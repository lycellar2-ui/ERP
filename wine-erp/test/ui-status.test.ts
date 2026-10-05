import { describe, it, expect } from 'vitest'
import { getStatusTone, TONE_CLASS, TONES } from '@/lib/ui/status'

describe('getStatusTone', () => {
    it('maps known statuses to their tone', () => {
        expect(getStatusTone('PAID')).toBe('success')
        expect(getStatusTone('PENDING_APPROVAL')).toBe('warning')
        expect(getStatusTone('CANCELLED')).toBe('danger')
        expect(getStatusTone('CONFIRMED')).toBe('brand')
        expect(getStatusTone('IN_TRANSIT')).toBe('info')
        expect(getStatusTone('DRAFT')).toBe('neutral')
    })

    it('is case-insensitive', () => {
        expect(getStatusTone('paid')).toBe('success')
    })

    it('falls back to neutral for unknown or empty status', () => {
        expect(getStatusTone('SOMETHING_ELSE')).toBe('neutral')
        expect(getStatusTone(null)).toBe('neutral')
        expect(getStatusTone(undefined)).toBe('neutral')
        expect(getStatusTone('')).toBe('neutral')
    })

    it('lets a module override a tone', () => {
        expect(getStatusTone('DELIVERED', { DELIVERED: 'brand' })).toBe('brand')
    })
})

describe('TONE_CLASS', () => {
    it('defines token classes for every tone', () => {
        for (const tone of TONES) {
            expect(TONE_CLASS[tone]).toContain(`text-tone-${tone}-fg`)
            expect(TONE_CLASS[tone]).toContain(`bg-tone-${tone}-bg`)
            expect(TONE_CLASS[tone]).toContain(`border-tone-${tone}-border`)
        }
    })
})
