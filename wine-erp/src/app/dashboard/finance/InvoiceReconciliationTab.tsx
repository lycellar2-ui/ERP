'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import {
    CheckCircle2, AlertCircle, Clock, AlertTriangle, FileX2,
    RefreshCw, Download, Search, Link2, ExternalLink,
    Building2, Calendar, FileText, Loader2, ArrowUpDown, Trash2, Filter,
    Upload, Unlink, Check, X, ShieldAlert, Sparkles, FolderArchive
} from 'lucide-react'
import { toast } from 'sonner'
import {
    ReconciliationRow, ReconciliationKpis, ReconciliationFilters, ReconciliationStatus,
    getInvoiceReconciliationData, batchSyncPendingInvoices, manualLinkInvoiceToOrder, exportInvoiceReconciliationExcel,
    VnptInvoiceRegistryItem, VnptRegistryKpis, VnptRegistryFilters, VnptAssignmentStatus,
    getVnptInvoicesRegistry, uploadVnptMonthlyExcel, searchSalesOrdersForLinking,
    unlinkVnptInvoiceFromOrder, exportVnptRegistryExcel
} from './actions-reconciliation'
import { syncVnptInvoiceForOrder, deleteDraftInvoiceFromVnpt } from '../sales/actions-vnpt'
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

    const [activeView, setActiveView] = useState<'SO_VIEW' | 'VNPT_VIEW'>('SO_VIEW')

    // VNPT Registry State
    const [vnptItems, setVnptItems] = useState<VnptInvoiceRegistryItem[]>([])
    const [vnptTotal, setVnptTotal] = useState(0)
    const [vnptPage, setVnptPage] = useState(1)
    const vnptPageSize = 25
    const [vnptEntity, setVnptEntity] = useState<'ALL' | 'TA' | 'LC'>('ALL')
    const [vnptStatus, setVnptStatus] = useState<VnptAssignmentStatus>('ALL')
    const [vnptSearch, setVnptSearch] = useState('')
    const [vnptLoading, setVnptLoading] = useState(false)
    const [vnptExporting, setVnptExporting] = useState(false)
    const [vnptUploading, setVnptUploading] = useState(false)
    const [vnptKpis, setVnptKpis] = useState<VnptRegistryKpis>({
        totalInvoices: 0,
        totalAmount: 0,
        assignedCount: 0,
        assignedAmount: 0,
        unassignedCount: 0,
        unassignedAmount: 0,
        specialCount: 0,
        specialAmount: 0,
    })

    // VNPT Linking Modal State
    const [vnptLinkModalOpen, setVnptLinkModalOpen] = useState(false)
    const [selectedVnptItem, setSelectedVnptItem] = useState<VnptInvoiceRegistryItem | null>(null)
    const [soSearchQuery, setSoSearchQuery] = useState('')
    const [soCandidates, setSoCandidates] = useState<Array<{
        id: string
        soNo: string
        orderDate: string
        customerName: string
        customerTaxId: string
        legalEntityCode: string
        grossAmount: number
        status: string
        currentInvoiceNo?: string
    }>>([])
    const [soSearching, setSoSearching] = useState(false)
    const [linkingToSoId, setLinkingToSoId] = useState<string | null>(null)
    const [vnptLinkNotes, setVnptLinkNotes] = useState('')
    const [unlinkingInvNo, setUnlinkingInvNo] = useState<string | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)

    // Manual Link Modal State (SO View)
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

    // Delete Draft Invoice
    const [deletingSoId, setDeletingSoId] = useState<string | null>(null)
    const handleDeleteDraft = async (soId: string, soNo: string) => {
        if (!confirm(`Bạn có chắc chắn muốn hủy bản nháp hóa đơn cho đơn hàng ${soNo}?`)) return
        setDeletingSoId(soId)
        try {
            const res = await deleteDraftInvoiceFromVnpt(soId)
            if (res.success) {
                toast.success(res.message || 'Đã hủy bản nháp hóa đơn thành công.')
                loadData()
            } else {
                toast.error(res.error || 'Lỗi khi hủy bản nháp.')
            }
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`)
        } finally {
            setDeletingSoId(null)
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

    // Load VNPT Registry Data
    const loadVnptData = useCallback(async () => {
        setVnptLoading(true)
        const res = await getVnptInvoicesRegistry({
            entityCode: vnptEntity,
            statusFilter: vnptStatus,
            search: vnptSearch.trim() || undefined,
            page: vnptPage,
            pageSize: vnptPageSize,
        })
        setVnptLoading(false)
        if (res.success) {
            setVnptItems(res.items)
            setVnptTotal(res.total)
            setVnptKpis(res.kpis)
        } else {
            toast.error(res.error || 'Không thể tải danh sách hóa đơn VNPT.')
        }
    }, [vnptEntity, vnptStatus, vnptSearch, vnptPage, vnptPageSize])

    useEffect(() => {
        if (activeView === 'VNPT_VIEW') {
            loadVnptData()
        }
    }, [activeView, loadVnptData])

    // Preload VNPT KPIs once on mount for header badges
    useEffect(() => {
        getVnptInvoicesRegistry({ page: 1, pageSize: 1 }).then(res => {
            if (res.success) {
                setVnptKpis(res.kpis)
            }
        })
    }, [])

    // Handle Upload Excel
    const handleVnptFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setVnptUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await uploadVnptMonthlyExcel(formData)
            if (res.success) {
                toast.success(res.message || 'Đã nạp file hóa đơn VNPT thành công!')
                loadVnptData()
                loadData()
            } else {
                toast.error(res.error || 'Lỗi khi tải lên file VNPT.')
            }
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`)
        } finally {
            setVnptUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    // Handle Export VNPT Excel
    const handleVnptExport = async () => {
        setVnptExporting(true)
        try {
            const res = await exportVnptRegistryExcel({
                entityCode: vnptEntity,
                statusFilter: vnptStatus,
                search: vnptSearch.trim() || undefined,
            })
            if (res.success && res.base64) {
                const link = document.createElement('a')
                link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`
                link.download = res.filename || 'Bang_Ke_Hoa_Don_VNPT.xlsx'
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                toast.success('Đã xuất file Excel bảng kê hóa đơn VNPT!')
            } else {
                toast.error(res.error || 'Lỗi xuất Excel.')
            }
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`)
        } finally {
            setVnptExporting(false)
        }
    }

    // Open Modal to link unassigned VNPT invoice
    const handleOpenVnptLinkModal = async (item: VnptInvoiceRegistryItem) => {
        setSelectedVnptItem(item)
        setVnptLinkNotes(`Gán từ HĐ VNPT ${item.serial}-${item.invNo} (${item.buyerName})`)
        const initialQuery = item.buyerTaxId || item.buyerName.slice(0, 12).trim()
        setSoSearchQuery(initialQuery)
        setVnptLinkModalOpen(true)
        setSoSearching(true)
        try {
            const res = await searchSalesOrdersForLinking({
                query: initialQuery,
                entityCode: item.entityCode,
            })
            if (res.success) {
                setSoCandidates(res.orders)
            }
        } finally {
            setSoSearching(false)
        }
    }

    // Search SOs
    const handleSearchSos = async (q: string) => {
        setSoSearchQuery(q)
        setSoSearching(true)
        try {
            const res = await searchSalesOrdersForLinking({
                query: q,
                entityCode: selectedVnptItem?.entityCode,
            })
            if (res.success) {
                setSoCandidates(res.orders)
            }
        } finally {
            setSoSearching(false)
        }
    }

    // Perform Link VNPT Invoice to SO
    const handlePerformLinkVnpt = async (soId: string, soNo: string) => {
        if (!selectedVnptItem) return
        setLinkingToSoId(soId)
        try {
            const res = await manualLinkInvoiceToOrder({
                soId,
                invoiceNo: selectedVnptItem.invNo,
                notes: vnptLinkNotes.trim() || undefined,
            })
            if (res.success) {
                toast.success(`Đã gán thành công HĐ #${selectedVnptItem.invNo} cho đơn hàng ${soNo}!`)
                setVnptLinkModalOpen(false)
                setSelectedVnptItem(null)
                loadVnptData()
                loadData()
            } else {
                toast.error(res.error || 'Không thể gán hóa đơn.')
            }
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`)
        } finally {
            setLinkingToSoId(null)
        }
    }

    // Unlink VNPT
    const handleUnlinkVnpt = async (item: VnptInvoiceRegistryItem) => {
        if (!item.linkedSoId) return
        if (!confirm(`Bạn có chắc muốn hủy gán hóa đơn #${item.invNo} khỏi đơn hàng ${item.linkedSoNo}?`)) return
        setUnlinkingInvNo(item.invNo)
        try {
            const res = await unlinkVnptInvoiceFromOrder({
                soId: item.linkedSoId,
                invoiceNo: item.invNo,
            })
            if (res.success) {
                toast.success(`Đã hủy gán hóa đơn #${item.invNo}!`)
                loadVnptData()
                loadData()
            } else {
                toast.error(res.error || 'Lỗi khi hủy gán.')
            }
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`)
        } finally {
            setUnlinkingInvNo(null)
        }
    }

    return (
        <div className="space-y-6">
            {/* Hidden File Input for VNPT Excel Upload */}
            <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls"
                onChange={handleVnptFileUpload}
                className="hidden"
            />

            {/* View Mode Switcher */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                    onClick={() => setActiveView('SO_VIEW')}
                    className="px-4 py-2 rounded-t-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                    style={{
                        background: activeView === 'SO_VIEW' ? '#FFFFFF' : 'transparent',
                        color: activeView === 'SO_VIEW' ? '#87CBB9' : '#475569',
                        borderBottom: activeView === 'SO_VIEW' ? '2px solid #87CBB9' : '2px solid transparent',
                    }}
                >
                    <FileText size={14} />
                    <span>Đối Chiếu Theo Đơn Hàng (ERP → VNPT)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-slate-600">
                        {kpis.totalOrders} đơn
                    </span>
                </button>

                <button
                    onClick={() => { setActiveView('VNPT_VIEW'); loadVnptData() }}
                    className="px-4 py-2 rounded-t-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                    style={{
                        background: activeView === 'VNPT_VIEW' ? '#FFFFFF' : 'transparent',
                        color: activeView === 'VNPT_VIEW' ? '#87CBB9' : '#475569',
                        borderBottom: activeView === 'VNPT_VIEW' ? '2px solid #87CBB9' : '2px solid transparent',
                    }}
                >
                    <Building2 size={14} />
                    <span>Danh Sách Hóa Đơn VNPT (VNPT → ERP)</span>
                    {vnptKpis.unassignedCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            {vnptKpis.unassignedCount} chưa gán
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-slate-600">
                            {vnptKpis.totalInvoices} HĐ
                        </span>
                    )}
                </button>
            </div>

            {activeView === 'SO_VIEW' ? (
                <>
                    {/* Top Header & Fast Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: '#0F172A' }}>
                        <span>Kiểm Soát & Đối Chiếu Hóa Đơn VAT</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                            VNPT e-Invoice TT78
                        </span>
                    </h3>
                    <p className="text-xs mt-1" style={{ color: '#475569' }}>
                        Đối chiếu trạng thái xuất hóa đơn của các đơn bán hàng ERP so với cổng hóa đơn điện tử VNPT
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={handleBatchSync}
                        disabled={batchSyncing || loading}
                        className="px-3.5 py-2 rounded-md text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-slate-900"
                        style={{ background: '#87CBB9' }}
                        title="Rà soát toàn bộ các đơn hàng đang có bản nháp trên VNPT để tự động kéo số HĐ và link PDF đã ký"
                    >
                        {batchSyncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                        Đồng Bộ Hàng Loạt VNPT
                    </button>

                    <button
                        onClick={handleExportExcel}
                        disabled={exporting || loading}
                        className="px-3.5 py-2 rounded-md text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-slate-200 text-slate-900 hover:bg-white disabled:opacity-50"
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
                        background: '#FFFFFF',
                        border: statusFilter === 'ALL' ? '2px solid #87CBB9' : '1px solid #E2E8F0',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>
                            Độ Phủ Hóa Đơn
                        </span>
                        <CheckCircle2 size={16} style={{ color: '#0891B2' }} />
                    </div>
                    <p className="text-2xl font-bold font-mono" style={{ color: '#0891B2' }}>
                        {kpis.coveragePct}%
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: '#64748B' }}>
                        {kpis.matchedOrders} / {kpis.totalOrders - kpis.exemptOrders} đơn bắt buộc
                    </p>
                </div>

                {/* 2. Missing Invoices */}
                <div
                    onClick={() => { setStatusFilter('MISSING_INVOICE'); setPage(1) }}
                    className="p-4 rounded-md transition-all cursor-pointer hover:border-[#EF4444]"
                    style={{
                        background: '#FFFFFF',
                        border: statusFilter === 'MISSING_INVOICE' ? '2px solid #EF4444' : '1px solid #E2E8F0',
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
                        background: '#FFFFFF',
                        border: statusFilter === 'PENDING_SIGN' ? '2px solid #D4A853' : '1px solid #E2E8F0',
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
                        background: '#FFFFFF',
                        border: statusFilter === 'DISCREPANCY' ? '2px solid #F97316' : '1px solid #E2E8F0',
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
                        background: '#FFFFFF',
                        border: statusFilter === 'EXEMPT' ? '2px solid #94A3B8' : '1px solid #E2E8F0',
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
            <div className="p-4 rounded-md space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
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
                                        background: active ? '#FFFFFF' : 'transparent',
                                        color: active ? '#87CBB9' : '#475569',
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
                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                            >
                                <option value="">Tất cả pháp nhân</option>
                                {legalEntities.map(le => (
                                    <option key={le.id} value={le.id}>{le.code} - {le.name}</option>
                                ))}
                            </select>
                        )}

                        <div className="relative flex-1 min-w-[220px]">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1) }}
                                placeholder="Tìm SO, Khách hàng, MST, Số HĐ..."
                                className="w-full text-xs pl-8 pr-3 py-1.5 rounded outline-none"
                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Custom Date Range Picker */}
                {period === 'custom' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200 text-xs">
                        <span style={{ color: '#475569' }}>Từ ngày:</span>
                        <input
                            type="date"
                            value={customFrom}
                            onChange={e => { setCustomFrom(e.target.value); setPage(1) }}
                            className="px-2 py-1 rounded text-xs outline-none"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                        />
                        <span style={{ color: '#475569' }}>Đến ngày:</span>
                        <input
                            type="date"
                            value={customTo}
                            onChange={e => { setCustomTo(e.target.value); setPage(1) }}
                            className="px-2 py-1 rounded text-xs outline-none"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                        />
                    </div>
                )}

                {/* Status Filter Tabs / Pills */}
                <div className="flex items-center gap-1.5 pt-2.5 border-t border-slate-200 flex-wrap">
                    <span className="text-[11px] font-bold mr-1 flex items-center gap-1 uppercase tracking-wider" style={{ color: '#475569' }}>
                        <Filter size={11} /> Lọc Trạng Thái:
                    </span>

                    {[
                        { key: 'ALL' as const, label: 'Tất Cả', count: kpis.totalOrders, color: '#475569', activecolor: '#0891B2', activeBg: '#FFFFFF' },
                        { key: 'MISSING_INVOICE' as const, label: 'Thiếu HĐ', count: kpis.missingOrders, color: '#EF4444', activeColor: '#EF4444', activeBg: 'rgba(239,68,68,0.15)' },
                        { key: 'DISCREPANCY' as const, label: 'Lệch Tiền', count: kpis.discrepancyOrders, color: '#F97316', activeColor: '#F97316', activeBg: 'rgba(249,115,22,0.15)' },
                        { key: 'PENDING_SIGN' as const, label: 'Chờ Ký Số', count: kpis.pendingSignOrders, color: '#D4A853', activeColor: '#D4A853', activeBg: 'rgba(212,168,83,0.15)' },
                        { key: 'MATCHED' as const, label: 'Đã Khớp', count: kpis.matchedOrders, color: '#5BA88A', activeColor: '#5BA88A', activeBg: 'rgba(91,168,138,0.15)' },
                        { key: 'EXEMPT' as const, label: 'Miễn HĐ', count: kpis.exemptOrders, color: '#94A3B8', activeColor: '#94A3B8', activeBg: 'rgba(100,116,139,0.15)' },
                    ].map(tab => {
                        const active = statusFilter === tab.key
                        return (
                            <button
                                key={tab.key}
                                onClick={() => { setStatusFilter(tab.key); setPage(1) }}
                                className="px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer flex items-center gap-1.5 hover:opacity-90"
                                style={{
                                    background: active ? tab.activeBg : '#111F2D',
                                    color: active ? tab.activeColor : '#475569',
                                    border: active ? `1.5px solid ${tab.activeColor}` : '1px solid #E2E8F0',
                                    fontWeight: active ? 700 : 500,
                                }}
                            >
                                <span>{tab.label}</span>
                                <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold leading-none"
                                    style={{
                                        background: active ? tab.activeColor : '#1E3547',
                                        color: active ? '#F8FAFC' : tab.color,
                                    }}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        )
                    })}

                    {statusFilter !== 'ALL' && (
                        <button
                            onClick={() => { setStatusFilter('ALL'); setPage(1) }}
                            className="text-[11px] ml-auto px-2 py-0.5 rounded text-slate-400 hover:text-white underline cursor-pointer"
                        >
                            Xóa bộ lọc
                        </button>
                    )}
                </div>
            </div>

            {/* Reconciliation Data Table */}
            <div className="rounded-md overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
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
                                    <td colSpan={8} className="py-12 text-center" style={{ color: '#475569' }}>
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Đang tải dữ liệu đối chiếu...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center" style={{ color: '#64748B' }}>
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
                                            className="transition-colors hover:bg-white/50"
                                            style={{ borderBottom: '1px solid #E2E8F0' }}
                                        >
                                            {/* 1. SO No & Date */}
                                            <td className="py-3 px-3.5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-bold font-mono text-[#0891B2]">{r.soNo}</span>
                                                    {r.dateWarning?.isDifferentMonth && (
                                                        <span 
                                                            className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 cursor-help" 
                                                            title={r.dateWarning.message}
                                                        >
                                                            ⚠️ Lệch kỳ thuế
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px]" style={{ color: '#64748B' }}>
                                                    {new Date(r.orderDate).toLocaleDateString('vi-VN')}
                                                </div>
                                            </td>

                                            {/* 2. Customer & Tax ID */}
                                            <td className="py-3 px-3 max-w-[220px]">
                                                <div className="font-medium truncate text-slate-900" title={r.customerName}>
                                                    {r.customerName}
                                                </div>
                                                <div className="text-[11px] font-mono mt-0.5" style={{ color: '#475569' }}>
                                                    MST: {r.taxId}
                                                </div>
                                            </td>

                                            {/* 3. Legal Entity */}
                                            <td className="py-3 px-2">
                                                <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#D4A853' }}>
                                                    {r.legalEntityCode || 'TA'}
                                                </span>
                                            </td>

                                            {/* 4. Order Total & VAT */}
                                            <td className="py-3 px-3 text-right">
                                                <div className="font-mono font-bold text-slate-900">
                                                    {formatVND(r.orderTotal)}
                                                </div>
                                                <div className="text-[10px]" style={{ color: '#64748B' }}>
                                                    VAT: {formatVND(r.orderVat)}
                                                </div>
                                            </td>

                                            {/* 5. Invoice Total & Variance */}
                                            <td className="py-3 px-3 text-right">
                                                {r.invoiceTotal !== null ? (
                                                    <div>
                                                        <div className="font-mono font-medium text-slate-900">
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
                                                    <span className="text-[11px]" style={{ color: '#64748B' }}>—</span>
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
                                                        <div className="font-mono font-bold text-xs text-slate-900">
                                                            {r.invoiceNo}
                                                        </div>
                                                        {r.taxAuthorityCode && (
                                                            <div className="text-[10px] font-mono truncate max-w-[130px] text-emerald-400" title={r.taxAuthorityCode}>
                                                                CQT: {r.taxAuthorityCode}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px]" style={{ color: '#64748B' }}>Chưa cấp</span>
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

                                                    {/* If Pending Sign: Hủy nháp button */}
                                                    {r.reconciliationStatus === 'PENDING_SIGN' && (
                                                        <button
                                                            onClick={() => handleDeleteDraft(r.soId, r.soNo)}
                                                            disabled={deletingSoId === r.soId}
                                                            className="text-[10px] px-2 py-1 rounded font-bold border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 shadow-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                            title="Hủy bản nháp hóa đơn này để đưa đơn hàng về trạng thái chưa xuất HĐ"
                                                        >
                                                            {deletingSoId === r.soId ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                                            Hủy Nháp
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
                                                        className="text-[10px] px-2 py-1 rounded font-medium border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white transition-all flex items-center gap-1 cursor-pointer"
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
        </>
    ) : (
        <div className="space-y-6">
            {/* Top Header & Actions for VNPT */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: '#0F172A' }}>
                        <span>Danh Sách Hóa Đơn Điện Tử VNPT</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Thắng Ân (TA) & Ly's Cellar (LC)
                        </span>
                    </h3>
                    <p className="text-xs mt-1" style={{ color: '#475569' }}>
                        Liệt kê toàn bộ hóa đơn phát hành từ portal VNPT và phát hiện hóa đơn nào chưa được gán vào đơn hàng ERP
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={vnptUploading || vnptLoading}
                        className="px-3.5 py-2 rounded-md text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-slate-900"
                        style={{ background: '#87CBB9' }}
                        title="Tải lên file bảng kê chi tiết (.xlsx) xuất từ portal VNPT"
                    >
                        {vnptUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        Tải File Excel VNPT
                    </button>

                    <button
                        onClick={handleVnptExport}
                        disabled={vnptExporting || vnptLoading}
                        className="px-3.5 py-2 rounded-md text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-slate-200 text-slate-900 hover:bg-white disabled:opacity-50"
                        title="Xuất file Excel danh sách hóa đơn VNPT và trạng thái gán đơn"
                    >
                        {vnptExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        Xuất Excel Bảng Kê
                    </button>

                    <button
                        onClick={loadVnptData}
                        disabled={vnptLoading}
                        className="p-2 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white cursor-pointer"
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw size={14} className={vnptLoading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* 4 VNPT KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Total Invoices */}
                <div
                    onClick={() => { setVnptStatus('ALL'); setVnptPage(1) }}
                    className="p-4 rounded-md transition-all cursor-pointer hover:border-[#87CBB9]"
                    style={{
                        background: '#FFFFFF',
                        border: vnptStatus === 'ALL' ? '2px solid #87CBB9' : '1px solid #E2E8F0',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>
                            Tổng HĐ Phát Hành
                        </span>
                        <Building2 size={16} style={{ color: '#0891B2' }} />
                    </div>
                    <p className="text-2xl font-bold font-mono" style={{ color: '#0891B2' }}>
                        {vnptKpis.totalInvoices} <span className="text-xs font-normal">hóa đơn</span>
                    </p>
                    <p className="text-[11px] mt-1 font-mono" style={{ color: '#64748B' }}>
                        {formatVND(vnptKpis.totalAmount)}
                    </p>
                </div>

                {/* 2. Assigned Invoices */}
                <div
                    onClick={() => { setVnptStatus('ASSIGNED'); setVnptPage(1) }}
                    className="p-4 rounded-md transition-all cursor-pointer hover:border-[#5BA88A]"
                    style={{
                        background: '#FFFFFF',
                        border: vnptStatus === 'ASSIGNED' ? '2px solid #5BA88A' : '1px solid #E2E8F0',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#5BA88A' }}>
                            Đã Gán Vào Đơn ERP
                        </span>
                        <CheckCircle2 size={16} style={{ color: '#5BA88A' }} />
                    </div>
                    <p className="text-2xl font-bold font-mono" style={{ color: '#5BA88A' }}>
                        {vnptKpis.assignedCount} <span className="text-xs font-normal">hóa đơn</span>
                    </p>
                    <p className="text-[11px] mt-1 font-mono text-emerald-400/80">
                        {formatVND(vnptKpis.assignedAmount)}
                    </p>
                </div>

                {/* 3. Unassigned / Orphan Invoices */}
                <div
                    onClick={() => { setVnptStatus('UNASSIGNED'); setVnptPage(1) }}
                    className="p-4 rounded-md transition-all cursor-pointer hover:border-[#EF4444]"
                    style={{
                        background: '#FFFFFF',
                        border: vnptStatus === 'UNASSIGNED' ? '2px solid #EF4444' : '1px solid #E2E8F0',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#EF4444' }}>
                            Chưa Gán Đơn (Cần Gán)
                        </span>
                        <AlertCircle size={16} style={{ color: '#EF4444' }} />
                    </div>
                    <p className="text-2xl font-bold font-mono" style={{ color: '#EF4444' }}>
                        {vnptKpis.unassignedCount} <span className="text-xs font-normal">hóa đơn</span>
                    </p>
                    <p className="text-[11px] mt-1 font-mono text-rose-300">
                        {formatVND(vnptKpis.unassignedAmount)}
                    </p>
                </div>

                {/* 4. Special Invoices (Adjustments / Internal Transfers) */}
                <div
                    onClick={() => { setVnptStatus('SPECIAL'); setVnptPage(1) }}
                    className="p-4 rounded-md transition-all cursor-pointer hover:border-[#94A3B8]"
                    style={{
                        background: '#FFFFFF',
                        border: vnptStatus === 'SPECIAL' ? '2px solid #94A3B8' : '1px solid #E2E8F0',
                    }}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>
                            HĐ Điều Chỉnh & Nội Bộ
                        </span>
                        <FileX2 size={16} style={{ color: '#94A3B8' }} />
                    </div>
                    <p className="text-2xl font-bold font-mono" style={{ color: '#94A3B8' }}>
                        {vnptKpis.specialCount} <span className="text-xs font-normal">hóa đơn</span>
                    </p>
                    <p className="text-[11px] mt-1 font-mono text-slate-400">
                        {formatVND(vnptKpis.specialAmount)}
                    </p>
                </div>
            </div>

            {/* Filter & Search Bar for VNPT */}
            <div className="p-4 rounded-md space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={vnptEntity}
                            onChange={e => { setVnptEntity(e.target.value as any); setVnptPage(1) }}
                            className="text-xs px-3 py-1.5 rounded outline-none cursor-pointer"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                        >
                            <option value="ALL">Tất cả pháp nhân (TA & LC)</option>
                            <option value="TA">Thắng Ân (TA - C26TTA)</option>
                            <option value="LC">Ly's Cellar (LC - C26TLY)</option>
                        </select>
                    </div>

                    <div className="relative flex-1 max-w-md">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                        <input
                            type="text"
                            value={vnptSearch}
                            onChange={e => { setVnptSearch(e.target.value); setVnptPage(1) }}
                            placeholder="Tìm số HĐ, MST, Tên đơn vị mua, Mã SO..."
                            className="w-full text-xs pl-8 pr-3 py-1.5 rounded outline-none"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                        />
                    </div>
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5 pt-2.5 border-t border-slate-200 flex-wrap">
                    <span className="text-[11px] font-bold mr-1 flex items-center gap-1 uppercase tracking-wider" style={{ color: '#475569' }}>
                        <Filter size={11} /> Lọc Trạng Thái:
                    </span>

                    {[
                        { key: 'ALL' as const, label: 'Tất Cả', count: vnptKpis.totalInvoices, color: '#475569', activecolor: '#0891B2', activeBg: '#FFFFFF' },
                        { key: 'UNASSIGNED' as const, label: 'Chưa Gán Đơn', count: vnptKpis.unassignedCount, color: '#EF4444', activeColor: '#EF4444', activeBg: 'rgba(239,68,68,0.15)' },
                        { key: 'ASSIGNED' as const, label: 'Đã Gán Đơn', count: vnptKpis.assignedCount, color: '#5BA88A', activeColor: '#5BA88A', activeBg: 'rgba(91,168,138,0.15)' },
                        { key: 'SPECIAL' as const, label: 'Điều Chỉnh / Nội Bộ', count: vnptKpis.specialCount, color: '#94A3B8', activeColor: '#94A3B8', activeBg: 'rgba(100,116,139,0.15)' },
                    ].map(tab => {
                        const active = vnptStatus === tab.key
                        return (
                            <button
                                key={tab.key}
                                onClick={() => { setVnptStatus(tab.key); setVnptPage(1) }}
                                className="px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer flex items-center gap-1.5 hover:opacity-90"
                                style={{
                                    background: active ? tab.activeBg : '#111F2D',
                                    color: active ? tab.activeColor : '#475569',
                                    border: active ? `1.5px solid ${tab.activeColor}` : '1px solid #E2E8F0',
                                    fontWeight: active ? 700 : 500,
                                }}
                            >
                                <span>{tab.label}</span>
                                <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold leading-none"
                                    style={{
                                        background: active ? tab.activeColor : '#1E3547',
                                        color: active ? '#F8FAFC' : tab.color,
                                    }}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        )
                    })}

                    {vnptStatus !== 'ALL' && (
                        <button
                            onClick={() => { setVnptStatus('ALL'); setVnptPage(1) }}
                            className="text-[11px] ml-auto px-2 py-0.5 rounded text-slate-400 hover:text-white underline cursor-pointer"
                        >
                            Xóa bộ lọc
                        </button>
                    )}
                </div>
            </div>

            {/* VNPT Table */}
            <div className="rounded-md overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                                <th className="py-3 px-3.5 font-semibold">Số HĐ / Ký Hiệu</th>
                                <th className="py-3 px-3 font-semibold">Ngày Lập</th>
                                <th className="py-3 px-2 font-semibold">Pháp Nhân</th>
                                <th className="py-3 px-3 font-semibold">Đơn Vị Mua / MST</th>
                                <th className="py-3 px-3 text-right font-semibold">Tổng Thanh Toán</th>
                                <th className="py-3 px-3 text-center font-semibold">Trạng Thái Gán</th>
                                <th className="py-3 px-3 font-semibold">Đơn Hàng ERP Liên Kết</th>
                                <th className="py-3 px-3 text-right font-semibold">Thao Tác</th>
                            </tr>
                        </thead>

                        <tbody>
                            {vnptLoading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center" style={{ color: '#475569' }}>
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Đang tải danh sách hóa đơn VNPT...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : vnptItems.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center" style={{ color: '#64748B' }}>
                                        Không tìm thấy hóa đơn nào phù hợp với bộ lọc.
                                    </td>
                                </tr>
                            ) : (
                                vnptItems.map(item => {
                                    const isUnlinking = unlinkingInvNo === item.invNo
                                    return (
                                        <tr
                                            key={`${item.entityCode}_${item.invNo}`}
                                            className="transition-colors hover:bg-white/50"
                                            style={{ borderBottom: '1px solid #E2E8F0' }}
                                        >
                                            {/* 1. Invoice No & Serial */}
                                            <td className="py-3 px-3.5">
                                                <div className="font-mono font-bold text-sm text-[#0891B2]">
                                                    #{item.invNo}
                                                </div>
                                                <div className="text-[10px] font-mono" style={{ color: '#475569' }}>
                                                    {item.serial} • {item.pattern}
                                                </div>
                                            </td>

                                            {/* 2. Issue Date */}
                                            <td className="py-3 px-3">
                                                <div className="font-medium text-slate-900">{item.issueDate}</div>
                                                <div className="text-[10px]" style={{ color: '#64748B' }}>{item.itemCount} dòng SP</div>
                                            </td>

                                            {/* 3. Legal Entity */}
                                            <td className="py-3 px-2">
                                                <span
                                                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                                                    style={{
                                                        background: item.entityCode === 'LC' ? 'rgba(56,189,248,0.15)' : 'rgba(212,168,83,0.15)',
                                                        color: item.entityCode === 'LC' ? '#38BDF8' : '#D4A853',
                                                        border: item.entityCode === 'LC' ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(212,168,83,0.3)',
                                                    }}
                                                >
                                                    {item.entityCode}
                                                </span>
                                            </td>

                                            {/* 4. Buyer & TaxId */}
                                            <td className="py-3 px-3 max-w-[240px]">
                                                <div className="font-semibold text-slate-900 truncate" title={item.buyerName}>
                                                    {item.buyerName}
                                                </div>
                                                <div className="text-[11px] font-mono text-slate-600">
                                                    MST: {item.buyerTaxId || 'Khách lẻ'}
                                                </div>
                                                {item.note && (
                                                    <div className="text-[10px] italic text-amber-400/80 truncate mt-0.5" title={item.note}>
                                                        📝 {item.note}
                                                    </div>
                                                )}
                                            </td>

                                            {/* 5. Gross & Net/Vat */}
                                            <td className="py-3 px-3 text-right font-mono">
                                                <div className="font-bold text-slate-900">
                                                    {formatVND(item.totalGross)}
                                                </div>
                                                <div className="text-[10px]" style={{ color: '#475569' }}>
                                                    Net: {formatVND(item.totalNet)} | VAT: {formatVND(item.totalVat)}
                                                </div>
                                            </td>

                                            {/* 6. Assignment Status */}
                                            <td className="py-3 px-3 text-center">
                                                {item.isAssigned ? (
                                                    <span
                                                        className="px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1"
                                                        style={{
                                                            background: 'rgba(91,168,138,0.15)',
                                                            color: '#5BA88A',
                                                            border: '1px solid rgba(91,168,138,0.4)',
                                                        }}
                                                    >
                                                        <Check size={12} /> Đã Gán Đơn
                                                    </span>
                                                ) : item.specialType === 'ADJUSTMENT' ? (
                                                    <span
                                                        className="px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1"
                                                        style={{
                                                            background: 'rgba(100,116,139,0.15)',
                                                            color: '#94A3B8',
                                                            border: '1px solid rgba(100,116,139,0.3)',
                                                        }}
                                                    >
                                                        HĐ Điều Chỉnh Giảm
                                                    </span>
                                                ) : item.specialType === 'INTERNAL_TRANSFER' ? (
                                                    <span
                                                        className="px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1"
                                                        style={{
                                                            background: 'rgba(100,116,139,0.15)',
                                                            color: '#38BDF8',
                                                            border: '1px solid rgba(56,189,248,0.3)',
                                                        }}
                                                    >
                                                        Điều Chuyển Nội Bộ
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1"
                                                        style={{
                                                            background: 'rgba(239,68,68,0.15)',
                                                            color: '#EF4444',
                                                            border: '1px solid rgba(239,68,68,0.4)',
                                                        }}
                                                    >
                                                        <AlertCircle size={12} /> Chưa Gán Đơn
                                                    </span>
                                                )}
                                            </td>

                                            {/* 7. Linked ERP SO */}
                                            <td className="py-3 px-3">
                                                {item.isAssigned && item.linkedSoNo ? (
                                                    <div>
                                                        <div className="font-mono font-bold text-[#0891B2] flex items-center gap-1">
                                                            <span>{item.linkedSoNo}</span>
                                                            {item.variance !== undefined && Math.abs(item.variance) > 1000 && (
                                                                <span
                                                                    className="text-[10px] px-1 py-0.2 rounded font-mono font-bold bg-amber-500/20 text-amber-300"
                                                                    title={`Lệch ${formatVND(item.variance)}`}
                                                                >
                                                                    Lệch {formatVND(Math.abs(item.variance))}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-slate-600 truncate max-w-[200px]" title={item.linkedCustomerName}>
                                                            {item.linkedCustomerName}
                                                        </div>
                                                        {item.linkedSoGross && (
                                                            <div className="text-[10px] font-mono" style={{ color: '#64748B' }}>
                                                                Đơn: {formatVND(item.linkedSoGross)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 italic text-[11px]">Chưa liên kết</span>
                                                )}
                                            </td>

                                            {/* 8. Action */}
                                            <td className="py-3 px-3 text-right">
                                                {item.isAssigned ? (
                                                    <button
                                                        onClick={() => handleUnlinkVnpt(item)}
                                                        disabled={isUnlinking}
                                                        className="px-2.5 py-1 rounded text-[11px] font-semibold transition-all border border-slate-200 text-slate-600 hover:text-rose-400 hover:border-rose-500/40 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                                        title="Hủy gán số hóa đơn này khỏi đơn hàng ERP"
                                                    >
                                                        {isUnlinking ? <Loader2 size={11} className="animate-spin" /> : <Unlink size={11} />}
                                                        Bỏ Gán
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleOpenVnptLinkModal(item)}
                                                        className="px-2.5 py-1 rounded text-[11px] font-bold transition-all shadow-sm cursor-pointer inline-flex items-center gap-1 text-slate-900"
                                                        style={{ background: '#87CBB9' }}
                                                        title="Tìm đơn hàng ERP để gán số hóa đơn này"
                                                    >
                                                        <Link2 size={11} /> Gán Đơn
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* VNPT Pagination */}
                <div className="p-3 border-t border-slate-200">
                    <DataPagination
                        total={vnptTotal}
                        page={vnptPage}
                        pageSize={vnptPageSize}
                        onPageChange={p => setVnptPage(p)}
                    />
                </div>
            </div>
        </div>
    )}

    {/* Manual Link Invoice Modal (SO View) */}
    {linkModalOpen && linkTargetRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div
                className="w-full max-w-md p-6 rounded-lg shadow-2xl space-y-4"
                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
            >
                <div className="flex items-center justify-between">
                    <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                        <Link2 size={16} className="text-[#0891B2]" />
                        Gán Số Hóa Đơn VAT
                    </h4>
                    <button
                        onClick={() => setLinkModalOpen(false)}
                        className="text-xs px-2 py-1 rounded text-slate-600 hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-3 rounded text-xs space-y-1" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div className="flex justify-between">
                        <span style={{ color: '#475569' }}>Mã Đơn Hàng:</span>
                        <span className="font-mono font-bold text-[#0891B2]">{linkTargetRow.soNo}</span>
                    </div>
                    <div className="flex justify-between">
                        <span style={{ color: '#475569' }}>Khách Hàng:</span>
                        <span className="font-medium text-slate-900 truncate max-w-[200px]">{linkTargetRow.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                        <span style={{ color: '#475569' }}>Tổng Tiền:</span>
                        <span className="font-mono font-bold text-slate-900">{formatVND(linkTargetRow.orderTotal)}</span>
                    </div>
                </div>

                <form onSubmit={handleManualLinkSubmit} className="space-y-3 text-xs">
                    <div>
                        <label className="block font-semibold mb-1" style={{ color: '#475569' }}>
                            Số Hóa Đơn Điện Tử VAT *
                        </label>
                        <input
                            type="text"
                            required
                            value={linkInvoiceNo}
                            onChange={e => setLinkInvoiceNo(e.target.value)}
                            placeholder="Ví dụ: C26TAB-00000190 hoặc 00000190"
                            className="w-full px-3 py-2 rounded font-mono text-sm outline-none"
                            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' }}
                        />
                        <p className="text-[10px] mt-1" style={{ color: '#64748B' }}>
                            Nhập số hóa đơn đã xuất trên cổng VNPT / Viettel / MISA để gắn vào đơn hàng.
                        </p>
                    </div>

                    <div>
                        <label className="block font-semibold mb-1" style={{ color: '#475569' }}>
                            Ghi Chú Kế Toán (Tùy chọn)
                        </label>
                        <textarea
                            rows={2}
                            value={linkNotes}
                            onChange={e => setLinkNotes(e.target.value)}
                            placeholder="Lý do gán thủ công / Ngày phát hành thực tế..."
                            className="w-full px-3 py-1.5 rounded text-xs outline-none"
                            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' }}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setLinkModalOpen(false)}
                            className="px-4 py-2 rounded font-semibold text-xs border border-slate-200 text-slate-600 hover:text-white"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={linking || !linkInvoiceNo.trim()}
                            className="px-4 py-2 rounded font-bold text-xs text-slate-900 transition-all disabled:opacity-50 flex items-center gap-1.5"
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

    {/* Modal Gán Hóa Đơn VNPT Vào Đơn Hàng ERP */}
    {vnptLinkModalOpen && selectedVnptItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div
                className="w-full max-w-2xl rounded-lg shadow-2xl p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col"
                style={{ background: '#FFFFFF' }}
            >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
                    <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Link2 size={18} style={{ color: '#0891B2' }} />
                        Gán Hóa Đơn VNPT Vào Đơn Hàng ERP
                    </h4>
                    <button
                        onClick={() => setVnptLinkModalOpen(false)}
                        className="text-slate-400 hover:text-white cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Invoice Info Card */}
                <div className="p-3 rounded text-xs space-y-1.5 shrink-0" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <span style={{ color: '#475569' }}>Số Hóa Đơn: </span>
                            <span className="font-mono font-bold text-[#0891B2]">#{selectedVnptItem.invNo}</span>
                            <span className="text-[10px] text-slate-600 ml-1">({selectedVnptItem.serial})</span>
                        </div>
                        <div>
                            <span style={{ color: '#475569' }}>Ngày Phát Hành: </span>
                            <span className="font-medium text-slate-900">{selectedVnptItem.issueDate}</span>
                        </div>
                        <div className="col-span-2">
                            <span style={{ color: '#475569' }}>Đơn Vị Mua: </span>
                            <span className="font-semibold text-slate-900">{selectedVnptItem.buyerName}</span>
                            {selectedVnptItem.buyerTaxId && (
                                <span className="text-[11px] font-mono text-slate-600 ml-2">MST: {selectedVnptItem.buyerTaxId}</span>
                            )}
                        </div>
                        <div>
                            <span style={{ color: '#475569' }}>Tổng Thanh Toán: </span>
                            <span className="font-mono font-bold text-emerald-400 text-sm">{formatVND(selectedVnptItem.totalGross)}</span>
                        </div>
                        <div>
                            <span style={{ color: '#475569' }}>Pháp Nhân Bán: </span>
                            <span className="font-bold text-amber-300">{selectedVnptItem.entityCode === 'TA' ? 'Thắng Ân (TA)' : "Ly's Cellar (LC)"}</span>
                        </div>
                    </div>
                </div>

                {/* Order Search Box */}
                <div className="space-y-2 shrink-0">
                    <label className="block text-xs font-semibold text-slate-600">
                        Tìm Đơn Bán Hàng (SO) Trong ERP Để Gán:
                    </label>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            value={soSearchQuery}
                            onChange={e => handleSearchSos(e.target.value)}
                            placeholder="Gõ mã đơn SO (vd: SO-2608-0045) hoặc tên khách hàng..."
                            className="w-full text-xs pl-9 pr-3 py-2 rounded outline-none"
                            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' }}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Order Candidates List */}
                <div className="overflow-y-auto flex-1 border border-slate-200 rounded-md max-h-[260px]" style={{ background: '#F8FAFC' }}>
                    {soSearching ? (
                        <div className="py-8 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            <span>Đang tìm kiếm đơn hàng...</span>
                        </div>
                    ) : soCandidates.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500">
                            Không tìm thấy đơn hàng nào phù hợp với từ khóa "{soSearchQuery}".
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {soCandidates.map(order => {
                                const variance = order.grossAmount - selectedVnptItem.totalGross
                                const isExact = Math.abs(variance) < 100
                                const isLinkingThis = linkingToSoId === order.id

                                return (
                                    <div
                                        key={order.id}
                                        className="p-3 hover:bg-white/50 transition-colors flex items-center justify-between gap-3 text-xs"
                                    >
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-[#0891B2]">{order.soNo}</span>
                                                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-white text-slate-600">
                                                    {new Date(order.orderDate).toLocaleDateString('vi-VN')}
                                                </span>
                                                {order.currentInvoiceNo && (
                                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                                                        HĐ hiện tại: #{order.currentInvoiceNo}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-medium text-slate-900 truncate max-w-sm">
                                                {order.customerName}
                                                {order.customerTaxId && <span className="text-slate-600 ml-1">({order.customerTaxId})</span>}
                                            </div>
                                            <div className="flex items-center gap-2 font-mono text-[11px]">
                                                <span className="text-slate-900">Tiền đơn: {formatVND(order.grossAmount)}</span>
                                                <span
                                                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                                        isExact ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                                    }`}
                                                >
                                                    {isExact ? 'Khớp 100%' : `Lệch ${formatVND(Math.abs(variance))}`}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handlePerformLinkVnpt(order.id, order.soNo)}
                                            disabled={isLinkingThis}
                                            className="px-3 py-1.5 rounded text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50 text-slate-900 flex items-center gap-1.5"
                                            style={{ background: '#87CBB9' }}
                                        >
                                            {isLinkingThis ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                            Chọn & Gán
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Optional Notes */}
                <div className="shrink-0 text-xs space-y-1">
                    <label className="block text-slate-600 font-semibold">
                        Ghi Chú Gán (Tùy chọn):
                    </label>
                    <input
                        type="text"
                        value={vnptLinkNotes}
                        onChange={e => setVnptLinkNotes(e.target.value)}
                        placeholder="Ghi chú kế toán..."
                        className="w-full text-xs px-3 py-1.5 rounded outline-none"
                        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' }}
                    />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 shrink-0">
                    <button
                        type="button"
                        onClick={() => setVnptLinkModalOpen(false)}
                        className="px-4 py-1.5 rounded font-semibold text-xs border border-slate-200 text-slate-600 hover:text-white"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )}
        </div>
    )
}
