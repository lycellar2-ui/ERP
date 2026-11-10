const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const XLSX = require('xlsx');

function getDbUrl() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!url) throw new Error('Could not find DIRECT_URL or DATABASE_URL');
    return url.replace(/\?sslmode=require/i, '');
}

function normStr(s) {
    if (!s) return '';
    return String(s).trim().toUpperCase().replace(/\s+/g, ' ');
}

function normInvoice(inv) {
    if (!inv) return '';
    const s = String(inv).trim().toUpperCase();
    if (/^\d+$/.test(s)) return String(parseInt(s, 10));
    return s;
}

function parseDateValue(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    if (typeof val === 'number') {
        if (val < 30000 || val > 70000) return null;
        const utcDays = Math.floor(val - 25569);
        return new Date(utcDays * 86400 * 1000);
    }
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s.slice(0, 10) + 'T00:00:00Z');
        if (!isNaN(d.getTime())) return d;
    }
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) {
        const day = m[1].padStart(2, '0');
        const mon = m[2].padStart(2, '0');
        const yr = m[3];
        const d = new Date(`${yr}-${mon}-${day}T00:00:00Z`);
        if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

function toMonthStr(dateObj) {
    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function isInternalCustomer(name, code) {
    const n = normStr(name);
    const c = normStr(code);
    if (n.includes('HẦM RƯỢU LY') || n.includes('HAM RUOU LY') || n.includes('THẮNG ÂN') || n.includes('THANG AN')) {
        return true;
    }
    if (c === 'KH0093' || c === 'NCC0001' || c === '0109525202' || c === '0108152305') return true;
    return false;
}

function isNonProductSku(sku, name) {
    const s = normStr(sku);
    const n = normStr(name);
    if (!s) return true;
    if (s.startsWith('CP') || s.startsWith('DV') || s === 'CHIẾT KHẤU' || s === 'CK') return true;
    if (n.startsWith('CHIẾT KHẤU') || n.startsWith('DỊCH VỤ')) return true;
    return false;
}

function cuidLike(index) {
    return 'histsku_' + Date.now().toString(36) + '_' + index.toString(36).padStart(5, '0');
}

async function main() {
    const client = new Client({
        connectionString: getDbUrl(),
        ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    console.log('Connected to Supabase PostgreSQL.');

    // 1. Create table and indexes on Supabase
    await client.query(`
        CREATE TABLE IF NOT EXISTS "historical_customer_sku_sales" (
            "id" TEXT NOT NULL,
            "productId" TEXT,
            "skuCode" TEXT NOT NULL,
            "productName" TEXT,
            "customerId" TEXT,
            "customerCode" TEXT,
            "customerName" TEXT NOT NULL,
            "channel" TEXT,
            "legalEntity" TEXT,
            "invoiceDate" TIMESTAMP(3) NOT NULL,
            "month" TEXT NOT NULL,
            "voucherNo" TEXT,
            "invoiceNo" TEXT,
            "qty" DECIMAL(12,2) NOT NULL DEFAULT 0,
            "unitPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
            "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
            "source" TEXT DEFAULT 'HISTORICAL_LEDGER',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "historical_customer_sku_sales_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "historical_customer_sku_sales_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT "historical_customer_sku_sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "historical_customer_sku_sales_productId_idx" ON "historical_customer_sku_sales"("productId");
        CREATE INDEX IF NOT EXISTS "historical_customer_sku_sales_skuCode_idx" ON "historical_customer_sku_sales"("skuCode");
        CREATE INDEX IF NOT EXISTS "historical_customer_sku_sales_customerId_idx" ON "historical_customer_sku_sales"("customerId");
        CREATE INDEX IF NOT EXISTS "historical_customer_sku_sales_month_idx" ON "historical_customer_sku_sales"("month");
        CREATE INDEX IF NOT EXISTS "historical_customer_sku_sales_invoiceDate_idx" ON "historical_customer_sku_sales"("invoiceDate");
    `);
    console.log('Ensured table historical_customer_sku_sales exists on Supabase.');

    await client.query(`TRUNCATE TABLE "historical_customer_sku_sales";`);

    // 2. Load Products and Customers from Supabase
    const prodRes = await client.query(`SELECT id, "skuCode", "productName" FROM products WHERE "deletedAt" IS NULL`);
    const productBySku = new Map();
    for (const p of prodRes.rows) {
        productBySku.set(normStr(p.skuCode), p);
    }
    console.log(`Loaded ${productBySku.size} active products from Supabase.`);

    const custRes = await client.query(`
        SELECT id, code, name, "shortName", "taxId", channel, "entityType", "parentId"
        FROM customers
        WHERE "deletedAt" IS NULL
    `);
    const customerByCode = new Map();
    const customerByName = new Map();
    const customerByTaxId = new Map();
    const childrenByParentId = new Map();

    for (const c of custRes.rows) {
        customerByCode.set(normStr(c.code), c);
        customerByName.set(normStr(c.name), c);
        if (c.shortName) customerByName.set(normStr(c.shortName), c);
        if (c.taxId) {
            customerByTaxId.set(normStr(c.taxId), c);
            const baseTax = normStr(c.taxId).split('-')[0];
            if (baseTax && !customerByTaxId.has(baseTax)) customerByTaxId.set(baseTax, c);
        }
        if (c.parentId) {
            const list = childrenByParentId.get(c.parentId) || [];
            list.push(c);
            childrenByParentId.set(c.parentId, list);
        }
    }
    console.log(`Loaded ${custRes.rows.length} active customers from Supabase.`);

    const rawNameToCode = new Map();
    const rawCodeToCode = new Map();

    function preferChildIfSingle(c, rawName) {
        if (!c) return null;
        const children = childrenByParentId.get(c.id) || [];
        if (children.length === 1) return children[0];
        if (children.length > 1 && rawName) {
            const rn = normStr(rawName);
            for (const ch of children) {
                if (rn.includes(normStr(ch.name)) || (ch.shortName && rn.includes(normStr(ch.shortName)))) {
                    return ch;
                }
            }
        }
        return c;
    }

    function resolveCustomer({ maCon, maCha, rawCode, rawName }) {
        if (maCon && customerByCode.has(normStr(maCon))) {
            return customerByCode.get(normStr(maCon));
        }
        if (maCha && customerByCode.has(normStr(maCha))) {
            return preferChildIfSingle(customerByCode.get(normStr(maCha)), rawName);
        }
        if (rawCode) {
            const rc = normStr(rawCode);
            if (customerByCode.has(rc)) return preferChildIfSingle(customerByCode.get(rc), rawName);
            if (customerByTaxId.has(rc)) return preferChildIfSingle(customerByTaxId.get(rc), rawName);
            const baseTax = rc.split('-')[0];
            if (baseTax && customerByTaxId.has(baseTax)) return preferChildIfSingle(customerByTaxId.get(baseTax), rawName);
            if (rawCodeToCode.has(rc) && customerByCode.has(rawCodeToCode.get(rc))) {
                return preferChildIfSingle(customerByCode.get(rawCodeToCode.get(rc)), rawName);
            }
        }
        if (rawName) {
            const rn = normStr(rawName);
            if (customerByName.has(rn)) return preferChildIfSingle(customerByName.get(rn), rawName);
            if (rawNameToCode.has(rn) && customerByCode.has(rawNameToCode.get(rn))) {
                return preferChildIfSingle(customerByCode.get(rawNameToCode.get(rn)), rawName);
            }
        }
        return null;
    }

    function normalizeChannel(ch, cust) {
        if (cust && cust.channel) return cust.channel;
        const s = normStr(ch);
        if (s.includes('HORECA')) return 'HORECA';
        if (s.includes('DOANH NGHIỆP') || s.includes('CORPORATE') || s.includes('B2B')) return 'CORPORATE';
        if (s.includes('BÁN BUÔN') || s.includes('WHOLESALE') || s.includes('ĐẠI LÝ')) return 'WHOLESALE_DISTRIBUTOR';
        if (s.includes('KHÁCH LẺ') || s.includes('RETAIL') || s.includes('CA NHAN')) return 'RETAIL';
        return 'HORECA';
    }

    const recordsToInsert = [];
    const seen2026Keys = new Set();

    // =========================================================================
    // PART A: BAO_CAO_BAN_HANG_Tt_c_khch_hng_2026-01-01_2026-07-26.xlsx
    // Sheet 'Chi tiết bán hàng': Header is Row 6, Data starts at Row 7
    // [0:STT, 1:Ngày hóa đơn, 2:Số hóa đơn, 3:Mã khách hàng, 4:Tên khách hàng, 5:Kênh, 6:Mã hàng, 7:Tên hàng, 8:Xuất xứ, 9:Nhà cung cấp, 10:Nguồn, 11:Số lượng, 12:Đơn giá, 13:Doanh thu]
    // =========================================================================
    const fileA = 'D:\\Lyscellar\\Bán hàng - Khách hàng\\BAO_CAO_BAN_HANG_Tt_c_khch_hng_2026-01-01_2026-07-26.xlsx';
    if (fs.existsSync(fileA)) {
        const wbA = XLSX.readFile(fileA);
        const rowsA = XLSX.utils.sheet_to_json(wbA.Sheets['Chi tiết bán hàng'], { header: 1 });
        let countA = 0;
        for (let i = 7; i < rowsA.length; i++) {
            const r = rowsA[i];
            if (!r || !r[1] || !r[6]) continue;
            const skuCode = normStr(r[6]);
            const productName = String(r[7] || '').trim();
            if (isNonProductSku(skuCode, productName)) continue;

            const custCodeRaw = normStr(r[3]);
            const custNameRaw = String(r[4] || '').trim();
            if (isInternalCustomer(custNameRaw, custCodeRaw)) continue;

            const invDate = parseDateValue(r[1]);
            if (!invDate) continue;
            const month = toMonthStr(invDate);
            if (month >= '2026-08') continue;

            const qty = Number(r[11]) || 0;
            const unitPrice = Number(r[12]) || 0;
            const totalAmount = Number(r[13]) || Math.round(qty * unitPrice);
            if (qty === 0 && totalAmount === 0) continue;

            const invoiceNo = String(r[2] || '').trim();
            const legalEntity = String(r[10] || '').trim() || null;

            const prod = productBySku.get(skuCode) || null;
            const cust = resolveCustomer({
                maCon: custCodeRaw,
                maCha: null,
                rawCode: custCodeRaw,
                rawName: custNameRaw,
            });

            const dedupKey = `${normInvoice(invoiceNo)}|${skuCode}|${qty}`;
            seen2026Keys.add(dedupKey);
            if (cust && custNameRaw) {
                rawNameToCode.set(normStr(custNameRaw), normStr(cust.code));
            }

            recordsToInsert.push({
                productId: prod ? prod.id : null,
                skuCode,
                productName: prod ? prod.productName : (productName || skuCode),
                customerId: cust ? cust.id : null,
                customerCode: cust ? cust.code : (custCodeRaw || null),
                customerName: cust ? cust.name : (custNameRaw || 'Khách hàng'),
                channel: normalizeChannel(r[5], cust),
                legalEntity,
                invoiceDate: invDate,
                month,
                voucherNo: null,
                invoiceNo: invoiceNo || null,
                qty,
                unitPrice,
                totalAmount,
                source: 'HORECA_DETAIL_2026',
            });
            countA++;
        }
        console.log(`Part A (HORECA Branch Detail Jan-Jul 2026): prepared ${countA} rows.`);
    }

    // =========================================================================
    // PART B: TONG_HOP_BAN_HANG_2026_FULL.xlsx ('Dữ liệu bán ngoài (Khử nội bộ)')
    // Also learn rawName/rawCode -> Ma_Con/Ma_Cha mappings for Part C!
    // =========================================================================
    const fileB = 'D:\\Lyscellar\\Kế toán\\Dữ liệu bán hàng 2026\\TONG_HOP_BAN_HANG_2026_FULL.xlsx';
    if (fs.existsSync(fileB)) {
        const wbB = XLSX.readFile(fileB);
        const sheetNameB = wbB.SheetNames.find(n => n.includes('Dữ liệu bán ngoài')) || wbB.SheetNames[0];
        const rowsB = XLSX.utils.sheet_to_json(wbB.Sheets[sheetNameB], { defval: '' });
        let countB = 0;
        for (const r of rowsB) {
            const maCon = normStr(r['Ma_Con']);
            const maCha = normStr(r['Ma_Cha']);
            const rawCode = normStr(r['Ma_KH_Raw']);
            const rawName = String(r['Ten_KH_Raw'] || '').trim();
            const targetCode = maCon || maCha;
            if (targetCode) {
                if (rawCode) rawCodeToCode.set(rawCode, targetCode);
                if (rawName) rawNameToCode.set(normStr(rawName), targetCode);
            }

            const skuCode = normStr(r['Ma_Hang']);
            const productName = String(r['Ten_Hang'] || '').trim();
            if (isNonProductSku(skuCode, productName)) continue;

            const displayCustName = String(r['Ten_Chi_Nhanh_Con'] || r['Ten_Cong_Ty_Cha'] || rawName || '').trim();
            if (isInternalCustomer(displayCustName, rawCode)) continue;

            const invDate = parseDateValue(r['Ngay_Hach_Toan']);
            if (!invDate) continue;
            const month = toMonthStr(invDate);
            if (month >= '2026-08') continue;

            const qty = Number(r['So_Luong_Ban']) || 0;
            const unitPrice = Number(r['Don_Gia']) || 0;
            const totalAmount = Number(r['Doanh_Thu_Thuan']) || Math.round(qty * unitPrice);
            if (qty === 0 && totalAmount === 0) continue;

            const invoiceNo = String(r['So_Hoa_Don'] || '').trim();
            const voucherNo = String(r['So_Chung_Tu'] || '').trim();
            const dedupKey = `${normInvoice(invoiceNo)}|${skuCode}|${qty}`;
            if (seen2026Keys.has(dedupKey)) continue;
            seen2026Keys.add(dedupKey);

            const prod = productBySku.get(skuCode) || null;
            const cust = resolveCustomer({
                maCon,
                maCha,
                rawCode,
                rawName: displayCustName || rawName,
            });

            recordsToInsert.push({
                productId: prod ? prod.id : null,
                skuCode,
                productName: prod ? prod.productName : (productName || skuCode),
                customerId: cust ? cust.id : null,
                customerCode: cust ? cust.code : (maCon || maCha || rawCode || null),
                customerName: cust ? cust.name : (displayCustName || 'Khách hàng'),
                channel: normalizeChannel(r['Kenh_Ban'], cust),
                legalEntity: String(r['Phap_Nhan'] || '').trim() || null,
                invoiceDate: invDate,
                month,
                voucherNo: voucherNo || null,
                invoiceNo: invoiceNo || null,
                qty,
                unitPrice,
                totalAmount,
                source: 'ACCOUNTING_2026_FULL',
            });
            countB++;
        }
        console.log(`Part B (Remaining 2026 External Sales): prepared ${countB} rows.`);
    }

    // =========================================================================
    // PART C: Pre-2026 (2021 - 2025) from SO_CHI_TIET_BAN_HANG_TA_TRUOC_T8 & LY_TRUOC_T8
    // Sheet 'Báo cáo': Header is Row 2, Data starts at Row 3
    // [0:Ngày hạch toán, 1:Ngày chứng từ, 2:Số chứng từ, 3:Ngày hóa đơn, 4:Số hóa đơn, 5:Diễn giải chung, 6:Diễn giải, 7:Mã khách hàng, 8:Tên khách hàng, 9:Mã hàng, 10:Tên hàng, 11:ĐVT, 12:Tổng số lượng bán, 13:Đơn giá, 14:Tổng doanh thu]
    // =========================================================================
    const pre2026Files = [
        { path: 'D:\\Lyscellar\\Kế toán\\Dữ liệu bán hàng 2026\\SO_CHI_TIET_BAN_HANG_TA_TRUOC_T8.xlsx', entity: 'Thắng Ân', source: 'LEDGER_TA_PRE2026' },
        { path: 'D:\\Lyscellar\\Kế toán\\Dữ liệu bán hàng 2026\\SO_CHI_TIET_BAN_HANG_LY_TRUOC_T8.xlsx', entity: "Ly's Cellars", source: 'LEDGER_LY_PRE2026' },
    ];

    for (const f of pre2026Files) {
        if (!fs.existsSync(f.path)) continue;
        const wb = XLSX.readFile(f.path);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        let countC = 0;
        for (let i = 3; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[0] || !r[9]) continue;
            if (String(r[0]).startsWith('Số dòng') || String(r[0]).startsWith('Tổng')) continue;

            const skuCode = normStr(r[9]);
            const productName = String(r[10] || '').trim();
            if (isNonProductSku(skuCode, productName)) continue;

            const rawCode = normStr(r[7]);
            const rawName = String(r[8] || '').trim();
            if (isInternalCustomer(rawName, rawCode)) continue;

            const invDate = parseDateValue(r[0]) || parseDateValue(r[3]);
            if (!invDate) continue;
            const month = toMonthStr(invDate);
            if (month >= '2026-01') continue; // 2026 is already covered in Part A & Part B

            const qty = Number(r[12]) || 0;
            const unitPrice = Number(r[13]) || 0;
            const totalAmount = Number(r[14]) || Math.round(qty * unitPrice);
            if (qty === 0 && totalAmount === 0) continue;

            const prod = productBySku.get(skuCode) || null;
            const cust = resolveCustomer({
                maCon: null,
                maCha: null,
                rawCode,
                rawName,
            });

            recordsToInsert.push({
                productId: prod ? prod.id : null,
                skuCode,
                productName: prod ? prod.productName : (productName || skuCode),
                customerId: cust ? cust.id : null,
                customerCode: cust ? cust.code : (rawCode || null),
                customerName: cust ? cust.name : (rawName || 'Khách hàng'),
                channel: normalizeChannel('', cust),
                legalEntity: f.entity,
                invoiceDate: invDate,
                month,
                voucherNo: String(r[2] || '').trim() || null,
                invoiceNo: String(r[4] || '').trim() || null,
                qty,
                unitPrice,
                totalAmount,
                source: f.source,
            });
            countC++;
        }
        console.log(`Part C (${f.entity} 2021-2025): prepared ${countC} rows.`);
    }

    console.log(`Total historical rows to insert into Supabase: ${recordsToInsert.length}`);

    // 4. Bulk insert in batches of 400
    const batchSize = 400;
    for (let i = 0; i < recordsToInsert.length; i += batchSize) {
        const batch = recordsToInsert.slice(i, i + batchSize);
        const values = [];
        const placeholders = [];
        let paramIdx = 1;

        batch.forEach((rec, idx) => {
            const id = cuidLike(i + idx + 1);
            placeholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
            values.push(
                id,
                rec.productId,
                rec.skuCode,
                rec.productName,
                rec.customerId,
                rec.customerCode,
                rec.customerName,
                rec.channel,
                rec.legalEntity,
                rec.invoiceDate,
                rec.month,
                rec.voucherNo,
                rec.invoiceNo,
                rec.qty,
                rec.unitPrice,
                rec.totalAmount,
                rec.source
            );
        });

        await client.query(`
            INSERT INTO "historical_customer_sku_sales" (
                "id", "productId", "skuCode", "productName",
                "customerId", "customerCode", "customerName", "channel",
                "legalEntity", "invoiceDate", "month", "voucherNo", "invoiceNo",
                "qty", "unitPrice", "totalAmount", "source"
            ) VALUES ${placeholders.join(', ')}
        `, values);
    }

    // 5. Verify in Supabase
    const verifyRes = await client.query(`
        SELECT 
            COUNT(*) AS total_rows,
            COUNT("productId") AS linked_products,
            COUNT("customerId") AS linked_customers,
            COUNT(DISTINCT "skuCode") AS distinct_skus,
            COUNT(DISTINCT COALESCE("customerCode", "customerName")) AS distinct_customers,
            MIN("month") AS min_month,
            MAX("month") AS max_month,
            SUM("qty") AS total_bottles,
            SUM("totalAmount") AS total_revenue
        FROM "historical_customer_sku_sales"
    `);
    console.log('=== SUPABASE VERIFICATION SUMMARY ===');
    console.log(verifyRes.rows[0]);

    const bySource = await client.query(`
        SELECT "source", COUNT(*) AS cnt, SUM("qty") AS bottles, MIN("month") AS min_m, MAX("month") AS max_m
        FROM "historical_customer_sku_sales"
        GROUP BY "source"
        ORDER BY "source"
    `);
    console.log('=== BY SOURCE ===');
    console.table(bySource.rows);

    await client.end();
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
