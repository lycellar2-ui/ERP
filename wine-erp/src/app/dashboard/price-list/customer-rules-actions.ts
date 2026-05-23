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
    source: 'SPECIAL_PRICE' | 'FIXED_PRICE' | 'FIXED_DISCOUNT' | 'CHANNEL_BASE' | 'RETAIL_FALLBACK' | 'DEFAULT_ZERO'
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
        select: { channel: true },
    })
    const channel = customer?.channel ?? 'DIRECT_INDIVIDUAL'

    // 3. Load active mappings
    const mapping = await getChannelPriceMapping()
    const targetChannel = mapping[channel] ?? 'DIRECT_INDIVIDUAL'

    // 4. Fetch base price from price lists
    const basePrice = await getChannelBasePrice(productId, targetChannel, now)

    // 5. Look up active approved price rules
    const rules = await prisma.customerPriceRule.findMany({
        where: {
            customerId,
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

    // Priority 1: SPECIAL_PRICE (Campaign pricing with expiry date)
    const specialRule = rules.find(r => r.ruleType === 'SPECIAL_PRICE')
    if (specialRule) {
        return {
            price: Number(specialRule.value),
            source: 'SPECIAL_PRICE',
            ruleId: specialRule.id,
        }
    }

    // Priority 2: FIXED_PRICE
    const fixedPriceRule = rules.find(r => r.ruleType === 'FIXED_PRICE')
    if (fixedPriceRule) {
        return {
            price: Number(fixedPriceRule.value),
            source: 'FIXED_PRICE',
            ruleId: fixedPriceRule.id,
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

    // Priority 4: Channel Base
    if (basePrice !== null) {
        return {
            price: basePrice,
            source: 'CHANNEL_BASE',
        }
    }

    // Priority 5: Retail Fallback
    const retailPrice = await getChannelBasePrice(productId, 'DIRECT_INDIVIDUAL', now)
    if (retailPrice !== null) {
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

    // Set initial fallback values
    for (const pId of Object.keys(results)) {
        if (retailPrices[pId] !== undefined) {
            results[pId] = { price: retailPrices[pId], source: 'RETAIL_FALLBACK' }
        }
    }

    if (!customerId) {
        return results
    }

    // 3. Get customer channel and target price list
    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { channel: true }
    })
    const channel = customer?.channel ?? 'DIRECT_INDIVIDUAL'
    const mapping = await getChannelPriceMapping()
    const targetChannel = mapping[channel] ?? 'DIRECT_INDIVIDUAL'

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

    // Set channel base prices
    for (const pId of Object.keys(results)) {
        if (basePrices[pId] !== undefined) {
            results[pId] = { price: basePrices[pId], source: 'CHANNEL_BASE' }
        }
    }

    // 5. Fetch approved customer price rules
    const rules = await prisma.customerPriceRule.findMany({
        where: {
            customerId,
            status: 'APPROVED',
            startDate: { lte: now },
            OR: [
                { endDate: null },
                { endDate: { gte: now } }
            ]
        },
        orderBy: { createdAt: 'desc' }
    })

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
        select: { id: true, name: true, code: true, channel: true },
        orderBy: { name: 'asc' },
    })
}
