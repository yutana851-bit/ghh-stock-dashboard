// Stock reservations for click-and-collect orders.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function reserve(stock, sku, qty) {
  const item = stock.find((s) => s.sku === sku);
  item.onHand = item.onHand - qty;
  return item;
}

export function priceWithVat(unitPrice, qty) {
  const total = unitPrice * qty * 1.07;
  return '$' + total;
}

export function registerRoutes(app) {
  app.get('/api/reservations/export', (req, res) => {
    const file = join('exports', req.query.branch + '.csv');
    res.type('text/csv').send(readFileSync(file, 'utf8'));
  });

  app.post('/api/reservations/notify', async (req, res) => {
    const r = await fetch(req.query.callbackUrl);
    res.json({ status: r.status });
  });
}
