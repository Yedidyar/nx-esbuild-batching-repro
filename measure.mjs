// Compares peak RSS of one esbuild call with all entry points vs sequential batches of 500.
// Each mode runs in its own child process so peak RSS is not shared. esbuild runs as a child
// process too, so RSS is read from its process tree via `ps` sampling.
import { spawn, execFileSync } from 'node:child_process';
import { readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BATCH = 500;

function listFiles(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

async function build(mode) {
  const { build } = await import('esbuild');
  const entryPoints = listFiles('src');
  const base = { bundle: false, format: 'esm', outdir: `dist-${mode}`, outbase: 'src', logLevel: 'error' };
  if (mode === 'single') {
    await build({ ...base, entryPoints });
  } else {
    for (let i = 0; i < entryPoints.length; i += BATCH) {
      await build({ ...base, entryPoints: entryPoints.slice(i, i + BATCH) });
    }
  }
  console.log(`built ${entryPoints.length} files`);
}

function treeRssKb(rootPid) {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=']).toString().trim().split('\n')
    .map((l) => l.trim().split(/\s+/).map(Number));
  const kids = new Map();
  for (const [pid, ppid, rss] of rows) {
    if (!kids.has(ppid)) kids.set(ppid, []);
    kids.get(ppid).push({ pid, rss });
  }
  const rss = new Map(rows.map(([pid, , r]) => [pid, r]));
  let total = 0;
  const stack = [rootPid];
  while (stack.length) {
    const p = stack.pop();
    total += rss.get(p) ?? 0;
    for (const k of kids.get(p) ?? []) stack.push(k.pid);
  }
  return total;
}

async function run(mode) {
  rmSync(`dist-${mode}`, { recursive: true, force: true });
  const child = spawn(process.execPath, [new URL(import.meta.url).pathname, '--child', mode], { stdio: 'inherit' });
  let peak = 0;
  const timer = setInterval(() => { peak = Math.max(peak, treeRssKb(child.pid)); }, 20);
  const start = Date.now();
  await new Promise((r) => child.on('exit', r));
  clearInterval(timer);
  return { mode, peakMb: Math.round(peak / 1024), seconds: ((Date.now() - start) / 1000).toFixed(1) };
}

if (process.argv[2] === '--child') {
  await build(process.argv[3]);
} else {
  const results = [];
  for (const mode of ['single', 'batched']) results.push(await run(mode));
  console.table(results);
  const a = listFiles('dist-single').sort().map((f) => f.replace('dist-single', ''));
  const b = listFiles('dist-batched').sort().map((f) => f.replace('dist-batched', ''));
  console.log('same output layout:', JSON.stringify(a) === JSON.stringify(b));
}
