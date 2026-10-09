// Measures peak RSS (process tree) of `nx build big-app` through the real @nx/esbuild executor.
// Run `node generate-app.mjs <N>` first. The installed @nx/esbuild decides whether batching applies.
import { spawn, execFileSync } from 'node:child_process';

function treeRssKb(rootPid) {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='])
    .toString().trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
  const kids = new Map();
  const rss = new Map();
  for (const [pid, ppid, r] of rows) {
    rss.set(pid, r);
    if (!kids.has(ppid)) kids.set(ppid, []);
    kids.get(ppid).push(pid);
  }
  let total = 0;
  const stack = [rootPid];
  while (stack.length) {
    const p = stack.pop();
    total += rss.get(p) ?? 0;
    stack.push(...(kids.get(p) ?? []));
  }
  return total;
}

const child = spawn('pnpm', ['nx', 'build', 'big-app', '--skip-nx-cache'], {
  stdio: 'inherit',
  env: { ...process.env, NX_DAEMON: 'false' },
});
let peak = 0;
const timer = setInterval(() => { peak = Math.max(peak, treeRssKb(child.pid)); }, 20);
const start = Date.now();
const code = await new Promise((r) => child.on('exit', r));
clearInterval(timer);
const version = JSON.parse(
  (await import('node:fs')).readFileSync('node_modules/@nx/esbuild/package.json', 'utf8')
).version;
console.table([{ '@nx/esbuild': version, peakMb: Math.round(peak / 1024), seconds: ((Date.now() - start) / 1000).toFixed(1), exit: code }]);
process.exit(code ?? 1);
