'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'
import { requirePermission } from '@/lib/session'

// ─── Types ───────────────────────────────────────
export interface StepRoleConfig {
    level: number
    role: string // e.g. 'SALES_MGR', 'KE_TOAN', 'CEO', 'THU_MUA', 'SALES_REP', 'SALES_ADMIN', 'ADMIN'
    label?: string
}

export interface ProposalRouteConfig {
    category: string
    creatorRoles: string[] // Roles allowed to CREATE this proposal (empty = All roles)
    steps: StepRoleConfig[] // List of approval steps in order
}

export interface ThresholdConfig {
    key: string
    label: string
    value: number
    description: string
}

export interface SystemRoleInfo {
    code: string
    name: string
}

export interface ApprovalMatrixData {
    proposalRoutes: ProposalRouteConfig[]
    thresholds: ThresholdConfig[]
    availableRoles: SystemRoleInfo[]
}

// Available system roles for selection
const SYSTEM_ROLES: SystemRoleInfo[] = [
    { code: 'SALES_REP', name: 'Sales Rep (Kinh doanh)' },
    { code: 'SALES_ADMIN', name: 'Sales Admin (Hỗ trợ KD)' },
    { code: 'SALES_MGR', name: 'Trưởng Phòng Kinh Doanh (CBO)' },
    { code: 'KE_TOAN', name: 'Kế Toán / GĐ Tài Chính' },
    { code: 'THU_MUA', name: 'Trưởng / NV Mua Hàng' },
    { code: 'THU_KHO', name: 'Thủ Kho' },
    { code: 'CEO', name: 'Tổng Giám Đốc (CEO)' },
    { code: 'OPERATION_MGR', name: 'Operation Manager' },
    { code: 'ADMIN', name: 'Admin Hệ Thống' },
]

// Default routing (fallback when no DB config exists)
const DEFAULT_ROUTING_FULL: Record<string, ProposalRouteConfig> = {
    TASTING: {
        category: 'TASTING',
        creatorRoles: ['SALES_REP', 'SALES_ADMIN', 'SALES_MGR', 'ADMIN'],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Quản Lý Kinh Doanh' },
            { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng / Vận Hành' },
            { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    PRICE_ADJUSTMENT: {
        category: 'PRICE_ADJUSTMENT',
        creatorRoles: ['SALES_REP', 'SALES_ADMIN', 'SALES_MGR', 'ADMIN'],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng Kinh Doanh' },
            { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    BUDGET_REQUEST: {
        category: 'BUDGET_REQUEST',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng' },
            { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    CAPITAL_EXPENDITURE: {
        category: 'CAPITAL_EXPENDITURE',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng' },
            { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    NEW_SUPPLIER: {
        category: 'NEW_SUPPLIER',
        creatorRoles: ['THU_MUA', 'ADMIN'],
        steps: [
            { level: 1, role: 'THU_MUA', label: 'Trưởng Phòng Mua Hàng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    NEW_PRODUCT: {
        category: 'NEW_PRODUCT',
        creatorRoles: ['THU_MUA', 'SALES_MGR', 'ADMIN'],
        steps: [
            { level: 1, role: 'THU_MUA', label: 'Trưởng Phòng Mua Hàng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    POLICY_CHANGE: {
        category: 'POLICY_CHANGE',
        creatorRoles: ['CEO', 'ADMIN'],
        steps: [
            { level: 1, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    STAFF_REQUISITION: {
        category: 'STAFF_REQUISITION',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    PAYMENT_SCHEDULE: {
        category: 'PAYMENT_SCHEDULE',
        creatorRoles: ['KE_TOAN', 'ADMIN'],
        steps: [
            { level: 1, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    PROMOTION_CAMPAIGN: {
        category: 'PROMOTION_CAMPAIGN',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng' },
            { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    SPECIAL_EVENT: {
        category: 'SPECIAL_EVENT',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng' },
            { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    LICENSE_RENEWAL: {
        category: 'LICENSE_RENEWAL',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    CONTRACT_SIGNING: {
        category: 'CONTRACT_SIGNING',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    DEBT_WRITE_OFF: {
        category: 'DEBT_WRITE_OFF',
        creatorRoles: ['KE_TOAN', 'ADMIN'],
        steps: [
            { level: 1, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    OTHER: {
        category: 'OTHER',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
}

const DEFAULT_THRESHOLDS: ThresholdConfig[] = [
    { key: 'so.amount_threshold', label: 'SO: Giá trị cần CEO duyệt', value: 100_000_000, description: 'Đơn bán ≥ mức này → chuyển CEO phê duyệt' },
    { key: 'so.discount_threshold', label: 'SO: % Chiết khấu cần duyệt', value: 15, description: '% Chiết khấu > mức này → cần CEO phê duyệt' },
    { key: 'po.amount_threshold', label: 'PO: Giá trị cần CEO duyệt', value: 200_000_000, description: 'Đơn mua ≥ mức này → chuyển CEO phê duyệt' },
    { key: 'proposal.amount_auto_ceo', label: 'Tờ Trình: Giá trị lên CEO trực tiếp', value: 500_000_000, description: 'Tờ trình ≥ mức này → skip cấp trung, lên CEO trực tiếp' },
]

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

        // Build thresholds
        const thresholds: ThresholdConfig[] = DEFAULT_THRESHOLDS.map(dt => {
            const dbValue = configMap.get(dt.key)
            const value = dbValue && typeof dbValue === 'object' && 'threshold' in (dbValue as any)
                ? (dbValue as any).threshold as number
                : dt.value
            return { ...dt, value }
        })

        return { proposalRoutes, thresholds, availableRoles: SYSTEM_ROLES }
    }, 120_000)
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
