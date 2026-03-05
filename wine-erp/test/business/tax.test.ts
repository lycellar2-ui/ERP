import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockPrisma = {
    taxRate: { findFirst: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { calculateTaxEngine } = await import('@/app/dashboard/tax/actions')

beforeEach(() => { vi.clearAllMocks() })

describe('TAX-01: Tax Engine Calculation', () => {
    it('should calculate proper taxes (Import -> SCT -> VAT)', async () => {
        mockPrisma.taxRate.findFirst.mockResolvedValue({
            importTaxRate: 50, // 50%
            sctRate: 0,        // overwritten by logic based on ABV
            vatRate: 10,       // 10%
            requiresCo: false,
        })

        const result = await calculateTaxEngine({
            countryOfOrigin: 'FR', hsCode: '2204', abvPercent: 14, cifUsd: 10, exchangeRate: 25000, qty: 100
        })

        expect(result.success).toBe(true)
        const res = result.result!

        // CIF total VND check: 10 USD * 25,000 = 250,000
        expect(res.cifVnd).toBe(250_000)

        // Import Tax: 50% of CIF -> 125,000
        expect(res.importTax).toBe(125_000)

        // SCT: 14 ABV (< 20) -> 35% of (CIF + Import Tax) = 0.35 * (375,000) = 131,250
        expect(res.sct).toBe(131_250)

        // VAT: 10% of (CIF + Import Tax + SCT) = 0.1 * (506,250) = 50,625
        expect(res.vat).toBe(50_625)

        // Total Tax
        expect(res.totalTax).toBe(125_000 + 131_250 + 50_625) // 306,875
    })

    it('should apply 65% SCT for ABV >= 20', async () => {
        mockPrisma.taxRate.findFirst.mockResolvedValue({
            importTaxRate: 0, sctRate: 0, vatRate: 10, requiresCo: false,
        })

        const result = await calculateTaxEngine({
            countryOfOrigin: 'UK', hsCode: '2204', abvPercent: 40, cifUsd: 100, exchangeRate: 25000, qty: 1
        })

        expect(result.success).toBe(true)
        // SCT should be 65% (ABV is 40)
        expect(result.result!.sctRate).toBe(65)
    })

    it('should return fallback rates if DB mapping missing', async () => {
        mockPrisma.taxRate.findFirst.mockResolvedValue(null)

        const result = await calculateTaxEngine({
            countryOfOrigin: 'XX', hsCode: '0000', abvPercent: 12, cifUsd: 100, exchangeRate: 25000, qty: 1
        })

        expect(result.success).toBe(true)
        expect(result.result!.rateSource).toBe('fallback')
        expect(result.result!.importTaxRate).toBe(50) // Default fallback mapping
    })
})
