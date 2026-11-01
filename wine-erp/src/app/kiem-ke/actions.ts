'use server'

// Public showroom quick count (/kiem-ke) — no login by design (temporary tool for showroom staff).
// Writes only to the three showroom_count_* tables; never touches Product, StockLot or StockCount data.

import { prisma } from '@/lib/db'
import { canRecheck, cleanLabel, cleanNote, MAX_NOTE, normalizeVintage, parseQty, type ShowroomData } from './logic'

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string }

export async function getShowroomCount(): Promise<Result<ShowroomData>> {
    try {
        const [spots, items, entries, checks, notes] = await Promise.all([
            prisma.showroomCountSpot.findMany({ orderBy: { sortOrder: 'asc' } }),
            prisma.showroomCountItem.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] }),
            prisma.showroomCountEntry.findMany({
                select: { spotId: true, itemId: true, qty: true, countedBy: true, countedAt: true },
            }),
            prisma.showroomCountCheck.findMany({
                select: { spotId: true, itemId: true, checkedBy: true, qtyAtCheck: true, checkedAt: true },
            }),
            prisma.showroomCountNote.findMany({
                select: { spotId: true, itemId: true, note: true, writtenBy: true, updatedAt: true },
            }),
        ])
        return {
            success: true,
            data: JSON.parse(JSON.stringify({
                spots: spots.map(({ id, groupName, kind, name, sortOrder }) => ({ id, groupName, kind, name, sortOrder })),
                items: items.map(({ id, kind, code, name, vintage, isExtra, sortOrder }) => ({ id, kind, code, name, vintage, isExtra, sortOrder })),
                entries,
                checks,
                notes,
            })),
        }
    } catch (err) {
        console.error('[kiem-ke] getShowroomCount', err)
        return { success: false, error: 'Không tải được dữ liệu kiểm kê. Thử tải lại trang.' }
    }
}

/**
 * qty = null xoá dòng (chưa đếm); 0 = đã kiểm, không có hàng.
 * Mỗi người kiểm có dòng riêng (spot + item + countedBy) nên hai người cùng đếm một vị trí không ghi đè nhau.
 */
export async function saveShowroomCount(input: {
    spotId: string
    itemId: string
    qty: number | null
    countedBy: string
}): Promise<Result> {
    const qty = parseQty(input.qty)
    if (qty === 'invalid') return { success: false, error: 'Số lượng phải là số nguyên từ 0 trở lên.' }
    const countedBy = cleanLabel(input.countedBy)
    if (!countedBy) return { success: false, error: 'Thiếu tên người kiểm.' }
    try {
        const key = { spotId: String(input.spotId), itemId: String(input.itemId), countedBy }
        if (qty === null) {
            await prisma.showroomCountEntry.deleteMany({ where: key })
        } else {
            const [spot, item] = await Promise.all([
                prisma.showroomCountSpot.findUnique({ where: { id: String(input.spotId) }, select: { kind: true } }),
                prisma.showroomCountItem.findUnique({ where: { id: String(input.itemId) }, select: { kind: true } }),
            ])
            if (!spot || !item) return { success: false, error: 'Vị trí hoặc mặt hàng không còn tồn tại. Tải lại trang.' }
            if ((spot.kind === 'POSM') !== (item.kind === 'POSM')) return { success: false, error: 'Mặt hàng không thuộc khu vực này.' }
            await prisma.showroomCountEntry.upsert({
                where: { spotId_itemId_countedBy: key },
                create: { ...key, qty },
                update: { qty, countedAt: new Date() },
            })
        }
        return { success: true }
    } catch (err) {
        console.error('[kiem-ke] saveShowroomCount', err)
        return { success: false, error: 'Chưa lưu được, kiểm tra mạng rồi sửa lại số.' }
    }
}

/** Thêm vintage chưa có trong danh mục (hiện ở mọi vị trí) và ghi 0 chai tại vị trí đang đếm. */
export async function addShowroomVintage(input: {
    code: string
    vintage: string
    spotId: string
    countedBy: string
}): Promise<Result<{ itemId: string }>> {
    const vintage = normalizeVintage(input.vintage)
    if (vintage === null) return { success: false, error: 'Vintage là năm 4 chữ số, ví dụ 2021. Để trống nếu là NV.' }
    const countedBy = cleanLabel(input.countedBy)
    if (!countedBy) return { success: false, error: 'Thiếu tên người kiểm.' }
    try {
        const base = await prisma.showroomCountItem.findFirst({
            where: { kind: 'WINE', code: String(input.code) },
            orderBy: { isExtra: 'asc' },
        })
        if (!base) return { success: false, error: 'Không tìm thấy mã rượu này.' }
        const spot = await prisma.showroomCountSpot.findUnique({ where: { id: String(input.spotId) }, select: { kind: true } })
        if (!spot || spot.kind === 'POSM') return { success: false, error: 'Chỉ thêm vintage ở vị trí đếm rượu.' }

        const item = await prisma.showroomCountItem.upsert({
            where: { kind_code_vintage: { kind: 'WINE', code: base.code, vintage } },
            create: { kind: 'WINE', code: base.code, name: base.name, vintage, isExtra: true, sortOrder: base.sortOrder },
            update: {},
        })
        const existing = await prisma.showroomCountEntry.findUnique({
            where: { spotId_itemId_countedBy: { spotId: String(input.spotId), itemId: item.id, countedBy } },
        })
        if (!existing) {
            await prisma.showroomCountEntry.create({ data: { spotId: String(input.spotId), itemId: item.id, qty: 0, countedBy } })
        }
        return { success: true, data: { itemId: item.id } }
    } catch (err) {
        console.error('[kiem-ke] addShowroomVintage', err)
        return { success: false, error: 'Chưa thêm được vintage. Thử lại.' }
    }
}

