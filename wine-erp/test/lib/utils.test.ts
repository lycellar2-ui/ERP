import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    formatVND,
    formatUSD,
    formatNumber,
    formatPercent,
    formatDate,
    formatDateTime,
    generatePoNo,
    generateSoNo,
    maskApiKey,
    generateLocationCode,
} from '@/lib/utils'

// ─── Currency Formatting ──────────────────────────

describe('formatVND', () => {
    it('should format a positive amount in VND', () => {
        const result = formatVND(1500000)
        expect(result).toContain('1.500.000')
        expect(result).toContain('₫')
    })

    it('should format zero', () => {
        const result = formatVND(0)
        expect(result).toContain('0')
    })

    it('should format negative amounts', () => {
        const result = formatVND(-250000)
        expect(result).toContain('250.000')
    })

    it('should not include decimal places', () => {
        const result = formatVND(1234567)
        expect(result).not.toContain(',')
        expect(result).toContain('1.234.567')
    })
})

describe('formatUSD', () => {
    it('should format with 2 decimal places', () => {
        const result = formatUSD(49.5)
        expect(result).toContain('49.50')
        expect(result).toContain('$')
    })

    it('should handle large amounts', () => {
        const result = formatUSD(10000)
        expect(result).toContain('10,000.00')
    })

    it('should format zero', () => {
        const result = formatUSD(0)
        expect(result).toContain('0.00')
    })
})

// ─── Number Formatting ────────────────────────────

describe('formatNumber', () => {
    it('should format with Vietnamese locale separators', () => {
        const result = formatNumber(1234567)
        expect(result).toBe('1.234.567')
    })

    it('should format zero', () => {
        expect(formatNumber(0)).toBe('0')
    })

    it('should format small numbers without separator', () => {
        expect(formatNumber(999)).toBe('999')
    })
})

describe('formatPercent', () => {
    it('should format with default 1 decimal place', () => {
        expect(formatPercent(45.678)).toBe('45.7%')
    })

    it('should format with custom decimals', () => {
        expect(formatPercent(33.3333, 2)).toBe('33.33%')
    })

    it('should format zero', () => {
        expect(formatPercent(0)).toBe('0.0%')
    })

    it('should format 100%', () => {
        expect(formatPercent(100, 0)).toBe('100%')
    })
})

// ─── Date Formatting ──────────────────────────────

describe('formatDate', () => {
    it('should format Date object in Vietnamese locale (dd/mm/yyyy)', () => {
        const result = formatDate(new Date('2026-03-05'))
        expect(result).toMatch(/05\/03\/2026/)
    })

    it('should format ISO string', () => {
        const result = formatDate('2025-12-25T00:00:00Z')
        expect(result).toMatch(/25\/12\/2025/)
    })
})

describe('formatDateTime', () => {
    it('should include both date and time', () => {
        const result = formatDateTime(new Date('2026-03-05T14:30:00'))
        expect(result).toMatch(/05\/03\/2026/)
        expect(result).toMatch(/14:30/)
    })
})

// ─── ID Generators ────────────────────────────────

describe('generatePoNo', () => {
    let dateSpy: any

    beforeEach(() => {
        dateSpy = vi.useFakeTimers()
        dateSpy.setSystemTime(new Date('2026-03-15'))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should generate PO number with correct format PO-YYMM-NNNN', () => {
        expect(generatePoNo(1)).toBe('PO-2603-0001')
    })

    it('should pad sequence to 4 digits', () => {
        expect(generatePoNo(42)).toBe('PO-2603-0042')
    })

    it('should handle large sequences', () => {
        expect(generatePoNo(9999)).toBe('PO-2603-9999')
    })
})

describe('generateSoNo', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-07-01'))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should generate SO number with correct format', () => {
        expect(generateSoNo(1)).toBe('SO-2607-0001')
    })

    it('should pad sequence', () => {
        expect(generateSoNo(123)).toBe('SO-2607-0123')
    })
})

// ─── API Key Masking ──────────────────────────────

describe('maskApiKey', () => {
    it('should mask middle of long keys', () => {
        const result = maskApiKey('sk-1234567890abcdef')
        expect(result).toBe('sk-1***cdef')
    })

    it('should return *** for short keys (<=8 chars)', () => {
        expect(maskApiKey('short')).toBe('***')
        expect(maskApiKey('12345678')).toBe('***')
    })

    it('should handle 9-char key (edge case)', () => {
        const result = maskApiKey('123456789')
        expect(result).toBe('1234***6789')
    })
})

// ─── Location Code ────────────────────────────────

describe('generateLocationCode', () => {
    it('should combine zone-rack-bin in uppercase', () => {
        expect(generateLocationCode('A', 'R01', 'B03')).toBe('A-R01-B03')
    })

    it('should uppercase lowercase input', () => {
        expect(generateLocationCode('zone-a', 'rack-2', 'bin-5')).toBe('ZONE-A-RACK-2-BIN-5')
    })

    it('should handle empty parts', () => {
        expect(generateLocationCode('', '', '')).toBe('--')
    })
})
