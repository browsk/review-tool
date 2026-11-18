import { test as base, expect } from '@playwright/test';

/** Global guard: fail any test that makes a request to a non-local origin. */
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const external: string[] = [];
    const origin = new URL(baseURL!).origin;
    page.on('request', (req) => {
      const u = req.url();
      if (u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:')) return;
      if (!u.startsWith(origin)) external.push(u);
    });
    await use(page);
    expect(external, 'external network requests').toEqual([]);
  },
});
export { expect };
