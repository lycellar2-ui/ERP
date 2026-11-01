-- Kiểm kê showroom — tách "Phòng trong T1 - kệ cạnh tủ lạnh" thành kệ trên (giữ số đã đếm) + kệ dưới (mới).
-- Chạy: npx prisma db execute --file prisma/sql/add_showroom_spot_t1_ke_duoi_tu_lanh.sql  (chạy lại an toàn)

UPDATE showroom_count_spots SET name = 'Phòng trong T1 - kệ cạnh tủ lạnh (trên)'
WHERE id = 't1-5' AND name = 'Phòng trong T1 - kệ cạnh tủ lạnh';

-- Chừa chỗ ngay sau t1-5 (chỉ khi kệ dưới chưa có)
UPDATE showroom_count_spots SET "sortOrder" = "sortOrder" + 1
WHERE "sortOrder" > (SELECT "sortOrder" FROM showroom_count_spots WHERE id = 't1-5')
  AND NOT EXISTS (SELECT 1 FROM showroom_count_spots WHERE id = 't1-7');

INSERT INTO showroom_count_spots (id, "groupName", kind, name, "sortOrder")
SELECT 't1-7', 'Tầng 1', 'WINE', 'Phòng trong T1 - kệ cạnh tủ lạnh (dưới)', "sortOrder" + 1
FROM showroom_count_spots WHERE id = 't1-5'
ON CONFLICT (id) DO NOTHING;
