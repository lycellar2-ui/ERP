-- Kiểm kê showroom — dấu "đã kiểm lại" (lần 2) cho từng dòng ở từng vị trí.
-- Người tích phải khác người đã đếm; qtyAtCheck lưu tổng lúc tích để biết số có bị đổi sau đó không.
-- Chạy: npx prisma db execute --file prisma/sql/add_showroom_count_checks.sql  (chạy lại an toàn)

CREATE TABLE IF NOT EXISTS showroom_count_checks (
    id            TEXT PRIMARY KEY,
    "spotId"      TEXT NOT NULL REFERENCES showroom_count_spots(id) ON DELETE CASCADE ON UPDATE CASCADE,
    "itemId"      TEXT NOT NULL REFERENCES showroom_count_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
    "checkedBy"   TEXT NOT NULL,
    "qtyAtCheck"  INTEGER NOT NULL,
    "checkedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "showroom_count_checks_spotId_itemId_key"
    ON showroom_count_checks ("spotId", "itemId");
