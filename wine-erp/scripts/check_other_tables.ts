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
    console.log("=== CHECKING ALL TABLES FOR SUPPLIER REFERENCES ===");
    
    const countRegDocs = await prisma.regulatedDocument.count({
        where: { NOT: { supplierId: null } }
    });
    console.log(`RegulatedDocuments referencing a Supplier: ${countRegDocs}`);

    const countActivities = await prisma.supplierActivity.count();
    console.log(`Total SupplierActivities: ${countActivities}`);

    const countAddresses = await prisma.supplierAddress.count();
    console.log(`Total SupplierAddresses: ${countAddresses}`);

    const countContacts = await prisma.supplierContact.count();
    console.log(`Total SupplierContacts: ${countContacts}`);
    
    if (countRegDocs > 0) {
        const regDocs = await prisma.regulatedDocument.findMany({
            where: { NOT: { supplierId: null } },
            select: { id: true, docNo: true, supplierId: true }
        });
        console.log("Details of RegulatedDocuments:", JSON.stringify(regDocs));
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    });
