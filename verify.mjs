// Proves batched output equals single-call output: same files, same bytes.
// Also runs a control without a shared `outbase` to show why the fix sets one.
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { build } from 'esbuild';

const BATCH = 500;
const TOTAL = 1300; // 3 batches
const SRC = 'verify-src';

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  }).sort();
}

function snapshot(dir) {
  return Object.fromEntries(
    files(dir).map((f) => [
      relative(dir, f),
      createHash('sha256').update(readFileSync(f)).digest('hex'),
    ])
  );
}

const entries = [];

function fixture() {
  rmSync(SRC, { recursive: true, force: true });
  entries.length = 0;
  // Entry order matters: early batches span many folders, the last batch holds only files from
  // one deep folder, so without a shared outbase it would lose that folder's prefix.
  for (let i = 0; i < TOTAL; i++) {
    const dir = i < 1000 ? join(SRC, `feature-${i % 20}`, `lib-${i % 5}`) : join(SRC, 'tail', 'deep');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `file-${i}.ts`);
    writeFileSync(file, `export const v${i}: number = ${i};\nexport const f${i} = (x: number): number => x + v${i};\n`);
    entries.push(file);
  }
}

async function run(outdir, { batched, outbase }) {
  rmSync(outdir, { recursive: true, force: true });
  const entryPoints = [...entries];
  const base = { bundle: false, format: 'esm', outdir, logLevel: 'error', ...(outbase && { outbase }) };
  if (!batched) return build({ ...base, entryPoints });
  for (let i = 0; i < entryPoints.length; i += BATCH) {
    await build({ ...base, entryPoints: entryPoints.slice(i, i + BATCH) });
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let failed = false;
function check(name, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed = true;
}

fixture();
await run('verify-single', { batched: false });
await run('verify-batched', { batched: true, outbase: SRC });
await run('verify-batched-no-outbase', { batched: true });

const single = snapshot('verify-single');
const batched = snapshot('verify-batched');
const control = snapshot('verify-batched-no-outbase');

check(`single call wrote ${Object.keys(single).length} files`, Object.keys(single).length === TOTAL);
check('batched (shared outbase): same file paths as single call', same(Object.keys(single), Object.keys(batched)));
check('batched (shared outbase): identical bytes for every file', same(single, batched));
check('control (no outbase): output differs, which is why the fix sets outbase', !same(single, control));

for (const d of ['verify-single', 'verify-batched', 'verify-batched-no-outbase', SRC]) {
  rmSync(d, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
