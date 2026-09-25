'use client'

import { useState, useEffect, useTransition } from 'react'
import {
    ArrowRightLeft,
    RefreshCw,
    Search,
    Download,
    SlidersHorizontal,
    Building2,
    Wine,
    Package,
    AlertTriangle,
    CheckCircle2,
    Boxes,
    Layers,
    ArrowRight,
    Zap,
    ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'
import {
    type ReplenishmentSuggestionRow,
    type ReplenishmentCategory,
    getReplenishmentSuggestions
} from './actions'
import { CreateTransferDrawer, type TransferInitialData } from '../transfers/CreateTransferDrawer'

const WINE_TYPE_LABELS: Record<string, string> = {
    RED: 'Vang Đỏ',
    WHITE: 'Vang Trắng',
    SPARKLING: 'Vang Sủi',
    ROSE: 'Vang Hồng',
    DESSERT: 'Vang Ngọt',
    FORTIFIED: 'Vang Cường Hóa',
}

export function ReplenishmentTab() {
    const [isPending, startTransition] = useTransition()
    const [suggestions, setSuggestions] = useState<ReplenishmentSuggestionRow[]>([])
    const [stats, setStats] = useState({ totalAlerts: 0, intraTaCount: 0, toShowroomCount: 0 })
    const [loading, setLoading] = useState(true)

    // Filter states
    const [category, setCategory] = useState<ReplenishmentCategory>('ALL')
    const [targetThreshold, setTargetThreshold] = useState<number>(6)
    const [sourceMinStock, setSourceMinStock] = useState<number>(12)
    const [search, setSearch] = useState('')
    const [wineType, setWineType] = useState<string>('')

    // Drawer state
    const [transferOpen, setTransferOpen] = useState(false)
    const [transferInitialData, setTransferInitialData] = useState<TransferInitialData | null>(null)

    const loadData = async (
        curTarget = targetThreshold,
        curSource = sourceMinStock,
        curCat = category,
        curSearch = search,
        curWineType = wineType
    ) => {
        setLoading(true)
        try {
            const res = await getReplenishmentSuggestions({
                targetThreshold: curTarget,
                sourceMinStock: curSource,
                category: curCat,
                search: curSearch,
                wineType: curWineType || undefined,
            })
            setSuggestions(res.suggestions)
            setStats(res.stats)
        } catch (err: any) {
            toast.error('Lỗi tải gợi ý điều chuyển: ' + (err.message || 'Lỗi không xác định'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [category, targetThreshold, sourceMinStock, wineType])

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        loadData()
    }

    const handleCreateTransfer = (row: ReplenishmentSuggestionRow) => {
        setTransferInitialData({
            fromWarehouseId: row.sourceWarehouseId,
            toWarehouseId: row.targetWarehouseId,
            reason: row.category === 'INTRA_TA'
                ? 'Cân bằng tồn kho giữa các kho chi nhánh'
                : 'Phân bổ hàng hóa cho Kho Cửa hàng / HORECA',
            lines: [
                {
                    productId: row.productId,
                    qtyTransferred: row.suggestedQty,
                    vintage: row.vintage,
                    qtyAvailable: row.sourceStockAvailable,
                }
            ]
        })
        setTransferOpen(true)
    }

    const handleExportCSV = () => {
        if (suggestions.length === 0) return
        const headers = [
            'Phân Loại',
            'Mã SKU',
            'Tên Sản Phẩm',
            'Vintage',
            'Loại Vang',
            'Kho Cần Nhận (Đích)',
            'Tồn Hiện Tại (Đích)',
            'Kho Xuất (Nguồn)',
            'Tồn Có Sẵn (Nguồn)',
            'Đề Xuất Chuyển (Chai)',
            'Số Thùng (6c/thùng)',
            'Lý Do Điều Chuyển'
        ]
        const rows = suggestions.map(s => [
            s.category === 'INTRA_TA' ? 'Nội Bộ Thắng Ân' : 'Cấp Hàng Showroom',
            s.skuCode,
            s.productName.replace(/[\r\n]+/g, ' '),
            s.vintage ?? 'NV',
            WINE_TYPE_LABELS[s.wineType ?? ''] ?? s.wineType ?? '',
            s.targetWarehouseName,
            s.targetStockAvailable,
            s.sourceWarehouseName,
            s.sourceStockAvailable,
            s.suggestedQty,
            s.suggestedCases,
            s.reason
        ])

        const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
        const BOM = '\uFEFF'
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `goi-y-dieu-chuyen-kho-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const totalSuggestedBottles = suggestions.reduce((sum, s) => sum + s.suggestedQty, 0)
    const totalSuggestedCases = suggestions.reduce((sum, s) => sum + s.suggestedCases, 0)

    return (
        <div className="w-full space-y-4">
            {/* Top Info Banner */}
            <div className="p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
                style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/20 text-indigo-400">
                            <ArrowRightLeft size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                Gợi Ý Điều Chuyển Kho & Cân Bằng Tồn
                                {loading && <RefreshCw size={14} className="animate-spin text-[#0891B2]" />}
                            </h2>
                            <p className="text-xs text-slate-600">
                                Tự động rà soát kho bán/showroom sắp hết để đề xuất chuyển hàng từ kho tổng/kho cùng pháp nhân
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => loadData()}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border transition-colors cursor-pointer"
                        style={{ background: '#FFFFFF', borderColor: '#E2E8F0', color: '#0F172A' }}
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Làm mới
                    </button>
                    <button
                        onClick={handleExportCSV}
                        disabled={suggestions.length === 0}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border transition-colors cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                    >
                        <Download size={13} />
                        Xuất CSV
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border bg-white shadow-xs" style={{ borderColor: '#E2E8F0' }}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                        <span>Tổng SKU Cần Chuyển</span>
                        <AlertTriangle size={15} className="text-amber-500" />
                    </div>
                    <div className="text-2xl font-black font-mono text-slate-900">
                        {stats.totalAlerts} <span className="text-xs font-normal text-slate-500 font-sans">mặt hàng</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                        {totalSuggestedBottles.toLocaleString()} chai (~{totalSuggestedCases} thùng)
                    </div>
                </div>

                <div className="p-3.5 rounded-xl border bg-white shadow-xs" style={{ borderColor: '#E2E8F0' }}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                        <span>Bổ Sung Kho GVM (TA)</span>
                        <Building2 size={15} className="text-blue-600" />
                    </div>
                    <div className="text-2xl font-black font-mono text-blue-700">
                        {stats.intraTaCount} <span className="text-xs font-normal text-slate-500 font-sans">SKU</span>
                    </div>
                    <div className="text-[11px] text-blue-600 font-medium mt-1">
                        Từ Kho Thường Tín ➔ Tầng 2 GVM
                    </div>
                </div>

                <div className="p-3.5 rounded-xl border bg-white shadow-xs" style={{ borderColor: '#E2E8F0' }}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                        <span>Cấp Hàng Showroom</span>
                        <Wine size={15} className="text-emerald-600" />
                    </div>
                    <div className="text-2xl font-black font-mono text-emerald-700">
                        {stats.toShowroomCount} <span className="text-xs font-normal text-slate-500 font-sans">SKU</span>
                    </div>
                    <div className="text-[11px] text-emerald-600 font-medium mt-1">
                        Từ Kho Thắng Ân ➔ Showroom Lys
                    </div>
                </div>

                <div className="p-3.5 rounded-xl border bg-indigo-50/60 border-indigo-200 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 mb-1">
                        <span>Quy Cách Điều Chuyển</span>
                        <Boxes size={15} className="text-indigo-600" />
                    </div>
                    <div className="text-2xl font-black font-mono text-indigo-950">
                        6 / 12 <span className="text-xs font-normal text-indigo-700 font-sans">chai/thùng</span>
                    </div>
                    <div className="text-[11px] text-indigo-700 mt-1">
                        Làm tròn chẵn thùng khi xuất kho
                    </div>
                </div>
            </div>

            {/* Filter & Threshold Selector Bar */}
            <div className="p-4 rounded-xl border space-y-3 shadow-xs"
                style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Category Navigation Pills */}
                    <div className="flex items-center gap-1.5 p-1 rounded-lg bg-white border border-slate-200 overflow-x-auto">
                        {[
                            { key: 'ALL', label: 'Tất Cả Cảnh Báo', count: stats.totalAlerts },
                            { key: 'INTRA_TA', label: 'Nội Bộ Thắng Ân (TT ➔ GVM)', count: stats.intraTaCount },
                            { key: 'TO_SHOWROOM', label: 'Cấp Hàng Showroom (TA ➔ Lys)', count: stats.toShowroomCount },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setCategory(tab.key as ReplenishmentCategory)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                                    category === tab.key
                                        ? 'bg-[#0891B2] text-white shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                                    category === tab.key ? 'bg-slate-50/20 text-slate-900' : 'bg-white text-[#0891B2]'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Search Input */}
                    <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input
                            type="text"
                            placeholder="Tìm theo SKU, tên rượu..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg outline-none font-medium text-slate-900 bg-white border border-slate-200 focus:border-[#87CBB9]"
                        />
                    </form>
                </div>

                {/* Threshold Configuration Row */}
                <div className="pt-3 border-t border-slate-200/40 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Target WH Max Threshold */}
                        <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-medium">Kho đích sắp hết khi tồn:</span>
                            <div className="flex items-center gap-1">
                                {[
                                    { label: '≤ 3 chai', val: 3 },
                                    { label: '≤ 6 chai (1th)', val: 6 },
                                    { label: '≤ 12 chai (2th)', val: 12 },
                                    { label: '≤ 24 chai', val: 24 },
                                ].map(btn => (
                                    <button
                                        key={btn.val}
                                        type="button"
                                        onClick={() => setTargetThreshold(btn.val)}
                                        className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors cursor-pointer border ${
                                            targetThreshold === btn.val
                                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                                        }`}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Source WH Min Stock */}
                        <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-medium">Kho nguồn còn ít nhất:</span>
                            <div className="flex items-center gap-1">
                                {[
                                    { label: '≥ 6 chai', val: 6 },
                                    { label: '≥ 12 chai', val: 12 },
                                    { label: '≥ 24 chai', val: 24 },
                                ].map(btn => (
                                    <button
                                        key={btn.val}
                                        type="button"
                                        onClick={() => setSourceMinStock(btn.val)}
                                        className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors cursor-pointer border ${
                                            sourceMinStock === btn.val
                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                                        }`}
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Wine Type Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-slate-600">Loại vang:</span>
                        <select
                            value={wineType}
                            onChange={e => setWineType(e.target.value)}
                            className="px-2.5 py-1 rounded text-xs outline-none bg-white border border-slate-200 text-slate-900 cursor-pointer"
                        >
                            <option value="">Tất cả loại vang</option>
                            {Object.entries(WINE_TYPE_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Suggestions Table / Cards */}
            {suggestions.length === 0 ? (
                <div className="py-16 rounded-xl border text-center space-y-3 bg-white" style={{ borderColor: '#E2E8F0' }}>
                    <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
                    <div className="space-y-1">
                        <h3 className="text-base font-bold text-slate-800">Không có cảnh báo lệch tồn kho nào</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                            Tất cả các kho đều đang duy trì mức tồn kho cân bằng theo ngưỡng đã chọn (Kho đích &gt; {targetThreshold} chai hoặc Kho nguồn không đủ hàng).
                        </p>
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border overflow-hidden bg-white shadow-xs" style={{ borderColor: '#E2E8F0' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                    <th className="px-3.5 py-2.5">Mã SKU & Rượu Vang</th>
                                    <th className="px-3 py-2.5 text-center">VTG</th>
                                    <th className="px-3.5 py-2.5">Kho Đích (Cần Bổ Sung)</th>
                                    <th className="px-3.5 py-2.5">Kho Nguồn (Có Sẵn)</th>
                                    <th className="px-3.5 py-2.5 text-center">Đề Xuất Chuyển</th>
                                    <th className="px-3.5 py-2.5">Lý Do / Chi Tiết</th>
                                    <th className="px-3.5 py-2.5 text-right">Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {suggestions.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                        {/* SKU & Product Name */}
                                        <td className="px-3.5 py-2.5 min-w-[220px]">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-bold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 text-[11px]">
                                                        {row.skuCode}
                                                    </span>
                                                    {row.country && (
                                                        <span className="text-[10px] text-slate-500 font-medium">
                                                            {row.country}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-semibold text-slate-900 leading-snug line-clamp-2 text-xs">
                                                    {row.productName}
                                                </p>
                                            </div>
                                        </td>

                                        {/* Vintage */}
                                        <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-600 text-xs">
                                            {row.vintage ?? 'NV'}
                                        </td>

                                        {/* Target WH */}
                                        <td className="px-3.5 py-2.5 min-w-[180px]">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-slate-800 flex items-center gap-1">
                                                    <span className="truncate">{row.targetWarehouseName}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                                                        ⚠️ Còn: {row.targetStockAvailable} chai
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Source WH */}
                                        <td className="px-3.5 py-2.5 min-w-[180px]">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-slate-800 flex items-center gap-1">
                                                    <span className="truncate">{row.sourceWarehouseName}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                                        🟢 Sẵn có: {row.sourceStockAvailable} chai
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Suggested Qty */}
                                        <td className="px-3.5 py-2.5 text-center min-w-[130px]">
                                            <div className="inline-flex flex-col items-center">
                                                <span className="text-sm font-black font-mono text-indigo-700">
                                                    {row.suggestedQty} <span className="text-[10px] font-sans font-normal text-slate-500">chai</span>
                                                </span>
                                                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded mt-0.5">
                                                    ({row.suggestedCases} thùng)
                                                </span>
                                            </div>
                                        </td>

                                        {/* Reason / Category */}
                                        <td className="px-3.5 py-2.5 min-w-[200px]">
                                            <div className="space-y-1">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                                                    row.category === 'INTRA_TA'
                                                        ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                }`}>
                                                    {row.categoryLabel}
                                                </span>
                                                <p className="text-[11px] text-slate-500">
                                                    {row.reason}
                                                </p>
                                            </div>
                                        </td>

                                        {/* 1-Click Action */}
                                        <td className="px-3.5 py-2.5 text-right min-w-[150px]">
                                            <button
                                                onClick={() => handleCreateTransfer(row)}
                                                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold transition-all shadow-xs cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"
                                            >
                                                <Zap size={13} />
                                                Tạo Lệnh Chuyển
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Transfer Drawer with Prepopulated Data */}
            <CreateTransferDrawer
                open={transferOpen}
                onClose={() => {
                    setTransferOpen(false)
                    setTransferInitialData(null)
                }}
                onSuccess={() => {
                    setTransferOpen(false)
                    setTransferInitialData(null)
                    loadData()
                    toast.success('🎉 Đã lập phiếu chuyển kho thành công!')
                }}
                initialData={transferInitialData}
            />
        </div>
    )
}
