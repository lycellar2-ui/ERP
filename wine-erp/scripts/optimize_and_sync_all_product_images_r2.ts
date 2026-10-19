import * as path from 'path'
import * as fs from 'fs'
import dotenv from 'dotenv'
import sharp from 'sharp'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { prisma } from '../src/lib/db'
import { uploadBufferToR2 } from '../src/lib/storage-r2'

const SEARCH_DIRS = [
    'D:\\Lyscellar\\Wiki\\sources\\Marketing asset\\Pictures',
    'D:\\Lyscellar\\scratch\\prepared_images',
    'D:\\Lyscellar\\scratch\\extracted_images',
    'D:\\Lyscellar\\scratch\\extracted_images_horizontal',
]

const SPECIAL_MAP: Record<string, string> = {
    L20073: 'D:\\Lyscellar\\scratch\\labels_for_tcb\\cassaigne_red_bottle.png',
    L20074: 'D:\\Lyscellar\\scratch\\labels_for_tcb\\cassaigne_white_bottle.png',
}

function findLocalImageForSku(skuCode: string): string | null {
    if (SPECIAL_MAP[skuCode] && fs.existsSync(SPECIAL_MAP[skuCode])) {
        return SPECIAL_MAP[skuCode]
    }
    for (const dir of SEARCH_DIRS) {
        if (!fs.existsSync(dir)) continue
        for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
            const p = path.join(dir, `${skuCode}${ext}`)
            if (fs.existsSync(p)) {
                return p
            }
        }
    }
    return null
}

async function main() {
    console.log('=== Starting 157/157 Product Image Optimization & R2 Sync ===')

    // 1. Update v_product_rows PostgreSQL view to prefer COALESCE(thumbnailUrl, mediumUrl, url)
    await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE VIEW v_product_rows AS
        SELECT p.id,
            p."skuCode",
            p."productName",
            p."wineType",
            p.format,
            p."packagingType",
            p."unitsPerCase",
            (p."abvPercent")::double precision AS "abvPercent",
            p.country,
            p."barcodeEan",
            p.classification,
            p.status,
            p."createdAt",
            p."deletedAt",
            p."producerId",
            pr.name AS "producerName",
            pr.country AS "producerCountry",
            p."appellationId",
            ap.name AS "appellationName",
            p."volumeMl",
            p."hsCode",
            p."isAllocationEligible",
            p."selfDeclarationUrl",
            p."tastingNoteUrl",
            (mp."retailPrice")::double precision AS "retailPrice",
            (mp."wholesalePrice")::double precision AS "wholesalePrice",
            prof."originDetail",
            prof.certification,
            prof.color,
            prof.aromas,
            prof.palate,
            prof.style,
            prof."servingTemp",
            prof."foodPairings",
            prof."bestSuitedFor",
            prof.grapes,
            ( SELECT (COALESCE(sum(sl."qtyAvailable"), (0)::numeric))::integer AS "coalesce"
                   FROM stock_lots sl
                  WHERE ((sl."productId" = p.id) AND (sl.status = 'AVAILABLE'::"LotStatus"))) AS "totalStock",
            ( SELECT (count(*))::integer AS count
                   FROM product_media pm
                  WHERE (pm."productId" = p.id)) AS "mediaCount",
            ( SELECT COALESCE(pm."thumbnailUrl", pm."mediumUrl", pm.url)
                   FROM product_media pm
                  WHERE ((pm."productId" = p.id) AND (pm."isPrimary" = true))
                 LIMIT 1) AS "primaryImageUrl"
           FROM ((((products p
             JOIN producers pr ON ((p."producerId" = pr.id)))
             LEFT JOIN appellations ap ON ((p."appellationId" = ap.id)))
             LEFT JOIN product_margin_prices mp ON ((p.id = mp."productId")))
             LEFT JOIN product_profiles prof ON ((p.id = prof."productId")));
    `)
    console.log('[OK] Updated v_product_rows view to serve lightweight WebP thumbnails.')

    // 2. Fetch all 157 commercial products
    const products = await prisma.product.findMany({
        where: { deletedAt: null, NOT: { skuCode: { startsWith: 'E2E-' } } },
        orderBy: { skuCode: 'asc' },
        include: {
            media: { orderBy: [{ isPrimary: 'desc' }, { uploadedAt: 'asc' }] },
        },
    })

    let processedCount = 0
    let newlyAddedCount = 0
    let totalThumbBytes = 0
    let totalFullBytes = 0

    for (const product of products) {
        const localFile = findLocalImageForSku(product.skuCode)
        if (!localFile) {
            console.warn(`  [WARN] No local image found for ${product.skuCode}`)
            continue
        }

        const rawBuf = fs.readFileSync(localFile)

        // Generate 320px WebP thumbnail (~8-18 KB) and 900px WebP full image (~35-70 KB)
        const [thumbBuf, fullBuf] = await Promise.all([
            sharp(rawBuf)
                .rotate()
                .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 82, effort: 4 })
                .toBuffer(),
            sharp(rawBuf)
                .rotate()
                .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 86, effort: 4 })
                .toBuffer(),
        ])

        totalThumbBytes += thumbBuf.byteLength
        totalFullBytes += fullBuf.byteLength

        const thumbKey = `products/images/thumbs/${product.skuCode}.webp`
        const fullKey = `products/images/full/${product.skuCode}.webp`

        const [thumbRes, fullRes] = await Promise.all([
            uploadBufferToR2(thumbBuf, thumbKey, 'image/webp'),
            uploadBufferToR2(fullBuf, fullKey, 'image/webp'),
        ])

        if (!thumbRes.success || !fullRes.success) {
            console.error(`  [ERR] R2 upload failed for ${product.skuCode}:`, thumbRes.error || fullRes.error)
            continue
        }

        const thumbUrl = thumbRes.url!
        const fullUrl = fullRes.url!

        const primaryMedia = product.media.find(m => m.isPrimary) || product.media[0]
        if (primaryMedia) {
            await prisma.productMedia.update({
                where: { id: primaryMedia.id },
                data: {
                    url: fullUrl,
                    mediumUrl: fullUrl,
                    thumbnailUrl: thumbUrl,
                    isPrimary: true,
                },
            })
        } else {
            await prisma.productMedia.create({
                data: {
                    productId: product.id,
                    mediaType: 'PRODUCT_MAIN',
                    url: fullUrl,
                    mediumUrl: fullUrl,
                    thumbnailUrl: thumbUrl,
                    isPrimary: true,
                    tags: [product.skuCode, product.country],
                },
            })
            newlyAddedCount++
        }

        processedCount++
        console.log(
            `  [${processedCount}/${products.length}] ${product.skuCode}: thumb=${(
                thumbBuf.byteLength / 1024
            ).toFixed(1)}KB | full=${(fullBuf.byteLength / 1024).toFixed(1)}KB`
        )
    }

    console.log('\n=============================================================')
    console.log(`IMAGE OPTIMIZATION & R2 SYNC COMPLETE:`)
    console.log(`- Total SKUs synced with WebP images: ${processedCount} / ${products.length}`)
    console.log(`- Newly populated missing SKUs: ${newlyAddedCount}`)
    console.log(
        `- Average Thumbnail Size: ${(totalThumbBytes / Math.max(1, processedCount) / 1024).toFixed(1)} KB`
    )
    console.log(
        `- Average Full Image Size: ${(totalFullBytes / Math.max(1, processedCount) / 1024).toFixed(1)} KB`
    )
    console.log('=============================================================')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
