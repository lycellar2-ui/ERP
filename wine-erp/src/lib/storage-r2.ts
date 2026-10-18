'use server'

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
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

export type UploadProductAssetResult = {
    success: boolean
    url?: string
    thumbUrl?: string
    mediumUrl?: string
    storagePath?: string
    fileName?: string
    fileSize?: number
    mimeType?: string
    error?: string
}

/**
 * Internal helper: Returns permanent URL for a product asset.
 * If R2_PUBLIC_DOMAIN is configured (e.g., https://pub-xxx.r2.dev or custom cdn), returns the direct CDN URL.
 * Otherwise returns the internal API route /api/r2-file/... which securely redirects to presigned GET.
 */
function getProductAssetUrl(storagePath: string): string {
    if (!storagePath) return ''
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
        return storagePath
    }
    const cleanPath = storagePath.replace(/^\/+/, '')
    const config = getR2Config()
    if (config.publicDomain) {
        const domain = config.publicDomain.replace(/\/+$/, '')
        return `${domain}/${cleanPath}`
    }
    return `/api/r2-file/${cleanPath}`
}

/**
 * Upload a product asset (image, tasting-note, self-declaration doc) directly to Cloudflare R2
 */
export async function uploadProductAsset(
    formData: FormData,
    folder: 'images' | 'tasting-notes' | 'documents' = 'tasting-notes',
    customFileName?: string
): Promise<UploadProductAssetResult> {
    try {
        const file = formData.get('file') as File
        if (!file) {
            return { success: false, error: 'Không tìm thấy file tải lên' }
        }

        const maxBytes = folder === 'images' ? 15 * 1024 * 1024 : 35 * 1024 * 1024
        if (file.size > maxBytes) {
            return { success: false, error: `Dung lượng file vượt quá giới hạn ${(maxBytes / (1024 * 1024)).toFixed(0)}MB` }
        }

        const timestamp = Date.now()
        const originalName = customFileName || file.name
        const safeName = originalName
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .replace(/_+/g, '_')
            .slice(0, 80)

        const storagePath = `products/${folder}/${timestamp}_${safeName}`
        const buffer = Buffer.from(await file.arrayBuffer())
        const contentType = file.type || 'application/octet-stream'

        const r2 = getR2Client()
        if (r2) {
            await r2.client.send(
                new PutObjectCommand({
                    Bucket: r2.bucketName,
                    Key: storagePath,
                    Body: buffer,
                    ContentType: contentType,
                })
            )

            const url = getProductAssetUrl(storagePath)

            return {
                success: true,
                url,
                storagePath,
                fileName: originalName,
                fileSize: file.size,
                mimeType: contentType,
            }
        }

        // Fallback: Supabase Storage
        const supabaseRes = await uploadSupabaseFile(formData, `products/${folder}`)
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
        console.error('[Storage R2] uploadProductAsset error:', err)
        return { success: false, error: err.message || 'Lỗi không xác định khi upload tài liệu' }
    }
}

/**
 * Upload a raw Buffer to Cloudflare R2 directly (useful for background scripts & bulk imports)
 */
export async function uploadBufferToR2(
    buffer: Buffer,
    storagePath: string,
    contentType: string = 'application/octet-stream'
): Promise<{ success: boolean; url?: string; storagePath?: string; error?: string }> {
    try {
        const r2 = getR2Client()
        if (!r2) {
            return { success: false, error: 'Không thể kết nối máy chủ Cloudflare R2' }
        }

        await r2.client.send(
            new PutObjectCommand({
                Bucket: r2.bucketName,
                Key: storagePath,
                Body: buffer,
                ContentType: contentType,
            })
        )

        const url = getProductAssetUrl(storagePath)
        return { success: true, url, storagePath }
    } catch (err: any) {
        console.error('[Storage R2] uploadBufferToR2 error:', err)
        return { success: false, error: err.message || 'Lỗi khi upload buffer lên R2' }
    }
}

/**
 * Delete a product asset from Cloudflare R2
 */
export async function deleteProductAsset(storagePath: string): Promise<boolean> {
    try {
        if (!storagePath) return true
        let cleanKey = storagePath
        if (storagePath.startsWith('/api/r2-file/')) {
            cleanKey = storagePath.replace('/api/r2-file/', '')
        }

        const r2 = getR2Client()
        if (r2) {
            await r2.client.send(
                new DeleteObjectCommand({
                    Bucket: r2.bucketName,
                    Key: cleanKey,
                })
            )
            return true
        }

        const res = await deleteSupabaseFile(cleanKey)
        return res.success
    } catch (err) {
        console.error('[Storage R2] deleteProductAsset error:', err)
        return false
    }
}

export type R2FolderStat = {
    prefix: string
    label: string
    fileCount: number
    totalBytes: number
    latestModified: string | null
}

export type R2StorageOverview = {
    connected: boolean
    bucketName: string
    accountIdMasked: string
    freeTierLimitBytes: number // 10 GB standard free tier on Cloudflare R2
    totalFiles: number
    totalBytes: number
    remainingFreeBytes: number
    usagePercent: number
    latencyMs: number
    folders: R2FolderStat[]
    recentFiles: {
        key: string
        size: number
        lastModified: string
        url: string
    }[]
    error?: string
}

/**
 * Inspect Cloudflare R2 Bucket live objects, total size, free tier quota (10 GB/month), and folder breakdown
 */
