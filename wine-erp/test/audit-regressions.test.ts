import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/cache', () => ({
    cached: vi.fn((_key: string, fn: () => any) => fn()),
    revalidateCache: vi.fn(),
}))
vi.mock('@/lib/session', () => ({
    requireAuth: vi.fn().mockResolvedValue({
        id: 'test-ceo',
        name: 'Test CEO',
        email: 'ceo@lyscellars.com',
        roles: ['CEO', 'ADMIN'],
        permissions: ['*'],
    }),
    requirePermission: vi.fn().mockResolvedValue({
        id: 'test-ceo',
        name: 'Test CEO',
        email: 'ceo@lyscellars.com',
        roles: ['CEO', 'ADMIN'],
        permissions: ['*'],
    }),
    getCurrentUser: vi.fn().mockResolvedValue({
        id: 'test-ceo',
        name: 'Test CEO',
        email: 'ceo@lyscellars.com',
        roles: ['CEO', 'ADMIN'],
        permissions: ['*'],
    }),
    hasRole: vi.fn((_u: any, ...roles: string[]) => roles.some(r => ['CEO', 'ADMIN', 'Admin'].includes(r))),
}))

const mockPrisma = {
    salesOrder: { findUnique: vi.fn(), update: vi.fn() },
    approvalRequest: { findFirst: vi.fn().mockResolvedValue(null) },
    warehouse: { findUnique: vi.fn(), findFirst: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([]) },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { CONTRACT_TEMPLATES } = await import('@/app/dashboard/contracts/contract-templates')
const templateActions = await import('@/app/dashboard/contracts/template-actions')
const { sanitizeMarkdownHtml } = await import('@/components/ui/MarkdownViewer')
const { generateNextDocCode } = await import('@/lib/doc-code')
const { approveSalesOrder } = await import('@/app/dashboard/sales/actions')

const SRC_ROOT = path.resolve(process.cwd(), 'src')

function collectSourceFiles(dir: string): string[] {
    const out: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            out.push(...collectSourceFiles(full))
        } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
            out.push(full)
        }
    }
    return out
}

beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.approvalRequest.findFirst.mockResolvedValue(null)
    mockPrisma.user.findMany.mockResolvedValue([])
})

describe('REG-01: Next.js 16 "use server" export safety', () => {
    it('exports CONTRACT_TEMPLATES from non-server module', () => {
        expect(Array.isArray(CONTRACT_TEMPLATES)).toBe(true)
        expect(CONTRACT_TEMPLATES.length).toBeGreaterThan(0)
    })

    it('exports only async functions from template-actions ("use server")', () => {
        const exportsList = Object.entries(templateActions)
        expect(exportsList.length).toBeGreaterThan(0)
        for (const [name, value] of exportsList) {
            expect(typeof value, `Export "${name}" in template-actions.ts must be a function`).toBe('function')
        }
    })
})

describe('REG-02: sanitizeMarkdownHtml XSS protection', () => {
    it('strips dangerous tags, event handlers, and javascript URIs', () => {
        const dirty = [
            '<h2>Safe Heading</h2>',
            '<script>alert("xss")</script>',
            '<iframe src="https://evil.test"></iframe>',
            '<img src="x" onerror="alert(1)" onclick="steal()" />',
            '<a href="javascript:alert(2)">Bad</a>',
            '<a href="https://example.com"><strong>OK</strong></a>',
        ].join('')

        const clean = sanitizeMarkdownHtml(dirty)
        expect(clean).not.toMatch(/<script/i)
        expect(clean).not.toMatch(/<iframe/i)
        expect(clean).not.toMatch(/onerror\s*=/i)
        expect(clean).not.toMatch(/onclick\s*=/i)
        expect(clean).not.toMatch(/javascript:/i)
        expect(clean).toContain('<h2>Safe Heading</h2>')
        expect(clean).toContain('<strong>OK</strong>')
        expect(clean).toContain('https://example.com')
    })
})

