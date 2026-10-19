import fs from 'fs';

const files = [
  'src/app/dashboard/warehouse/actions-do.ts',
  'src/app/dashboard/warehouse/actions-gr.ts',
  'src/app/dashboard/warehouse/actions.ts',
  'src/app/dashboard/sales/actions.ts',
  'src/app/dashboard/finance/actions.ts',
  'src/app/dashboard/delivery/actions.ts',
  'src/app/dashboard/payment-requests/actions.ts',
  'src/app/dashboard/stamps/actions.ts',
  'src/app/dashboard/transfers/actions.ts',
  'src/app/dashboard/returns/actions.ts',
  'src/app/dashboard/procurement/actions.ts',
  'src/app/dashboard/warehouse/actions-inspection.ts'
];

for (const f of files) {
  if (fs.existsSync(f)) {
    const text = fs.readFileSync(f, 'utf8');
    const txCount = (text.match(/\$transaction/g) || []).length;
    console.log(`${f}: ${txCount} $transaction calls`);
  }
}
