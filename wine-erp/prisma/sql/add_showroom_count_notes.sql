-- Kiểm kê showroom — ghi chú của người kiểm (mỗi người một ghi chú cho mỗi dòng; itemId = '' là ghi chú chung của vị trí).
-- Chạy: npx prisma db execute --file prisma/sql/add_showroom_count_notes.sql  (chạy lại an toàn)

CREATE TABLE IF NOT EXISTS showroom_count_notes (
    id           TEXT PRIMARY KEY,
    "spotId"     TEXT NOT NULL REFERENCES showroom_count_spots(id) ON DELETE CASCADE ON UPDATE CASCADE,
    "itemId"     TEXT NOT NULL DEFAULT '',
    note         TEXT NOT NULL,
    "writtenBy"  TEXT NOT NULL,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "showroom_count_notes_spotId_itemId_writtenBy_key"
    ON showroom_count_notes ("spotId", "itemId", "writtenBy");
