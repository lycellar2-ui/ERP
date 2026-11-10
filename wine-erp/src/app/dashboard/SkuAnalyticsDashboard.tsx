'use client'

import React, { useState, useEffect, useTransition, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
    Search, Wine, Users, Package, DollarSign, ArrowUpRight,
    Building2, Clock, Layers,
    TrendingUp, FileText, Filter, Warehouse, ExternalLink
} from 'lucide-react'
import { formatVND, formatDate } from '@/lib/utils'
import { useAppLocale } from '@/lib/i18n'
import {
    searchProductsForDashboard,
    getProductAnalyticsForDashboard,
    type DashboardProductSearchItem,
    type SkuAnalyticsResult,
    type SkuReplenishmentAlertItem,
} from './actions'

interface SkuAnalyticsDashboardProps {
    topProducts: Array<{
        id?: string
        sku: string
        name: string
        qty: number
        revenue: number
        marginPct: number | null
    }>
    initialProductId?: string
    initialSearchResults?: DashboardProductSearchItem[]
    initialData?: SkuAnalyticsResult | null
    replenishmentAlerts?: SkuReplenishmentAlertItem[]
}

type TimeRangeKey = 'ALL' | 'THIS_YEAR' | 'LAST_6_MONTHS' | 'THIS_MONTH'
type BuyerStatusFilter = 'ALL' | 'ACTIVE' | 'AT_RISK' | 'PRICE_RULE' | 'HISTORICAL_ONLY'
type OrderSourceFilter = 'ALL' | 'ERP_SO' | 'HISTORICAL_INVOICE' | 'TASTING'
type ImportSourceFilter = 'EXTERNAL' | 'INTERNAL' | 'ALL'
type ReplenishmentTierFilter = 'ALL' | 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'PLAN_REORDER'

const WINE_TYPE_BADGE: Record<string, { vi: string; en: string; bg: string; color: string; border: string }> = {
    RED: { vi: 'Vang Đỏ', en: 'Red Wine', bg: 'rgba(153, 27, 27, 0.08)', color: '#991B1B', border: 'rgba(153, 27, 27, 0.25)' },
    WHITE: { vi: 'Vang Trắng', en: 'White Wine', bg: 'rgba(180, 83, 9, 0.08)', color: '#B45309', border: 'rgba(180, 83, 9, 0.25)' },
    SPARKLING: { vi: 'Vang Nổ / Champagne', en: 'Sparkling', bg: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: 'rgba(8, 145, 178, 0.25)' },
    ROSE: { vi: 'Vang Hồng', en: 'Rosé Wine', bg: 'rgba(190, 24, 93, 0.08)', color: '#BE185D', border: 'rgba(190, 24, 93, 0.25)' },
    FORTIFIED: { vi: 'Vang Cường Hóa', en: 'Fortified', bg: 'rgba(109, 40, 217, 0.08)', color: '#475569', border: 'rgba(71, 85, 105, 0.25)' },
    DESSERT: { vi: 'Vang Ngọt', en: 'Dessert', bg: 'rgba(217, 119, 6, 0.08)', color: '#D97706', border: 'rgba(217, 119, 6, 0.25)' },
}

