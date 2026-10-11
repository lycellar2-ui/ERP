'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import {
    searchCustomersForDashboard,
    getCustomerPurchaseHistory,
    type DashboardCustomerSearchItem,
    type CustomerPurchaseHistoryResult,
    type CustomerHistorySOItem,
    type CustomerSpecialPriceRuleItem,
} from './actions'
import {
    Search, Users, Wine, Calendar, DollarSign, Package, TrendingUp,
    ChevronDown, ChevronUp, ChevronRight, ExternalLink, FileText,
    CheckCircle2, Truck, AlertCircle, Clock, X, ArrowUpRight,
    Store, Building2, User, RefreshCw, BarChart2, ShieldAlert,
    Tag, Award, Phone, MapPin, AlertTriangle, Sparkles, Filter,
    Check, ArrowRight, Percent, Info, ShoppingCart, CreditCard
} from 'lucide-react'
import { formatVND } from '@/lib/utils'
import Link from 'next/link'
import { useAppLocale } from '@/lib/i18n'
import { getDashboardDictionary } from './i18n'

interface TopCustomerSimple {
    id: string
    code: string
    name: string
    channel: string | null
    revenue: number
    orders: number
}

interface Props {
    topCustomers?: TopCustomerSimple[]
    initialCustomerId?: string
}

type TimeRangeKey = 'ALL' | 'THIS_YEAR' | 'LAST_6_MONTHS' | 'THIS_MONTH'

function formatFriendlyVND(amount: number | null | undefined): string {
    if (!amount || amount === 0) return '0 đ'
    const abs = Math.abs(amount)
    const sign = amount < 0 ? '−' : ''
    if (abs >= 1_000_000_000) {
        const billions = abs / 1_000_000_000
        return `${sign}${billions >= 10 ? billions.toFixed(1) : billions.toFixed(2).replace('.', ',')} Tỷ`
    } else if (abs >= 1_000_000) {
        const millions = abs / 1_000_000
        return `${sign}${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1).replace('.', ',')} Tr`
    }
    return `${sign}${abs.toLocaleString('vi-VN')} đ`
}

