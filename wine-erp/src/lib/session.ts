import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase'
import { prisma } from '@/lib/db'
import { cached, revalidateCache } from '@/lib/cache'

export type SessionUser = {
    id: string
    email: string
    name: string
    status: string
    roles: string[]
    permissions: string[]
}

// ── Cached Prisma user lookup (shared across all requests for 5 min) ─────
// Supabase auth (JWT validation) still runs every request,
// but the heavy Prisma join for roles/permissions is cached in-memory.
async function fetchUserByEmail(email: string): Promise<SessionUser | null> {
    return cached(`user:session:${email}`, async () => {
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: { permission: true },
                                },
                            },
                        },
                    },
                },
            },
        })

        if (!user || user.status !== 'ACTIVE') return null

        const roles = user.roles.flatMap(r => {
            const name = r.role.name
            const norm = ROLE_NAME_MAP[name] || name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
            return name === norm ? [name] : [name, norm]
        })
        const permissions = Array.from(
            new Set(
                user.roles.flatMap(r =>
                    r.role.permissions.map(p => `${p.permission.module}:${p.permission.action}`)
                )
            )
        )

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            status: user.status,
            roles,
            permissions,
        }
    }, 300_000) // 5 minutes — roles/permissions rarely change
}

// Get current authenticated user with roles & permissions
// Wrapped with React cache() for per-request deduplication — avoids duplicate
// Supabase + Prisma calls when multiple server functions need the user in one render.
export const getCurrentUser = cache(async function getCurrentUser(): Promise<SessionUser | null> {
    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser?.email) return null

        return await fetchUserByEmail(authUser.email)
    } catch {
        return null
    }
})

/**
 * Force-refresh user session cache (call after role/permission changes)
 */
export function invalidateUserSession(email?: string) {
    if (email) {
        revalidateCache(`user:session:${email}`)
    } else {
        revalidateCache('user:session')
    }
}

export const ROLE_NAME_MAP: Record<string, string> = {
    'Kế Toán': 'KE_TOAN',
    'Sales Manager': 'SALES_MGR',
    'Sales Rep': 'SALES_REP',
    'Thủ Kho': 'THU_KHO',
    'Thu Mua': 'THU_MUA',
    'Sales Admin': 'SALES_ADMIN',
}

// Check if user has specific permission
export function hasPermission(user: SessionUser, module: string, action: string): boolean {
    return user.permissions.includes(`${module}:${action}`)
}

// Check if user has any of the specified roles
export function hasRole(user: SessionUser, ...roleNames: string[]): boolean {
    return roleNames.some(r => user.roles.includes(r))
}

// ── Report Permission Mapping ─────────────────────
const REPORT_ROLE_MAP: Record<string, string[]> = {
    'R01_STOCK_DETAIL': ['CEO', 'THU_KHO', 'KE_TOAN'],
    'R02_REVENUE': ['CEO', 'SALES_MGR', 'KE_TOAN', 'SALES_ADMIN'],
    'R03_AR_AGING': ['CEO', 'KE_TOAN'],
    'R04_COST_MARGIN': ['CEO', 'KE_TOAN', 'SALES_ADMIN'],
    'R05_AP_OUTSTANDING': ['CEO', 'KE_TOAN', 'THU_MUA'],
    'R06_PO_STATUS': ['CEO', 'THU_MUA', 'KE_TOAN'],
    'R07_MONTHLY_PL': ['CEO', 'KE_TOAN'],
    'R08_SKU_MARGIN': ['CEO', 'KE_TOAN', 'SALES_MGR', 'SALES_ADMIN'],
    'R09_CHANNEL_PERF': ['CEO', 'SALES_MGR', 'SALES_REP', 'SALES_ADMIN'],
    'R10_CUSTOMER_RANK': ['CEO', 'SALES_MGR', 'KE_TOAN', 'SALES_ADMIN'],
    'R11_SLOW_STOCK': ['CEO', 'THU_KHO'],
    'R12_STAMP_USAGE': ['CEO', 'KE_TOAN', 'THU_KHO'],
    'R13_TAX_SUMMARY': ['CEO', 'KE_TOAN'],
    'R14_EXPENSE_SUMMARY': ['CEO', 'KE_TOAN'],
    'R15_JOURNAL_LEDGER': ['CEO', 'KE_TOAN'],
}

export function canAccessReport(user: SessionUser, reportCode: string): boolean {
    if (hasRole(user, 'CEO')) return true // CEO sees all
    const allowedRoles = REPORT_ROLE_MAP[reportCode]
    if (!allowedRoles) return false
    return allowedRoles.some(r => user.roles.includes(r))
}

export function getAccessibleReports(user: SessionUser): string[] {
    return Object.keys(REPORT_ROLE_MAP).filter(code => canAccessReport(user, code))
}

/**
 * Auth guard for server actions — returns user or throws.
 * 
 * Usage at the TOP of any mutation server action:
 *   const user = await requireAuth()
 * 
 * The throw is caught by the action's try/catch → returns { success: false, error }
 */
export async function requireAuth(): Promise<SessionUser> {
    const user = await getCurrentUser()
    if (!user) throw new Error('Bạn chưa đăng nhập. Vui lòng đăng nhập lại.')
    return user
}

/**
 * Permission guard — checks a specific module:action permission.
 * Throws if user doesn't have the required permission.
 */
export async function requirePermission(module: string, action: string): Promise<SessionUser> {
    const user = await requireAuth()
    if (!hasPermission(user, module, action)) {
        throw new Error(`Bạn không có quyền ${module}:${action}`)
    }
    return user
}
