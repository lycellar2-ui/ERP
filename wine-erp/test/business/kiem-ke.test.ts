import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseQty, normalizeVintage, cleanLabel, summarize, buildCsv, type ShowroomData } from '@/app/kiem-ke/logic'

// ─── Setup Mocks ──────────────────────────────────

const mockPrisma = {
    showroomCountSpot: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    showroomCountItem: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
    showroomCountEntry: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { saveShowroomCount, addShowroomVintage, renameShowroomSpots } = await import('@/app/kiem-ke/actions')

beforeEach(() => vi.clearAllMocks())

const data: ShowroomData = {
    spots: [
        { id: 't1-1', groupName: 'Tầng 1', kind: 'WINE', name: 'Kệ to', sortOrder: 0 },
        { id: 't2-1', groupName: 'Tầng 2', kind: 'WINE', name: 'Kệ hàng lẻ', sortOrder: 1 },
        { id: 'posm-1', groupName: 'POSM', kind: 'POSM', name: 'Kho T2', sortOrder: 2 },
    ],
    items: [
        { id: 'a', kind: 'WINE', code: 'L20019', name: 'Chateauneuf du Pape', vintage: '2021', isExtra: false, sortOrder: 1 },
        { id: 'b', kind: 'WINE', code: 'L10001', name: 'Amarone, "Classico"', vintage: '', isExtra: false, sortOrder: 0 },
        { id: 'c', kind: 'WINE', code: 'L20040', name: 'Chablis', vintage: '2022', isExtra: false, sortOrder: 2 },
        { id: 'p', kind: 'POSM', code: 'P01', name: 'Ly rượu', vintage: '', isExtra: false, sortOrder: 0 },
    ],
    entries: [
        { spotId: 't1-1', itemId: 'a', qty: 3, countedBy: 'Lan', countedAt: '2026-11-01T02:00:00.000Z' },
        { spotId: 't2-1', itemId: 'a', qty: 5, countedBy: 'Minh', countedAt: '2026-11-01T03:00:00.000Z' },
        { spotId: 't2-1', itemId: 'c', qty: 0, countedBy: 'Minh', countedAt: '2026-11-01T03:05:00.000Z' },
        { spotId: 'posm-1', itemId: 'p', qty: 12, countedBy: 'Lan', countedAt: '2026-11-01T04:00:00.000Z' },
    ],
}

describe('kiem-ke input rules', () => {
    it('parses quantities: blank = not counted, 0 allowed, rejects negatives/decimals', () => {
        expect(parseQty('')).toBeNull()
        expect(parseQty(null)).toBeNull()
        expect(parseQty(0)).toBe(0)
        expect(parseQty('12')).toBe(12)
        expect(parseQty(-1)).toBe('invalid')
        expect(parseQty(2.5)).toBe('invalid')
        expect(parseQty('abc')).toBe('invalid')
    })

    it('normalizes vintages: NV/blank → "", 4-digit years only', () => {
        expect(normalizeVintage('')).toBe('')
        expect(normalizeVintage('nv')).toBe('')
        expect(normalizeVintage(' 2021 ')).toBe('2021')
        expect(normalizeVintage('21')).toBeNull()
        expect(normalizeVintage('1850')).toBeNull()
    })

    it('cleans labels and rejects empty or overlong names', () => {
        expect(cleanLabel('  Lan   Anh ')).toBe('Lan Anh')
        expect(cleanLabel('   ')).toBeNull()
        expect(cleanLabel('x'.repeat(61))).toBeNull()
    })
})

describe('kiem-ke summary', () => {
    it('totals wine per item and per floor, keeps POSM separate', () => {
        const s = summarize(data)
        expect(s.bottles).toBe(8)
        expect(s.posmTotal).toBe(12)
        const a = s.wineFound.find(x => x.item.id === 'a')!
        expect(a.total).toBe(8)
        expect(a.byGroup).toEqual({ 'Tầng 1': 3, 'Tầng 2': 5 })
        expect(s.wineMissing.map(x => x.item.id).sort()).toEqual(['b', 'c'])
        // c was checked with 0, b never counted
        expect(s.wineMissing.find(x => x.item.id === 'c')!.checked).toBe(1)
        expect(s.wineMissing.find(x => x.item.id === 'b')!.checked).toBe(0)
    })

    it('summarizes spots with people and last update', () => {
        const t2 = summarize(data).spots.find(x => x.spot.id === 't2-1')!
        expect(t2).toMatchObject({ lines: 1, qty: 5, people: ['Minh'], lastAt: '2026-11-01T03:05:00.000Z', touched: true })
    })

    it('exports a sheet with one column per spot and a POSM section', () => {
        const csv = buildCsv(data, new Date('2026-11-01T05:00:00Z'))
        const rows = csv.replace(/^﻿/, '').split('\r\n')
        expect(rows[0]).toBe('Mã hàng,Tên hàng,Vintage,Tầng 1 - Kệ to,Tầng 2 - Kệ hàng lẻ,Cộng')
        expect(rows[1]).toBe('L10001,"Amarone, ""Classico""",NV,,,0')
        expect(rows).toContain('L20019,Chateauneuf du Pape,2021,3,5,8')
        expect(rows).toContain(',Ly rượu,,12,12')
    })
})

describe('kiem-ke actions', () => {
    it('rejects invalid quantity without touching the database', async () => {
        const r = await saveShowroomCount({ spotId: 't1-1', itemId: 'a', qty: -2, countedBy: 'Lan' })
        expect(r.success).toBe(false)
        expect(mockPrisma.showroomCountEntry.upsert).not.toHaveBeenCalled()
    })

    it('requires a counter name', async () => {
        const r = await saveShowroomCount({ spotId: 't1-1', itemId: 'a', qty: 1, countedBy: ' ' })
        expect(r.success).toBe(false)
    })

    it('upserts a count for a matching spot and item', async () => {
        mockPrisma.showroomCountSpot.findUnique.mockResolvedValue({ kind: 'WINE' })
        mockPrisma.showroomCountItem.findUnique.mockResolvedValue({ kind: 'WINE' })
        const r = await saveShowroomCount({ spotId: 't1-1', itemId: 'a', qty: 4, countedBy: 'Lan' })
        expect(r.success).toBe(true)
        expect(mockPrisma.showroomCountEntry.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { spotId_itemId: { spotId: 't1-1', itemId: 'a' } },
            create: { spotId: 't1-1', itemId: 'a', qty: 4, countedBy: 'Lan' },
        }))
    })

    it('refuses a POSM item at a wine spot', async () => {
        mockPrisma.showroomCountSpot.findUnique.mockResolvedValue({ kind: 'WINE' })
        mockPrisma.showroomCountItem.findUnique.mockResolvedValue({ kind: 'POSM' })
        const r = await saveShowroomCount({ spotId: 't1-1', itemId: 'p', qty: 1, countedBy: 'Lan' })
        expect(r.success).toBe(false)
        expect(mockPrisma.showroomCountEntry.upsert).not.toHaveBeenCalled()
    })

    it('blank quantity deletes the entry', async () => {
        const r = await saveShowroomCount({ spotId: 't1-1', itemId: 'a', qty: null, countedBy: 'Lan' })
        expect(r.success).toBe(true)
        expect(mockPrisma.showroomCountEntry.deleteMany).toHaveBeenCalledWith({ where: { spotId: 't1-1', itemId: 'a' } })
    })

    it('adds an unlisted vintage and records 0 at the current spot', async () => {
        mockPrisma.showroomCountItem.findFirst.mockResolvedValue({ code: 'L20019', name: 'Chateauneuf du Pape', sortOrder: 1 })
        mockPrisma.showroomCountSpot.findUnique.mockResolvedValue({ kind: 'WINE' })
        mockPrisma.showroomCountItem.upsert.mockResolvedValue({ id: 'new' })
        mockPrisma.showroomCountEntry.findUnique.mockResolvedValue(null)
        const r = await addShowroomVintage({ code: 'L20019', vintage: '2018', spotId: 't1-1', countedBy: 'Lan' })
        expect(r).toEqual({ success: true, data: { itemId: 'new' } })
        expect(mockPrisma.showroomCountItem.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({ code: 'L20019', vintage: '2018', isExtra: true }),
        }))
        expect(mockPrisma.showroomCountEntry.create).toHaveBeenCalledWith({ data: { spotId: 't1-1', itemId: 'new', qty: 0, countedBy: 'Lan' } })
    })

    it('rejects a malformed vintage', async () => {
        const r = await addShowroomVintage({ code: 'L20019', vintage: '18', spotId: 't1-1', countedBy: 'Lan' })
        expect(r.success).toBe(false)
        expect(mockPrisma.showroomCountItem.upsert).not.toHaveBeenCalled()
    })

    it('rejects an empty spot name on rename', async () => {
        const r = await renameShowroomSpots([{ id: 't1-1', name: '  ' }])
        expect(r.success).toBe(false)
        expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
})
