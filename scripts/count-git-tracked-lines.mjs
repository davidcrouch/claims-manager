#!/usr/bin/env node
/**
 * Count total lines across every file tracked by git (git ls-files).
 * Includes source, scripts, markdown, config, etc. Binary files are reported separately.
 *
 * Usage:
 *   node scripts/count-git-tracked-lines.mjs
 *   node scripts/count-git-tracked-lines.mjs --json
 *   node scripts/count-git-tracked-lines.mjs --by-extension
 *   pnpm run count-git-lines
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG = "count-git-tracked-lines.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const jsonOut = args.has("--json");
const byExtension = args.has("--by-extension") || jsonOut;

function log(message) {
  if (!jsonOut) {
    console.log(`[${PKG}] ${message}`);
  }
}

function gitLsFiles() {
  const raw = execSync("git ls-files -z", {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (raw.length === 0) return [];
  return raw
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

function isBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  return sample.includes(0);
}

/** Line count: POSIX-style (final line without newline still counts). */
function countTextLines(text) {
  if (text.length === 0) return 0;
  let lines = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") lines++;
  }
  if (!text.endsWith("\n")) lines++;
  return lines;
}

function extensionKey(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return ext || "(no extension)";
}

function countTrackedFiles() {
  const files = gitLsFiles();
  let totalLines = 0;
  let textFileCount = 0;
  let binaryFileCount = 0;
  let missingFileCount = 0;
  const byExt = new Map();

  for (const relPath of files) {
    const absPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absPath)) {
      missingFileCount++;
      continue;
    }

    const stat = fs.statSync(absPath);
    if (!stat.isFile()) continue;

    const buffer = fs.readFileSync(absPath);
    const ext = extensionKey(relPath);

    if (isBinary(buffer)) {
      binaryFileCount++;
      if (!byExt.has(ext)) byExt.set(ext, { files: 0, lines: 0, binaryFiles: 0 });
      const row = byExt.get(ext);
      row.files++;
      row.binaryFiles++;
      continue;
    }

    const lines = countTextLines(buffer.toString("utf8"));
    totalLines += lines;
    textFileCount++;

    if (!byExt.has(ext)) byExt.set(ext, { files: 0, lines: 0, binaryFiles: 0 });
    const row = byExt.get(ext);
    row.files++;
    row.lines += lines;
  }

  return {
    repoRoot,
    trackedFiles: files.length,
    textFileCount,
    binaryFileCount,
    missingFileCount,
    totalLines,
    byExtension: Object.fromEntries(
      [...byExt.entries()].sort((a, b) => b[1].lines - a[1].lines || a[0].localeCompare(b[0])),
    ),
  };
}

function main() {
  const result = countTrackedFiles();

  if (jsonOut) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  log(`Repository: ${result.repoRoot}`);
  log(`Tracked files (git ls-files): ${result.trackedFiles}`);
  log(`Text files counted: ${result.textFileCount}`);
  if (result.binaryFileCount > 0) {
    log(`Binary files skipped (0 lines): ${result.binaryFileCount}`);
  }
  if (result.missingFileCount > 0) {
    log(`Missing on disk (skipped): ${result.missingFileCount}`);
  }
  log(`Total lines: ${result.totalLines.toLocaleString()}`);

  if (byExtension) {
    console.log("");
    console.log("By extension (text lines only):");
    console.log("  extension          files    lines");
    for (const [ext, row] of Object.entries(result.byExtension)) {
      const label = ext.padEnd(18);
      const files = String(row.files).padStart(6);
      const lines = String(row.lines).padStart(8);
      const binaryNote = row.binaryFiles ? ` (${row.binaryFiles} binary)` : "";
      console.log(`  ${label}${files}${lines}${binaryNote}`);
    }
  }
}

try {
  main();
} catch (err) {
  console.error(`[${PKG}] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
