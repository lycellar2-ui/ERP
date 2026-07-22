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
    console.log('🔍 Auditing unmapped customers between Excel and ERP Database...')

    const allCustomers = await prisma.customer.findMany()
    const allProducts = await prisma.product.findMany({ where: { deletedAt: null } })

    const productBySkuMap = new Map<string, string>()
    allProducts.forEach(p => productBySkuMap.set(p.skuCode.toUpperCase(), p.id))

    const findCustomer = (nameStr: string) => {
        if (!nameStr) return null
        const clean = nameStr.toLowerCase().trim()

        let found = allCustomers.find(c => c.code.toLowerCase() === clean)
        if (found) return found

        found = allCustomers.find(c => {
            const cn = c.name.toLowerCase()
            return cn.includes(clean) || clean.includes(cn)
        })
        if (found) return found

        const tokens = clean.split(/[\s,()\-]+/).filter(t => t.length > 2)
        for (const token of tokens) {
            found = allCustomers.find(c => c.name.toLowerCase().includes(token) || c.code.toLowerCase().includes(token))
            if (found) return found
        }

        return null
    }

    const filesToAudit = [
        'D:\\Lyscellar\\Price\\Customer Special Price - need to confirm.xlsx',
        'D:\\Lyscellar\\Price\\Cơ chế và giá đặc biệt khách hàng 30.03.2026.xlsx'
    ]

    const unmappedCustomersMap = new Map<string, { sheet: string; products: { sku: string; price: number }[] }>()
    const mappedCustomersSet = new Set<string>()

    for (const filePath of filesToAudit) {
        if (!fs.existsSync(filePath)) continue
        const fileName = path.basename(filePath)

        const wb = xlsx.readFile(filePath)
        for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName]
            const rows = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1 })

            let currentCustomerName = ''

            for (let i = 0; i < rows.length; i++) {
                const r = rows[i]
                if (!r || r.length === 0) continue

                const col1 = r[1] ? String(r[1]).trim() : ''
                if (col1 && isNaN(Number(col1)) && !col1.toLowerCase().startsWith('stt') && !col1.toLowerCase().startsWith('khách hàng') && col1.length > 2) {
                    currentCustomerName = col1
                }

                let skuCode = ''
                let specialPriceNum = 0

                for (let j = 0; j < r.length; j++) {
                    const val = String(r[j] || '').trim().toUpperCase()
                    if (/^L\d{5}$/.test(val) || /^PETRUS/.test(val) || /^OPUS/.test(val) || /^PENFOLDS/.test(val)) {
                        skuCode = val
                    }
                }

                for (let j = 0; j < r.length; j++) {
                    const num = Number(r[j])
                    if (!isNaN(num) && num >= 50000 && num <= 50000000) {
                        specialPriceNum = num
                        break
                    }
                }

                if (skuCode && specialPriceNum > 0 && currentCustomerName) {
                    const targetCustomer = findCustomer(currentCustomerName)
                    if (targetCustomer) {
                        mappedCustomersSet.add(`${targetCustomer.name} [Mã: ${targetCustomer.code}]`)
                    } else {
                        if (!unmappedCustomersMap.has(currentCustomerName)) {
                            unmappedCustomersMap.set(currentCustomerName, { sheet: `${fileName} (${sheetName})`, products: [] })
                        }
                        unmappedCustomersMap.get(currentCustomerName)!.products.push({ sku: skuCode, price: specialPriceNum })
                    }
                }
            }
        }
    }

    console.log('\n==================================================')
    console.log(`✅ KHÁCH HÀNG ĐÃ ĐẨY LÊN THÀNH CÔNG (${mappedCustomersSet.size} khách hàng):`)
    console.log('==================================================')
    Array.from(mappedCustomersSet).forEach(c => console.log(`  ✓ ${c}`))

    console.log('\n==================================================')
    console.log(`❌ KHÁCH HÀNG CÓ TRONG FILE NHƯNG CHƯA ĐẨY LÊN HỆ THỐNG (${unmappedCustomersMap.size} khách hàng):`)
    console.log('==================================================')

    unmappedCustomersMap.forEach((info, custName) => {
        console.log(`\n🔴 Khách hàng trong Excel: "${custName}" [File/Sheet: ${info.sheet}]`)
        console.log('   Sản phẩm & Giá đặc biệt:')
        info.products.forEach(p => {
            console.log(`     - Mã SP ${p.sku}: ${p.price.toLocaleString()} VNĐ`)
        })
    })
}

main().catch(console.error).finally(() => pool.end())
