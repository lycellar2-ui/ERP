import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

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

async function main() {
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

    console.log(`Total files in R2 products/tasting-notes/: ${r2Keys.size}`)

    const products = await prisma.product.findMany({
        where: { deletedAt: null },
        orderBy: { skuCode: 'asc' },
        select: { skuCode: true, productName: true, tastingNoteUrl: true },
    })

    let missingInR2 = 0
    for (const p of products) {
        const key = (p.tastingNoteUrl || '').replace('/api/r2-file/', '')
        const exists = key ? r2Keys.has(key) : false
        if (!exists) {
            missingInR2++
            console.log(`[MISSING IN R2] ${p.skuCode} | ${p.productName} | url=${p.tastingNoteUrl}`)
        }
    }
    console.log(`Products with missing R2 object: ${missingInR2}`)

    // Also check all files in D:\Lyscellar\Learning and Development\TASTING NOTES and D:\Lyscellar\Wiki\sources\TASTING NOTES
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

    const ldFiles = walk('D:\\Lyscellar\\Learning and Development\\TASTING NOTES')
    const wikiFiles = walk('D:\\Lyscellar\\Wiki\\sources\\TASTING NOTES')
    console.log(`Local files in Learning & Dev TASTING NOTES: ${ldFiles.length}`)
    console.log(`Local files in Wiki sources TASTING NOTES: ${wikiFiles.length}`)

    // Check which local files in Wiki\sources\TASTING NOTES are not in R2
    for (const f of [...ldFiles, ...wikiFiles]) {
        const base = path.basename(f)
        const safeName = base.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_+/g, '_')
        const key = `products/tasting-notes/${safeName}`
        if (!r2Keys.has(key)) {
            console.log(`[NOT UPLOADED YET] ${f} -> ${key}`)
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
