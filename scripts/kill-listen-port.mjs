import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const out = { label: 'dev', defaultPort: NaN, port: NaN, cwd: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--label') out.label = argv[++i] ?? out.label;
    else if (arg === '--default-port') out.defaultPort = Number.parseInt(argv[++i] ?? '', 10);
    else if (arg === '--port') out.port = Number.parseInt(argv[++i] ?? '', 10);
    else if (arg === '--cwd') out.cwd = resolve(argv[++i] ?? process.cwd());
  }
  return out;
}

export function loadPort({ cwd = process.cwd(), defaultPort, port } = {}) {
  if (Number.isFinite(port) && port > 0) {
    return port;
  }

  const fromEnv = Number.parseInt(process.env.PORT ?? '', 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }

  const envPath = resolve(cwd, '.env');
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf8').match(/^\s*PORT\s*=\s*(\d+)\s*$/m);
    if (match) {
      return Number.parseInt(match[1], 10);
    }
  }

  if (Number.isFinite(defaultPort) && defaultPort > 0) {
    return defaultPort;
  }

  throw new Error('[killListenPort] no port: set PORT, --port, or --default-port');
}

function localAddressHasPort(localAddress, port) {
  return localAddress.endsWith(`:${port}`) || localAddress.endsWith(`]:${port}`);
}

export function pidsListeningOnPort(port) {
  if (process.platform === 'win32') {
    const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) {
        continue;
      }
      const parts = line.trim().split(/\s+/);
      const localAddress = parts[1] ?? '';
      const pid = parts[parts.length - 1];
      if (!localAddressHasPort(localAddress, port)) {
        continue;
      }
      if (!pid || pid === '0' || pid === '4') {
        continue;
      }
      pids.add(pid);
    }
    return [...pids];
  }

  try {
    const out = execFileSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], {
      encoding: 'utf8',
    });
    return out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function killPidTree(pid) {
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    return;
  }

  try {
    process.kill(Number(pid), 'SIGTERM');
  } catch {
    // already gone
  }
}

export function killListenPort(port, label = 'dev') {
  const logPrefix = `[${label}.killListenPort]`;
  const pids = pidsListeningOnPort(port);
  if (pids.length === 0) {
    console.log(`${logPrefix} nothing listening on port ${port}`);
    return [];
  }

  console.log(`${logPrefix} killing listener(s) on port ${port}: ${pids.join(', ')}`);
  for (const pid of pids) {
    try {
      killPidTree(pid);
    } catch (err) {
      console.warn(`${logPrefix} failed to kill pid ${pid}: ${err.message}`);
    }
  }

  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (pidsListeningOnPort(port).length === 0) {
      return pids;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }

  const remaining = pidsListeningOnPort(port);
  if (remaining.length > 0) {
    throw new Error(`${logPrefix} port ${port} still in use by pid(s) ${remaining.join(', ')}`);
  }
  return pids;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    killListenPort(loadPort(opts), opts.label);
  } catch (err) {
    console.error(err.message ?? err);
    process.exit(1);
  }
}
