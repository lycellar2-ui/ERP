'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { requireAuth, requirePermission, getCurrentUser, hasRole, hasPermission } from '@/lib/session'
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

// ─── LEVEL 2 POLICY CONFIGURATION & RESOLUTION ───
export type Level2PolicyConfig = {
    customerId: string
    basePriceType: string // 'BY_CHANNEL' | 'WHOLESALE' | 'RETAIL' | 'HORECA'
    discountPct: number
    startDate: string | null
    endDate: string | null
    proposalId?: string | null
    proposalNo?: string | null
    title?: string | null
    approvedBy?: string | null
    approvedAt?: string | null
}

export type EffectiveLevel2Policy = {
    isActive: boolean
    isExpired: boolean
    isInherited: boolean
    inheritedFromCode: string | null
    inheritedFromName: string | null
    basePriceType: string
    discountPct: number
    startDate: Date | null
    endDate: Date | null
    proposalNo: string | null
}

export async function getLevel2PolicyMap(): Promise<Record<string, Level2PolicyConfig>> {
    const configs = await prisma.approvalConfig.findMany({
        where: { configKey: { startsWith: 'pricing.policy_l2.' } },
    })
    const map: Record<string, Level2PolicyConfig> = {}
    for (const c of configs) {
        const custId = c.configKey.replace('pricing.policy_l2.', '')
        if (c.value && typeof c.value === 'object') {
            const val = c.value as any
            map[custId] = {
                customerId: custId,
                basePriceType: val.basePriceType || 'BY_CHANNEL',
                discountPct: Number(val.discountPct ?? 0),
                startDate: val.startDate ?? null,
                endDate: val.endDate ?? null,
                proposalId: val.proposalId ?? null,
                proposalNo: val.proposalNo ?? null,
                title: val.title ?? null,
                approvedBy: val.approvedBy ?? null,
                approvedAt: val.approvedAt ?? null,
            }
        }
    }
    return map
}

function evaluateSingleCustomerL2(
    custId: string,
    dbBasePriceType: string | null | undefined,
    dbDiscountPct: any,
    policyMap: Record<string, Level2PolicyConfig>,
    now: Date
): Omit<EffectiveLevel2Policy, 'isInherited' | 'inheritedFromCode' | 'inheritedFromName'> {
    const cfg = policyMap[custId]
    if (cfg) {
        const start = cfg.startDate ? new Date(cfg.startDate) : null
        const end = cfg.endDate ? new Date(cfg.endDate) : null
        if (end) end.setHours(23, 59, 59, 999)

        const notStarted = Boolean(start && now < start)
        const isExpired = Boolean(end && now > end)

        if (notStarted || isExpired) {
            return {
                isActive: false,
                isExpired,
                basePriceType: 'BY_CHANNEL',
                discountPct: 0,
                startDate: start,
                endDate: end,
                proposalNo: cfg.proposalNo ?? null,
            }
        }

        const disc = Number(cfg.discountPct || 0)
        const base = cfg.basePriceType || 'BY_CHANNEL'
        return {
            isActive: disc > 0 || base !== 'BY_CHANNEL',
            isExpired: false,
            basePriceType: base,
            discountPct: disc,
            startDate: start,
            endDate: end,
            proposalNo: cfg.proposalNo ?? null,
        }
    }

    // Legacy fallback if customer has defaultDiscountPct/basePriceType in DB without ApprovalConfig entry
    const disc = Number(dbDiscountPct || 0)
    const base = dbBasePriceType || 'BY_CHANNEL'
    return {
        isActive: disc > 0 || base !== 'BY_CHANNEL',
        isExpired: false,
        basePriceType: base,
        discountPct: disc,
        startDate: null,
        endDate: null,
        proposalNo: null,
    }
}

function resolveEffectiveLevel2Policy(
    customer: {
        id: string
        basePriceType?: string | null
        defaultDiscountPct?: any
        parentId?: string | null
        parent?: {
            id: string
            code: string
            name: string
            basePriceType?: string | null
            defaultDiscountPct?: any
        } | null
    },
    policyMap: Record<string, Level2PolicyConfig>,
    now: Date
): EffectiveLevel2Policy {
    const selfEval = evaluateSingleCustomerL2(
        customer.id,
        customer.basePriceType,
        customer.defaultDiscountPct,
        policyMap,
        now
    )

    if (selfEval.isActive) {
        return {
            ...selfEval,
            isInherited: false,
            inheritedFromCode: null,
            inheritedFromName: null,
        }
    }

    // Inherit from Parent Company if child has no active Level 2 policy
    if (customer.parent) {
        const parentEval = evaluateSingleCustomerL2(
            customer.parent.id,
            customer.parent.basePriceType,
            customer.parent.defaultDiscountPct,
            policyMap,
            now
        )
        if (parentEval.isActive) {
            return {
                ...parentEval,
                isInherited: true,
                inheritedFromCode: customer.parent.code,
                inheritedFromName: customer.parent.name,
            }
        }
    }

    return {
        ...selfEval,
        isInherited: false,
        inheritedFromCode: null,
        inheritedFromName: null,
    }
}

