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
    Check, ArrowRight, Percent, Info
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
    PARTIALLY_DELIVERED: { labelVi: 'Giao một phần', labelEn: 'Partially Delivered', bg: 'rgba(212,168,83,0.1)', color: '#B45309', border: 'rgba(212,168,83,0.25)' },
    DELIVERED: { labelVi: 'Đã giao hàng', labelEn: 'Delivered', bg: 'rgba(91,168,138,0.12)', color: '#16A34A', border: 'rgba(91,168,138,0.25)' },
    INVOICED: { labelVi: 'Đã xuất HĐ', labelEn: 'Invoiced', bg: 'rgba(2,132,199,0.1)', color: '#0284C7', border: 'rgba(2,132,199,0.25)' },
    PAID: { labelVi: 'Đã thanh toán', labelEn: 'Paid', bg: 'rgba(22,163,74,0.12)', color: '#15803D', border: 'rgba(22,163,74,0.25)' },
    PENDING_APPROVAL: { labelVi: 'Chờ duyệt', labelEn: 'Pending Approval', bg: 'rgba(212,168,83,0.12)', color: '#B45309', border: 'rgba(212,168,83,0.25)' },
    PENDING_ACCOUNTING: { labelVi: 'Chờ kế toán', labelEn: 'Pending Accounting', bg: 'rgba(212,168,83,0.1)', color: '#D97706', border: 'rgba(212,168,83,0.2)' },
    DRAFT: { labelVi: 'Bản nháp', labelEn: 'Draft', bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
    CANCELLED: { labelVi: 'Đã hủy', labelEn: 'Cancelled', bg: 'rgba(224,82,82,0.1)', color: '#E05252', border: 'rgba(224,82,82,0.2)' },
}

