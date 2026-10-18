import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!
const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 2,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '77bcd51bb60bed1a4b71c794c28b49f2'
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '4642b28f948f8d18f430186f1f7a5e36'
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '5e75f7e5f71c5afa72b67b175483e32b397b49a7b1d6aba426fed6c0bbe8ae9d'
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'wine-erp-documents'

const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
})

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    switch (ext) {
        case '.pdf': return 'application/pdf'
        case '.jpg':
        case '.jpeg': return 'image/jpeg'
        case '.png': return 'image/png'
        case '.pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        case '.md': return 'text/markdown; charset=utf-8'
        default: return 'application/octet-stream'
    }
}

async function uploadFile(filePath: string, customR2Name?: string): Promise<string> {
    const buffer = fs.readFileSync(filePath)
    const base = customR2Name || path.basename(filePath)
    const safeName = base.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_+/g, '_')
    const key = `products/tasting-notes/${safeName}`
    await r2Client.send(
        new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: getMimeType(filePath),
        })
    )
    return `/api/r2-file/${key}`
}

function walk(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out
    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry)
        const stat = fs.statSync(full)
        if (stat.isDirectory()) {
            if (!entry.includes('__MACOSX')) walk(full, out)
        } else if (!entry.startsWith('.')) {
            out.push(full)
        }
    }
    return out
}

