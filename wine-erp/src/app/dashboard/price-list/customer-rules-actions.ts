'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { requireAuth, requirePermission, getCurrentUser } from '@/lib/session'
import { cached, revalidateCache } from '@/lib/cache'

export type PriceRuleRow = {
    id: string
    customerId: string
    customerName: string
    customerCode: string
    customerChannel: string | null
    productId: string
    productName: string
    skuCode: string
    ruleType: 'FIXED_DISCOUNT' | 'FIXED_PRICE' | 'SPECIAL_PRICE'
    value: number
    startDate: Date
    endDate: Date | null
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
    requesterName: string
    approverName: string | null
    approvedAt: Date | null
    notes: string | null
    createdAt: Date
}

// Default mapping (HORECA + WHOLESALE -> WHOLESALE_DISTRIBUTOR; VIP + DIRECT -> DIRECT_INDIVIDUAL)
const DEFAULT_CHANNEL_MAPPING: Record<string, string> = {
    HORECA: 'WHOLESALE_DISTRIBUTOR',
    WHOLESALE_DISTRIBUTOR: 'WHOLESALE_DISTRIBUTOR',
    VIP_RETAIL: 'DIRECT_INDIVIDUAL',
    DIRECT_INDIVIDUAL: 'DIRECT_INDIVIDUAL',
}

// ─── Get Channel Mapping ─────────────────────────
export async function getChannelPriceMapping(): Promise<Record<string, string>> {
    return cached('pricing:channel_mapping', async () => {
        const config = await prisma.approvalConfig.findUnique({
            where: { configKey: 'pricing.channel_mapping' },
        })
        if (!config || !config.value || typeof config.value !== 'object') {
            return DEFAULT_CHANNEL_MAPPING
        }
        return config.value as Record<string, string>
    }, 60_000)
}

