import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profiles = new Set(['smoke', 'load', 'stress']);
const profile = process.argv[2];

if (!profiles.has(profile)) {
  console.error(`Usage: node scripts/run-profile.mjs <${[...profiles].join('|')}>`);
  process.exit(64);
}

const port = process.env.PORT ?? '8085';
const baseUrl = process.env.BASE_URL ?? `http://127.0.0.1:${port}`;
const k6Bin = process.env.K6_BIN ?? 'k6';

let serverLog = '';
const server = spawn(process.execPath, ['apps/opsboard/server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: port },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
server.stdout.on('data', (chunk) => {
  serverLog += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverLog += chunk.toString();
});

function stopServer() {
  if (!server.killed) server.kill();
}
process.once('exit', stopServer);
process.once('SIGINT', () => {
  stopServer();
  process.exit(130);
});

async function waitForReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Local target exited before becoming ready:\n${serverLog}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch {
      // Retry; the server may still be binding the port.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Local target at ${baseUrl} did not become ready:\n${serverLog}`);
}

function runK6() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      k6Bin,
      [
        'run',
        '--out',
        `json=reports/${profile}-raw.json`,
        `scripts/profiles/${profile}.js`,
      ],
      {
        cwd: root,
        env: { ...process.env, BASE_URL: baseUrl, PROFILE: profile },
        stdio: 'inherit',
      },
    );

    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (signal) resolve(1);
      else resolve(code ?? 1);
    });
  });
}

try {
  await mkdir(path.join(root, 'reports'), { recursive: true });
  await waitForReady();
  const exitCode = await runK6();
  process.exitCode = exitCode;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  stopServer();
}
