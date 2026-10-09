// Generates N small TypeScript files across nested folders, like a large non-bundled project.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const total = Number(process.argv[2] ?? 5000);
rmSync('src', { recursive: true, force: true });
for (let i = 0; i < total; i++) {
  const dir = join('src', `feature-${i % 50}`, `lib-${i % 7}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `file-${i}.ts`),
    `export interface Item${i} { id: number; name: string }\n` +
      `export function create${i}(id: number): Item${i} {\n` +
      `  return { id, name: 'item-${i}-' + id };\n}\n` +
      `export const value${i} = create${i}(${i});\n`
  );
}
console.log(`generated ${total} files under src/`);
