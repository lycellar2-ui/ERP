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

const WIKI_DIR = 'D:\\Lyscellar\\Wiki\\wiki\\products'

// Utility to clean markdown links like [Text](Url) into Text
function cleanMarkdown(val: string | null | undefined): string | null {
    if (!val) return null
    return val.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
}

// Extract grapes from list or content
function extractGrapes(content: string): string | null {
    // 1. Try list patterns like - **Giống nho:** Corvina... or Giống nho: Corvina...
    const grapesMatch = content.match(/(?:-\s*\*\*Giống nho:\*\*|Giống nho:)\s*([^\n]+)/i)
    if (grapesMatch && grapesMatch[1].trim()) {
        return cleanMarkdown(grapesMatch[1].trim())
    }

    // 2. Fallback: Scan entire file for concept_nho links and grab grape names
    const grapeLinkRegex = /\[([^\]]+)\]\([^)]*concept_nho_[^)]+\)/gi
    const grapes: string[] = []
    let match
    while ((match = grapeLinkRegex.exec(content)) !== null) {
        const grapeName = match[1].trim()
        if (grapeName && !grapes.includes(grapeName)) {
            grapes.push(grapeName)
        }
    }

    if (grapes.length > 0) {
        return grapes.join(', ')
    }

    return null
}

// Extract serving temperature
function extractServingTemp(content: string): string | null {
    const tempMatch = content.match(/(?:Nhiệt độ phục vụ|Nhiệt độ uống|Température de service|Serving Temperature)[^\n:]*::?\s*([^\n]+)/i)
    if (tempMatch && tempMatch[1].trim()) {
        return cleanMarkdown(tempMatch[1].trim())
    }
    return null
}

// Parse markdown table rows
function parseProductProfileTable(content: string): Record<string, string | null> {
    const profile: Record<string, string | null> = {
        originDetail: null,
        certification: null,
        color: null,
        aromas: null,
        palate: null,
        style: null,
        foodPairings: null,
        bestSuitedFor: null,
    }

    const lines = content.split('\n')
    for (const line of lines) {
        const match = line.match(/^\|\s*\*\*([^*()]+)(?:\([^)]+\))?\*\*\s*\|\s*([^|]+)\|/i)
        if (match) {
            const key = match[1].trim().toLowerCase()
            const val = cleanMarkdown(match[2].trim())

            if (key.includes('origin') || key.includes('xuất xứ')) {
                profile.originDetail = val
            } else if (key.includes('certification') || key.includes('chứng chỉ')) {
                profile.certification = val
            } else if (key.includes('color') || key.includes('màu sắc')) {
                profile.color = val
            } else if (key.includes('aromas') || key.includes('hương thơm') || key.includes('nose')) {
                profile.aromas = val
            } else if (key.includes('palate') || key.includes('vị giác')) {
                profile.palate = val
            } else if (key.includes('style') || key.includes('phong cách')) {
                profile.style = val
            } else if (key.includes('food') || key.includes('món ăn')) {
                profile.foodPairings = val
            } else if (key.includes('suited') || key.includes('phù hợp')) {
                profile.bestSuitedFor = val
            }
        }
    }

    return profile
}

