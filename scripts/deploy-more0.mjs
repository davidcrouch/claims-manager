/**
 * Deploy more0 definitions via the public HTTP gateway (not registry/NATS).
 *
 * Env:
 *   GATEWAY_URL, AUTH_SERVER_URL, MORE0_CLIENT_ID, MORE0_CLIENT_SECRET (required)
 *   DEFINITIONS_DIR (default: apps/api/more0/definitions)
 *   MORE0_VERSION (default: 0.0.0)
 *   MORE0_TARGET_REVISION (default: immutable)
 *   MORE0_DRY_RUN (default: false)
 *   MORE0_CONFLICT_STRATEGY (default: overwrite)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const LOG = "scripts/deploy-more0.mjs";

const definitionsDir = resolve(
  process.env.DEFINITIONS_DIR ?? "./apps/api/more0/definitions",
);
const gatewayUrl = process.env.GATEWAY_URL;
const authServerUrl = process.env.AUTH_SERVER_URL;
const clientId = process.env.MORE0_CLIENT_ID;
const clientSecret = process.env.MORE0_CLIENT_SECRET;
const version = process.env.MORE0_VERSION ?? "0.0.0";
const dryRun = process.env.MORE0_DRY_RUN === "true";
const target = process.env.MORE0_TARGET_REVISION ?? "immutable";
const conflictStrategy = process.env.MORE0_CONFLICT_STRATEGY ?? "overwrite";

if (!gatewayUrl || !authServerUrl || !clientId || !clientSecret) {
  console.error(
    `${LOG}: Missing GATEWAY_URL, AUTH_SERVER_URL, MORE0_CLIENT_ID, or MORE0_CLIENT_SECRET`,
  );
  process.exit(1);
}

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, base));
    } else {
      out.push({
        path: relative(base, full).replaceAll("\\", "/"),
        content: readFileSync(full, "utf8"),
      });
    }
  }
  return out;
}

async function token() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "registry:admin registry:read capability:invoke",
  });
  const res = await fetch(`${authServerUrl.replace(/\/$/, "")}/token`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`${LOG}:token ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`${LOG}:token no access_token in response`);
  }
  return json.access_token;
}

const files = walk(definitionsDir);
console.log(
  `${LOG}: importing ${files.length} files from ${definitionsDir} ` +
    `(target=${target} version=${version} dry_run=${dryRun})`,
);

const accessToken = await token();
const importUrl = `${gatewayUrl.replace(/\/$/, "")}/api/v1/registry/import`;
const res = await fetch(importUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({
    target_revision: target,
    version,
    conflict_strategy: conflictStrategy,
    dry_run: dryRun,
    files,
  }),
});

const text = await res.text();
let result;
try {
  result = JSON.parse(text);
} catch {
  throw new Error(`${LOG}:import ${res.status}: non-JSON response: ${text}`);
}

console.log(JSON.stringify(result, null, 2));

if (!res.ok) {
  console.error(`${LOG}:import failed with HTTP ${res.status}`);
  process.exit(1);
}
if (result.errors?.length) {
  console.error(`${LOG}:import reported ${result.errors.length} error(s)`);
  process.exit(1);
}

console.log(
  `${LOG}: ok app_key=${result.app_key ?? "(none)"} imported=${result.imported?.length ?? 0}`,
);