/**
 * Tích / bỏ tích "đã kiểm lại" cho một mã tại một vị trí (kiểm lần 2).
 * Người tích phải khác người đã đếm; lưu tổng lúc tích để phát hiện số bị sửa sau đó.
 */
export async function setShowroomRecheck(input: {
    spotId: string
    itemId: string
    checkedBy: string
    checked: boolean
}): Promise<Result> {
    const checkedBy = cleanLabel(input.checkedBy)
    if (!checkedBy) return { success: false, error: 'Thiếu tên người kiểm lại.' }
    const where = { spotId: String(input.spotId), itemId: String(input.itemId) }
    try {
        if (!input.checked) {
            await prisma.showroomCountCheck.deleteMany({ where })
            return { success: true }
        }
        const entries = await prisma.showroomCountEntry.findMany({ where, select: { qty: true, countedBy: true } })
        if (!entries.length) return { success: false, error: 'Dòng này chưa có ai đếm nên chưa kiểm lại được.' }
        if (!canRecheck(entries.map(e => e.countedBy), checkedBy)) {
            return { success: false, error: 'Người kiểm lại phải khác người đã đếm.' }
        }
        const qtyAtCheck = entries.reduce((t, e) => t + e.qty, 0)
        await prisma.showroomCountCheck.upsert({
            where: { spotId_itemId: where },
            create: { ...where, checkedBy, qtyAtCheck },
            update: { checkedBy, qtyAtCheck, checkedAt: new Date() },
        })
        return { success: true }
    } catch (err) {
        console.error('[kiem-ke] setShowroomRecheck', err)
        return { success: false, error: 'Chưa lưu được dấu kiểm lại. Thử lại.' }
    }
}

/**
 * Ghi chú riêng của từng người cho một dòng (itemId) hoặc cả vị trí (itemId = "").
 * Ghi chú rỗng = xoá. Không phụ thuộc số đếm: ghi được cả dòng chưa có số.
 */
export async function saveShowroomNote(input: {
    spotId: string
    itemId: string
    note: string
    writtenBy: string
}): Promise<Result> {
    const note = cleanNote(input.note)
    if (note === 'invalid') return { success: false, error: `Ghi chú tối đa ${MAX_NOTE} ký tự.` }
    const writtenBy = cleanLabel(input.writtenBy)
    if (!writtenBy) return { success: false, error: 'Thiếu tên người kiểm.' }
    const key = { spotId: String(input.spotId), itemId: String(input.itemId ?? ''), writtenBy }
    try {
        if (note === null) {
            await prisma.showroomCountNote.deleteMany({ where: key })
            return { success: true }
        }
        const [spot, item] = await Promise.all([
            prisma.showroomCountSpot.findUnique({ where: { id: key.spotId }, select: { kind: true } }),
            key.itemId ? prisma.showroomCountItem.findUnique({ where: { id: key.itemId }, select: { kind: true } }) : null,
        ])
        if (!spot || (key.itemId && !item)) return { success: false, error: 'Vị trí hoặc mặt hàng không còn tồn tại. Tải lại trang.' }
        await prisma.showroomCountNote.upsert({
            where: { spotId_itemId_writtenBy: key },
            create: { ...key, note },
            update: { note },
        })
        return { success: true }
    } catch (err) {
        console.error('[kiem-ke] saveShowroomNote', err)
        return { success: false, error: 'Chưa lưu được ghi chú, kiểm tra mạng rồi bấm Lưu lại.' }
    }
}

export async function renameShowroomSpots(input: Array<{ id: string; name: string }>): Promise<Result> {
    if (!Array.isArray(input) || input.length > 100) return { success: false, error: 'Danh sách vị trí không hợp lệ.' }
    const updates: Array<{ id: string; name: string }> = []
    for (const s of input) {
        const name = cleanLabel(s.name)
        if (!name) return { success: false, error: 'Tên vị trí cần từ 1 đến 60 ký tự.' }
        updates.push({ id: String(s.id), name })
    }
    try {
        await prisma.$transaction(updates.map(u => prisma.showroomCountSpot.updateMany({ where: { id: u.id }, data: { name: u.name } })))
        return { success: true }
    } catch (err) {
        console.error('[kiem-ke] renameShowroomSpots', err)
        return { success: false, error: 'Không lưu được tên vị trí. Thử lại sau.' }
    }
}
