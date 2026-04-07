#!/usr/bin/env node
/**
 * Appends a work-hours block to docs/tracking/work_hours.md when Estimated-hours (or Work-hours)
 * is present in the commit message. See .cursor/rules/work-hours-tracking.mdc for
 * estimation rules, invoice-style Work-summary guidance, and logging conventions.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG = "append-work-hours.mjs";

const MIN_DESC_LINES = 5;
const MAX_DESC_LINES = 7;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const trackingRel = path.join("docs", "tracking", "work_hours.md");
const trackingFile = path.join(repoRoot, trackingRel);

function git(formatArgs) {
  return execSync(`git ${formatArgs}`, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  }).trimEnd();
}

function logSkip(reason) {
  console.error(`[${PKG}] ${reason}`);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Safe for inline markdown: backticks flattened; keep newlines for Work-summary paths. */
function escMdInline(s) {
  return s.replace(/`/g, "'").trim();
}

function normalizeOneLine(s) {
  return s.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n+/g, " ").trim();
}

function stripTrailerLines(text) {
  return text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (/^(Estimated-hours|Work-hours|Work-hours-logged|Made-with):/i.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

function removeWorkSummaryBlock(text) {
  return text
    .replace(
      /^\s*Work-summary:\s*[\s\S]*?(?=^\s*(?:Estimated-hours|Work-hours)\s*:)/im,
      "",
    )
    .trim();
}

/** Target description lines (5–7) from estimated hours. */
function hoursToTargetLines(hoursStr) {
  const n = parseFloat(hoursStr, 10);
  if (Number.isNaN(n) || n <= 1.5) return 5;
  if (n <= 8) return 6;
  return 7;
}

function splitSentences(text) {
  const t = normalizeOneLine(text);
  if (!t) return [];
  const parts = t.split(/(?<=[.!?])\s+(?=[A-Z(`*0-9])/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function mergeLinesToCount(lines, target) {
  const L = lines.map((l) => escMdInline(l)).filter(Boolean);
  if (L.length <= target) return L;
  const out = [];
  const n = L.length;
  let i = 0;
  for (let k = 0; k < target; k++) {
    const restSlots = target - k;
    const restItems = n - i;
    const take = Math.max(1, Math.ceil(restItems / restSlots));
    out.push(L.slice(i, i + take).join(" "));
    i += take;
  }
  return out;
}

function distributeSentencesToLines(sentences, lineCount) {
  if (sentences.length === 0) return [];
  if (lineCount <= 0) return [];
  const out = [];
  let i = 0;
  const n = sentences.length;
  for (let k = 0; k < lineCount; k++) {
    const restSlots = lineCount - k;
    const restItems = n - i;
    const take = Math.max(1, Math.ceil(restItems / restSlots));
    out.push(sentences.slice(i, i + take).join(" "));
    i += take;
  }
  return out.map((l) => l.trim()).filter(Boolean);
}

/** Split the longest line by sentences or at a space to increase line count. */
function splitLongestLine(lines) {
  let idx = 0;
  let max = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > max) {
      max = lines[i].length;
      idx = i;
    }
  }
  const parts = splitSentences(lines[idx]);
  if (parts.length >= 2) {
    const mid = Math.ceil(parts.length / 2);
    const next = [...lines];
    next.splice(
      idx,
      1,
      parts.slice(0, mid).join(" "),
      parts.slice(mid).join(" "),
    );
    return next;
  }
  const s = lines[idx];
  if (s.length < 80) return lines;
  const mid = Math.floor(s.length / 2);
  const cut = s.lastIndexOf(" ", mid);
  const at = cut > 50 ? cut : mid;
  const next = [...lines];
  next.splice(idx, 1, s.slice(0, at).trim(), s.slice(at).trim());
  return next;
}

/** Re-pack all text into exactly `target` lines (subject kept bold on line 1). */
function redistributeIntoLines(lines, subject, target) {
  const subjEsc = escMdInline(subject);
  const blob = lines
    .join(" ")
    .replace(/^\*\*[^*]+\*\*\s*/i, "")
    .trim();
  const sents = splitSentences(blob);
  const all =
    sents.length > 0
      ? sents
      : [
          "(No billable narrative in commit body; add an invoice-style Work-summary next time.)",
        ];
  const first = `**${subjEsc}.** ${escMdInline(all[0])}`;
  const tailSlots = Math.max(0, target - 1);
  const tail =
    all.length > 1 && tailSlots > 0
      ? distributeSentencesToLines(
          all.slice(1).map((x) => escMdInline(x)),
          tailSlots,
        )
      : [];
  let L = [first, ...tail].filter(Boolean);
  if (L.length > target) L = mergeLinesToCount(L, target);
  let guard = 0;
  while (L.length < target && guard++ < 24) {
    const n = L.length;
    L = splitLongestLine(L);
    if (L.length === n) break;
    if (L.length > target) L = mergeLinesToCount(L, target);
  }
  return mergeLinesToCount(L, target);
}

/**
 * @param {string} subject
 * @param {string | null} narrativeBody - plain text (no Work-summary wrapper)
 * @param {string} hoursStr
 * @param {string[] | null} explicitLines - from multi-line Work-summary (already split)
 */
