'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'
import {
    getStockCountSessions, createStockCountSession,
    recordCountLine, completeStockCount, adjustStockFromCount
} from '../warehouse/actions'

export { getStockCountSessions, createStockCountSession, recordCountLine, completeStockCount }

export type StockCountRow = {
    id: string; warehouseId: string; warehouseName: string
    zone: string | null; type: string; status: string
    lineCount: number; startedAt: Date | null
    completedAt: Date | null; createdAt: Date
    totalSystemQty: number; totalActualQty: number; totalVariance: number
}

export async function getStockCountList(): Promise<StockCountRow[]> {
    return cached('stock-count:list', async () => {
        const sessions = await prisma.stockCountSession.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                lines: {
                    select: { qtySystem: true, qtyActual: true, variance: true },
                },
            },
        })

        const warehouseIds = [...new Set(sessions.map(s => s.warehouseId))]
        const warehouses = await prisma.warehouse.findMany({
            where: { id: { in: warehouseIds } },
            select: { id: true, name: true },
        })
        const whMap = new Map(warehouses.map(w => [w.id, w.name]))

        return sessions.map(s => ({
            id: s.id,
            warehouseId: s.warehouseId,
            warehouseName: whMap.get(s.warehouseId) ?? '?',
            zone: s.zone,
            type: s.type,
            status: s.status,
            lineCount: s.lines.length,
            startedAt: s.startedAt,
            completedAt: s.completedAt,
            createdAt: s.createdAt,
            totalSystemQty: s.lines.reduce((sum, l) => sum + Number(l.qtySystem), 0),
            totalActualQty: s.lines.reduce((sum, l) => sum + Number(l.qtyActual ?? 0), 0),
            totalVariance: s.lines.reduce((sum, l) => sum + Number(l.variance ?? 0), 0),
        }))
    }) // end cached
}

export async function getStockCountDetail(sessionId: string) {
    const session = await prisma.stockCountSession.findUnique({
        where: { id: sessionId },
        include: { lines: true },
    })
    if (!session) return null

    const warehouse = await prisma.warehouse.findUnique({
        where: { id: session.warehouseId },
        select: { name: true },
    })

    // Join product info manually
    const productIds = [...new Set(session.lines.map(l => l.productId))]
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, skuCode: true, productName: true },
    })
    const pMap = new Map(products.map(p => [p.id, p]))

    return {
        ...session,
        warehouseName: warehouse?.name ?? '?',
        lines: session.lines.map(l => {
            const p = pMap.get(l.productId)
            return {
                id: l.id,
                productId: l.productId,
                skuCode: p?.skuCode ?? '',
                productName: p?.productName ?? '',
                locationCode: l.locationCode,
                qtySystem: Number(l.qtySystem),
                qtyActual: l.qtyActual !== null ? Number(l.qtyActual) : null,
                variance: l.variance !== null ? Number(l.variance) : null,
            }
        }),
    }
}

export async function getCountStats() {
    return cached('stock-count:stats', async () => {
        const [total, inProgress, completed] = await Promise.all([
            prisma.stockCountSession.count(),
            prisma.stockCountSession.count({ where: { status: 'DRAFT' } }),
            prisma.stockCountSession.count({ where: { status: 'COMPLETED' } }),
        ])
        return { total, inProgress, completed }
    }) // end cached
}

export async function startStockCount(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.stockCountSession.update({
            where: { id: sessionId },
            data: { status: 'IN_PROGRESS', startedAt: new Date() },
        })
        revalidateCache('stock-count')
        revalidatePath('/dashboard/stock-count')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getWarehouseOptions() {
    return prisma.warehouse.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
    })
}

/**
 * Phân tích chuỗi Code 128 barcode thành SKU và Vintage
 * Ví dụ: "CH-MARGAUX-2018" -> { sku: "CH-MARGAUX", vintage: 2018 }
 * Ví dụ: "WIN001-NV" -> { sku: "WIN001", vintage: null }
 * Ví dụ: "SKU1024" -> { sku: "SKU1024", vintage: null }
 */
