'use client'

import React, { useState } from 'react'
import { X, Upload, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createEmployeeDocument, uploadHrDocumentFile } from './actions'
import { useAppLocale } from '@/lib/i18n'
import { HR_I18N } from './i18n'

interface Props {
    employeeId: string
    employeeName: string
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

const DOC_TYPE_KEYS = ['CONTRACT', 'NATIONAL_ID', 'DEGREE_CERT', 'HEALTH_CERT', 'CV', 'OTHER'] as const

export function DocumentUploadModal({ employeeId, employeeName, isOpen, onClose, onSuccess }: Props) {
    const { locale } = useAppLocale()
    const i18n = HR_I18N[locale]

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
                toast.error(i18n.errFileTooLarge)
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
            toast.error(i18n.errFileRequired)
            return
        }
        if (!title.trim()) {
            toast.error(i18n.errDocTitleRequired)
            return
        }

        setIsUploading(true)
        try {
            // 1. Upload to Supabase Storage
            const formData = new FormData()
            formData.append('file', file)

            const uploadRes = await uploadHrDocumentFile(formData)
            if (!uploadRes.success || !uploadRes.url) {
                throw new Error(uploadRes.error || i18n.errUploadFailed)
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
                throw new Error(i18n.errSaveDocFailed)
            }

            toast.success(i18n.uploadDocSuccess)
            onSuccess()
            onClose()
        } catch (err: any) {
            console.error('Upload document error:', err)
            toast.error(err.message || i18n.errSaveDocFailed)
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="relative w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/50">
                    <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-[#0891B2]" />
                            {i18n.uploadModalTitle}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">{i18n.uploadModalEmpPrefix} <span className="font-semibold text-slate-900">{employeeName}</span></p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* File Dropzone */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            {i18n.lblSelectDocFile} <span className="text-rose-700">*</span>
                        </label>
                        <div className="relative flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 hover:border-[#0E7490] rounded-lg bg-slate-50 hover:bg-slate-100/80 transition-colors">
                            <input
                                type="file"
                                accept=".pdf,image/jpeg,image/png,image/webp"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={isUploading}
                            />
                            {file ? (
                                <div className="flex items-center gap-3 text-left">
                                    <div className="p-2.5 rounded-lg bg-[#0E7490]/20 text-[#0891B2]">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-semibold text-slate-900 truncate max-w-[280px]">{file.name}</p>
                                        <p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <Upload className="w-8 h-8 text-[#0891B2] mx-auto mb-2 opacity-80" />
                                    <p className="text-xs font-medium text-slate-900">{i18n.dropzonePrompt1} <span className="text-[#0891B2] underline">{i18n.dropzonePromptLink}</span></p>
                                    <p className="text-[11px] text-slate-600 mt-1">{i18n.dropzoneSub}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Doc Type & Title */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                {i18n.lblDocType} <span className="text-rose-700">*</span>
                            </label>
                            <select
                                value={docType}
                                onChange={e => setDocType(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                            >
                                {DOC_TYPE_KEYS.map(k => (
                                    <option key={k} value={k}>{i18n.docTypes[k]}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                {i18n.lblDocCode}
                            </label>
                            <input
                                type="text"
                                placeholder={i18n.phDocCode}
                                value={docNumber}
                                onChange={e => setDocNumber(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            {i18n.lblDocTitle} <span className="text-rose-700">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder={i18n.phDocTitle}
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                        />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                                {i18n.lblDocIssueDate}
                            </label>
                            <input
                                type="date"
                                value={issueDate}
                                onChange={e => setIssueDate(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-semibold text-slate-600">
                                    {i18n.lblDocExpiryDate}
                                </label>
                                <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={hasNoExpiry}
                                        onChange={e => setHasNoExpiry(e.target.checked)}
                                        className="rounded border-slate-200 bg-white text-[#0891B2] focus:ring-0"
                                    />
                                    {i18n.noExpiryText}
                                </label>
                            </div>
                            <input
                                type="date"
                                value={expiryDate}
                                onChange={e => setExpiryDate(e.target.value)}
                                disabled={hasNoExpiry}
                                className={`w-full px-3 py-2 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490] ${hasNoExpiry ? 'opacity-40 cursor-not-allowed' : ''}`}
                            />
                        </div>
                    </div>

                    {/* Expiry Warning Note */}
                    {!hasNoExpiry && expiryDate && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-xs font-medium">
                            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                            <span>{i18n.docExpiryWarnNote}</span>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                            {i18n.lblInternalNotes}
                        </label>
                        <textarea
                            rows={2}
                            placeholder={i18n.phDocNotes}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490] resize-none"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isUploading}
                            className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 bg-white hover:bg-[#E2E8F0] transition-colors"
                        >
                            {i18n.btnCancel}
                        </button>
                        <button
                            type="submit"
                            disabled={isUploading || !file}
                            className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg bg-[#0E7490] text-white hover:bg-[#68B9A5] transition-all disabled:opacity-50 cursor-pointer"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {i18n.btnUploading}
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    {i18n.btnSaveDoc}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
