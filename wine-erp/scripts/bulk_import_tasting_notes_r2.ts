import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createRequire } from 'module'

const requireModule = createRequire(import.meta.url)
const { PDFParse } = requireModule('pdf-parse')

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

// R2 Storage Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '77bcd51bb60bed1a4b71c794c28b49f2'
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '4642b28f948f8d18f430186f1f7a5e36'
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '5e75f7e5f71c5afa72b67b175483e32b397b49a7b1d6aba426fed6c0bbe8ae9d'
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'wine-erp-documents'
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN

const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
})

const PRIMARY_NOTES_DIR = 'D:\\Lyscellar\\Learning and Development\\TASTING NOTES'
const SECONDARY_NOTES_DIR = 'D:\\Lyscellar\\Wiki\\sources\\TASTING NOTES'

function getAssetUrl(storagePath: string): string {
    const cleanPath = storagePath.replace(/^\/+/, '')
    if (R2_PUBLIC_DOMAIN) {
        const domain = R2_PUBLIC_DOMAIN.replace(/\/+$/, '')
        return `${domain}/${cleanPath}`
    }
    return `/api/r2-file/${cleanPath}`
}

async function uploadToR2(
    buffer: Buffer,
    key: string,
    contentType: string = 'application/pdf'
): Promise<string> {
    await r2Client.send(
        new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        })
    )
    return getAssetUrl(key)
}

// ─── String Normalization & Fuzzy Match ────────────────────────────

function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\(\)\[\]\-\_\,\.\:\;\/\?\!\*\+\#]/g, ' ')
        .replace(/\b(18|19|20)\d{2}\b/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function getTokens(str: string): string[] {
    const stopwords = new Set(['and', 'of', 'the', 'in', 'with', 'for', 'a', 'an', 'to', 'by', 'at', 'on', 'vdf', 'doc', 'docg', 'igt', 'cru', 'ft', 'en', 'tn', 'tasting', 'note', 'notes'])
    return normalizeString(str)
        .split(' ')
        .filter(t => t.length > 1 && !stopwords.has(t))
}

type DBProduct = {
    id: string
    skuCode: string
    productName: string
    producerName: string
    tastingNoteUrl: string | null
}

function findBestMatch(fileRelativePath: string, dbProducts: DBProduct[]): { product: DBProduct; score: number } | null {
    const fileName = path.basename(fileRelativePath, path.extname(fileRelativePath))
    const folderName = path.dirname(fileRelativePath).split(path.sep).pop() || ''
    
    const targetString = `${folderName} ${fileName}`
    const fileTokens = getTokens(targetString)
    
    if (fileTokens.length === 0) return null

    let bestMatch: DBProduct | null = null
    let highestScore = 0

    for (const product of dbProducts) {
        const productString = `${product.producerName} ${product.productName}`
        const productTokens = getTokens(productString)
        
        const intersection = fileTokens.filter(t => productTokens.includes(t))
        let score = intersection.length / Math.max(fileTokens.length, productTokens.length)

        const cleanTarget = normalizeString(targetString)
        const cleanProduct = normalizeString(productString)
        
        if (cleanProduct.includes(cleanTarget) || cleanTarget.includes(cleanProduct)) {
            score += 0.25
        }

        const cleanSku = product.skuCode.toLowerCase().replace(/[^a-z0-9]/g, '')
        const cleanFile = fileName.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (cleanFile.includes(cleanSku)) {
            score += 0.4
        }

        if (score > highestScore) {
            highestScore = score
            bestMatch = product
        }
    }

    if (bestMatch && highestScore >= 0.35) {
        return { product: bestMatch, score: highestScore }
    }

    return null
}

// ─── PDF Parsing & Wine Profile Extractor ─────────────────────────

function extractWineDetailsFromText(rawText: string): {
    notes: string
    foodPairings?: string
    grapes?: string
} {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    let tastingParagraphs: string[] = []
    let foodPairingText = ''
    let grapesText = ''
    let activeSection = ''

    const sectionsRegex = /^(tasting notes|palate|nose|aroma|bouquet|appearance|colour|food pairing|pairings|winemaking|viticulture|varietals|grape varieties|grape variety|blend)/i

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const match = line.match(sectionsRegex)

        if (match) {
            const header = match[0].toUpperCase()
            if (header.includes('FOOD') || header.includes('PAIRING')) {
                activeSection = 'FOOD'
            } else if (header.includes('GRAPE') || header.includes('VARIET')) {
                activeSection = 'GRAPES'
            } else {
                activeSection = 'TASTING'
            }
            continue
        }

        if (line.includes('www.') || line.includes('@') || line.includes('Tel:') || line.includes('Fax:')) {
            continue
        }

        if (activeSection === 'FOOD' && !foodPairingText && line.length > 5) {
            foodPairingText = line
            activeSection = ''
        } else if (activeSection === 'GRAPES' && !grapesText && line.length > 3) {
            grapesText = line
            activeSection = ''
        } else if (activeSection === 'TASTING' && line.length > 15) {
            tastingParagraphs.push(line)
            activeSection = ''
        } else if (line.length > 50 && !line.includes('Page') && !/^\d+$/.test(line)) {
            tastingParagraphs.push(line)
        }
    }

    if (tastingParagraphs.length === 0) {
        const descParagraphs = lines.filter(l => 
            l.length > 50 && 
            !l.includes('www.') && 
            !l.includes('@') && 
            !l.includes('Phone') && 
            !l.includes('Page') &&
            !/^(abv|acidity|ph|residual|sugar|alcohol|vintage|winemaker)/i.test(l)
        )
        tastingParagraphs = descParagraphs.slice(0, 3)
    }

    let notes = tastingParagraphs.join(' ').replace(/\s+/g, ' ').trim()
    if (notes.length > 600) {
        notes = notes.slice(0, 597) + '...'
    }

    return {
        notes,
        foodPairings: foodPairingText || undefined,
        grapes: grapesText || undefined,
    }
}

