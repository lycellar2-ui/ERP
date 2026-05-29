import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: '.env.local' })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const connectionString = process.env.DATABASE_URL!
const pool = new pg.Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const PICTURES_DIR = 'D:\\Lyscellar\\Marketing\\Design Files\\Pictures';
const BACKUP_FILE = path.join(process.cwd(), 'scripts', 'backup_product_media.json');

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

async function checkUrlStatus(url: string): Promise<{ ok: boolean; status?: number }> {
    try {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        // ImgBB displays a 404 page with 404 status when an image is deleted/not found
        return { ok: res.status === 200, status: res.status };
    } catch (e) {
        try {
            // Fallback to GET just in case HEAD is not supported properly
            const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
            return { ok: res.status === 200, status: res.status };
        } catch (err) {
            return { ok: false };
        }
    }
}

async function main() {
    console.log("🍷 [1/4] Starting Backup of ProductMedia Table...");
    
    // Fetch all current product media
    const allMedia = await prisma.productMedia.findMany();
    console.log(`Found ${allMedia.length} media records in database.`);
    
    // Write backup to JSON file
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(allMedia, null, 2));
    console.log(`✓ Backup successfully saved to: ${BACKUP_FILE}\n`);

    console.log("🍷 [2/4] Scanning Products for Missing or Broken Images...");
    
    const dbProducts = await prisma.product.findMany({
        where: { deletedAt: null },
        include: {
            media: {
                where: { mediaType: 'PRODUCT_MAIN' },
                orderBy: { isPrimary: 'desc' }
            }
        }
    });

    console.log(`Loaded ${dbProducts.length} active products from database.`);
    
    const missingOrBrokenProducts: { product: typeof dbProducts[0]; reason: string }[] = [];
    
    for (let i = 0; i < dbProducts.length; i++) {
        const p = dbProducts[i];
        process.stdout.write(`  Checking [${i + 1}/${dbProducts.length}] Product: ${p.skuCode}... `);
        
        if (p.media.length === 0) {
            console.log("❌ MISSING (No media entries in database)");
            missingOrBrokenProducts.push({ product: p, reason: 'missing' });
        } else {
            const primaryMedia = p.media.find(m => m.isPrimary) || p.media[0];
            const check = await checkUrlStatus(primaryMedia.url);
            if (!check.ok) {
                console.log(`❌ BROKEN (URL: ${primaryMedia.url} returned status ${check.status ?? 'failed'})`);
                missingOrBrokenProducts.push({ product: p, reason: 'broken' });
            } else {
                console.log("✅ OK");
            }
        }
    }

    console.log(`\nFound ${missingOrBrokenProducts.length} products with missing or broken images.\n`);

    if (missingOrBrokenProducts.length === 0) {
        console.log("🎉 All active products have valid and working image links! No action required.");
        return;
    }

    console.log("🍷 [3/4] Matching with Local Images and Uploading...");
    
    if (!fs.existsSync(PICTURES_DIR)) {
        throw new Error(`Local pictures folder not found at: ${PICTURES_DIR}`);
    }

    const localFiles = fs.readdirSync(PICTURES_DIR);
    console.log(`Found ${localFiles.length} files in local folder: ${PICTURES_DIR}\n`);

    let uploadCount = 0;
    let dbUpdateCount = 0;

    for (let i = 0; i < missingOrBrokenProducts.length; i++) {
        const { product, reason } = missingOrBrokenProducts[i];
        console.log(`[${i + 1}/${missingOrBrokenProducts.length}] Processing missing/broken picture for SKU: ${product.skuCode} (${product.productName})`);
        
        // Look for matching local files: exact SKU base name (case-insensitive)
        const matchedFileName = localFiles.find(f => {
            const baseName = path.basename(f, path.extname(f)).trim().toLowerCase();
            return baseName === product.skuCode.toLowerCase();
        });

        if (!matchedFileName) {
            console.log(`  ⚠️ No local file matches SKU "${product.skuCode}" in local directory. Skipping.\n`);
            continue;
        }

        const localFilePath = path.join(PICTURES_DIR, matchedFileName);
        console.log(`  🔍 Matched local file: "${matchedFileName}" (${(fs.statSync(localFilePath).size / 1024 / 1024).toFixed(2)} MB)`);

        try {
            // Read file & encode base64
            const buffer = fs.readFileSync(localFilePath);
            const base64 = buffer.toString('base64');

            // Upload to ImgBB
            console.log(`  ⬆️ Uploading to ImgBB CDN...`);
            const result = await uploadToImgBB(base64, product.skuCode);

            if (!result.success || !result.url) {
                console.error(`  ❌ Failed to upload image to ImgBB: ${result.error}\n`);
                continue;
            }

            console.log(`  ✓ Uploaded successfully. URL: ${result.url}`);
            uploadCount++;

            // Update database records
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
                        isPrimary: true,
                    }
                });
                console.log(`  ✓ Updated database image link for [${product.skuCode}]`);
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
                console.log(`  ✓ Created new database image link for [${product.skuCode}]`);
            }
            dbUpdateCount++;
            console.log();
        } catch (err: any) {
            console.error(`  ❌ Error processing file for [${product.skuCode}]: ${err.message}\n`);
        }

        // Polite brief delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log("🍷 [4/4] Summary of Actions:");
    console.log(`- Database backup file: ${BACKUP_FILE}`);
    console.log(`- Checked products: ${dbProducts.length}`);
    console.log(`- Identified missing/broken: ${missingOrBrokenProducts.length}`);
    console.log(`- Uploaded files to ImgBB: ${uploadCount}`);
    console.log(`- Updated database records: ${dbUpdateCount}`);
    console.log(`==================================================\n`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
        await prisma.$disconnect();
    });
