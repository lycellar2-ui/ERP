'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, Download, Upload, Calculator, RefreshCw, AlertCircle, Percent, Coins, ArrowUpRight, TrendingUp, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ExcelImportDialog } from '@/components/ExcelImportDialog'
import { MarginProductRow, getMarginProducts, bulkImportMarginPrices } from './actions'

// Flag emoji dictionary
const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
    GE: '🇬🇪', HU: '🇭🇺', GR: '🇬🇷', AT: '🇦🇹', RO: '🇷🇴', MX: '🇲🇽', JP: '🇯🇵',
}

const COUNTRY_NAMES: Record<string, string> = {
    FR: 'Pháp', IT: 'Ý', ES: 'TBN', PT: 'BĐN', DE: 'Đức',
    US: 'Mỹ', AU: 'Úc', NZ: 'NZ', AR: 'Argentina', CL: 'Chile', ZA: 'Nam Phi',
}

const WINE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    RED: { label: 'Đỏ', color: '#E05252', bg: 'rgba(224,82,82,0.12)' },
    WHITE: { label: 'Trắng', color: '#87CBB9', bg: 'rgba(135,203,185,0.12)' },
    ROSE: { label: 'Rosé', color: '#D4607A', bg: 'rgba(212,96,122,0.12)' },
    SPARKLING: { label: 'Sâm panh', color: '#7AC4C4', bg: 'rgba(122,196,196,0.12)' },
    FORTIFIED: { label: 'Fortified', color: '#B39EDB', bg: 'rgba(179,158,219,0.12)' },
    DESSERT: { label: 'Dessert', color: '#D4A853', bg: 'rgba(212,168,83,0.12)' },
}

function WineTypeBadge({ type }: { type: string }) {
    const cfg = WINE_TYPE_CONFIG[type] ?? { label: type, color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)' }
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
    )
}

function formatVND(val: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
        .format(val)
        .replace('₫', 'đ')
}

// Single calculated product row state for simulation
type SimulatedRow = {
    product: MarginProductRow
    // Editable inputs
    wholesaleInput: number
    discountPercent: number
    incentiveVnd: number
    // Calculated metrics
    netSellingPrice: number
    profit: number
    marginPercent: number
    markupPercent: number
    reductionVsWholesale: number
    reductionVsRetail: number
}

