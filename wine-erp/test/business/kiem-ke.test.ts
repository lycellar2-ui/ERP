import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseQty, normalizeVintage, cleanLabel, cleanNote, MAX_NOTE, summarize, buildGroupReport, buildCsv, checkState, canRecheck, type ShowroomData } from '@/app/kiem-ke/logic'

// ─── Setup Mocks ──────────────────────────────────

const mockPrisma = {
    showroomCountSpot: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    showroomCountItem: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
    showroomCountEntry: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    showroomCountCheck: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    showroomCountNote: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { saveShowroomCount, addShowroomVintage, renameShowroomSpots, setShowroomRecheck, saveShowroomNote } = await import('@/app/kiem-ke/actions')

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
    checks: [
        // Minh rechecked Lan's 3 → still valid
        { spotId: 't1-1', itemId: 'a', checkedBy: 'Minh', qtyAtCheck: 3, checkedAt: '2026-11-01T05:00:00.000Z' },
        // Lan rechecked Minh's spot when it was 4; it is now 5 → no longer valid
        { spotId: 't2-1', itemId: 'a', checkedBy: 'Lan', qtyAtCheck: 4, checkedAt: '2026-11-01T05:10:00.000Z' },
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

    it('adds up two people counting the same spot instead of overwriting', () => {
        const two: ShowroomData = { ...data, entries: [...data.entries,
            { spotId: 't1-1', itemId: 'a', qty: 4, countedBy: 'Minh', countedAt: '2026-11-01T02:10:00.000Z' }] }
        const s = summarize(two)
        const a = s.wineFound.find(x => x.item.id === 'a')!
        expect(a.total).toBe(12)
        expect(a.byGroup['Tầng 1']).toBe(7)
        expect(a.parts).toContainEqual(expect.objectContaining({ qty: 3, by: 'Lan' }))
        expect(a.parts).toContainEqual(expect.objectContaining({ qty: 4, by: 'Minh' }))
        expect(buildCsv(two).split('\r\n')).toContain('L20019,Chateauneuf du Pape,2021,7,5,12')
    })

    it('lists what each person counted', () => {
        const s = summarize(data)
        expect(s.people.map(p => p.name)).toEqual(['Lan', 'Minh'])
        const lan = s.people[0]
        expect(lan).toMatchObject({ wine: 3, posm: 12 })
        expect(lan.lines.map(l => [l.spot.id, l.item.id, l.qty])).toEqual([['t1-1', 'a', 3], ['posm-1', 'p', 12]])
        const csv = buildCsv(data).split('\r\n')
        expect(csv).toContain('CHI TIẾT THEO NGƯỜI KIỂM')
        expect(csv.some(r => r.startsWith('Minh,Tầng 2 - Kệ hàng lẻ,L20040,Chablis,2022,0,'))).toBe(true)
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
            where: { spotId_itemId_countedBy: { spotId: 't1-1', itemId: 'a', countedBy: 'Lan' } },
            create: { spotId: 't1-1', itemId: 'a', countedBy: 'Lan', qty: 4 },
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
        // only this person's own number is removed
        expect(mockPrisma.showroomCountEntry.deleteMany).toHaveBeenCalledWith({ where: { spotId: 't1-1', itemId: 'a', countedBy: 'Lan' } })
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

describe('kiem-ke second-round recheck', () => {
    it('a recheck counts only while the total is unchanged', () => {
        expect(checkState(3, undefined)).toBe('none')
        expect(checkState(3, { qtyAtCheck: 3 })).toBe('ok')
        expect(checkState(5, { qtyAtCheck: 4 })).toBe('changed')
    })

    it('the checker must be someone other than the counter', () => {
        expect(canRecheck(['Lan'], 'Lan')).toBe(false)
        expect(canRecheck(['Lan'], 'Minh')).toBe(true)
        expect(canRecheck(['Lan', 'Minh'], 'Lan')).toBe(true)
    })

    it('reports recheck progress overall, per spot and per checker', () => {
        const s = summarize(data)
        // cells: t1-1/a, t2-1/a, t2-1/c, posm-1/p → only t1-1/a is a valid recheck
        expect(s.cells).toBe(4)
        expect(s.rechecked).toBe(1)
        expect(s.spots.find(x => x.spot.id === 't1-1')).toMatchObject({ cells: 1, rechecked: 1 })
        expect(s.spots.find(x => x.spot.id === 't2-1')).toMatchObject({ cells: 2, rechecked: 0 })
        expect(s.people.find(p => p.name === 'Minh')!.rechecks).toBe(1)
    })

    it('CSV detail names the rechecker or flags a changed count', () => {
        const rows = buildCsv(data).split('\r\n')
        expect(rows.find(r => r.startsWith('Lan,Tầng 1 - Kệ to,L20019'))!.endsWith(',Minh')).toBe(true)
        expect(rows.find(r => r.startsWith('Minh,Tầng 2 - Kệ hàng lẻ,L20019'))!.endsWith(',Số đổi sau khi Lan kiểm lại')).toBe(true)
    })

    it('refuses a recheck by the only counter', async () => {
        mockPrisma.showroomCountEntry.findMany.mockResolvedValue([{ qty: 3, countedBy: 'Lan' }])
        const r = await setShowroomRecheck({ spotId: 't1-1', itemId: 'a', checkedBy: 'Lan', checked: true })
        expect(r.success).toBe(false)
        expect(mockPrisma.showroomCountCheck.upsert).not.toHaveBeenCalled()
    })

    it('stores the total at the time of the recheck', async () => {
        mockPrisma.showroomCountEntry.findMany.mockResolvedValue([{ qty: 3, countedBy: 'Lan' }, { qty: 2, countedBy: 'Hoa' }])
        const r = await setShowroomRecheck({ spotId: 't1-1', itemId: 'a', checkedBy: 'Minh', checked: true })
        expect(r.success).toBe(true)
        expect(mockPrisma.showroomCountCheck.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { spotId_itemId: { spotId: 't1-1', itemId: 'a' } },
            create: { spotId: 't1-1', itemId: 'a', checkedBy: 'Minh', qtyAtCheck: 5 },
        }))
    })

    it('cannot recheck a row nobody counted; unticking removes the mark', async () => {
        mockPrisma.showroomCountEntry.findMany.mockResolvedValue([])
        expect((await setShowroomRecheck({ spotId: 't1-1', itemId: 'b', checkedBy: 'Minh', checked: true })).success).toBe(false)
        expect((await setShowroomRecheck({ spotId: 't1-1', itemId: 'a', checkedBy: 'Minh', checked: false })).success).toBe(true)
        expect(mockPrisma.showroomCountCheck.deleteMany).toHaveBeenCalledWith({ where: { spotId: 't1-1', itemId: 'a' } })
    })
})

describe('kiem-ke notes', () => {
    it('trims a note, treats blank as delete and caps the length', () => {
        expect(cleanNote('  hộp rách \r\n nhãn bẩn ')).toBe('hộp rách \n nhãn bẩn')
        expect(cleanNote('   ')).toBeNull()
        expect(cleanNote('x'.repeat(MAX_NOTE + 1))).toBe('invalid')
    })

    it('saves one note per person per row, even on a row without a count', async () => {
        mockPrisma.showroomCountSpot.findUnique.mockResolvedValue({ kind: 'WINE' })
        mockPrisma.showroomCountItem.findUnique.mockResolvedValue({ kind: 'WINE' })
        const r = await saveShowroomNote({ spotId: 't1-1', itemId: 'b', note: ' không thấy chai ', writtenBy: 'Lan' })
        expect(r.success).toBe(true)
        expect(mockPrisma.showroomCountNote.upsert).toHaveBeenCalledWith({
            where: { spotId_itemId_writtenBy: { spotId: 't1-1', itemId: 'b', writtenBy: 'Lan' } },
            create: { spotId: 't1-1', itemId: 'b', writtenBy: 'Lan', note: 'không thấy chai' },
            update: { note: 'không thấy chai' },
        })
        expect(mockPrisma.showroomCountEntry.upsert).not.toHaveBeenCalled()
    })

    it('a spot-wide note uses an empty itemId; a blank note deletes only the writer\'s own', async () => {
        mockPrisma.showroomCountSpot.findUnique.mockResolvedValue({ kind: 'WINE' })
        expect((await saveShowroomNote({ spotId: 't1-1', itemId: '', note: 'còn 2 thùng', writtenBy: 'Lan' })).success).toBe(true)
        expect(mockPrisma.showroomCountItem.findUnique).not.toHaveBeenCalled()
        expect((await saveShowroomNote({ spotId: 't1-1', itemId: 'a', note: '', writtenBy: 'Minh' })).success).toBe(true)
        expect(mockPrisma.showroomCountNote.deleteMany).toHaveBeenCalledWith({ where: { spotId: 't1-1', itemId: 'a', writtenBy: 'Minh' } })
    })

    it('rejects a note without a name or for a missing row', async () => {
        expect((await saveShowroomNote({ spotId: 't1-1', itemId: 'a', note: 'x', writtenBy: ' ' })).success).toBe(false)
        mockPrisma.showroomCountSpot.findUnique.mockResolvedValue({ kind: 'WINE' })
        mockPrisma.showroomCountItem.findUnique.mockResolvedValue(null)
        expect((await saveShowroomNote({ spotId: 't1-1', itemId: 'gone', note: 'x', writtenBy: 'Lan' })).success).toBe(false)
        expect(mockPrisma.showroomCountNote.upsert).not.toHaveBeenCalled()
    })

    it('CSV lists notes with spot, wine and writer', () => {
        const rows = buildCsv({ ...data, notes: [
            { spotId: 't2-1', itemId: 'c', note: 'hộp rách, 1 chai', writtenBy: 'Minh', updatedAt: '2026-11-01T06:00:00.000Z' },
            { spotId: 't1-1', itemId: '', note: 'còn 2 thùng', writtenBy: 'Lan', updatedAt: '2026-11-01T06:05:00.000Z' },
        ] }).split('\r\n')
        const at = rows.indexOf('GHI CHÚ')
        expect(at).toBeGreaterThan(0)
        expect(rows[at + 2].startsWith('Tầng 1 - Kệ to,,(cả vị trí),,Lan,còn 2 thùng,')).toBe(true)
        expect(rows[at + 3].startsWith('Tầng 2 - Kệ hàng lẻ,L20040,Chablis,2022,Minh,"hộp rách, 1 chai",')).toBe(true)
    })
})

describe('kiem-ke group report (biên bản)', () => {
    it('one column per spot of the group, only rows with stock, totals and recheck progress', () => {
        const d: ShowroomData = { ...data, spots: [...data.spots, { id: 't1-2', groupName: 'Tầng 1', kind: 'WINE', name: 'Kệ nhỏ', sortOrder: 3 }],
            entries: [...data.entries, { spotId: 't1-2', itemId: 'b', qty: 2, countedBy: 'Hoa', countedAt: '2026-11-01T01:00:00.000Z' }],
            notes: [{ spotId: 't1-1', itemId: '', note: 'còn 2 thùng', writtenBy: 'Lan', updatedAt: '2026-11-01T06:00:00.000Z' }] }
        const r = buildGroupReport(d, 'Tầng 1')!
        expect(r.spots.map(s => s.spot.id)).toEqual(['t1-1', 't1-2'])
        expect(r.rows.map(x => [x.item.code, x.bySpot, x.total])).toEqual([['L10001', [0, 2], 2], ['L20019', [3, 0], 3]])
        expect(r.total).toBe(5)
        expect(r.people).toEqual(['Hoa', 'Lan'])
        expect([r.rechecked, r.cells]).toEqual([1, 2])
        expect(r.unchecked.map(u => u.item.code)).toEqual(['L10001'])
        expect(r.notes[0]).toMatchObject({ item: null, note: 'còn 2 thùng' })
        expect(r.firstAt).toBe('2026-11-01T01:00:00.000Z')
    })

    it('a zero count is a checked cell but not a row; unknown group gives null', () => {
        const r = buildGroupReport(data, 'Tầng 2')!
        expect(r.rows.map(x => x.item.code)).toEqual(['L20019'])
        expect(r.cells).toBe(2)
        expect(buildGroupReport(data, 'Tầng 9')).toBeNull()
    })
})
