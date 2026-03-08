/**
 * E2E Test Script — Full Procurement Workflow
 * Product → Supplier → PO → Approve → Shipment → GR → Stock Lot
 * Run: set env then npx tsx src/scripts/test-procurement-flow.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { prisma } from '../lib/db'

async function main() {
    console.log('═══════════════════════════════════════════')
    console.log('  E2E TEST: Full Procurement Workflow')
    console.log('═══════════════════════════════════════════\n')

    // ── 1. Producer ──
    console.log('Step 1: Producer')
    let producer = await prisma.producer.findFirst({ where: { name: 'Chateau Test' } })
    if (!producer) {
        producer = await prisma.producer.create({ data: { name: 'Chateau Test', country: 'France' } })
    }
    console.log('  OK:', producer.name, producer.id)

    // ── 2. Product ──
    console.log('Step 2: Product')
    let product = await prisma.product.findFirst({ where: { skuCode: 'TST-E2E-001' } })
    if (!product) {
        product = await prisma.product.create({
            data: {
                skuCode: 'TST-E2E-001',
                productName: 'Chateau Test Bordeaux 2022',
                producerId: producer.id,
                vintage: 2022,
                country: 'France',
                abvPercent: 13.5,
                volumeMl: 750,
                format: 'STANDARD',
                packagingType: 'CARTON',
                unitsPerCase: 6,
                hsCode: '2204.21',
                wineType: 'RED',
                status: 'ACTIVE',
            }
        })
    }
    console.log('  OK:', product.productName, '(' + product.skuCode + ')')

    // ── 3. Supplier ──
    console.log('Step 3: Supplier')
    let supplier = await prisma.supplier.findFirst({ where: { code: 'TST-NCC-E2E' } })
    if (!supplier) {
        supplier = await prisma.supplier.create({
            data: {
                code: 'TST-NCC-E2E',
                name: 'Maison Test Bordeaux',
                type: 'NEGOCIANT',
                country: 'France',
                status: 'ACTIVE',
            }
        })
    }
    console.log('  OK:', supplier.name, '(' + supplier.code + ')')

    // ── 4. Purchase Order ──
    console.log('Step 4: Create PO')
    const poNo = 'PO-E2E-' + Date.now().toString(36).toUpperCase()
    const userId = (await prisma.user.findFirst({ select: { id: true } }))!.id
    const po = await prisma.purchaseOrder.create({
        data: {
            poNo,
            supplier: { connect: { id: supplier.id } },
            currency: 'EUR',
            exchangeRate: 27500,
            status: 'DRAFT',
            creator: { connect: { id: userId } },
            lines: { create: [{ productId: product.id, qtyOrdered: 600, unitPrice: 8.50, uom: 'BOTTLE' }] }
        },
        include: { lines: true }
    })
    const totalEUR = po.lines.reduce((s, l) => Number(l.qtyOrdered) * Number(l.unitPrice), 0)
    console.log('  OK:', po.poNo, '| EUR', totalEUR, '| Status:', po.status)

    // ── 5. Approve PO ──
    console.log('Step 5: Approve PO')
    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'APPROVED' } })
    console.log('  OK: APPROVED')

    // ── 6. Create Shipment ──
    console.log('Step 6: Create Shipment')
    const bl = 'MAEU' + Date.now().toString(36).toUpperCase()
    const cifAmount = totalEUR * 1.15
    const shipment = await prisma.shipment.create({
        data: {
            poId: po.id, billOfLading: bl, vesselName: 'MSC ROMA', voyageNo: 'VA523W',
            containerNo: 'MSKU' + Math.random().toString(36).substring(2, 9).toUpperCase(),
            containerType: '20FT', portOfLoading: 'FRMRS', portOfDischarge: 'VNSGN',
            etd: new Date('2026-04-01'), eta: new Date('2026-05-15'),
            cifAmount, cifCurrency: 'EUR', incoterms: 'EXW', status: 'BOOKED',
        }
    })
    console.log('  OK:', shipment.billOfLading, '| Vessel:', shipment.vesselName, '| CIF EUR', Number(shipment.cifAmount))

    // ── 7. Add milestones ──
    console.log('Step 7: Milestones')
    const ms = ['PO_CONFIRMED', 'PICKUP', 'LOADED', 'DOCS', 'DEPARTED', 'ARRIVED', 'CUSTOMS_FILE', 'INSPECTION', 'CLEARED', 'STAMPS', 'DELIVERED', 'GR', 'DONE']
    await prisma.shipmentMilestone.createMany({
        data: ms.map((m, i) => ({ shipmentId: shipment.id, milestone: m, label: m, sortOrder: i * 10 }))
    })
    console.log('  OK:', ms.length, 'milestones')

    // ── 8. Cost items ──
    console.log('Step 8: Cost Items')
    const costs = [
        { category: 'FREIGHT', description: 'Ocean freight', amount: 1800, currency: 'USD', exchangeRate: 25300, amountVND: 1800 * 25300 },
        { category: 'INSURANCE', description: 'All Risks', amount: 350, currency: 'USD', exchangeRate: 25300, amountVND: 350 * 25300 },
        { category: 'THC_DEST', description: 'THC Cat Lai', amount: 8500000, currency: 'VND', exchangeRate: 1, amountVND: 8500000 },
        { category: 'CUSTOMS_FEE', description: 'HQ fee', amount: 3500000, currency: 'VND', exchangeRate: 1, amountVND: 3500000 },
        { category: 'TRUCKING_DEST', description: 'Trucking', amount: 4500000, currency: 'VND', exchangeRate: 1, amountVND: 4500000 },
        { category: 'STAMP', description: 'Tem 600 chai', amount: 3000000, currency: 'VND', exchangeRate: 1, amountVND: 3000000 },
    ]
    await prisma.shipmentCostItem.createMany({ data: costs.map(c => ({ shipmentId: shipment.id, ...c })) })
    const totalCostVND = costs.reduce((s, c) => s + c.amountVND, 0)
    console.log('  OK:', costs.length, 'items |', totalCostVND.toLocaleString(), 'VND')

    // ── 9. Customs Declaration ──
    console.log('Step 9: Customs Declaration')
    const cifVND = Number(shipment.cifAmount) * 27500
    const importTax = cifVND * 0.128
    const sct = (cifVND + importTax) * 0.35
    const vat = (cifVND + importTax + sct) * 0.10
    const totalTax = importTax + sct + vat
    await prisma.customsDeclaration.create({
        data: {
            shipmentId: shipment.id, declarationNo: '305E2E/NKD/HQ', declarationType: 'C31',
            customsOffice: 'Cat Lai', hsCode: '2204.21', coFormType: 'EUR.1',
            importTaxRate: 12.8, importTaxAmount: importTax,
            sctRate: 35, sctAmount: sct, vatRate: 10, vatAmount: vat, totalTax,
            inspectionBody: 'VNATEST', inspectionResult: 'PASSED', inspectionDate: new Date(), status: 'CLEARED',
        }
    })
    console.log('  OK: NK', Math.round(importTax).toLocaleString(), '| SCT', Math.round(sct).toLocaleString(), '| VAT', Math.round(vat).toLocaleString(), '| Total', Math.round(totalTax).toLocaleString())

    // ── 10. Goods Receipt ──
    console.log('Step 10: Goods Receipt')
    let wh = await prisma.warehouse.findFirst()
    if (!wh) wh = await prisma.warehouse.create({ data: { name: 'Kho HCM', code: 'WH-HCM' } })
    const gr = await prisma.goodsReceipt.create({
        data: {
            grNo: 'GR-E2E-' + Date.now().toString(36).toUpperCase(),
            po: { connect: { id: po.id } },
            shipment: { connect: { id: shipment.id } },
            warehouse: { connect: { id: wh.id } },
            status: 'CONFIRMED',
            confirmer: { connect: { id: userId } },
            confirmedAt: new Date(),
            lines: { create: [{ productId: product.id, qtyExpected: 600, qtyReceived: 600, variance: 0 }] }
        },
        include: { lines: true }
    })
    console.log('  OK:', gr.grNo, '| 600/600 received')

    // ── 11. Update statuses ──
    console.log('Step 11: Final Status Updates')
    await prisma.shipment.update({ where: { id: shipment.id }, data: { status: 'DELIVERED_TO_WAREHOUSE', ata: new Date() } })
    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'RECEIVED' } })
    console.log('  OK: Shipment -> DELIVERED_TO_WAREHOUSE, PO -> RECEIVED')

    // ── 12. Stock Lot ──
    console.log('Step 12: Stock Lot')
    const landedPerBottle = (cifVND + totalCostVND + totalTax) / 600
    // Get or create location
    let loc = await prisma.location.findFirst()
    if (!loc) {
        loc = await prisma.location.create({
            data: { warehouseId: wh.id, zone: 'A', rack: '01', bin: '001', type: 'STORAGE', status: 'ACTIVE' }
        })
    }
    const lot = await prisma.stockLot.create({
        data: {
            lotNo: 'LOT-E2E-' + Date.now().toString(36).toUpperCase(),
            product: { connect: { id: product.id } },
            shipment: { connect: { id: shipment.id } },
            location: { connect: { id: loc.id } },
            qtyReceived: 600, qtyAvailable: 600, unitLandedCost: landedPerBottle,
            receivedDate: new Date(),
            status: 'AVAILABLE',
        }
    })
    console.log('  OK:', lot.lotNo, '| 600 bottles @', Math.round(landedPerBottle).toLocaleString(), 'VND/bottle')

    // ── SUMMARY ──
    console.log('\n═══════════════════════════════════════════')
    console.log('  SUMMARY')
    console.log('═══════════════════════════════════════════')
    console.log('  Product:', product.productName, '(' + product.skuCode + ')')
    console.log('  Supplier:', supplier.name)
    console.log('  PO:', po.poNo, '-> RECEIVED')
    console.log('  Shipment:', shipment.billOfLading, '| Vessel:', shipment.vesselName)
    console.log('  CIF:', 'EUR', Number(shipment.cifAmount).toLocaleString(), '=', cifVND.toLocaleString(), 'VND')
    console.log('  Costs:', totalCostVND.toLocaleString(), 'VND')
    console.log('  Taxes:', Math.round(totalTax).toLocaleString(), 'VND')
    console.log('  GR:', gr.grNo, '| 600/600')
    console.log('  Stock:', lot.lotNo, '|', Number(lot.qtyReceived), 'bottles @', Math.round(landedPerBottle).toLocaleString(), 'VND')
    console.log('  TOTAL LANDED:', Math.round(cifVND + totalCostVND + totalTax).toLocaleString(), 'VND')
    console.log('═══════════════════════════════════════════')
    console.log('  ALL 12 STEPS PASSED!')
}

main()
    .catch(e => { console.error('FAILED:', e.message ?? e); process.exit(1) })
    .finally(() => prisma.$disconnect())