// ─── CORE 4-LEVEL PRICE RESOLUTION ENGINE ────────
// Priority Order: Level 4 (CTKM) > Level 3 (Special SKU Price) > Level 2 (Customer Portfolio Policy) > Level 1 (Channel Base)
export type PricingLevel = 1 | 2 | 3 | 4
export type ResolvedPrice = {
    price: number
    level?: PricingLevel
    source: 'PROMOTION_PRICE' | 'SPECIAL_PRICE' | 'FIXED_PRICE' | 'FIXED_DISCOUNT' | 'CUSTOMER_DEFAULT_DISCOUNT' | 'CHANNEL_BASE' | 'RETAIL_FALLBACK' | 'DEFAULT_ZERO'
    ruleId?: string
    discountPct?: number
    basePrice?: number
    isInheritedL2?: boolean
}

export async function resolveCustomerProductPrice(
    customerId: string | null | undefined,
    productId: string
): Promise<ResolvedPrice> {
    const now = new Date()

    // 1. Fallback if no customer (retail mode — Level 1)
    if (!customerId) {
        const retailPrice = await getChannelBasePrice(productId, 'DIRECT_INDIVIDUAL', now)
        if (retailPrice !== null) {
            return { price: retailPrice, level: 1, source: 'RETAIL_FALLBACK' }
        }
        return { price: 0, level: 1, source: 'DEFAULT_ZERO' }
    }

    // 2. Fetch Customer + Parent Info & Level 2 Policy Map
    const [customer, policyMap] = await Promise.all([
        prisma.customer.findUnique({
            where: { id: customerId },
            select: {
                id: true,
                channel: true,
                parentId: true,
                basePriceType: true,
                defaultDiscountPct: true,
                parent: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        basePriceType: true,
                        defaultDiscountPct: true,
                    },
                },
            },
        }),
        getLevel2PolicyMap(),
    ])

    const channel = customer?.channel ?? 'DIRECT_INDIVIDUAL'
    const effectiveL2 = customer
        ? resolveEffectiveLevel2Policy(customer, policyMap, now)
        : {
              isActive: false,
              isExpired: false,
              isInherited: false,
              inheritedFromCode: null,
              inheritedFromName: null,
              basePriceType: 'BY_CHANNEL',
              discountPct: 0,
              startDate: null,
              endDate: null,
              proposalNo: null,
          }

    // 3. Determine target base price channel (Level 1 / Level 2 base)
    let targetChannel = 'DIRECT_INDIVIDUAL'
    if (effectiveL2.basePriceType === 'WHOLESALE') {
        targetChannel = 'WHOLESALE_DISTRIBUTOR'
    } else if (effectiveL2.basePriceType === 'RETAIL') {
        targetChannel = 'DIRECT_INDIVIDUAL'
    } else if (effectiveL2.basePriceType === 'HORECA') {
        targetChannel = 'HORECA'
    } else {
        const mapping = await getChannelPriceMapping()
        targetChannel = mapping[channel] ?? 'DIRECT_INDIVIDUAL'
    }

    // 4. Fetch Level 1 Base Price
    const basePrice = await getChannelBasePrice(productId, targetChannel, now)

    // 5. Look up Level 3 — Active approved per-SKU price rules (Child overrides Parent)
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

    let rules = allRules
    if (customer?.parentId) {
        const childRules = allRules.filter(r => r.customerId === customerId)
        rules = childRules.length > 0 ? childRules : allRules.filter(r => r.customerId === customer.parentId)
    }

    // ── LEVEL 3: Per-Product Special Price (CustomerPriceRule) ──
    const specialRule = rules.find(r => r.ruleType === 'SPECIAL_PRICE')
    if (specialRule) {
        return {
            price: Number(specialRule.value),
            level: 3,
            source: 'SPECIAL_PRICE',
            ruleId: specialRule.id,
            basePrice: basePrice ?? undefined,
            discountPct: basePrice && basePrice > 0 ? Math.round(((basePrice - Number(specialRule.value)) / basePrice) * 100) : undefined,
        }
    }

    const fixedPriceRule = rules.find(r => r.ruleType === 'FIXED_PRICE')
    if (fixedPriceRule) {
        return {
            price: Number(fixedPriceRule.value),
            level: 3,
            source: 'FIXED_PRICE',
            ruleId: fixedPriceRule.id,
            basePrice: basePrice ?? undefined,
            discountPct: basePrice && basePrice > 0 ? Math.round(((basePrice - Number(fixedPriceRule.value)) / basePrice) * 100) : undefined,
        }
    }

    const fixedDiscountRule = rules.find(r => r.ruleType === 'FIXED_DISCOUNT')
    if (fixedDiscountRule && basePrice !== null) {
        const discPct = Number(fixedDiscountRule.value)
        const price = Math.round(basePrice * (1 - discPct / 100))
        return {
            price,
            level: 3,
            source: 'FIXED_DISCOUNT',
            ruleId: fixedDiscountRule.id,
            discountPct: discPct,
            basePrice,
        }
    }

    // ── LEVEL 2: Customer Portfolio Pricing Mechanism (Cơ chế giảm % toàn kho) ──
    if (effectiveL2.isActive && effectiveL2.discountPct > 0 && basePrice !== null) {
        const price = Math.round(basePrice * (1 - effectiveL2.discountPct / 100))
        return {
            price,
            level: 2,
            source: 'CUSTOMER_DEFAULT_DISCOUNT',
            discountPct: effectiveL2.discountPct,
            basePrice,
            isInheritedL2: effectiveL2.isInherited,
        }
    }

    // ── LEVEL 1: Channel Base Price ──
    if (basePrice !== null) {
        return {
            price: basePrice,
            level: 1,
            source: 'CHANNEL_BASE',
        }
    }

    // Level 1.5: Wholesale Margin Fallback for HORECA/Wholesale channels
    const isWholesaleChannel = targetChannel === 'WHOLESALE_DISTRIBUTOR' || channel === 'HORECA' || channel === 'WHOLESALE_DISTRIBUTOR'
    if (isWholesaleChannel) {
        const margin = await prisma.productMarginPrice.findFirst({ where: { productId } })
        if (margin && Number(margin.wholesalePrice) > 0) {
            const rawWholesale = Number(margin.wholesalePrice)
            if (effectiveL2.isActive && effectiveL2.discountPct > 0) {
                return {
                    price: Math.round(rawWholesale * (1 - effectiveL2.discountPct / 100)),
                    level: 2,
                    source: 'CUSTOMER_DEFAULT_DISCOUNT',
                    discountPct: effectiveL2.discountPct,
                    basePrice: rawWholesale,
                    isInheritedL2: effectiveL2.isInherited,
                }
            }
            return {
                price: rawWholesale,
                level: 1,
                source: 'CHANNEL_BASE',
            }
        }
    }

    // Level 1 Retail Fallback
    const retailPrice = await getChannelBasePrice(productId, 'DIRECT_INDIVIDUAL', now)
    if (retailPrice !== null) {
        if (effectiveL2.isActive && effectiveL2.discountPct > 0) {
            return {
                price: Math.round(retailPrice * (1 - effectiveL2.discountPct / 100)),
                level: 2,
                source: 'CUSTOMER_DEFAULT_DISCOUNT',
                discountPct: effectiveL2.discountPct,
                basePrice: retailPrice,
                isInheritedL2: effectiveL2.isInherited,
            }
        }
        return {
            price: retailPrice,
            level: 1,
            source: 'RETAIL_FALLBACK',
        }
    }

    return { price: 0, level: 1, source: 'DEFAULT_ZERO' }
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

