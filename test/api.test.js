import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';

let server, base;
before(async () => {
  await new Promise((resolve) => { server = createApp().listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
const get = async (p) => { const r = await fetch(base + p); return { status: r.status, body: await r.json() }; };

test('health', async () => {
  const r = await get('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.asOf, '2026-11-16');
});

test('branches', async () => {
  const r = await get('/api/branches');
  assert.deepEqual(r.body.map((b) => b.code), ['KKN', 'ROE', 'UDN']);
});

test('stock defaults to KKN and returns 60 products', async () => {
  const r = await get('/api/stock');
  assert.equal(r.body.branch, 'KKN');
  assert.equal(r.body.count, 60);
});

test('stock status filter: 4 sold out at KKN', async () => {
  const r = await get('/api/stock?branch=KKN&status=out');
  assert.equal(r.body.count, 4);
  assert.ok(r.body.items.every((i) => i.onHand === 0));
});

test('stock search works in Thai and English', async () => {
  assert.equal((await get('/api/stock?q=' + encodeURIComponent('ปูนซีเมนต์'))).body.items[0].sku, 'GH-CEM-1001');
  assert.ok((await get('/api/stock?q=hose')).body.count >= 1);
});

test('bad branch and bad status are 400 with a clear message', async () => {
  const a = await get('/api/stock?branch=BKK');
  assert.equal(a.status, 400);
  assert.match(a.body.error, /KKN, ROE, UDN/);
  const b = await get('/api/stock?status=broken');
  assert.equal(b.status, 400);
});

test('summary counts add up', async () => {
  const { body: s } = await get('/api/stock/summary?branch=KKN');
  assert.equal(s.out + s.low + s.over + s.ok, s.skus);
  assert.equal(s.out, 4);
  assert.ok(s.stockValueAtCost > 0);
});

test('reorder: validates coverDays and returns positive quantities', async () => {
  assert.equal((await get('/api/reorder?coverDays=-1')).status, 400);
  assert.equal((await get('/api/reorder?coverDays=abc')).status, 400);
  const r = await get('/api/reorder?branch=KKN');
  assert.ok(r.body.items.length >= 10);
  assert.ok(r.body.items.every((i) => i.suggestedQty > 0));
});

test('sales: validates days', async () => {
  assert.equal((await get('/api/sales?days=0')).status, 400);
  const r = await get('/api/sales?branch=ROE&days=7');
  assert.equal(r.status, 200);
  assert.equal(r.body.days, 7);
});

test('unknown api path is a JSON 404', async () => {
  const r = await get('/api/nope');
  assert.equal(r.status, 404);
  assert.ok(r.body.error);
});

test('dashboard page is served', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Branch stock dashboard/);
});
