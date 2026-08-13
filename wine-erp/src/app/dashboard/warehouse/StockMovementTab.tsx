'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
    Search, Package, ArrowDownCircle, ArrowUpCircle, Loader2,
    Calendar, Filter, Download, MapPin, BarChart3, TrendingUp, TrendingDown,
    FileText, X, ChevronDown, ArrowLeft, Eye, CheckSquare, Boxes, Layers, RefreshCw,
    ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react'
import {
    StockMovementRow, NXTSummary, ProductOption,
    WarehouseNXTItem, WarehouseNXTSummary,
    getWarehouseNXTReport, getStockMovements, getProductSearchOptions, getProductStockByLocation
} from './actions-nxt'
import { formatVND, formatDate, formatNumber } from '@/lib/utils'

interface WarehouseOption {
    id: string
    code: string
    name: string
}

const DOC_TYPE_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    GR: { label: 'Nhập Kho', color: '#059669', bg: '#ECFDF5', icon: ArrowDownCircle },
    DO: { label: 'Xuất Kho', color: '#E11D48', bg: '#FFF1F2', icon: ArrowUpCircle },
    ADJ: { label: 'Điều Chỉnh', color: '#D97706', bg: '#FEF3C7', icon: BarChart3 },
    TRANSFER_IN: { label: 'Chuyển Vào', color: '#0284C7', bg: '#F0F9FF', icon: ArrowDownCircle },
    TRANSFER_OUT: { label: 'Chuyển Ra', color: '#C05621', bg: '#FFFAF0', icon: ArrowUpCircle },
    WRITE_OFF: { label: 'Hủy', color: '#991B1B', bg: '#FEF2F2', icon: TrendingDown },
}

type ViewMode = 'SUMMARY' | 'DETAIL'
type SortField = 'skuCode' | 'productName' | 'openingQty' | 'inQty' | 'outQty' | 'closingQty' | 'closingValue'
type SortOrder = 'asc' | 'desc'

