'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'
import { requireAuth, hasRole } from '@/lib/session'

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

        // Real-time stock check at source warehouse
        for (const line of input.lines) {
            const stockSum = await prisma.stockLot.aggregate({
                where: {
                    productId: line.productId,
                    status: 'AVAILABLE',
                    location: { warehouseId: input.fromWarehouseId },
                },
                _sum: { qtyAvailable: true },
            })
            const available = Number(stockSum._sum.qtyAvailable || 0)
            if (line.qtyTransferred > available) {
                const product = await prisma.product.findUnique({ where: { id: line.productId }, select: { skuCode: true, productName: true } })
                return {
                    success: false,
                    error: `Sản phẩm ${product?.skuCode || line.productId} (${product?.productName}) chỉ còn ${available} chai ở Kho xuất (Yêu cầu chuyển ${line.qtyTransferred} chai).`
                }
            }
        }

        const now = new Date()
        const prefix = `TO-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`
        const count = await prisma.transferOrder.count()
        const transferNo = `${prefix}-${String(count + 1).padStart(4, '0')}`
        const status = input.submitForApproval ? 'PENDING_ACCOUNTING' : 'DRAFT'

        await prisma.transferOrder.create({
            data: {
                transferNo,
                fromWarehouseId: input.fromWarehouseId,
                toWarehouseId: input.toWarehouseId,
                requesterId: user.id,
                transferDate: input.transferDate ? new Date(input.transferDate) : new Date(),
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

            // Trừ tồn kho tại Kho Đi theo FIFO
            for (const line of to.lines) {
                let remaining = Number(line.qtyTransferred)
                const lots = await tx.stockLot.findMany({
                    where: {
                        productId: line.productId,
                        status: 'AVAILABLE',
                        qtyAvailable: { gt: 0 },
                        location: { warehouseId: to.fromWarehouseId },
                    },
                    orderBy: { receivedDate: 'asc' },
                })

                for (const lot of lots) {
                    if (remaining <= 0) break
                    const take = Math.min(Number(lot.qtyAvailable), remaining)
                    await tx.stockLot.update({
                        where: { id: lot.id },
                        data: { qtyAvailable: { decrement: take } },
                    })
                    remaining -= take
                }

                if (remaining > 0) {
                    throw new Error(`Kho xuất không đủ tồn kho cho SKU ${line.product.skuCode} (thiếu ${remaining} chai)`)
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
export async function receiveTransferOrder(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAuth()

        const result = await prisma.$transaction(async (tx) => {
            const to = await tx.transferOrder.findUnique({
                where: { id },
                include: { lines: { include: { product: { select: { skuCode: true } } } } },
            })
            if (!to) throw new Error('Không tìm thấy phiếu chuyển kho')
            if (to.status !== 'IN_TRANSIT') throw new Error('Phiếu chuyển kho phải ở trạng thái Đang vận chuyển')

            // Lấy location đầu tiên ở kho nhận để nhập hàng vào
            const destLocation = await tx.location.findFirst({
                where: { warehouseId: to.toWarehouseId },
                orderBy: { locationCode: 'asc' },
            })
            if (!destLocation) throw new Error('Kho nhận chưa có vị trí kệ (Location) nào')

            for (const line of to.lines) {
                // Ước tính giá vốn từ kho xuất
                const sourceLot = await tx.stockLot.findFirst({
                    where: { productId: line.productId, location: { warehouseId: to.fromWarehouseId } },
                    orderBy: { receivedDate: 'desc' },
                })
                const avgCost = sourceLot ? Number(sourceLot.unitLandedCost) : 0

                let ownerEntityId = sourceLot?.ownerEntityId
                if (!ownerEntityId) {
                    const firstLE = await tx.legalEntity.findFirst()
                    if (!firstLE) throw new Error('Chưa cấu hình pháp nhân')
                    ownerEntityId = firstLE.id
                }

                const lotCount = await tx.stockLot.count()
                await tx.stockLot.create({
                    data: {
                        lotNo: `TRF-${String(lotCount + 1).padStart(6, '0')}`,
                        ownerEntityId,
                        productId: line.productId,
                        locationId: destLocation.id,
                        qtyReceived: line.qtyTransferred,
                        qtyAvailable: line.qtyTransferred,
                        unitLandedCost: avgCost,
                        receivedDate: new Date(),
                        status: 'AVAILABLE',
                    },
                })
            }

            await tx.transferOrder.update({
                where: { id },
                data: {
                    status: 'RECEIVED',
                    receivedAt: new Date(),
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
                select: { productId: true, vintage: true },
            }),
        ])

        const vintageMap: Record<string, number[]> = {}
        for (const lot of stockLots) {
            if (lot.vintage) {
                if (!vintageMap[lot.productId]) vintageMap[lot.productId] = []
                if (!vintageMap[lot.productId].includes(lot.vintage)) {
                    vintageMap[lot.productId].push(lot.vintage)
                }
            }
        }

        const productsWithVintages = products.map(p => ({
            ...p,
            vintages: (vintageMap[p.id] || []).sort((a, b) => b - a),
        }))

        return { warehouses, products: productsWithVintages }
    })
}

// ── Cancel ────────────────────────────────────────
export async function cancelTransferOrder(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        const to = await prisma.transferOrder.findUnique({ where: { id } })
        if (!to) return { success: false, error: 'Không tìm thấy phiếu' }
        if (to.status !== 'DRAFT' && to.status !== 'PENDING_ACCOUNTING') {
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
        const stockSum = await prisma.stockLot.aggregate({
            where: {
                productId: l.productId,
                status: 'AVAILABLE',
                location: { warehouseId: to.fromWarehouseId },
            },
            _sum: { qtyAvailable: true },
        })

        const firstLot = await prisma.stockLot.findFirst({
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
            qtyAvailableFromWH: Number(stockSum._sum.qtyAvailable || 0),
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
