/**
 * Convert more0-ensure WaitForEvent states to AWS ASL-compatible Task+Choice.
 * Resource stays non-ARN: states.waitForTaskToken (allowed exception).
 *
 * Usage: node scripts/normalize-ensure-asl.mjs [path...]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const LOG = "scripts/normalize-ensure-asl.mjs";
const WAIT_RESOURCE = "states.waitForTaskToken";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name === "asl.json") out.push(full);
  }
  return out;
}

function filterEquals(path, expected) {
  if (typeof expected === "boolean") {
    return { Variable: path, BooleanEquals: expected };
  }
  if (typeof expected === "number") {
    return { Variable: path, NumericEquals: expected };
  }
  return { Variable: path, StringEquals: String(expected) };
}

function choiceRuleForPattern(pattern) {
  const parts = [
    filterEquals("$.event.eventType", pattern.eventType),
  ];
  if (pattern.filter && typeof pattern.filter === "object") {
    for (const [key, expected] of Object.entries(pattern.filter)) {
      // more0-ensure matched filter keys against event.payload
      parts.push(filterEquals(`$.event.payload.${key}`, expected));
    }
  }
  const rule =
    parts.length === 1
      ? { ...parts[0], Next: pattern.Next }
      : { And: parts, Next: pattern.Next };
  return rule;
}

function convertState(name, state, states) {
  if (state.Type !== "WaitForEvent") return false;

  const patterns = Array.isArray(state.EventPatterns) ? state.EventPatterns : [];
  if (patterns.length === 0) {
    throw new Error(`${LOG}: ${name} has WaitForEvent with no EventPatterns`);
  }

  const routeName = `${name}__Route`;
  if (states[routeName]) {
    throw new Error(`${LOG}: route state already exists: ${routeName}`);
  }

  const waitParams = {
    eventPatterns: patterns.map(({ eventType, filter }) => {
      const p = { eventType };
      if (filter) p.filter = filter;
      return p;
    }),
  };

  const task = {
    Type: "Task",
    Resource: WAIT_RESOURCE,
    Parameters: waitParams,
    ResultPath: "$.event",
    Next: routeName,
  };
  if (state.Comment) task.Comment = state.Comment;
  if (state.TimeoutSeconds) task.TimeoutSeconds = state.TimeoutSeconds;
  if (state.TimeoutNext) {
    task.Catch = [
      {
        ErrorEquals: ["States.Timeout"],
        ResultPath: "$.eventTimeout",
        Next: state.TimeoutNext,
      },
    ];
  }

  const choices = patterns.map(choiceRuleForPattern);
  const choice = {
    Type: "Choice",
    Comment: `Route resume payload for ${name}`,
    Choices: choices,
    // Unmatched resume → wait again (preserves ensure "still waiting" semantics)
    Default: name,
  };

  states[name] = task;
  states[routeName] = choice;
  return true;
}

function convertFile(path) {
  const raw = readFileSync(path, "utf8");
  const def = JSON.parse(raw);
  if (!def.States || typeof def.States !== "object") {
    console.log(`${LOG}: skip ${path} (no States)`);
    return 0;
  }

  let converted = 0;
  // Snapshot keys so we don't iterate newly added route states.
  for (const name of Object.keys(def.States)) {
    if (convertState(name, def.States[name], def.States)) converted += 1;
  }

  if (converted > 0) {
    writeFileSync(path, `${JSON.stringify(def, null, 2)}\n`, "utf8");
  }
  console.log(`${LOG}: ${path} — converted ${converted} WaitForEvent state(s)`);
  return converted;
}

const roots = process.argv.slice(2);
const files =
  roots.length > 0
    ? roots
    : walk("apps/api/more0/ensure/definitions");

let total = 0;
for (const f of files) total += convertFile(f);
console.log(`${LOG}: done, ${total} state(s) converted across ${files.length} file(s)`);
