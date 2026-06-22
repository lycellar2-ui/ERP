const fs = require('fs');
const log = fs.readFileSync('C:/Users/Chienth/.gemini/antigravity-ide/brain/aef135a2-b7c1-4652-a90b-1d958ae91dff/.system_generated/tasks/task-681.log', 'utf8');
const lines = log.split('\n');
console.log('--- ACTUAL LINT ERRORS ---');
lines.forEach((line, i) => {
    if (line.includes('error') && !line.includes('warning') && !line.includes('problems') && !line.includes('0 errors')) {
        console.log(`${i + 1}: ${line.trim()}`);
    }
});
