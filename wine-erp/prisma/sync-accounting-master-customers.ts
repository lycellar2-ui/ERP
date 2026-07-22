import { PrismaClient, CustomerType } from '@prisma/client'
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

function mapChannelToCustomerType(channelStr?: string): CustomerType {
    if (!channelStr) return CustomerType.HORECA
    const c = channelStr.toUpperCase().trim()
    if (c.includes('HORECA')) return CustomerType.HORECA
    if (c.includes('CORP')) return CustomerType.CORPORATE
    if (c.includes('RETAIL')) return CustomerType.RETAIL
    if (c.includes('WHOLESALE') || c.includes('SỈ') || c.includes('BUÔN')) return CustomerType.WHOLESALE_DISTRIBUTOR
    return CustomerType.HORECA
}

function mapChannelToSalesChannel(channelStr?: string): any {
    if (!channelStr) return 'HORECA'
    const c = channelStr.toUpperCase().trim()
    if (c.includes('HORECA')) return 'HORECA'
    if (c.includes('CORP')) return 'DIRECT_INDIVIDUAL'
    if (c.includes('RETAIL')) return 'DIRECT_INDIVIDUAL'
    if (c.includes('WHOLESALE') || c.includes('SỈ') || c.includes('BUÔN')) return 'WHOLESALE_DISTRIBUTOR'
    return 'HORECA'
}

