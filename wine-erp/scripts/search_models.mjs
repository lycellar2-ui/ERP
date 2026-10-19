import fs from 'fs';

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Search for models related to AP, POS, Stamp, Transfer, RegDoc, Pipeline, etc.
const keywords = [
  'APInvoice', 'Invoice', 'Bill',
  'Stamp', 'WineStamp',
  'Transfer', 'StockTransfer',
  'Pos', 'Retail',
  'Deal', 'Lead', 'Pipeline', 'CRM',
  'Regulated', 'Document',
  'DeliveryOrder', 'StockMovement', 'StockLot'
];

const modelRegex = /model\s+([A-Za-z0-9_]+)\s+{([^}]+)}/g;
let m;
const found = {};

while ((m = modelRegex.exec(schema)) !== null) {
  const name = m[1];
  const body = m[2];
  for (const kw of keywords) {
    if (name.toLowerCase().includes(kw.toLowerCase())) {
      if (!found[kw]) found[kw] = [];
      if (!found[kw].includes(name)) found[kw].push(name);
    }
  }
}

console.log('Matching models in schema.prisma:');
for (const [kw, list] of Object.entries(found)) {
  console.log(`${kw}: ${list.join(', ')}`);
}
