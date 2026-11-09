'use client'

import { useState, useEffect, useMemo } from 'react'
import { ArrowRightLeft, ArrowRight, Plus, Eye, RefreshCw, Search, Clock, CheckCircle2, Truck, PackageCheck, FileText, Ban, ArrowUpDown, ArrowUp, ArrowDown, Zap, ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import { type TransferOrderRow, getTransferOrders, cancelTransferOrder } from '../transfers/actions'
import { CreateTransferDrawer } from '../transfers/CreateTransferDrawer'
import { TransferDetailDrawer } from '../transfers/TransferDetailDrawer'
import { ReplenishmentTab } from './ReplenishmentTab'
import { formatDate } from '@/lib/utils'
import { useConfirmDialog } from '@/components/ui'

type SortField =
    | 'transferNo'
    | 'fromWarehouse'
    | 'toWarehouse'
    | 'requesterName'
    | 'transferDate'
    | 'lineCount'
    | 'totalQty'
    | 'status'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    DRAFT: { label: 'Nháp', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
    PENDING_ACCOUNTING: { label: 'Chờ Kế Toán Duyệt', color: '#B47816', bg: 'rgba(180,83,9,0.15)', border: '#F59E0B' },
    CONFIRMED: { label: 'Kế Toán Đã Duyệt', color: '#0284C7', bg: 'rgba(2,132,199,0.12)', border: '#38BDF8' },
    IN_TRANSIT: { label: 'Đang Chuyển', color: '#2563EB', bg: 'rgba(37,99,235,0.12)', border: '#60A5FA' },
    RECEIVED: { label: 'Đã Nhận Hàng', color: '#16A34A', bg: 'rgba(22,163,74,0.12)', border: '#4ADE80' },
    CANCELLED: { label: 'Đã Hủy', color: '#B91C1C', bg: 'rgba(185,28,28,0.12)', border: '#B91C1C' },
}

export function TransfersTab() {
    const [subTab, setSubTab] = useState<'transfers' | 'replenishment'>('transfers')
    const [rows, setRows] = useState<TransferOrderRow[]>([])
    const [loading, setLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    const [statusTab, setStatusTab] = useState<string>('ALL')
    const [search, setSearch] = useState('')
    const [fromWhFilter, setFromWhFilter] = useState('')
    const [toWhFilter, setToWhFilter] = useState('')
    const [showStats, setShowStats] = useState(true)

    // Sắp xếp mặc định: ngày chuyển giảm dần (mới nhất lên đầu)
    const [sortField, setSortField] = useState<SortField>('transferDate')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortField(field)
            const defaultDesc = field === 'transferDate' || field === 'totalQty' || field === 'lineCount'
            setSortOrder(defaultDesc ? 'desc' : 'asc')
        }
    }

    const reload = async () => {
        setLoading(true)
        try {
            const data = await getTransferOrders()
            setRows(data)
        } catch (err: any) {
            toast.error('Lỗi tải danh sách phiếu chuyển kho: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { reload() }, [])

    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    const handleCancel = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        confirm({
            title: 'Hủy phiếu chuyển kho',
            message: 'Bạn có chắc chắn muốn hủy Phiếu Chuyển Kho này? Thao tác này sẽ chuyển trạng thái phiếu sang Đã hủy.',
            danger: true,
            confirmLabel: 'Hủy phiếu',
            onConfirm: async () => {
                try {
                    const res = await cancelTransferOrder(id)
                    if (!res.success) throw new Error(res.error)
                    toast.success('Đã hủy phiếu chuyển kho thành công')
                    reload()
                } catch (err: any) {
                    toast.error('Lỗi hủy phiếu: ' + err.message)
                }
            }
        })
    }

    const fromWhOptions = useMemo(() => Array.from(new Set(rows.map(r => r.fromWarehouse))).sort((a, b) => a.localeCompare(b, 'vi')), [rows])
    const toWhOptions = useMemo(() => Array.from(new Set(rows.map(r => r.toWarehouse))).sort((a, b) => a.localeCompare(b, 'vi')), [rows])

    const filteredRows = rows.filter(r => {
        const matchesStatus = statusTab === 'ALL' || r.status === statusTab
        const matchesFrom = !fromWhFilter || r.fromWarehouse === fromWhFilter
        const matchesTo = !toWhFilter || r.toWarehouse === toWhFilter
        const matchesSearch = !search ||
            r.transferNo.toLowerCase().includes(search.toLowerCase()) ||
            r.fromWarehouse.toLowerCase().includes(search.toLowerCase()) ||
            r.toWarehouse.toLowerCase().includes(search.toLowerCase()) ||
            r.requesterName.toLowerCase().includes(search.toLowerCase())
        return matchesStatus && matchesFrom && matchesTo && matchesSearch
    })

    const activeFilterCount = [search, fromWhFilter, toWhFilter, statusTab !== 'ALL' ? statusTab : ''].filter(Boolean).length
    const resetFilters = () => {
        setSearch('')
        setFromWhFilter('')
        setToWhFilter('')
        setStatusTab('ALL')
    }

    const sortedRows = [...filteredRows].sort((a, b) => {
        const dir = sortOrder === 'asc' ? 1 : -1

        switch (sortField) {
            case 'transferDate': {
                const timeA = a.transferDate ? new Date(a.transferDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
                const timeB = b.transferDate ? new Date(b.transferDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
                if (timeA !== timeB) return (timeA - timeB) * dir
                return a.transferNo.localeCompare(b.transferNo, undefined, { numeric: true }) * dir
            }
            case 'transferNo':
                return a.transferNo.localeCompare(b.transferNo, undefined, { numeric: true }) * dir
            case 'fromWarehouse':
                return a.fromWarehouse.localeCompare(b.fromWarehouse, 'vi') * dir
            case 'toWarehouse':
                return a.toWarehouse.localeCompare(b.toWarehouse, 'vi') * dir
            case 'requesterName':
                return (a.requesterName || '').localeCompare(b.requesterName || '', 'vi') * dir
            case 'lineCount':
                return (a.lineCount - b.lineCount) * dir
            case 'totalQty':
                return (a.totalQty - b.totalQty) * dir
            case 'status': {
                const labelA = STATUS_CFG[a.status]?.label || a.status
                const labelB = STATUS_CFG[b.status]?.label || b.status
                return labelA.localeCompare(labelB, 'vi') * dir
            }
            default:
                return 0
        }
    })

    const renderSortHeader = (field: SortField, label: React.ReactNode, align: 'left' | 'center' | 'right' = 'left') => {
        const isActive = sortField === field
        return (
            <th
                onClick={() => handleSort(field)}
                className={`px-3 py-2.5 font-extrabold uppercase text-[11px] whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-slate-100/80 group ${
                    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
                } ${isActive ? 'text-lys-teal-strong bg-lys-teal-soft/40' : 'text-slate-600'}`}
                title={`Sắp xếp theo ${typeof label === 'string' ? label : field}`}
            >
                <div className={`inline-flex items-center gap-1 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
                    <span>{label}</span>
                    {isActive ? (
                        sortOrder === 'asc' ? (
                            <ArrowUp size={12} className="text-lys-teal-strong font-bold shrink-0" />
                        ) : (
                            <ArrowDown size={12} className="text-lys-teal-strong font-bold shrink-0" />
                        )
                    ) : (
                        <ArrowUpDown size={11} className="text-slate-400 opacity-45 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                </div>
            </th>
        )
    }

    const statusCounts = {
        ALL: rows.length,
        PENDING_ACCOUNTING: rows.filter(r => r.status === 'PENDING_ACCOUNTING').length,
        CONFIRMED: rows.filter(r => r.status === 'CONFIRMED').length,
        IN_TRANSIT: rows.filter(r => r.status === 'IN_TRANSIT').length,
        RECEIVED: rows.filter(r => r.status === 'RECEIVED').length,
    }

    const totalBottlesTransferred = rows
        .filter(r => r.status !== 'CANCELLED')
        .reduce((sum, r) => sum + (r.totalQty ?? 0), 0)

    return (
        <div className="space-y-4 pb-8 md:pb-4">
            {/* ── TIER 1: Standardized Module Header Bar ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-lys-teal-soft border border-lys-teal-subtle flex items-center justify-center shrink-0">
                            <ArrowRightLeft size={18} className="text-lys-teal-strong" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                                    Điều Chuyển Kho Nội Bộ & Bổ Sung Tồn
                                </h3>
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-lys-teal-soft text-lys-teal-strong border border-lys-teal-subtle">
                                    {rows.length} phiếu
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Lập phiếu chuyển kho theo SKU, Vintage & vị trí, duyệt Kế toán và theo dõi vận chuyển
                            </p>
                        </div>
                    </div>

                    {/* Sub-Module Switcher */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setSubTab('transfers')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                subTab === 'transfers'
                                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <ArrowRightLeft size={13} className={subTab === 'transfers' ? 'text-lys-teal-strong' : 'text-slate-400'} />
                            <span>Phiếu Điều Chuyển ({rows.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSubTab('replenishment')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                subTab === 'replenishment'
                                    ? 'bg-white text-lys-teal-strong shadow-2xs border border-slate-200/80'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Zap size={13} className={subTab === 'replenishment' ? 'text-lys-teal-strong' : 'text-slate-400'} />
                            <span>Gợi Ý Bổ Sung Tồn</span>
                        </button>
                    </div>
                </div>

                {subTab === 'transfers' && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowStats(!showStats)}
                            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer transition-all"
                        >
                            {showStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            <span className="hidden sm:inline">Chỉ số</span>
                        </button>

                        <button
                            type="button"
                            onClick={reload}
                            disabled={loading}
                            className="p-2 rounded-lg text-slate-700 hover:bg-slate-50 border border-slate-200 bg-white transition-colors cursor-pointer"
                            title="Tải lại danh sách"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin text-lys-teal-strong' : ''} />
                        </button>

                        <button
                            type="button"
                            onClick={() => setCreateOpen(true)}
                            className="px-3.5 py-2 rounded-lg bg-lys-teal-strong hover:opacity-90 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                        >
                            <Plus size={14} /> Lập Phiếu Chuyển Kho
                        </button>
                    </div>
                )}
            </div>

            {subTab === 'replenishment' ? (
                <ReplenishmentTab />
            ) : (
                <>
                    {/* ── TIER 2: Collapsible KPI Stat Cards ── */}
                    {showStats && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                            <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col justify-between" style={{ borderLeft: '3px solid #0891B2' }}>
                                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Tổng Phiếu Điều Chuyển</span>
                                <div className="mt-1">
                                    <span className="text-lg sm:text-xl font-extrabold font-mono text-slate-900">{rows.length} phiếu</span>
                                </div>
                                <span className="text-[11px] text-slate-500 mt-1">
                                    Tổng luân chuyển: <strong className="font-mono text-slate-700">{totalBottlesTransferred.toLocaleString()}</strong> chai
                                </span>
                            </div>

                            <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col justify-between" style={{ borderLeft: '3px solid #B45309' }}>
                                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Chờ Kế Toán Duyệt</span>
                                <div className="mt-1">
                                    <span className="text-lg sm:text-xl font-extrabold font-mono text-amber-700">{statusCounts.PENDING_ACCOUNTING} phiếu</span>
                                </div>
                                <span className="text-[11px] text-slate-500 mt-1">
                                    Đã duyệt chờ xuất: <strong className="font-mono text-slate-700">{statusCounts.CONFIRMED}</strong> phiếu
                                </span>
                            </div>

                            <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col justify-between" style={{ borderLeft: '3px solid #2563EB' }}>
                                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Đang Vận Chuyển</span>
                                <div className="mt-1">
                                    <span className="text-lg sm:text-xl font-extrabold font-mono text-blue-700">{statusCounts.IN_TRANSIT} phiếu</span>
                                </div>
                                <span className="text-[11px] text-slate-500 mt-1">
                                    Hàng đang trên đường giữa các kho
                                </span>
                            </div>

                            <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col justify-between" style={{ borderLeft: '3px solid #15803D' }}>
                                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Đã Nhận Hoàn Tất</span>
                                <div className="mt-1">
                                    <span className="text-lg sm:text-xl font-extrabold font-mono text-emerald-700">{statusCounts.RECEIVED} phiếu</span>
                                </div>
                                <span className="text-[11px] text-slate-500 mt-1">
                                    Đã nhập vào vị trí kho nhận
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ── TIER 3: Unified Filter & Search Toolbar ── */}
                    <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-200 pb-3">
                            {[
                                { key: 'ALL', label: 'Tất Cả', count: statusCounts.ALL },
                                { key: 'PENDING_ACCOUNTING', label: 'Chờ Kế Toán Duyệt', count: statusCounts.PENDING_ACCOUNTING },
                                { key: 'CONFIRMED', label: 'Đã Duyệt', count: statusCounts.CONFIRMED },
                                { key: 'IN_TRANSIT', label: 'Đang Chuyển', count: statusCounts.IN_TRANSIT },
                                { key: 'RECEIVED', label: 'Hoàn Tất', count: statusCounts.RECEIVED },
                            ].map(t => {
                                const active = statusTab === t.key
                                return (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => setStatusTab(t.key)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap border ${
                                            active
                                                ? 'bg-lys-teal-strong text-white border-lys-teal-strong shadow-2xs'
                                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                                        }`}
                                    >
                                        <span>{t.label}</span>
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
                                            active ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                                        }`}>
                                            {t.count}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                            <div className="relative flex-1 min-w-[220px]">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Tìm mã phiếu chuyển, kho xuất, kho nhận, người lập..."
                                    className="w-full h-9 pl-9 pr-8 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-900 outline-none focus:border-lys-teal-strong"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>

                            <select
                                value={fromWhFilter}
                                onChange={e => setFromWhFilter(e.target.value)}
                                className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                            >
                                <option value="">Tất cả Kho Xuất</option>
                                {fromWhOptions.map(w => (
                                    <option key={w} value={w}>Xuất từ: {w}</option>
                                ))}
                            </select>

                            <select
                                value={toWhFilter}
                                onChange={e => setToWhFilter(e.target.value)}
                                className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                            >
                                <option value="">Tất cả Kho Nhận</option>
                                {toWhOptions.map(w => (
                                    <option key={w} value={w}>Nhận tại: {w}</option>
                                ))}
                            </select>

                            {activeFilterCount > 0 && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="flex items-center gap-1 px-2.5 py-1.5 h-9 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 cursor-pointer transition-all"
                                >
                                    <RotateCcw size={12} />
                                    <span>Xóa lọc ({activeFilterCount})</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── TIER 4: Desktop List Table ── */}
                    <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                        {renderSortHeader('transferNo', 'Mã Phiếu')}
                                        {renderSortHeader('fromWarehouse', 'Kho Xuất')}
                                        {renderSortHeader('toWarehouse', 'Kho Nhận')}
                                        {renderSortHeader('requesterName', 'Người Lập')}
                                        {renderSortHeader('transferDate', 'Ngày Chuyển')}
                                        {renderSortHeader('lineCount', 'Số Mặt Hàng', 'center')}
                                        {renderSortHeader('totalQty', 'Tổng Chai', 'center')}
                                        {renderSortHeader('status', 'Trạng Thái', 'center')}
                                        <th className="px-3 py-2.5 font-extrabold uppercase text-[11px] text-right whitespace-nowrap">Thao Tác</th>
                                    </tr>
                                </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {sortedRows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-400">
                                        Không tìm thấy phiếu chuyển kho nào
                                    </td>
                                </tr>
                            ) : (
                                sortedRows.map(r => {
                                    const st = STATUS_CFG[r.status] ?? STATUS_CFG.DRAFT
                                    return (
                                        <tr
                                            key={r.id}
                                            onClick={() => setSelectedId(r.id)}
                                            className="hover:bg-amber-50/40 transition-colors cursor-pointer"
                                        >
                                            <td className="p-3 font-mono font-extrabold text-amber-700 whitespace-nowrap">
                                                {r.transferNo}
                                            </td>
                                            <td className="px-2.5 py-2.5 font-bold text-slate-900">
                                                [{r.fromWarehouseCode}] {r.fromWarehouse}
                                            </td>
                                            <td className="px-2.5 py-2.5 font-bold text-slate-900">
                                                [{r.toWarehouseCode}] {r.toWarehouse}
                                            </td>
                                            <td className="p-3 text-slate-800 font-medium whitespace-nowrap">
                                                {r.requesterName}
                                            </td>
                                            <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                                                {formatDate(r.transferDate)}
                                            </td>
                                            <td className="p-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                                                {r.lineCount} mã
                                            </td>
                                            <td className="p-3 text-center font-mono font-extrabold text-emerald-700 whitespace-nowrap">
                                                {r.totalQty.toLocaleString()} chai
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap"
                                                    style={{ color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right whitespace-nowrap">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setSelectedId(r.id) }}
                                                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                                    >
                                                        <Eye size={12} /> Xem Phiếu
                                                    </button>
                                                    {(r.status === 'DRAFT' || r.status === 'PENDING_ACCOUNTING') && (
                                                        <button
                                                            onClick={e => handleCancel(r.id, e)}
                                                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                                                            title="Hủy phiếu này"
                                                        >
                                                            <Ban size={14} />
                                                        </button>
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
            </div>

            {/* Mobile Card List View (< 768px) */}
            <div className="block md:hidden space-y-3">
                {sortedRows.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs bg-white border border-slate-200 rounded-lg">
                        Không tìm thấy phiếu chuyển kho nào
                    </div>
                ) : (
                    sortedRows.map(r => {
                        const st = STATUS_CFG[r.status] ?? STATUS_CFG.DRAFT
                        return (
                            <div
                                key={r.id}
                                onClick={() => setSelectedId(r.id)}
                                className="p-4 rounded-lg bg-white border border-slate-200 text-slate-900 space-y-3 shadow-2xs active:scale-98 transition cursor-pointer"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 whitespace-nowrap shrink-0">
                                        {r.transferNo}
                                    </span>
                                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap inline-flex items-center shrink-0"
                                        style={{ color: st.color, background: st.bg, borderColor: st.border }}>
                                        {st.label}
                                    </span>
                                </div>

                                {/* Route indicator */}
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs font-semibold gap-1">
                                    <span className="text-rose-700 font-bold truncate min-w-0 flex-1">{r.fromWarehouse}</span>
                                    <ArrowRight size={13} className="text-slate-400 shrink-0 mx-1" />
                                    <span className="text-emerald-700 font-bold truncate min-w-0 flex-1 text-right">{r.toWarehouse}</span>
                                </div>

                                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                                    <div>
                                        <span className="text-slate-500 text-[10px] uppercase block font-bold">Tổng số chai:</span>
                                        <span className="font-mono font-black text-emerald-700 text-sm">{r.totalQty.toLocaleString()} chai</span>
                                    </div>
                                    <button
                                        onClick={e => { e.stopPropagation(); setSelectedId(r.id) }}
                                        className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1 shadow-md"
                                    >
                                        <Eye size={12} /> Xem Chi Tiết
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Create Drawer */}
            <CreateTransferDrawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onSuccess={reload}
            />

            {/* Detail & Print Drawer */}
            <TransferDetailDrawer
                transferId={selectedId}
                onClose={() => setSelectedId(null)}
                onRefresh={reload}
            />
            </>
            )}

            {confirmDialog}
        </div>
    )
}
