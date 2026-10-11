import { describe, it, expect } from 'vitest'
import { SOP_ITEMS, SOP_CATEGORIES } from '@/data/sops'

describe('SOP Knowledge Hub Data Integrity', () => {
    it('should have standard categories configured', () => {
        expect(SOP_CATEGORIES.length).toBeGreaterThanOrEqual(5)
        const catIds = SOP_CATEGORIES.map(c => c.id)
        expect(catIds).toContain('all')
        expect(catIds).toContain('sales')
        expect(catIds).toContain('warehouse')
        expect(catIds).toContain('procurement')
        expect(catIds).toContain('finance')
        expect(catIds).toContain('hr')
    })

    it('should load all 6 core SOP items with full details', () => {
        expect(SOP_ITEMS.length).toBe(6)

        const codes = SOP_ITEMS.map(i => i.code)
        expect(codes).toContain('SOP-SLS-01')
        expect(codes).toContain('SOP-WMS-01')
        expect(codes).toContain('SOP-WMS-02')
        expect(codes).toContain('SOP-PRC-01')
        expect(codes).toContain('SOP-FIN-01')
        expect(codes).toContain('SOP-HRM-01')
    })

    it('should ensure each SOP has valid steps, RACI and checklists', () => {
        SOP_ITEMS.forEach(sop => {
            // Check basic meta
            expect(sop.id).toBeDefined()
            expect(sop.title).toBeTruthy()
            expect(sop.department).toBeTruthy()
            expect(sop.version).toMatch(/^v\d+\.\d+$/)

            // Check RACI
            expect(sop.raci.responsible.length).toBeGreaterThan(0)
            expect(sop.raci.accountable.length).toBeGreaterThan(0)

            // Check Steps
            expect(sop.flowSteps.length).toBeGreaterThanOrEqual(3)
            sop.flowSteps.forEach((step, idx) => {
                expect(step.stepNumber).toBe(idx + 1)
                expect(step.title).toBeTruthy()
                expect(step.role).toBeTruthy()
                expect(step.action).toBeTruthy()
            })

            // Check Checklist
            expect(sop.checklist.length).toBeGreaterThanOrEqual(3)
            expect(sop.checklist.some(c => c.critical)).toBe(true)

            // Check FAQ
            expect(sop.faqs.length).toBeGreaterThanOrEqual(1)
        })
    })

    it('should verify ERP deep links point to valid dashboard routes', () => {
        const allowedPrefixes = ['/dashboard/sales', '/dashboard/quotations', '/dashboard/warehouse', '/dashboard/stamps', '/dashboard/delivery', '/dashboard/procurement', '/dashboard/costing', '/dashboard/contracts', '/dashboard/payment-requests', '/dashboard/hr', '/dashboard/settings', '/dashboard/margin', '/dashboard/customers', '/dashboard/finance', '/dashboard/sop']

        SOP_ITEMS.forEach(sop => {
            sop.flowSteps.forEach(step => {
                if (step.erpLink) {
                    const isValidPath = allowedPrefixes.some(prefix => step.erpLink!.path.startsWith(prefix))
                    expect(isValidPath).toBe(true)
                }
            })
        })
    })
})
