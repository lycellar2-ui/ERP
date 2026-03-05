/**
 * Seed extra sample data (Users, Departments, Transactons, etc.)
 * Run: npx tsx prisma/seed-extra.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as crypto from 'crypto'

dotenv.config({ path: '.env.local' })

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 3,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Helper
const hashPassword = (pwd: string) => crypto.createHash('sha256').update(pwd).digest('hex')

async function main() {
    console.log('🌟 Seeding Extra Data...')

    // 1. Departments
    const salesDept = await prisma.department.upsert({
        where: { id: 'dept-sales' },
        update: {},
        create: { id: 'dept-sales', name: 'Sales & Marketing' }
    })
    const financeDept = await prisma.department.upsert({
        where: { id: 'dept-finance' },
        update: {},
        create: { id: 'dept-finance', name: 'Finance & Accounting' }
    })
    const opsDept = await prisma.department.upsert({
        where: { id: 'dept-ops' },
        update: {},
        create: { id: 'dept-ops', name: 'Operations & SCM' }
    })

    // 2. Roles
    const adminRole = await prisma.role.upsert({
        where: { id: 'role-admin' },
        update: {},
        create: { id: 'role-admin', name: 'System Administrator' }
    })
    const salesRepRole = await prisma.role.upsert({
        where: { id: 'role-salesrep' },
        update: {},
        create: { id: 'role-salesrep', name: 'Sales Representative', deptId: salesDept.id }
    })

    // 3. Users
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@wine-erp.com' },
        update: {},
        create: {
            email: 'admin@wine-erp.com',
            name: 'Admin User',
            passwordHash: hashPassword('admin123'),
        }
    })
    const salesUser1 = await prisma.user.upsert({
        where: { email: 'john.sales@wine-erp.com' },
        update: {},
        create: {
            email: 'john.sales@wine-erp.com',
            name: 'John Doe',
            passwordHash: hashPassword('sales123'),
            deptId: salesDept.id
        }
    })

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
        update: {},
        create: { userId: adminUser.id, roleId: adminRole.id }
    })
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: salesUser1.id, roleId: salesRepRole.id } },
        update: {},
        create: { userId: salesUser1.id, roleId: salesRepRole.id }
    })

    // Fetch existing data
    const products = await prisma.product.findMany({ take: 5 })
    const customers = await prisma.customer.findMany({ take: 3 })
    const suppliers = await prisma.supplier.findMany({ take: 2 })

    if (products.length > 0) {
        // Market Prices
        for (const p of products) {
            await prisma.marketPrice.create({
                data: {
                    productId: p.id,
                    price: 1500000 + Math.random() * 500000,
                    source: 'Competitor A',
                    priceDate: new Date(),
                    enteredBy: adminUser.id
                }
            })
        }
        console.log('  ✓ Seeded Market Prices')

        // Tax Rates
        await prisma.taxRate.create({
            data: {
                hsCode: '2204211000',
                countryOfOrigin: 'FR',
                tradeAgreement: 'EVFTA',
                importTaxRate: 15,
                sctRate: 35,
                vatRate: 10,
                effectiveDate: new Date('2024-01-01'),
            }
        })
        console.log('  ✓ Seeded Tax Rates')
    }

    if (customers.length > 0 && products.length > 0) {
        // Sales Order
        const so = await prisma.salesOrder.upsert({
            where: { soNo: 'SO-202503-001' },
            update: {},
            create: {
                soNo: 'SO-202503-001',
                customerId: customers[0].id,
                salesRepId: salesUser1.id,
                channel: customers[0].channel || 'HORECA',
                paymentTerm: customers[0].paymentTerm || 'NET30',
                status: 'CONFIRMED',
                totalAmount: 12000000,
            }
        })
        await prisma.salesOrderLine.create({
            data: {
                soId: so.id,
                productId: products[0].id,
                qtyOrdered: 12,
                unitPrice: 1000000,
            }
        })

        // AR Invoice
        await prisma.aRInvoice.upsert({
            where: { invoiceNo: 'INV-202503-001' },
            update: {},
            create: {
                invoiceNo: 'INV-202503-001',
                soId: so.id,
                customerId: customers[0].id,
                amount: 12000000,
                vatAmount: 1200000,
                totalAmount: 13200000,
                dueDate: new Date(new Date().getTime() + 30 * 86400000),
                status: 'UNPAID'
            }
        })

        // Customer Activity
        await prisma.customerActivity.create({
            data: {
                customerId: customers[0].id,
                type: 'CALL',
                description: 'Follow up on SO-202503-001',
                performedBy: salesUser1.id
            }
        })

        // Sales Opportunity
        await prisma.salesOpportunity.create({
            data: {
                customerId: customers[1]?.id || customers[0].id,
                name: 'Q2 Wine Supply',
                expectedValue: 50000000,
                stage: 'PROPOSAL',
                assignedTo: salesUser1.id
            }
        })
        console.log('  ✓ Seeded Sales Orders, Invoices, Opportunities & CRM activities')
    }

    if (suppliers.length > 0 && products.length > 0) {
        const po = await prisma.purchaseOrder.upsert({
            where: { poNo: 'PO-202503-001' },
            update: {},
            create: {
                poNo: 'PO-202503-001',
                supplierId: suppliers[0].id,
                createdBy: adminUser.id,
                status: 'APPROVED',
                currency: 'USD',
                exchangeRate: 25400
            }
        })

        await prisma.purchaseOrderLine.create({
            data: {
                poId: po.id,
                productId: products[0].id,
                qtyOrdered: 120,
                unitPrice: 40,
                uom: 'BOTTLE'
            }
        })

        await prisma.aPInvoice.create({
            data: {
                invoiceNo: 'AP-INV-' + Math.random().toString(36).substring(7),
                poId: po.id,
                supplierId: suppliers[0].id,
                amount: 4800,
                dueDate: new Date(new Date().getTime() + 30 * 86400000),
                status: 'UNPAID'
            }
        })
        console.log('  ✓ Seeded Purchase Orders and AP Invoices')
    }

    console.log('✅ Extra Seed complete!')
}

main()
    .catch((e) => {
        console.error('❌ Extra Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
