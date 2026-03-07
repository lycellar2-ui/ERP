'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, X, Loader2, Download, ExternalLink } from 'lucide-react'

interface DocumentItem {
    id?: string
    name: string
    url: string
    size?: number
    uploadedAt?: string
}

interface DocumentUploaderProps {
    documents?: DocumentItem[]
    onUpload: (formData: FormData) => Promise<{ success: boolean; error?: string }>
    onDelete?: (id: string) => Promise<{ success: boolean; error?: string }>
    label?: string
    accept?: string
    maxSizeMB?: number
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentUploader({
    documents = [],
    onUpload,
    onDelete,
    label = 'Tài liệu đính kèm',
    accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg',
    maxSizeMB = 50,
}: DocumentUploaderProps) {
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`File quá lớn (max ${maxSizeMB}MB)`)
            return
        }

        setUploading(true)
        setError('')

        const formData = new FormData()
        formData.append('file', file)
        formData.append('name', file.name)

        try {
            const result = await onUpload(formData)
            if (!result.success) setError(result.error ?? 'Upload thất bại')
        } catch {
            setError('Lỗi kết nối')
        }

        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''
    }

    const handleDelete = async (id: string) => {
        if (!onDelete || !confirm('Xóa tài liệu này?')) return
        const result = await onDelete(id)
        if (!result.success) setError(result.error ?? 'Xóa thất bại')
    }

    const getFileIcon = (name: string) => {
        if (name.match(/\.pdf$/i)) return '📄'
        if (name.match(/\.(doc|docx)$/i)) return '📝'
        if (name.match(/\.(xls|xlsx)$/i)) return '📊'
        if (name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return '🖼️'
        return '📎'
    }

    return (
        <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wide block"
                style={{ color: '#4A6A7A' }}>{label}</label>

            {/* Existing documents */}
            {documents.length > 0 && (
                <div className="space-y-2">
                    {documents.map((doc, i) => (
                        <div key={doc.id ?? i}
                            className="flex items-center gap-3 p-3 rounded-lg"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <span className="text-lg">{getFileIcon(doc.name)}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm truncate" style={{ color: '#E0E8EF' }}>
                                    {doc.name}
                                </p>
                                {doc.size && (
                                    <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                        {formatFileSize(doc.size)}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-1">
                                <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                    className="p-1.5 rounded-md transition-colors hover:bg-white/5"
                                    style={{ color: '#87CBB9' }} title="Mở file">
                                    <ExternalLink size={14} />
                                </a>
                                <a href={doc.url} download={doc.name}
                                    className="p-1.5 rounded-md transition-colors hover:bg-white/5"
                                    style={{ color: '#87CBB9' }} title="Tải về">
                                    <Download size={14} />
                                </a>
                                {onDelete && doc.id && (
                                    <button onClick={() => handleDelete(doc.id!)}
                                        className="p-1.5 rounded-md transition-colors hover:bg-white/5"
                                        style={{ color: '#E8A0A0' }} title="Xóa">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload button */}
            <button onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
                    transition-all cursor-pointer"
                style={{
                    background: '#1B2E3D',
                    border: '1px dashed #2A4355',
                    color: uploading ? '#4A6A7A' : '#87CBB9',
                }}>
                {uploading ? (
                    <><Loader2 size={16} className="animate-spin" /> Đang upload...</>
                ) : (
                    <><Upload size={16} /> Thêm tài liệu</>
                )}
            </button>

            {error && (
                <p className="text-xs flex items-center gap-1" style={{ color: '#E8A0A0' }}>
                    ⚠ {error}
                </p>
            )}

            <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
        </div>
    )
}
