'use server'

// Public showroom quick count (/kiem-ke) — no login by design (temporary tool for showroom staff).
// Writes only to the showroom_count_* tables; never touches Product, StockLot or StockCount data.

import crypto from 'crypto'
import { prisma } from '@/lib/db'
import {
    auditAnomalies, canRecheck, cleanLabel, cleanNote, isCaseSpot, isLooseShelfSpot, MAX_NOTE,
    normalizeVintage, normalizeVoiceTranscript, packSizeOf, parseQty, summarize,
    type AiCandidateOption, type AiVisionMatch, type AiVisionShelfItem, type AiVoiceMatch, type ShowroomData,
} from './logic'

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string }

export async function getShowroomCount(): Promise<Result<ShowroomData>> {
    try {
        const [spots, items, entries, checks, notes] = await Promise.all([
            prisma.showroomCountSpot.findMany({ orderBy: { sortOrder: 'asc' } }),
            prisma.showroomCountItem.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] }),
            prisma.showroomCountEntry.findMany({
                select: { spotId: true, itemId: true, qty: true, cases: true, loose: true, countedBy: true, countedAt: true },
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
                items: items.map(({ id, kind, code, name, vintage, packSize, isExtra, sortOrder }) => ({
                    id, kind, code, name, vintage, packSize: packSizeOf({ kind, code, packSize }), isExtra, sortOrder,
                })),
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
 * Tại Tầng 2 có thêm cases (số thùng) và loose (số chai lẻ thực tế).
 */
export async function saveShowroomCount(input: {
    spotId: string
    itemId: string
    qty: number | null
    cases?: number | null
    loose?: number | null
    countedBy: string
}): Promise<Result> {
    const qty = parseQty(input.qty)
    if (qty === 'invalid') return { success: false, error: 'Số lượng phải là số nguyên từ 0 trở lên.' }
    const hasCaseLoose = input.cases !== undefined || input.loose !== undefined
    const cases = hasCaseLoose ? parseQty(input.cases ?? null) : null
    const loose = hasCaseLoose ? parseQty(input.loose ?? null) : null
    if (cases === 'invalid' || loose === 'invalid') {
        return { success: false, error: 'Số thùng và số chai lẻ phải là số nguyên từ 0 trở lên.' }
    }
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
            const extra = hasCaseLoose ? { cases, loose } : {}
            await prisma.showroomCountEntry.upsert({
                where: { spotId_itemId_countedBy: key },
                create: { ...key, qty, ...extra },
                update: { qty, ...extra, countedAt: new Date() },
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
            create: {
                kind: 'WINE',
                code: base.code,
                name: base.name,
                vintage,
                ...(base.packSize ? { packSize: base.packSize } : {}),
                isExtra: true,
                sortOrder: base.sortOrder,
            },
            update: {},
        })
        const existing = await prisma.showroomCountEntry.findUnique({
            where: { spotId_itemId_countedBy: { spotId: String(input.spotId), itemId: item.id, countedBy } },
        })
        if (!existing) {
            await prisma.showroomCountEntry.create({ data: { spotId: String(input.spotId), itemId: item.id, qty: 0, countedBy } })
        }
        invalidateShowroomCatalogCache()
        return { success: true, data: { itemId: item.id } }
    } catch (err) {
        console.error('[kiem-ke] addShowroomVintage', err)
        return { success: false, error: 'Chưa thêm được vintage. Thử lại.' }
    }
}

/** Cập nhật quy cách đóng gói (6 hoặc 12 chai/thùng) cho một mã rượu và tính lại tổng chai cho các dòng đã nhập số thùng. */
export async function setShowroomItemPackSize(input: {
    code: string
    packSize: number
}): Promise<Result> {
    if (input.packSize !== 6 && input.packSize !== 12) {
        return { success: false, error: 'Quy cách đóng gói chỉ nhận 6 hoặc 12 chai/thùng.' }
    }
    const code = String(input.code).trim()
    if (!code) return { success: false, error: 'Thiếu mã hàng.' }
    try {
        const items = await prisma.showroomCountItem.findMany({
            where: { kind: 'WINE', code },
            select: { id: true },
        })
        if (!items.length) return { success: false, error: 'Không tìm thấy mã hàng.' }
        const itemIds = items.map(i => i.id)
        await prisma.showroomCountItem.updateMany({
            where: { id: { in: itemIds } },
            data: { packSize: input.packSize },
        })
        const entries = await prisma.showroomCountEntry.findMany({
            where: { itemId: { in: itemIds }, cases: { not: null } },
            select: { id: true, cases: true, loose: true },
        })
        if (entries.length) {
            await prisma.$transaction(
                entries.map(e =>
                    prisma.showroomCountEntry.update({
                        where: { id: e.id },
                        data: { qty: (e.cases ?? 0) * input.packSize + (e.loose ?? 0) },
                    })
                )
            )
        }
        invalidateShowroomCatalogCache()
        return { success: true }
    } catch (err) {
        console.error('[kiem-ke] setShowroomItemPackSize', err)
        return { success: false, error: 'Chưa cập nhật được quy cách. Thử lại.' }
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
        invalidateShowroomCatalogCache()
        return { success: true }
    } catch (err) {
        console.error('[kiem-ke] renameShowroomSpots', err)
        return { success: false, error: 'Không lưu được tên vị trí. Thử lại sau.' }
    }
}

// ═══════════════════════════════════════════════════════════════════
// AI Cho Kiểm Kê Showroom (Gemini 3.0 / 2.5 Flash + Auto Model Discovery)
// ═══════════════════════════════════════════════════════════════════

const GEMINI_FLASH_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
] as const

let cachedWorkingGeminiModel: string | null = null
let cachedApiKeyRecord: { key: string; source: 'db' | 'env'; expiresAt: number } | null = null
let cachedCatalogRecord: {
    spots: Awaited<ReturnType<typeof prisma.showroomCountSpot.findMany>>
    items: Awaited<ReturnType<typeof prisma.showroomCountItem.findMany>>
    expiresAt: number
} | null = null

function invalidateShowroomCatalogCache() {
    cachedCatalogRecord = null
}

async function getCachedShowroomCatalog() {
    const now = Date.now()
    if (cachedCatalogRecord && cachedCatalogRecord.expiresAt > now) {
        return { spots: cachedCatalogRecord.spots, items: cachedCatalogRecord.items }
    }
    const [spots, items] = await Promise.all([
        prisma.showroomCountSpot.findMany({ orderBy: { sortOrder: 'asc' } }),
        prisma.showroomCountItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
    ])
    cachedCatalogRecord = { spots, items, expiresAt: now + 60_000 }
    return { spots, items }
}

async function discoverAvailableGeminiModels(apiKey: string): Promise<{ ok: boolean; status: number; models: string[]; errorText?: string }> {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
            { method: 'GET' }
        )
        if (!res.ok) {
            const errText = await res.text()
            return { ok: false, status: res.status, models: [], errorText: errText }
        }
        const data = (await res.json()) as {
            models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>
        }
        const raw = (data.models ?? [])
            .filter(m =>
                m.name &&
                m.supportedGenerationMethods?.includes('generateContent') &&
                !/embedding|imagen|veo|tts|aqa|bison|gecko|learnlm|robotics|computer-use/i.test(m.name)
            )
            .map(m => String(m.name).replace(/^models\//, ''))

        // Ưu tiên cao nhất cho gemini-3.8-flash, sau đó tới dòng Gemini 3.x Flash khác
        const sorted = raw.sort((a, b) => {
            const score = (name: string) => {
                let s = 0
                if (/3\.8-flash$/i.test(name)) s += 200
                if (/flash/i.test(name)) s += 100
                if (/3\.|3-/i.test(name)) s += 50
                if (!/tts|image|exp/i.test(name)) s += 30
                return s
            }
            return score(b) - score(a)
        })
        return { ok: true, status: 200, models: sorted }
    } catch (err) {
        return { ok: false, status: 0, models: [], errorText: err instanceof Error ? err.message : String(err) }
    }
}

function deriveVaultKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY || 'lyscellars-showroom-default-secret-2026'
    const salt = process.env.ENCRYPTION_SALT ?? 'lyscellars-erp-2026'
    return crypto.scryptSync(secret, salt, 32)
}

