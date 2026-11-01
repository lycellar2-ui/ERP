-- Tạo 3 bảng cho trang kiểm kê nhanh showroom (/kiem-ke).
-- Chỉ thêm bảng mới (IF NOT EXISTS) — không đụng bảng nào đang có, chạy lại an toàn.
-- Chạy: npx prisma db execute --file prisma/sql/create_showroom_count_tables.sql

CREATE TABLE IF NOT EXISTS showroom_count_spots (
    id            TEXT PRIMARY KEY,
    "groupName"   TEXT NOT NULL,
    kind          TEXT NOT NULL DEFAULT 'WINE',
    name          TEXT NOT NULL,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS showroom_count_items (
    id            TEXT PRIMARY KEY,
    kind          TEXT NOT NULL DEFAULT 'WINE',
    code          TEXT NOT NULL,
    name          TEXT NOT NULL,
    vintage       TEXT NOT NULL DEFAULT '',
    "isExtra"     BOOLEAN NOT NULL DEFAULT false,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS showroom_count_items_kind_code_vintage_key
    ON showroom_count_items (kind, code, vintage);

CREATE TABLE IF NOT EXISTS showroom_count_entries (
    id            TEXT PRIMARY KEY,
    "spotId"      TEXT NOT NULL REFERENCES showroom_count_spots(id) ON DELETE CASCADE ON UPDATE CASCADE,
    "itemId"      TEXT NOT NULL REFERENCES showroom_count_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
    qty           INTEGER NOT NULL,
    "countedBy"   TEXT NOT NULL,
    "countedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "showroom_count_entries_spotId_itemId_key"
    ON showroom_count_entries ("spotId", "itemId");