const STATUS_BADGES: Record<string, { labelVi: string; labelEn: string; bg: string; color: string; border: string }> = {
    CONFIRMED: { labelVi: 'Đã xác nhận', labelEn: 'Confirmed', bg: 'rgba(8,145,178,0.08)', color: '#0891B2', border: 'rgba(8,145,178,0.2)' },
    PARTIALLY_DELIVERED: { labelVi: 'Giao một phần', labelEn: 'Partially Delivered', bg: 'rgba(180,83,9,0.1)', color: '#B45309', border: 'rgba(180,83,9,0.25)' },
    DELIVERED: { labelVi: 'Đã giao hàng', labelEn: 'Delivered', bg: 'rgba(21,128,61,0.12)', color: '#16A34A', border: 'rgba(21,128,61,0.25)' },
    INVOICED: { labelVi: 'Đã xuất HĐ', labelEn: 'Invoiced', bg: 'rgba(2,132,199,0.1)', color: '#0284C7', border: 'rgba(2,132,199,0.25)' },
    PAID: { labelVi: 'Đã thanh toán', labelEn: 'Paid', bg: 'rgba(22,163,74,0.12)', color: '#15803D', border: 'rgba(22,163,74,0.25)' },
    PENDING_APPROVAL: { labelVi: 'Chờ duyệt', labelEn: 'Pending Approval', bg: 'rgba(180,83,9,0.12)', color: '#B45309', border: 'rgba(180,83,9,0.25)' },
    PENDING_ACCOUNTING: { labelVi: 'Chờ kế toán', labelEn: 'Pending Accounting', bg: 'rgba(180,83,9,0.1)', color: '#D97706', border: 'rgba(180,83,9,0.2)' },
    DRAFT: { labelVi: 'Bản nháp', labelEn: 'Draft', bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
    CANCELLED: { labelVi: 'Đã hủy', labelEn: 'Cancelled', bg: 'rgba(185,28,28,0.1)', color: '#B91C1C', border: 'rgba(185,28,28,0.2)' },
}

const DELIVERY_BADGES: Record<string, { labelVi: string; labelEn: string; bg: string; color: string }> = {
    DELIVERED: { labelVi: 'Giao đủ', labelEn: 'Fully Delivered', bg: 'rgba(22,163,74,0.1)', color: '#16A34A' },
    PARTIALLY_DELIVERED: { labelVi: 'Giao 1 phần', labelEn: 'Partially Delivered', bg: 'rgba(180,83,9,0.1)', color: '#B45309' },
    PREPARING: { labelVi: 'Đang chuẩn bị', labelEn: 'Preparing', bg: 'rgba(8,145,178,0.08)', color: '#0891B2' },
    UNDELIVERED: { labelVi: 'Chưa giao', labelEn: 'Not Dispatched', bg: '#F1F5F9', color: '#64748B' },
}

const BASE_PRICE_LABELS: Record<string, { vi: string; en: string }> = {
    BY_CHANNEL: { vi: 'Giá theo kênh bán hàng', en: 'Channel-based pricing' },
    WHOLESALE: { vi: 'Bảng giá bán buôn', en: 'Standard Wholesale Price' },
    RETAIL: { vi: 'Giá bán lẻ niêm yết', en: 'Retail List Price' },
    HORECA: { vi: 'Bảng giá HORECA', en: 'HORECA Price List' },
}

export function CustomerAnalyticsDashboard({ topCustomers = [], initialCustomerId }: Props) {
    const { locale, isEn } = useAppLocale()
    const t = getDashboardDictionary(locale)

    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId ?? null)
    const [timeRange, setTimeRange] = useState<TimeRangeKey>('ALL')
    const [activeTab, setActiveTab] = useState<'ORDERS' | 'WINES' | 'TREND'>('ORDERS')
    const [expandedSoId, setExpandedSoId] = useState<string | null>(null)
    const [orderFilter, setOrderFilter] = useState<'ALL' | 'COMMERCIAL' | 'TASTING' | 'UNPAID' | 'DELIVERED'>('ALL')
    const [wineSearch, setWineSearch] = useState<string>('')

    const timeRangeOptions: { key: TimeRangeKey; label: string }[] = [
        { key: 'ALL', label: isEn ? 'All time' : 'Toàn bộ thời gian' },
        { key: 'THIS_YEAR', label: isEn ? 'This year (2026)' : 'Năm nay (2026)' },
        { key: 'LAST_6_MONTHS', label: isEn ? 'Last 6 months' : '6 tháng qua' },
        { key: 'THIS_MONTH', label: isEn ? 'This month' : 'Tháng này' },
    ]

    // Search state
    const [searchQuery, setSearchQuery] = useState('')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [searchResults, setSearchResults] = useState<DashboardCustomerSearchItem[]>([])
    const [isSearching, startSearch] = useTransition()

    // History data state
    const [historyData, setHistoryData] = useState<CustomerPurchaseHistoryResult | null>(null)
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)

    const searchRef = useRef<HTMLDivElement>(null)

    const handleSearchChange = (val: string) => {
        setSearchQuery(val)
        setIsDropdownOpen(true)
        startSearch(async () => {
            const results = await searchCustomersForDashboard(val)
            setSearchResults(results)
        })
    }

    const handleSelectCustomer = (id: string, name?: string) => {
        setSelectedCustomerId(id)
        setIsDropdownOpen(false)
        if (name) setSearchQuery(name)
        setExpandedSoId(null)
    }

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Load initial customer if topCustomers is available and nothing selected yet
    useEffect(() => {
        if (!selectedCustomerId && topCustomers.length > 0 && topCustomers[0].id) {
            handleSelectCustomer(topCustomers[0].id, topCustomers[0].name)
        }
    }, [topCustomers])

    // Fetch history when selected customer or timeRange changes
    useEffect(() => {
        if (!selectedCustomerId) return
        let isCancelled = false
        setIsLoadingHistory(true)
        getCustomerPurchaseHistory(selectedCustomerId, timeRange)
            .then(res => {
                if (!isCancelled) {
                    setHistoryData(res)
                    setIsLoadingHistory(false)
                }
            })
            .catch(err => {
                console.error('Failed to load customer analytics:', err)
                if (!isCancelled) setIsLoadingHistory(false)
            })
        return () => {
            isCancelled = true
        }
    }, [selectedCustomerId, timeRange])

    // Filter orders
    const filteredOrders = (historyData?.orders ?? []).filter(o => {
        if (orderFilter === 'ALL') return true
        if (orderFilter === 'COMMERCIAL') return o.orderType === 'STANDARD' || !o.orderType
        if (orderFilter === 'TASTING') return o.orderType === 'TASTING' || o.orderType === 'SAMPLE'
        if (orderFilter === 'UNPAID') return o.unpaidAmount > 0
        if (orderFilter === 'DELIVERED') return o.deliveryStatus === 'DELIVERED' || o.status === 'DELIVERED'
        return true
    })

    // Filter wines
    const filteredWines = (historyData?.topProducts ?? []).filter(p => {
        if (!wineSearch.trim()) return true
        const q = wineSearch.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.skuCode.toLowerCase().includes(q) || (p.originCountry ?? '').toLowerCase().includes(q)
    })

    return (
        <div className="space-y-4 max-w-7xl mx-auto">

            {/* ═══ TOP CONTROL BAR: SEARCH, TIME SELECTOR & QUICK PICKS (FLAT & INTEGRATED) ═══ */}
            <div className="space-y-2.5 pb-3 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    {/* Search Combobox - Clean & Minimal */}
                    <div className="relative flex-1 max-w-xl" ref={searchRef}>
                        <div className="relative flex items-center">
                            <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder={t.customer360.searchPlaceholder}
                                value={searchQuery}
                                onFocus={() => {
                                    setIsDropdownOpen(true)
                                    if (searchResults.length === 0) {
                                        startSearch(async () => {
                                            const res = await searchCustomersForDashboard(searchQuery)
                                            setSearchResults(res)
                                        })
                                    }
                                }}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="w-full text-xs pl-9 pr-8 py-2 rounded-md transition-colors bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => { setSearchQuery(''); handleSearchChange('') }}
                                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-1"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Autocomplete Dropdown */}
                        {isDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-md shadow-lg border border-slate-200 max-h-80 overflow-y-auto divide-y divide-slate-100">
                                {isSearching ? (
                                    <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                                        <RefreshCw size={12} className="animate-spin text-slate-600" /> {isEn ? 'Searching...' : 'Đang tìm...'}
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="py-4 text-center text-xs text-slate-500">
                                        {isEn ? 'No customer found' : 'Không tìm thấy khách hàng'}
                                    </div>
                                ) : (
                                    searchResults.map(c => {
                                        const isSelected = c.id === selectedCustomerId
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => handleSelectCustomer(c.id, c.name)}
                                                className={`w-full text-left p-2.5 flex items-center justify-between gap-3 text-xs transition-colors hover:bg-slate-50 ${isSelected ? 'bg-slate-50 font-bold' : ''}`}
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="inline-block font-mono text-[10px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 whitespace-nowrap shrink-0">
                                                            {c.code}
                                                        </span>
                                                        <span className="font-semibold text-slate-900 truncate">{c.name}</span>
                                                        {c.channel && (
                                                            <span className="inline-block text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600 whitespace-nowrap shrink-0">
                                                                {c.channel}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                        {c.salesRepName && <span>{isEn ? 'Sales Rep:' : 'Sale:'} {c.salesRepName}</span>}
                                                        {c.parentName && <span>&bull; {c.parentName}</span>}
                                                    </div>
                                                </div>
                                                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex-shrink-0 whitespace-nowrap font-mono">
                                                    {c.orderCount} {isEn ? 'orders' : 'đơn'}
                                                </span>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* Time Range Selector */}
                    <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md self-start sm:self-auto overflow-x-auto max-w-full">
                        {timeRangeOptions.map(opt => (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => setTimeRange(opt.key)}
                                className={`text-xs px-2.5 py-1 rounded transition-all whitespace-nowrap ${
                                    timeRange === opt.key
                                        ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Quick picks from Top Customers */}
                {topCustomers.length > 0 && (
                    <div className="flex items-center gap-2 text-xs overflow-x-auto no-scrollbar pt-1">
                        <span className="text-[11px] font-medium text-slate-400 flex-shrink-0">
                            {t.customer360.quickPickTitle}:
                        </span>
                        <div className="flex items-center gap-1.5 flex-nowrap">
                            {topCustomers.map((tc, idx) => {
                                const isSelected = tc.id === selectedCustomerId
                                return (
                                    <button
                                        key={tc.id || idx}
                                        type="button"
                                        onClick={() => handleSelectCustomer(tc.id, tc.name)}
                                        className={`px-2 py-0.5 rounded text-xs transition-all flex items-center gap-1 flex-shrink-0 border ${
                                            isSelected
                                                ? 'bg-slate-900 text-white font-semibold border-slate-900'
                                                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                                        }`}
                                    >
                                        <span className={`text-[10px] font-mono ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>#{idx + 1}</span>
                                        <span className="truncate max-w-[130px]">{tc.name}</span>
                                        <span className={`text-[10px] font-mono ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                            ({formatFriendlyVND(tc.revenue)})
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ LOADING STATE ═══ */}
            {isLoadingHistory && (
                <div className="py-20 text-center">
                    <RefreshCw size={24} className="animate-spin text-slate-400 mx-auto mb-2.5" />
                    <p className="text-xs font-semibold text-slate-700">Đang tải dữ liệu khách hàng...</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Nạp lịch sử đơn hàng, công nợ và chính sách giá riêng</p>
                </div>
            )}

            {/* ═══ MAIN DASHBOARD CONTENT (ZERO CARD-IN-CARD) ═══ */}
            {!isLoadingHistory && historyData && (
                <div className="space-y-4">

                    {/* ═══ 1. CUSTOMER DOSSIER HEADER (CLEAN & INTEGRATED) ═══ */}
                    <div className="space-y-1.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                                    {historyData.customer.code}
                                </span>
                                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                    {historyData.customer.name}
                                </h3>
                                {historyData.customer.channel && (
                                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                                        {historyData.customer.channel}
                                    </span>
                                )}
                                {historyData.customer.entityType === 'COMPANY' && (
                                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                                        {isEn ? `Group (${historyData.customer.childrenCount} branches)` : `Công ty Mẹ (${historyData.customer.childrenCount} chi nhánh)`}
                                    </span>
                                )}
                            </div>

                            {/* Inline Rhythm Indicator - Eliminates the separate yellow card */}
                            <div className="flex items-center gap-2 text-xs self-start sm:self-auto">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                    historyData.health.status === 'AT_RISK'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : historyData.health.status === 'WARNING'
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                        historyData.health.status === 'AT_RISK'
                                            ? 'bg-rose-600'
                                            : historyData.health.status === 'WARNING'
                                            ? 'bg-amber-600'
                                            : 'bg-emerald-600'
                                    }`} />
                                    <span>
                                        {historyData.health.status === 'AT_RISK'
                                            ? (isEn ? `Overdue by ${historyData.health.delayDays}d` : `Quá chu kỳ ${historyData.health.delayDays} ngày`)
                                            : historyData.health.status === 'WARNING'
                                            ? (isEn ? `Slow by ${historyData.health.delayDays}d` : `Chậm ${historyData.health.delayDays} ngày`)
                                            : (isEn ? 'Regular cadence' : 'Đặt đều đặn')}
                                    </span>
                                    <span className="text-slate-300 font-normal">|</span>
                                    <span className="text-slate-600 font-mono text-[11px]">
                                        {historyData.health.daysSinceLastOrder !== null
                                            ? (isEn ? `${historyData.health.daysSinceLastOrder}d ago` : `Đơn gần nhất cách đây ${historyData.health.daysSinceLastOrder} ngày`)
                                            : (isEn ? 'No orders' : 'Chưa có đơn')}
                                        {historyData.health.averageOrderCycleDays ? ` (~${historyData.health.averageOrderCycleDays} ngày/đơn)` : ''}
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Inline Metadata (Omits empty fields) */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>
                                <strong className="text-slate-700 font-medium">{isEn ? 'Sales Rep:' : 'Sale phụ trách:'}</strong>{' '}
                                <span className={historyData.customer.salesRepName ? 'text-slate-800 font-semibold' : 'text-slate-400'}>
                                    {historyData.customer.salesRepName || (isEn ? 'Unassigned' : 'Chưa phân bổ')}
                                </span>
                            </span>
                            {historyData.customer.parentName && (
                                <>
                                    <span>&bull;</span>
                                    <span>
                                        <strong className="text-slate-700 font-medium">{isEn ? 'Parent:' : 'Công ty mẹ:'}</strong>{' '}
                                        <span className="text-slate-800">{historyData.customer.parentName}</span>
                                    </span>
                                </>
                            )}
                            {historyData.customer.purchasingName && (
                                <>
                                    <span>&bull;</span>
                                    <span>
                                        <strong className="text-slate-700 font-medium">{isEn ? 'Purchasing:' : 'Thu mua:'}</strong>{' '}
                                        <span className="text-slate-800">{historyData.customer.purchasingName}</span>
                                        {historyData.customer.purchasingPhone && (
                                            <span className="text-slate-400 font-mono text-[11px] ml-1">({historyData.customer.purchasingPhone})</span>
                                        )}
                                    </span>
                                </>
                            )}
                            {historyData.customer.receiverName && (
                                <>
                                    <span>&bull;</span>
                                    <span>
                                        <strong className="text-slate-700 font-medium">{isEn ? 'Site Contact:' : 'Nhận hàng:'}</strong>{' '}
                                        <span className="text-slate-800">{historyData.customer.receiverName}</span>
                                        {historyData.customer.receiverPhone && (
                                            <span className="text-slate-400 font-mono text-[11px] ml-1">({historyData.customer.receiverPhone})</span>
                                        )}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ═══ 2. PRIORITY METRIC STRIP: FINANCIAL & ORDER KPI (BROUGHT TO TOP) ═══ */}
                    <div className="bg-white rounded-lg border border-slate-200 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 grid grid-cols-2 lg:grid-cols-4 shadow-2xs">
                        {/* 1. Tổng tiền đã mua */}
                        <div className="p-3.5 sm:p-4">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                                {isEn ? 'LIFETIME PURCHASES' : 'Tổng Tiền Đã Mua'}
                            </span>
                            <p className="text-lg sm:text-xl font-bold font-mono text-slate-900 tracking-tight">
                                {formatFriendlyVND(historyData.kpis.totalRevenue)}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                {formatVND(historyData.kpis.totalRevenue)}
                            </p>
                        </div>

                        {/* 2. Đã thu vs Còn nợ AR */}
                        <div className="p-3.5 sm:p-4">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                                {isEn ? 'PAID / OUTSTANDING' : 'Đã Thu / Còn Nợ'}
                            </span>
                            <p className="text-lg sm:text-xl font-bold font-mono text-emerald-700 tracking-tight">
                                {formatFriendlyVND(historyData.kpis.totalPaidAmount)}
                            </p>
                            <p className="text-[11px] mt-0.5 font-medium text-slate-600">
                                {isEn ? 'Debt: ' : 'Nợ: '}<strong className="text-slate-900 font-mono">{formatFriendlyVND(historyData.kpis.totalArDebt)}</strong>
                                {historyData.kpis.overdueArDebt > 0 && (
                                    <span className="text-rose-600 font-bold ml-1 font-mono">
                                        ({formatFriendlyVND(historyData.kpis.overdueArDebt)} {isEn ? 'overdue' : 'quá hạn'})
                                    </span>
                                )}
                            </p>
                        </div>

                        {/* 3. Sản lượng & Đơn thương mại vs Tasting */}
                        <div className="p-3.5 sm:p-4">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                                {isEn ? 'BOTTLES DELIVERED' : 'Tổng Chai Đã Giao'}
                            </span>
                            <p className="text-lg sm:text-xl font-bold font-mono text-slate-900 tracking-tight">
                                {historyData.kpis.totalBottles.toLocaleString(isEn ? 'en-US' : 'vi-VN')} <span className="text-xs font-normal text-slate-500 font-sans">{isEn ? 'btls' : 'chai'}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                <strong>{historyData.orderBreakdown.commercialCount}</strong> {isEn ? 'sales' : 'đơn bán'} ({historyData.orderBreakdown.commercialBottles} {isEn ? 'btls' : 'chai'}) &bull; <strong>{historyData.orderBreakdown.tastingCount}</strong> tasting
                            </p>
                        </div>

                        {/* 4. Điều khoản & Hạn mức */}
                        <div className="p-3.5 sm:p-4">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                                {isEn ? 'CREDIT LIMIT & TERMS' : 'Hạn Mức & Điều Khoản'}
                            </span>
                            <p className="text-base sm:text-lg font-bold text-slate-900 truncate">
                                {historyData.customer.paymentTerm}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                {isEn ? 'Limit: ' : 'Hạn mức: '}<strong className="text-slate-800 font-mono">{formatFriendlyVND(historyData.customer.creditLimit)}</strong>
                            </p>
                        </div>
                    </div>

                    {/* ═══ 3. CHÍNH SÁCH GIÁ & BẢNG GIÁ RIÊNG (FLAT & MINIMAL) ═══ */}
                    <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                            <div>
                                <h4 className="font-bold text-sm text-slate-900">
                                    {isEn ? 'Pricing Policy & Custom Price Lists' : 'Chính Sách Giá & Bảng Giá Riêng'}
                                </h4>
                                <p className="text-xs text-slate-400">
                                    {isEn ? 'Discount terms and wine SKUs with approved custom rates' : 'Chính sách chiết khấu và danh mục mã rượu có giá thỏa thuận riêng'}
                                </p>
                            </div>

                            {/* Base Pricing Badges */}
                            <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                    {BASE_PRICE_LABELS[historyData.pricing.basePriceType]?.[isEn ? 'en' : 'vi'] ?? historyData.pricing.basePriceType}
                                </span>
                                {historyData.pricing.defaultDiscountPct > 0 && (
                                    <span className="font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                        {isEn ? `Default: -${historyData.pricing.defaultDiscountPct}%` : `Chiết khấu mặc định: -${historyData.pricing.defaultDiscountPct}%`}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Approved Price Proposals (Flat compact layout) */}
                        {historyData.pricing.proposals.length > 0 && (
                            <div className="border border-slate-200 rounded-md p-3 bg-slate-50/50 space-y-2">
                                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                                    <FileText size={12} className="text-slate-500" />
                                    <span>{isEn ? `Approved Proposals (${historyData.pricing.proposals.length}):` : `Tờ trình duyệt giá riêng (${historyData.pricing.proposals.length}):`}</span>
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {historyData.pricing.proposals.map(p => (
                                        <div key={p.id} className="bg-white p-2.5 rounded border border-slate-200 text-xs flex items-center justify-between gap-2 shadow-2xs">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                                    <span className="font-mono text-slate-700">{p.proposalNo}</span>
                                                    <span className="truncate">{p.title}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                                    {p.startDate ? `${new Date(p.startDate).toLocaleDateString(isEn ? 'en-US' : 'vi-VN')} – ` : ''}
                                                    {p.endDate ? new Date(p.endDate).toLocaleDateString(isEn ? 'en-US' : 'vi-VN') : (isEn ? 'Indefinite' : 'Vô thời hạn')}
                                                </div>
                                            </div>
                                            <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0 whitespace-nowrap">
                                                {isEn ? 'Approved' : 'Đã duyệt'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Special Price Rules by SKU Table */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-700">
                                    {isEn ? `Custom price rules by SKU (${historyData.pricing.specialRules.length} SKUs):` : `Bảng giá riêng theo từng mã hàng (${historyData.pricing.specialRules.length} SKU):`}
                                </span>
                                {historyData.pricing.specialRules.some(r => r.isExpiringSoon || r.isExpired) && (
                                    <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                                        <AlertTriangle size={12} /> {isEn ? 'Expiring or expired rates exist' : 'Có mã sắp hoặc đã hết hạn'}
                                    </span>
                                )}
                            </div>

                            {historyData.pricing.specialRules.length === 0 ? (
                                <div className="py-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded border border-dashed border-slate-200">
                                    {isEn ? 'Customer is on standard wholesale pricing. No SKU-specific custom price rules assigned.' : 'Khách hàng đang áp dụng theo bảng giá chung, chưa có giá thỏa thuận riêng cho từng mã.'}
                                </div>
                            ) : (
                                <div className="border border-slate-200 rounded-md overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-semibold tracking-wider border-b border-slate-200">
                                                <tr>
                                                    <th className="py-2 px-3">{isEn ? 'SKU Code & Wine Name' : 'Mã SKU & Tên Rượu'}</th>
                                                    <th className="py-2 px-3">{isEn ? 'Origin' : 'Xuất Xứ'}</th>
                                                    <th className="py-2 px-3 text-right">{isEn ? 'List Price' : 'Giá Niêm Yết'}</th>
                                                    <th className="py-2 px-3 text-right">{isEn ? 'Special Price' : 'Giá Riêng Áp Dụng'}</th>
                                                    <th className="py-2 px-3 text-right">{isEn ? 'Discount' : 'Mức Giảm'}</th>
                                                    <th className="py-2 px-3 text-center">{isEn ? 'Validity Period' : 'Thời Hạn Áp Dụng'}</th>
                                                    <th className="py-2 px-3 text-center">{isEn ? 'Status' : 'Trạng Thái'}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {historyData.pricing.specialRules.map(rule => (
                                                    <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="py-2.5 px-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="inline-block font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap shrink-0">
                                                                    {rule.skuCode}
                                                                </span>
                                                                <span className="font-bold text-slate-900">{rule.productName}</span>
                                                                {rule.wineType && (
                                                                    <span className="inline-block text-[10px] px-1 py-0.2 rounded font-medium bg-slate-100 text-slate-700 whitespace-nowrap shrink-0">
                                                                        {rule.wineType}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {rule.notes && (
                                                                <p className="text-[10px] text-slate-400 mt-0.5 italic">{rule.notes}</p>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-slate-600">{rule.country || '—'}</td>
                                                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                                            {rule.wholesalePrice ? formatVND(rule.wholesalePrice) : rule.retailPrice ? formatVND(rule.retailPrice) : '—'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900 text-sm">
                                                            {formatVND(rule.specialPrice)}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                                                            {rule.discountPct > 0 ? (
                                                                <span>-{rule.discountPct}% <span className="text-[10px] font-normal text-slate-500 font-mono">({formatVND(rule.discountAmount)})</span></span>
                                                            ) : (isEn ? 'Fixed rate' : 'Giá ấn định')}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center text-slate-600 whitespace-nowrap text-[11px] font-mono">
                                                            {new Date(rule.startDate).toLocaleDateString(isEn ? 'en-US' : 'vi-VN')}
                                                            {rule.endDate ? ` → ${new Date(rule.endDate).toLocaleDateString(isEn ? 'en-US' : 'vi-VN')}` : ` (${isEn ? 'Indefinite' : 'Vô thời hạn'})`}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                            {rule.isExpired ? (
                                                                <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap shrink-0">
                                                                    {isEn ? 'Expired' : 'Đã hết hạn'}
                                                                </span>
                                                            ) : rule.isExpiringSoon ? (
                                                                <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
                                                                    {isEn ? 'Expiring Soon' : 'Sắp hết hạn'}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0">
                                                                    {isEn ? 'Active' : 'Đang áp dụng'}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ═══ 4. TABS: ORDERS / WINES / TRENDS (SLEEK UNDERLINE TABS) ═══ */}
                    <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
                        
                        {/* Tab Switcher - Sleek Underline Tabs */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200">
                            <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('ORDERS')}
                                    className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
                                        activeTab === 'ORDERS'
                                            ? 'border-slate-900 text-slate-900 font-bold'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <FileText size={14} />
                                    <span>{isEn ? `Order History (${historyData.orders.length})` : `Lịch Sử Đơn Hàng (${historyData.orders.length})`}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('WINES')}
                                    className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
                                        activeTab === 'WINES'
                                            ? 'border-slate-900 text-slate-900 font-bold'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <Wine size={14} />
                                    <span>{isEn ? `Purchased Wines (${historyData.topProducts.length})` : `Danh Mục Rượu Đã Mua (${historyData.topProducts.length})`}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('TREND')}
                                    className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
                                        activeTab === 'TREND'
                                            ? 'border-slate-900 text-slate-900 font-bold'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <TrendingUp size={14} />
                                    <span>{isEn ? `Monthly Purchases (${historyData.monthlyTrend.length} mo)` : `Lịch Sử Nhập Theo Tháng (${historyData.monthlyTrend.length} tháng)`}</span>
                                </button>
                            </div>

                            <Link
                                href={`/dashboard/sales?search=${encodeURIComponent(historyData.customer.code)}`}
                                className="text-xs font-semibold text-slate-600 hover:text-slate-900 pb-2.5 flex items-center gap-1 hover:underline self-end sm:self-auto"
                            >
                                {isEn ? 'View in Sales Orders' : 'Xem tại danh sách Bán hàng'} <ExternalLink size={12} />
                            </Link>
                        </div>

                        {/* ═══ TAB 1: ORDERS LIST ═══ */}
                        {activeTab === 'ORDERS' && (
                            <div className="mt-4 space-y-3">
                                
                                {/* Order Sub-filters */}
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-semibold text-slate-500">{isEn ? 'Filter by:' : 'Lọc theo:'}</span>
                                        {[
                                            { key: 'ALL', label: isEn ? 'All orders' : 'Tất cả đơn', icon: null },
                                            { key: 'COMMERCIAL', label: isEn ? 'Sales orders' : 'Đơn bán hàng', icon: ShoppingCart },
                                            { key: 'TASTING', label: isEn ? 'Tasting / Samples' : 'Hàng mẫu / Tasting', icon: Wine },
                                            { key: 'UNPAID', label: isEn ? 'Outstanding debt' : 'Đơn còn nợ', icon: CreditCard },
                                            { key: 'DELIVERED', label: isEn ? 'Delivered' : 'Đã giao hàng', icon: Package },
                                        ].map(f => {
                                            const FilterIcon = f.icon
                                            return (
                                                <button
                                                    key={f.key}
                                                    type="button"
                                                    onClick={() => setOrderFilter(f.key as any)}
                                                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                                                        orderFilter === f.key
                                                            ? 'bg-cyan-700 text-white font-bold'
                                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {FilterIcon && <FilterIcon size={12} />}
                                                    <span>{f.label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <span className="text-[11px] text-slate-500">
                                        {isEn ? `Showing ${filteredOrders.length} / ${historyData.orders.length} orders` : `Hiển thị ${filteredOrders.length} / ${historyData.orders.length} đơn`}
                                    </span>
                                </div>

                                {filteredOrders.length === 0 ? (
                                    <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-md">
                                        {isEn ? 'No orders match the selected filter' : 'Không có đơn hàng nào khớp với bộ lọc'}
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-md overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[900px] text-xs text-left">
                                                <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-semibold tracking-wider border-b border-slate-200">
                                                    <tr>
                                                        <th className="py-2.5 px-3">{isEn ? 'SO No.' : 'Mã SO'}</th>
                                                        <th className="py-2.5 px-3">{isEn ? 'Order Date' : 'Ngày Đặt'}</th>
                                                        <th className="py-2.5 px-3">{isEn ? 'Order Type' : 'Loại Đơn'}</th>
                                                        <th className="py-2.5 px-3">{isEn ? 'Destination & Contact' : 'Điểm Giao & Người Nhận'}</th>
                                                        <th className="py-2.5 px-3 text-right">{isEn ? 'Bottles' : 'Số Chai'}</th>
                                                        <th className="py-2.5 px-3 text-right">{isEn ? 'Total Amount' : 'Tổng Tiền'}</th>
                                                        <th className="py-2.5 px-3 text-right">{isEn ? 'Paid / Balance' : 'Đã Thu / Còn Nợ'}</th>
                                                        <th className="py-2.5 px-3 text-center">{isEn ? 'Order Status' : 'Trạng Thái Đơn'}</th>
                                                        <th className="py-2.5 px-3 text-center">{isEn ? 'Delivery' : 'Giao Hàng'}</th>
                                                        <th className="py-2.5 px-3 text-center">{isEn ? 'Invoice' : 'Hóa Đơn'}</th>
                                                        <th className="py-2.5 px-3 text-center">{isEn ? 'Details' : 'Chi Tiết'}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {filteredOrders.map(order => {
                                                        const isExpanded = expandedSoId === order.id
                                                        const statusCfg = STATUS_BADGES[order.status] ?? STATUS_BADGES.DRAFT
                                                        const delivCfg = DELIVERY_BADGES[order.deliveryStatus] ?? DELIVERY_BADGES.UNDELIVERED
                                                        const isTasting = order.orderType === 'TASTING' || order.orderType === 'SAMPLE'

                                                        return (
                                                            <>
                                                                <tr key={order.id} className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-cyan-50/20' : ''}`}>
                                                                    <td className="py-2.5 px-3 font-mono font-bold text-cyan-800">
                                                                        <Link href={`/dashboard/sales?search=${encodeURIComponent(order.soNo)}`} className="hover:underline">
                                                                            {order.soNo}
                                                                        </Link>
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                                                        {new Date(order.createdAt).toLocaleDateString(isEn ? 'en-US' : 'vi-VN')}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                                                        {isTasting ? (
                                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
                                                                                <Wine size={11} className="text-amber-700" />
                                                                                <span>{order.orderType === 'TASTING' ? 'Tasting' : 'Sample'}</span>
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap shrink-0">
                                                                                {isEn ? 'Commercial' : 'Đơn bán'}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-slate-700 max-w-[180px]">
                                                                        <p className="truncate font-medium">{order.shippingAddress || order.branchName || (isEn ? 'Central Warehouse' : 'Kho trung tâm')}</p>
                                                                        {order.receiverName && (
                                                                            <p className="text-[10px] text-slate-400 truncate">
                                                                                {isEn ? 'Recipient: ' : 'Người nhận: '}{order.receiverName} {order.receiverPhone ? `(${order.receiverPhone})` : ''}
                                                                            </p>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right font-medium text-slate-900 whitespace-nowrap">
                                                                        {order.totalBottles} {isEn ? 'btls' : 'chai'} <span className="text-[10px] text-slate-400">({order.lineCount} {isEn ? 'lines' : 'dòng'})</span>
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                                                        {formatVND(order.totalAmount)}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                                        <span className="text-emerald-700 font-mono font-semibold block">{formatVND(order.paidAmount)}</span>
                                                                        {order.unpaidAmount > 0 && (
                                                                            <span className="text-rose-600 font-mono text-[10px]">
                                                                                {isEn ? 'Balance: ' : 'Còn: '}{formatVND(order.unpaidAmount)}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block whitespace-nowrap shrink-0"
                                                                            style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>
                                                                            {isEn ? statusCfg.labelEn : statusCfg.labelVi}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded inline-block whitespace-nowrap shrink-0"
                                                                            style={{ background: delivCfg.bg, color: delivCfg.color }}>
                                                                            {isEn ? delivCfg.labelEn : delivCfg.labelVi}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                        {order.arInvoices.length > 0 ? (
                                                                            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0">
                                                                                {order.arInvoices[0].invoiceNo || (isEn ? 'Has Inv' : 'Có HĐ')}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[10px] text-slate-400">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setExpandedSoId(isExpanded ? null : order.id)}
                                                                            className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
                                                                            title={isExpanded ? (isEn ? 'Collapse' : 'Thu gọn') : (isEn ? 'View products' : 'Xem chi tiết sản phẩm')}
                                                                        >
                                                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                        </button>
                                                                    </td>
                                                                </tr>

                                                                {/* Expandable row for line items */}
                                                                {isExpanded && (
                                                                    <tr key={`${order.id}-detail`} className="bg-slate-50/70 border-t border-slate-100">
                                                                        <td colSpan={11} className="p-3">
                                                                            <div className="bg-white rounded border border-slate-200 p-3 shadow-2xs">
                                                                                <div className="flex items-center justify-between mb-2">
                                                                                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                                                                        <Wine size={13} className="text-cyan-700" />
                                                                                        {isEn ? `Order items (${order.lines.length} products) in SO ${order.soNo}:` : `Danh sách ${order.lines.length} sản phẩm trong đơn ${order.soNo}:`}
                                                                                    </span>
                                                                                    {order.deliveryNotes && (
                                                                                        <span className="inline-block text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 whitespace-nowrap shrink-0">
                                                                                            {isEn ? 'Delivery note: ' : 'Ghi chú giao hàng: '}{order.deliveryNotes}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="overflow-x-auto">
                                                                                    <table className="w-full text-xs">
                                                                                        <thead className="bg-slate-50 text-[10px] text-slate-500 font-semibold border-b border-slate-200">
                                                                                            <tr>
                                                                                                <th className="py-1.5 px-2 text-left">{isEn ? 'SKU Code' : 'Mã SKU'}</th>
                                                                                                <th className="py-1.5 px-2 text-left">{isEn ? 'Wine Name' : 'Tên Rượu'}</th>
                                                                                                <th className="py-1.5 px-2 text-center">{isEn ? 'Wine Type' : 'Loại Vang'}</th>
                                                                                                <th className="py-1.5 px-2 text-right">{isEn ? 'Quantity' : 'Số Lượng'}</th>
                                                                                                <th className="py-1.5 px-2 text-right">{isEn ? 'Unit Price' : 'Đơn Giá'}</th>
                                                                                                <th className="py-1.5 px-2 text-right">{isEn ? 'Discount' : 'Chiết Khấu'}</th>
                                                                                                <th className="py-1.5 px-2 text-right">{isEn ? 'Line Total' : 'Thành Tiền'}</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                                                                            {order.lines.map(l => (
                                                                                                <tr key={l.id}>
                                                                                                    <td className="py-1.5 px-2 font-mono text-[10px] text-slate-500">{l.skuCode}</td>
                                                                                                    <td className="py-1.5 px-2 font-bold text-slate-900">{l.productName}</td>
                                                                                                    <td className="py-1.5 px-2 text-center text-slate-600">{l.wineType || '—'}</td>
                                                                                                    <td className="py-1.5 px-2 text-right font-semibold">{l.qtyOrdered} {isEn ? 'btls' : 'chai'}</td>
                                                                                                    <td className="py-1.5 px-2 text-right font-mono">{formatVND(l.unitPrice)}</td>
                                                                                                    <td className="py-1.5 px-2 text-right text-slate-500">
                                                                                                        {l.lineDiscountPct > 0 ? `${l.lineDiscountPct}%` : '—'}
                                                                                                    </td>
                                                                                                    <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">{formatVND(l.lineTotal)}</td>
                                                                                                </tr>
                                                                                            ))}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══ TAB 2: WINE PROFILE & PURCHASED PRODUCTS ═══ */}
                        {activeTab === 'WINES' && (
                            <div className="mt-4 space-y-4">
                                
                                {/* Cơ Cấu Loại Rượu & Tầm Giá */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Loại Vang */}
                                    <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200">
                                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <Wine size={13} className="text-cyan-700" />
                                            <span>{isEn ? 'Breakdown by wine type:' : 'Cơ cấu theo loại vang:'}</span>
                                        </span>
                                        <div className="space-y-2">
                                            {historyData.preferences.wineTypes.map(wt => (
                                                <div key={wt.type} className="text-xs">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-semibold text-slate-800">{wt.label}</span>
                                                        <span className="text-slate-500 font-mono">
                                                            {wt.bottles} {isEn ? 'btls' : 'chai'} ({wt.pct}%) &bull; <strong>{formatFriendlyVND(wt.revenue)}</strong>
                                                        </span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                                                        <div className="h-full rounded-full bg-cyan-700" style={{ width: `${wt.pct}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Phân khúc giá */}
                                    <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200">
                                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <Tag size={13} className="text-amber-700" />
                                            <span>{isEn ? 'Breakdown by price bracket:' : 'Cơ cấu theo tầm giá:'}</span>
                                        </span>
                                        <div className="space-y-2">
                                            {historyData.preferences.priceBrackets.map(pb => (
                                                <div key={pb.label} className="text-xs">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-semibold text-slate-800">{pb.label}</span>
                                                        <span className="text-slate-500 font-mono">
                                                            {pb.bottles} {isEn ? 'btls' : 'chai'} ({pb.pct}%) &bull; <strong>{formatFriendlyVND(pb.revenue)}</strong>
                                                        </span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                                                        <div className="h-full rounded-full bg-amber-600" style={{ width: `${pb.pct}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Table of all products purchased */}
                                <div className="space-y-2 pt-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-slate-800">
                                            {isEn ? `Purchased wines catalogue (${historyData.topProducts.length} items):` : `Danh mục các dòng rượu đã từng mua (${historyData.topProducts.length} dòng):`}
                                        </span>
                                        <div className="relative w-full sm:w-64">
                                            <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder={isEn ? 'Search wine name, SKU, country...' : 'Tìm tên vang, mã SKU, xuất xứ...'}
                                                value={wineSearch}
                                                onChange={(e) => setWineSearch(e.target.value)}
                                                className="w-full text-xs pl-7 pr-3 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                            />
                                        </div>
                                    </div>

                                    {filteredWines.length === 0 ? (
                                        <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded">
                                            {isEn ? 'No matching wines found' : 'Không tìm thấy dòng rượu phù hợp'}
                                        </div>
                                    ) : (
                                        <div className="border border-slate-200 rounded-md overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-semibold tracking-wider border-b border-slate-200">
                                                        <tr>
                                                            <th className="py-2.5 px-3 text-center w-10">#</th>
                                                            <th className="py-2.5 px-3">{isEn ? 'SKU & Wine Name' : 'Mã SKU & Tên Rượu'}</th>
                                                            <th className="py-2.5 px-3">{isEn ? 'Origin' : 'Xuất Xứ'}</th>
                                                            <th className="py-2.5 px-3 text-right">{isEn ? 'Bottles Purchased' : 'Số Chai Đã Mua'}</th>
                                                            <th className="py-2.5 px-3 text-right">{isEn ? 'Last Unit Price' : 'Giá Mua Gần Nhất'}</th>
                                                            <th className="py-2.5 px-3 text-right">{isEn ? 'Total Spend' : 'Tổng Tiền'}</th>
                                                            <th className="py-2.5 px-3 text-center">{isEn ? 'Last Purchase Date' : 'Lần Mua Gần Nhất'}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {filteredWines.map((wine, idx) => (
                                                            <tr key={wine.productId} className="hover:bg-slate-50 transition-colors">
                                                                <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                                                                <td className="py-2.5 px-3">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="inline-block font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap shrink-0">
                                                                            {wine.skuCode}
                                                                        </span>
                                                                        <span className="font-bold text-slate-900">{wine.name}</span>
                                                                        {wine.wineType && (
                                                                            <span className="inline-block text-[10px] px-1.5 py-0.2 rounded font-medium bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
                                                                                {wine.wineType}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="py-2.5 px-3 text-slate-600">{wine.originCountry || '—'}</td>
                                                                <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                                                    {wine.totalQty.toLocaleString(isEn ? 'en-US' : 'vi-VN')} {isEn ? 'btls' : 'chai'}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                                                    {formatVND(wine.lastUnitPrice)}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-900">
                                                                    {formatVND(wine.totalSpend)}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center text-slate-500 whitespace-nowrap">
                                                                    {new Date(wine.lastPurchasedAt).toLocaleDateString(isEn ? 'en-US' : 'vi-VN')}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ═══ TAB 3: MONTHLY TREND ═══ */}
                        {activeTab === 'TREND' && (
                            <div className="mt-4 space-y-4">
                                <p className="text-xs text-slate-600">
                                    {isEn ? 'Monthly order volume and purchase value:' : 'Sản lượng và tiền hàng theo từng tháng:'}
                                </p>

                                {historyData.monthlyTrend.length === 0 ? (
                                    <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded">
                                        {isEn ? 'No monthly purchase data recorded' : 'Chưa có dữ liệu theo tháng'}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-md border border-slate-200 bg-slate-50/50 space-y-3">
                                        {(() => {
                                            const maxRev = Math.max(...historyData.monthlyTrend.map(m => m.revenue), 1)
                                            return (
                                                <div className="space-y-3">
                                                    {historyData.monthlyTrend.map(m => {
                                                        const pct = Math.max(4, (m.revenue / maxRev) * 100)
                                                        return (
                                                            <div key={m.month} className="space-y-1">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-bold text-slate-800 w-20">{m.label}</span>
                                                                    <div className="flex items-center gap-4">
                                                                        <span className="text-slate-500 text-[11px] font-mono">
                                                                            {m.orders} {isEn ? 'orders' : 'đơn'} &bull; {m.bottles} {isEn ? 'btls' : 'chai'}
                                                                        </span>
                                                                        <span className="font-bold font-mono text-cyan-900 text-xs w-32 text-right">
                                                                            {formatVND(m.revenue)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full transition-all duration-500 bg-cyan-700"
                                                                        style={{ width: `${pct}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
