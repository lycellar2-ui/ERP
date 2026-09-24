'use client'

import React, { useState } from 'react'
import { X, Upload, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createEmployeeDocument, uploadHrDocumentFile } from './actions'

interface Props {
    employeeId: string
    employeeName: string
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

const DOC_TYPES = [
    { value: 'CONTRACT', label: 'Hợp đồng lao động' },
    { value: 'NATIONAL_ID', label: 'CCCD / CMND / Hộ chiếu' },
    { value: 'DEGREE_CERT', label: 'Bằng cấp / Chứng chỉ' },
    { value: 'HEALTH_CERT', label: 'Giấy khám sức khỏe' },
    { value: 'CV', label: 'Sơ yếu lý lịch / CV' },
    { value: 'OTHER', label: 'Tài liệu / Quyết định khác' },
]

export function DocumentUploadModal({ employeeId, employeeName, isOpen, onClose, onSuccess }: Props) {
    const [docType, setDocType] = useState('CONTRACT')
    const [title, setTitle] = useState('')
    const [docNumber, setDocNumber] = useState('')
    const [issueDate, setIssueDate] = useState('')
    const [expiryDate, setExpiryDate] = useState('')
    const [hasNoExpiry, setHasNoExpiry] = useState(false)
    const [notes, setNotes] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    if (!isOpen) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0]
            if (selected.size > 10 * 1024 * 1024) {
                toast.error('Kích thước tệp không được vượt quá 10MB')
                return
            }
            setFile(selected)
            if (!title) {
                // Pre-fill title from filename
                const nameWithoutExt = selected.name.substring(0, selected.name.lastIndexOf('.')) || selected.name
                setTitle(nameWithoutExt)
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) {
            toast.error('Vui lòng chọn tệp giấy tờ cần tải lên')
            return
        }
        if (!title.trim()) {
            toast.error('Vui lòng nhập tên giấy tờ')
            return
        }

        setIsUploading(true)
        try {
            // 1. Upload to Supabase Storage
            const formData = new FormData()
            formData.append('file', file)

            const uploadRes = await uploadHrDocumentFile(formData)
            if (!uploadRes.success || !uploadRes.url) {
                throw new Error(uploadRes.error || 'Tải tệp lên hệ thống thất bại')
            }

            // 2. Create document record in database
            const docRes = await createEmployeeDocument({
                employeeId,
                docType,
                title: title.trim(),
                docNumber: docNumber.trim() || null,
                fileUrl: uploadRes.url,
                filePath: uploadRes.path || null,
                fileType: file.type || 'application/octet-stream',
                fileSize: file.size,
                issueDate: issueDate || null,
                expiryDate: hasNoExpiry ? null : (expiryDate || null),
                notes: notes.trim() || null,
            })

            if (!docRes.success) {
                throw new Error('Lỗi khi lưu thông tin giấy tờ')
            }

            toast.success('Đã tải lên giấy tờ thành công')
            onSuccess()
            onClose()
        } catch (err: any) {
            console.error('Upload document error:', err)
            toast.error(err.message || 'Không thể lưu giấy tờ')
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[#2A4355] bg-[#142433] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A4355] bg-[#1B2E3D]/50">
                    <div>
                        <h3 className="text-base font-bold text-[#E8F1F2] flex items-center gap-2">
                            <Upload className="w-5 h-5 text-[#87CBB9]" />
                            Tải Lên Giấy Tờ & Hồ Sơ Số Hóa
                        </h3>
                        <p className="text-xs text-[#8AAEBB] mt-0.5">Nhân viên: <span className="font-semibold text-white">{employeeName}</span></p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className="p-1 rounded-lg text-[#8AAEBB] hover:text-white hover:bg-[#2A4355] transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* File Dropzone */}
                    <div>
                        <label className="block text-xs font-semibold text-[#8AAEBB] mb-1.5">
                            Chọn tệp giấy tờ (PDF, JPG, PNG - Tối đa 10MB) <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative flex flex-col items-center justify-center p-5 border-2 border-dashed border-[#2A4355] hover:border-[#87CBB9] rounded-xl bg-[#0D1822]/60 transition-colors">
                            <input
                                type="file"
                                accept=".pdf,image/jpeg,image/png,image/webp"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={isUploading}
                            />
                            {file ? (
                                <div className="flex items-center gap-3 text-left">
                                    <div className="p-2.5 rounded-lg bg-[#87CBB9]/20 text-[#87CBB9]">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-semibold text-white truncate max-w-[280px]">{file.name}</p>
                                        <p className="text-xs text-[#8AAEBB]">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <Upload className="w-8 h-8 text-[#87CBB9] mx-auto mb-2 opacity-80" />
                                    <p className="text-xs font-medium text-[#E8F1F2]">Kéo thả file vào đây hoặc <span className="text-[#87CBB9] underline">bấm để chọn</span></p>
                                    <p className="text-[11px] text-[#8AAEBB] mt-1">Hỗ trợ PDF scan, ảnh CCCD, chứng chỉ rõ nét</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Doc Type & Title */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-[#8AAEBB] mb-1">
                                Loại giấy tờ <span className="text-rose-400">*</span>
                            </label>
                            <select
                                value={docType}
                                onChange={e => setDocType(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                            >
                                {DOC_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#8AAEBB] mb-1">
                                Số hiệu / Mã văn bản
                            </label>
                            <input
                                type="text"
                                placeholder="VD: HĐ-2026/01, 079..."
                                value={docNumber}
                                onChange={e => setDocNumber(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[#8AAEBB] mb-1">
                            Tên giấy tờ / Tiêu đề <span className="text-rose-400">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="VD: Hợp đồng lao động xác định thời hạn 1 năm"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            className="w-full px-3 py-2 text-xs rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                        />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-[#8AAEBB] mb-1">
                                Ngày ban hành / Ngày ký
                            </label>
                            <input
                                type="date"
                                value={issueDate}
                                onChange={e => setIssueDate(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-semibold text-[#8AAEBB]">
                                    Ngày hết hạn hiệu lực
                                </label>
                                <label className="flex items-center gap-1.5 text-[11px] text-[#8AAEBB] cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={hasNoExpiry}
                                        onChange={e => setHasNoExpiry(e.target.checked)}
                                        className="rounded border-[#2A4355] bg-[#1B2E3D] text-[#87CBB9] focus:ring-0"
                                    />
                                    Vô thời hạn
                                </label>
                            </div>
                            <input
                                type="date"
                                value={expiryDate}
                                onChange={e => setExpiryDate(e.target.value)}
                                disabled={hasNoExpiry}
                                className={`w-full px-3 py-2 text-xs rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9] ${hasNoExpiry ? 'opacity-40 cursor-not-allowed' : ''}`}
                            />
                        </div>
                    </div>

                    {/* Expiry Warning Note */}
                    {!hasNoExpiry && expiryDate && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                            <span>Hệ thống sẽ tự động bật cảnh báo trước khi giấy tờ này hết hạn 30 ngày.</span>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-semibold text-[#8AAEBB] mb-1">
                            Ghi chú nội bộ
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Ghi chú về tình trạng tài liệu, bản gốc lưu tại đâu..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9] resize-none"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2A4355]">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isUploading}
                            className="px-4 py-2 text-xs font-semibold rounded-lg text-[#8AAEBB] hover:text-white bg-[#1B2E3D] hover:bg-[#2A4355] transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isUploading || !file}
                            className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg bg-[#87CBB9] text-[#0A1926] hover:bg-[#68B9A5] transition-all disabled:opacity-50 cursor-pointer"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Đang tải lên...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    Lưu Giấy Tờ
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
