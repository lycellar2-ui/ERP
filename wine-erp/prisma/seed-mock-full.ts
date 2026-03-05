/**
 * Advanced Mock Data Generator for Wine ERP
 * Run: npx tsx prisma/seed-mock-full.ts
 * Generates massive amount of realistic data spanning the last 6 months.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(start: Date, end: Date) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

async function main() {
    console.log('🚀 Generating massive mock data...')

    const products = await prisma.product.findMany()
    const customers = await prisma.customer.findMany()
    const suppliers = await prisma.supplier.findMany()
    const users = await prisma.user.findMany()

    if (products.length === 0 || customers.length === 0 || suppliers.length === 0 || users.length === 0) {
        console.error('❌ Missing master data. Run other seeds first.')
        process.exit(1)
    }

    const admin = users.find(u => u.email === 'admin@wine-erp.com') || users[0]
    const salesRep = users.find(u => u.email.includes('sales')) || users[0]

    const endOfToday = new Date()
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    // ─── 1. Generate 20 Purchase Orders over 6 months ────────────────────────
    console.log('  → Generating 20 POs over 6 months...')
    for (let i = 1; i <= 20; i++) {
        const date = randomDate(sixMonthsAgo, endOfToday)
        const dStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`
        const poNo = `PO-MOCK-${dStr}-${i.toString().padStart(3, '0')}-${Math.random().toString(36).substring(7)}`
        const supplier = randomItem(suppliers)
        const poStatus = randomItem(['APPROVED', 'IN_TRANSIT', 'RECEIVED'])

        const po = await prisma.purchaseOrder.create({
            data: {
                poNo,
                supplierId: supplier.id,
                createdBy: admin.id,
                createdAt: date,
                updatedAt: date,
                status: poStatus as any,
                currency: supplier.defaultCurrency || 'USD',
                exchangeRate: supplier.defaultCurrency === 'USD' ? 25400 : 27500,
            }
        })

        let poTotal = 0
        const lineCount = randomInt(2, 5)
        for (let j = 0; j < lineCount; j++) {
            const product = randomItem(products)
            const qty = randomInt(12, 120)
            const price = randomInt(20, 200)
            await prisma.purchaseOrderLine.create({
                data: {
                    poId: po.id,
                    productId: product.id,
                    qtyOrdered: qty,
                    unitPrice: price,
                    uom: 'BOTTLE'
                }
            })
            poTotal += (qty * price)
        }

        const dueDate = new Date(date)
        dueDate.setDate(dueDate.getDate() + 30)

        await prisma.aPInvoice.create({
            data: {
                invoiceNo: `APINV-${poNo}`,
                poId: po.id,
                supplierId: supplier.id,
                amount: poTotal,
                dueDate: dueDate,
                createdAt: date,
                status: date.getTime() < endOfToday.getTime() - 15 * 86400000 ? ('PAID' as any) : (randomItem(['UNPAID', 'PARTIALLY_PAID']) as any)
            }
        })
    }
    console.log('  ✓ 20 POs + AP Invoices')


    // ─── 2. Generate 50 Sales Orders over 6 months ──────────────────────────
    console.log('  → Generating 50 SOs and AR Invoices...')
    for (let i = 1; i <= 50; i++) {
        const date = randomDate(sixMonthsAgo, endOfToday)
        const dStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`
        const soNo = `SO-MOCK-${dStr}-${i.toString().padStart(3, '0')}-${Math.random().toString(36).substring(7)}`
        const customer = randomItem(customers)

        let status = 'DELIVERED'
        if (date.getTime() > endOfToday.getTime() - 5 * 86400000) {
            status = randomItem(['DRAFT', 'CONFIRMED'])
        }

        const so = await prisma.salesOrder.create({
            data: {
                soNo,
                customerId: customer.id,
                salesRepId: salesRep.id,
                status: status as any,
                channel: customer.channel || ('HORECA' as any),
                paymentTerm: customer.paymentTerm || 'NET30',
                totalAmount: 0,
                createdAt: date,
                updatedAt: date
            }
        })

        let soTotal = 0
        const lineCount = randomInt(1, 5)
        for (let j = 0; j < lineCount; j++) {
            const product = randomItem(products)
            const qty = randomInt(6, 60)
            const unitPrice = randomInt(1_000_000, 10_000_000)
            await prisma.salesOrderLine.create({
                data: {
                    soId: so.id,
                    productId: product.id,
                    qtyOrdered: qty,
                    unitPrice: unitPrice,
                }
            })
            soTotal += (qty * unitPrice)
        }

        await prisma.salesOrder.update({
            where: { id: so.id },
            data: { totalAmount: soTotal }
        })

        if (status === 'DELIVERED') {
            const dueDate = new Date(date)
            dueDate.setDate(dueDate.getDate() + 30)
            const isPaid = date.getTime() < endOfToday.getTime() - 20 * 86400000

            const arInvoice = await prisma.aRInvoice.create({
                data: {
                    invoiceNo: `ARINV-${soNo}`,
                    soId: so.id,
                    customerId: customer.id,
                    amount: soTotal,
                    vatAmount: soTotal * 0.1,
                    totalAmount: soTotal * 1.1,
                    status: isPaid ? ('PAID' as any) : (randomItem(['UNPAID', 'PARTIALLY_PAID']) as any),
                    dueDate: dueDate,
                    createdAt: date
                }
            })

            if (isPaid) {
                await prisma.aRPayment.create({
                    data: {
                        reference: `PAYIN-${soNo}`,
                        invoiceId: arInvoice.id,
                        amount: soTotal * 1.1,
                        paidAt: new Date(date.getTime() + 15 * 86400000),
                        method: 'BANK_TRANSFER' as any,
                    }
                })
            }
        }
    }
    console.log('  ✓ 50 SOs + Invoices + Payments')


    // ─── 3. Generate Massive Journal Entries for P&L ─────────────────────────
    console.log('  → Generating Journal Entries for P&L...')

    for (let m = 0; m < 6; m++) {
        const d = new Date()
        d.setMonth(d.getMonth() - m)
        const sMonth = d.getMonth() + 1
        const sYear = d.getFullYear()

        let period = await prisma.accountingPeriod.findUnique({
            where: { year_month: { year: sYear, month: sMonth } }
        })
        if (!period) {
            period = await prisma.accountingPeriod.create({
                data: {
                    month: sMonth,
                    year: sYear,
                    isClosed: false
                }
            })
        }

        const revAmount = randomInt(2_000_000_000, 10_000_000_000)
        const cogsAmount = Math.floor(revAmount * (randomInt(40, 60) / 100))
        const totalExp = randomInt(500_000_000, 1_500_000_000)

        // Revenue
        const rvJe = await prisma.journalEntry.create({
            data: {
                entryNo: `JE-REV-${sYear}${sMonth}-${Math.random().toString(36).substring(7)}`,
                postedAt: new Date(sYear, sMonth - 1, 28),
                periodId: period.id,
                description: `Tổng doanh thu bán hàng tháng ${sMonth}/${sYear}`,
                docType: 'SALES_INVOICE' as any,
                docId: 'MOCK',
                createdBy: admin.id
            }
        })
        await prisma.journalLine.createMany({
            data: [
                { entryId: rvJe.id, account: '131', debit: revAmount, credit: 0 },
                { entryId: rvJe.id, account: '511', debit: 0, credit: revAmount }
            ]
        })

        // COGS
        const cgJe = await prisma.journalEntry.create({
            data: {
                entryNo: `JE-COGS-${sYear}${sMonth}-${Math.random().toString(36).substring(7)}`,
                postedAt: new Date(sYear, sMonth - 1, 28),
                periodId: period.id,
                description: `Kết chuyển giá vốn hàng hóa tháng ${sMonth}/${sYear}`,
                docType: 'COGS' as any,
                docId: 'MOCK',
                createdBy: admin.id
            }
        })
        await prisma.journalLine.createMany({
            data: [
                { entryId: cgJe.id, account: '632', debit: cogsAmount, credit: 0 },
                { entryId: cgJe.id, account: '156', debit: 0, credit: cogsAmount }
            ]
        })

        // Expenses
        const exJe = await prisma.journalEntry.create({
            data: {
                entryNo: `JE-EXP-${sYear}${sMonth}-${Math.random().toString(36).substring(7)}`,
                postedAt: new Date(sYear, sMonth - 1, 28),
                periodId: period.id,
                description: `Chi phí quản lý doanh nghiệp tháng ${sMonth}/${sYear}`,
                docType: 'EXPENSE' as any,
                docId: 'MOCK',
                createdBy: admin.id
            }
        })
        await prisma.journalLine.createMany({
            data: [
                { entryId: exJe.id, account: '642', debit: totalExp, credit: 0 },
                { entryId: exJe.id, account: '112', debit: 0, credit: totalExp }
            ]
        })
    }
    console.log('  ✓ Filled 6 months of Journal Entries (Revenue, COGS, Expenses)')


    // ─── 4. Ensure Heavy Stock Levels ────────────────────────────────────────
    console.log('  → Boosting Stock Levels...')
    const location = await prisma.location.findFirst({ where: { type: 'STORAGE' } })
    if (location) {
        let i = 0
        for (const p of products) {
            i++
            await prisma.stockLot.upsert({
                where: { lotNo: `MOCK-LOT-${p.skuCode}` },
                update: {
                    qtyReceived: 500,
                    qtyAvailable: randomInt(150, 480)
                },
                create: {
                    lotNo: `MOCK-LOT-${p.skuCode}`,
                    productId: p.id,
                    locationId: location.id,
                    qtyReceived: 500,
                    qtyAvailable: randomInt(150, 480),
                    unitLandedCost: randomInt(3_000_000, 25_000_000),
                    receivedDate: new Date(new Date().getTime() - 30 * 86400000),
                    status: 'AVAILABLE'
                }
            })
        }
        console.log(`  ✓ Bumped Stock Levels for ${i} products`)
    }

    console.log('\n🎉 Massive Mock Data Generation Complete!')
}

main()
    .catch((e) => {
        console.error('❌ Mock Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
