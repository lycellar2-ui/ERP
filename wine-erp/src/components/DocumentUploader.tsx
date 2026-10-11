'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, X, Loader2, Download, ExternalLink, FileSpreadsheet, Image as ImageIcon, Paperclip, AlertCircle } from 'lucide-react'
import { useConfirmDialog } from './ui/Modal'

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
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
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
        if (!onDelete) return
        const ok = await confirm({
            title: 'Xóa tài liệu',
            message: 'Bạn có chắc chắn muốn xóa tài liệu này không?',
            confirmLabel: 'Xóa tài liệu',
            variant: 'danger',
        })
        if (!ok) return
        const result = await onDelete(id)
        if (!result.success) setError(result.error ?? 'Xóa thất bại')
    }

    const renderFileIcon = (name: string) => {
        if (name.match(/\.pdf$/i)) return <FileText size={18} className="text-rose-600" />
        if (name.match(/\.(doc|docx)$/i)) return <FileText size={18} className="text-blue-600" />
        if (name.match(/\.(xls|xlsx|csv)$/i)) return <FileSpreadsheet size={18} className="text-emerald-600" />
        if (name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return <ImageIcon size={18} className="text-cyan-600" />
        return <Paperclip size={18} className="text-slate-500" />
    }

    return (
        <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wide block"
                style={{ color: '#64748B' }}>{label}</label>

            {/* Existing documents */}
            {documents.length > 0 && (
                <div className="space-y-2">
                    {documents.map((doc, i) => (
                        <div key={doc.id ?? i}
                            className="flex items-center gap-3 p-3 rounded-lg"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <span className="flex items-center justify-center w-8 h-8 rounded bg-slate-50 shrink-0">{renderFileIcon(doc.name)}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm truncate font-medium" style={{ color: '#0F172A' }}>
                                    {doc.name}
                                </p>
                                {doc.size && (
                                    <p className="text-xs" style={{ color: '#64748B' }}>
                                        {formatFileSize(doc.size)}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-1">
                                <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                    className="p-1.5 rounded-md transition-colors hover:bg-slate-100"
                                    style={{ color: '#0891B2' }} title="Mở file">
                                    <ExternalLink size={14} />
                                </a>
                                <a href={doc.url} download={doc.name}
                                    className="p-1.5 rounded-md transition-colors hover:bg-slate-100"
                                    style={{ color: '#0891B2' }} title="Tải về">
                                    <Download size={14} />
                                </a>
                                {onDelete && doc.id && (
                                    <button onClick={() => handleDelete(doc.id!)}
                                        className="p-1.5 rounded-md transition-colors hover:bg-slate-100"
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
                    background: '#FFFFFF',
                    border: '1px dashed #E2E8F0',
                    color: uploading ? '#64748B' : '#0E7490',
                }}>
                {uploading ? (
                    <><Loader2 size={16} className="animate-spin" /> Đang upload...</>
                ) : (
                    <><Upload size={16} /> Thêm tài liệu</>
                )}
            </button>

            {error && (
                <p className="text-xs flex items-center gap-1" style={{ color: '#E11D48' }}>
                    <AlertCircle size={13} /> {error}
                </p>
            )}

            <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
            {confirmDialog}
        </div>
    )
}
