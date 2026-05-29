'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, Download, Upload, Calculator, RefreshCw, Trash2, ArrowUpRight, Plus, HelpCircle, Check, ChevronDown } from 'lucide-react'
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

function formatNumberString(val: number | string) {
    if (val === undefined || val === null || val === '') return ''
    const clean = String(val).replace(/\D/g, '')
    if (!clean) return ''
    return new Intl.NumberFormat('vi-VN').format(parseInt(clean))
}

function parseNumberString(val: string): number {
    const clean = val.replace(/\D/g, '')
    return clean ? parseInt(clean) : 0
}

// Simulated active pricing parameters
type AddedProduct = {
    id: string // maps to product.id
    product: MarginProductRow
    sellingPrice: number // user-defined actual selling price (S)
    discount: number     // additional discount percent (D %)
    incentive: number    // additional incentive VND (I)
}

// Extracted metrics derived from inputs
type ComputedRow = {
    product: MarginProductRow
    sellingPrice: number
    discountPercent: number
    incentiveVnd: number
    netSellingPrice: number
    profit: number
    marginPercent: number
    markupPercent: number
    reductionVsWholesale: number
    reductionVsRetail: number
}

export function MarginClient({ initialRows, isAdmin }: { initialRows: MarginProductRow[]; isAdmin: boolean }) {
    const [dbRows, setDbRows] = useState<MarginProductRow[]>(initialRows)
    const [loading, setLoading] = useState(false)
    const [importOpen, setImportOpen] = useState(false)

    // Product Autocomplete States
    const [supplierFilter, setSupplierFilter] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [isOpenDropdown, setIsOpenDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Selected Active Product for simulation
    const [activeProduct, setActiveProduct] = useState<MarginProductRow | null>(null)
    
    // Active Simulator Workbench States
    const [simSellingPrice, setSimSellingPrice] = useState<number>(0)
    const [simDiscount, setSimDiscount] = useState<number>(0)
    const [simIncentive, setSimIncentive] = useState<number>(0)

    // Báo Giá Nhanh Accumulated Products List
    const [addedProducts, setAddedProducts] = useState<AddedProduct[]>([])

    // Close autocomplete when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpenDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Sync active inputs when product is selected
    useEffect(() => {
        if (activeProduct) {
            setSimSellingPrice(activeProduct.wholesalePrice)
            setSimDiscount(0)
            setSimIncentive(0)
        }
    }, [activeProduct])

    const reloadData = async () => {
        setLoading(true)
        try {
            const data = await getMarginProducts()
            setDbRows(data)
            toast.success('Đã làm mới danh mục sản phẩm từ Database')
        } catch {
            toast.error('Lỗi tải dữ liệu sản phẩm')
        } finally {
            setLoading(false)
        }
    }

    // Dynamic list of unique suppliers (NCC)
    const uniqueSuppliers = useMemo(() => {
        const list = dbRows.map(p => ({ id: p.producerId, name: p.producerName }))
        const seen = new Set<string>()
        return list.filter(item => {
            if (seen.has(item.id)) return false
            seen.add(item.id)
            return true
        }).sort((a, b) => a.name.localeCompare(b.name))
    }, [dbRows])

    // Filter autocomplete suggestions based on search text and supplier filter (NCC)
    const autocompleteSuggestions = useMemo(() => {
        let list = dbRows
        if (supplierFilter) {
            list = list.filter(p => p.producerId === supplierFilter)
        }
        if (!searchQuery.trim()) {
            return list.slice(0, 15)
        }
        const q = searchQuery.toLowerCase()
        return list.filter(p => 
            p.productName.toLowerCase().includes(q) || 
            p.skuCode.toLowerCase().includes(q)
        ).slice(0, 30)
    }, [dbRows, searchQuery, supplierFilter])

    // Calculates individual computed rows for the report list
    const computedRows = useMemo<ComputedRow[]>(() => {
        return addedProducts.map(item => {
            const r = item.product
            const s = item.sellingPrice
            const d = item.discount
            const incentive = item.incentive

            // Formulas: pre-tax
            const netSellingPrice = Math.max(0, Math.round(s * (1 - d / 100) - incentive))
            const profit = netSellingPrice - r.costPrice
            const marginPercent = netSellingPrice > 0 ? (profit / netSellingPrice) * 100 : -100
            const markupPercent = r.costPrice > 0 ? (profit / r.costPrice) * 100 : 0
            const reductionVsWholesale = r.wholesalePrice > 0 ? ((r.wholesalePrice - netSellingPrice) / r.wholesalePrice) * 100 : 0
            const reductionVsRetail = r.retailPrice > 0 ? ((r.retailPrice - netSellingPrice) / r.retailPrice) * 100 : 0

            return {
                product: r,
                sellingPrice: s,
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
    }, [addedProducts])



    // Add current simulated product into addedProducts collection
    const handleAddToReport = () => {
        if (!activeProduct) return
        
        const currentItem: AddedProduct = {
            id: activeProduct.id,
            product: activeProduct,
            sellingPrice: simSellingPrice,
            discount: simDiscount,
            incentive: simIncentive
        }

        setAddedProducts(prev => {
            const existsIndex = prev.findIndex(item => item.product.id === activeProduct.id)
            if (existsIndex >= 0) {
                const next = [...prev]
                next[existsIndex] = currentItem
                toast.success(`Đã cập nhật cấu hình cho ${activeProduct.productName} trong Báo Giá Nhanh`)
                return next
            } else {
                toast.success(`Đã thêm ${activeProduct.productName} vào Báo Giá Nhanh`)
                return [...prev, currentItem]
            }
        })

        // Reset selector
        setActiveProduct(null)
        setSearchQuery('')
    }

    // Direct inline modification of inputs inside table rows
    const updateInlineProduct = (productId: string, field: 'sellingPrice' | 'discount' | 'incentive', value: number) => {
        setAddedProducts(prev => prev.map(item => {
            if (item.product.id === productId) {
                return {
                    ...item,
                    [field]: value
                }
            }
            return item
        }))
    }

    // Delete single item from report
    const removeProductFromReport = (productId: string) => {
        setAddedProducts(prev => prev.filter(item => item.product.id !== productId))
        toast.info('Đã xóa sản phẩm khỏi Báo Giá Nhanh')
    }

    // Clear all reporting items
    const handleClearAll = () => {
        if (addedProducts.length === 0) return
        if (confirm('Bạn có chắc chắn muốn xóa sạch bảng báo giá nhanh hiện tại không?')) {
            setAddedProducts([])
            toast.info('Đã làm trống bảng báo giá')
        }
    }

    // Single simulated results for the live workbench
    const activeComputed = useMemo(() => {
        if (!activeProduct) return null
        const c = activeProduct.costPrice
        const r = activeProduct.retailPrice
        const w = activeProduct.wholesalePrice
        const s = simSellingPrice
        const d = simDiscount
        const incentive = simIncentive

        const netSellingPrice = Math.max(0, Math.round(s * (1 - d / 100) - incentive))
        const profit = netSellingPrice - c
        const marginPercent = netSellingPrice > 0 ? (profit / netSellingPrice) * 100 : -100
        const markupPercent = c > 0 ? (profit / c) * 100 : 0
        const reductionVsWholesale = w > 0 ? ((w - netSellingPrice) / w) * 100 : 0
        const reductionVsRetail = r > 0 ? ((r - netSellingPrice) / r) * 100 : 0

        return {
            netSellingPrice,
            profit,
            marginPercent,
            markupPercent,
            reductionVsWholesale,
            reductionVsRetail
        }
    }, [activeProduct, simSellingPrice, simDiscount, simIncentive])

    const handleExportCsv = () => {
        if (computedRows.length === 0) {
            toast.error('Báo giá nhanh hiện tại đang trống. Vui lòng thêm sản phẩm trước!')
            return
        }

        const headers = [
            'SKU', 'Tên sản phẩm', 'Loại', 'Quốc gia', 'Vintage',
            'Giá vốn (VND)', 'Giá bán lẻ (VND)', 'Giá sỉ tiêu chuẩn (VND)',
            'Giá bán thực tế (VND)', 'Chiết khấu (%)', 'Incentive (VND)',
            'Giá bán ròng (VND)', 'Lợi nhuận gộp (VND)', 'Biên lợi nhuận (%)', 'Tỷ lệ Markup (%)',
            'Mức giảm vs Wholesale (%)', 'Mức giảm vs Retail (%)'
        ]

        const csvRows = [
            headers.join(','),
            ...computedRows.map(r => [
                r.product.skuCode,
                `"${r.product.productName.replace(/"/g, '""')}"`,
                r.product.wineType,
                r.product.country,
                r.product.vintage ?? 'NV',
                r.product.costPrice,
                r.product.retailPrice,
                r.product.wholesalePrice,
                r.sellingPrice,
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
        a.download = `bao_gia_nhanh_khach_hang_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Đã xuất báo giá nhanh gồm ${computedRows.length} sản phẩm thành công!`)
    }

    return (
        <div className="space-y-4 max-w-screen-2xl text-slate-100">
            {/* Upper control board with actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1E2B]/50 p-4 rounded-xl border border-[#2A4355]/40 backdrop-blur-md">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Check Giá & Biên Lợi Nhuận
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded tracking-wider uppercase font-mono" style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853' }}>
                            Báo Giá Nhanh
                        </span>
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    {addedProducts.length > 0 && (
                        <button
                            onClick={handleExportCsv}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all duration-150 shadow-lg shadow-emerald-950/20"
                            style={{ background: '#87CBB9', color: '#0A1926' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}
                        >
                            <Download size={13} /> Xuất Báo Giá (CSV)
                        </button>
                    )}
                </div>
            </div>

            {/* Select & Workbench Section */}
            <div className="bg-[#0D1E2B] border border-[#2A4355]/40 rounded-xl p-4 relative overflow-hidden space-y-4">
                {/* Header Row: Calculator Icon on Left, Info Tooltip and Admin Toolbar on Right */}
                <div className="flex items-center justify-between border-b border-[#2A4355]/20 pb-2">
                    <div className="flex items-center gap-1.5 text-xs text-[#D4A853]">
                        <Calculator size={14} />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={reloadData}
                                    disabled={loading}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1B2E3D] hover:bg-[#142433] border border-[#2A4355] text-[10px] font-semibold text-[#87CBB9] transition-all disabled:opacity-50"
                                    title="Làm mới Database"
                                >
                                    <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                                    <span>Làm mới DB</span>
                                </button>
                                <button
                                    onClick={() => setImportOpen(true)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1B2E3D] hover:bg-[#142433] border border-[#2A4355] text-[10px] font-semibold text-[#D4A853] transition-all"
                                    title="Nhập bảng giá từ Excel"
                                >
                                    <Upload size={11} />
                                    <span>Nhập Excel</span>
                                </button>
                            </div>
                        )}

                        {/* Compact Info tooltip "i" icon */}
                        <div className="relative group">
                            <HelpCircle size={15} className="text-[#8AAEBB] hover:text-[#D4A853] cursor-pointer transition-all duration-150" />
                            <div className="absolute right-0 top-6 hidden group-hover:block w-72 p-3 bg-[#0D1E2B]/95 border border-[#2A4355] rounded-lg shadow-2xl text-[10px] text-slate-300 space-y-1.5 z-50 leading-relaxed backdrop-blur-md">
                                <p className="font-bold text-[#D4A853]">💡 Hướng dẫn nhanh:</p>
                                <p>• Chọn Nhà cung cấp (NCC) để rút gọn danh sách tìm kiếm (không bắt buộc).</p>
                                <p>• Nhập mã SKU hoặc Tên sản phẩm để mô phỏng.</p>
                                <p>• Hệ thống lưu trữ độc lập Giá Vốn, Lẻ và Sỉ theo bảng Excel bạn đã tải lên.</p>
                                <p>• Tất cả các số liệu đều được xử lý ở dạng Trước thuế (Pre-tax).</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selector Row (NCC Filter and Product Autocomplete side-by-side) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Supplier Filter (NCC) */}
                    <div className="md:col-span-4 space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">Nhà cung cấp (NCC)</label>
                        <select
                            value={supplierFilter}
                            onChange={e => {
                                setSupplierFilter(e.target.value)
                                // Reset active product if it doesn't belong to the new supplier
                                if (activeProduct && e.target.value && activeProduct.producerId !== e.target.value) {
                                    setActiveProduct(null)
                                    setSearchQuery('')
                                }
                            }}
                            className="w-full px-2.5 py-2 bg-[#142433] border border-[#2A4355] rounded-lg text-xs outline-none cursor-pointer text-slate-200 focus:border-[#D4A853] transition-colors"
                        >
                            <option value="">Tất cả NCC</option>
                            {uniqueSuppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search SKU Autocomplete */}
                    <div className="md:col-span-8 space-y-1 relative" ref={dropdownRef}>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">Chọn mã sản phẩm</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Gõ SKU hoặc tên sản phẩm..."
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value)
                                    setIsOpenDropdown(true)
                                }}
                                onFocus={() => setIsOpenDropdown(true)}
                                className="w-full pl-8 pr-8 py-2 bg-[#142433] border border-[#2A4355] rounded-lg text-xs text-[#E8F1F2] placeholder-[#4A6A7A] focus:outline-none focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853]/30 transition-all font-mono"
                            />
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4A6A7A]" />
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4A6A7A] pointer-events-none" />
                        </div>

                        {/* Autocomplete Dropdown List */}
                        {isOpenDropdown && (
                            <div className="absolute left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-[#0D1E2B] border border-[#2A4355] rounded-lg shadow-2xl z-50 divide-y divide-[#2A4355]/30">
                                {autocompleteSuggestions.length === 0 ? (
                                    <div className="px-3 py-4 text-center text-xs text-[#4A6A7A]">
                                        Không tìm thấy sản phẩm nào
                                    </div>
                                ) : (
                                    autocompleteSuggestions.map(p => {
                                        const flag = COUNTRY_FLAGS[p.country] ?? '🌍'
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => {
                                                    setActiveProduct(p)
                                                    setSearchQuery(p.productName)
                                                    setIsOpenDropdown(false)
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-[#1B2E3D]/50 transition-colors flex items-center gap-2 text-xs"
                                            >
                                                <div className="w-8 h-8 rounded bg-[#142433] border border-[#2A4355]/30 flex items-center justify-center flex-shrink-0">
                                                    {p.primaryImageUrl ? (
                                                        <img src={p.primaryImageUrl} alt={p.productName} className="w-full h-full object-contain p-0.5" />
                                                    ) : (
                                                        <span className="text-xs">🍷</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1 leading-tight">
                                                    <div className="font-semibold text-slate-200 truncate">{p.productName}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                                                        <span className="text-[#8AAEBB]">{p.skuCode}</span>
                                                        <span>•</span>
                                                        <span>{flag} {p.country}</span>
                                                        <span>•</span>
                                                        <WineTypeBadge type={p.wineType} />
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Rest of Workbench Details - visible only when activeProduct is chosen */}
                {activeProduct && activeComputed ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 border-t border-[#2A4355]/20 pt-4">
                        {/* Product Info Column */}
                        <div className="md:col-span-4 flex flex-col items-center justify-center p-3 rounded-lg bg-[#142433]/40 border border-[#2A4355]/30">
                            <div className="relative w-20 h-28 bg-[#142433] rounded border border-[#2A4355]/40 flex items-center justify-center p-1.5 mb-2 overflow-hidden">
                                {activeProduct.primaryImageUrl ? (
                                    <img src={activeProduct.primaryImageUrl} alt={activeProduct.productName} className="max-h-full max-w-full object-contain" />
                                ) : (
                                    <span className="text-2xl">🍷</span>
                                ) }
                            </div>
                            <div className="text-center leading-tight">
                                <h4 className="text-sm font-bold text-slate-100 line-clamp-2 px-1">{activeProduct.productName}</h4>
                                <span className="text-[10px] text-[#8AAEBB] font-mono block mt-1">{activeProduct.skuCode}</span>
                                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                                    <span className="text-xs">{COUNTRY_FLAGS[activeProduct.country] ?? '🌍'}</span>
                                    <WineTypeBadge type={activeProduct.wineType} />
                                    <span className="text-[10px] text-slate-400 font-mono">V:{activeProduct.vintage ?? 'NV'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Inputs & Outputs Column */}
                        <div className="md:col-span-8 flex flex-col justify-between space-y-4">
                            {/* Base Reference Values */}
                            <div className="grid grid-cols-3 gap-2 bg-[#1B2E3D]/30 p-2.5 rounded-lg border border-[#2A4355]/20 text-center font-sans">
                                <div>
                                    <div className="text-[9px] uppercase font-bold tracking-wide text-slate-400">Giá Vốn (C)</div>
                                    <div className="text-sm font-bold text-[#8AAEBB] mt-0.5">{formatVND(activeProduct.costPrice)}</div>
                                    <div className="text-[8px] text-[#4A6A7A] mt-0.5 italic">excl. VAT</div>
                                </div>
                                <div>
                                    <div className="text-[9px] uppercase font-bold tracking-wide text-slate-400">Giá Sỉ (W)</div>
                                    <div className="text-sm font-bold text-[#D4A853] mt-0.5">{formatVND(activeProduct.wholesalePrice)}</div>
                                    <div className="text-[8px] text-[#4A6A7A] mt-0.5 italic">excl. VAT</div>
                                </div>
                                <div>
                                    <div className="text-[9px] uppercase font-bold tracking-wide text-slate-400">Giá Lẻ (R)</div>
                                    <div className="text-sm font-bold text-slate-200 mt-0.5">{formatVND(activeProduct.retailPrice)}</div>
                                    <div className="text-[8px] text-[#4A6A7A] mt-0.5 italic">excl. VAT</div>
                                </div>
                            </div>

                            {/* User Interactive Inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-slate-300 uppercase">Giá Bán Thực Tế (S)</label>
                                    <input
                                        type="text"
                                        value={simSellingPrice === 0 ? '' : formatNumberString(simSellingPrice)}
                                        onChange={e => setSimSellingPrice(parseNumberString(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans font-bold text-emerald-300 focus:outline-none focus:border-[#87CBB9]"
                                        placeholder="Gợi ý: Nhập sỉ..."
                                    />
                                    <span className="text-[9px] text-[#4A6A7A] block italic">Mặc định bằng giá sỉ sẵn có (excl. VAT)</span>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-slate-300 uppercase">Khấu trừ sỉ (%)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.5"
                                            value={simDiscount === 0 ? '' : simDiscount}
                                            onChange={e => setSimDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                                            className="w-full pl-2.5 pr-7 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-[#E8F1F2] focus:outline-none focus:border-[#D4A853]"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">%</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-slate-300 uppercase">Incentive/chai (đ)</label>
                                    <input
                                        type="text"
                                        value={simIncentive === 0 ? '' : formatNumberString(simIncentive)}
                                        onChange={e => setSimIncentive(parseNumberString(e.target.value))}
                                        className="w-full px-2.5 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-[#E8F1F2] focus:outline-none focus:border-[#D4A853]"
                                        placeholder="0đ"
                                    />
                                </div>
                            </div>

                            {/* Dynamic calculations */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#1B2E3D]/20 p-2.5 rounded-lg border border-[#2A4355]/30">
                                <div className="text-center font-sans">
                                    <div className="text-[9px] text-[#4A6A7A] uppercase font-bold">Giá Bán Ròng (Net)</div>
                                    <div className="text-xs font-bold text-[#87CBB9] mt-0.5">{formatVND(activeComputed.netSellingPrice)}</div>
                                    <div className="text-[8px] text-[#4A6A7A] mt-0.5 italic">excl. VAT</div>
                                </div>
                                <div className="text-center font-sans">
                                    <div className="text-[9px] text-[#4A6A7A] uppercase font-bold">Lợi Nhuận Gộp</div>
                                    <div className="text-xs font-bold mt-0.5" style={{ color: activeComputed.profit >= 0 ? '#5BA88A' : '#E05252' }}>
                                        {activeComputed.profit >= 0 ? '+' : ''}{formatVND(activeComputed.profit)}
                                    </div>
                                    <div className="text-[8px] text-[#4A6A7A] mt-0.5 italic">excl. VAT</div>
                                </div>
                                <div className="text-center font-sans">
                                    <div className="text-[9px] text-[#4A6A7A] uppercase font-bold">Biên Lợi Nhuận</div>
                                    <div className="text-xs font-bold text-[#D4A853] mt-0.5">{activeComputed.marginPercent.toFixed(1)}%</div>
                                    <div className="text-[8px] text-[#4A6A7A] mt-0.5 italic">Net Margin</div>
                                </div>
                                <div className="text-center font-sans">
                                    <div className="text-[9px] text-[#4A6A7A] uppercase font-bold">Giảm so vs Sỉ</div>
                                    <div className="text-xs font-bold text-rose-400 mt-0.5">
                                        {activeComputed.reductionVsWholesale > 0 ? `-${activeComputed.reductionVsWholesale.toFixed(1)}%` : '0%'}
                                    </div>
                                    <div className="text-[8px] text-[#4A6A7A] mt-0.5 italic">vs Wholesale</div>
                                </div>
                            </div>

                            <button
                                onClick={handleAddToReport}
                                className="w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 text-xs transition-all duration-150"
                                style={{ background: '#D4A853', color: '#0A1926' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#E5B964')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#D4A853')}
                            >
                                <Plus size={14} /> THÊM VÀO BÁO GIÁ NHANH
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 py-10 border border-[#2A4355]/20 rounded-lg bg-[#142433]/10">
                        <span className="text-3xl mb-2 block">🍷</span>
                        <h4 className="text-xs font-bold text-slate-400">Sandbox Mô Phỏng Chờ Kích Hoạt</h4>
                        <p className="text-[10px] text-slate-500 max-w-sm mt-1">
                            Vui lòng chọn Nhà cung cấp và Sản phẩm phía trên để bắt đầu mô phỏng giá bán và lãi gộp cho khách hàng.
                        </p>
                    </div>
                )}
            </div>

            {/* Báo Giá Nhanh Section Title & Action Button */}
            <div className="flex items-center justify-between border-b border-[#2A4355]/40 pb-2 mt-6">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                    <span>Danh Sách Báo Giá Nhanh Tích Lũy</span>
                    <span className="text-xs px-2 py-0.5 bg-[#1B2E3D] border border-[#2A4355]/60 text-slate-300 font-mono rounded-full font-normal">
                        {addedProducts.length} sản phẩm
                    </span>
                </h3>

                {addedProducts.length > 0 && (
                    <button
                        onClick={handleClearAll}
                        className="text-xs text-[#E05252] border border-[#E05252]/20 hover:border-[#E05252]/40 rounded-lg px-2.5 py-1 hover:bg-[#E05252]/5 transition-all flex items-center gap-1"
                    >
                        <Trash2 size={12} /> Xóa sạch bảng
                    </button>
                )}
            </div>

            {/* Empty State warning */}
            {addedProducts.length === 0 ? (
                <div className="bg-[#0D1E2B] border border-[#2A4355]/40 rounded-xl p-12 text-center">
                    <span className="text-3xl mb-2 block">📋</span>
                    <p className="font-semibold text-slate-300 text-xs">Chưa có sản phẩm nào trong báo giá nhanh</p>
                    <p className="text-[10px] text-[#4A6A7A] mt-1 max-w-xs mx-auto">
                        Hãy chọn sản phẩm phía trên, nhập mức giá chiết khấu ưu đãi cho khách và click "+ Thêm vào báo giá nhanh".
                    </p>
                </div>
            ) : (
                <>


                    {/* DESKTOP VIEW: Premium Wide Grid Table */}
                    <div className="hidden md:block rounded-xl overflow-hidden border border-[#2A4355]/40 bg-[#0D1E2B]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                        <th className="px-3 py-2.5 text-[10px] uppercase font-bold tracking-wider text-[#4A6A7A] w-[220px]">Sản phẩm</th>
                                        <th className="px-2 py-2.5 text-[10px] uppercase font-bold tracking-wider text-[#4A6A7A] text-right w-[100px]">Vốn (C)</th>
                                        <th className="px-2 py-2.5 text-[10px] uppercase font-bold tracking-wider text-[#4A6A7A] text-right w-[100px]">Lẻ (R)</th>
                                        <th className="px-2 py-2.5 text-[10px] uppercase font-bold tracking-wider text-[#4A6A7A] text-right w-[100px]">Sỉ (W)</th>
                                        <th className="px-2 py-2.5 text-[10px] uppercase font-bold tracking-wider text-[#4A6A7A] text-right w-[110px] text-emerald-400">Giá bán S (đ)</th>
                                        <th className="px-2 py-2.5 text-[10px] uppercase font-bold tracking-wider text-[#4A6A7A] text-center w-[80px]">C.Khấu D(%)</th>
                                        <th className="px-2 py-2.5 text-[10px] uppercase font-bold tracking-wider text-[#4A6A7A] text-right w-[95px]">Incentive I</th>
                                        <th className="px-2 py-2.5 text-[10px] uppercase font-bold tracking-wider text-[#4A6A7A] text-right w-[110px] text-[#87CBB9]">Bán Ròng Net</th>
                                        <th className="px-2 py-2.5 text-[10px] uppercase font-bold tracking-wider text-[#4A6A7A] text-right w-[105px]">Lãi gộp</th>
                                        <th className="px-2 py-2.5 text-[10px] uppercase font-bold tracking-wider text-[#4A6A7A] text-center w-[85px]">Margin</th>
                                        <th className="px-2 py-2.5 text-[10px] uppercase font-bold tracking-wider text-[#4A6A7A] text-center w-[85px]">Markup</th>
                                        <th className="px-2 py-2.5 text-[10px] uppercase font-bold tracking-wider text-[#4A6A7A] text-center w-[85px]">% Giảm vs Sỉ</th>
                                        <th className="px-2.5 py-2.5 text-center w-[50px]"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {computedRows.map(row => (
                                        <SimulatedTableRow
                                            key={row.product.id}
                                            row={row}
                                            onUpdate={updateInlineProduct}
                                            onDelete={removeProductFromReport}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* MOBILE VIEW: Gorgeous Premium Velvet Vertical Cards Stack */}
                    <div className="block md:hidden space-y-3">
                        {computedRows.map(row => (
                            <MobileSimulatedCard
                                key={row.product.id}
                                row={row}
                                onUpdate={updateInlineProduct}
                                onDelete={removeProductFromReport}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Excel spread parser sync component */}
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

// Subcomponent: Row inside Báo Giá Nhanh Desktop Table
function SimulatedTableRow({
    row,
    onUpdate,
    onDelete
}: {
    row: ComputedRow
    onUpdate: (productId: string, field: 'sellingPrice' | 'discount' | 'incentive', value: number) => void
    onDelete: (productId: string) => void
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
            {/* Th Thumbnail & details */}
            <td className="px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="relative w-9 h-7 rounded bg-[#142433] border border-[#2A4355]/60 flex items-center justify-center flex-shrink-0">
                        {p.primaryImageUrl ? (
                            <img
                                ref={imgRef}
                                src={p.primaryImageUrl}
                                alt={p.productName}
                                className={`object-contain transition-all duration-100 ${
                                    isVertical
                                        ? 'absolute w-[18px] h-[32px] rotate-90'
                                        : 'w-full h-full p-0.5'
                                }`}
                            />
                        ) : (
                            <span className="text-[10px]" style={{ color: '#2A4355' }}>🍷</span>
                        )}
                    </div>
                    <div className="min-w-0 leading-tight">
                        <p className="text-xs font-semibold truncate text-[#E8F1F2] max-w-[140px]" title={p.productName}>
                            {p.productName}
                        </p>
                        <p className="text-[9px] mt-0.5 text-slate-400 font-mono flex items-center gap-1 flex-wrap">
                            <span className="text-[#8AAEBB]">{p.skuCode}</span>
                            <span>•</span>
                            <span>V:{p.vintage ?? 'NV'}</span>
                            <span>•</span>
                            <span>{flag}</span>
                        </p>
                    </div>
                </div>
            </td>

            {/* Giá Vốn trước thuế */}
            <td className="px-2 py-2.5 text-right font-sans text-xs text-slate-300 font-semibold whitespace-nowrap leading-tight">
                <div>{formatVND(p.costPrice)}</div>
                <div className="text-[8px] text-[#4A6A7A] font-normal italic">excl. VAT</div>
            </td>

            {/* Giá Lẻ trước thuế */}
            <td className="px-2 py-2.5 text-right font-sans text-xs text-slate-300 font-semibold whitespace-nowrap leading-tight">
                <div>{formatVND(p.retailPrice)}</div>
                <div className="text-[8px] text-[#4A6A7A] font-normal italic">excl. VAT</div>
            </td>

            {/* Giá Sỉ tiêu chuẩn */}
            <td className="px-2 py-2.5 text-right font-sans text-xs text-[#D4A853] font-semibold whitespace-nowrap leading-tight">
                <div>{formatVND(p.wholesalePrice)}</div>
                <div className="text-[8px] text-[#4A6A7A] font-normal italic">excl. VAT</div>
            </td>

            {/* Giá Bán Thực Tế (S) Input */}
            <td className="px-2 py-2.5 text-right leading-tight">
                <input
                    type="text"
                    value={row.sellingPrice === 0 ? '' : formatNumberString(row.sellingPrice)}
                    onChange={e => onUpdate(p.id, 'sellingPrice', parseNumberString(e.target.value))}
                    className="w-[95px] px-1.5 py-0.5 bg-[#142433] border border-[#2A4355] rounded text-right font-sans text-xs text-emerald-300 font-bold outline-none focus:border-[#87CBB9]"
                    placeholder="0đ"
                />
                <div className="text-[8px] text-[#4A6A7A] font-normal italic mt-0.5">excl. VAT</div>
            </td>

            {/* Chiết khấu % Input */}
            <td className="px-2 py-2.5 text-center">
                <div className="inline-flex items-center justify-center">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={row.discountPercent === 0 ? '' : row.discountPercent}
                        onChange={e => onUpdate(p.id, 'discount', Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                        className="w-[45px] px-1 py-0.5 bg-[#142433] border border-[#2A4355] rounded text-center font-sans text-xs text-[#E8F1F2] outline-none focus:border-[#87CBB9]"
                        placeholder="0"
                    />
                    <span className="text-[9px] text-[#4A6A7A] ml-0.5">%</span>
                </div>
            </td>

            {/* Incentive Input */}
            <td className="px-2 py-2.5 text-right">
                <input
                    type="text"
                    value={row.incentiveVnd === 0 ? '' : formatNumberString(row.incentiveVnd)}
                    onChange={e => onUpdate(p.id, 'incentive', parseNumberString(e.target.value))}
                    className="w-[75px] px-1 py-0.5 bg-[#142433] border border-[#2A4355] rounded text-right font-sans text-xs text-[#E8F1F2] outline-none focus:border-[#87CBB9]"
                    placeholder="0đ"
                />
            </td>

            {/* Giá Bán Ròng (Net) */}
            <td className="px-2 py-2.5 text-right font-sans text-xs text-[#87CBB9] font-bold whitespace-nowrap leading-tight">
                <div>{formatVND(row.netSellingPrice)}</div>
                <div className="text-[8px] text-[#4A6A7A] font-normal italic">excl. VAT</div>
            </td>

            {/* Lãi gộp VND */}
            <td className="px-2 py-2.5 text-right font-sans text-xs font-bold whitespace-nowrap leading-tight"
                style={{ color: row.profit >= 0 ? '#5BA88A' : '#E05252' }}>
                <div>{row.profit >= 0 ? '+' : ''}{formatVND(row.profit)}</div>
                <div className="text-[8px] text-[#4A6A7A] font-normal italic">excl. VAT</div>
            </td>

            {/* Margin (%) */}
            <td className="px-2 py-2.5 text-center whitespace-nowrap">
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
            <td className="px-2 py-2.5 text-center whitespace-nowrap font-mono text-[10px]"
                style={{ color: row.markupPercent >= 35 ? '#D4A853' : row.markupPercent >= 0 ? '#5BA88A' : '#E05252' }}>
                {row.markupPercent.toFixed(1)}%
            </td>

            {/* % Giảm vs Wholesale */}
            <td className="px-2 py-2.5 text-center whitespace-nowrap font-mono text-[10px] text-[#8AAEBB]">
                {row.reductionVsWholesale > 0 ? (
                    <span className="flex items-center justify-center gap-0.5 text-rose-400">
                        <ArrowUpRight size={10} className="rotate-90" /> {row.reductionVsWholesale.toFixed(1)}%
                    </span>
                ) : (
                    <span className="text-[#4A6A7A]">0%</span>
                )}
            </td>

            {/* Delete CTA */}
            <td className="px-2.5 py-2.5 text-center">
                <button
                    onClick={() => onDelete(p.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                >
                    <Trash2 size={13} />
                </button>
            </td>
        </tr>
    )
}

// Subcomponent: Individual card inside Báo Giá Nhanh on Mobile
function MobileSimulatedCard({
    row,
    onUpdate,
    onDelete
}: {
    row: ComputedRow
    onUpdate: (productId: string, field: 'sellingPrice' | 'discount' | 'incentive', value: number) => void
    onDelete: (productId: string) => void
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
        <div className="bg-[#0D1E2B] border border-[#2A4355]/40 rounded-xl p-3.5 space-y-3 relative">
            {/* Header info */}
            <div className="flex gap-2">
                <div className="relative w-12 h-12 rounded bg-[#142433] border border-[#2A4355]/50 flex items-center justify-center p-1 flex-shrink-0 overflow-hidden">
                    {p.primaryImageUrl ? (
                        <img
                            ref={imgRef}
                            src={p.primaryImageUrl}
                            alt={p.productName}
                            className={`object-contain transition-all duration-100 ${
                                isVertical
                                    ? 'absolute w-[20px] h-[36px] rotate-90'
                                    : 'w-full h-full'
                            }`}
                        />
                    ) : (
                        <span className="text-lg">🍷</span>
                    )}
                </div>
                <div className="min-w-0 flex-1 leading-tight pr-6">
                    <h4 className="text-xs font-bold text-slate-100 truncate">{p.productName}</h4>
                    <p className="text-[9px] text-[#8AAEBB] font-mono mt-0.5">{p.skuCode}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px]">{flag}</span>
                        <WineTypeBadge type={p.wineType} />
                        <span className="text-[9px] text-slate-400 font-mono">V:{p.vintage ?? 'NV'}</span>
                    </div>
                </div>
                
                {/* Trash Delete button */}
                <button
                    onClick={() => onDelete(p.id)}
                    className="absolute right-3 top-3 p-1.5 rounded-lg bg-[#E05252]/10 text-[#E05252] hover:bg-[#E05252]/20 transition-colors"
                >
                    <Trash2 size={13} />
                </button>
            </div>

            {/* Static Base Prices Reference Row */}
            <div className="grid grid-cols-3 gap-1 bg-[#142433]/40 p-2 rounded-lg border border-[#2A4355]/20 text-center font-sans text-[10px]">
                <div>
                    <span className="text-slate-400 block text-[8px] uppercase">Vốn (C)</span>
                    <span className="font-bold text-slate-300 block">{formatVND(p.costPrice)}</span>
                    <span className="text-[7px] text-[#4A6A7A] block italic mt-0.5">excl. VAT</span>
                </div>
                <div>
                    <span className="text-slate-400 block text-[8px] uppercase">Sỉ (W)</span>
                    <span className="font-bold text-[#D4A853] block">{formatVND(p.wholesalePrice)}</span>
                    <span className="text-[7px] text-[#4A6A7A] block italic mt-0.5">excl. VAT</span>
                </div>
                <div>
                    <span className="text-slate-400 block text-[8px] uppercase">Lẻ (R)</span>
                    <span className="font-bold text-slate-200 block">{formatVND(p.retailPrice)}</span>
                    <span className="text-[7px] text-[#4A6A7A] block italic mt-0.5">excl. VAT</span>
                </div>
            </div>

            {/* Touch Friendly Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                    <span className="block text-[9px] uppercase font-bold text-slate-400">Giá bán thực tế (S)</span>
                    <input
                        type="text"
                        value={row.sellingPrice === 0 ? '' : formatNumberString(row.sellingPrice)}
                        onChange={e => onUpdate(p.id, 'sellingPrice', parseNumberString(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans font-bold text-emerald-300 focus:outline-none focus:border-[#87CBB9]"
                        placeholder="Nhập giá sỉ..."
                    />
                    <span className="text-[7px] text-[#4A6A7A] block italic mt-0.5">excl. VAT</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <span className="block text-[9px] uppercase font-bold text-slate-400">Khấu trừ %</span>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={row.discountPercent === 0 ? '' : row.discountPercent}
                                onChange={e => onUpdate(p.id, 'discount', Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                                className="w-full pl-2 pr-6 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-[#E8F1F2] focus:outline-none focus:border-[#D4A853]"
                                placeholder="0"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#4A6A7A] font-bold">%</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="block text-[9px] uppercase font-bold text-slate-400">Incentive đ</span>
                        <input
                            type="text"
                            value={row.incentiveVnd === 0 ? '' : formatNumberString(row.incentiveVnd)}
                            onChange={e => onUpdate(p.id, 'incentive', parseNumberString(e.target.value))}
                            className="w-full px-2 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-[#E8F1F2] focus:outline-none focus:border-[#D4A853]"
                            placeholder="0đ"
                        />
                    </div>
                </div>
            </div>

            {/* Calculations and Output Badges */}
            <div className="grid grid-cols-2 gap-2 bg-[#1B2E3D]/20 p-2 rounded-lg border border-[#2A4355]/30">
                <div className="flex flex-col items-center justify-center font-sans">
                    <span className="text-[8px] text-slate-400 uppercase">Giá bán ròng (Net)</span>
                    <span className="text-xs font-bold text-[#87CBB9]">{formatVND(row.netSellingPrice)}</span>
                    <span className="text-[7px] text-[#4A6A7A] italic mt-0.5">excl. VAT</span>
                </div>
                <div className="flex flex-col items-center justify-center font-sans">
                    <span className="text-[8px] text-slate-400 uppercase">Lãi gộp</span>
                    <span className="text-xs font-bold" style={{ color: row.profit >= 0 ? '#5BA88A' : '#E05252' }}>
                        {row.profit >= 0 ? '+' : ''}{formatVND(row.profit)}
                    </span>
                    <span className="text-[7px] text-[#4A6A7A] italic mt-0.5">excl. VAT</span>
                </div>
            </div>

            <div className="flex items-center justify-between text-[10px] pt-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-[#4A6A7A]">Margin:</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-sans"
                        style={{
                            background: row.marginPercent < 15 ? 'rgba(224,82,82,0.12)' : row.marginPercent >= 35 ? 'rgba(212,168,83,0.12)' : 'rgba(91,168,138,0.12)',
                            color: row.marginPercent < 15 ? '#E05252' : row.marginPercent >= 35 ? '#D4A853' : '#5BA88A'
                        }}>
                        {row.marginPercent.toFixed(1)}%
                    </span>
                </div>
                <div className="flex items-center gap-1 text-[#8AAEBB] font-sans">
                    <span>Giảm vs Sỉ:</span>
                    <span className="font-bold text-rose-400">{row.reductionVsWholesale > 0 ? `-${row.reductionVsWholesale.toFixed(1)}%` : '0%'}</span>
                </div>
            </div>
        </div>
    )
}