// ─── Resolve prices for all products for a customer (Optimized Batch: Level 1 -> Level 2 -> Level 3 -> Level 4) ───
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
        results[p.id] = { price: 0, level: 1, source: 'DEFAULT_ZERO' }
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
                results[pId] = { price: retailPrices[pId], level: 1, source: 'RETAIL_FALLBACK' }
            } else if (marginRetailMap[pId] !== undefined && marginRetailMap[pId] > 0) {
                results[pId] = { price: marginRetailMap[pId], level: 1, source: 'RETAIL_FALLBACK' }
            } else if (marginWholesaleMap[pId] !== undefined && marginWholesaleMap[pId] > 0) {
                results[pId] = { price: marginWholesaleMap[pId], level: 1, source: 'RETAIL_FALLBACK' }
            }
        }
        return results
    }

    // 3. Get customer + parent and evaluate Level 2 policy (with expiry & Parent->Child inheritance)
    const [customer, policyMap] = await Promise.all([
        prisma.customer.findUnique({
            where: { id: customerId },
            select: {
                id: true,
                channel: true,
                parentId: true,
                basePriceType: true,
                defaultDiscountPct: true,
                parent: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        basePriceType: true,
                        defaultDiscountPct: true,
                    },
                },
            },
        }),
        getLevel2PolicyMap(),
    ])

    const channel = customer?.channel ?? 'DIRECT_INDIVIDUAL'
    const effectiveL2 = customer
        ? resolveEffectiveLevel2Policy(customer, policyMap, now)
        : {
              isActive: false,
              isExpired: false,
              isInherited: false,
              inheritedFromCode: null,
              inheritedFromName: null,
              basePriceType: 'BY_CHANNEL',
              discountPct: 0,
              startDate: null,
              endDate: null,
              proposalNo: null,
          }

    let targetChannel = 'DIRECT_INDIVIDUAL'
    if (effectiveL2.basePriceType === 'WHOLESALE') {
        targetChannel = 'WHOLESALE_DISTRIBUTOR'
    } else if (effectiveL2.basePriceType === 'RETAIL') {
        targetChannel = 'DIRECT_INDIVIDUAL'
    } else if (effectiveL2.basePriceType === 'HORECA') {
        targetChannel = 'HORECA'
    } else {
        const mapping = await getChannelPriceMapping()
        targetChannel = mapping[channel] ?? 'DIRECT_INDIVIDUAL'
    }
    const isWholesaleChannel = targetChannel === 'WHOLESALE_DISTRIBUTOR' || channel === 'HORECA' || channel === 'WHOLESALE_DISTRIBUTOR'

    // 4. LEVEL 1 — Fetch target channel base price list lines
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

    for (const pId of Object.keys(results)) {
        if (basePrices[pId] !== undefined) {
            results[pId] = { price: basePrices[pId], level: 1, source: 'CHANNEL_BASE' }
        } else if (isWholesaleChannel && marginWholesaleMap[pId] !== undefined) {
            results[pId] = { price: marginWholesaleMap[pId], level: 1, source: 'CHANNEL_BASE' }
            basePrices[pId] = marginWholesaleMap[pId]
        } else if (retailPrices[pId] !== undefined && retailPrices[pId] > 0) {
            results[pId] = { price: retailPrices[pId], level: 1, source: 'RETAIL_FALLBACK' }
        } else if (marginRetailMap[pId] !== undefined && marginRetailMap[pId] > 0) {
            results[pId] = { price: marginRetailMap[pId], level: 1, source: 'RETAIL_FALLBACK' }
        }
    }

    // 5. LEVEL 2 — Apply approved Customer Portfolio Pricing Policy across all SKUs (overwrites Level 1)
    if (effectiveL2.isActive && effectiveL2.discountPct > 0) {
        for (const pId of Object.keys(results)) {
            const current = results[pId]
            if ((current.source === 'CHANNEL_BASE' || current.source === 'RETAIL_FALLBACK') && current.price > 0) {
                results[pId] = {
                    price: Math.round(current.price * (1 - effectiveL2.discountPct / 100)),
                    level: 2,
                    source: 'CUSTOMER_DEFAULT_DISCOUNT',
                    discountPct: effectiveL2.discountPct,
                    basePrice: current.price,
                    isInheritedL2: effectiveL2.isInherited,
                }
            }
        }
    }

    // 6. LEVEL 3 — Apply approved per-SKU Special Price Rules (overwrites Level 2 & Level 1)
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

    const discountRules = rules.filter(r => r.ruleType === 'FIXED_DISCOUNT')
    for (const rule of [...discountRules].reverse()) {
        const pId = rule.productId
        const basePrice = basePrices[pId] ?? retailPrices[pId] ?? null
        if (basePrice !== null) {
            const discPct = Number(rule.value)
            results[pId] = {
                price: Math.round(basePrice * (1 - discPct / 100)),
                level: 3,
                source: 'FIXED_DISCOUNT',
                ruleId: rule.id,
                discountPct: discPct,
                basePrice
            }
        }
    }

    const fixedPriceRules = rules.filter(r => r.ruleType === 'FIXED_PRICE')
    for (const rule of [...fixedPriceRules].reverse()) {
        results[rule.productId] = {
            price: Number(rule.value),
            level: 3,
            source: 'FIXED_PRICE',
            ruleId: rule.id
        }
    }

    const specialRules = rules.filter(r => r.ruleType === 'SPECIAL_PRICE')
    for (const rule of [...specialRules].reverse()) {
        results[rule.productId] = {
            price: Number(rule.value),
            level: 3,
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

export type PendingLevel2ProposalSummary = {
    proposalId: string
    proposalNo: string
    title: string
    proposedBasePriceType: string
    proposedDiscountPct: number
    startDate: string | null
    endDate: string | null
    status: string // 'SUBMITTED' | 'REVIEWING' | 'APPROVED_L1' | 'APPROVED_L2'
    currentLevel: number // 1 (SALES_MGR) | 2 (KE_TOAN) | 3 (CEO)
    creatorName: string
    createdAt: Date
    justification: string
    branchCount: number
    approvalLogs: {
        level: number
        action: string
        approverName: string
        comment: string | null
        approvedAt: Date
    }[]
}

export type CustomerPricingMasterRow = {
    id: string
    code: string
    name: string
    shortName: string | null
    channel: string
    brandGroup: string | null
    parentId: string | null
    parentName: string | null
    basePriceType: string // Effective active basePriceType ('BY_CHANNEL' | 'WHOLESALE' | 'RETAIL' | 'HORECA')
    defaultDiscountPct: number // Effective active discountPct
    effectiveL2: {
        isActive: boolean
        isExpired: boolean
        isInherited: boolean
        inheritedFromCustomerId: string | null
        inheritedFromName: string | null
        inheritedFromCode: string | null
        startDate: string | null
        endDate: string | null
        proposalNo: string | null
        rawBasePriceType: string
        rawDiscountPct: number
    }
    pendingL2Proposal: PendingLevel2ProposalSummary | null
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
        pendingL2Count: number
    }
}

function parsePendingL2Proposal(p: any, fallbackBaseType: string): PendingLevel2ProposalSummary {
    let proposedBasePriceType = fallbackBaseType || 'BY_CHANNEL'
    let branchCount = 0
    if (p.scope) {
        const baseMatch = p.scope.match(/BASE_TYPE:([A-Z_]+)/)
        if (baseMatch && baseMatch[1]) {
            proposedBasePriceType = baseMatch[1]
        }
        const branchMatch = p.scope.match(/BRANCHES:([a-zA-Z0-9_,-]+)/)
        if (branchMatch && branchMatch[1]) {
            branchCount = branchMatch[1].split(',').filter(Boolean).length
        }
    }
    return {
        proposalId: p.id,
        proposalNo: p.proposalNo,
        title: p.title,
        proposedBasePriceType,
        proposedDiscountPct: p.discountPct !== null && p.discountPct !== undefined ? Number(p.discountPct) : 0,
        startDate: p.startDate ? p.startDate.toISOString() : null,
        endDate: p.endDate ? p.endDate.toISOString() : null,
        status: p.status,
        currentLevel: p.currentLevel,
        creatorName: p.creator?.name ?? p.creator?.email ?? 'Sales',
        createdAt: p.createdAt,
        justification: p.justification || '',
        branchCount,
        approvalLogs: (p.approvalLogs || []).map((log: any) => ({
            level: log.level,
            action: log.action,
            approverName: log.approver?.name ?? log.approver?.email ?? 'Leader',
            comment: log.comment,
            approvedAt: log.createdAt,
        })),
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

    const [customers, policyMap, pendingProposals] = await Promise.all([
        prisma.customer.findMany({
            where,
            select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                channel: true,
                brandGroup: true,
                parentId: true,
                parent: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        basePriceType: true,
                        defaultDiscountPct: true,
                    }
                },
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
        }),
        getLevel2PolicyMap(),
        prisma.proposal.findMany({
            where: {
                category: 'PRICE_ADJUSTMENT',
                status: { in: ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'] },
                customerId: { not: null },
            },
            include: {
                creator: { select: { name: true, email: true } },
                approvalLogs: {
                    include: { approver: { select: { name: true, email: true } } },
                    orderBy: { createdAt: 'asc' },
                }
            },
            orderBy: { createdAt: 'desc' }
        })
    ])

    // Map latest pending Level 2 proposal per customer
    const pendingL2ByCustomer = new Map<string, any>()
    for (const p of pendingProposals) {
        const isL2Proposal = p.discountPct !== null || (p.scope && p.scope.includes('BASE_TYPE:'))
        if (!isL2Proposal || !p.customerId) continue
        if (!pendingL2ByCustomer.has(p.customerId)) {
            pendingL2ByCustomer.set(p.customerId, p)
        }
    }

    const now = new Date()

    const totalCustomers = customers.length
    let customPolicyCount = 0
    let hasSpecialPriceCount = 0
    let pendingRulesCount = 0
    const pendingL2Count = pendingL2ByCustomer.size

    const rows: CustomerPricingMasterRow[] = []

    for (const c of customers) {
        const approvedRules = c.priceRules.filter(r => r.status === 'APPROVED' && r.startDate <= now && (!r.endDate || r.endDate >= now))
        const pendingRules = c.priceRules.filter(r => r.status === 'PENDING_APPROVAL')

        const effL2 = resolveEffectiveLevel2Policy(c, policyMap, now)
        const rawBasePriceType = c.basePriceType || 'BY_CHANNEL'
        const rawDiscountPct = Number(c.defaultDiscountPct || 0)

        const isCustomPolicy = effL2.isActive
        const hasSpecialPrice = approvedRules.length > 0
        const pendingL2Raw = pendingL2ByCustomer.get(c.id)
        const pendingL2Proposal = pendingL2Raw ? parsePendingL2Proposal(pendingL2Raw, rawBasePriceType) : null

        if (isCustomPolicy) customPolicyCount++
        if (hasSpecialPrice) hasSpecialPriceCount++
        pendingRulesCount += pendingRules.length

        // Filter by filterType if selected
        if (filters?.filterType === 'HAS_SPECIAL' && !hasSpecialPrice) continue
        if (filters?.filterType === 'HAS_CUSTOM_DISCOUNT' && !isCustomPolicy && !effL2.isExpired) continue
        if (filters?.filterType === 'PENDING' && pendingRules.length === 0 && !pendingL2Proposal) continue

        rows.push({
            id: c.id,
            code: c.code,
            name: c.name,
            shortName: c.shortName,
            channel: c.channel,
            brandGroup: c.brandGroup,
            parentId: c.parentId,
            parentName: c.parent?.name ?? null,
            basePriceType: effL2.basePriceType,
            defaultDiscountPct: effL2.discountPct,
            effectiveL2: {
                isActive: effL2.isActive,
                isExpired: effL2.isExpired,
                isInherited: effL2.isInherited,
                inheritedFromCustomerId: c.parentId ?? null,
                inheritedFromName: effL2.inheritedFromName,
                inheritedFromCode: effL2.inheritedFromCode,
                startDate: effL2.startDate ? effL2.startDate.toISOString() : null,
                endDate: effL2.endDate ? effL2.endDate.toISOString() : null,
                proposalNo: effL2.proposalNo,
                rawBasePriceType,
                rawDiscountPct,
            },
            pendingL2Proposal,
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
            pendingL2Count,
        }
    }
}

// ─── LEVEL 2: CUSTOMER PRICING MECHANISM APPROVAL FLOW (TP.KD -> KE_TOAN -> CEO) ───

export type PendingPricingPolicyL2Row = {
    proposalId: string
    proposalNo: string
    title: string
    customerId: string
    customerCode: string
    customerName: string
    customerChannel: string
    currentActiveBasePriceType: string
    currentActiveDiscountPct: number
    proposedBasePriceType: string
    proposedDiscountPct: number
    startDate: string | null
    endDate: string | null
    status: string
    currentLevel: number
    requiredRole: string
    creatorName: string
    createdAt: Date
    justification: string
    branchIds: string[]
    approvalLogs: {
        level: number
        action: string
        approverName: string
        comment: string | null
        approvedAt: Date
    }[]
}

async function getPriceAdjustmentApprovalConfig(): Promise<{
    creatorRoles: string[]
    steps: { level: number; role: string }[]
}> {
    const config = await prisma.approvalConfig.findUnique({
        where: { configKey: 'proposal.PRICE_ADJUSTMENT' },
    })
    let steps: { level: number; role: string }[] = [
        { level: 1, role: 'SALES_MGR' },
        { level: 2, role: 'KE_TOAN' },
        { level: 3, role: 'CEO' },
    ]
    let creatorRoles: string[] = ['SALES_REP', 'SALES_ADMIN', 'SALES_MGR', 'CBO', 'CEO', 'ADMIN']

    if (config?.value && typeof config.value === 'object') {
        const val = config.value as any
        if (Array.isArray(val.steps) && val.steps.length > 0) {
            steps = val.steps
        } else if (Array.isArray(val.levels) && val.levels.length > 0) {
            steps = (val.levels as number[]).map(l => ({
                level: l,
                role: l === 1 ? 'SALES_MGR' : l === 2 ? 'KE_TOAN' : 'CEO',
            }))
        }
        if (Array.isArray(val.creatorRoles) && val.creatorRoles.length > 0) {
            creatorRoles = val.creatorRoles
        }
    }
    return { creatorRoles, steps }
}

export async function getPendingPricingPoliciesL2(): Promise<PendingPricingPolicyL2Row[]> {
    const [proposals, policyMap, approvalCfg] = await Promise.all([
        prisma.proposal.findMany({
            where: {
                category: 'PRICE_ADJUSTMENT',
                status: { in: ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'] },
                customerId: { not: null },
            },
            include: {
                customer: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        channel: true,
                        basePriceType: true,
                        defaultDiscountPct: true,
                        parentId: true,
                        parent: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                basePriceType: true,
                                defaultDiscountPct: true,
                            }
                        }
                    }
                },
                creator: { select: { name: true, email: true } },
                approvalLogs: {
                    include: { approver: { select: { name: true, email: true } } },
                    orderBy: { createdAt: 'asc' },
                }
            },
            orderBy: { createdAt: 'desc' }
        }),
        getLevel2PolicyMap(),
        getPriceAdjustmentApprovalConfig(),
    ])

    const now = new Date()
    const rows: PendingPricingPolicyL2Row[] = []

    for (const p of proposals) {
        const isL2Proposal = p.discountPct !== null || (p.scope && p.scope.includes('BASE_TYPE:'))
        if (!isL2Proposal || !p.customer) continue

        const effL2 = resolveEffectiveLevel2Policy(p.customer, policyMap, now)
        const parsed = parsePendingL2Proposal(p, p.customer.basePriceType || 'BY_CHANNEL')

        let branchIds: string[] = []
        if (p.scope) {
            const branchMatch = p.scope.match(/BRANCHES:([a-zA-Z0-9_,-]+)/)
            if (branchMatch && branchMatch[1]) {
                branchIds = branchMatch[1].split(',').filter(Boolean)
            }
        }

        const matchedStep = approvalCfg.steps.find(s => s.level === p.currentLevel)
        const requiredRole = matchedStep?.role ?? (p.currentLevel === 1 ? 'SALES_MGR' : p.currentLevel === 2 ? 'KE_TOAN' : 'CEO')

        rows.push({
            proposalId: p.id,
            proposalNo: p.proposalNo,
            title: p.title,
            customerId: p.customer.id,
            customerCode: p.customer.code,
            customerName: p.customer.name,
            customerChannel: p.customer.channel,
            currentActiveBasePriceType: effL2.basePriceType,
            currentActiveDiscountPct: effL2.discountPct,
            proposedBasePriceType: parsed.proposedBasePriceType,
            proposedDiscountPct: parsed.proposedDiscountPct,
            startDate: parsed.startDate,
            endDate: parsed.endDate,
            status: p.status,
            currentLevel: p.currentLevel,
            requiredRole,
            creatorName: parsed.creatorName,
            createdAt: p.createdAt,
            justification: parsed.justification,
            branchIds,
            approvalLogs: parsed.approvalLogs,
        })
    }

    return rows
}

