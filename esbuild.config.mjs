import { build, context } from 'esbuild';

const options = {
  entryPoints: { client: 'client/main.ts' },
  outdir: 'public',
  bundle: true,
  format: 'iife',
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
