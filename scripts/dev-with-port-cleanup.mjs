import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import {
  killListenPort,
  killPidTree,
  loadPort,
} from './kill-listen-port.mjs';

function parseArgs(argv) {
  const dashIdx = argv.indexOf('--');
  const flags = dashIdx === -1 ? argv : argv.slice(0, dashIdx);
  const command = dashIdx === -1 ? [] : argv.slice(dashIdx + 1);
  const out = {
    label: 'dev',
    defaultPort: NaN,
    port: NaN,
    resolveTarget: null,
    cwd: process.cwd(),
    command,
  };

  for (let i = 0; i < flags.length; i += 1) {
    const arg = flags[i];
    if (arg === '--label') out.label = flags[++i] ?? out.label;
    else if (arg === '--default-port') out.defaultPort = Number.parseInt(flags[++i] ?? '', 10);
    else if (arg === '--port') out.port = Number.parseInt(flags[++i] ?? '', 10);
    else if (arg === '--cwd') out.cwd = resolve(flags[++i] ?? process.cwd());
    else if (arg === '--resolve') out.resolveTarget = flags[++i] ?? null;
  }

  return out;
}

const opts = parseArgs(process.argv.slice(2));
const logPrefix = `[${opts.label}.devWatch]`;
const port = loadPort(opts);

killListenPort(port, opts.label);

let spawnFile = opts.command[0];
let spawnArgs = opts.command.slice(1);

if (opts.resolveTarget) {
  const require = createRequire(resolve(opts.cwd, 'package.json'));
  spawnFile = process.execPath;
  spawnArgs = [require.resolve(opts.resolveTarget), ...opts.command];
}

if (!spawnFile) {
  console.error(`${logPrefix} missing command after --`);
  process.exit(1);
}

console.log(`${logPrefix} starting ${[spawnFile, ...spawnArgs].join(' ')} (port ${port})`);

const child = spawn(spawnFile, spawnArgs, {
  cwd: opts.cwd,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`${logPrefix} ${signal} — stopping process tree`);

  if (child.pid) {
    try {
      killPidTree(child.pid);
    } catch {
      // child may already have exited
    }
  }

  try {
    killListenPort(port, opts.label);
  } catch {
    // best-effort; next start will retry
  }

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGHUP', () => shutdown('SIGHUP'));

child.on('exit', (code, signal) => {
  if (shuttingDown) {
    return;
  }
  if (signal) {
    console.log(`${logPrefix} child exited via ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error(`${logPrefix} failed to start: ${err.message}`);
  process.exit(1);
});
