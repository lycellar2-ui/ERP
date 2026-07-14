import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { createRequire } from 'module'
const requireModule = createRequire(import.meta.url)
const pdfParse = requireModule('pdf-parse')

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 1,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const NOTES_DIR = 'D:\\Lyscellar\\Learning and Development\\TASTING NOTES';

// ─── Helpers for String Normalization & Fuzzy Match ────────────────

function normalizeString(str: string): string {
    return str
        .toLowerCase()
        // Remove diacritics / Vietnamese accents
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Replace punctuation, hyphens, parentheses with spaces
        .replace(/[\(\)\[\]\-\_\,\.\:\;\/\?\!\*\+\#]/g, ' ')
        // Remove years (vintages like 2018, 2019, 2020)
        .replace(/\b(18|19|20)\d{2}\b/g, '')
        // Clean double spaces
        .replace(/\s+/g, ' ')
        .trim();
}

function getTokens(str: string): string[] {
    const stopwords = new Set(['and', 'of', 'the', 'in', 'with', 'for', 'a', 'an', 'to', 'by', 'at', 'on', 'vdf', 'doc', 'docg', 'igt', 'cru']);
    return normalizeString(str)
        .split(' ')
        .filter(t => t.length > 1 && !stopwords.has(t));
}

type DBProduct = {
    id: string
    skuCode: string
    productName: string
    producerName: string
}

function findBestMatch(fileRelativePath: string, dbProducts: DBProduct[]): { product: DBProduct; score: number } | null {
    const fileName = path.basename(fileRelativePath, path.extname(fileRelativePath));
    const folderName = path.dirname(fileRelativePath).split(path.sep).pop() || '';
    
    // Combine folder name and filename for the match target
    const targetString = `${folderName} ${fileName}`;
    const fileTokens = getTokens(targetString);
    
    if (fileTokens.length === 0) return null;

    let bestMatch: DBProduct | null = null;
    let highestScore = 0;

    for (const product of dbProducts) {
        // We match against the product name + producer name
        const productString = `${product.producerName} ${product.productName}`;
        const productTokens = getTokens(productString);
        
        // Compute token intersection
        const intersection = fileTokens.filter(t => productTokens.includes(t));
        
        // Score = matching tokens / max(file tokens, product tokens)
        let score = intersection.length / Math.max(fileTokens.length, productTokens.length);

        // Add bonus if the cleaned filename is a substring of the product name or vice versa
        const cleanTarget = normalizeString(targetString);
        const cleanProduct = normalizeString(productString);
        
        if (cleanProduct.includes(cleanTarget) || cleanTarget.includes(cleanProduct)) {
            score += 0.25;
        }

        // Add bonus if SKU code is mentioned in the file name
        const cleanSku = product.skuCode.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanFile = fileName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanFile.includes(cleanSku)) {
            score += 0.4;
        }

        if (score > highestScore) {
            highestScore = score;
            bestMatch = product;
        }
    }

    if (bestMatch && highestScore >= 0.45) {
        return { product: bestMatch, score: highestScore };
    }

    return null;
}

// ─── PDF Text Cleaning & Extraction ──────────────────────────────

function cleanExtractedText(rawText: string): string {
    const lines = rawText.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    // Look for wine descriptions by searching for standard sections
    let tastingParagraphs: string[] = [];
    let activeSection = '';

    const sectionsRegex = /^(tasting notes|palate|nose|aroma|bouquet|appearance|colour|food pairing|pairings|winemaking|viticulture|technical details|analysis|comments)/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(sectionsRegex);

        if (match) {
            activeSection = match[0].toUpperCase();
            // If it is a technical/analysis section, skip it
            if (activeSection.includes('TECHNICAL') || activeSection.includes('ANALYSIS') || activeSection.includes('DETAILS')) {
                activeSection = 'SKIP';
            }
            continue;
        }

        if (activeSection === 'SKIP') continue;

        // Clean out contact/website footers
        if (line.includes('www.') || line.includes('@') || line.includes('Tel:') || line.includes('Fax:') || line.includes('Road') || line.includes('Street')) {
            continue;
        }

        // If in an active tasting section, keep the text
        if (activeSection && line.length > 15) {
            tastingParagraphs.push(`${activeSection}: ${line}`);
            activeSection = ''; // Reset section to look for next
        } else if (line.length > 40 && !line.includes('Page') && !/^\d+$/.test(line)) {
            // Keep long descriptive paragraphs even if not prefixed by a section header
            tastingParagraphs.push(line);
        }
    }

    // Fallback: If no structured sections could be parsed, just take the longest descriptive paragraphs
    if (tastingParagraphs.length === 0) {
        const descParagraphs = lines.filter(l => 
            l.length > 50 && 
            !l.includes('www.') && 
            !l.includes('@') && 
            !l.includes('Phone') && 
            !l.includes('Page') &&
            !/^(abv|acidity|ph|residual|sugar|alcohol|vintage|winemaker)/i.test(l)
        );
        tastingParagraphs = descParagraphs.slice(0, 3);
    }

    // Join and trim to a premium compact text (max 500 chars)
    let notes = tastingParagraphs.join(' ').replace(/\s+/g, ' ').trim();
    if (notes.length > 500) {
        notes = notes.slice(0, 497) + '...';
    }

    return notes;
}

