'use client'

import React, { useState, useRef } from 'react'
import { X, Upload, FileText, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { uploadFormAction } from './actions'
import { type SopFormFile } from '@/data/forms-data'

interface SopFormUploadModalProps {
    targetFileName?: string
    onClose: () => void
    onUploaded: (newForm: SopFormFile) => void
}

export function SopFormUploadModal({ targetFileName, onClose, onUploaded }: SopFormUploadModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [customName, setCustomName] = useState(targetFileName || '')
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setSelectedFile(file)
            if (!customName) {
                setCustomName(file.name)
            }
        }
    }

    const handleUpload = async () => {
        if (!selectedFile) {
            setError('Vui lòng chọn tệp tin (.xlsx, .docx, .pdf)')
            return
        }

        try {
            setUploading(true)
            setError(null)

            const formData = new FormData()
            formData.append('file', selectedFile)
            formData.append('targetFileName', customName || selectedFile.name)

            const res = await uploadFormAction(formData)
            if (res.success && res.data) {
                setSuccess(true)
                setTimeout(() => {
                    onUploaded(res.data!)
                    onClose()
                }, 1000)
            } else {
                setError(res.error || 'Lỗi khi tải lên biểu mẫu')
            }
        } catch (err: any) {
            setError(err?.message || 'Lỗi kết nối')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-auto overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400">
                            <Upload className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                {targetFileName ? 'Thay Thế Biểu Mẫu' : 'Tải Lên Biểu Mẫu Mới'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {targetFileName ? `Cập nhật tệp: ${targetFileName}` : 'Thêm biểu mẫu vào thư viện SOP'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="p-4 bg-emerald-50 border-b border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>Tải lên và thay thế biểu mẫu thành công! Web đã tự cập nhật.</span>
                    </div>
                )}

                {/* Body */}
                <div className="p-6 space-y-4 text-xs">
                    {/* File Picker Drag & Drop */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-rose-500 dark:hover:border-rose-500 transition space-y-2 bg-slate-50/50 dark:bg-slate-800/30"
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.docx,.doc,.pdf"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        {selectedFile ? (
                            <div className="space-y-1">
                                <FileSpreadsheet className="w-10 h-10 text-emerald-600 mx-auto" />
                                <div className="font-bold text-slate-900 dark:text-white text-sm">
                                    {selectedFile.name}
                                </div>
                                <div className="text-slate-500">
                                    {(selectedFile.size / 1024).toFixed(1)} KB • Bấm để chọn tệp khác
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                                <div className="font-semibold text-slate-700 dark:text-slate-200">
                                    Nhấp để chọn tệp từ máy tính
                                </div>
                                <div className="text-slate-400 text-[11px]">
                                    Hỗ trợ định dạng: .XLSX, .DOCX, .PDF (Excel, Word biểu mẫu)
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Target file name */}
                    <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-slate-300">
                            Tên Lưu Trữ Trên Hệ Thống (File Name)
                        </label>
                        <input
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder="Ví dụ: Form_8.8-A_Yeu_cau_Tao_ma_KH.xlsx"
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                        <p className="text-[11px] text-slate-400">
                            Tệp này sẽ được lưu vào thư mục tải về của hệ thống. Nhân viên bấm tải sẽ nhận tệp này.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center text-xs">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading || !selectedFile}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold transition shadow-sm disabled:opacity-50"
                    >
                        <Upload className="w-4 h-4" />
                        <span>{uploading ? 'Đang Tải Lên...' : 'Xác Nhận Tải Lên Web'}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