async function main() {
    console.log('\n=================================================================')
    console.log('UPLOADING ALL REMAINING TASTING NOTES TO CLOUDFLARE R2')
    console.log('=================================================================\n')

    // 1. Get existing R2 keys
    let token: string | undefined
    const r2Keys = new Set<string>()
    do {
        const res = await r2Client.send(
            new ListObjectsV2Command({
                Bucket: R2_BUCKET,
                Prefix: 'products/tasting-notes/',
                ContinuationToken: token,
            })
        )
        for (const obj of res.Contents || []) {
            if (obj.Key) r2Keys.add(obj.Key)
        }
        token = res.NextContinuationToken
    } while (token)

    console.log(`Initial R2 object count in products/tasting-notes/: ${r2Keys.size}`)

    // 2. Upload all missing files from Learning & Dev and Wiki TASTING NOTES
    const ldFiles = walk('D:\\Lyscellar\\Learning and Development\\TASTING NOTES')
    const wikiFiles = walk('D:\\Lyscellar\\Wiki\\sources\\TASTING NOTES')

    let newlyUploaded = 0
    for (const f of [...ldFiles, ...wikiFiles]) {
        const base = path.basename(f)
        const safeName = base.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_+/g, '_')
        const key = `products/tasting-notes/${safeName}`
        if (!r2Keys.has(key)) {
            await uploadFile(f)
            r2Keys.add(key)
            newlyUploaded++
            console.log(`[UPLOADED] ${base} -> ${key}`)
        }
    }

    // 3. Upload additional tech sheets from Purchasing dossiers
    const extraDossierFiles: { filePath: string; r2Name: string }[] = [
        {
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Ethica\\CA\\Anselmi San Vincenzo tech sheet.pdf',
            r2Name: 'l10039_anselmi_san_vincenzo_bianco_veneto.pdf',
        },
        {
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Satoril mới\\Tasting note\\40003075 BiancoVulcanico_en.pdf',
            r2Name: 'terre_di_monteforte_bianco_vulcanico_en.pdf',
        },
        {
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Satoril mới\\RossoVulcanico-Scheda TecnicaMD EN.pdf',
            r2Name: 'terre_di_monteforte_rosso_vulcanico_scheda_tecnica.pdf',
        },
        {
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Pháp 08.2026\\Maison Bouey\\Label\\FT CH MOULIN DE LA BRIDANE Saint-Julien 2022 EN.pdf',
            r2Name: 'ft_ch_moulin_de_la_bridane_saint_julien_2022_en.pdf',
        },
        {
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Pháp 08.2026\\Maison Bouey\\Label\\FT Château La Ribaud 2015 EN.pdf',
            r2Name: 'ft_chateau_la_ribaud_2015_en.pdf',
        },
        {
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Pháp 08.2026\\Wilfried\\TCB\\Folie_Rouge_Malbec_2022_Export_FR_EN_139207.pdf',
            r2Name: 'folie_rouge_malbec_2022_export_fr_en.pdf',
        },
    ]

    for (const extra of extraDossierFiles) {
        if (fs.existsSync(extra.filePath)) {
            const url = await uploadFile(extra.filePath, extra.r2Name)
            r2Keys.add(url.replace('/api/r2-file/', ''))
            newlyUploaded++
            console.log(`[UPLOADED EXTRA] ${extra.r2Name}`)
        }
    }

    // 4. Fix exact SKU links where fuzzy match had pointed to generic/wrong files
    const exactFixes: { skuCode: string; url: string }[] = [
        {
            skuCode: 'L10025',
            url: '/api/r2-file/products/tasting-notes/l10025_la_jara_prosecco_rose_millesimato_brut_doc.pdf',
        },
        {
            skuCode: 'L10037',
            url: '/api/r2-file/products/tasting-notes/labels_amarone.pdf',
        },
        {
            skuCode: 'L10038',
            url: '/api/r2-file/products/tasting-notes/price_list_sartori_2023.pdf',
        },
        {
            skuCode: 'L10039',
            url: '/api/r2-file/products/tasting-notes/l10039_anselmi_san_vincenzo_bianco_veneto.pdf',
        },
        {
            skuCode: 'L20064',
            url: '/api/r2-file/products/tasting-notes/l20064_el_pinot.pdf',
        },
        {
            skuCode: 'L20067',
            url: '/api/r2-file/products/tasting-notes/l20067_locus_folle_b.pdf',
        },
        {
            skuCode: 'L30001',
            url: '/api/r2-file/products/tasting-notes/l30001_vina_san_esteban_classic_cabernet_sauvignon.pdf',
        },
    ]

    for (const fix of exactFixes) {
        await prisma.product.updateMany({
            where: { skuCode: fix.skuCode, deletedAt: null },
            data: { tastingNoteUrl: fix.url },
        })
        console.log(`[FIXED LINK] ${fix.skuCode} -> ${fix.url}`)
    }

    // Update L10039 ProductProfile to match Anselmi San Vincenzo Bianco Veneto
    const l10039 = await prisma.product.findFirst({
        where: { skuCode: 'L10039', deletedAt: null },
        select: { id: true },
    })
    if (l10039) {
        await prisma.productProfile.upsert({
            where: { productId: l10039.id },
            create: {
                productId: l10039.id,
                grapes: '40% Sauvignon Blanc & Sauvignier Gris, 30% Garganega, 30% Chardonnay, Goldtraminer, Pinot Bianco, Manzoni, Aromera, Riesling',
                color: 'Bright straw yellow with greenish reflections',
                aromas: 'Fruity and fresh with expressive aromas of tropical fruits, white flowers, and wild Mediterranean herbs.',
                palate: 'Fresh, mineral, and aromatic from high-altitude volcanic and calcareous soils between Monteforte and Soave; aged 6 months on the lees with weekly batonnage, revealing juicy pineapple and vibrant citrus.',
                foodPairings: 'Appetizers, seafood pasta, risotto, grilled fish, and fresh cheeses',
                servingTemp: '8 - 10°C',
                originDetail: 'Veneto IGT — Monteforte & Soave hillside, Veneto, Italy (Volcanic and calcareous soil)',
                style: 'Fresh, mineral & aromatic White Blend',
            },
            update: {
                grapes: '40% Sauvignon Blanc & Sauvignier Gris, 30% Garganega, 30% Chardonnay, Goldtraminer, Pinot Bianco, Manzoni, Aromera, Riesling',
                color: 'Bright straw yellow with greenish reflections',
                aromas: 'Fruity and fresh with expressive aromas of tropical fruits, white flowers, and wild Mediterranean herbs.',
                palate: 'Fresh, mineral, and aromatic from high-altitude volcanic and calcareous soils between Monteforte and Soave; aged 6 months on the lees with weekly batonnage, revealing juicy pineapple and vibrant citrus.',
                foodPairings: 'Appetizers, seafood pasta, risotto, grilled fish, and fresh cheeses',
                servingTemp: '8 - 10°C',
                originDetail: 'Veneto IGT — Monteforte & Soave hillside, Veneto, Italy (Volcanic and calcareous soil)',
                style: 'Fresh, mineral & aromatic White Blend',
            },
        })
        console.log(`[UPDATED PROFILE] L10039 -> Anselmi San Vincenzo Bianco Veneto`)
    }

    console.log('\n=================================================================')
    console.log(`COMPLETED! Newly uploaded files: ${newlyUploaded} | Total R2 files in products/tasting-notes/: ${r2Keys.size}`)
    console.log('=================================================================\n')
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
