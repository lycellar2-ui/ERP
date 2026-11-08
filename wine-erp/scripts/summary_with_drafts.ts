import { prisma } from '../src/lib/db'

async function run() {
  const calabriaCodes = ['L40010', 'L40011', 'L40012', 'L40013', 'L40014']
  const importQty: Record<string, number> = {
    L40010: 600,
    L40011: 600,
    L40012: 300,
    L40013: 300,
    L40014: 300
  }
  const skuNames: Record<string, string> = {
    L40010: 'Calabria The Wall Shiraz',
    L40011: 'Calabria The Wall Chardonnay',
    L40012: 'Calabria Guiding Star Shiraz',
    L40013: 'Calabria Guiding Star Chardonnay',
    L40014: 'Calabria Guiding Star Moscato'
  }

  const lines = await prisma.salesOrderLine.findMany({
    where: {
      product: { skuCode: { in: calabriaCodes } },
      so: { status: { not: 'CANCELLED' } }
    },
    include: {
      so: { include: { customer: true } },
      product: true
    }
  })

  // Structure by SKU
  const report: Record<string, any> = {}
  for (const c of calabriaCodes) {
    report[c] = {
      sku: c,
      name: skuNames[c],
      imported: importQty[c],
      invoiced: 0,
      delivered: 0,
      pendingAccounting: 0,
      confirmed: 0,
      draft: 0,
      totalWithDraft: 0,
      totalWithoutDraft: 0
    }
  }

  for (const l of lines) {
    const sku = l.product.skuCode
    const qty = Number(l.qtyOrdered)
    const st = l.so.status
    if (st === 'INVOICED') report[sku].invoiced += qty
    else if (st === 'DELIVERED') report[sku].delivered += qty
    else if (st === 'PENDING_ACCOUNTING') report[sku].pendingAccounting += qty
    else if (st === 'CONFIRMED') report[sku].confirmed += qty
    else if (st === 'DRAFT') report[sku].draft += qty

    if (st === 'DRAFT') {
      report[sku].totalWithDraft += qty
    } else {
      report[sku].totalWithDraft += qty
      report[sku].totalWithoutDraft += qty
    }
  }

  console.log('=== SUMMARY TABLE (UP TO 15/10/2026) ===')
  console.table(Object.values(report).map(r => ({
    SKU: r.sku,
    'Tên Rượu': r.name,
    'Nhập': r.imported,
    'Đã xong (Inv+Del)': r.invoiced + r.delivered,
    'Chờ duyệt/giao (Pending+Conf)': r.pendingAccounting + r.confirmed,
    'ĐƠN NHÁP (Draft)': r.draft,
    'TỔNG CẢ NHÁP': r.totalWithDraft,
    '% Đã ra hàng (gồm nháp)': `${((r.totalWithDraft / r.imported) * 100).toFixed(1)}%`,
    'Tồn kho còn lại (trừ cả nháp)': r.imported - r.totalWithDraft
  })))

  await prisma.$disconnect()
}
run()
