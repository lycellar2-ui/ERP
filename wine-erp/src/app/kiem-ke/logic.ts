// Pure helpers for the public showroom quick count (/kiem-ke).
// Kept out of the 'use server' file so they can be unit-tested and reused on the client.

export type ShowroomSpot = { id: string; groupName: string; kind: string; name: string; sortOrder: number }
export type ShowroomItem = { id: string; kind: string; code: string; name: string; vintage: string; isExtra: boolean; sortOrder: number }
export type ShowroomEntry = { spotId: string; itemId: string; qty: number; countedBy: string; countedAt: string }
export type ShowroomCheck = { spotId: string; itemId: string; checkedBy: string; qtyAtCheck: number; checkedAt: string }
export type ShowroomData = { spots: ShowroomSpot[]; items: ShowroomItem[]; entries: ShowroomEntry[]; checks: ShowroomCheck[] }

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

/** Tên người kiểm / tên vị trí: bỏ khoảng trắng thừa, 1–60 ký tự. */
export function cleanLabel(raw: unknown): string | null {
    const s = String(raw ?? '').replace(/\s+/g, ' ').trim()
    return s.length >= 1 && s.length <= 60 ? s : null
}

export function normalizeSearch(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
}

export function sortItems(items: ShowroomItem[]): ShowroomItem[] {
    return [...items].sort((a, b) => a.code.localeCompare(b.code) || a.vintage.localeCompare(b.vintage))
}

export type ItemSummary = {
    item: ShowroomItem
    total: number
    checked: number
    byGroup: Record<string, number>
    parts: Array<{ spot: ShowroomSpot; qty: number; by: string }>
}

export type PersonSummary = {
    name: string
    wine: number
    posm: number
    lines: Array<{ spot: ShowroomSpot; item: ShowroomItem; qty: number; at: string }>
    rechecks?: number
}

export type SpotSummary = {
    spot: ShowroomSpot; lines: number; qty: number; people: string[]; lastAt: string | null; touched: boolean
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
    for (const item of data.items) items.set(item.id, { item, total: 0, checked: 0, byGroup: {}, parts: [] })
    const spots = new Map<string, SpotSummary>()
    for (const spot of data.spots) spots.set(spot.id, { spot, lines: 0, qty: 0, people: [], lastAt: null, touched: false, cells: 0, rechecked: 0 })

    for (const e of data.entries) {
        const spot = spotById.get(e.spotId)
        const is = items.get(e.itemId)
        const ss = spots.get(e.spotId)
        if (!spot || !is || !ss) continue
        const p = people.get(e.countedBy) ?? { name: e.countedBy, wine: 0, posm: 0, lines: [] }
        people.set(e.countedBy, p)
        p.lines.push({ spot, item: itemById.get(e.itemId)!, qty: e.qty, at: e.countedAt })
        if (spot.kind === 'POSM') p.posm += e.qty; else p.wine += e.qty
        is.checked++
        ss.touched = true
        if (!ss.people.includes(e.countedBy)) ss.people.push(e.countedBy)
        if (!ss.lastAt || e.countedAt > ss.lastAt) ss.lastAt = e.countedAt
        if (e.qty <= 0) continue
        is.total += e.qty
        is.byGroup[spot.groupName] = (is.byGroup[spot.groupName] ?? 0) + e.qty
        is.parts.push({ spot, qty: e.qty, by: e.countedBy })
        ss.lines++
        ss.qty += e.qty
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
    lines.push([], ['Người kiểm', s.people.map(p => p.name).join(', ')], ['Xuất lúc', exportedAt.toLocaleString('vi-VN')])
    return '﻿' + lines.map(r => r.map(csvCell).join(',')).join('\r\n')
}
