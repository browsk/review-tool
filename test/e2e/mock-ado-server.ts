/** Local mock of the Azure DevOps API for Playwright (started by playwright.config.ts). */
import http from 'node:http';
import { handleAdo } from '../fixtures/ado/mock.js';

const port = Number(process.env.MOCK_ADO_PORT ?? 4174);
const seen: { method: string; url: string; hasAuth: boolean }[] = [];

http
  .createServer((req, res) => {
    if (req.url === '/__requests') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(seen));
      return;
    }
    if (req.url === '/__reset') {
      seen.length = 0;
      res.writeHead(204).end();
      return;
    }
    seen.push({ method: req.method ?? 'GET', url: req.url ?? '', hasAuth: !!req.headers.authorization });
    const r = handleAdo({ method: req.method, url: req.url ?? '/', authorization: req.headers.authorization ?? null });
    res.writeHead(r.status, r.headers);
    res.end(r.body);
  })
  .listen(port, '127.0.0.1', () => console.log(`mock ADO on ${port}`));
