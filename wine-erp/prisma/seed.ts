/**
 * Seed script — Wine ERP realistic sample data
 * Run: npx tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// ─── Use pg.Pool so we can set SSL properly ───────
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🍷 Seeding Wine ERP data...')

    // ─── 1. Wine Regions ──────────────────────────────
    console.log('  → Creating wine regions...')

    // WineRegion has: id, name, country
    const bordeaux = await prisma.wineRegion.upsert({
        where: { id: 'region-bordeaux' },
        update: {},
        create: { id: 'region-bordeaux', name: 'Bordeaux', country: 'FR' },
    })
    const burgundy = await prisma.wineRegion.upsert({
        where: { id: 'region-burgundy' },
        update: {},
        create: { id: 'region-burgundy', name: 'Burgundy (Bourgogne)', country: 'FR' },
    })
    const champagne = await prisma.wineRegion.upsert({
        where: { id: 'region-champagne' },
        update: {},
        create: { id: 'region-champagne', name: 'Champagne', country: 'FR' },
    })
    const tuscany = await prisma.wineRegion.upsert({
        where: { id: 'region-tuscany' },
        update: {},
        create: { id: 'region-tuscany', name: 'Tuscany (Toscana)', country: 'IT' },
    })
    const napa = await prisma.wineRegion.upsert({
        where: { id: 'region-napa' },
        update: {},
        create: { id: 'region-napa', name: 'Napa Valley', country: 'US' },
    })
    await prisma.wineRegion.upsert({
        where: { id: 'region-rhone' },
        update: {},
        create: { id: 'region-rhone', name: 'Rhône Valley', country: 'FR' },
    })

    // ─── 2. Appellations ──────────────────────────────
    console.log('  → Creating appellations...')
    const pomerol = await prisma.appellation.upsert({
        where: { id: 'app-pomerol' },
        update: {},
        create: { id: 'app-pomerol', name: 'Pomerol AOC', regionId: bordeaux.id },
    })
    await prisma.appellation.upsert({
        where: { id: 'app-stemilion' },
        update: {},
        create: { id: 'app-stemilion', name: 'Saint-Émilion Grand Cru', regionId: bordeaux.id },
    })
    const pauillac = await prisma.appellation.upsert({
        where: { id: 'app-pauillac' },
        update: {},
        create: { id: 'app-pauillac', name: 'Pauillac AOC', regionId: bordeaux.id },
    })
    const margauxApp = await prisma.appellation.upsert({
        where: { id: 'app-margaux' },
        update: {},
        create: { id: 'app-margaux', name: 'Margaux AOC', regionId: bordeaux.id },
    })
    const chambolle = await prisma.appellation.upsert({
        where: { id: 'app-chambolle' },
        update: {},
        create: { id: 'app-chambolle', name: 'Chambolle-Musigny', regionId: burgundy.id },
    })

    // ─── 3. Producers ─────────────────────────────────
    console.log('  → Creating producers...')
    const petrus = await prisma.producer.upsert({
        where: { id: 'prod-petrus' },
        update: {},
        create: { id: 'prod-petrus', name: 'Château Pétrus', country: 'FR', website: 'https://petrus.com' },
    })
    const opusOne = await prisma.producer.upsert({
        where: { id: 'prod-opusone' },
        update: {},
        create: { id: 'prod-opusone', name: 'Opus One Winery', country: 'US', website: 'https://opusonewinery.com' },
    })
    const mouton = await prisma.producer.upsert({
        where: { id: 'prod-mouton' },
        update: {},
        create: { id: 'prod-mouton', name: 'Château Mouton Rothschild', country: 'FR' },
    })
    const chateauMargaux = await prisma.producer.upsert({
        where: { id: 'prod-margaux' },
        update: {},
        create: { id: 'prod-margaux', name: 'Château Margaux', country: 'FR' },
    })
    const krug = await prisma.producer.upsert({
        where: { id: 'prod-krug' },
        update: {},
        create: { id: 'prod-krug', name: 'Krug', country: 'FR' },
    })
    const veuve = await prisma.producer.upsert({
        where: { id: 'prod-veuve' },
        update: {},
        create: { id: 'prod-veuve', name: 'Veuve Clicquot', country: 'FR' },
    })
    const sassicaia = await prisma.producer.upsert({
        where: { id: 'prod-sassicaia' },
        update: {},
        create: { id: 'prod-sassicaia', name: 'Tenuta San Guido (Sassicaia)', country: 'IT' },
    })
    const drc = await prisma.producer.upsert({
        where: { id: 'prod-drc' },
        update: {},
        create: { id: 'prod-drc', name: 'Domaine de la Romanée-Conti', country: 'FR' },
    })

    // ─── 4. Products ──────────────────────────────────
    // Enum ProductStatus: ACTIVE | DISCONTINUED | ALLOCATION_ONLY
    // Enum WineType: RED | WHITE | ROSE | SPARKLING | FORTIFIED | DESSERT
    // Enum WineFormat: STANDARD | MAGNUM | JEROBOAM | METHUSELAH
    // Enum PackagingType: OWC | CARTON
    console.log('  → Creating products...')

    const productList = [
        { id: 'p-petrus-2018', skuCode: 'PETRUS-2018-750', productName: 'Château Pétrus 2018', producerId: petrus.id, vintage: 2018, appellationId: pomerol.id, country: 'FR', abvPercent: 14.5, volumeMl: 750, format: 'STANDARD', packagingType: 'OWC', unitsPerCase: 6, hsCode: '2204211000', wineType: 'RED', classification: 'First Growth Equivalent', tastingNotes: 'Opulent, velvety. Plum, truffle, mocha. Legendary.', status: 'ACTIVE' },
        { id: 'p-opusone-2020', skuCode: 'OPUSONE-2020-750', productName: 'Opus One 2020', producerId: opusOne.id, vintage: 2020, country: 'US', abvPercent: 14.5, volumeMl: 750, format: 'STANDARD', packagingType: 'OWC', unitsPerCase: 12, hsCode: '2204211000', wineType: 'RED', classification: 'Napa Valley Blend', tastingNotes: 'Cassis, cedar, graphite. Bordeaux-style elegance.', status: 'ACTIVE' },
        { id: 'p-mouton-2019', skuCode: 'MOUTON-2019-750', productName: 'Château Mouton Rothschild 2019', producerId: mouton.id, vintage: 2019, appellationId: pauillac.id, country: 'FR', abvPercent: 13.5, volumeMl: 750, format: 'STANDARD', packagingType: 'OWC', unitsPerCase: 12, hsCode: '2204211000', wineType: 'RED', classification: 'Premier Cru Classé 1855', tastingNotes: 'Blackcurrant, tobacco, dark chocolate.', status: 'ACTIVE' },
        { id: 'p-margaux-2018', skuCode: 'CMARGAUX-2018-750', productName: 'Château Margaux 2018', producerId: chateauMargaux.id, vintage: 2018, appellationId: margauxApp.id, country: 'FR', abvPercent: 13.0, volumeMl: 750, format: 'STANDARD', packagingType: 'OWC', unitsPerCase: 12, hsCode: '2204211000', wineType: 'RED', classification: 'Premier Grand Cru Classé', tastingNotes: 'Floral violet, silky tannins. The epitome of elegance.', status: 'ACTIVE' },
        { id: 'p-krug-mv', skuCode: 'KRUG-MV-750', productName: 'Krug Grande Cuvée 171ème Édition', producerId: krug.id, country: 'FR', abvPercent: 12.0, volumeMl: 750, format: 'STANDARD', packagingType: 'OWC', unitsPerCase: 6, hsCode: '2204101000', wineType: 'SPARKLING', classification: 'Prestige Non-Vintage Cuvée', tastingNotes: 'Toasted brioche, marzipan, dried apricot.', status: 'ACTIVE' },
        { id: 'p-veuve-yl', skuCode: 'VEUVE-YL-750', productName: 'Veuve Clicquot Yellow Label Brut NV', producerId: veuve.id, country: 'FR', abvPercent: 12.0, volumeMl: 750, format: 'STANDARD', packagingType: 'CARTON', unitsPerCase: 12, hsCode: '2204101000', barcodeEan: '3049614085392', wineType: 'SPARKLING', tastingNotes: 'Brioche, white peach, toasted almond.', status: 'ACTIVE' },
        { id: 'p-sassicaia-2019', skuCode: 'SASSICAIA-2019-750', productName: 'Sassicaia 2019', producerId: sassicaia.id, vintage: 2019, country: 'IT', abvPercent: 14.0, volumeMl: 750, format: 'STANDARD', packagingType: 'OWC', unitsPerCase: 12, hsCode: '2204211000', wineType: 'RED', classification: 'Bolgheri DOC Superiore', tastingNotes: 'Blackberry, eucalyptus, cedar. The original Super Tuscan.', status: 'ACTIVE' },
        { id: 'p-drc-2018', skuCode: 'DRC-CC-2018-750', productName: 'DRC Chambolle-Musigny 2018', producerId: drc.id, vintage: 2018, appellationId: chambolle.id, country: 'FR', abvPercent: 13.0, volumeMl: 750, format: 'STANDARD', packagingType: 'OWC', unitsPerCase: 6, hsCode: '2204211000', wineType: 'RED', classification: 'Village AOC by DRC', tastingNotes: 'Delicate red berry, rose petals, forest floor.', status: 'ACTIVE' },
        { id: 'p-petrus-2020', skuCode: 'PETRUS-2020-750', productName: 'Château Pétrus 2020', producerId: petrus.id, vintage: 2020, appellationId: pomerol.id, country: 'FR', abvPercent: 14.0, volumeMl: 750, format: 'STANDARD', packagingType: 'OWC', unitsPerCase: 6, hsCode: '2204211000', wineType: 'RED', classification: 'First Growth Equivalent', tastingNotes: 'Dense, concentrated, immortal structure.', status: 'ALLOCATION_ONLY' },
        { id: 'p-mouton-mag-2016', skuCode: 'MOUTON-2016-1500', productName: 'Château Mouton Rothschild 2016 Magnum', producerId: mouton.id, vintage: 2016, appellationId: pauillac.id, country: 'FR', abvPercent: 13.5, volumeMl: 1500, format: 'MAGNUM', packagingType: 'OWC', unitsPerCase: 3, hsCode: '2204211000', wineType: 'RED', classification: 'Premier Cru Classé 1855', tastingNotes: '2016 classic Pauillac in magnum — cellar potential to 2050.', status: 'ACTIVE' },
    ]

    for (const p of productList) {
        await prisma.product.upsert({
            where: { skuCode: p.skuCode },
            update: {},
            create: p as any,
        })
    }
    console.log(`  ✓ ${productList.length} products seeded`)

    // ─── 5. Suppliers ─────────────────────────────────
    // Enum SupplierType: WINERY | NEGOCIANT | DISTRIBUTOR | LOGISTICS | FORWARDER | CUSTOMS_BROKER
    // Enum SupplierStatus: ACTIVE | INACTIVE | BLACKLISTED
    console.log('  → Creating suppliers...')
    const supplierList = [
        { id: 'sup-lvmh', code: 'SUP-LVMH', name: 'LVMH Wines & Spirits Distribution', type: 'WINERY', country: 'FR', tradeAgreement: 'EVFTA', coFormType: 'EUR.1', paymentTerm: 'NET60', defaultCurrency: 'EUR', incoterms: 'CIF Ho Chi Minh City', leadTimeDays: 60, status: 'ACTIVE' },
        { id: 'sup-millesima', code: 'SUP-MILLESIMA', name: 'Millésima Bordeaux (En Primeur)', type: 'NEGOCIANT', country: 'FR', tradeAgreement: 'EVFTA', coFormType: 'EUR.1', paymentTerm: 'NET90', defaultCurrency: 'EUR', incoterms: 'FOB Bordeaux', leadTimeDays: 90, status: 'ACTIVE' },
        { id: 'sup-treasury', code: 'SUP-TREASURY', name: 'Treasury Wine Estates Asia Pacific', type: 'WINERY', country: 'AU', tradeAgreement: 'AANZFTA', coFormType: 'Form AANZ', paymentTerm: 'NET30', defaultCurrency: 'USD', incoterms: 'CIF Ho Chi Minh City', leadTimeDays: 45, status: 'ACTIVE' },
        { id: 'sup-suntory', code: 'SUP-SUNTORY', name: 'Suntory Beam Global (Opus One)', type: 'DISTRIBUTOR', country: 'US', paymentTerm: 'NET45', defaultCurrency: 'USD', incoterms: 'CIF Ho Chi Minh City', leadTimeDays: 50, status: 'ACTIVE' },
    ]
    for (const s of supplierList) {
        await prisma.supplier.upsert({
            where: { code: s.code },
            update: {},
            create: s as any,
        })
    }
    console.log(`  ✓ ${supplierList.length} suppliers seeded`)

    // ─── 6. Customers ─────────────────────────────────
    // Enum CustomerType: HORECA | WHOLESALE_DISTRIBUTOR | VIP_RETAIL | INDIVIDUAL
    // Enum SalesChannel: HORECA | WHOLESALE_DISTRIBUTOR | VIP_RETAIL | DIRECT_INDIVIDUAL
    // Enum CustomerStatus: ACTIVE | INACTIVE | BLOCKED
    console.log('  → Creating customers...')
    const customerList = [
        { id: 'cus-parkhyatt', code: 'CUS-PARKHYATT', name: 'Park Hyatt Saigon', taxId: '0302012345', customerType: 'HORECA', channel: 'HORECA', paymentTerm: 'NET30', creditLimit: 500_000_000, status: 'ACTIVE' },
        { id: 'cus-rex', code: 'CUS-REX', name: 'Rex Hotel Saigon', taxId: '0301009876', customerType: 'HORECA', channel: 'HORECA', paymentTerm: 'NET30', creditLimit: 300_000_000, status: 'ACTIVE' },
        { id: 'cus-sheraton', code: 'CUS-SHERATON', name: 'Sheraton Grand Saigon Hotel', taxId: '0313456789', customerType: 'HORECA', channel: 'HORECA', paymentTerm: 'NET45', creditLimit: 600_000_000, status: 'ACTIVE' },
        { id: 'cus-therest', code: 'CUS-THEREST', name: 'The Restaurant by Martino', taxId: '0304567890', customerType: 'HORECA', channel: 'HORECA', paymentTerm: 'NET15', creditLimit: 100_000_000, status: 'ACTIVE' },
        { id: 'cus-hndist', code: 'CUS-HNDIST', name: 'Công ty TNHH Phân Phối Rượu Miền Bắc', taxId: '0102345678', customerType: 'WHOLESALE_DISTRIBUTOR', channel: 'WHOLESALE_DISTRIBUTOR', paymentTerm: 'NET60', creditLimit: 2_000_000_000, status: 'ACTIVE' },
        { id: 'cus-winebar', code: 'CUS-WINEBAR', name: 'The Wine Room - Wine Bar & Shop', taxId: '0305678901', customerType: 'VIP_RETAIL', channel: 'VIP_RETAIL', paymentTerm: 'NET30', creditLimit: 150_000_000, status: 'ACTIVE' },
        { id: 'cus-intercon', code: 'CUS-INTERCON', name: 'InterContinental Hanoi Westlake', taxId: '0100456712', customerType: 'HORECA', channel: 'HORECA', paymentTerm: 'NET30', creditLimit: 400_000_000, status: 'ACTIVE' },
        { id: 'cus-vip-nguyen', code: 'CUS-NGUYEN', name: 'Mr. Nguyễn Thành Trung (VIP)', customerType: 'VIP_RETAIL', channel: 'VIP_RETAIL', paymentTerm: 'NET15', creditLimit: 200_000_000, status: 'ACTIVE' },
    ]
    for (const c of customerList) {
        await prisma.customer.upsert({
            where: { code: c.code },
            update: {},
            create: c as any,
        })
    }
    console.log(`  ✓ ${customerList.length} customers seeded`)

    console.log('\n✅ Seed complete!')
    console.log(`   Regions: 6 | Producers: 8 | Products: ${productList.length}`)
    console.log(`   Suppliers: ${supplierList.length} | Customers: ${customerList.length}`)
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