function encryptKey(plain: string): { encrypted: string; iv: string } {
    const key = deriveVaultKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    let encrypted = cipher.update(plain, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return { encrypted: `${encrypted}:${authTag}`, iv: iv.toString('hex') }
}

function decryptKey(encryptedData: string, ivHex: string): string {
    const key = deriveVaultKey()
    const iv = Buffer.from(ivHex, 'hex')
    const [encrypted, authTag] = encryptedData.split(':')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}

function maskKeyString(plain: string): string {
    if (plain.length <= 10) return '••••••••'
    return `${plain.slice(0, 6)}••••••••${plain.slice(-4)}`
}

async function resolveShowroomGeminiKey(clientKey?: string): Promise<{ key: string | null; source: 'db' | 'env' | 'client' | 'none' }> {
    const now = Date.now()
    if (cachedApiKeyRecord && cachedApiKeyRecord.expiresAt > now) {
        return { key: cachedApiKeyRecord.key, source: cachedApiKeyRecord.source }
    }
    try {
        const row = await prisma.aiApiKey.findFirst({
            where: { provider: 'gemini', isActive: true },
        })
        if (row?.encryptedKey && row?.iv) {
            const plain = decryptKey(row.encryptedKey, row.iv).trim()
            if (plain) {
                cachedApiKeyRecord = { key: plain, source: 'db', expiresAt: now + 300_000 }
                return { key: plain, source: 'db' }
            }
        }
    } catch { /* fallback to client or env */ }

    if (clientKey && clientKey.trim().length > 10) {
        return { key: clientKey.trim(), source: 'client' }
    }
    if (process.env.GEMINI_API_KEY?.trim()) {
        const envKey = process.env.GEMINI_API_KEY.trim()
        cachedApiKeyRecord = { key: envKey, source: 'env', expiresAt: now + 300_000 }
        return { key: envKey, source: 'env' }
    }
    return { key: null, source: 'none' }
}

async function callGeminiFlash(params: {
    apiKey: string
    parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
    jsonMode?: boolean
    maxOutputTokens?: number
    temperature?: number
    disableThinking?: boolean
}): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
    let lastError = 'Không kết nối được Gemini API.'
    const queue: string[] = [
        ...(cachedWorkingGeminiModel ? [cachedWorkingGeminiModel] : []),
        ...GEMINI_FLASH_MODELS,
    ]
    const tried = new Set<string>()
    let discovered = false

    while (queue.length > 0) {
        const model = queue.shift()!
        if (tried.has(model)) continue
        tried.add(model)

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(params.apiKey)}`
            const supportsZeroThinking = Boolean(
                params.disableThinking &&
                /^gemini-(?:3|2\.5)/i.test(model) &&
                !/3\.5-flash-lite/i.test(model)
            )
            const buildBody = (withZeroThinking: boolean) => JSON.stringify({
                contents: [{ role: 'user', parts: params.parts }],
                generationConfig: {
                    temperature: params.temperature ?? 0.1,
                    maxOutputTokens: params.maxOutputTokens ?? (params.disableThinking ? 1024 : 4096),
                    ...(params.jsonMode ? { responseMimeType: 'application/json' } : {}),
                    ...(withZeroThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
                },
            })
            let res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: buildBody(supportsZeroThinking),
            })
            // Nếu model không hỗ trợ thinkingConfig (trả về 400), tự gọi lại ngay không kèm thinkingConfig
            if (res.status === 400 && supportsZeroThinking) {
                res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: buildBody(false),
                })
            }
            if (!res.ok) {
                const body = await res.text()
                if (
                    res.status === 401 ||
                    res.status === 403 ||
                    (res.status === 400 && /API_KEY_INVALID|API key not valid/i.test(body))
                ) {
                    return { ok: false, error: 'API Key không hợp lệ hoặc không có quyền truy cập Gemini API.' }
                }

                // Nếu thông báo lỗi 404 gợi ý model mới, tự động thêm vào đầu hàng đợi
                const suggestedMatch = body.match(/use\s+models\/([a-zA-Z0-9._-]+)/i)
                if (suggestedMatch?.[1] && !tried.has(suggestedMatch[1])) {
                    queue.unshift(suggestedMatch[1])
                }

                // Nếu gặp 404 hoặc 503/429 (quá tải cục bộ ở 1 model), tự động lấy danh sách tất cả model khả dụng của Key để xoay vòng sang model rảnh hơn (như flash-lite)
                if ((res.status === 404 || res.status === 503 || res.status === 429) && !discovered) {
                    discovered = true
                    const disc = await discoverAvailableGeminiModels(params.apiKey)
                    for (const m of disc.models.slice(0, 6)) {
                        if (!tried.has(m)) queue.push(m)
                    }
                }

                if (res.status === 503 || res.status === 429) {
                    lastError = 'Máy chủ Gemini của Google đang quá tải tạm thời (503). Hãy bấm thử lại sau vài giây.'
                } else {
                    lastError = `Lỗi Gemini (${res.status}): ${body.slice(0, 180)}`
                }
                continue
            }
            const data = await res.json()
            const partsList: Array<{ text?: string; thought?: boolean }> = data.candidates?.[0]?.content?.parts ?? []
            const text = partsList
                .filter(p => !p.thought)
                .map(p => p.text ?? '')
                .join('')
                .trim()
            cachedWorkingGeminiModel = model
            return { ok: true, text, model }
        } catch (err) {
            lastError = err instanceof Error ? err.message : String(err)
        }
    }
    return { ok: false, error: lastError }
}

export type ShowroomAiStatus = {
    configured: boolean
    maskedKey: string | null
    source: 'db' | 'env' | 'client' | 'none'
    updatedAt: string | null
}

/** Kiểm tra trạng thái cấu hình Gemini API Key cho trang kiểm kê. */
export async function getShowroomAiKeyStatus(): Promise<Result<ShowroomAiStatus>> {
    try {
        const row = await prisma.aiApiKey.findFirst({ where: { provider: 'gemini', isActive: true } })
        if (row?.encryptedKey && row?.iv) {
            try {
                const plain = decryptKey(row.encryptedKey, row.iv)
                return {
                    success: true,
                    data: {
                        configured: true,
                        maskedKey: maskKeyString(plain),
                        source: 'db',
                        updatedAt: row.updatedAt.toISOString(),
                    },
                }
            } catch { /* fallback */ }
        }
        if (process.env.GEMINI_API_KEY?.trim()) {
            return {
                success: true,
                data: {
                    configured: true,
                    maskedKey: maskKeyString(process.env.GEMINI_API_KEY.trim()),
                    source: 'env',
                    updatedAt: null,
                },
            }
        }
        return {
            success: true,
            data: { configured: false, maskedKey: null, source: 'none', updatedAt: null },
        }
    } catch (err) {
        console.error('[kiem-ke] getShowroomAiKeyStatus', err)
        return { success: false, error: 'Không kiểm tra được trạng thái AI Key.' }
    }
}

/** Lưu & kiểm tra kết nối Gemini API Key (dùng chung cho mọi thiết bị kiểm kê). Truyền chuỗi rỗng để xóa key. */
export async function saveShowroomAiKey(input: { apiKey: string }): Promise<Result<ShowroomAiStatus>> {
    const raw = String(input.apiKey ?? '').trim()
    try {
        cachedApiKeyRecord = null
        if (!raw) {
            await prisma.aiApiKey.deleteMany({ where: { provider: 'gemini' } })
            return {
                success: true,
                data: { configured: false, maskedKey: null, source: 'none', updatedAt: null },
            }
        }
        if (raw.length < 20) {
            return { success: false, error: 'API Key quá ngắn. Vui lòng dán đúng Gemini API Key (bắt đầu bằng AIza...).' }
        }
        // Xác thực Key trực tiếp qua endpoint danh sách models của Google (nhanh <100ms và không bị chặn bởi lỗi quá tải 503 của từng model lẻ)
        const disc = await discoverAvailableGeminiModels(raw)
        if (!disc.ok) {
            if (disc.status === 400 || disc.status === 401 || disc.status === 403) {
                return { success: false, error: 'API Key không hợp lệ hoặc không có quyền truy cập Gemini API.' }
            }
            // Nếu mạng hoặc endpoint models trục trặc, thử gọi generateContent dự phòng
            const fallbackTest = await callGeminiFlash({
                apiKey: raw,
                parts: [{ text: 'OK' }],
                maxOutputTokens: 4,
            })
            if (!fallbackTest.ok && !fallbackTest.error.includes('503')) {
                return { success: false, error: fallbackTest.error }
            }
        } else if (disc.models.length > 0) {
            cachedWorkingGeminiModel = disc.models[0]
        }
        const { encrypted, iv } = encryptKey(raw)
        const now = new Date()
        await prisma.aiApiKey.upsert({
            where: { provider: 'gemini' },
            create: {
                provider: 'gemini',
                label: 'Google Gemini API Key (Kiểm kê)',
                encryptedKey: encrypted,
                iv,
                isActive: true,
                lastTestedAt: now,
            },
            update: {
                encryptedKey: encrypted,
                iv,
                isActive: true,
                lastTestedAt: now,
            },
        })
        return {
            success: true,
            data: {
                configured: true,
                maskedKey: maskKeyString(raw),
                source: 'db',
                updatedAt: now.toISOString(),
            },
        }
    } catch (err) {
        console.error('[kiem-ke] saveShowroomAiKey', err)
        return { success: false, error: 'Không lưu được API Key vào hệ thống. Bạn vẫn có thể lưu tạm trên máy này.' }
    }
}

/**
 * Dựng bảng tra cứu nhanh danh mục rượu để hậu xử lý kết quả AI:
 * - Gắn `availableVintages` (các niên vụ đang có của cùng mã SKU trong danh mục)
 * - Gắn `alternatives` (các lựa chọn thay thế 1-chạm: các niên vụ khác của cùng mã + các ứng viên do AI đề xuất)
 * - Tự động cảnh báo nếu mã rượu có từ 2 niên vụ trở lên mà người dùng không đọc/chụp rõ năm.
 */
function buildCatalogEnricher(allItems: Array<{
    id: string
    code: string
    name: string
    vintage: string
    packSize: number | null
    kind: string
}>) {
    const byId = new Map(allItems.map(i => [i.id, i]))
    const byCode = new Map<string, typeof allItems>()
    for (const item of allItems) {
        if (!item.code) continue
        const key = item.code.trim().toUpperCase()
        const list = byCode.get(key) ?? []
        list.push(item)
        byCode.set(key, list)
    }

    function enrichCandidate(input: {
        itemId?: string | null
        code?: string
        name?: string
        vintage?: string
        isNewVintage?: boolean
        packSize?: number
        warning?: string
        rawAlternatives?: Array<{ itemId?: string; code?: string; name?: string; vintage?: string; packSize?: number }>
    }) {
        const cleanCode = String(input.code ?? '').trim().toUpperCase()
        const sameCodeItems = byCode.get(cleanCode) ?? []
        const exactById = input.itemId ? byId.get(input.itemId) : undefined
        const cleanVintage = String(input.vintage ?? '').trim()

        let matchedItem = exactById &&
            (!cleanCode || exactById.code.toUpperCase() === cleanCode) &&
            (!cleanVintage || exactById.vintage.trim() === cleanVintage)
            ? exactById
            : undefined

        if (!matchedItem && sameCodeItems.length > 0) {
            if (cleanVintage) {
                matchedItem = sameCodeItems.find(x => x.vintage.trim() === cleanVintage)
            }
            if (!matchedItem && !cleanVintage && exactById && exactById.code.toUpperCase() === cleanCode) {
                matchedItem = exactById
            }
            if (!matchedItem) {
                matchedItem = sameCodeItems[0]
            }
        }

        const resolvedCode = matchedItem?.code || cleanCode
        const resolvedSiblings = byCode.get(resolvedCode.toUpperCase()) ?? sameCodeItems
        const availableVintages = Array.from(
            new Set(resolvedSiblings.map(x => x.vintage.trim()).filter(Boolean))
        ).sort()

        const isNewVintage = Boolean(
            cleanVintage &&
            resolvedSiblings.length > 0 &&
            !resolvedSiblings.some(x => x.vintage.trim() === cleanVintage)
        )

        const resolvedVintage = cleanVintage || matchedItem?.vintage || ''
        const resolvedPack: number = matchedItem
            ? (packSizeOf(matchedItem) ?? 6)
            : (input.packSize === 12 ? 12 : 6)

        const altMap = new Map<string, AiCandidateOption>()
        // 1. Đưa tất cả niên vụ đang có của cùng mã vào danh sách 1-chạm để đổi nhanh
        for (const sib of resolvedSiblings) {
            const key = `${sib.code}|${sib.vintage}`
            altMap.set(key, {
                itemId: sib.id,
                code: sib.code,
                name: sib.name,
                vintage: sib.vintage,
                packSize: packSizeOf(sib) ?? 6,
            })
        }
        // 2. Đưa các mã tương tự mà AI gợi ý vào danh sách 1-chạm
        for (const alt of input.rawAlternatives ?? []) {
            const altItem = (alt.itemId && byId.get(alt.itemId))
                || (alt.code ? (byCode.get(String(alt.code).trim().toUpperCase()) ?? [])[0] : undefined)
            if (altItem) {
                const key = `${altItem.code}|${altItem.vintage}`
                if (!altMap.has(key)) {
                    altMap.set(key, {
                        itemId: altItem.id,
                        code: altItem.code,
                        name: altItem.name,
                        vintage: altItem.vintage,
                        packSize: packSizeOf(altItem) ?? 6,
                    })
                }
            }
        }

        let warning = String(input.warning ?? '').trim()
        if (!warning && availableVintages.length > 1 && !cleanVintage) {
            warning = `Mã ${resolvedCode} có ${availableVintages.length} niên vụ (${availableVintages.join(', ')}) — hãy chạm chọn đúng năm trên nhãn chai.`
        }

        return {
            itemId: matchedItem?.id ?? input.itemId ?? '',
            code: resolvedCode,
            name: matchedItem?.name || String(input.name ?? '').trim(),
            vintage: resolvedVintage,
            isNewVintage: Boolean(input.isNewVintage || isNewVintage),
            packSize: resolvedPack,
            availableVintages,
            alternatives: Array.from(altMap.values()).slice(0, 6),
            warning: warning || undefined,
        }
    }

    return { enrichCandidate }
}

/**
 * AI phân tích câu nói tiếng Việt (hoặc văn bản gõ nhanh) thành danh sách mặt hàng + số lượng kiểm kê theo vị trí.
 * Hỗ trợ:
 * - Tự động chuẩn hoá phiên âm tiếng Việt & đọc từng chữ số ("lờ một không không ba chín" -> L10039, "xa bli" -> Chablis)
 * - Tự động nhận diện vị trí kệ trong câu nói & ý định Cộng thêm ('add') hay Ghi đè ('replace')
 * - Trả về danh sách niên vụ / mã tương tự để người kiểm đổi 1 chạm nếu cần.
 */
export async function parseShowroomVoiceWithAi(input: {
    transcript?: string
    audioBase64?: string
    audioMimeType?: string
    spotId: string
    clientKey?: string
}): Promise<Result<{
    matches: AiVoiceMatch[]
    summaryText: string
    normalizedTranscript: string
    suggestedMode: 'add' | 'replace'
}>> {
    const rawTranscript = String(input.transcript ?? '').trim()
    const hasAudio = Boolean(input.audioBase64 && input.audioBase64.length > 50)
    if (!rawTranscript && !hasAudio) {
        return { success: false, error: 'Chưa có nội dung giọng nói để phân tích.' }
    }
    const normalizedTranscript = rawTranscript ? normalizeVoiceTranscript(rawTranscript) : ''
    try {
        const [{ key }, { spots: allSpots, items: allItems }] = await Promise.all([
            resolveShowroomGeminiKey(input.clientKey),
            getCachedShowroomCatalog(),
        ])
        if (!key) {
            return { success: false, error: 'NO_API_KEY: Chưa cài đặt Gemini API Key. Hãy nhập API Key ở mục Cài đặt AI.' }
        }
        const defaultSpot = allSpots.find(s => s.id === String(input.spotId)) ?? allSpots[0]
        if (!defaultSpot) return { success: false, error: 'Không tìm thấy vị trí kiểm kê.' }
        const spotById = new Map(allSpots.map(s => [s.id, s]))
        const { enrichCandidate } = buildCatalogEnricher(allItems)

        const spotLines = allSpots.map(s =>
            `${s.id}|${s.groupName}|${s.name}|mode=${isCaseSpot(s) ? (isLooseShelfSpot(s) ? 'TANG2_KE_LE' : 'TANG2_THUNG_LE') : s.kind === 'POSM' ? 'POSM' : 'CHAI'}`
        ).join('\n')

        const catalogLines = allItems.map(i => {
            const p = packSizeOf(i)
            return i.kind === 'POSM'
                ? `${i.id}|POSM||pack=1|${i.name}`
                : `${i.id}|${i.code}|${i.vintage || 'NV'}|pack=${p}|${i.name}`
        }).join('\n')

        const prompt = `Bạn là trợ lý AI chuyên trách kiểm kê kho rượu vang cao cấp của LY's Cellars.
Vị trí mặc định đang đứng: "${defaultSpot.id}" ("${defaultSpot.groupName} - ${defaultSpot.name}").

Danh sách tất cả vị trí kiểm kê (spotId|groupName|spotName|mode):
${spotLines}

${hasAudio
    ? 'Hãy nghe kỹ file ghi âm tiếng Việt đính kèm, chép lại câu người kiểm vừa đọc vào trường "transcribedText", sau đó bóc tách danh sách mã rượu và số lượng.'
    : `Câu gốc thu âm: "${rawTranscript}"\nCâu đã chuẩn hoá mã & phiên âm: "${normalizedTranscript}"`}

Danh mục mặt hàng hiện có (id|code|vintage|pack=số_chai_mỗi_thùng|name):
${catalogLines}

Quy tắc suy luận thông minh:
1. Ý ĐỊNH CỘNG THÊM HAY GHI ĐÈ ("suggestedMode"):
   - Nếu câu có từ "cộng thêm", "thêm", "đếm thêm", "bổ sung", "nữa" -> "suggestedMode": "add".
   - Nếu câu có từ "sửa lại", "sửa thành", "đặt lại", "chốt tổng là", "tất cả là" -> "suggestedMode": "replace".
   - Mặc định nếu chỉ đọc tên rượu + số lượng ở Kệ hàng lẻ hoặc đọc nối tiếp -> "suggestedMode": "add".
2. VỊ TRÍ ("spotId" và "spotName"):
   - Nếu người dùng nhắc tên vị trí/kệ (ví dụ: "kệ hàng lẻ", "cạnh cửa ra vào", "cửa sổ", "tường lớn", "bồn rửa", "cầu thang", "tủ lạnh", "kệ to", "gầm cầu thang"...), tự động chọn đúng "spotId" của vị trí đó (chú ý phân biệt Tầng 1 và Tầng 2 theo vị trí mặc định "${defaultSpot.groupName}").
   - Nếu không nhắc vị trí, dùng "${defaultSpot.id}".
3. ĐỐI CHIẾU MÃ RƯỢU, TÊN RƯỢU & NIÊN VỤ (CỰC KỲ QUAN TRỌNG):
   - Hỗ trợ nhận diện tiếng lóng/viết tắt kho:
     + "San Vincenzo" -> L10039; "Capitel Foscarino" -> L10040; "Capitel Croce" -> L10042; "Realda" -> L10041.
     + "Collavini Pinot Grigio" -> L10016; "Collavini Chardonnay" -> L10015; "Collavini Merlot" -> L10018; "Broy" -> L10021; "Ribolla Gialla" -> L10020/L10023.
     + "Richland" -> nhóm L60001..L60005 (Pinot Grigio L60001, Sauvignon Blanc L60002, Chardonnay L60003, Cabernet L60004, Shiraz L60005).
     + "3 Bridges" -> nhóm L60009..L60011; "Saint Clair" -> nhóm L60015..L60022.
   - Nếu người dùng đọc tên chung có nhiều mã gần giống (ví dụ chỉ đọc "Richland 3 chai" hoặc mã đó có nhiều niên vụ 2022/2023), hãy chọn mã khớp nhất vào kết quả chính VÀ liệt kê các mã/niên vụ khả dĩ khác vào mảng "alternatives", đồng thời ghi "warning" nhắc người kiểm chạm chọn.
   - Nếu người dùng đọc năm niên vụ (ví dụ 2021, 2022, 2023, 2024):
     + Chọn dòng có đúng mã và đúng năm vintage đó.
     + Nếu mã rượu đó có trong danh mục nhưng CHƯA có năm đó, lấy itemId của dòng cùng mã, điền "vintage" mới và đặt "isNewVintage": true.
4. SỐ LƯỢNG THEO VỊ TRÍ ĐÍCH:
   - Nếu vị trí đích thuộc Tầng 2 (mode=TANG2_THUNG_LE hoặc TANG2_KE_LE):
     + Ở TANG2_KE_LE (Kệ hàng lẻ): nếu người dùng chỉ đọc "3 chai" hoặc "L10039 3", hiểu là "cases": 0, "loose": 3.
     + Nếu đọc cả thùng và lẻ (vd "2 thùng 4 chai" hoặc "2 thùng lẻ 4"): "cases": 2, "loose": 4, "qty" = cases * pack + loose.
   - Nếu vị trí đích thuộc Tầng 1 / POSM: "cases": null, "loose": null, "qty" = tổng số chai/cái.
5. Chỉ trả về JSON thuần theo cấu trúc:
{
  "transcribedText": "Câu tiếng Việt nghe được từ file âm thanh (hoặc câu chuẩn hóa)",
  "summaryText": "Tóm tắt ngắn gọn kết quả nhận diện bằng tiếng Việt",
  "suggestedMode": "add",
  "matches": [
    {
      "spotId": "${defaultSpot.id}",
      "spotName": "${defaultSpot.groupName} · ${defaultSpot.name}",
      "itemId": "id trong danh mục",
      "code": "L10039",
      "name": "tên mặt hàng",
      "vintage": "2024",
      "packSize": 12,
      "cases": 0,
      "loose": 3,
      "qty": 3,
      "isNewVintage": false,
      "confidence": "Cao",
      "reason": "Giải thích ngắn",
      "warning": "Cảnh báo nếu có nhiều niên vụ hoặc tên rượu gần giống",
      "alternatives": [
        { "itemId": "id khác", "code": "L10040", "name": "tên khác", "vintage": "2023", "packSize": 12 }
      ]
    }
  ]
}`

        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }]
        if (hasAudio && input.audioBase64) {
            const cleanAudio = input.audioBase64.replace(/^data:[^;]+;base64,/, '')
            parts.push({
                inlineData: {
                    mimeType: input.audioMimeType || 'audio/webm',
                    data: cleanAudio,
                },
            })
        }

        const res = await callGeminiFlash({
            apiKey: key,
            parts,
            jsonMode: true,
            maxOutputTokens: 1536,
            temperature: 0.1,
            disableThinking: true,
        })
        if (!res.ok) return { success: false, error: res.error }

        const clean = res.text.replace(/```json/gi, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(clean) as {
            transcribedText?: string
            summaryText?: string
            suggestedMode?: 'add' | 'replace'
            matches?: Array<AiVoiceMatch & { alternatives?: AiCandidateOption[] }>
        }
        const finalTranscript = normalizedTranscript || (parsed.transcribedText ? normalizeVoiceTranscript(parsed.transcribedText) : '')
        const rawMatches = Array.isArray(parsed.matches)
            ? parsed.matches.filter(m => m && (m.code || m.itemId) && typeof m.qty === 'number' && m.qty >= 0)
            : []
        if (!rawMatches.length) {
            return {
                success: false,
                error: `AI chưa tìm thấy mã rượu khớp với câu "${finalTranscript || rawTranscript || 'vừa đọc'}". Hãy đọc mã (vd: L10039) hoặc tên rượu kèm số lượng.`,
            }
        }
        const suggestedMode: 'add' | 'replace' = parsed.suggestedMode === 'replace' ? 'replace' : 'add'
        const matches: AiVoiceMatch[] = rawMatches.map(m => {
            const sp = (m.spotId && spotById.get(m.spotId)) || defaultSpot
            const enriched = enrichCandidate({
                itemId: m.itemId,
                code: m.code,
                name: m.name,
                vintage: m.vintage,
                isNewVintage: m.isNewVintage,
                packSize: m.packSize ?? undefined,
                warning: m.warning,
                rawAlternatives: m.alternatives,
            })
            const spIsCase = isCaseSpot(sp)
            const cases = spIsCase ? Math.max(0, Math.round(Number(m.cases ?? 0))) : null
            const loose = spIsCase ? Math.max(0, Math.round(Number(m.loose ?? (cases === 0 ? m.qty : 0)))) : null
            const qty = spIsCase
                ? (cases ?? 0) * enriched.packSize + (loose ?? 0)
                : Math.max(0, Math.round(Number(m.qty ?? 0)))
            return {
                ...m,
                spotId: sp.id,
                spotName: `${sp.groupName} · ${sp.name}`,
                itemId: enriched.itemId,
                code: enriched.code,
                name: enriched.name,
                vintage: enriched.vintage,
                isNewVintage: enriched.isNewVintage,
                packSize: enriched.packSize,
                cases,
                loose,
                qty,
                confidence: m.confidence || 'Cao',
                warning: enriched.warning,
                availableVintages: enriched.availableVintages,
                alternatives: enriched.alternatives,
                suggestedMode,
            }
        })
        return {
            success: true,
            data: {
                summaryText: parsed.summaryText || `Đã nhận diện ${matches.length} dòng kiểm kê.`,
                normalizedTranscript: finalTranscript || normalizedTranscript,
                suggestedMode,
                matches,
            },
        }
    } catch (err) {
        console.error('[kiem-ke] parseShowroomVoiceWithAi', err)
        return { success: false, error: 'AI không phân tích được câu vừa đọc. Vui lòng thử lại.' }
    }
}

