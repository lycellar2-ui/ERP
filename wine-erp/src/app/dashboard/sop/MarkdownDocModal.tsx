'use client'

import React, { useState, useEffect } from 'react'
import {
    X,
    FileText,
    Download,
    Printer,
    Copy,
    Check,
    RefreshCw,
    AlertCircle,
    Calendar,
    Tag
} from 'lucide-react'
import { MarkdownViewer } from '@/components/ui/MarkdownViewer'
import { getMarkdownContentAction } from './actions'

interface MarkdownDocModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    docUrl?: string
    fileName?: string
    rawContent?: string
    relativeFilePath?: string
    version?: string
    lastUpdated?: string
    groupLabel?: string
}

export function MarkdownDocModal({
    isOpen,
    onClose,
    title,
    docUrl,
    fileName,
    rawContent,
    relativeFilePath,
    version,
    lastUpdated,
    groupLabel
}: MarkdownDocModalProps) {
    const [content, setContent] = useState<string>(rawContent || '')
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState<boolean>(false)

    useEffect(() => {
        if (!isOpen) return

        if (rawContent) {
            setContent(rawContent)
            setLoading(false)
            setError(null)
            return
        }

        async function loadContent() {
            setLoading(true)
            setError(null)

            // Try server action first if relativeFilePath is provided
            if (relativeFilePath) {
                try {
                    const res = await getMarkdownContentAction(relativeFilePath)
                    if (res.success && res.content) {
                        setContent(res.content)
                        setLoading(false)
                        return
                    }
                } catch (err) {
                    console.error('Lỗi khi đọc markdown từ server action:', err)
                }
            }

            // Fallback to fetch via docUrl
            if (docUrl) {
                try {
                    const res = await fetch(docUrl, { cache: 'no-store' })
                    if (!res.ok) {
                        throw new Error(`Mã lỗi HTTP ${res.status}`)
                    }
                    const text = await res.text()
                    setContent(text)
                    setLoading(false)
                    return
                } catch (err: any) {
                    console.error('Lỗi fetch markdown:', err)
                    setError('Không thể tải nội dung tài liệu. Vui lòng thử lại.')
                    setLoading(false)
                    return
                }
            }

            setError('Không xác định được đường dẫn tài liệu.')
            setLoading(false)
        }

        loadContent()
    }, [isOpen, docUrl, rawContent, relativeFilePath])

    if (!isOpen) return null

    const handleCopy = () => {
        if (!content) return
        navigator.clipboard.writeText(content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center p-3 sm:p-6 animate-in fade-in duration-150">
            <div
                className="bg-white w-full max-w-4xl rounded-lg shadow-2xl border border-slate-200 flex flex-col my-auto max-h-[92vh] overflow-hidden"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 overflow-hidden">
                        <div className="p-2 rounded-lg bg-slate-200 text-slate-700 flex-shrink-0 mt-0.5">
                            <FileText className="w-4 h-4" />
                        </div>
                        <div className="overflow-hidden">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                {groupLabel && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200/80 text-slate-700 border border-slate-300/60">
                                        {groupLabel}
                                    </span>
                                )}
                                {version && (
                                    <span className="text-[11px] text-slate-500 font-medium">
                                        Phiên bản {version}
                                    </span>
                                )}
                                {lastUpdated && (
                                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-slate-400" />
                                        {lastUpdated}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                                {title}
                            </h2>
                            {fileName && (
                                <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                                    {fileName}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Toolbar Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                            onClick={handleCopy}
                            disabled={loading || !content}
                            title="Sao chép nội dung văn bản"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition disabled:opacity-50"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="hidden sm:inline text-emerald-600 font-semibold">Đã chép</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="hidden sm:inline">Sao chép</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={handlePrint}
                            disabled={loading || !content}
                            title="In tài liệu này"
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition disabled:opacity-50"
                        >
                            <Printer className="w-4 h-4 text-slate-500" />
                        </button>

                        {docUrl && (
                            <a
                                href={docUrl}
                                download={fileName || 'tai_lieu.md'}
                                title="Tải về tệp .md gốc"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Tải về</span>
                            </a>
                        )}

                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ml-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-5 sm:p-8 overflow-y-auto flex-1 bg-white">
                    {loading && (
                        <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-500">
                            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                            <div className="text-xs">Đang tải và định dạng văn bản...</div>
                        </div>
                    )}

                    {error && (
                        <div className="p-6 text-center rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                            <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
                            <div className="text-sm font-semibold text-slate-800">
                                {error}
                            </div>
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="max-w-3xl mx-auto">
                            <MarkdownViewer content={content} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
