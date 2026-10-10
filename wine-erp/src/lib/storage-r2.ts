'use server'

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { uploadFile as uploadSupabaseFile, deleteFile as deleteSupabaseFile } from './storage'

export type UploadPaymentDocResult = {
    success: boolean
    url?: string
    storagePath?: string
    fileName?: string
    fileSize?: number
    mimeType?: string
    error?: string
}

// ── Environment Variables for Cloudflare R2 ─────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'lycellar-docs'
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN // e.g. https://pub-xxxxxx.r2.dev or https://docs.lycellar.vn

function getR2Client(): S3Client | null {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        return null
    }

    return new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    })
}

/**
 * Upload a payment document (invoice, receipt, UNC, contract)
 * Priority: Cloudflare R2 -> Fallback: Supabase Storage
 */
export async function uploadPaymentDoc(
    formData: FormData,
    subfolder: string = 'general'
): Promise<UploadPaymentDocResult> {
    try {
        const file = formData.get('file') as File
        if (!file) {
            return { success: false, error: 'Không tìm thấy file tải lên' }
        }

        // Validate max 20MB for high-res PDF / scans
        const maxBytes = 20 * 1024 * 1024
        if (file.size > maxBytes) {
            return { success: false, error: 'Dung lượng file vượt quá giới hạn 20MB' }
        }

        const year = new Date().getFullYear()
        const timestamp = Date.now()
        const originalName = file.name
        const safeName = originalName
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .replace(/_+/g, '_')
            .slice(0, 80)

        const storagePath = `payment-requests/${year}/${subfolder}/${timestamp}_${safeName}`
        const buffer = Buffer.from(await file.arrayBuffer())
        const contentType = file.type || 'application/octet-stream'

        const r2 = getR2Client()

        if (r2) {
            // Upload to Cloudflare R2
            await r2.send(
                new PutObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: storagePath,
                    Body: buffer,
                    ContentType: contentType,
                })
            )

            // Resolve access URL (public custom domain or pre-signed URL)
            let viewUrl = ''
            if (R2_PUBLIC_DOMAIN) {
                const domain = R2_PUBLIC_DOMAIN.replace(/\/+$/, '')
                viewUrl = `${domain}/${storagePath}`
            } else {
                // Generate pre-signed URL valid for 24 hours
                viewUrl = await getSignedUrl(
                    r2,
                    new GetObjectCommand({
                        Bucket: R2_BUCKET_NAME,
                        Key: storagePath,
                    }),
                    { expiresIn: 86400 }
                )
            }

            return {
                success: true,
                url: viewUrl,
                storagePath,
                fileName: originalName,
                fileSize: file.size,
                mimeType: contentType,
            }
        }

        // Fallback: Supabase Storage
        const supabaseRes = await uploadSupabaseFile(formData, `payment-requests/${year}/${subfolder}`)
        if (!supabaseRes.success || !supabaseRes.url) {
            return { success: false, error: supabaseRes.error || 'Lỗi tải file lên máy chủ lưu trữ' }
        }

        return {
            success: true,
            url: supabaseRes.url,
            storagePath: supabaseRes.path,
            fileName: originalName,
            fileSize: file.size,
            mimeType: contentType,
        }
    } catch (err: any) {
        console.error('[Storage R2] Upload error:', err)
        return { success: false, error: err.message || 'Lỗi không xác định khi upload chứng từ' }
    }
}

/**
 * Generate a secure, time-limited Pre-signed URL for viewing/printing a document
 * @param storagePath The key on R2 or Supabase path
 * @param expiresInSeconds Time valid in seconds (default 30 mins)
 */
export async function getPresignedDocUrl(
    storagePath: string,
    expiresInSeconds: number = 1800
): Promise<string | null> {
    try {
        if (!storagePath) return null

        // If it's already a full HTTP(S) URL and not in R2 format, return as is
        if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
            return storagePath
        }

        const r2 = getR2Client()
        if (r2) {
            if (R2_PUBLIC_DOMAIN) {
                const domain = R2_PUBLIC_DOMAIN.replace(/\/+$/, '')
                return `${domain}/${storagePath}`
            }

            return await getSignedUrl(
                r2,
                new GetObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: storagePath,
                }),
                { expiresIn: expiresInSeconds }
            )
        }

        // Fallback for Supabase paths
        return storagePath
    } catch (err) {
        console.error('[Storage R2] Presigned URL error:', err)
        return null
    }
}

/**
 * Delete a payment document
 */
export async function deletePaymentDoc(storagePath: string): Promise<boolean> {
    try {
        if (!storagePath) return true

        const r2 = getR2Client()
        if (r2) {
            await r2.send(
                new DeleteObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: storagePath,
                })
            )
            return true
        }

        const res = await deleteSupabaseFile(storagePath)
        return res.success
    } catch (err) {
        console.error('[Storage R2] Delete error:', err)
        return false
    }
}
