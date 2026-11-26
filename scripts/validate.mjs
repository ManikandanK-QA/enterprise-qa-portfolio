import { spawnSync } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['.git', 'node_modules', 'reports', 'site']);

const required = [
  'README.md',
  'LICENSE',
  'NOTICE.md',
  'docs/architecture.md',
  'docs/test-strategy.md',
  'docs/ci.md',
  'apps/opsboard/server.mjs',
  'apps/opsboard/public/index.html',
  'scripts/config.js',
  'scripts/checks.js',
  'scripts/summary.js',
  'scripts/profiles/smoke.js',
  'scripts/profiles/load.js',
  'scripts/profiles/stress.js',
  '.github/workflows/ci.yml',
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

let failed = false;

for (const relative of required) {
  try {
    await stat(path.join(root, relative));
  } catch {
    console.error(`MISSING required file: ${relative}`);
    failed = true;
  }
}

for (const file of await walk(root)) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error(`SYNTAX FAIL ${path.relative(root, file)}`);
    console.error(result.stderr.trim());
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('validate: required files present and all JavaScript parses');