function walkDir(dir: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList
    const entries = fs.readdirSync(dir)
    for (const entry of entries) {
        const fullPath = path.join(dir, entry)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
            walkDir(fullPath, fileList)
        } else if (path.extname(entry).toLowerCase() === '.pdf') {
            fileList.push(fullPath)
        }
    }
    return fileList
}

async function main() {
    console.log(`\n=================================================================`)
    console.log(`🍷 BULK IMPORT TASTING NOTES TO CLOUDFLARE R2 & WINE DATABASE`)
    console.log(`Target Bucket: ${R2_BUCKET}`)
    console.log(`=================================================================\n`)

    const filesToProcess: string[] = []
    if (fs.existsSync(PRIMARY_NOTES_DIR)) {
        walkDir(PRIMARY_NOTES_DIR, filesToProcess)
    }
    if (fs.existsSync(SECONDARY_NOTES_DIR)) {
        walkDir(SECONDARY_NOTES_DIR, filesToProcess)
    }

    // Deduplicate by path
    const uniqueFiles = Array.from(new Set(filesToProcess))
    console.log(`Found ${uniqueFiles.length} tasting notes PDF files in repository storage.\n`)

    const dbProducts = await prisma.product.findMany({
        where: { deletedAt: null },
        include: {
            producer: { select: { name: true } }
        }
    })

    const productsList: DBProduct[] = dbProducts.map(p => ({
        id: p.id,
        skuCode: p.skuCode,
        productName: p.productName,
        producerName: p.producer.name,
        tastingNoteUrl: p.tastingNoteUrl,
    }))

    console.log(`Loaded ${productsList.length} active products from database.\n`)

    let uploadedCount = 0
    let matchedCount = 0
    let dbUpdatedCount = 0
    const unmatchedList: string[] = []

    for (let i = 0; i < uniqueFiles.length; i++) {
        const filePath = uniqueFiles[i]
        const fileName = path.basename(filePath)
        const match = findBestMatch(filePath, productsList)

        if (!match) {
            unmatchedList.push(fileName)
            console.log(`[${i + 1}/${uniqueFiles.length}] ⚠️  No match found for: "${fileName}"`)
            continue
        }

        matchedCount++
        const { product, score } = match
        console.log(`[${i + 1}/${uniqueFiles.length}] Match ${(score * 100).toFixed(0)}%: "${fileName}" -> [${product.skuCode}] ${product.productName}`)

        try {
            const buffer = fs.readFileSync(filePath)
            const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_+/g, '_')
            const r2Key = `products/tasting-notes/${safeName}`

            // 1. Upload to Cloudflare R2
            const r2Url = await uploadToR2(buffer, r2Key, 'application/pdf')
            uploadedCount++

            // 2. Parse text from PDF
            let parsedText = ''
            let parser: any = null
            try {
                parser = new PDFParse({ data: buffer })
                await parser.load()
                const res = await parser.getText()
                parsedText = res.text || ''
            } catch (pErr) {
                console.warn(`    ⚠️  PDF text parsing warning: ${(pErr as any).message}`)
            } finally {
                if (parser) {
                    try { await parser.destroy() } catch {}
                }
            }

            const { notes, foodPairings, grapes } = extractWineDetailsFromText(parsedText)

            // 3. Update database: product and all vintage variants with same parent SKU
            const parentSku = product.skuCode.split('-')[0]
            const matchedVariants = await prisma.product.findMany({
                where: {
                    deletedAt: null,
                    skuCode: {
                        startsWith: parentSku,
                    },
                },
                select: { id: true, skuCode: true, productName: true }
            })

            for (const variant of matchedVariants) {
                await prisma.product.update({
                    where: { id: variant.id },
                    data: { tastingNoteUrl: r2Url }
                })

                if (notes || foodPairings || grapes) {
                    await prisma.productProfile.upsert({
                        where: { productId: variant.id },
                        create: {
                            productId: variant.id,
                            aromas: notes || null,
                            foodPairings: foodPairings || null,
                            grapes: grapes || null,
                        },
                        update: {
                            ...(notes ? { aromas: notes } : {}),
                            ...(foodPairings ? { foodPairings } : {}),
                            ...(grapes ? { grapes } : {}),
                        }
                    })
                }

                dbUpdatedCount++
            }

            console.log(`    ✓ Uploaded to R2: ${r2Url}`)
            console.log(`    ✓ Linked to ${matchedVariants.length} SKU variant(s). Notes: ${notes ? notes.slice(0, 70) + '...' : '(N/A)'}`)

        } catch (err: any) {
            console.error(`    ❌ Error processing ${fileName}:`, err.message)
        }
    }

    console.log(`\n=================================================================`)
    console.log(`🎉 BULK IMPORT COMPLETED`)
    console.log(`- Total PDFs analyzed: ${uniqueFiles.length}`)
    console.log(`- Successfully matched: ${matchedCount}`)
    console.log(`- Uploaded to Cloudflare R2: ${uploadedCount} files`)
    console.log(`- Database records updated: ${dbUpdatedCount}`)
    if (unmatchedList.length > 0) {
        console.log(`- Unmatched PDFs (${unmatchedList.length}):`)
        unmatchedList.forEach(u => console.log(`    - ${u}`))
    }
    console.log(`=================================================================\n`)
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
