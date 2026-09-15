'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'
import { requireAuth, hasRole } from '@/lib/session'
import { parseDateWithCurrentTime } from '@/lib/utils'

export type TransferOrderRow = {
    id: string
    transferNo: string
    fromWarehouse: string
    fromWarehouseCode: string
    fromWarehouseId: string
    toWarehouse: string
    toWarehouseCode: string
    toWarehouseId: string
    status: string
    notes: string | null
    requesterName: string
    transferDate: Date
    accountingApprovedAt: Date | null
    accountingNotes: string | null
    lineCount: number
    totalQty: number
    createdAt: Date
}

export type TransferOrderDetail = {
    id: string
    transferNo: string
    fromWarehouse: string
    fromWarehouseCode: string
    fromWarehouseId: string
    toWarehouse: string
    toWarehouseCode: string
    toWarehouseId: string
    status: string
    notes: string | null
    transferDate: Date
    requesterName: string
    requesterId: string | null
    accountingApprovedBy: string | null
    accountingApprovedAt: Date | null
    accountingNotes: string | null
    confirmedAt: Date | null
    receivedAt: Date | null
    createdAt: Date
    lines: {
        id: string
        productId: string
        productName: string
        skuCode: string
        vintage: number | null
        country: string | null
        qtyTransferred: number
        qtyReceived: number
        qtyAvailableFromWH: number
        availableVintages?: { vintage: number | null; qtyAvailable: number }[]
        vintageAvailableStock?: number
        unitCost: number
        totalValue: number
    }[]
    fromWarehouseEntity?: {
        companyName: string
        address: string
        taxId: string
        phone: string
        email: string
    } | null
    totalQty: number
    totalValue: number
}

// ── List ──────────────────────────────────────────
export async function getTransferOrders(): Promise<TransferOrderRow[]> {
    return cached('transfers:list', async () => {
        const orders = await prisma.transferOrder.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                fromWarehouse: { select: { name: true, code: true } },
                toWarehouse: { select: { name: true, code: true } },
                lines: { select: { qtyTransferred: true } },
            },
        })

        // Get user names for requesters
        const userIds = Array.from(new Set(orders.map(o => o.requesterId).filter(Boolean))) as string[]
        const users = userIds.length > 0
            ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
            : []
        const userMap = new Map(users.map(u => [u.id, u.name || u.email]))

        return orders.map(o => ({
            id: o.id,
            transferNo: o.transferNo,
            fromWarehouse: o.fromWarehouse.name,
            fromWarehouseCode: o.fromWarehouse.code,
            fromWarehouseId: o.fromWarehouseId,
            toWarehouse: o.toWarehouse.name,
            toWarehouseCode: o.toWarehouse.code,
            toWarehouseId: o.toWarehouseId,
            status: o.status,
            notes: o.notes,
            requesterName: o.requesterId ? (userMap.get(o.requesterId) || 'Nhân viên') : 'Hệ thống',
            transferDate: o.transferDate,
            accountingApprovedAt: o.accountingApprovedAt,
            accountingNotes: o.accountingNotes,
            lineCount: o.lines.length,
            totalQty: o.lines.reduce((s, l) => s + Number(l.qtyTransferred), 0),
            createdAt: o.createdAt,
        }))
    })
}

// ── Stats ─────────────────────────────────────────
export async function getTransferStats() {
    return cached('transfers:stats', async () => {
        const [total, pendingAcct, confirmed, inTransit, completed] = await Promise.all([
            prisma.transferOrder.count(),
            prisma.transferOrder.count({ where: { status: 'PENDING_ACCOUNTING' } }),
            prisma.transferOrder.count({ where: { status: 'CONFIRMED' } }),
            prisma.transferOrder.count({ where: { status: 'IN_TRANSIT' } }),
            prisma.transferOrder.count({ where: { status: 'RECEIVED' } }),
        ])
        return { total, pendingAcct, confirmed, inTransit, completed }
    })
}

