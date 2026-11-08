import { prisma } from '../src/lib/db'

async function check() {
  try {
    console.log('Querying live database for Calabria sales orders...')
    const calabriaCodes = ['L40010', 'L40011', 'L40012', 'L40013', 'L40014']

    // 1. Check all sales orders containing Calabria items via SalesOrderLine
    const lines = await prisma.salesOrderLine.findMany({
      where: {
        product: {
          skuCode: { in: calabriaCodes }
        }
      },
      include: {
        so: {
          include: { customer: true }
        },
        product: true
      },
      orderBy: {
        so: { createdAt: 'desc' }
      }
    })

    console.log(`\nFound ${lines.length} total line items in database:`)
    
    // Group by status
    const statusCounts: Record<string, number> = {}
    const statusQtys: Record<string, number> = {}
    const skuStatusBreakdown: Record<string, Record<string, number>> = {}

    for (const line of lines) {
      const st = line.so.status
      const qty = Number(line.qtyOrdered)
      statusCounts[st] = (statusCounts[st] || 0) + 1
      statusQtys[st] = (statusQtys[st] || 0) + qty

      const sku = line.product.skuCode
      if (!skuStatusBreakdown[sku]) skuStatusBreakdown[sku] = {}
      skuStatusBreakdown[sku][st] = (skuStatusBreakdown[sku][st] || 0) + qty
      skuStatusBreakdown[sku]['TOTAL'] = (skuStatusBreakdown[sku]['TOTAL'] || 0) + qty
    }

    console.log('\n--- Line items count by Status ---')
    console.log(statusCounts)

    console.log('\n--- Total Bottles by Status ---')
    console.log(statusQtys)

    console.log('\n--- Breakdown by SKU & Status (Bottles) ---')
    console.table(skuStatusBreakdown)

    // Check if there are ANY DRAFT orders in the system
    const draftOrders = lines.filter(l => l.so.status === 'DRAFT' || l.so.status.includes('DRAFT'))
    console.log(`\nDraft orders for Calabria: ${draftOrders.length}`)
    for (const d of draftOrders) {
      console.log(`- SO: ${d.so.soNo} | CreatedAt: ${d.so.createdAt} | SKU: ${d.product.skuCode} - ${d.product.productName} | Qty: ${d.qtyOrdered} | Cust: ${d.so.customer?.name}`)
    }

    // Check overall distinct statuses in sales_orders table
    const globalStatuses = await prisma.salesOrder.groupBy({
      by: ['status'],
      _count: { id: true }
    })
    console.log('\n--- Global SalesOrder count by status across entire ERP ---')
    console.table(globalStatuses)

  } catch (err: any) {
    console.error('Error querying DB:', err)
  } finally {
    await prisma.$disconnect()
    process.exit(0)
  }
}

check()
