'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAuth, type SessionUser } from '@/lib/session'
import {
    getVideoGuidePresignedUploadUrl,
    deletePaymentDoc,
    type PresignedUploadResult,
} from '@/lib/storage-r2'
import { getScreenMeta } from './constants'

const MANAGER_ROLES = new Set([
    'CEO',
    'ADMIN',
    'SYS:ADMIN',
    'DIRECTOR',
    'BOD',
    'Admin',
    'TRO_LY',
    'Trợ Lý',
    'Trợ lý',
    'ASSISTANT',
])

function canManageGuides(user: SessionUser | null): boolean {
    if (!user) return false
    if ((user.roles || []).some((r) => MANAGER_ROLES.has(r))) return true
    return (user.permissions || []).includes('SYS:ADMIN')
}

export interface VideoGuideDTO {
    id: string
    screenKey: string
    screenLabel: string
    title: string
    description: string | null
    storagePath: string
    streamUrl: string
    fileName: string
    fileSize: number
    mimeType: string
    durationSec: number | null
    sortOrder: number
    isPublished: boolean
    uploadedByName: string | null
    createdAt: string
    updatedAt: string
}

function toStreamUrl(storagePath: string): string {
    if (!storagePath) return ''
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
        return storagePath
    }
    const clean = storagePath.replace(/^\/+/, '')
    return `/api/r2-file/${clean}`
}

export async function getVideoGuidesPageData(): Promise<{
    guides: VideoGuideDTO[]
    canManage: boolean
}> {
    const user = await requireAuth()
    const canManage = canManageGuides(user)

    const rows = await prisma.videoGuide.findMany({
        where: canManage ? {} : { isPublished: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    return {
        canManage,
        guides: rows.map((row) => ({
            id: row.id,
            screenKey: row.screenKey,
            screenLabel: row.screenLabel,
            title: row.title,
            description: row.description,
            storagePath: row.storagePath,
            streamUrl: toStreamUrl(row.storagePath),
            fileName: row.fileName,
            fileSize: row.fileSize,
            mimeType: row.mimeType,
            durationSec: row.durationSec,
            sortOrder: row.sortOrder,
            isPublished: row.isPublished,
            uploadedByName: row.uploadedByName,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        })),
    }
}

export async function requestVideoUploadUrlAction(input: {
    fileName: string
    mimeType: string
    fileSize: number
    screenKey: string
}): Promise<PresignedUploadResult> {
    const user = await requireAuth()
    if (!canManageGuides(user)) {
        return { success: false, error: 'Bạn không có quyền tải video hướng dẫn lên hệ thống' }
    }
    return getVideoGuidePresignedUploadUrl(
        input.fileName,
        input.mimeType,
        input.fileSize,
        input.screenKey
    )
}

export async function createVideoGuideAction(input: {
    screenKey: string
    screenLabel?: string
    title: string
    description?: string
    storagePath: string
    fileName: string
    fileSize: number
    mimeType: string
    durationSec?: number | null
    sortOrder?: number
    isPublished?: boolean
}): Promise<{ success: boolean; data?: VideoGuideDTO; error?: string }> {
    try {
        const user = await requireAuth()
        if (!canManageGuides(user)) {
            return { success: false, error: 'Bạn không có quyền tạo video hướng dẫn' }
        }

        const title = input.title.trim()
        const screenKey = input.screenKey.trim() || 'overview'
        if (!title || !input.storagePath) {
            return { success: false, error: 'Thiếu tiêu đề hoặc đường dẫn video trên R2' }
        }

        const preset = getScreenMeta(screenKey)
        const screenLabel = input.screenLabel?.trim() || preset?.label || screenKey

        const created = await prisma.videoGuide.create({
            data: {
                screenKey,
                screenLabel,
                title,
                description: input.description?.trim() || null,
                storagePath: input.storagePath,
                fileName: input.fileName,
                fileSize: Math.max(0, Math.round(input.fileSize)),
                mimeType: input.mimeType || 'video/mp4',
                durationSec: input.durationSec ? Math.round(input.durationSec) : null,
                sortOrder: input.sortOrder ?? 0,
                isPublished: input.isPublished ?? true,
                uploadedById: user.id,
                uploadedByName: user.name || user.email,
            },
        })

        revalidatePath('/dashboard/guides')

        return {
            success: true,
            data: {
                id: created.id,
                screenKey: created.screenKey,
                screenLabel: created.screenLabel,
                title: created.title,
                description: created.description,
                storagePath: created.storagePath,
                streamUrl: toStreamUrl(created.storagePath),
                fileName: created.fileName,
                fileSize: created.fileSize,
                mimeType: created.mimeType,
                durationSec: created.durationSec,
                sortOrder: created.sortOrder,
                isPublished: created.isPublished,
                uploadedByName: created.uploadedByName,
                createdAt: created.createdAt.toISOString(),
                updatedAt: created.updatedAt.toISOString(),
            },
        }
    } catch (err: any) {
        console.error('[Guides] createVideoGuideAction error:', err)
        return { success: false, error: err?.message || 'Không thể lưu thông tin video hướng dẫn' }
    }
}

export async function updateVideoGuideAction(
    id: string,
    input: {
        screenKey?: string
        screenLabel?: string
        title?: string
        description?: string | null
        sortOrder?: number
        isPublished?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        if (!canManageGuides(user)) {
            return { success: false, error: 'Bạn không có quyền chỉnh sửa video hướng dẫn' }
        }

        const screenKey = input.screenKey?.trim()
        const preset = screenKey ? getScreenMeta(screenKey) : undefined

        await prisma.videoGuide.update({
            where: { id },
            data: {
                ...(screenKey ? { screenKey } : {}),
                ...(input.screenLabel !== undefined
                    ? { screenLabel: input.screenLabel.trim() || preset?.label || screenKey }
                    : preset
                      ? { screenLabel: preset.label }
                      : {}),
                ...(input.title !== undefined ? { title: input.title.trim() } : {}),
                ...(input.description !== undefined
                    ? { description: input.description?.trim() || null }
                    : {}),
                ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
                ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
            },
        })

        revalidatePath('/dashboard/guides')
        return { success: true }
    } catch (err: any) {
        console.error('[Guides] updateVideoGuideAction error:', err)
        return { success: false, error: err?.message || 'Không thể cập nhật video' }
    }
}

export async function deleteVideoGuideAction(
    id: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        if (!canManageGuides(user)) {
            return { success: false, error: 'Bạn không có quyền xóa video hướng dẫn' }
        }

        const existing = await prisma.videoGuide.findUnique({ where: { id } })
        if (!existing) {
            return { success: false, error: 'Không tìm thấy video' }
        }

        await deletePaymentDoc(existing.storagePath).catch((err) => {
            console.warn('[Guides] Failed to delete R2 object:', err)
        })

        await prisma.videoGuide.delete({ where: { id } })
        revalidatePath('/dashboard/guides')

        return { success: true }
    } catch (err: any) {
        console.error('[Guides] deleteVideoGuideAction error:', err)
        return { success: false, error: err?.message || 'Không thể xóa video' }
    }
}
