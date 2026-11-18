import fs from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { D2Service, D2_VERSION, chooseLayout, parseD2Error } from '../../src/diagrams/d2.js';
import { cssIsSafe, sanitizeSvg } from '../../src/diagrams/svg.js';
import { renderersFor } from '../../src/diagrams/registry.js';
import { DEFAULT_DIAGRAM_SETTINGS } from '../../src/diagrams/types.js';

describe('SVG sanitiser', () => {
  const evil = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="alert(1)">
    <script>alert(2)</script>
    <foreignObject><iframe src="https://evil.example/x"></iframe><div onclick="x()">html</div></foreignObject>
    <a href="javascript:alert(3)"><text>link text</text></a>
    <a xlink:href="https://evil.example/page"><rect width="5" height="5"/></a>
    <image href="https://evil.example/pixel.png" width="1" height="1"/>
    <image xlink:href="data:image/png;base64,iVBORw0KGgo=" width="1" height="1"/>
    <use href="https://evil.example/s.svg#a"/><use href="#local"/>
    <rect id="local" width="3" height="3" onclick="alert(4)" style="fill:url(https://evil.example/a.png)"/>
    <rect width="2" height="2" style="fill:red;stroke:url(#grad)"/>
    <animate attributeName="href" values="javascript:alert(5)"/><set attributeName="onmouseover" to="alert(6)"/>
    <style>@import url(https://evil.example/x.css); .a { fill: red }</style>
    <style>.ok { fill: blue } @font-face { src: url("data:application/font-woff;base64,AAAA") }</style>
    <style>.bad { background: url(https://evil.example/bg.png) }</style>
    <g class="keep"><text x="1" y="2">Hello</text></g>
  </svg>`;
  const out = sanitizeSvg(evil);

  it('removes scripts, foreignObject, iframes, links, animation and event handlers', () => {
    for (const bad of ['<script', 'alert(', 'foreignObject', '<iframe', 'javascript:', 'onload', 'onclick', 'onmouseover', '<animate', '<set ', '<a ', '<a>']) {
      expect(out.toLowerCase(), bad).not.toContain(bad.toLowerCase());
    }
  });

  it('removes every external URL (href, xlink:href, style attributes and CSS) so no request can be made', () => {
    expect(out).not.toContain('evil.example');
    expect(out).not.toMatch(/@import/i);
  });

  it('keeps what a diagram needs: shapes, text, local references, data images, safe styles', () => {
    expect(out).toContain('<svg');
    expect(out).toContain('Hello');
    expect(out).toContain('link text'); // content of a removed link is kept
    expect(out).not.toContain('<use'); // <use> is dropped outright (a known SVG attack surface; D2 does not emit it)
    expect(out).toContain('data:image/png;base64,iVBORw0KGgo=');
    expect(out).toContain('fill:red;stroke:url(#grad)');
    expect(out).toContain('.ok { fill: blue }');
    expect(out).toContain('data:application/font-woff;base64,AAAA');
    expect(out).toContain('class="keep"');
  });

  it.each([
    ['@import url(x.css)', false],
    ['.a { background: url(https://x/y.png) }', false],
    ['.a { background: url( "//x/y.png" ) }', false],
    ['.a { width: expression(alert(1)) }', false],
    ['.a { behavior: url(x.htc) }', false],
    ['.a { src: url(javascript:alert(1)) }', false],
    ['.a { fill: red }', true],
    ['.a { filter: url(#blur) }', true],
    ['@font-face { src: url("data:application/font-woff;base64,AAAA") }', true],
  ])('cssIsSafe(%j) = %s', (css, ok) => expect(cssIsSafe(css)).toBe(ok));
});

describe('D2 layout engine choice', () => {
  it('honours dagre and elk, ignoring case and quotes', () => {
    expect(chooseLayout('vars: {\n  d2-config: {\n    layout-engine: elk\n  }\n}\na -> b', 'dagre')).toEqual({ layout: 'elk', warnings: [] });
    expect(chooseLayout('layout-engine: "DAGRE"', 'elk')).toEqual({ layout: 'dagre', warnings: [] });
  });

  it('falls back from TALA (proprietary) to the default engine with a warning carrying the line', () => {
    const r = chooseLayout('vars: {\n  d2-config: {\n    layout-engine: tala\n  }\n}\na -> b', 'dagre');
    expect(r.layout).toBe('dagre');
    expect(r.warnings).toEqual([{ line: 3, message: expect.stringMatching(/"tala" is proprietary and not available here; using "dagre"/) }]);
    expect(chooseLayout('layout-engine: TALA', 'elk').layout).toBe('elk');
  });

  it('warns about unknown engines and uses the default when none is requested', () => {
    expect(chooseLayout('layout-engine: foo', 'dagre').warnings[0]!.message).toMatch(/Unknown D2 layout engine "foo"/);
    expect(chooseLayout('a -> b', 'elk')).toEqual({ layout: 'elk', warnings: [] });
  });
});

describe('D2 error parsing', () => {
  it('maps the compiler JSON to a readable message and a 1-based line', () => {
    const raw = JSON.stringify([
      { range: 'index,2:0:14-2:5:19', errmsg: 'index:3:1: connection missing destination' },
      { range: 'index,2:5:19-2:6:20', errmsg: 'index:3:6: connection missing source' },
    ]);
    expect(parseD2Error(new Error(raw))).toEqual({ line: 3, message: 'connection missing destination (and 1 more error)' });
    expect(parseD2Error(new Error(JSON.stringify([{ range: 'index,0:3:3-2:0:9', errmsg: 'index:1:4: maps must be terminated with }' }])))).toEqual({ line: 1, message: 'maps must be terminated with }' });
  });
  it('falls back to the range, then to the raw text', () => {
    expect(parseD2Error(new Error(JSON.stringify([{ range: 'index,4:0:0-4:1:1', errmsg: 'odd' }])))).toEqual({ line: 5, message: 'odd' });
    expect(parseD2Error(new Error('not json at all'))).toEqual({ message: 'not json at all' });
  });
});

describe('D2 service (real D2.js WASM)', () => {
  const svc = new D2Service();
  afterAll(() => svc.dispose());

  it('renders light and dark variants as sanitised SVG with distinct per-variant class names', async () => {
    const light = await svc.render('client -> gateway: request\ngateway -> ledger', 'light');
    const dark = await svc.render('client -> gateway: request\ngateway -> ledger', 'dark');
    expect(light.error).toBeUndefined();
    expect(light.svg).toMatch(/^<svg/);
    expect(dark.svg).toMatch(/^<svg/);
    const cls = (s: string) => /class="(d2-\d+) d2-svg"/.exec(s)?.[1];
    expect(cls(light.svg!)).toBeTruthy();
    expect(cls(light.svg!)).not.toBe(cls(dark.svg!)); // salted: the two variants cannot restyle each other
    expect(light.svg).toContain('client');
    expect(light.svg!.toLowerCase()).not.toMatch(/<script|onload|@import/);
    expect(light.svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/)/); // no external URLs (the XML namespaces are fine)
    expect(light.svg).not.toBe(dark.svg);
  }, 30000);

  it('caches results by source, theme, layout and settings (a repeat does not render again)', async () => {
    const s = new D2Service();
    try {
      await s.render('cache -> me', 'light');
      expect(s.renders).toBe(1);
      await s.render('cache -> me', 'light');
      expect(s.renders).toBe(1);
      await s.render('cache -> me', 'dark');
      expect(s.renders).toBe(2);
      await s.render('cache -> me', 'light', { ...DEFAULT_DIAGRAM_SETTINGS, d2Layout: 'elk' });
      expect(s.renders).toBe(3);
      await s.render('cache -> me', 'light', { ...DEFAULT_DIAGRAM_SETTINGS, d2ThemeLight: 1 });
      expect(s.renders).toBe(4);
      const k = (src: string, theme: 'light' | 'dark', layout: 'dagre' | 'elk', st = DEFAULT_DIAGRAM_SETTINGS) => s.cacheKey(src, theme, layout, st);
      expect(k('a', 'light', 'dagre')).toMatch(/^[0-9a-f]{64}$/);
      expect(new Set([k('a', 'light', 'dagre'), k('b', 'light', 'dagre'), k('a', 'dark', 'dagre'), k('a', 'light', 'elk')]).size).toBe(4);
    } finally {
      s.dispose();
    }
  }, 30000);

  it('reports a syntax error with its line, caches the failure, and keeps working', async () => {
    const src = 'a -> b\nb -> c\nc -> ->\nd';
    const r = await svc.render(src, 'light');
    expect(r.svg).toBeUndefined();
    expect(r.error).toMatchObject({ line: 3, message: expect.stringMatching(/connection missing destination/) });
    const before = svc.renders;
    await svc.render(src, 'light');
    expect(svc.renders).toBe(before); // failures are cached briefly
    expect((await svc.render('ok -> fine', 'light')).svg).toMatch(/^<svg/);
  }, 30000);

  it('falls back from TALA to dagre, renders, and warns with the line', async () => {
    const r = await svc.render('vars: {\n  d2-config: {\n    layout-engine: tala\n  }\n}\nx -> y', 'light');
    expect(r.svg).toMatch(/^<svg/);
    expect(r.warnings).toEqual([{ line: 3, message: expect.stringContaining('"tala"') }]);
  }, 30000);

  it('honours elk when requested in the source', async () => {
    const r = await svc.render('vars: {\n  d2-config: {\n    layout-engine: elk\n  }\n}\nx -> y', 'light');
    expect(r.svg).toMatch(/^<svg/);
    expect(r.warnings).toBeUndefined();
  }, 30000);

  it('serialises concurrent renders and returns every result', async () => {
    const rs = await Promise.all(['p -> q', 'r -> s', 't -> u', 'v -> ->'].map((s) => svc.render(s, 'light')));
    expect(rs.map((r) => !!r.svg)).toEqual([true, true, true, false]);
  }, 30000);

  it('refuses oversized sources without rendering', async () => {
    const before = svc.renders;
    const r = await svc.render(`a -> b # ${'x'.repeat(200)}`, 'light', { ...DEFAULT_DIAGRAM_SETTINGS, maxSourceBytes: 100 });
    expect(r.error!.message).toMatch(/too large/);
    expect(svc.renders).toBe(before);
  });

  it('stops a render that exceeds the timeout, then recovers with a fresh worker', async () => {
    const s = new D2Service();
    try {
      await s.render('warm -> up', 'light'); // warm-up is not counted against the diagram timeout
      const slow = await s.render('timeout -> test', 'light', { ...DEFAULT_DIAGRAM_SETTINGS, timeoutMs: 1 });
      expect(slow.svg).toBeUndefined();
      expect(slow.error!.message).toMatch(/longer than 0\.001 s|took longer than/);
      const ok = await s.render('after -> timeout', 'light');
      expect(ok.svg).toMatch(/^<svg/); // the killed worker was replaced
    } finally {
      s.dispose();
    }
  }, 60000);
});

describe('pinned dependency', () => {
  it('uses the exact D2.js version recorded in D2_VERSION and package.json', () => {
    const installed = JSON.parse(fs.readFileSync('node_modules/@terrastruct/d2/package.json', 'utf8')).version;
    const declared = JSON.parse(fs.readFileSync('package.json', 'utf8')).dependencies['@terrastruct/d2'];
    expect(installed).toBe(D2_VERSION);
    expect(declared).toBe(D2_VERSION); // exact, no ^ or ~
  });
});

describe('renderer registry (plugin interface)', () => {
  it('registers Mermaid as a client renderer and D2 as a server renderer by fence language', () => {
    const r = renderersFor();
    expect([...r.keys()].sort()).toEqual(['d2', 'mermaid']);
    expect(r.get('mermaid')).toMatchObject({ kind: 'client', lang: 'mermaid' });
    expect(r.get('d2')).toMatchObject({ kind: 'server', lang: 'd2' });
  });
});
