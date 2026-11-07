// Pure helpers for the public showroom quick count (/kiem-ke).
// Kept out of the 'use server' file so they can be unit-tested and reused on the client.

export type ShowroomSpot = { id: string; groupName: string; kind: string; name: string; sortOrder: number }
export type ShowroomItem = {
    id: string; kind: string; code: string; name: string; vintage: string; isExtra: boolean; sortOrder: number
    packSize?: number | null
}
export type ShowroomEntry = {
    spotId: string; itemId: string; qty: number; countedBy: string; countedAt: string
    cases?: number | null; loose?: number | null
}
export type ShowroomCheck = { spotId: string; itemId: string; checkedBy: string; qtyAtCheck: number; checkedAt: string }
/** itemId = "" → ghi chú chung cho cả vị trí. */
export type ShowroomNote = { spotId: string; itemId: string; note: string; writtenBy: string; updatedAt: string }
export type ShowroomData = {
    spots: ShowroomSpot[]; items: ShowroomItem[]; entries: ShowroomEntry[]; checks: ShowroomCheck[]
    notes?: ShowroomNote[]
}

/** Danh sách mã rượu đóng thùng 12 chai (xác nhận từ bảng kiểm kê Tầng 2 & bộ chứng từ nhập khẩu Purchasing). */
export const PACK_12_CODES = new Set([
    'L10023', 'L10024', 'L10025', 'L10026', 'L10027', 'L10028', 'L10029',
    'L10032', 'L10033', 'L10039', 'L10042',
    'L30001', 'L30002', 'L30003', 'L30004', 'L30005',
    'L40001', 'L40002', 'L40003', 'L40004', 'L40009',
    'L40010', 'L40011', 'L40012', 'L40013', 'L40014',
    'L60001', 'L60002',
    'L70001', 'L70002', 'L70005',
])

/** Quy cách đóng gói (số chai/thùng): 6 hoặc 12 đối với rượu; null đối với POSM. */
export function packSizeOf(item: Pick<ShowroomItem, 'kind' | 'code' | 'packSize'>): number | null {
    if (item.kind === 'POSM') return null
    if (item.packSize === 6 || item.packSize === 12) return item.packSize
    return PACK_12_CODES.has(item.code) ? 12 : 6
}

/** Chỉ bật chế độ nhập Số thùng + Số chai lẻ cho khu vực Tầng 2. */
export function isCaseSpot(spot?: Pick<ShowroomSpot, 'groupName' | 'kind'> | null): boolean {
    return Boolean(spot && spot.kind !== 'POSM' && spot.groupName === 'Tầng 2')
}

/**
 * Tính tổng số chai từ số thùng + số chai lẻ.
 * Giữ nguyên số chai lẻ người dùng nhập (không tự quy đổi chai lẻ >= packSize thành thùng vì thực tế có thể là chai lẻ ngoài thùng).
 * Khi cả cases và loose đều null → chưa đếm (qty = null).
 */
export function calcCaseLooseTotal(
    cases: number | null,
    loose: number | null,
    packSize: number
): { cases: number | null; loose: number | null; qty: number | null } {
    if (cases === null && loose === null) return { cases: null, loose: null, qty: null }
    const c = cases ?? 0
    const l = loose ?? 0
    return { cases, loose, qty: c * packSize + l }
}

/** Lấy số thùng và số chai lẻ của một dòng đếm (giữ nguyên số chai lẻ đã lưu). */
export function entryCaseLoose(
    entry: Pick<ShowroomEntry, 'qty' | 'cases' | 'loose'>,
    packSize: number
): { cases: number; loose: number; qty: number } {
    if (entry.cases !== undefined && entry.cases !== null || entry.loose !== undefined && entry.loose !== null) {
        return { cases: entry.cases ?? 0, loose: entry.loose ?? 0, qty: entry.qty }
    }
    return {
        cases: packSize > 0 ? Math.floor(entry.qty / packSize) : 0,
        loose: packSize > 0 ? entry.qty % packSize : entry.qty,
        qty: entry.qty,
    }
}

export type CheckState = 'none' | 'ok' | 'changed'

/** "ok" chỉ khi tổng hiện tại còn đúng bằng tổng lúc người kiểm lại tích; đổi số sau đó → "changed". */
export function checkState(currentTotal: number, check?: Pick<ShowroomCheck, 'qtyAtCheck'>): CheckState {
    if (!check) return 'none'
    return check.qtyAtCheck === currentTotal ? 'ok' : 'changed'
}

/** Người kiểm lại phải khác người đếm: cần ít nhất một dòng đếm của người khác. */
export function canRecheck(counters: string[], checker: string): boolean {
    return counters.some(c => c !== checker)
}

export const MAX_QTY = 100_000

/** "" → null (chưa đếm); số nguyên 0..MAX_QTY → số; còn lại → "invalid". */
export function parseQty(raw: unknown): number | null | 'invalid' {
    if (raw === null || raw === undefined || raw === '') return null
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
    if (!Number.isInteger(n) || n < 0 || n > MAX_QTY) return 'invalid'
    return n
}

/** "" / "NV" → ""; năm 4 chữ số 1900–2099 → chuỗi năm; còn lại → null (không hợp lệ). */
export function normalizeVintage(raw: unknown): string | null {
    const s = String(raw ?? '').trim().toUpperCase()
    if (s === '' || s === 'NV') return ''
    return /^(19|20)\d\d$/.test(s) ? s : null
}

export const MAX_NOTE = 500

/** Ghi chú: bỏ khoảng trắng đầu/cuối, tối đa MAX_NOTE ký tự; "" → null (xoá ghi chú); quá dài → "invalid". */
export function cleanNote(raw: unknown): string | null | 'invalid' {
    const s = String(raw ?? '').replace(/\r\n?/g, '\n').trim()
    if (!s) return null
    return s.length <= MAX_NOTE ? s : 'invalid'
}

/** Tên người kiểm / tên vị trí: bỏ khoảng trắng thừa, 1–60 ký tự. */
export function cleanLabel(raw: unknown): string | null {
    const s = String(raw ?? '').replace(/\s+/g, ' ').trim()
    return s.length >= 1 && s.length <= 60 ? s : null
}

export function normalizeSearch(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
}

/** Nhận diện vị trí Kệ hàng lẻ / Kệ cạnh hàng lẻ (ưu tiên chế độ chụp ảnh liệt kê danh sách chai lẻ). */
export function isLooseShelfSpot(spot?: Pick<ShowroomSpot, 'id' | 'name'> | null): boolean {
    if (!spot) return false
    const norm = normalizeSearch(spot.name)
    return spot.id === 't2-4' || spot.id === 't2-8' || norm.includes('hang le') || norm.includes('ke le')
}

