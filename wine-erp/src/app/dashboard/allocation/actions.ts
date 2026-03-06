'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'

export type AllocationCampaignRow = {
    id: string; name: string; productId: string; skuCode: string; productName: string
    totalQty: number; unit: string; startDate: Date; endDate: Date; status: string
    allocatedQty: number; soldQty: number; quotaCount: number
}

export type AllocationQuotaRow = {
    id: string; campaignId: string; targetType: string; targetId: string; targetName: string
    qtyAllocated: number; qtySold: number; remaining: number; pctUsed: number
}

// ─── Get all campaigns ────────────────────────────
export async function getAllocCampaigns(): Promise<AllocationCampaignRow[]> {
    return cached('allocation:campaigns', async () => {
        const campaigns = await prisma.allocationCampaign.findMany({
            include: {
                product: { select: { skuCode: true, productName: true } },
                quotas: { select: { qtyAllocated: true, qtySold: true } },
            },
            orderBy: { createdAt: 'desc' },
        })

        return campaigns.map(c => ({
            id: c.id,
            name: c.name,
            productId: c.productId,
            skuCode: c.product.skuCode,
            productName: c.product.productName,
            totalQty: Number(c.totalQty),
            unit: c.unit,
            startDate: c.startDate,
            endDate: c.endDate,
            status: c.status,
            allocatedQty: c.quotas.reduce((s, q) => s + Number(q.qtyAllocated), 0),
            soldQty: c.quotas.reduce((s, q) => s + Number(q.qtySold), 0),
            quotaCount: c.quotas.length,
        }))
    }) // end cached
}

// ─── Get quotas for a campaign ────────────────────
export async function getAllocQuotas(campaignId: string): Promise<AllocationQuotaRow[]> {
    const quotas = await prisma.allocationQuota.findMany({
        where: { campaignId },
        orderBy: { qtyAllocated: 'desc' },
    })

    const result: AllocationQuotaRow[] = []
    for (const q of quotas) {
        let targetName = q.targetId
        if (q.targetType === 'SALES_REP') {
            const user = await prisma.user.findUnique({ where: { id: q.targetId }, select: { name: true } })
            targetName = user?.name ?? q.targetId
        } else if (q.targetType === 'CUSTOMER') {
            const cust = await prisma.customer.findUnique({ where: { id: q.targetId }, select: { name: true } })
            targetName = cust?.name ?? q.targetId
        }
        const alloc = Number(q.qtyAllocated)
        const sold = Number(q.qtySold)
        result.push({
            id: q.id,
            campaignId: q.campaignId,
            targetType: q.targetType,
            targetId: q.targetId,
            targetName,
            qtyAllocated: alloc,
            qtySold: sold,
            remaining: alloc - sold,
            pctUsed: alloc > 0 ? (sold / alloc) * 100 : 0,
        })
    }
    return result
}

// ─── Stats ────────────────────────────────────────
export async function getAllocStats() {
    return cached('allocation:stats', async () => {
        const [total, active] = await Promise.all([
            prisma.allocationCampaign.count(),
            prisma.allocationCampaign.count({ where: { status: 'ACTIVE' } }),
        ])
        return { total, active }
    }) // end cached
}

// ─── Create Campaign ──────────────────────────────
export async function createAllocCampaign(input: {
    name: string; productId: string; totalQty: number; unit: string
    startDate: string; endDate: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.allocationCampaign.create({
            data: {
                name: input.name,
                productId: input.productId,
                totalQty: input.totalQty,
                unit: input.unit as any,
                startDate: new Date(input.startDate),
                endDate: new Date(input.endDate),
            },
        })
        revalidateCache('allocation')
        revalidatePath('/dashboard/allocation')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Add Quota ────────────────────────────────────
export async function addAllocQuota(input: {
    campaignId: string; targetType: string; targetId: string; qtyAllocated: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.allocationQuota.create({
            data: {
                campaignId: input.campaignId,
                targetType: input.targetType as any,
                targetId: input.targetId,
                qtyAllocated: input.qtyAllocated,
            },
        })
        revalidateCache('allocation')
        revalidatePath('/dashboard/allocation')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Product / User / Customer options ────────────
export async function getAllocOptions() {
    const [products, users, customers] = await Promise.all([
        prisma.product.findMany({ where: { status: 'ACTIVE' }, select: { id: true, skuCode: true, productName: true }, orderBy: { skuCode: 'asc' } }),
        prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.customer.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),
    ])
    return { products, users, customers }
}