async function main() {
    const isDryRun = process.argv.includes('--dry-run')
    console.log(`\n==================================================`)
    console.log(`🍇 Wine ProductProfile Sync starting...`)
    console.log(`Wiki Directory: ${WIKI_DIR}`)
    console.log(`Mode: ${isDryRun ? 'DRY-RUN (SIMULATION)' : 'LIVE DATABASE SYNC'}`)
    console.log(`==================================================\n`)

    if (!fs.existsSync(WIKI_DIR)) {
        throw new Error(`Directory not found: ${WIKI_DIR}`)
    }

    // 1. Scan markdown files
    const files = fs.readdirSync(WIKI_DIR).filter(file => file.endsWith('.md'))
    console.log(`Found ${files.length} markdown product files in Wiki.\n`)

    let matchedFiles = 0
    let dbUpdatedCount = 0

    for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const filePath = path.join(WIKI_DIR, file)
        const content = fs.readFileSync(filePath, 'utf-8')

        // Extract SKU code from content or fallback to filename
        const skuMatch = content.match(/-\s*\*\*Mã sản phẩm\s*\(SKU\):\*\*\s*([^\s\n|]+)/i)
        let sku = skuMatch ? cleanMarkdown(skuMatch[1].trim()) : null
        
        if (sku) {
            // Clean any trailing symbols/brackets
            sku = sku.replace(/[\[\]]/g, '').trim().toUpperCase()
        }

        // Backup: extract from filename (e.g., prod_l10001.md -> L10001)
        const filenameSku = path.basename(file, '.md').replace(/^prod_/, '').toUpperCase()
        if (!sku) {
            sku = filenameSku
        }

        if (!sku) {
            console.log(`[${i + 1}/${files.length}] ⚠️ Could not identify SKU for file: ${file}`)
            continue
        }

        console.log(`[${i + 1}/${files.length}] Processing SKU: [${sku}] (File: ${file})`)

        // Parse characteristics
        const tableProfile = parseProductProfileTable(content)
        const grapes = extractGrapes(content)
        const servingTemp = extractServingTemp(content)

        const finalProfile = {
            ...tableProfile,
            grapes,
            servingTemp
        } as any

        // Output some stats
        console.log(`  Origin:        ${finalProfile.originDetail || 'N/A'}`)
        console.log(`  Grapes:        ${finalProfile.grapes || 'N/A'}`)
        console.log(`  Serving Temp:  ${finalProfile.servingTemp || 'N/A'}`)

        // 2. Sync to DB
        // Match variants (e.g. L10001 might have L10001, L10001-19, L10001-20 variants)
        const parentSku = sku.split('-')[0]
        const matchedProducts = await prisma.product.findMany({
            where: {
                deletedAt: null,
                skuCode: {
                    startsWith: parentSku
                }
            },
            select: { id: true, skuCode: true, productName: true }
        })

        if (matchedProducts.length === 0) {
            console.log(`  ⚠️ No active database product matches parent SKU prefix "${parentSku}"`)
            continue
        }

        matchedFiles++
        console.log(`  Found ${matchedProducts.length} database product variant(s): ${matchedProducts.map(p => p.skuCode).join(', ')}`)

        if (!isDryRun) {
            for (const product of matchedProducts) {
                await prisma.productProfile.upsert({
                    where: { productId: product.id },
                    create: {
                        productId: product.id,
                        originDetail: finalProfile.originDetail,
                        certification: finalProfile.certification,
                        color: finalProfile.color,
                        aromas: finalProfile.aromas,
                        palate: finalProfile.palate,
                        style: finalProfile.style,
                        servingTemp: finalProfile.servingTemp,
                        foodPairings: finalProfile.foodPairings,
                        bestSuitedFor: finalProfile.bestSuitedFor,
                        grapes: finalProfile.grapes
                    },
                    update: {
                        originDetail: finalProfile.originDetail,
                        certification: finalProfile.certification,
                        color: finalProfile.color,
                        aromas: finalProfile.aromas,
                        palate: finalProfile.palate,
                        style: finalProfile.style,
                        servingTemp: finalProfile.servingTemp,
                        foodPairings: finalProfile.foodPairings,
                        bestSuitedFor: finalProfile.bestSuitedFor,
                        grapes: finalProfile.grapes
                    }
                })
                dbUpdatedCount++
            }
            console.log(`  ✓ Successfully updated database profiles for variants.`)
        } else {
            console.log(`  ✓ [DRY-RUN] Will create/update profile for variants.`)
        }
        console.log()
    }

    console.log(`==================================================`)
    console.log(`🎉 Sync Completed!`)
    console.log(`- Files processed: ${matchedFiles}/${files.length}`)
    if (!isDryRun) {
        console.log(`- Database profiles upserted: ${dbUpdatedCount}`)
    } else {
        console.log(`- [DRY-RUN] simulation completed. No database changes were executed.`)
    }
    console.log(`==================================================\n`)
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
