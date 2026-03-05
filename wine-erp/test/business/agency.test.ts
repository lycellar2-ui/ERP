import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockPrisma = {
    agencySubmission: { create: vi.fn(), update: vi.fn(), count: vi.fn() },
    externalPartner: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    shipment: { count: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const {
    createAgencyPartner,
    createAgencySubmission,
    reviewAgencySubmission,
} = await import('@/app/dashboard/agency/actions')

beforeEach(() => { vi.clearAllMocks() })

describe('AGC-01: Agency Partner Management', () => {
    it('should create new partner', async () => {
        mockPrisma.externalPartner.create.mockResolvedValue({ id: 'partner-1' })
        const result = await createAgencyPartner({
            code: 'AGN', name: 'Agency 1', type: 'CUSTOMS_BROKER', email: 'test@agen.cy', passwordHash: 'hash'
        })
        expect(result.success).toBe(true)
        expect(result.id).toBe('partner-1')
    })
})

describe('AGC-02: Submission Workflow', () => {
    it('should create submission with PENDING_REVIEW', async () => {
        mockPrisma.agencySubmission.create.mockResolvedValue({ id: 'sub-1' })
        const result = await createAgencySubmission({
            partnerId: 'partner-1', shipmentId: 'ship-1', declarationNo: 'DECL-123'
        })
        expect(result.success).toBe(true)
        expect(mockPrisma.agencySubmission.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ status: 'PENDING_REVIEW', declarationNo: 'DECL-123' })
        })
    })

    it('should reject or approve submission', async () => {
        mockPrisma.agencySubmission.update.mockResolvedValue({})
        const result = await reviewAgencySubmission('sub-1', 'APPROVED', 'admin-1', 'Looks good')
        expect(result.success).toBe(true)
        expect(mockPrisma.agencySubmission.update).toHaveBeenCalledWith({
            where: { id: 'sub-1' },
            data: expect.objectContaining({ status: 'APPROVED', reviewedBy: 'admin-1', notes: 'Looks good' })
        })
    })
})