export function MarginClient({ initialRows }: { initialRows: MarginProductRow[] }) {
    const [dbRows, setDbRows] = useState<MarginProductRow[]>(initialRows)
    const [loading, setLoading] = useState(false)
    const [importOpen, setImportOpen] = useState(false)

    // Filter states
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [countryFilter, setCountryFilter] = useState('')

    // Simulation states
    const [simData, setSimData] = useState<Record<string, { wholesale: number; discount: number; incentive: number }>>({})

    // Initialize/sync simulated values when dbRows changes
    useEffect(() => {
        const nextSim: Record<string, { wholesale: number; discount: number; incentive: number }> = { ...simData }
        dbRows.forEach(r => {
            if (!nextSim[r.id]) {
                nextSim[r.id] = {
                    wholesale: r.wholesalePrice,
                    discount: 0,
                    incentive: 0
                }
            }
        })
        setSimData(nextSim)
    }, [dbRows])

    const reloadData = async () => {
        setLoading(true)
        try {
            const data = await getMarginProducts()
            setDbRows(data)
            toast.success('Đã làm mới dữ liệu từ Database')
        } catch {
            toast.error('Lỗi tải dữ liệu sản phẩm')
        } finally {
            setLoading(false)
        }
    }

    // Individual input updater
    const updateInput = (productId: string, field: 'wholesale' | 'discount' | 'incentive', value: number) => {
        setSimData(prev => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                [field]: value
            }
        }))
    }

    // Bulk action states
    const [bulkDiscount, setBulkDiscount] = useState('')
    const [bulkIncentive, setBulkIncentive] = useState('')

    // Computes all simulated rows
    const simulatedRows = useMemo<SimulatedRow[]>(() => {
        return dbRows.map(r => {
            const preset = simData[r.id] ?? { wholesale: r.wholesalePrice, discount: 0, incentive: 0 }
            const w = preset.wholesale
            const d = preset.discount
            const incentive = preset.incentive

            // Formulas: pre-tax
            const netSellingPrice = Math.max(0, Math.round(w * (1 - d / 100) - incentive))
            const profit = netSellingPrice - r.costPrice
            const marginPercent = netSellingPrice > 0 ? (profit / netSellingPrice) * 100 : -100
            const markupPercent = r.costPrice > 0 ? (profit / r.costPrice) * 100 : 0
            const reductionVsWholesale = w > 0 ? ((w - netSellingPrice) / w) * 100 : 0
            const reductionVsRetail = r.retailPrice > 0 ? ((r.retailPrice - netSellingPrice) / r.retailPrice) * 100 : 0

            return {
                product: r,
                wholesaleInput: w,
                discountPercent: d,
                incentiveVnd: incentive,
                netSellingPrice,
                profit,
                marginPercent,
                markupPercent,
                reductionVsWholesale,
                reductionVsRetail
            }
        })
    }, [dbRows, simData])

    // Filters products based on text search and selections
    const filteredRows = useMemo(() => {
        return simulatedRows.filter(row => {
            const p = row.product
            const matchesSearch = !search ||
                p.productName.toLowerCase().includes(search.toLowerCase()) ||
                p.skuCode.toLowerCase().includes(search.toLowerCase())
            const matchesType = !typeFilter || p.wineType === typeFilter
            const matchesCountry = !countryFilter || p.country === countryFilter

            return matchesSearch && matchesType && matchesCountry
        })
    }, [simulatedRows, search, typeFilter, countryFilter])

    // Bulk apply preset methods
    const applyDefaultWholesale = () => {
        const next = { ...simData }
        filteredRows.forEach(row => {
            next[row.product.id] = {
                ...next[row.product.id],
                wholesale: Math.round(row.product.retailPrice * 0.8) // Default sỉ = 80% lẻ
            }
        })
        setSimData(next)
        toast.success('Đã reset giá sỉ = 80% giá lẻ cho danh sách đang lọc')
    }

    const applyBulkDiscount = () => {
        const pct = parseFloat(bulkDiscount)
        if (isNaN(pct) || pct < 0 || pct > 100) {
            toast.error('Vui lòng nhập số phần trăm chiết khấu hợp lệ (0-100)')
            return
        }
        const next = { ...simData }
        filteredRows.forEach(row => {
            next[row.product.id] = {
                ...next[row.product.id],
                discount: pct
            }
        })
        setSimData(next)
        toast.success(`Đã áp dụng chiết khấu ${pct}% cho danh sách đang lọc`)
        setBulkDiscount('')
    }

    const applyBulkIncentive = () => {
        const inc = parseInt(bulkIncentive)
        if (isNaN(inc) || inc < 0) {
            toast.error('Vui lòng nhập số tiền incentive hợp lệ')
            return
        }
        const next = { ...simData }
        filteredRows.forEach(row => {
            next[row.product.id] = {
                ...next[row.product.id],
                incentive: inc
            }
        })
        setSimData(next)
        toast.success(`Đã áp dụng incentive ${formatVND(inc)}/chai cho danh sách đang lọc`)
        setBulkIncentive('')
    }

    const resetAllSimulations = () => {
        const next = { ...simData }
        filteredRows.forEach(row => {
            next[row.product.id] = {
                wholesale: row.product.wholesalePrice,
                discount: 0,
                incentive: 0
            }
        })
        setSimData(next)
        toast.success('Đã đặt lại kịch bản mô phỏng về mặc định')
    }

    // Dynamic aggregated summary of filtered rows
    const summary = useMemo(() => {
        const count = filteredRows.length
        if (count === 0) return { avgCost: 0, avgWholesale: 0, avgNet: 0, avgMargin: 0, avgMarkup: 0, totalProfit: 0 }

        const totalCost = filteredRows.reduce((sum, r) => sum + r.product.costPrice, 0)
        const totalWholesale = filteredRows.reduce((sum, r) => sum + r.wholesaleInput, 0)
        const totalNet = filteredRows.reduce((sum, r) => sum + r.netSellingPrice, 0)
        const totalProfit = filteredRows.reduce((sum, r) => sum + r.profit, 0)

        const avgCost = Math.round(totalCost / count)
        const avgWholesale = Math.round(totalWholesale / count)
        const avgNet = Math.round(totalNet / count)
        const avgMargin = totalNet > 0 ? (totalProfit / totalNet) * 100 : 0
        const avgMarkup = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0

        return { avgCost, avgWholesale, avgNet, avgMargin, avgMarkup, totalProfit }
    }, [filteredRows])

    // Countries & Types lists dynamically compiled from database rows
    const uniqueCountries = useMemo(() => {
        const codes = Array.from(new Set(dbRows.map(r => r.country)))
        return codes.filter(Boolean).sort()
    }, [dbRows])

    const handleExportCsv = () => {
        if (filteredRows.length === 0) {
            toast.error('Không có sản phẩm để xuất báo cáo')
            return
        }

        const headers = [
            'SKU', 'Tên sản phẩm', 'Loại', 'Quốc gia', 'Vintage',
            'Giá vốn trước thuế (VND)', 'Giá lẻ trước thuế (VND)',
            'Giá sỉ đề xuất (VND)', 'Chiết khấu (%)', 'Incentive (VND)',
            'Giá bán ròng (VND)', 'Lợi nhuận gộp (VND)', 'Biên lợi nhuận (%)', 'Tỷ lệ Markup (%)',
            'Mức giảm vs Wholesale (%)', 'Mức giảm vs Retail (%)'
        ]

        const csvRows = [
            headers.join(','),
            ...filteredRows.map(r => [
                r.product.skuCode,
                `"${r.product.productName.replace(/"/g, '""')}"`,
                r.product.wineType,
                r.product.country,
                r.product.vintage ?? 'NV',
                r.product.costPrice,
                r.product.retailPrice,
                r.wholesaleInput,
                r.discountPercent,
                r.incentiveVnd,
                r.netSellingPrice,
                r.profit,
                r.marginPercent.toFixed(1),
                r.markupPercent.toFixed(1),
                r.reductionVsWholesale.toFixed(1),
                r.reductionVsRetail.toFixed(1)
            ].join(','))
        ]

        const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `mo_phong_bien_loi_nhuan_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Đã xuất báo cáo mô phỏng cho ${filteredRows.length} sản phẩm`)
    }

    return (
        <div className="space-y-4 max-w-screen-2xl">
            {/* Header section with upload/refresh */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1E2B]/40 p-3 rounded-xl border border-[#2A4355]/30">
                <div>
                    <h2 className="text-lg font-bold inline-flex items-center gap-2"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Bảng Mô Phỏng Margin Giá Vang (Pre-Tax)
                        <span className="text-xs font-normal px-2 py-0.5 rounded" style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}>
                            Mô Phỏng Sandbox
                        </span>
                    </h2>
                    <p className="text-[11px] mt-0.5" style={{ color: '#4A6A7A' }}>
                        Nhập sỉ, chiết khấu và incentive để theo dõi biên lợi nhuận, so sánh mức giảm giá wholesale/retail
                    </p>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        onClick={reloadData}
                        disabled={loading}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        style={{ background: '#1B2E3D', color: '#87CBB9', border: '1px solid #2A4355' }}
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 
                        {loading ? 'Đang làm mới...' : 'Làm mới DB'}
                    </button>
                    <button
                        onClick={() => setImportOpen(true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ background: '#1B2E3D', color: '#D4A853', border: '1px solid #2A4355' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#142433'; e.currentTarget.style.borderColor = '#D4A853' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#1B2E3D'; e.currentTarget.style.borderColor = '#2A4355' }}
                    >
                        <Upload size={13} /> Upload Bảng Giá
                    </button>
                    <button
                        onClick={handleExportCsv}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                        style={{ background: '#87CBB9', color: '#0A1926' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}
                    >
                        <Download size={13} /> Export CSV
                    </button>
                </div>
            </div>

            {/* Summary metrics display block */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                <div className="bg-[#1B2E3D]/50 border border-[#2A4355]/30 p-2.5 rounded-xl text-center">
                    <p className="text-[10px] uppercase font-bold tracking-wide" style={{ color: '#4A6A7A' }}>Giá Vốn TB</p>
                    <p className="text-sm font-bold mt-1 text-[#E8F1F2] font-mono">{formatVND(summary.avgCost)}</p>
                </div>
                <div className="bg-[#1B2E3D]/50 border border-[#2A4355]/30 p-2.5 rounded-xl text-center">
                    <p className="text-[10px] uppercase font-bold tracking-wide" style={{ color: '#4A6A7A' }}>Wholesale TB</p>
                    <p className="text-sm font-bold mt-1 text-[#E8F1F2] font-mono">{formatVND(summary.avgWholesale)}</p>
                </div>
                <div className="bg-[#1B2E3D]/50 border border-[#2A4355]/30 p-2.5 rounded-xl text-center">
                    <p className="text-[10px] uppercase font-bold tracking-wide" style={{ color: '#4A6A7A' }}>Giá Bán Ròng TB</p>
                    <p className="text-sm font-bold mt-1 text-[#87CBB9] font-mono">{formatVND(summary.avgNet)}</p>
                </div>
                <div className="bg-[#1B2E3D]/50 border border-[#2A4355]/30 p-2.5 rounded-xl text-center">
                    <p className="text-[10px] uppercase font-bold tracking-wide" style={{ color: '#4A6A7A' }}>Biên Lợi Nhuận TB</p>
                    <p className="text-sm font-bold mt-1 text-[#D4A853] font-mono">
                        {summary.avgMargin.toFixed(1)}%
                    </p>
                </div>
                <div className="bg-[#1B2E3D]/50 border border-[#2A4355]/30 p-2.5 rounded-xl text-center col-span-2 md:col-span-1">
                    <p className="text-[10px] uppercase font-bold tracking-wide" style={{ color: '#4A6A7A' }}>Markup Vốn TB</p>
                    <p className="text-sm font-bold mt-1 text-[#5BA88A] font-mono">
                        {summary.avgMarkup.toFixed(1)}%
                    </p>
                </div>
            </div>

            {/* Quick Bulk Adjustments Presets Toolbar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-[#1B2E3D]/30 border border-[#2A4355]/20 rounded-xl">
                <span className="text-xs font-bold text-[#E8F1F2] flex items-center gap-1">
                    <Calculator size={13} style={{ color: '#87CBB9' }} /> Áp dụng nhanh cho &nbsp;<strong className="text-[#87CBB9] font-mono">{filteredRows.length}</strong>&nbsp; sản phẩm đang lọc:
                </span>
                
                <div className="h-4 w-[1px] bg-[#2A4355]/40 hidden lg:block" />

                {/* Reset sỉ */}
                <button
                    onClick={applyDefaultWholesale}
                    className="px-2.5 py-1 rounded text-xs transition-colors bg-[#1B2E3D] hover:bg-[#142433] text-[#8AAEBB] border border-[#2A4355]"
                >
                    Đặt Sỉ = 80% Lẻ
                </button>

                <div className="h-4 w-[1px] bg-[#2A4355]/40" />

                {/* Bulk Discount % */}
                <div className="flex items-center gap-1">
                    <div className="relative">
                        <input
                            type="number"
                            placeholder="Chiết khấu sỉ"
                            value={bulkDiscount}
                            onChange={e => setBulkDiscount(e.target.value)}
                            className="pl-2 pr-5 py-1 w-24 bg-[#142433] border border-[#2A4355] rounded text-xs text-[#E8F1F2]"
                        />
                        <Percent size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4A6A7A]" />
                    </div>
                    <button
                        onClick={applyBulkDiscount}
                        className="px-2 py-1 bg-[#2A4355]/40 hover:bg-[#2A4355]/60 text-[11px] text-[#E8F1F2] rounded border border-[#2A4355]/60"
                    >
                        Áp Dụng
                    </button>
                </div>

                <div className="h-4 w-[1px] bg-[#2A4355]/40" />

                {/* Bulk Incentive */}
                <div className="flex items-center gap-1">
                    <div className="relative">
                        <input
                            type="number"
                            placeholder="Incentive VND"
                            value={bulkIncentive}
                            onChange={e => setBulkIncentive(e.target.value)}
                            className="pl-2 pr-5 py-1 w-28 bg-[#142433] border border-[#2A4355] rounded text-xs text-[#E8F1F2]"
                        />
                        <Coins size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4A6A7A]" />
                    </div>
                    <button
                        onClick={applyBulkIncentive}
                        className="px-2 py-1 bg-[#2A4355]/40 hover:bg-[#2A4355]/60 text-[11px] text-[#E8F1F2] rounded border border-[#2A4355]/60"
                    >
                        Áp Dụng
                    </button>
                </div>

                <div className="flex-1" />

                {/* Reset simulation */}
                <button
                    onClick={resetAllSimulations}
                    className="px-2.5 py-1 text-xs text-[#E05252] border border-[#E05252]/20 hover:border-[#E05252]/40 rounded hover:bg-[#E05252]/5 transition-colors"
                >
                    Reset Bộ Tính
                </button>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm sản phẩm theo tên hoặc SKU..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: typeFilter ? '#E8F1F2' : '#4A6A7A' }}
                >
                    <option value="">Tất cả loại vang</option>
                    <option value="RED">🔴 Vang Đỏ</option>
                    <option value="WHITE">🟡 Vang Trắng</option>
                    <option value="ROSE">🌸 Rosé</option>
                    <option value="SPARKLING">🥂 Sâm panh</option>
                    <option value="FORTIFIED">🍯 Fortified</option>
                    <option value="DESSERT">🍰 Dessert</option>
                </select>
                <select
                    value={countryFilter}
                    onChange={e => setCountryFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: countryFilter ? '#E8F1F2' : '#4A6A7A' }}
                >
                    <option value="">Tất cả quốc gia</option>
                    {uniqueCountries.map(code => (
                        <option key={code} value={code}>
                            {COUNTRY_FLAGS[code] ?? '🌍'} {COUNTRY_NAMES[code] ?? code}
                        </option>
                    ))}
                </select>
            </div>

            {/* Calculations Simulation Grid Table */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                <th className="px-3 py-2 text-xs uppercase tracking-wider font-semibold text-[#4A6A7A] w-[260px]">Sản phẩm</th>
                                <th className="px-2.5 py-2 text-xs uppercase tracking-wider font-semibold text-[#4A6A7A] text-right w-[110px]">Giá vốn trước thuế</th>
                                <th className="px-2.5 py-2 text-xs uppercase tracking-wider font-semibold text-[#4A6A7A] text-right w-[110px]">Giá lẻ trước thuế</th>
                                <th className="px-2.5 py-2 text-xs uppercase tracking-wider font-semibold text-[#4A6A7A] text-right w-[125px]">Giá Sỉ Wholesale (W)</th>
                                <th className="px-2.5 py-2 text-xs uppercase tracking-wider font-semibold text-[#4A6A7A] text-center w-[90px]">C.Khấu sỉ D(%)</th>
                                <th className="px-2.5 py-2 text-xs uppercase tracking-wider font-semibold text-[#4A6A7A] text-right w-[105px]">Incentive/chai</th>
                                <th className="px-2.5 py-2 text-xs uppercase tracking-wider font-semibold text-[#4A6A7A] text-right w-[115px]">Giá Bán Ròng (Net)</th>
                                <th className="px-2.5 py-2 text-xs uppercase tracking-wider font-semibold text-[#4A6A7A] text-right w-[110px]">Lãi gộp VND</th>
                                <th className="px-2.5 py-2 text-xs uppercase tracking-wider font-semibold text-[#4A6A7A] text-center w-[90px]">Margin (%)</th>
                                <th className="px-2.5 py-2 text-xs uppercase tracking-wider font-semibold text-[#4A6A7A] text-center w-[90px]">Markup (%)</th>
                                <th className="px-2.5 py-2 text-xs uppercase tracking-wider font-semibold text-[#4A6A7A] text-center w-[95px]">% Giảm vs Sỉ</th>
                                <th className="px-2.5 py-2 text-xs uppercase tracking-wider font-semibold text-[#4A6A7A] text-center w-[95px]">% Giảm vs Lẻ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="px-4 py-16 text-center">
                                        <p className="font-semibold text-sm" style={{ color: '#E8F1F2' }}>Không có sản phẩm nào khớp bộ lọc</p>
                                        <p className="text-xs mt-1" style={{ color: '#4A6A7A' }}>Vui lòng thay đổi từ khóa tìm kiếm</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map(row => (
                                    <SimulatedTableRow
                                        key={row.product.id}
                                        row={row}
                                        onUpdate={updateInput}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Custom pricing upload dialog */}
            <ExcelImportDialog
                open={importOpen}
                onClose={() => setImportOpen(false)}
                title="Upload Bảng Giá (Giá Vốn, Giá Lẻ, Giá Sỉ)"
                templateFileName="template_bang_gia_mo_phong.xlsx"
                templateColumns={[
                    { header: 'SKU', sample: 'MOUTON-2018-750', required: true },
                    { header: 'Giá vốn', sample: '850000', required: true },
                    { header: 'Giá retail', sample: '1500000', required: true },
                    { header: 'Giá wholesale', sample: '1200000', required: true }
                ]}
                onImport={bulkImportMarginPrices}
                onComplete={() => {
                    setImportOpen(false)
                    reloadData()
                }}
            />
        </div>
    )
}

