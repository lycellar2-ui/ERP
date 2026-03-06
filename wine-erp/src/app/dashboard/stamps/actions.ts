'use server'

import { prisma } from '@/lib/db'
import { cached, revalidateCache } from '@/lib/cache'

export async function getStampPurchases() {
    return prisma.wineStampPurchase.findMany({
        include: {
            usages: {
                select: {
                    id: true,
                    qtyUsed: true,
                    qtyDamaged: true,
                    usedAt: true,
                    shipmentId: true,
                    lotId: true,
                    notes: true,
                },
            },
        },
        orderBy: { purchaseDate: 'desc' },
    })
}

export async function createStampPurchase(data: {
    purchaseDate: string
    stampType: 'UNDER_20_ABV' | 'OVER_20_ABV'
    symbol: string
    serialStart: string
    serialEnd: string
    totalQty: number
}) {
    return prisma.wineStampPurchase.create({
        data: {
            purchaseDate: new Date(data.purchaseDate),
            stampType: data.stampType,
            symbol: data.symbol,
            serialStart: data.serialStart,
            serialEnd: data.serialEnd,
            totalQty: data.totalQty,
            usedQty: 0,
            status: 'ACTIVE',
        },
    })
}

export async function recordStampUsage(data: {
    purchaseId: string
    shipmentId?: string
    lotId?: string
    qtyUsed: number
    qtyDamaged: number
    reportedBy: string
    notes?: string
}) {
    // CONSTRAINT: Không được dán lố tem
    const purchase = await prisma.wineStampPurchase.findUnique({
        where: { id: data.purchaseId },
    })

    if (!purchase) {
        throw new Error('Không tìm thấy lô tem.')
    }

    const totalAfter = purchase.usedQty + data.qtyUsed + data.qtyDamaged
    if (totalAfter > purchase.totalQty) {
        throw new Error(
            `Vượt quá số lượng tem khả dụng! Tồn kho tem: ${purchase.totalQty - purchase.usedQty}, yêu cầu: ${data.qtyUsed + data.qtyDamaged}`
        )
    }

    // Transaction: tạo usage + cập nhật usedQty
    return prisma.$transaction(async (tx) => {
        const usage = await tx.wineStampUsage.create({
            data: {
                purchaseId: data.purchaseId,
                shipmentId: data.shipmentId || null,
                lotId: data.lotId || null,
                qtyUsed: data.qtyUsed,
                qtyDamaged: data.qtyDamaged,
                reportedBy: data.reportedBy,
                notes: data.notes || null,
            },
        })

        const newUsedQty = purchase.usedQty + data.qtyUsed + data.qtyDamaged
        await tx.wineStampPurchase.update({
            where: { id: data.purchaseId },
            data: {
                usedQty: newUsedQty,
                status: newUsedQty >= purchase.totalQty ? 'EXHAUSTED' : 'ACTIVE',
            },
        })

        return usage
    })
}

export async function getStampSummary() {
    return cached('stamps:summary', async () => {
        const purchases = await prisma.wineStampPurchase.findMany()

        const under20 = purchases.filter((p) => p.stampType === 'UNDER_20_ABV')
        const over20 = purchases.filter((p) => p.stampType === 'OVER_20_ABV')

        const sum = (items: typeof purchases) => ({
            total: items.reduce((s, p) => s + p.totalQty, 0),
            used: items.reduce((s, p) => s + p.usedQty, 0),
            remaining: items.reduce((s, p) => s + (p.totalQty - p.usedQty), 0),
            activeBatches: items.filter((p) => p.status === 'ACTIVE').length,
        })

        return {
            under20: sum(under20),
            over20: sum(over20),
            all: sum(purchases),
        }
    }) // end cached
}

