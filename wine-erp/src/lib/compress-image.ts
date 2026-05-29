/**
 * Client-side image compression utility.
 * Resizes large images before uploading, avoiding Vercel's 4.5MB serverless payload limit.
 * 
 * PNG (transparent background): keeps PNG format, only resizes — NO format conversion.
 * JPEG/WebP: compresses to WebP (smaller, supports transparency) with quality fallback.
 */

const MAX_WIDTH = 1600
const MAX_HEIGHT = 6000
const QUALITY = 0.88
const MAX_FILE_SIZE = 3.5 * 1024 * 1024 // 3.5MB target

function hasTransparency(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): boolean {
    // Sample pixels to detect alpha < 255 (transparency)
    const sampleSize = Math.min(canvas.width, 200)
    const data = ctx.getImageData(0, 0, sampleSize, Math.min(canvas.height, 200)).data
    for (let i = 3; i < data.length; i += 16) { // check every 4th pixel's alpha
        if (data[i] < 250) return true
    }
    return false
}

export async function compressImage(file: File): Promise<File> {
    const isPng = file.type === 'image/png'

    // Skip small non-PNG files entirely
    if (file.size <= MAX_FILE_SIZE && !isPng) {
        return file
    }

    return new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)

        img.onload = () => {
            URL.revokeObjectURL(url)

            let { width, height } = img

            const needsResize = width > MAX_WIDTH || height > MAX_HEIGHT

            // If PNG is small and doesn't need resize, skip entirely
            if (isPng && file.size <= MAX_FILE_SIZE && !needsResize) {
                resolve(file)
                return
            }

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
                resolve(file)
                return
            }

            // High-quality resize — do NOT fill background (preserve transparency)
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(img, 0, 0, width, height)

            // Detect if image has transparency
            const transparent = isPng && hasTransparency(canvas, ctx)

            if (transparent) {
                // PNG with transparency → keep as PNG (resize only, no format change)
                canvas.toBlob(
                    (blob) => {
                        if (!blob) { resolve(file); return }
                        const name = file.name.replace(/\.[^.]+$/, '.png')
                        resolve(new File([blob], name, { type: 'image/png' }))
                    },
                    'image/png'
                )
            } else {
                // No transparency → use WebP for best compression (or JPEG fallback)
                const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp')
                const outputType = supportsWebP ? 'image/webp' : 'image/jpeg'
                const ext = supportsWebP ? '.webp' : '.jpg'
                let quality = QUALITY

                const tryCompress = () => {
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) { resolve(file); return }

                            // If still too large, reduce quality
                            if (blob.size > MAX_FILE_SIZE && quality > 0.5) {
                                quality -= 0.1
                                tryCompress()
                                return
                            }

                            const name = file.name.replace(/\.[^.]+$/, ext)
                            resolve(new File([blob], name, { type: outputType }))
                        },
                        outputType,
                        quality
                    )
                }

                tryCompress()
            }
        }

        img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('Không thể đọc file ảnh'))
        }

        img.src = url
    })
}
