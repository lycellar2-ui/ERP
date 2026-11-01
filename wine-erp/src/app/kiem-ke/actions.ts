'use server'

// Public showroom quick count (/kiem-ke) — no login by design (temporary tool for showroom staff).
// Writes only to the three showroom_count_* tables; never touches Product, StockLot or StockCount data.

import { prisma } from '@/lib/db'
import { cleanLabel, normalizeVintage, parseQty, type ShowroomData } from './logic'

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string }

export async function getShowroomCount(): Promise<Result<ShowroomData>> {
    try {
        const [spots, items, entries] = await Promise.all([
            prisma.showroomCountSpot.findMany({ orderBy: { sortOrder: 'asc' } }),
            prisma.showroomCountItem.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] }),
            prisma.showroomCountEntry.findMany({
                select: { spotId: true, itemId: true, qty: true, countedBy: true, countedAt: true },
            }),
        ])
        return {
            success: true,
            data: JSON.parse(JSON.stringify({
                spots: spots.map(({ id, groupName, kind, name, sortOrder }) => ({ id, groupName, kind, name, sortOrder })),
                items: items.map(({ id, kind, code, name, vintage, isExtra, sortOrder }) => ({ id, kind, code, name, vintage, isExtra, sortOrder })),
                entries,
            })),
        }
    } catch (err) {
        console.error('[kiem-ke] getShowroomCount', err)
        return { success: false, error: 'Không tải được dữ liệu kiểm kê. Thử tải lại trang.' }
    }
}

/** qty = null xoá dòng (chưa đếm); 0 = đã kiểm, không có hàng. */
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
        const where = { spotId_itemId: { spotId: String(input.spotId), itemId: String(input.itemId) } }
        if (qty === null) {
            await prisma.showroomCountEntry.deleteMany({ where: { spotId: String(input.spotId), itemId: String(input.itemId) } })
        } else {
            const [spot, item] = await Promise.all([
                prisma.showroomCountSpot.findUnique({ where: { id: String(input.spotId) }, select: { kind: true } }),
                prisma.showroomCountItem.findUnique({ where: { id: String(input.itemId) }, select: { kind: true } }),
            ])
            if (!spot || !item) return { success: false, error: 'Vị trí hoặc mặt hàng không còn tồn tại. Tải lại trang.' }
            if ((spot.kind === 'POSM') !== (item.kind === 'POSM')) return { success: false, error: 'Mặt hàng không thuộc khu vực này.' }
            await prisma.showroomCountEntry.upsert({
                where,
                create: { spotId: String(input.spotId), itemId: String(input.itemId), qty, countedBy },
                update: { qty, countedBy, countedAt: new Date() },
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
            where: { spotId_itemId: { spotId: String(input.spotId), itemId: item.id } },
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
