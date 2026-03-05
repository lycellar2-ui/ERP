import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Setup Mocks ──────────────────────────────────

const mockPrisma = {
    approvalTemplate: {
        findFirst: vi.fn(),
    },
    approvalRequest: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    approvalLog: {
        create: vi.fn(),
    },
}

vi.mock('@/lib/db', () => ({
    prisma: mockPrisma,
}))

vi.mock('@/lib/audit', () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
}))

// Must import after mocking
const { submitForApproval, approveRequest, rejectRequest } = await import('@/lib/approval')

beforeEach(() => {
    vi.clearAllMocks()
})

// ─── submitForApproval ────────────────────────────

describe('submitForApproval', () => {
    it('should return error when no template found', async () => {
        mockPrisma.approvalTemplate.findFirst.mockResolvedValue(null)

        const result = await submitForApproval({
            docType: 'SALES_ORDER',
            docId: 'so-001',
            docValue: 50_000_000,
            requestedBy: 'user-001',
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Không tìm thấy quy trình duyệt')
    })

    it('should auto-approve when no applicable step matches', async () => {
        mockPrisma.approvalTemplate.findFirst.mockResolvedValue({
            id: 'tpl-001',
            steps: [
                { stepOrder: 1, threshold: 100_000_000, approverRole: 'CEO' },
            ],
        })

        const result = await submitForApproval({
            docType: 'SALES_ORDER',
            docId: 'so-001',
            docValue: 50_000_000, // Below threshold
            requestedBy: 'user-001',
        })

        expect(result.success).toBe(true)
        expect(result.requestId).toBeUndefined()
    })

    it('should return existing pending request if already submitted', async () => {
        mockPrisma.approvalTemplate.findFirst.mockResolvedValue({
            id: 'tpl-001',
            steps: [{ stepOrder: 1, threshold: null, approverRole: 'CEO' }],
        })

        mockPrisma.approvalRequest.findFirst.mockResolvedValue({
            id: 'req-existing',
            status: 'PENDING',
        })

        const result = await submitForApproval({
            docType: 'SALES_ORDER',
            docId: 'so-001',
            docValue: 200_000_000,
            requestedBy: 'user-001',
        })

        expect(result.success).toBe(true)
        expect(result.requestId).toBe('req-existing')
        expect(mockPrisma.approvalRequest.create).not.toHaveBeenCalled()
    })

    it('should create new approval request when conditions met', async () => {
        mockPrisma.approvalTemplate.findFirst.mockResolvedValue({
            id: 'tpl-001',
            steps: [{ stepOrder: 1, threshold: null, approverRole: 'CEO' }],
        })

        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null) // No existing

        mockPrisma.approvalRequest.create.mockResolvedValue({ id: 'req-new-001' })

        const result = await submitForApproval({
            docType: 'PURCHASE_ORDER',
            docId: 'po-001',
            docValue: 500_000_000,
            requestedBy: 'user-mgr-001',
            requestedByName: 'Manager Tran',
        })

        expect(result.success).toBe(true)
        expect(result.requestId).toBe('req-new-001')
        expect(mockPrisma.approvalRequest.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                templateId: 'tpl-001',
                docType: 'PURCHASE_ORDER',
                docId: 'po-001',
                status: 'PENDING',
            }),
        })
    })
})

// ─── approveRequest ───────────────────────────────

