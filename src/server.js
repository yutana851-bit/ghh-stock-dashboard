// Stock Dashboard API: reference solution for lab 2.
// Participants build this WITH Bob from lab2/starter. Use this only to check your work.

import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, reorderSuggestions, salesSummary, stockRows } from './data.js';

const here = dirname(fileURLToPath(import.meta.url));

export function createApp(data = loadData(join(here, '..', 'data'))) {
  const app = express();
  app.disable('x-powered-by');
  const codes = new Set(data.branches.map((b) => b.code));
  const STATUSES = new Set(['ok', 'low', 'out', 'over']);

  // Validate ?branch= once, for every route that has it.
  const needBranch = (req, res, next) => {
    const branch = String(req.query.branch ?? 'KKN').toUpperCase();
    if (!codes.has(branch)) {
      return res.status(400).json({ error: `Unknown branch "${req.query.branch}". Use one of: ${[...codes].join(', ')}.` });
    }
    req.branch = branch;
    next();
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true, asOf: data.asOf }));
  app.get('/api/branches', (_req, res) => res.json(data.branches));

  app.get('/api/stock', needBranch, (req, res) => {
    const { status, category, q } = req.query;
    if (status !== undefined && !STATUSES.has(String(status))) {
      return res.status(400).json({ error: `Unknown status "${status}". Use one of: ${[...STATUSES].join(', ')}.` });
    }
    const items = stockRows(data, { branch: req.branch, status, category, q: q === undefined ? undefined : String(q) });
    res.json({ asOf: data.asOf, branch: req.branch, count: items.length, items });
  });

  app.get('/api/stock/summary', needBranch, (req, res) => {
    const rows = stockRows(data, { branch: req.branch });
    const count = (s) => rows.filter((r) => r.status === s).length;
    res.json({
      asOf: data.asOf,
      branch: req.branch,
      skus: rows.length,
      out: count('out'),
      low: count('low'),
      over: count('over'),
      ok: count('ok'),
      stockValueAtCost: Math.round(rows.reduce((t, r) => t + r.onHand * r.cost, 0) * 100) / 100,
    });
  });

  app.get('/api/reorder', needBranch, (req, res) => {
    const cover = req.query.coverDays === undefined ? 14 : Number(req.query.coverDays);
    if (!Number.isInteger(cover) || cover < 0 || cover > 60) {
      return res.status(400).json({ error: 'coverDays must be a whole number from 0 to 60.' });
    }
    const items = reorderSuggestions(data, req.branch, cover);
    res.json({ asOf: data.asOf, branch: req.branch, coverDays: cover, totalEstimatedCost: Math.round(items.reduce((t, i) => t + i.estCost, 0) * 100) / 100, items });
  });

  app.get('/api/sales', needBranch, (req, res) => {
    const days = req.query.days === undefined ? 30 : Number(req.query.days);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      return res.status(400).json({ error: 'days must be a whole number from 1 to 90.' });
    }
    res.json(salesSummary(data, { branch: req.branch, days }));
  });

  app.use(express.static(join(here, '..', 'public')));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => console.log(`Stock dashboard on http://localhost:${port}`));
}
