import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

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

const PICTURES_DIR = 'D:\\Lyscellar\\Marketing\\Design Files\\Pictures';

async function uploadToImgBB(
    base64Image: string,
    name: string
): Promise<{ success: boolean; url?: string; thumbUrl?: string; mediumUrl?: string; error?: string }> {
    const apiKey = process.env.IMGBB_API_KEY
    if (!apiKey) return { success: false, error: 'IMGBB_API_KEY not configured in env' }

    const params = new URLSearchParams()
    params.append('key', apiKey)
    params.append('image', base64Image)
    params.append('name', name)

    try {
        const res = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        })
        const json: any = await res.json()

        if (!json.success) {
            return { success: false, error: json.error?.message ?? 'ImgBB upload failed' }
        }

        return {
            success: true,
            url: json.data.display_url,
            thumbUrl: json.data.thumb?.url,
            mediumUrl: json.data.medium?.url,
        }
    } catch (err: any) {
        return { success: false, error: err.message ?? 'Network error' }
    }
}

async function main() {
    console.log("🍷 Starting Batch Product Picture Upload & Database Synchronization...");
    console.log(`Checking pictures folder at: ${PICTURES_DIR}`);

    if (!fs.existsSync(PICTURES_DIR)) {
        throw new Error(`Folder not found: ${PICTURES_DIR}`);
    }

    // 1. Scan folder files
    const allFiles = fs.readdirSync(PICTURES_DIR);
    const imageFiles = allFiles.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ext === '.png' || ext === '.jpg' || ext === '.jpeg';
    });

    console.log(`Found ${allFiles.length} files in directory, including ${imageFiles.length} images.`);

    // 2. Fetch current products
    const dbProducts = await prisma.product.findMany({
        select: { id: true, skuCode: true, productName: true }
    });
    console.log(`Loaded ${dbProducts.length} active products from database.`);

    // 3. Process limits (Support --limit <number> argument)
    const limitArgIndex = process.argv.indexOf('--limit');
    let limit: number | null = null;
    if (limitArgIndex !== -1 && process.argv[limitArgIndex + 1]) {
        limit = parseInt(process.argv[limitArgIndex + 1], 10);
    }

    const filesToProcess = limit ? imageFiles.slice(0, limit) : imageFiles;
    if (limit) {
        console.log(`⚠️ Limit parameter passed. Processing only the first ${limit} image files.`);
    }

    console.log(`\n==================================================`);
    console.log(`Starting upload process for ${filesToProcess.length} images...`);
    console.log(`==================================================\n`);

    let uploadedCount = 0;
    let updatedDbRecords = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const baseName = path.basename(file, path.extname(file)).trim();
        const filePath = path.join(PICTURES_DIR, file);

        console.log(`[${i + 1}/${filesToProcess.length}] Processing file "${file}" (SKU: ${baseName})...`);

        // Check SKU parent match
        const matchedProducts = dbProducts.filter(p => p.skuCode === baseName || p.skuCode.startsWith(baseName + '-'));

        if (matchedProducts.length === 0) {
            console.log(`  ⚠️ No products found in DB matching SKU parent "${baseName}". Skipping upload.`);
            continue;
        }

        console.log(`  🔍 Matches found: ${matchedProducts.length} product(s) in DB:`);
        matchedProducts.forEach(p => console.log(`    - [${p.skuCode}] ${p.productName}`));

        // Read file & encode base64
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');

        // Upload to ImgBB
        console.log(`  ⬆️ Uploading to ImgBB CDN...`);
        const result = await uploadToImgBB(base64, baseName);

        if (!result.success || !result.url) {
            console.error(`  ❌ Failed to upload image to ImgBB: ${result.error}`);
            continue;
        }

        console.log(`  ✓ Uploaded successfully. URL: ${result.url}`);
        uploadedCount++;

        // Update database records
        for (const product of matchedProducts) {
            const existing = await prisma.productMedia.findFirst({
                where: { productId: product.id, mediaType: 'PRODUCT_MAIN' }
            });

            if (existing) {
                await prisma.productMedia.update({
                    where: { id: existing.id },
                    data: {
                        url: result.url,
                        thumbnailUrl: result.thumbUrl ?? null,
                        mediumUrl: result.mediumUrl ?? null,
                    }
                });
                console.log(`    ✓ Updated database image link for [${product.skuCode}]`);
            } else {
                await prisma.productMedia.create({
                    data: {
                        productId: product.id,
                        url: result.url,
                        thumbnailUrl: result.thumbUrl ?? null,
                        mediumUrl: result.mediumUrl ?? null,
                        mediaType: 'PRODUCT_MAIN',
                        isPrimary: true,
                    }
                });
                console.log(`    ✓ Created database image link for [${product.skuCode}]`);
            }
            updatedDbRecords++;
        }

        // Brief delay between requests to be polite to the ImgBB API
        await new Promise(resolve => setTimeout(resolve, 400));
        console.log();
    }

    console.log(`\n==================================================`);
    console.log(`🎉 Batch Picture Upload Process Completed!`);
    console.log(`- Uploaded files to ImgBB: ${uploadedCount}`);
    console.log(`- Updated database records: ${updatedDbRecords}`);
    console.log(`==================================================\n`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
        await prisma.$disconnect();
    });
