import { build, context } from 'esbuild';
import fs from 'node:fs';

// clean old chunks so stale hashed files do not pile up
fs.rmSync('public/chunks', { recursive: true, force: true });

const options = {
  entryPoints: { client: 'client/main.ts' },
  outdir: 'public',
  bundle: true,
  // ES modules + splitting: Mermaid (large) is a separate chunk, fetched only when a page has a Mermaid diagram
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  target: 'es2022',
  sourcemap: true,
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
