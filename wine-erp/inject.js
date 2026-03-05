const fs = require('fs');
const path = require('path');

function walk(dir) {
    fs.readdirSync(dir).forEach(f => {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            walk(p);
        } else if (f === 'page.tsx') {
            let content = fs.readFileSync(p, 'utf8');
            if (!content.includes('force-dynamic') && !content.includes('"use client"') && !content.includes("'use client'")) {
                let lines = content.split('\n');
                // Find last import
                let lastImport = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].startsWith('import ')) {
                        lastImport = i;
                    }
                }

                lines.splice(lastImport + 1, 0, '\nexport const dynamic = "force-dynamic"\n');
                fs.writeFileSync(p, lines.join('\n'));
                console.log('Updated', p);
            }
        }
    });
}
walk('src/app/dashboard');