// Helper: Format Date object to YYYY-MM-DD in local timezone without UTC shift
function formatYMD(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

export function StockMovementTab({ warehouses, selectedWarehouseId }: { warehouses: WarehouseOption[]; selectedWarehouseId?: string }) {
    const [viewMode, setViewMode] = useState<ViewMode>('SUMMARY')

    // ── Global Filter States ────────────────────────
    const [warehouseId, setWarehouseId] = useState(selectedWarehouseId || '')

    useEffect(() => {
        setWarehouseId(selectedWarehouseId || '')
    }, [selectedWarehouseId])
    
    // Default date range: 1st day of current month -> today
    const getDefaultDateRange = () => {
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        return {
            dateFromStr: formatYMD(firstDay),
            dateToStr: formatYMD(now)
        }
    }

    const initialDates = getDefaultDateRange()
    const [dateFrom, setDateFrom] = useState(initialDates.dateFromStr)
    const [dateTo, setDateTo] = useState(initialDates.dateToStr)
    const [datePreset, setDatePreset] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'CUSTOM'>('THIS_MONTH')

    const [search, setSearch] = useState('')
    const [wineType, setWineType] = useState('ALL')
    const [hideZeroStock, setHideZeroStock] = useState(true)

    // ── Sorting State ────────────────────────────────
    const [sortField, setSortField] = useState<SortField>('skuCode')
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

    // ── SUMMARY Data States ────────────────────────
    const [summaryItems, setSummaryItems] = useState<WarehouseNXTItem[]>([])
    const [summaryStats, setSummaryStats] = useState<WarehouseNXTSummary | null>(null)
    const [loadingSummary, setLoadingSummary] = useState(false)

    // ── DETAIL Data States ─────────────────────────
    const [selectedProduct, setSelectedProduct] = useState<{ id: string; skuCode: string; productName: string; wineType: string; country: string } | null>(null)
    const [movementType, setMovementType] = useState<'ALL' | 'IN' | 'OUT'>('ALL')
    const [movements, setMovements] = useState<StockMovementRow[]>([])
    const [detailSummary, setDetailSummary] = useState<NXTSummary | null>(null)
    const [stockLocations, setStockLocations] = useState<any[]>([])
    const [loadingDetail, setLoadingDetail] = useState(false)

    // ── Date Range Presets Handler ──────────────────
    const applyDatePreset = (preset: 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'CUSTOM') => {
        setDatePreset(preset)
        const now = new Date()
        let start: Date
        let end: Date = now

        if (preset === 'THIS_MONTH') {
            start = new Date(now.getFullYear(), now.getMonth(), 1)
        } else if (preset === 'LAST_MONTH') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            end = new Date(now.getFullYear(), now.getMonth(), 0)
        } else if (preset === 'THIS_QUARTER') {
            const quarterMonth = Math.floor(now.getMonth() / 3) * 3
            start = new Date(now.getFullYear(), quarterMonth, 1)
        } else if (preset === 'THIS_YEAR') {
            start = new Date(now.getFullYear(), 0, 1)
        } else {
            return
        }

        setDateFrom(formatYMD(start))
        setDateTo(formatYMD(end))
    }

    // ── Load Warehouse Summary Report ───────────────
    const loadSummaryReport = useCallback(async () => {
        setLoadingSummary(true)
        try {
            const res = await getWarehouseNXTReport({
                warehouseId: warehouseId || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                search: search || undefined,
                wineType: wineType !== 'ALL' ? wineType : undefined,
                hideZeroStock,
            })
            setSummaryItems(res.items)
            setSummaryStats(res.summary)
        } finally {
            setLoadingSummary(false)
        }
    }, [warehouseId, dateFrom, dateTo, search, wineType, hideZeroStock])

    // Load summary report on mount & filter change
    useEffect(() => {
        if (viewMode === 'SUMMARY') {
            loadSummaryReport()
        }
    }, [viewMode, loadSummaryReport])

    // ── Sorted Summary Items ────────────────────────
    const sortedSummaryItems = useMemo(() => {
        return [...summaryItems].sort((a, b) => {
            let valA: any = a[sortField]
            let valB: any = b[sortField]

            if (typeof valA === 'string') {
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
            }
            return sortOrder === 'asc' ? valA - valB : valB - valA
        })
    }, [summaryItems, sortField, sortOrder])

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    // ── Load Detail Stock Ledger ────────────────────
    const loadDetailReport = useCallback(async (productObj?: typeof selectedProduct) => {
        const targetProd = productObj || selectedProduct
        if (!targetProd) return

        setLoadingDetail(true)
        try {
            const [res, locs] = await Promise.all([
                getStockMovements({
                    productId: targetProd.id,
                    warehouseId: warehouseId || undefined,
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
                    movementType,
                }),
                getProductStockByLocation(targetProd.id, warehouseId || undefined),
            ])
            setMovements(res.movements)
            setDetailSummary(res.summary)
            setStockLocations(locs)
        } finally {
            setLoadingDetail(false)
        }
    }, [selectedProduct, warehouseId, dateFrom, dateTo, movementType])

    // Reload detail report if view mode is DETAIL and filters change
    useEffect(() => {
        if (viewMode === 'DETAIL' && selectedProduct) {
            loadDetailReport()
        }
    }, [viewMode, loadDetailReport, selectedProduct])

    // Trigger drill-down detail view for a specific product
    const handleDrillDown = (item: WarehouseNXTItem) => {
        const prod = {
            id: item.productId,
            skuCode: item.skuCode,
            productName: item.productName,
            wineType: item.wineType,
            country: item.country,
        }
        setSelectedProduct(prod)
        setViewMode('DETAIL')
        loadDetailReport(prod)
    }

    // ── Export CSV for Summary ────────────────────────
    const exportSummaryCSV = () => {
        if (sortedSummaryItems.length === 0) return
        const headers = [
            'Mã SKU', 'Tên Sản Phẩm', 'Phân Loại', 'ĐVT',
            'Tồn Đầu Kỳ (SL)', 'Tồn Đầu Kỳ (Giá Trị)',
            'Nhập Trong Kỳ (SL)', 'Nhập Trong Kỳ (Giá Trị)',
            'Xuất Trong Kỳ (SL)', 'Xuất Trong Kỳ (Giá Trị)',
            'Tồn Cuối Kỳ (SL)', 'Tồn Cuối Kỳ (Giá Trị)',
            'Đơn Giá Vốn BK'
        ]
        const rows = sortedSummaryItems.map(item => [
            item.skuCode, item.productName, item.wineType, item.unit,
            item.openingQty, item.openingValue,
            item.inQty, item.inValue,
            item.outQty, item.outValue,
            item.closingQty, item.closingValue,
            item.unitCost
        ])
        const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
        const BOM = '\uFEFF'
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `bao-cao-nxt-kho-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    // ── Export CSV for Detail ─────────────────────────
    const exportDetailCSV = () => {
        if (movements.length === 0 || !selectedProduct) return
        const headers = ['Ngày', 'Loại Phiếu', 'Số Chứng Từ', 'Kho', 'Vị Trí', 'Lô Hàng', 'SL Nhập', 'SL Xuất', 'Tồn Lũy Kế', 'Đơn Giá Vốn', 'Tham Chiếu']
        const rows = movements.map(m => [
            new Date(m.date).toLocaleDateString('vi-VN'),
            DOC_TYPE_CFG[m.docType]?.label || m.docType,
            m.docNo, m.warehouseName, m.locationCode, m.lotNo,
            m.qtyIn || '', m.qtyOut || '', m.balance,
            m.unitCost, m.reference,
        ])
        const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
        const BOM = '\uFEFF'
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `so-nxt-${selectedProduct.skuCode}-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const inputCls = "px-3 py-2 rounded-xl text-xs outline-none transition-colors w-full bg-white border border-slate-200 text-slate-900 focus:border-emerald-500 shadow-2xs"

    return (
        <div className="space-y-5">
            {/* ═════════════════════════════════════════════════════ */}
            {/* GLOBAL FILTER BAR (Light Theme)                      */}
            {/* ═════════════════════════════════════════════════════ */}
            <div className="p-4 sm:p-5 rounded-2xl space-y-4 bg-white border border-slate-200 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        {viewMode === 'DETAIL' ? (
                            <button onClick={() => setViewMode('SUMMARY')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer">
                                <ArrowLeft size={14} /> Quay lại Bảng Tổng Hợp
                            </button>
                        ) : (
                            <>
                                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
                                    <BarChart3 size={18} />
                                </div>
                                <h3 className="text-base font-extrabold text-slate-900">
                                    Báo Cáo Nhập Xuất Tồn Kho (NXT)
                                </h3>
                            </>
                        )}
                    </div>

                    {/* Quick Date Presets */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                        {[
                            { id: 'THIS_MONTH', label: 'Tháng này' },
                            { id: 'LAST_MONTH', label: 'Tháng trước' },
                            { id: 'THIS_QUARTER', label: 'Quý này' },
                            { id: 'THIS_YEAR', label: 'Năm nay' },
                        ].map(p => (
                            <button
                                key={p.id}
                                onClick={() => applyDatePreset(p.id as any)}
                                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap text-xs font-bold cursor-pointer ${
                                    datePreset === p.id 
                                        ? 'bg-emerald-600 text-white shadow-xs' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                                }`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                    {/* Search */}
                    <div className="lg:col-span-3">
                        <label className="text-[10px] uppercase tracking-widest font-bold block mb-1 text-slate-500">
                            Tìm SKU / Tên sản phẩm
                        </label>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                placeholder="Nhập SKU, tên sản phẩm..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className={`pl-9 ${inputCls}`}
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Warehouse filter */}
                    <div className="lg:col-span-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold block mb-1 text-slate-500">Kho Hàng</label>
                        <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={inputCls}>
                            <option value="">Tất cả các kho</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>

                    {/* Date From */}
                    <div className="lg:col-span-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold block mb-1 text-slate-500">Từ Ngày</label>
                        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDatePreset('CUSTOM') }} className={inputCls} />
                    </div>

                    {/* Date To */}
                    <div className="lg:col-span-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold block mb-1 text-slate-500">Đến Ngày</label>
                        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setDatePreset('CUSTOM') }} className={inputCls} />
                    </div>

                    {/* Filter Button / Options */}
                    <div className="lg:col-span-3 flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (viewMode === 'SUMMARY') loadSummaryReport()
                                else loadDetailReport()
                            }}
                            disabled={loadingSummary || loadingDetail}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer active:scale-95">
                            {(loadingSummary || loadingDetail) ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                            Tra Cứu Báo Cáo
                        </button>

                        {viewMode === 'SUMMARY' ? (
                            <button onClick={exportSummaryCSV} disabled={summaryItems.length === 0}
                                title="Xuất CSV báo cáo kho"
                                className="px-3 py-2 rounded-xl flex items-center justify-center transition-colors bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer disabled:opacity-40">
                                <Download size={16} />
                            </button>
                        ) : (
                            <button onClick={exportDetailCSV} disabled={movements.length === 0}
                                title="Xuất CSV sổ chi tiết mã"
                                className="px-3 py-2 rounded-xl flex items-center justify-center transition-colors bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer disabled:opacity-40">
                                <Download size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {viewMode === 'SUMMARY' && (
                    <div className="flex items-center gap-4 pt-1 text-xs text-slate-600 font-medium">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={hideZeroStock}
                                onChange={e => setHideZeroStock(e.target.checked)}
                                className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                            />
                            <span>Chỉ hiện sản phẩm có tồn kho hoặc có phát sinh trong kỳ</span>
                        </label>
                    </div>
                )}
            </div>

            {/* ═════════════════════════════════════════════════════ */}
            {/* VIEW MODE 1: BẢNG TỔNG HỢP NHẬP XUẤT TỒN CẢ KHO        */}
            {/* ═════════════════════════════════════════════════════ */}
            {viewMode === 'SUMMARY' && (
                <div className="space-y-4">
                    {/* KPI Cards for Warehouse Summary */}
                    {summaryStats && (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                    <span>Tổng SKU</span>
                                    <Boxes size={14} className="text-emerald-600" />
                                </div>
                                <p className="text-xl font-extrabold font-mono text-slate-900">{summaryStats.totalProducts.toLocaleString()}</p>
                                <p className="text-[10px] text-slate-500 font-medium">Mặt hàng có dữ liệu</p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                    <span>Tồn Đầu Kỳ</span>
                                    <Package size={14} className="text-amber-600" />
                                </div>
                                <p className="text-xl font-extrabold font-mono text-amber-600">{summaryStats.totalOpeningQty.toLocaleString()} <span className="text-xs font-normal">chai</span></p>
                                <p className="text-[10px] font-mono text-slate-500">{formatVND(summaryStats.totalOpeningValue)}</p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                    <span>Nhập Trong Kỳ</span>
                                    <ArrowDownCircle size={14} className="text-emerald-600" />
                                </div>
                                <p className="text-xl font-extrabold font-mono text-emerald-600">+{summaryStats.totalInQty.toLocaleString()} <span className="text-xs font-normal">chai</span></p>
                                <p className="text-[10px] font-mono text-slate-500">{formatVND(summaryStats.totalInValue)}</p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                    <span>Xuất Trong Kỳ</span>
                                    <ArrowUpCircle size={14} className="text-rose-600" />
                                </div>
                                <p className="text-xl font-extrabold font-mono text-rose-600">-{summaryStats.totalOutQty.toLocaleString()} <span className="text-xs font-normal">chai</span></p>
                                <p className="text-[10px] font-mono text-slate-500">{formatVND(summaryStats.totalOutValue)}</p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                    <span>Tồn Cuối Kỳ</span>
                                    <TrendingUp size={14} className="text-teal-600" />
                                </div>
                                <p className="text-xl font-extrabold font-mono text-teal-600">{summaryStats.totalClosingQty.toLocaleString()} <span className="text-xs font-normal">chai</span></p>
                                <p className="text-[10px] font-mono font-bold text-teal-700">{formatVND(summaryStats.totalClosingValue)}</p>
                            </div>
                        </div>
                    )}

                    {/* Summary Data Table — Desktop View */}
                    <div className="hidden md:block rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
                        {loadingSummary ? (
                            <div className="flex items-center justify-center py-20 gap-3">
                                <Loader2 size={24} className="animate-spin text-emerald-600" />
                                <span className="text-sm font-semibold text-slate-600">Đang tính toán sổ kho tổng hợp...</span>
                            </div>
                        ) : sortedSummaryItems.length === 0 ? (
                            <div className="flex flex-col items-center py-16 gap-3">
                                <BarChart3 size={36} className="text-slate-300" />
                                <p className="text-sm font-semibold text-slate-500">Không tìm thấy dữ liệu nhập xuất tồn phù hợp bộ lọc</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                                <table className="w-full text-left border-collapse min-w-[1000px]">
                                    <thead>
                                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 sticky top-0 z-10">
                                            <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold">STT</th>
                                            <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-emerald-700 cursor-pointer select-none" onClick={() => toggleSort('skuCode')}>
                                                <div className="flex items-center gap-1">
                                                    Mã SKU {sortField === 'skuCode' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </div>
                                            </th>
                                            <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold cursor-pointer select-none" onClick={() => toggleSort('productName')}>
                                                <div className="flex items-center gap-1">
                                                    Tên Sản Phẩm {sortField === 'productName' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </div>
                                            </th>
                                            <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-center">ĐVT</th>
                                            <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-right text-amber-700 cursor-pointer select-none" onClick={() => toggleSort('openingQty')}>
                                                <div className="flex items-center justify-end gap-1">
                                                    Tồn Đầu Kỳ {sortField === 'openingQty' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </div>
                                            </th>
                                            <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-right text-emerald-700 cursor-pointer select-none" onClick={() => toggleSort('inQty')}>
                                                <div className="flex items-center justify-end gap-1">
                                                    Nhập Trong Kỳ {sortField === 'inQty' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </div>
                                            </th>
                                            <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-right text-rose-700 cursor-pointer select-none" onClick={() => toggleSort('outQty')}>
                                                <div className="flex items-center justify-end gap-1">
                                                    Xuất Trong Kỳ {sortField === 'outQty' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </div>
                                            </th>
                                            <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-right text-teal-700 cursor-pointer select-none" onClick={() => toggleSort('closingQty')}>
                                                <div className="flex items-center justify-end gap-1">
                                                    Tồn Cuối Kỳ {sortField === 'closingQty' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </div>
                                            </th>
                                            <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-right">Giá Vốn BK</th>
                                            <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-center">Thao Tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sortedSummaryItems.map((item, idx) => (
                                            <tr key={item.productId}
                                                className="group transition-colors hover:bg-slate-50 cursor-pointer"
                                                onClick={() => handleDrillDown(item)}>
                                                <td className="px-3.5 py-3 text-xs text-slate-500 font-medium">{idx + 1}</td>
                                                <td className="px-3.5 py-3">
                                                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        {item.skuCode}
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-slate-900 truncate">{item.productName}</p>
                                                        <p className="text-[10px] text-slate-500 font-medium">{item.wineType} · {item.country}</p>
                                                    </div>
                                                </td>
                                                <td className="px-3.5 py-3 text-xs text-center text-slate-500 font-medium">{item.unit}</td>
                                                
                                                {/* Tồn Đầu Kỳ */}
                                                <td className="px-3.5 py-3 text-right">
                                                    <p className="text-xs font-bold font-mono text-amber-600">{item.openingQty.toLocaleString()}</p>
                                                    <p className="text-[10px] font-mono text-slate-400">{formatVND(item.openingValue)}</p>
                                                </td>

                                                {/* Nhập Trong Kỳ */}
                                                <td className="px-3.5 py-3 text-right">
                                                    <p className={`text-xs font-bold font-mono ${item.inQty > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                        {item.inQty > 0 ? `+${item.inQty.toLocaleString()}` : '—'}
                                                    </p>
                                                    {item.inQty > 0 && <p className="text-[10px] font-mono text-slate-400">{formatVND(item.inValue)}</p>}
                                                </td>

                                                {/* Xuất Trong Kỳ */}
                                                <td className="px-3.5 py-3 text-right">
                                                    <p className={`text-xs font-bold font-mono ${item.outQty > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                                        {item.outQty > 0 ? `-${item.outQty.toLocaleString()}` : '—'}
                                                    </p>
                                                    {item.outQty > 0 && <p className="text-[10px] font-mono text-slate-400">{formatVND(item.outValue)}</p>}
                                                </td>

                                                {/* Tồn Cuối Kỳ */}
                                                <td className="px-3.5 py-3 text-right">
                                                    <p className="text-xs font-bold font-mono text-teal-600">{item.closingQty.toLocaleString()}</p>
                                                    <p className="text-[10px] font-mono font-bold text-teal-700">{formatVND(item.closingValue)}</p>
                                                </td>

                                                {/* Đơn giá vốn Landed Cost */}
                                                <td className="px-3.5 py-3 text-right text-xs font-mono text-slate-600 font-medium">
                                                    {formatVND(item.unitCost)}
                                                </td>

                                                {/* Thao tác Drill-down */}
                                                <td className="px-3.5 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => handleDrillDown(item)}
                                                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-bold transition-all bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white cursor-pointer">
                                                        <Eye size={12} /> Sổ Chi Tiết
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {/* Sticky Summary Footer Row */}
                                    {summaryStats && (
                                        <tfoot className="sticky bottom-0 z-10 bg-slate-100 border-t-2 border-slate-300">
                                            <tr>
                                                <td colSpan={4} className="px-3.5 py-3 text-xs font-extrabold tracking-wider text-right text-slate-900">
                                                    TỔNG CỘNG TOÀN KHO ({summaryStats.totalProducts} SKU):
                                                </td>
                                                <td className="px-3.5 py-3 text-right">
                                                    <p className="text-xs font-extrabold font-mono text-amber-600">{summaryStats.totalOpeningQty.toLocaleString()}</p>
                                                    <p className="text-[10px] font-mono text-slate-500">{formatVND(summaryStats.totalOpeningValue)}</p>
                                                </td>
                                                <td className="px-3.5 py-3 text-right">
                                                    <p className="text-xs font-extrabold font-mono text-emerald-600">+{summaryStats.totalInQty.toLocaleString()}</p>
                                                    <p className="text-[10px] font-mono text-slate-500">{formatVND(summaryStats.totalInValue)}</p>
                                                </td>
                                                <td className="px-3.5 py-3 text-right">
                                                    <p className="text-xs font-extrabold font-mono text-rose-600">-{summaryStats.totalOutQty.toLocaleString()}</p>
                                                    <p className="text-[10px] font-mono text-slate-500">{formatVND(summaryStats.totalOutValue)}</p>
                                                </td>
                                                <td className="px-3.5 py-3 text-right">
                                                    <p className="text-xs font-extrabold font-mono text-teal-700">{summaryStats.totalClosingQty.toLocaleString()}</p>
                                                    <p className="text-[10px] font-mono font-bold text-teal-700">{formatVND(summaryStats.totalClosingValue)}</p>
                                                </td>
                                                <td colSpan={2}></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Summary Data Cards — Mobile View (< 768px) */}
                    <div className="block md:hidden space-y-3">
                        {loadingSummary ? (
                            <div className="p-8 text-center text-slate-500 text-xs bg-white border border-slate-200 rounded-2xl">
                                <Loader2 size={20} className="animate-spin inline text-emerald-600 mr-2" /> Đang tải báo cáo NXT...
                            </div>
                        ) : sortedSummaryItems.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-xs bg-white border border-slate-200 rounded-2xl">
                                Không tìm thấy dữ liệu NXT phù hợp
                            </div>
                        ) : (
                            sortedSummaryItems.map((item) => (
                                <div
                                    key={item.productId}
                                    onClick={() => handleDrillDown(item)}
                                    className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-900 space-y-3 shadow-2xs active:scale-98 transition cursor-pointer"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                                {item.skuCode}
                                            </span>
                                            <h4 className="text-xs font-black text-white mt-1">{item.productName}</h4>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDrillDown(item) }}
                                            className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-bold text-[11px] rounded-lg shrink-0 shadow"
                                        >
                                            Sổ Chi Tiết ➔
                                        </button>
                                    </div>

                                    {/* 4 Metric Pills Grid */}
                                    <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center font-mono">
                                        <div>
                                            <span className="text-[9px] uppercase text-slate-500 font-bold block">Đầu kỳ</span>
                                            <span className="text-xs font-bold text-amber-400">{item.openingQty}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] uppercase text-slate-500 font-bold block">Nhập</span>
                                            <span className="text-xs font-bold text-emerald-400">{item.inQty > 0 ? `+${item.inQty}` : '0'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] uppercase text-slate-500 font-bold block">Xuất</span>
                                            <span className="text-xs font-bold text-rose-400">{item.outQty > 0 ? `-${item.outQty}` : '0'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] uppercase text-slate-500 font-bold block">Cuối kỳ</span>
                                            <span className="text-xs font-black text-teal-400">{item.closingQty}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-800/80">
                                        <span className="text-slate-400 font-semibold">Giá trị tồn cuối:</span>
                                        <span className="font-mono font-black text-teal-400">{formatVND(item.closingValue)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════ */}
            {/* VIEW MODE 2: SỔ CHI TIẾT NHẬP XUẤT TỒN SẢN PHẨM       */}
            {/* ═════════════════════════════════════════════════════ */}
            {viewMode === 'DETAIL' && selectedProduct && (
                <div className="space-y-5">
                    {/* Header Banner for Selected Product */}
                    <div className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0 font-bold">
                                <Package size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        {selectedProduct.skuCode}
                                    </span>
                                    <h2 className="text-base font-extrabold text-slate-900">{selectedProduct.productName}</h2>
                                </div>
                                <p className="text-xs mt-0.5 text-slate-500 font-medium">
                                    {selectedProduct.wineType} · {selectedProduct.country} | Khoảng thời gian: <span className="font-mono text-emerald-700 font-bold">{formatDate(dateFrom)}</span> đến <span className="font-mono text-emerald-700 font-bold">{formatDate(dateTo)}</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <select value={movementType} onChange={e => setMovementType(e.target.value as any)} className={`text-xs ${inputCls}`}>
                                <option value="ALL">Tất cả chứng từ</option>
                                <option value="IN">Chỉ xem Nhập Kho</option>
                                <option value="OUT">Chỉ xem Xuất Kho</option>
                            </select>

                            <button onClick={() => loadDetailReport()} disabled={loadingDetail}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs">
                                {loadingDetail ? <Loader2 size={13} className="animate-spin" /> : <Filter size={13} />} Lọc
                            </button>
                        </div>
                    </div>

                    {/* Detail Summary Cards */}
                    {detailSummary && (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                <p className="text-[10px] uppercase font-bold text-slate-500">Tồn Đầu Kỳ ({formatDate(dateFrom)})</p>
                                <p className="text-lg font-extrabold font-mono mt-1 text-amber-600">{detailSummary.openingBalance.toLocaleString()} chai</p>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                <p className="text-[10px] uppercase font-bold text-slate-500">Tổng Nhập Trong Kỳ</p>
                                <p className="text-lg font-extrabold font-mono mt-1 text-emerald-600">+{detailSummary.totalIn.toLocaleString()} chai</p>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                <p className="text-[10px] uppercase font-bold text-slate-500">Tổng Xuất Trong Kỳ</p>
                                <p className="text-lg font-extrabold font-mono mt-1 text-rose-600">-{detailSummary.totalOut.toLocaleString()} chai</p>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                <p className="text-[10px] uppercase font-bold text-slate-500">Tồn Cuối Kỳ ({formatDate(dateTo)})</p>
                                <p className="text-lg font-extrabold font-mono mt-1 text-teal-600">{detailSummary.closingBalance.toLocaleString()} chai</p>
                            </div>
                            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                <p className="text-[10px] uppercase font-bold text-slate-500">Giá Trị Tồn Cuối</p>
                                <p className="text-lg font-extrabold font-mono mt-1 text-teal-700">{formatVND(detailSummary.totalValue)}</p>
                            </div>
                        </div>
                    )}

                    {/* Timeline Table & Current Stock Locations */}
                    <div className="grid grid-cols-12 gap-5">
                        {/* Main Ledger Table */}
                        <div className="col-span-12 lg:col-span-8 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs uppercase tracking-widest font-extrabold text-slate-500">
                                    Sổ Chi Tiết Chứng Từ ({movements.length} giao dịch)
                                </h4>
                            </div>

                            {loadingDetail ? (
                                <div className="flex items-center justify-center py-16 gap-2">
                                    <Loader2 size={20} className="animate-spin text-emerald-600" />
                                    <span className="text-xs font-semibold text-slate-600">Đang nạp sổ chi tiết...</span>
                                </div>
                            ) : movements.length === 0 ? (
                                <div className="flex flex-col items-center py-16 gap-3 rounded-2xl bg-white border border-dashed border-slate-300">
                                    <FileText size={32} className="text-slate-300" />
                                    <p className="text-sm font-semibold text-slate-500">Không có phát sinh nhập/xuất nào trong khoảng thời gian này</p>
                                </div>
                            ) : (
                                <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
                                    <div style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 sticky top-0 z-10">
                                                    {['Ngày', 'Loại', 'Số CT', 'Kho / Vị Trí', 'Nhập', 'Xuất', 'Tồn Lũy Kế', 'Đơn Giá', 'Tham Chiếu'].map(h => (
                                                        <th key={h} className="px-3.5 py-2.5 text-[10px] uppercase tracking-wider font-extrabold">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {/* Opening Balance Row */}
                                                {detailSummary && (
                                                    <tr className="bg-amber-50/60 border-b border-amber-200">
                                                        <td className="px-3.5 py-2 text-xs font-bold text-amber-700">{formatDate(dateFrom)}</td>
                                                        <td colSpan={3} className="px-3.5 py-2 text-xs font-bold text-amber-700">--- TỒN ĐẦU KỲ ---</td>
                                                        <td className="px-3.5 py-2 text-center text-xs text-slate-400">—</td>
                                                        <td className="px-3.5 py-2 text-center text-xs text-slate-400">—</td>
                                                        <td className="px-3.5 py-2 text-center text-xs font-extrabold font-mono text-amber-700">{detailSummary.openingBalance.toLocaleString()}</td>
                                                        <td colSpan={2} className="px-3.5 py-2 text-xs text-slate-500 font-medium">Mốc bắt đầu báo cáo</td>
                                                    </tr>
                                                )}

                                                {movements.map(m => {
                                                    const cfg = DOC_TYPE_CFG[m.docType] || { label: m.docType, color: '#475569', bg: '#F1F5F9', icon: FileText }
                                                    const Icon = cfg.icon
                                                    return (
                                                        <tr key={m.id} className="transition-colors hover:bg-slate-50">
                                                            <td className="px-3.5 py-2.5 text-xs text-slate-600 font-medium">{formatDate(m.date)}</td>
                                                            <td className="px-3.5 py-2.5">
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
                                                                    style={{ color: cfg.color, background: cfg.bg }}>
                                                                    <Icon size={10} /> {cfg.label}
                                                                </span>
                                                            </td>
                                                            <td className="px-3.5 py-2.5 text-xs font-bold font-mono text-emerald-700">{m.docNo}</td>
                                                            <td className="px-3.5 py-2.5 text-xs text-slate-700 font-medium">
                                                                <div>{m.warehouseName}</div>
                                                                <div className="text-[10px] font-mono text-slate-400">📍 {m.locationCode} · Lô: {m.lotNo}</div>
                                                            </td>
                                                            <td className="px-3.5 py-2.5 text-center">
                                                                {m.qtyIn > 0 ? (
                                                                    <span className="text-xs font-bold font-mono text-emerald-600">+{m.qtyIn.toLocaleString()}</span>
                                                                ) : <span className="text-slate-300">—</span>}
                                                            </td>
                                                            <td className="px-3.5 py-2.5 text-center">
                                                                {m.qtyOut > 0 ? (
                                                                    <span className="text-xs font-bold font-mono text-rose-600">-{m.qtyOut.toLocaleString()}</span>
                                                                ) : <span className="text-slate-300">—</span>}
                                                            </td>
                                                            <td className="px-3.5 py-2.5 text-center">
                                                                <span className="text-xs font-bold font-mono text-teal-600">
                                                                    {m.balance.toLocaleString()}
                                                                </span>
                                                            </td>
                                                            <td className="px-3.5 py-2.5 text-xs font-mono text-slate-600 font-medium">
                                                                {formatVND(m.unitCost)}
                                                            </td>
                                                            <td className="px-3.5 py-2.5 text-xs text-slate-500">{m.reference}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Stock Breakdown by Location */}
                        <div className="col-span-12 lg:col-span-4 space-y-3">
                            <h4 className="text-xs uppercase tracking-widest font-extrabold text-slate-500">
                                Phân Bổ Tồn Kho Thực Tế Theo Vị Trí
                            </h4>
                            {stockLocations.length === 0 ? (
                                <div className="flex flex-col items-center py-8 gap-2 rounded-2xl bg-white border border-dashed border-slate-300">
                                    <MapPin size={20} className="text-slate-300" />
                                    <p className="text-xs font-semibold text-slate-500">Không có lô hàng khả dụng trong kho</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                    {stockLocations.map((loc: any, i: number) => (
                                        <div key={i} className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-md font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    📍 {loc.locationCode}
                                                </span>
                                                <span className="text-xs font-bold font-mono text-emerald-600">
                                                    {loc.qtyAvailable.toLocaleString()} chai
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                                <span>{loc.warehouseName}</span>
                                                <span className="font-mono text-amber-600 font-bold">Lô: {loc.lotNo}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                                <span>Khu {loc.zone} · Giá vốn: {formatVND(loc.unitCost)}</span>
                                                <span className="text-slate-600 font-bold">{formatVND(loc.qtyAvailable * loc.unitCost)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
