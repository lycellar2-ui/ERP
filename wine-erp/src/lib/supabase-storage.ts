import { createClient } from '@supabase/supabase-js'

export type StorageBucket = 'contracts' | 'invoices' | 'documents'

function getStorageClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase Storage: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return createClient(url, key, { auth: { persistSession: false } })
}

export async function uploadToStorage(
    bucket: StorageBucket,
    filePath: string,
    file: File | Buffer,
    contentType?: string
): Promise<{ success: boolean; url?: string; path?: string; error?: string }> {
    try {
        const supabase = getStorageClient()

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, {
                contentType: contentType ?? 'application/octet-stream',
                upsert: true,
            })

        if (error) return { success: false, error: error.message }

        // Signed URL (1 year) for private buckets
        const { data: signedData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(data.path, 60 * 60 * 24 * 365)

        return {
            success: true,
            url: signedData?.signedUrl ?? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${data.path}`,
            path: data.path,
        }
    } catch (err: any) {
        return { success: false, error: err.message ?? 'Storage upload failed' }
    }
}

export async function deleteFromStorage(
    bucket: StorageBucket,
    filePath: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = getStorageClient()
        const { error } = await supabase.storage.from(bucket).remove([filePath])
        return error ? { success: false, error: error.message } : { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getSignedUrl(
    bucket: StorageBucket,
    filePath: string,
    expiresIn = 3600
): Promise<string | null> {
    try {
        const supabase = getStorageClient()
        const { data } = await supabase.storage.from(bucket).createSignedUrl(filePath, expiresIn)
        return data?.signedUrl ?? null
    } catch {
        return null
    }
}