const CHANNEL_BADGE: Record<string, { label: string; labelEn: string; bg: string; color: string; border: string }> = {
    HORECA: { label: 'HORECA', labelEn: 'HORECA', bg: '#ECFEFF', color: '#0E7490', border: '#A5F3FC' },
    CORPORATE: { label: 'Doanh Nghiệp', labelEn: 'Corporate B2B', bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
    WHOLESALE_DISTRIBUTOR: { label: 'Đại Lý / Sỉ', labelEn: 'Wholesale', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
    VIP_RETAIL: { label: 'VIP Retail', labelEn: 'VIP Retail', bg: '#F8FAFC', color: '#0F172A', border: '#CBD5E1' },
    RETAIL: { label: 'Khách Lẻ', labelEn: 'Retail', bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' },
    DIRECT_INDIVIDUAL: { label: 'Khách Cá Nhân', labelEn: 'Individual', bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' },
}

export function SkuAnalyticsDashboard({
    topProducts,
    initialProductId,
    initialSearchResults,
    initialData,
    replenishmentAlerts = [],
}: SkuAnalyticsDashboardProps) {
    const { isEn } = useAppLocale()

    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<DashboardProductSearchItem[]>(initialSearchResults ?? [])
    const [selectedProductId, setSelectedProductId] = useState<string>(
        initialProductId || initialData?.product.id || topProducts.find(p => p.id)?.id || initialSearchResults?.[0]?.id || ''
    )
    const [timeRange, setTimeRange] = useState<TimeRangeKey>('ALL')
    const [data, setData] = useState<SkuAnalyticsResult | null>(initialData ?? null)
    const [isPending, startTransition] = useTransition()
    const [isSearching, setIsSearching] = useState(false)
    const [showReplenishmentList, setShowReplenishmentList] = useState<boolean>(false)
    const [replenishmentFilter, setReplenishmentFilter] = useState<ReplenishmentTierFilter>('ALL')

    // Client-side instant cache for SKU 360 results (key: `${productId}:${timeRange}`)
    const clientCacheRef = useRef<Map<string, SkuAnalyticsResult>>(
        new Map(
            initialData
                ? [[`${initialData.product.id}:ALL`, initialData]]
                : []
        )
    )
    const isFirstSearchMount = useRef(Boolean(initialSearchResults && initialSearchResults.length > 0))
    const isFirstDataMount = useRef(Boolean(initialData))

    // Sub-tabs & local table filters
    const [activeSubTab, setActiveSubTab] = useState<'buyers' | 'orders' | 'imports' | 'monthly'>('buyers')
    const [buyerStatusFilter, setBuyerStatusFilter] = useState<BuyerStatusFilter>('ALL')
    const [buyerChannelFilter, setBuyerChannelFilter] = useState<string>('ALL')
    const [buyerTextFilter, setBuyerTextFilter] = useState<string>('')
    const [orderSourceFilter, setOrderSourceFilter] = useState<OrderSourceFilter>('ALL')
    const [importSourceFilter, setImportSourceFilter] = useState<ImportSourceFilter>('EXTERNAL')
    const [mosCycle, setMosCycle] = useState<3 | 6 | 12>(6)

    // Sync initialProductId if URL param changes
    useEffect(() => {
        if (initialProductId && initialProductId !== selectedProductId) {
            setSelectedProductId(initialProductId)
        }
    }, [initialProductId])

    // Search products with debounce (skip initial fetch if SSR already provided initialSearchResults)
    useEffect(() => {
        if (isFirstSearchMount.current && searchQuery === '') {
            isFirstSearchMount.current = false
            return
        }
        let active = true
        setIsSearching(true)
        const timer = setTimeout(async () => {
            try {
                const res = await searchProductsForDashboard(searchQuery)
                if (active) {
                    setSearchResults(res)
                    if (!selectedProductId && res.length > 0) {
                        setSelectedProductId(res[0].id)
                    }
                }
            } finally {
                if (active) setIsSearching(false)
            }
        }, 160)
        return () => {
            active = false
            clearTimeout(timer)
        }
    }, [searchQuery])

    // Load SKU 360 analytics with instant client-cache hit + non-blocking transition
    useEffect(() => {
        if (!selectedProductId) return
        const cacheKey = `${selectedProductId}:${timeRange}`
        if (isFirstDataMount.current && initialData && initialData.product.id === selectedProductId && timeRange === 'ALL') {
            isFirstDataMount.current = false
            return
        }
        isFirstDataMount.current = false

        const cachedItem = clientCacheRef.current.get(cacheKey)
        if (cachedItem) {
            setData(cachedItem)
            return
        }

        let cancelled = false
        startTransition(async () => {
            const res = await getProductAnalyticsForDashboard(selectedProductId, timeRange)
            if (!cancelled && res) {
                clientCacheRef.current.set(cacheKey, res)
                setData(res)
            }
        })
        return () => {
            cancelled = true
        }
    }, [selectedProductId, timeRange])

    // Hover prefetch so clicking any SKU pill feels instantaneous
    const prefetchSku = useCallback((productId: string) => {
        const cacheKey = `${productId}:${timeRange}`
        if (clientCacheRef.current.has(cacheKey)) return
        getProductAnalyticsForDashboard(productId, timeRange)
            .then(res => {
                if (res) clientCacheRef.current.set(cacheKey, res)
            })
            .catch(() => {})
    }, [timeRange])

    const filteredBuyers = useMemo(() => {
        if (!data) return []
        return data.customers.filter(c => {
            if (buyerStatusFilter === 'ACTIVE' && c.buyerStatus !== 'ACTIVE') return false
            if (buyerStatusFilter === 'AT_RISK' && c.buyerStatus !== 'AT_RISK') return false
            if (buyerStatusFilter === 'PRICE_RULE' && c.specialPrice === null) return false
            if (buyerStatusFilter === 'HISTORICAL_ONLY' && c.buyerStatus !== 'HISTORICAL_ONLY') return false
            if (buyerChannelFilter !== 'ALL' && c.channel !== buyerChannelFilter) return false
            if (buyerTextFilter.trim()) {
                const q = buyerTextFilter.trim().toLowerCase()
                const matchName = c.customerName.toLowerCase().includes(q)
                const matchCode = c.customerCode.toLowerCase().includes(q)
                const matchParent = (c.parentName || '').toLowerCase().includes(q)
                const matchRep = (c.salesRepName || '').toLowerCase().includes(q)
                if (!matchName && !matchCode && !matchParent && !matchRep) return false
            }
            return true
        })
    }, [data, buyerStatusFilter, buyerChannelFilter, buyerTextFilter])

    const filteredOrders = useMemo(() => {
        if (!data) return []
        return data.orders.filter(o => {
            if (orderSourceFilter === 'ERP_SO' && (o.recordSource !== 'ERP_SO' || o.orderType === 'TASTING' || o.orderType === 'SAMPLE')) return false
            if (orderSourceFilter === 'HISTORICAL_INVOICE' && o.recordSource !== 'HISTORICAL_INVOICE') return false
            if (orderSourceFilter === 'TASTING' && o.orderType !== 'TASTING' && o.orderType !== 'SAMPLE') return false
            return true
        })
    }, [data, orderSourceFilter])

    const filteredImports = useMemo(() => {
        if (!data) return []
        return data.imports.filter(imp => {
            if (importSourceFilter === 'EXTERNAL' && imp.importType === 'INTERNAL_TRANSFER') return false
            if (importSourceFilter === 'INTERNAL' && imp.importType !== 'INTERNAL_TRANSFER') return false
            return true
        })
    }, [data, importSourceFilter])

    const maxMonthlyBottles = useMemo(() => {
        if (!data || data.monthlyTrend.length === 0) return 1
        return Math.max(...data.monthlyTrend.map(m => m.commercialBottles + m.tastingBottles), 1)
    }, [data])

    const filteredReplenishmentAlerts = useMemo(() => {
        if (replenishmentFilter === 'ALL') return replenishmentAlerts
        return replenishmentAlerts.filter(a => a.urgencyTier === replenishmentFilter)
    }, [replenishmentAlerts, replenishmentFilter])

    return (
        <div className="space-y-4">
            {/* ═══ 1. SEARCH & SKU SELECTOR BAR ═══ */}
            <div className="bg-white rounded-md border border-slate-200 p-4 shadow-2xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Wine size={16} className="text-cyan-600" />
                            <span>
                                {isEn
                                    ? 'SKU 360° Distribution & Restaurant Buyer Intelligence'
                                    : 'Báo Cáo Phân Tích Theo SKU (SKU 360°)'}
                            </span>
                        </h3>
                        {replenishmentAlerts.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowReplenishmentList(prev => !prev)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                                    showReplenishmentList
                                        ? 'bg-red-600 border-red-600 text-white'
                                        : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${showReplenishmentList ? 'bg-white' : 'bg-red-600'}`} />
                                <span>
                                    {isEn
                                        ? `Stock Alert: ${replenishmentAlerts.length} SKUs to Reorder`
                                        : `Cảnh báo tồn kho: ${replenishmentAlerts.length} SKU cần mua thêm`}
                                </span>
                            </button>
                        )}
                    </div>

                    {/* Time Range Filter */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md self-start">
                        {([
                            { key: 'ALL', vi: 'Toàn thời gian (2021–2026)', en: 'All Time (2021–2026)' },
                            { key: 'THIS_YEAR', vi: 'Năm 2026', en: 'Year 2026' },
                            { key: 'LAST_6_MONTHS', vi: '6 tháng qua', en: 'Last 6M' },
                            { key: 'THIS_MONTH', vi: 'Tháng này', en: 'This Month' },
                        ] as const).map(t => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTimeRange(t.key)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                                    timeRange === t.key
                                        ? 'bg-slate-900 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {isEn ? t.en : t.vi}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Search Input */}
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={
                            isEn
                                ? 'Search by SKU code (e.g. L20034, L10023), wine name, country, or producer...'
                                : 'Nhập mã SKU (VD: L20034, L10023, L40004...), tên rượu, quốc gia hoặc nhà sản xuất để tra cứu...'
                        }
                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-cyan-600 text-slate-900"
                    />
                    {isSearching && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                            {isEn ? 'Searching...' : 'Đang tìm...'}
                        </span>
                    )}
                </div>

                {/* Quick Pick SKU Pills */}
                <div className="mt-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
                        {searchResults.map(item => {
                            const isSelected = item.id === selectedProductId
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onMouseEnter={() => prefetchSku(item.id)}
                                    onClick={() => setSelectedProductId(item.id)}
                                    className={`shrink-0 text-left px-3 py-1.5 rounded-md border transition-all cursor-pointer flex items-center gap-2 ${
                                        isSelected
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                                            : 'bg-slate-50/80 border-slate-200 text-slate-800 hover:bg-slate-100 hover:border-slate-300'
                                    }`}
                                >
                                    <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                        isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
                                    }`}>
                                        {item.skuCode}
                                    </span>
                                    <span className="text-xs font-semibold truncate max-w-[190px]">
                                        {item.productName}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* ═══ 1B. BẢNG CẢNH BÁO TỒN KHO & DANH SÁCH SKU CẦN MUA (SẮP XẾP TỪ TRÊN XUỐNG DƯỚI) ═══ */}
            {showReplenishmentList && replenishmentAlerts.length > 0 && (
                <div className="bg-white rounded-md border border-slate-200 p-4 shadow-2xs space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                {isEn
                                    ? 'SKU Replenishment Priority Queue (Sorted by Urgency)'
                                    : 'Danh Sách Cảnh Báo Tồn Kho & Đề Xuất Mua Hàng (Sắp Xếp Từ Trên Xuống Dưới Theo Độ Khẩn Cấp)'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                {filteredReplenishmentAlerts.length} SKU
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {([
                                { key: 'ALL' as const, vi: `Tất cả cần mua (${replenishmentAlerts.length})`, en: `All (${replenishmentAlerts.length})` },
                                { key: 'OUT_OF_STOCK' as const, vi: `Đứt hàng (${replenishmentAlerts.filter(a => a.urgencyTier === 'OUT_OF_STOCK').length})`, en: `Out of Stock (${replenishmentAlerts.filter(a => a.urgencyTier === 'OUT_OF_STOCK').length})` },
                                { key: 'CRITICAL' as const, vi: `Đặt gấp MOS < 2T (${replenishmentAlerts.filter(a => a.urgencyTier === 'CRITICAL').length})`, en: `Urgent <2M (${replenishmentAlerts.filter(a => a.urgencyTier === 'CRITICAL').length})` },
                                { key: 'LOW' as const, vi: `Tồn thấp < 3.5T (${replenishmentAlerts.filter(a => a.urgencyTier === 'LOW').length})`, en: `Low <3.5M (${replenishmentAlerts.filter(a => a.urgencyTier === 'LOW').length})` },
                                { key: 'PLAN_REORDER' as const, vi: `Bổ sung < 6T (${replenishmentAlerts.filter(a => a.urgencyTier === 'PLAN_REORDER').length})`, en: `Plan <6M (${replenishmentAlerts.filter(a => a.urgencyTier === 'PLAN_REORDER').length})` },
                            ]).map(f => (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setReplenishmentFilter(f.key)}
                                    className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors cursor-pointer whitespace-nowrap ${
                                        replenishmentFilter === f.key
                                            ? 'bg-slate-900 border-slate-900 text-white'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {isEn ? f.en : f.vi}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-md max-h-[380px] overflow-y-auto">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 whitespace-nowrap">
                                    <th className="py-2.5 px-3 w-10">#</th>
                                    <th className="py-2.5 px-3">{isEn ? 'Urgency' : 'Mức Độ Ưu Tiên'}</th>
                                    <th className="py-2.5 px-3">{isEn ? 'SKU & Wine Name' : 'Mã SKU & Tên Rượu'}</th>
                                    <th className="py-2.5 px-3 text-right">{isEn ? 'Available Stock' : 'Tồn Kho Hiện Tại'}</th>
                                    <th className="py-2.5 px-3 text-right">{isEn ? 'Monthly Velocity' : 'Tốc Độ Bán TB'}</th>
                                    <th className="py-2.5 px-3 text-right">{isEn ? 'Current MOS' : 'MOS Hiện Tại'}</th>
                                    <th className="py-2.5 px-3 text-right">{isEn ? 'Suggested Order (6M Target)' : 'SL Đề Xuất Đặt Mua (Chuẩn 6T)'}</th>
                                    <th className="py-2.5 px-3 text-right">{isEn ? 'Est. Capital' : 'Dự Toán Vốn Nhập'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredReplenishmentAlerts.map((item, idx) => {
                                    const isCurrent = item.id === selectedProductId
                                    const badgeStyle =
                                        item.urgencyTier === 'OUT_OF_STOCK'
                                            ? 'bg-red-50 text-red-700 border-red-200/90'
                                            : item.urgencyTier === 'CRITICAL'
                                            ? 'bg-amber-50 text-amber-800 border-amber-200/90'
                                            : item.urgencyTier === 'LOW'
                                            ? 'bg-cyan-50 text-cyan-800 border-cyan-200/90'
                                            : 'bg-slate-100 text-slate-700 border-slate-200/90'
                                    const dotColor =
                                        item.urgencyTier === 'OUT_OF_STOCK'
                                            ? 'bg-red-600'
                                            : item.urgencyTier === 'CRITICAL'
                                            ? 'bg-amber-500'
                                            : item.urgencyTier === 'LOW'
                                            ? 'bg-cyan-600'
                                            : 'bg-slate-400'

                                    return (
                                        <tr
                                            key={item.id}
                                            onMouseEnter={() => prefetchSku(item.id)}
                                            onClick={() => setSelectedProductId(item.id)}
                                            className={`cursor-pointer transition-colors whitespace-nowrap ${
                                                isCurrent ? 'bg-cyan-50/70' : 'hover:bg-slate-50/90'
                                            }`}
                                        >
                                            <td className="py-2 px-3 font-mono text-slate-400 tabular-nums">{idx + 1}</td>
                                            <td className="py-2 px-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${badgeStyle}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                                                    <span>{isEn ? item.urgencyLabelEn : item.urgencyLabelVi}</span>
                                                </span>
                                            </td>
                                            <td className="py-2 px-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200/80">
                                                        {item.skuCode}
                                                    </span>
                                                    <span className="font-semibold text-slate-900 truncate max-w-[260px]">
                                                        {item.productName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono tabular-nums">
                                                <span className={`font-bold ${item.totalStock <= 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                                    {item.totalStock.toLocaleString()} {isEn ? 'btls' : 'chai'}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 tabular-nums">
                                                {item.avgMonthlySales.toLocaleString()} {isEn ? 'btls/mo' : 'chai/tháng'}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">
                                                <span className={item.mosCurrent < 2 ? 'text-red-600' : item.mosCurrent < 3.5 ? 'text-amber-700' : 'text-slate-800'}>
                                                    {item.mosCurrent} {isEn ? 'mos' : 'tháng'}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-cyan-700 tabular-nums">
                                                {item.suggestedReorderBottles.toLocaleString()} {isEn ? 'btls' : 'chai'} ({item.suggestedReorderCases} {isEn ? 'cs' : 'thùng'})
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                                                {item.estimatedReorderCostVnd > 0 ? formatVND(item.estimatedReorderCostVnd) : '—'}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Loading State (only shown if no initial data yet) */}
            {isPending && !data && (
                <div className="bg-white rounded-md border border-slate-200 p-8 text-center text-xs text-slate-500">
                    {isEn ? 'Loading SKU 360° data from Supabase...' : 'Đang tải dữ liệu báo cáo SKU 360° từ Supabase...'}
                </div>
            )}

            {/* ═══ 2. MAIN SKU 360 CONTENT ═══ */}
            {data && (
                <div className={`space-y-4 transition-opacity duration-150 ${isPending ? 'opacity-65' : 'opacity-100'}`}>
                    {/* SKU Identity & Warehouse Stock Banner */}
                    <div className="bg-white rounded-md border border-slate-200 p-4 shadow-2xs">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            {/* Left: SKU Metadata */}
                            <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-900 text-white">
                                        {data.product.skuCode}
                                    </span>
                                    {(() => {
                                        const wb = WINE_TYPE_BADGE[data.product.wineType] || {
                                            vi: data.product.wineType,
                                            en: data.product.wineType,
                                            bg: '#F1F5F9',
                                            color: '#475569',
                                            border: '#CBD5E1',
                                        }
                                        return (
                                            <span
                                                className="px-2 py-0.5 text-[11px] font-semibold rounded"
                                                style={{ background: wb.bg, color: wb.color, border: `1px solid ${wb.border}` }}
                                            >
                                                {isEn ? wb.en : wb.vi}
                                            </span>
                                        )
                                    })()}
                                    <span className="text-xs font-medium text-slate-600">
                                        {data.product.country} &middot; {data.product.producerName}
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-400">
                                        {data.product.volumeMl}ml &middot; {data.product.abvPercent}% ABV &middot; {data.product.unitsPerCase} {isEn ? 'btls/case' : 'chai/thùng'}
                                    </span>
                                </div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    {data.product.productName}
                                </h2>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-0.5">
                                    <div>
                                        <span className="text-slate-400">{isEn ? 'Wholesale Price:' : 'Giá bán buôn chuẩn:'}</span>{' '}
                                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                                            {data.product.wholesalePrice > 0 ? formatVND(data.product.wholesalePrice) : '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">{isEn ? 'Retail Price:' : 'Giá bán lẻ:'}</span>{' '}
                                        <span className="font-mono font-semibold text-slate-700 tabular-nums">
                                            {data.product.retailPrice > 0 ? formatVND(data.product.retailPrice) : '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">{isEn ? 'Actual Avg Selling Price:' : 'Đơn giá bán TB thực tế:'}</span>{' '}
                                        <span className="font-mono font-bold text-cyan-700 tabular-nums">
                                            {data.kpis.avgSellingPrice > 0 ? formatVND(data.kpis.avgSellingPrice) : '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">{isEn ? 'Avg Landed Cost:' : 'Giá vốn nhập TB:'}</span>{' '}
                                        <span className="font-mono font-semibold text-slate-800 tabular-nums">
                                            {data.importKpis.avgLandedCostVnd ? formatVND(data.importKpis.avgLandedCostVnd) : (data.product.costPrice > 0 ? formatVND(data.product.costPrice) : '—')}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">{isEn ? 'Total Imported:' : 'Tổng đã nhập khẩu:'}</span>{' '}
                                        <button
                                            type="button"
                                            onClick={() => setActiveSubTab('imports')}
                                            className="font-mono font-bold text-emerald-700 hover:underline cursor-pointer tabular-nums"
                                        >
                                            {data.importKpis.totalImportedBottles.toLocaleString()} {isEn ? 'btls' : 'chai'} ({data.importKpis.totalImportBatches} {isEn ? 'batches' : 'đợt'})
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Warehouse Stock Breakdown Box */}
                            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-md p-3 shrink-0">
                                <div className="p-2 rounded bg-cyan-50 text-cyan-700">
                                    <Warehouse size={18} />
                                </div>
                                <div className="grid grid-cols-4 gap-4 text-right font-mono tabular-nums">
                                    <div>
                                        <div className="text-[10px] font-sans font-semibold uppercase text-slate-400">
                                            {isEn ? 'Total Stock' : 'Tổng Tồn Kho'}
                                        </div>
                                        <div className="text-sm font-bold text-slate-900">
                                            {data.product.totalStock.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">{isEn ? 'btls' : 'chai'}</span>
                                        </div>
                                    </div>
                                    <div className="border-l border-slate-200 pl-3">
                                        <div className="text-[10px] font-sans font-semibold uppercase text-slate-400">
                                            {isEn ? 'Thuong Tin' : 'Kho Thường Tín'}
                                        </div>
                                        <div className="text-sm font-semibold text-slate-700">
                                            {data.product.stockTT.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="border-l border-slate-200 pl-3">
                                        <div className="text-[10px] font-sans font-semibold uppercase text-slate-400">
                                            {isEn ? 'Giang Vo (GVM)' : 'Kho GVM'}
                                        </div>
                                        <div className="text-sm font-semibold text-cyan-700">
                                            {data.product.stockGVM.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="border-l border-slate-200 pl-3">
                                        <div className="text-[10px] font-sans font-semibold uppercase text-slate-400">
                                            {isEn ? 'Other / SR' : 'Kho Khác'}
                                        </div>
                                        <div className="text-sm font-semibold text-slate-600">
                                            {data.product.stockOther.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ 3. 4 EXECUTIVE KPI CARDS ═══ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Card 1: Total Buyers / Restaurants */}
                        <div className="bg-white rounded-md border border-slate-200 p-3.5">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                <span className="font-semibold uppercase tracking-wider text-[11px]">
                                    {isEn ? 'TOTAL BUYING OUTLETS' : 'TỔNG NHÀ HÀNG / KHÁCH LẤY'}
                                </span>
                                <Users size={15} className="text-cyan-600" />
                            </div>
                            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                                {data.kpis.totalBuyersCount} <span className="text-xs font-sans font-normal text-slate-500">{isEn ? 'partners' : 'đối tác'}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 font-mono tabular-nums">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                                    {data.kpis.activeBuyersCount} {isEn ? 'active' : 'đang lấy'}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700">
                                    {data.kpis.specialRuleCustomerCount} {isEn ? 'special price' : 'có giá riêng'}
                                </span>
                            </div>
                        </div>

                        {/* Card 2: Total Bottles Sold (Live + Historical) */}
                        <div className="bg-white rounded-md border border-slate-200 p-3.5">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                <span className="font-semibold uppercase tracking-wider text-[11px]">
                                    {isEn ? 'TOTAL VOLUME SOLD' : 'TỔNG SẢN LƯỢNG TIÊU THỤ'}
                                </span>
                                <Package size={15} className="text-emerald-600" />
                            </div>
                            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                                {data.kpis.totalBottles.toLocaleString()} <span className="text-xs font-sans font-normal text-slate-500">{isEn ? 'bottles' : 'chai'}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 font-mono tabular-nums">
                                <span>ERP: <strong>{data.kpis.liveCommercialBottles.toLocaleString()}</strong></span>
                                <span>&bull;</span>
                                <span>Tasting: <strong>{data.kpis.liveTastingBottles.toLocaleString()}</strong></span>
                                <span>&bull;</span>
                                <span>{isEn ? 'Pre-Aug:' : 'Trước T8:'} <strong>{data.kpis.historicalBottles.toLocaleString()}</strong></span>
                            </div>
                        </div>

                        {/* Card 3: Total Net Revenue */}
                        <div className="bg-white rounded-md border border-slate-200 p-3.5">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                <span className="font-semibold uppercase tracking-wider text-[11px]">
                                    {isEn ? 'CUMULATIVE SKU REVENUE' : 'DOANH THU LŨY KẾ SKU'}
                                </span>
                                <DollarSign size={15} className="text-amber-600" />
                            </div>
                            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                                {formatVND(data.kpis.totalRevenue)}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                                <span>{data.kpis.totalOrdersCount.toLocaleString()} {isEn ? 'orders/invoices' : 'đơn & hóa đơn'}</span>
                                <span>TB: {formatVND(data.kpis.avgSellingPrice)}/{isEn ? 'btl' : 'chai'}</span>
                            </div>
                        </div>

                        {/* Card 4: Channel Mix */}
                        <div className="bg-white rounded-md border border-slate-200 p-3.5">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                                <span className="font-semibold uppercase tracking-wider text-[11px]">
                                    {isEn ? 'CHANNEL DISTRIBUTION' : 'TỶ TRỌNG KÊNH TIÊU THỤ'}
                                </span>
                                <Layers size={15} className="text-slate-600" />
                            </div>
                            {data.channelBreakdown.length === 0 ? (
                                <div className="text-xs text-slate-400 py-2">
                                    {isEn ? 'No channel sales recorded' : 'Chưa phát sinh doanh số theo kênh'}
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {data.channelBreakdown.slice(0, 3).map(ch => (
                                        <div key={ch.channel} className="text-xs">
                                            <div className="flex items-center justify-between font-mono tabular-nums">
                                                <span className="font-sans font-medium text-slate-700 truncate max-w-[140px]">
                                                    {ch.channel === 'HORECA' ? 'HORECA (Nhà hàng)' : ch.channel === 'CORPORATE' ? 'Corporate (DN)' : ch.label}
                                                </span>
                                                <span className="text-slate-900 font-semibold">
                                                    {ch.bottles.toLocaleString()} {isEn ? 'btls' : 'chai'} ({ch.pct}%)
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${Math.max(4, ch.pct)}%`,
                                                        background: ch.channel === 'HORECA' ? '#0891B2' : ch.channel === 'CORPORATE' ? '#15803D' : '#D97706',
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ═══ 3B. DỰ BÁO MOS (MONTHS OF SUPPLY) & KẾ HOẠCH ĐẶT HÀNG ═══ */}
                    {(() => {
                        const mf = data.mosForecast
                        const activeMos = mosCycle === 3 ? mf.cycles.m3 : mosCycle === 12 ? mf.cycles.m12 : mf.cycles.m6
                        const statusStyle =
                            mf.riskStatus === 'OUT_OF_STOCK' || mf.riskStatus === 'CRITICAL'
                                ? { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-600' }
                                : mf.riskStatus === 'LOW' || mf.riskStatus === 'OVERSTOCK'
                                ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' }
                                : mf.riskStatus === 'OPTIMAL'
                                ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-600' }
                                : { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-600' }

                        return (
                            <div className="bg-white rounded-md border border-slate-200 p-4 shadow-2xs space-y-3">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
                                            <Clock size={15} className="text-cyan-600" />
                                            <span>
                                                {isEn
                                                    ? 'MOS Forecast (Months of Supply) & Inventory Replenishment'
                                                    : 'Dự Báo MOS (Số Tháng Đủ Bán) & Kế Hoạch Đặt Hàng Bổ Sung'}
                                            </span>
                                        </div>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                                            <span>{isEn ? mf.riskLabelEn : mf.riskLabelVi}</span>
                                        </span>
                                    </div>

                                    {/* Cycle Selector: 3M | 6M | 12M */}
                                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded self-start">
                                        {([
                                            { cycle: 3 as const, vi: 'Chu kỳ 3 Tháng', en: '3M Velocity' },
                                            { cycle: 6 as const, vi: 'Chu kỳ 6 Tháng (Chuẩn)', en: '6M Velocity (Std)' },
                                            { cycle: 12 as const, vi: 'Chu kỳ 12 Tháng', en: '12M Velocity' },
                                        ]).map(c => (
                                            <button
                                                key={c.cycle}
                                                type="button"
                                                onClick={() => setMosCycle(c.cycle)}
                                                className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                                                    mosCycle === c.cycle
                                                        ? 'bg-slate-900 text-white shadow-2xs'
                                                        : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                            >
                                                {isEn ? c.en : c.vi}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 4 MOS Forecast Metrics */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {/* Metric 1: Current MOS & MOS with Incoming */}
                                    <div className="bg-slate-50/70 rounded border border-slate-200 p-3">
                                        <div className="text-[11px] font-semibold uppercase text-slate-500">
                                            {isEn ? `CURRENT MOS (${mosCycle}M BASIS)` : `CHỈ SỐ MOS HIỆN TẠI (CHU KỲ ${mosCycle}T)`}
                                        </div>
                                        <div className="flex items-baseline gap-2 mt-1 font-mono tabular-nums">
                                            <span className={`text-2xl font-bold ${
                                                activeMos.mosCurrentStock !== null && activeMos.mosCurrentStock < 2
                                                    ? 'text-red-600'
                                                    : activeMos.mosCurrentStock !== null && activeMos.mosCurrentStock <= 6
                                                    ? 'text-emerald-700'
                                                    : 'text-slate-900'
                                            }`}>
                                                {activeMos.mosCurrentStock !== null
                                                    ? `${activeMos.mosCurrentStock} ${isEn ? 'mos' : 'tháng'}`
                                                    : (data.product.totalStock > 0 ? '∞' : '0.0 tháng')}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-mono mt-1 tabular-nums">
                                            {mf.incomingQty > 0 && activeMos.mosWithIncoming !== null ? (
                                                <span className="text-cyan-700 font-semibold">
                                                    {isEn ? 'With Incoming PO:' : 'Gồm hàng đang về:'} {activeMos.mosWithIncoming} {isEn ? 'mos' : 'tháng'} (+{mf.incomingQty} {isEn ? 'btls' : 'chai'})
                                                </span>
                                            ) : (
                                                <span>
                                                    {isEn ? 'Current Stock:' : 'Tồn khả dụng:'} <strong>{data.product.totalStock.toLocaleString()}</strong> {isEn ? 'btls' : 'chai'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Metric 2: Monthly Sales Velocity */}
                                    <div className="bg-slate-50/70 rounded border border-slate-200 p-3">
                                        <div className="text-[11px] font-semibold uppercase text-slate-500">
                                            {isEn ? `AVG MONTHLY VELOCITY (${mosCycle}M)` : `TỐC ĐỘ TIÊU THỤ TB (${mosCycle} THÁNG QUA)`}
                                        </div>
                                        <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                                            {activeMos.avgMonthlySales.toLocaleString()}{' '}
                                            <span className="text-xs font-sans font-normal text-slate-500">{isEn ? 'btls / month' : 'chai / tháng'}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-mono mt-1 tabular-nums">
                                            <span>
                                                {isEn ? `Sold in ${mosCycle}M:` : `Tổng bán ${mosCycle}T:`} <strong>{activeMos.totalBottlesInCycle.toLocaleString()}</strong> {isEn ? 'btls' : 'chai'}
                                            </span>
                                            {activeMos.avgMonthlyTotalOutflow > activeMos.avgMonthlySales && (
                                                <span className="ml-2 text-amber-700">
                                                    ({isEn ? 'Incl. Tasting:' : 'Gồm Tasting:'} {activeMos.avgMonthlyTotalOutflow}/th)
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Metric 3: Estimated Stockout Date & Lead Time */}
                                    <div className="bg-slate-50/70 rounded border border-slate-200 p-3">
                                        <div className="text-[11px] font-semibold uppercase text-slate-500">
                                            {isEn ? 'ESTIMATED RUNOUT DATE' : 'DỰ KIẾN NGÀY CHẠM ĐÁY TỒN KHO'}
                                        </div>
                                        <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                                            {data.product.totalStock <= 0
                                                ? (isEn ? 'Depleted (0 stock)' : 'Đã hết tồn kho')
                                                : activeMos.estimatedRunoutDate
                                                ? formatDate(activeMos.estimatedRunoutDate)
                                                : (isEn ? 'No runout risk (>24M)' : 'Chưa có nguy cơ hết hàng')}
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-mono mt-1">
                                            {isEn ? 'Import Lead Time:' : 'Lead time nhập khẩu:'} <strong>~{mf.leadTimeDays} {isEn ? 'days' : 'ngày'}</strong>
                                            {mf.incomingPoNo && (
                                                <span className="ml-2 text-emerald-700 font-semibold">
                                                    &bull; PO: {mf.incomingPoNo} {mf.incomingEta ? `(ETA ${formatDate(mf.incomingEta)})` : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Metric 4: Suggested Reorder Qty (Target 6M MOS) */}
                                    <div className="bg-slate-50/70 rounded border border-slate-200 p-3">
                                        <div className="text-[11px] font-semibold uppercase text-slate-500">
                                            {isEn ? `SUGGESTED REORDER (TARGET ${mf.targetMosMonths}M)` : `ĐỀ XUẤT ĐẶT HÀNG (ĐỦ CHUẨN ${mf.targetMosMonths} THÁNG)`}
                                        </div>
                                        <div className="text-2xl font-bold text-cyan-700 font-mono tabular-nums mt-1">
                                            {activeMos.suggestedReorderBottles > 0 ? (
                                                <>
                                                    {activeMos.suggestedReorderBottles.toLocaleString()}{' '}
                                                    <span className="text-xs font-sans font-normal text-slate-600">
                                                        {isEn ? `btls (~${activeMos.suggestedReorderCases} cases)` : `chai (~${activeMos.suggestedReorderCases} thùng)`}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-base font-sans font-semibold text-emerald-700">
                                                    {isEn ? 'No reorder required' : 'Chưa cần đặt thêm'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-1 truncate" title={isEn ? mf.recommendationEn : mf.recommendationVi}>
                                            {isEn ? mf.recommendationEn : mf.recommendationVi}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })()}

                    {/* ═══ 4. SUB-TABS: BUYERS LIST | ORDER HISTORY | MONTHLY VELOCITY ═══ */}
                    <div className="bg-white rounded-md border border-slate-200 shadow-2xs overflow-hidden">
                        {/* Sub-tab Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 border-b border-slate-200 bg-slate-50/60">
                            <div className="flex items-center gap-5 overflow-x-auto no-scrollbar">
                                <button
                                    type="button"
                                    onClick={() => setActiveSubTab('buyers')}
                                    className={`flex items-center gap-2 pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                                        activeSubTab === 'buyers'
                                            ? 'border-slate-900 text-slate-900 font-bold'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <Building2 size={14} />
                                    <span>
                                        {isEn
                                            ? `Restaurants & Customers Buying (${data.customers.length})`
                                            : `Nhà Hàng & Khách Hàng Đang Lấy (${data.customers.length})`}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveSubTab('orders')}
                                    className={`flex items-center gap-2 pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                                        activeSubTab === 'orders'
                                            ? 'border-slate-900 text-slate-900 font-bold'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <FileText size={14} />
                                    <span>
                                        {isEn
                                            ? `Orders & Historical Invoices (${data.orders.length})`
                                            : `Sổ Chi Tiết Đơn Hàng & Hóa Đơn (${data.orders.length})`}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveSubTab('imports')}
                                    className={`flex items-center gap-2 pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                                        activeSubTab === 'imports'
                                            ? 'border-slate-900 text-slate-900 font-bold'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <Warehouse size={14} />
                                    <span>
                                        {isEn
                                            ? `Import History & Stock Lots (${data.importKpis.totalImportBatches} batches)`
                                            : `Lịch Sử Nhập Hàng & Lô Tồn Kho (${data.importKpis.totalImportBatches} đợt nhập)`}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveSubTab('monthly')}
                                    className={`flex items-center gap-2 pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                                        activeSubTab === 'monthly'
                                            ? 'border-slate-900 text-slate-900 font-bold'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <TrendingUp size={14} />
                                    <span>
                                        {isEn
                                            ? `Monthly Sales Velocity (${data.monthlyTrend.length} months)`
                                            : `Nhịp Độ Bán Hàng Theo Tháng (${data.monthlyTrend.length} tháng)`}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* ─── SUB-TAB 1: DANH SÁCH NHÀ HÀNG / KHÁCH HÀNG ĐANG LẤY ─── */}
                        {activeSubTab === 'buyers' && (
                            <div className="p-4 space-y-3">
                                {/* Filter Bar for Buyers */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {([
                                            { key: 'ALL', label: isEn ? `All (${data.customers.length})` : `Tất cả (${data.customers.length})` },
                                            {
                                                key: 'ACTIVE',
                                                label: isEn
                                                    ? `Active Buyers (${data.customers.filter(c => c.buyerStatus === 'ACTIVE').length})`
                                                    : `Đang lấy gần đây (${data.customers.filter(c => c.buyerStatus === 'ACTIVE').length})`,
                                            },
                                            {
                                                key: 'AT_RISK',
                                                label: isEn
                                                    ? `Over 75d (${data.customers.filter(c => c.buyerStatus === 'AT_RISK').length})`
                                                    : `Chậm lấy >75 ngày (${data.customers.filter(c => c.buyerStatus === 'AT_RISK').length})`,
                                            },
                                            {
                                                key: 'PRICE_RULE',
                                                label: isEn
                                                    ? `Has Special Price (${data.customers.filter(c => c.specialPrice !== null).length})`
                                                    : `Có bảng giá riêng (${data.customers.filter(c => c.specialPrice !== null).length})`,
                                            },
                                            {
                                                key: 'HISTORICAL_ONLY',
                                                label: isEn
                                                    ? `Pre-Aug 2026 Only (${data.customers.filter(c => c.buyerStatus === 'HISTORICAL_ONLY').length})`
                                                    : `Khách lịch sử trước T8/2026 (${data.customers.filter(c => c.buyerStatus === 'HISTORICAL_ONLY').length})`,
                                            },
                                        ] as const).map(f => (
                                            <button
                                                key={f.key}
                                                type="button"
                                                onClick={() => setBuyerStatusFilter(f.key)}
                                                className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer ${
                                                    buyerStatusFilter === f.key
                                                        ? 'bg-slate-900 border-slate-900 text-white'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <select
                                            value={buyerChannelFilter}
                                            onChange={e => setBuyerChannelFilter(e.target.value)}
                                            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-cyan-600"
                                        >
                                            <option value="ALL">{isEn ? 'All Channels' : 'Tất cả kênh'}</option>
                                            <option value="HORECA">HORECA (Nhà hàng / KS)</option>
                                            <option value="CORPORATE">Corporate (Doanh nghiệp)</option>
                                            <option value="WHOLESALE_DISTRIBUTOR">Wholesale (Đại lý)</option>
                                            <option value="RETAIL">Retail (Khách lẻ)</option>
                                        </select>

                                        <div className="relative">
                                            <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={buyerTextFilter}
                                                onChange={e => setBuyerTextFilter(e.target.value)}
                                                placeholder={isEn ? 'Filter restaurant / sales rep...' : 'Lọc tên nhà hàng / mã KH / Sales...'}
                                                className="pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded w-56 focus:outline-none focus:bg-white focus:border-cyan-600"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Buyers Table */}
                                <div className="overflow-x-auto border border-slate-200 rounded-md">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 whitespace-nowrap">
                                                <th className="py-2.5 px-3 w-10">#</th>
                                                <th className="py-2.5 px-3 min-w-[240px]">{isEn ? 'Restaurant / Customer' : 'Nhà Hàng / Khách Hàng'}</th>
                                                <th className="py-2.5 px-3 min-w-[115px]">{isEn ? 'Channel' : 'Kênh'}</th>
                                                <th className="py-2.5 px-3 min-w-[125px]">{isEn ? 'Sales Rep' : 'Sales Phụ Trách'}</th>
                                                <th className="py-2.5 px-3 min-w-[140px]">{isEn ? 'Buying Status' : 'Trạng Thái Lấy'}</th>
                                                <th className="py-2.5 px-3 text-right min-w-[120px]">{isEn ? 'Volume (Btls)' : 'Sản Lượng (Chai)'}</th>
                                                <th className="py-2.5 px-3 text-right min-w-[130px]">{isEn ? 'Total Revenue' : 'Tổng Doanh Thu'}</th>
                                                <th className="py-2.5 px-3 text-right min-w-[175px]">{isEn ? 'Applied / Special Price' : 'Đơn Giá Mua / Giá Riêng'}</th>
                                                <th className="py-2.5 px-3 text-right min-w-[125px]">{isEn ? 'Last Order' : 'Lần Lấy Gần Nhất'}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredBuyers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="py-8 text-center text-slate-400">
                                                        {isEn
                                                            ? 'No matching restaurants/customers found for this filter.'
                                                            : 'Không tìm thấy nhà hàng / khách hàng phù hợp với bộ lọc hiện tại.'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredBuyers.map((buyer, idx) => {
                                                    const chBadge = CHANNEL_BADGE[buyer.channel] || {
                                                        label: buyer.channel,
                                                        labelEn: buyer.channel,
                                                        bg: '#F1F5F9',
                                                        color: '#475569',
                                                        border: '#E2E8F0',
                                                    }
                                                    return (
                                                        <tr key={buyer.key} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="py-2.5 px-3 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                                                                {idx + 1}
                                                            </td>
                                                            <td className="py-2.5 px-3">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80 whitespace-nowrap">
                                                                        {buyer.customerCode}
                                                                    </span>
                                                                    {buyer.isLinkedCustomer && buyer.customerId ? (
                                                                        <Link
                                                                            href={`/dashboard?tab=customers&customerId=${buyer.customerId}`}
                                                                            className="font-bold text-slate-900 hover:text-cyan-700 flex items-center gap-1 group"
                                                                            title={isEn ? 'Open Customer 360° Profile' : 'Mở hồ sơ Khách hàng 360°'}
                                                                        >
                                                                            <span className="line-clamp-1">{buyer.customerName}</span>
                                                                            <ExternalLink size={12} className="text-slate-400 group-hover:text-cyan-600 shrink-0" />
                                                                        </Link>
                                                                    ) : (
                                                                        <span className="font-semibold text-slate-800 line-clamp-1">
                                                                            {buyer.customerName}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                                <span
                                                                    className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-wide rounded-full whitespace-nowrap"
                                                                    style={{
                                                                        background: chBadge.bg,
                                                                        color: chBadge.color,
                                                                        border: `1px solid ${chBadge.border}`,
                                                                    }}
                                                                >
                                                                    {isEn ? chBadge.labelEn : chBadge.label}
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                                <span className="font-medium text-slate-800">
                                                                    {buyer.salesRepName || '—'}
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                                {buyer.buyerStatus === 'ACTIVE' && (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/90 whitespace-nowrap">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                                        <span>{isEn ? 'Active Buyer' : 'Đang lấy hàng'}</span>
                                                                    </span>
                                                                )}
                                                                {buyer.buyerStatus === 'AT_RISK' && (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/90 whitespace-nowrap">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                                        <span>{isEn ? 'Slow (>75d)' : 'Chậm lấy >75 ngày'}</span>
                                                                    </span>
                                                                )}
                                                                {buyer.buyerStatus === 'HISTORICAL_ONLY' && (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/90 whitespace-nowrap">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                                                        <span>{isEn ? 'Pre-Aug 2026' : 'Trước T8/2026'}</span>
                                                                    </span>
                                                                )}
                                                                {buyer.buyerStatus === 'PRICE_RULE_ONLY' && (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-200/90 whitespace-nowrap">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                                                                        <span>{isEn ? 'Special Price' : 'Có giá riêng'}</span>
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                                                <span className="text-sm font-bold text-slate-900">
                                                                    {buyer.totalBottles.toLocaleString()}
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                                                {buyer.totalRevenue > 0 ? formatVND(buyer.totalRevenue) : '—'}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                                                <div className="inline-flex items-center justify-end gap-1.5">
                                                                    {buyer.lastUnitPrice !== null && buyer.lastUnitPrice > 0 ? (
                                                                        <span className="font-bold text-slate-900">
                                                                            {formatVND(buyer.lastUnitPrice)}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-400">—</span>
                                                                    )}
                                                                    {buyer.specialPrice !== null && (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200/80 text-[10px] font-semibold whitespace-nowrap">
                                                                            <span>
                                                                                {isEn ? 'Special:' : 'Giá riêng:'} {formatVND(buyer.specialPrice)}
                                                                            </span>
                                                                            {buyer.specialDiscountPct ? (
                                                                                <span className="text-cyan-600 font-bold">
                                                                                    (-{buyer.specialDiscountPct}%)
                                                                                </span>
                                                                            ) : null}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                                                                {buyer.lastOrderDate ? formatDate(buyer.lastOrderDate) : '—'}
                                                            </td>
                                                        </tr>
                                                    )
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ─── SUB-TAB 2: SỔ CHI TIẾT ĐƠN HÀNG & HÓA ĐƠN XUẤT BÁN ─── */}
                        {activeSubTab === 'orders' && (
                            <div className="p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {([
                                            { key: 'ALL', label: isEn ? `All Transactions (${data.orders.length})` : `Tất cả giao dịch (${data.orders.length})` },
                                            {
                                                key: 'ERP_SO',
                                                label: isEn
                                                    ? `Live ERP SO (Aug 2026+)`
                                                    : `Đơn bán ERP (T8/2026–Nay: ${data.orders.filter(o => o.recordSource === 'ERP_SO' && o.orderType !== 'TASTING' && o.orderType !== 'SAMPLE').length})`,
                                            },
                                            {
                                                key: 'HISTORICAL_INVOICE',
                                                label: isEn
                                                    ? `Historical Ledger (2021–Jul 2026)`
                                                    : `Sổ kế toán lịch sử (2021–T7/2026: ${data.orders.filter(o => o.recordSource === 'HISTORICAL_INVOICE').length})`,
                                            },
                                            {
                                                key: 'TASTING',
                                                label: isEn
                                                    ? `Tasting / Sample`
                                                    : `Xuất Tasting / Hàng mẫu (${data.orders.filter(o => o.orderType === 'TASTING' || o.orderType === 'SAMPLE').length})`,
                                            },
                                        ] as const).map(f => (
                                            <button
                                                key={f.key}
                                                type="button"
                                                onClick={() => setOrderSourceFilter(f.key)}
                                                className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer ${
                                                    orderSourceFilter === f.key
                                                        ? 'bg-slate-900 border-slate-900 text-white'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                        {isEn ? 'Showing up to 200 latest records' : 'Hiển thị tối đa 200 dòng giao dịch gần nhất'}
                                    </span>
                                </div>

                                <div className="overflow-x-auto border border-slate-200 rounded-md">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                                                <th className="py-2.5 px-3">{isEn ? 'Date' : 'Ngày Chứng Từ'}</th>
                                                <th className="py-2.5 px-3">{isEn ? 'Order / Invoice No.' : 'Số Đơn / Hóa Đơn'}</th>
                                                <th className="py-2.5 px-3">{isEn ? 'Source & Entity' : 'Nguồn & Pháp Nhân'}</th>
                                                <th className="py-2.5 px-3">{isEn ? 'Restaurant / Customer' : 'Nhà Hàng / Khách Hàng'}</th>
                                                <th className="py-2.5 px-3 text-right">{isEn ? 'Qty (Btls)' : 'Số Lượng (Chai)'}</th>
                                                <th className="py-2.5 px-3 text-right">{isEn ? 'Net Unit Price' : 'Đơn Giá Thực'}</th>
                                                <th className="py-2.5 px-3 text-right">{isEn ? 'Line Total' : 'Thành Tiền'}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredOrders.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="py-8 text-center text-slate-400">
                                                        {isEn ? 'No transactions found.' : 'Không có giao dịch nào trong mục này.'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredOrders.slice(0, 200).map(ord => (
                                                    <tr key={ord.id} className="hover:bg-slate-50/80">
                                                        <td className="py-2 px-3 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                                                            {formatDate(ord.date)}
                                                        </td>
                                                        <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                                            {ord.docNo}
                                                            {(ord.orderType === 'TASTING' || ord.orderType === 'SAMPLE') && (
                                                                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-700 font-sans font-semibold">
                                                                    {ord.orderType}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 whitespace-nowrap">
                                                            <span
                                                                className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                                                                    ord.recordSource === 'ERP_SO'
                                                                        ? 'bg-cyan-50 text-cyan-700'
                                                                        : 'bg-slate-100 text-slate-600'
                                                                }`}
                                                            >
                                                                {ord.recordSource === 'ERP_SO' ? 'ERP Live' : (isEn ? 'Historical DB' : 'Lịch sử KT')}
                                                            </span>
                                                            {ord.legalEntity && (
                                                                <span className="ml-1.5 text-[11px] text-slate-500">
                                                                    {ord.legalEntity}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-600">
                                                                    {ord.customerCode}
                                                                </span>
                                                                {ord.customerId ? (
                                                                    <Link
                                                                        href={`/dashboard?tab=customers&customerId=${ord.customerId}`}
                                                                        className="font-semibold text-slate-900 hover:text-cyan-700 flex items-center gap-1"
                                                                    >
                                                                        <span>{ord.customerName}</span>
                                                                        <ArrowUpRight size={12} className="text-slate-400" />
                                                                    </Link>
                                                                ) : (
                                                                    <span className="font-medium text-slate-800">{ord.customerName}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                                                            {ord.qty.toLocaleString()}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono text-slate-700 tabular-nums">
                                                            {ord.unitPrice > 0 ? formatVND(ord.unitPrice) : '0 ₫'}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                                                            {ord.lineTotal > 0 ? formatVND(ord.lineTotal) : '0 ₫'}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ─── SUB-TAB 3: LỊCH SỬ NHẬP HÀNG & LÔ TỒN KHO ─── */}
                        {activeSubTab === 'imports' && (
                            <div className="p-4 space-y-4">
                                {/* 4 Import KPI Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div className="bg-slate-50/70 rounded-md border border-slate-200 p-3">
                                        <div className="text-[11px] font-semibold uppercase text-slate-500">
                                            {isEn ? 'TOTAL DIRECT IMPORTED VOLUME' : 'TỔNG SẢN LƯỢNG NHẬP KHẨU TRỰC TIẾP'}
                                        </div>
                                        <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                                            {data.importKpis.totalImportedBottles.toLocaleString()}{' '}
                                            <span className="text-xs font-sans font-normal text-slate-500">{isEn ? 'bottles' : 'chai'}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-600 font-mono mt-1">
                                            <span>{data.importKpis.totalImportBatches} {isEn ? 'shipments/batches' : 'đợt nhập'}</span>
                                            {data.importKpis.totalFocBottles > 0 && (
                                                <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                                                    +{data.importKpis.totalFocBottles} FOC
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50/70 rounded-md border border-slate-200 p-3">
                                        <div className="text-[11px] font-semibold uppercase text-slate-500">
                                            {isEn ? 'TOTAL LANDED IMPORT VALUE' : 'TỔNG GIÁ TRỊ VỐN NHẬP KHO'}
                                        </div>
                                        <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                                            {data.importKpis.totalImportValueVnd > 0 ? formatVND(data.importKpis.totalImportValueVnd) : '—'}
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-mono mt-1">
                                            {isEn ? "Internal Transfer (TA -> Ly's):" : "Mua nội bộ (TA -> Ly's):"}{' '}
                                            <strong className="text-slate-700">{data.importKpis.totalInternalTransferBottles.toLocaleString()} {isEn ? 'btls' : 'chai'}</strong>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50/70 rounded-md border border-slate-200 p-3">
                                        <div className="text-[11px] font-semibold uppercase text-slate-500">
                                            {isEn ? 'UNIT LANDED COST (COGS)' : 'ĐƠN GIÁ VỐN NHẬP KHO (1 CHAI)'}
                                        </div>
                                        <div className="text-xl font-bold text-cyan-700 font-mono tabular-nums mt-1">
                                            {data.importKpis.avgLandedCostVnd ? formatVND(data.importKpis.avgLandedCostVnd) : '—'}
                                            <span className="text-[11px] font-sans font-normal text-slate-500 ml-1">({isEn ? 'weighted avg' : 'bình quân'})</span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-mono mt-1 tabular-nums">
                                            {data.importKpis.minLandedCostVnd && data.importKpis.maxLandedCostVnd ? (
                                                <span>
                                                    {isEn ? 'Range:' : 'Biên độ:'} {formatVND(data.importKpis.minLandedCostVnd)} – {formatVND(data.importKpis.maxLandedCostVnd)}
                                                </span>
                                            ) : (
                                                <span>{isEn ? 'Standard Cost:' : 'Giá vốn chuẩn:'} {data.product.costPrice > 0 ? formatVND(data.product.costPrice) : '—'}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50/70 rounded-md border border-slate-200 p-3">
                                        <div className="text-[11px] font-semibold uppercase text-slate-500">
                                            {isEn ? 'LATEST IMPORT SHIPMENT' : 'ĐỢT NHẬP KHẨU GẦN NHẤT'}
                                        </div>
                                        <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-1">
                                            {data.importKpis.latestImportDate ? formatDate(data.importKpis.latestImportDate) : (isEn ? 'No import record' : 'Chưa có đợt nhập')}
                                        </div>
                                        <div className="text-[11px] text-slate-600 mt-1 truncate" title={data.importKpis.latestSupplierName || ''}>
                                            {data.importKpis.latestSupplierName ? (
                                                <span>
                                                    NCC: <strong>{data.importKpis.latestSupplierName}</strong>
                                                    {data.importKpis.latestLandedCostVnd ? ` (${formatVND(data.importKpis.latestLandedCostVnd)}/chai)` : ''}
                                                </span>
                                            ) : '—'}
                                        </div>
                                    </div>
                                </div>

                                {/* Filter Bar for Imports Table */}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {([
                                            {
                                                key: 'EXTERNAL',
                                                label: isEn
                                                    ? `Direct Foreign Imports & ERP GR (${data.imports.filter(i => i.importType !== 'INTERNAL_TRANSFER').length})`
                                                    : `Nhập khẩu trực tiếp & Phiếu GRN (${data.imports.filter(i => i.importType !== 'INTERNAL_TRANSFER').length})`,
                                            },
                                            {
                                                key: 'INTERNAL',
                                                label: isEn
                                                    ? `Internal Transfer Thắng Ân -> Ly's Cellars (${data.imports.filter(i => i.importType === 'INTERNAL_TRANSFER').length})`
                                                    : `Nhập mua nội bộ Thắng Ân -> Ly's Cellars (${data.imports.filter(i => i.importType === 'INTERNAL_TRANSFER').length})`,
                                            },
                                            {
                                                key: 'ALL',
                                                label: isEn
                                                    ? `All Inbound Vouchers (${data.imports.length})`
                                                    : `Tất cả phiếu nhập (${data.imports.length})`,
                                            },
                                        ] as const).map(f => (
                                            <button
                                                key={f.key}
                                                type="button"
                                                onClick={() => setImportSourceFilter(f.key)}
                                                className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer ${
                                                    importSourceFilter === f.key
                                                        ? 'bg-slate-900 border-slate-900 text-white'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                        {isEn
                                            ? 'Data migrated from Customs & Accounting Import Ledgers (2021–2026) on Supabase'
                                            : 'Dữ liệu đồng bộ từ Tờ khai Hải quan & Sổ chi tiết lô nhập hàng (2021–2026) trên Supabase'}
                                    </span>
                                </div>

                                {/* Table 1: Historical & Live Import Batches */}
                                <div className="overflow-x-auto border border-slate-200 rounded-md">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                                                <th className="py-2.5 px-3">{isEn ? 'Receipt Date' : 'Ngày Nhập'}</th>
                                                <th className="py-2.5 px-3">{isEn ? 'Voucher / Batch' : 'Số Phiếu / Mã Lô'}</th>
                                                <th className="py-2.5 px-3">{isEn ? 'Customs Decl / Invoice' : 'Số Tờ Khai HQ / HĐ'}</th>
                                                <th className="py-2.5 px-3">{isEn ? 'Supplier / Winery' : 'Nhà Cung Cấp / Hãng Rượu'}</th>
                                                <th className="py-2.5 px-3">{isEn ? 'Entity & Type' : 'Pháp Nhân & Loại Nhập'}</th>
                                                <th className="py-2.5 px-3 text-right">{isEn ? 'Qty Imported' : 'SL Nhập (Chai)'}</th>
                                                <th className="py-2.5 px-3 text-right">{isEn ? 'Purchase Price' : 'Đơn Giá Mua'}</th>
                                                <th className="py-2.5 px-3 text-right">{isEn ? 'Unit Landed Cost' : 'Giá Vốn 1 Chai (VND)'}</th>
                                                <th className="py-2.5 px-3 text-right">{isEn ? 'Total Batch Value' : 'Thành Tiền Giá Vốn'}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredImports.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="py-8 text-center text-slate-400">
                                                        {isEn
                                                            ? 'No import records found for this filter.'
                                                            : 'Không có dữ liệu đợt nhập hàng nào trong bộ lọc này.'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredImports.map(imp => (
                                                    <tr key={imp.id} className="hover:bg-slate-50/80">
                                                        <td className="py-2 px-3 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                                                            {formatDate(imp.receiptDate)}
                                                        </td>
                                                        <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                                            <span>{imp.voucherNo}</span>
                                                            {imp.batchCode && (
                                                                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded bg-cyan-50 text-cyan-700 font-bold">
                                                                    {imp.batchCode}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                                                            {imp.declarationNo || '—'}
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <div className="font-semibold text-slate-900">{imp.supplierName}</div>
                                                            {imp.country && (
                                                                <div className="text-[10px] text-slate-500">{imp.country}</div>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 whitespace-nowrap">
                                                            <span
                                                                className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                                                                    imp.importType === 'DIRECT_IMPORT' || imp.importType === 'ERP_GR'
                                                                        ? 'bg-emerald-50 text-emerald-700'
                                                                        : imp.importType === 'INTERNAL_TRANSFER'
                                                                        ? 'bg-slate-100 text-slate-600'
                                                                        : 'bg-amber-50 text-amber-700'
                                                                }`}
                                                            >
                                                                {imp.importType === 'DIRECT_IMPORT'
                                                                    ? (isEn ? 'Direct Import' : 'Nhập khẩu trực tiếp')
                                                                    : imp.importType === 'ERP_GR'
                                                                    ? 'ERP GRN'
                                                                    : imp.importType === 'INTERNAL_TRANSFER'
                                                                    ? (isEn ? 'Internal (TA->LYS)' : 'Nội bộ TA→LYS')
                                                                    : (isEn ? 'Return Inbound' : 'Nhập hàng trả lại')}
                                                            </span>
                                                            {imp.legalEntity && (
                                                                <span className="ml-1.5 text-[11px] font-medium text-slate-700">
                                                                    {imp.legalEntity}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                                            <div className="font-bold text-slate-900">
                                                                {imp.qtyTotal.toLocaleString()}
                                                            </div>
                                                            {imp.qtyFoc > 0 && (
                                                                <div className="text-[10px] text-emerald-700">
                                                                    ({imp.qtyCommercial} TM + {imp.qtyFoc} FOC)
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                                                            {imp.foreignUnitPrice !== null && imp.currency !== 'VND' ? (
                                                                <div>
                                                                    <span className="font-semibold text-slate-900">
                                                                        {imp.foreignUnitPrice.toLocaleString()} {imp.currency}
                                                                    </span>
                                                                    {imp.purchasePriceVnd > 0 && (
                                                                        <div className="text-[10px] text-slate-400">
                                                                            ({formatVND(imp.purchasePriceVnd)})
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span>{imp.purchasePriceVnd > 0 ? formatVND(imp.purchasePriceVnd) : '—'}</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-cyan-700 tabular-nums whitespace-nowrap">
                                                            {imp.landedCostVnd > 0 ? formatVND(imp.landedCostVnd) : '—'}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                                            {imp.totalValueVnd > 0 ? formatVND(imp.totalValueVnd) : '0 ₫'}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Table 2: Active Warehouse Stock Lots */}
                                <div className="space-y-2 pt-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                            <Warehouse size={14} className="text-cyan-600" />
                                            <span>
                                                {isEn
                                                    ? `Current Active Stock Lots in Warehouse (${data.stockLots.length} lots — ${data.product.totalStock.toLocaleString()} bottles)`
                                                    : `Chi Tiết Các Lô Tồn Kho Hiện Tại Tại Kho (${data.stockLots.length} lô — ${data.product.totalStock.toLocaleString()} chai khả dụng)`}
                                            </span>
                                        </h4>
                                    </div>
                                    <div className="overflow-x-auto border border-slate-200 rounded-md">
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                                                    <th className="py-2 px-3">{isEn ? 'Stock Lot No.' : 'Mã Lô Tồn Kho (Lot No)'}</th>
                                                    <th className="py-2 px-3">{isEn ? 'Warehouse & Location' : 'Kho & Vị Trí Kệ'}</th>
                                                    <th className="py-2 px-3">{isEn ? 'Owner Entity' : 'Pháp Nhân Sở Hữu'}</th>
                                                    <th className="py-2 px-3">{isEn ? 'Vintage' : 'Niên Vụ'}</th>
                                                    <th className="py-2 px-3">{isEn ? 'Lot Date' : 'Ngày Ghi Nhận Lô'}</th>
                                                    <th className="py-2 px-3 text-right">{isEn ? 'Initial Qty' : 'SL Nhập Lô'}</th>
                                                    <th className="py-2 px-3 text-right">{isEn ? 'Available Stock' : 'SL Đang Tồn (Chai)'}</th>
                                                    <th className="py-2 px-3 text-right">{isEn ? 'Lot Unit Cost' : 'Giá Vốn Lô / Chai'}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                                                {data.stockLots.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={8} className="py-6 text-center font-sans text-slate-400">
                                                            {isEn ? 'Out of stock across all warehouses.' : 'Hiện tại mã SKU này đã hết tồn kho khả dụng.'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    data.stockLots.map(lot => (
                                                        <tr key={lot.id} className="hover:bg-slate-50/80">
                                                            <td className="py-2 px-3 font-bold text-slate-900">{lot.lotNo}</td>
                                                            <td className="py-2 px-3 font-sans">
                                                                <span className="font-semibold text-slate-800">{lot.warehouseName}</span>
                                                                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-slate-600">
                                                                    {lot.locationCode}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-3 font-sans text-slate-700">{lot.legalEntityName}</td>
                                                            <td className="py-2 px-3 text-slate-600">{lot.vintage || 'NV'}</td>
                                                            <td className="py-2 px-3 text-slate-600">{formatDate(lot.receivedDate)}</td>
                                                            <td className="py-2 px-3 text-right text-slate-600">{lot.qtyReceived.toLocaleString()}</td>
                                                            <td className="py-2 px-3 text-right font-bold text-emerald-700">{lot.qtyAvailable.toLocaleString()}</td>
                                                            <td className="py-2 px-3 text-right text-slate-800">
                                                                {lot.unitLandedCost > 0 ? formatVND(lot.unitLandedCost) : '—'}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ─── SUB-TAB 4: NHỊP ĐỘ TIÊU THỤ THEO THÁNG ─── */}
                        {activeSubTab === 'monthly' && (
                            <div className="p-4 space-y-4">
                                {/* Multi-Cycle MOS Comparison Table (3M vs 6M vs 12M) */}
                                <div className="overflow-x-auto border border-slate-200 rounded-md">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                                                <th className="py-2 px-3">{isEn ? 'Velocity Window' : 'Chu Kỳ Tính MOS'}</th>
                                                <th className="py-2 px-3 text-right">{isEn ? 'Total Sold in Window' : 'Tổng Bán Trong Chu Kỳ'}</th>
                                                <th className="py-2 px-3 text-right">{isEn ? 'Avg Monthly Velocity' : 'Tốc Độ Bán TB / Tháng'}</th>
                                                <th className="py-2 px-3 text-right">{isEn ? 'Current MOS' : 'MOS Tồn Hiện Tại'}</th>
                                                <th className="py-2 px-3 text-right">{isEn ? 'MOS incl. Incoming' : 'MOS Gồm Hàng Đang Về'}</th>
                                                <th className="py-2 px-3 text-right">{isEn ? 'Est. Runout Date' : 'Dự Kiến Hết Hàng'}</th>
                                                <th className="py-2 px-3 text-right">{isEn ? 'Suggested Reorder (6M Target)' : 'Đề Xuất Đặt Thêm (Chuẩn 6T)'}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                                            {([
                                                { labelVi: 'Ngắn hạn (3 tháng gần nhất)', labelEn: 'Short-term (Last 3 Months)', item: data.mosForecast.cycles.m3 },
                                                { labelVi: 'Trung hạn (6 tháng — Chuẩn đặt hàng)', labelEn: 'Medium-term (Last 6 Months — Standard)', item: data.mosForecast.cycles.m6 },
                                                { labelVi: 'Dài hạn (12 tháng gần nhất)', labelEn: 'Annual (Last 12 Months)', item: data.mosForecast.cycles.m12 },
                                            ]).map(row => (
                                                <tr key={row.item.cycleMonths} className="hover:bg-slate-50/80">
                                                    <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                                                        {isEn ? row.labelEn : row.labelVi}
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-slate-700">
                                                        {row.item.totalBottlesInCycle.toLocaleString()} {isEn ? 'btls' : 'chai'}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                                                        {row.item.avgMonthlySales.toLocaleString()} {isEn ? 'btls/mo' : 'chai/tháng'}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-bold text-cyan-700">
                                                        {row.item.mosCurrentStock !== null ? `${row.item.mosCurrentStock} ${isEn ? 'mos' : 'tháng'}` : '∞'}
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-slate-700">
                                                        {row.item.mosWithIncoming !== null ? `${row.item.mosWithIncoming} ${isEn ? 'mos' : 'tháng'}` : '∞'}
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-slate-700">
                                                        {row.item.estimatedRunoutDate ? formatDate(row.item.estimatedRunoutDate) : '—'}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                                        {row.item.suggestedReorderBottles > 0
                                                            ? `${row.item.suggestedReorderBottles.toLocaleString()} ${isEn ? 'btls' : 'chai'} (${row.item.suggestedReorderCases} ${isEn ? 'cs' : 'thùng'})`
                                                            : (isEn ? 'Sufficient' : 'Đủ tồn')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {data.monthlyTrend.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-400">
                                        {isEn ? 'No monthly data recorded.' : 'Chưa có dữ liệu tiêu thụ theo tháng.'}
                                    </div>
                                ) : (
                                    <>
                                        {/* Bar Chart (Last 24 active months) */}
                                        <div className="border border-slate-200 rounded-md p-4 bg-slate-50/40">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-bold text-slate-800">
                                                    {isEn
                                                        ? 'Monthly Sales Volume Progression (Bottles)'
                                                        : 'Biểu Đồ Sản Lượng Xuất Bán Theo Tháng (Chai)'}
                                                </span>
                                                <div className="flex items-center gap-4 text-[11px] text-slate-600">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="w-2.5 h-2.5 rounded-xs bg-cyan-600 inline-block" />
                                                        <span>{isEn ? 'Commercial Bottles' : 'Bán thương mại'}</span>
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                                                        <span>{isEn ? 'Tasting / Sample' : 'Tasting / Mẫu'}</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-end gap-2 h-44 pt-4 overflow-x-auto pb-2">
                                                {data.monthlyTrend.slice(-24).map(m => {
                                                    const totalM = m.commercialBottles + m.tastingBottles
                                                    const heightPct = Math.max(6, Math.round((totalM / maxMonthlyBottles) * 100))
                                                    return (
                                                        <div key={m.month} className="flex flex-col items-center gap-1 min-w-[38px] flex-1">
                                                            <span className="text-[10px] font-mono font-bold text-slate-700 tabular-nums">
                                                                {totalM}
                                                            </span>
                                                            <div className="w-full max-w-[28px] bg-slate-200/70 rounded-t flex flex-col justify-end overflow-hidden" style={{ height: '120px' }}>
                                                                <div
                                                                    className="w-full transition-all"
                                                                    style={{
                                                                        height: `${heightPct}%`,
                                                                        background: m.tastingBottles > 0 && m.commercialBottles === 0 ? '#F59E0B' : '#0891B2',
                                                                    }}
                                                                    title={`${m.label}: ${m.commercialBottles} TM + ${m.tastingBottles} Tasting — ${formatVND(m.revenue)}`}
                                                                />
                                                            </div>
                                                            <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
                                                                {m.label}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Monthly Table */}
                                        <div className="overflow-x-auto border border-slate-200 rounded-md">
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                                                        <th className="py-2 px-3">{isEn ? 'Month' : 'Tháng'}</th>
                                                        <th className="py-2 px-3 text-right">{isEn ? 'Active Buyers' : 'Số Nhà Hàng Lấy'}</th>
                                                        <th className="py-2 px-3 text-right">{isEn ? 'Commercial (Btls)' : 'Bán Thương Mại (Chai)'}</th>
                                                        <th className="py-2 px-3 text-right">{isEn ? 'Tasting / Sample' : 'Tasting / Mẫu (Chai)'}</th>
                                                        <th className="py-2 px-3 text-right">{isEn ? 'Total Revenue' : 'Doanh Thu Thuần'}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                                                    {[...data.monthlyTrend].reverse().map(m => (
                                                        <tr key={m.month} className="hover:bg-slate-50/80">
                                                            <td className="py-2 px-3 font-bold text-slate-900">
                                                                {m.month} ({m.label})
                                                            </td>
                                                            <td className="py-2 px-3 text-right text-slate-700">
                                                                {m.buyerCount > 0 ? `${m.buyerCount} ${isEn ? 'buyers' : 'nhà lấy'}` : '—'}
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                                                                {m.commercialBottles.toLocaleString()}
                                                            </td>
                                                            <td className="py-2 px-3 text-right text-amber-700">
                                                                {m.tastingBottles > 0 ? m.tastingBottles.toLocaleString() : '—'}
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-semibold text-slate-900">
                                                                {m.revenue > 0 ? formatVND(m.revenue) : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
