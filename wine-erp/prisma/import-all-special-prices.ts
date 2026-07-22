import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import * as xlsx from 'xlsx'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 3,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🚀 Importing ALL Customer Special Prices from D:\\Lyscellar\\Price...')

    const adminUser = await prisma.user.findFirst()
    if (!adminUser) throw new Error('No admin user found!')

    // All active products & customers map for fast lookup
    const allProducts = await prisma.product.findMany({
        where: { deletedAt: null }
    })
    const productBySkuMap = new Map<string, string>()
    allProducts.forEach(p => {
        productBySkuMap.set(p.skuCode.toUpperCase(), p.id)
    })

    const allCustomers = await prisma.customer.findMany()
    
    // Helper to find customer by name/code substring
    const findCustomer = (nameStr: string) => {
        if (!nameStr) return null
        const clean = nameStr.toLowerCase().trim()
        
        // Exact code match
        let found = allCustomers.find(c => c.code.toLowerCase() === clean)
        if (found) return found

        // Customer name contains search term or search term contains customer name
        found = allCustomers.find(c => {
            const cn = c.name.toLowerCase()
            return cn.includes(clean) || clean.includes(cn)
        })
        if (found) return found

        // Search key tokens (e.g. "Pincho", "Badiane", "Dragon Cello", "Ete", "Paolo")
        const tokens = clean.split(/[\s,()\-]+/).filter(t => t.length > 2)
        for (const token of tokens) {
            found = allCustomers.find(c => c.name.toLowerCase().includes(token) || c.code.toLowerCase().includes(token))
            if (found) return found
        }

        return null
    }

    const filesToImport = [
        'D:\\Lyscellar\\Price\\Customer Special Price - need to confirm.xlsx',
        'D:\\Lyscellar\\Price\\Cơ chế và giá đặc biệt khách hàng 30.03.2026.xlsx'
    ]

    let totalImported = 0

    // Set end date to 31/07/2026 23:59:59 as requested by user
    const endDate = new Date('2026-07-31T23:59:59.999Z')
    const startDate = new Date('2026-01-01T00:00:00.000Z')

    for (const filePath of filesToImport) {
        if (!fs.existsSync(filePath)) continue
        console.log(`\n📂 Reading file: ${path.basename(filePath)}`)

        const wb = xlsx.readFile(filePath)
        for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName]
            const rows = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1 })

            let currentCustomerName = ''

            for (let i = 0; i < rows.length; i++) {
                const r = rows[i]
                if (!r || r.length === 0) continue

                // Check if row has customer name in column 1 (index 1)
                const col1 = r[1] ? String(r[1]).trim() : ''
                if (col1 && isNaN(Number(col1)) && !col1.toLowerCase().startsWith('stt') && !col1.toLowerCase().startsWith('khách hàng') && col1.length > 2) {
                    currentCustomerName = col1
                }

                // Check SKU code in column 3 (index 3) or column 2 (index 2)
                let skuCode = ''
                let specialPriceNum = 0

                for (let j = 0; j < r.length; j++) {
                    const val = String(r[j] || '').trim().toUpperCase()
                    if (/^L\d{5}$/.test(val) || /^PETRUS/.test(val) || /^OPUS/.test(val) || /^PENFOLDS/.test(val)) {
                        skuCode = val
                    }
                }

                // Find numeric price value in row (e.g. 189000, 340000, 420000)
                for (let j = 0; j < r.length; j++) {
                    const num = Number(r[j])
                    if (!isNaN(num) && num >= 50000 && num <= 50000000) {
                        specialPriceNum = num
                        break
                    }
                }

                if (skuCode && specialPriceNum > 0 && currentCustomerName) {
                    const targetCustomer = findCustomer(currentCustomerName)
                    const productId = productBySkuMap.get(skuCode)

                    if (targetCustomer && productId) {
                        // Upsert CustomerPriceRule
                        const existingRule = await prisma.customerPriceRule.findFirst({
                            where: {
                                customerId: targetCustomer.id,
                                productId: productId,
                            }
                        })

                        if (existingRule) {
                            await prisma.customerPriceRule.update({
                                where: { id: existingRule.id },
                                data: {
                                    ruleType: 'FIXED_PRICE',
                                    value: specialPriceNum,
                                    startDate,
                                    endDate,
                                    status: 'APPROVED',
                                    notes: `Imported from ${path.basename(filePath)} (${sheetName}) - Hạn đến 31.07.2026`,
                                }
                            })
                        } else {
                            await prisma.customerPriceRule.create({
                                data: {
                                    customerId: targetCustomer.id,
                                    productId: productId,
                                    ruleType: 'FIXED_PRICE',
                                    value: specialPriceNum,
                                    startDate,
                                    endDate,
                                    status: 'APPROVED',
                                    requestedBy: adminUser.id,
                                    approvedBy: adminUser.id,
                                    approvedAt: new Date(),
                                    notes: `Imported from ${path.basename(filePath)} (${sheetName}) - Hạn đến 31.07.2026`,
                                }
                            })
                        }

                        totalImported++
                        console.log(`  ✅ Rule #${totalImported}: Khách hàng [${targetCustomer.code}] ${targetCustomer.name} -> SP [${skuCode}] Giá Đặc Biệt: ${specialPriceNum.toLocaleString()}đ (Hạn 31/07/2026)`)
                    } else {
                        if (!targetCustomer) {
                            console.warn(`  ⚠️ KHÔNG TÌM THẤY KHÁCH HÀNG: "${currentCustomerName}" (SKU: ${skuCode}, Giá: ${specialPriceNum})`)
                        }
                        if (!productId) {
                            console.warn(`  ⚠️ KHÔNG TÌM THẤY MÃ SẢN PHẨM: "${skuCode}"`)
                        }
                    }
                }
            }
        }
    }

    console.log(`\n🎉 THÀNH CÔNG: Đã nạp và kích hoạt tổng cộng ${totalImported} Quy tắc Giá Đặc Biệt cho khách hàng (Hạn dùng đến 31/07/2026)!`)
}

main()
    .catch((e) => {
        console.error('❌ Lỗi khi nạp giá đặc biệt:', e)
        process.exit(1)
    })
    .finally(() => pool.end())
