import { describe, it, expect } from 'vitest'
import { hasPermission, hasRole, canAccessReport, getAccessibleReports, type SessionUser } from '@/lib/session'

// ─── Test Fixtures ────────────────────────────────

const ceoUser: SessionUser = {
    id: 'user-ceo-001',
    email: 'ceo@lyscellars.com',
    name: 'CEO Ly',
    status: 'ACTIVE',
    roles: ['CEO'],
    permissions: [
        'MDM:READ', 'MDM:WRITE', 'MDM:DELETE',
        'SLS:READ', 'SLS:WRITE',
        'FIN:READ', 'FIN:WRITE',
        'WMS:READ', 'WMS:WRITE',
        'SYS:ADMIN',
        'RPT:READ',
    ],
}

const salesRepUser: SessionUser = {
    id: 'user-sales-001',
    email: 'sales@lyscellars.com',
    name: 'Nguyen Sales',
    status: 'ACTIVE',
    roles: ['SALES_REP'],
    permissions: [
        'SLS:READ', 'SLS:WRITE',
        'MDM:READ',
        'CRM:READ', 'CRM:WRITE',
    ],
}

const accountantUser: SessionUser = {
    id: 'user-acct-001',
    email: 'ketoan@lyscellars.com',
    name: 'Tran KeToan',
    status: 'ACTIVE',
    roles: ['KE_TOAN'],
    permissions: [
        'FIN:READ', 'FIN:WRITE',
        'RPT:READ',
        'MDM:READ',
    ],
}

const warehouseUser: SessionUser = {
    id: 'user-wh-001',
    email: 'thukho@lyscellars.com',
    name: 'Le ThuKho',
    status: 'ACTIVE',
    roles: ['THU_KHO'],
    permissions: [
        'WMS:READ', 'WMS:WRITE',
        'MDM:READ',
    ],
}

// ─── hasPermission ────────────────────────────────

describe('hasPermission', () => {
    it('should return true when user has exact permission', () => {
        expect(hasPermission(ceoUser, 'SYS', 'ADMIN')).toBe(true)
    })

    it('should return false when user lacks permission', () => {
        expect(hasPermission(salesRepUser, 'SYS', 'ADMIN')).toBe(false)
    })

    it('should match module:action format strictly', () => {
        expect(hasPermission(salesRepUser, 'SLS', 'READ')).toBe(true)
        expect(hasPermission(salesRepUser, 'SLS', 'DELETE')).toBe(false)
    })

    it('should return false for nonexistent module', () => {
        expect(hasPermission(ceoUser, 'NONEXIST', 'READ')).toBe(false)
    })
})

// ─── hasRole ──────────────────────────────────────

describe('hasRole', () => {
    it('should return true when user has the role', () => {
        expect(hasRole(ceoUser, 'CEO')).toBe(true)
    })

    it('should return true when user has any of the specified roles', () => {
        expect(hasRole(salesRepUser, 'CEO', 'SALES_REP')).toBe(true)
    })

    it('should return false when user has none of the roles', () => {
        expect(hasRole(salesRepUser, 'CEO', 'KE_TOAN', 'THU_KHO')).toBe(false)
    })

    it('should handle single role check', () => {
        expect(hasRole(accountantUser, 'KE_TOAN')).toBe(true)
        expect(hasRole(accountantUser, 'CEO')).toBe(false)
    })
})

// ─── canAccessReport ─────────────────────────────

describe('canAccessReport', () => {
    it('CEO should access all reports', () => {
        expect(canAccessReport(ceoUser, 'R01_STOCK_DETAIL')).toBe(true)
        expect(canAccessReport(ceoUser, 'R03_AR_AGING')).toBe(true)
        expect(canAccessReport(ceoUser, 'R07_MONTHLY_PL')).toBe(true)
        expect(canAccessReport(ceoUser, 'R15_JOURNAL_LEDGER')).toBe(true)
    })

    it('KE_TOAN should access finance-related reports', () => {
        expect(canAccessReport(accountantUser, 'R03_AR_AGING')).toBe(true)
        expect(canAccessReport(accountantUser, 'R07_MONTHLY_PL')).toBe(true)
        expect(canAccessReport(accountantUser, 'R15_JOURNAL_LEDGER')).toBe(true)
    })

    it('THU_KHO should access stock reports but not finance', () => {
        expect(canAccessReport(warehouseUser, 'R01_STOCK_DETAIL')).toBe(true)
        expect(canAccessReport(warehouseUser, 'R11_SLOW_STOCK')).toBe(true)
        expect(canAccessReport(warehouseUser, 'R03_AR_AGING')).toBe(false)
        expect(canAccessReport(warehouseUser, 'R07_MONTHLY_PL')).toBe(false)
    })

    it('SALES_REP should access channel performance only', () => {
        expect(canAccessReport(salesRepUser, 'R09_CHANNEL_PERF')).toBe(true)
        expect(canAccessReport(salesRepUser, 'R03_AR_AGING')).toBe(false)
        expect(canAccessReport(salesRepUser, 'R01_STOCK_DETAIL')).toBe(false)
    })

    it('should return false for unknown report code', () => {
        expect(canAccessReport(ceoUser, 'R99_UNKNOWN')).toBe(true)  // CEO shortcut
        expect(canAccessReport(salesRepUser, 'R99_UNKNOWN')).toBe(false)
    })
})

// ─── getAccessibleReports ─────────────────────────

describe('getAccessibleReports', () => {
    it('CEO should get all 15 reports', () => {
        const reports = getAccessibleReports(ceoUser)
        expect(reports).toHaveLength(15)
    })

    it('SALES_REP should get limited reports', () => {
        const reports = getAccessibleReports(salesRepUser)
        expect(reports).toContain('R09_CHANNEL_PERF')
        expect(reports).not.toContain('R03_AR_AGING')
        expect(reports).not.toContain('R15_JOURNAL_LEDGER')
    })

    it('KE_TOAN should get finance and reporting access', () => {
        const reports = getAccessibleReports(accountantUser)
        expect(reports).toContain('R03_AR_AGING')
        expect(reports).toContain('R04_COST_MARGIN')
        expect(reports).toContain('R07_MONTHLY_PL')
        expect(reports).toContain('R15_JOURNAL_LEDGER')
        expect(reports.length).toBeGreaterThan(5)
    })

    it('THU_KHO should get warehouse reports', () => {
        const reports = getAccessibleReports(warehouseUser)
        expect(reports).toContain('R01_STOCK_DETAIL')
        expect(reports).toContain('R11_SLOW_STOCK')
        expect(reports).toContain('R12_STAMP_USAGE')
    })
})
