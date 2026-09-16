'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import {
    CheckCircle2, AlertCircle, Clock, AlertTriangle, FileX2,
    RefreshCw, Download, Search, Link2, ExternalLink,
    Building2, Calendar, FileText, Loader2, ArrowUpDown
} from 'lucide-react'
import { toast } from 'sonner'
import {
    ReconciliationRow, ReconciliationKpis, ReconciliationFilters, ReconciliationStatus,
    getInvoiceReconciliationData, batchSyncPendingInvoices, manualLinkInvoiceToOrder, exportInvoiceReconciliationExcel
} from './actions-reconciliation'
import { syncVnptInvoiceForOrder } from '../sales/actions-vnpt'
import { DataPagination } from '@/components/DataPagination'
import { formatVND } from '@/lib/utils'

const STATUS_CONFIG: Record<ReconciliationStatus, { label: string; badgeBg: string; badgeText: string; border: string }> = {
    MATCHED: {
        label: 'Đã Khớp',
        badgeBg: 'rgba(91,168,138,0.15)',
        badgeText: '#5BA88A',
        border: '1px solid rgba(91,168,138,0.4)',
    },
    MISSING_INVOICE: {
        label: 'Thiếu HĐ',
        badgeBg: 'rgba(239,68,68,0.15)',
        badgeText: '#EF4444',
        border: '1px solid rgba(239,68,68,0.4)',
    },
    PENDING_SIGN: {
        label: 'Chờ Ký Số',
        badgeBg: 'rgba(212,168,83,0.15)',
        badgeText: '#D4A853',
        border: '1px solid rgba(212,168,83,0.4)',
    },
    DISCREPANCY: {
        label: 'Lệch Tiền',
        badgeBg: 'rgba(249,115,22,0.15)',
        badgeText: '#F97316',
        border: '1px solid rgba(249,115,22,0.4)',
    },
    EXEMPT: {
        label: 'Miễn HĐ',
        badgeBg: 'rgba(100,116,139,0.15)',
        badgeText: '#94A3B8',
        border: '1px solid rgba(100,116,139,0.3)',
    },
}

