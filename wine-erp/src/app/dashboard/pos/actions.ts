'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'

// ═══════════════════════════════════════════════════
// POS — Point of Sale for Showroom
// ═══════════════════════════════════════════════════

export type POSProduct = {
    id: string
    skuCode: string
    productName: string
    category: string
    unitPrice: number
    qtyAvailable: number
    imageUrl: string | null
}

export type CartItem = {
    productId: string
    skuCode: string
    productName: string
    qty: number
    unitPrice: number
    discountPct: number
}

export type ShiftStatus = 'OPEN' | 'CLOSED'

// ── Get products for POS display ──────────────────
export async function getPOSProducts(search?: string, category?: string): Promise<POSProduct[]> {
    const where: any = { status: 'ACTIVE', deletedAt: null }
    if (search) {
        where.OR = [
            { productName: { contains: search, mode: 'insensitive' } },
            { skuCode: { contains: search, mode: 'insensitive' } },
        ]
    }
    if (category && category !== 'ALL') {
        where.wineType = category
    }

    const products = await prisma.product.findMany({
        where,
        select: {
            id: true, skuCode: true, productName: true, wineType: true,
            stockLots: {
                where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                select: { qtyAvailable: true },
            },
        },
        orderBy: { productName: 'asc' },
        take: 100,
    })

    // Get VIP/POS prices
    const now = new Date()
    const priceList = await prisma.priceList.findFirst({
        where: { channel: 'VIP_RETAIL', effectiveDate: { lte: now } },
        orderBy: { effectiveDate: 'desc' },
    })
    const priceLines = priceList
        ? await prisma.priceListLine.findMany({
            where: { priceListId: priceList.id },
            select: { productId: true, unitPrice: true },
        })
        : []
    const priceMap = new Map(priceLines.map(l => [l.productId, Number(l.unitPrice)]))

    return products.map(p => ({
        id: p.id,
        skuCode: p.skuCode,
        productName: p.productName,
        category: p.wineType ?? 'OTHER',
        unitPrice: priceMap.get(p.id) ?? 0,
        qtyAvailable: p.stockLots.reduce((s, l) => s + Number(l.qtyAvailable), 0),
        imageUrl: null,
    }))
}

// ── Get categories for filter ─────────────────────
export async function getPOSCategories() {
    const types = await prisma.product.groupBy({
        by: ['wineType'],
        where: { status: 'ACTIVE', deletedAt: null },
        _count: true,
    })
    return types.map(t => ({
        value: t.wineType ?? 'OTHER',
        label: t.wineType ?? 'Khác',
        count: t._count,
    }))
}

