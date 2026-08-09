'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'
import { getCurrentUser } from '@/lib/session'
import { serialize } from '@/lib/serialize'
import {
    getStockCountSessions, createStockCountSession,
    recordCountLine, completeStockCount, adjustStockFromCount
} from '../warehouse/actions'

export { getStockCountSessions, createStockCountSession, recordCountLine, completeStockCount, adjustStockFromCount }

export type StockCountRow = {
    id: string
    sessionNo: string
    title: string
    warehouseId: string
    warehouseName: string
    zone: string | null
    type: string
    scopeType: string
    isBlindCount: boolean
    status: string
    assignedToId: string | null
    assignedToName: string | null
    lineCount: number
    startedAt: Date | null
    completedAt: Date | null
    createdAt: Date
    totalSystemQty: number
    totalActualQty: number
    totalVariance: number
    hasSignatures: boolean
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
                assignedTo: { select: { id: true, name: true } },
                warehouse: { select: { id: true, name: true } }
            },
        })

        return sessions.map(s => {
            const sysQty = s.lines.reduce((sum, l) => sum + Number(l.qtySystem), 0)
            const actQty = s.lines.reduce((sum, l) => sum + Number(l.qtyActual ?? 0), 0)
            const varQty = s.lines.reduce((sum, l) => sum + Number(l.variance ?? 0), 0)
            const sessionNoStr = s.sessionNo || `SC-${s.id.slice(-6).toUpperCase()}`
            const titleStr = s.title || `Kiểm kê kho ${s.warehouse?.name ?? ''}`

            return {
                id: s.id,
                sessionNo: sessionNoStr,
                title: titleStr,
                warehouseId: s.warehouseId,
                warehouseName: s.warehouse?.name ?? '?',
                zone: s.zone,
                type: s.type,
                scopeType: s.scopeType || 'FULL_WAREHOUSE',
                isBlindCount: Boolean(s.isBlindCount),
                status: s.status,
                assignedToId: s.assignedToId,
                assignedToName: s.assignedTo?.name ?? null,
                lineCount: s.lines.length,
                startedAt: s.startedAt,
                completedAt: s.completedAt,
                createdAt: s.createdAt,
                totalSystemQty: sysQty,
                totalActualQty: actQty,
                totalVariance: varQty,
                hasSignatures: Boolean(s.counterSignature || s.managerSignature || s.accountantSignature)
            }
        })
    })
}

export async function getStockCountDetail(sessionId: string) {
    const session = await prisma.stockCountSession.findUnique({
        where: { id: sessionId },
        include: {
            lines: {
                include: {
                    product: {
                        select: {
                            id: true,
                            skuCode: true,
                            productName: true,
                            unitsPerCase: true,
                            country: true,
                            format: true
                        }
                    },
                    location: {
                        select: {
                            id: true,
                            locationCode: true,
                            zone: true
                        }
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            },
            warehouse: { select: { id: true, name: true, code: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true } }
        },
    })

    if (!session) return null

    const s = session as any
    // Compute unit costs and vintages from StockLot
    const productIds: string[] = Array.from(new Set(s.lines.map((l: any) => l.productId)))
    const lots = await prisma.stockLot.findMany({
        where: { productId: { in: productIds } },
        select: { productId: true, unitLandedCost: true, vintage: true }
    })

    const lotInfoMap = new Map<string, { unitCost: number; vintage: number | null }>()
    for (const lot of lots) {
        if (!lotInfoMap.has(lot.productId)) {
            lotInfoMap.set(lot.productId, {
                unitCost: Number(lot.unitLandedCost) || 0,
                vintage: lot.vintage ?? null,
            })
        }
    }

    const sessionNoStr = s.sessionNo || `SC-${s.id.slice(-6).toUpperCase()}`
    const titleStr = s.title || `Kiểm kê kho ${s.warehouse?.name ?? ''}`

    const formattedLines = s.lines.map((l: any) => {
        const sysQty = Number(l.qtySystem)
        const actQty = l.qtyActual !== null ? Number(l.qtyActual) : null
        const varQty = l.variance !== null ? Number(l.variance) : null
        const info = lotInfoMap.get(l.productId)
        const unitCost = info?.unitCost || 0
        const vintage = (l as any).vintage ?? info?.vintage ?? null
        const varianceValueVND = varQty !== null ? varQty * unitCost : 0

        return {
            id: l.id,
            productId: l.productId,
            skuCode: l.product?.skuCode ?? '',
            productName: l.product?.productName ?? '',
            unitsPerCase: l.product?.unitsPerCase ?? 6,
            vintage,
            locationId: l.locationId,
            locationCode: l.locationCode || l.location?.locationCode || 'N/A',
            zone: l.location?.zone || l.locationCode || 'Khu vực chung',
            qtySystem: sysQty,
            qtyActual: actQty,
            variance: varQty,
            varianceReason: l.varianceReason || null,
            photoUrl: l.photoUrl || null,
            unitCost,
            varianceValueVND,
            countedAt: l.countedAt || null,
            notes: l.notes || null,
            assignedToId: l.assignedToId || null,
            assignedToName: l.assignedTo?.name || null,
        }
    })

    return serialize({
        ...session,
        sessionNo: sessionNoStr,
        title: titleStr,
        warehouseName: session.warehouse?.name ?? '?',
        warehouseCode: session.warehouse?.code ?? 'WH',
        lines: formattedLines,
    })
}

export async function getCountStats() {
    return cached('stock-count:stats', async () => {
        const currentUser = await getCurrentUser()
        const [total, draft, inProgress, completed, assignedToMe] = await Promise.all([
            prisma.stockCountSession.count(),
            prisma.stockCountSession.count({ where: { status: 'DRAFT' } }),
            prisma.stockCountSession.count({ where: { status: 'IN_PROGRESS' } }),
            prisma.stockCountSession.count({ where: { status: { in: ['COMPLETED', 'APPROVED'] } } }),
            currentUser ? prisma.stockCountSession.count({ where: { assignedToId: currentUser.id, status: { in: ['DRAFT', 'IN_PROGRESS'] } } }) : 0
        ])
        return { total, draft, inProgress, completed, assignedToMe }
    })
}

export async function getStaffUserOptions() {
    const users = await prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' }
    })
    return serialize(users)
}