/**
 * AI nhận diện ảnh chụp thông minh:
 * - Chụp Kệ hàng lẻ / nhiều chai xếp trên kệ -> Quét từ trái sang phải, phát hiện cả chai hàng trước lẫn cổ chai/nhãn chai đứng lấp phía sau, cảnh báo nếu bị khuất năm niên vụ, kèm danh sách niên vụ/mã tương tự để bấm đổi 1 chạm.
 * - Chụp chồng thùng carton Tầng 2 / cận cảnh vỏ thùng / tem phụ -> Đọc cả chữ viết tay bút dạ trên vỏ thùng (vd "L10039", "10039"), quy cách 6x750ml / 12x750ml, cảnh báo nếu thùng trên cùng đã rạch băng keo (thùng dở).
 */
export async function identifyShowroomWineImageWithAi(input: {
    imageBase64: string
    mimeType: string
    spotId: string
    clientKey?: string
}): Promise<Result<AiVisionMatch & { sceneWarning?: string }>> {
    if (!input.imageBase64) return { success: false, error: 'Chưa có ảnh chụp.' }
    try {
        const [{ key }, { spots: allSpots, items: allCatalogItems }] = await Promise.all([
            resolveShowroomGeminiKey(input.clientKey),
            getCachedShowroomCatalog(),
        ])
        if (!key) {
            return { success: false, error: 'NO_API_KEY: Chưa cài đặt Gemini API Key. Hãy nhập API Key ở mục Cài đặt AI.' }
        }
        const spot = allSpots.find(s => s.id === String(input.spotId)) ?? null
        const items = allCatalogItems.filter(i => i.kind === 'WINE')
        const isLooseShelf = isLooseShelfSpot(spot)
        const isT2 = isCaseSpot(spot)
        const { enrichCandidate } = buildCatalogEnricher(items)
        const catalogLines = items.map(i => `${i.id}|${i.code}|${i.vintage || 'NV'}|pack=${packSizeOf(i)}|${i.name}`).join('\n')

        const prompt = `Bạn là chuyên gia thị giác máy tính (Computer Vision) kiểm kê kho rượu vang cao cấp của LY's Cellars.
Người kiểm đang chụp ảnh tại vị trí: "${spot ? `${spot.groupName} - ${spot.name}` : input.spotId}" (${isLooseShelf ? 'ĐÂY LÀ KỆ HÀNG LẺ: ưu tiên quét toàn bộ các chai rượu lẻ xuất hiện trên kệ (cả hàng trước và hàng khuất phía sau) và liệt kê thành danh sách' : isT2 ? 'Khu vực kho Tầng 2: có thể là chồng thùng carton nguyên, thùng dở hoặc các chai rượu lẻ trên kệ' : 'Kệ trưng bày Showroom Tầng 1'}).

Danh mục rượu vang hiện có (id|code|vintage|pack|name):
${catalogLines}

Quy tắc phân tích hình ảnh chuyên sâu:
1. QUÉT TOÀN CẢNH & ĐẾM CHÍNH XÁC (TRÁI -> PHẢI, TRÊN -> DƯỚI):
   - Nếu ảnh chụp **Kệ hàng lẻ / nhiều chai xếp trên kệ**:
     + Nhận diện TẤT CẢ các loại rượu nhìn thấy trong ảnh.
     + Chú ý đếm cả **các chai đứng ở hàng sau** (nhìn thấy qua cổ chai/nắp chụp foil cùng màu hoặc vai chai nhô lên phía sau hàng trước). Nếu có chai hàng sau bị che khuất nhãn chính hoặc không nhìn rõ năm niên vụ, vẫn cộng vào tổng "loose" nhưng BẮT BUỘC ghi rõ trong "warning" (ví dụ: "Đếm được 4 chai (3 chai hàng trước + 1 cổ chai phía sau bị khuất năm niên vụ, hãy kiểm tra lại chai sau)").
     + Nếu các chai của cùng 1 nhà sản xuất có nhãn rất giống nhau (ví dụ: Anselmi San Vincenzo L10039 vs Capitel Foscarino L10040 vs Capitel Croce L10042; Collavini Pinot Grigio L10016 vs Chardonnay L10015; Calabria Richland L60001..L60005), hãy đọc kỹ chữ trên nhãn/màu viền để phân biệt và đưa các mã dễ nhầm vào mảng "alternatives".
   - Nếu ảnh chụp **Thùng carton ở Kho Tầng 2**:
     + Đọc kỹ chữ in nhà sản xuất trên vỏ thùng, **tem phụ tiếng Việt** dán ngoài thùng, VÀ **mã SKU viết tay bằng bút dạ** trên vỏ thùng (ví dụ viết tay "L10039" hoặc "10039" -> chính là mã L10039).
     + Tìm ký hiệu quy cách trên vỏ thùng ("6x750ml", "6 bottles", "12x750ml", "12 btls") để xác định "packSize" (6 hoặc 12).
     + Đếm số thùng nguyên ("cases") trong chồng. Nếu thấy thùng trên cùng đã rạch băng keo / mở nắp / móp nhẹ có thể là thùng lẻ đang lấy dở, hãy ghi cảnh báo vào "warning" (ví dụ: "Thùng trên cùng có dấu hiệu đã mở băng keo — hãy kiểm tra xem đủ chai nguyên thùng hay là thùng lẻ").
2. ĐỐI CHIẾU NIÊN VỤ (VINTAGE):
   - Đọc kỹ số năm 4 chữ số trên nhãn cổ chai hoặc nhãn chính (2018..2025).
   - Nếu không nhìn rõ năm niên vụ trên ảnh mà mã rượu đó có nhiều niên vụ trong danh mục, đặt "confidence": "Trung bình" và ghi rõ vào "warning": "Ảnh hơi mờ năm niên vụ — hãy chạm chọn năm đúng bên dưới".
   - Nếu nhìn rõ năm niên vụ mới chưa có trong danh mục của mã đó, đặt "isNewVintage": true.
3. Chỉ trả về JSON thuần theo cấu trúc:
{
  "summaryText": "Tóm tắt ngắn gọn kết quả quét ảnh (ví dụ: Phát hiện 4 mã rượu với tổng 11 chai lẻ trên kệ)",
  "sceneWarning": "Cảnh báo chung cho bức ảnh nếu có (ví dụ: Có 2 chai hàng trong bị khuất nhãn hoặc ánh sáng chói ở góc phải), nếu không có thì để chuỗi rỗng",
  "items": [
    {
      "itemId": "id khớp trong danh mục",
      "code": "L10039",
      "name": "tên rượu",
      "vintage": "2024",
      "isNewVintage": false,
      "packSize": 12,
      "cases": 0,
      "loose": 3,
      "qty": 3,
      "confidence": "Cao",
      "positionNote": "3 chai ngoài cùng bên trái kệ trên, nhãn trắng chữ Anselmi",
      "warning": "Cảnh báo riêng cho dòng này nếu khuất năm niên vụ, có chai hàng sau hoặc thùng mở nắp",
      "alternatives": [
        { "itemId": "id mã dễ nhầm", "code": "L10040", "name": "tên mã dễ nhầm", "vintage": "2023", "packSize": 12 }
      ]
    }
  ]
}`

        const base64Clean = input.imageBase64.replace(/^data:[^;]+;base64,/, '')
        const res = await callGeminiFlash({
            apiKey: key,
            parts: [
                { text: prompt },
                { inlineData: { mimeType: input.mimeType || 'image/jpeg', data: base64Clean } },
            ],
            jsonMode: true,
            maxOutputTokens: 8192,
            temperature: 0.1,
        })
        if (!res.ok) return { success: false, error: res.error }

        const clean = res.text.replace(/```json/gi, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(clean) as {
            summaryText?: string
            sceneWarning?: string
            items?: Array<AiVisionShelfItem & { alternatives?: AiCandidateOption[] }>
            itemId?: string | null
            code?: string
            name?: string
            vintage?: string
            isNewVintage?: boolean
            detectedPackSize?: number | null
            estimatedCases?: number | null
            estimatedLoose?: number | null
            confidence?: string
            note?: string
        }

        const rawItems: AiVisionShelfItem[] = Array.isArray(parsed.items)
            ? parsed.items.filter(x => x && (x.code || x.itemId)).map(x => {
                const enriched = enrichCandidate({
                    itemId: x.itemId,
                    code: x.code,
                    name: x.name,
                    vintage: x.vintage,
                    isNewVintage: x.isNewVintage,
                    packSize: x.packSize,
                    warning: x.warning,
                    rawAlternatives: x.alternatives,
                })
                const pack = x.packSize === 12 || x.packSize === 6 ? x.packSize : enriched.packSize
                const cases = Math.max(0, Math.round(Number(x.cases ?? 0)))
                const loose = Math.max(0, Math.round(Number(x.loose ?? (cases === 0 ? (x.qty ?? 1) : 0))))
                const qty = cases * pack + loose
                return {
                    itemId: enriched.itemId || null,
                    code: enriched.code,
                    name: enriched.name,
                    vintage: enriched.vintage,
                    isNewVintage: enriched.isNewVintage,
                    packSize: pack,
                    cases,
                    loose,
                    qty: qty > 0 ? qty : 1,
                    confidence: String(x.confidence ?? 'Trung bình'),
                    positionNote: String(x.positionNote ?? ''),
                    warning: enriched.warning,
                    availableVintages: enriched.availableVintages,
                    alternatives: enriched.alternatives,
                }
            })
            : parsed.code
                ? (() => {
                    const enriched = enrichCandidate({
                        itemId: parsed.itemId,
                        code: parsed.code,
                        name: parsed.name,
                        vintage: parsed.vintage,
                        isNewVintage: parsed.isNewVintage,
                        packSize: parsed.detectedPackSize ?? undefined,
                    })
                    const pack = parsed.detectedPackSize === 12 || parsed.detectedPackSize === 6
                        ? parsed.detectedPackSize
                        : enriched.packSize
                    const cases = parsed.estimatedCases ?? 0
                    const loose = parsed.estimatedLoose ?? 1
                    return [{
                        itemId: enriched.itemId || null,
                        code: enriched.code,
                        name: enriched.name,
                        vintage: enriched.vintage,
                        isNewVintage: enriched.isNewVintage,
                        packSize: pack,
                        cases,
                        loose,
                        qty: cases * pack + loose,
                        confidence: parsed.confidence ?? 'Trung bình',
                        positionNote: parsed.note ?? '',
                        warning: enriched.warning,
                        availableVintages: enriched.availableVintages,
                        alternatives: enriched.alternatives,
                    }]
                })()
                : []

        if (!rawItems.length) {
            return { success: false, error: 'AI không nhận diện được chai rượu/thùng nào trong ảnh. Hãy chụp rõ nhãn chai trên kệ hoặc mặt bên thùng.' }
        }

        const first = rawItems[0]
        const totalLoose = rawItems.reduce((t, x) => t + x.loose, 0)
        const totalCases = rawItems.reduce((t, x) => t + x.cases, 0)

        return {
            success: true,
            data: {
                spotId: spot?.id ?? input.spotId,
                summaryText: parsed.summaryText || `Nhận diện được ${rawItems.length} mã rượu (${totalCases ? `${totalCases} thùng, ` : ''}${totalLoose} chai lẻ).`,
                sceneWarning: parsed.sceneWarning?.trim() || undefined,
                items: rawItems,
                itemId: first.itemId,
                code: first.code,
                name: first.name,
                vintage: first.vintage,
                isNewVintage: first.isNewVintage,
                detectedPackSize: first.packSize,
                estimatedCases: first.cases,
                estimatedLoose: first.loose,
                confidence: first.confidence,
                note: first.positionNote,
            },
        }
    } catch (err) {
        console.error('[kiem-ke] identifyShowroomWineImageWithAi', err)
        return { success: false, error: 'Không phân tích được ảnh chụp. Vui lòng thử chụp lại rõ nét hơn.' }
    }
}

/**
 * AI Rà soát tổng thể đợt kiểm kê trước khi in biên bản ký.
 */
export async function auditShowroomWithAi(input?: {
    clientKey?: string
}): Promise<Result<{ report: string; anomalyCount: number }>> {
    const { key } = await resolveShowroomGeminiKey(input?.clientKey)
    if (!key) {
        return { success: false, error: 'NO_API_KEY: Chưa cài đặt Gemini API Key. Hãy nhập API Key ở mục Cài đặt AI.' }
    }
    try {
        const countRes = await getShowroomCount()
        if (!countRes.success || !countRes.data) {
            return { success: false, error: 'Không tải được dữ liệu kiểm kê để rà soát.' }
        }
        const data = countRes.data
        const s = summarize(data)
        const anomalies = auditAnomalies(data)

        const anomalyLines = anomalies.slice(0, 25).map((a, idx) =>
            `${idx + 1}. [${a.severity.toUpperCase()}] ${a.spot.groupName} - ${a.spot.name} | ${a.item.code} ${a.item.name} (${a.item.vintage || 'NV'}): ${a.message} (${a.detail})`
        ).join('\n')

        const noteLines = (data.notes ?? []).slice(0, 25).map(n => {
            const sp = data.spots.find(x => x.id === n.spotId)
            const it = data.items.find(x => x.id === n.itemId)
            return `- ${sp?.name ?? n.spotId} | ${it ? `${it.code} ${it.name}` : 'Ghi chú vị trí'} (${n.writtenBy}): "${n.note}"`
        }).join('\n')

        const spotLines = s.spots.map(sp =>
            `- ${sp.spot.groupName} - ${sp.spot.name}: ${sp.touched ? `${sp.lines} mã, ${sp.qty} chai/cái${isCaseSpot(sp.spot) ? ` (${sp.cases} thùng + ${sp.loose} lẻ)` : ''}, kiểm lại ${sp.rechecked}/${sp.cells}` : 'CHƯA ĐẾM'}`
        ).join('\n')

        const prompt = `Bạn là Kiểm toán viên nội bộ rà soát số liệu kiểm kê Showroom & Kho Tầng 2 cho LY's Cellars trước khi in biên bản ký.

Tổng quan số liệu hiện tại:
- Tổng số chai rượu đã đếm: ${s.bottles} chai (${s.wineFound.length}/${s.wineCount} dòng rượu có hàng)
- Tầng 2: ${s.t2Cases} thùng + ${s.t2Loose} chai lẻ = ${s.t2Bottles} chai
- Tiến độ kiểm lại lần 2: ${s.rechecked}/${s.cells} ô đã kiểm chéo
- Số người tham gia kiểm: ${s.people.map(p => `${p.name} (${p.wine} chai)`).join(', ') || 'Chưa có'}

Tiến độ từng vị trí:
${spotLines}

Danh sách cảnh báo bất thường phát hiện tự động (${anomalies.length} mục):
${anomalyLines || 'Không có cảnh báo tự động.'}

Ghi chú hiện trường của nhân viên (${(data.notes ?? []).length} ghi chú):
${noteLines || 'Không có ghi chú.'}

Hãy viết một báo cáo rà soát ngắn gọn, súc tích bằng tiếng Việt (dùng gạch đầu dòng rõ ràng, KHÔNG dùng emoji trang trí) gồm 3 phần:
1. ĐÁNH GIÁ ĐỘ TIN CẬY SỐ LIỆU: Nhận xét tiến độ phủ vị trí, tiến độ kiểm chéo lần 2 và số liệu Tầng 2.
2. CÁC DÒNG NGHI NGỜ CẦN KIỂM TRA LẠI NGAY: Chỉ rõ từng mã hàng/vị trí có nguy cơ đếm trùng (cộng đôi), nhầm thùng/chai lẻ hoặc có ghi chú bất thường.
3. KHUYẾN NGHỊ TRƯỚC KHI IN BIÊN BẢN KÝ: Các bước cần hoàn tất.`

        const res = await callGeminiFlash({
            apiKey: key,
            parts: [{ text: prompt }],
            maxOutputTokens: 8192,
            temperature: 0.2,
        })
        if (!res.ok) return { success: false, error: res.error }

        return {
            success: true,
            data: {
                report: res.text.trim(),
                anomalyCount: anomalies.length,
            },
        }
    } catch (err) {
        console.error('[kiem-ke] auditShowroomWithAi', err)
        return { success: false, error: 'AI chưa tạo được báo cáo rà soát. Thử lại sau.' }
    }
}