// ─── Scan Directory Recursively ──────────────────────────────────

function walkDir(dir: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir)
    files.forEach(file => {
        const filePath = path.join(dir, file)
        const stat = fs.statSync(filePath)
        if (stat.isDirectory()) {
            walkDir(filePath, fileList)
        } else {
            const ext = path.extname(file).toLowerCase()
            if (ext === '.pdf') {
                fileList.push(filePath)
            }
        }
    })
    return fileList
}

// ─── Main Execution ──────────────────────────────────────────────

async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(`\n==================================================`);
    console.log(`🍷 Tasting Notes Synchronization Process starting...`);
    console.log(`Mode: ${isDryRun ? 'DRY-RUN (SIMULATION)' : 'LIVE DATABASE SYNC'}`);
    console.log(`==================================================\n`);

    if (!fs.existsSync(NOTES_DIR)) {
        throw new Error(`Directory not found: ${NOTES_DIR}`);
    }

    // 1. Scan PDF files
    const pdfFiles = walkDir(NOTES_DIR);
    console.log(`Found ${pdfFiles.length} tasting notes PDF files locally.\n`);

    // 2. Fetch active products from DB
    const dbProducts = await prisma.product.findMany({
        where: { deletedAt: null },
        include: {
            producer: { select: { name: true } }
        }
    });

    const productsList: DBProduct[] = dbProducts.map(p => ({
        id: p.id,
        skuCode: p.skuCode,
        productName: p.productName,
        producerName: p.producer.name,
    }));

    console.log(`Loaded ${productsList.length} active products from database.\n`);

    let matchedCount = 0;
    let dbUpdatedCount = 0;

    for (let i = 0; i < pdfFiles.length; i++) {
        const filePath = pdfFiles[i];
        const relativePath = path.relative(NOTES_DIR, filePath);
        
        // Find best match
        const matchResult = findBestMatch(relativePath, productsList);

        if (!matchResult) {
            console.log(`[${i + 1}/${pdfFiles.length}] ⚠️ No match found for: "${relativePath}"`);
            continue;
        }

        const { product, score } = matchResult;
        matchedCount++;
        console.log(`[${i + 1}/${pdfFiles.length}] Match Found! (Score: ${(score * 100).toFixed(0)}%)`);
        console.log(`  - File: "${relativePath}"`);
        console.log(`  - Match: [${product.skuCode}] ${product.productName} (${product.producerName})`);

        let parser: any = null;
        try {
            // Read PDF and parse text
            const buffer = fs.readFileSync(filePath);
            parser = new pdfParse.PDFParse({ data: buffer });
            await parser.load();
            const parsed = await parser.getText();
            
            // Clean extracted text
            const tastingNotes = cleanExtractedText(parsed.text);
            
            if (!tastingNotes) {
                console.log(`  ⚠️ Extracted text is empty or has no tasting details. Skipping.`);
                continue;
            }

            console.log(`  📝 Notes Preview: "${tastingNotes.slice(0, 120)}${tastingNotes.length > 120 ? '...' : ''}"`);

            if (!isDryRun) {
                // Find all vintage child products in DB that match the parent SKU code
                // e.g. L40006, L40006-19, L40006-21
                const parentSku = product.skuCode.split('-')[0];
                const matchedVariants = await prisma.product.findMany({
                    where: {
                        deletedAt: null,
                        skuCode: {
                            startsWith: parentSku
                        }
                    },
                    select: { id: true, skuCode: true, productName: true }
                });

                console.log(`  ⬆️ Updating tasting notes for ${matchedVariants.length} database SKU variant(s)...`);
                for (const variant of matchedVariants) {
                    await prisma.productProfile.upsert({
                        where: { productId: variant.id },
                        create: {
                            productId: variant.id,
                            aromas: tastingNotes,
                        },
                        update: {
                            aromas: tastingNotes,
                        }
                    });
                    console.log(`    ✓ Updated [${variant.skuCode}] ${variant.productName}`);
                    dbUpdatedCount++;
                }
            } else {
                console.log(`  ✓ [DRY-RUN] Will update this product and its vintage variants in live run.`);
            }

        } catch (error: any) {
            console.error(`  ❌ Error processing file: ${error.message}`);
        } finally {
            if (parser) {
                await parser.destroy();
            }
        }
        console.log();
    }

    console.log(`==================================================`);
    console.log(`🎉 Process Completed!`);
    console.log(`- Matched PDF documents: ${matchedCount}/${pdfFiles.length}`);
    if (!isDryRun) {
        console.log(`- Total Database records updated: ${dbUpdatedCount}`);
    } else {
        console.log(`- Dry-run completed successfully. No records were written.`);
    }
    console.log(`==================================================\n`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
        await prisma.$disconnect();
    });
