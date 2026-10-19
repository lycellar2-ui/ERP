import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!
const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 4,
    allowExitOnIdle: true,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

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
        case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        case '.doc': return 'application/msword'
        case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        case '.jpg':
        case '.jpeg': return 'image/jpeg'
        case '.png': return 'image/png'
        default: return 'application/octet-stream'
    }
}

function sanitizeFileName(name: string): string {
    const normalized = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, m => (m === 'đ' ? 'd' : 'D'))
    return normalized.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
}

const existingR2Keys = new Set<string>()
const localUploadedCache = new Map<string, string>()

async function loadExistingR2Keys() {
    let token: string | undefined
    do {
        const res = await r2Client.send(
            new ListObjectsV2Command({
                Bucket: R2_BUCKET,
                Prefix: 'products/legal-docs/',
                ContinuationToken: token,
            })
        )
        for (const obj of res.Contents || []) {
            if (obj.Key) existingR2Keys.add(obj.Key)
        }
        token = res.NextContinuationToken
    } while (token)
    console.log(`Existing R2 keys in products/legal-docs/: ${existingR2Keys.size}`)
}

async function ensureUploadedToR2(
    localPath: string,
    subFolder: 'tcb' | 'amendment' | 'testing' | 'labels',
    customPrefix?: string
): Promise<{ fileUrl: string; storagePath: string; fileName: string }> {
    const cacheKey = `${subFolder}:${localPath}:${customPrefix || ''}`
    const origFileName = path.basename(localPath)
    const safeBase = sanitizeFileName(customPrefix ? `${customPrefix}_${origFileName}` : origFileName)
    const r2Key = `products/legal-docs/${subFolder}/${safeBase}`
    const fileUrl = `/api/r2-file/${r2Key}`

    if (localUploadedCache.has(cacheKey) || existingR2Keys.has(r2Key)) {
        localUploadedCache.set(cacheKey, fileUrl)
        return { fileUrl, storagePath: r2Key, fileName: origFileName }
    }

    const buffer = fs.readFileSync(localPath)
    await r2Client.send(
        new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: r2Key,
            Body: buffer,
            ContentType: getMimeType(localPath),
        })
    )
    existingR2Keys.add(r2Key)
    localUploadedCache.set(cacheKey, fileUrl)
    console.log(`  [R2 UPLOAD] ${r2Key}`)
    return { fileUrl, storagePath: r2Key, fileName: origFileName }
}

interface DocSeed {
    skuCode: string
    group: 'TCB' | 'AMENDMENT' | 'TESTING'
    docNo: string
    name: string
    description?: string
    issueDate: Date
    issuingAuthority?: string
    version?: number
    localFilePath: string
}