export function InvoiceReconciliationTab() {
    const [period, setPeriod] = useState<ReconciliationFilters['period']>('this_month')
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')
    const [legalEntityId, setLegalEntityId] = useState('')
    const [statusFilter, setStatusFilter] = useState<'ALL' | ReconciliationStatus>('ALL')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const pageSize = 25

    const [rows, setRows] = useState<ReconciliationRow[]>([])
    const [total, setTotal] = useState(0)
    const [legalEntities, setLegalEntities] = useState<{ id: string; code: string; name: string }[]>([])
    const [kpis, setKpis] = useState<ReconciliationKpis>({
        totalOrders: 0,
        totalOrderAmount: 0,
        matchedOrders: 0,
        matchedAmount: 0,
        missingOrders: 0,
        missingAmount: 0,
        pendingSignOrders: 0,
        pendingSignAmount: 0,
        discrepancyOrders: 0,
        discrepancyAmount: 0,
        exemptOrders: 0,
        exemptAmount: 0,
        coveragePct: 0,
    })

    const [loading, setLoading] = useState(true)
    const [batchSyncing, setBatchSyncing] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [syncingSoId, setSyncingSoId] = useState<string | null>(null)

    // Manual Link Modal State
    const [linkModalOpen, setLinkModalOpen] = useState(false)
    const [linkTargetRow, setLinkTargetRow] = useState<ReconciliationRow | null>(null)
    const [linkInvoiceNo, setLinkInvoiceNo] = useState('')
    const [linkNotes, setLinkNotes] = useState('')
    const [linking, setLinking] = useState(false)

    const [isPending, startTransition] = useTransition()

    const loadData = useCallback(async () => {
        setLoading(true)
        const res = await getInvoiceReconciliationData({
            period,
            customFrom: period === 'custom' ? customFrom : undefined,
            customTo: period === 'custom' ? customTo : undefined,
            legalEntityId: legalEntityId || undefined,
            statusFilter,
            search: search.trim() || undefined,
            page,
            pageSize,
        })

        setLoading(false)
        if (res.success) {
            setRows(res.rows)
            setTotal(res.total)
            setKpis(res.kpis)
            if (res.legalEntities.length > 0) {
                setLegalEntities(res.legalEntities)
            }
        } else {
            toast.error(res.error || 'Không thể tải dữ liệu đối chiếu hóa đơn.')
        }
    }, [period, customFrom, customTo, legalEntityId, statusFilter, search, page, pageSize])

    useEffect(() => {
        startTransition(() => {
            loadData()
        })
    }, [loadData])

    // Batch Sync
    const handleBatchSync = async () => {
        setBatchSyncing(true)
        try {
            const res = await batchSyncPendingInvoices()
            if (res.success) {
                if (res.syncedCount > 0) {
                    toast.success(res.message)
                } else {
                    toast.info(res.message)
                }
                loadData()
            } else {
                toast.error(res.message || 'Lỗi khi đồng bộ hàng loạt từ VNPT.')
            }
        } catch (err: any) {
            toast.error(`Lỗi kết nối: ${err.message}`)
        } finally {
            setBatchSyncing(false)
        }
    }

    // Single Sync from VNPT
    const handleSingleSync = async (soId: string) => {
        setSyncingSoId(soId)
        try {
            const res = await syncVnptInvoiceForOrder(soId)
            if (res.success) {
                toast.success(res.message || 'Đồng bộ hóa đơn VNPT thành công!')
                loadData()
            } else if (res.isDraft) {
                toast.warning(res.error || 'Hóa đơn vẫn ở trạng thái nháp trên VNPT, chưa được ký số.')
            } else {
                toast.error(res.error || 'Lỗi khi đồng bộ hóa đơn.')
            }
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`)
        } finally {
            setSyncingSoId(null)
        }
    }

    // Export Excel
    const handleExportExcel = async () => {
        setExporting(true)
        try {
            const res = await exportInvoiceReconciliationExcel({
                period,
                customFrom: period === 'custom' ? customFrom : undefined,
                customTo: period === 'custom' ? customTo : undefined,
                legalEntityId: legalEntityId || undefined,
                statusFilter,
                search: search.trim() || undefined,
            })

            if (res.success && res.base64) {
                const link = document.createElement('a')
                link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`
                link.download = res.filename || 'Doi_Chieu_Hoa_Don_VNPT.xlsx'
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                toast.success('Đã xuất file Excel báo cáo đối chiếu!')
            } else {
                toast.error(res.error || 'Lỗi xuất file Excel.')
            }
        } catch (err: any) {
            toast.error(`Lỗi xuất Excel: ${err.message}`)
        } finally {
            setExporting(false)
        }
    }

    // Manual Link Submit
    const handleManualLinkSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!linkTargetRow || !linkInvoiceNo.trim()) return

        setLinking(true)
        try {
            const res = await manualLinkInvoiceToOrder({
                soId: linkTargetRow.soId,
                invoiceNo: linkInvoiceNo.trim(),
                notes: linkNotes.trim() || undefined,
            })

            if (res.success) {
                toast.success(`Đã gán số HĐ ${linkInvoiceNo.trim()} cho đơn ${linkTargetRow.soNo}`)
                setLinkModalOpen(false)
                setLinkTargetRow(null)
                setLinkInvoiceNo('')
                setLinkNotes('')
                loadData()
            } else {
                toast.error(res.error || 'Không thể gán số hóa đơn.')
            }
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`)
        } finally {
            setLinking(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Top Header & Fast Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: '#E8F1F2' }}>
                        <span>Kiểm Soát & Đối Chiếu Hóa Đơn VAT</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                            VNPT e-Invoice TT78
                        </span>
                    </h3>
                    <p className="text-xs mt-1" style={{ color: '#8AAEBB' }}>
                        Đối chiếu trạng thái xuất hóa đơn của các đơn bán hàng ERP so với cổng hóa đơn điện tử VNPT
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={handleBatchSync}
                        disabled={batchSyncing || loading}
                        className="px-3.5 py-2 rounded-md text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-[#0A1926]"
                        style={{ background: '#87CBB9' }}
                        title="Rà soát toàn bộ các đơn hàng đang có bản nháp trên VNPT để tự động kéo số HĐ và link PDF đã ký"
                    >
                        {batchSyncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                        Đồng Bộ Hàng Loạt VNPT
                    </button>

                    <button
                        onClick={handleExportExcel}
                        disabled={exporting || loading}
                        className="px-3.5 py-2 rounded-md text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-[#2A4355] text-[#E8F1F2] hover:bg-[#1B2E3D] disabled:opacity-50"
                        title="Xuất file Excel đối chiếu 2 sheet gồm Tổng hợp và Chi tiết"
                    >
                        {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        Xuất Excel Đối Chiếu
                    </button>
                </div>
            </div>

            {/* 5 KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* 1. Coverage */}
                <div
                    onClick={() => { setStatusFilter('ALL'); setPage(1) }}
                    className="p-4 rounded-md transition-all cursor-pointer hover:border-[#87CBB9]"
                    style={{
                        background: '#142433',
                        border: statusFilter === 'ALL' ? '2px solid #87CBB9' : '1px solid #2A4355',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8AAEBB' }}>
                            Độ Phủ Hóa Đơn
                        </span>
                        <CheckCircle2 size={16} style={{ color: '#87CBB9' }} />
                    </div>
                    <p className="text-2xl font-bold font-mono" style={{ color: '#87CBB9' }}>
                        {kpis.coveragePct}%
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: '#4A6A7A' }}>
                        {kpis.matchedOrders} / {kpis.totalOrders - kpis.exemptOrders} đơn bắt buộc
                    </p>
                </div>

                {/* 2. Missing Invoices */}
                <div
                    onClick={() => { setStatusFilter('MISSING_INVOICE'); setPage(1) }}
                    className="p-4 rounded-md transition-all cursor-pointer hover:border-[#EF4444]"
                    style={{
                        background: '#142433',
                        border: statusFilter === 'MISSING_INVOICE' ? '2px solid #EF4444' : '1px solid #2A4355',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#EF4444' }}>
                            Cần Xuất HĐ
                        </span>
                        <AlertCircle size={16} style={{ color: '#EF4444' }} />
                    </div>
                    <p className="text-2xl font-bold font-mono" style={{ color: '#EF4444' }}>
                        {kpis.missingOrders} <span className="text-xs font-normal">đơn</span>
                    </p>
                    <p className="text-[11px] mt-1 font-mono" style={{ color: '#FCA5A5' }}>
                        {formatVND(kpis.missingAmount)}
                    </p>
                </div>

                {/* 3. Pending Sign */}
                <div
                    onClick={() => { setStatusFilter('PENDING_SIGN'); setPage(1) }}
                    className="p-4 rounded-md transition-all cursor-pointer hover:border-[#D4A853]"
                    style={{
                        background: '#142433',
                        border: statusFilter === 'PENDING_SIGN' ? '2px solid #D4A853' : '1px solid #2A4355',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#D4A853' }}>
                            Chờ Ký Số VNPT
                        </span>
                        <Clock size={16} style={{ color: '#D4A853' }} />
                    </div>
                    <p className="text-2xl font-bold font-mono" style={{ color: '#D4A853' }}>
                        {kpis.pendingSignOrders} <span className="text-xs font-normal">đơn</span>
                    </p>
                    <p className="text-[11px] mt-1 font-mono" style={{ color: '#FDE68A' }}>
                        {formatVND(kpis.pendingSignAmount)}
                    </p>
                </div>

                {/* 4. Discrepancy */}
                <div
                    onClick={() => { setStatusFilter('DISCREPANCY'); setPage(1) }}
                    className="p-4 rounded-md transition-all cursor-pointer hover:border-[#F97316]"
                    style={{
                        background: '#142433',
                        border: statusFilter === 'DISCREPANCY' ? '2px solid #F97316' : '1px solid #2A4355',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#F97316' }}>
                            Lệch Tiền / Thuế
                        </span>
                        <AlertTriangle size={16} style={{ color: '#F97316' }} />
                    </div>
                    <p className="text-2xl font-bold font-mono" style={{ color: '#F97316' }}>
                        {kpis.discrepancyOrders} <span className="text-xs font-normal">đơn</span>
                    </p>
                    <p className="text-[11px] mt-1 font-mono" style={{ color: '#FDBA74' }}>
                        {formatVND(kpis.discrepancyAmount)}
                    </p>
                </div>

                {/* 5. Exempt */}
                <div
                    onClick={() => { setStatusFilter('EXEMPT'); setPage(1) }}
                    className="p-4 rounded-md transition-all cursor-pointer hover:border-[#94A3B8]"
                    style={{
                        background: '#142433',
                        border: statusFilter === 'EXEMPT' ? '2px solid #94A3B8' : '1px solid #2A4355',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>
                            Miễn Xuất HĐ
                        </span>
                        <FileX2 size={16} style={{ color: '#94A3B8' }} />
                    </div>
                    <p className="text-2xl font-bold font-mono" style={{ color: '#94A3B8' }}>
                        {kpis.exemptOrders} <span className="text-xs font-normal">đơn</span>
                    </p>
                    <p className="text-[11px] mt-1 font-mono" style={{ color: '#CBD5E1' }}>
                        {formatVND(kpis.exemptAmount)}
                    </p>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 rounded-md space-y-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Period Tabs */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {(['this_month', 'last_month', 'this_quarter', 'this_year', 'all', 'custom'] as const).map(p => {
                            const labels: Record<string, string> = {
                                this_month: 'Tháng Này',
                                last_month: 'Tháng Trước',
                                this_quarter: 'Quý Này',
                                this_year: 'Năm Nay',
                                all: 'Toàn Bộ',
                                custom: 'Tùy Chọn',
                            }
                            const active = period === p
                            return (
                                <button
                                    key={p}
                                    onClick={() => { setPeriod(p); setPage(1) }}
                                    className="px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer"
                                    style={{
                                        background: active ? '#1B2E3D' : 'transparent',
                                        color: active ? '#87CBB9' : '#8AAEBB',
                                        border: active ? '1px solid #87CBB9' : '1px solid transparent',
                                    }}
                                >
                                    {labels[p]}
                                </button>
                            )
                        })}
                    </div>

                    {/* Legal Entity & Search */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        {legalEntities.length > 0 && (
                            <select
                                value={legalEntityId}
                                onChange={e => { setLegalEntityId(e.target.value); setPage(1) }}
                                className="text-xs px-3 py-1.5 rounded outline-none cursor-pointer"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            >
                                <option value="">Tất cả pháp nhân</option>
                                {legalEntities.map(le => (
                                    <option key={le.id} value={le.id}>{le.code} - {le.name}</option>
                                ))}
                            </select>
                        )}

                        <div className="relative flex-1 min-w-[220px]">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1) }}
                                placeholder="Tìm SO, Khách hàng, MST, Số HĐ..."
                                className="w-full text-xs pl-8 pr-3 py-1.5 rounded outline-none"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Custom Date Range Picker */}
                {period === 'custom' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-[#2A4355] text-xs">
                        <span style={{ color: '#8AAEBB' }}>Từ ngày:</span>
                        <input
                            type="date"
                            value={customFrom}
                            onChange={e => { setCustomFrom(e.target.value); setPage(1) }}
                            className="px-2 py-1 rounded text-xs outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                        />
                        <span style={{ color: '#8AAEBB' }}>Đến ngày:</span>
                        <input
                            type="date"
                            value={customTo}
                            onChange={e => { setCustomTo(e.target.value); setPage(1) }}
                            className="px-2 py-1 rounded text-xs outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                        />
                    </div>
                )}
            </div>

            {/* Reconciliation Data Table */}
            <div className="rounded-md overflow-hidden" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#1B2E3D', borderBottom: '1px solid #2A4355', color: '#8AAEBB' }}>
                                <th className="py-3 px-3.5 font-semibold">Mã Đơn (SO)</th>
                                <th className="py-3 px-3 font-semibold">Khách Hàng / MST</th>
                                <th className="py-3 px-2 font-semibold">Pháp Nhân</th>
                                <th className="py-3 px-3 text-right font-semibold">Tổng Tiền SO</th>
                                <th className="py-3 px-3 text-right font-semibold">Hóa Đơn VAT</th>
                                <th className="py-3 px-3 text-center font-semibold">Trạng Thái Đối Chiếu</th>
                                <th className="py-3 px-3 font-semibold">Số HĐ / Mã CQT</th>
                                <th className="py-3 px-3 text-right font-semibold">Thao Tác</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center" style={{ color: '#8AAEBB' }}>
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Đang tải dữ liệu đối chiếu...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center" style={{ color: '#4A6A7A' }}>
                                        Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
                                    </td>
                                </tr>
                            ) : (
                                rows.map(r => {
                                    const stCfg = STATUS_CONFIG[r.reconciliationStatus]
                                    const isSyncingThis = syncingSoId === r.soId

                                    return (
                                        <tr
                                            key={r.soId}
                                            className="transition-colors hover:bg-[#1B2E3D]/50"
                                            style={{ borderBottom: '1px solid #2A4355' }}
                                        >
                                            {/* 1. SO No & Date */}
                                            <td className="py-3 px-3.5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-bold font-mono text-[#87CBB9]">{r.soNo}</span>
                                                    {r.dateWarning?.isDifferentMonth && (
                                                        <span 
                                                            className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 cursor-help" 
                                                            title={r.dateWarning.message}
                                                        >
                                                            ⚠️ Lệch kỳ thuế
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px]" style={{ color: '#4A6A7A' }}>
                                                    {new Date(r.orderDate).toLocaleDateString('vi-VN')}
                                                </div>
                                            </td>

                                            {/* 2. Customer & Tax ID */}
                                            <td className="py-3 px-3 max-w-[220px]">
                                                <div className="font-medium truncate text-[#E8F1F2]" title={r.customerName}>
                                                    {r.customerName}
                                                </div>
                                                <div className="text-[11px] font-mono mt-0.5" style={{ color: '#8AAEBB' }}>
                                                    MST: {r.taxId}
                                                </div>
                                            </td>

                                            {/* 3. Legal Entity */}
                                            <td className="py-3 px-2">
                                                <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#D4A853' }}>
                                                    {r.legalEntityCode || 'TA'}
                                                </span>
                                            </td>

                                            {/* 4. Order Total & VAT */}
                                            <td className="py-3 px-3 text-right">
                                                <div className="font-mono font-bold text-[#E8F1F2]">
                                                    {formatVND(r.orderTotal)}
                                                </div>
                                                <div className="text-[10px]" style={{ color: '#4A6A7A' }}>
                                                    VAT: {formatVND(r.orderVat)}
                                                </div>
                                            </td>

                                            {/* 5. Invoice Total & Variance */}
                                            <td className="py-3 px-3 text-right">
                                                {r.invoiceTotal !== null ? (
                                                    <div>
                                                        <div className="font-mono font-medium text-[#E8F1F2]">
                                                            {formatVND(r.invoiceTotal)}
                                                        </div>
                                                        {Math.abs(r.variance) > 1000 ? (
                                                            <div 
                                                                className="text-[10px] font-bold text-orange-400 cursor-help"
                                                                title={r.discrepancyReason || `Lệch tổng tiền ${formatVND(r.variance)}`}
                                                            >
                                                                Lệch: {formatVND(r.variance)}
                                                            </div>
                                                        ) : r.vatVariance && Math.abs(r.vatVariance) > 1000 ? (
                                                            <div 
                                                                className="text-[10px] font-bold text-orange-400 cursor-help"
                                                                title={r.discrepancyReason || `Lệch thuế VAT ${formatVND(r.vatVariance)}`}
                                                            >
                                                                Lệch VAT: {formatVND(r.vatVariance)}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-emerald-400">Khớp 100%</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px]" style={{ color: '#4A6A7A' }}>—</span>
                                                )}
                                            </td>

                                            {/* 6. Status Badge */}
                                            <td className="py-3 px-3 text-center">
                                                <span
                                                    className="text-[10px] px-2.5 py-1 rounded-full font-bold inline-block"
                                                    style={{
                                                        background: stCfg.badgeBg,
                                                        color: stCfg.badgeText,
                                                        border: stCfg.border,
                                                    }}
                                                >
                                                    {stCfg.label}
                                                </span>
                                            </td>

                                            {/* 7. Invoice No & Tax Authority Code */}
                                            <td className="py-3 px-3">
                                                {r.invoiceNo ? (
                                                    <div>
                                                        <div className="font-mono font-bold text-xs text-[#E8F1F2]">
                                                            {r.invoiceNo}
                                                        </div>
                                                        {r.taxAuthorityCode && (
                                                            <div className="text-[10px] font-mono truncate max-w-[130px] text-emerald-400" title={r.taxAuthorityCode}>
                                                                CQT: {r.taxAuthorityCode}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px]" style={{ color: '#4A6A7A' }}>Chưa cấp</span>
                                                )}
                                            </td>

                                            {/* 8. Action Buttons */}
                                            <td className="py-3 px-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                    {/* If Pending Sign: Kéo số HĐ button */}
                                                    {r.reconciliationStatus === 'PENDING_SIGN' && (
                                                        <button
                                                            onClick={() => handleSingleSync(r.soId)}
                                                            disabled={isSyncingThis}
                                                            className="text-[10px] px-2 py-1 rounded font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                            title="Kiểm tra trạng thái ký số và kéo số HĐ chính thức từ VNPT"
                                                        >
                                                            {isSyncingThis ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                                            Kéo Số
                                                        </button>
                                                    )}

                                                    {/* Manual Link Button */}
                                                    <button
                                                        onClick={() => {
                                                            setLinkTargetRow(r)
                                                            setLinkInvoiceNo(r.invoiceNo && !r.invoiceNo.startsWith('NHAP-') ? r.invoiceNo : '')
                                                            setLinkNotes('')
                                                            setLinkModalOpen(true)
                                                        }}
                                                        className="text-[10px] px-2 py-1 rounded font-medium border border-[#2A4355] text-[#8AAEBB] hover:text-white hover:bg-[#1B2E3D] transition-all flex items-center gap-1 cursor-pointer"
                                                        title="Gán thủ công số hóa đơn VAT cho đơn hàng này"
                                                    >
                                                        <Link2 size={10} />
                                                        Gán HĐ
                                                    </button>

                                                    {/* PDF Download */}
                                                    {r.pdfUrl && (
                                                        <a
                                                            href={r.pdfUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-[10px] px-1.5 py-1 rounded font-bold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/30 transition-all flex items-center gap-0.5 cursor-pointer"
                                                            title="Tải file PDF gốc từ VNPT"
                                                        >
                                                            <Download size={10} />
                                                            PDF
                                                        </a>
                                                    )}

                                                    {/* Portal View */}
                                                    {r.viewUrl && (
                                                        <a
                                                            href={r.viewUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-[10px] px-1.5 py-1 rounded font-medium text-blue-300 hover:bg-blue-500/20 border border-blue-500/30 transition-all flex items-center gap-0.5 cursor-pointer"
                                                            title="Mở xem trên Portal VNPT"
                                                        >
                                                            <ExternalLink size={10} />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <DataPagination
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={setPage}
                />
            </div>

            {/* Manual Link Invoice Modal */}
            {linkModalOpen && linkTargetRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div
                        className="w-full max-w-md p-6 rounded-lg shadow-2xl space-y-4"
                        style={{ background: '#142433', border: '1px solid #2A4355' }}
                    >
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-base text-[#E8F1F2] flex items-center gap-2">
                                <Link2 size={16} className="text-[#87CBB9]" />
                                Gán Số Hóa Đơn VAT
                            </h4>
                            <button
                                onClick={() => setLinkModalOpen(false)}
                                className="text-xs px-2 py-1 rounded text-[#8AAEBB] hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-3 rounded text-xs space-y-1" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex justify-between">
                                <span style={{ color: '#8AAEBB' }}>Mã Đơn Hàng:</span>
                                <span className="font-mono font-bold text-[#87CBB9]">{linkTargetRow.soNo}</span>
                            </div>
                            <div className="flex justify-between">
                                <span style={{ color: '#8AAEBB' }}>Khách Hàng:</span>
                                <span className="font-medium text-[#E8F1F2] truncate max-w-[200px]">{linkTargetRow.customerName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span style={{ color: '#8AAEBB' }}>Tổng Tiền:</span>
                                <span className="font-mono font-bold text-[#E8F1F2]">{formatVND(linkTargetRow.orderTotal)}</span>
                            </div>
                        </div>

                        <form onSubmit={handleManualLinkSubmit} className="space-y-3 text-xs">
                            <div>
                                <label className="block font-semibold mb-1" style={{ color: '#8AAEBB' }}>
                                    Số Hóa Đơn Điện Tử VAT *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={linkInvoiceNo}
                                    onChange={e => setLinkInvoiceNo(e.target.value)}
                                    placeholder="Ví dụ: C26TAB-00000190 hoặc 00000190"
                                    className="w-full px-3 py-2 rounded font-mono text-sm outline-none"
                                    style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                />
                                <p className="text-[10px] mt-1" style={{ color: '#4A6A7A' }}>
                                    Nhập số hóa đơn đã xuất trên cổng VNPT / Viettel / MISA để gắn vào đơn hàng.
                                </p>
                            </div>

                            <div>
                                <label className="block font-semibold mb-1" style={{ color: '#8AAEBB' }}>
                                    Ghi Chú Kế Toán (Tùy chọn)
                                </label>
                                <textarea
                                    rows={2}
                                    value={linkNotes}
                                    onChange={e => setLinkNotes(e.target.value)}
                                    placeholder="Lý do gán thủ công / Ngày phát hành thực tế..."
                                    className="w-full px-3 py-1.5 rounded text-xs outline-none"
                                    style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setLinkModalOpen(false)}
                                    className="px-4 py-2 rounded font-semibold text-xs border border-[#2A4355] text-[#8AAEBB] hover:text-white"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={linking || !linkInvoiceNo.trim()}
                                    className="px-4 py-2 rounded font-bold text-xs text-[#0A1926] transition-all disabled:opacity-50 flex items-center gap-1.5"
                                    style={{ background: '#87CBB9' }}
                                >
                                    {linking && <Loader2 size={12} className="animate-spin" />}
                                    Lưu Gán Hóa Đơn
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