function SimulatedTableRow({
    row,
    onUpdate
}: {
    row: SimulatedRow
    onUpdate: (productId: string, field: 'wholesale' | 'discount' | 'incentive', value: number) => void
}) {
    const p = row.product
    const flag = COUNTRY_FLAGS[p.country] ?? '🌍'

    // Smart vertical image auto-rotation ref/effect
    const [isVertical, setIsVertical] = useState(false)
    const imgRef = useRef<HTMLImageElement>(null)

    useEffect(() => {
        const img = imgRef.current
        if (!img) return

        const handleLoad = () => {
            if (img.naturalHeight > img.naturalWidth * 1.2) {
                setIsVertical(true)
            } else {
                setIsVertical(false)
            }
        }

        if (img.complete) {
            handleLoad()
        } else {
            setIsVertical(false)
            img.addEventListener('load', handleLoad)
            return () => img.removeEventListener('load', handleLoad)
        }
    }, [p.primaryImageUrl])

    return (
        <tr className="group border-b border-[#2A4355]/30 hover:bg-[#1B2E3D]/10 transition-colors">
            {/* Product description & thumbnail */}
            <td className="px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="relative group/img w-10 h-7 rounded bg-[#142433] border border-[#2A4355]/60 flex items-center justify-center flex-shrink-0">
                        {p.primaryImageUrl ? (
                            <img
                                ref={imgRef}
                                src={p.primaryImageUrl}
                                alt={p.productName}
                                className={`object-contain transition-all duration-100 ${
                                    isVertical
                                        ? 'absolute w-[22px] h-[36px] rotate-90'
                                        : 'w-full h-full p-0.5'
                                }`}
                            />
                        ) : (
                            <span className="text-[10px]" style={{ color: '#2A4355' }}>🍷</span>
                        )}
                    </div>
                    <div className="min-w-0 leading-tight">
                        <p className="text-xs font-semibold truncate text-[#E8F1F2] max-w-[200px]" title={p.productName}>
                            {p.productName}
                        </p>
                        <p className="text-[9px] mt-0.5 text-[#4A6A7A] font-mono flex items-center gap-1.5 flex-wrap">
                            <span className="text-[#8AAEBB]">{p.skuCode}</span>
                            <span>{p.vintage ? `V:${p.vintage}` : 'NV'}</span>
                            <span>{flag}</span>
                            <WineTypeBadge type={p.wineType} />
                        </p>
                    </div>
                </div>
            </td>

            {/* Giá Vốn trước thuế */}
            <td className="px-2.5 py-2 text-right font-mono text-xs text-[#8AAEBB] whitespace-nowrap">
                <span className="flex flex-col items-end">
                    <span>{formatVND(p.costPrice)}</span>
                    {!p.hasCustomPrice && (
                        <span className="text-[8px] text-[#4A6A7A] font-normal italic leading-none mt-0.5">(giả lập)</span>
                    )}
                </span>
            </td>

            {/* Giá Retail trước thuế */}
            <td className="px-2.5 py-2 text-right font-mono text-xs text-[#8AAEBB] whitespace-nowrap">
                <span className="flex flex-col items-end">
                    <span>{formatVND(p.retailPrice)}</span>
                    {!p.hasCustomPrice && (
                        <span className="text-[8px] text-[#4A6A7A] font-normal italic leading-none mt-0.5">(giả lập)</span>
                    )}
                </span>
            </td>

            {/* Giá Sỉ Wholesale (W) Input */}
            <td className="px-2.5 py-2 text-right">
                <div className="inline-flex items-center justify-end w-full">
                    <input
                        type="number"
                        value={row.wholesaleInput === 0 ? '' : row.wholesaleInput}
                        onChange={e => onUpdate(p.id, 'wholesale', Math.max(0, parseInt(e.target.value || '0')))}
                        className="w-[105px] px-1.5 py-0.5 bg-[#142433] border border-[#2A4355] rounded text-right font-mono text-xs text-[#E8F1F2] font-semibold outline-none focus:border-[#87CBB9]"
                        placeholder="0đ"
                    />
                </div>
            </td>

            {/* % Chiết khấu sỉ Input */}
            <td className="px-2.5 py-2 text-center">
                <div className="inline-flex items-center justify-center w-full">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={row.discountPercent === 0 ? '' : row.discountPercent}
                        onChange={e => onUpdate(p.id, 'discount', Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                        className="w-[55px] px-1.5 py-0.5 bg-[#142433] border border-[#2A4355] rounded text-center font-mono text-xs text-[#E8F1F2] outline-none focus:border-[#87CBB9]"
                        placeholder="0"
                    />
                    <span className="text-[10px] text-[#4A6A7A] ml-0.5">%</span>
                </div>
            </td>

            {/* Incentive/chai Input */}
            <td className="px-2.5 py-2 text-right">
                <div className="inline-flex items-center justify-end w-full">
                    <input
                        type="number"
                        value={row.incentiveVnd === 0 ? '' : row.incentiveVnd}
                        onChange={e => onUpdate(p.id, 'incentive', Math.max(0, parseInt(e.target.value || '0')))}
                        className="w-[85px] px-1.5 py-0.5 bg-[#142433] border border-[#2A4355] rounded text-right font-mono text-xs text-[#E8F1F2] outline-none focus:border-[#87CBB9]"
                        placeholder="0đ"
                    />
                </div>
            </td>

            {/* Giá Bán Ròng (Net) */}
            <td className="px-2.5 py-2 text-right font-mono text-xs text-[#87CBB9] font-bold whitespace-nowrap">
                {formatVND(row.netSellingPrice)}
            </td>

            {/* Lãi gộp VND */}
            <td className="px-2.5 py-2 text-right font-mono text-xs font-bold whitespace-nowrap"
                style={{ color: row.profit >= 0 ? '#5BA88A' : '#E05252' }}>
                {row.profit >= 0 ? '+' : ''}{formatVND(row.profit)}
            </td>

            {/* Margin (%) */}
            <td className="px-2.5 py-2 text-center whitespace-nowrap">
                {row.marginPercent === -100 ? (
                    <span className="text-[10px] text-[#4A6A7A] font-mono">N/A</span>
                ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                        style={{
                            background: row.marginPercent < 15 ? 'rgba(224,82,82,0.12)' : row.marginPercent >= 35 ? 'rgba(212,168,83,0.12)' : 'rgba(91,168,138,0.12)',
                            color: row.marginPercent < 15 ? '#E05252' : row.marginPercent >= 35 ? '#D4A853' : '#5BA88A'
                        }}>
                        {row.marginPercent.toFixed(1)}%
                    </span>
                )}
            </td>

            {/* Markup (%) */}
            <td className="px-2.5 py-2 text-center whitespace-nowrap font-mono text-[10px]"
                style={{ color: row.markupPercent >= 35 ? '#D4A853' : row.markupPercent >= 0 ? '#5BA88A' : '#E05252' }}>
                {row.markupPercent.toFixed(1)}%
            </td>

            {/* % Giảm vs Wholesale */}
            <td className="px-2.5 py-2 text-center whitespace-nowrap font-mono text-[10px] text-[#8AAEBB]">
                {row.reductionVsWholesale > 0 ? (
                    <span className="flex items-center justify-center gap-0.5 text-[#E05252]/80">
                        <ArrowUpRight size={10} className="rotate-90" /> {row.reductionVsWholesale.toFixed(1)}%
                    </span>
                ) : (
                    <span className="text-[#4A6A7A]">0%</span>
                )}
            </td>

            {/* % Giảm vs Retail */}
            <td className="px-2.5 py-2 text-center whitespace-nowrap font-mono text-[10px] text-[#8AAEBB]">
                {row.reductionVsRetail > 0 ? (
                    <span className="flex items-center justify-center gap-0.5 text-[#E05252]">
                        <ArrowUpRight size={10} className="rotate-90" /> {row.reductionVsRetail.toFixed(1)}%
                    </span>
                ) : (
                    <span className="text-[#4A6A7A]">0%</span>
                )}
            </td>
        </tr>
    )
}
