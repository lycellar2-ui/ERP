'use client'

import { useState, useRef, useCallback } from 'react'
import { FileText, Upload, Loader2, CheckCircle2, X, AlertCircle, Copy, ArrowRight } from 'lucide-react'
import { ocrCustomsDeclaration, ocrLogisticsInvoice, type OCRDeclarationResult, type OCRLogisticsResult } from './actions'
import { formatVND } from '@/lib/utils'

type OCRMode = 'customs' | 'logistics'

export function OCRUploadWidget() {
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
            setError('Chỉ hỗ trợ PDF, ảnh hoặc file text')
            return
        }
        if (f.size > 10 * 1024 * 1024) {
            setError('File quá lớn (tối đa 10MB)')
            return
        }
        setFile(f)
        setError('')
        setCustomsResult(null)
        setLogisticsResult(null)
    }, [])

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
            // Read file as text (for demo - real OCR would use Vision API)
            let text = ''
            if (file.type.includes('text')) {
                text = await file.text()
            } else {
                // For PDF/image, we simulate reading text content
                // In production, this would call Google Vision API
                text = await file.text().catch(() => '')
                if (!text.trim()) {
                    text = `[File: ${file.name}] — Nội dung sẽ được xử lý bởi Google Vision API. Vui lòng paste nội dung text bên dưới nếu muốn test OCR.`
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
            setError(err.message || 'Lỗi xử lý OCR')
        }
        setLoading(false)
    }

    // Manual text input mode
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
            setError(err.message || 'Lỗi xử lý OCR')
        }
        setLoading(false)
    }

    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '8px' }
    const hasResult = customsResult || logisticsResult

    return (
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(135,203,185,0.15)' }}>
                        <FileText size={16} style={{ color: '#87CBB9' }} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm" style={{ color: '#E8F1F2' }}>OCR — Đọc Tờ Khai / Invoice</h3>
                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Upload PDF hoặc paste nội dung → trích xuất tự động</p>
                    </div>
                </div>
                {hasResult && (
                    <button onClick={resetState} className="text-xs px-2 py-1 rounded" style={{ color: '#4A6A7A' }}>
                        <X size={14} className="inline mr-1" />Làm Mới
                    </button>
                )}
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
                {([
                    { key: 'customs' as OCRMode, label: '📄 Tờ Khai HQ', desc: 'Hải quan NK' },
                    { key: 'logistics' as OCRMode, label: '🚢 Invoice Logistics', desc: 'Forwarder' },
                ] as const).map(m => (
                    <button key={m.key} onClick={() => { setMode(m.key); resetState() }}
                        className="flex-1 p-3 rounded-lg text-left transition-all"
                        style={{
                            background: mode === m.key ? 'rgba(135,203,185,0.08)' : '#142433',
                            border: `1px solid ${mode === m.key ? 'rgba(135,203,185,0.3)' : '#2A4355'}`,
                        }}>
                        <span className="text-sm font-semibold block" style={{ color: mode === m.key ? '#87CBB9' : '#8AAEBB' }}>
                            {m.label}
                        </span>
                        <span className="text-[10px]" style={{ color: '#4A6A7A' }}>{m.desc}</span>
                    </button>
                ))}
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
                            background: dragging ? 'rgba(135,203,185,0.06)' : '#142433',
                            border: `2px dashed ${dragging ? '#87CBB9' : file ? '#5BA88A' : '#2A4355'}`,
                            padding: file ? '12px 16px' : '24px 16px',
                        }}>
                        <input ref={fileInputRef} type="file" accept=".pdf,.txt,.png,.jpg,.jpeg" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                        {file ? (
                            <div className="flex items-center gap-3">
                                <FileText size={20} style={{ color: '#5BA88A' }} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate" style={{ color: '#E8F1F2' }}>{file.name}</p>
                                    <p className="text-xs" style={{ color: '#4A6A7A' }}>{(file.size / 1024).toFixed(0)} KB</p>
                                </div>
                                <button onClick={e => { e.stopPropagation(); setFile(null) }}
                                    className="p-1 rounded" style={{ color: '#4A6A7A' }}><X size={14} /></button>
                            </div>
                        ) : (
                            <div className="text-center">
                                <Upload size={28} className="mx-auto mb-2" style={{ color: dragging ? '#87CBB9' : '#2A4355' }} />
                                <p className="text-sm font-semibold" style={{ color: '#8AAEBB' }}>
                                    Kéo thả file vào đây
                                </p>
                                <p className="text-xs mt-1" style={{ color: '#4A6A7A' }}>
                                    Hỗ trợ: PDF, ảnh (PNG/JPG), text • Tối đa 10MB
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Text Input Area */}
                    <div className="mt-3">
                        <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>
                            Hoặc paste nội dung text trực tiếp:
                        </label>
                        <textarea
                            value={extractedText}
                            onChange={e => setExtractedText(e.target.value)}
                            placeholder={mode === 'customs'
                                ? 'Paste nội dung tờ khai hải quan...\nVD: Số TK: 103210000123/A12, CIF: 15,000 USD...'
                                : 'Paste nội dung invoice logistics...\nVD: Invoice No: INV-2026-001, Total: 2,500 USD...'}
                            rows={4}
                            className="w-full px-3 py-2 text-sm outline-none resize-none"
                            style={inputStyle} />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 mt-3 text-xs p-2 rounded"
                            style={{ background: 'rgba(224,82,82,0.08)', color: '#E05252', border: '1px solid rgba(224,82,82,0.2)' }}>
                            <AlertCircle size={12} /> {error}
                        </div>
                    )}

                    {/* Process Button */}
                    <button onClick={file ? handleExtract : handleManualProcess}
                        disabled={loading || (!file && !extractedText.trim())}
                        className="w-full flex items-center justify-center gap-2 mt-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-all"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        {loading
                            ? <><Loader2 size={14} className="animate-spin" /> Đang xử lý OCR...</>
                            : <><ArrowRight size={14} /> Trích Xuất Dữ Liệu</>}
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