function parseCode128Barcode(barcodeString: string): { sku: string; vintage: number | null } {
    const trimmed = barcodeString.trim()
    if (!trimmed) return { sku: '', vintage: null }

    const lastHyphenIndex = trimmed.lastIndexOf('-')
    if (lastHyphenIndex === -1) {
        return { sku: trimmed, vintage: null }
    }

    const possibleSku = trimmed.substring(0, lastHyphenIndex)
    const possibleVintageStr = trimmed.substring(lastHyphenIndex + 1).trim()

    // Kiểm tra nếu phần đuôi là năm (4 chữ số từ 1900 - 2099)
    if (/^(19|20)\d{2}$/.test(possibleVintageStr)) {
        return { sku: possibleSku, vintage: parseInt(possibleVintageStr, 10) }
    }

    return { sku: trimmed, vintage: null }
}

function formatCasesAndLoose(qty: number, unitsPerCase: number = 6): { cases: number; loose: number; formatted: string } {
    const upc = unitsPerCase > 0 ? unitsPerCase : 6
    const cases = Math.floor(qty / upc)
    const loose = Math.round(qty % upc)

    let formatted = ''
    if (cases > 0 && loose > 0) {
        formatted = `${cases} thùng ${loose} chai lẻ`
    } else if (cases > 0) {
        formatted = `${cases} thùng`
    } else {
        formatted = `${loose} chai lẻ`
    }
    return { cases, loose, formatted }
}



export type VintageSummary = {
    vintage: number | null
    totalQty: number
    casesFormatted: string
    isScannedVintage: boolean
}

export type BarcodeLookupResult = {
    success: boolean
    error?: string
    barcodeRaw?: string
    parsedSku?: string
    parsedVintage?: number | null
    product?: {
        id: string
        skuCode: string
        productName: string
        country: string
        format: string
        unitsPerCase: number
        producerName: string
        barcodeEan: string | null
    }
    totalStockAvailable: number
    totalCasesFormatted: string
    vintagesSummary: VintageSummary[]
    lotsBreakdown: Array<{
        lotNo: string
        warehouseName: string
        locationCode: string
        vintage: number | null
        qtyAvailable: number
        casesFormatted: string
    }>
}

