import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

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
    const targetCodes = ['L20033', 'L20034', 'L20035', 'L20036', 'L20037', 'L20038', 'L20064', 'L20065', 'L20066', 'L20067']

    console.log('=== 1. TẤT CẢ KHÁCH HÀNG LIÊN QUAN ĐẾN AMBRYS TRÊN HỆ THỐNG ===')
    const customers = await prisma.customer.findMany({
        where: {
            OR: [
                { name: { contains: 'Ambrys', mode: 'insensitive' } },
                { code: { contains: 'AMBRYS', mode: 'insensitive' } },
                { code: { contains: '10064', mode: 'insensitive' } },
            ]
        },
        select: { id: true, code: true, name: true, channel: true, status: true, parentId: true }
    })
    console.table(customers)

    const customerIds = customers.map(c => c.id)

    console.log('\n=== 2. GIÁ CHUẨN TRÊN HỆ THỐNG (PRODUCT & MARGIN PRICE) ===')
    const products = await prisma.product.findMany({
        where: { skuCode: { in: targetCodes } },
        include: { marginPrice: true }
    })
    const productMap = new Map(products.map(p => [p.skuCode, p]))
    
    for (const code of targetCodes) {
        const p = productMap.get(code)
        if (p) {
            console.log(`SKU: ${p.skuCode} | Tên: ${p.productName} | Wholesale(ex VAT): ${p.marginPrice?.wholesalePrice} | Retail: ${p.marginPrice?.retailPrice} | VAT: ${p.vatRate}%`)
        } else {
            console.log(`SKU: ${code} KHÔNG TÌM THẤY TRÊN HỆ THỐNG`)
        }
    }

    console.log('\n=== 3. QUY TẮC GIÁ ĐẶC BIỆT (CUSTOMER_PRICE_RULES) CỦA AMBRYS ===')
    const rules = await prisma.customerPriceRule.findMany({
        where: {
            customerId: { in: customerIds },
            product: { skuCode: { in: targetCodes } }
        },
        include: { customer: true, product: true }
    })
    console.log(`Số rule tìm thấy cho 10 mã trên: ${rules.length}`)
    for (const r of rules) {
        console.log(`Khách: ${r.customer.code} - ${r.customer.name} | SKU: ${r.product.skuCode} | Loại rule: ${r.ruleType} | Giá đặc biệt: ${r.value} | Trạng thái: ${r.status} | Hiệu lực: ${r.startDate?.toISOString().slice(0,10)} -> ${r.endDate?.toISOString().slice(0,10)}`)
    }

    console.log('\n=== 4. CÁC BÁO GIÁ (SALES QUOTATION) CỦA AMBRYS CÓ CHỨA CÁC MÃ NÀY ===')
    const quotations = await prisma.salesQuotation.findMany({
        where: {
            customerId: { in: customerIds }
        },
        include: {
            lines: {
                where: {
                    product: { skuCode: { in: targetCodes } }
                },
                include: { product: true }
            },
            customer: true
        }
    })
    console.log(`Số báo giá tìm thấy: ${quotations.length}`)
    for (const q of quotations) {
        console.log(`Quotation: ${q.quotationNo} | Khách: ${q.customer.code} | Ngày: ${q.quotationDate} | Status: ${q.status}`)
        for (const l of q.lines) {
            console.log(`   - SKU: ${l.product.skuCode} | Tên: ${l.product.productName} | Đơn giá: ${l.unitPrice} | CK: ${l.discountPercent}% | Giá sau CK: ${l.finalPrice}`)
        }
    }

    console.log('\n=== 5. CÁC ĐƠN HÀNG (SALES ORDER) CỦA AMBRYS CÓ CHỨA CÁC MÃ NÀY ===')
    const orders = await prisma.salesOrder.findMany({
        where: {
            customerId: { in: customerIds }
        },
        include: {
            lines: {
                where: {
                    product: { skuCode: { in: targetCodes } }
                },
                include: { product: true }
            },
            customer: true
        }
    })
    console.log(`Số đơn hàng tìm thấy: ${orders.length}`)
    for (const o of orders) {
        if (o.lines.length > 0) {
            console.log(`SO: ${o.orderNo} | Khách: ${o.customer.code} | Ngày: ${o.orderDate} | Status: ${o.status}`)
            for (const l of o.lines) {
                console.log(`   - SKU: ${l.product.skuCode} | SL: ${l.quantity} | Đơn giá: ${l.unitPrice} | CK: ${l.discountPercent}% | VAT: ${l.vatAmount}`)
            }
        }
    }
}

main().catch(console.error).finally(() => pool.end())
