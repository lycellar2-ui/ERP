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
    buyQty: number       // buy quantity
    focQty: number       // FOC quantity
    incentivePercent: number // additional incentive percent
}

// Extracted metrics derived from inputs
type ComputedRow = {
    product: MarginProductRow
    sellingPrice: number
    discountPercent: number
    incentiveVnd: number
    incentivePercent: number
    buyQty: number
    focQty: number
    netSellingPrice: number
    profit: number
    marginPercent: number
    markupPercent: number
    reductionVsWholesale: number
    reductionVsRetail: number
}

export function MarginClient({ initialRows, suppliers, isAdmin }: { initialRows: MarginProductRow[]; suppliers: { id: string; name: string }[]; isAdmin: boolean }) {
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
    const [simBuyQty, setSimBuyQty] = useState<number>(1)
    const [simFocQty, setSimFocQty] = useState<number>(0)
    const [simIncentivePercent, setSimIncentivePercent] = useState<number>(0)

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
            setSimIncentivePercent(0)
            setSimBuyQty(1)
            setSimFocQty(0)
        }
    }, [activeProduct])

    const handleSimSellingPriceChange = (val: number) => {
        setSimSellingPrice(val)
        if (activeProduct) {
            const W = activeProduct.wholesalePrice
            const dVal = W > 0 ? parseFloat((((W - val) / W) * 100).toFixed(1)) : 0
            setSimDiscount(dVal)
            const incVal = Math.round(val * (simIncentivePercent / 100))
            setSimIncentive(incVal)
        }
    }

    const handleSimDiscountChange = (val: number) => {
        setSimDiscount(val)
        if (activeProduct) {
            const W = activeProduct.wholesalePrice
            const sVal = Math.round(W * (1 - val / 100))
            setSimSellingPrice(sVal)
            const incVal = Math.round(sVal * (simIncentivePercent / 100))
            setSimIncentive(incVal)
        }
    }

    const handleSimIncentivePercentChange = (val: number) => {
        setSimIncentivePercent(val)
        const incVal = Math.round(simSellingPrice * (val / 100))
        setSimIncentive(incVal)
    }

    const handleSimIncentiveChange = (val: number) => {
        setSimIncentive(val)
        const pVal = simSellingPrice > 0 ? parseFloat(((val / simSellingPrice) * 100).toFixed(1)) : 0
        setSimIncentivePercent(pVal)
    }

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
    const uniqueSuppliers = suppliers

    // Filter autocomplete suggestions based on search text and supplier filter (NCC)
    const autocompleteSuggestions = useMemo(() => {
        let list = dbRows
        if (supplierFilter) {
            list = list.filter(p => p.supplierId === supplierFilter)
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
            const incPercent = item.incentivePercent || 0
            const incVnd = item.incentive || 0
            const buy = item.buyQty || 1
            const foc = item.focQty || 0

            // Effective FOC dilution factor (e.g. pay 12 get 14 -> factor = 12/14)
            const focFactor = (buy > 0 && foc > 0) ? (buy / (buy + foc)) : 1

            // Formulas: pre-tax
            const baseNetSellingPrice = Math.max(0, Math.round(s * (1 - d / 100) - incVnd))
            const netSellingPrice = Math.round(baseNetSellingPrice * focFactor)

            const profit = netSellingPrice - r.costPrice
            const marginPercent = netSellingPrice > 0 ? (profit / netSellingPrice) * 100 : -100
            const markupPercent = r.costPrice > 0 ? (profit / r.costPrice) * 100 : 0
            const reductionVsWholesale = r.wholesalePrice > 0 ? ((r.wholesalePrice - netSellingPrice) / r.wholesalePrice) * 100 : 0
            const reductionVsRetail = r.retailPrice > 0 ? ((r.retailPrice - netSellingPrice) / r.retailPrice) * 100 : 0

            return {
                product: r,
                sellingPrice: s,
                discountPercent: d,
                incentiveVnd: incVnd,
                incentivePercent: incPercent,
                buyQty: buy,
                focQty: foc,
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
            incentive: simIncentive,
            buyQty: simBuyQty,
            focQty: simFocQty,
            incentivePercent: simIncentivePercent
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
    const updateInlineProduct = (
        productId: string, 
        field: 'sellingPrice' | 'discount' | 'incentive' | 'buyQty' | 'focQty' | 'incentivePercent', 
        value: number
    ) => {
        setAddedProducts(prev => prev.map(item => {
            if (item.product.id === productId) {
                const W = item.product.wholesalePrice
                
                if (field === 'sellingPrice') {
                    // Recalculate discount percent based on Selling Price S vs Wholesale price W
                    const discount = W > 0 ? parseFloat((((W - value) / W) * 100).toFixed(1)) : 0
                    // Recalculate incentive amount if % incentive is loaded
                    const incentive = Math.round(value * ((item.incentivePercent || 0) / 100))
                    return { ...item, sellingPrice: value, discount, incentive }
                }
                
                if (field === 'discount') {
                    // Recalculate Selling Price S based on discount percent D %
                    const sellingPrice = Math.round(W * (1 - value / 100))
                    // Recalculate incentive amount if % incentive is loaded
                    const incentive = Math.round(sellingPrice * ((item.incentivePercent || 0) / 100))
                    return { ...item, discount: value, sellingPrice, incentive }
                }

                if (field === 'incentivePercent') {
                    // Recalculate incentive VND amount based on % and current Selling Price S
                    const incentive = Math.round(item.sellingPrice * (value / 100))
                    return { ...item, incentivePercent: value, incentive }
                }

                if (field === 'incentive') {
                    // Recalculate incentive percent based on VND amount vs Selling Price S
                    const S = item.sellingPrice
                    const incentivePercent = S > 0 ? parseFloat(((value / S) * 100).toFixed(1)) : 0
                    return { ...item, incentive: value, incentivePercent }
                }

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
        const buy = simBuyQty
        const foc = simFocQty

        // Dilute price per bottle based on Buy/FOC ratio
        const focFactor = (buy > 0 && foc > 0) ? (buy / (buy + foc)) : 1

        const baseNetSellingPrice = Math.max(0, Math.round(s * (1 - d / 100) - incentive))
        const netSellingPrice = Math.round(baseNetSellingPrice * focFactor)

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
    }, [activeProduct, simSellingPrice, simDiscount, simIncentive, simBuyQty, simFocQty])

    const handleExportCsv = () => {
        if (computedRows.length === 0) {
            toast.error('Báo giá nhanh hiện tại đang trống. Vui lòng thêm sản phẩm trước!')
            return
        }

        const headers = [
            'SKU', 'Tên sản phẩm', 'Loại', 'Quốc gia', 'Vintage',
            'Giá vốn (VND)', 'Giá bán lẻ (VND)', 'Giá sỉ tiêu chuẩn (VND)',
            'Giá bán thực tế (VND)', 'Chiết khấu (%)', 'Buy', 'FOC', 'Incentive (%)', 'Incentive (VND)',
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
                r.buyQty,
                r.focQty,
                r.incentivePercent,
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
            {/* Select & Workbench Section */}
            <div className="bg-[#0D1E2B] border border-[#2A4355]/40 rounded-xl p-4 relative overflow-hidden space-y-4">
                {/* Selector Row (NCC Filter, Autocomplete, Admin tools, and Help tooltip inline) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Supplier Filter (NCC) */}
                    <div className="md:col-span-3 space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase">NCC</label>
                        <select
                            value={supplierFilter}
                            onChange={e => {
                                setSupplierFilter(e.target.value)
                                // Reset active product if it doesn't belong to the new supplier
                                if (activeProduct && e.target.value && activeProduct.supplierId !== e.target.value) {
                                    setActiveProduct(null)
                                    setSearchQuery('')
                                }
                            }}
                            className="w-full h-8 px-2.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs outline-none cursor-pointer text-slate-200 focus:border-[#D4A853] transition-colors"
                        >
                            <option value="">Tất cả NCC</option>
                            {uniqueSuppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search SKU Autocomplete */}
                    <div className={`${isAdmin ? 'md:col-span-5' : 'md:col-span-9'} space-y-1 relative`} ref={dropdownRef}>
                        <div className="flex items-center gap-1.5 h-4 mb-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase leading-none">Chọn mã sản phẩm</label>
                            <div className="relative group leading-none flex items-center">
                                <HelpCircle size={13} className="text-[#8AAEBB] hover:text-[#D4A853] cursor-pointer transition-colors" />
                                <div className="absolute left-0 sm:left-auto sm:right-0 top-5 hidden group-hover:block w-72 p-3 bg-[#0D1E2B]/95 border border-[#2A4355] rounded-lg shadow-2xl text-[10px] text-slate-300 space-y-1.5 z-50 leading-relaxed backdrop-blur-md font-normal normal-case">
                                    <p className="font-bold text-[#D4A853]">💡 Hướng dẫn nhanh:</p>
                                    <p>• Chọn NCC để rút gọn danh sách tìm kiếm (không bắt buộc).</p>
                                    <p>• Nhập mã SKU hoặc Tên sản phẩm để mô phỏng.</p>
                                    <p>• Hệ thống lưu trữ độc lập Giá Vốn, Lẻ và Sỉ theo bảng Excel bạn đã tải lên.</p>
                                    <p>• Tất cả các số liệu đều được xử lý ở dạng Trước thuế (Pre-tax).</p>
                                </div>
                            </div>
                        </div>
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
                                className="w-full h-8 pl-8 pr-8 bg-[#142433] border border-[#2A4355] rounded-lg text-xs text-[#E8F1F2] placeholder-[#4A6A7A] focus:outline-none focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853]/30 transition-all font-sans"
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

                    {isAdmin && (
                        <div className="md:col-span-4 grid grid-cols-2 gap-2 w-full">
                            {/* Làm mới DB */}
                            <div className="space-y-1">
                                <span className="hidden md:block text-[10px] font-bold text-transparent select-none h-4">DB Tools</span>
                                <button
                                    onClick={reloadData}
                                    disabled={loading}
                                    className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all duration-150 bg-[#1B2E3D] hover:bg-[#142433] border border-[#2A4355] text-[#87CBB9] disabled:opacity-50"
                                >
                                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                                    <span>Làm mới DB</span>
                                </button>
                            </div>

                            {/* Nhập Excel */}
                            <div className="space-y-1">
                                <span className="hidden md:block text-[10px] font-bold text-transparent select-none h-4">Excel Tools</span>
                                <button
                                    onClick={() => setImportOpen(true)}
                                    className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all duration-150 bg-[#1B2E3D] hover:bg-[#142433] border border-[#2A4355] text-[#D4A853]"
                                >
                                    <Upload size={13} />
                                    <span>Nhập Excel</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Rest of Workbench Details - visible only when activeProduct is chosen */}
                {activeProduct && activeComputed ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 border-t border-[#2A4355]/20 pt-4">
                        {/* Product Info Column */}
                        <div className="md:col-span-4 flex flex-col items-center justify-center p-3 rounded-lg bg-[#142433]/40 border border-[#2A4355]/30">
                            <div className="relative w-28 h-36 bg-[#142433] rounded border border-[#2A4355]/40 flex items-center justify-center p-1.5 mb-2 transition-all duration-200 hover:scale-[1.8] hover:z-50 hover:shadow-2xl hover:bg-[#0D1E2B] cursor-zoom-in">
                                {activeProduct.primaryImageUrl ? (
                                    <img src={activeProduct.primaryImageUrl} alt={activeProduct.productName} className="max-h-full max-w-full object-contain" />
                                ) : (
                                    <span className="text-3xl">🍷</span>
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

                            {/* User Interactive Inputs (6-columns) */}
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-bold text-emerald-400 uppercase">Giá Bán S (đ)</label>
                                    <input
                                        type="text"
                                        value={simSellingPrice === 0 ? '' : formatNumberString(simSellingPrice)}
                                        onChange={e => handleSimSellingPriceChange(parseNumberString(e.target.value))}
                                        className="w-full px-2 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans font-bold text-emerald-300 focus:outline-none focus:border-[#87CBB9]"
                                        placeholder="Giá bán"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-bold text-emerald-400 uppercase">C.Khấu D (%)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.5"
                                            value={simDiscount === 0 ? '' : simDiscount}
                                            onChange={e => handleSimDiscountChange(Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                                            className="w-full pl-2 pr-5 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-emerald-300 focus:outline-none focus:border-[#87CBB9]"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">%</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-bold text-amber-400 uppercase">Buy (Mua)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={simBuyQty === 0 ? '' : simBuyQty}
                                        onChange={e => setSimBuyQty(Math.max(1, parseInt(e.target.value || '1')))}
                                        className="w-full px-2 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-[#E8F1F2] focus:outline-none focus:border-[#D4A853]"
                                        placeholder="1"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-bold text-amber-400 uppercase">FOC (Tặng)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={simFocQty === 0 ? '' : simFocQty}
                                        onChange={e => setSimFocQty(Math.max(0, parseInt(e.target.value || '0')))}
                                        className="w-full px-2 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-[#E8F1F2] focus:outline-none focus:border-[#D4A853]"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-bold text-sky-400 uppercase">% Incentive</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={simIncentivePercent === 0 ? '' : simIncentivePercent}
                                            onChange={e => handleSimIncentivePercentChange(Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                                            className="w-full pl-2 pr-5 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-sky-300 focus:outline-none focus:border-[#8AAEBB]"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">%</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-bold text-sky-400 uppercase">Inc VNĐ</label>
                                    <input
                                        type="text"
                                        value={simIncentive === 0 ? '' : formatNumberString(simIncentive)}
                                        onChange={e => handleSimIncentiveChange(parseNumberString(e.target.value))}
                                        className="w-full px-2 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-sky-300 focus:outline-none focus:border-[#8AAEBB]"
                                        placeholder="Thưởng đ"
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
                        <h4 className="text-xs font-bold text-slate-400">Check margin</h4>
                        <p className="text-[10px] text-slate-500 max-w-sm mt-1">
                            Vui lòng chọn NCC và Sản phẩm phía trên để kiểm tra margin.
                        </p>
                    </div>
                )}
            </div>

            {/* Báo Giá Nhanh Section Title & Action Button */}
            <div className="flex items-center justify-between border-b border-[#2A4355]/40 pb-2 mt-6">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                    <span>Danh sách check margin</span>
                    <span className="text-xs px-2 py-0.5 bg-[#1B2E3D] border border-[#2A4355]/60 text-slate-300 font-mono rounded-full font-normal">
                        {addedProducts.length} sản phẩm
                    </span>
                </h3>

                {addedProducts.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportCsv}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all duration-150 shadow-lg shadow-emerald-950/20 bg-[#87CBB9] text-[#0A1926] hover:bg-[#A5DED0]"
                        >
                            <Download size={13} /> Xuất Báo Giá (CSV)
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="text-xs text-[#E05252] border border-[#E05252]/20 hover:border-[#E05252]/40 rounded-lg px-2.5 py-1 hover:bg-[#E05252]/5 transition-all flex items-center gap-1"
                        >
                            <Trash2 size={12} /> Xóa sạch bảng
                        </button>
                    </div>
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
                                    <tr style={{ background: '#102435', borderBottom: '1px solid rgba(42, 67, 85, 0.4)' }}>
                                        <th colSpan={4} className="px-3 py-1.5 text-[9px] uppercase font-extrabold tracking-wider text-slate-400 text-center border-r border-[#2A4355]/40">
                                            Thông tin tham chiếu
                                        </th>
                                        <th colSpan={6} className="px-3 py-1.5 text-[9px] uppercase font-extrabold tracking-wider text-emerald-400 bg-[#132A3E]/40 text-center border-r border-[#2A4355]/40">
                                            Nhập liệu & Tinh chỉnh
                                        </th>
                                        <th colSpan={6} className="px-3 py-1.5 text-[9px] uppercase font-extrabold tracking-wider text-[#87CBB9] text-center">
                                            Kết quả mô phỏng (Pre-tax)
                                        </th>
                                    </tr>
                                    <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                        <th className="px-3 py-2 text-[9px] uppercase font-bold tracking-wider text-[#4A6A7A] w-[240px]">Sản phẩm</th>
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-[#4A6A7A] text-right w-[100px]">Vốn (C)</th>
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-[#4A6A7A] text-right w-[100px]">Lẻ (R)</th>
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-[#4A6A7A] text-right w-[100px] border-r border-[#2A4355]/40">Sỉ (W)</th>
                                        
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-emerald-400 bg-[#132A3E]/20 text-right w-[110px]">Giá bán S (đ)</th>
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-emerald-400 bg-[#132A3E]/20 text-center w-[80px]">C.Khấu D (%)</th>
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-amber-400 bg-[#132A3E]/20 text-center w-[60px]">Buy</th>
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-amber-400 bg-[#132A3E]/20 text-center w-[60px]">FOC</th>
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-sky-400 bg-[#132A3E]/20 text-center w-[85px]">% Inc</th>
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-sky-400 bg-[#132A3E]/20 text-right w-[95px] border-r border-[#2A4355]/40">Inc VNĐ</th>
                                        
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-[#87CBB9] text-right w-[110px]">Bán Ròng Net</th>
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-[#4A6A7A] text-right w-[105px]">Lãi gộp</th>
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-[#4A6A7A] text-center w-[85px]">Margin</th>
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-[#4A6A7A] text-center w-[85px]">Markup</th>
                                        <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider text-[#4A6A7A] text-center w-[85px]">% Giảm vs Sỉ</th>
                                        <th className="px-2.5 py-2 text-center w-[40px]"></th>
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
    onUpdate: (
        productId: string, 
        field: 'sellingPrice' | 'discount' | 'incentive' | 'buyQty' | 'focQty' | 'incentivePercent', 
        value: number
    ) => void
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
            {/* Thumbnail & details */}
            <td className="px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="relative w-16 h-12 rounded bg-[#142433] border border-[#2A4355]/60 flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:scale-[3.5] hover:z-50 hover:shadow-2xl hover:bg-[#0D1E2B] cursor-zoom-in">
                        {p.primaryImageUrl ? (
                            <img
                                ref={imgRef}
                                src={p.primaryImageUrl}
                                alt={p.productName}
                                className={`object-contain transition-all duration-100 ${
                                    isVertical
                                        ? 'absolute w-[24px] h-[44px] rotate-90'
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

            {/* Giá Sỉ tiêu chuẩn (Vùng chia 1) */}
            <td className="px-2 py-2.5 text-right font-sans text-xs text-[#D4A853] font-semibold whitespace-nowrap leading-tight border-r border-[#2A4355]/40">
                <div>{formatVND(p.wholesalePrice)}</div>
                <div className="text-[8px] text-[#4A6A7A] font-normal italic">excl. VAT</div>
            </td>

            {/* Giá Bán Thực Tế (S) Input */}
            <td className="px-2 py-2.5 text-right leading-tight bg-[#132A3E]/10">
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
            <td className="px-2 py-2.5 text-center bg-[#132A3E]/10">
                <div className="inline-flex items-center justify-center">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={row.discountPercent === 0 ? '' : row.discountPercent}
                        onChange={e => onUpdate(p.id, 'discount', Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                        className="w-[45px] px-1 py-0.5 bg-[#142433] border border-[#2A4355] rounded text-center font-sans text-xs text-emerald-300 outline-none focus:border-[#87CBB9]"
                        placeholder="0"
                    />
                    <span className="text-[9px] text-[#4A6A7A] ml-0.5">%</span>
                </div>
            </td>

            {/* Buy Input */}
            <td className="px-2 py-2.5 text-center bg-[#132A3E]/10">
                <input
                    type="number"
                    min="1"
                    value={row.buyQty === 0 ? '' : row.buyQty}
                    onChange={e => onUpdate(p.id, 'buyQty', Math.max(1, parseInt(e.target.value || '1')))}
                    className="w-[45px] px-1 py-0.5 bg-[#142433] border border-[#2A4355] rounded text-center font-sans text-xs text-[#E8F1F2] outline-none focus:border-[#D4A853]"
                    placeholder="1"
                />
            </td>

            {/* FOC Input */}
            <td className="px-2 py-2.5 text-center bg-[#132A3E]/10">
                <input
                    type="number"
                    min="0"
                    value={row.focQty === 0 ? '' : row.focQty}
                    onChange={e => onUpdate(p.id, 'focQty', Math.max(0, parseInt(e.target.value || '0')))}
                    className="w-[45px] px-1 py-0.5 bg-[#142433] border border-[#2A4355] rounded text-center font-sans text-xs text-[#E8F1F2] outline-none focus:border-[#D4A853]"
                    placeholder="0"
                />
            </td>

            {/* % Incentive Input */}
            <td className="px-2 py-2.5 text-center bg-[#132A3E]/10">
                <div className="inline-flex items-center justify-center">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={row.incentivePercent === 0 ? '' : row.incentivePercent}
                        onChange={e => onUpdate(p.id, 'incentivePercent', Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                        className="w-[50px] px-1 py-0.5 bg-[#142433] border border-[#2A4355] rounded text-center font-sans text-xs text-sky-300 outline-none focus:border-[#8AAEBB]"
                        placeholder="0"
                    />
                    <span className="text-[9px] text-[#4A6A7A] ml-0.5">%</span>
                </div>
            </td>

            {/* Incentive VNĐ Input (Vùng chia 2) */}
            <td className="px-2 py-2.5 text-right bg-[#132A3E]/10 border-r border-[#2A4355]/40">
                <input
                    type="text"
                    value={row.incentiveVnd === 0 ? '' : formatNumberString(row.incentiveVnd)}
                    onChange={e => onUpdate(p.id, 'incentive', parseNumberString(e.target.value))}
                    className="w-[75px] px-1 py-0.5 bg-[#142433] border border-[#2A4355] rounded text-right font-sans text-xs text-sky-300 outline-none focus:border-[#8AAEBB]"
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
    onUpdate: (
        productId: string, 
        field: 'sellingPrice' | 'discount' | 'incentive' | 'buyQty' | 'focQty' | 'incentivePercent', 
        value: number
    ) => void
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
                <div className="relative w-16 h-16 rounded bg-[#142433] border border-[#2A4355]/50 flex items-center justify-center p-1 flex-shrink-0 transition-all duration-200 hover:scale-[2.5] hover:z-50 hover:shadow-2xl hover:bg-[#0D1E2B] cursor-zoom-in">
                    {p.primaryImageUrl ? (
                        <img
                            ref={imgRef}
                            src={p.primaryImageUrl}
                            alt={p.productName}
                            className={`object-contain transition-all duration-100 ${
                                isVertical
                                    ? 'absolute w-[24px] h-[44px] rotate-90'
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
            <div className="space-y-2.5">
                {/* Row 1: Price and Discount (bound) */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <span className="block text-[9px] uppercase font-bold text-emerald-400">Giá bán S (đ)</span>
                        <input
                            type="text"
                            value={row.sellingPrice === 0 ? '' : formatNumberString(row.sellingPrice)}
                            onChange={e => onUpdate(p.id, 'sellingPrice', parseNumberString(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans font-bold text-emerald-300 focus:outline-none focus:border-[#87CBB9]"
                            placeholder="Nhập giá sỉ..."
                        />
                        <span className="text-[7px] text-[#4A6A7A] block italic mt-0.5">excl. VAT</span>
                    </div>
                    <div className="space-y-1">
                        <span className="block text-[9px] uppercase font-bold text-emerald-400">Khấu trừ %</span>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={row.discountPercent === 0 ? '' : row.discountPercent}
                                onChange={e => onUpdate(p.id, 'discount', Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                                className="w-full pl-2 pr-6 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-emerald-300 focus:outline-none focus:border-[#87CBB9]"
                                placeholder="0"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#4A6A7A] font-bold">%</span>
                        </div>
                    </div>
                </div>

                {/* Row 2: Buy & FOC */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <span className="block text-[9px] uppercase font-bold text-amber-400">Mua (Buy Qty)</span>
                        <input
                            type="number"
                            min="1"
                            value={row.buyQty === 0 ? '' : row.buyQty}
                            onChange={e => onUpdate(p.id, 'buyQty', Math.max(1, parseInt(e.target.value || '1')))}
                            className="w-full px-2 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-[#E8F1F2] focus:outline-none focus:border-[#D4A853]"
                            placeholder="1"
                        />
                    </div>
                    <div className="space-y-1">
                        <span className="block text-[9px] uppercase font-bold text-amber-400">Tặng (FOC Qty)</span>
                        <input
                            type="number"
                            min="0"
                            value={row.focQty === 0 ? '' : row.focQty}
                            onChange={e => onUpdate(p.id, 'focQty', Math.max(0, parseInt(e.target.value || '0')))}
                            className="w-full px-2 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-[#E8F1F2] focus:outline-none focus:border-[#D4A853]"
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Row 3: Incentive % and amount */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <span className="block text-[9px] uppercase font-bold text-sky-400">% Incentive</span>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={row.incentivePercent === 0 ? '' : row.incentivePercent}
                                onChange={e => onUpdate(p.id, 'incentivePercent', Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                                className="w-full pl-2 pr-6 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-sky-300 focus:outline-none focus:border-[#8AAEBB]"
                                placeholder="0"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#4A6A7A] font-bold">%</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="block text-[9px] uppercase font-bold text-sky-400">Incentive đ</span>
                        <input
                            type="text"
                            value={row.incentiveVnd === 0 ? '' : formatNumberString(row.incentiveVnd)}
                            onChange={e => onUpdate(p.id, 'incentive', parseNumberString(e.target.value))}
                            className="w-full px-2 py-1.5 bg-[#142433] border border-[#2A4355] rounded-lg text-xs font-sans text-sky-300 focus:outline-none focus:border-[#8AAEBB]"
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