export function sortItems(items: ShowroomItem[]): ShowroomItem[] {
    return [...items].sort((a, b) => a.code.localeCompare(b.code) || a.vintage.localeCompare(b.vintage))
}

export type ItemSummary = {
    item: ShowroomItem
    total: number
    checked: number
    byGroup: Record<string, number>
    t2Cases: number
    t2Loose: number
    parts: Array<{ spot: ShowroomSpot; qty: number; cases?: number | null; loose?: number | null; by: string }>
}

export type PersonSummary = {
    name: string
    wine: number
    posm: number
    lines: Array<{ spot: ShowroomSpot; item: ShowroomItem; qty: number; cases?: number | null; loose?: number | null; at: string }>
    rechecks?: number
}

export type SpotSummary = {
    spot: ShowroomSpot; lines: number; qty: number; cases: number; loose: number; people: string[]; lastAt: string | null; touched: boolean
    cells: number; rechecked: number // dòng (mã) có số tại vị trí / số dòng đã kiểm lại còn đúng
}

/**
 * Gộp số đếm theo mặt hàng, theo vị trí và theo người kiểm.
 * Mỗi người có số riêng nên tổng = cộng các người. Số 0 vẫn tính là "đã kiểm" nhưng không cộng vào tổng.
 */
export function summarize(data: ShowroomData) {
    const spotById = new Map(data.spots.map(s => [s.id, s]))
    const itemById = new Map(data.items.map(i => [i.id, i]))
    const people = new Map<string, PersonSummary>()
    const items = new Map<string, ItemSummary>()
    for (const item of data.items) items.set(item.id, { item, total: 0, checked: 0, byGroup: {}, t2Cases: 0, t2Loose: 0, parts: [] })
    const spots = new Map<string, SpotSummary>()
    for (const spot of data.spots) spots.set(spot.id, { spot, lines: 0, qty: 0, cases: 0, loose: 0, people: [], lastAt: null, touched: false, cells: 0, rechecked: 0 })

    let t2Cases = 0, t2Loose = 0, t2Bottles = 0

    for (const e of data.entries) {
        const spot = spotById.get(e.spotId)
        const is = items.get(e.itemId)
        const ss = spots.get(e.spotId)
        const item = itemById.get(e.itemId)
        if (!spot || !is || !ss || !item) continue
        const p = people.get(e.countedBy) ?? { name: e.countedBy, wine: 0, posm: 0, lines: [] }
        people.set(e.countedBy, p)
        const t2 = isCaseSpot(spot)
        const pack = packSizeOf(item) ?? 6
        const cl = t2 ? entryCaseLoose(e, pack) : null
        p.lines.push({ spot, item, qty: e.qty, cases: cl?.cases ?? null, loose: cl?.loose ?? null, at: e.countedAt })
        if (spot.kind === 'POSM') p.posm += e.qty; else p.wine += e.qty
        is.checked++
        ss.touched = true
        if (!ss.people.includes(e.countedBy)) ss.people.push(e.countedBy)
        if (!ss.lastAt || e.countedAt > ss.lastAt) ss.lastAt = e.countedAt
        if (e.qty <= 0) continue
        is.total += e.qty
        is.byGroup[spot.groupName] = (is.byGroup[spot.groupName] ?? 0) + e.qty
        is.parts.push({ spot, qty: e.qty, cases: cl?.cases ?? null, loose: cl?.loose ?? null, by: e.countedBy })
        ss.lines++
        ss.qty += e.qty
        if (cl) {
            ss.cases += cl.cases
            ss.loose += cl.loose
            is.t2Cases += cl.cases
            is.t2Loose += cl.loose
            t2Cases += cl.cases
            t2Loose += cl.loose
            t2Bottles += e.qty
        }
    }

    // Recheck progress per spot: one "cell" per spot + item that has any count.
    const cellTotals = new Map<string, number>()
    for (const e of data.entries) cellTotals.set(`${e.spotId}|${e.itemId}`, (cellTotals.get(`${e.spotId}|${e.itemId}`) ?? 0) + e.qty)
    const checkByCell = new Map((data.checks ?? []).map(c => [`${c.spotId}|${c.itemId}`, c]))
    const checkers = new Map<string, number>()
    let cells = 0, rechecked = 0
    for (const [cell, total] of cellTotals) {
        const ss = spots.get(cell.split('|')[0])
        if (!ss) continue
        ss.cells++; cells++
        const c = checkByCell.get(cell)
        if (checkState(total, c) === 'ok') {
            ss.rechecked++; rechecked++
            checkers.set(c!.checkedBy, (checkers.get(c!.checkedBy) ?? 0) + 1)
        }
    }

    const all = sortItems(data.items).map(i => items.get(i.id)!)
    const wine = all.filter(s => s.item.kind !== 'POSM')
    const posm = data.items.filter(i => i.kind === 'POSM').sort((a, b) => a.sortOrder - b.sortOrder).map(i => items.get(i.id)!)
    return {
        wineFound: wine.filter(s => s.total > 0),
        wineMissing: wine.filter(s => s.total === 0),
        wineCount: wine.length,
        bottles: wine.reduce((t, s) => t + s.total, 0),
        t2Cases,
        t2Loose,
        t2Bottles,
        posm,
        posmTotal: posm.reduce((t, s) => t + s.total, 0),
        spots: [...spots.values()],
        cells,
        rechecked,
        people: [...people.values()]
            .map(p => ({ ...p, rechecks: checkers.get(p.name) ?? 0, lines: p.lines.sort((a, b) => a.spot.sortOrder - b.spot.sortOrder || a.item.code.localeCompare(b.item.code)) }))
            .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    }
}

