const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const orders = await prisma.salesOrderItem.findMany({
      where: {
        product: {
          code: { in: ['L40010', 'L40011', 'L40012', 'L40013', 'L40014'] }
        }
      },
      include: {
        salesOrder: {
          include: { customer: true }
        },
        product: true
      }
    });

    console.log('Total sales order items in DB for Calabria:', orders.length);
    const byStatus = {};
    const detailedList = [];

    for (const item of orders) {
      const st = item.salesOrder.status;
      byStatus[st] = (byStatus[st] || 0) + item.quantity;
      detailedList.push({
        code: item.salesOrder.code,
        status: st,
        date: item.salesOrder.orderDate || item.salesOrder.createdAt,
        customer: item.salesOrder.customer?.name || item.salesOrder.customerName,
        sku: item.product.code,
        productName: item.product.name,
        qty: item.quantity,
        price: item.unitPrice
      });
    }
    console.log('Status breakdown (bottles):', byStatus);

    // Filter by SKU and status
    const summary = {};
    for (const d of detailedList) {
      if (!summary[d.sku]) summary[d.sku] = {};
      summary[d.sku][d.status] = (summary[d.sku][d.status] || 0) + d.qty;
      summary[d.sku]['TOTAL'] = (summary[d.sku]['TOTAL'] || 0) + d.qty;
    }
    console.log('Summary by SKU & Status:', JSON.stringify(summary, null, 2));

    // Check all distinct statuses in SalesOrder table
    const allStatuses = await prisma.salesOrder.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    console.log('All SalesOrder statuses in system:', allStatuses);

    // List any orders with status DRAFT or not INVOICED/DELIVERED
    const nonCompleted = detailedList.filter(d => !['INVOICED', 'DELIVERED'].includes(d.status));
    console.log('\n--- Non-completed orders (DRAFT, CONFIRMED, PENDING, etc.) ---');
    console.table(nonCompleted);

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
check();
