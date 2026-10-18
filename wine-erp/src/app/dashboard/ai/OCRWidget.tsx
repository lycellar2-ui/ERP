'use client'

import { useState, useRef, useCallback } from 'react'
import { FileText, Upload, Loader2, CheckCircle2, X, AlertCircle, Copy, ArrowRight, Ship } from 'lucide-react'
import { ocrCustomsDeclaration, ocrLogisticsInvoice, type OCRDeclarationResult, type OCRLogisticsResult } from './actions'
import { useAppLocale } from '@/lib/i18n'
import { getAiI18n } from './i18n'

type OCRMode = 'customs' | 'logistics'

export function OCRUploadWidget() {
    const { locale } = useAppLocale()
    const t = getAiI18n(locale).ocr
    const [mode, setMode] = useState<OCRMode>('customs')
    const [file, setFile] = useState<File | null>(null)
    const [dragging, setDragging] = useState(false)
    const [loading, setLoading] = useState(false)
    const [extractedText, setExtractedText] = useState('')
    const [customsResult, setCustomsResult] = useState<OCRDeclarationResult | null>(null)
    const [logisticsResult, setLogisticsResult] = useState<OCRLogisticsResult | null>(null)
    const [error, setError] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const resetState = () => {
        setFile(null)
        setExtractedText('')
        setCustomsResult(null)
        setLogisticsResult(null)
        setError('')
    }

    const handleFile = useCallback((f: File) => {
        if (!f.type.includes('pdf') && !f.type.includes('image') && !f.type.includes('text')) {
            setError(locale === 'en' ? 'Only PDF, image, or text files are supported' : 'Chỉ hỗ trợ PDF, ảnh hoặc file text')
            return
        }
        if (f.size > 10 * 1024 * 1024) {
            setError(locale === 'en' ? 'File too large (max 10MB)' : 'File quá lớn (tối đa 10MB)')
            return
        }
        setFile(f)
        setError('')
        setCustomsResult(null)
        setLogisticsResult(null)
    }, [locale])

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) handleFile(f)
    }

    const handleExtract = async () => {
        if (!file) return
        setLoading(true)
        setError('')

        try {
            let text = ''
            if (file.type.includes('text')) {
                text = await file.text()
            } else {
                text = await file.text().catch(() => '')
                if (!text.trim()) {
                    text = `[File: ${file.name}] — Google Vision API`
                }
            }

            setExtractedText(text)

            if (mode === 'customs') {
                const result = await ocrCustomsDeclaration(text)
                setCustomsResult(result)
            } else {
                const result = await ocrLogisticsInvoice(text)
                setLogisticsResult(result)
            }
        } catch (err: any) {
            setError(err.message || 'OCR Error')
        }
        setLoading(false)
    }

    const handleManualProcess = async () => {
        if (!extractedText.trim()) return
        setLoading(true)
        setError('')
        try {
            if (mode === 'customs') {
                const result = await ocrCustomsDeclaration(extractedText)
                setCustomsResult(result)
            } else {
                const result = await ocrLogisticsInvoice(extractedText)
                setLogisticsResult(result)
            }
        } catch (err: any) {
            setError(err.message || 'OCR Error')
        }
        setLoading(false)
    }

    const inputStyle = { background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', borderRadius: '8px' }
    const hasResult = customsResult || logisticsResult

    return (
        <div className="p-5 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(8, 145, 178, 0.08)' }}>
                        <FileText size={16} style={{ color: '#0891B2' }} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>{t.title}</h3>
                        <p className="text-xs" style={{ color: '#64748B' }}>{t.subtitle}</p>
                    </div>
                </div>
                {hasResult && (
                    <button onClick={resetState} className="inline-block text-xs px-2 py-1 rounded whitespace-nowrap shrink-0" style={{ color: '#64748B' }}>
                        <X size={14} className="inline mr-1" />{t.resetBtn}
                    </button>
                )}
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
                {([
                    { key: 'customs' as OCRMode, label: t.customsTab, icon: FileText, desc: t.customsDesc },
                    { key: 'logistics' as OCRMode, label: t.logisticsTab, icon: Ship, desc: t.logisticsDesc },
                ] as const).map(m => {
                    const IconComp = m.icon
                    return (
                        <button key={m.key} onClick={() => { setMode(m.key); resetState() }}
                            className="flex-1 p-3 rounded-lg text-left transition-all"
                            style={{
                                background: mode === m.key ? 'rgba(8,145,178,0.08)' : '#FFFFFF',
                                border: `1px solid ${mode === m.key ? 'rgba(8, 145, 178, 0.25)' : '#E2E8F0'}`,
                            }}>
                            <span className="text-sm font-semibold flex items-center gap-1.5 mb-0.5" style={{ color: mode === m.key ? '#0E7490' : '#475569' }}>
                                <IconComp size={14} />
                                {m.label}
                            </span>
                            <span className="text-[10px]" style={{ color: '#64748B' }}>{m.desc}</span>
                        </button>
                    )
                })}
            </div>

            {!hasResult ? (
                <>
                    {/* Drop Zone */}
                    <div
                        onDragOver={e => { e.preventDefault(); setDragging(true) }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className="relative rounded-lg cursor-pointer transition-all"
                        style={{
                            background: dragging ? 'rgba(8,145,178,0.06)' : '#FFFFFF',
                            border: `2px dashed ${dragging ? '#0E7490' : file ? '#15803D' : '#E2E8F0'}`,
                            padding: file ? '12px 16px' : '24px 16px',
                        }}>
                        <input ref={fileInputRef} type="file" accept=".pdf,.txt,.png,.jpg,.jpeg" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                        {file ? (
                            <div className="flex items-center gap-3">
                                <FileText size={20} style={{ color: '#15803D' }} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{file.name}</p>
                                    <p className="text-xs" style={{ color: '#64748B' }}>{(file.size / 1024).toFixed(0)} KB</p>
                                </div>
                                <button onClick={e => { e.stopPropagation(); setFile(null) }}
                                    className="p-1 rounded" style={{ color: '#64748B' }}><X size={14} /></button>
                            </div>
                        ) : (
                            <div className="text-center">
                                <Upload size={28} className="mx-auto mb-2" style={{ color: dragging ? '#0E7490' : '#E2E8F0' }} />
                                <p className="text-sm font-semibold" style={{ color: '#475569' }}>
                                    {t.dropHere}
                                </p>
                                <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                                    {t.dropHint}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Text Input Area */}
                    <div className="mt-3">
                        <label className="text-xs font-semibold block mb-1" style={{ color: '#64748B' }}>
                            {t.pasteLabel}
                        </label>
                        <textarea
                            value={extractedText}
                            onChange={e => setExtractedText(e.target.value)}
                            placeholder={mode === 'customs' ? t.customsPlaceholder : t.logisticsPlaceholder}
                            rows={4}
                            className="w-full px-3 py-2 text-sm outline-none resize-none"
                            style={inputStyle} />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 mt-3 text-xs p-2 rounded"
                            style={{ background: 'rgba(185,28,28,0.08)', color: '#B91C1C', border: '1px solid rgba(185,28,28,0.2)' }}>
                            <AlertCircle size={12} /> {error}
                        </div>
                    )}

                    {/* Process Button */}
                    <button onClick={file ? handleExtract : handleManualProcess}
                        disabled={loading || (!file && !extractedText.trim())}
                        className="w-full flex items-center justify-center gap-2 mt-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-all"
                        style={{ background: '#0E7490', color: '#FFFFFF' }}>
                        {loading
                            ? <><Loader2 size={14} className="animate-spin" /> {t.processingBtn}</>
                            : <><ArrowRight size={14} /> {t.extractBtn}</>}
                    </button>
                </>
            ) : (
                /* Results Display */
                <div className="space-y-3">
                    {customsResult && <CustomsResultView result={customsResult} />}
                    {logisticsResult && <LogisticsResultView result={logisticsResult} />}
                </div>
            )}
        </div>
    )
}