export async function getTransactedProducts(warehouseId: string, days: number = 30) {
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)

    // GR, DO lines in last N days
    const [grLines, doLines] = await Promise.all([
        prisma.goodsReceiptLine.findMany({
            where: { gr: { warehouseId, createdAt: { gte: fromDate } } },
            select: { productId: true }
        }),
        prisma.deliveryOrderLine.findMany({
            where: { do: { warehouseId, createdAt: { gte: fromDate } } },
            select: { productId: true }
        })
    ])

    const pIds = Array.from(new Set([...grLines.map(l => l.productId), ...doLines.map(l => l.productId)]))
    const products = await prisma.product.findMany({
        where: { id: { in: pIds } },
        select: { id: true, skuCode: true, productName: true }
    })

    return serialize(products)
}

export async function createStockCountSessionExtended(input: {
    warehouseId: string
    title?: string
    scopeType: 'FULL_WAREHOUSE' | 'CYCLE_COUNT' | 'TRANSACTED_ITEMS' | 'SPOT_COUNT'
    type?: 'FULL' | 'CYCLE' | 'SPOT'
    isBlindCount?: boolean
    assignedToId?: string
    selectedZone?: string
    selectedWineType?: string
    transactedDays?: number
    selectedProductIds?: string[]
    selectedLocationIds?: string[]
}): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
        const currentUser = await getCurrentUser()
        const wh = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } })
        if (!wh) return { success: false, error: 'Kho hàng không tồn tại' }

        // Generate sessionNo: e.g. KK-GVM-20260808-001
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const countToday = await prisma.stockCountSession.count({
            where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
        })
        const sessionNo = `KK-${wh.code}-${dateStr}-${String(countToday + 1).padStart(2, '0')}`
        const title = input.title || `Kiểm kê ${input.scopeType === 'FULL_WAREHOUSE' ? 'Tổng thể' : input.scopeType === 'SPOT_COUNT' ? 'Đột xuất' : 'Chu kỳ'} - ${wh.name}`

        // Filter locations/lots
        let locationWhere: any = { warehouseId: input.warehouseId }
        if (input.selectedZone) {
            locationWhere.zone = input.selectedZone
        }
        if (input.selectedLocationIds && input.selectedLocationIds.length > 0) {
            locationWhere.id = { in: input.selectedLocationIds }
        }

        let productFilterWhere: any = {}
        if (input.selectedWineType) {
            productFilterWhere.wineType = input.selectedWineType
        }
        if (input.selectedProductIds && input.selectedProductIds.length > 0) {
            productFilterWhere.id = { in: input.selectedProductIds }
        }

        // Handle TRANSACTED_ITEMS scope
        if (input.scopeType === 'TRANSACTED_ITEMS') {
            const days = input.transactedDays || 30
            const transactedProds = await getTransactedProducts(input.warehouseId, days)
            const tIds = transactedProds.map((p: any) => p.id)
            if (tIds.length === 0) {
                return { success: false, error: `Không có mã hàng nào phát sinh giao dịch trong ${days} ngày gần nhất tại kho này.` }
            }
            productFilterWhere.id = { in: tIds }
        }

        // Fetch locations and stock lots
        const locations = await prisma.location.findMany({
            where: locationWhere,
            select: {
                id: true,
                locationCode: true,
                zone: true,
                stockLots: {
                    where: {
                        status: 'AVAILABLE',
                        qtyAvailable: { gt: 0 },
                        product: productFilterWhere
                    },
                    select: {
                        productId: true,
                        qtyAvailable: true
                    }
                }
            }
        })

        // Map location/product lines
        const linesToCreate: Array<{ productId: string; locationId: string; locationCode: string; qtySystem: number }> = []

        for (const loc of locations) {
            for (const lot of loc.stockLots) {
                linesToCreate.push({
                    productId: lot.productId,
                    locationId: loc.id,
                    locationCode: loc.locationCode,
                    qtySystem: Number(lot.qtyAvailable)
                })
            }
        }

        if (linesToCreate.length === 0) {
            return { success: false, error: 'Không tìm thấy tồn kho phù hợp với điều kiện kiểm kê đã chọn.' }
        }

        const countTypeEnum: any = input.scopeType === 'FULL_WAREHOUSE' ? 'FULL_PHYSICAL' : input.scopeType === 'SPOT_COUNT' ? 'SPOT' : 'CYCLE'

        const session = await prisma.stockCountSession.create({
            data: {
                sessionNo,
                title,
                warehouseId: input.warehouseId,
                zone: input.selectedZone || null,
                type: countTypeEnum,
                scopeType: input.scopeType,
                isBlindCount: Boolean(input.isBlindCount),
                status: 'DRAFT',
                assignedToId: input.assignedToId || null,
                createdById: currentUser?.id || null,
                lines: {
                    create: linesToCreate.map(l => ({
                        productId: l.productId,
                        locationId: l.locationId,
                        locationCode: l.locationCode,
                        qtySystem: l.qtySystem
                    }))
                }
            }
        })

        revalidateCache('stock-count')
        revalidatePath('/dashboard/stock-count')

        return { success: true, sessionId: session.id }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi tạo phiên kiểm kê' }
    }
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

