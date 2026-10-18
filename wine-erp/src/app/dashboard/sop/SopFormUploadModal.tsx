'use client'

import React, { useState, useRef } from 'react'
import { X, Upload, FileText, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { uploadFormAction } from './actions'
import { type SopFormFile } from '@/data/forms-data'
import { useAppLocale } from '@/lib/i18n'
import { getSopI18n } from './i18n'

interface SopFormUploadModalProps {
    targetFileName?: string
    onClose: () => void
    onUploaded: (newForm: SopFormFile) => void
}

export function SopFormUploadModal({ targetFileName, onClose, onUploaded }: SopFormUploadModalProps) {
    const { locale } = useAppLocale()
    const t = getSopI18n(locale).uploadModal
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
            setError(t.selectFileErr)
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
                setError(res.error || 'Error')
            }
        } catch (err: any) {
            setError(err?.message || 'Error')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-lg shadow-2xl border border-slate-200 flex flex-col my-auto overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
                            <Upload className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900">
                                {targetFileName ? t.replaceTitle : t.newTitle}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {targetFileName ? t.replaceDesc(targetFileName) : t.newDesc}
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
                        <span>{t.uploadSuccess}</span>
                    </div>
                )}

                {/* Body */}
                <div className="p-6 space-y-4 text-xs">
                    {/* File Picker Drag & Drop */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-rose-500 transition space-y-2 bg-slate-50/50"
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
                                <div className="font-bold text-slate-900 text-sm">
                                    {selectedFile.name}
                                </div>
                                <div className="text-slate-500">
                                    {(selectedFile.size / 1024).toFixed(1)} KB • {t.clickAnotherFile}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                                <div className="font-semibold text-slate-700">
                                    {t.clickToSelect}
                                </div>
                                <div className="text-slate-400 text-[11px]">
                                    {t.supportedFormats}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Target file name */}
                    <div className="space-y-1">
                        <label className="font-semibold text-slate-700">
                            {t.fileNameLabel}
                        </label>
                        <input
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder="Form_8.8-A_Yeu_cau_Tao_ma_KH.xlsx"
                            className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                        />
                        <p className="text-[11px] text-slate-400">
                            {t.fileNameHint}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium"
                    >
                        {t.cancelBtn}
                    </button>
                    <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading || !selectedFile}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold transition shadow-sm disabled:opacity-50"
                    >
                        <Upload className="w-4 h-4" />
                        <span>{uploading ? t.uploadingBtn : t.confirmBtn}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