function CustomsResultView({ result }: { result: OCRDeclarationResult }) {
    const { locale, formatCurrency } = useAppLocale()
    const t = getAiI18n(locale).ocr

    if (!result.success) {
        return (
            <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(185,28,28,0.08)', color: '#B91C1C', border: '1px solid rgba(185,28,28,0.2)' }}>
                <AlertCircle size={14} className="inline mr-1" /> {result.error}
            </div>
        )
    }

    const fields = [
        { label: t.fields.declarationNo, value: result.declarationNo, mono: true },
        { label: t.fields.date, value: result.date },
        { label: t.fields.importerName, value: result.importerName },
        { label: t.fields.hsCode, value: result.hsCode, mono: true },
        { label: t.fields.cifValue, value: result.cifValue ? `${result.cifValue.toLocaleString()} ${result.cifCurrency ?? 'USD'}` : undefined, mono: true },
        { label: t.fields.importTax, value: result.importTax ? formatCurrency(result.importTax) : undefined, color: '#B45309' },
        { label: t.fields.sct, value: result.specialConsumptionTax ? formatCurrency(result.specialConsumptionTax) : undefined, color: '#B45309' },
        { label: t.fields.vat, value: result.vatTax ? formatCurrency(result.vatTax) : undefined, color: '#B45309' },
        { label: t.fields.totalTax, value: result.totalTaxPayable ? formatCurrency(result.totalTaxPayable) : undefined, color: '#B91C1C', bold: true },
    ].filter(f => f.value)

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} style={{ color: '#15803D' }} />
                <span className="text-sm font-semibold" style={{ color: '#15803D' }}>{t.customsSuccess}</span>
            </div>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                {fields.map((f, i) => (
                    <div key={f.label} className="flex items-center justify-between px-4 py-2.5"
                        style={{
                            background: '#FFFFFF',
                            borderBottom: i < fields.length - 1 ? '1px solid #E2E8F0' : undefined,
                        }}>
                        <span className="text-xs" style={{ color: '#64748B' }}>{f.label}</span>
                        <span className="text-sm font-semibold" style={{ color: (f as any).color ?? '#0F172A', fontWeight: (f as any).bold ? 700 : undefined }}>
                            {f.value}
                        </span>
                    </div>
                ))}
            </div>
            <p className="text-[10px] text-center" style={{ color: '#64748B' }}>
                {t.disclaimer}
            </p>
        </div>
    )
}

