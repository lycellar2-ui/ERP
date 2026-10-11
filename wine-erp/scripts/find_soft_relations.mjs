import fs from 'fs';

const schemaContent = fs.readFileSync('prisma/schema.prisma', 'utf8');

const modelRegex = /model\s+([A-Za-z0-9_]+)\s+{([^}]+)}/g;
let m;

const softIdFields = [];

while ((m = modelRegex.exec(schemaContent)) !== null) {
  const modelName = m[1];
  const body = m[2];
  const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//') && !l.startsWith('@@'));

  const relationFields = new Set();
  for (const line of lines) {
    const relMatch = line.match(/@relation\(([^)]+)\)/);
    if (relMatch) {
      const fMatch = relMatch[1].match(/fields:\s*\[([^\]]+)\]/);
      if (fMatch) {
        fMatch[1].split(',').forEach(f => relationFields.add(f.trim()));
      }
    }
  }

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const fieldName = parts[0];
      const fieldType = parts[1];
      if (fieldName.endsWith('Id') && fieldName !== 'id' && !relationFields.has(fieldName)) {
        softIdFields.push({
          model: modelName,
          field: fieldName,
          type: fieldType,
          line
        });
      }
    }
  }
}

console.log(`Found ${softIdFields.length} unlinked ID fields (soft references without @relation):`);
const groupedByModel = {};
for (const item of softIdFields) {
  if (!groupedByModel[item.model]) groupedByModel[item.model] = [];
  groupedByModel[item.model].push(item.field);
}

for (const [model, fields] of Object.entries(groupedByModel)) {
  console.log(`- ${model}: ${fields.join(', ')}`);
}