function csvCell(v: unknown): string {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Bảng giống phiếu kiểm hàng: mỗi vị trí một cột, rượu trước rồi POSM. Có BOM để Excel đọc đúng tiếng Việt. */
export function buildCsv(data: ShowroomData, exportedAt: Date = new Date()): string {
    // Several people may count the same spot: the cell is their sum; the detail section lists each person.
    const qty = new Map<string, number>()
    for (const e of data.entries) qty.set(`${e.spotId}|${e.itemId}`, (qty.get(`${e.spotId}|${e.itemId}`) ?? 0) + e.qty)
    const ordered = [...data.spots].sort((a, b) => a.sortOrder - b.sortOrder)
    const wineSpots = ordered.filter(s => s.kind !== 'POSM')
    const posmSpots = ordered.filter(s => s.kind === 'POSM')
    const label = (s: ShowroomSpot) => (s.groupName === s.name ? s.name : `${s.groupName} - ${s.name}`)
    const rowFor = (item: ShowroomItem, spots: ShowroomSpot[]) => {
        const vals = spots.map(s => qty.get(`${s.id}|${item.id}`) ?? '')
        return [...vals, vals.reduce<number>((t, v) => t + (typeof v === 'number' ? v : 0), 0)]
    }

    const lines: unknown[][] = [['Mã hàng', 'Tên hàng', 'Vintage', ...wineSpots.map(label), 'Cộng']]
    for (const item of sortItems(data.items.filter(i => i.kind !== 'POSM'))) {
        lines.push([item.code, item.name, item.vintage || 'NV', ...rowFor(item, wineSpots)])
    }
    const posmItems = data.items.filter(i => i.kind === 'POSM').sort((a, b) => a.sortOrder - b.sortOrder)
    if (posmSpots.length && posmItems.length) {
        lines.push([], ['KIỂM POSM'], ['', 'Tên hàng', '', ...posmSpots.map(s => s.name), 'Cộng'])
        for (const item of posmItems) lines.push(['', item.name, '', ...rowFor(item, posmSpots)])
    }
    const s = summarize(data)
    if (s.people.length) {
        const checks = new Map((data.checks ?? []).map(c => [`${c.spotId}|${c.itemId}`, c]))
        const recheckCell = (spotId: string, itemId: string) => {
            const c = checks.get(`${spotId}|${itemId}`)
            const st = checkState(qty.get(`${spotId}|${itemId}`) ?? 0, c)
            return st === 'ok' ? c!.checkedBy : st === 'changed' ? `Số đổi sau khi ${c!.checkedBy} kiểm lại` : ''
        }
        lines.push([], ['CHI TIẾT THEO NGƯỜI KIỂM'], ['Người kiểm', 'Vị trí', 'Mã hàng', 'Tên hàng', 'Vintage', 'Số lượng', 'Thời gian', 'Kiểm lại bởi'])
        for (const p of s.people) for (const l of p.lines) {
            lines.push([p.name, label(l.spot), l.item.kind === 'POSM' ? '' : l.item.code, l.item.name,
                l.item.kind === 'POSM' ? '' : l.item.vintage || 'NV', l.qty, new Date(l.at).toLocaleString('vi-VN'),
                recheckCell(l.spot.id, l.item.id)])
        }
    }
    const itemById = new Map(data.items.map(i => [i.id, i]))
    const spotById = new Map(data.spots.map(sp => [sp.id, sp]))
    const notes = (data.notes ?? []).filter(n => spotById.has(n.spotId))
        .sort((a, b) => spotById.get(a.spotId)!.sortOrder - spotById.get(b.spotId)!.sortOrder || a.updatedAt.localeCompare(b.updatedAt))
    if (notes.length) {
        lines.push([], ['GHI CHÚ'], ['Vị trí', 'Mã hàng', 'Tên hàng', 'Vintage', 'Người ghi', 'Ghi chú', 'Thời gian'])
        for (const n of notes) {
            const it = itemById.get(n.itemId)
            const wine = it && it.kind !== 'POSM'
            lines.push([label(spotById.get(n.spotId)!), wine ? it.code : '', it ? it.name : '(cả vị trí)', wine ? it.vintage || 'NV' : '',
                n.writtenBy, n.note, new Date(n.updatedAt).toLocaleString('vi-VN')])
        }
    }
    lines.push([], ['Người kiểm', s.people.map(p => p.name).join(', ')], ['Xuất lúc', exportedAt.toLocaleString('vi-VN')])
    return '﻿' + lines.map(r => r.map(csvCell).join(',')).join('\r\n')
}

export type GroupReport = {
    group: string
    kind: string
    isCaseGroup: boolean
    spots: Array<{
        spot: ShowroomSpot; lines: number; qty: number; cases: number; loose: number; people: string[]
        cells: number; rechecked: number; checkers: string[]
    }>
    rows: Array<{ item: ShowroomItem; packSize: number | null; bySpot: number[]; cases: number; loose: number; total: number }>
    spotTotals: number[]
    totalCases: number
    totalLoose: number
    total: number
    people: string[]
    checkers: string[]
    firstAt: string | null
    lastAt: string | null
    cells: number
    rechecked: number
    unchecked: Array<{ spot: ShowroomSpot; item: ShowroomItem; total: number }>
    notes: Array<{ spot: ShowroomSpot; item: ShowroomItem | null; note: string; writtenBy: string; updatedAt: string }>
}

/**
 * Số liệu biên bản kiểm kê cho một nhóm vị trí (Tầng 1, Tầng 2, Hàng mẫu, POSM):
 * mỗi vị trí một cột, chỉ các dòng có hàng; kèm tiến độ kiểm lại lần 2 và ghi chú.
 */
export function buildGroupReport(data: ShowroomData, group: string): GroupReport | null {
    const spots = data.spots.filter(s => s.groupName === group).sort((a, b) => a.sortOrder - b.sortOrder)
    if (!spots.length) return null
    const isCaseGroup = isCaseSpot(spots[0])
    const col = new Map(spots.map((s, i) => [s.id, i]))
    const itemById = new Map(data.items.map(i => [i.id, i]))
    const cell = new Map<string, number>()
    const cellCases = new Map<string, number>()
    const cellLoose = new Map<string, number>()
    const stats = spots.map(spot => ({ spot, lines: 0, qty: 0, cases: 0, loose: 0, people: [] as string[], cells: 0, rechecked: 0, checkers: [] as string[] }))
    const people = new Set<string>()
    let firstAt: string | null = null, lastAt: string | null = null
    for (const e of data.entries) {
        const c = col.get(e.spotId)
        const item = itemById.get(e.itemId)
        if (c === undefined || !item) continue
        const key = `${e.spotId}|${e.itemId}`
        cell.set(key, (cell.get(key) ?? 0) + e.qty)
        if (isCaseGroup && e.qty > 0) {
            const cl = entryCaseLoose(e, packSizeOf(item) ?? 6)
            cellCases.set(key, (cellCases.get(key) ?? 0) + cl.cases)
            cellLoose.set(key, (cellLoose.get(key) ?? 0) + cl.loose)
        }
        people.add(e.countedBy)
        if (!stats[c].people.includes(e.countedBy)) stats[c].people.push(e.countedBy)
        if (!firstAt || e.countedAt < firstAt) firstAt = e.countedAt
        if (!lastAt || e.countedAt > lastAt) lastAt = e.countedAt
    }

    const checks = new Map((data.checks ?? []).map(c => [`${c.spotId}|${c.itemId}`, c]))
    const checkers = new Set<string>()
    const unchecked: GroupReport['unchecked'] = []
    const byItem = new Map<string, number[]>()
    const casesByItem = new Map<string, number>()
    const looseByItem = new Map<string, number>()
    for (const [key, total] of cell) {
        const [spotId, itemId] = key.split('|')
        const st = stats[col.get(spotId)!]
        st.cells++
        const c = checks.get(key)
        if (checkState(total, c) === 'ok') {
            st.rechecked++
            checkers.add(c!.checkedBy)
            if (!st.checkers.includes(c!.checkedBy)) st.checkers.push(c!.checkedBy)
        } else {
            unchecked.push({ spot: st.spot, item: itemById.get(itemId)!, total })
        }
        if (total <= 0) continue
        st.lines++
        st.qty += total
        const cs = cellCases.get(key) ?? 0
        const ls = cellLoose.get(key) ?? 0
        st.cases += cs
        st.loose += ls
        casesByItem.set(itemId, (casesByItem.get(itemId) ?? 0) + cs)
        looseByItem.set(itemId, (looseByItem.get(itemId) ?? 0) + ls)
        const row = byItem.get(itemId) ?? spots.map(() => 0)
        row[col.get(spotId)!] = total
        byItem.set(itemId, row)
    }

    const order = (a: ShowroomItem, b: ShowroomItem) =>
        a.kind === 'POSM' ? a.sortOrder - b.sortOrder : a.code.localeCompare(b.code) || a.vintage.localeCompare(b.vintage)
    const rows = [...byItem].map(([id, bySpot]) => {
        const item = itemById.get(id)!
        return {
            item,
            packSize: packSizeOf(item),
            bySpot,
            cases: casesByItem.get(id) ?? 0,
            loose: looseByItem.get(id) ?? 0,
            total: bySpot.reduce((t, n) => t + n, 0),
        }
    }).sort((a, b) => order(a.item, b.item))
    const spotTotals = stats.map(s => s.qty)
    const totalCases = stats.reduce((t, s) => t + s.cases, 0)
    const totalLoose = stats.reduce((t, s) => t + s.loose, 0)
    const vi = (a: string, b: string) => a.localeCompare(b, 'vi')
    return {
        group,
        kind: spots[0].kind,
        isCaseGroup,
        spots: stats.map(s => ({ ...s, people: s.people.sort(vi), checkers: s.checkers.sort(vi) })),
        rows,
        spotTotals,
        totalCases,
        totalLoose,
        total: spotTotals.reduce((t, n) => t + n, 0),
        people: [...people].sort(vi),
        checkers: [...checkers].sort(vi),
        firstAt,
        lastAt,
        cells: stats.reduce((t, s) => t + s.cells, 0),
        rechecked: stats.reduce((t, s) => t + s.rechecked, 0),
        unchecked: unchecked.sort((a, b) => a.spot.sortOrder - b.spot.sortOrder || order(a.item, b.item)),
        notes: (data.notes ?? [])
            .filter(n => col.has(n.spotId))
            .map(n => ({ spot: stats[col.get(n.spotId)!].spot, item: itemById.get(n.itemId) ?? null, note: n.note, writtenBy: n.writtenBy, updatedAt: n.updatedAt }))
            .sort((a, b) => a.spot.sortOrder - b.spot.sortOrder || a.updatedAt.localeCompare(b.updatedAt)),
    }
}

export type ShowroomAnomaly = {
    type: 'DUPLICATE_COUNT' | 'CASE_LOOSE_SUSPICIOUS' | 'UNCHECKED_HIGH_QTY'
    severity: 'high' | 'medium'
    spot: ShowroomSpot
    item: ShowroomItem
    message: string
    detail: string
}

/**
 * Phát hiện các dấu hiệu bất thường trong dữ liệu kiểm kê:
 * 1) Hai người cùng nhập số ở một vị trí mà chưa kiểm lại (đặc biệt khi 2 số bằng nhau -> dễ do người thứ 2 định kiểm lại nhưng lại nhập số đếm làm cộng đôi).
 * 2) Ở Tầng 2: số chai lẻ lớn gấp >= 2 lần quy cách thùng hoặc số thùng trên 1 kệ quá lớn (>= 30 thùng -> dễ do gõ tổng chai vào ô số thùng).
 * 3) Dòng có số lượng lớn (>= 24 chai) nhưng chưa có người thứ 2 tích kiểm lại.
 */
export function auditAnomalies(data: ShowroomData): ShowroomAnomaly[] {
    const spotById = new Map(data.spots.map(s => [s.id, s]))
    const itemById = new Map(data.items.map(i => [i.id, i]))
    const checkByCell = new Map((data.checks ?? []).map(c => [`${c.spotId}|${c.itemId}`, c]))
    const byCell = new Map<string, ShowroomEntry[]>()
    for (const e of data.entries) {
        if (e.qty <= 0) continue
        const key = `${e.spotId}|${e.itemId}`
        byCell.set(key, [...(byCell.get(key) ?? []), e])
    }

    const out: ShowroomAnomaly[] = []
    for (const [key, list] of byCell) {
        const [spotId, itemId] = key.split('|')
        const spot = spotById.get(spotId)
        const item = itemById.get(itemId)
        if (!spot || !item) continue
        const total = list.reduce((t, e) => t + e.qty, 0)
        const isCheckedOk = checkState(total, checkByCell.get(key)) === 'ok'

        if (list.length >= 2 && !isCheckedOk) {
            const sameQty = list.every(e => e.qty === list[0].qty)
            out.push({
                type: 'DUPLICATE_COUNT',
                severity: sameQty ? 'high' : 'medium',
                spot,
                item,
                message: sameQty
                    ? `Nghi ngờ đếm trùng (cộng đôi): ${list.map(e => `${e.countedBy}=${e.qty}`).join(', ')} → Tổng ${total}`
                    : `Nhiều người cùng nhập số tại 1 kệ: ${list.map(e => `${e.countedBy}=${e.qty}`).join(', ')} → Tổng ${total}`,
                detail: sameQty
                    ? 'Hai người nhập đúng cùng một số lượng. Nếu người thứ 2 chỉ kiểm lại thì cần xóa dòng trùng và bấm "Kiểm lại: đúng".'
                    : 'Kiểm tra xem hai người đếm hai khu khác nhau trong cùng vị trí hay vô tình đếm trùng.',
            })
        }

        if (isCaseSpot(spot)) {
            const pack = packSizeOf(item) ?? 6
            for (const e of list) {
                const cl = entryCaseLoose(e, pack)
                if (cl.cases >= 35) {
                    out.push({
                        type: 'CASE_LOOSE_SUSPICIOUS',
                        severity: 'high',
                        spot,
                        item,
                        message: `Số thùng rất lớn (${cl.cases} thùng = ${e.qty} chai) do ${e.countedBy} nhập`,
                        detail: `Kiểm tra xem ${e.countedBy} có gõ nhầm tổng số chai vào ô "Số thùng" hay không.`,
                    })
                } else if (cl.loose >= pack * 2 && cl.cases === 0) {
                    out.push({
                        type: 'CASE_LOOSE_SUSPICIOUS',
                        severity: 'medium',
                        spot,
                        item,
                        message: `Nhập 0 thùng + ${cl.loose} chai lẻ (quy cách thùng ${pack}) do ${e.countedBy} nhập`,
                        detail: 'Kiểm tra xem đây là chai lẻ thực tế hay chưa tách số thùng nguyên.',
                    })
                }
            }
        }

        if (total >= 24 && !isCheckedOk && list.length === 1) {
            out.push({
                type: 'UNCHECKED_HIGH_QTY',
                severity: 'medium',
                spot,
                item,
                message: `Số lượng lớn (${total} ${spot.kind === 'POSM' ? 'cái' : 'chai'}) chưa được kiểm lại lần 2`,
                detail: `Đếm bởi ${list[0].countedBy}. Nên có người thứ 2 kiểm chéo và tích xác nhận.`,
            })
        }
    }

    return out.sort((a, b) => (a.severity === 'high' ? -1 : 1) - (b.severity === 'high' ? -1 : 1) || a.spot.sortOrder - b.spot.sortOrder)
}

export type AiCandidateOption = {
    itemId: string
    code: string
    name: string
    vintage: string
    packSize: number
}

export type AiVoiceMatch = {
    spotId?: string
    spotName?: string
    itemId: string
    code: string
    name: string
    vintage: string
    packSize: number | null
    cases: number | null
    loose: number | null
    qty: number
    isNewVintage?: boolean
    confidence?: string
    suggestedMode?: 'add' | 'replace'
    availableVintages?: string[]
    alternatives?: AiCandidateOption[]
    warning?: string
    reason?: string
}

export type AiVisionShelfItem = {
    itemId: string | null
    code: string
    name: string
    vintage: string
    isNewVintage: boolean
    packSize: number
    cases: number
    loose: number
    qty: number
    confidence: string
    positionNote: string
    warning?: string
    availableVintages?: string[]
    alternatives?: AiCandidateOption[]
}

export type AiVisionMatch = {
    spotId?: string
    summaryText?: string
    sceneWarning?: string
    items?: AiVisionShelfItem[]
    itemId: string | null
    code: string
    name: string
    vintage: string
    isNewVintage: boolean
    detectedPackSize: number | null
    estimatedCases: number | null
    estimatedLoose: number | null
    confidence: string
    note: string
}

const VIET_PHONETIC_WINES: Array<[RegExp, string]> = [
    [/(?:^|(?<=\s))(xa\s*bli|cha\s*bli|sáp\s*li|xap\s*li)(?=\s|$|[,.;])/gi, 'Chablis'],
    [/(?:^|(?<=\s))(pô\s*ma|po\s*ma)(?=\s|$|[,.;])/gi, 'Pommard'],
    [/(?:^|(?<=\s))(buốc\s*gôn|booc\s*gôn|bốc\s*gôn)(?=\s|$|[,.;])/gi, 'Bourgogne'],
    [/(?:^|(?<=\s))(cha\s*tô\s*nớp|sa\s*tô\s*nớp|chato\s*nop)(?=\s|$|[,.;])/gi, 'Chateauneuf du Pape'],
    [/(?:^|(?<=\s))(a\s*ma\s*rôn|ama\s*rôn|a\s*ma\s*rô\s*nê)(?=\s|$|[,.;])/gi, 'Amarone'],
    [/(?:^|(?<=\s))(prô\s*sê\s*cô|pro\s*se\s*co|pờ\s*rô\s*sê\s*cô)(?=\s|$|[,.;])/gi, 'Prosecco'],
    [/(?:^|(?<=\s))(pi\s*nô\s*gri\s*giô|pi\s*nô)(?=\s|$|[,.;])/gi, 'Pinot'],
    [/(?:^|(?<=\s))(san\s*vin\s*xen\s*dô|san\s*vin\s*xen\s*zô|san\s*vin\s*sen)(?=\s|$|[,.;])/gi, 'San Vincenzo'],
    [/(?:^|(?<=\s))(rê\s*an\s*đa|ri\s*an\s*đa)(?=\s|$|[,.;])/gi, 'Realda'],
    [/(?:^|(?<=\s))(ca\s*la\s*bri\s*a|ca\s*la\s*bi\s*a)(?=\s|$|[,.;])/gi, 'Calabria'],
    [/(?:^|(?<=\s))(môn\s*tê\s*pun|môn\s*tê)(?=\s|$|[,.;])/gi, 'Montepulciano'],
    [/(?:^|(?<=\s))(sô\s*vinh\s*giông|xô\s*vi\s*nhông)(?=\s|$|[,.;])/gi, 'Sauvignon'],
    [/(?:^|(?<=\s))(sác\s*đô\s*nây|cha\s*đô\s*nay)(?=\s|$|[,.;])/gi, 'Chardonnay'],
    [/(?:^|(?<=\s))(ca\s*béc\s*nê|ca\s*be\s*nê)(?=\s|$|[,.;])/gi, 'Cabernet'],
    [/(?:^|(?<=\s))(ríp\s*pát\s*xô|ri\s*pa\s*sô)(?=\s|$|[,.;])/gi, 'Ripasso'],
    [/(?:^|(?<=\s))(ru\s*bi\s*côn\s*nê|ru\s*bi\s*côn)(?=\s|$|[,.;])/gi, 'Rubicone'],
    // Phiên âm tiếng Việt của từ "vintage" / "non-vintage" khi thu âm bằng giọng nói
    [/(?:^|(?<=\s))(nôn\s*vin\s*tết|nôn\s*phim\s*tết|non\s*vintage|không\s*niên\s*vụ)(?=\s|$|[,.;])/gi, 'vintage NV'],
    [/(?:^|(?<=\s))(phim\s*tết|phim\s*tét|phiên\s*tết|phim\s*tech|phim\s*text|vin\s*tết|vin\s*tét|vin\s*tịt|vin\s*tịch|vin\s*tệch|vin\s*tech|vin\s*text|vintết|vintet|vintịt|vinh\s*tết|vinh\s*tét|vinh\s*tịt|vinh\s*tịch|viên\s*tết|vìn\s*tết|vanh\s*tết|bình\s*tết|pin\s*tết)(?=\s|$|[,.;])/gi, 'vintage'],
]

/**
 * Chuẩn hóa câu thu âm tiếng Việt trước khi đưa vào AI:
 * - Ghép các số đọc rời ("lờ một không không ba chín", "eo 100 39", "mã 10039") thành đúng mã SKU chuẩn (vd: "L10039").
 * - Phiên âm các tên rượu Pháp/Ý bị bộ nhận diện giọng nói tiếng Việt viết lệch về tên gốc.
 */
export function normalizeVoiceTranscript(raw: string): string {
    let s = String(raw ?? '').trim()
    if (!s) return ''

    for (const [pattern, replacement] of VIET_PHONETIC_WINES) {
        s = s.replace(pattern, replacement)
    }

    // Chuyển chữ số tiếng Việt đứng sau "lờ / eo / l / mã" thành đúng 5 chữ số của mã SKU (L10001..L80005)
    const digitWords: Record<string, string> = {
        'không': '0', 'linh': '0', 'lẻ': '0',
        'một': '1', 'mốt': '1',
        'hai': '2',
        'ba': '3',
        'bốn': '4', 'tư': '4',
        'năm': '5', 'lăm': '5',
        'sáu': '6',
        'bảy': '7', 'bẩy': '7',
        'tám': '8',
        'chín': '9',
    }

    const singleDigitToken = '(?:không|linh|một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|bẩy|tám|chín|\\d)'
    // Nếu chữ số thứ 5 đứng ngay trước "thùng / chai / lẻ / cái" (vd: "lờ một không không bảy ba thùng")
    // thì chữ số thứ 5 là số lượng ("3 thùng"), còn 4 chữ số đầu ("1007") là đọc tắt của mã L10007.
    const fiveSpokenDigitsRe = new RegExp(
        `(?:^|(?<=\\s))(?:lờ|eo|mã\\s*lờ|mã\\s*l|mã\\s*số|mã|l)\\s*(${singleDigitToken}(?:\\s+${singleDigitToken}){4})(?!\\s+(?:thùng|chai|lẻ|cái)\\b)(?=\\s|$)`,
        'gi'
    )
    s = s.replace(fiveSpokenDigitsRe, (full, seq: string) => {
        const digits = seq
            .trim()
            .split(/\s+/)
            .map(tok => digitWords[tok.toLowerCase()] ?? tok)
            .join('')
        if (/^[1-8]\d{4}$/.test(digits)) {
            return `L${digits}`
        }
        return full
    })

    // Trường hợp đọc tắt 4 chữ số của mã 01..09 (bỏ bớt 1 số không): "lờ một không không bảy ba thùng" → "L10007 ba thùng"
    const fourSpokenDigitsRe = new RegExp(
        `(?:^|(?<=\\s))(?:lờ|eo|mã\\s*lờ|mã\\s*l|mã\\s*số|mã|l)\\s*(${singleDigitToken}(?:\\s+${singleDigitToken}){3})(?=\\s|$)`,
        'gi'
    )
    s = s.replace(fourSpokenDigitsRe, (full, seq: string) => {
        const digits = seq
            .trim()
            .split(/\s+/)
            .map(tok => digitWords[tok.toLowerCase()] ?? tok)
            .join('')
        const m = digits.match(/^([1-8]00)([1-9])$/)
        if (m) {
            return `L${m[1]}0${m[2]}`
        }
        return full
    })

    // Trường hợp bộ STT tự ghép dính mã đọc tắt 4 số với số lượng đứng trước đơn vị:
    // vd: "l10073 thùng" / "10073 thùng" / "l 100 73 thùng" (ý là L10007 3 thùng)
    s = s.replace(
        /(?:^|(?<=\s))(?:lờ|eo|mã\s*lờ|mã\s*l|mã\s*số|mã|l)?\s*([1-8]00)\s*([1-9])([1-9])(?=\s+(?:thùng|chai|lẻ|cái)\b)/gi,
        'L$10$2 $3'
    )

    // Chuẩn hóa trường hợp đọc "mã 10039", "eo 200 19", "L 100 39", "lờ 10 039" (5 chữ số bắt đầu từ 1..8) thành L10039
    // Không gộp nếu cụm số thứ 2 đứng ngay trước "thùng / chai / lẻ / cái" (tránh gộp nhầm số lượng vào mã)
    s = s.replace(
        /(?:^|(?<=\s))(?:lờ|eo|mã\s*lờ|mã\s*l|mã\s*số|mã|l)?\s*([1-8]\d{2})(\d{2})(?=\s|$)/gi,
        'L$1$2'
    )
    s = s.replace(
        /(?:^|(?<=\s))(?:lờ|eo|mã\s*lờ|mã\s*l|mã\s*số|mã|l)?\s*([1-8]\d{2})\s+(\d{2})(?!\s+(?:thùng|chai|lẻ|cái)\b)(?=\s|$)/gi,
        'L$1$2'
    )
    s = s.replace(
        /(?:^|(?<=\s))(?:lờ|eo|mã\s*lờ|mã\s*l|mã\s*số|mã|l)?\s*([1-8]\d)\s+(\d{3})(?!\s+(?:thùng|chai|lẻ|cái)\b)(?=\s|$)/gi,
        'L$1$2'
    )
    // Trường hợp bộ thu âm viết tắt "l600 1", "l1007", "l100 5", "mã 300 2" (thiếu 1 số 0 ở hàng chục) → L60001, L10007, L10005, L30002
    s = s.replace(
        /(?:^|(?<=\s))(?:lờ|eo|mã\s*lờ|mã\s*l|mã\s*số|mã|l)\s*([1-8]00)\s*([1-9])(?=\s|$)/gi,
        'L$10$2'
    )

    // Chuẩn hóa năm niên vụ đọc bằng chữ tiếng Việt: "hai không hai hai", "hai nghìn không trăm hai mươi tư"...
    const spokenUnitMap: Record<string, string> = {
        'không': '0',
        'một': '1', 'mốt': '1',
        'hai': '2',
        'ba': '3',
        'bốn': '4', 'tư': '4',
        'năm': '5', 'lăm': '5',
        'sáu': '6',
        'bảy': '7', 'bẩy': '7',
        'tám': '8',
        'chín': '9',
    }
    // "hai không hai hai" / "hai không hai mươi tư" / "hai nghìn không trăm hai mươi hai" → 2022 / 2024
    s = s.replace(
        /(?:^|(?<=\s))hai\s+(?:nghìn\s+không\s+trăm|ngàn\s+không\s+trăm|không)\s+(?:(mười)\s*(một|hai|ba|bốn|tư|năm|lăm|sáu|bảy|bẩy|tám|chín)?|(hai)\s*(?:mươi\s*)?(không|một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|bẩy|tám|chín)?)(?=\s|$|[,.;])/gi,
        (full, teen, teenUnit, twenty, twentyUnit) => {
            if (teen) {
                const u = teenUnit ? (spokenUnitMap[String(teenUnit).toLowerCase()] ?? '0') : '0'
                return `201${u}`
            }
            if (twenty) {
                const u = twentyUnit ? (spokenUnitMap[String(twentyUnit).toLowerCase()] ?? '0') : '0'
                return `202${u}`
            }
            return full
        }
    )

    // Chuẩn hóa năm 2 chữ số đứng sau "vintage / niên vụ / đời / năm": "vintage 22" → "vintage 2022", "niên vụ 21" → "vintage 2021"
    s = s.replace(
        /(?:^|(?<=\s))(?:vintage|niên\s*vụ|đời|năm)\s+(1\d|2[0-9])(?=\s|$|[,.;])/gi,
        'vintage 20$1'
    )
    // Chuẩn hóa trường hợp đọc mã SKU rồi đọc luôn 2 số cuối của năm trước số lượng: "L10001 22 1 thùng" → "L10001 vintage 2022 1 thùng"
    s = s.replace(
        /\b(L[1-8]\d{4})\s+(1[5-9]|2[0-6])(?=\s+(?:\d+|một|hai|ba|bốn|tư|năm|sáu|bảy|bẩy|tám|chín|mười)\s*(?:thùng|chai|lẻ))/gi,
        '$1 vintage 20$2'
    )
    // Chuẩn hóa "20 22", "20 23", "20 24" bị tách dấu cách → "2022", "2023", "2024"
    s = s.replace(/(?:^|(?<=\s))20\s+([12]\d)(?=\s|$|[,.;])/g, '20$1')

    // Chuẩn hóa số lượng đọc bằng chữ trước đơn vị "thùng / chai / lẻ / cái": "một thùng" → "1 thùng", "hai chai" → "2 chai"
    const qtyWords: Record<string, string> = {
        'một': '1',
        'hai': '2',
        'ba': '3',
        'bốn': '4', 'tư': '4',
        'năm': '5', 'lăm': '5',
        'sáu': '6',
        'bảy': '7', 'bẩy': '7',
        'tám': '8',
        'chín': '9',
        'mười': '10',
    }
    s = s.replace(
        /(?:^|(?<=\s))(một|hai|ba|bốn|tư|năm|lăm|sáu|bảy|bẩy|tám|chín|mười)(?=\s+(?:thùng|chai|lẻ|cái)\b)/gi,
        (full, w: string) => qtyWords[w.toLowerCase()] ?? full
    )

    return s.replace(/\s+/g, ' ').trim()
}

const LOCAL_SPOT_ALIASES: Array<[RegExp, string]> = [
    [/kệ\s*cạnh\s*hàng\s*lẻ/i, 't2-8'],
    [/kệ\s*hàng\s*lẻ|kệ\s*lẻ/i, 't2-4'],
    [/cửa\s*ra\s*vào/i, 't2-1'],
    [/cửa\s*sổ/i, 't2-2'],
    [/tường\s*lớn/i, 't2-3'],
    [/bồn\s*rửa/i, 't2-5'],
    [/bàn\s*lớn|gầm\s*bàn/i, 't2-6'],
    [/khu\s*vực\s*cầu\s*thang/i, 't2-7'],
    [/tủ\s*lạnh/i, 't1-1'],
    [/kệ\s*nhỏ\s*ngoài/i, 't1-2'],
    [/kệ\s*to/i, 't1-3'],
    [/kệ\s*nhỏ\s*trong/i, 't1-4'],
    [/gầm\s*cầu\s*thang/i, 't1-5'],
    [/phòng\s*vip/i, 't1-6'],
]

const LOCAL_WINE_ALIASES: Array<[RegExp, string]> = [
    [/\bsan\s*vincenzo\b/i, 'L10039'],
    [/\bfoscarino\b/i, 'L10040'],
    [/\brealda\b/i, 'L10041'],
    [/\bsabazio\b|\bcroce\b/i, 'L10042'],
    [/\bchablis\b/i, 'L20040'],
    [/\blamura\b/i, 'L10029'],
    [/\bsaltari\b|\bamarone\b/i, 'L10001'],
]

/**
 * Bộ phân tích giọng nói tức thì ngay trên trình duyệt (< 5ms, không cần chờ mạng/Gemini)
 * cho các câu đọc rõ Mã SKU (vd: "L10029 1 chai", "L60001 5 thùng 3 chai", "L10001 vintage 2022 1 thùng")
 * hoặc tên rượu thông dụng. Nếu câu phức tạp hoặc mơ hồ thì trả về null để chuyển sang Gemini.
 */
export function parseVoiceLocally(params: {
    transcript: string
    spotId: string
    spots: ShowroomSpot[]
    items: ShowroomItem[]
}): {
    matches: AiVoiceMatch[]
    summaryText: string
    normalizedTranscript: string
    suggestedMode: 'add' | 'replace'
} | null {
    const normalizedTranscript = normalizeVoiceTranscript(params.transcript)
    if (!normalizedTranscript) return null

    const wineItems = params.items.filter(i => i.kind !== 'POSM')
    if (!wineItems.length) return null

    // 1. Nhận diện chế độ Cộng dồn hay Ghi đè
    const isReplace = /(?:sửa\s*lại|sửa\s*thành|đặt\s*lại|ghi\s*đè|chốt\s*tổng|tất\s*cả\s*là)/i.test(normalizedTranscript)
    const suggestedMode: 'add' | 'replace' = isReplace ? 'replace' : 'add'

    // 2. Nhận diện vị trí nếu có nhắc trong câu
    let targetSpot = params.spots.find(s => s.id === params.spotId) ?? params.spots[0]
    if (!targetSpot) return null
    for (const [re, sid] of LOCAL_SPOT_ALIASES) {
        if (re.test(normalizedTranscript)) {
            const found = params.spots.find(s => s.id === sid)
            if (found) {
                targetSpot = found
                break
            }
        }
    }

    // 3. Tách câu thành từng vế (theo dấu phẩy, "và", hoặc tách trước mỗi mã L100xx)
    const preSplit = normalizedTranscript
        .replace(/\s+(?:và|với|rồi|cùng)\s+/gi, ' | ')
        .replace(/[,;]+/g, ' | ')
        .replace(/(?<=\b(?:thùng|chai|lẻ)\b)\s+(?=L[1-8]\d{4}\b)/gi, ' | ')

    const clauses = preSplit.split('|').map(c => c.trim()).filter(Boolean)
    if (!clauses.length) return null

    const byCode = new Map<string, ShowroomItem[]>()
    for (const it of wineItems) {
        const k = it.code.trim().toUpperCase()
        byCode.set(k, [...(byCode.get(k) ?? []), it])
    }

    const matches: AiVoiceMatch[] = []
    const t2 = isCaseSpot(targetSpot)

    for (const clause of clauses) {
        // Tìm mã SKU L10001..L89999 hoặc tên rượu trong danh mục
        const skuMatch = clause.match(/\b(L[1-8]\d{4})\b/i)
        let code = skuMatch ? skuMatch[1].toUpperCase() : ''
        let extraCandidateItems: ShowroomItem[] = []
        if (!code) {
            for (const [re, aliasCode] of LOCAL_WINE_ALIASES) {
                if (re.test(clause)) {
                    code = aliasCode
                    break
                }
            }
        }
        if (!code) {
            // Tìm kiếm theo từ khóa tên rượu trong danh mục (vd: "Richland", "Saint Clair", "Sandy Cove", "Collavini"...)
            const stopWords = new Set([
                'ke', 'hang', 'le', 'canh', 'cua', 'ra', 'vao', 'so', 'tuong', 'lon', 'bon', 'rua', 'ban', 'cau', 'thang',
                'tu', 'lanh', 'nho', 'ngoai', 'to', 'trong', 'gam', 'phong', 'vip', 'tang', 'khu', 'vuc',
                'cong', 'them', 'sua', 'lai', 'thanh', 'dat', 'ghi', 'de', 'chot', 'tong', 'tat', 'ca', 'la',
                'thung', 'chai', 'cai', 'ma', 'vintage', 'nien', 'vu', 'nam', 'doi', 'nv',
                'cho', 'toi', 'minh', 'may', 'nhung', 'vang', 'ruou', 'phap', 'vung', 'loai', 'dong', 'kiem', 'dem',
            ])
            const words = normalizeSearch(clause)
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length >= 4 && !/^\d+$/.test(w) && !stopWords.has(w))
            if (words.length > 0) {
                const scored = wineItems
                    .map(it => {
                        const normTokens = new Set(
                            normalizeSearch(it.name)
                                .replace(/[^a-z0-9\s]/g, ' ')
                                .split(/\s+/)
                                .filter(Boolean)
                        )
                        let hits = 0
                        for (const w of words) {
                            if (normTokens.has(w)) hits++
                        }
                        return { it, hits }
                    })
                    .filter(x => x.hits > 0)
                    .sort((a, b) => b.hits - a.hits || a.it.code.localeCompare(b.it.code))
                if (scored.length > 0 && scored[0].hits >= words.length) {
                    const topScore = scored[0].hits
                    const topMatches = scored.filter(x => x.hits === topScore).map(x => x.it)
                    code = topMatches[0].code.toUpperCase()
                    extraCandidateItems = topMatches.slice(0, 6)
                }
            }
        }
        if (!code) return null

        const siblings = byCode.get(code)
        if (!siblings || !siblings.length) return null

        // Xóa phần mã SKU và phần năm vintage để bóc số lượng không bị lẫn số
        let rest = clause.replace(new RegExp(`\\b${code}\\b`, 'gi'), ' ')

        // Tìm năm niên vụ (2010..2029 hoặc NV)
        let spokenVintage = ''
        const nvMatch = rest.match(/\bvintage\s+NV\b|\bNV\b/i)
        const yearMatch = rest.match(/(?:\bvintage\s+|\bniên\s*vụ\s+|\bnăm\s+|\bđời\s+)?\b(19\d\d|20[0-2]\d)\b/i)
        if (nvMatch) {
            spokenVintage = 'NV'
            rest = rest.replace(nvMatch[0], ' ')
        } else if (yearMatch) {
            spokenVintage = yearMatch[1]
            rest = rest.replace(yearMatch[0], ' ')
        }

        // Bóc số thùng và số chai lẻ
        const caseM = rest.match(/\b(\d+)\s*thùng\b/i)
        const looseAfterM = rest.match(/\blẻ\s*(\d+)\s*(?:chai)?\b/i)
        const bottleM = rest.match(/\b(\d+)\s*(?:chai\s*lẻ|chai|lẻ)\b/i)

        let cases = caseM ? parseInt(caseM[1], 10) : 0
        let loose = 0
        if (looseAfterM) {
            loose = parseInt(looseAfterM[1], 10)
        } else if (bottleM) {
            loose = parseInt(bottleM[1], 10)
        } else if (!caseM) {
            // Trường hợp đọc ngắn "L10039 3"
            const bareNum = rest.match(/\b(\d{1,3})\b/)
            if (bareNum) loose = parseInt(bareNum[1], 10)
        }

        if (cases <= 0 && loose <= 0) return null

        const cleanVin = spokenVintage === 'NV' ? '' : spokenVintage
        let matchedItem = cleanVin
            ? siblings.find(x => x.vintage.trim() === cleanVin)
            : undefined
        const isNewVintage = Boolean(spokenVintage && spokenVintage !== 'NV' && !matchedItem)
        if (!matchedItem) {
            matchedItem = siblings[0]
        }

        const resolvedVintage = spokenVintage === 'NV' ? '' : (spokenVintage || matchedItem.vintage || '')
        const pack = packSizeOf(matchedItem) ?? 6
        const qty = t2 ? cases * pack + loose : cases * pack + loose
        const availableVintages = Array.from(new Set(siblings.map(x => x.vintage.trim()).filter(Boolean))).sort()
        const altMap = new Map<string, AiCandidateOption>()
        for (const sib of [...siblings, ...extraCandidateItems]) {
            const key = `${sib.code}|${sib.vintage}`
            if (!altMap.has(key)) {
                altMap.set(key, {
                    itemId: sib.id,
                    code: sib.code,
                    name: sib.name,
                    vintage: sib.vintage,
                    packSize: packSizeOf(sib) ?? 6,
                })
            }
        }
        const alternatives = Array.from(altMap.values()).slice(0, 6)
        const distinctCodes = new Set(alternatives.map(a => a.code))

        const warning = distinctCodes.size > 1
            ? `Có ${distinctCodes.size} mã khớp tên vừa đọc (${Array.from(distinctCodes).join(', ')}) — hãy chạm chọn đúng mã bên dưới.`
            : (!spokenVintage && availableVintages.length > 1
                ? `Mã ${code} có ${availableVintages.length} niên vụ (${availableVintages.join(', ')}) — hãy chạm chọn đúng năm trên nhãn chai.`
                : undefined)

        matches.push({
            spotId: targetSpot.id,
            spotName: `${targetSpot.groupName} · ${targetSpot.name}`,
            itemId: matchedItem.id,
            code: matchedItem.code,
            name: matchedItem.name,
            vintage: resolvedVintage,
            packSize: pack,
            cases: t2 ? cases : null,
            loose: t2 ? loose : null,
            qty,
            isNewVintage,
            confidence: 'Cao',
            suggestedMode,
            availableVintages,
            alternatives,
            warning,
        })
    }

    if (!matches.length) return null

    const summaryParts = matches.map(m => {
        const qtyDesc = m.cases
            ? `${m.cases} thùng${m.loose ? ` ${m.loose} lẻ` : ''} (${m.qty} chai)`
            : `${m.qty} chai`
        return `${m.code}${m.vintage ? ` (${m.vintage})` : ''}: ${qtyDesc}`
    })

    return {
        matches,
        summaryText: `Nhận diện tức thì: ${summaryParts.join(' · ')}`,
        normalizedTranscript,
        suggestedMode,
    }
}
