import { prisma } from '../src/lib/db'

async function run() {
  const calabriaCodes = ['L40010', 'L40011', 'L40012', 'L40013', 'L40014']
  const lines = await prisma.salesOrderLine.findMany({
    where: {
      product: { skuCode: { in: calabriaCodes } },
      so: { createdAt: { gte: new Date('2026-10-04T00:00:00Z') } }
    },
    include: {
      so: { include: { customer: true, salesRep: true } },
      product: true
    },
    orderBy: { so: { createdAt: 'desc' } }
  })
  
  console.log(`Orders created from 04/10 to 15/10/2026: ${lines.length} lines`)
  for (const l of lines) {
    console.log(`[${l.so.status}] SO: ${l.so.soNo} | Date: ${l.so.createdAt.toISOString().slice(0,10)} | ${l.product.skuCode} - ${l.product.productName} | Qty: ${Number(l.qtyOrdered)} | Cust: ${l.so.customer?.name} | Rep: ${l.so.salesRep?.name}`)
  }
  await prisma.$disconnect()
}
run()