export async function recordMobileCountLine(input: {
    lineId: string
    qtyActual: number
    varianceReason?: string
    photoUrl?: string
    notes?: string
}): Promise<{ success: boolean; variance?: number; error?: string }> {
    try {
        const line = await prisma.stockCountLine.findUnique({
            where: { id: input.lineId },
            select: { qtySystem: true, sessionId: true }
        })
        if (!line) return { success: false, error: 'Không tìm thấy dòng kiểm kê' }

        const qtySys = Number(line.qtySystem)
        const variance = input.qtyActual - qtySys

        await prisma.stockCountLine.update({
            where: { id: input.lineId },
            data: {
                qtyActual: input.qtyActual,
                variance,
                varianceReason: input.varianceReason || null,
                photoUrl: input.photoUrl || null,
                notes: input.notes || null,
                countedAt: new Date()
            }
        })

        revalidateCache('stock-count')
        revalidatePath(`/dashboard/stock-count`)
        return { success: true, variance }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi ghi nhận kiểm kê' }
    }
}

export async function saveStockCountSignatures(input: {
    sessionId: string
    counterSignature?: string
    managerSignature?: string
    accountantSignature?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const updateData: any = {}
        if (input.counterSignature) updateData.counterSignature = input.counterSignature
        if (input.managerSignature) updateData.managerSignature = input.managerSignature
        if (input.accountantSignature) updateData.accountantSignature = input.accountantSignature

        await prisma.stockCountSession.update({
            where: { id: input.sessionId },
            data: updateData
        })

        revalidateCache('stock-count')
        revalidatePath('/dashboard/stock-count')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi lưu chữ ký' }
    }
}

export async function approveAndCreateAdjustment(sessionId: string): Promise<{ success: boolean; error?: string; adjustmentNo?: string }> {
    try {
        const session = await prisma.stockCountSession.findUnique({
            where: { id: sessionId },
            include: {
                lines: true,
                warehouse: true
            }
        })

        if (!session) return { success: false, error: 'Không tìm thấy phiên kiểm kê' }
        if (session.status === 'APPROVED') return { success: false, error: 'Phiên kiểm kê đã được duyệt trước đó' }

        // Update session status
        const adjustmentNo = `ADJ-${session.sessionNo || session.id.slice(-6).toUpperCase()}`

        await prisma.$transaction(async (tx) => {
            // Update stock lots for lines with variance
            for (const line of session.lines) {
                if (line.qtyActual !== null && Number(line.variance) !== 0) {
                    const varianceVal = Number(line.variance)

                    // Find primary stock lot in this location
                    const targetLot = await tx.stockLot.findFirst({
                        where: {
                            productId: line.productId,
                            location: { warehouseId: session.warehouseId },
                            status: 'AVAILABLE'
                        }
                    })

                    if (targetLot) {
                        const newQty = Math.max(0, Number(targetLot.qtyAvailable) + varianceVal)
                        await tx.stockLot.update({
                            where: { id: targetLot.id },
                            data: {
                                qtyAvailable: newQty,
                                status: newQty === 0 ? 'CONSUMED' : 'AVAILABLE'
                            }
                        })
                    }
                }
            }

            await tx.stockCountSession.update({
                where: { id: sessionId },
                data: {
                    status: 'APPROVED',
                    completedAt: session.completedAt || new Date(),
                    adjustmentVoucherId: adjustmentNo
                }
            })
        })

        revalidateCache('stock-count')
        revalidateCache('wms')
        revalidatePath('/dashboard/stock-count')
        revalidatePath('/dashboard/warehouse')

        return { success: true, adjustmentNo }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi phê duyệt kiểm kê' }
    }
}

