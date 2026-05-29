/**
 * Client-side image compression utility.
 * Resizes large images and compresses to JPEG before uploading,
 * avoiding Vercel's 4.5MB serverless function payload limit.
 */

const MAX_WIDTH = 1600
const MAX_HEIGHT = 6000
const JPEG_QUALITY = 0.88
const MAX_FILE_SIZE = 3.5 * 1024 * 1024 // 3.5MB target

export async function compressImage(file: File): Promise<File> {
    // Skip if already small enough and not oversized dimensions
    if (file.size <= MAX_FILE_SIZE && !file.type.includes('png')) {
        return file
    }

    return new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)

        img.onload = () => {
            URL.revokeObjectURL(url)

            let { width, height } = img

            // Scale down if exceeds max dimensions
            if (width > MAX_WIDTH) {
                height = Math.round(height * (MAX_WIDTH / width))
                width = MAX_WIDTH
            }
            if (height > MAX_HEIGHT) {
                width = Math.round(width * (MAX_HEIGHT / height))
                height = MAX_HEIGHT
            }

            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height

            const ctx = canvas.getContext('2d')
            if (!ctx) {
                resolve(file) // fallback to original
                return
            }

            // High-quality resize
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(img, 0, 0, width, height)

            // Try JPEG first for best compression
            let quality = JPEG_QUALITY

            const tryCompress = () => {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(file)
                            return
                        }

                        // If still too large, reduce quality
                        if (blob.size > MAX_FILE_SIZE && quality > 0.5) {
                            quality -= 0.1
                            tryCompress()
                            return
                        }

                        const name = file.name.replace(/\.[^.]+$/, '.jpg')
                        resolve(new File([blob], name, { type: 'image/jpeg' }))
                    },
                    'image/jpeg',
                    quality
                )
            }

            tryCompress()
        }

        img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('Không thể đọc file ảnh'))
        }

        img.src = url
    })
}
