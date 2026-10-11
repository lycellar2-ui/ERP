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
    AlertCircle
} from 'lucide-react'
import { MarkdownViewer } from '@/components/ui/MarkdownViewer'

interface MarkdownDocModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    docUrl?: string
    fileName?: string
    rawContent?: string
}

export function MarkdownDocModal({
    isOpen,
    onClose,
    title,
    docUrl,
    fileName,
    rawContent
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

        if (docUrl) {
            setLoading(true)
            setError(null)
            fetch(docUrl, { cache: 'no-store' })
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`Không thể tải tệp (Mã lỗi: ${res.status})`)
                    }
                    return res.text()
                })
                .then(text => {
                    setContent(text)
                    setLoading(false)
                })
                .catch(err => {
                    console.error('Lỗi khi tải tài liệu markdown:', err)
                    setError('Không thể tải nội dung tài liệu. Vui lòng kiểm tra lại kết nối hoặc tệp tin.')
                    setLoading(false)
                })
        }
    }, [isOpen, docUrl, rawContent])

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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
            <div
                className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[92vh] overflow-hidden"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 flex-shrink-0">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div className="overflow-hidden">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                    MARKDOWN
                                </span>
                                {fileName && (
                                    <span className="text-xs text-slate-500 truncate max-w-xs">
                                        {fileName}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                                {title}
                            </h2>
                        </div>
                    </div>

                    {/* Toolbar Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                            onClick={handleCopy}
                            disabled={loading || !content}
                            title="Sao chép nội dung văn bản"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition disabled:opacity-50"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="hidden sm:inline text-emerald-600 font-bold">Đã chép</span>
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
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition disabled:opacity-50"
                        >
                            <Printer className="w-4 h-4 text-slate-500" />
                        </button>

                        {docUrl && (
                            <a
                                href={docUrl}
                                download={fileName || 'tai_lieu.md'}
                                title="Tải về tệp .md gốc"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shadow-sm transition"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Tải về</span>
                            </a>
                        )}

                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition ml-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-900">
                    {loading && (
                        <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-500">
                            <RefreshCw className="w-8 h-8 animate-spin text-rose-600" />
                            <div className="text-xs">Đang tải và định dạng tài liệu...</div>
                        </div>
                    )}

                    {error && (
                        <div className="p-6 text-center rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 space-y-3">
                            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                            <div className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                                {error}
                            </div>
                            {docUrl && (
                                <button
                                    onClick={() => {
                                        setLoading(true)
                                        setError(null)
                                        fetch(docUrl, { cache: 'no-store' })
                                            .then(r => r.text())
                                            .then(t => {
                                                setContent(t)
                                                setLoading(false)
                                            })
                                            .catch(() => {
                                                setError('Tải lại thất bại. Vui lòng thử lại sau.')
                                                setLoading(false)
                                            })
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-semibold hover:bg-rose-800 transition"
                                >
                                    Thử lại
                                </button>
                            )}
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
