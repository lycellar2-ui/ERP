'use server'

import { createServerSupabaseClient } from '@/lib/supabase'

export type UploadResult = {
    success: boolean
    url?: string
    path?: string
    error?: string
}

const BUCKET = 'erp-files'

// Upload file to Supabase Storage
export async function uploadFile(
    formData: FormData,
    folder: string = 'documents',
): Promise<UploadResult> {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: 'Không có file' }

        // Validate size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return { success: false, error: 'File quá lớn (tối đa 10MB)' }
        }

        const supabase = await createServerSupabaseClient()

        // Generate unique filename
        const ext = file.name.split('.').pop()
        const timestamp = Date.now()
        const safeName = file.name
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .replace(/_+/g, '_')
            .slice(0, 50)
        const path = `${folder}/${timestamp}_${safeName}`

        const buffer = Buffer.from(await file.arrayBuffer())

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, buffer, {
                contentType: file.type,
                upsert: false,
            })

        if (error) {
            return { success: false, error: error.message }
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(path)

        return {
            success: true,
            url: urlData.publicUrl,
            path,
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// Delete file from Supabase Storage
export async function deleteFile(path: string): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createServerSupabaseClient()
        const { error } = await supabase.storage.from(BUCKET).remove([path])

        if (error) return { success: false, error: error.message }
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// List files in a folder
export async function listFiles(folder: string): Promise<{ name: string; url: string; size: number; createdAt: string }[]> {
    try {
        const supabase = await createServerSupabaseClient()
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .list(folder, { sortBy: { column: 'created_at', order: 'desc' } })

        if (error || !data) return []

        return data.map(f => {
            const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(`${folder}/${f.name}`)
            return {
                name: f.name,
                url: urlData.publicUrl,
                size: f.metadata?.size ?? 0,
                createdAt: f.created_at,
            }
        })
    } catch {
        return []
    }
}