export async function getR2StorageOverview(): Promise<R2StorageOverview> {
    const start = Date.now()
    const config = getR2Config()
    const freeTierLimitBytes = 10 * 1024 * 1024 * 1024 // 10 GB
    const accountIdMasked = config.accountId
        ? `${config.accountId.slice(0, 6)}...${config.accountId.slice(-4)}`
        : 'N/A'

    const r2 = getR2Client()
    if (!r2) {
        return {
            connected: false,
            bucketName: config.bucketName,
            accountIdMasked,
            freeTierLimitBytes,
            totalFiles: 0,
            totalBytes: 0,
            remainingFreeBytes: freeTierLimitBytes,
            usagePercent: 0,
            latencyMs: Date.now() - start,
            folders: [],
            recentFiles: [],
            error: 'Chưa cấu hình thông tin xác thực Cloudflare R2',
        }
    }

    try {
        let continuationToken: string | undefined = undefined
        let totalFiles = 0
        let totalBytes = 0

        const folderMap = new Map<
            string,
            { label: string; fileCount: number; totalBytes: number; latestModified: Date | null }
        >([
            [
                'products/tasting-notes/',
                { label: 'Tasting Note & Tech Sheet Sản phẩm', fileCount: 0, totalBytes: 0, latestModified: null },
            ],
            [
                'products/legal-docs/tcb/',
                { label: 'Bản Tự Công Bố Sản Phẩm (TCB)', fileCount: 0, totalBytes: 0, latestModified: null },
            ],
            [
                'products/legal-docs/amendment/',
                { label: 'Thông Báo Thay Đổi Sau TCB', fileCount: 0, totalBytes: 0, latestModified: null },
            ],
            [
                'products/legal-docs/testing/',
                { label: 'Phiếu Kiểm Định / Kiểm Nghiệm ATTP', fileCount: 0, totalBytes: 0, latestModified: null },
            ],
            [
                'products/documents/',
                { label: 'Tài Liệu Sản Phẩm Khác', fileCount: 0, totalBytes: 0, latestModified: null },
            ],
            [
                'products/images/',
                { label: 'Hình Ảnh Chai Rượu & Media (Product Media)', fileCount: 0, totalBytes: 0, latestModified: null },
            ],
            [
                'payment-requests/',
                { label: 'Chứng Từ Thanh Toán / Hóa Đơn / UNC', fileCount: 0, totalBytes: 0, latestModified: null },
            ],
            [
                'other',
                { label: 'Tệp Lưu Trữ Khác', fileCount: 0, totalBytes: 0, latestModified: null },
            ],
        ])

        const allObjects: { key: string; size: number; lastModified: Date }[] = []

        do {
            const res: any = await r2.client.send(
                new ListObjectsV2Command({
                    Bucket: r2.bucketName,
                    ContinuationToken: continuationToken,
                    MaxKeys: 1000,
                })
            )

            const contents = res.Contents || []
            for (const obj of contents) {
                if (!obj.Key) continue
                const size = Number(obj.Size || 0)
                const mod: Date = obj.LastModified ? new Date(obj.LastModified) : new Date(0)

                totalFiles += 1
                totalBytes += size
                allObjects.push({ key: obj.Key, size, lastModified: mod })

                let matchedPrefix = 'other'
                for (const prefix of folderMap.keys()) {
                    if (prefix !== 'other' && obj.Key.startsWith(prefix)) {
                        matchedPrefix = prefix
                        break
                    }
                }

                const stat = folderMap.get(matchedPrefix)!
                stat.fileCount += 1
                stat.totalBytes += size
                if (!stat.latestModified || mod > stat.latestModified) {
                    stat.latestModified = mod
                }
            }

            continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
        } while (continuationToken)

        allObjects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
        const recentFiles = allObjects.slice(0, 12).map(o => ({
            key: o.key,
            size: o.size,
            lastModified: o.lastModified.toISOString(),
            url: getProductAssetUrl(o.key),
        }))

        const folders: R2FolderStat[] = Array.from(folderMap.entries())
            .map(([prefix, v]) => ({
                prefix,
                label: v.label,
                fileCount: v.fileCount,
                totalBytes: v.totalBytes,
                latestModified: v.latestModified ? v.latestModified.toISOString() : null,
            }))
            .filter(f => f.fileCount > 0 || f.prefix !== 'other')

        const remainingFreeBytes = Math.max(0, freeTierLimitBytes - totalBytes)
        const usagePercent = Number(((totalBytes / freeTierLimitBytes) * 100).toFixed(3))

        return {
            connected: true,
            bucketName: r2.bucketName,
            accountIdMasked,
            freeTierLimitBytes,
            totalFiles,
            totalBytes,
            remainingFreeBytes,
            usagePercent,
            latencyMs: Date.now() - start,
            folders,
            recentFiles,
        }
    } catch (err: any) {
        console.error('[Storage R2] getR2StorageOverview error:', err)
        return {
            connected: false,
            bucketName: r2.bucketName,
            accountIdMasked,
            freeTierLimitBytes,
            totalFiles: 0,
            totalBytes: 0,
            remainingFreeBytes: freeTierLimitBytes,
            usagePercent: 0,
            latencyMs: Date.now() - start,
            folders: [],
            recentFiles: [],
            error: err.message || 'Không thể truy vấn thống kê Cloudflare R2',
        }
    }
}