export async function lookupStockByBarcode(rawBarcode: string): Promise<BarcodeLookupResult> {
    try {
        const { sku, vintage } = parseCode128Barcode(rawBarcode)
        const cleanRaw = rawBarcode.trim()

        // Tìm sản phẩm theo SKU tách từ barcode hoặc theo barcodeEan hoặc SKU nguyên bản
        const product = await prisma.product.findFirst({
            where: {
                OR: [
                    { skuCode: { equals: sku, mode: 'insensitive' } },
                    { skuCode: { equals: cleanRaw, mode: 'insensitive' } },
                    { barcodeEan: cleanRaw },
                ],
                deletedAt: null,
            },
            include: {
                producer: { select: { name: true } },
            },
        })

        if (!product) {
            return {
                success: false,
                error: `Không tìm thấy sản phẩm khớp với mã barcode "${rawBarcode}" (SKU: ${sku || cleanRaw})`,
                totalStockAvailable: 0,
                totalCasesFormatted: '0 chai',
                vintagesSummary: [],
                lotsBreakdown: [],
            }
        }

        const unitsPerCase = product.unitsPerCase > 0 ? product.unitsPerCase : 6

        // Truy vấn TẤT CẢ các lô hàng (StockLot) của sản phẩm này (kể cả niên vụ khác)
        const allLots = await prisma.stockLot.findMany({
            where: {
                productId: product.id,
                status: 'AVAILABLE',
            },
            include: {
                location: {
                    include: {
                        warehouse: { select: { name: true } },
                    },
                },
            },
            orderBy: { receivedDate: 'desc' },
        })

        // 1. Nhóm và tính toán tổng tồn kho theo từng Niên Vụ (Vintage)
        const vintageMap = new Map<number | null, number>()
        for (const lot of allLots) {
            const vKey = lot.vintage ?? null
            const current = vintageMap.get(vKey) || 0
            vintageMap.set(vKey, current + Number(lot.qtyAvailable))
        }

        const vintagesSummary: VintageSummary[] = Array.from(vintageMap.entries()).map(([vYear, totalQty]) => {
            const isScanned = vintage !== null ? vYear === vintage : false
            return {
                vintage: vYear,
                totalQty,
                casesFormatted: formatCasesAndLoose(totalQty, unitsPerCase).formatted,
                isScannedVintage: isScanned,
            }
        }).sort((a, b) => (b.vintage ?? 0) - (a.vintage ?? 0))

        // 2. Lọc danh sách lô hàng theo Vintage được quét (nếu có vintage) hoặc tất cả
        const filteredLots = vintage !== null
            ? allLots.filter(l => l.vintage === vintage)
            : allLots

        const totalStockAvailable = filteredLots.reduce((sum, l) => sum + Number(l.qtyAvailable), 0)
        const totalCasesFormatted = formatCasesAndLoose(totalStockAvailable, unitsPerCase).formatted

        const lotsBreakdown = filteredLots.map(l => {
            const qty = Number(l.qtyAvailable)
            return {
                lotNo: l.lotNo,
                warehouseName: l.location?.warehouse?.name ?? 'Kho Không Xác Định',
                locationCode: l.location?.locationCode ?? 'N/A',
                vintage: l.vintage,
                qtyAvailable: qty,
                casesFormatted: formatCasesAndLoose(qty, unitsPerCase).formatted,
            }
        })

        return {
            success: true,
            barcodeRaw: cleanRaw,
            parsedSku: sku,
            parsedVintage: vintage,
            product: {
                id: product.id,
                skuCode: product.skuCode,
                productName: product.productName,
                country: product.country,
                format: product.format,
                unitsPerCase,
                producerName: product.producer?.name ?? '',
                barcodeEan: product.barcodeEan,
            },
            totalStockAvailable,
            totalCasesFormatted,
            vintagesSummary,
            lotsBreakdown,
        }
    } catch (err: any) {
        return {
            success: false,
            error: err.message || 'Lỗi server khi tra cứu tồn kho theo barcode',
            totalStockAvailable: 0,
            totalCasesFormatted: '0 chai',
            vintagesSummary: [],
            lotsBreakdown: [],
        }
    }
}


/**
 * Ghi nhận số lượng đếm thực tế khi quét barcode trong phiên kiểm kê
 */
export async function recordCountByBarcode(
    sessionId: string,
    rawBarcode: string,
    qtyIncrement: number = 1
): Promise<{ success: boolean; error?: string; lineId?: string; qtyActual?: number }> {
    try {
        const lookup = await lookupStockByBarcode(rawBarcode)
        if (!lookup.success || !lookup.product) {
            return { success: false, error: lookup.error || 'Mã barcode không hợp lệ' }
        }

        const session = await prisma.stockCountSession.findUnique({
            where: { id: sessionId },
            include: { lines: true },
        })
        if (!session) return { success: false, error: 'Phiên kiểm kê không tồn tại' }

        if (session.status !== 'IN_PROGRESS') {
            return { success: false, error: 'Phiên kiểm kê phải ở trạng thái "Đang Kiểm" mới có thể nhập số liệu' }
        }

        // Tìm dòng trong phiên đếm trùng productId
        const line = session.lines.find(l => l.productId === lookup.product!.id)
        if (!line) {
            return { success: false, error: `Sản phẩm "${lookup.product.productName}" (${lookup.product.skuCode}) không thuộc phạm vi phiên kiểm kê này` }
        }

        const currentQtyActual = line.qtyActual !== null ? Number(line.qtyActual) : 0
        const newQtyActual = currentQtyActual + qtyIncrement

        const res = await recordCountLine(line.id, newQtyActual)


        if (!res.success) return { success: false, error: res.error }

        revalidateCache('stock-count')
        revalidatePath('/dashboard/stock-count')

        return {
            success: true,
            lineId: line.id,
            qtyActual: newQtyActual,
        }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi ghi nhận kiểm kê qua barcode' }
    }
}

export { adjustStockFromCount }

