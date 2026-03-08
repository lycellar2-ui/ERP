'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// ─── Types ───────────────────────────────────────
export interface ProposalRouteConfig {
    category: string
    levels: number[] // [1,2,3] = TP → KT → CEO
}

export interface ThresholdConfig {
    key: string
    label: string
    value: number
    description: string
}

export interface ApprovalMatrixData {
    proposalRoutes: ProposalRouteConfig[]
    thresholds: ThresholdConfig[]
}

// Default routing (fallback when no DB config exists)
const DEFAULT_ROUTING: Record<string, number[]> = {
    BUDGET_REQUEST: [1, 2, 3],
    CAPITAL_EXPENDITURE: [1, 2, 3],
    PRICE_ADJUSTMENT: [1, 2, 3],
    NEW_SUPPLIER: [1, 3],
    NEW_PRODUCT: [1, 3],
    POLICY_CHANGE: [3],
    STAFF_REQUISITION: [1, 3],
    PAYMENT_SCHEDULE: [2, 3],
    PROMOTION_CAMPAIGN: [1, 2, 3],
    SPECIAL_EVENT: [1, 2, 3],
    LICENSE_RENEWAL: [2, 3],
    CONTRACT_SIGNING: [2, 3],
    DEBT_WRITE_OFF: [2, 3],
    OTHER: [1, 3],
}

const DEFAULT_THRESHOLDS: ThresholdConfig[] = [
    { key: 'so.amount_threshold', label: 'SO: Giá trị cần CEO duyệt', value: 100_000_000, description: 'Đơn bán ≥ mức này → chuyển CEO phê duyệt' },
    { key: 'so.discount_threshold', label: 'SO: % Chiết khấu cần duyệt', value: 15, description: '% Chiết khấu > mức này → cần CEO phê duyệt' },
    { key: 'po.amount_threshold', label: 'PO: Giá trị cần CEO duyệt', value: 200_000_000, description: 'Đơn mua ≥ mức này → chuyển CEO phê duyệt' },
    { key: 'proposal.amount_auto_ceo', label: 'Tờ Trình: Giá trị lên CEO trực tiếp', value: 500_000_000, description: 'Tờ trình ≥ mức này → skip cấp trung, lên CEO trực tiếp' },
]

// ─── Load full approval matrix ───────────────────
export async function getApprovalMatrix(): Promise<ApprovalMatrixData> {
    const configs = await prisma.approvalConfig.findMany()
    const configMap = new Map(configs.map(c => [c.configKey, c.value]))

    // Build proposal routes
    const proposalRoutes: ProposalRouteConfig[] = Object.entries(DEFAULT_ROUTING).map(([category, defaultLevels]) => {
        const dbValue = configMap.get(`proposal.${category}`)
        const levels = dbValue && typeof dbValue === 'object' && 'levels' in (dbValue as any)
            ? (dbValue as any).levels as number[]
            : defaultLevels
        return { category, levels }
    })

    // Build thresholds
    const thresholds: ThresholdConfig[] = DEFAULT_THRESHOLDS.map(dt => {
        const dbValue = configMap.get(dt.key)
        const value = dbValue && typeof dbValue === 'object' && 'threshold' in (dbValue as any)
            ? (dbValue as any).threshold as number
            : dt.value
        return { ...dt, value }
    })

    return { proposalRoutes, thresholds }
}

// ─── Save proposal routing ───────────────────────
export async function saveProposalRoute(
    category: string,
    levels: number[],
): Promise<{ success: boolean; error?: string }> {
    try {
        const key = `proposal.${category}`
        await prisma.approvalConfig.upsert({
            where: { configKey: key },
            update: { value: { levels }, updatedAt: new Date() },
            create: { configKey: key, value: { levels }, label: `Tờ trình: ${category}` },
        })
        revalidatePath('/dashboard/settings/approval-matrix')
        revalidatePath('/dashboard/proposals')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Save threshold ──────────────────────────────
export async function saveThreshold(
    key: string,
    value: number,
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.approvalConfig.upsert({
            where: { configKey: key },
            update: { value: { threshold: value }, updatedAt: new Date() },
            create: { configKey: key, value: { threshold: value }, label: key },
        })
        revalidatePath('/dashboard/settings/approval-matrix')
        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Bulk save all routes ────────────────────────
export async function saveAllRoutes(
    routes: ProposalRouteConfig[],
): Promise<{ success: boolean; error?: string }> {
    try {
        for (const r of routes) {
            const key = `proposal.${r.category}`
            await prisma.approvalConfig.upsert({
                where: { configKey: key },
                update: { value: { levels: r.levels }, updatedAt: new Date() },
                create: { configKey: key, value: { levels: r.levels }, label: `Tờ trình: ${r.category}` },
            })
        }
        revalidatePath('/dashboard/settings/approval-matrix')
        revalidatePath('/dashboard/proposals')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Bulk save thresholds ────────────────────────
export async function saveAllThresholds(
    thresholds: ThresholdConfig[],
): Promise<{ success: boolean; error?: string }> {
    try {
        for (const t of thresholds) {
            await prisma.approvalConfig.upsert({
                where: { configKey: t.key },
                update: { value: { threshold: t.value }, updatedAt: new Date() },
                create: { configKey: t.key, value: { threshold: t.value }, label: t.label },
            })
        }
        revalidatePath('/dashboard/settings/approval-matrix')
        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
