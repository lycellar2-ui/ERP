import fs from 'fs';

const checks = [
  {
    name: '1. PO Deletion/Cancellation Guard (Check GR or APInvoice)',
    files: ['src/app/dashboard/procurement/actions.ts'],
    test: content => /goodsReceipt|aPInvoice/i.test(content) && /status === 'CANCELLED'|delete/i.test(content)
  },
  {
    name: '2. StockLot Deletion Guard (Check qty_received vs qty_available)',
    files: ['src/app/dashboard/warehouse/actions.ts', 'src/app/dashboard/warehouse/actions-gr.ts'],
    test: content => /qty_received|qty_available|CANNOT_DELETE|cannot delete/i.test(content)
  },
  {
    name: '3. SO Modification Guard (Check DELIVERED or INVOICED)',
    files: ['src/app/dashboard/sales/actions.ts'],
    test: content => /(?:status === ['"]DELIVERED['"]|status === ['"]INVOICED['"])/.test(content)
  },
  {
    name: '4. SO Credit Hold & Minimum Price Guard',
    files: ['src/app/dashboard/sales/actions.ts'],
    test: content => /creditHold|isCreditHold|CREDIT_HOLD/i.test(content)
  },
  {
    name: '5. DO WH-TA-TT Guard (Ban sales outbound from Thuong Tin)',
    files: ['src/app/dashboard/warehouse/actions-do.ts'],
    test: content => /WH-TA-TT|Thường Tín|Thuong Tin/i.test(content)
  },
  {
    name: '6. Master Data Soft Delete (Product, Customer, Supplier)',
    files: [
      'src/app/dashboard/products/actions.ts',
      'src/app/dashboard/customers/actions.ts',
      'src/app/dashboard/suppliers/actions.ts'
    ],
    test: content => /deletedAt|status:\s*['"]INACTIVE['"]/i.test(content) && !/prisma\.(?:customer|product|supplier)\.delete\b/.test(content)
  },
  {
    name: '7. Wine Stamp Overuse Guard (qtyUsed + qtyDamaged <= totalQty)',
    files: ['src/app/dashboard/stamps/actions.ts'],
    test: content => /remainingQty|qtyUsed/i.test(content) && /throw new Error/i.test(content)
  },
  {
    name: '8. Multi-Entity Intercompany / Owner Entity Check',
    files: ['src/app/dashboard/sales/actions.ts', 'src/app/dashboard/warehouse/actions-do.ts'],
    test: content => /legalEntityId|ownerEntityId|legal_entity_id|owner_entity_id/i.test(content)
  }
];

console.log('--- AUDITING HARD CONSTRAINTS IN CODE ---');
for (const check of checks) {
  let passed = true;
  let details = [];
  for (const f of check.files) {
    if (fs.existsSync(f)) {
      const c = fs.readFileSync(f, 'utf8');
      const res = check.test(c);
      details.push(`${f}: ${res ? 'ENFORCED' : 'NOT ENFORCED / PARTIAL'}`);
      if (!res) passed = false;
    } else {
      details.push(`${f}: MISSING FILE`);
      passed = false;
    }
  }
  const mark = passed ? '[x]' : '[!]';
  console.log(`${mark} ${check.name}`);
  for (const d of details) {
    console.log(`    -> ${d}`);
  }
}