// ── Customs Declaration Result ──────────────
function CustomsResultView({ result }: { result: OCRDeclarationResult }) {
    if (!result.success) {
        return (
            <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(224,82,82,0.08)', color: '#E05252', border: '1px solid rgba(224,82,82,0.2)' }}>
                <AlertCircle size={14} className="inline mr-1" /> Lỗi: {result.error}
            </div>
        )
    }

    const fields = [
        { label: 'Số Tờ Khai', value: result.declarationNo, mono: true },
        { label: 'Ngày', value: result.date },
        { label: 'Nhà Nhập Khẩu', value: result.importerName },
        { label: 'HS Code', value: result.hsCode, mono: true },
        { label: 'Trị Giá CIF', value: result.cifValue ? `${result.cifValue.toLocaleString()} ${result.cifCurrency ?? 'USD'}` : undefined, mono: true },
        { label: 'Thuế Nhập Khẩu', value: result.importTax ? formatVND(result.importTax) : undefined, color: '#D4A853' },
        { label: 'Thuế TTĐB', value: result.specialConsumptionTax ? formatVND(result.specialConsumptionTax) : undefined, color: '#D4A853' },
        { label: 'Thuế GTGT', value: result.vatTax ? formatVND(result.vatTax) : undefined, color: '#D4A853' },
        { label: 'Tổng Thuế Phải Nộp', value: result.totalTaxPayable ? formatVND(result.totalTaxPayable) : undefined, color: '#E05252', bold: true },
    ].filter(f => f.value)

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} style={{ color: '#5BA88A' }} />
                <span className="text-sm font-semibold" style={{ color: '#5BA88A' }}>Trích xuất thành công — Tờ Khai Hải Quan</span>
            </div>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                {fields.map((f, i) => (
                    <div key={f.label} className="flex items-center justify-between px-4 py-2.5"
                        style={{
                            background: i % 2 === 0 ? '#142433' : '#1B2E3D',
                            borderBottom: i < fields.length - 1 ? '1px solid rgba(42,67,85,0.5)' : undefined,
                        }}>
                        <span className="text-xs" style={{ color: '#4A6A7A' }}>{f.label}</span>
                        <span className="text-sm font-semibold"
                            style={{
                                color: (f as any).color ?? '#E8F1F2',
                                fontFamily: (f as any).mono ? '"DM Mono"' : undefined,
                                fontWeight: (f as any).bold ? 700 : undefined,
                            }}>
                            {f.value}
                        </span>
                    </div>
                ))}
            </div>
            <p className="text-[10px] text-center" style={{ color: '#4A6A7A' }}>
                * Kết quả mang tính tham khảo. Vui lòng kiểm tra lại trước khi import vào hệ thống.
            </p>
        </div>
    )
}

// ── Logistics Invoice Result ──────────────
function LogisticsResultView({ result }: { result: OCRLogisticsResult }) {
    if (!result.success) {
        return (
            <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(224,82,82,0.08)', color: '#E05252', border: '1px solid rgba(224,82,82,0.2)' }}>
                <AlertCircle size={14} className="inline mr-1" /> Lỗi: {result.error}
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} style={{ color: '#5BA88A' }} />
                <span className="text-sm font-semibold" style={{ color: '#5BA88A' }}>Trích xuất — Invoice Logistics</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {result.invoiceNo && (
                    <div className="p-3 rounded-lg" style={{ background: '#142433' }}>
                        <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Số Invoice</p>
                        <p className="text-sm font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{result.invoiceNo}</p>
                    </div>
                )}
                {result.supplierName && (
                    <div className="p-3 rounded-lg" style={{ background: '#142433' }}>
                        <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Nhà Cung Cấp</p>
                        <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{result.supplierName}</p>
                    </div>
                )}
            </div>

            {result.costItems && result.costItems.length > 0 && (
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    <div className="px-4 py-2" style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                        <span className="text-xs font-semibold uppercase" style={{ color: '#4A6A7A' }}>Chi Tiết Chi Phí</span>
                    </div>
                    {result.costItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5"
                            style={{
                                background: i % 2 === 0 ? '#1B2E3D' : '#142433',
                                borderBottom: i < result.costItems!.length - 1 ? '1px solid rgba(42,67,85,0.5)' : undefined,
                            }}>
                            <span className="text-xs" style={{ color: '#8AAEBB' }}>{item.description}</span>
                            <span className="text-sm font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                                {item.amount.toLocaleString()} {item.currency}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {result.totalAmount != null && (
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(135,203,185,0.08)', border: '1px solid rgba(135,203,185,0.2)' }}>
                    <span className="text-xs font-semibold" style={{ color: '#87CBB9' }}>TỔNG</span>
                    <span className="text-lg font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                        {result.totalAmount.toLocaleString()} USD
                    </span>
                </div>
            )}

            <p className="text-[10px] text-center" style={{ color: '#4A6A7A' }}>
                * Kết quả mang tính tham khảo. Kiểm tra lại trước khi import.
            </p>
        </div>
    )
}