// ── Stamp Linking Options ─────────────────────────
export async function getStampLinkingOptions() {
    const [shipments, lots] = await Promise.all([
        prisma.shipment.findMany({
            where: { status: { not: 'DELIVERED_TO_WAREHOUSE' } },
            select: { id: true, billOfLading: true, status: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
        }),
        prisma.stockLot.findMany({
            where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
            select: {
                id: true, lotNo: true,
                product: { select: { skuCode: true, productName: true } },
            },
            orderBy: { receivedDate: 'desc' },
            take: 100,
        }),
    ])
    return { shipments, lots }
}

// ── Safe Record Stamp Usage ───────────────────────
import { revalidatePath } from 'next/cache'

export async function safeRecordStampUsage(data: {
    purchaseId: string
    shipmentId?: string
    lotId?: string
    qtyUsed: number
    qtyDamaged: number
    reportedBy: string
    notes?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await recordStampUsage(data)
        revalidateCache('stamps')
        revalidatePath('/dashboard/stamps')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Stamp Report Data (Quarterly/Annual) ──────────
export async function getStampReportData(filters: {
    year: number
    quarter?: number // 1-4, if omitted → full year
} = { year: new Date().getFullYear() }) {
    const { year, quarter } = filters
    let startDate: Date, endDate: Date

    if (quarter) {
        const startMonth = (quarter - 1) * 3
        startDate = new Date(year, startMonth, 1)
        endDate = new Date(year, startMonth + 3, 0, 23, 59, 59)
    } else {
        startDate = new Date(year, 0, 1)
        endDate = new Date(year, 11, 31, 23, 59, 59)
    }

    const purchases = await prisma.wineStampPurchase.findMany({
        where: {
            purchaseDate: { gte: startDate, lte: endDate },
        },
        include: {
            usages: {
                select: {
                    id: true, qtyUsed: true, qtyDamaged: true, usedAt: true,
                    shipmentId: true, lotId: true, notes: true, reportedBy: true,
                },
            },
        },
        orderBy: { purchaseDate: 'asc' },
    })

    const rows = purchases.map(p => {
        const totalUsed = p.usages.reduce((s, u) => s + u.qtyUsed, 0)
        const totalDamaged = p.usages.reduce((s, u) => s + u.qtyDamaged, 0)
        return {
            symbol: p.symbol,
            stampType: p.stampType === 'UNDER_20_ABV' ? 'Dưới 20°' : 'Trên 20°',
            serialStart: p.serialStart,
            serialEnd: p.serialEnd,
            purchaseDate: p.purchaseDate,
            totalQty: p.totalQty,
            qtyUsed: totalUsed,
            qtyDamaged: totalDamaged,
            qtyRemaining: p.totalQty - totalUsed - totalDamaged,
            status: p.status,
            usageCount: p.usages.length,
        }
    })

    const summary = {
        period: quarter ? `Q${quarter}/${year}` : `Năm ${year}`,
        totalPurchased: rows.reduce((s, r) => s + r.totalQty, 0),
        totalUsed: rows.reduce((s, r) => s + r.qtyUsed, 0),
        totalDamaged: rows.reduce((s, r) => s + r.qtyDamaged, 0),
        totalRemaining: rows.reduce((s, r) => s + r.qtyRemaining, 0),
        batchCount: rows.length,
    }

    return { rows, summary }
}

// ── Export Stamp Report Excel ─────────────────────
export async function exportStampReportExcel(filters: {
    year: number
    quarter?: number
}): Promise<{ success: boolean; base64?: string; filename?: string; error?: string }> {
    try {
        const ExcelJS = (await import('exceljs')).default
        const { rows, summary } = await getStampReportData(filters)

        const wb = new ExcelJS.Workbook()
        wb.creator = 'Wine ERP - LYS Cellars'
        const ws = wb.addWorksheet('Báo Cáo Tem Rượu')

        // Header
        ws.mergeCells('A1:I1')
        const titleCell = ws.getCell('A1')
        titleCell.value = 'CÔNG TY CỔ PHẦN LYS CELLARS'
        titleCell.font = { bold: true, size: 14 }
        titleCell.alignment = { horizontal: 'center' }

        ws.mergeCells('A2:I2')
        const subtitleCell = ws.getCell('A2')
        subtitleCell.value = `BÁO CÁO SỬ DỤNG TEM RƯỢU NHẬP KHẨU — ${summary.period}`
        subtitleCell.font = { bold: true, size: 12 }
        subtitleCell.alignment = { horizontal: 'center' }

        ws.addRow([])

        // Summary
        ws.addRow(['Kỳ báo cáo:', summary.period])
        ws.addRow(['Tổng tem mua:', summary.totalPurchased])
        ws.addRow(['Tổng tem đã sử dụng:', summary.totalUsed])
        ws.addRow(['Tổng tem hỏng:', summary.totalDamaged])
        ws.addRow(['Tổng tem còn lại:', summary.totalRemaining])
        ws.addRow(['Số lô tem:', summary.batchCount])
        ws.addRow([])

        // Table headers
        const headerRow = ws.addRow([
            'STT', 'Ký Hiệu', 'Loại Tem', 'Serial Đầu', 'Serial Cuối',
            'Ngày Mua', 'Tổng SL', 'Đã Dùng', 'Hỏng', 'Còn Lại', 'Trạng Thái',
        ])
        headerRow.eachCell(c => {
            c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A4355' } }
            c.alignment = { horizontal: 'center' }
            c.border = {
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' },
            }
        })

        rows.forEach((r, i) => {
            const row = ws.addRow([
                i + 1, r.symbol, r.stampType, r.serialStart, r.serialEnd,
                new Date(r.purchaseDate).toLocaleDateString('vi-VN'),
                r.totalQty, r.qtyUsed, r.qtyDamaged, r.qtyRemaining,
                r.status === 'ACTIVE' ? 'Đang dùng' : r.status === 'EXHAUSTED' ? 'Đã hết' : r.status,
            ])
            row.eachCell(c => {
                c.border = {
                    top: { style: 'thin' }, bottom: { style: 'thin' },
                    left: { style: 'thin' }, right: { style: 'thin' },
                }
            })
                // Number format
                ;[7, 8, 9, 10].forEach(col => {
                    row.getCell(col).numFmt = '#,##0'
                    row.getCell(col).alignment = { horizontal: 'right' }
                })
        })

        // Auto column width
        ws.columns.forEach(col => {
            col.width = 16
        })
        ws.getColumn(1).width = 6

        const buffer = await wb.xlsx.writeBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const filename = `bao-cao-tem-ruou-${summary.period.replace('/', '-')}.xlsx`

        return { success: true, base64, filename }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// STAMP DESTRUCTION RECORD (Biên Bản Hủy Tem)
// ═══════════════════════════════════════════════════

export type StampDestructionRecord = {
    id: string
    purchaseId: string
    purchaseSymbol: string
    qtyDestroyed: number
    reason: string
    witnessName: string
    destructionDate: Date
    notes: string | null
    createdAt: Date
}

export async function createStampDestruction(data: {
    purchaseId: string
    qtyDestroyed: number
    reason: string
    witnessName: string
    destructionDate: string
    notes?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const purchase = await prisma.wineStampPurchase.findUnique({
            where: { id: data.purchaseId },
        })
        if (!purchase) return { success: false, error: 'Lô tem không tồn tại' }

        const remaining = purchase.totalQty - purchase.usedQty
        if (data.qtyDestroyed > remaining) {
            return { success: false, error: `Số lượng hủy (${data.qtyDestroyed}) vượt quá tồn kho tem (${remaining})` }
        }

        if (!data.reason.trim()) {
            return { success: false, error: 'Lý do hủy tem là bắt buộc' }
        }
        if (!data.witnessName.trim()) {
            return { success: false, error: 'Người chứng kiến là bắt buộc' }
        }

        await prisma.$transaction(async (tx) => {
            // Record the destruction as a special usage with qtyDamaged
            await tx.wineStampUsage.create({
                data: {
                    purchaseId: data.purchaseId,
                    qtyUsed: 0,
                    qtyDamaged: data.qtyDestroyed,
                    reportedBy: data.witnessName,
                    notes: `[HỦY TEM] ${data.reason}${data.notes ? ` — ${data.notes}` : ''} | Ngày: ${data.destructionDate} | Chứng kiến: ${data.witnessName}`,
                },
            })

            // Update purchase quantities
            const newUsedQty = purchase.usedQty + data.qtyDestroyed
            await tx.wineStampPurchase.update({
                where: { id: data.purchaseId },
                data: {
                    usedQty: newUsedQty,
                    status: newUsedQty >= purchase.totalQty ? 'EXHAUSTED' : 'ACTIVE',
                },
            })
        })

        revalidateCache('stamps')
        revalidatePath('/dashboard/stamps')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// Get destruction history
export async function getStampDestructions(): Promise<StampDestructionRecord[]> {
    const usages = await prisma.wineStampUsage.findMany({
        where: {
            notes: { startsWith: '[HỦY TEM]' },
        },
        include: {
            purchase: { select: { symbol: true } },
        },
        orderBy: { usedAt: 'desc' },
    })

    return usages.map(u => ({
        id: u.id,
        purchaseId: u.purchaseId,
        purchaseSymbol: u.purchase.symbol,
        qtyDestroyed: u.qtyDamaged,
        reason: (u.notes ?? '').replace('[HỦY TEM] ', '').split(' | ')[0],
        witnessName: u.reportedBy,
        destructionDate: u.usedAt,
        notes: u.notes,
        createdAt: u.usedAt,
    }))
}

// ═══════════════════════════════════════════════════
// STAMP OVERUSE ALERTS
// ═══════════════════════════════════════════════════

export type StampAlert = {
    id: string
    symbol: string
    stampType: string
    severity: 'WARNING' | 'CRITICAL'
    message: string
    usagePct: number
    damagedPct: number
    totalQty: number
    usedQty: number
    remaining: number
}

export async function getStampAlerts(): Promise<StampAlert[]> {
    return cached('stamps:alerts', async () => {
        const purchases = await prisma.wineStampPurchase.findMany({
            where: { status: 'ACTIVE' },
            include: {
                usages: { select: { qtyUsed: true, qtyDamaged: true } },
            },
        })

        const alerts: StampAlert[] = []

        for (const p of purchases) {
            const totalUsed = p.usages.reduce((s, u) => s + u.qtyUsed, 0)
            const totalDamaged = p.usages.reduce((s, u) => s + u.qtyDamaged, 0)
            const remaining = p.totalQty - p.usedQty
            const usagePct = p.totalQty > 0 ? (p.usedQty / p.totalQty) * 100 : 0
            const damagedPct = p.totalQty > 0 ? (totalDamaged / p.totalQty) * 100 : 0

            // Alert: Usage > 85% — running low
            if (usagePct > 85) {
                alerts.push({
                    id: `${p.id}-low`,
                    symbol: p.symbol,
                    stampType: p.stampType === 'UNDER_20_ABV' ? 'Dưới 20°' : 'Trên 20°',
                    severity: usagePct > 95 ? 'CRITICAL' : 'WARNING',
                    message: usagePct > 95
                        ? `Lô tem ${p.symbol} sắp hết! Chỉ còn ${remaining} tem (${Math.round(100 - usagePct)}%)`
                        : `Lô tem ${p.symbol} đã sử dụng ${Math.round(usagePct)}% — cần đặt thêm`,
                    usagePct: Math.round(usagePct * 10) / 10,
                    damagedPct: Math.round(damagedPct * 10) / 10,
                    totalQty: p.totalQty,
                    usedQty: p.usedQty,
                    remaining,
                })
            }

            // Alert: Damaged > 5% — abnormal damage rate
            if (damagedPct > 5 && totalDamaged > 2) {
                alerts.push({
                    id: `${p.id}-dmg`,
                    symbol: p.symbol,
                    stampType: p.stampType === 'UNDER_20_ABV' ? 'Dưới 20°' : 'Trên 20°',
                    severity: damagedPct > 10 ? 'CRITICAL' : 'WARNING',
                    message: `Lô tem ${p.symbol} có tỷ lệ hỏng bất thường: ${Math.round(damagedPct)}% (${totalDamaged}/${p.totalQty})`,
                    usagePct: Math.round(usagePct * 10) / 10,
                    damagedPct: Math.round(damagedPct * 10) / 10,
                    totalQty: p.totalQty,
                    usedQty: p.usedQty,
                    remaining,
                })
            }
        }

        return alerts.sort((a, b) => (a.severity === 'CRITICAL' ? -1 : 1) - (b.severity === 'CRITICAL' ? -1 : 1))
    }, 60_000) // 1 min cache
}
