-- Kiểm kê showroom — cập nhật 07/11/2026:
-- 1) Thêm cột "packSize" (số chai/thùng: 6 hoặc 12) vào showroom_count_items.
-- 2) Thêm cột "cases" (số thùng) và "loose" (số chai lẻ thực tế) vào showroom_count_entries (phục vụ kiểm kê Tầng 2).
-- Chạy lại an toàn (idempotent).

ALTER TABLE showroom_count_items
    ADD COLUMN IF NOT EXISTS "packSize" INTEGER;

ALTER TABLE showroom_count_entries
    ADD COLUMN IF NOT EXISTS cases INTEGER,
    ADD COLUMN IF NOT EXISTS loose INTEGER;

-- Nạp quy cách 12 chai/thùng cho các mã đã xác nhận từ bảng kiểm kê Tầng 2 & bộ chứng từ nhập khẩu Purchasing
UPDATE showroom_count_items
SET "packSize" = 12
WHERE kind = 'WINE'
  AND code IN (
      'L10023', 'L10024', 'L10025', 'L10026', 'L10027', 'L10028', 'L10029',
      'L10032', 'L10033', 'L10039', 'L10042',
      'L30001', 'L30002', 'L30003', 'L30004', 'L30005',
      'L40001', 'L40002', 'L40003', 'L40004', 'L40009',
      'L40010', 'L40011', 'L40012', 'L40013', 'L40014',
      'L60001', 'L60002',
      'L70001', 'L70002', 'L70005'
  );

-- Các mã rượu còn lại mặc định quy cách 6 chai/thùng (chỉ gán nếu chưa có packSize)
UPDATE showroom_count_items
SET "packSize" = 6
WHERE kind = 'WINE'
  AND "packSize" IS NULL;

-- Backfill các dòng đã đếm trước đó ở Tầng 2 chưa có cases/loose
UPDATE showroom_count_entries e
SET cases = FLOOR(e.qty::numeric / COALESCE(i."packSize", 6))::int,
    loose = MOD(e.qty, COALESCE(i."packSize", 6))
FROM showroom_count_items i,
     showroom_count_spots s
WHERE e."itemId" = i.id
  AND e."spotId" = s.id
  AND s."groupName" = 'Tầng 2'
  AND e.cases IS NULL
  AND e.loose IS NULL;
