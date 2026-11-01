-- Kiểm kê showroom — sửa vintage: L40010 NV → 2025; L40014 về lại NV (01/11/2026).
-- Chạy: npx prisma db execute --file prisma/sql/update_showroom_vintages_2026-11-01c.sql  (chạy lại an toàn)

UPDATE showroom_count_items SET vintage = '2025'
WHERE kind = 'WINE' AND code = 'L40010' AND vintage = ''
  AND NOT EXISTS (SELECT 1 FROM showroom_count_items t WHERE t.kind = 'WINE' AND t.code = 'L40010' AND t.vintage = '2025');

UPDATE showroom_count_items SET vintage = ''
WHERE kind = 'WINE' AND code = 'L40014' AND vintage = '2025'
  AND NOT EXISTS (SELECT 1 FROM showroom_count_items t WHERE t.kind = 'WINE' AND t.code = 'L40014' AND t.vintage = '');