// ─── Save Channel Mapping ────────────────────────
export async function saveChannelPriceMapping(
    mapping: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requirePermission('SLS', 'APPROVE') // Only Managers or Admins
        await prisma.approvalConfig.upsert({
            where: { configKey: 'pricing.channel_mapping' },
            update: { value: mapping, updatedBy: user.name, updatedAt: new Date() },
            create: { configKey: 'pricing.channel_mapping', value: mapping, label: 'Ánh xạ Kênh khách hàng -> Bảng giá mặc định', updatedBy: user.name },
        })
        revalidateCache('pricing')
        revalidatePath('/dashboard/price-list')
        revalidatePath('/dashboard/sales')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── List Price Rules ────────────────────────────
export async function getCustomerPriceRules(filters?: {
    customerId?: string
    status?: string
    ruleType?: string
}): Promise<PriceRuleRow[]> {
    const where: any = {}
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status as any
    if (filters?.ruleType && filters.ruleType !== 'ALL') where.ruleType = filters.ruleType as any

    const rules = await prisma.customerPriceRule.findMany({
        where,
        include: {
            customer: { select: { name: true, code: true, channel: true } },
            product: { select: { productName: true, skuCode: true } },
            requester: { select: { name: true, email: true } },
            approver: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
    })

    return rules.map(r => ({
        id: r.id,
        customerId: r.customerId,
        customerName: r.customer.name,
        customerCode: r.customer.code,
        customerChannel: r.customer.channel,
        productId: r.productId,
        productName: r.product.productName,
        skuCode: r.product.skuCode,
        ruleType: r.ruleType,
        value: Number(r.value),
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
        requesterName: r.requester.name ?? r.requester.email,
        approverName: r.approver ? (r.approver.name ?? r.approver.email) : null,
        approvedAt: r.approvedAt,
        notes: r.notes,
        createdAt: r.createdAt,
    }))
}

// ─── Create Price Rule (Sales Rep đề xuất) ────────
export async function createCustomerPriceRule(input: {
    customerId: string
    productId: string
    ruleType: 'FIXED_DISCOUNT' | 'FIXED_PRICE' | 'SPECIAL_PRICE'
    value: number
    startDate: string
    endDate?: string
    notes?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const user = await requirePermission('SLS', 'CREATE')

        // Validations
        if (input.value < 0) {
            return { success: false, error: 'Giá trị chính sách không được âm' }
        }
        if (input.ruleType === 'FIXED_DISCOUNT' && input.value > 100) {
            return { success: false, error: 'Tỷ lệ chiết khấu không được vượt quá 100%' }
        }

        const startDate = new Date(input.startDate)
        startDate.setHours(0, 0, 0, 0)
        
        const endDate = input.endDate ? new Date(input.endDate) : null
        if (endDate) {
            endDate.setHours(23, 59, 59, 999)
            if (endDate < startDate) {
                return { success: false, error: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu' }
            }
        }

        const rule = await prisma.customerPriceRule.create({
            data: {
                customerId: input.customerId,
                productId: input.productId,
                ruleType: input.ruleType,
                value: input.value,
                startDate,
                endDate,
                notes: input.notes ?? null,
                requestedBy: user.id,
                status: 'PENDING_APPROVAL', // Auto trình duyệt
            },
        })

        logAudit({
            userId: user.id,
            userName: user.name,
            action: 'CREATE',
            entityType: 'CustomerPriceRule',
            entityId: rule.id,
            newValue: { customerId: input.customerId, productId: input.productId, ruleType: input.ruleType, value: input.value, status: 'PENDING_APPROVAL' },
        })

        revalidatePath('/dashboard/price-list')
        return { success: true, id: rule.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Update Price Rule (Chỉ áp dụng cho DRAFT/REJECTED) ──
export async function updateCustomerPriceRule(
    id: string,
    input: {
        ruleType?: 'FIXED_DISCOUNT' | 'FIXED_PRICE' | 'SPECIAL_PRICE'
        value?: number
        startDate?: string
        endDate?: string
        notes?: string
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requirePermission('SLS', 'CREATE')
        const rule = await prisma.customerPriceRule.findUnique({ where: { id } })
        if (!rule) return { success: false, error: 'Chính sách giá không tồn tại' }
        if (rule.status !== 'DRAFT' && rule.status !== 'REJECTED') {
            return { success: false, error: 'Chỉ có sửa chính sách giá nháp hoặc bị từ chối' }
        }

        const currentRuleType = input.ruleType ?? rule.ruleType
        const currentValue = input.value !== undefined ? input.value : Number(rule.value)

        if (currentValue < 0) {
            return { success: false, error: 'Giá trị chính sách không được âm' }
        }
        if (currentRuleType === 'FIXED_DISCOUNT' && currentValue > 100) {
            return { success: false, error: 'Tỷ lệ chiết khấu không được vượt quá 100%' }
        }

        let startDate = rule.startDate
        if (input.startDate) {
            startDate = new Date(input.startDate)
            startDate.setHours(0, 0, 0, 0)
        }

        let endDate = rule.endDate
        if (input.endDate !== undefined) {
            if (input.endDate) {
                endDate = new Date(input.endDate)
                endDate.setHours(23, 59, 59, 999)
            } else {
                endDate = null
            }
        }

        if (endDate && endDate < startDate) {
            return { success: false, error: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu' }
        }

        await prisma.customerPriceRule.update({
            where: { id },
            data: {
                ...(input.ruleType && { ruleType: input.ruleType }),
                ...(input.value !== undefined && { value: input.value }),
                ...(input.startDate && { startDate }),
                ...(input.endDate !== undefined && { endDate }),
                ...(input.notes !== undefined && { notes: input.notes }),
                status: 'PENDING_APPROVAL', // Đưa về trạng thái chờ duyệt sau khi sửa
            },
        })

        revalidatePath('/dashboard/price-list')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Approve Price Rule (Quản lý duyệt) ──────────
export async function approveCustomerPriceRule(
    id: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requirePermission('SLS', 'APPROVE')
        const rule = await prisma.customerPriceRule.findUnique({ where: { id } })
        if (!rule) return { success: false, error: 'Chính sách giá không tồn tại' }
        if (rule.status !== 'PENDING_APPROVAL') {
            return { success: false, error: 'Chính sách giá không ở trạng thái chờ duyệt' }
        }

        await prisma.customerPriceRule.update({
            where: { id },
            data: {
                status: 'APPROVED',
                approvedBy: user.id,
                approvedAt: new Date(),
                notes: notes ? `${rule.notes ? rule.notes + ' | ' : ''}Duyệt: ${notes}` : rule.notes,
            },
        })

        logAudit({
            userId: user.id,
            userName: user.name,
            action: 'APPROVE',
            entityType: 'CustomerPriceRule',
            entityId: id,
            newValue: { status: 'APPROVED' },
        })

        revalidatePath('/dashboard/price-list')
        revalidatePath('/dashboard/sales')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Reject Price Rule (Quản lý từ chối) ──────────
export async function rejectCustomerPriceRule(
    id: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requirePermission('SLS', 'APPROVE')
        const rule = await prisma.customerPriceRule.findUnique({ where: { id } })
        if (!rule) return { success: false, error: 'Chính sách giá không tồn tại' }
        if (rule.status !== 'PENDING_APPROVAL') {
            return { success: false, error: 'Chính sách giá không ở trạng thái chờ duyệt' }
        }

        await prisma.customerPriceRule.update({
            where: { id },
            data: {
                status: 'REJECTED',
                approvedBy: user.id,
                approvedAt: new Date(),
                notes: notes ? `${rule.notes ? rule.notes + ' | ' : ''}Từ chối: ${notes}` : rule.notes,
            },
        })

        logAudit({
            userId: user.id,
            userName: user.name,
            action: 'REJECT',
            entityType: 'CustomerPriceRule',
            entityId: id,
            newValue: { status: 'REJECTED', comment: notes },
        })

        revalidatePath('/dashboard/price-list')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Delete Price Rule ───────────────────────────
export async function deleteCustomerPriceRule(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requirePermission('SLS', 'CREATE')
        const rule = await prisma.customerPriceRule.findUnique({ where: { id } })
        if (!rule) return { success: false, error: 'Chính sách giá không tồn tại' }
        if (rule.status !== 'DRAFT' && rule.status !== 'PENDING_APPROVAL' && rule.status !== 'REJECTED') {
            const hasApprovePermission = await getCurrentUser().then(u => u ? u.permissions.includes('SLS:APPROVE') : false)
            if (!hasApprovePermission) {
                return { success: false, error: 'Chỉ có quản lý mới xóa được chính sách giá đang hoạt động' }
            }
        }

        await prisma.customerPriceRule.delete({ where: { id } })
        revalidatePath('/dashboard/price-list')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── CORE PRICE RESOLUTION ENGINE ────────────────
export type ResolvedPrice = {
    price: number
    source: 'SPECIAL_PRICE' | 'FIXED_PRICE' | 'FIXED_DISCOUNT' | 'CUSTOMER_DEFAULT_DISCOUNT' | 'CHANNEL_BASE' | 'RETAIL_FALLBACK' | 'DEFAULT_ZERO'
    ruleId?: string
    discountPct?: number
    basePrice?: number
}

export async function resolveCustomerProductPrice(
    customerId: string | null | undefined,
    productId: string
): Promise<ResolvedPrice> {
    const now = new Date()

    // 1. Fallback if no customer (retail mode)
    if (!customerId) {
        const retailPrice = await getChannelBasePrice(productId, 'DIRECT_INDIVIDUAL', now)
        if (retailPrice !== null) {
            return { price: retailPrice, source: 'RETAIL_FALLBACK' }
        }
        return { price: 0, source: 'DEFAULT_ZERO' }
    }

    // 2. Fetch Customer Info
    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { channel: true, parentId: true, basePriceType: true, defaultDiscountPct: true },
    })
    const channel = customer?.channel ?? 'DIRECT_INDIVIDUAL'
    const defaultDiscountPct = Number(customer?.defaultDiscountPct ?? 0)

    // 3. Load active mappings or customer basePriceType
    let targetChannel = 'DIRECT_INDIVIDUAL'
    if (customer?.basePriceType === 'WHOLESALE') {
        targetChannel = 'WHOLESALE_DISTRIBUTOR'
    } else if (customer?.basePriceType === 'RETAIL') {
        targetChannel = 'DIRECT_INDIVIDUAL'
    } else if (customer?.basePriceType === 'HORECA') {
        targetChannel = 'HORECA'
    } else {
        const mapping = await getChannelPriceMapping()
        targetChannel = mapping[channel] ?? 'DIRECT_INDIVIDUAL'
    }

    // 4. Fetch base price from price lists
    const basePrice = await getChannelBasePrice(productId, targetChannel, now)

    // 5. Look up active approved price rules
    const customerWhere = customer?.parentId
        ? { in: [customerId, customer.parentId] }
        : customerId

    const allRules = await prisma.customerPriceRule.findMany({
        where: {
            customerId: customerWhere,
            productId,
            status: 'APPROVED',
            startDate: { lte: now },
            OR: [
                { endDate: null },
                { endDate: { gte: now } }
            ]
        },
        orderBy: { createdAt: 'desc' },
    })

    // Filter rules: if the child has any rules, use them. Otherwise, if the parent has rules, use them.
    let rules = allRules
    if (customer?.parentId) {
        const childRules = allRules.filter(r => r.customerId === customerId)
        rules = childRules.length > 0 ? childRules : allRules.filter(r => r.customerId === customer.parentId)
    }

    // Priority 1: SPECIAL_PRICE (Campaign pricing with expiry date)
    const specialRule = rules.find(r => r.ruleType === 'SPECIAL_PRICE')
    if (specialRule) {
        return {
            price: Number(specialRule.value),
            source: 'SPECIAL_PRICE',
            ruleId: specialRule.id,
            basePrice: basePrice ?? undefined,
            discountPct: basePrice && basePrice > 0 ? Math.round(((basePrice - Number(specialRule.value)) / basePrice) * 100) : undefined,
        }
    }

    // Priority 2: FIXED_PRICE
    const fixedPriceRule = rules.find(r => r.ruleType === 'FIXED_PRICE')
    if (fixedPriceRule) {
        return {
            price: Number(fixedPriceRule.value),
            source: 'FIXED_PRICE',
            ruleId: fixedPriceRule.id,
            basePrice: basePrice ?? undefined,
            discountPct: basePrice && basePrice > 0 ? Math.round(((basePrice - Number(fixedPriceRule.value)) / basePrice) * 100) : undefined,
        }
    }

    // Priority 3: FIXED_DISCOUNT (Value is percentage discount off basePrice)
    const fixedDiscountRule = rules.find(r => r.ruleType === 'FIXED_DISCOUNT')
    if (fixedDiscountRule && basePrice !== null) {
        const discPct = Number(fixedDiscountRule.value)
        const price = Math.round(basePrice * (1 - discPct / 100))
        return {
            price,
            source: 'FIXED_DISCOUNT',
            ruleId: fixedDiscountRule.id,
            discountPct: discPct,
            basePrice,
        }
    }

    // Priority 4: Dynamic Customer Default Discount (e.g. Wholesale -10%)
    if (defaultDiscountPct > 0) {
        if (basePrice !== null) {
            const price = Math.round(basePrice * (1 - defaultDiscountPct / 100))
            return {
                price,
                source: 'CUSTOMER_DEFAULT_DISCOUNT',
                discountPct: defaultDiscountPct,
                basePrice,
            }
        }
    }

    // Priority 5: Channel Base
    if (basePrice !== null) {
        return {
            price: basePrice,
            source: 'CHANNEL_BASE',
        }
    }

    // Priority 5.5: Wholesale Margin Fallback for HORECA/Wholesale customers
    const isWholesaleChannel = targetChannel === 'WHOLESALE_DISTRIBUTOR' || channel === 'HORECA' || channel === 'WHOLESALE_DISTRIBUTOR'
    if (isWholesaleChannel) {
        const margin = await prisma.productMarginPrice.findFirst({ where: { productId } })
        if (margin && Number(margin.wholesalePrice) > 0) {
            const rawWholesale = Number(margin.wholesalePrice)
            if (defaultDiscountPct > 0) {
                return {
                    price: Math.round(rawWholesale * (1 - defaultDiscountPct / 100)),
                    source: 'CUSTOMER_DEFAULT_DISCOUNT',
                    discountPct: defaultDiscountPct,
                    basePrice: rawWholesale,
                }
            }
            return {
                price: rawWholesale,
                source: 'CHANNEL_BASE',
            }
        }
    }

    // Priority 6: Retail Fallback
    const retailPrice = await getChannelBasePrice(productId, 'DIRECT_INDIVIDUAL', now)
    if (retailPrice !== null) {
        if (defaultDiscountPct > 0) {
            return {
                price: Math.round(retailPrice * (1 - defaultDiscountPct / 100)),
                source: 'CUSTOMER_DEFAULT_DISCOUNT',
                discountPct: defaultDiscountPct,
                basePrice: retailPrice,
            }
        }
        return {
            price: retailPrice,
            source: 'RETAIL_FALLBACK',
        }
    }

    return { price: 0, source: 'DEFAULT_ZERO' }
}

// Helper to fetch price list line
async function getChannelBasePrice(
    productId: string,
    channel: string,
    date: Date
): Promise<number | null> {
    const priceList = await prisma.priceList.findFirst({
        where: {
            channel: channel as any,
            effectiveDate: { lte: date },
            OR: [
                { expiryDate: null },
                { expiryDate: { gte: date } }
            ]
        },
        include: {
            lines: {
                where: { productId },
                take: 1,
            }
        },
        orderBy: { effectiveDate: 'desc' },
    })

    if (!priceList || priceList.lines.length === 0) return null
    return Number(priceList.lines[0].unitPrice)
}

// ─── Resolve prices for all products for a customer (Optimized Batch) ───
export async function getCustomerResolvedPrices(
    customerId: string | null | undefined
): Promise<Record<string, ResolvedPrice>> {
    const now = new Date()

    // 1. Get products list
    const products = await prisma.product.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true }
    })

    const results: Record<string, ResolvedPrice> = {}
    for (const p of products) {
        results[p.id] = { price: 0, source: 'DEFAULT_ZERO' }
    }

    // 2. Fetch retail fallback price list lines
    const retailPriceList = await prisma.priceList.findFirst({
        where: {
            channel: 'DIRECT_INDIVIDUAL',
            effectiveDate: { lte: now },
            OR: [
                { expiryDate: null },
                { expiryDate: { gte: now } }
            ]
        },
        orderBy: { effectiveDate: 'desc' },
        select: { id: true }
    })
    
    const retailPrices: Record<string, number> = {}
    if (retailPriceList) {
        const lines = await prisma.priceListLine.findMany({
            where: { priceListId: retailPriceList.id },
            select: { productId: true, unitPrice: true }
        })
        for (const l of lines) {
            retailPrices[l.productId] = Number(l.unitPrice)
        }
    }

    // Fetch ProductMarginPrice fallback for products without PriceList lines
    const marginPrices = await prisma.productMarginPrice.findMany({
        select: { productId: true, wholesalePrice: true, retailPrice: true }
    })
    const marginWholesaleMap: Record<string, number> = {}
    const marginRetailMap: Record<string, number> = {}
    for (const m of marginPrices) {
        if (Number(m.wholesalePrice) > 0) marginWholesaleMap[m.productId] = Number(m.wholesalePrice)
        if (Number(m.retailPrice) > 0) marginRetailMap[m.productId] = Number(m.retailPrice)
    }

    if (!customerId) {
        for (const pId of Object.keys(results)) {
            if (retailPrices[pId] !== undefined && retailPrices[pId] > 0) {
                results[pId] = { price: retailPrices[pId], source: 'RETAIL_FALLBACK' }
            } else if (marginRetailMap[pId] !== undefined && marginRetailMap[pId] > 0) {
                results[pId] = { price: marginRetailMap[pId], source: 'RETAIL_FALLBACK' }
            } else if (marginWholesaleMap[pId] !== undefined && marginWholesaleMap[pId] > 0) {
                results[pId] = { price: marginWholesaleMap[pId], source: 'RETAIL_FALLBACK' }
            }
        }
        return results
    }

    // 3. Get customer channel and target price list
    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { channel: true, parentId: true, basePriceType: true, defaultDiscountPct: true }
    })
    const channel = customer?.channel ?? 'DIRECT_INDIVIDUAL'
    const defaultDiscountPct = Number(customer?.defaultDiscountPct ?? 0)

    let targetChannel = 'DIRECT_INDIVIDUAL'
    if (customer?.basePriceType === 'WHOLESALE') {
        targetChannel = 'WHOLESALE_DISTRIBUTOR'
    } else if (customer?.basePriceType === 'RETAIL') {
        targetChannel = 'DIRECT_INDIVIDUAL'
    } else if (customer?.basePriceType === 'HORECA') {
        targetChannel = 'HORECA'
    } else {
        const mapping = await getChannelPriceMapping()
        targetChannel = mapping[channel] ?? 'DIRECT_INDIVIDUAL'
    }
    const isWholesaleChannel = targetChannel === 'WHOLESALE_DISTRIBUTOR' || channel === 'HORECA' || channel === 'WHOLESALE_DISTRIBUTOR'

    // 4. Fetch target channel base price list lines
    const basePrices: Record<string, number> = {}
    if (targetChannel === 'DIRECT_INDIVIDUAL') {
        Object.assign(basePrices, retailPrices)
    } else {
        const basePriceList = await prisma.priceList.findFirst({
            where: {
                channel: targetChannel as any,
                effectiveDate: { lte: now },
                OR: [
                    { expiryDate: null },
                    { expiryDate: { gte: now } }
                ]
            },
            orderBy: { effectiveDate: 'desc' },
            select: { id: true }
        })
        if (basePriceList) {
            const lines = await prisma.priceListLine.findMany({
                where: { priceListId: basePriceList.id },
                select: { productId: true, unitPrice: true }
            })
            for (const l of lines) {
                basePrices[l.productId] = Number(l.unitPrice)
            }
        }
    }

    // Set channel base prices or wholesale margin fallback
    for (const pId of Object.keys(results)) {
        if (basePrices[pId] !== undefined) {
            results[pId] = { price: basePrices[pId], source: 'CHANNEL_BASE' }
        } else if (isWholesaleChannel && marginWholesaleMap[pId] !== undefined) {
            // Priority fallback for HORECA & Wholesale channels: Wholesale margin price
            results[pId] = { price: marginWholesaleMap[pId], source: 'CHANNEL_BASE' }
            basePrices[pId] = marginWholesaleMap[pId]
        } else if (retailPrices[pId] !== undefined && retailPrices[pId] > 0) {
            results[pId] = { price: retailPrices[pId], source: 'RETAIL_FALLBACK' }
        } else if (marginRetailMap[pId] !== undefined && marginRetailMap[pId] > 0) {
            results[pId] = { price: marginRetailMap[pId], source: 'RETAIL_FALLBACK' }
        }
    }

    // 4.5 Apply dynamic customer default discount across all base prices
    if (defaultDiscountPct > 0) {
        for (const pId of Object.keys(results)) {
            const current = results[pId]
            if ((current.source === 'CHANNEL_BASE' || current.source === 'RETAIL_FALLBACK') && current.price > 0) {
                results[pId] = {
                    price: Math.round(current.price * (1 - defaultDiscountPct / 100)),
                    source: 'CUSTOMER_DEFAULT_DISCOUNT',
                    discountPct: defaultDiscountPct,
                    basePrice: current.price,
                }
            }
        }
    }

    // 5. Fetch approved customer price rules for both customer and its parent
    const customerWhere = customer?.parentId
        ? { in: [customerId, customer.parentId] }
        : customerId

    const allRules = await prisma.customerPriceRule.findMany({
        where: {
            customerId: customerWhere,
            status: 'APPROVED',
            startDate: { lte: now },
            OR: [
                { endDate: null },
                { endDate: { gte: now } }
            ]
        },
        orderBy: { createdAt: 'desc' }
    })

    // Filter rules so child rules override parent rules on a per-product basis
    let rules = allRules
    if (customer?.parentId) {
        const childRules = allRules.filter(r => r.customerId === customerId)
        const parentRules = allRules.filter(r => r.customerId === customer.parentId)
        const childRuleProductIds = new Set(childRules.map(r => r.productId))
        rules = [
            ...childRules,
            ...parentRules.filter(r => !childRuleProductIds.has(r.productId))
        ]
    }

    // Apply rules in reverse precedence order so higher priority rules overwrite lower ones
    // 5.1. Apply FIXED_DISCOUNT rules
    const discountRules = rules.filter(r => r.ruleType === 'FIXED_DISCOUNT')
    for (const rule of [...discountRules].reverse()) {
        const pId = rule.productId
        const basePrice = basePrices[pId] ?? retailPrices[pId] ?? null
        if (basePrice !== null) {
            const discPct = Number(rule.value)
            results[pId] = {
                price: Math.round(basePrice * (1 - discPct / 100)),
                source: 'FIXED_DISCOUNT',
                ruleId: rule.id,
                discountPct: discPct,
                basePrice
            }
        }
    }

    // 5.2. Apply FIXED_PRICE rules
    const fixedPriceRules = rules.filter(r => r.ruleType === 'FIXED_PRICE')
    for (const rule of [...fixedPriceRules].reverse()) {
        results[rule.productId] = {
            price: Number(rule.value),
            source: 'FIXED_PRICE',
            ruleId: rule.id
        }
    }

    // 5.3. Apply SPECIAL_PRICE rules (highest priority)
    const specialRules = rules.filter(r => r.ruleType === 'SPECIAL_PRICE')
    for (const rule of [...specialRules].reverse()) {
        results[rule.productId] = {
            price: Number(rule.value),
            source: 'SPECIAL_PRICE',
            ruleId: rule.id
        }
    }

    return results
}

// ─── Fetch active customers for pricing dropdowns ───
export async function getCustomersForRules() {
    return prisma.customer.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true, name: true, code: true, channel: true, brandGroup: true, parentId: true },
        orderBy: { name: 'asc' },
    })
}

// ─── Get Sibling / Related Branches for a Customer ───
export async function getCustomerRelatedBranches(customerId: string) {
    const cust = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, name: true, code: true, brandGroup: true, parentId: true }
    })
    if (!cust) return []

    const parentId = cust.parentId ?? cust.id
    const brandGroup = cust.brandGroup

    const related = await prisma.customer.findMany({
        where: {
            id: { not: customerId },
            deletedAt: null,
            status: 'ACTIVE',
            OR: [
                { parentId: parentId },
                { id: parentId },
                ...(brandGroup ? [{ brandGroup }] : [])
            ]
        },
        select: {
            id: true,
            code: true,
            name: true,
            brandGroup: true,
            channel: true,
            parentId: true,
        },
        orderBy: { code: 'asc' }
    })

    return related
}

