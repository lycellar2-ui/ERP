'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Upload,
    Download,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ChevronDown,
    ChevronRight,
    RotateCcw,
    ArrowRightLeft,
    Building2,
    FileSpreadsheet,
    X,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatVND, formatDate } from '@/lib/utils'
import { useAppLocale } from '@/lib/i18n'
import {
    ParentPaymentPreviewRow,
    ParentPaymentBatchRow,
    downloadParentPaymentTemplate,
    previewParentPaymentImport,
    commitParentPaymentImport,
    getParentPaymentBatches,
    allocateUnallocatedBatch,
    reverseParentPaymentBatch,
} from './actions-parent-payment'

const BATCH_STATUS: Record<string, { label: string; labelEn: string; color: string }> = {
    POSTED: { label: 'Đã Phân Bổ Đủ', labelEn: 'Allocated', color: '#15803D' },
    PARTIALLY_ALLOCATED: { label: 'Còn Tiền Dư', labelEn: 'Partial / Advance', color: '#B45309' },
    REVERSED: { label: 'Đã Hoàn Tác', labelEn: 'Reversed', color: '#64748B' },
}

export function ParentPaymentImportTab({ onDataChanged }: { onDataChanged?: () => void }) {
    const { isEn } = useAppLocale()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [downloading, setDownloading] = useState(false)
    const [parsing, setParsing] = useState(false)
    const [committing, setCommitting] = useState(false)
    const [fileName, setFileName] = useState<string | null>(null)
    const [previewRows, setPreviewRows] = useState<ParentPaymentPreviewRow[] | null>(null)
    const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set())
    const [expandedPreview, setExpandedPreview] = useState<Set<number>>(new Set())

    const [batches, setBatches] = useState<ParentPaymentBatchRow[]>([])
    const [batchesLoading, setBatchesLoading] = useState(true)
    const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())
    const [actionBatchId, setActionBatchId] = useState<string | null>(null)

    const loadBatches = useCallback(async () => {
        setBatchesLoading(true)
        const res = await getParentPaymentBatches()
        if (res.success && res.data) {
            setBatches(res.data)
        }
        setBatchesLoading(false)
    }, [])

    useEffect(() => {
        loadBatches()
    }, [loadBatches])

    const handleDownloadTemplate = async () => {
        setDownloading(true)
        try {
            const res = await downloadParentPaymentTemplate()
            if (!res.success || !res.data) throw new Error(res.error || 'Download failed')
            const blob = new Blob([Uint8Array.from(atob(res.data), c => c.charCodeAt(0))], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'BangKe_ThuTien_CongTyMe.xlsx'
            a.click()
            URL.revokeObjectURL(url)
            toast.success(isEn ? 'Template downloaded' : 'Đã tải file mẫu Bảng kê thu tiền')
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setDownloading(false)
        }
    }

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setFileName(file.name)
        setParsing(true)
        try {
            const arrayBuffer = await file.arrayBuffer()
            const bytes = new Uint8Array(arrayBuffer)
            let binary = ''
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i])
            }
            const base64 = btoa(binary)

            const res = await previewParentPaymentImport(base64)
            if (!res.success || !res.data) {
                toast.error(res.error || (isEn ? 'Failed to parse file' : 'Không đọc được file'))
                setPreviewRows(null)
                return
            }

            setPreviewRows(res.data)
            const validSet = new Set<number>()
            const expandSet = new Set<number>()
            res.data.forEach(r => {
                if (!r.error && !r.isDuplicate && r.matchedCustomer) {
                    validSet.add(r.rowIndex)
                    if (r.allocations.length > 0) expandSet.add(r.rowIndex)
                }
            })
            setSelectedRowIndices(validSet)
            setExpandedPreview(expandSet)
        } catch (err: any) {
            toast.error(err.message || 'Lỗi đọc file')
        } finally {
            setParsing(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const toggleSelectRow = (rowIndex: number) => {
        setSelectedRowIndices(prev => {
            const next = new Set(prev)
            if (next.has(rowIndex)) next.delete(rowIndex)
            else next.add(rowIndex)
            return next
        })
    }

    const toggleExpandPreview = (rowIndex: number) => {
        setExpandedPreview(prev => {
            const next = new Set(prev)
            if (next.has(rowIndex)) next.delete(rowIndex)
            else next.add(rowIndex)
            return next
        })
    }

    const toggleExpandBatch = (batchId: string) => {
        setExpandedBatches(prev => {
            const next = new Set(prev)
            if (next.has(batchId)) next.delete(batchId)
            else next.add(batchId)
            return next
        })
    }

    const handleCommit = async () => {
        if (!previewRows) return
        const chosen = previewRows.filter(
            r => selectedRowIndices.has(r.rowIndex) && !r.error && !r.isDuplicate && r.matchedCustomer
        )
        if (chosen.length === 0) {
            toast.error(isEn ? 'No valid rows selected' : 'Chưa chọn dòng hợp lệ nào để ghi sổ')
            return
        }

        setCommitting(true)
        try {
            const payload = chosen.map(r => ({
                customerId: r.matchedCustomer!.id,
                paymentDate: r.paymentDate,
                amount: r.amount,
                method: r.method,
                reference: r.reference,
                notes: r.notes,
                importHash: r.importHash,
                allocations: r.allocations.map(a => ({
                    invoiceId: a.invoiceId,
                    amount: a.allocatedAmount,
                })),
            }))

            const res = await commitParentPaymentImport(payload)
            if (!res.success || !res.data) {
                throw new Error(res.error || 'Ghi sổ thất bại')
            }

            toast.success(
                isEn
                    ? `Posted ${res.data.batchesCreated} batches (${res.data.paymentsCreated} invoice payments)`
                    : `Đã ghi sổ ${res.data.batchesCreated} phiếu thu (${res.data.paymentsCreated} hóa đơn được gạch nợ)`
            )
            setPreviewRows(null)
            setFileName(null)
            setSelectedRowIndices(new Set())
            await loadBatches()
            onDataChanged?.()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setCommitting(false)
        }
    }

    const handleAllocateRemaining = async (batchId: string) => {
        setActionBatchId(batchId)
        try {
            const res = await allocateUnallocatedBatch(batchId)
            if (!res.success || !res.data) throw new Error(res.error || 'Phân bổ thất bại')
            toast.success(
                isEn
                    ? `Allocated ${formatVND(res.data.allocatedNow)} across ${res.data.paymentsCreated} invoices`
                    : `Đã phân bổ thêm ${formatVND(res.data.allocatedNow)} vào ${res.data.paymentsCreated} hóa đơn`
            )
            await loadBatches()
            onDataChanged?.()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setActionBatchId(null)
        }
    }

    const handleReverseBatch = async (batchId: string, batchNo: string) => {
        if (!window.confirm(isEn ? `Reverse batch ${batchNo}?` : `Xác nhận hoàn tác phiếu thu ${batchNo} và khôi phục công nợ các hóa đơn liên quan?`)) {
            return
        }
        setActionBatchId(batchId)
        try {
            const res = await reverseParentPaymentBatch(batchId)
            if (!res.success) throw new Error(res.error || 'Hoàn tác thất bại')
            toast.success(isEn ? `Reversed ${batchNo}` : `Đã hoàn tác phiếu thu ${batchNo}`)
            await loadBatches()
            onDataChanged?.()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setActionBatchId(null)
        }
    }

    const validPreviewCount = previewRows?.filter(r => !r.error && !r.isDuplicate && r.matchedCustomer).length ?? 0
    const selectedTotalAmount = previewRows
        ?.filter(r => selectedRowIndices.has(r.rowIndex))
        .reduce((s, r) => s + r.amount, 0) ?? 0
    const selectedAllocatedAmount = previewRows
        ?.filter(r => selectedRowIndices.has(r.rowIndex))
        .reduce((s, r) => s + r.allocatedTotal, 0) ?? 0

    return (
        <div className="space-y-5">
            {/* Top Action Card */}
            <div className="p-5 rounded-lg bg-white border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-[#0E7490]" />
                        <h3 className="text-sm font-bold text-slate-900">
                            {isEn ? 'Import Parent Company Payment Statement' : 'Import Bảng Kê Thu Tiền Theo Công Ty Mẹ'}
                        </h3>
                    </div>
                    <p className="text-xs text-slate-500 max-w-2xl">
                        {isEn
                            ? 'Upload an Excel/CSV payment collection sheet by Parent Company (Code or Tax ID). The system automatically allocates payments FIFO across the parent company and all child branches.'
                            : 'Tải lên file Excel/CSV bảng kê thu tiền từ phần mềm kế toán theo Mã KH hoặc MST Công ty mẹ. Hệ thống tự động phân bổ gạch nợ FIFO xuống các hóa đơn đang mở của Công ty mẹ và toàn bộ chi nhánh con.'}
                    </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                    <button
                        onClick={handleDownloadTemplate}
                        disabled={downloading}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        {isEn ? 'Download Template' : 'Tải File Mẫu'}
                    </button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileSelected}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={parsing}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-[#0E7490] hover:bg-[#0891B2] text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {parsing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {isEn ? 'Upload Payment Sheet' : 'Upload Bảng Kê (.xlsx)'}
                    </button>
                </div>
            </div>

            {/* Preview & Allocation Section */}
            {previewRows && (
                <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <FileSpreadsheet size={15} className="text-[#0E7490]" />
                            <span className="text-xs font-bold text-slate-800">{fileName}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-50 text-[#0E7490] font-semibold">
                                {validPreviewCount}/{previewRows.length} {isEn ? 'valid rows' : 'dòng hợp lệ'}
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-xs text-slate-600">
                                {isEn ? 'Selected:' : 'Đã chọn:'}{' '}
                                <span className="font-bold text-slate-900">{formatVND(selectedTotalAmount)}</span>
                                <span className="mx-1.5 text-slate-300">|</span>
                                {isEn ? 'Allocated:' : 'Gạch nợ:'}{' '}
                                <span className="font-bold text-[#15803D]">{formatVND(selectedAllocatedAmount)}</span>
                            </div>

                            <button
                                onClick={() => {
                                    setPreviewRows(null)
                                    setFileName(null)
                                }}
                                className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
                                title={isEn ? 'Close preview' : 'Đóng xem trước'}
                            >
                                <X size={15} />
                            </button>

                            <button
                                onClick={handleCommit}
                                disabled={committing || selectedRowIndices.size === 0}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-[#15803D] hover:bg-[#166534] text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {committing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                {isEn ? `Post (${selectedRowIndices.size})` : `Xác Nhận Ghi Sổ (${selectedRowIndices.size})`}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/50">
                                    <th className="px-3 py-2.5 w-8"></th>
                                    <th className="px-3 py-2.5 w-8"></th>
                                    <th className="px-3 py-2.5">{isEn ? 'Row' : 'Dòng'}</th>
                                    <th className="px-3 py-2.5">{isEn ? 'Parent Company' : 'Công Ty Mẹ'}</th>
                                    <th className="px-3 py-2.5">{isEn ? 'Date' : 'Ngày Thu'}</th>
                                    <th className="px-3 py-2.5">{isEn ? 'Ref' : 'Số CT'}</th>
                                    <th className="px-3 py-2.5 text-right">{isEn ? 'Collected' : 'Số Tiền Thu'}</th>
                                    <th className="px-3 py-2.5 text-right">{isEn ? 'Allocated' : 'Gạch Nợ'}</th>
                                    <th className="px-3 py-2.5 text-right">{isEn ? 'Advance' : 'Tiền Dư'}</th>
                                    <th className="px-3 py-2.5">{isEn ? 'Status' : 'Trạng Thái'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {previewRows.map(row => {
                                    const isValid = !row.error && !row.isDuplicate && !!row.matchedCustomer
                                    const isChecked = selectedRowIndices.has(row.rowIndex)
                                    const isExpanded = expandedPreview.has(row.rowIndex)

                                    return (
                                        <>
                                            <tr key={row.rowIndex} className={!isValid ? 'bg-rose-50/40' : 'hover:bg-slate-50/70'}>
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        disabled={!isValid}
                                                        checked={isChecked}
                                                        onChange={() => toggleSelectRow(row.rowIndex)}
                                                        className="rounded border-slate-300 text-[#0E7490] cursor-pointer disabled:opacity-40"
                                                    />
                                                </td>
                                                <td className="px-2 py-2.5">
                                                    {row.allocations.length > 0 && (
                                                        <button
                                                            onClick={() => toggleExpandPreview(row.rowIndex)}
                                                            className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                                                        >
                                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 font-mono text-slate-500">#{row.rowIndex}</td>
                                                <td className="px-3 py-2.5">
                                                    {row.matchedCustomer ? (
                                                        <div>
                                                            <p className="font-semibold text-slate-900">{row.matchedCustomer.name}</p>
                                                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                                                <span>{row.matchedCustomer.code}</span>
                                                                {row.matchedCustomer.taxId && <span>MST: {row.matchedCustomer.taxId}</span>}
                                                                {row.matchedCustomer.childrenCount > 0 && (
                                                                    <span className="px-1.5 py-0.2 rounded bg-cyan-50 text-[#0E7490] font-medium">
                                                                        {row.matchedCustomer.childrenCount} chi nhánh con
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {row.matchedCustomer.isChildResolvedToParent && (
                                                                <p className="text-[10px] text-amber-700 mt-0.5">
                                                                    Quy về công ty mẹ từ: {row.matchedCustomer.resolvedFromName}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <p className="font-medium text-rose-700">{row.customerKey || row.customerNameInput || '—'}</p>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-slate-600">{formatDate(row.paymentDate)}</td>
                                                <td className="px-3 py-2.5 font-mono text-slate-600">{row.reference || '—'}</td>
                                                <td className="px-3 py-2.5 text-right font-bold text-slate-900">{formatVND(row.amount)}</td>
                                                <td className="px-3 py-2.5 text-right font-semibold text-[#15803D]">
                                                    {formatVND(row.allocatedTotal)}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-semibold text-[#B45309]">
                                                    {row.unallocatedAmount > 0 ? formatVND(row.unallocatedAmount) : '—'}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    {row.error ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-medium">
                                                            <AlertCircle size={12} className="shrink-0" />
                                                            {row.error}
                                                        </span>
                                                    ) : row.allocations.length === 0 ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                                                            <AlertCircle size={12} className="shrink-0" />
                                                            {isEn ? 'No open invoices (Advance)' : 'Không có nợ mở (Lưu tiền dư)'}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[11px] text-[#15803D] font-medium">
                                                            <CheckCircle2 size={12} className="shrink-0" />
                                                            {row.allocations.length} {isEn ? 'invoices' : 'hóa đơn'}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>

                                            {isExpanded && row.allocations.length > 0 && (
                                                <tr key={`${row.rowIndex}-detail`} className="bg-slate-50/70">
                                                    <td colSpan={10} className="px-10 py-2.5">
                                                        <div className="rounded border border-slate-200 bg-white overflow-hidden">
                                                            <table className="w-full text-[11px]">
                                                                <thead>
                                                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                                                        <th className="px-3 py-1.5 text-left">Hóa Đơn AR</th>
                                                                        <th className="px-3 py-1.5 text-left">Đơn Hàng SO</th>
                                                                        <th className="px-3 py-1.5 text-left">Chi Nhánh / Khách Hàng</th>
                                                                        <th className="px-3 py-1.5 text-left">Hạn TT</th>
                                                                        <th className="px-3 py-1.5 text-right">Còn Nợ</th>
                                                                        <th className="px-3 py-1.5 text-right">Phân Bổ Gạch Nợ</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100">
                                                                    {row.allocations.map(alloc => (
                                                                        <tr key={alloc.invoiceId}>
                                                                            <td className="px-3 py-1.5 font-mono font-semibold text-[#0891B2]">{alloc.invoiceNo}</td>
                                                                            <td className="px-3 py-1.5 font-mono text-slate-600">{alloc.soNo || '—'}</td>
                                                                            <td className="px-3 py-1.5 text-slate-800">
                                                                                <span className="font-medium">{alloc.branchName}</span>{' '}
                                                                                <span className="text-slate-400">({alloc.branchCode})</span>
                                                                            </td>
                                                                            <td className="px-3 py-1.5 text-slate-600">{formatDate(alloc.dueDate)}</td>
                                                                            <td className="px-3 py-1.5 text-right text-slate-600">{formatVND(alloc.outstanding)}</td>
                                                                            <td className="px-3 py-1.5 text-right font-bold text-[#15803D]">{formatVND(alloc.allocatedAmount)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Batch History Section */}
            <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        {isEn ? 'Parent Company Payment Batches History' : 'Lịch Sử Phiếu Thu Tổng Theo Công Ty Mẹ'}
                    </h4>
                    <span className="text-xs text-slate-500">
                        {batches.length} {isEn ? 'batches' : 'phiếu thu'}
                    </span>
                </div>

                {batchesLoading ? (
                    <div className="p-8 flex items-center justify-center text-slate-500 text-xs gap-2">
                        <Loader2 size={15} className="animate-spin" />
                        {isEn ? 'Loading...' : 'Đang tải dữ liệu...'}
                    </div>
                ) : batches.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                        {isEn ? 'No parent company payment batches imported yet.' : 'Chưa có bảng kê thu tiền công ty mẹ nào được import.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/50">
                                    <th className="px-3 py-2.5 w-8"></th>
                                    <th className="px-3 py-2.5">{isEn ? 'Batch No.' : 'Mã Phiếu'}</th>
                                    <th className="px-3 py-2.5">{isEn ? 'Parent Company' : 'Công Ty Mẹ'}</th>
                                    <th className="px-3 py-2.5">{isEn ? 'Date' : 'Ngày Thu'}</th>
                                    <th className="px-3 py-2.5">{isEn ? 'Ref' : 'Số CT'}</th>
                                    <th className="px-3 py-2.5 text-right">{isEn ? 'Total' : 'Tổng Thu'}</th>
                                    <th className="px-3 py-2.5 text-right">{isEn ? 'Allocated' : 'Đã Phân Bổ'}</th>
                                    <th className="px-3 py-2.5 text-right">{isEn ? 'Advance' : 'Tiền Dư'}</th>
                                    <th className="px-3 py-2.5">{isEn ? 'Status' : 'Trạng Thái'}</th>
                                    <th className="px-3 py-2.5 text-right">{isEn ? 'Actions' : 'Thao Tác'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {batches.map(b => {
                                    const st = BATCH_STATUS[b.status] || { label: b.status, labelEn: b.status, color: '#64748B' }
                                    const isExpanded = expandedBatches.has(b.id)
                                    const isBusy = actionBatchId === b.id

                                    return (
                                        <>
                                            <tr key={b.id} className="hover:bg-slate-50/70">
                                                <td className="px-3 py-2.5">
                                                    {b.payments.length > 0 && (
                                                        <button
                                                            onClick={() => toggleExpandBatch(b.id)}
                                                            className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                                                        >
                                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 font-mono font-bold text-[#0891B2]">{b.batchNo}</td>
                                                <td className="px-3 py-2.5">
                                                    <p className="font-semibold text-slate-900">{b.customerName}</p>
                                                    <p className="text-[11px] text-slate-500">
                                                        {b.customerCode}
                                                        {b.customerTaxId ? ` • MST: ${b.customerTaxId}` : ''}
                                                    </p>
                                                </td>
                                                <td className="px-3 py-2.5 text-slate-600">{formatDate(b.paymentDate)}</td>
                                                <td className="px-3 py-2.5 font-mono text-slate-600">{b.reference || '—'}</td>
                                                <td className="px-3 py-2.5 text-right font-bold text-slate-900">{formatVND(b.totalAmount)}</td>
                                                <td className="px-3 py-2.5 text-right font-semibold text-[#15803D]">{formatVND(b.allocatedAmount)}</td>
                                                <td className="px-3 py-2.5 text-right font-semibold text-[#B45309]">
                                                    {b.unallocatedAmount > 0 ? formatVND(b.unallocatedAmount) : '—'}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span
                                                        className="inline-block text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                                                        style={{ color: st.color, background: `${st.color}18` }}
                                                    >
                                                        {isEn ? st.labelEn : st.label}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        {b.unallocatedAmount > 0 && b.status !== 'REVERSED' && (
                                                            <button
                                                                onClick={() => handleAllocateRemaining(b.id)}
                                                                disabled={isBusy}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-cyan-50 hover:bg-cyan-100 text-[#0E7490] border border-cyan-200 cursor-pointer disabled:opacity-50"
                                                                title={isEn ? 'Allocate remaining credit to new invoices' : 'Phân bổ tiền dư vào hóa đơn mới'}
                                                            >
                                                                {isBusy ? <Loader2 size={11} className="animate-spin" /> : <ArrowRightLeft size={11} />}
                                                                {isEn ? 'Allocate' : 'Phân bổ'}
                                                            </button>
                                                        )}
                                                        {b.status !== 'REVERSED' && (
                                                            <button
                                                                onClick={() => handleReverseBatch(b.id, b.batchNo)}
                                                                disabled={isBusy}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 cursor-pointer disabled:opacity-50"
                                                                title={isEn ? 'Reverse batch' : 'Hoàn tác phiếu thu'}
                                                            >
                                                                <RotateCcw size={11} />
                                                                {isEn ? 'Reverse' : 'Hoàn tác'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {isExpanded && b.payments.length > 0 && (
                                                <tr key={`${b.id}-detail`} className="bg-slate-50/60">
                                                    <td colSpan={10} className="px-10 py-2.5">
                                                        <div className="rounded border border-slate-200 bg-white overflow-hidden">
                                                            <table className="w-full text-[11px]">
                                                                <thead>
                                                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                                                        <th className="px-3 py-1.5 text-left">Hóa Đơn AR</th>
                                                                        <th className="px-3 py-1.5 text-left">Chi Nhánh / Khách Hàng</th>
                                                                        <th className="px-3 py-1.5 text-right">Số Tiền Đã Gạch</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100">
                                                                    {b.payments.map(p => (
                                                                        <tr key={p.id}>
                                                                            <td className="px-3 py-1.5 font-mono font-semibold text-[#0891B2]">{p.invoiceNo}</td>
                                                                            <td className="px-3 py-1.5 text-slate-800">
                                                                                <span className="font-medium">{p.branchName}</span>{' '}
                                                                                <span className="text-slate-400">({p.branchCode})</span>
                                                                            </td>
                                                                            <td className="px-3 py-1.5 text-right font-bold text-[#15803D]">{formatVND(p.amount)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
