-- Kiểm kê showroom — chốt vintage cho các mã đang ghi NV (01/11/2026).
-- L40011–L40014: NV → 2025 (chưa có dòng 2025: đổi thẳng).
-- L20076 → 2019, L10038 → 2024, L10037 → 2020: đã có dòng vintage đích (thêm tay) → chuyển số đếm,
-- dấu kiểm lại, ghi chú từ dòng NV sang dòng đích rồi xoá dòng NV; dòng đích thành dòng chính của danh mục.
-- Chạy: npx prisma db execute --file prisma/sql/update_showroom_vintages_2026-11-01b.sql  (chạy lại an toàn)

UPDATE showroom_count_items SET vintage = '2025'
WHERE kind = 'WINE' AND code IN ('L40011', 'L40012', 'L40013', 'L40014') AND vintage = ''
  AND NOT EXISTS (SELECT 1 FROM showroom_count_items t WHERE t.kind = 'WINE' AND t.code = showroom_count_items.code AND t.vintage = '2025');

CREATE TEMP TABLE kk_merge AS
SELECT nv.id AS from_id, tg.id AS to_id
FROM (VALUES ('L20076', '2019'), ('L10038', '2024'), ('L10037', '2020')) AS m(code, vintage)
JOIN showroom_count_items nv ON nv.kind = 'WINE' AND nv.code = m.code AND nv.vintage = ''
JOIN showroom_count_items tg ON tg.kind = 'WINE' AND tg.code = m.code AND tg.vintage = m.vintage;

-- Cùng vị trí + cùng người ở cả hai dòng: cộng số vào dòng đích, bỏ dòng NV.
UPDATE showroom_count_entries t SET qty = t.qty + f.qty, "countedAt" = GREATEST(t."countedAt", f."countedAt")
FROM showroom_count_entries f JOIN kk_merge m ON f."itemId" = m.from_id
WHERE t."itemId" = m.to_id AND t."spotId" = f."spotId" AND t."countedBy" = f."countedBy";
DELETE FROM showroom_count_entries f USING kk_merge m, showroom_count_entries t
WHERE f."itemId" = m.from_id AND t."itemId" = m.to_id AND t."spotId" = f."spotId" AND t."countedBy" = f."countedBy";
UPDATE showroom_count_entries f SET "itemId" = m.to_id FROM kk_merge m WHERE f."itemId" = m.from_id;

-- Dấu kiểm lại: vị trí đã có dấu ở dòng đích thì bỏ dấu của dòng NV (tổng đã đổi, cần kiểm lại).
DELETE FROM showroom_count_checks f USING kk_merge m, showroom_count_checks t
WHERE f."itemId" = m.from_id AND t."itemId" = m.to_id AND t."spotId" = f."spotId";
UPDATE showroom_count_checks f SET "itemId" = m.to_id FROM kk_merge m WHERE f."itemId" = m.from_id;

DELETE FROM showroom_count_notes f USING kk_merge m, showroom_count_notes t
WHERE f."itemId" = m.from_id AND t."itemId" = m.to_id AND t."spotId" = f."spotId" AND t."writtenBy" = f."writtenBy";
UPDATE showroom_count_notes f SET "itemId" = m.to_id FROM kk_merge m WHERE f."itemId" = m.from_id;

DELETE FROM showroom_count_items i USING kk_merge m WHERE i.id = m.from_id;
UPDATE showroom_count_items i SET "isExtra" = false FROM kk_merge m WHERE i.id = m.to_id;

DROP TABLE kk_merge;
