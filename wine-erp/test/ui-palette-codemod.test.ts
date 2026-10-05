import { describe, it, expect } from 'vitest'
import { transform } from '../scripts/ui-palette-codemod.mjs'

describe('ui-palette-codemod transform', () => {
    it('maps legacy hex colors case-insensitively', () => {
        const { out, stats } = transform(`style={{ color: '#87cbb9', background: '#E05252' }}`)
        expect(out).toBe(`style={{ color: '#0E7490', background: '#B91C1C' }}`)
        expect(stats.hex).toBe(2)
    })

    it('keeps unknown hex and does not touch longer hex-like tokens', () => {
        const src = `color: '#0F172A'; id="#87CBB9AA"`
        expect(transform(src).out).toBe(src)
    })

    it('maps rgba triplets and preserves alpha', () => {
        expect(transform('rgba(135,203,185,0.25)').out).toBe('rgba(8,145,178,0.25)')
        expect(transform('rgba(139, 26, 46, 0.15)').out).toBe('rgba(185,28,28, 0.15)')
    })

    it('replaces dark-only overlay and card rgba values', () => {
        expect(transform(`background: 'rgba(10,5,2,0.7)'`).out).toBe(`background: 'rgba(15,23,42,0.4)'`)
        expect(transform(`background: 'rgba(27,46,61,0.4)'`).out).toBe(`background: '#F8FAFC'`)
    })

    it('upgrades pale text utilities to readable shades', () => {
        expect(transform('className="text-emerald-400 bg-emerald-400"').out).toBe('className="text-emerald-700 bg-emerald-400"')
    })

    it('strips dark: variants', () => {
        expect(transform('className="bg-white dark:bg-slate-900 dark:hover:text-white p-2"').out).toBe('className="bg-white p-2"')
    })

    it('arbitrary Tailwind hex classes are mapped too', () => {
        expect(transform('border-[#87CBB9]/40 text-[#4A6A7A]').out).toBe('border-[#0E7490]/40 text-[#64748B]')
    })
})
