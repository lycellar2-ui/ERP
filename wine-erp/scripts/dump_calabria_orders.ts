import { prisma } from '../src/lib/db'

async function check() {
  try {
    const calabriaCodes = ['L40010', 'L40011', 'L40012', 'L40013', 'L40014']

    const lines = await prisma.salesOrderLine.findMany({
      where: {
        product: {
          skuCode: { in: calabriaCodes }
        }
      },
      include: {
        so: {
          include: { customer: true, salesRep: true }
        },
        product: true
      },
      orderBy: {
        so: { createdAt: 'desc' }
      }
    })

    console.log(`\n=== ALL ${lines.length} LIVE ORDERS FOR CALABRIA (AS OF TODAY) ===`)
    const rows = lines.map(l => ({
      soNo: l.so.soNo,
      date: l.so.orderDate?.toISOString().slice(0, 10) || l.so.createdAt.toISOString().slice(0, 10),
      created: l.so.createdAt.toISOString().slice(0, 19),
      sku: l.product.skuCode,
      name: l.product.productName,
      qty: Number(l.qtyOrdered),
      unitPrice: Number(l.unitPrice),
      total: Number(l.qtyOrdered) * Number(l.unitPrice),
      status: l.so.status,
      customer: l.so.customer?.name,
      salesRep: l.so.salesRep?.name
    }))

    console.log(JSON.stringify(rows, null, 2))

  } catch (err: any) {
    console.error(err)
  } finally {
    await prisma.$disconnect()
  }
}
check()
