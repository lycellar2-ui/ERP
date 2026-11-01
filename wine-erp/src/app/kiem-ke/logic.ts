// Pure helpers for the public showroom quick count (/kiem-ke).
// Kept out of the 'use server' file so they can be unit-tested and reused on the client.

export type ShowroomSpot = { id: string; groupName: string; kind: string; name: string; sortOrder: number }
export type ShowroomItem = { id: string; kind: string; code: string; name: string; vintage: string; isExtra: boolean; sortOrder: number }
export type ShowroomEntry = { spotId: string; itemId: string; qty: number; countedBy: string; countedAt: string }
export type ShowroomData = { spots: ShowroomSpot[]; items: ShowroomItem[]; entries: ShowroomEntry[] }

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
    parts: Array<{ spot: ShowroomSpot; qty: number }>
}

export type SpotSummary = { spot: ShowroomSpot; lines: number; qty: number; people: string[]; lastAt: string | null; touched: boolean }

/** Gộp số đếm theo mặt hàng và theo vị trí. Số 0 vẫn tính là "đã kiểm" nhưng không cộng vào tổng. */
export function summarize(data: ShowroomData) {
    const spotById = new Map(data.spots.map(s => [s.id, s]))
    const items = new Map<string, ItemSummary>()
    for (const item of data.items) items.set(item.id, { item, total: 0, checked: 0, byGroup: {}, parts: [] })
    const spots = new Map<string, SpotSummary>()
    for (const spot of data.spots) spots.set(spot.id, { spot, lines: 0, qty: 0, people: [], lastAt: null, touched: false })

    for (const e of data.entries) {
        const spot = spotById.get(e.spotId)
        const is = items.get(e.itemId)
        const ss = spots.get(e.spotId)
        if (!spot || !is || !ss) continue
        is.checked++
        ss.touched = true
        if (!ss.people.includes(e.countedBy)) ss.people.push(e.countedBy)
        if (!ss.lastAt || e.countedAt > ss.lastAt) ss.lastAt = e.countedAt
        if (e.qty <= 0) continue
        is.total += e.qty
        is.byGroup[spot.groupName] = (is.byGroup[spot.groupName] ?? 0) + e.qty
        is.parts.push({ spot, qty: e.qty })
        ss.lines++
        ss.qty += e.qty
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
    }
}

function csvCell(v: unknown): string {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Bảng giống phiếu kiểm hàng: mỗi vị trí một cột, rượu trước rồi POSM. Có BOM để Excel đọc đúng tiếng Việt. */
export function buildCsv(data: ShowroomData, exportedAt: Date = new Date()): string {
    const qty = new Map(data.entries.map(e => [`${e.spotId}|${e.itemId}`, e.qty]))
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
    const people = [...new Set(data.entries.map(e => e.countedBy))]
    lines.push([], ['Người kiểm', people.join(', ')], ['Xuất lúc', exportedAt.toLocaleString('vi-VN')])
    return '﻿' + lines.map(r => r.map(csvCell).join(',')).join('\r\n')
}
