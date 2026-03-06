'use client'

import { useState, useCallback, useRef } from 'react'
import { X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, FileX2 } from 'lucide-react'
import * as XLSX from 'xlsx'

type ImportResult = { success: number; errors: { row: number; message: string }[]; total: number }

interface ExcelImportDialogProps {
    open: boolean
    onClose: () => void
    title: string // e.g. "Import Sản Phẩm"
    templateColumns: { header: string; sample: string; required?: boolean }[]
    templateFileName: string // e.g. "template_san_pham.xlsx"
    onImport: (rows: Record<string, any>[]) => Promise<ImportResult>
    onComplete?: () => void // Called after import finishes to reload data
}

export function ExcelImportDialog({ open, onClose, title, templateColumns, templateFileName, onImport, onComplete }: ExcelImportDialogProps) {
    const [step, setStep] = useState<'upload' | 'importing' | 'result'>('upload')
    const [fileName, setFileName] = useState('')
    const [rowCount, setRowCount] = useState(0)
    const [result, setResult] = useState<ImportResult | null>(null)
    const [dragOver, setDragOver] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const reset = () => {
        setStep('upload')
        setFileName('')
        setRowCount(0)
        setResult(null)
    }

    const handleClose = () => {
        reset()
        onClose()
    }

    // Download template
    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            templateColumns.map(c => c.header),
            templateColumns.map(c => c.sample),
        ])
        // Set column widths
        ws['!cols'] = templateColumns.map(c => ({ wch: Math.max(c.header.length, c.sample.length) + 4 }))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Template')
        XLSX.writeFile(wb, templateFileName)
    }

    // Parse file
    const processFile = useCallback(async (file: File) => {
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            alert('Chỉ chấp nhận file Excel (.xlsx, .xls)')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('File quá lớn (tối đa 5MB)')
            return
        }

        setFileName(file.name)
        setStep('importing')

        try {
            const buffer = await file.arrayBuffer()
            const workbook = XLSX.read(buffer, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const sheet = workbook.Sheets[sheetName]
            const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null })

            if (jsonRows.length === 0) {
                setResult({ success: 0, errors: [{ row: 1, message: 'File không có dữ liệu' }], total: 0 })
                setStep('result')
                return
            }

            setRowCount(jsonRows.length)
            const importResult = await onImport(jsonRows)
            setResult(importResult)
            setStep('result')

            if (importResult.success > 0) {
                onComplete?.()
            }
        } catch (err: any) {
            setResult({ success: 0, errors: [{ row: 0, message: `Lỗi đọc file: ${err.message}` }], total: 0 })
            setStep('result')
        }
    }, [onImport, onComplete])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
    }, [processFile])

    if (!open) return null

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-50 transition-opacity duration-300"
                style={{ background: 'rgba(10,5,2,0.8)' }}
                onClick={handleClose} />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
                    style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}
                    onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4"
                        style={{ borderBottom: '1px solid #2A4355' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                                style={{ background: 'rgba(74,143,171,0.15)' }}>
                                <FileSpreadsheet size={18} style={{ color: '#4A8FAB' }} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>
                                    {title}
                                </h3>
                                <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                    Tải template → Điền dữ liệu → Upload
                                </p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="p-2 rounded-lg transition-colors"
                            style={{ color: '#4A6A7A' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <X size={18} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5 space-y-5">

                        {/* Step 1: Download template */}
                        <button onClick={downloadTemplate}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group"
                            style={{ background: '#142433', border: '1px solid #2A4355' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#4A8FAB')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(74,143,171,0.12)' }}>
                                <Download size={18} style={{ color: '#4A8FAB' }} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>
                                    📥 Tải File Template
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>
                                    {templateColumns.filter(c => c.required).length} cột bắt buộc · {templateColumns.length} cột tổng · Tối đa 500 dòng
                                </p>
                            </div>
                        </button>

                        {/* Step 2: Upload zone */}
                        {step === 'upload' && (
                            <div
                                className="relative rounded-xl transition-all cursor-pointer"
                                style={{
                                    background: dragOver ? 'rgba(74,143,171,0.08)' : '#142433',
                                    border: `2px dashed ${dragOver ? '#4A8FAB' : '#2A4355'}`,
                                    padding: '2rem',
                                }}
                                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => inputRef.current?.click()}>
                                <input ref={inputRef} type="file" className="hidden"
                                    accept=".xlsx,.xls"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }} />
                                <div className="flex flex-col items-center gap-3 text-center">
                                    <Upload size={32} style={{ color: dragOver ? '#4A8FAB' : '#4A6A7A' }} />
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>
                                            Kéo thả file Excel vào đây
                                        </p>
                                        <p className="text-xs mt-1" style={{ color: '#4A6A7A' }}>
                                            hoặc click để chọn file (.xlsx, .xls) · Tối đa 5MB
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2b: Importing */}
                        {step === 'importing' && (
                            <div className="flex flex-col items-center gap-4 py-8">
                                <Loader2 size={36} className="animate-spin" style={{ color: '#4A8FAB' }} />
                                <div className="text-center">
                                    <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>
                                        Đang xử lý {fileName}...
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: '#4A6A7A' }}>
                                        Vui lòng đợi, không đóng cửa sổ
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Results */}
                        {step === 'result' && result && (
                            <div className="space-y-4">
                                {/* Summary */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-3 rounded-lg text-center" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                        <p className="text-xl font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono", monospace' }}>{result.total}</p>
                                        <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: '#4A6A7A' }}>Tổng dòng</p>
                                    </div>
                                    <div className="p-3 rounded-lg text-center" style={{ background: 'rgba(91,168,138,0.08)', border: '1px solid rgba(91,168,138,0.3)' }}>
                                        <p className="text-xl font-bold" style={{ color: '#5BA88A', fontFamily: '"DM Mono", monospace' }}>{result.success}</p>
                                        <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: '#5BA88A' }}>Thành công</p>
                                    </div>
                                    <div className="p-3 rounded-lg text-center" style={{ background: result.errors.length > 0 ? 'rgba(224,82,82,0.08)' : '#142433', border: `1px solid ${result.errors.length > 0 ? 'rgba(224,82,82,0.3)' : '#2A4355'}` }}>
                                        <p className="text-xl font-bold" style={{ color: result.errors.length > 0 ? '#E05252' : '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>{result.errors.length}</p>
                                        <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: result.errors.length > 0 ? '#E05252' : '#4A6A7A' }}>Lỗi</p>
                                    </div>
                                </div>

                                {/* Success banner */}
                                {result.success > 0 && (
                                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg"
                                        style={{ background: 'rgba(91,168,138,0.1)', border: '1px solid rgba(91,168,138,0.3)' }}>
                                        <CheckCircle2 size={16} style={{ color: '#5BA88A' }} />
                                        <span className="text-sm font-medium" style={{ color: '#5BA88A' }}>
                                            Đã import thành công {result.success}/{result.total} dòng
                                        </span>
                                    </div>
                                )}

                                {/* Error list */}
                                {result.errors.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#E05252' }}>
                                            <AlertTriangle size={12} className="inline mr-1" />
                                            Chi tiết lỗi ({result.errors.length})
                                        </p>
                                        <div className="max-h-48 overflow-y-auto rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                            {result.errors.map((err, idx) => (
                                                <div key={idx} className="flex items-start gap-3 px-4 py-2.5 text-xs"
                                                    style={{ borderBottom: idx < result.errors.length - 1 ? '1px solid #1B2E3D' : 'none' }}>
                                                    <span className="font-bold flex-shrink-0 w-14" style={{ color: '#E05252', fontFamily: '"DM Mono", monospace' }}>
                                                        {err.row > 0 ? `Dòng ${err.row}` : 'Chung'}
                                                    </span>
                                                    <span style={{ color: '#8AAEBB' }}>{err.message}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Download error report */}
                                        <button onClick={() => {
                                            const ws = XLSX.utils.json_to_sheet(result.errors.map(e => ({ 'Dòng': e.row, 'Lỗi': e.message })))
                                            const wb = XLSX.utils.book_new()
                                            XLSX.utils.book_append_sheet(wb, ws, 'Lỗi Import')
                                            XLSX.writeFile(wb, `import_errors_${Date.now()}.xlsx`)
                                        }}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                                            style={{ background: 'rgba(224,82,82,0.1)', color: '#E05252', border: '1px solid rgba(224,82,82,0.2)' }}>
                                            <FileX2 size={14} /> Tải báo cáo lỗi (.xlsx)
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4"
                        style={{ borderTop: '1px solid #2A4355' }}>
                        {step === 'result' ? (
                            <>
                                <button onClick={() => { reset() }}
                                    className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                                    style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                    Import thêm
                                </button>
                                <button onClick={handleClose}
                                    className="px-5 py-2.5 rounded-lg text-sm font-semibold"
                                    style={{ background: '#87CBB9', color: '#0A1926' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                                    Đóng
                                </button>
                            </>
                        ) : (
                            <button onClick={handleClose}
                                className="px-4 py-2.5 rounded-lg text-sm"
                                style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                Hủy
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
