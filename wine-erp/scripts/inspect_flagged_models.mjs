import fs from 'fs';

const s = fs.readFileSync('prisma/schema.prisma', 'utf8');
const models = ['ProductProfile', 'GrapeVariety', 'RegDocAlert', 'TastingEventAttendee', 'TastingEventGuest', 'ApprovalStep'];

for (const m of models) {
  const reg = new RegExp(`model\\s+${m}\\s+\\{([^}]+)\\}`, 'm');
  const match = s.match(reg);
  if (match) {
    console.log(`\n=== MODEL ${m} ===`);
    console.log(match[0]);
  } else {
    console.log(`Model ${m} NOT FOUND`);
  }
}
