import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

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

async function fetchImgBBPage(page: number): Promise<string> {
    const url = `https://cellar-ly.imgbb.com/?page=${page}`;
    console.log(`🌐 Fetching ImgBB Page ${page}: ${url}...`);
    
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch page ${page}: ${response.statusText}`);
    }

    return response.text();
}

interface ImgBBObject {
    id_encoded: string;
    image: {
        filename: string;
        name: string;
        mime: string;
        extension: string;
        url: string;
        size: string;
    };
    thumb?: {
        filename: string;
        name: string;
        mime: string;
        extension: string;
        url: string;
    };
    medium?: {
        filename: string;
        name: string;
        mime: string;
        extension: string;
        url: string;
    };
    name: string;
    title: string;
    display_url: string;
    url: string;
    url_viewer: string;
}

async function main() {
    console.log("🍷 Restoring Product Images from ImgBB Profile cellar-ly...");

    // 1. Fetch products from DB for matching
    const dbProducts = await prisma.product.findMany({
        select: { id: true, skuCode: true, productName: true }
    });
    console.log(`Loaded ${dbProducts.length} products from Database.`);

    // Map skuCode (lowercase) to DB product
    const productMap = new Map<string, any>();
    dbProducts.forEach(p => productMap.set(p.skuCode.toLowerCase().trim(), p));

    const allImgBBPictures: ImgBBObject[] = [];
    let page = 1;
    let hasMore = true;

    // We will scan up to 10 pages or stop if we find 0 items on a page
    while (hasMore && page <= 10) {
        try {
            const html = await fetchImgBBPage(page);
            
            // Match all data-object='...'
            const regex = /data-object='([^']*)'/g;
            let match;
            let countOnPage = 0;

            while ((match = regex.exec(html)) !== null) {
                const encodedJson = match[1];
                try {
                    const decodedJson = decodeURIComponent(encodedJson);
                    const obj = JSON.parse(decodedJson) as ImgBBObject;
                    if (obj.title && obj.url) {
                        allImgBBPictures.push(obj);
                        countOnPage++;
                    }
                } catch (e: any) {
                    console.error(`   ⚠️ Failed to decode/parse object: ${e.message}`);
                }
            }

            console.log(`   ✓ Found ${countOnPage} images on page ${page}.`);
            
            if (countOnPage === 0) {
                hasMore = false;
            } else {
                page++;
                // Polite delay between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (err: any) {
            console.error(`❌ Error fetching/parsing page ${page}: ${err.message}`);
            hasMore = false;
        }
    }

    console.log(`\nParsed a total of ${allImgBBPictures.length} unique images from ImgBB.`);

    let restoredCount = 0;
    let skippedCount = 0;

    // Clear current media first to avoid duplicates
    console.log("Clearing any existing media...");
    await prisma.productMedia.deleteMany({});

    const insertedProductIds = new Set<string>();

    for (const pic of allImgBBPictures) {
        const titleSku = pic.title.trim().toLowerCase();
        
        // Find DB product by SKU matching title
        let dbProd = productMap.get(titleSku);

        // Fallback: Check if SKU matches vintage suffix (e.g. L20019 matches L20019-21)
        if (!dbProd) {
            for (const [dbSku, prod] of productMap.entries()) {
                if (dbSku.startsWith(titleSku + '-')) {
                    dbProd = prod;
                    break;
                }
            }
        }

        if (!dbProd) {
            console.log(`  ⚠️ No database product matched SKU: "${pic.title}"`);
            skippedCount++;
            continue;
        }

        // Enforce uniqueness: Only insert one primary image per product
        if (insertedProductIds.has(dbProd.id)) {
            continue;
        }
        insertedProductIds.add(dbProd.id);

        // Insert into ProductMedia
        await prisma.productMedia.create({
            data: {
                productId: dbProd.id,
                mediaType: 'PRODUCT_MAIN',
                url: pic.url,
                thumbnailUrl: pic.thumb?.url || null,
                mediumUrl: pic.medium?.url || null,
                isPrimary: true,
            }
        });

        console.log(`   ✓ Restored ImgBB link for [${dbProd.skuCode}] -> ${pic.url}`);
        restoredCount++;
    }

    console.log(`\n🎉 Image Restoration Completed!`);
    console.log(`- Restored in DB: ${restoredCount} unique product images`);
    console.log(`- Skipped (unmatched): ${skippedCount} images`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
        await prisma.$disconnect();
    });