// ── Process POS Sale ──────────────────────────────
export async function processPOSSale(input: {
    items: CartItem[]
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'QR'
    cashReceived?: number
    customerId?: string
    cashierName?: string
}): Promise<{
    success: boolean
    soNo?: string
    totalAmount?: number
    change?: number
    error?: string
}> {
    try {
        if (input.items.length === 0) {
            return { success: false, error: 'Giỏ hàng trống' }
        }

        // Calculate total
        const totalAmount = input.items.reduce((sum, item) => {
            const lineTotal = item.qty * item.unitPrice
            const discount = lineTotal * (item.discountPct / 100)
            return sum + lineTotal - discount
        }, 0)

        // Validate cash payment
        let change = 0
        if (input.paymentMethod === 'CASH') {
            const received = input.cashReceived ?? 0
            if (received < totalAmount) {
                return { success: false, error: `Tiền nhận (${received.toLocaleString()}) nhỏ hơn tổng tiền (${totalAmount.toLocaleString()})` }
            }
            change = received - totalAmount
        }

        // Create SO (POS type)
        const count = await prisma.salesOrder.count()
        const now = new Date()
        const yy = String(now.getFullYear()).slice(-2)
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const soNo = `POS-${yy}${mm}-${String(count + 1).padStart(4, '0')}`

        // Use walk-in customer or specified customer
        let customerId = input.customerId
        if (!customerId) {
            const walkIn = await prisma.customer.findFirst({
                where: { code: 'WALK-IN' },
            })
            customerId = walkIn?.id
            if (!customerId) {
                // Create walk-in customer
                const c = await prisma.customer.create({
                    data: {
                        code: 'WALK-IN',
                        name: 'Khách Lẻ',
                        customerType: 'INDIVIDUAL',
                        paymentTerm: 'COD',
                        channel: 'DIRECT_INDIVIDUAL',
                        creditLimit: 0,
                    },
                })
                customerId = c.id
            }
        }

        // Transaction: Create SO + Deduct stock (FIFO)
        // Get or create a POS system user
        let salesRepId = 'pos-system'
        const adminUser = await prisma.user.findFirst({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } })
        if (adminUser) salesRepId = adminUser.id

        const so = await prisma.$transaction(async (tx) => {
            const salesOrder = await tx.salesOrder.create({
                data: {
                    soNo,
                    customerId: customerId!,
                    salesRepId,
                    channel: 'DIRECT_INDIVIDUAL',
                    paymentTerm: 'COD',
                    totalAmount,
                    status: 'PAID' as any, // POS is immediate
                    lines: {
                        create: input.items.map(item => ({
                            productId: item.productId,
                            qtyOrdered: item.qty,
                            unitPrice: item.unitPrice,
                            lineDiscountPct: item.discountPct,
                        })),
                    },
                },
            })

            // Deduct stock FIFO per item
            for (const item of input.items) {
                let remaining = item.qty
                const lots = await tx.stockLot.findMany({
                    where: {
                        productId: item.productId,
                        status: 'AVAILABLE',
                        qtyAvailable: { gt: 0 },
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
                    throw new Error(`Không đủ tồn kho cho ${item.skuCode}`)
                }
            }

            return salesOrder
        })

        // Audit
        logAudit({
            userId: 'pos-system',
            action: 'CREATE',
            entityType: 'SalesOrder',
            entityId: so.id,
            description: `POS Sale ${soNo} — ${input.paymentMethod}`,
            newValue: { soNo, totalAmount, paymentMethod: input.paymentMethod },
        }).catch(() => { })

        revalidatePath('/dashboard/pos')
        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard/warehouse')

        return {
            success: true,
            soNo,
            totalAmount,
            change: input.paymentMethod === 'CASH' ? change : undefined,
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Get POS shift summary ─────────────────────────
export async function getPOSShiftSummary(date?: string) {
    const targetDate = date ? new Date(date) : new Date()
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86400000)

    const posSales = await prisma.salesOrder.findMany({
        where: {
            soNo: { startsWith: 'POS-' },
            createdAt: { gte: dayStart, lt: dayEnd },
        },
        select: { totalAmount: true, status: true, createdAt: true },
    })

    const totalRevenue = posSales.reduce((s, o) => s + Number(o.totalAmount), 0)
    const transactionCount = posSales.length
    const avgTransaction = transactionCount > 0 ? totalRevenue / transactionCount : 0

    return {
        date: dayStart.toISOString(),
        totalRevenue,
        transactionCount,
        avgTransaction,
        sales: posSales.map(s => ({
            amount: Number(s.totalAmount),
            status: s.status,
            time: s.createdAt,
        })),
    }
}

// ── Barcode / SKU Lookup ──────────────────────────
export async function lookupByBarcode(barcode: string): Promise<POSProduct | null> {
    // Try exact SKU match first, then barcode field
    const product = await prisma.product.findFirst({
        where: {
            OR: [
                { skuCode: barcode },
            ],
            status: 'ACTIVE',
            deletedAt: null,
        },
        select: {
            id: true, skuCode: true, productName: true, wineType: true,
            stockLots: {
                where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                select: { qtyAvailable: true },
            },
        },
    })

    if (!product) return null

    // Get POS price
    const now = new Date()
    const priceList = await prisma.priceList.findFirst({
        where: { channel: 'VIP_RETAIL', effectiveDate: { lte: now } },
        orderBy: { effectiveDate: 'desc' },
    })
    let unitPrice = 0
    if (priceList) {
        const priceLine = await prisma.priceListLine.findFirst({
            where: { priceListId: priceList.id, productId: product.id },
        })
        unitPrice = priceLine ? Number(priceLine.unitPrice) : 0
    }

    return {
        id: product.id,
        skuCode: product.skuCode,
        productName: product.productName,
        category: product.wineType ?? 'OTHER',
        unitPrice,
        qtyAvailable: product.stockLots.reduce((s, l) => s + Number(l.qtyAvailable), 0),
        imageUrl: null,
    }
}

// ── Generate POS VAT Invoice ──────────────────────
export async function generatePOSVATInvoice(input: {
    soNo: string
    customerName: string
    customerTaxCode?: string
    customerAddress?: string
}): Promise<{ success: boolean; invoiceNo?: string; error?: string }> {
    try {
        const so = await prisma.salesOrder.findFirst({
            where: { soNo: input.soNo },
            include: {
                customer: { select: { id: true, name: true } },
                lines: {
                    include: { product: { select: { skuCode: true, productName: true } } },
                },
            },
        })

        if (!so) return { success: false, error: `Không tìm thấy đơn ${input.soNo}` }

        // Check if VAT invoice already exists
        const existing = await prisma.aRInvoice.findFirst({
            where: { soId: so.id },
        })
        if (existing) return { success: false, error: `Đơn ${input.soNo} đã có hóa đơn ${existing.invoiceNo}` }

        // Generate VAT invoice number
        const now = new Date()
        const yy = String(now.getFullYear()).slice(-2)
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const count = await prisma.aRInvoice.count()
        const invoiceNo = `VAT-${yy}${mm}-${String(count + 1).padStart(5, '0')}`

        const totalAmount = Number(so.totalAmount)
        const vatAmount = Math.round(totalAmount / 11) // VAT 10% from total (total = base + VAT)
        const baseAmount = totalAmount - vatAmount

        await prisma.aRInvoice.create({
            data: {
                invoiceNo,
                customerId: so.customerId,
                soId: so.id,
                amount: baseAmount,
                vatAmount,
                totalAmount,
                status: 'PAID',
                dueDate: now,
            },
        })

        revalidatePath('/dashboard/pos')
        revalidatePath('/dashboard/finance')
        return { success: true, invoiceNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// #29 — LOYALTY PROGRAM
// ═══════════════════════════════════════════════════

const POINTS_PER_10K = 1  // 1 point per 10,000 VND
const POINT_VALUE_VND = 1000  // 1 point = 1,000 VND

export type LoyaltyInfo = {
    customerId: string
    customerName: string
    pointsBalance: number
    totalEarned: number
    totalRedeemed: number
    redeemableValue: number
    tier: string
    history: { date: Date; type: string; points: number; description: string }[]
}

export async function getLoyaltyInfo(customerId: string): Promise<LoyaltyInfo | null> {
    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { name: true },
    })
    if (!customer) return null

    const transactions = await prisma.loyaltyTransaction.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })

    const totalEarned = transactions.filter(t => t.type === 'EARN').reduce((s, t) => s + t.points, 0)
    const totalRedeemed = transactions.filter(t => t.type === 'REDEEM').reduce((s, t) => s + Math.abs(t.points), 0)
    const pointsBalance = totalEarned - totalRedeemed

    const tier = pointsBalance >= 5000 ? 'PLATINUM' :
        pointsBalance >= 2000 ? 'GOLD' :
            pointsBalance >= 500 ? 'SILVER' : 'BRONZE'

    return {
        customerId,
        customerName: customer.name,
        pointsBalance,
        totalEarned,
        totalRedeemed,
        redeemableValue: pointsBalance * POINT_VALUE_VND,
        tier,
        history: transactions.map(t => ({
            date: t.createdAt,
            type: t.type,
            points: t.points,
            description: t.description,
        })),
    }
}

export async function earnLoyaltyPoints(input: {
    customerId: string
    orderAmount: number
    soNo: string
}): Promise<{ success: boolean; pointsEarned: number }> {
    const points = Math.floor(input.orderAmount / 10000) * POINTS_PER_10K
    if (points <= 0) return { success: true, pointsEarned: 0 }

    await prisma.loyaltyTransaction.create({
        data: {
            customerId: input.customerId,
            type: 'EARN',
            points,
            description: `Tích điểm từ đơn ${input.soNo}`,
        },
    })
    return { success: true, pointsEarned: points }
}

export async function redeemLoyaltyPoints(input: {
    customerId: string
    points: number
}): Promise<{ success: boolean; discountAmount: number; error?: string }> {
    const info = await getLoyaltyInfo(input.customerId)
    if (!info) return { success: false, discountAmount: 0, error: 'Không tìm thấy KH' }
    if (info.pointsBalance < input.points) {
        return { success: false, discountAmount: 0, error: `Không đủ điểm (còn ${info.pointsBalance})` }
    }

    await prisma.loyaltyTransaction.create({
        data: {
            customerId: input.customerId,
            type: 'REDEEM',
            points: -input.points,
            description: `Đổi ${input.points} điểm = ${(input.points * POINT_VALUE_VND).toLocaleString()}đ`,
        },
    })

    return { success: true, discountAmount: input.points * POINT_VALUE_VND }
}