// ─── Clone Price Rules to Other Branches / Customers ───
export async function cloneCustomerPriceRules(input: {
    sourceCustomerId: string
    targetCustomerIds: string[]
    ruleIds?: string[]
    overrideExisting?: boolean
}): Promise<{ success: boolean; clonedCount?: number; targetCount?: number; error?: string }> {
    try {
        const user = await requirePermission('SLS', 'CREATE')
        const { sourceCustomerId, targetCustomerIds, ruleIds, overrideExisting = true } = input

        if (!sourceCustomerId || !targetCustomerIds || targetCustomerIds.length === 0) {
            return { success: false, error: 'Vui lòng chọn khách hàng nguồn và ít nhất 1 cơ sở đích' }
        }

        const sourceCustomer = await prisma.customer.findUnique({
            where: { id: sourceCustomerId },
            select: { name: true, code: true }
        })
        if (!sourceCustomer) {
            return { success: false, error: 'Khách hàng nguồn không tồn tại' }
        }

        // Get source rules
        const whereClause: any = {
            customerId: sourceCustomerId,
            status: 'APPROVED',
        }
        if (ruleIds && ruleIds.length > 0) {
            whereClause.id = { in: ruleIds }
        }

        const sourceRules = await prisma.customerPriceRule.findMany({
            where: whereClause,
        })

        if (sourceRules.length === 0) {
            return { success: false, error: 'Khách hàng nguồn không có chính sách giá đã duyệt nào để sao chép' }
        }

        let totalCloned = 0

        for (const targetId of targetCustomerIds) {
            if (targetId === sourceCustomerId) continue

            for (const r of sourceRules) {
                const existing = await prisma.customerPriceRule.findFirst({
                    where: {
                        customerId: targetId,
                        productId: r.productId,
                    }
                })

                const noteText = `Sao chép từ cơ chế giá ${sourceCustomer.name} (${sourceCustomer.code})${r.notes ? ' | ' + r.notes : ''}`

                if (existing) {
                    if (overrideExisting) {
                        await prisma.customerPriceRule.update({
                            where: { id: existing.id },
                            data: {
                                ruleType: r.ruleType,
                                value: r.value,
                                startDate: r.startDate,
                                endDate: r.endDate,
                                status: 'APPROVED',
                                notes: noteText,
                                approvedBy: user.id,
                                approvedAt: new Date(),
                            }
                        })
                        totalCloned++
                    }
                } else {
                    await prisma.customerPriceRule.create({
                        data: {
                            customerId: targetId,
                            productId: r.productId,
                            ruleType: r.ruleType,
                            value: r.value,
                            startDate: r.startDate,
                            endDate: r.endDate,
                            status: 'APPROVED',
                            notes: noteText,
                            requestedBy: user.id,
                            approvedBy: user.id,
                            approvedAt: new Date(),
                        }
                    })
                    totalCloned++
                }
            }
        }

        logAudit({
            userId: user.id,
            userName: user.name,
            action: 'CREATE',
            entityType: 'CustomerPriceRule',
            entityId: sourceCustomerId,
            newValue: {
                action: 'CLONE_RULES',
                sourceCustomerId,
                targetCustomerIds,
                rulesCount: sourceRules.length,
                totalCloned
            }
        })

        revalidateCache('pricing')
        revalidatePath('/dashboard/price-list')
        revalidatePath('/dashboard/sales')
        return { success: true, clonedCount: totalCloned, targetCount: targetCustomerIds.length }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── CUSTOMER PRICING MASTER OVERVIEW & MANAGEMENT (CENTRAL HUB) ───

export type CustomerPricingMasterRow = {
    id: string
    code: string
    name: string
    shortName: string | null
    channel: string
    brandGroup: string | null
    basePriceType: string // 'BY_CHANNEL' | 'WHOLESALE' | 'RETAIL' | 'HORECA'
    defaultDiscountPct: number
    specialRuleCount: number
    pendingRuleCount: number
    activeRulesSummary: {
        id: string
        productName: string
        skuCode: string
        ruleType: string
        value: number
        status: string
        startDate: Date
        endDate: Date | null
    }[]
    updatedAt: Date
}

export type CustomerPricingMasterResult = {
    customers: CustomerPricingMasterRow[]
    kpis: {
        totalCustomers: number
        customPolicyCount: number
        hasSpecialPriceCount: number
        pendingRulesCount: number
    }
}

export async function getCustomerPricingMasterOverview(filters?: {
    search?: string
    channel?: string
    filterType?: 'ALL' | 'HAS_SPECIAL' | 'HAS_CUSTOM_DISCOUNT' | 'PENDING'
}): Promise<CustomerPricingMasterResult> {
    const where: any = { deletedAt: null }
    if (filters?.channel && filters.channel !== 'ALL') {
        where.channel = filters.channel
    }
    if (filters?.search && filters.search.trim()) {
        const s = filters.search.trim()
        where.OR = [
            { name: { contains: s, mode: 'insensitive' } },
            { code: { contains: s, mode: 'insensitive' } },
            { shortName: { contains: s, mode: 'insensitive' } },
        ]
    }

    const customers = await prisma.customer.findMany({
        where,
        select: {
            id: true,
            code: true,
            name: true,
            shortName: true,
            channel: true,
            brandGroup: true,
            basePriceType: true,
            defaultDiscountPct: true,
            updatedAt: true,
            priceRules: {
                select: {
                    id: true,
                    ruleType: true,
                    value: true,
                    status: true,
                    startDate: true,
                    endDate: true,
                    product: { select: { productName: true, skuCode: true } }
                },
                orderBy: { createdAt: 'desc' }
            }
        },
        orderBy: [{ channel: 'asc' }, { name: 'asc' }]
    })

    const now = new Date()

    let totalCustomers = customers.length
    let customPolicyCount = 0
    let hasSpecialPriceCount = 0
    let pendingRulesCount = 0

    const rows: CustomerPricingMasterRow[] = []

    for (const c of customers) {
        const approvedRules = c.priceRules.filter(r => r.status === 'APPROVED' && r.startDate <= now && (!r.endDate || r.endDate >= now))
        const pendingRules = c.priceRules.filter(r => r.status === 'PENDING_APPROVAL')

        const basePriceType = c.basePriceType || 'BY_CHANNEL'
        const defaultDiscountPct = Number(c.defaultDiscountPct || 0)

        const isCustomPolicy = defaultDiscountPct > 0 || (basePriceType !== 'BY_CHANNEL')
        const hasSpecialPrice = approvedRules.length > 0

        if (isCustomPolicy) customPolicyCount++
        if (hasSpecialPrice) hasSpecialPriceCount++
        pendingRulesCount += pendingRules.length

        // Filter by filterType if selected
        if (filters?.filterType === 'HAS_SPECIAL' && !hasSpecialPrice) continue
        if (filters?.filterType === 'HAS_CUSTOM_DISCOUNT' && !isCustomPolicy) continue
        if (filters?.filterType === 'PENDING' && pendingRules.length === 0) continue

        rows.push({
            id: c.id,
            code: c.code,
            name: c.name,
            shortName: c.shortName,
            channel: c.channel,
            brandGroup: c.brandGroup,
            basePriceType,
            defaultDiscountPct,
            specialRuleCount: approvedRules.length,
            pendingRuleCount: pendingRules.length,
            activeRulesSummary: c.priceRules.slice(0, 5).map(r => ({
                id: r.id,
                productName: r.product.productName,
                skuCode: r.product.skuCode,
                ruleType: r.ruleType,
                value: Number(r.value),
                status: r.status,
                startDate: r.startDate,
                endDate: r.endDate,
            })),
            updatedAt: c.updatedAt
        })
    }

    return {
        customers: rows,
        kpis: {
            totalCustomers,
            customPolicyCount,
            hasSpecialPriceCount,
            pendingRulesCount,
        }
    }
}

export async function updateCustomerDefaultPricing(
    customerId: string,
    input: {
        basePriceType: string
        defaultDiscountPct: number
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requirePermission('SLS', 'CREATE')
        if (input.defaultDiscountPct < 0 || input.defaultDiscountPct > 100) {
            return { success: false, error: 'Mức chiết khấu mặc định phải từ 0% đến 100%' }
        }

        const validTypes = ['BY_CHANNEL', 'WHOLESALE', 'RETAIL', 'HORECA']
        if (!validTypes.includes(input.basePriceType)) {
            return { success: false, error: 'Loại bảng giá gốc không hợp lệ' }
        }

        const oldCustomer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { name: true, code: true, basePriceType: true, defaultDiscountPct: true }
        })

        if (!oldCustomer) {
            return { success: false, error: 'Không tìm thấy khách hàng' }
        }

        await prisma.customer.update({
            where: { id: customerId },
            data: {
                basePriceType: input.basePriceType,
                defaultDiscountPct: input.defaultDiscountPct,
            }
        })

        logAudit({
            userId: user.id,
            userName: user.name,
            action: 'UPDATE',
            entityType: 'CustomerPricingPolicy',
            entityId: customerId,
            oldValue: { basePriceType: oldCustomer.basePriceType, defaultDiscountPct: Number(oldCustomer.defaultDiscountPct) },
            newValue: { basePriceType: input.basePriceType, defaultDiscountPct: input.defaultDiscountPct },
        })

        revalidateCache('pricing')
        revalidatePath('/dashboard/price-list')
        revalidatePath('/dashboard/customers')
        revalidatePath('/dashboard/sales')

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getCustomerSpecialPriceDetail(customerId: string) {
    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
            id: true,
            code: true,
            name: true,
            channel: true,
            basePriceType: true,
            defaultDiscountPct: true,
        }
    })
    if (!customer) return null

    const rules = await prisma.customerPriceRule.findMany({
        where: { customerId },
        include: {
            product: { select: { id: true, productName: true, skuCode: true } },
            requester: { select: { name: true, email: true } },
            approver: { select: { name: true, email: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
    })

    const now = new Date()
    const mapping = await getChannelPriceMapping()
    const targetChannel = customer.basePriceType === 'WHOLESALE' ? 'WHOLESALE_DISTRIBUTOR'
        : customer.basePriceType === 'RETAIL' ? 'DIRECT_INDIVIDUAL'
        : customer.basePriceType === 'HORECA' ? 'HORECA'
        : mapping[customer.channel] ?? 'DIRECT_INDIVIDUAL'

    const detailedRules = await Promise.all(rules.map(async r => {
        const basePrice = await getChannelBasePrice(r.productId, targetChannel, now)
        let savingsPct = 0
        let effectivePrice = Number(r.value)
        if (r.ruleType === 'FIXED_DISCOUNT') {
            savingsPct = Number(r.value)
            if (basePrice) effectivePrice = Math.round(basePrice * (1 - savingsPct / 100))
        } else if (basePrice && basePrice > 0) {
            savingsPct = Math.round(((basePrice - effectivePrice) / basePrice) * 100 * 10) / 10
        }

        return {
            id: r.id,
            productId: r.productId,
            productName: r.product.productName,
            skuCode: r.product.skuCode,
            ruleType: r.ruleType,
            value: Number(r.value),
            basePrice,
            effectivePrice,
            savingsPct,
            startDate: r.startDate,
            endDate: r.endDate,
            status: r.status,
            requesterName: r.requester.name ?? r.requester.email,
            approverName: r.approver ? (r.approver.name ?? r.approver.email) : null,
            approvedAt: r.approvedAt,
            notes: r.notes,
            isCurrentlyActive: r.status === 'APPROVED' && r.startDate <= now && (!r.endDate || r.endDate >= now)
        }
    }))

    return {
        customer: {
            ...customer,
            defaultDiscountPct: Number(customer.defaultDiscountPct || 0),
            basePriceType: customer.basePriceType || 'BY_CHANNEL'
        },
        rules: detailedRules
    }
}