async function generateLevel2ProposalNo(): Promise<string> {
    const year = new Date().getFullYear()
    const prefix = `TT-${year}-`
    const proposals = await prisma.proposal.findMany({
        where: { proposalNo: { startsWith: prefix } },
        select: { proposalNo: true },
    })

    let maxSeq = 0
    for (const p of proposals) {
        const match = p.proposalNo.match(new RegExp(`^TT-${year}-(\\d+)$`))
        if (match && match[1]) {
            const num = parseInt(match[1], 10)
            if (!isNaN(num) && num > maxSeq) maxSeq = num
        }
    }

    let nextSeq = maxSeq + 1
    let proposalNo = `${prefix}${String(nextSeq).padStart(3, '0')}`
    while (await prisma.proposal.findUnique({ where: { proposalNo } })) {
        nextSeq++
        proposalNo = `${prefix}${String(nextSeq).padStart(3, '0')}`
    }
    return proposalNo
}

export async function submitCustomerPricingPolicyL2(
    customerId: string,
    input: {
        basePriceType: string
        defaultDiscountPct: number
        startDate?: string
        endDate?: string
        justification?: string
        applyToBranchIds?: string[]
    }
): Promise<{ success: boolean; proposalNo?: string; error?: string }> {
    try {
        const user = await requireAuth()
        const approvalCfg = await getPriceAdjustmentApprovalConfig()

        // RBAC Guard: Only authorized creator roles or users with SLS:CREATE / PRC:WRITE may submit Level 2 pricing proposals
        const canSubmit =
            hasRole(user, 'CEO', 'ADMIN', ...approvalCfg.creatorRoles) ||
            hasPermission(user, 'SLS', 'CREATE') ||
            hasPermission(user, 'PRC', 'WRITE')

        if (!canSubmit) {
            return {
                success: false,
                error: 'Bạn không có quyền trình đề xuất Cơ chế giá khách hàng (Yêu cầu quyền Sales / Quản lý kinh doanh / Ban Giám Đốc)',
            }
        }

        if (input.defaultDiscountPct < 0 || input.defaultDiscountPct > 100) {
            return { success: false, error: 'Mức chiết khấu toàn kho phải từ 0% đến 100%' }
        }

        const validTypes = ['BY_CHANNEL', 'WHOLESALE', 'RETAIL', 'HORECA']
        if (!validTypes.includes(input.basePriceType)) {
            return { success: false, error: 'Loại bảng giá gốc không hợp lệ' }
        }

        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { id: true, name: true, code: true, basePriceType: true, defaultDiscountPct: true }
        })
        if (!customer) {
            return { success: false, error: 'Không tìm thấy khách hàng' }
        }

        // Check if there is already a pending Level 2 proposal for this customer
        const existingPending = await prisma.proposal.findFirst({
            where: {
                customerId,
                category: 'PRICE_ADJUSTMENT',
                status: { in: ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'] },
            }
        })
        if (existingPending && (existingPending.discountPct !== null || existingPending.scope?.includes('BASE_TYPE:'))) {
            return {
                success: false,
                error: `Khách hàng này đang có Tờ trình cơ chế giá ${existingPending.proposalNo} chờ duyệt (Cấp ${existingPending.currentLevel}). Vui lòng xử lý tờ trình hiện tại trước.`
            }
        }

        const proposalNo = await generateLevel2ProposalNo()
        const startDate = input.startDate ? new Date(input.startDate) : new Date()
        const endDate = input.endDate ? new Date(input.endDate) : null

        const scopeTokens = [`BASE_TYPE:${input.basePriceType}`]
        if (input.applyToBranchIds && input.applyToBranchIds.length > 0) {
            scopeTokens.push(`BRANCHES:${input.applyToBranchIds.join(',')}`)
        }
        const scope = scopeTokens.join(' | ')

        const baseLabel = input.basePriceType === 'WHOLESALE' ? 'Giá Bán Buôn'
            : input.basePriceType === 'RETAIL' ? 'Giá Bán Lẻ'
            : input.basePriceType === 'HORECA' ? 'Giá HORECA'
            : 'Theo Kênh Mặc Định'

        const title = `[Level 2] Cơ chế giá KH ${customer.code} - ${customer.name}: Giảm ${input.defaultDiscountPct}% toàn kho (${baseLabel})`
        const justification = input.justification?.trim() ||
            `Đề xuất áp dụng Cơ chế giá Level 2 cho khách hàng ${customer.name} (${customer.code}): Bảng giá gốc ${baseLabel}, chiết khấu toàn bộ mã sản phẩm ${input.defaultDiscountPct}%.`

        const firstStep = approvalCfg.steps[0] ?? { level: 1, role: 'SALES_MGR' }

        const proposal = await prisma.proposal.create({
            data: {
                proposalNo,
                category: 'PRICE_ADJUSTMENT',
                priority: 'HIGH',
                status: 'SUBMITTED',
                currentLevel: firstStep.level,
                title,
                content: `Cơ chế đang hiệu lực: Bảng giá ${customer.basePriceType || 'BY_CHANNEL'}, chiết khấu toàn kho ${Number(customer.defaultDiscountPct || 0)}%. (Vẫn giữ nguyên hiệu lực cho tới khi tờ trình mới được duyệt hoàn tất).`,
                justification,
                expectedOutcome: `Áp dụng bảng giá ${baseLabel}, giảm ${input.defaultDiscountPct}% trên toàn bộ mã hàng từ ngày ${startDate.toLocaleDateString('vi-VN')}${endDate ? ` đến ${endDate.toLocaleDateString('vi-VN')}` : ' (vô thời hạn)'}.`,
                scope,
                customerId: customer.id,
                discountPct: input.defaultDiscountPct,
                startDate,
                endDate,
                createdBy: user.id,
                submittedAt: new Date(),
            }
        })

        // Notify first-step approver role
        const { triggerNotificationForRole } = await import('@/lib/notifications')
        await triggerNotificationForRole(firstStep.role, {
            title: `Trình duyệt Cơ chế giá Level 2 (${proposalNo})`,
            content: `${user.name || user.email} trình duyệt cơ chế giá giảm ${input.defaultDiscountPct}% toàn kho cho KH ${customer.name}. Chờ duyệt Cấp ${firstStep.level}.`,
            type: 'info',
            link: `/dashboard/price-list`
        })

        logAudit({
            userId: user.id,
            userName: user.name,
            action: 'CREATE',
            entityType: 'CustomerPricingPolicyL2Proposal',
            entityId: proposal.id,
            newValue: {
                proposalNo,
                customerId,
                basePriceType: input.basePriceType,
                defaultDiscountPct: input.defaultDiscountPct,
                startDate: input.startDate ?? null,
                endDate: input.endDate ?? null,
            },
        })

        revalidateCache('pricing')
        revalidateCache('proposals')
        revalidatePath('/dashboard/price-list')
        revalidatePath('/dashboard/proposals')
        revalidatePath('/dashboard/customers')

        return { success: true, proposalNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// Keep backward-compatible signature that routes to 3-step Level 2 approval flow
export async function updateCustomerDefaultPricing(
    customerId: string,
    input: {
        basePriceType: string
        defaultDiscountPct: number
        startDate?: string
        endDate?: string
        justification?: string
        applyToBranchIds?: string[]
    }
): Promise<{ success: boolean; proposalNo?: string; error?: string }> {
    return submitCustomerPricingPolicyL2(customerId, input)
}

export async function approveCustomerPricingPolicyL2(
    proposalId: string,
    comment?: string
): Promise<{ success: boolean; newStatus?: string; error?: string }> {
    const { processProposalApproval } = await import('@/app/dashboard/proposals/actions')
    const user = await requireAuth()
    const res = await processProposalApproval({
        proposalId,
        action: 'APPROVE',
        approverId: user.id,
        comment: comment || 'Đồng ý phê duyệt cơ chế giá Level 2',
    })
    if (res.success) {
        revalidateCache('pricing')
        revalidatePath('/dashboard/price-list')
        revalidatePath('/dashboard/customers')
        revalidatePath('/dashboard/sales')
    }
    return res
}

export async function rejectCustomerPricingPolicyL2(
    proposalId: string,
    comment?: string
): Promise<{ success: boolean; newStatus?: string; error?: string }> {
    const { processProposalApproval } = await import('@/app/dashboard/proposals/actions')
    const user = await requireAuth()
    const res = await processProposalApproval({
        proposalId,
        action: 'REJECT',
        approverId: user.id,
        comment: comment || 'Từ chối tờ trình cơ chế giá Level 2',
    })
    if (res.success) {
        revalidateCache('pricing')
        revalidatePath('/dashboard/price-list')
    }
    return res
}

export async function getCustomerSpecialPriceDetail(customerId: string) {
    const [customer, childBranches, policyMap, pendingProposals] = await Promise.all([
        prisma.customer.findUnique({
            where: { id: customerId },
            select: {
                id: true,
                code: true,
                name: true,
                channel: true,
                parentId: true,
                parent: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        basePriceType: true,
                        defaultDiscountPct: true,
                    }
                },
                basePriceType: true,
                defaultDiscountPct: true,
            }
        }),
        prisma.customer.findMany({
            where: { parentId: customerId, deletedAt: null },
            select: {
                id: true,
                code: true,
                name: true,
                channel: true,
            }
        }),
        getLevel2PolicyMap(),
        prisma.proposal.findMany({
            where: {
                customerId,
                category: 'PRICE_ADJUSTMENT',
                status: { in: ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'] },
            },
            include: {
                creator: { select: { name: true, email: true } },
                approvalLogs: {
                    include: { approver: { select: { name: true, email: true } } },
                    orderBy: { createdAt: 'asc' },
                }
            },
            orderBy: { createdAt: 'desc' }
        })
    ])
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
    const effL2 = resolveEffectiveLevel2Policy(customer, policyMap, now)
    const pendingL2Raw = pendingProposals.find(p => p.discountPct !== null || (p.scope && p.scope.includes('BASE_TYPE:')))
    const pendingL2Proposal = pendingL2Raw ? parsePendingL2Proposal(pendingL2Raw, customer.basePriceType || 'BY_CHANNEL') : null

    const mapping = await getChannelPriceMapping()
    const targetChannel = effL2.basePriceType === 'WHOLESALE' ? 'WHOLESALE_DISTRIBUTOR'
        : effL2.basePriceType === 'RETAIL' ? 'DIRECT_INDIVIDUAL'
        : effL2.basePriceType === 'HORECA' ? 'HORECA'
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
            id: customer.id,
            code: customer.code,
            name: customer.name,
            channel: customer.channel,
            parentId: customer.parentId,
            parentName: customer.parent?.name ?? null,
            parentCode: customer.parent?.code ?? null,
            defaultDiscountPct: effL2.discountPct,
            basePriceType: effL2.basePriceType,
            effectiveL2: {
                isActive: effL2.isActive,
                isExpired: effL2.isExpired,
                isInherited: effL2.isInherited,
                inheritedFromCustomerId: customer.parentId ?? null,
                inheritedFromName: effL2.inheritedFromName,
                inheritedFromCode: effL2.inheritedFromCode,
                startDate: effL2.startDate ? effL2.startDate.toISOString() : null,
                endDate: effL2.endDate ? effL2.endDate.toISOString() : null,
                proposalNo: effL2.proposalNo,
                rawBasePriceType: customer.basePriceType || 'BY_CHANNEL',
                rawDiscountPct: Number(customer.defaultDiscountPct || 0),
            },
            pendingL2Proposal,
            branches: childBranches.map(b => ({
                id: b.id,
                code: b.code,
                name: b.name,
                channel: b.channel,
            })),
        },
        rules: detailedRules
    }
}