const DELIVERY_BADGES: Record<string, { labelVi: string; labelEn: string; bg: string; color: string }> = {
    DELIVERED: { labelVi: 'Giao đủ', labelEn: 'Fully Delivered', bg: 'rgba(22,163,74,0.1)', color: '#16A34A' },
    PARTIALLY_DELIVERED: { labelVi: 'Giao 1 phần', labelEn: 'Partially Delivered', bg: 'rgba(212,168,83,0.1)', color: '#B45309' },
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
        <div className="space-y-5 max-w-7xl mx-auto">

            {/* ═══ TOP CONTROL BAR: SEARCH & TIME SELECTOR ═══ */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    
                    {/* Search Combobox */}
                    <div className="relative flex-1 max-w-xl" ref={searchRef}>
                        <div className="relative flex items-center">
                            <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
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
                                className="w-full text-xs pl-9 pr-8 py-2.5 rounded-md transition-colors bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-600 focus:bg-white"
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
                                        <RefreshCw size={12} className="animate-spin text-cyan-600" /> {isEn ? 'Searching...' : 'Đang tìm...'}
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
                                                className={`w-full text-left p-3 flex items-center justify-between gap-3 text-xs transition-colors hover:bg-slate-50 ${isSelected ? 'bg-cyan-50/50' : ''}`}
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                                            {c.code}
                                                        </span>
                                                        <span className="font-bold text-slate-900 truncate">{c.name}</span>
                                                        {c.channel && (
                                                            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-cyan-50 text-cyan-700 border border-cyan-200">
                                                                {c.channel}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                        {c.salesRepName && <span>{isEn ? 'Sales Rep:' : 'Sale phụ trách:'} <strong>{c.salesRepName}</strong></span>}
                                                        {c.parentName && <span>&bull; {isEn ? 'Group:' : 'Thuộc:'} {c.parentName}</span>}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
                                                    {c.orderCount} {isEn ? 'orders' : 'đơn hàng'}
                                                </span>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* Time Range Selector */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200 self-start lg:self-auto overflow-x-auto max-w-full">
                        {timeRangeOptions.map(opt => (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => setTimeRange(opt.key)}
                                className={`text-xs px-3 py-1.5 rounded transition-all font-medium whitespace-nowrap ${
                                    timeRange === opt.key
                                        ? 'bg-white text-slate-900 font-bold shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Quick 1-tap picks from Top Customers */}
                {topCustomers.length > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs overflow-x-auto">
                        <span className="text-[11px] font-semibold text-slate-500 flex-shrink-0 flex items-center gap-1">
                            <Users size={12} className="text-amber-500" /> {t.customer360.quickPickTitle}
                        </span>
                        <div className="flex items-center gap-1.5 flex-nowrap">
                            {topCustomers.map((tc, idx) => {
                                const isSelected = tc.id === selectedCustomerId
                                return (
                                    <button
                                        key={tc.id || idx}
                                        type="button"
                                        onClick={() => handleSelectCustomer(tc.id, tc.name)}
                                        className={`px-2.5 py-1 rounded-md text-xs transition-all flex items-center gap-1.5 flex-shrink-0 ${
                                            isSelected
                                                ? 'bg-cyan-700 text-white font-bold shadow-xs'
                                                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                        }`}
                                    >
                                        <span className={`text-[10px] font-bold ${isSelected ? 'text-cyan-200' : 'text-amber-600'}`}>#{idx + 1}</span>
                                        <span className="truncate max-w-[130px] font-medium">{tc.name}</span>
                                        <span className={`text-[10px] ${isSelected ? 'text-cyan-200' : 'text-slate-500'}`}>
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
                <div className="py-24 text-center bg-white rounded-lg border border-slate-200">
                    <RefreshCw size={26} className="animate-spin text-cyan-600 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-800">Đang tải dữ liệu khách hàng...</p>
                    <p className="text-xs text-slate-500 mt-1">Nạp lịch sử đơn hàng, công nợ và chính sách giá riêng</p>
                </div>
            )}

            {/* ═══ MAIN DASHBOARD CONTENT ═══ */}
            {!isLoadingHistory && historyData && (
                <div className="space-y-4">

                    {/* ═══ SECTION 1: CUSTOMER PROFILE & BUYING HEALTH ALERT ═══ */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        
                        {/* Profile Info (2 cols) */}
                        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                                    {historyData.customer.code}
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                                    {historyData.customer.name}
                                </h3>
                                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                                    {historyData.customer.channel}
                                </span>
                                {historyData.customer.entityType === 'COMPANY' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        {isEn ? `Parent Group (${historyData.customer.childrenCount} branches)` : `Công ty Mẹ (${historyData.customer.childrenCount} chi nhánh con)`}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                                        {isEn ? 'Assigned Sales Rep' : 'Sale phụ trách'}
                                    </span>
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                                        <User size={13} className="text-slate-400" />
                                        {historyData.customer.salesRepName || (isEn ? 'Unassigned' : 'Chưa phân bổ')}
                                    </span>
                                </div>
                                {historyData.customer.parentName && (
                                    <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                                            {isEn ? 'Parent Company' : 'Công ty mẹ'}
                                        </span>
                                        <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                                            <Building2 size={13} className="text-slate-400" />
                                            {historyData.customer.parentName}
                                        </span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                                        {isEn ? 'Purchasing Contact' : 'Liên hệ thu mua'}
                                    </span>
                                    <span className="text-slate-800 mt-0.5 font-medium flex items-center gap-1">
                                        {historyData.customer.purchasingName || '—'}
                                        {historyData.customer.purchasingPhone && (
                                            <span className="text-slate-500 font-normal">({historyData.customer.purchasingPhone})</span>
                                        )}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                                        {isEn ? 'Site Receiver' : 'Nhận hàng tại điểm'}
                                    </span>
                                    <span className="text-slate-800 mt-0.5 font-medium flex items-center gap-1">
                                        {historyData.customer.receiverName || '—'}
                                        {historyData.customer.receiverPhone && (
                                            <span className="text-slate-500 font-normal">({historyData.customer.receiverPhone})</span>
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Buying Frequency & Order Rhythm (1 col) */}
                        <div className={`rounded-lg border p-4 shadow-xs flex flex-col justify-between ${
                            historyData.health.status === 'AT_RISK'
                                ? 'bg-rose-50/40 border-rose-200'
                                : historyData.health.status === 'WARNING'
                                ? 'bg-amber-50/40 border-amber-200'
                                : 'bg-emerald-50/40 border-emerald-200'
                        }`}>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        {isEn ? 'Order Rhythm & Frequency' : 'Theo Dõi Nhịp Đặt Hàng'}
                                    </span>
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                        historyData.health.status === 'AT_RISK'
                                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                            : historyData.health.status === 'WARNING'
                                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    }`}>
                                        {historyData.health.status === 'AT_RISK'
                                            ? (isEn ? '⚠️ Overdue Cycle' : '⚠️ Quá chu kỳ')
                                            : historyData.health.status === 'WARNING'
                                            ? (isEn ? '⚡ Delay Warning' : '⚡ Đang chậm đơn')
                                            : (isEn ? '✓ Regular Rhythm' : '✓ Đặt đều đặn')}
                                    </span>
                                </div>

                                <div className="space-y-1.5 mt-2 text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600">{isEn ? 'Last order:' : 'Đơn gần nhất:'}</span>
                                        <strong className="text-slate-900 font-mono">
                                            {historyData.health.daysSinceLastOrder !== null
                                                ? (isEn ? `${historyData.health.daysSinceLastOrder} days ago` : `Cách đây ${historyData.health.daysSinceLastOrder} ngày`)
                                                : (isEn ? 'No orders recorded' : 'Chưa có đơn')}
                                        </strong>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600">{isEn ? 'Average cycle:' : 'Chu kỳ thường đặt:'}</span>
                                        <strong className="text-slate-900 font-mono">
                                            {historyData.health.averageOrderCycleDays
                                                ? `~ ${historyData.health.averageOrderCycleDays} ${isEn ? 'days / order' : 'ngày / đơn'}`
                                                : (isEn ? 'Insufficient data' : 'Chưa đủ dữ liệu')}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 mt-2 border-t border-slate-200/60 text-xs">
                                <p className="text-slate-700 leading-snug">
                                    {historyData.health.status === 'AT_RISK' ? (
                                        <span className="text-rose-700 font-semibold">
                                            {isEn
                                                ? `Exceeded typical order cycle by ${historyData.health.delayDays} days. Sales rep should follow up.`
                                                : `Đã quá chu kỳ mua ${historyData.health.delayDays} ngày. Sale cần chủ động liên hệ kiểm tra lại nhu cầu của khách.`}
                                        </span>
                                    ) : historyData.health.status === 'WARNING' ? (
                                        <span className="text-amber-800 font-medium">
                                            {isEn
                                                ? `Customer ordering slower than usual by ${historyData.health.delayDays} days.`
                                                : `Khách đang đặt chậm hơn chu kỳ ${historyData.health.delayDays} ngày.`}
                                        </span>
                                    ) : (
                                        <span className="text-emerald-800 font-medium">
                                            {isEn ? 'Customer maintains a consistent ordering rhythm.' : 'Khách duy trì đặt hàng đúng chu kỳ đều đặn.'}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ═══ SECTION 2: CHÍNH SÁCH GIÁ & BẢNG GIÁ RIÊNG ═══ */}
                    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center">
                                    <Tag size={16} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-900">
                                        {isEn ? 'Pricing Policy & Special Price Lists' : 'Chính Sách Giá & Bảng Giá Riêng'}
                                    </h4>
                                    <p className="text-xs text-slate-500">
                                        {isEn ? 'Discount terms and wine SKUs with approved custom rates' : 'Chính sách chiết khấu và danh mục mã rượu có giá thỏa thuận riêng'}
                                    </p>
                                </div>
                            </div>

                            {/* Base Pricing Badges */}
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-500">{isEn ? 'Pricing policy:' : 'Chính sách giá:'}</span>
                                <span className="font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                    {BASE_PRICE_LABELS[historyData.pricing.basePriceType]?.[isEn ? 'en' : 'vi'] ?? historyData.pricing.basePriceType}
                                </span>
                                {historyData.pricing.defaultDiscountPct > 0 && (
                                    <span className="font-bold px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                        {isEn ? `Default discount: -${historyData.pricing.defaultDiscountPct}%` : `Chiết khấu mặc định: -${historyData.pricing.defaultDiscountPct}%`}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Approved Price Proposals (Tờ trình giá đã duyệt) */}
                        {historyData.pricing.proposals.length > 0 && (
                            <div className="mt-4 p-3 rounded-md bg-amber-50/40 border border-amber-200">
                                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-2">
                                    📜 {isEn ? `Approved Price Proposals (${historyData.pricing.proposals.length}):` : `Tờ trình duyệt giá riêng (${historyData.pricing.proposals.length}):`}
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {historyData.pricing.proposals.map(p => (
                                        <div key={p.id} className="bg-white p-2.5 rounded border border-amber-200/80 text-xs flex items-center justify-between gap-2 shadow-2xs">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                                    <span className="font-mono text-cyan-700">{p.proposalNo}</span>
                                                    <span className="truncate">{p.title}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    {p.startDate ? `${new Date(p.startDate).toLocaleDateString(isEn ? 'en-US' : 'vi-VN')} – ` : ''}
                                                    {p.endDate ? new Date(p.endDate).toLocaleDateString(isEn ? 'en-US' : 'vi-VN') : (isEn ? 'Indefinite' : 'Vô thời hạn')}
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                                                {isEn ? 'Approved' : 'Đã duyệt'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Special Price Rules by SKU Table */}
                        <div className="mt-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-800">
                                    {isEn ? `Custom price rules by SKU (${historyData.pricing.specialRules.length} SKUs):` : `Bảng giá riêng theo từng mã hàng (${historyData.pricing.specialRules.length} SKU):`}
                                </span>
                                {historyData.pricing.specialRules.some(r => r.isExpiringSoon || r.isExpired) && (
                                    <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                                        <AlertTriangle size={12} /> {isEn ? 'Expiring or expired rates exist' : 'Có mã sắp hoặc đã hết hạn'}
                                    </span>
                                )}
                            </div>

                            {historyData.pricing.specialRules.length === 0 ? (
                                <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded border border-dashed border-slate-200">
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
                                                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                                                    {rule.skuCode}
                                                                </span>
                                                                <span className="font-bold text-slate-900">{rule.productName}</span>
                                                                {rule.wineType && (
                                                                    <span className="text-[10px] px-1 py-0.2 rounded font-medium bg-cyan-50 text-cyan-800">
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
                                                        <td className="py-2.5 px-3 text-right font-bold font-mono text-amber-800 text-sm">
                                                            {formatVND(rule.specialPrice)}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                                                            {rule.discountPct > 0 ? (
                                                                <span>-{rule.discountPct}% <span className="text-[10px] font-normal text-slate-500">({formatVND(rule.discountAmount)})</span></span>
                                                            ) : (isEn ? 'Fixed rate' : 'Giá ấn định')}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center text-slate-600 whitespace-nowrap text-[11px]">
                                                            {new Date(rule.startDate).toLocaleDateString(isEn ? 'en-US' : 'vi-VN')}
                                                            {rule.endDate ? ` → ${new Date(rule.endDate).toLocaleDateString(isEn ? 'en-US' : 'vi-VN')}` : ` (${isEn ? 'Indefinite' : 'Vô thời hạn'})`}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                            {rule.isExpired ? (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                                                    {isEn ? 'Expired' : 'Đã hết hạn'}
                                                                </span>
                                                            ) : rule.isExpiringSoon ? (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                                                    {isEn ? 'Expiring Soon' : 'Sắp hết hạn'}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
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

                    {/* ═══ SECTION 3: 4 FINANCIAL & ORDER BREAKDOWN CARDS ═══ */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* 1. Tổng tiền đã mua */}
                        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs border-l-4 border-l-cyan-600">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                {isEn ? 'LIFETIME PURCHASES' : 'Tổng Tiền Hàng Đã Mua'}
                            </span>
                            <p className="text-xl font-bold font-mono text-slate-900">
                                {formatFriendlyVND(historyData.kpis.totalRevenue)}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1 font-mono">
                                {formatVND(historyData.kpis.totalRevenue)}
                            </p>
                        </div>

                        {/* 2. Đã thu vs Còn nợ AR */}
                        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs border-l-4 border-l-amber-500">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                {isEn ? 'PAID / OUTSTANDING DEBT' : 'Đã Thanh Toán / Còn Nợ'}
                            </span>
                            <p className="text-xl font-bold font-mono text-emerald-700">
                                {formatFriendlyVND(historyData.kpis.totalPaidAmount)}
                            </p>
                            <p className="text-[11px] mt-1 font-medium">
                                {isEn ? 'Balance: ' : 'Còn nợ: '}<strong className="text-amber-800">{formatFriendlyVND(historyData.kpis.totalArDebt)}</strong>
                                {historyData.kpis.overdueArDebt > 0 && (
                                    <span className="text-rose-600 font-bold ml-1">
                                        ({formatFriendlyVND(historyData.kpis.overdueArDebt)} {isEn ? 'overdue' : 'quá hạn'})
                                    </span>
                                )}
                            </p>
                        </div>

                        {/* 3. Sản lượng & Đơn thương mại vs Tasting */}
                        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs border-l-4 border-l-emerald-600">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                {isEn ? 'TOTAL BOTTLES DELIVERED' : 'Tổng Số Chai Đã Giao'}
                            </span>
                            <p className="text-xl font-bold font-mono text-slate-900">
                                {historyData.kpis.totalBottles.toLocaleString(isEn ? 'en-US' : 'vi-VN')} <span className="text-xs font-normal text-slate-500">{isEn ? 'btls' : 'chai'}</span>
                            </p>
                            <p className="text-[11px] text-slate-600 mt-1">
                                <strong>{historyData.orderBreakdown.commercialCount}</strong> {isEn ? 'sales orders' : 'đơn bán'} ({historyData.orderBreakdown.commercialBottles} {isEn ? 'btls' : 'chai'}) &bull; <strong>{historyData.orderBreakdown.tastingCount}</strong> {isEn ? 'tasting orders' : 'đơn thử nếm'}
                            </p>
                        </div>

                        {/* 4. Điều khoản & Hạn mức */}
                        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs border-l-4 border-l-slate-700">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                {isEn ? 'CREDIT LIMIT & TERMS' : 'Hạn Mức Nợ & Điều Khoản'}
                            </span>
                            <p className="text-base font-bold text-slate-900">
                                {historyData.customer.paymentTerm}
                            </p>
                            <p className="text-[11px] text-slate-600 mt-1">
                                {isEn ? 'Credit limit: ' : 'Hạn mức: '}<strong className="text-slate-800">{formatFriendlyVND(historyData.customer.creditLimit)}</strong>
                            </p>
                        </div>
                    </div>

                    {/* ═══ SECTION 4: TABS (ORDERS / WINES / TRENDS) ═══ */}
                    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
                        
                        {/* Tab Switcher */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('ORDERS')}
                                    className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold rounded-md transition-colors ${
                                        activeTab === 'ORDERS'
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <FileText size={14} />
                                    {isEn ? `Order History (${historyData.orders.length})` : `Lịch Sử Đơn Hàng (${historyData.orders.length})`}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('WINES')}
                                    className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold rounded-md transition-colors ${
                                        activeTab === 'WINES'
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <Wine size={14} />
                                    {isEn ? `Purchased Wines (${historyData.topProducts.length})` : `Danh Mục Rượu Đã Mua (${historyData.topProducts.length})`}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('TREND')}
                                    className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold rounded-md transition-colors ${
                                        activeTab === 'TREND'
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <TrendingUp size={14} />
                                    {isEn ? `Monthly Purchases (${historyData.monthlyTrend.length} mo)` : `Lịch Sử Nhập Theo Tháng (${historyData.monthlyTrend.length} tháng)`}
                                </button>
                            </div>

                            <Link
                                href={`/dashboard/sales?search=${encodeURIComponent(historyData.customer.code)}`}
                                className="text-xs font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 hover:underline"
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
                                            { key: 'ALL', label: isEn ? 'All orders' : 'Tất cả đơn' },
                                            { key: 'COMMERCIAL', label: isEn ? '🛒 Sales orders' : '🛒 Đơn bán hàng' },
                                            { key: 'TASTING', label: isEn ? '🍷 Tasting / Samples' : '🍷 Hàng mẫu / Tasting' },
                                            { key: 'UNPAID', label: isEn ? '💳 Outstanding debt' : '💳 Đơn còn nợ' },
                                            { key: 'DELIVERED', label: isEn ? '📦 Delivered' : '📦 Đã giao hàng' },
                                        ].map(f => (
                                            <button
                                                key={f.key}
                                                type="button"
                                                onClick={() => setOrderFilter(f.key as any)}
                                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                                    orderFilter === f.key
                                                        ? 'bg-cyan-700 text-white font-bold'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
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
                                            <table className="w-full text-xs text-left">
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
                                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                                                                🍷 {order.orderType === 'TASTING' ? 'Tasting' : 'Sample'}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
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
                                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block"
                                                                            style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>
                                                                            {isEn ? statusCfg.labelEn : statusCfg.labelVi}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded inline-block"
                                                                            style={{ background: delivCfg.bg, color: delivCfg.color }}>
                                                                            {isEn ? delivCfg.labelEn : delivCfg.labelVi}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                        {order.arInvoices.length > 0 ? (
                                                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
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
                                                                                        <span className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
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
                                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                                            🍷 {isEn ? 'Breakdown by wine type:' : 'Cơ cấu theo loại vang:'}
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
                                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                                            🏷️ {isEn ? 'Breakdown by price bracket:' : 'Cơ cấu theo tầm giá:'}
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
                                                                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                                                            {wine.skuCode}
                                                                        </span>
                                                                        <span className="font-bold text-slate-900">{wine.name}</span>
                                                                        {wine.wineType && (
                                                                            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-amber-50 text-amber-800 border border-amber-200">
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
