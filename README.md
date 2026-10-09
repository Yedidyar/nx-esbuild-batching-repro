# esbuild entry point batching repro

Reproduces the memory growth described in [nrwl/nx#37369](https://github.com/nrwl/nx/issues/37369):
passing thousands of entry points to a single esbuild call (what `@nx/esbuild:esbuild` does with
`bundle: false`) uses memory in proportion to the number of entry points. Splitting them into
sequential builds of 500 keeps memory flat. The proposed fix is in
[nrwl/nx#37339](https://github.com/nrwl/nx/pull/37339).

`measure-nx.mjs` shows the problem through the executor. `measure.mjs` and `verify.mjs` call esbuild directly to show the root cause and that batching does not change the output.

## Setup

pnpm 12.4.2 (via `packageManager`), Nx 23.3.0, `@nx/esbuild` 23.3.0, esbuild 0.25.12.

```bash
pnpm install
```

## Reproduce through the `@nx/esbuild` executor

`apps/big-app` is built with `@nx/esbuild:esbuild`, `bundle: false`, `format: ["esm"]`.

```bash
node generate-app.mjs 15000   # generate N small TypeScript files under apps/big-app/src
node measure-nx.mjs           # runs `nx build big-app` and prints peak memory of the process tree
```

The installed `@nx/esbuild` version is printed in the result, so the same script can be used to
compare a build that includes the batching fix against a release that does not.

## Reproduce the root cause with esbuild directly

```bash
node generate.mjs 5000   # generate N small TypeScript files under src/
node measure.mjs         # build once with all entry points, then in batches of 500
```

`measure.mjs` runs each mode in its own child process and samples the summed RSS of that process
tree every 20 ms, so the numbers are approximate. It also checks that both modes write the same
file layout (both set `outbase: 'src'`).

## Verify the output is the same

```bash
node verify.mjs
```

Builds 1,300 generated files once in a single call and once in batches of 500, then compares the
file paths and the SHA-256 of every output file. It also runs a control without a shared `outbase`,
which must produce different output. That control is why the fix in nrwl/nx sets `outbase` on every
batch. Exit code is non-zero if any check fails.

```
PASS  single call wrote 1300 files
PASS  batched (shared outbase): same file paths as single call
PASS  batched (shared outbase): identical bytes for every file
PASS  control (no outbase): output differs, which is why the fix sets outbase
```

## Results

Apple M4 Pro, 48 GB RAM, macOS (arm64), Node 24.19.0. One run per row.

Through the `@nx/esbuild` executor (released 23.3.0, no batching):

| Files  | Peak memory | Time   |
| ------ | ----------- | ------ |
| 5,000  | 4,770 MB    | 2.7 s  |
| 15,000 | 11,652 MB   | 16.0 s |

esbuild called directly (esbuild 0.25.12), one call vs. batches of 500:

| Files  | Mode            | Peak memory | Time   |
| ------ | --------------- | ----------- | ------ |
| 5,000  | single call     | 3,733 MB    | 1.8 s  |
| 5,000  | batches of 500  | 340 MB      | 0.8 s  |
| 15,000 | single call     | 11,553 MB   | 11.7 s |
| 15,000 | batches of 500  | 343 MB      | 2.2 s  |

Output layout was identical in both modes.
