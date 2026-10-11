import fs from 'fs';
import path from 'path';

const prismaPath = path.resolve('prisma/schema.prisma');
const srcPath = path.resolve('src');

console.log('--- 1. PARSING SCHEMA.PRISMA ---');
const schemaContent = fs.readFileSync(prismaPath, 'utf8');

// Regex to parse models
const modelRegex = /model\s+([A-Za-z0-9_]+)\s+{([^}]+)}/g;
let match;

const models = {};
const allModelNames = new Set();
const enums = new Set();

const enumRegex = /enum\s+([A-Za-z0-9_]+)\s+{([^}]+)}/g;
while ((match = enumRegex.exec(schemaContent)) !== null) {
  enums.add(match[1]);
}

while ((match = modelRegex.exec(schemaContent)) !== null) {
  const modelName = match[1];
  const body = match[2];
  allModelNames.add(modelName);

  const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//') && !l.startsWith('@@'));
  const fields = [];
  const relations = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const fieldName = parts[0];
      const fieldType = parts[1].replace('?', '').replace('[]', '');
      const isArray = parts[1].includes('[]');
      const isOptional = parts[1].includes('?');
      const relationMatch = line.match(/@relation\(([^)]+)\)/);

      fields.push({
        name: fieldName,
        type: fieldType,
        isArray,
        isOptional,
        isRelation: false
      });

      if (relationMatch) {
        const relDetails = relationMatch[1];
        const fieldsMatch = relDetails.match(/fields:\s*\[([^\]]+)\]/);
        const refMatch = relDetails.match(/references:\s*\[([^\]]+)\]/);
        const nameMatch = relDetails.match(/^"([^"]+)"/);

        relations.push({
          field: fieldName,
          targetModel: fieldType,
          relationName: nameMatch ? nameMatch[1] : null,
          foreignKeys: fieldsMatch ? fieldsMatch[1].split(',').map(s => s.trim()) : [],
          references: refMatch ? refMatch[1].split(',').map(s => s.trim()) : [],
          isArray,
          isOptional
        });
      }
    }
  }

  models[modelName] = {
    name: modelName,
    fields,
    relations,
    incomingRelations: []
  };
}

// Map relation fields that don't have @relation explicitly (e.g. 1-to-many opposite side)
for (const [mName, mData] of Object.entries(models)) {
  for (const field of mData.fields) {
    if (allModelNames.has(field.type) && !mData.relations.some(r => r.field === field.name)) {
      mData.relations.push({
        field: field.name,
        targetModel: field.type,
        relationName: null,
        foreignKeys: [],
        references: [],
        isArray: field.isArray,
        isOptional: field.isOptional,
        isInverse: true
      });
    }
  }
}

// Compute incoming relations
for (const [mName, mData] of Object.entries(models)) {
  for (const rel of mData.relations) {
    if (models[rel.targetModel]) {
      models[rel.targetModel].incomingRelations.push({
        sourceModel: mName,
        field: rel.field,
        relationName: rel.relationName,
        foreignKeys: rel.foreignKeys,
        isArray: rel.isArray,
        isInverse: rel.isInverse
      });
    }
  }
}

console.log(`Parsed ${Object.keys(models).length} models and ${enums.size} enums.`);

// Find orphaned/isolated models
const isolatedModels = [];
for (const [mName, mData] of Object.entries(models)) {
  const outgoingTargets = mData.relations.filter(r => allModelNames.has(r.targetModel) && r.targetModel !== mName);
  const incomingSources = mData.incomingRelations.filter(r => allModelNames.has(r.sourceModel) && r.sourceModel !== mName);
  if (outgoingTargets.length === 0 && incomingSources.length === 0) {
    isolatedModels.push(mName);
  }
}

console.log(`Isolated models (0 incoming & 0 outgoing relations):`, isolatedModels);

// Scan codebase for model usage
function getAllFiles(dir, exts = ['.ts', '.tsx', '.js', '.jsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        results = results.concat(getAllFiles(fullPath, exts));
      }
    } else {
      if (exts.includes(path.extname(file))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const codeFiles = getAllFiles(srcPath);
console.log(`Scanning ${codeFiles.length} code files in src/ for model references...`);

const modelUsage = {};
for (const mName of Object.keys(models)) {
  modelUsage[mName] = {
    reads: 0,
    writes: 0,
    files: new Set(),
    actions: new Set()
  };
}

// Helper to lowercase first letter for prisma client access
function toPrismaProp(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

for (const file of codeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');

  for (const mName of Object.keys(models)) {
    const propName = toPrismaProp(mName);
    // Patterns: prisma.<modelName> or tx.<modelName>
    const readRegex = new RegExp(`(?:prisma|tx)\\.${propName}\\.(?:find|count|aggregate|groupBy)`, 'g');
    const writeRegex = new RegExp(`(?:prisma|tx)\\.${propName}\\.(?:create|update|upsert|delete)`, 'g');
    const generalRegex = new RegExp(`(?:prisma|tx)\\.${propName}\\b`, 'g');

    const readMatches = content.match(readRegex);
    const writeMatches = content.match(writeRegex);
    const generalMatches = content.match(generalRegex);

    if (generalMatches) {
      modelUsage[mName].files.add(relPath);
      if (file.includes('actions')) {
        modelUsage[mName].actions.add(relPath);
      }
      if (readMatches) modelUsage[mName].reads += readMatches.length;
      if (writeMatches) modelUsage[mName].writes += writeMatches.length;
    }
  }
}

const unusedModels = [];
const writeOnlyModels = [];
const readOnlyModels = [];
const activeModels = [];

for (const [mName, usage] of Object.entries(modelUsage)) {
  if (usage.files.size === 0) {
    unusedModels.push(mName);
  } else if (usage.writes > 0 && usage.reads === 0) {
    writeOnlyModels.push(mName);
  } else if (usage.reads > 0 && usage.writes === 0) {
    readOnlyModels.push(mName);
  } else {
    activeModels.push(mName);
  }
}

const result = {
  totalModels: Object.keys(models).length,
  totalEnums: enums.size,
  isolatedModels,
  unusedModels,
  writeOnlyModels,
  readOnlyModels,
  activeModelsCount: activeModels.length,
  modelsSummary: {}
};

for (const [mName, mData] of Object.entries(models)) {
  result.modelsSummary[mName] = {
    fieldsCount: mData.fields.length,
    outgoingRelations: mData.relations.map(r => ({
      field: r.field,
      target: r.targetModel,
      fks: r.foreignKeys,
      isArray: r.isArray
    })),
    incomingRelations: mData.incomingRelations.map(r => ({
      source: r.sourceModel,
      field: r.field,
      isArray: r.isArray
    })),
    usage: {
      filesCount: modelUsage[mName].files.size,
      reads: modelUsage[mName].reads,
      writes: modelUsage[mName].writes,
      actions: Array.from(modelUsage[mName].actions)
    }
  };
}

fs.writeFileSync('scratch/model_audit_summary.json', JSON.stringify(result, null, 2));
console.log('Results written to scratch/model_audit_summary.json');
console.log(`Summary:
- Total Models: ${result.totalModels}
- Isolated Models (No relations): ${isolatedModels.length} -> [${isolatedModels.join(', ')}]
- Unused Models in Code: ${unusedModels.length} -> [${unusedModels.join(', ')}]
- Read-only Models (in code): ${readOnlyModels.length} -> [${readOnlyModels.join(', ')}]
- Write-only Models (in code): ${writeOnlyModels.length} -> [${writeOnlyModels.join(', ')}]
- Fully active models: ${activeModels.length}
`);
