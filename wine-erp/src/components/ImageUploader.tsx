'use client'

import { useState, useRef } from 'react'
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'

interface ImageUploaderProps {
    currentUrl?: string | null
    onUpload: (formData: FormData) => Promise<{ success: boolean; url?: string; error?: string }>
    onRemove?: () => void
    label?: string
    size?: number
}

export function ImageUploader({
    currentUrl,
    onUpload,
    onRemove,
    label = 'Ảnh sản phẩm',
    size = 180,
}: ImageUploaderProps) {
    const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setPreview(URL.createObjectURL(file))
        setUploading(true)
        setError('')

        const formData = new FormData()
        formData.append('image', file)

        try {
            const result = await onUpload(formData)
            if (result.success && result.url) {
                setPreview(result.url)
            } else {
                setError(result.error ?? 'Upload thất bại')
                setPreview(currentUrl ?? null)
            }
        } catch {
            setError('Lỗi kết nối')
            setPreview(currentUrl ?? null)
        }

        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''
    }

    const handleRemove = () => {
        setPreview(null)
        setError('')
        if (inputRef.current) inputRef.current.value = ''
        onRemove?.()
    }

    return (
        <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5"
                style={{ color: '#4A6A7A' }}>{label}</label>

            {preview ? (
                <div className="relative group rounded-xl overflow-hidden"
                    style={{ width: size, height: size, background: '#1B2E3D' }}>
                    <img src={preview} alt={label}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105" />

                    {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center"
                            style={{ background: 'rgba(10,25,38,0.75)' }}>
                            <Loader2 size={28} className="animate-spin" style={{ color: '#87CBB9' }} />
                        </div>
                    )}

                    {!uploading && (
                        <div className="absolute inset-0 flex items-center justify-center gap-2
                            opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'rgba(10,25,38,0.6)' }}>
                            <button onClick={() => inputRef.current?.click()}
                                className="p-2 rounded-lg transition-colors"
                                title="Thay đổi ảnh"
                                style={{ background: 'rgba(135,203,185,0.2)', color: '#87CBB9' }}>
                                <Upload size={18} />
                            </button>
                            <button onClick={handleRemove}
                                className="p-2 rounded-lg transition-colors"
                                title="Xóa ảnh"
                                style={{ background: 'rgba(139,26,46,0.3)', color: '#E8A0A0' }}>
                                <X size={18} />
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <button onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="flex flex-col items-center justify-center gap-3 rounded-xl
                        transition-all hover:border-solid cursor-pointer"
                    style={{
                        width: size, height: size,
                        background: '#1B2E3D',
                        border: '2px dashed #2A4355',
                        color: '#4A6A7A',
                    }}>
                    {uploading ? (
                        <Loader2 size={28} className="animate-spin" style={{ color: '#87CBB9' }} />
                    ) : (
                        <>
                            <ImageIcon size={32} />
                            <span className="text-xs">Click để upload</span>
                        </>
                    )}
                </button>
            )}

            {error && (
                <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#E8A0A0' }}>
                    ⚠ {error}
                </p>
            )}

            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden" onChange={handleFile} />
        </div>
    )
}
