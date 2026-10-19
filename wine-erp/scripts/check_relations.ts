import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

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

async function main() {
    console.log("=== CHECKING SUPPLIER RELATIONSHIPS ===");
    
    // Check PO counts per supplier
    const pos = await prisma.purchaseOrder.findMany({
        select: {
            id: true,
            poNo: true,
            supplierId: true,
            supplier: {
                select: {
                    code: true,
                    name: true
                }
            }
        }
    });

    console.log(`Total Purchase Orders: ${pos.length}`);
    pos.forEach(po => {
        console.log(`PO: ${po.poNo} | Supplier: ${po.supplier.name} (${po.supplier.code})`);
    });

    // Check Contracts per supplier
    const contracts = await prisma.contract.findMany({
        select: {
            id: true,
            contractNo: true,
            supplierId: true,
            supplier: {
                select: {
                    code: true,
                    name: true
                }
            }
        }
    });
    console.log(`\nTotal Contracts: ${contracts.length}`);
    contracts.forEach(c => {
        console.log(`Contract: ${c.contractNo} | Supplier: ${c.supplier?.name} (${c.supplier?.code})`);
    });

    // Check AP Invoices
    const apInvoices = await prisma.aPInvoice.findMany({
        select: {
            id: true,
            invoiceNo: true,
            supplier: {
                select: {
                    code: true,
                    name: true
                }
            }
        }
    });
    console.log(`\nTotal AP Invoices: ${apInvoices.length}`);
    apInvoices.forEach(inv => {
        console.log(`Invoice: ${inv.invoiceNo} | Supplier: ${inv.supplier.name} (${inv.supplier.code})`);
    });
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    });
