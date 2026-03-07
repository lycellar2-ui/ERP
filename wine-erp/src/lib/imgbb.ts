'use server'

const IMGBB_API = 'https://api.imgbb.com/1/upload'

export type ImgBBResult = {
    success: boolean
    url?: string
    thumbUrl?: string
    mediumUrl?: string
    deleteUrl?: string
    error?: string
}

export async function uploadToImgBB(
    base64Image: string,
    name?: string
): Promise<ImgBBResult> {
    const apiKey = process.env.IMGBB_API_KEY
    if (!apiKey) return { success: false, error: 'IMGBB_API_KEY not configured' }

    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '')

    const formData = new FormData()
    formData.append('key', apiKey)
    formData.append('image', cleanBase64)
    if (name) formData.append('name', name)

    try {
        const res = await fetch(IMGBB_API, { method: 'POST', body: formData })
        const json = await res.json()

        if (!json.success) {
            return { success: false, error: json.error?.message ?? 'ImgBB upload failed' }
        }

        return {
            success: true,
            url: json.data.display_url,
            thumbUrl: json.data.thumb?.url,
            mediumUrl: json.data.medium?.url,
            deleteUrl: json.data.delete_url,
        }
    } catch (err: any) {
        return { success: false, error: err.message ?? 'Network error' }
    }
}

export async function uploadFileToImgBB(file: File): Promise<ImgBBResult> {
    const maxSize = 32 * 1024 * 1024
    if (file.size > maxSize) return { success: false, error: 'File quá lớn (max 32MB)' }
    if (!file.type.startsWith('image/')) return { success: false, error: 'Chỉ chấp nhận file ảnh' }

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const name = file.name.replace(/\.[^.]+$/, '')
    return uploadToImgBB(base64, name)
}