describe('approveRequest', () => {
    it('should return error when request not found', async () => {
        mockPrisma.approvalRequest.findUnique.mockResolvedValue(null)

        const result = await approveRequest({
            requestId: 'req-nonexist',
            approvedBy: 'user-ceo',
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Yêu cầu không tồn tại')
    })

    it('should return error when request already processed', async () => {
        mockPrisma.approvalRequest.findUnique.mockResolvedValue({
            id: 'req-001',
            status: 'APPROVED', // Already approved
            template: { steps: [] },
        })

        const result = await approveRequest({
            requestId: 'req-001',
            approvedBy: 'user-ceo',
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Yêu cầu đã được xử lý')
    })

    it('should move to next step when there are more steps', async () => {
        mockPrisma.approvalRequest.findUnique.mockResolvedValue({
            id: 'req-001',
            status: 'PENDING',
            currentStep: 1,
            docType: 'SALES_ORDER',
            docId: 'so-001',
            template: {
                steps: [
                    { stepOrder: 1, approverRole: 'SALES_MGR' },
                    { stepOrder: 2, approverRole: 'CEO' },
                ],
            },
        })

        const result = await approveRequest({
            requestId: 'req-001',
            approvedBy: 'user-mgr',
            approverName: 'Sales Manager',
        })

        expect(result.success).toBe(true)
        expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith({
            where: { id: 'req-001' },
            data: { currentStep: 2 },
        })
    })

    it('should mark as APPROVED on final step', async () => {
        mockPrisma.approvalRequest.findUnique.mockResolvedValue({
            id: 'req-001',
            status: 'PENDING',
            currentStep: 2,
            docType: 'SALES_ORDER',
            docId: 'so-001',
            template: {
                steps: [
                    { stepOrder: 1, approverRole: 'SALES_MGR' },
                    { stepOrder: 2, approverRole: 'CEO' },
                ],
            },
        })

        const result = await approveRequest({
            requestId: 'req-001',
            approvedBy: 'user-ceo',
        })

        expect(result.success).toBe(true)
        expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith({
            where: { id: 'req-001' },
            data: { status: 'APPROVED' },
        })
    })

    it('should create approval log entry', async () => {
        mockPrisma.approvalRequest.findUnique.mockResolvedValue({
            id: 'req-001',
            status: 'PENDING',
            currentStep: 1,
            docType: 'SALES_ORDER',
            docId: 'so-001',
            template: {
                steps: [{ stepOrder: 1, approverRole: 'CEO' }],
            },
        })

        await approveRequest({
            requestId: 'req-001',
            approvedBy: 'user-ceo',
            comment: 'Đồng ý',
        })

        expect(mockPrisma.approvalLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                requestId: 'req-001',
                step: 1,
                action: 'APPROVE',
                approvedBy: 'user-ceo',
                comment: 'Đồng ý',
            }),
        })
    })
})

// ─── rejectRequest ────────────────────────────────

describe('rejectRequest', () => {
    it('should mark request as REJECTED', async () => {
        mockPrisma.approvalRequest.findUnique.mockResolvedValue({
            id: 'req-001',
            status: 'PENDING',
            currentStep: 1,
            docType: 'PURCHASE_ORDER',
            docId: 'po-001',
        })

        const result = await rejectRequest({
            requestId: 'req-001',
            rejectedBy: 'user-ceo',
            reason: 'Giá quá cao',
        })

        expect(result.success).toBe(true)
        expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith({
            where: { id: 'req-001' },
            data: { status: 'REJECTED' },
        })
    })

    it('should create rejection log with reason', async () => {
        mockPrisma.approvalRequest.findUnique.mockResolvedValue({
            id: 'req-002',
            status: 'PENDING',
            currentStep: 1,
            docType: 'WRITE_OFF',
            docId: 'wo-001',
        })

        await rejectRequest({
            requestId: 'req-002',
            rejectedBy: 'user-ceo',
            rejectorName: 'CEO Ly',
            reason: 'Chưa đủ thông tin',
        })

        expect(mockPrisma.approvalLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                requestId: 'req-002',
                action: 'REJECT',
                comment: 'Chưa đủ thông tin',
            }),
        })
    })

    it('should return error when request not found', async () => {
        mockPrisma.approvalRequest.findUnique.mockResolvedValue(null)

        const result = await rejectRequest({
            requestId: 'req-ghost',
            rejectedBy: 'user-ceo',
            reason: 'Test',
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Yêu cầu không tồn tại')
    })

    it('should return error when already processed', async () => {
        mockPrisma.approvalRequest.findUnique.mockResolvedValue({
            id: 'req-003',
            status: 'REJECTED',
            currentStep: 1,
        })

        const result = await rejectRequest({
            requestId: 'req-003',
            rejectedBy: 'user-ceo',
            reason: 'Duplicate',
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Yêu cầu đã được xử lý')
    })
})
