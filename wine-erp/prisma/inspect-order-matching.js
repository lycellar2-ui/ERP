const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

async function main() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    const soList = [
        'SO-2608-0105', 'SO-2608-0104', 'SO-2608-0103', 'SO-2608-0102', 'SO-2608-0101',
        'SO-2608-0097', 'SO-2608-0096', 'SO-2608-0095', 'SO-2608-0094', 'SO-2608-0093',
        'SO-2608-0092', 'SO-2608-0091', 'SO-2608-0049', 'SO-2608-0008', 'SO-2608-0006',
        'SO-2608-0005', 'SO-2608-0004', 'SO-2608-0003', 'SO-2608-0001'
    ];

    let output = [];

    for (const soNo of soList) {
        const so = (await client.query(`
            SELECT so.id, so."soNo", so."customerId", so."totalAmount", so.notes, so.status, c.code as parent_code, c.name as parent_name
            FROM sales_orders so
            JOIN customers c ON so."customerId" = c.id
            WHERE so."soNo" = $1
        `, [soNo])).rows[0];

        const lines = (await client.query(`
            SELECT sol."qtyOrdered", sol."unitPrice", p.id as product_id, p."skuCode", p."productName"
            FROM sales_order_lines sol
            JOIN products p ON sol."productId" = p.id
            WHERE sol."soId" = $1
        `, [so.id])).rows;

        const children = (await client.query(`
            SELECT id, code, name
            FROM customers
            WHERE "parentId" = $1 AND id != $1
        `, [so.customerId])).rows;

        let itemData = {
            soNo: so.soNo,
            parentCode: so.parent_code,
            parentName: so.parent_name,
            totalAmount: Number(so.totalAmount),
            notes: so.notes,
            childrenCount: children.length,
            children: children.map(c => ({ id: c.id, code: c.code, name: c.name })),
            lines: []
        };

        for (const l of lines) {
            let lineInfo = {
                skuCode: l.skuCode,
                productName: l.productName,
                qty: Number(l.qtyOrdered),
                unitPrice: Number(l.unitPrice),
                childPriceRules: []
            };

            for (const ch of children) {
                const rule = (await client.query(`
                    SELECT "ruleType", "value"
                    FROM customer_price_rules
                    WHERE "customerId" = $1 AND "productId" = $2 AND status = 'APPROVED'
                `, [ch.id, l.product_id])).rows[0];

                if (rule) {
                    lineInfo.childPriceRules.push({
                        childCode: ch.code,
                        childName: ch.name,
                        ruleType: rule.ruleType,
                        value: Number(rule.value)
                    });
                }
            }
            itemData.lines.push(lineInfo);
        }

        output.push(itemData);
    }

    fs.writeFileSync('order_matching_analysis.json', JSON.stringify(output, null, 2), 'utf-8');
    console.log('Saved to order_matching_analysis.json');

    await client.end();
}

main().catch(console.error);