function LogisticsResultView({ result }: { result: OCRLogisticsResult }) {
    const { locale } = useAppLocale()
    const t = getAiI18n(locale).ocr

    if (!result.success) {
        return (
            <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(185,28,28,0.08)', color: '#B91C1C', border: '1px solid rgba(185,28,28,0.2)' }}>
                <AlertCircle size={14} className="inline mr-1" /> {result.error}
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} style={{ color: '#15803D' }} />
                <span className="text-sm font-semibold" style={{ color: '#15803D' }}>{t.logisticsSuccess}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {result.invoiceNo && (
                    <div className="p-3 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>{t.invoiceNo}</p>
                        <p className="text-sm font-bold" style={{ color: '#0F172A' }}>{result.invoiceNo}</p>
                    </div>
                )}
                {result.supplierName && (
                    <div className="p-3 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>{t.supplierName}</p>
                        <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{result.supplierName}</p>
                    </div>
                )}
            </div>

            {result.costItems && result.costItems.length > 0 && (
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                    <div className="px-4 py-2" style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                        <span className="text-xs font-semibold uppercase" style={{ color: '#64748B' }}>{t.costDetails}</span>
                    </div>
                    {result.costItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5"
                            style={{
                                background: '#FFFFFF',
                                borderBottom: i < result.costItems!.length - 1 ? '1px solid #E2E8F0' : undefined,
                            }}>
                            <span className="text-xs" style={{ color: '#475569' }}>{item.description}</span>
                            <span className="text-sm font-bold" style={{ color: '#B45309' }}>
                                {item.amount.toLocaleString()} {item.currency}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {result.totalAmount != null && (
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(8,145,178,0.08)', border: '1px solid rgba(8, 145, 178, 0.15)' }}>
                    <span className="text-xs font-semibold" style={{ color: '#0891B2' }}>{t.totalLabel}</span>
                    <span className="text-lg font-bold" style={{ color: '#0891B2' }}>
                        {result.totalAmount.toLocaleString()} USD
                    </span>
                </div>
            )}

            <p className="text-[10px] text-center" style={{ color: '#64748B' }}>
                {t.disclaimer}
            </p>
        </div>
    )
}
