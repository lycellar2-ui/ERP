'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'
import { requirePermission } from '@/lib/session'

import {
    type StepRoleConfig,
    type ProposalRouteConfig,
    type ThresholdConfig,
    type SystemRoleInfo,
    type PORouteConfig,
    type ApprovalMatrixData,
    DEFAULT_PO_ROUTING,
    SYSTEM_ROLES,
    DEFAULT_ROUTING_FULL,
    DEFAULT_THRESHOLDS,
} from './constants'

// ─── Load full approval matrix ───────────────────
export async function getApprovalMatrix(): Promise<ApprovalMatrixData> {
    await requirePermission('SYS', 'ADMIN')
    return cached('settings:approvalMatrix', async () => {
        const configs = await prisma.approvalConfig.findMany()
        const configMap = new Map(configs.map(c => [c.configKey, c.value]))

        // Build proposal routes
        const proposalRoutes: ProposalRouteConfig[] = Object.entries(DEFAULT_ROUTING_FULL).map(([category, defaultCfg]) => {
            const dbValue = configMap.get(`proposal.${category}`)
            if (dbValue && typeof dbValue === 'object') {
                const val = dbValue as any
                let steps: StepRoleConfig[] = []
                if (Array.isArray(val.steps)) {
                    steps = val.steps
                } else if (Array.isArray(val.levels)) {
                    // Legacy fallback: convert number[] to StepRoleConfig[]
                    steps = (val.levels as number[]).map(l => ({
                        level: l,
                        role: l === 1 ? 'SALES_MGR' : l === 2 ? 'KE_TOAN' : 'CEO',
                    }))
                } else {
                    steps = defaultCfg.steps
                }

                const creatorRoles: string[] = Array.isArray(val.creatorRoles) ? val.creatorRoles : defaultCfg.creatorRoles
                return { category, creatorRoles, steps }
            }
            return defaultCfg
        })

        // Build PO route
        const dbPoValue = configMap.get('procurement.purchase_order')
        let poRoute: PORouteConfig = DEFAULT_PO_ROUTING
        if (dbPoValue && typeof dbPoValue === 'object') {
            const val = dbPoValue as any
            const creatorRoles: string[] = Array.isArray(val.creatorRoles) ? val.creatorRoles : DEFAULT_PO_ROUTING.creatorRoles
            const steps: StepRoleConfig[] = Array.isArray(val.steps) && val.steps.length > 0 ? val.steps : DEFAULT_PO_ROUTING.steps
            poRoute = { creatorRoles, steps }
        }

        // Build thresholds
        const thresholds: ThresholdConfig[] = DEFAULT_THRESHOLDS.map(dt => {
            const dbValue = configMap.get(dt.key)
            const value = dbValue && typeof dbValue === 'object' && 'threshold' in (dbValue as any)
                ? (dbValue as any).threshold as number
                : dt.value
            return { ...dt, value }
        })

        return { proposalRoutes, poRoute, thresholds, availableRoles: SYSTEM_ROLES }
    }, 120_000)
}

// ─── Save PO route ───────────────────────────────
export async function savePORoute(
    poRouteConfig: PORouteConfig
): Promise<{ success: boolean; error?: string }> {
    try {
        await requirePermission('SYS', 'ADMIN')
        const key = 'procurement.purchase_order'
        await prisma.approvalConfig.upsert({
            where: { configKey: key },
            update: {
                value: {
                    creatorRoles: poRouteConfig.creatorRoles,
                    steps: poRouteConfig.steps,
                } as any,
                updatedAt: new Date()
            },
            create: {
                configKey: key,
                value: {
                    creatorRoles: poRouteConfig.creatorRoles,
                    steps: poRouteConfig.steps,
                } as any,
                label: 'Đơn mua hàng (PO)'
            }
        })
        revalidateCache('settings')
        revalidateCache('procurement')
        revalidatePath('/dashboard/settings/approval-matrix')
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Save single proposal route ──────────────────
export async function saveProposalRoute(
    category: string,
    routeConfig: ProposalRouteConfig,
): Promise<{ success: boolean; error?: string }> {
    try {
        await requirePermission('SYS', 'ADMIN')
        const key = `proposal.${category}`
        await prisma.approvalConfig.upsert({
            where: { configKey: key },
            update: {
                value: {
                    creatorRoles: routeConfig.creatorRoles,
                    steps: routeConfig.steps,
                } as any,
                updatedAt: new Date()
            },
            create: {
                configKey: key,
                value: {
                    creatorRoles: routeConfig.creatorRoles,
                    steps: routeConfig.steps,
                } as any,
                label: `Tờ trình: ${category}`
            },
        })
        revalidateCache('settings')
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
        await requirePermission('SYS', 'ADMIN')
        await prisma.approvalConfig.upsert({
            where: { configKey: key },
            update: { value: { threshold: value } as any, updatedAt: new Date() },
            create: { configKey: key, value: { threshold: value } as any, label: key },
        })
        revalidateCache('settings')
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
        await requirePermission('SYS', 'ADMIN')
        for (const r of routes) {
            const key = `proposal.${r.category}`
            await prisma.approvalConfig.upsert({
                where: { configKey: key },
                update: {
                    value: {
                        creatorRoles: r.creatorRoles,
                        steps: r.steps,
                    } as any,
                    updatedAt: new Date()
                },
                create: {
                    configKey: key,
                    value: {
                        creatorRoles: r.creatorRoles,
                        steps: r.steps,
                    } as any,
                    label: `Tờ trình: ${r.category}`
                },
            })
        }
        revalidateCache('settings')
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
        await requirePermission('SYS', 'ADMIN')
        for (const t of thresholds) {
            await prisma.approvalConfig.upsert({
                where: { configKey: t.key },
                update: { value: { threshold: t.value }, updatedAt: new Date() },
                create: { configKey: t.key, value: { threshold: t.value }, label: t.label },
            })
        }
        revalidateCache('settings')
        revalidatePath('/dashboard/settings/approval-matrix')
        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
