import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Setup Mocks ──────────────────────────────────

const mockPrisma = {
    auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
    },
}

vi.mock('@/lib/db', () => ({
    prisma: mockPrisma,
}))

const { logAudit, getAuditLogs } = await import('@/lib/audit')

beforeEach(() => {
    vi.clearAllMocks()
})

// ─── logAudit ─────────────────────────────────────

describe('logAudit', () => {
    it('should create audit log entry with all fields', async () => {
        mockPrisma.auditLog.create.mockResolvedValue({})

        await logAudit({
            userId: 'user-001',
            userName: 'Test User',
            action: 'CREATE',
            entityType: 'SalesOrder',
            entityId: 'so-001',
            newValue: { status: 'DRAFT' },
        })

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: {
                userId: 'user-001',
                userName: 'Test User',
                action: 'CREATE',
                entityType: 'SalesOrder',
                entityId: 'so-001',
                oldValue: undefined,
                newValue: { status: 'DRAFT' },
            },
        })
    })

    it('should handle optional fields with null fallback', async () => {
        mockPrisma.auditLog.create.mockResolvedValue({})

        await logAudit({
            action: 'LOGIN',
            entityType: 'Auth',
        })

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: {
                userId: null,
                userName: null,
                action: 'LOGIN',
                entityType: 'Auth',
                entityId: null,
                oldValue: undefined,
                newValue: undefined,
            },
        })
    })

    it('should not throw when prisma.create fails (silent error)', async () => {
        mockPrisma.auditLog.create.mockRejectedValue(new Error('DB connection error'))
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

        await expect(logAudit({
            action: 'UPDATE',
            entityType: 'Product',
            entityId: 'p-001',
        })).resolves.toBeUndefined()

        expect(consoleSpy).toHaveBeenCalledWith(
            '[AuditLog] Failed to write audit log:',
            expect.any(Error),
        )

        consoleSpy.mockRestore()
    })

    it('should log status changes with old and new values', async () => {
        mockPrisma.auditLog.create.mockResolvedValue({})

        await logAudit({
            userId: 'user-ceo',
            action: 'STATUS_CHANGE',
            entityType: 'PurchaseOrder',
            entityId: 'po-001',
            oldValue: { status: 'DRAFT' },
            newValue: { status: 'CONFIRMED' },
        })

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'STATUS_CHANGE',
                oldValue: { status: 'DRAFT' },
                newValue: { status: 'CONFIRMED' },
            }),
        })
    })
})

// ─── getAuditLogs ─────────────────────────────────

describe('getAuditLogs', () => {
    it('should return logs with total count', async () => {
        const mockLogs = [
            { id: '1', action: 'CREATE', entityType: 'Product', createdAt: new Date() },
            { id: '2', action: 'UPDATE', entityType: 'Product', createdAt: new Date() },
        ]
        mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs)
        mockPrisma.auditLog.count.mockResolvedValue(2)

        const result = await getAuditLogs()

        expect(result.logs).toHaveLength(2)
        expect(result.total).toBe(2)
    })

    it('should filter by entityType', async () => {
        mockPrisma.auditLog.findMany.mockResolvedValue([])
        mockPrisma.auditLog.count.mockResolvedValue(0)

        await getAuditLogs({ entityType: 'SalesOrder' })

        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { entityType: 'SalesOrder' },
            }),
        )
    })

    it('should filter by entityId', async () => {
        mockPrisma.auditLog.findMany.mockResolvedValue([])
        mockPrisma.auditLog.count.mockResolvedValue(0)

        await getAuditLogs({ entityType: 'Product', entityId: 'p-001' })

        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { entityType: 'Product', entityId: 'p-001' },
            }),
        )
    })

    it('should apply default limit of 50 and offset of 0', async () => {
        mockPrisma.auditLog.findMany.mockResolvedValue([])
        mockPrisma.auditLog.count.mockResolvedValue(0)

        await getAuditLogs()

        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 50,
                skip: 0,
            }),
        )
    })

    it('should apply custom limit and offset', async () => {
        mockPrisma.auditLog.findMany.mockResolvedValue([])
        mockPrisma.auditLog.count.mockResolvedValue(0)

        await getAuditLogs({ limit: 10, offset: 20 })

        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 10,
                skip: 20,
            }),
        )
    })

    it('should order by createdAt descending', async () => {
        mockPrisma.auditLog.findMany.mockResolvedValue([])
        mockPrisma.auditLog.count.mockResolvedValue(0)

        await getAuditLogs()

        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { createdAt: 'desc' },
            }),
        )
    })
})
