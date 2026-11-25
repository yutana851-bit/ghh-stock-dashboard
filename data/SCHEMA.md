# Dataset schema (synthetic data, not real Global House data)

As of 2026-11-16. Sales cover 90 days: 2026-08-18 to 2026-11-15. All money is Thai baht (THB).

## branches.json
- code, name, nameTh

## products.json
- sku (GH-<CAT>-<NNNN>), nameTh, nameEn, category, categoryEn, categoryTh, unit, price, cost

## stock.json
- asOf, items[]: branch, sku, onHand, reorderPoint, leadTimeDays, avgDailySales30d

## sales.csv
- date, branch, sku, qty, unit_price, revenue   (revenue = qty x unit_price)