// ── Create Transfer Order Voucher ────────────────
export async function createTransferOrder(input: {
    fromWarehouseId: string
    toWarehouseId: string
    transferDate?: string
    notes?: string
    submitForApproval?: boolean
    lines: { productId: string; qtyTransferred: number; vintage?: number | null }[]
}): Promise<{ success: boolean; error?: string; transferNo?: string }> {
    try {
        const user = await requireAuth()

        if (!input.fromWarehouseId || !input.toWarehouseId)
            return { success: false, error: 'Vui lòng chọn Kho xuất và Kho nhận' }

        if (input.fromWarehouseId === input.toWarehouseId)
            return { success: false, error: 'Kho xuất và Kho nhận phải khác nhau' }

        if (!input.lines || input.lines.length === 0)
            return { success: false, error: 'Vui lòng chọn ít nhất 1 sản phẩm để chuyển kho' }

        // Validate stock availability
        for (const line of input.lines) {
            const whereClause: any = {
                productId: line.productId,
                status: 'AVAILABLE',
                location: { warehouseId: input.fromWarehouseId },
            }
            if (line.vintage) {
                whereClause.vintage = Number(line.vintage)
            }
            const stockSum = await prisma.stockLot.aggregate({
                where: whereClause,
                _sum: { qtyAvailable: true },
            })
            const available = Number(stockSum._sum.qtyAvailable || 0)
            if (line.qtyTransferred > available) {
                const product = await prisma.product.findUnique({ where: { id: line.productId }, select: { skuCode: true, productName: true } })
                const vText = line.vintage ? ` (Niên vụ ${line.vintage})` : ''
                return {
                    success: false,
                    error: `Sản phẩm ${product?.skuCode || line.productId} - ${product?.productName}${vText} chỉ còn ${available} chai ở Kho xuất (Yêu cầu chuyển ${line.qtyTransferred} chai).`
                }
            }
        }

        const now = new Date()
        const prefix = `TO-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}-`
        const lastTO = await prisma.transferOrder.findFirst({
            where: { transferNo: { startsWith: prefix } },
            orderBy: { transferNo: 'desc' },
            select: { transferNo: true },
        })
        const nextSeq = lastTO ? parseInt(lastTO.transferNo.slice(-4), 10) + 1 : 1
        const transferNo = `${prefix}${String(nextSeq).padStart(4, '0')}`
        const status = input.submitForApproval ? 'PENDING_ACCOUNTING' : 'DRAFT'

        await prisma.transferOrder.create({
            data: {
                transferNo,
                fromWarehouseId: input.fromWarehouseId,
                toWarehouseId: input.toWarehouseId,
                requesterId: user.id,
                transferDate: parseDateWithCurrentTime(input.transferDate),
                status,
                notes: input.notes ?? null,
                lines: {
                    create: input.lines.map(l => ({
                        productId: l.productId,
                        qtyTransferred: l.qtyTransferred,
                        vintage: l.vintage ? Number(l.vintage) : null,
                    })),
                },
            },
        })

        revalidateCache('transfers')
        revalidatePath('/dashboard/transfers')
        revalidatePath('/dashboard/warehouse')
        return { success: true, transferNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Submit for Accounting Approval ────────────────
export async function submitTransferForAccounting(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAuth()
        const to = await prisma.transferOrder.findUnique({ where: { id } })
        if (!to) return { success: false, error: 'Không tìm thấy phiếu chuyển kho' }
        if (to.status !== 'DRAFT') return { success: false, error: 'Phiếu này đã được gửi duyệt hoặc đã xử lý' }

        await prisma.transferOrder.update({
            where: { id },
            data: { status: 'PENDING_ACCOUNTING' },
        })

        revalidateCache('transfers')
        revalidatePath('/dashboard/transfers')
        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Kế Toán Phê Duyệt Phiếu Chuyển Kho ───────────
export async function accountingApproveTransfer(id: string, notes?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        if (!hasRole(user, 'Kế Toán', 'KE_TOAN', 'CEO', 'Admin', 'ADMIN')) {
            return { success: false, error: 'Chỉ Kế toán hoặc Ban Giám Đốc mới có quyền duyệt phiếu chuyển kho' }
        }

        const to = await prisma.transferOrder.findUnique({ where: { id } })
        if (!to) return { success: false, error: 'Không tìm thấy phiếu chuyển kho' }
        if (to.status !== 'PENDING_ACCOUNTING' && to.status !== 'DRAFT') {
            return { success: false, error: 'Phiếu này không ở trạng thái chờ duyệt' }
        }

        await prisma.transferOrder.update({
            where: { id },
            data: {
                status: 'CONFIRMED',
                accountingApprovedBy: user.id,
                accountingApprovedAt: new Date(),
                accountingNotes: notes ?? null,
            },
        })

        revalidateCache('transfers')
        revalidatePath('/dashboard/transfers')
        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Kế Toán Từ Chối Phiếu Chuyển Kho ─────────────
export async function accountingRejectTransfer(id: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        if (!hasRole(user, 'Kế Toán', 'KE_TOAN', 'CEO', 'Admin', 'ADMIN')) {
            return { success: false, error: 'Chỉ Kế toán hoặc Ban Giám Đốc mới có quyền từ chối phiếu chuyển kho' }
        }

        const to = await prisma.transferOrder.findUnique({ where: { id } })
        if (!to) return { success: false, error: 'Không tìm thấy phiếu chuyển kho' }

        await prisma.transferOrder.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                accountingApprovedBy: user.id,
                accountingApprovedAt: new Date(),
                accountingNotes: `Từ chối: ${reason}`,
            },
        })

        revalidateCache('transfers')
        revalidatePath('/dashboard/transfers')
        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Thủ Kho Xuất Hàng (CONFIRMED -> IN_TRANSIT) ───
export async function dispatchTransferOrder(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAuth()

        const result = await prisma.$transaction(async (tx) => {
            const to = await tx.transferOrder.findUnique({
                where: { id },
                include: { lines: { include: { product: { select: { skuCode: true } } } } },
            })
            if (!to) throw new Error('Không tìm thấy phiếu chuyển kho')
            if (to.status !== 'CONFIRMED') throw new Error('Phiếu chuyển kho phải được Kế toán duyệt trước khi xuất kho')

            // Trừ tồn kho tại Kho Đi theo FIFO an toàn concurrency & đúng niên vụ
            for (const line of to.lines) {
                let remaining = Number(line.qtyTransferred)
                const whereLot: any = {
                    productId: line.productId,
                    status: 'AVAILABLE',
                    qtyAvailable: { gt: 0 },
                    location: { warehouseId: to.fromWarehouseId },
                }
                if (line.vintage) {
                    whereLot.vintage = line.vintage
                }

                const lots = await tx.stockLot.findMany({
                    where: whereLot,
                    orderBy: { receivedDate: 'asc' },
                })

                for (const lot of lots) {
                    if (remaining <= 0) break
                    const take = Math.min(Number(lot.qtyAvailable), remaining)
                    const isFullyConsumed = Number(lot.qtyAvailable) === take
                    const updated = await tx.stockLot.updateMany({
                        where: { id: lot.id, qtyAvailable: { gte: take } },
                        data: {
                            qtyAvailable: { decrement: take },
                            ...(isFullyConsumed ? { status: 'CONSUMED' } : {}),
                        },
                    })
                    if (updated.count === 0) {
                        throw new Error(`Lô ${lot.lotNo} đã bị thay đổi do có giao dịch đồng thời. Vui lòng thử lại.`)
                    }
                    remaining -= take
                }

                if (remaining > 0) {
                    throw new Error(`Kho xuất không đủ tồn kho cho SKU ${line.product.skuCode}${line.vintage ? ` (niên vụ ${line.vintage})` : ''} (thiếu ${remaining} chai)`)
                }
            }

            await tx.transferOrder.update({
                where: { id },
                data: {
                    status: 'IN_TRANSIT',
                    confirmedAt: new Date(),
                },
            })

            return { success: true }
        })

        revalidateCache('transfers')
        revalidatePath('/dashboard/transfers')
        revalidatePath('/dashboard/warehouse')
        return result
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Thủ Kho Nhận Hàng (IN_TRANSIT -> RECEIVED) ────
export interface ReceiveTransferLineInput {
    lineId: string
    qtyReceived: number
    locationId?: string
}

export interface ReceiveTransferInput {
    transferOrderId: string
    lines?: ReceiveTransferLineInput[]
    receiptNotes?: string
}

export async function getWarehouseLocations(warehouseId: string): Promise<Array<{ id: string; locationCode: string; zone?: string | null; rack?: string | null }>> {
    try {
        await requireAuth()
        return await prisma.location.findMany({
            where: { warehouseId },
            select: { id: true, locationCode: true, zone: true, rack: true },
            orderBy: { locationCode: 'asc' },
        })
    } catch {
        return []
    }
}

export async function receiveTransferOrder(idOrInput: string | ReceiveTransferInput): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAuth()

        const input: ReceiveTransferInput = typeof idOrInput === 'string'
            ? { transferOrderId: idOrInput }
            : idOrInput

        const result = await prisma.$transaction(async (tx) => {
            const to = await tx.transferOrder.findUnique({
                where: { id: input.transferOrderId },
                include: {
                    toWarehouse: true,
                    fromWarehouse: true,
                    lines: {
                        include: {
                            product: { select: { skuCode: true, productName: true } },
                        },
                    },
                },
            })
            if (!to) throw new Error('Không tìm thấy phiếu chuyển kho')
            if (to.status !== 'IN_TRANSIT') throw new Error('Phiếu chuyển kho phải ở trạng thái Đang vận chuyển')

            // Lấy location đầu tiên ở kho nhận để làm dự phòng mặc định
            const defaultDestLocation = await tx.location.findFirst({
                where: { warehouseId: to.toWarehouseId },
                orderBy: { locationCode: 'asc' },
            })
            if (!defaultDestLocation) throw new Error('Kho nhận chưa có vị trí kệ (Location) nào')

            const whCode = to.toWarehouse.code ? to.toWarehouse.code.replace(/^WH-/, '') : 'DEST'

            // Lấy danh sách tất cả các lotNo hiện có trong hệ thống để đảm bảo tính duy nhất
            const allExistingLots = await tx.stockLot.findMany({
                select: { lotNo: true },
            })
            const existingLotNos = new Set(allExistingLots.map((l) => l.lotNo))

            let maxTrfSeq = 0
            for (const l of allExistingLots) {
                const match = l.lotNo.match(/TRF-(\d+)/)
                if (match) {
                    const parsed = parseInt(match[1], 10)
                    if (!isNaN(parsed) && parsed > maxTrfSeq) {
                        maxTrfSeq = parsed
                    }
                }
            }
            let currentTrfSeq = maxTrfSeq

            let totalExpected = 0
            let totalActual = 0
            const discrepancies: string[] = []

            for (const line of to.lines) {
                const lineInput = input.lines?.find((l) => l.lineId === line.id)
                const expectedQty = Number(line.qtyTransferred)
                const actualQty = lineInput != null ? Math.max(0, Number(lineInput.qtyReceived)) : expectedQty

                if (actualQty > expectedQty) {
                    throw new Error(`Số lượng thực nhận cho SKU ${line.product.skuCode} (${actualQty} chai) không được lớn hơn số lượng xuất (${expectedQty} chai)`)
                }

                totalExpected += expectedQty
                totalActual += actualQty

                if (actualQty < expectedQty) {
                    discrepancies.push(`${line.product.skuCode}: xuất ${expectedQty}, nhận ${actualQty} (thiếu ${expectedQty - actualQty} chai)`)
                }

                // Cập nhật số lượng thực nhận trên dòng phiếu chuyển
                await tx.transferOrderLine.update({
                    where: { id: line.id },
                    data: { qtyReceived: actualQty },
                })

                // Nếu số lượng thực nhận = 0 (ví dụ bể vỡ toàn bộ), bỏ qua việc tạo/cộng tồn kho
                if (actualQty <= 0) continue

                // Xác thực an toàn: Vị trí kệ nhận BẮT BUỘC phải thuộc về Kho Nhận (toWarehouseId)
                let destLocationId = defaultDestLocation.id
                if (lineInput?.locationId) {
                    const validLoc = await tx.location.findFirst({
                        where: { id: lineInput.locationId, warehouseId: to.toWarehouseId },
                        select: { id: true },
                    })
                    if (validLoc) {
                        destLocationId = validLoc.id
                    }
                }

                // Truy tìm lô hàng nguồn ở kho xuất theo thứ tự FIFO (đồng bộ với thứ tự xuất kho)
                const whereSource: any = {
                    productId: line.productId,
                    location: { warehouseId: to.fromWarehouseId },
                }
                if (line.vintage) {
                    whereSource.vintage = line.vintage
                }
                const sourceLot = await tx.stockLot.findFirst({
                    where: whereSource,
                    orderBy: { receivedDate: 'asc' },
                })
                const avgCost = sourceLot ? Number(sourceLot.unitLandedCost) : 0

                let ownerEntityId = sourceLot?.ownerEntityId
                if (!ownerEntityId) {
                    const firstLE = await tx.legalEntity.findFirst()
                    if (!firstLE) throw new Error('Chưa cấu hình pháp nhân')
                    ownerEntityId = firstLE.id
                }

                const shipmentId = sourceLot?.shipmentId ?? null
                const vintage = line.vintage ?? sourceLot?.vintage ?? null

                // Kiểm tra xem tại vị trí kệ nhận đã có sẵn lô cùng sản phẩm, niên vụ, shipment và pháp nhân chưa
                const existingLotAtLocation = await tx.stockLot.findFirst({
                    where: {
                        productId: line.productId,
                        locationId: destLocationId,
                        vintage,
                        ownerEntityId,
                        shipmentId,
                        status: 'AVAILABLE',
                    },
                })

                if (existingLotAtLocation) {
                    // Nếu đã có sẵn cùng lô/shipment tại kệ này: cộng dồn tồn kho
                    await tx.stockLot.update({
                        where: { id: existingLotAtLocation.id },
                        data: {
                            qtyReceived: { increment: actualQty },
                            qtyAvailable: { increment: actualQty },
                        },
                    })
                } else {
                    // Tạo lô mới bắt đầu bằng tiền tố 'TRF-' (tương thích báo cáo NXT) nhưng bảo toàn định danh lô gốc
                    const cleanLot = sourceLot?.lotNo ? sourceLot.lotNo.replace(/^TRF-/, '') : ''
                    let baseLotNo = cleanLot
                        ? `TRF-${cleanLot}/${whCode}`
                        : `TRF-${String(++currentTrfSeq).padStart(6, '0')}`
                    let candidateLotNo = baseLotNo
                    let suffix = 1
                    while (existingLotNos.has(candidateLotNo)) {
                        suffix++
                        candidateLotNo = `${baseLotNo}-${suffix}`
                    }
                    existingLotNos.add(candidateLotNo)

                    await tx.stockLot.create({
                        data: {
                            lotNo: candidateLotNo,
                            ownerEntityId,
                            productId: line.productId,
                            locationId: destLocationId,
                            shipmentId,
                            qtyReceived: actualQty,
                            qtyAvailable: actualQty,
                            unitLandedCost: avgCost,
                            receivedDate: new Date(),
                            vintage,
                            status: 'AVAILABLE',
                        },
                    })
                }
            }

            // Ghi chú biên bản nhận kho nếu có chênh lệch hoặc có ghi chú của thủ kho nhận
            let updatedNotes = to.notes || ''
            if (discrepancies.length > 0 || input.receiptNotes?.trim()) {
                const nowStr = new Date().toLocaleString('vi-VN')
                const reportParts = [`[Biên bản nhận kho ${nowStr}]: Thực nhận ${totalActual}/${totalExpected} chai`]
                if (discrepancies.length > 0) {
                    reportParts.push(`Hao hụt/vỡ: ${discrepancies.join('; ')}`)
                }
                if (input.receiptNotes?.trim()) {
                    reportParts.push(`Ghi chú thủ kho: ${input.receiptNotes.trim()}`)
                }
                const reportStr = reportParts.join(' | ')
                updatedNotes = updatedNotes ? `${updatedNotes}\n${reportStr}` : reportStr
            }

            await tx.transferOrder.update({
                where: { id: input.transferOrderId },
                data: {
                    status: 'RECEIVED',
                    receivedAt: new Date(),
                    notes: updatedNotes,
                },
            })

            return { success: true }
        })

        revalidateCache('transfers')
        revalidateCache('wms')
        revalidatePath('/dashboard/transfers')
        revalidatePath('/dashboard/warehouse')
        return result
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Advance Status General Helper ─────────────────
export async function advanceTransferStatus(id: string): Promise<{ success: boolean; error?: string }> {
    const to = await prisma.transferOrder.findUnique({ where: { id } })
    if (!to) return { success: false, error: 'Not found' }

    if (to.status === 'DRAFT') {
        return submitTransferForAccounting(id)
    } else if (to.status === 'PENDING_ACCOUNTING') {
        return accountingApproveTransfer(id)
    } else if (to.status === 'CONFIRMED') {
        return dispatchTransferOrder(id)
    } else if (to.status === 'IN_TRANSIT') {
        return receiveTransferOrder(id)
    }
    return { success: false, error: 'Không thể chuyển trạng thái tiếp theo' }
}

// ── Options (Warehouses & Products with Stock) ─────
export async function getTransferOptions() {
    return cached('transfers:options', async () => {
        const [warehouses, products, stockLots] = await Promise.all([
            prisma.warehouse.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
            prisma.product.findMany({
                where: { status: 'ACTIVE' },
                select: { id: true, skuCode: true, productName: true, country: true },
                orderBy: { skuCode: 'asc' }
            }),
            prisma.stockLot.findMany({
                where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                select: {
                    productId: true,
                    vintage: true,
                    qtyAvailable: true,
                    location: {
                        select: { warehouseId: true }
                    }
                },
            }),
        ])

        const stockMap: Record<string, Record<string, { totalAvailable: number; vintages: Map<number | null, number> }>> = {}
        const allVintagesMap: Record<string, Set<number>> = {}

        for (const lot of stockLots) {
            const pId = lot.productId
            const whId = lot.location?.warehouseId
            const v = lot.vintage
            const qty = Number(lot.qtyAvailable || 0)

            if (v) {
                if (!allVintagesMap[pId]) allVintagesMap[pId] = new Set()
                allVintagesMap[pId].add(v)
            }

            if (whId) {
                if (!stockMap[pId]) stockMap[pId] = {}
                if (!stockMap[pId][whId]) {
                    stockMap[pId][whId] = { totalAvailable: 0, vintages: new Map() }
                }
                stockMap[pId][whId].totalAvailable += qty
                const curVQty = stockMap[pId][whId].vintages.get(v) || 0
                stockMap[pId][whId].vintages.set(v, curVQty + qty)
            }
        }

        const productsWithStock = products.map(p => {
            const whStocks: Record<string, { totalAvailable: number; vintages: { vintage: number | null; qtyAvailable: number }[] }> = {}
            const pStocks = stockMap[p.id] || {}
            for (const [whId, data] of Object.entries(pStocks)) {
                whStocks[whId] = {
                    totalAvailable: data.totalAvailable,
                    vintages: Array.from(data.vintages.entries()).map(([vintage, qtyAvailable]) => ({
                        vintage,
                        qtyAvailable
                    })).sort((a, b) => (b.vintage || 0) - (a.vintage || 0))
                }
            }

            return {
                ...p,
                vintages: Array.from(allVintagesMap[p.id] || []).sort((a, b) => b - a),
                stocksByWH: whStocks,
            }
        })

        return { warehouses, products: productsWithStock }
    })
}

// ── Cancel ────────────────────────────────────────
export async function cancelTransferOrder(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        const to = await prisma.transferOrder.findUnique({ where: { id } })
        if (!to) return { success: false, error: 'Không tìm thấy phiếu' }
        if (to.status !== 'DRAFT' && to.status !== 'PENDING_ACCOUNTING' && to.status !== 'CONFIRMED') {
            return { success: false, error: 'Chỉ có thể hủy phiếu khi chưa xuất kho' }
        }

        await prisma.transferOrder.update({
            where: { id },
            data: { status: 'CANCELLED', accountingNotes: `Đã hủy bởi ${user.name}` }
        })

        revalidateCache('transfers')
        revalidatePath('/dashboard/transfers')
        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Get Full Transfer Order Voucher Detail ────────
export async function getTransferDetail(id: string): Promise<TransferOrderDetail | null> {
    const to = await prisma.transferOrder.findUnique({
        where: { id },
        include: {
            fromWarehouse: {
                select: {
                    name: true,
                    code: true,
                    address: true,
                    legalEntity: {
                        select: {
                            name: true,
                            address: true,
                            taxId: true,
                            phone: true,
                            email: true,
                        },
                    },
                },
            },
            toWarehouse: { select: { name: true, code: true } },
            lines: {
                include: {
                    product: { select: { productName: true, skuCode: true, country: true } },
                },
            },
        },
    })
    if (!to) return null

    // Get user names for requester and approver
    const userIds = [to.requesterId, to.accountingApprovedBy].filter(Boolean) as string[]
    const users = userIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
        : []
    const userMap = new Map(users.map(u => [u.id, u.name || u.email]))

    // Get stock lots at source warehouse & cost info
    const lineDetails = await Promise.all((to.lines || []).map(async (l: any) => {
        const sourceLots = await prisma.stockLot.findMany({
            where: {
                productId: l.productId,
                status: 'AVAILABLE',
                qtyAvailable: { gt: 0 },
                location: { warehouseId: to.fromWarehouseId },
            },
            select: { vintage: true, qtyAvailable: true, unitLandedCost: true },
        })

        const vintageStockMap: Record<string, number> = {}
        let totalWHStock = 0
        for (const lot of sourceLots) {
            const vKey = lot.vintage !== null && lot.vintage !== undefined ? String(lot.vintage) : 'NV'
            const qty = Number(lot.qtyAvailable)
            vintageStockMap[vKey] = (vintageStockMap[vKey] || 0) + qty
            totalWHStock += qty
        }

        const availableVintages = Object.entries(vintageStockMap).map(([vStr, qty]) => ({
            vintage: vStr === 'NV' ? null : parseInt(vStr, 10),
            qtyAvailable: qty,
        })).sort((a, b) => (b.vintage ?? 0) - (a.vintage ?? 0))

        const currentVintageKey = l.vintage !== null && l.vintage !== undefined ? String(l.vintage) : 'NV'
        const vintageAvailableStock = vintageStockMap[currentVintageKey] || 0

        const firstLot = sourceLots[0] || await prisma.stockLot.findFirst({
            where: { productId: l.productId },
            select: { unitLandedCost: true, vintage: true },
            orderBy: { receivedDate: 'desc' },
        })

        const qtyTrans = Number(l.qtyTransferred)
        const unitCost = firstLot ? Number(firstLot.unitLandedCost) : 0
        return {
            id: l.id,
            productId: l.productId,
            productName: l.product.productName,
            skuCode: l.product.skuCode,
            vintage: l.vintage ?? firstLot?.vintage ?? null,
            country: l.product.country,
            qtyTransferred: qtyTrans,
            qtyReceived: Number(l.qtyReceived || 0),
            qtyAvailableFromWH: totalWHStock,
            availableVintages,
            vintageAvailableStock,
            unitCost,
            totalValue: qtyTrans * unitCost,
        }
    }))

    const totalQty = lineDetails.reduce((s: number, l: any) => s + l.qtyTransferred, 0)
    const totalValue = lineDetails.reduce((s: number, l: any) => s + l.totalValue, 0)

    const fromWH = to.fromWarehouse as any
    const le = fromWH?.legalEntity

    const fromWarehouseEntity = le ? {
        companyName: le.name,
        address: le.address || fromWH?.address || 'Hà Nội',
        taxId: le.taxId || '—',
        phone: le.phone || '024.3933.8888',
        email: le.email || 'accounting@lyscellars.com',
    } : {
        companyName: fromWH?.name || 'CÔNG TY CỔ PHẦN LYS CELLARS',
        address: fromWH?.address || '15 Giang Văn Minh, Phường Đội Cấn, Q. Ba Đình, TP. Hà Nội',
        taxId: '0109579480',
        phone: '024.3933.8888',
        email: 'accounting@lyscellars.com',
    }

    return {
        id: to.id,
        transferNo: to.transferNo,
        fromWarehouse: to.fromWarehouse.name,
        fromWarehouseCode: to.fromWarehouse.code,
        fromWarehouseId: to.fromWarehouseId,
        toWarehouse: to.toWarehouse.name,
        toWarehouseCode: to.toWarehouse.code,
        toWarehouseId: to.toWarehouseId,
        status: to.status,
        notes: to.notes,
        transferDate: to.transferDate,
        requesterName: to.requesterId ? (userMap.get(to.requesterId) || 'Nhân viên') : 'Hệ thống',
        requesterId: to.requesterId,
        accountingApprovedBy: to.accountingApprovedBy ? (userMap.get(to.accountingApprovedBy) || 'Kế toán') : null,
        accountingApprovedAt: to.accountingApprovedAt,
        accountingNotes: to.accountingNotes,
        confirmedAt: to.confirmedAt,
        receivedAt: to.receivedAt,
        createdAt: to.createdAt,
        lines: lineDetails,
        fromWarehouseEntity,
        totalQty,
        totalValue,
    }
}

// ── 10. Get FIFO Picking Location Suggestions for Transfer Order ───────
export type TransferPickingItem = {
    productId: string
    skuCode: string
    productName: string
    vintageRequested: number | null
    qtyRequested: number
    pickingLocations: {
        lotId: string
        lotNo: string
        locationId: string
        locationCode: string
        zone: string
        rack: string | null
        bin: string | null
        vintage: number | null
        qtyAvailable: number
        qtyToPick: number
    }[]
    isSufficient: boolean
    totalAvailableInWH: number
}

export async function getTransferPickingLocations(transferOrderId: string): Promise<TransferPickingItem[]> {
    const to = await prisma.transferOrder.findUnique({
        where: { id: transferOrderId },
        include: {
            lines: {
                include: {
                    product: { select: { skuCode: true, productName: true } }
                }
            }
        }
    })
    if (!to) return []

    const result: TransferPickingItem[] = []

    for (const line of to.lines) {
        let remaining = Number(line.qtyTransferred)

        const whereCondition: any = {
            productId: line.productId,
            status: 'AVAILABLE',
            qtyAvailable: { gt: 0 },
            location: { warehouseId: to.fromWarehouseId },
        }
        const lineVintage = (line as any).vintage
        if (lineVintage) {
            whereCondition.vintage = lineVintage
        }

        const lots = await prisma.stockLot.findMany({
            where: whereCondition,
            include: {
                location: { select: { id: true, locationCode: true, zone: true, rack: true, bin: true } }
            },
            orderBy: { receivedDate: 'asc' }, // FIFO: Order by oldest received date first
        })

        const totalAvailableInWH = lots.reduce((sum, l) => sum + Number(l.qtyAvailable), 0)
        const pickingLocations: TransferPickingItem['pickingLocations'] = []

        for (const lot of lots) {
            const avail = Number(lot.qtyAvailable)
            const take = Math.min(avail, Math.max(0, remaining))
            if (take > 0) {
                pickingLocations.push({
                    lotId: lot.id,
                    lotNo: lot.lotNo,
                    locationId: lot.location.id,
                    locationCode: lot.location.locationCode,
                    zone: lot.location.zone,
                    rack: lot.location.rack,
                    bin: lot.location.bin,
                    vintage: lot.vintage,
                    qtyAvailable: avail,
                    qtyToPick: take,
                })
                remaining -= take
            }
        }

        result.push({
            productId: line.productId,
            skuCode: line.product.skuCode,
            productName: line.product.productName,
            vintageRequested: lineVintage ? Number(lineVintage) : null,
            qtyRequested: Number(line.qtyTransferred),
            pickingLocations,
            isSufficient: totalAvailableInWH >= Number(line.qtyTransferred),
            totalAvailableInWH,
        })
    }

    return result
}

// ── Cập Nhật Niên Vụ (Vintage) Cho Dòng Phiếu Chuyển Kho ──
export async function updateTransferLineVintage(input: {
    transferOrderId: string
    lineId: string
    newVintage: number | null
}): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAuth()
        const to = await prisma.transferOrder.findUnique({
            where: { id: input.transferOrderId },
            include: { lines: { include: { product: { select: { skuCode: true, productName: true } } } } }
        })
        if (!to) return { success: false, error: 'Không tìm thấy phiếu chuyển kho' }
        if (!['DRAFT', 'PENDING_ACCOUNTING', 'CONFIRMED'].includes(to.status)) {
            return { success: false, error: 'Chỉ có thể đổi niên vụ khi phiếu chưa xuất kho (Nháp, Chờ duyệt, hoặc Đã duyệt)' }
        }

        const line = to.lines.find(l => l.id === input.lineId)
        if (!line) return { success: false, error: 'Không tìm thấy dòng sản phẩm' }

        // Validate stock of newVintage in fromWarehouseId
        const whereClause: any = {
            productId: line.productId,
            status: 'AVAILABLE',
            location: { warehouseId: to.fromWarehouseId },
        }
        if (input.newVintage !== null && input.newVintage !== undefined) {
            whereClause.vintage = Number(input.newVintage)
        } else {
            whereClause.vintage = null
        }

        const stockSum = await prisma.stockLot.aggregate({
            where: whereClause,
            _sum: { qtyAvailable: true }
        })
        const available = Number(stockSum._sum.qtyAvailable || 0)
        if (available < Number(line.qtyTransferred)) {
            const vText = input.newVintage ? `Niên vụ ${input.newVintage}` : 'Không niên vụ (NV)'
            return {
                success: false,
                error: `${line.product.skuCode} (${vText}) chỉ còn ${available} chai ở Kho xuất (Yêu cầu chuyển ${line.qtyTransferred} chai).`
            }
        }

        await prisma.transferOrderLine.update({
            where: { id: input.lineId },
            data: { vintage: input.newVintage !== null && input.newVintage !== undefined ? Number(input.newVintage) : null }
        })

        revalidateCache('transfers')
        revalidatePath('/dashboard/transfers')
        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Tự Động Khớp Niên Vụ Còn Hàng Cho Tất Cả Các Dòng Bị Kẹt ──
export async function autoFixTransferVintages(transferOrderId: string): Promise<{
    success: boolean
    error?: string
    updatedCount?: number
    details?: string[]
}> {
    try {
        await requireAuth()
        const to = await prisma.transferOrder.findUnique({
            where: { id: transferOrderId },
            include: {
                lines: {
                    include: {
                        product: { select: { skuCode: true, productName: true } }
                    }
                }
            }
        })
        if (!to) return { success: false, error: 'Không tìm thấy phiếu chuyển kho' }
        if (!['DRAFT', 'PENDING_ACCOUNTING', 'CONFIRMED'].includes(to.status)) {
            return { success: false, error: 'Chỉ có thể tự động đổi niên vụ khi phiếu chưa xuất kho' }
        }

        const details: string[] = []
        let updatedCount = 0

        for (const line of to.lines) {
            const qtyReq = Number(line.qtyTransferred)

            // Check current vintage stock
            const whereCurr: any = {
                productId: line.productId,
                status: 'AVAILABLE',
                location: { warehouseId: to.fromWarehouseId }
            }
            if (line.vintage !== null && line.vintage !== undefined) {
                whereCurr.vintage = line.vintage
            } else {
                whereCurr.vintage = null
            }
            const currSum = await prisma.stockLot.aggregate({
                where: whereCurr,
                _sum: { qtyAvailable: true }
            })
            const currAvailable = Number(currSum._sum.qtyAvailable || 0)

            if (currAvailable >= qtyReq) {
                continue
            }

            // Find all available vintages in fromWarehouse
            const allLots = await prisma.stockLot.findMany({
                where: {
                    productId: line.productId,
                    status: 'AVAILABLE',
                    qtyAvailable: { gt: 0 },
                    location: { warehouseId: to.fromWarehouseId }
                },
                select: { vintage: true, qtyAvailable: true }
            })

            const vintageGroup: Record<string, number> = {}
            for (const lot of allLots) {
                const k = lot.vintage !== null && lot.vintage !== undefined ? String(lot.vintage) : 'NV'
                vintageGroup[k] = (vintageGroup[k] || 0) + Number(lot.qtyAvailable)
            }

            // Find best matching vintage that has >= qtyReq
            const candidates = Object.entries(vintageGroup)
                .map(([vStr, stock]) => ({ vintage: vStr === 'NV' ? null : parseInt(vStr, 10), stock }))
                .filter(c => c.stock >= qtyReq)
                .sort((a, b) => b.stock - a.stock)

            if (candidates.length > 0) {
                const chosen = candidates[0]
                await prisma.transferOrderLine.update({
                    where: { id: line.id },
                    data: { vintage: chosen.vintage }
                })
                const oldText = line.vintage ? `VTG ${line.vintage}` : 'NV'
                const newText = chosen.vintage ? `VTG ${chosen.vintage}` : 'NV'
                details.push(`[${line.product.skuCode}] ${line.product.productName}: ${oldText} ➔ ${newText} (Kho có ${chosen.stock} chai)`)
                updatedCount++
            }
        }

        revalidateCache('transfers')
        revalidatePath('/dashboard/transfers')
        revalidatePath('/dashboard/warehouse')

        return {
            success: true,
            updatedCount,
            details
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