function buildDescriptionLines(subject, narrativeBody, hoursStr, explicitLines) {
  const target = Math.min(
    MAX_DESC_LINES,
    Math.max(MIN_DESC_LINES, hoursToTargetLines(hoursStr)),
  );
  const subjEsc = escMdInline(subject);

  let lines;
  if (explicitLines && explicitLines.length > 0) {
    lines = explicitLines.map((l) => escMdInline(l.trim())).filter(Boolean);
    if (lines.length && !lines[0].startsWith("**")) {
      lines[0] = `**${subjEsc}.** ${lines[0]}`;
    }
  } else {
    const sents = splitSentences(narrativeBody || "");
    const fallback = sents.length
      ? sents
      : [
          "(Add a 5–7 line invoice-style Work-summary before Estimated-hours.)",
        ];
    const firstLine = `**${subjEsc}.** ${escMdInline(fallback[0])}`;
    const tailSlots = Math.max(0, target - 1);
    const tail =
      fallback.length > 1 && tailSlots > 0
        ? distributeSentencesToLines(
            fallback.slice(1).map((s) => escMdInline(s)),
            tailSlots,
          )
        : [];
    lines = [firstLine, ...tail].filter(Boolean);
  }

  if (lines.length > target) {
    lines = mergeLinesToCount(lines, target);
  }

  let guard = 0;
  while (lines.length < target && guard++ < 16) {
    const before = lines.length;
    lines = splitLongestLine(lines);
    if (lines.length === before) {
      lines = redistributeIntoLines(lines, subject, target);
      break;
    }
    if (lines.length > target) {
      lines = mergeLinesToCount(lines, target);
    }
  }

  if (lines.length < target) {
    lines = redistributeIntoLines(lines, subject, target);
  }

  return mergeLinesToCount(lines, target);
}

function extractWorkSummaryRaw(fullBody) {
  const m = fullBody.match(
    /^\s*Work-summary:\s*([\s\S]+?)(?=^\s*(?:Estimated-hours|Work-hours)\s*:)/im,
  );
  if (!m) return null;
  return m[1].trim();
}

function buildNarrativeBody(subject, fullBody) {
  const wsRaw = extractWorkSummaryRaw(fullBody);
  if (wsRaw) {
    if (/\n/.test(wsRaw)) {
      return {
        explicitLines: wsRaw
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean),
        narrativeBody: null,
      };
    }
    return { explicitLines: null, narrativeBody: normalizeOneLine(wsRaw) };
  }

  let afterSubject = fullBody;
  const subjRe = new RegExp(
    "^" + escapeRegex(subject) + "\\s*(?:\n|$)",
    "m",
  );
  if (subjRe.test(afterSubject)) {
    afterSubject = afterSubject.replace(subjRe, "");
  } else {
    afterSubject = afterSubject.replace(/^[^\n]+\n?/, "");
  }
  afterSubject = removeWorkSummaryBlock(afterSubject);
  afterSubject = stripTrailerLines(afterSubject);
  return { explicitLines: null, narrativeBody: normalizeOneLine(afterSubject) };
}

function main() {
  let hash;
  let fullBody;
  let subject;
  let dateIso;
  try {
    hash = git("rev-parse --short HEAD");
    fullBody = git("log -1 --format=%B");
    subject = git("log -1 --format=%s");
    dateIso = git("log -1 --format=%cI");
  } catch (e) {
    logSkip(`Skip: not a git repository or no commits (${e?.message ?? e}).`);
    return;
  }

  if (/^\s*Work-hours-logged:\s*true\s*$/im.test(fullBody)) {
    logSkip("Skip: Work-hours-logged: true — entry was written by the agent before commit.");
    return;
  }

  const hoursRe =
    /^\s*(?:Estimated-hours|Work-hours):\s*([0-9]+(?:\.[0-9]+)?)\s*$/im;
  const hoursMatch = fullBody.match(hoursRe);
  if (!hoursMatch) {
    logSkip(
      'Skip: add "Estimated-hours: <n>" (or Work-hours) to the commit body to log this commit.',
    );
    return;
  }
  const hours = hoursMatch[1];

  if (!fs.existsSync(trackingFile)) {
    logSkip(`Skip: missing ${trackingRel}; create it before logging.`);
    return;
  }

  const existing = fs.readFileSync(trackingFile, "utf8");
  const hashToken = `\`${hash}\``;
  if (existing.includes(hashToken)) {
    logSkip(`Skip: commit ${hash} already recorded.`);
    return;
  }

  const { explicitLines, narrativeBody } = buildNarrativeBody(subject, fullBody);
  const descLines = buildDescriptionLines(
    subject,
    narrativeBody,
    hours,
    explicitLines,
  );

  const datePart = dateIso.includes("T") ? dateIso.split("T")[0] : dateIso;
  const bodyIndented = descLines.map((l) => `  ${l}`).join("\n");
  const block = `- \`${datePart}\` ${hashToken} **${hours} h**  \n${bodyIndented}\n\n`;

  const sep = existing.length > 0 && !/\n$/.test(existing) ? "\n" : "";
  fs.appendFileSync(trackingFile, sep + block, "utf8");
  console.error(`[${PKG}] Appended work entry for ${hash} (${hours} h).`);
}

main();
