# esbuild entry point batching repro

Reproduces the memory growth described in [nrwl/nx#37369](https://github.com/nrwl/nx/issues/37369):
passing thousands of entry points to a single esbuild call (what `@nx/esbuild:esbuild` does with
`bundle: false`) uses memory in proportion to the number of entry points. Splitting them into
sequential builds of 500 keeps memory flat. The proposed fix is in
[nrwl/nx#37339](https://github.com/nrwl/nx/pull/37339).

This script calls esbuild directly. It demonstrates the root cause, not the `@nx/esbuild` executor.

## Run

```bash
npm install
node generate.mjs 5000   # generate N small TypeScript files under src/
node measure.mjs         # build once with all entry points, then in batches of 500
```

`measure.mjs` runs each mode in its own child process and samples the summed RSS of that process
tree every 20 ms, so the numbers are approximate. It also checks that both modes write the same
file layout (both set `outbase: 'src'`).

## Results

Apple M4 Pro, 48 GB RAM, macOS (arm64), Node 24.19.0, esbuild 0.25.12. One run per row.

| Files  | Mode            | Peak memory | Time   |
| ------ | --------------- | ----------- | ------ |
| 5,000  | single call     | 3,733 MB    | 1.8 s  |
| 5,000  | batches of 500  | 340 MB      | 0.8 s  |
| 15,000 | single call     | 11,553 MB   | 11.7 s |
| 15,000 | batches of 500  | 343 MB      | 2.2 s  |

Output layout was identical in both modes.
