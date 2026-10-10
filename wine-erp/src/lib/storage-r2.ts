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

// ── Environment Variables & Fallback for Cloudflare R2 ───────────
const DEFAULT_R2_ACCOUNT_ID = '77bcd51bb60bed1a4b71c794c28b49f2'
const DEFAULT_R2_ACCESS_KEY_ID = '4642b28f948f8d18f430186f1f7a5e36'
const DEFAULT_R2_SECRET_ACCESS_KEY = '5e75f7e5f71c5afa72b67b175483e32b397b49a7b1d6aba426fed6c0bbe8ae9d'
const DEFAULT_R2_BUCKET = 'wine-erp-documents'

function getR2Config() {
    return {
        accountId: process.env.R2_ACCOUNT_ID || DEFAULT_R2_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID || DEFAULT_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || DEFAULT_R2_SECRET_ACCESS_KEY,
        bucketName: process.env.R2_BUCKET_NAME || DEFAULT_R2_BUCKET,
        publicDomain: process.env.R2_PUBLIC_DOMAIN,
    }
}

function getR2Client(): { client: S3Client; bucketName: string; publicDomain?: string } | null {
    const config = getR2Config()
    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey) {
        return null
    }

    const client = new S3Client({
        region: 'auto',
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    })

    return { client, bucketName: config.bucketName, publicDomain: config.publicDomain }
}

export type PresignedUploadResult = {
    success: boolean
    uploadUrl?: string
    storagePath?: string
    viewUrl?: string
    fileName?: string
    fileSize?: number
    mimeType?: string
    error?: string
}

/**
 * Generate a direct Presigned PUT URL for browser-to-R2 upload
 * Bypasses Vercel Serverless Function 4.5MB request body size limit completely
 */
export async function getPresignedUploadUrl(
    fileName: string,
    mimeType: string,
    fileSize: number,
    subfolder: string = 'general'
): Promise<PresignedUploadResult> {
    try {
        if (!fileName) {
            return { success: false, error: 'Tên file không hợp lệ' }
        }

        // Validate max 25MB for high-res PDF / scans
        const maxBytes = 25 * 1024 * 1024
        if (fileSize > maxBytes) {
            return { success: false, error: 'Dung lượng file vượt quá giới hạn 25MB' }
        }

        const r2 = getR2Client()
        if (!r2) {
            return { success: false, error: 'Không thể kết nối máy chủ lưu trữ Cloudflare R2' }
        }

        const year = new Date().getFullYear()
        const timestamp = Date.now()
        const safeName = fileName
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .replace(/_+/g, '_')
            .slice(0, 80)

        const storagePath = `payment-requests/${year}/${subfolder}/${timestamp}_${safeName}`
        const contentType = mimeType || 'application/octet-stream'

        // Presigned PUT URL for direct browser upload valid for 15 minutes
        const uploadUrl = await getSignedUrl(
            r2.client,
            new PutObjectCommand({
                Bucket: r2.bucketName,
                Key: storagePath,
                ContentType: contentType,
            }),
            { expiresIn: 900 }
        )

        // Resolve initial view URL (custom public domain or 24h signed GET URL)
        let viewUrl = ''
        if (r2.publicDomain) {
            const domain = r2.publicDomain.replace(/\/+$/, '')
            viewUrl = `${domain}/${storagePath}`
        } else {
            viewUrl = await getSignedUrl(
                r2.client,
                new GetObjectCommand({
                    Bucket: r2.bucketName,
                    Key: storagePath,
                }),
                { expiresIn: 86400 } // 24 hours
            )
        }

        return {
            success: true,
            uploadUrl,
            storagePath,
            viewUrl,
            fileName,
            fileSize,
            mimeType: contentType,
        }
    } catch (err: any) {
        console.error('[Storage R2] Presigned upload URL error:', err)
        return { success: false, error: err.message || 'Lỗi khi khởi tạo đường dẫn upload chứng từ' }
    }
}

/**
 * Upload a payment document (invoice, receipt, UNC, contract) via Server Action
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

        // Validate max 25MB for high-res PDF / scans
        const maxBytes = 25 * 1024 * 1024
        if (file.size > maxBytes) {
            return { success: false, error: 'Dung lượng file vượt quá giới hạn 25MB' }
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
            await r2.client.send(
                new PutObjectCommand({
                    Bucket: r2.bucketName,
                    Key: storagePath,
                    Body: buffer,
                    ContentType: contentType,
                })
            )

            // Resolve access URL (public custom domain or pre-signed URL)
            let viewUrl = ''
            if (r2.publicDomain) {
                const domain = r2.publicDomain.replace(/\/+$/, '')
                viewUrl = `${domain}/${storagePath}`
            } else {
                // Generate pre-signed URL valid for 24 hours
                viewUrl = await getSignedUrl(
                    r2.client,
                    new GetObjectCommand({
                        Bucket: r2.bucketName,
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
            if (r2.publicDomain) {
                const domain = r2.publicDomain.replace(/\/+$/, '')
                return `${domain}/${storagePath}`
            }

            return await getSignedUrl(
                r2.client,
                new GetObjectCommand({
                    Bucket: r2.bucketName,
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
            await r2.client.send(
                new DeleteObjectCommand({
                    Bucket: r2.bucketName,
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
