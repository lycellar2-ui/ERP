process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const connStr = rawUrl.replace(/[?&]sslmode=[^&]+/g, '');
const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
});

function parseVNDate(str) {
    if (!str) return null;
    if (typeof str === 'number') {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(str);
        if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
    }
    const s = String(str).trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const year = parseInt(m[3], 10);
        return new Date(Date.UTC(year, month - 1, day));
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

function toMonthKey(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

async function main() {
    const client = await pool.connect();
    try {
        console.log('1. Ensuring historical_sku_imports table exists on Supabase...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "historical_sku_imports" (
                "id" TEXT NOT NULL,
                "productId" TEXT,
                "skuCode" TEXT NOT NULL,
                "productName" TEXT,
                "supplierName" TEXT NOT NULL,
                "country" TEXT,
                "legalEntity" TEXT,
                "importType" TEXT NOT NULL DEFAULT 'DIRECT_IMPORT',
                "batchCode" TEXT,
                "receiptDate" TIMESTAMP(3) NOT NULL,
                "month" TEXT NOT NULL,
                "voucherNo" TEXT,
                "declarationNo" TEXT,
                "qtyCommercial" DECIMAL(12,2) NOT NULL DEFAULT 0,
                "qtyFoc" DECIMAL(12,2) NOT NULL DEFAULT 0,
                "qtyTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
                "currency" TEXT DEFAULT 'VND',
                "foreignUnitPrice" DECIMAL(18,4),
                "purchasePriceVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,
                "landedCostVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,
                "totalValueVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,
                "source" TEXT DEFAULT 'HISTORICAL_IMPORT_LEDGER',
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "historical_sku_imports_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "historical_sku_imports_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "historical_sku_imports_productId_idx" ON "historical_sku_imports"("productId");
            CREATE INDEX IF NOT EXISTS "historical_sku_imports_skuCode_idx" ON "historical_sku_imports"("skuCode");
            CREATE INDEX IF NOT EXISTS "historical_sku_imports_month_idx" ON "historical_sku_imports"("month");
            CREATE INDEX IF NOT EXISTS "historical_sku_imports_receiptDate_idx" ON "historical_sku_imports"("receiptDate");
        `);

        console.log('2. Loading products map from Supabase...');
        const prodRes = await client.query(`SELECT id, "skuCode", "productName", country FROM products WHERE "deletedAt" IS NULL`);
        const productBySku = new Map();
        for (const p of prodRes.rows) {
            productBySku.set(String(p.skuCode).trim().toUpperCase(), p);
        }
        console.log(`   Loaded ${productBySku.size} active products.`);

        const records = [];
        let seq = 1;

        // Source 1: Báo cáo chi tiết mua hàng và giá vốn.xlsx -> 'Chi tiết lô nhập hàng' (2021 - 04/2026)
        const file1 = 'D:\\Lyscellar\\Kế toán\\Đối chiếu tồn kho\\Báo cáo chi tiết mua hàng và giá vốn.xlsx';
        if (fs.existsSync(file1)) {
            const wb1 = XLSX.readFile(file1);
            const ws1 = wb1.Sheets['Chi tiết lô nhập hàng'];
            const rows1 = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: '' });
            for (let i = 4; i < rows1.length; i++) {
                const r = rows1[i];
                const supplierRaw = String(r[0] || '').trim();
                const skuRaw = String(r[1] || '').trim().toUpperCase();
                if (!skuRaw || !supplierRaw || supplierRaw.toLowerCase().includes('tổng cộng')) continue;

                const productName = String(r[2] || '').trim();
                const receiptDate = parseVNDate(r[3]);
                if (!receiptDate) continue;

                const voucherNo = String(r[4] || '').trim() || null;
                const declarationNo = String(r[5] || '').trim() || null;
                const entityCode = String(r[6] || '').trim().toUpperCase();
                const qty = Number(r[7]) || 0;
                if (qty <= 0) continue;

                const purchasePriceVnd = Number(r[8]) || 0;
                const landedCostVnd = Number(r[9]) || purchasePriceVnd;
                const totalValueVnd = Number(r[10]) || 0;

                const prod = productBySku.get(skuRaw);
                const legalEntity = entityCode === 'TA' ? 'Thắng Ân' : entityCode === 'LYS' ? "Ly's Cellars" : entityCode;

                let importType = 'DIRECT_IMPORT';
                if (voucherNo && /HTL/i.test(voucherNo)) {
                    importType = 'RETURN_INBOUND';
                } else if (entityCode === 'LYS') {
                    // LYS purchasing from Thắng Ân internal transfer unless 12-digit customs declaration
                    const isCustomsDecl = declarationNo && /^\d{11,12}$/.test(declarationNo);
                    importType = isCustomsDecl ? 'DIRECT_IMPORT' : 'INTERNAL_TRANSFER';
                }

                const isFocLine = entityCode === 'TA' && totalValueVnd === 0 && qty > 0;
                const qtyCommercial = isFocLine ? 0 : qty;
                const qtyFoc = isFocLine ? qty : 0;

                records.push({
                    id: `himp_${String(seq++).padStart(5, '0')}`,
                    productId: prod ? prod.id : null,
                    skuCode: skuRaw,
                    productName: productName || (prod ? prod.productName : null),
                    supplierName: supplierRaw,
                    country: prod ? prod.country : null,
                    legalEntity,
                    importType,
                    batchCode: null,
                    receiptDate,
                    month: toMonthKey(receiptDate),
                    voucherNo,
                    declarationNo,
                    qtyCommercial,
                    qtyFoc,
                    qtyTotal: qty,
                    currency: 'VND',
                    foreignUnitPrice: null,
                    purchasePriceVnd: Math.round(purchasePriceVnd * 100) / 100,
                    landedCostVnd: Math.round(landedCostVnd * 100) / 100,
                    totalValueVnd: Math.round((totalValueVnd > 0 ? totalValueVnd : qty * landedCostVnd) * 100) / 100,
                    source: ' PURCHASE_COGS_LEDGER_2021_2026'.trim(),
                });
            }
        }

        // Source 2: Bảng tổng hợp chi phí các lô hàng nhập T6-T10.2026.xlsx -> '2. Bảng tính COGS theo SKU' (L01 - L15)
        const file2 = 'D:\\Lyscellar\\Kế toán\\Tập hợp chứng từ tính giá vốn\\Bảng tổng hợp chi phí các lô hàng nhập T6-T10.2026.xlsx';
        if (fs.existsSync(file2)) {
            const wb2 = XLSX.readFile(file2);
            const ws2 = wb2.Sheets['2. Bảng tính COGS theo SKU'];
            const rows2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' });
            for (let i = 4; i < rows2.length; i++) {
                const r = rows2[i];
                if (typeof r[0] !== 'number' || !r[6]) continue;

                const batchCode = String(r[1] || '').trim() || null;
                const supplierName = String(r[2] || '').trim();
                const country = String(r[3] || '').trim() || null;
                const declarationNo = String(r[4] || '').trim() || null;
                const receiptDate = parseVNDate(r[5]);
                const skuRaw = String(r[6] || '').trim().toUpperCase();
                const productName = String(r[7] || '').trim();
                if (!skuRaw || !receiptDate) continue;

                const qtyCommercial = Number(r[8]) || 0;
                const qtyFoc = Number(r[9]) || 0;
                const qtyTotal = Number(r[10]) || (qtyCommercial + qtyFoc);
                if (qtyTotal <= 0) continue;

                const currency = String(r[11] || 'USD').trim().toUpperCase();
                const foreignUnitPrice = Number(r[12]) || null;
                const P = Number(r[15]) || 0; // Tiền hàng nhập thực trả VNĐ
                const R = Number(r[17]) || 0; // Cước QT & EXW
                const S = Number(r[18]) || 0; // CP Nội địa
                const W = Number(r[22]) || 0; // Thuế NK
                const Y = Number(r[24]) || 0; // Thuế TTĐB 35%
                const totalCogsVnd = Number(r[27]) || (P + R + S + W + Y);
                const unitLandedCostVnd = Number(r[28]) || (qtyTotal > 0 ? totalCogsVnd / qtyTotal : 0);
                const purchasePriceVnd = qtyTotal > 0 ? P / qtyTotal : 0;

                const prod = productBySku.get(skuRaw);

                records.push({
                    id: `himp_${String(seq++).padStart(5, '0')}`,
                    productId: prod ? prod.id : null,
                    skuCode: skuRaw,
                    productName: productName || (prod ? prod.productName : null),
                    supplierName,
                    country: country || (prod ? prod.country : null),
                    legalEntity: 'Thắng Ân',
                    importType: 'DIRECT_IMPORT',
                    batchCode,
                    receiptDate,
                    month: toMonthKey(receiptDate),
                    voucherNo: batchCode ? `NK-${batchCode}/2026` : null,
                    declarationNo,
                    qtyCommercial,
                    qtyFoc,
                    qtyTotal,
                    currency,
                    foreignUnitPrice: foreignUnitPrice !== null ? Math.round(foreignUnitPrice * 10000) / 10000 : null,
                    purchasePriceVnd: Math.round(purchasePriceVnd * 100) / 100,
                    landedCostVnd: Math.round(unitLandedCostVnd * 100) / 100,
                    totalValueVnd: Math.round(totalCogsVnd * 100) / 100,
                    source: 'IMPORT_SHIPMENT_COGS_2026',
                });
            }
        }

        console.log(`3. Prepared ${records.length} historical SKU import records. Truncating & inserting into Supabase...`);
        await client.query('BEGIN');
        await client.query('TRUNCATE TABLE "historical_sku_imports"');

        const chunkSize = 200;
        for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);
            const values = [];
            const placeholders = chunk.map((rec, idx) => {
                const base = idx * 21;
                values.push(
                    rec.id,
                    rec.productId,
                    rec.skuCode,
                    rec.productName,
                    rec.supplierName,
                    rec.country,
                    rec.legalEntity,
                    rec.importType,
                    rec.batchCode,
                    rec.receiptDate,
                    rec.month,
                    rec.voucherNo,
                    rec.declarationNo,
                    rec.qtyCommercial,
                    rec.qtyFoc,
                    rec.qtyTotal,
                    rec.currency,
                    rec.foreignUnitPrice,
                    rec.purchasePriceVnd,
                    rec.landedCostVnd,
                    rec.totalValueVnd,
                    rec.source
                );
                const b = idx * 22;
                return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13},$${b + 14},$${b + 15},$${b + 16},$${b + 17},$${b + 18},$${b + 19},$${b + 20},$${b + 21},$${b + 22})`;
            });

            await client.query(
                `INSERT INTO "historical_sku_imports" (
                    "id", "productId", "skuCode", "productName", "supplierName", "country",
                    "legalEntity", "importType", "batchCode", "receiptDate", "month",
                    "voucherNo", "declarationNo", "qtyCommercial", "qtyFoc", "qtyTotal",
                    "currency", "foreignUnitPrice", "purchasePriceVnd", "landedCostVnd",
                    "totalValueVnd", "source"
                ) VALUES ${placeholders.join(',')}`,
                values
            );
        }

        await client.query('COMMIT');

        const summary = await client.query(`
            SELECT "importType", COUNT(*)::int AS rows, SUM("qtyTotal")::numeric AS total_qty, SUM("totalValueVnd")::numeric AS total_val
            FROM "historical_sku_imports"
            GROUP BY "importType"
            ORDER BY rows DESC
        `);
        console.log('4. Migration completed successfully! Summary by importType:');
        console.table(summary.rows);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration error:', err);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main();
