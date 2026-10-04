import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
    logAuditWithDiff: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/cache', () => ({
    cached: vi.fn((key, fn) => fn()),
    revalidateCache: vi.fn(),
}))
vi.mock('@/lib/session', () => ({
    requirePermission: vi.fn().mockResolvedValue({ id: 'u1', name: 'Admin', email: 'admin@test.com', roles: ['CEO'] }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'Admin', email: 'admin@test.com', roles: ['CEO'] }),
    requireAuth: vi.fn().mockResolvedValue({ id: 'u1', name: 'Admin', email: 'admin@test.com' }),
    hasRole: vi.fn((user: any, ...roles: string[]) => roles.some(r => ['CEO', 'Kế Toán', 'Sales Manager'].includes(r))),
}))

const mockPrisma = {
    customer: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    customerContact: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    customerAddress: {
        create: vi.fn(),
    },
    $transaction: vi.fn(async (callback: any) => {
        if (typeof callback === 'function') {
            return callback(mockPrisma)
        }
        return Promise.all(callback)
    }),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const {
    checkCustomerDuplicates,
    createCustomer,
    updateCustomer,
} = await import('@/app/dashboard/customers/actions')

beforeEach(() => {
    vi.clearAllMocks()
})

describe('CUST-DUP: Customer Hierarchy & Duplicate Prevention', () => {
    describe('checkCustomerDuplicates', () => {
        it('should flag TAX_ID duplicate when an unrelated customer has the same Tax ID', async () => {
            mockPrisma.customer.findFirst.mockResolvedValueOnce({
                id: 'cust-unrelated',
                code: 'CUST-001',
                name: 'Công ty Đối thủ',
            })

            const res = await checkCustomerDuplicates({
                taxId: '0312345678',
                parentId: 'parent-123',
            })

            expect(res.success).toBe(true)
            expect(res.warnings).toHaveLength(1)
            expect(res.warnings?.[0].type).toBe('TAX_ID')
            expect(res.warnings?.[0].customer.code).toBe('CUST-001')

            // Verify query excluded parent and sibling branches
            expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        taxId: { equals: '0312345678', mode: 'insensitive' },
                        NOT: [
                            { id: 'parent-123' },
                            { parentId: 'parent-123' }
                        ]
                    })
                })
            )
        })

        it('should NOT flag TAX_ID duplicate when query excludes parent and sibling branches', async () => {
            mockPrisma.customer.findFirst.mockResolvedValueOnce(null)

            const res = await checkCustomerDuplicates({
                taxId: '0312345678',
                parentId: 'parent-123',
            })

            expect(res.success).toBe(true)
            expect(res.warnings).toHaveLength(0)
        })

        it('should exclude parent & siblings when checking phone duplicate', async () => {
            mockPrisma.customerContact.findFirst.mockResolvedValueOnce(null)
            mockPrisma.customer.findFirst.mockResolvedValueOnce(null)

            const res = await checkCustomerDuplicates({
                phone: '0901234567',
                parentId: 'parent-123',
            })

            expect(res.success).toBe(true)
            expect(res.warnings).toHaveLength(0)

            // Verify exclusions were passed to customerContact query
            expect(mockPrisma.customerContact.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        phone: { equals: '0901234567', mode: 'insensitive' },
                        customer: expect.objectContaining({
                            NOT: [
                                { id: 'parent-123' },
                                { parentId: 'parent-123' }
                            ]
                        })
                    })
                })
            )
        })

        it('should flag PHONE duplicate when an unrelated customer contact matches', async () => {
            mockPrisma.customerContact.findFirst.mockResolvedValueOnce({
                id: 'contact-1',
                customer: {
                    id: 'cust-unrelated',
                    code: 'CUST-009',
                    name: 'Khách hàng Khác',
                    parentId: null,
                }
            })

            const res = await checkCustomerDuplicates({
                phone: '0909999999',
                parentId: 'parent-123',
            })

            expect(res.success).toBe(true)
            expect(res.warnings).toHaveLength(1)
            expect(res.warnings?.[0].type).toBe('PHONE')
            expect(res.warnings?.[0].customer.code).toBe('CUST-009')
        })
    })

    describe('createCustomer', () => {
        it('should allow creating child customer with parent Tax ID', async () => {
            // Unrelated tax search returns null because parent & siblings are excluded
            mockPrisma.customer.findFirst.mockResolvedValueOnce(null)
            mockPrisma.customer.create.mockResolvedValueOnce({
                id: 'child-1',
                code: 'REST-001',
                name: 'Nhà hàng Con',
                taxId: '0312345678',
            })

            const res = await createCustomer({
                code: 'REST-001',
                name: 'Nhà hàng Con',
                taxId: '0312345678',
                parentId: 'parent-123',
                entityType: 'RESTAURANT',
                allowDirectSO: false,
                channel: 'HORECA',
                paymentTerm: 'NET30',
                creditLimit: 0,
                status: 'ACTIVE',
            })

            expect(res.success).toBe(true)
            expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        taxId: { equals: '0312345678', mode: 'insensitive' },
                        NOT: [
                            { id: 'parent-123' },
                            { parentId: 'parent-123' }
                        ]
                    })
                })
            )
        })

        it('should block creating customer when Tax ID belongs to an unrelated customer', async () => {
            mockPrisma.customer.findFirst.mockResolvedValueOnce({
                id: 'unrelated-cust',
                code: 'CUST-OTHER',
                name: 'Công ty Cổ phần Khác',
            })

            const res = await createCustomer({
                code: 'REST-002',
                name: 'Nhà hàng Con 2',
                taxId: '0312345678',
                parentId: 'parent-123',
                entityType: 'RESTAURANT',
                allowDirectSO: false,
                channel: 'HORECA',
                paymentTerm: 'NET30',
                creditLimit: 0,
                status: 'ACTIVE',
            })

            expect(res.success).toBe(false)
            expect(res.error).toContain('Mã số thuế \'0312345678\' đã tồn tại cho Khách hàng [CUST-OTHER] Công ty Cổ phần Khác.')
        })
    })

    describe('updateCustomer', () => {
        it('should allow updating child customer Tax ID to parent Tax ID', async () => {
            mockPrisma.customer.findUnique.mockResolvedValueOnce({
                id: 'child-1',
                code: 'REST-001',
                name: 'Nhà hàng Con',
                parentId: 'parent-123',
                entityType: 'RESTAURANT',
                taxId: null,
            })
            // No unrelated customer found
            mockPrisma.customer.findFirst.mockResolvedValueOnce(null)
            mockPrisma.customer.update.mockResolvedValueOnce({ id: 'child-1' })

            const res = await updateCustomer('child-1', {
                taxId: '0312345678',
            })

            expect(res.success).toBe(true)
        })

        it('should block updating Tax ID if it belongs to an unrelated customer', async () => {
            mockPrisma.customer.findUnique.mockResolvedValueOnce({
                id: 'child-1',
                code: 'REST-001',
                name: 'Nhà hàng Con',
                parentId: 'parent-123',
                entityType: 'RESTAURANT',
                taxId: null,
            })
            mockPrisma.customer.findFirst.mockResolvedValueOnce({
                id: 'other-cust',
                code: 'CUST-OTHER',
                name: 'Công ty Khác',
            })

            const res = await updateCustomer('child-1', {
                taxId: '0399999999',
            })

            expect(res.success).toBe(false)
            expect(res.error).toContain('Mã số thuế \'0399999999\' đã tồn tại cho Khách hàng [CUST-OTHER]')
        })
    })
})