describe('REG-03: approveSalesOrder warehouse invariants', () => {
    const baseSO = {
        status: 'PENDING_APPROVAL',
        soNo: 'SO-2604-0001',
        salesRepId: 'rep-1',
        legalEntityId: 'le-ta',
        warehouseId: null,
        totalAmount: 10_000_000,
        orderDiscount: 0,
        customer: { name: 'Khách VIP' },
        salesRep: { name: 'Rep', email: 'rep@test.com' },
        lines: [{ id: 'l1', qtyOrdered: 6, unitPrice: 1_000_000, lineDiscountPct: 0 }],
    }

    it('rejects WH-TA-TT storage warehouse from direct sales approval', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue(baseSO)
        mockPrisma.warehouse.findUnique.mockResolvedValue({
            id: 'wh-tt',
            code: 'WH-TA-TT',
            allowSales: true,
            legalEntityId: 'le-ta',
        })

        const res = await approveSalesOrder('so-1', undefined, 'wh-tt')
        expect(res.success).toBe(false)
        expect(res.error).toContain('WH-TA-TT')
        expect(mockPrisma.salesOrder.update).not.toHaveBeenCalled()
    })

    it('rejects warehouse with allowSales = false', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue(baseSO)
        mockPrisma.warehouse.findUnique.mockResolvedValue({
            id: 'wh-hold',
            code: 'WH-HOLD',
            allowSales: false,
            legalEntityId: 'le-ta',
        })

        const res = await approveSalesOrder('so-1', undefined, 'wh-hold')
        expect(res.success).toBe(false)
        expect(res.error).toContain('allowSales = false')
        expect(mockPrisma.salesOrder.update).not.toHaveBeenCalled()
    })

    it('rejects cross-legal-entity warehouse mismatch', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue(baseSO)
        mockPrisma.warehouse.findUnique.mockResolvedValue({
            id: 'wh-lc',
            code: 'WH-LC-MAIN',
            allowSales: true,
            legalEntityId: 'le-lc',
        })

        const res = await approveSalesOrder('so-1', undefined, 'wh-lc')
        expect(res.success).toBe(false)
        expect(res.error).toContain('Pháp nhân')
        expect(mockPrisma.salesOrder.update).not.toHaveBeenCalled()
    })
})

describe('REG-04: generateNextDocCode collision safety', () => {
    it('increments from max existing code rather than count() when records have been deleted', async () => {
        const model = {
            findFirst: vi.fn().mockResolvedValue({ code: 'NV-005' }),
            count: vi.fn().mockResolvedValue(2),
        }
        const nextCode = await generateNextDocCode(model, 'code', 'NV-', 3)
        expect(nextCode).toBe('NV-006')
        expect(model.count).not.toHaveBeenCalled()
    })

    it('falls back to count() + 1 when findFirst is absent on partial test mocks', async () => {
        const model = {
            count: vi.fn().mockResolvedValue(4),
        }
        const nextCode = await generateNextDocCode(model, 'code', 'COD-', 6)
        expect(nextCode).toBe('COD-000005')
    })

    it('ignores suffixed or malformed entries (e.g. JE-COGS-20266-69rdla) and picks numeric max via findMany', async () => {
        const model = {
            findMany: vi.fn().mockResolvedValue([
                { entryNo: 'JE-COGS-20266-69rdla' },
                { entryNo: 'JE-COGS-REV-000999' },
                { entryNo: 'JE-COGS-00198' },
                { entryNo: 'JE-COGS-00042' },
            ]),
            count: vi.fn().mockResolvedValue(999),
        }
        const nextCode = await generateNextDocCode(model, 'entryNo', 'JE-COGS-', 6)
        expect(nextCode).toBe('JE-COGS-000199')
        expect(model.count).not.toHaveBeenCalled()
    })
})

describe('REG-05: Static UI/UX & Print CSS regression guards', () => {
    it('has zero window.prompt calls across src/', () => {
        const files = collectSourceFiles(SRC_ROOT)
        const offenders: string[] = []
        for (const f of files) {
            const content = fs.readFileSync(f, 'utf-8')
            if (content.includes('window.prompt(')) {
                offenders.push(path.relative(SRC_ROOT, f))
            }
        }
        expect(offenders).toEqual([])
    })

    it('ensures all 8 printable modals carry the print-modal class', () => {
        const printableFiles = [
            'app/dashboard/warehouse/PosmInventoryTab.tsx',
            'app/dashboard/consignment/PrintableConsignmentCount.tsx',
            'app/dashboard/consignment/PrintableConsignmentDispatch.tsx',
            'app/dashboard/payment-requests/PrintablePaymentRequest.tsx',
            'app/dashboard/stock-count/PrintableAuditReport.tsx',
            'app/dashboard/stamps/StampsClient.tsx',
            'app/dashboard/sop/MarkdownDocModal.tsx',
            'app/dashboard/sop/SopDetailModal.tsx',
        ]
        for (const rel of printableFiles) {
            const txt = fs.readFileSync(path.join(SRC_ROOT, rel), 'utf-8')
            expect(txt, `${rel} must include print-modal`).toContain('print-modal')
        }
    })

    it('ensures hooks in ProcurementCashFlowModal and AddUnlistedModal run before early returns', () => {
        const cashFlow = fs.readFileSync(
            path.join(SRC_ROOT, 'app/dashboard/procurement/ProcurementCashFlowModal.tsx'),
            'utf-8'
        )
        const addUnlisted = fs.readFileSync(
            path.join(SRC_ROOT, 'app/dashboard/stock-count/AddUnlistedModal.tsx'),
            'utf-8'
        )
        expect(cashFlow.indexOf('if (!open) return null')).toBeGreaterThan(cashFlow.lastIndexOf('useMemo'))
        expect(addUnlisted.indexOf('if (!isOpen) return null')).toBeGreaterThan(addUnlisted.lastIndexOf('useEffect'))
    })
})
