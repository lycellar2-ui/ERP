import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const DEFAULT_R2_ACCOUNT_ID = '77bcd51bb60bed1a4b71c794c28b49f2'
const DEFAULT_R2_ACCESS_KEY_ID = '4642b28f948f8d18f430186f1f7a5e36'
const DEFAULT_R2_SECRET_ACCESS_KEY = '5e75f7e5f71c5afa72b67b175483e32b397b49a7b1d6aba426fed6c0bbe8ae9d'
const DEFAULT_R2_BUCKET = 'wine-erp-documents'

function getR2Client() {
    const accountId = process.env.R2_ACCOUNT_ID || DEFAULT_R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || DEFAULT_R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || DEFAULT_R2_SECRET_ACCESS_KEY
    const bucketName = process.env.R2_BUCKET_NAME || DEFAULT_R2_BUCKET
    const publicDomain = process.env.R2_PUBLIC_DOMAIN

    if (!accountId || !accessKeyId || !secretAccessKey) return null

    const client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
    })

    return { client, bucketName, publicDomain }
}

function inferMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'pdf': return 'application/pdf'
        case 'png': return 'image/png'
        case 'jpg':
        case 'jpeg': return 'image/jpeg'
        case 'webp': return 'image/webp'
        case 'gif': return 'image/gif'
        default: return 'application/octet-stream'
    }
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path } = await context.params
        if (!path || path.length === 0) {
            return NextResponse.json({ error: 'File path not provided' }, { status: 400 })
        }

        const storagePath = path.join('/')
        const r2 = getR2Client()

        if (!r2) {
            return NextResponse.json({ error: 'R2 storage configuration unavailable' }, { status: 500 })
        }

        const isDownload = request.nextUrl.searchParams.get('download') === 'true'
        const customFileName = path[path.length - 1]
        const disposition = isDownload
            ? `attachment; filename="${encodeURIComponent(customFileName)}"`
            : `inline; filename="${encodeURIComponent(customFileName)}"`

        try {
            const obj = await r2.client.send(
                new GetObjectCommand({
                    Bucket: r2.bucketName,
                    Key: storagePath,
                })
            )

            if (obj.Body) {
                const bytes = await obj.Body.transformToByteArray()
                const contentType = obj.ContentType || inferMimeType(customFileName)

                return new NextResponse(Buffer.from(bytes), {
                    status: 200,
                    headers: {
                        'Content-Type': contentType,
                        'Content-Length': String(bytes.byteLength),
                        'Content-Disposition': disposition,
                        'Cache-Control': 'public, max-age=3600',
                        'X-Frame-Options': 'SAMEORIGIN',
                    },
                })
            }
        } catch (s3Err) {
            console.warn('[API r2-file] Direct stream fallback to presigned URL:', s3Err)
        }

        const commandInput: any = {
            Bucket: r2.bucketName,
            Key: storagePath,
            ResponseContentDisposition: disposition,
        }

        const presignedUrl = await getSignedUrl(
            r2.client,
            new GetObjectCommand(commandInput),
            { expiresIn: 3600 }
        )

        return NextResponse.redirect(presignedUrl, 302)
    } catch (err: any) {
        console.error('[API r2-file] Error resolving file:', err)
        return NextResponse.json({ error: err.message || 'File not found or inaccessible' }, { status: 404 })
    }
}
