/**
 * Client-side direct upload to ImgBB.
 * Bypasses Vercel serverless function entirely — no payload limit.
 * Flow: Browser → ImgBB API → returns URL → save URL to DB via server action.
 */

const IMGBB_API = 'https://api.imgbb.com/1/upload'

export type ImgBBClientResult = {
    success: boolean
    url?: string
    thumbUrl?: string
    mediumUrl?: string
    error?: string
}

export async function uploadToImgBBDirect(
    file: File,
    apiKey: string,
    name?: string,
): Promise<ImgBBClientResult> {
    if (!apiKey) return { success: false, error: 'ImgBB API key missing' }

    const formData = new FormData()
    formData.append('key', apiKey)
    formData.append('image', file)
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
        }
    } catch (err: any) {
        return { success: false, error: err.message ?? 'Network error' }
    }
}
