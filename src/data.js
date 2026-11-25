// Shared data access for the workshop kit. Plain Node, no database.
// Used by the MCP server (lab 1) and copied into the reference app (lab 2) by `npm run sync`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadData(dataDir) {
  const read = (f) => readFileSync(join(dataDir, f), 'utf8');
  const branches = JSON.parse(read('branches.json'));
  const products = JSON.parse(read('products.json'));
  const stockFile = JSON.parse(read('stock.json'));
  const sales = read('sales.csv')
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const [date, branch, sku, qty, unitPrice, revenue] = line.split(',');
      return { date, branch, sku, qty: Number(qty), unitPrice: Number(unitPrice), revenue: Number(revenue) };
    });
  const productBySku = new Map(products.map((p) => [p.sku, p]));
  return { branches, products, productBySku, stock: stockFile.items, asOf: stockFile.asOf, sales };
}

export function formatBaht(n) {
  return `฿${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function stockStatus(item) {
  if (item.onHand <= 0) return 'out';
  if (item.onHand <= item.reorderPoint) return 'low';
  const cover = daysOfCover(item);
  if (cover !== null && cover > 90) return 'over';
  return 'ok';
}

// Days of stock left at the current 30-day sales rate. null = no recent sales.
export function daysOfCover(item) {
  if (!item.avgDailySales30d) return null;
  return Math.round((item.onHand / item.avgDailySales30d) * 10) / 10;
}

export function stockRows(data, { branch, status, category, q } = {}) {
  const needle = q?.trim().toLowerCase();
  return data.stock
    .filter((s) => !branch || s.branch === branch)
    .map((s) => {
      const p = data.productBySku.get(s.sku);
      return { ...s, nameTh: p.nameTh, nameEn: p.nameEn, category: p.category, categoryEn: p.categoryEn, unit: p.unit, price: p.price, cost: p.cost, status: stockStatus(s), daysOfCover: daysOfCover(s) };
    })
    .filter((r) => !status || r.status === status)
    .filter((r) => !category || r.category === category)
    .filter((r) => !needle || r.sku.toLowerCase().includes(needle) || r.nameEn.toLowerCase().includes(needle) || r.nameTh.includes(needle));
}

// How many units to order so that stock covers lead time plus a safety window.
export function reorderQty(item, coverDays = 14) {
  const target = Math.ceil(item.avgDailySales30d * (item.leadTimeDays + coverDays));
  return Math.max(0, target - item.onHand);
}

export function reorderSuggestions(data, branch, coverDays = 14) {
  return stockRows(data, { branch })
    .filter((r) => r.status === 'out' || r.status === 'low')
    .map((r) => {
      const qty = reorderQty(r, coverDays);
      return { sku: r.sku, nameEn: r.nameEn, nameTh: r.nameTh, onHand: r.onHand, reorderPoint: r.reorderPoint, suggestedQty: qty, unit: r.unit, estCost: Math.round(qty * r.cost * 100) / 100 };
    })
    .filter((r) => r.suggestedQty > 0)
    .sort((a, b) => a.onHand - b.onHand || b.estCost - a.estCost);
}

export function salesSummary(data, { branch, category, days = 30 } = {}) {
  const lastDate = data.sales.reduce((m, s) => (s.date > m ? s.date : m), '');
  const from = new Date(Date.parse(lastDate) - (days - 1) * 86400000).toISOString().slice(0, 10);
  const rows = data.sales.filter((s) => s.date >= from && (!branch || s.branch === branch) && (!category || data.productBySku.get(s.sku).category === category));
  const bySku = new Map();
  for (const r of rows) {
    const cur = bySku.get(r.sku) ?? { sku: r.sku, qty: 0, revenue: 0 };
    cur.qty += r.qty;
    cur.revenue += r.revenue;
    bySku.set(r.sku, cur);
  }
  const top = [...bySku.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((r) => ({ ...r, nameEn: data.productBySku.get(r.sku).nameEn }));
  return {
    from,
    to: lastDate,
    days,
    revenue: rows.reduce((t, r) => t + r.revenue, 0),
    units: rows.reduce((t, r) => t + r.qty, 0),
    topProducts: top,
  };
}