async function main() {
    await loadExistingR2Keys()

    const products = await prisma.product.findMany({
        where: { deletedAt: null, NOT: { skuCode: { startsWith: 'E2E-' } } },
        select: { id: true, skuCode: true, productName: true },
    })
    const skuToProduct = new Map(products.map(p => [p.skuCode.toUpperCase(), p]))
    console.log(`Loaded ${skuToProduct.size} commercial SKUs from database.`)

    const seeds: DocSeed[] = []

    // ============================================================================
    // 1. Parse Wiki Product Markdowns (130 SKUs with exact TCB link & TCB number)
    // ============================================================================
    const wikiProdDir = 'D:\\Lyscellar\\Wiki\\wiki\\products'
    if (fs.existsSync(wikiProdDir)) {
        for (const f of fs.readdirSync(wikiProdDir).filter(x => x.endsWith('.md'))) {
            const fullMd = path.join(wikiProdDir, f)
            const content = fs.readFileSync(fullMd, 'utf8')
            const skuMatch = content.match(/\*\*Mã sản phẩm \(SKU\):\*\*\s*([^\r\n]+)/)
            if (!skuMatch) continue
            const sku = skuMatch[1].trim().toUpperCase()
            if (!skuToProduct.has(sku)) continue

            const tcbNoMatch = content.match(/\*\*Số TCB\*\*\s*\|\s*([^\r\n|]+)/)
            const yearMatch = content.match(/\*\*Năm CB\*\*\s*\|\s*(\d{4})/)
            const tcbLinkMatch = content.match(/\*\*Bản tự công bố:\*\*\s*\[([^\]]+)\]\(([^)]+)\)/)

            if (tcbLinkMatch) {
                const relUrl = decodeURIComponent(tcbLinkMatch[2].trim())
                const resolvedPath = path.resolve(wikiProdDir, relUrl)
                if (fs.existsSync(resolvedPath)) {
                    const rawTcbNo = tcbNoMatch ? tcbNoMatch[1].trim() : `TCB-${sku}`
                    const year = yearMatch ? parseInt(yearMatch[1], 10) : 2024
                    seeds.push({
                        skuCode: sku,
                        group: 'TCB',
                        docNo: `TCB-${sku}-${rawTcbNo.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
                        name: `Bản Tự Công Bố (${rawTcbNo})`,
                        description: `Hồ sơ Tự công bố sản phẩm số ${rawTcbNo} (Năm ${year})`,
                        issueDate: new Date(`${year}-06-15T00:00:00Z`),
                        issuingAuthority: 'Ban Quản lý ATTP / Chi cục ATVSTP',
                        version: 1,
                        localFilePath: resolvedPath,
                    })
                }
            }
        }
    }

    // ============================================================================
    // 2. Additional TCB files for newer 2025/2026 SKUs (L10037..L10046, L20073..74, L40010..14, L60005, L70001..05, L80001..06)
    // ============================================================================
    const extraTcbs: Array<{
        sku: string
        docNo: string
        name: string
        desc: string
        date: string
        filePath: string
        version?: number
    }> = [
        // Sartori 2026
        {
            sku: 'L10037',
            docNo: '05/TA-CB/2026',
            name: 'Bản Tự Công Bố 05/TA-CB/2026 — Sartori Reius Amarone',
            desc: 'Hồ sơ Tự công bố sản phẩm Rượu vang đỏ Sartori Reius Amarone della Valpolicella Classico',
            date: '2026-05-07',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Sartori\\05 TA.CB.2026 Reius Amarone.pdf',
        },
        {
            sku: 'L10038',
            docNo: '06/TA-CB/2026',
            name: 'Bản Tự Công Bố 06/TA-CB/2026 — Sartori Brolo di Sotto',
            desc: 'Hồ sơ Tự công bố sản phẩm Rượu vang đỏ Sartori Brolo di Sotto Valpolicella Classico',
            date: '2026-05-07',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Sartori\\06 TA.CB.2026 Brolo di Sotto Valpolicell.pdf',
        },
        // Lô Ý T7.2026 (L10039..L10046)
        {
            sku: 'L10039',
            docNo: '07/TA-CB/2026-L10039',
            name: 'Bản Tự Công Bố (Scan dấu đỏ) — Anselmi San Vincenzo Bianco Veneto',
            desc: 'Bản tự công bố sản phẩm Rượu vang trắng Anselmi San Vincenzo Bianco Veneto (Lô Ý T7/2026)',
            date: '2026-07-10',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Bản tự công bố scan Rượu vang trắng Anselmi San Vincenzo Bianco Veneto.pdf',
        },
        {
            sku: 'L10040',
            docNo: '08/TA-CB/2026-L10040',
            name: 'Bản Tự Công Bố (Scan dấu đỏ) — Buccia Nera Tenuta di Campriano Chianti',
            desc: 'Bản tự công bố sản phẩm Rượu vang đỏ Buccia Nera Tenuta di Campriano Chianti (Lô Ý T7/2026)',
            date: '2026-07-10',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Bản tự công bố scan Rượu vang đỏ Buccia Nera Tenuta di Campriano Chianti.pdf',
        },
        {
            sku: 'L10041',
            docNo: '09/TA-CB/2026-L10041',
            name: 'Bản Tự Công Bố (Scan dấu đỏ) — Buccia Nera ROSSORELATIVO',
            desc: 'Bản tự công bố sản phẩm Rượu vang đỏ Buccia Nera ROSSORELATIVO (Lô Ý T7/2026)',
            date: '2026-07-10',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Bản tự công bố scan Rượu vang đỏ Buccia Nera ROSSORELATIVO.pdf',
        },
        {
            sku: 'L10042',
            docNo: '10/TA-CB/2026-L10042',
            name: 'Bản Tự Công Bố (Scan dấu đỏ) — Petra Zingari Rosso Toscana',
            desc: 'Bản tự công bố sản phẩm Rượu vang đỏ Petra Zingari Rosso Toscana (Lô Ý T7/2026)',
            date: '2026-07-10',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Bản tự công bố scan Rượu vang đỏ Petra Zingari Rosso Toscana.pdf',
        },
        {
            sku: 'L10043',
            docNo: '11/TA-CB/2026-L10043',
            name: "Bản Tự Công Bố (Scan dấu đỏ) — Buccia Nera Pa'ro Rosso",
            desc: "Bản tự công bố sản phẩm Rượu vang đỏ Buccia Nera Pa'ro Rosso Toscana (Lô Ý T7/2026)",
            date: '2026-07-10',
            filePath: "D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Bản tự công bố scan Rượu vang đỏ Buccia Nera Pa'ro Rosso.pdf",
        },
        {
            sku: 'L10044',
            docNo: '12/TA-CB/2026-L10044',
            name: "Bản Tự Công Bố (Scan dấu đỏ) — Buccia Nera Pa'ro Orange",
            desc: "Bản tự công bố sản phẩm Rượu vang trắng Buccia Nera Pa'ro Orange Wine (Lô Ý T7/2026)",
            date: '2026-07-10',
            filePath: "D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Bản tự công bố scan Rượu vang trắng Buccia Nera Pa'ro Orange.pdf",
        },
        {
            sku: 'L10045',
            docNo: '13/TA-CB/2026-L10045',
            name: 'Bản Tự Công Bố (Scan dấu đỏ) — Terre di Monteforte Vulcanico Rosso Veneto',
            desc: 'Bản tự công bố sản phẩm Rượu vang đỏ Terre di Monteforte Vulcanico Rosso Veneto (Lô Ý T7/2026)',
            date: '2026-07-10',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Bản tự công bố scan Rượu vang đỏ Terre di Monteforte Vulcanico Rosso Veneto.pdf',
        },
        {
            sku: 'L10046',
            docNo: '14/TA-CB/2026-L10046',
            name: 'Bản Tự Công Bố (Scan dấu đỏ) — Terre di Monteforte Vulcanico Soave',
            desc: 'Bản tự công bố sản phẩm Rượu vang trắng Terre di Monteforte Vulcanico Soave (Lô Ý T7/2026)',
            date: '2026-07-10',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Bản tự công bố scan Rượu vang trắng Terre di Monteforte Vulcanico Soave.pdf',
        },
        // Cassaigne Plaimont (L20073, L20074)
        {
            sku: 'L20073',
            docNo: '28/TA-CB/2026-L20073',
            name: 'Bản Tự Công Bố 28/TA-CB/2026 — Cassaigne le Labyrinthe Côtes de Gascogne Rouge',
            desc: 'Bản tự công bố kèm dịch nhãn Rượu vang đỏ Cassaigne le Labyrinthe Côtes de Gascogne Rouge',
            date: '2026-08-05',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\28.TACB.26. Cassaigne le Labyrinthe Côtes de Gascogne Rouge + dich nhan.pdf',
        },
        {
            sku: 'L20074',
            docNo: '27/TA-CB/2026-L20074',
            name: 'Bản Tự Công Bố 27/TA-CB/2026 — Cassaigne le Labyrinthe Côtes de Gascogne Blanc',
            desc: 'Bản tự công bố kèm dịch nhãn Rượu vang trắng Cassaigne le Labyrinthe Côtes de Gascogne Blanc',
            date: '2026-08-05',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\27.TACB.26. Cassaigne le Labyrinthe Côtes de Gascogne Blanc + dich nhan.pdf',
        },
        // Maison Bouey & Lorgeril updated TCBs with CV + dịch nhãn (version 2)
        {
            sku: 'L20030',
            docNo: '03/THAAN-CB/2024-FULL',
            name: 'Bộ Hồ sơ TCB + Dịch nhãn — Chateau Moulin de la Bridane Saint-Julien',
            desc: 'Bản tự công bố kèm dịch nhãn đầy đủ phục vụ đăng ký ATTP & thông quan T8/2026',
            date: '2026-08-01',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\03. Tu cong bo Chateau Moulin de la Bridane Saint-Julien + dich nhan.pdf',
            version: 2,
        },
        {
            sku: 'L20068',
            docNo: '06/TA-CB/2025-FULL',
            name: 'Bộ Hồ sơ TCB + Công văn + Dịch nhãn — Esprit de Maison Blanche Rouge',
            desc: 'Bản tự công bố kèm công văn giải trình và dịch nhãn phục vụ thông quan T8/2026',
            date: '2026-08-01',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\06. Tu cong bo Esprit de Maison Blanche Rouge + CV + dich nhan.pdf',
            version: 2,
        },
        {
            sku: 'L20069',
            docNo: '12/TA-CB/2025-FULL',
            name: 'Bộ Hồ sơ TCB + Dịch nhãn — Esprit de Maison Blanche Blanc',
            desc: 'Bản tự công bố kèm dịch nhãn đầy đủ phục vụ thông quan T8/2026',
            date: '2026-08-01',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\12. Tu cong bo Esprit de Maison Blanche Blanc + dich nhan.pdf',
            version: 2,
        },
        {
            sku: 'L20063',
            docNo: '08/TA-CB/2025-FULL',
            name: "Bộ Hồ sơ TCB + Công văn + Dịch nhãn — La Petite Rosee d'Ete Pays d'Oc",
            desc: 'Bản tự công bố kèm công văn và dịch nhãn phục vụ thông quan T8/2026',
            date: '2026-08-01',
            filePath: "D:\\Lyscellar\\ATTP\\Tự công bố\\08. Tu cong bo La Petite Rosee d'Ete Pays d'Oc + CV + dich nhan.pdf",
            version: 2,
        },
        // Calabria & The Wall (L40010..L40014)
        {
            sku: 'L40010',
            docNo: '05/TA-CB/2026-L40010',
            name: 'Bản Tự Công Bố — Rượu vang đỏ The Wall Shiraz',
            desc: 'Hồ sơ Tự công bố sản phẩm Calabria The Wall Shiraz (Barossa Valley)',
            date: '2026-07-01',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\LAbel rượu\\Ho so TCB, dich nhan, kiem nghiem ATTP\\05. Tu cong bo Rượu vang đỏ The Wall Shiraz.docx',
        },
        {
            sku: 'L40011',
            docNo: '04/TA-CB/2026-L40011',
            name: 'Bản Tự Công Bố — Rượu vang trắng The Wall Chardonnay',
            desc: 'Hồ sơ Tự công bố sản phẩm Calabria The Wall Chardonnay',
            date: '2026-07-01',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\LAbel rượu\\Ho so TCB, dich nhan, kiem nghiem ATTP\\04. Tu cong bo Rượu vang trắng The Wall Chardonnay.docx',
        },
        {
            sku: 'L40012',
            docNo: '03/TA-CB/2026-L40012',
            name: 'Bản Tự Công Bố — Rượu vang đỏ Calabria Guiding Star Shiraz',
            desc: 'Hồ sơ Tự công bố sản phẩm Calabria Guiding Star Shiraz',
            date: '2026-07-01',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\LAbel rượu\\Ho so TCB, dich nhan, kiem nghiem ATTP\\03. Tu cong bo Rượu vang đỏ Calabria Guiding Star Shiraz.docx',
        },
        {
            sku: 'L40013',
            docNo: '01/TA-CB/2026-L40013',
            name: 'Bản Tự Công Bố — Rượu vang trắng Calabria Guiding Star Chardonnay',
            desc: 'Hồ sơ Tự công bố sản phẩm Calabria Guiding Star Chardonnay',
            date: '2026-07-01',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\LAbel rượu\\Ho so TCB, dich nhan, kiem nghiem ATTP\\01. Tu cong bo Rượu vang trắng Calabria Guiding Star Chardonnay.docx',
        },
        {
            sku: 'L40014',
            docNo: '02/TA-CB/2026-L40014',
            name: 'Bản Tự Công Bố — Rượu vang trắng Calabria Guiding Star Moscato',
            desc: 'Hồ sơ Tự công bố sản phẩm Calabria Guiding Star Moscato',
            date: '2026-07-01',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\LAbel rượu\\Ho so TCB, dich nhan, kiem nghiem ATTP\\02. Tu cong bo Rượu vang trắng Calabria Guiding Star Moscato.docx',
        },
        // By Josh Scott Petillant Naturel (L60005)
        {
            sku: 'L60005',
            docNo: '12/TA-CB/2026-L60005',
            name: 'Bản Tự Công Bố 12/TA-CB/2026 — By Josh Scott Petillant Naturel',
            desc: 'Bản tự công bố sản phẩm Rượu vang nổ By Josh Scott Marlborough Petillant Naturel',
            date: '2026-06-15',
            filePath: 'D:\\Lyscellar\\Wiki\\TCB - Dịch nhãn - Tem phụ-20261012T022027Z-1-001\\TCB - Dịch nhãn - Tem phụ\\Tự công bố sản phẩm\\New Zealand\\12.TA.CB.2026 By Josh Scott Petillant Naturel.pdf',
        },
        // Duckhorn & Decoy (L70001..L70005)
        {
            sku: 'L70001',
            docNo: 'TCB-DN-2026-L70001',
            name: 'Hồ sơ Tự Công Bố & Dịch nhãn — Decoy California Pinot Noir',
            desc: 'Hồ sơ tự công bố & dịch nhãn tiếng Việt Rượu vang đỏ Decoy California Pinot Noir (Lô Mỹ T8/2026)',
            date: '2026-08-15',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Mỹ T8.2026\\TCB\\Dich nhan Rượu vang đỏ Decoy California Pinot Noir.docx',
        },
        {
            sku: 'L70002',
            docNo: 'TCB-DN-2026-L70002',
            name: 'Hồ sơ Tự Công Bố & Dịch nhãn — Decoy California Cabernet Sauvignon',
            desc: 'Hồ sơ tự công bố & dịch nhãn tiếng Việt Rượu vang đỏ Decoy California Cabernet Sauvignon (Lô Mỹ T8/2026)',
            date: '2026-08-15',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Mỹ T8.2026\\TCB\\Dich nhan Rượu vang đỏ Decoy California Cabernet Sauvignon.docx',
        },
        {
            sku: 'L70003',
            docNo: 'TCB-DN-2026-L70003',
            name: 'Hồ sơ Tự Công Bố & Dịch nhãn — Duckhorn Napa Valley Merlot',
            desc: 'Hồ sơ tự công bố & dịch nhãn tiếng Việt Rượu vang đỏ Duckhorn Napa Valley Merlot (Lô Mỹ T8/2026)',
            date: '2026-08-15',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Mỹ T8.2026\\TCB\\Dich nhan Rượu vang đỏ Duckhorn Napa Valley Merlot.docx',
        },
        {
            sku: 'L70004',
            docNo: 'TCB-DN-2026-L70004',
            name: 'Hồ sơ Tự Công Bố & Dịch nhãn — Duckhorn Napa Valley Cabernet Sauvignon',
            desc: 'Hồ sơ tự công bố & dịch nhãn tiếng Việt Rượu vang đỏ Duckhorn Napa Valley Cabernet Sauvignon (Lô Mỹ T8/2026)',
            date: '2026-08-15',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Mỹ T8.2026\\TCB\\Dich nhan Rượu vang đỏ Duckhorn Napa Valley Cabernet Sauvignon.docx',
        },
        {
            sku: 'L70005',
            docNo: 'TCB-DN-2026-L70005',
            name: 'Hồ sơ Tự Công Bố & Dịch nhãn — Decoy California Chardonnay',
            desc: 'Hồ sơ tự công bố & dịch nhãn tiếng Việt Rượu vang trắng Decoy California Chardonnay (Lô Mỹ T8/2026)',
            date: '2026-08-15',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Mỹ T8.2026\\TCB\\Dich nhan Rượu vang trắng Decoy California Chardonnay.docx',
        },
        // Anthonij Rupert & Protea South Africa (L80001..L80006) — both Scan Dấu Đỏ PDF & Individual Word TCB
        {
            sku: 'L80001',
            docNo: 'TCB-SCAN-2026-L80001',
            name: 'Bản Tự Công Bố (Scan dấu đỏ) — Anthonij Rupert Protea Shiraz',
            desc: 'Bản tự công bố scan dấu đỏ kèm nhãn, dịch nhãn và KQ kiểm nghiệm Eurofins (Lô Nam Phi T9/2026)',
            date: '2026-09-12',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\Hồ sơ tham vấn giá\\09. TCB - Dich nhan - Kiem dinh\\09a. TCB scan dau do - 6 SKU (kem nhan, dich nhan, KQ kiem nghiem Eurofins).pdf',
        },
        {
            sku: 'L80001',
            docNo: 'TCB-DOCX-2026-L80001',
            name: 'Bản Tự Công Bố chi tiết — Rượu vang đỏ Anthonij Rupert Protea Shiraz',
            desc: 'File Bản tự công bố chi tiết SKU L80001 Protea Shiraz',
            date: '2026-09-10',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\TCB\\03. Tu cong bo Rượu vang đỏ Anthonij Rupert Protea Shiraz.docx',
            version: 2,
        },
        {
            sku: 'L80002',
            docNo: 'TCB-SCAN-2026-L80002',
            name: 'Bản Tự Công Bố (Scan dấu đỏ) — Anthonij Rupert Protea Cabernet Sauvignon',
            desc: 'Bản tự công bố scan dấu đỏ kèm nhãn, dịch nhãn và KQ kiểm nghiệm Eurofins (Lô Nam Phi T9/2026)',
            date: '2026-09-12',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\Hồ sơ tham vấn giá\\09. TCB - Dich nhan - Kiem dinh\\09a. TCB scan dau do - 6 SKU (kem nhan, dich nhan, KQ kiem nghiem Eurofins).pdf',
        },
        {
            sku: 'L80002',
            docNo: 'TCB-DOCX-2026-L80002',
            name: 'Bản Tự Công Bố chi tiết — Rượu vang đỏ Anthonij Rupert Protea Cabernet Sauvignon',
            desc: 'File Bản tự công bố chi tiết SKU L80002 Protea Cabernet Sauvignon',
            date: '2026-09-10',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\TCB\\03. Tu cong bo Rượu vang đỏ Anthonij Rupert Protea Cabernet Sauvignon.docx',
            version: 2,
        },
        {
            sku: 'L80003',
            docNo: 'TCB-SCAN-2026-L80003',
            name: 'Bản Tự Công Bố (Scan dấu đỏ) — Anthonij Rupert Optima',
            desc: 'Bản tự công bố scan dấu đỏ kèm nhãn, dịch nhãn và KQ kiểm nghiệm Eurofins (Lô Nam Phi T9/2026)',
            date: '2026-09-12',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\Hồ sơ tham vấn giá\\09. TCB - Dich nhan - Kiem dinh\\09a. TCB scan dau do - 6 SKU (kem nhan, dich nhan, KQ kiem nghiem Eurofins).pdf',
        },
        {
            sku: 'L80003',
            docNo: 'TCB-DOCX-2026-L80003',
            name: 'Bản Tự Công Bố chi tiết — Rượu vang đỏ Anthonij Rupert Optima',
            desc: 'File Bản tự công bố chi tiết SKU L80003 Anthonij Rupert Optima',
            date: '2026-09-10',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\TCB\\03. Tu cong bo Rượu vang đỏ Anthonij Rupert Optima.docx',
            version: 2,
        },
        {
            sku: 'L80004',
            docNo: 'TCB-SCAN-2026-L80004',
            name: 'Bản Tự Công Bố (Scan dấu đỏ) — Anthonij Rupert Blend',
            desc: 'Bản tự công bố scan dấu đỏ kèm nhãn, dịch nhãn và KQ kiểm nghiệm Eurofins (Lô Nam Phi T9/2026)',
            date: '2026-09-12',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\Hồ sơ tham vấn giá\\09. TCB - Dich nhan - Kiem dinh\\09a. TCB scan dau do - 6 SKU (kem nhan, dich nhan, KQ kiem nghiem Eurofins).pdf',
        },
        {
            sku: 'L80004',
            docNo: 'TCB-DOCX-2026-L80004',
            name: 'Bản Tự Công Bố chi tiết — Rượu vang đỏ Anthonij Rupert Blend',
            desc: 'File Bản tự công bố chi tiết SKU L80004 Anthonij Rupert Blend',
            date: '2026-09-10',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\TCB\\03. Tu cong bo Rượu vang đỏ Anthonij Rupert Blend.docx',
            version: 2,
        },
        {
            sku: 'L80005',
            docNo: 'TCB-SCAN-2026-L80005',
            name: 'Bản Tự Công Bố (Scan dấu đỏ) — Anthonij Rupert Protea Chenin Blanc',
            desc: 'Bản tự công bố scan dấu đỏ kèm nhãn, dịch nhãn và KQ kiểm nghiệm Eurofins (Lô Nam Phi T9/2026)',
            date: '2026-09-12',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\Hồ sơ tham vấn giá\\09. TCB - Dich nhan - Kiem dinh\\09a. TCB scan dau do - 6 SKU (kem nhan, dich nhan, KQ kiem nghiem Eurofins).pdf',
        },
        {
            sku: 'L80005',
            docNo: 'TCB-DOCX-2026-L80005',
            name: 'Bản Tự Công Bố chi tiết — Rượu vang trắng Anthonij Rupert Protea Chenin Blanc',
            desc: 'File Bản tự công bố chi tiết SKU L80005 Protea Chenin Blanc',
            date: '2026-09-10',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\TCB\\03. Tu cong bo Rượu vang trắng Anthonij Rupert Protea Chenin Blanc.docx',
            version: 2,
        },
        {
            sku: 'L80006',
            docNo: 'TCB-SCAN-2026-L80006',
            name: 'Bản Tự Công Bố (Scan dấu đỏ) — Anthonij Rupert Protea Sauvignon Blanc',
            desc: 'Bản tự công bố scan dấu đỏ kèm nhãn, dịch nhãn và KQ kiểm nghiệm Eurofins (Lô Nam Phi T9/2026)',
            date: '2026-09-12',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\Hồ sơ tham vấn giá\\09. TCB - Dich nhan - Kiem dinh\\09a. TCB scan dau do - 6 SKU (kem nhan, dich nhan, KQ kiem nghiem Eurofins).pdf',
        },
        {
            sku: 'L80006',
            docNo: 'TCB-DOCX-2026-L80006',
            name: 'Bản Tự Công Bố chi tiết — Rượu vang trắng Anthonij Rupert Protea Sauvignon Blanc',
            desc: 'File Bản tự công bố chi tiết SKU L80006 Protea Sauvignon Blanc',
            date: '2026-09-10',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\TCB\\03. Tu cong bo Rượu vang trắng Anthonij Rupert Protea Sauvignon Blanc.docx',
            version: 2,
        },
    ]

    for (const item of extraTcbs) {
        if (fs.existsSync(item.filePath)) {
            seeds.push({
                skuCode: item.sku,
                group: 'TCB',
                docNo: item.docNo,
                name: item.name,
                description: item.desc,
                issueDate: new Date(`${item.date}T00:00:00Z`),
                issuingAuthority: 'Ban Quản lý ATTP / Chi cục ATVSTP',
                version: item.version || 1,
                localFilePath: item.filePath,
            })
        }
    }

    // ============================================================================
    // 3. GROUP 2: THÔNG BÁO THAY ĐỔI SAU TCB (AMENDMENT)
    // ============================================================================
    const cvRoot =
        'D:\\Lyscellar\\Wiki\\TCB - Dịch nhãn - Tem phụ-20261012T022027Z-1-001\\TCB - Dịch nhãn - Tem phụ\\Tự công bố sản phẩm\\Công văn thông báo cập nhật TCB\\2025'
    const amendmentMappings: Array<{
        sku: string
        docNo: string
        name: string
        desc: string
        date: string
        filePath: string
    }> = [
        // Domaine de la Solitude
        {
            sku: 'L20019',
            docNo: 'CV-TD-2025-L20019',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Chateauneuf du Pape',
            desc: 'Thông báo thay đổi thông tin nhãn phụ & cập nhật sau tự công bố (Domaine de la Solitude)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Domaine de la Solttude\\Chateauneuf du Pape.docx'),
        },
        {
            sku: 'L20017',
            docNo: 'CV-TD-2025-L20017',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Cotes du Rhone Blanc',
            desc: 'Thông báo thay đổi thông tin nhãn phụ & cập nhật sau tự công bố (Domaine de la Solitude)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Domaine de la Solttude\\Cotes du Rhone blanc.docx'),
        },
        {
            sku: 'L20016',
            docNo: 'CV-TD-2025-L20016',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Cotes du Rhone Rouge',
            desc: 'Thông báo thay đổi thông tin nhãn phụ & cập nhật sau tự công bố (Domaine de la Solitude)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Domaine de la Solttude\\Cotes du Rhone Red.docx'),
        },
        {
            sku: 'L20018',
            docNo: 'CV-TD-2025-L20018',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Gigondas Bellecoste',
            desc: 'Thông báo thay đổi thông tin nhãn phụ & cập nhật sau tự công bố (Domaine de la Solitude)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Domaine de la Solttude\\Gigondas Bellecoste.docx'),
        },
        // Domaine du Meteore
        {
            sku: 'L20050',
            docNo: 'CV-TD-2025-L20050',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Meteore Carignides',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Domaine du Météore)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Domaine du Meteore\\Carignides.docx'),
        },
        {
            sku: 'L20049',
            docNo: 'CV-TD-2025-L20049',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Leonides Faugeres',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Domaine du Météore)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Domaine du Meteore\\Leonides Faugeres.docx'),
        },
        {
            sku: 'L20047',
            docNo: 'CV-TD-2025-L20047',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Le Meteore Blanc',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Domaine du Météore)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Domaine du Meteore\\Meteore Blanc.docx'),
        },
        {
            sku: 'L20048',
            docNo: 'CV-TD-2025-L20048',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Le Meteore Rouge',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Domaine du Météore)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Domaine du Meteore\\Meteore Rouge.docx'),
        },
        {
            sku: 'L20051',
            docNo: 'CV-TD-2025-L20051',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Meteore Perseides',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Domaine du Météore)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Domaine du Meteore\\Perseides.docx'),
        },
        {
            sku: 'L20052',
            docNo: 'CV-TD-2025-L20052',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Parangon Saint Chinian',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Domaine du Météore)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Domaine du Meteore\\Saint Chinian.docx'),
        },
        // DVP (Rochebin & Baudouin Millet)
        {
            sku: 'L20043',
            docNo: 'CV-TD-2025-L20043',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Bourgogne Aligote',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Domaine de Rochebin)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\DVP\\Bourgogne Aligote.docx'),
        },
        {
            sku: 'L20044',
            docNo: 'CV-TD-2025-L20044',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Bourgogne Chardonnay',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Domaine de Rochebin)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\DVP\\Bourgogne Chardonnay.docx'),
        },
        {
            sku: 'L20042',
            docNo: 'CV-TD-2025-L20042',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Baudouin Millet Bourgogne Chardonnay',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Baudouin Millet)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\DVP\\Bourgogne Chardonnay.docx'),
        },
        {
            sku: 'L20040',
            docNo: 'CV-TD-2025-L20040',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Baudouin Millet Chablis',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Baudouin Millet)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\DVP\\Chablis.docx'),
        },
        {
            sku: 'L20045',
            docNo: 'CV-TD-2025-L20045',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Macon Villages',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Domaine de Rochebin)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\DVP\\Macon Villages.docx'),
        },
        {
            sku: 'L20039',
            docNo: 'CV-TD-2025-L20039',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Petit Chablis',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Baudouin Millet)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\DVP\\Petit Chabis..docx'),
        },
        {
            sku: 'L20046',
            docNo: 'CV-TD-2025-L20046',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Bourgogne Pinot Noir',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (Domaine de Rochebin)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\DVP\\Pinot Noir.docx'),
        },
        // La Perriere
        {
            sku: 'L20034',
            docNo: 'CV-TD-2025-L20034',
            name: 'Công văn thông báo thay đổi thông tin nhãn — La Petite Perriere Pinot Noir',
            desc: 'Thông báo thay đổi thông tin nhãn & chỉ tiêu an toàn sau TCB (19/THAAN-CB/2024)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\La Perriere\\Pinot Noir.docx'),
        },
        {
            sku: 'L20033',
            docNo: 'CV-TD-2025-L20033',
            name: 'Công văn thông báo thay đổi thông tin nhãn — La Petite Perriere Sauvignon Blanc',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (18/THAAN-CB/2024)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\La Perriere\\Sauvignon Blanc.docx'),
        },
        // Lorgeril
        {
            sku: 'L20053',
            docNo: 'CV-TD-2025-L20053',
            name: "Công văn thông báo thay đổi thông tin nhãn — L'Orangeraie Cabernet Sauvignon",
            desc: 'Đã làm bổ sung TCB: thay đổi địa chỉ ở nhãn phụ và chỉ tiêu ATTP (38/THAAN-CB/2024)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Lorgeril\\L_Orangeraie Cabernet Sauvignon.docx'),
        },
        {
            sku: 'L20054',
            docNo: 'CV-TD-2025-L20054',
            name: "Công văn thông báo thay đổi thông tin nhãn — L'Orangeraie Pays d'Oc Viognier",
            desc: 'Đã làm bổ sung TCB: thay đổi địa chỉ ở nhãn phụ và chỉ tiêu ATTP (39/THAAN-CB/2024)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Lorgeril\\L_Orangeraie Pays d’Oc Viognier.docx'),
        },
        {
            sku: 'L20053',
            docNo: 'CV-TD-2026-LORGERIL-L20053',
            name: 'Thông báo thay đổi TCBSP Lorgeril T1/2026 (Bản scan PDF)',
            desc: 'Công văn thông báo thay đổi thông tin trên bản Tự công bố sản phẩm Lorgeril tháng 01/2026',
            date: '2026-01-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Lorgeril\\Thay doi TCBSP Lorgeril T1.26.pdf'),
        },
        {
            sku: 'L20054',
            docNo: 'CV-TD-2026-LORGERIL-L20054',
            name: 'Thông báo thay đổi TCBSP Lorgeril T1/2026 (Bản scan PDF)',
            desc: 'Công văn thông báo thay đổi thông tin trên bản Tự công bố sản phẩm Lorgeril tháng 01/2026',
            date: '2026-01-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Lorgeril\\Thay doi TCBSP Lorgeril T1.26.pdf'),
        },
        {
            sku: 'L20055',
            docNo: 'CV-TD-2026-LORGERIL-L20055',
            name: 'Thông báo thay đổi TCBSP Lorgeril T1/2026 (Bản scan PDF)',
            desc: 'Đã làm bổ sung TCB: địa chỉ ở nhãn phụ và chỉ tiêu ATTP (40/THAAN-CB/2024)',
            date: '2026-01-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Lorgeril\\Thay doi TCBSP Lorgeril T1.26.pdf'),
        },
        // Maison Bouey
        {
            sku: 'L20003',
            docNo: 'CV-TD-2025-L20003',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Colors 719',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (03/THAAN-CB/2022)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Maison Bouey\\Colors 719.docx'),
        },
        {
            sku: 'L20002',
            docNo: 'CV-TD-2025-L20002',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Maison Blanche Bordeaux Blanc',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (02/THAAN-CB/2022)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Maison Bouey\\Maison Blanche Bordeaux Blanc.docx'),
        },
        {
            sku: 'L20001',
            docNo: 'CV-TD-2025-L20001',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Maison Blanche Bordeaux Rouge',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (01/THAAN-CB/2022)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Maison Bouey\\Maison Blanche Bordeaux Rouge.docx'),
        },
        {
            sku: 'L20006',
            docNo: 'CV-TD-2025-L20006',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Oh La Vache Rouge',
            desc: 'Thông báo thay đổi chỉ tiêu an toàn & thông tin nhãn sau TCB (13/THAAN-CB/2022)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Maison Bouey\\Oh La Vache Rouge.docx'),
        },
        // Pardon & Fils
        {
            sku: 'L20025',
            docNo: 'CV-TD-2025-L20025',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Pardon & Fils Beaujolais Blanc',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (21/THAAN-CB/2023)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Pardon & Fils\\Beaujolais Blanc.docx'),
        },
        {
            sku: 'L20020',
            docNo: 'CV-TD-2025-L20020',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Pardon & Fils Beaujolais-Villages',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (16/THAAN-CB/2023)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Pardon & Fils\\Beaujolais-Villages..docx'),
        },
        {
            sku: 'L20023',
            docNo: 'CV-TD-2025-L20023',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Pardon & Fils Brouilly',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (19/THAAN-CB/2023)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Pardon & Fils\\Brouilly.docx'),
        },
        {
            sku: 'L20028',
            docNo: 'CV-TD-2025-L20028',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Pardon & Fils Bourgogne Chardonnay',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (24/THAAN-CB/2023)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Pardon & Fils\\Chardonnay.docx'),
        },
        {
            sku: 'L20022',
            docNo: 'CV-TD-2025-L20022',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Pardon & Fils Chenas Domaine du Dime',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (18/THAAN-CB/2023)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Pardon & Fils\\Chenas Domaine du Dime.docx'),
        },
        {
            sku: 'L20021',
            docNo: 'CV-TD-2025-L20021',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Pardon & Fils Chiroubles Les Chanteranes',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (17/THAAN-CB/2023)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Pardon & Fils\\Chiroubles Les Chanteranes.docx'),
        },
        {
            sku: 'L20024',
            docNo: 'CV-TD-2025-L20024',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Pardon & Fils Morgon La Croix Gaillard',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (20/THAAN-CB/2023)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Pardon & Fils\\Morgon La Croix Gaillard.docx'),
        },
        {
            sku: 'L20026',
            docNo: 'CV-TD-2025-L20026',
            name: 'Công văn thông báo thay đổi thông tin nhãn — Pardon & Fils Saint-Amour Les Diamantines',
            desc: 'Thông báo thay đổi thông tin nhãn sản phẩm sau TCB (22/THAAN-CB/2023)',
            date: '2025-08-15',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Pardon & Fils\\Saint-Amour Les Diamantines.docx'),
        },
        // Arco dei Giovi Pinot Grigio (L10007)
        {
            sku: 'L10007',
            docNo: 'CV-TD-2025-L10007',
            name: 'Thông báo cập nhật sản phẩm — Arco dei Giovi Pinot Grigio',
            desc: 'Update tự công bố L10007 (26/07/2025): thay đổi thông tin nhãn phụ và thiết kế nhãn chính',
            date: '2025-07-26',
            filePath: path.join(cvRoot, 'Công văn thông báo thay đổi thông tin nhãn\\Thông báo cập nhật sản phẩm Arco Pinot Grigio.docx'),
        },
        // Allan Scott / Josh Scott NZ (L60001..L60004)
        {
            sku: 'L60001',
            docNo: 'CV-TD-2025-L60001',
            name: 'Thông báo thay đổi trên CBSP (03/11/2025) — Sandy Cove Sauvignon Blanc',
            desc: 'Công văn thông báo thay đổi thông tin trên bản Tự công bố sản phẩm Allan Scott / Sandy Cove',
            date: '2025-11-03',
            filePath: path.join(cvRoot, 'Tự công bố sản phẩm\\Allan Scott\\TB thay doi tren CBSP 03.11.2025.docx'),
        },
        {
            sku: 'L60002',
            docNo: 'CV-TD-2025-L60002',
            name: 'Thông báo thay đổi trên CBSP (03/11/2025) — Sandy Cove Pinot Noir',
            desc: 'Công văn thông báo thay đổi thông tin trên bản Tự công bố sản phẩm Allan Scott / Sandy Cove',
            date: '2025-11-03',
            filePath: path.join(cvRoot, 'Tự công bố sản phẩm\\Allan Scott\\TB thay doi tren CBSP 03.11.2025.docx'),
        },
        {
            sku: 'L60003',
            docNo: 'CV-TD-2025-L60003',
            name: 'Thông báo thay đổi trên CBSP (03/11/2025) — By Josh Scott Yeah Cool Sauvignon Blanc',
            desc: 'Công văn thông báo thay đổi thông tin trên bản Tự công bố sản phẩm Allan Scott / Josh Scott',
            date: '2025-11-03',
            filePath: path.join(cvRoot, 'Tự công bố sản phẩm\\Allan Scott\\TB thay doi tren CBSP 03.11.2025.docx'),
        },
        {
            sku: 'L60004',
            docNo: 'CV-TD-2025-L60004',
            name: 'Thông báo thay đổi trên CBSP (03/11/2025) — By Josh Scott Deal With It Pinot Noir',
            desc: 'Công văn thông báo thay đổi thông tin trên bản Tự công bố sản phẩm Allan Scott / Josh Scott',
            date: '2025-11-03',
            filePath: path.join(cvRoot, 'Tự công bố sản phẩm\\Allan Scott\\TB thay doi tren CBSP 03.11.2025.docx'),
        },
        // Vina San Esteban Classic Merlot (L30002), Cabernet (L30001), Chardonnay (L30003)
        {
            sku: 'L30002',
            docNo: 'CV-TD-2026-L30002',
            name: 'Thông báo cập nhật nhãn chính, phụ & chỉ tiêu an toàn — VSE Classic Merlot',
            desc: 'Công văn thông báo cập nhật nhãn chính, nhãn phụ và chỉ tiêu an toàn sản phẩm Vina San Esteban Merlot',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\LAbel rượu\\Hồ sơ mẫu\\TB cap nhat nhan chinh, phu, chi tieu an toan SP VSE Merlot.docx',
        },
        {
            sku: 'L30001',
            docNo: 'CV-TD-2026-L30001',
            name: 'Thông báo bổ sung TCB: Địa chỉ nhãn phụ & Chỉ tiêu ATTP — VSE Classic Cabernet Sauvignon',
            desc: 'Đã làm bổ sung TCB (16/THAAN-CB/2022): thay đổi địa chỉ ở nhãn phụ và chỉ tiêu ATTP',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        {
            sku: 'L30003',
            docNo: 'CV-TD-2026-L30003',
            name: 'Thông báo bổ sung TCB: Địa chỉ nhãn phụ & Chỉ tiêu ATTP — VSE Classic Chardonnay',
            desc: 'Đã làm bổ sung TCB (19/THAAN-CB/2022): thay đổi địa chỉ ở nhãn phụ và chỉ tiêu ATTP',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        // Thay doi TCBSP T5.26.pdf & Danh sách hồ sơ TCB.xlsx items
        {
            sku: 'L20065',
            docNo: 'CV-TD-2026-L20065',
            name: 'Thông báo thay đổi TCBSP T5/2026 — El Chardo (02/TA-CB/2025)',
            desc: 'Thay đổi chỉ tiêu an toàn trong hồ sơ tự công bố sản phẩm (Đợt T5/2026)',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        {
            sku: 'L20064',
            docNo: 'CV-TD-2026-L20064',
            name: 'Thông báo thay đổi TCBSP T5/2026 — El Pinot (01/TA-CB/2025)',
            desc: 'Thay đổi chỉ tiêu an toàn trong hồ sơ tự công bố sản phẩm (Đợt T5/2026)',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        {
            sku: 'L20007',
            docNo: 'CV-TD-2026-L20007',
            name: 'Thông báo thay đổi TCBSP T5/2026 — Oh La Vache Blanc (14/THAAN-CB/2022)',
            desc: 'Thay đổi nhãn phụ và chỉ tiêu an toàn (Update TCB 20/08/2025 & T5/2026)',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        {
            sku: 'L20031',
            docNo: 'CV-TD-2026-L20031',
            name: 'Thông báo thay đổi TCBSP T5/2026 — Le Secret de Franc Maillet (04/THAAN-CB/2024)',
            desc: 'Thay đổi nhãn phụ: địa chỉ, độ cồn và chỉ tiêu an toàn',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        {
            sku: 'L20029',
            docNo: 'CV-TD-2026-L20029',
            name: 'Thông báo thay đổi TCBSP T5/2026 — Chateau Clos Cormey (02/THAAN-CB/2024)',
            desc: 'Thay đổi nhãn phụ: địa chỉ và thay đổi chỉ tiêu an toàn',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        {
            sku: 'L20068',
            docNo: 'CV-TD-2026-L20068',
            name: 'Thông báo thay đổi TCBSP T5/2026 — Esprit de Maison Blanche Rouge (06/TA-CB/2025)',
            desc: 'Thay đổi chỉ tiêu an toàn trên hồ sơ tự công bố sản phẩm',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        {
            sku: 'L10014',
            docNo: 'CV-TD-2026-L10014',
            name: 'Thông báo thay đổi TCBSP T5/2026 — Sartori Regolo Valpolicella Ripasso (04/THAAN-CB/2023)',
            desc: 'Thay đổi nhãn phụ: địa chỉ, độ cồn và chỉ tiêu an toàn',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        {
            sku: 'L10023',
            docNo: 'CV-TD-2026-L10023',
            name: 'Thông báo bổ sung TCB — La Jara Prosecco Millesimato Dry (06/THAAN-CB/2024)',
            desc: 'Đã làm bổ sung TCB: thay đổi địa chỉ ở nhãn phụ và chỉ tiêu ATTP',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        {
            sku: 'L10024',
            docNo: 'CV-TD-2026-L10024',
            name: 'Thông báo thay đổi TCBSP T5/2026 — La Jara Prosecco Zero Dosage (07/THAAN-CB/2024)',
            desc: 'Thay đổi chỉ tiêu an toàn trong hồ sơ tự công bố sản phẩm',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        {
            sku: 'L10025',
            docNo: 'CV-TD-2026-L10025',
            name: 'Thông báo bổ sung TCB — La Jara Prosecco Rose Millesimato Brut (08/THAAN-CB/2024)',
            desc: 'Đã làm bổ sung TCB: thay đổi địa chỉ ở nhãn phụ và chỉ tiêu ATTP',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        {
            sku: 'L10026',
            docNo: 'CV-TD-2026-L10026',
            name: 'Thông báo bổ sung TCB — La Jara Pinot Noir Blanc de Noir Brut Nature (09/THAAN-CB/2024)',
            desc: 'Đã làm bổ sung TCB: thay đổi địa chỉ ở nhãn phụ và chỉ tiêu ATTP',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
        {
            sku: 'L10027',
            docNo: 'CV-TD-2026-L10027',
            name: 'Thông báo thay đổi TCBSP T5/2026 — La Jara Chardonnay Brut Nature (10/THAAN-CB/2024)',
            desc: 'Thay đổi chỉ tiêu an toàn trong hồ sơ tự công bố sản phẩm',
            date: '2026-05-15',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Thay đổi TCB\\Thay doi TCBSP T5.26.pdf',
        },
    ]

    for (const item of amendmentMappings) {
        if (fs.existsSync(item.filePath)) {
            seeds.push({
                skuCode: item.sku,
                group: 'AMENDMENT',
                docNo: item.docNo,
                name: item.name,
                description: item.desc,
                issueDate: new Date(`${item.date}T00:00:00Z`),
                issuingAuthority: 'Công ty CP Thương mại Thắng Ân',
                version: 1,
                localFilePath: item.filePath,
            })
        }
    }

    // ============================================================================
    // 4. GROUP 3: PHIẾU KIỂM ĐỊNH / KẾT QUẢ KIỂM NGHIỆM (TESTING)
    // ============================================================================
    const kq2025Root =
        'D:\\Lyscellar\\Wiki\\TCB - Dịch nhãn - Tem phụ-20261012T022027Z-1-001\\TCB - Dịch nhãn - Tem phụ\\Tự công bố sản phẩm\\Kết quả kiểm định\\2025'
    const sartori2021Root =
        'D:\\Lyscellar\\Wiki\\TCB - Dịch nhãn - Tem phụ-20261012T022027Z-1-001\\TCB - Dịch nhãn - Tem phụ\\Tự công bố sản phẩm\\Ý\\Veneto\\Collis Heritage - Sartori\\2021'
    const attpSeptRoot = 'D:\\Lyscellar\\ATTP\\Kiểm định rượu\\Tháng 09.2026\\Kiểm định rượu tháng 9'
    const attpAugRoot = 'D:\\Lyscellar\\ATTP\\Kiểm định rượu\\Tháng 08.2026'
    const attpJulyRoot = 'D:\\Lyscellar\\ATTP\\Kiểm định rượu\\Tháng 07.2026'
    const attpLabelRoot = 'D:\\Lyscellar\\ATTP\\Tự công bố\\LAbel rượu\\Ho so TCB, dich nhan, kiem nghiem ATTP'

    const testMappings: Array<{
        sku: string
        docNo: string
        name: string
        desc: string
        date: string
        authority: string
        filePath: string
    }> = [
        // 2021 Sartori Lab Tests
        {
            sku: 'L10001',
            docNo: 'KD-2021-07-L10001',
            name: 'Phiếu Kết quả Kiểm định 07/KĐ/2021 — I Saltari Amarone della Valpolicella',
            desc: 'Phiếu kết quả kiểm nghiệm ATTP phục vụ công bố sản phẩm',
            date: '2021-10-15',
            authority: 'Viện Kiểm nghiệm / Quatest',
            filePath: path.join(sartori2021Root, '07_KĐ_2021.pdf'),
        },
        {
            sku: 'L10002',
            docNo: 'KD-2021-08-L10002',
            name: 'Phiếu Kết quả Kiểm định 08/KĐ/2021 — I Saltari Valpolicella Ripasso',
            desc: 'Phiếu kết quả kiểm nghiệm ATTP phục vụ công bố sản phẩm',
            date: '2021-10-15',
            authority: 'Viện Kiểm nghiệm / Quatest',
            filePath: path.join(sartori2021Root, '08_KĐ_2021.pdf'),
        },
        {
            sku: 'L10005',
            docNo: 'KD-2021-08-L10005',
            name: 'Phiếu Kết quả Kiểm định 08/KĐ/2021 — Arco dei Giovi Valpolicella Ripasso',
            desc: 'Phiếu kết quả kiểm nghiệm ATTP phục vụ công bố sản phẩm',
            date: '2021-10-15',
            authority: 'Viện Kiểm nghiệm / Quatest',
            filePath: path.join(sartori2021Root, '08_KĐ_2021.pdf'),
        },
        {
            sku: 'L10003',
            docNo: 'KD-2021-09-L10003',
            name: 'Phiếu Kết quả Kiểm định 09/KĐ/2021 — I Saltari Valpolicella Superiore',
            desc: 'Phiếu kết quả kiểm nghiệm ATTP phục vụ công bố sản phẩm',
            date: '2021-10-15',
            authority: 'Viện Kiểm nghiệm / Quatest',
            filePath: path.join(sartori2021Root, '09_KĐ_2021.pdf'),
        },
        {
            sku: 'L10006',
            docNo: 'KD-2021-10-L10006',
            name: 'Phiếu Kết quả Kiểm định 10/KĐ/2021 — Arco dei Giovi Valpolicella Superiore',
            desc: 'Phiếu kết quả kiểm nghiệm ATTP phục vụ công bố sản phẩm',
            date: '2021-10-15',
            authority: 'Viện Kiểm nghiệm / Quatest',
            filePath: path.join(sartori2021Root, '10_KĐ_2021.pdf'),
        },
        // 2025 Lab Tests (Kết quả kiểm định\2025)
        {
            sku: 'L50001',
            docNo: 'KD-2025-L50001',
            name: 'Phiếu Kết quả Kiểm định 2025 — Bailando Garnacha',
            desc: 'Kết quả kiểm nghiệm các chỉ tiêu an toàn thực phẩm theo QCVN 6-3:2010/BYT',
            date: '2025-09-01',
            authority: 'Eurofins / NIFC',
            filePath: path.join(kq2025Root, 'Bailando.pdf'),
        },
        {
            sku: 'L50002',
            docNo: 'KD-2025-L50002',
            name: 'Phiếu Kết quả Kiểm định 2025 — Cava Bella Mistala Brut',
            desc: 'Kết quả kiểm nghiệm các chỉ tiêu an toàn thực phẩm theo QCVN 6-3:2010/BYT',
            date: '2025-09-01',
            authority: 'Eurofins / NIFC',
            filePath: path.join(kq2025Root, 'Cava Bella.pdf'),
        },
        {
            sku: 'L20062',
            docNo: 'KD-2025-L20062',
            name: "Phiếu Kết quả Kiểm định 2025 — L'Orangeraie Pays d'Oc Chardonnay",
            desc: 'Kết quả kiểm nghiệm các chỉ tiêu an toàn thực phẩm theo QCVN 6-3:2010/BYT',
            date: '2025-09-01',
            authority: 'Eurofins / NIFC',
            filePath: path.join(kq2025Root, 'Chardonnay.pdf'),
        },
        {
            sku: 'L20070',
            docNo: 'KD-2025-L20070',
            name: 'Phiếu Kết quả Kiểm định 2025 — Domaine de la Solitude Chateauneuf du Pape Blanc',
            desc: 'Kết quả kiểm nghiệm các chỉ tiêu an toàn thực phẩm theo QCVN 6-3:2010/BYT',
            date: '2025-09-01',
            authority: 'Eurofins / NIFC',
            filePath: path.join(kq2025Root, 'du Pape.pdf'),
        },
        {
            sku: 'L20065',
            docNo: 'KD-2025-L20065',
            name: 'Phiếu Kết quả Kiểm định 2025 — El Chardo',
            desc: 'Kết quả kiểm nghiệm các chỉ tiêu an toàn thực phẩm theo QCVN 6-3:2010/BYT',
            date: '2025-09-01',
            authority: 'Eurofins / NIFC',
            filePath: path.join(kq2025Root, 'El Chardo.pdf'),
        },
        {
            sku: 'L20064',
            docNo: 'KD-2025-L20064',
            name: 'Phiếu Kết quả Kiểm định 2025 — El Pinot',
            desc: 'Kết quả kiểm nghiệm các chỉ tiêu an toàn thực phẩm theo QCVN 6-3:2010/BYT',
            date: '2025-09-01',
            authority: 'Eurofins / NIFC',
            filePath: path.join(kq2025Root, 'El Pinot.pdf'),
        },
        {
            sku: 'L20069',
            docNo: 'KD-2025-L20069',
            name: 'Phiếu Kết quả Kiểm định 2025 — Esprit de Maison Blanche Blanc',
            desc: 'Kết quả kiểm nghiệm các chỉ tiêu an toàn thực phẩm theo QCVN 6-3:2010/BYT',
            date: '2025-09-01',
            authority: 'Eurofins / NIFC',
            filePath: path.join(kq2025Root, 'Esprit trắng.pdf'),
        },
        {
            sku: 'L20069',
            docNo: 'CA-EXCELL-2024-L20069',
            name: 'Certificate of Analysis (CA) — Esprit de Maison Blanche Blanc (Laboratoire Excell)',
            desc: 'Chứng nhận phân tích chất lượng từ phòng lab Laboratoire Excell (Pháp)',
            date: '2026-07-15',
            authority: 'Laboratoire Excell (France)',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Pháp 08.2026\\Chứng từ mới nhất (Đăng ký ATTP & Thông quan)\\1. Maison Bouey\\CA\\CA - Esprit de Maison Blanche Blanc 2024 (Laboratoire Excell).pdf',
        },
        {
            sku: 'L20068',
            docNo: 'KD-2025-L20068',
            name: 'Phiếu Kết quả Kiểm định 2025 — Esprit de Maison Blanche Rouge',
            desc: 'Kết quả kiểm nghiệm các chỉ tiêu an toàn thực phẩm theo QCVN 6-3:2010/BYT',
            date: '2025-09-01',
            authority: 'Eurofins / NIFC',
            filePath: path.join(kq2025Root, 'Esprit đỏ.pdf'),
        },
        {
            sku: 'L20068',
            docNo: 'CA-EXCELL-2023-L20068',
            name: 'Certificate of Analysis (CA) — Esprit de Maison Blanche Rouge (Laboratoire Excell)',
            desc: 'Chứng nhận phân tích chất lượng từ phòng lab Laboratoire Excell (Pháp)',
            date: '2026-07-15',
            authority: 'Laboratoire Excell (France)',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Pháp 08.2026\\Chứng từ mới nhất (Đăng ký ATTP & Thông quan)\\1. Maison Bouey\\CA\\CA - Esprit de Maison Blanche Rouge 2023 (Laboratoire Excell).pdf',
        },
        {
            sku: 'L20067',
            docNo: 'KD-2025-L20067',
            name: 'Phiếu Kết quả Kiểm định 2025 — Locus Folle B.',
            desc: 'Kết quả kiểm nghiệm các chỉ tiêu an toàn thực phẩm theo QCVN 6-3:2010/BYT',
            date: '2025-09-01',
            authority: 'Eurofins / NIFC',
            filePath: path.join(kq2025Root, 'Folle B.pdf'),
        },
        {
            sku: 'L20063',
            docNo: 'KD-2025-L20063',
            name: "Phiếu Kết quả Kiểm định 2025 — La Petite Rosee d'Ete Pays d'Oc",
            desc: 'Kết quả kiểm nghiệm các chỉ tiêu an toàn thực phẩm theo QCVN 6-3:2010/BYT',
            date: '2025-09-01',
            authority: 'Eurofins / NIFC',
            filePath: path.join(kq2025Root, 'La Petite.pdf'),
        },
        {
            sku: 'L20063',
            docNo: 'CA-DUBERNET-2025-L20063',
            name: "CA & Sanitary Certificate — La Petite Rosee d'Ete (Laboratoires Dubernet)",
            desc: 'Chứng nhận phân tích & vệ sinh dịch tễ từ Laboratoires Dubernet (Pháp)',
            date: '2026-07-15',
            authority: 'Laboratoires Dubernet (France)',
            filePath: "D:\\Lyscellar\\Purchasing\\Lô Pháp 08.2026\\Chứng từ mới nhất (Đăng ký ATTP & Thông quan)\\2. Lorgeril\\CA\\CA & Sanitary Certificate - La Petite Rosee d'Ete 2025 (Laboratoires Dubernet).pdf",
        },
        {
            sku: 'L20066',
            docNo: 'KD-2025-L20066',
            name: 'Phiếu Kết quả Kiểm định 2025 — Locus Melon B.',
            desc: 'Kết quả kiểm nghiệm các chỉ tiêu an toàn thực phẩm theo QCVN 6-3:2010/BYT',
            date: '2025-09-01',
            authority: 'Eurofins / NIFC',
            filePath: path.join(kq2025Root, 'Melon B.pdf'),
        },
        {
            sku: 'L20061',
            docNo: 'KD-2025-L20061',
            name: "Phiếu Kết quả Kiểm định 2025 — L'Orangeraie Pays d'Oc Pinot Noir",
            desc: 'Kết quả kiểm nghiệm các chỉ tiêu an toàn thực phẩm theo QCVN 6-3:2010/BYT',
            date: '2025-09-01',
            authority: 'Eurofins / NIFC',
            filePath: path.join(kq2025Root, 'Pinot Noir.pdf'),
        },
        // Lô Ý T7.2026 (L10037..L10046)
        {
            sku: 'L10037',
            docNo: 'EUVNHC-00425146-L10037',
            name: 'Phiếu Kiểm định Eurofins EUVNHC-00425146 — Sartori Reius Amarone',
            desc: 'Kết quả kiểm định chất lượng sản phẩm rượu vang Sartori',
            date: '2026-05-10',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Sartori\\EUVNHC-00425146-Công ty CP Thương Mại Thắng Ân.pdf',
        },
        {
            sku: 'L10038',
            docNo: 'EUVNHC-00425146-L10038',
            name: 'Phiếu Kiểm định Eurofins EUVNHC-00425146 — Sartori Brolo di Sotto',
            desc: 'Kết quả kiểm định chất lượng sản phẩm rượu vang Sartori',
            date: '2026-05-10',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: 'D:\\Lyscellar\\ATTP\\Tự công bố\\Sartori\\EUVNHC-00425146-Công ty CP Thương Mại Thắng Ân.pdf',
        },
        {
            sku: 'L10039',
            docNo: 'AR-242-2026-00003849-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00003849-01 — Anselmi San Vincenzo Bianco',
            desc: 'Kết quả thử nghiệm Eurofins (Hàm lượng SO2, Chì, Độ cồn, Methanol, Ochratoxin A)',
            date: '2026-08-12',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpAugRoot, 'AR-242-2026-00003849-01.pdf'),
        },
        {
            sku: 'L10039',
            docNo: 'KD-2026-L10039-FULL',
            name: 'Hồ sơ Kiểm định đầy đủ — Anselmi San Vincenzo Bianco Veneto',
            desc: 'Bản tổng hợp kết quả kiểm định phục vụ nộp TCB Lô Ý T7/2026',
            date: '2026-07-20',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Ethica\\Kiểm định\\Kiem dinh Rượu vang trắng Anselmi San Vincenzo Bianco Veneto.pdf',
        },
        {
            sku: 'L10040',
            docNo: 'AR-242-2026-00002833-02',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00002833-02 — Buccia Nera Chianti Tenuta di Campriano',
            desc: 'Kết quả thử nghiệm Eurofins tháng 07/2026',
            date: '2026-07-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpJulyRoot, 'AR-242-2026-00002833-02.pdf'),
        },
        {
            sku: 'L10040',
            docNo: 'KD-2026-L10040-FULL',
            name: 'Hồ sơ Kiểm định đầy đủ — Buccia Nera Chianti Tenuta di Campriano',
            desc: 'Bản tổng hợp kết quả kiểm định phục vụ nộp TCB Lô Ý T7/2026',
            date: '2026-07-20',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Buccia Nera\\Kiểm định\\Kiem dinh Rượu vang đỏ Buccianera Chianti Tenuta di Campriano.pdf',
        },
        {
            sku: 'L10041',
            docNo: 'AR-242-2026-00003850-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00003850-01 — Buccia Nera ROSSORELATIVO',
            desc: 'Kết quả thử nghiệm Eurofins tháng 08/2026',
            date: '2026-08-12',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpAugRoot, 'AR-242-2026-00003850-01.pdf'),
        },
        {
            sku: 'L10041',
            docNo: 'KD-2026-L10041-FULL',
            name: 'Hồ sơ Kiểm định đầy đủ — Buccia Nera Rosso Relativo Toscana',
            desc: 'Bản tổng hợp kết quả kiểm định phục vụ nộp TCB Lô Ý T7/2026',
            date: '2026-07-20',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Buccia Nera\\Kiểm định\\Kiem dinh Rượu vang đỏ Buccianera Rosso Relativo Toscana.pdf',
        },
        {
            sku: 'L10042',
            docNo: 'AR-242-2026-00002832-02',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00002832-02 — Petra Zingari Rosso Toscana',
            desc: 'Kết quả thử nghiệm Eurofins tháng 07/2026',
            date: '2026-07-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpJulyRoot, 'AR-242-2026-00002832-02.pdf'),
        },
        {
            sku: 'L10042',
            docNo: 'KD-2026-L10042-FULL',
            name: 'Hồ sơ Kiểm định đầy đủ — Petra Zingari Rosso Toscana',
            desc: 'Bản tổng hợp kết quả kiểm định phục vụ nộp TCB Lô Ý T7/2026',
            date: '2026-07-20',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Ethica\\Kiểm định\\Kiem dinh Rượu vang đỏ Petra Zingari Rosso Toscana.pdf',
        },
        {
            sku: 'L10043',
            docNo: 'AR-242-2026-00003851-01',
            name: "Phiếu Kiểm định Eurofins AR-242-2026-00003851-01 — Buccia Nera Pa'ro Rosso",
            desc: 'Kết quả thử nghiệm Eurofins tháng 08/2026',
            date: '2026-08-12',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpAugRoot, 'AR-242-2026-00003851-01.pdf'),
        },
        {
            sku: 'L10043',
            docNo: 'KD-2026-L10043-FULL',
            name: "Hồ sơ Kiểm định đầy đủ — Buccia Nera Pa'ro Rosso Toscana",
            desc: 'Bản tổng hợp kết quả kiểm định phục vụ nộp TCB Lô Ý T7/2026',
            date: '2026-07-20',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: "D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Buccia Nera\\Kiểm định\\Kiem dinh Rượu vang đỏ Buccianera Pa'ro Rosso Toscana.pdf",
        },
        {
            sku: 'L10044',
            docNo: 'AR-242-2026-00002834-02',
            name: "Phiếu Kiểm định Eurofins AR-242-2026-00002834-02 — Buccia Nera Pa'ro Orange",
            desc: 'Kết quả thử nghiệm Eurofins tháng 07/2026',
            date: '2026-07-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpJulyRoot, 'AR-242-2026-00002834-02.pdf'),
        },
        {
            sku: 'L10044',
            docNo: 'KD-2026-L10044-FULL',
            name: "Hồ sơ Kiểm định đầy đủ — Buccia Nera Pa'ro Orange Wine",
            desc: 'Bản tổng hợp kết quả kiểm định phục vụ nộp TCB Lô Ý T7/2026',
            date: '2026-07-20',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: "D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Buccia Nera\\Kiểm định\\Kiem dinh Rượu vang trắng Buccianera Pa'ro Orange Wine.pdf",
        },
        {
            sku: 'L10045',
            docNo: 'AR-242-2026-00002836-02',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00002836-02 — Terre di Monteforte Vulcanico Rosso',
            desc: 'Kết quả thử nghiệm Eurofins tháng 07/2026',
            date: '2026-07-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpJulyRoot, 'AR-242-2026-00002836-02.pdf'),
        },
        {
            sku: 'L10045',
            docNo: 'KD-2026-L10045-FULL',
            name: 'Hồ sơ Kiểm định đầy đủ — Terre di Monteforte Vulcanico Rosso Veneto',
            desc: 'Bản tổng hợp kết quả kiểm định phục vụ nộp TCB Lô Ý T7/2026',
            date: '2026-07-20',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Satoril mới\\Kiểm định\\Kiem dinh Rượu vang đỏ Terre di Monteforte Vulcanico Rosso Veneto.pdf',
        },
        {
            sku: 'L10046',
            docNo: 'AR-242-2026-00002835-02',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00002835-02 — Terre di Monteforte Vulcanico Soave',
            desc: 'Kết quả thử nghiệm Eurofins tháng 07/2026',
            date: '2026-07-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpJulyRoot, 'AR-242-2026-00002835-02.pdf'),
        },
        {
            sku: 'L10046',
            docNo: 'KD-2026-L10046-FULL',
            name: 'Hồ sơ Kiểm định đầy đủ — Terre di Monteforte Vulcanico Soave',
            desc: 'Bản tổng hợp kết quả kiểm định phục vụ nộp TCB Lô Ý T7/2026',
            date: '2026-07-20',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Satoril mới\\Kiểm định\\Kiem dinh Rượu vang trắng Terre di Monteforte Vulcanico Soave.pdf',
        },
        // Cassaigne Plaimont (L20073, L20074)
        {
            sku: 'L20073',
            docNo: 'AR-242-2026-00003847-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00003847-01 — Cassaigne Côtes de Gascogne Rouge',
            desc: 'Kết quả thử nghiệm Eurofins tháng 08/2026 (Đã cập nhật tên theo TCB)',
            date: '2026-08-12',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpAugRoot, 'AR-242-2026-00003847-01.pdf'),
        },
        {
            sku: 'L20073',
            docNo: 'KD-2026-L20073-FULL',
            name: 'Hồ sơ Kiểm định & CA — Cassaigne le Labyrinthe Côtes de Gascogne Rouge',
            desc: 'Bản kết quả kiểm định đầy đủ kèm phân tích phòng lab Plaimont',
            date: '2026-08-12',
            authority: 'Eurofins / Plaimont Lab',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Pháp 08.2026\\Gautier\\TCB\\Kiem dinh Rượu vang đỏ Cassaigne le Labyrinthe Côtes de Gascogne Rouge.pdf',
        },
        {
            sku: 'L20074',
            docNo: 'AR-242-2026-00003848-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00003848-01 — Cassaigne Côtes de Gascogne Blanc',
            desc: 'Kết quả thử nghiệm Eurofins tháng 08/2026 (Đã cập nhật tên theo TCB)',
            date: '2026-08-12',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpAugRoot, 'AR-242-2026-00003848-01.pdf'),
        },
        {
            sku: 'L20074',
            docNo: 'KD-2026-L20074-FULL',
            name: 'Hồ sơ Kiểm định & CA — Cassaigne le Labyrinthe Côtes de Gascogne Blanc',
            desc: 'Bản kết quả kiểm định đầy đủ kèm phân tích phòng lab Plaimont',
            date: '2026-08-12',
            authority: 'Eurofins / Plaimont Lab',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Pháp 08.2026\\Gautier\\TCB\\Kiem dinh Rượu vang trắng Cassaigne le Labyrinthe Côtes de Gascogne Blanc.pdf',
        },
        // Calabria & The Wall (L40010..L40014) + Berton Vineyards (L40001..L40009)
        {
            sku: 'L40010',
            docNo: 'KD-2026-L40010',
            name: 'Phiếu Kiểm định — Rượu vang đỏ The Wall Shiraz',
            desc: 'Phiếu kết quả kiểm định chất lượng sản phẩm Calabria The Wall Shiraz',
            date: '2026-06-25',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpLabelRoot, 'Kiem dinh Rượu vang đỏ The Wall Shiraz.pdf'),
        },
        {
            sku: 'L40011',
            docNo: 'KD-2026-L40011',
            name: 'Phiếu Kiểm định — Rượu vang trắng The Wall Chardonnay',
            desc: 'Phiếu kết quả kiểm định chất lượng sản phẩm Calabria The Wall Chardonnay',
            date: '2026-06-25',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpLabelRoot, 'Kiem dinh Rượu vang trắng The Wall Chardonnay.pdf'),
        },
        {
            sku: 'L40012',
            docNo: 'KD-2026-L40012',
            name: 'Phiếu Kiểm định — Rượu vang đỏ Calabria Guiding Star Shiraz',
            desc: 'Phiếu kết quả kiểm định chất lượng sản phẩm Calabria Guiding Star Shiraz',
            date: '2026-06-25',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpLabelRoot, 'Kiem dinh Rượu vang đỏ Calabria Guiding Star Shiraz.pdf'),
        },
        {
            sku: 'L40013',
            docNo: 'KD-2026-L40013',
            name: 'Phiếu Kiểm định — Rượu vang trắng Calabria Guiding Star Chardonnay',
            desc: 'Phiếu kết quả kiểm định chất lượng sản phẩm Calabria Guiding Star Chardonnay',
            date: '2026-06-25',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpLabelRoot, 'Kiem dinh Rượu vang trắng Calabria Guiding Star Chardonnay.pdf'),
        },
        {
            sku: 'L40014',
            docNo: 'KD-2026-L40014',
            name: 'Phiếu Kiểm định — Rượu vang trắng Calabria Guiding Star Moscato',
            desc: 'Phiếu kết quả kiểm định chất lượng sản phẩm Calabria Guiding Star Moscato',
            date: '2026-06-25',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpLabelRoot, 'Kiem dinh Rượu vang trắng Calabria Guiding Star Moscato.pdf'),
        },
        // By Josh Scott Petillant Naturel (L60005)
        {
            sku: 'L60005',
            docNo: 'KD-2026-L60005',
            name: 'Phiếu Kiểm định — By Josh Scott Marlborough Petillant Naturel',
            desc: 'Phiếu kết quả kiểm định chất lượng sản phẩm (743-2026-00102162)',
            date: '2026-06-25',
            authority: 'Eurofins / Quatest',
            filePath: path.join(attpLabelRoot, 'Kiem dinh Rượu vang nổ By Josh Scott Marlborough Petillant Naturel.pdf'),
        },
        // September 2026 Eurofins Lab Test Reports (L70001..L70005 & L80001..L80006)
        {
            sku: 'L80004',
            docNo: 'AR-242-2026-00004639-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00004639-01 — Anthonij Rupert Blend',
            desc: 'Kết quả thử nghiệm Eurofins tháng 09/2026 (SO2, Chì, Độ cồn, Methanol, Ochratoxin A)',
            date: '2026-09-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpSeptRoot, 'AR-242-2026-00004639-01.pdf'),
        },
        {
            sku: 'L80003',
            docNo: 'AR-242-2026-00003911-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00003911-01 — Anthonij Rupert Optima',
            desc: 'Kết quả thử nghiệm Eurofins tháng 08-09/2026 (SO2, Chì, Độ cồn, Methanol, Ochratoxin A)',
            date: '2026-08-25',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpAugRoot, 'AR-242-2026-00003911-01.pdf'),
        },
        {
            sku: 'L80003',
            docNo: 'KD-2026-L80003-FULL',
            name: 'Hồ sơ Kiểm định đầy đủ — Rượu vang đỏ Anthonij Rupert Optima',
            desc: 'Bản kết quả kiểm định tổng hợp phục vụ công bố sản phẩm Lô Nam Phi',
            date: '2026-09-10',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\TCB\\Kiem dinh Rượu vang đỏ Anthonij Rupert Optima.pdf',
        },
        {
            sku: 'L80002',
            docNo: 'AR-242-2026-00004641-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00004641-01 — Protea Cabernet Sauvignon',
            desc: 'Kết quả thử nghiệm Eurofins tháng 09/2026 (SO2, Chì, Độ cồn, Methanol, Ochratoxin A)',
            date: '2026-09-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpSeptRoot, 'AR-242-2026-00004641-01.pdf'),
        },
        {
            sku: 'L80005',
            docNo: 'AR-242-2026-00004642-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00004642-01 — Protea Chenin Blanc',
            desc: 'Kết quả thử nghiệm Eurofins tháng 09/2026 (SO2, Chì, Độ cồn, Methanol, Ochratoxin A)',
            date: '2026-09-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpSeptRoot, 'AR-242-2026-00004642-01.pdf'),
        },
        {
            sku: 'L80006',
            docNo: 'AR-242-2026-00004643-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00004643-01 — Protea Sauvignon Blanc',
            desc: 'Kết quả thử nghiệm Eurofins tháng 09/2026 (SO2, Chì, Độ cồn, Methanol, Ochratoxin A)',
            date: '2026-09-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpSeptRoot, 'AR-242-2026-00004643-01.pdf'),
        },
        {
            sku: 'L80001',
            docNo: 'AR-242-2026-00004644-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00004644-01 — Protea Shiraz',
            desc: 'Kết quả thử nghiệm Eurofins tháng 09/2026 (SO2, Chì, Độ cồn, Methanol, Ochratoxin A)',
            date: '2026-09-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpSeptRoot, 'AR-242-2026-00004644-01.pdf'),
        },
        {
            sku: 'L70004',
            docNo: 'AR-242-2026-00004645-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00004645-01 — Duckhorn Napa Valley Cabernet Sauvignon',
            desc: 'Kết quả thử nghiệm Eurofins tháng 09/2026 (SO2, Chì, Độ cồn, Methanol, Ochratoxin A)',
            date: '2026-09-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpSeptRoot, 'AR-242-2026-00004645-01.pdf'),
        },
        {
            sku: 'L70003',
            docNo: 'AR-242-2026-00004646-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00004646-01 — Duckhorn Napa Valley Merlot',
            desc: 'Kết quả thử nghiệm Eurofins tháng 09/2026 (SO2, Chì, Độ cồn, Methanol, Ochratoxin A)',
            date: '2026-09-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpSeptRoot, 'AR-242-2026-00004646-01.pdf'),
        },
        {
            sku: 'L70005',
            docNo: 'AR-242-2026-00004647-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00004647-01 — Decoy California Chardonnay',
            desc: 'Kết quả thử nghiệm Eurofins tháng 09/2026 (SO2, Chì, Độ cồn, Methanol, Ochratoxin A)',
            date: '2026-09-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpSeptRoot, 'AR-242-2026-00004647-01.pdf'),
        },
        {
            sku: 'L70002',
            docNo: 'AR-242-2026-00004648-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00004648-01 — Decoy California Cabernet Sauvignon',
            desc: 'Kết quả thử nghiệm Eurofins tháng 09/2026 (SO2, Chì, Độ cồn, Methanol, Ochratoxin A)',
            date: '2026-09-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpSeptRoot, 'AR-242-2026-00004648-01.pdf'),
        },
        {
            sku: 'L70001',
            docNo: 'AR-242-2026-00004649-01',
            name: 'Phiếu Kiểm định Eurofins AR-242-2026-00004649-01 — Decoy California Pinot Noir',
            desc: 'Kết quả thử nghiệm Eurofins tháng 09/2026 (SO2, Chì, Độ cồn, Methanol, Ochratoxin A)',
            date: '2026-09-15',
            authority: 'Eurofins Sắc Ký Hải Đăng',
            filePath: path.join(attpSeptRoot, 'AR-242-2026-00004649-01.pdf'),
        },
    ]

    for (const item of testMappings) {
        if (fs.existsSync(item.filePath)) {
            seeds.push({
                skuCode: item.sku,
                group: 'TESTING',
                docNo: item.docNo,
                name: item.name,
                description: item.desc,
                issueDate: new Date(`${item.date}T00:00:00Z`),
                issuingAuthority: item.authority,
                version: 1,
                localFilePath: item.filePath,
            })
        }
    }

    console.log(`Prepared ${seeds.length} total document records across TCB, AMENDMENT, and TESTING.`)

    // Process in batches
    let createdOrUpdated = 0
    const latestTcbUrlByProductId = new Map<string, string>()

    for (const seed of seeds) {
        const prod = skuToProduct.get(seed.skuCode.toUpperCase())
        if (!prod) continue

        const subFolder =
            seed.group === 'TCB' ? 'tcb' : seed.group === 'AMENDMENT' ? 'amendment' : 'testing'
        const uploaded = await ensureUploadedToR2(seed.localFilePath, subFolder, seed.skuCode)

        if (seed.group === 'TCB') {
            // Prefer PDF over DOCX for primary selfDeclarationUrl if multiple exist
            const cur = latestTcbUrlByProductId.get(prod.id)
            if (!cur || uploaded.fileUrl.toLowerCase().endsWith('.pdf')) {
                latestTcbUrlByProductId.set(prod.id, uploaded.fileUrl)
            }
        }

        const regType =
            seed.group === 'TCB'
                ? 'QUALITY_DECLARATION'
                : seed.group === 'AMENDMENT'
                  ? 'STANDARDS_COMPLIANCE'
                  : 'QUALITY_TEST_REPORT'

        const existingDoc = await prisma.regulatedDocument.findUnique({
            where: { docNo: seed.docNo },
            include: { files: true },
        })

        if (existingDoc) {
            await prisma.regulatedDocument.update({
                where: { id: existingDoc.id },
                data: {
                    name: seed.name,
                    description: seed.description,
                    issueDate: seed.issueDate,
                    issuingAuthority: seed.issuingAuthority,
                    referenceNo: seed.group,
                    productId: prod.id,
                    scope: 'PRODUCT',
                    category: 'PRODUCT_CERTIFICATION',
                    type: regType as any,
                    version: seed.version || 1,
                },
            })
            if (existingDoc.files.length === 0) {
                await prisma.regDocFile.create({
                    data: {
                        regDocId: existingDoc.id,
                        name: uploaded.fileName,
                        fileUrl: uploaded.fileUrl,
                        storagePath: uploaded.storagePath,
                        version: seed.version || 1,
                    },
                })
            }
        } else {
            await prisma.regulatedDocument.create({
                data: {
                    docNo: seed.docNo,
                    category: 'PRODUCT_CERTIFICATION',
                    type: regType as any,
                    name: seed.name,
                    description: seed.description,
                    issueDate: seed.issueDate,
                    issuingAuthority: seed.issuingAuthority,
                    referenceNo: seed.group,
                    scope: 'PRODUCT',
                    productId: prod.id,
                    status: 'ACTIVE',
                    version: seed.version || 1,
                    files: {
                        create: {
                            name: uploaded.fileName,
                            fileUrl: uploaded.fileUrl,
                            storagePath: uploaded.storagePath,
                            version: seed.version || 1,
                        },
                    },
                },
            })
        }
        createdOrUpdated++
    }

    // Update Product.selfDeclarationUrl for all products that have a TCB
    let prodUpdated = 0
    for (const [productId, url] of latestTcbUrlByProductId.entries()) {
        await prisma.product.update({
            where: { id: productId },
            data: { selfDeclarationUrl: url },
        })
        prodUpdated++
    }

    console.log(`\n=============================================================`)
    console.log(`SYNC COMPLETE:`)
    console.log(`- RegulatedDocument records synced: ${createdOrUpdated}`)
    console.log(`- Products with selfDeclarationUrl updated: ${prodUpdated} / ${products.length}`)
    console.log(`=============================================================\n`)

    await prisma.$disconnect()
    await pool.end()
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