async function main() {
    console.log('🔄 Synchronizing Customer Master Data from Accounting Excel into Wine ERP...')

    const filePath = 'I:\\My Drive\\Kế toán 2026\\1. Dữ liệu kế toán\\1. Master data\\Master Data  - Khách hàng.xlsx'
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
    }

    const wb = xlsx.readFile(filePath)
    const sheetMaster = wb.Sheets['Master Data'] || wb.Sheets[wb.SheetNames[0]]
    const rows = xlsx.utils.sheet_to_json<any[]>(sheetMaster, { header: 1 })

    console.log(`Loaded ${rows.length} rows from Master Data sheet.`)

    const parentMap = new Map<string, { code: string; name: string; taxId?: string; channel?: string }>()
    const childrenList: {
        parentCode: string
        childCode: string
        childName: string
        address?: string
        channel?: string
        taxId?: string
        brandGroup?: string
    }[] = []

    for (let i = 1; i < rows.length; i++) {
        const r = rows[i]
        if (!r || r.length === 0) continue

        const parentCode = String(r[0] || '').trim()
        const parentName = String(r[1] || '').trim()
        const childCode = String(r[2] || '').trim()
        const childName = String(r[3] || '').trim()
        const address = String(r[4] || '').trim()
        const channel = String(r[5] || '').trim()
        const taxId = String(r[6] || '').trim()
        const brandGroup = String(r[7] || '').trim()

        if (!parentCode || !parentName) continue

        if (!parentMap.has(parentCode)) {
            parentMap.set(parentCode, {
                code: parentCode,
                name: parentName,
                taxId: taxId || undefined,
                channel: channel || 'HORECA',
            })
        }

        if (childCode && childName && childCode !== parentCode) {
            childrenList.push({
                parentCode,
                childCode,
                childName,
                address: address || undefined,
                channel: channel || 'HORECA',
                taxId: taxId || undefined,
                brandGroup: brandGroup || undefined,
            })
        }
    }

    console.log(`  ✓ Extracted ${parentMap.size} Parent Companies and ${childrenList.length} Child Outlets/Branches.`)

    // Step 2: Upsert Parent Customers in Database
    const dbParentMap = new Map<string, string>()

    for (const [pCode, pData] of parentMap.entries()) {
        const existing = await prisma.customer.findFirst({
            where: {
                OR: [
                    { code: pCode },
                    { name: pData.name }
                ]
            }
        })

        const cType = mapChannelToCustomerType(pData.channel)
        const sChannel = mapChannelToSalesChannel(pData.channel)

        if (existing) {
            const updated = await prisma.customer.update({
                where: { id: existing.id },
                data: {
                    code: pCode,
                    name: pData.name,
                    taxId: pData.taxId || existing.taxId,
                    customerType: cType,
                    channel: sChannel,
                    entityType: 'COMPANY',
                    allowDirectSO: false,
                }
            })
            dbParentMap.set(pCode, updated.id)
        } else {
            const created = await prisma.customer.create({
                data: {
                    code: pCode,
                    name: pData.name,
                    taxId: pData.taxId,
                    customerType: cType,
                    channel: sChannel,
                    entityType: 'COMPANY',
                    allowDirectSO: false,
                }
            })
            dbParentMap.set(pCode, created.id)
        }
    }

    console.log(`  ✅ Synced ${dbParentMap.size} Parent Companies into Database.`)

    // Step 3: Upsert Child Outlets/Branches in Database
    let childCount = 0
    for (const child of childrenList) {
        const parentDbId = dbParentMap.get(child.parentCode)
        if (!parentDbId) continue

        const existing = await prisma.customer.findFirst({
            where: {
                OR: [
                    { code: child.childCode },
                    { name: child.childName }
                ]
            }
        })

        const cType = mapChannelToCustomerType(child.channel)
        const sChannel = mapChannelToSalesChannel(child.channel)

        let childDbId = ''

        if (existing) {
            const updated = await prisma.customer.update({
                where: { id: existing.id },
                data: {
                    code: child.childCode,
                    name: child.childName,
                    parentId: parentDbId,
                    customerType: cType,
                    channel: sChannel,
                    taxId: child.taxId || existing.taxId,
                    brandGroup: child.brandGroup || existing.brandGroup,
                    entityType: 'RESTAURANT',
                    allowDirectSO: true,
                }
            })
            childDbId = updated.id
        } else {
            const created = await prisma.customer.create({
                data: {
                    code: child.childCode,
                    name: child.childName,
                    parentId: parentDbId,
                    customerType: cType,
                    channel: sChannel,
                    taxId: child.taxId,
                    brandGroup: child.brandGroup,
                    entityType: 'RESTAURANT',
                    allowDirectSO: true,
                }
            })
            childDbId = created.id
        }

        if (child.address && childDbId) {
            const hasAddr = await prisma.customerAddress.findFirst({
                where: { customerId: childDbId }
            })
            if (!hasAddr) {
                await prisma.customerAddress.create({
                    data: {
                        customerId: childDbId,
                        label: 'Địa chỉ đăng ký',
                        address: child.address,
                        isDefault: true,
                        isBilling: true,
                    }
                })
            }
        }

        childCount++
    }

    console.log(`  ✅ Synced ${childCount} Child Restaurants/Branches into Database.`)

    // Step 4: Special re-linking for Pincho (HR10022 & HR10022-01)
    const pinchoParent = await prisma.customer.findFirst({ where: { code: 'HR10022' } })
    const pinchoChild = await prisma.customer.findFirst({ where: { code: 'HR10022-01' } })
    const adminUser = await prisma.user.findFirst()

    if (pinchoParent && pinchoChild && adminUser) {
        console.log(`  📌 Linking 7 Pincho Special Price Rules to [${pinchoChild.code}] ${pinchoChild.name} & [${pinchoParent.code}] ${pinchoParent.name}...`)

        const pinchoRules = [
            { sku: 'L50001', price: 189000 },
            { sku: 'L20053', price: 359100 },
            { sku: 'L20033', price: 400000 },
            { sku: 'L60003', price: 470000 },
            { sku: 'L60004', price: 470000 },
            { sku: 'L20002', price: 330000 },
            { sku: 'L20016', price: 530000 },
        ]

        const startDate = new Date('2026-01-01T00:00:00.000Z')
        const endDate = new Date('2026-07-31T23:59:59.999Z')

        for (const custId of [pinchoParent.id, pinchoChild.id]) {
            for (const item of pinchoRules) {
                const product = await prisma.product.findUnique({ where: { skuCode: item.sku } })
                if (!product) continue

                const existing = await prisma.customerPriceRule.findFirst({
                    where: { customerId: custId, productId: product.id }
                })

                if (existing) {
                    await prisma.customerPriceRule.update({
                        where: { id: existing.id },
                        data: { value: item.price, startDate, endDate, status: 'APPROVED' }
                    })
                } else {
                    await prisma.customerPriceRule.create({
                        data: {
                            customerId: custId,
                            productId: product.id,
                            ruleType: 'FIXED_PRICE',
                            value: item.price,
                            startDate,
                            endDate,
                            status: 'APPROVED',
                            requestedBy: adminUser.id,
                            approvedBy: adminUser.id,
                            approvedAt: new Date(),
                            notes: `Master Data Sync HR10022 - Expiry 31/07/2026`,
                        }
                    })
                }
            }
        }
        console.log(`  ✓ Pincho Price Rules attached to official code HR10022 & HR10022-01!`)
    }

    console.log('\n🎉 COMPLETED: Customer Master Data successfully synchronized with Accounting Master File!')
}

main()
    .catch((e) => {
        console.error('❌ Error synchronizing customer master data:', e)
        process.exit(1)
    })
    .finally(() => pool.end())
