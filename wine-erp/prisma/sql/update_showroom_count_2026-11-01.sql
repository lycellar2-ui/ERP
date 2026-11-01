-- Kiểm kê showroom — cập nhật 01/11/2026
-- 1) Mỗi người kiểm giữ số riêng của mình tại một vị trí (trước đây người lưu sau ghi đè người lưu trước).
-- 2) Sửa danh mục: thêm L10004 2016, bổ sung vintage L10040/41/42/44, sửa tên L80001–L80006 (rượu Nam Phi, theo bảng products).
-- Chạy: npx prisma db execute --file prisma/sql/update_showroom_count_2026-11-01.sql  (chạy lại an toàn)

DROP INDEX IF EXISTS "showroom_count_entries_spotId_itemId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "showroom_count_entries_spotId_itemId_countedBy_key"
    ON showroom_count_entries ("spotId", "itemId", "countedBy");

INSERT INTO showroom_count_items (id, kind, code, name, vintage, "sortOrder") VALUES
('w_L10004_2016', 'WINE', 'L10004', 'Arco dei Giovi Amarone Della Valpolicella Classico', '2016', 2)
ON CONFLICT (kind, code, vintage) DO NOTHING;

-- Dòng NV → đúng vintage (chỉ khi chưa có dòng vintage đó)
UPDATE showroom_count_items i SET vintage = v.vintage
FROM (VALUES ('L10040', '2024'), ('L10041', '2024'), ('L10042', '2021'), ('L10044', '2024')) AS v(code, vintage)
WHERE i.kind = 'WINE' AND i.code = v.code AND i.vintage = ''
  AND NOT EXISTS (SELECT 1 FROM showroom_count_items x WHERE x.kind = 'WINE' AND x.code = v.code AND x.vintage = v.vintage);

UPDATE showroom_count_items i SET name = v.name
FROM (VALUES
    ('L80001', 'Protea - Shiraz'),
    ('L80002', 'Protea - Cabernet Sauvignon'),
    ('L80003', 'Anthonij Rupert - Optima'),
    ('L80004', 'Anthonij Rupert - Blend'),
    ('L80005', 'Protea - Chenin Blanc'),
    ('L80006', 'Protea - Sauvignon Blanc')
) AS v(code, name)
WHERE i.kind = 'WINE' AND i.code = v.code;