export async function getWarehouseOptions() {
    return prisma.warehouse.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
    })
}

export async function getWarehouseLocationOptions(warehouseId: string) {
    const locations = await prisma.location.findMany({
        where: { warehouseId },
        select: { id: true, locationCode: true, zone: true },
        orderBy: { locationCode: 'asc' }
    })
    return serialize(locations)
}

function parseCode128Barcode(barcodeString: string): { sku: string; vintage: number | null } {
    const trimmed = barcodeString.trim()
    if (!trimmed) return { sku: '', vintage: null }

    const lastHyphenIndex = trimmed.lastIndexOf('-')
    if (lastHyphenIndex === -1) {
        return { sku: trimmed, vintage: null }
    }

    const possibleSku = trimmed.substring(0, lastHyphenIndex)
    const possibleVintageStr = trimmed.substring(lastHyphenIndex + 1).trim()

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

export async function assignStaffToZones(
    sessionId: string,
    zoneAssignments: { zone: string; assignedToId: string | null }[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await prisma.stockCountSession.findUnique({
            where: { id: sessionId },
            include: { lines: { include: { location: true } } }
        })
        if (!session) return { success: false, error: 'Không tìm thấy phiên kiểm kê' }

        for (const assign of zoneAssignments) {
            const lineIds = session.lines
                .filter(l => (l.location?.zone || l.locationCode || 'Khu vực chung') === assign.zone)
                .map(l => l.id)

            if (lineIds.length > 0) {
                await (prisma.stockCountLine as any).updateMany({
                    where: { id: { in: lineIds } },
                    data: { assignedToId: assign.assignedToId }
                })
            }
        }

        revalidateCache('stock-count')
        revalidatePath('/dashboard/stock-count')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi phân công nhân sự kiểm kê' }
    }
}

export async function completeZoneCount(
    sessionId: string,
    zoneName: string
): Promise<{ success: boolean; summary?: any; error?: string }> {
    try {
        const session = await prisma.stockCountSession.findUnique({
            where: { id: sessionId },
            include: {
                lines: {
                    include: {
                        product: { select: { skuCode: true, productName: true, unitsPerCase: true } },
                        location: true
                    }
                }
            }
        })
        if (!session) return { success: false, error: 'Không tìm thấy phiên kiểm kê' }

        const zoneLines = session.lines.filter(l => (l.location?.zone || l.locationCode || 'Khu vực chung') === zoneName)
        const totalItems = zoneLines.length
        const countedItems = zoneLines.filter(l => l.qtyActual !== null)
        const matchedItems = zoneLines.filter(l => l.qtyActual !== null && Number(l.variance) === 0)
        const overItems = zoneLines.filter(l => l.variance !== null && Number(l.variance) > 0)
        const underItems = zoneLines.filter(l => l.variance !== null && Number(l.variance) < 0)
        const uncountedItems = zoneLines.filter(l => l.qtyActual === null)

        const varianceLines = zoneLines
            .filter(l => l.variance !== null && Number(l.variance) !== 0)
            .map(l => ({
                id: l.id,
                skuCode: l.product?.skuCode ?? '',
                productName: l.product?.productName ?? '',
                qtySystem: Number(l.qtySystem),
                qtyActual: Number(l.qtyActual ?? 0),
                variance: Number(l.variance),
                varianceReason: l.varianceReason,
                unitsPerCase: l.product?.unitsPerCase ?? 6
            }))

        return serialize({
            success: true,
            summary: {
                zoneName,
                totalItems,
                countedCount: countedItems.length,
                matchedCount: matchedItems.length,
                overCount: overItems.length,
                underCount: underItems.length,
                uncountedCount: uncountedItems.length,
                varianceLines
            }
        })
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi chốt kiểm kê khu vực' }
    }
}
