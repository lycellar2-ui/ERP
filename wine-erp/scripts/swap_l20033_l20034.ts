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

async function main() {
    console.log("🔍 Checking L20033 and L20034 in DB...");

    const p33 = await prisma.product.findFirst({
        where: { skuCode: { startsWith: 'L20033' } },
        include: { media: true }
    });

    const p34 = await prisma.product.findFirst({
        where: { skuCode: { startsWith: 'L20034' } },
        include: { media: true }
    });

    console.log("Product L20033:", p33?.skuCode, p33?.productName);
    console.log("Media L20033:", p33?.media);

    console.log("Product L20034:", p34?.skuCode, p34?.productName);
    console.log("Media L20034:", p34?.media);

    if (!p33 || !p34) {
        console.error("❌ Could not find products in database!");
        return;
    }

    const media33 = p33.media[0];
    const media34 = p34.media[0];

    if (!media33 || !media34) {
        console.error("❌ One or both products lack media records!");
        return;
    }

    console.log("🔄 Swapping media records between L20033 and L20034...");

    // Swap media attributes: url, thumbnailUrl, mediumUrl
    await prisma.productMedia.update({
        where: { id: media33.id },
        data: {
            url: media34.url,
            thumbnailUrl: media34.thumbnailUrl,
            mediumUrl: media34.mediumUrl
        }
    });

    await prisma.productMedia.update({
        where: { id: media34.id },
        data: {
            url: media33.url,
            thumbnailUrl: media33.thumbnailUrl,
            mediumUrl: media33.mediumUrl
        }
    });

    console.log("✅ Successfully swapped product images between L20033 and L20034 in Database!");
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
