// Generates N small TypeScript files under apps/big-app/src, like a large non-bundled project.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const total = Number(process.argv[2] ?? 5000);
const root = 'apps/big-app/src';
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
writeFileSync(join(root, 'main.ts'), `console.log('big-app');\n`);
for (let i = 0; i < total; i++) {
  const dir = join(root, `feature-${i % 50}`, `lib-${i % 7}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `file-${i}.ts`),
    `export const value${i}: number = ${i};\nexport const get${i} = (x: number): number => x + value${i};\n`
  );
}
console.log(`generated ${total + 1} files under ${root}`);
