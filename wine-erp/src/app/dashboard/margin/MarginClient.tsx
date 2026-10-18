'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, Download, Upload, RefreshCw, Trash2, ArrowUpRight, Plus, HelpCircle, ChevronDown, LayoutList, Wine, Lightbulb, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { ExcelImportDialog } from '@/components/ExcelImportDialog'
import { MarginProductRow, getMarginProducts, bulkImportMarginPrices } from './actions'
import { WineTypeBadge } from '@/components/WineTypeBadge'
import { useConfirmDialog } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { getMarginI18n, MarginI18n } from './i18n'

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
    const { locale, formatCurrency, formatNumber } = useAppLocale()
    const i18n = getMarginI18n(locale)

    const { confirm, dialog: confirmDialog } = useConfirmDialog()
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

    // Accumulated Products List
    const [addedProducts, setAddedProducts] = useState<AddedProduct[]>([])
    const [isCompactView, setIsCompactView] = useState(false)

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
            toast.success(i18n.dialogs.toastRefreshed)
        } catch {
            toast.error(i18n.dialogs.toastRefreshError)
        } finally {
            setLoading(false)
        }
    }

    // Dynamic list of unique suppliers (NCC)
    const uniqueSuppliers = suppliers

    // Filter autocomplete suggestions based on search text and supplier filter
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

            const focFactor = (buy > 0 && foc > 0) ? (buy / (buy + foc)) : 1

            // Formulas: pre-tax
            const baseNetSellingPrice = Math.max(0, Math.round(s - incVnd))
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
                toast.success(i18n.dialogs.toastUpdatedItem(activeProduct.productName))
                return next
            } else {
                toast.success(i18n.dialogs.toastAddedItem(activeProduct.productName))
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
                    const discount = W > 0 ? parseFloat((((W - value) / W) * 100).toFixed(1)) : 0
                    const incentive = Math.round(value * ((item.incentivePercent || 0) / 100))
                    return { ...item, sellingPrice: value, discount, incentive }
                }

                if (field === 'discount') {
                    const sellingPrice = Math.round(W * (1 - value / 100))
                    const incentive = Math.round(sellingPrice * ((item.incentivePercent || 0) / 100))
                    return { ...item, discount: value, sellingPrice, incentive }
                }

                if (field === 'incentivePercent') {
                    const incentive = Math.round(item.sellingPrice * (value / 100))
                    return { ...item, incentivePercent: value, incentive }
                }

                if (field === 'incentive') {
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
        toast.info(i18n.dialogs.toastRemovedItem)
    }

    // Clear all reporting items
    const handleClearAll = async () => {
        if (addedProducts.length === 0) return
        const ok = await confirm({
            title: i18n.dialogs.clearTitle,
            message: i18n.dialogs.clearMsg,
            confirmLabel: i18n.dialogs.clearConfirm,
            variant: 'danger',
        })
        if (!ok) return
        setAddedProducts([])
        toast.info(i18n.dialogs.toastCleared)
    }

    // Single simulated results for the live workbench
    const activeComputed = useMemo(() => {
        if (!activeProduct) return null
        const c = activeProduct.costPrice
        const r = activeProduct.retailPrice
        const w = activeProduct.wholesalePrice
        const s = simSellingPrice
        const incentive = simIncentive
        const buy = simBuyQty
        const foc = simFocQty

        const focFactor = (buy > 0 && foc > 0) ? (buy / (buy + foc)) : 1

        const baseNetSellingPrice = Math.max(0, Math.round(s - incentive))
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
    }, [activeProduct, simSellingPrice, simIncentive, simBuyQty, simFocQty])

    const handleExportCsv = () => {
        if (computedRows.length === 0) {
            toast.error(i18n.dialogs.toastEmptyExport)
            return
        }

        const headers = i18n.csv.headers

        const csvRows = [
            headers.join(','),
            ...computedRows.map(r => [
                r.product.skuCode,
                `"${r.product.productName.replace(/"/g, '""')}"`,
                r.product.wineType,
                r.product.country,
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
                r.reductionVsWholesale.toFixed(1),
                r.reductionVsRetail.toFixed(1)
            ].join(','))
        ]

        const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${i18n.csv.filePrefix}_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(i18n.dialogs.toastExportSuccess(computedRows.length))
    }

    return (
        <div className="space-y-4 max-w-screen-2xl text-slate-900">
            {/* Select & Workbench Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 relative overflow-hidden space-y-4">
                {/* Selector Row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Supplier Filter */}
                    <div className="md:col-span-3 space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">{i18n.selector.supplierLabel}</label>
                        <select
                            value={supplierFilter}
                            onChange={e => {
                                setSupplierFilter(e.target.value)
                                if (activeProduct && e.target.value && activeProduct.supplierId !== e.target.value) {
                                    setActiveProduct(null)
                                    setSearchQuery('')
                                }
                            }}
                            className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs outline-none cursor-pointer text-slate-900 focus:border-[#B45309] transition-colors"
                        >
                            <option value="">{i18n.selector.allSuppliers}</option>
                            {uniqueSuppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search SKU Autocomplete */}
                    <div className={`${isAdmin ? 'md:col-span-5' : 'md:col-span-9'} space-y-1 relative`} ref={dropdownRef}>
                        <div className="flex items-center gap-1.5 h-4 mb-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">{i18n.selector.selectSkuLabel}</label>
                            <div className="relative group leading-none flex items-center">
                                <HelpCircle size={13} className="text-slate-600 hover:text-[#B45309] cursor-pointer transition-colors" />
                                <div className="absolute left-0 sm:left-auto sm:right-0 top-5 hidden group-hover:block w-64 sm:w-72 max-w-[calc(100vw-2rem)] p-3 bg-white border border-slate-200 rounded-lg shadow-xl text-[10px] text-slate-700 space-y-1.5 z-50 leading-relaxed font-normal normal-case">
                                    <p className="font-bold text-[#B45309] flex items-center gap-1">
                                        <Lightbulb size={12} /> {i18n.selector.quickGuideTitle}
                                    </p>
                                    <p>{i18n.selector.quickGuide1}</p>
                                    <p>{i18n.selector.quickGuide2}</p>
                                    <p>{i18n.selector.quickGuide3}</p>
                                    <p>{i18n.selector.quickGuide4}</p>
                                </div>
                            </div>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={i18n.selector.searchPlaceholder}
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value)
                                    setIsOpenDropdown(true)
                                }}
                                onFocus={() => setIsOpenDropdown(true)}
                                className="w-full h-8 pl-8 pr-8 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#B45309] focus:ring-1 focus:ring-[#B45309]/30 transition-all font-sans"
                            />
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>

                        {/* Autocomplete Dropdown List */}
                        {isOpenDropdown && (
                            <div className="absolute left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-2xl z-50 divide-y divide-slate-100">
                                {autocompleteSuggestions.length === 0 ? (
                                    <div className="px-3 py-4 text-center text-xs text-slate-500">
                                        {i18n.selector.noProductsFound}
                                    </div>
                                ) : (
                                    autocompleteSuggestions.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => {
                                                setActiveProduct(p)
                                                setSearchQuery(p.productName)
                                                setIsOpenDropdown(false)
                                            }}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2 text-xs"
                                        >
                                            <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                                                {p.primaryImageUrl ? (
                                                    <img src={p.primaryImageUrl} alt={p.productName} className="w-full h-full object-contain p-0.5" />
                                                ) : (
                                                    <Wine size={14} className="text-slate-400" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1 leading-tight">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="font-semibold text-slate-900 truncate">{p.productName}</div>
                                                    {p.hasCustomPrice ? (
                                                        <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 flex-shrink-0 whitespace-nowrap">
                                                            {i18n.selector.importedBadge}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 flex-shrink-0 whitespace-nowrap">
                                                            {i18n.selector.notImportedBadge}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-sans mt-0.5 flex items-center gap-1.5">
                                                    <span className="text-slate-600 font-medium">{p.skuCode}</span>
                                                    <span>•</span>
                                                    <span className="font-semibold text-slate-700">{i18n.countries[p.country] ?? p.country}</span>
                                                    <span>•</span>
                                                    <WineTypeBadge type={p.wineType} />
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {isAdmin && (
                        <div className="md:col-span-4 grid grid-cols-2 gap-2 w-full">
                            {/* Refresh DB */}
                            <div className="space-y-1">
                                <span className="hidden md:block text-[10px] font-bold text-transparent select-none h-4">DB</span>
                                <button
                                    onClick={reloadData}
                                    disabled={loading}
                                    className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all duration-150 bg-white hover:bg-slate-50 border border-slate-200 text-[#0891B2] disabled:opacity-50"
                                >
                                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                                    <span>{i18n.selector.refreshDb}</span>
                                </button>
                            </div>

                            {/* Import Excel */}
                            <div className="space-y-1">
                                <span className="hidden md:block text-[10px] font-bold text-transparent select-none h-4">Excel</span>
                                <button
                                    onClick={() => setImportOpen(true)}
                                    className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all duration-150 bg-white hover:bg-slate-50 border border-slate-200 text-[#B45309]"
                                >
                                    <Upload size={13} />
                                    <span>{i18n.selector.importExcel}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Workbench Details - visible when activeProduct is chosen */}
                {activeProduct && activeComputed ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 border-t border-slate-200 pt-4">
                        {/* Product Info Column */}
                        <div className="md:col-span-4 flex flex-col items-center justify-center p-3 rounded-lg bg-white border border-slate-200">
                            <div className="relative w-28 h-36 bg-white rounded border border-slate-200 flex items-center justify-center p-1.5 mb-2 transition-all duration-200 hover:scale-[1.8] hover:z-50 hover:shadow-2xl hover:bg-slate-50 cursor-zoom-in">
                                {activeProduct.primaryImageUrl ? (
                                    <img src={activeProduct.primaryImageUrl} alt={activeProduct.productName} className="max-h-full max-w-full object-contain" />
                                ) : (
                                    <Wine className="w-10 h-10 text-slate-300" />
                                )}
                            </div>
                            <div className="text-center leading-tight">
                                <h4 className="text-sm font-bold text-slate-900 line-clamp-2 px-1">{activeProduct.productName}</h4>
                                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                                    <span className="text-[10px] text-slate-600 font-sans font-medium">{activeProduct.skuCode}</span>
                                    {activeProduct.hasCustomPrice ? (
                                        <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold text-emerald-700 bg-emerald-50 uppercase tracking-wide border border-emerald-200 whitespace-nowrap shrink-0">
                                            {i18n.selector.hasImportedPrice}
                                        </span>
                                    ) : (
                                        <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold text-amber-700 bg-amber-50 uppercase tracking-wide border border-amber-200 whitespace-nowrap shrink-0">
                                            {i18n.selector.assumedPrice}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                                    <span className="text-xs text-slate-500 font-medium">{i18n.countries[activeProduct.country] ?? activeProduct.country}</span>
                                    <WineTypeBadge type={activeProduct.wineType} />
                                </div>
                            </div>
                        </div>

                        {/* Inputs & Outputs Column */}
                        <div className="md:col-span-8 flex flex-col justify-between space-y-4">
                            {/* Base Reference Values */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 bg-white p-3.5 rounded-lg border border-slate-200 text-center font-sans">
                                <div>
                                    <div className="text-xs uppercase font-extrabold tracking-wider text-slate-500">{i18n.workbench.cost}</div>
                                    <div className="text-lg sm:text-xl font-black text-[#0891B2] mt-1">{formatNumber(activeProduct.costPrice)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase font-extrabold tracking-wider text-slate-500">{i18n.workbench.wholesale}</div>
                                    <div className="text-lg sm:text-xl font-black text-[#B45309] mt-1">{formatNumber(activeProduct.wholesalePrice)}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase font-extrabold tracking-wider text-slate-500">{i18n.workbench.retail}</div>
                                    <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">{formatNumber(activeProduct.retailPrice)}</div>
                                </div>
                            </div>

                            {/* User Interactive Inputs (6-columns) */}
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">{i18n.workbench.specialPrice}</label>
                                    <input
                                        type="text"
                                        value={simSellingPrice === 0 ? '' : formatNumberString(simSellingPrice)}
                                        onChange={e => handleSimSellingPriceChange(parseNumberString(e.target.value))}
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-base font-sans font-bold text-emerald-700 focus:outline-none focus:border-[#0E7490]"
                                        placeholder={i18n.workbench.specialPrice}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">{i18n.workbench.discountPct}</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.5"
                                            value={simDiscount === 0 ? '' : simDiscount}
                                            onChange={e => handleSimDiscountChange(Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                                            className="w-full pl-3 pr-6 py-2.5 bg-white border border-slate-200 rounded-lg text-base font-sans font-bold text-emerald-700 focus:outline-none focus:border-[#0E7490]"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-extrabold text-amber-700 uppercase tracking-wider">{i18n.workbench.buy}</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={simBuyQty === 0 ? '' : simBuyQty}
                                        onChange={e => setSimBuyQty(Math.max(1, parseInt(e.target.value || '1')))}
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-base font-sans font-bold text-slate-900 focus:outline-none focus:border-[#B45309]"
                                        placeholder="1"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-extrabold text-amber-700 uppercase tracking-wider">{i18n.workbench.foc}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={simFocQty === 0 ? '' : simFocQty}
                                        onChange={e => setSimFocQty(Math.max(0, parseInt(e.target.value || '0')))}
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-base font-sans font-bold text-slate-900 focus:outline-none focus:border-[#B45309]"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-extrabold text-sky-700 uppercase tracking-wider">{i18n.workbench.incentivePct}</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={simIncentivePercent === 0 ? '' : simIncentivePercent}
                                            onChange={e => handleSimIncentivePercentChange(Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                                            className="w-full pl-3 pr-6 py-2.5 bg-white border border-slate-200 rounded-lg text-base font-sans font-bold text-sky-700 focus:outline-none focus:border-[#0E7490]"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[11px] font-extrabold text-sky-700 uppercase tracking-wider">{i18n.workbench.incentiveValue}</label>
                                    <input
                                        type="text"
                                        value={simIncentive === 0 ? '' : formatNumberString(simIncentive)}
                                        onChange={e => handleSimIncentiveChange(parseNumberString(e.target.value))}
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-base font-sans font-bold text-sky-700 focus:outline-none focus:border-[#0E7490]"
                                        placeholder={i18n.workbench.placeholderValue}
                                    />
                                </div>
                            </div>

                            {/* Dynamic calculations */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-lg border border-slate-200">
                                <div className="text-center font-sans">
                                    <div className="text-xs text-slate-500 uppercase font-extrabold tracking-wider">{i18n.workbench.specialPrice}</div>
                                    <div className="text-lg sm:text-xl font-black text-[#0891B2] mt-1">{formatCurrency(activeComputed.netSellingPrice)}</div>
                                </div>
                                <div className="text-center font-sans">
                                    <div className="text-xs text-slate-500 uppercase font-extrabold tracking-wider">{i18n.workbench.grossMargin}</div>
                                    <div className="text-lg sm:text-xl font-black mt-1" style={{ color: activeComputed.profit >= 0 ? '#15803D' : '#B91C1C' }}>
                                        {activeComputed.profit >= 0 ? '+' : ''}{formatCurrency(activeComputed.profit)}
                                    </div>
                                </div>
                                <div className="text-center font-sans">
                                    <div className="text-xs text-slate-500 uppercase font-extrabold tracking-wider">{i18n.workbench.grossMarginPct}</div>
                                    <div className="text-lg sm:text-xl font-black text-[#B45309] mt-1">{activeComputed.marginPercent.toFixed(1)}%</div>
                                </div>
                                <div className="text-center font-sans">
                                    <div className="text-xs text-slate-500 uppercase font-extrabold tracking-wider">{i18n.workbench.vsWholesale}</div>
                                    <div className="text-lg sm:text-xl font-black text-rose-700 mt-1">
                                        {activeComputed.reductionVsWholesale > 0 ? `-${activeComputed.reductionVsWholesale.toFixed(1)}%` : '0%'}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleAddToReport}
                                className="w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 text-xs transition-all duration-150 bg-[#D97706] hover:bg-[#B45309] text-white"
                            >
                                <Plus size={14} /> {i18n.workbench.addToCheckTable}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 py-10 border border-slate-200 rounded-lg bg-white">
                        <Wine className="w-10 h-10 text-slate-300 mb-2" />
                        <h4 className="text-xs font-bold text-slate-600">{i18n.workbench.emptyWorkbenchTitle}</h4>
                        <p className="text-[11px] text-slate-500 max-w-sm mt-1">
                            {i18n.workbench.emptyWorkbenchDesc}
                        </p>
                    </div>
                )}
            </div>

            {/* Section Title & Action Buttons */}
            <div className="border-b border-slate-200 pb-2 mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                        {i18n.report.sectionTitle}
                    </h3>
                    <span className="inline-block text-xs px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-md font-normal font-sans whitespace-nowrap shrink-0">
                        {addedProducts.length} {i18n.report.productsCountUnit}
                    </span>
                </div>

                {addedProducts.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setIsCompactView(prev => !prev)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 border ${
                                isCompactView
                                    ? 'bg-[#B45309] text-white border-[#B45309] hover:bg-[#92400E]'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                            <LayoutList size={13} />
                            <span>{isCompactView ? i18n.report.viewFull : i18n.report.viewCompact}</span>
                        </button>
                        <button
                            onClick={handleExportCsv}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 bg-[#0E7490] text-white hover:bg-[#155E75]"
                        >
                            <Download size={13} /> {i18n.report.exportCsv}
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="text-xs text-[#B91C1C] border border-[#B91C1C]/20 hover:border-[#B91C1C]/40 rounded-lg px-2.5 py-1.5 hover:bg-[#B91C1C]/5 transition-all flex items-center gap-1"
                        >
                            <Trash2 size={12} /> {i18n.report.clearAll}
                        </button>
                    </div>
                )}
            </div>

            {/* Empty State warning */}
            {addedProducts.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-12 text-center">
                    <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700 text-xs">{i18n.report.emptyTitle}</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                        {i18n.report.emptyDesc}
                    </p>
                </div>
            ) : isCompactView ? (
                <>
                    {/* DESKTOP VIEW: Simplified Compact Table */}
                    <div className="hidden md:block rounded-lg overflow-hidden border border-slate-200 bg-white">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-3 py-2.5 text-xs uppercase font-bold tracking-wider text-slate-600 w-[140px]">{i18n.report.colSku}</th>
                                        <th className="px-3 py-2.5 text-xs uppercase font-bold tracking-wider text-slate-600">{i18n.report.colProductName}</th>
                                        <th className="px-3 py-2.5 text-xs uppercase font-bold tracking-wider text-slate-600 text-right w-[120px]">{i18n.report.colWholesale}</th>
                                        <th className="px-3 py-2.5 text-xs uppercase font-bold tracking-wider text-slate-600 text-right w-[120px]">{i18n.report.colSpecialPrice}</th>
                                        <th className="px-3 py-2.5 text-xs uppercase font-bold tracking-wider text-slate-600 text-center w-[100px]">{i18n.report.colMargin}</th>
                                        <th className="px-3 py-2.5 text-xs uppercase font-bold tracking-wider text-slate-600 text-center w-[140px]">{i18n.report.colVsWholesale}</th>
                                        <th className="px-3 py-2.5 w-[50px]"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {computedRows.map(row => {
                                        const p = row.product
                                        return (
                                            <tr key={p.id} className="group border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-2.5 text-xs text-slate-600 font-sans font-medium whitespace-nowrap">{p.skuCode}</td>
                                                <td className="px-3 py-2.5 text-xs text-slate-900 font-medium leading-snug">{p.productName}</td>
                                                <td className="px-3 py-2.5 text-xs text-right font-sans text-[#B45309] font-semibold whitespace-nowrap">{formatNumber(p.wholesalePrice)}</td>
                                                <td className="px-3 py-2.5 text-xs text-right font-sans text-[#0891B2] font-bold whitespace-nowrap">{formatCurrency(row.netSellingPrice)}</td>
                                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                    {row.marginPercent === -100 ? (
                                                        <span className="text-xs text-slate-500 font-sans">N/A</span>
                                                    ) : (
                                                        <span className="inline-block px-1.5 py-0.5 rounded text-xs font-bold font-sans whitespace-nowrap shrink-0"
                                                            style={{
                                                                background: row.marginPercent < 15 ? 'rgba(185,28,28,0.12)' : row.marginPercent >= 35 ? 'rgba(180,83,9,0.12)' : 'rgba(21,128,61,0.12)',
                                                                color: row.marginPercent < 15 ? '#B91C1C' : row.marginPercent >= 35 ? '#B45309' : '#15803D'
                                                            }}>
                                                            {row.marginPercent.toFixed(1)}%
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-center whitespace-nowrap font-sans text-xs text-slate-600">
                                                    {row.reductionVsWholesale > 0 ? (
                                                        <span className="flex items-center justify-center gap-0.5 text-rose-700">
                                                            <ArrowUpRight size={10} className="rotate-90" /> {row.reductionVsWholesale.toFixed(1)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-500">0%</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <button
                                                        onClick={() => removeProductFromReport(p.id)}
                                                        className="p-1 text-slate-500 hover:text-red-700 transition-colors"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* MOBILE VIEW: Simplified Compact Cards */}
                    <div className="block md:hidden space-y-3">
                        {computedRows.map(row => {
                            const p = row.product
                            return (
                                <div key={p.id} className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2 relative">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-xs font-bold text-slate-900 leading-snug">{p.productName}</h4>
                                            <p className="text-[10px] text-slate-600 font-sans font-medium mt-0.5">{p.skuCode}</p>
                                        </div>
                                        <button
                                            onClick={() => removeProductFromReport(p.id)}
                                            className="p-1.5 rounded-lg bg-[#B91C1C]/10 text-[#B91C1C] hover:bg-[#B91C1C]/20 transition-colors flex-shrink-0"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100 text-[11px]">
                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">{i18n.workbench.wholesale}:</span>
                                                <span className="font-semibold text-[#B45309]">{formatNumber(p.wholesalePrice)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">{i18n.workbench.specialPrice}:</span>
                                                <span className="font-bold text-[#0891B2]">{formatCurrency(row.netSellingPrice)}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1 pl-2 border-l border-slate-100">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">{i18n.report.colMargin}:</span>
                                                <span className="font-bold px-1 rounded" style={{
                                                    background: row.marginPercent < 15 ? 'rgba(185,28,28,0.12)' : row.marginPercent >= 35 ? 'rgba(180,83,9,0.12)' : 'rgba(21,128,61,0.12)',
                                                    color: row.marginPercent < 15 ? '#B91C1C' : row.marginPercent >= 35 ? '#B45309' : '#15803D'
                                                }}>{row.marginPercent.toFixed(1)}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">{i18n.workbench.vsWholesale}:</span>
                                                <span className="font-semibold text-rose-700">-{row.reductionVsWholesale.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            ) : (
                <>
                    {/* DESKTOP VIEW: Wide Grid Table */}
                    <div className="hidden md:block rounded-lg overflow-hidden border border-slate-200 bg-white">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 border-b border-slate-200">
                                        <th colSpan={4} className="px-3 py-1.5 text-xs uppercase font-extrabold tracking-wider text-slate-600 text-center border-r border-slate-200">
                                            {i18n.report.headerRefInfo}
                                        </th>
                                        <th colSpan={6} className="px-3 py-1.5 text-xs uppercase font-extrabold tracking-wider text-emerald-800 bg-emerald-50/70 text-center border-r border-slate-200">
                                            {i18n.report.headerInputAdjust}
                                        </th>
                                        <th colSpan={5} className="px-3 py-1.5 text-xs uppercase font-extrabold tracking-wider text-[#0891B2] bg-cyan-50/50 text-center">
                                            {i18n.report.headerSimResult}
                                        </th>
                                    </tr>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-3 py-2 text-xs uppercase font-bold tracking-wider text-slate-600 w-[280px] min-w-[280px]">{i18n.report.colProduct}</th>
                                        <th className="px-1.5 py-2 text-xs uppercase font-bold tracking-wider text-slate-600 text-right w-[85px]">{i18n.workbench.cost}</th>
                                        <th className="px-1.5 py-2 text-xs uppercase font-bold tracking-wider text-slate-600 text-right w-[85px]">{i18n.workbench.retail}</th>
                                        <th className="px-1.5 py-2 text-xs uppercase font-bold tracking-wider text-slate-600 text-right w-[85px] border-r border-slate-200">{i18n.workbench.wholesale}</th>

                                        <th className="px-1.5 py-2 text-xs uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50/40 text-center w-[100px]">{i18n.workbench.specialPrice}</th>
                                        <th className="px-1 py-2 text-xs uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50/40 text-center w-[65px]">{i18n.report.colDiscountD}</th>
                                        <th className="px-1 py-2 text-xs uppercase font-bold tracking-wider text-amber-700 bg-emerald-50/40 text-center w-[42px]">{i18n.workbench.buy}</th>
                                        <th className="px-1 py-2 text-xs uppercase font-bold tracking-wider text-amber-700 bg-emerald-50/40 text-center w-[42px]">{i18n.workbench.foc}</th>
                                        <th className="px-1 py-2 text-xs uppercase font-bold tracking-wider text-sky-700 bg-emerald-50/40 text-center w-[65px]">{i18n.report.colIncPct}</th>
                                        <th className="px-1 py-2 text-xs uppercase font-bold tracking-wider text-sky-700 bg-emerald-50/40 text-right w-[80px] border-r border-slate-200">{i18n.report.colIncVnd}</th>

                                        <th className="px-1.5 py-2 text-xs uppercase font-bold tracking-wider text-[#0891B2] text-right w-[95px]">{i18n.workbench.specialPrice}</th>
                                        <th className="px-1.5 py-2 text-xs uppercase font-bold tracking-wider text-slate-600 text-right w-[95px]">{i18n.report.colGrossProfit}</th>
                                        <th className="px-1 py-2 text-xs uppercase font-bold tracking-wider text-slate-600 text-center w-[70px]">{i18n.report.colMargin}</th>
                                        <th className="px-1 py-2 text-xs uppercase font-bold tracking-wider text-slate-600 text-center w-[70px]">{i18n.report.colRedVsWholesale}</th>
                                        <th className="px-2.5 py-2 text-center w-[40px]"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {computedRows.map(row => (
                                        <SimulatedTableRow
                                            key={row.product.id}
                                            row={row}
                                            i18n={i18n}
                                            formatCurrency={formatCurrency}
                                            formatNumber={formatNumber}
                                            onUpdate={updateInlineProduct}
                                            onDelete={removeProductFromReport}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* MOBILE VIEW: Vertical Cards Stack */}
                    <div className="block md:hidden space-y-3">
                        {computedRows.map(row => (
                            <MobileSimulatedCard
                                key={row.product.id}
                                row={row}
                                i18n={i18n}
                                formatCurrency={formatCurrency}
                                formatNumber={formatNumber}
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
                title={i18n.excelImport.modalTitle}
                templateFileName="template_bang_gia_mo_phong.xlsx"
                templateColumns={[
                    { header: 'SKU', sample: 'MOUTON-2018-750', required: true },
                    { header: 'Cost', sample: '850000', required: true },
                    { header: 'Retail Price', sample: '1500000', required: true },
                    { header: 'Wholesale Price', sample: '1200000', required: true }
                ]}
                onImport={bulkImportMarginPrices}
                onComplete={() => {
                    setImportOpen(false)
                    reloadData()
                }}
            />
            {confirmDialog}
        </div>
    )
}

// Subcomponent: Row inside Desktop Table
function SimulatedTableRow({
    row,
    i18n,
    formatCurrency,
    formatNumber,
    onUpdate,
    onDelete
}: {
    row: ComputedRow
    i18n: MarginI18n
    formatCurrency: (val: number) => string
    formatNumber: (val: number) => string
    onUpdate: (
        productId: string,
        field: 'sellingPrice' | 'discount' | 'incentive' | 'buyQty' | 'focQty' | 'incentivePercent',
        value: number
    ) => void
    onDelete: (productId: string) => void
}) {
    const p = row.product
    const countryLabel = i18n.countries[p.country] ?? p.country

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
        <tr className="group border-b border-slate-200 hover:bg-slate-50 transition-colors">
            {/* Thumbnail & details */}
            <td className="px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="relative w-16 h-12 rounded bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:scale-[3.5] hover:z-50 hover:shadow-2xl hover:bg-slate-50 cursor-zoom-in">
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
                            <Wine className="w-4 h-4 text-slate-300" />
                        )}
                    </div>
                    <div className="min-w-0 leading-tight">
                        <div className="flex items-start gap-1.5">
                            <p className="text-xs font-semibold text-slate-900 leading-snug" style={{ wordBreak: 'break-word' }}>
                                {p.productName}
                            </p>
                            {p.hasCustomPrice ? (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1" title={i18n.selector.hasImportedPrice} />
                            ) : (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0 mt-1" title={i18n.selector.assumedPrice} />
                            )}
                        </div>
                        <p className="text-[10px] mt-0.5 text-slate-400 font-sans flex items-center gap-1 flex-wrap">
                            <span className="text-slate-600 font-bold">{p.skuCode}</span>
                            <span>•</span>
                            <span>{countryLabel}</span>
                        </p>
                    </div>
                </div>
            </td>

            {/* Cost */}
            <td className="px-1.5 py-2.5 text-right font-sans text-[11px] text-slate-700 font-semibold whitespace-nowrap leading-tight">
                <div>{formatNumber(p.costPrice)}</div>
            </td>

            {/* Retail */}
            <td className="px-1.5 py-2.5 text-right font-sans text-[11px] text-slate-700 font-semibold whitespace-nowrap leading-tight">
                <div>{formatNumber(p.retailPrice)}</div>
            </td>

            {/* Wholesale */}
            <td className="px-1.5 py-2.5 text-right font-sans text-[11px] text-[#B45309] font-semibold whitespace-nowrap leading-tight border-r border-slate-200">
                <div>{formatNumber(p.wholesalePrice)}</div>
            </td>

            {/* Special Price Input */}
            <td className="px-1.5 py-2.5 text-right leading-tight bg-emerald-50/20">
                <input
                    type="text"
                    value={row.sellingPrice === 0 ? '' : formatNumberString(row.sellingPrice)}
                    onChange={e => onUpdate(p.id, 'sellingPrice', parseNumberString(e.target.value))}
                    className="w-[85px] px-1 py-0.5 bg-white border border-slate-200 rounded text-right font-sans text-[11px] text-emerald-700 font-bold outline-none focus:border-[#0E7490]"
                    placeholder="0"
                />
            </td>

            {/* Discount % Input */}
            <td className="px-1 py-2.5 text-center bg-emerald-50/20">
                <div className="inline-flex items-center justify-center">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={row.discountPercent === 0 ? '' : row.discountPercent}
                        onChange={e => onUpdate(p.id, 'discount', Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                        className="w-[40px] px-0.5 py-0.5 bg-white border border-slate-200 rounded text-center font-sans text-[11px] text-emerald-700 font-bold outline-none focus:border-[#0E7490]"
                        placeholder="0"
                    />
                    <span className="text-xs text-slate-500 ml-0.5">%</span>
                </div>
            </td>

            {/* Buy Input */}
            <td className="px-1 py-2.5 text-center bg-emerald-50/20">
                <input
                    type="number"
                    min="1"
                    value={row.buyQty === 0 ? '' : row.buyQty}
                    onChange={e => onUpdate(p.id, 'buyQty', Math.max(1, parseInt(e.target.value || '1')))}
                    className="w-[36px] px-0.5 py-0.5 bg-white border border-slate-200 rounded text-center font-sans text-[11px] text-slate-900 outline-none focus:border-[#B45309]"
                    placeholder="1"
                />
            </td>

            {/* FOC Input */}
            <td className="px-1 py-2.5 text-center bg-emerald-50/20">
                <input
                    type="number"
                    min="0"
                    value={row.focQty === 0 ? '' : row.focQty}
                    onChange={e => onUpdate(p.id, 'focQty', Math.max(0, parseInt(e.target.value || '0')))}
                    className="w-[36px] px-0.5 py-0.5 bg-white border border-slate-200 rounded text-center font-sans text-[11px] text-slate-900 outline-none focus:border-[#B45309]"
                    placeholder="0"
                />
            </td>

            {/* % Incentive Input */}
            <td className="px-1 py-2.5 text-center bg-emerald-50/20">
                <div className="inline-flex items-center justify-center">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={row.incentivePercent === 0 ? '' : row.incentivePercent}
                        onChange={e => onUpdate(p.id, 'incentivePercent', Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                        className="w-[40px] px-0.5 py-0.5 bg-white border border-slate-200 rounded text-center font-sans text-[11px] text-sky-700 font-bold outline-none focus:border-[#475569]"
                        placeholder="0"
                    />
                    <span className="text-xs text-slate-500 ml-0.5">%</span>
                </div>
            </td>

            {/* Incentive VND Input */}
            <td className="px-1 py-2.5 text-right bg-emerald-50/20 border-r border-slate-200">
                <input
                    type="text"
                    value={row.incentiveVnd === 0 ? '' : formatNumberString(row.incentiveVnd)}
                    onChange={e => onUpdate(p.id, 'incentive', parseNumberString(e.target.value))}
                    className="w-[70px] px-1 py-0.5 bg-white border border-slate-200 rounded text-right font-sans text-[11px] text-sky-700 font-bold outline-none focus:border-[#475569]"
                    placeholder="0"
                />
            </td>

            {/* Net Selling Price */}
            <td className="px-1.5 py-2.5 text-right font-sans text-[11px] text-[#0891B2] font-bold whitespace-nowrap leading-tight">
                <div>{formatCurrency(row.netSellingPrice)}</div>
            </td>

            {/* Gross Profit */}
            <td className="px-1.5 py-2.5 text-right font-sans text-[11px] font-bold whitespace-nowrap leading-tight"
                style={{ color: row.profit >= 0 ? '#15803D' : '#B91C1C' }}>
                <div>{row.profit >= 0 ? '+' : ''}{formatCurrency(row.profit)}</div>
            </td>

            {/* Margin (%) */}
            <td className="px-1 py-2.5 text-center whitespace-nowrap">
                {row.marginPercent === -100 ? (
                    <span className="text-[11px] text-slate-500 font-sans">N/A</span>
                ) : (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold font-sans whitespace-nowrap shrink-0"
                        style={{
                            background: row.marginPercent < 15 ? 'rgba(185,28,28,0.12)' : row.marginPercent >= 35 ? 'rgba(180,83,9,0.12)' : 'rgba(21,128,61,0.12)',
                            color: row.marginPercent < 15 ? '#B91C1C' : row.marginPercent >= 35 ? '#B45309' : '#15803D'
                        }}>
                        {row.marginPercent.toFixed(1)}%
                    </span>
                )}
            </td>

            {/* % Off Wholesale */}
            <td className="px-1 py-2.5 text-center whitespace-nowrap font-sans text-[11px] text-slate-600">
                {row.reductionVsWholesale > 0 ? (
                    <span className="flex items-center justify-center gap-0.5 text-rose-700">
                        <ArrowUpRight size={10} className="rotate-90" /> {row.reductionVsWholesale.toFixed(1)}%
                    </span>
                ) : (
                    <span className="text-slate-500">0%</span>
                )}
            </td>

            {/* Delete CTA */}
            <td className="px-2.5 py-2.5 text-center">
                <button
                    onClick={() => onDelete(p.id)}
                    className="p-1 text-slate-500 hover:text-red-700 transition-colors"
                >
                    <Trash2 size={13} />
                </button>
            </td>
        </tr>
    )
}

// Subcomponent: Individual card on Mobile (<768px)
function MobileSimulatedCard({
    row,
    i18n,
    formatCurrency,
    formatNumber,
    onUpdate,
    onDelete
}: {
    row: ComputedRow
    i18n: MarginI18n
    formatCurrency: (val: number) => string
    formatNumber: (val: number) => string
    onUpdate: (
        productId: string,
        field: 'sellingPrice' | 'discount' | 'incentive' | 'buyQty' | 'focQty' | 'incentivePercent',
        value: number
    ) => void
    onDelete: (productId: string) => void
}) {
    const p = row.product
    const countryLabel = i18n.countries[p.country] ?? p.country

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
        <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 relative shadow-2xs">
            {/* Header info */}
            <div className="flex gap-2">
                <div className="relative w-14 h-14 rounded bg-white border border-slate-200 flex items-center justify-center p-1 flex-shrink-0">
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
                        <Wine className="w-6 h-6 text-slate-300" />
                    )}
                </div>
                <div className="min-w-0 flex-1 leading-tight pr-6">
                    <div className="flex items-start gap-1.5">
                        <h4 className="text-xs font-bold text-slate-900 leading-snug" style={{ wordBreak: 'break-word' }}>{p.productName}</h4>
                        {p.hasCustomPrice ? (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
                        ) : (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0 mt-1" />
                        )}
                    </div>
                    <p className="text-[11px] text-slate-600 font-sans font-bold mt-0.5">{p.skuCode}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-medium">{countryLabel}</span>
                        <WineTypeBadge type={p.wineType} />
                    </div>
                </div>

                {/* Trash Delete button */}
                <button
                    onClick={() => onDelete(p.id)}
                    className="absolute right-3 top-3 p-1.5 rounded-lg bg-[#B91C1C]/10 text-[#B91C1C] hover:bg-[#B91C1C]/20 transition-colors"
                >
                    <Trash2 size={13} />
                </button>
            </div>

            {/* Static Base Prices Reference Row */}
            <div className="grid grid-cols-3 gap-1 bg-slate-50 p-2 rounded-lg border border-slate-200 text-center font-sans text-[10px]">
                <div>
                    <span className="text-slate-500 block text-xs uppercase">{i18n.workbench.cost}</span>
                    <span className="font-bold text-slate-700 block">{formatNumber(p.costPrice)}</span>
                </div>
                <div>
                    <span className="text-slate-500 block text-xs uppercase">{i18n.workbench.wholesale}</span>
                    <span className="font-bold text-[#B45309] block">{formatNumber(p.wholesalePrice)}</span>
                </div>
                <div>
                    <span className="text-slate-500 block text-xs uppercase">{i18n.workbench.retail}</span>
                    <span className="font-bold text-slate-900 block">{formatNumber(p.retailPrice)}</span>
                </div>
            </div>

            {/* Compact Inline Inputs */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {/* Pair 1 Left: Special Price */}
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs uppercase font-bold text-emerald-700 w-[58px] flex-shrink-0 leading-[1.1] text-left">{i18n.workbench.specialPrice}</span>
                    <input
                        type="text"
                        value={row.sellingPrice === 0 ? '' : formatNumberString(row.sellingPrice)}
                        onChange={e => onUpdate(p.id, 'sellingPrice', parseNumberString(e.target.value))}
                        className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-sans font-bold text-emerald-700 focus:outline-none focus:border-[#0E7490]"
                        placeholder="0"
                    />
                </div>

                {/* Pair 1 Right: Discount */}
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs uppercase font-bold text-emerald-700 w-[58px] flex-shrink-0 leading-[1.1] text-left">{i18n.report.mobileDiscount}</span>
                    <div className="relative flex-1 min-w-0">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={row.discountPercent === 0 ? '' : row.discountPercent}
                            onChange={e => onUpdate(p.id, 'discount', Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                            className="w-full pl-1.5 pr-4 py-1 bg-white border border-slate-200 rounded text-[11px] font-sans text-emerald-700 font-bold focus:outline-none focus:border-[#0E7490]"
                            placeholder="0"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">%</span>
                    </div>
                </div>

                {/* Pair 2 Left: BUY */}
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs uppercase font-bold text-amber-700 w-[58px] flex-shrink-0 leading-[1.1] text-left">{i18n.workbench.buy}</span>
                    <input
                        type="number"
                        min="1"
                        value={row.buyQty === 0 ? '' : row.buyQty}
                        onChange={e => onUpdate(p.id, 'buyQty', Math.max(1, parseInt(e.target.value || '1')))}
                        className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-sans text-slate-900 focus:outline-none focus:border-[#B45309]"
                        placeholder="1"
                    />
                </div>

                {/* Pair 2 Right: FOC */}
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs uppercase font-bold text-amber-700 w-[58px] flex-shrink-0 leading-[1.1] text-left">{i18n.workbench.foc}</span>
                    <input
                        type="number"
                        min="0"
                        value={row.focQty === 0 ? '' : row.focQty}
                        onChange={e => onUpdate(p.id, 'focQty', Math.max(0, parseInt(e.target.value || '0')))}
                        className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-sans text-slate-900 focus:outline-none focus:border-[#B45309]"
                        placeholder="0"
                    />
                </div>

                {/* Pair 3 Left: INC % */}
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs uppercase font-bold text-sky-700 w-[58px] flex-shrink-0 leading-[1.1] text-left">{i18n.report.mobileIncPct}</span>
                    <div className="relative flex-1 min-w-0">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={row.incentivePercent === 0 ? '' : row.incentivePercent}
                            onChange={e => onUpdate(p.id, 'incentivePercent', Math.max(0, Math.min(100, parseFloat(e.target.value || '0'))))}
                            className="w-full pl-1.5 pr-4 py-1 bg-white border border-slate-200 rounded text-[11px] font-sans text-sky-700 font-bold focus:outline-none focus:border-[#475569]"
                            placeholder="0"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">%</span>
                    </div>
                </div>

                {/* Pair 3 Right: INC VND */}
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs uppercase font-bold text-sky-700 w-[58px] flex-shrink-0 leading-[1.1] text-left">{i18n.report.mobileIncVnd}</span>
                    <input
                        type="text"
                        value={row.incentiveVnd === 0 ? '' : formatNumberString(row.incentiveVnd)}
                        onChange={e => onUpdate(p.id, 'incentive', parseNumberString(e.target.value))}
                        className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-sans text-sky-700 font-bold focus:outline-none focus:border-[#475569]"
                        placeholder="0"
                    />
                </div>
            </div>

            {/* Results: All 4 metrics in one unified grid */}
            <div className="grid grid-cols-4 gap-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <div className="flex flex-col items-center justify-center font-sans">
                    <span className="text-[9px] text-slate-500 uppercase">{i18n.workbench.specialPrice}</span>
                    <span className="text-[11px] font-bold text-[#0891B2]">{formatCurrency(row.netSellingPrice)}</span>
                </div>
                <div className="flex flex-col items-center justify-center font-sans">
                    <span className="text-[9px] text-slate-500 uppercase">{i18n.workbench.grossMargin}</span>
                    <span className="text-[11px] font-bold" style={{ color: row.profit >= 0 ? '#15803D' : '#B91C1C' }}>
                        {row.profit >= 0 ? '+' : ''}{formatCurrency(row.profit)}
                    </span>
                </div>
                <div className="flex flex-col items-center justify-center font-sans">
                    <span className="text-[9px] text-slate-500 uppercase">{i18n.report.mobileMarginPct}</span>
                    <span className="inline-block text-[11px] font-bold font-sans px-1 py-0.5 rounded whitespace-nowrap shrink-0"
                        style={{
                            background: row.marginPercent < 15 ? 'rgba(185,28,28,0.12)' : row.marginPercent >= 35 ? 'rgba(180,83,9,0.12)' : 'rgba(21,128,61,0.12)',
                            color: row.marginPercent < 15 ? '#B91C1C' : row.marginPercent >= 35 ? '#B45309' : '#15803D'
                        }}>
                        {row.marginPercent.toFixed(1)}%
                    </span>
                </div>
                <div className="flex flex-col items-center justify-center font-sans">
                    <span className="text-[9px] text-slate-500 uppercase">{i18n.workbench.vsWholesale}</span>
                    <span className="text-[11px] font-bold text-rose-700">
                        {row.reductionVsWholesale > 0 ? `-${row.reductionVsWholesale.toFixed(1)}%` : '0%'}
                    </span>
                </div>
            </div>
        </div>
    )
}
