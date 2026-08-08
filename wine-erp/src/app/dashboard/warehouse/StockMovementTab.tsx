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

const DOC_TYPE_CFG: Record<string, { label: string; color: string; icon: any }> = {
    GR: { label: 'Nhập Kho', color: '#5BA88A', icon: ArrowDownCircle },
    DO: { label: 'Xuất Kho', color: '#C74B50', icon: ArrowUpCircle },
    ADJ: { label: 'Điều Chỉnh', color: '#D4A853', icon: BarChart3 },
    TRANSFER_IN: { label: 'Chuyển Vào', color: '#4A8FAB', icon: ArrowDownCircle },
    TRANSFER_OUT: { label: 'Chuyển Ra', color: '#B87333', icon: ArrowUpCircle },
    WRITE_OFF: { label: 'Hủy', color: '#8B1A2E', icon: TrendingDown },
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

export function StockMovementTab({ warehouses }: { warehouses: WarehouseOption[] }) {
    const [viewMode, setViewMode] = useState<ViewMode>('SUMMARY')

    // ── Global Filter States ────────────────────────
    const [warehouseId, setWarehouseId] = useState('')
    
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
    const loadDetailReport = async (productObj?: typeof selectedProduct) => {
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
                getProductStockByLocation(targetProd.id),
            ])
            setMovements(res.movements)
            setDetailSummary(res.summary)
            setStockLocations(locs)
        } finally {
            setLoadingDetail(false)
        }
    }

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

    const inputCls = "px-3 py-2 rounded-lg text-sm outline-none transition-colors"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    return (
        <div className="space-y-5">
            {/* ═════════════════════════════════════════════════════ */}
            {/* GLOBAL FILTER BAR                                    */}
            {/* ═════════════════════════════════════════════════════ */}
            <div className="p-4 sm:p-5 rounded-2xl space-y-4" style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3" style={{ borderBottom: '1px solid rgba(42,67,85,0.6)' }}>
                    <div className="flex items-center gap-2">
                        {viewMode === 'DETAIL' ? (
                            <button onClick={() => setViewMode('SUMMARY')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:bg-white/10"
                                style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                <ArrowLeft size={14} /> Quay lại Bảng Tổng Hợp
                            </button>
                        ) : (
                            <>
                                <Layers size={18} style={{ color: '#87CBB9' }} />
                                <h3 className="text-sm font-bold" style={{ color: '#E8F1F2' }}>
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
                                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${datePreset === p.id ? 'font-bold' : ''}`}
                                style={{
                                    background: datePreset === p.id ? '#87CBB9' : 'rgba(42,67,85,0.4)',
                                    color: datePreset === p.id ? '#0A1926' : '#8AAEBB',
                                }}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                    {/* Search */}
                    <div className="lg:col-span-3">
                        <label className="text-[10px] uppercase tracking-widest font-bold block mb-1" style={{ color: '#4A6A7A' }}>
                            Tìm SKU / Tên sản phẩm
                        </label>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                            <input
                                placeholder="Nhập SKU, tên sản phẩm..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className={`w-full pl-9 ${inputCls}`}
                                style={inputStyle}
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }}>
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Warehouse filter */}
                    <div className="lg:col-span-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold block mb-1" style={{ color: '#4A6A7A' }}>Kho Hàng</label>
                        <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                            className={`w-full ${inputCls}`} style={{ ...inputStyle, color: warehouseId ? '#E8F1F2' : '#4A6A7A' }}>
                            <option value="">Tất cả các kho</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>

                    {/* Date From */}
                    <div className="lg:col-span-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold block mb-1" style={{ color: '#4A6A7A' }}>Từ Ngày</label>
                        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDatePreset('CUSTOM') }}
                            className={`w-full ${inputCls}`} style={inputStyle} />
                    </div>

                    {/* Date To */}
                    <div className="lg:col-span-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold block mb-1" style={{ color: '#4A6A7A' }}>Đến Ngày</label>
                        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setDatePreset('CUSTOM') }}
                            className={`w-full ${inputCls}`} style={inputStyle} />
                    </div>

                    {/* Filter Button / Options */}
                    <div className="lg:col-span-3 flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (viewMode === 'SUMMARY') loadSummaryReport()
                                else loadDetailReport()
                            }}
                            disabled={loadingSummary || loadingDetail}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            {(loadingSummary || loadingDetail) ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            Tra Cứu Báo Cáo
                        </button>

                        {viewMode === 'SUMMARY' ? (
                            <button onClick={exportSummaryCSV} disabled={summaryItems.length === 0}
                                title="Xuất CSV báo cáo kho"
                                className="px-3 py-2 rounded-lg flex items-center justify-center transition-colors"
                                style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                <Download size={16} />
                            </button>
                        ) : (
                            <button onClick={exportDetailCSV} disabled={movements.length === 0}
                                title="Xuất CSV sổ chi tiết mã"
                                className="px-3 py-2 rounded-lg flex items-center justify-center transition-colors"
                                style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                <Download size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {viewMode === 'SUMMARY' && (
                    <div className="flex items-center gap-4 pt-1 text-xs" style={{ color: '#8AAEBB' }}>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={hideZeroStock}
                                onChange={e => setHideZeroStock(e.target.checked)}
                                className="w-4 h-4 rounded accent-[#87CBB9] cursor-pointer"
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
                            <div className="p-3.5 rounded-xl space-y-1" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <div className="flex items-center justify-between text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>
                                    <span>Tổng SKU</span>
                                    <Boxes size={14} style={{ color: '#87CBB9' }} />
                                </div>
                                <p className="text-xl font-bold font-mono" style={{ color: '#E8F1F2' }}>{summaryStats.totalProducts.toLocaleString()}</p>
                                <p className="text-[10px]" style={{ color: '#8AAEBB' }}>Mặt hàng có dữ liệu</p>
                            </div>

                            <div className="p-3.5 rounded-xl space-y-1" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <div className="flex items-center justify-between text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>
                                    <span>Tồn Đầu Kỳ</span>
                                    <Package size={14} style={{ color: '#D4A853' }} />
                                </div>
                                <p className="text-xl font-bold font-mono" style={{ color: '#D4A853' }}>{summaryStats.totalOpeningQty.toLocaleString()} <span className="text-xs font-normal">chai</span></p>
                                <p className="text-[10px] font-mono" style={{ color: '#8AAEBB' }}>{formatVND(summaryStats.totalOpeningValue)}</p>
                            </div>

                            <div className="p-3.5 rounded-xl space-y-1" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <div className="flex items-center justify-between text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>
                                    <span>Nhập Trong Kỳ</span>
                                    <ArrowDownCircle size={14} style={{ color: '#5BA88A' }} />
                                </div>
                                <p className="text-xl font-bold font-mono" style={{ color: '#5BA88A' }}>+{summaryStats.totalInQty.toLocaleString()} <span className="text-xs font-normal">chai</span></p>
                                <p className="text-[10px] font-mono" style={{ color: '#8AAEBB' }}>{formatVND(summaryStats.totalInValue)}</p>
                            </div>

                            <div className="p-3.5 rounded-xl space-y-1" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <div className="flex items-center justify-between text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>
                                    <span>Xuất Trong Kỳ</span>
                                    <ArrowUpCircle size={14} style={{ color: '#C74B50' }} />
                                </div>
                                <p className="text-xl font-bold font-mono" style={{ color: '#C74B50' }}>-{summaryStats.totalOutQty.toLocaleString()} <span className="text-xs font-normal">chai</span></p>
                                <p className="text-[10px] font-mono" style={{ color: '#8AAEBB' }}>{formatVND(summaryStats.totalOutValue)}</p>
                            </div>

                            <div className="p-3.5 rounded-xl space-y-1" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <div className="flex items-center justify-between text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>
                                    <span>Tồn Cuối Kỳ</span>
                                    <TrendingUp size={14} style={{ color: '#87CBB9' }} />
                                </div>
                                <p className="text-xl font-bold font-mono" style={{ color: '#87CBB9' }}>{summaryStats.totalClosingQty.toLocaleString()} <span className="text-xs font-normal">chai</span></p>
                                <p className="text-[10px] font-mono" style={{ color: '#87CBB9' }}>{formatVND(summaryStats.totalClosingValue)}</p>
                            </div>
                        </div>
                    )}

                    {/* Summary Data Table */}
                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                        {loadingSummary ? (
                            <div className="flex items-center justify-center py-20 gap-3">
                                <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                                <span className="text-sm font-medium" style={{ color: '#8AAEBB' }}>Đang tính toán sổ kho tổng hợp...</span>
                            </div>
                        ) : sortedSummaryItems.length === 0 ? (
                            <div className="flex flex-col items-center py-16 gap-3">
                                <BarChart3 size={36} style={{ color: '#2A4355' }} />
                                <p className="text-sm font-medium" style={{ color: '#4A6A7A' }}>Không tìm thấy dữ liệu nhập xuất tồn phù hợp bộ lọc</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                                <table className="w-full text-left border-collapse min-w-[1000px]">
                                    <thead>
                                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355', position: 'sticky', top: 0, zIndex: 10 }}>
                                            <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>STT</th>
                                            <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold cursor-pointer select-none" style={{ color: '#87CBB9' }} onClick={() => toggleSort('skuCode')}>
                                                <div className="flex items-center gap-1">
                                                    Mã SKU {sortField === 'skuCode' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold cursor-pointer select-none" style={{ color: '#4A6A7A' }} onClick={() => toggleSort('productName')}>
                                                <div className="flex items-center gap-1">
                                                    Tên Sản Phẩm {sortField === 'productName' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-center" style={{ color: '#4A6A7A' }}>ĐVT</th>
                                            <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-right cursor-pointer select-none" style={{ color: '#D4A853' }} onClick={() => toggleSort('openingQty')}>
                                                <div className="flex items-center justify-end gap-1">
                                                    Tồn Đầu Kỳ {sortField === 'openingQty' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-right cursor-pointer select-none" style={{ color: '#5BA88A' }} onClick={() => toggleSort('inQty')}>
                                                <div className="flex items-center justify-end gap-1">
                                                    Nhập Trong Kỳ {sortField === 'inQty' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-right cursor-pointer select-none" style={{ color: '#C74B50' }} onClick={() => toggleSort('outQty')}>
                                                <div className="flex items-center justify-end gap-1">
                                                    Xuất Trong Kỳ {sortField === 'outQty' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-right cursor-pointer select-none" style={{ color: '#87CBB9' }} onClick={() => toggleSort('closingQty')}>
                                                <div className="flex items-center justify-end gap-1">
                                                    Tồn Cuối Kỳ {sortField === 'closingQty' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                                </div>
                                            </th>
                                            <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-right" style={{ color: '#4A6A7A' }}>Giá Vốn BK</th>
                                            <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-center" style={{ color: '#4A6A7A' }}>Thao Tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedSummaryItems.map((item, idx) => (
                                            <tr key={item.productId}
                                                className="group transition-colors hover:bg-[#142433] cursor-pointer"
                                                style={{ borderBottom: '1px solid rgba(42,67,85,0.4)' }}
                                                onClick={() => handleDrillDown(item)}>
                                                <td className="px-3 py-3 text-xs" style={{ color: '#4A6A7A' }}>{idx + 1}</td>
                                                <td className="px-3 py-3">
                                                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded"
                                                        style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.2)' }}>
                                                        {item.skuCode}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold truncate" style={{ color: '#E8F1F2' }}>{item.productName}</p>
                                                        <p className="text-[10px]" style={{ color: '#8AAEBB' }}>{item.wineType} · {item.country}</p>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-xs text-center" style={{ color: '#8AAEBB' }}>{item.unit}</td>
                                                
                                                {/* Tồn Đầu Kỳ */}
                                                <td className="px-3 py-3 text-right">
                                                    <p className="text-xs font-bold font-mono" style={{ color: '#D4A853' }}>{item.openingQty.toLocaleString()}</p>
                                                    <p className="text-[10px] font-mono" style={{ color: '#4A6A7A' }}>{formatVND(item.openingValue)}</p>
                                                </td>

                                                {/* Nhập Trong Kỳ */}
                                                <td className="px-3 py-3 text-right">
                                                    <p className="text-xs font-bold font-mono" style={{ color: item.inQty > 0 ? '#5BA88A' : '#4A6A7A' }}>
                                                        {item.inQty > 0 ? `+${item.inQty.toLocaleString()}` : '—'}
                                                    </p>
                                                    {item.inQty > 0 && <p className="text-[10px] font-mono" style={{ color: '#4A6A7A' }}>{formatVND(item.inValue)}</p>}
                                                </td>

                                                {/* Xuất Trong Kỳ */}
                                                <td className="px-3 py-3 text-right">
                                                    <p className="text-xs font-bold font-mono" style={{ color: item.outQty > 0 ? '#C74B50' : '#4A6A7A' }}>
                                                        {item.outQty > 0 ? `-${item.outQty.toLocaleString()}` : '—'}
                                                    </p>
                                                    {item.outQty > 0 && <p className="text-[10px] font-mono" style={{ color: '#4A6A7A' }}>{formatVND(item.outValue)}</p>}
                                                </td>

                                                {/* Tồn Cuối Kỳ */}
                                                <td className="px-3 py-3 text-right">
                                                    <p className="text-xs font-bold font-mono" style={{ color: '#87CBB9' }}>{item.closingQty.toLocaleString()}</p>
                                                    <p className="text-[10px] font-mono" style={{ color: '#87CBB9' }}>{formatVND(item.closingValue)}</p>
                                                </td>

                                                {/* Đơn giá vốn Landed Cost */}
                                                <td className="px-3 py-3 text-right text-xs font-mono" style={{ color: '#8AAEBB' }}>
                                                    {formatVND(item.unitCost)}
                                                </td>

                                                {/* Thao tác Drill-down */}
                                                <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => handleDrillDown(item)}
                                                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-all group-hover:bg-[#87CBB9] group-hover:text-[#0A1926]"
                                                        style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.2)' }}>
                                                        <Eye size={12} /> Sổ Chi Tiết
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {/* Sticky Summary Footer Row */}
                                    {summaryStats && (
                                        <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10, background: '#142433', borderTop: '2px solid #2A4355' }}>
                                            <tr>
                                                <td colSpan={4} className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-right" style={{ color: '#E8F1F2' }}>
                                                    TỔNG CỘNG TOÀN KHO ({summaryStats.totalProducts} SKU):
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <p className="text-xs font-bold font-mono" style={{ color: '#D4A853' }}>{summaryStats.totalOpeningQty.toLocaleString()}</p>
                                                    <p className="text-[10px] font-mono" style={{ color: '#8AAEBB' }}>{formatVND(summaryStats.totalOpeningValue)}</p>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <p className="text-xs font-bold font-mono" style={{ color: '#5BA88A' }}>+{summaryStats.totalInQty.toLocaleString()}</p>
                                                    <p className="text-[10px] font-mono" style={{ color: '#8AAEBB' }}>{formatVND(summaryStats.totalInValue)}</p>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <p className="text-xs font-bold font-mono" style={{ color: '#C74B50' }}>-{summaryStats.totalOutQty.toLocaleString()}</p>
                                                    <p className="text-[10px] font-mono" style={{ color: '#8AAEBB' }}>{formatVND(summaryStats.totalOutValue)}</p>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <p className="text-xs font-bold font-mono" style={{ color: '#87CBB9' }}>{summaryStats.totalClosingQty.toLocaleString()}</p>
                                                    <p className="text-[10px] font-mono" style={{ color: '#87CBB9' }}>{formatVND(summaryStats.totalClosingValue)}</p>
                                                </td>
                                                <td colSpan={2}></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
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
                    <div className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>
                                <Package size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold font-mono px-2 py-0.5 rounded" style={{ background: '#1B2E3D', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                        {selectedProduct.skuCode}
                                    </span>
                                    <h2 className="text-base font-bold" style={{ color: '#E8F1F2' }}>{selectedProduct.productName}</h2>
                                </div>
                                <p className="text-xs mt-0.5" style={{ color: '#8AAEBB' }}>
                                    {selectedProduct.wineType} · {selectedProduct.country} | Khoảng thời gian: <span className="font-mono text-[#87CBB9]">{formatDate(dateFrom)}</span> đến <span className="font-mono text-[#87CBB9]">{formatDate(dateTo)}</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <select value={movementType} onChange={e => setMovementType(e.target.value as any)}
                                className={`text-xs ${inputCls}`} style={{ ...inputStyle, color: '#E8F1F2' }}>
                                <option value="ALL">Tất cả chứng từ</option>
                                <option value="IN">Chỉ xem Nhập Kho</option>
                                <option value="OUT">Chỉ xem Xuất Kho</option>
                            </select>

                            <button onClick={() => loadDetailReport()} disabled={loadingDetail}
                                className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1"
                                style={{ background: '#87CBB9', color: '#0A1926' }}>
                                {loadingDetail ? <Loader2 size={12} className="animate-spin" /> : <Filter size={12} />} Lọc
                            </button>
                        </div>
                    </div>

                    {/* Detail Summary Cards */}
                    {detailSummary && (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <div className="p-3.5 rounded-xl" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <p className="text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>Tồn Đầu Kỳ ({formatDate(dateFrom)})</p>
                                <p className="text-lg font-bold font-mono mt-1" style={{ color: '#D4A853' }}>{detailSummary.openingBalance.toLocaleString()} chai</p>
                            </div>
                            <div className="p-3.5 rounded-xl" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <p className="text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>Tổng Nhập Trong Kỳ</p>
                                <p className="text-lg font-bold font-mono mt-1" style={{ color: '#5BA88A' }}>+{detailSummary.totalIn.toLocaleString()} chai</p>
                            </div>
                            <div className="p-3.5 rounded-xl" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <p className="text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>Tổng Xuất Trong Kỳ</p>
                                <p className="text-lg font-bold font-mono mt-1" style={{ color: '#C74B50' }}>-{detailSummary.totalOut.toLocaleString()} chai</p>
                            </div>
                            <div className="p-3.5 rounded-xl" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <p className="text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>Tồn Cuối Kỳ ({formatDate(dateTo)})</p>
                                <p className="text-lg font-bold font-mono mt-1" style={{ color: '#87CBB9' }}>{detailSummary.closingBalance.toLocaleString()} chai</p>
                            </div>
                            <div className="p-3.5 rounded-xl" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <p className="text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>Giá Trị Tồn Cuối</p>
                                <p className="text-lg font-bold font-mono mt-1" style={{ color: '#87CBB9' }}>{formatVND(detailSummary.totalValue)}</p>
                            </div>
                        </div>
                    )}

                    {/* Timeline Table & Current Stock Locations */}
                    <div className="grid grid-cols-12 gap-5">
                        {/* Main Ledger Table */}
                        <div className="col-span-12 lg:col-span-8 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs uppercase tracking-widest font-bold" style={{ color: '#4A6A7A' }}>
                                    Sổ Chi Tiết Chứng Từ ({movements.length} giao dịch)
                                </h4>
                            </div>

                            {loadingDetail ? (
                                <div className="flex items-center justify-center py-16 gap-2">
                                    <Loader2 size={20} className="animate-spin" style={{ color: '#87CBB9' }} />
                                    <span className="text-xs" style={{ color: '#8AAEBB' }}>Đang nạp sổ chi tiết...</span>
                                </div>
                            ) : movements.length === 0 ? (
                                <div className="flex flex-col items-center py-16 gap-3 rounded-2xl" style={{ border: '1px dashed #2A4355' }}>
                                    <FileText size={32} style={{ color: '#2A4355' }} />
                                    <p className="text-sm" style={{ color: '#4A6A7A' }}>Không có phát sinh nhập/xuất nào trong khoảng thời gian này</p>
                                </div>
                            ) : (
                                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                                    <div style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355', position: 'sticky', top: 0, zIndex: 10 }}>
                                                    {['Ngày', 'Loại', 'Số CT', 'Kho / Vị Trí', 'Nhập', 'Xuất', 'Tồn Lũy Kế', 'Đơn Giá', 'Tham Chiếu'].map(h => (
                                                        <th key={h} className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Opening Balance Row */}
                                                {detailSummary && (
                                                    <tr style={{ background: 'rgba(212,168,83,0.08)', borderBottom: '1px solid #2A4355' }}>
                                                        <td className="px-3 py-2 text-xs font-bold" style={{ color: '#D4A853' }}>{formatDate(dateFrom)}</td>
                                                        <td colSpan={3} className="px-3 py-2 text-xs font-bold" style={{ color: '#D4A853' }}>--- TỒN ĐẦU KỲ ---</td>
                                                        <td className="px-3 py-2 text-center text-xs" style={{ color: '#4A6A7A' }}>—</td>
                                                        <td className="px-3 py-2 text-center text-xs" style={{ color: '#4A6A7A' }}>—</td>
                                                        <td className="px-3 py-2 text-center text-xs font-bold font-mono" style={{ color: '#D4A853' }}>{detailSummary.openingBalance.toLocaleString()}</td>
                                                        <td colSpan={2} className="px-3 py-2 text-xs" style={{ color: '#4A6A7A' }}>Mốc bắt đầu báo cáo</td>
                                                    </tr>
                                                )}

                                                {movements.map(m => {
                                                    const cfg = DOC_TYPE_CFG[m.docType] || { label: m.docType, color: '#8AAEBB', icon: FileText }
                                                    const Icon = cfg.icon
                                                    return (
                                                        <tr key={m.id} className="transition-colors hover:bg-[#142433]" style={{ borderBottom: '1px solid rgba(42,67,85,0.4)' }}>
                                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{formatDate(m.date)}</td>
                                                            <td className="px-3 py-2.5">
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                                    style={{ color: cfg.color, background: `${cfg.color}15` }}>
                                                                    <Icon size={10} /> {cfg.label}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-xs font-bold font-mono" style={{ color: '#87CBB9' }}>{m.docNo}</td>
                                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>
                                                                <div>{m.warehouseName}</div>
                                                                <div className="text-[10px] font-mono" style={{ color: '#4A6A7A' }}>📍 {m.locationCode} · Lô: {m.lotNo}</div>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                {m.qtyIn > 0 ? (
                                                                    <span className="text-xs font-bold font-mono" style={{ color: '#5BA88A' }}>+{m.qtyIn.toLocaleString()}</span>
                                                                ) : <span style={{ color: '#2A4355' }}>—</span>}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                {m.qtyOut > 0 ? (
                                                                    <span className="text-xs font-bold font-mono" style={{ color: '#C74B50' }}>-{m.qtyOut.toLocaleString()}</span>
                                                                ) : <span style={{ color: '#2A4355' }}>—</span>}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                <span className="text-xs font-bold font-mono" style={{ color: '#87CBB9' }}>
                                                                    {m.balance.toLocaleString()}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-xs font-mono" style={{ color: '#8AAEBB' }}>
                                                                {formatVND(m.unitCost)}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>{m.reference}</td>
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
                            <h4 className="text-xs uppercase tracking-widest font-bold" style={{ color: '#4A6A7A' }}>
                                Phân Bổ Tồn Kho Thực Tế Theo Vị Trí
                            </h4>
                            {stockLocations.length === 0 ? (
                                <div className="flex flex-col items-center py-8 gap-2 rounded-xl" style={{ border: '1px dashed #2A4355' }}>
                                    <MapPin size={20} style={{ color: '#2A4355' }} />
                                    <p className="text-xs" style={{ color: '#4A6A7A' }}>Không có lô hàng khả dụng trong kho</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                    {stockLocations.map((loc: any, i: number) => (
                                        <div key={i} className="p-3 rounded-xl space-y-1.5" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded font-mono" style={{ background: '#1B2E3D', color: '#87CBB9' }}>
                                                    📍 {loc.locationCode}
                                                </span>
                                                <span className="text-xs font-bold font-mono" style={{ color: '#5BA88A' }}>
                                                    {loc.qtyAvailable.toLocaleString()} chai
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px]" style={{ color: '#8AAEBB' }}>
                                                <span>{loc.warehouseName}</span>
                                                <span className="font-mono" style={{ color: '#D4A853' }}>Lô: {loc.lotNo}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px]" style={{ color: '#4A6A7A' }}>
                                                <span>Khu {loc.zone} · Giá vốn: {formatVND(loc.unitCost)}</span>
                                                <span>{formatVND(loc.qtyAvailable * loc.unitCost)}</span>
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
