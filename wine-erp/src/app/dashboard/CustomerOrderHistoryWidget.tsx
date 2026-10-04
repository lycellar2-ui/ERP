'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import {
    searchCustomersForDashboard,
    getCustomerPurchaseHistory,
    type DashboardCustomerSearchItem,
    type CustomerPurchaseHistoryResult,
    type CustomerHistorySOItem,
} from './actions'
import {
    Search, Users, Wine, Calendar, DollarSign, Package, TrendingUp,
    ChevronDown, ChevronUp, ChevronRight, ExternalLink, FileText,
    CheckCircle2, Truck, AlertCircle, Clock, X, ArrowUpRight,
    Store, Building2, User, RefreshCw, BarChart2, ShieldAlert
} from 'lucide-react'
import { formatVND } from '@/lib/utils'
import Link from 'next/link'

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
}

type TimeRangeKey = 'ALL' | 'THIS_YEAR' | 'LAST_6_MONTHS' | 'THIS_MONTH'

const TIME_RANGE_OPTIONS: { key: TimeRangeKey; label: string }[] = [
    { key: 'ALL', label: 'Tất cả (All-time)' },
    { key: 'THIS_YEAR', label: 'Năm nay (2026)' },
    { key: 'LAST_6_MONTHS', label: '6 tháng qua' },
    { key: 'THIS_MONTH', label: 'Tháng này' },
]

function formatFriendlyVND(amount: number | null | undefined): string {
    if (!amount || amount === 0) return '0 đ'
    const abs = Math.abs(amount)
    const sign = amount < 0 ? '−' : ''
    if (abs >= 1_000_000_000) {
        const billions = abs / 1_000_000_000
        return `${sign}${billions >= 10 ? billions.toFixed(1) : billions.toFixed(2).replace('.', ',')} Tỷ`
    } else if (abs >= 1_000_000) {
        const millions = abs / 1_000_000
        return `${sign}${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1).replace('.', ',')} Triệu`
    }
    return `${sign}${abs.toLocaleString('vi-VN')} đ`
}

const STATUS_BADGES: Record<string, { label: string; bg: string; color: string; border: string }> = {
    CONFIRMED: { label: 'Đã xác nhận', bg: 'rgba(74,143,171,0.1)', color: '#0891B2', border: 'rgba(74,143,171,0.25)' },
    PARTIALLY_DELIVERED: { label: 'Giao một phần', bg: 'rgba(212,168,83,0.1)', color: '#D4A853', border: 'rgba(212,168,83,0.25)' },
    DELIVERED: { label: 'Đã giao hàng', bg: 'rgba(91,168,138,0.12)', color: '#5BA88A', border: 'rgba(91,168,138,0.25)' },
    INVOICED: { label: 'Đã xuất HĐ', bg: 'rgba(74,143,171,0.12)', color: '#0284C7', border: 'rgba(74,143,171,0.25)' },
    PAID: { label: 'Đã thanh toán', bg: 'rgba(91,168,138,0.15)', color: '#16A34A', border: 'rgba(91,168,138,0.3)' },
    PENDING_APPROVAL: { label: 'Chờ duyệt', bg: 'rgba(212,168,83,0.15)', color: '#B45309', border: 'rgba(212,168,83,0.3)' },
    PENDING_ACCOUNTING: { label: 'Chờ kế toán', bg: 'rgba(212,168,83,0.12)', color: '#D97706', border: 'rgba(212,168,83,0.25)' },
    DRAFT: { label: 'Bản nháp', bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
    CANCELLED: { label: 'Đã hủy', bg: 'rgba(224,82,82,0.1)', color: '#E05252', border: 'rgba(224,82,82,0.2)' },
}

const DELIVERY_BADGES: Record<string, { label: string; bg: string; color: string }> = {
    DELIVERED: { label: 'Giao đủ', bg: 'rgba(91,168,138,0.12)', color: '#5BA88A' },
    PARTIALLY_DELIVERED: { label: 'Giao 1 phần', bg: 'rgba(212,168,83,0.12)', color: '#D4A853' },
    PREPARING: { label: 'Đang chuẩn bị', bg: 'rgba(8,145,178,0.1)', color: '#0891B2' },
    UNDELIVERED: { label: 'Chưa giao', bg: '#F1F5F9', color: '#64748B' },
}

export function CustomerOrderHistoryWidget({ topCustomers = [] }: Props) {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
    const [timeRange, setTimeRange] = useState<TimeRangeKey>('ALL')
    const [activeTab, setActiveTab] = useState<'ORDERS' | 'WINES' | 'TREND'>('ORDERS')
    const [expandedSoId, setExpandedSoId] = useState<string | null>(null)
    const [soFilterStatus, setSoFilterStatus] = useState<string>('ALL')
    const [wineSearch, setWineSearch] = useState<string>('')

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
            handleSelectCustomer(topCustomers[0].id)
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
                console.error('Failed to load customer history:', err)
                if (!isCancelled) setIsLoadingHistory(false)
            })
        return () => {
            isCancelled = true
        }
    }, [selectedCustomerId, timeRange])

    // Handle search input
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
        if (soFilterStatus === 'ALL') return true
        if (soFilterStatus === 'DELIVERED') return o.deliveryStatus === 'DELIVERED' || o.status === 'DELIVERED'
        if (soFilterStatus === 'PAID') return o.status === 'PAID'
        if (soFilterStatus === 'PENDING') return o.status === 'PENDING_APPROVAL' || o.status === 'CONFIRMED'
        return o.status === soFilterStatus
    })

    // Filter wines
    const filteredWines = (historyData?.topProducts ?? []).filter(p => {
        if (!wineSearch.trim()) return true
        const q = wineSearch.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.skuCode.toLowerCase().includes(q) || (p.originCountry ?? '').toLowerCase().includes(q)
    })

    return (
        <div className="rounded-lg p-5 transition-all" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            
            {/* ═══ WIDGET HEADER ═══ */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(8, 145, 178, 0.1)', color: '#0891B2' }}>
                        <Users size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-slate-900 tracking-tight">Tra Cứu Lịch Sử Nhập Hàng Khách Hàng</h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(8, 145, 178, 0.1)', color: '#0891B2' }}>
                                Customer 360°
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Theo dõi doanh thu, sản lượng chai, công nợ AR và các dòng vang đã từng mua
                        </p>
                    </div>
                </div>

                {/* ═══ CUSTOMER SEARCH COMBOBOX ═══ */}
                <div className="relative w-full lg:w-96" ref={searchRef}>
                    <div className="relative flex items-center">
                        <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Tìm khách hàng theo tên, mã (KH-...), SĐT..."
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
                            className="w-full text-xs pl-8 pr-8 py-2 rounded-md transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#0F172A' }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => { setSearchQuery(''); handleSearchChange('') }}
                                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Autocomplete Dropdown */}
                    {isDropdownOpen && (
                        <div
                            className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-md shadow-lg max-h-72 overflow-y-auto"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                        >
                            {isSearching ? (
                                <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                                    <RefreshCw size={12} className="animate-spin text-cyan-600" /> Đang tìm kiếm...
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="py-4 text-center text-xs text-slate-500">
                                    Không tìm thấy khách hàng phù hợp
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {searchResults.map(c => {
                                        const isSelected = c.id === selectedCustomerId
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => handleSelectCustomer(c.id, c.name)}
                                                className={`w-full text-left p-2.5 flex items-center justify-between gap-3 text-xs transition-colors hover:bg-slate-50 ${isSelected ? 'bg-cyan-50/50' : ''}`}
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded" style={{ background: '#E2E8F0', color: '#334155' }}>
                                                            {c.code}
                                                        </span>
                                                        <span className="font-semibold truncate text-slate-900">{c.name}</span>
                                                        {c.channel && (
                                                            <span className="text-[9px] px-1 py-0.2 rounded font-medium" style={{ background: 'rgba(8,145,178,0.08)', color: '#0891B2' }}>
                                                                {c.channel}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                        {c.salesRepName && <span>Sale: {c.salesRepName}</span>}
                                                        {c.parentName && <span>&bull; Thuộc: {c.parentName}</span>}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#F1F5F9', color: '#475569' }}>
                                                    {c.orderCount} đơn
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ QUICK PILLS FROM TOP CUSTOMERS ═══ */}
            {topCustomers.length > 0 && (
                <div className="flex items-center gap-2 pt-3 pb-3 overflow-x-auto text-xs border-b border-slate-100">
                    <span className="text-[11px] font-medium text-slate-500 flex-shrink-0 flex items-center gap-1">
                        <Users size={12} className="text-amber-500" /> Gợi ý Top Tháng:
                    </span>
                    <div className="flex items-center gap-1.5 flex-nowrap">
                        {topCustomers.map((tc, idx) => {
                            const isSelected = tc.id === selectedCustomerId
                            return (
                                <button
                                    key={tc.id || idx}
                                    type="button"
                                    onClick={() => handleSelectCustomer(tc.id, tc.name)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 flex-shrink-0 ${
                                        isSelected
                                            ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                >
                                    <span className={`text-[10px] font-bold ${isSelected ? 'text-cyan-100' : 'text-amber-600'}`}>#{idx + 1}</span>
                                    <span className="truncate max-w-[130px]">{tc.name}</span>
                                    <span className={`text-[10px] ${isSelected ? 'text-cyan-200' : 'text-slate-500'}`}>
                                        ({formatFriendlyVND(tc.revenue)})
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ═══ LOADING STATE ═══ */}
            {isLoadingHistory && (
                <div className="py-16 text-center">
                    <RefreshCw size={24} className="animate-spin text-cyan-600 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-600">Đang tổng hợp dữ liệu lịch sử nhập hàng...</p>
                </div>
            )}

            {/* ═══ EMPTY STATE: NO CUSTOMER SELECTED ═══ */}
            {!isLoadingHistory && !selectedCustomerId && (
                <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto mb-3">
                        <Search size={20} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Chưa chọn khách hàng nào</p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                        Hãy chọn nhanh từ danh sách Top Khách Hàng ở trên, hoặc gõ tên/mã vào ô tìm kiếm để xem hồ sơ nhập hàng 360°.
                    </p>
                </div>
            )}

            {/* ═══ CUSTOMER 360 DASHBOARD VIEW ═══ */}
            {!isLoadingHistory && historyData && (
                <div className="mt-4 space-y-4">
                    
                    {/* 1. CUSTOMER PROFILE BANNER */}
                    <div className="p-4 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-3"
                        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: '#0891B2', color: '#FFFFFF' }}>
                                    {historyData.customer.code}
                                </span>
                                <h4 className="text-base font-bold text-slate-900">{historyData.customer.name}</h4>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(8,145,178,0.1)', color: '#0891B2' }}>
                                    {historyData.customer.channel}
                                </span>
                                {historyData.customer.entityType === 'COMPANY' && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                        Công ty Mẹ ({historyData.customer.childrenCount} chi nhánh)
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-600">
                                {historyData.customer.salesRepName && (
                                    <span className="flex items-center gap-1">
                                        <User size={12} className="text-slate-400" /> Sale: <strong className="text-slate-800">{historyData.customer.salesRepName}</strong>
                                    </span>
                                )}
                                {historyData.customer.parentName && (
                                    <span className="flex items-center gap-1">
                                        <Building2 size={12} className="text-slate-400" /> Thuộc: <strong className="text-slate-800">{historyData.customer.parentName}</strong>
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    <Clock size={12} className="text-slate-400" /> Thanh toán: <strong className="text-slate-800">{historyData.customer.paymentTerm}</strong>
                                </span>
                                {historyData.customer.creditLimit > 0 && (
                                    <span className="flex items-center gap-1">
                                        <DollarSign size={12} className="text-slate-400" /> Hạn mức tín dụng: <strong className="text-slate-800">{formatFriendlyVND(historyData.customer.creditLimit)}</strong>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* TIME RANGE SELECTOR PILLS */}
                        <div className="flex items-center gap-1 bg-white p-1 rounded-md border border-slate-200 self-start md:self-auto">
                            {TIME_RANGE_OPTIONS.map(opt => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setTimeRange(opt.key)}
                                    className={`text-[11px] px-2.5 py-1 rounded transition-colors font-medium ${
                                        timeRange === opt.key
                                            ? 'bg-slate-900 text-white font-semibold'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. FOUR CORE KPI CARDS FOR THIS CUSTOMER */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Doanh thu lũy kế */}
                        <div className="p-3.5 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '3px solid #0891B2' }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Tổng Tiền Đã Nhập</p>
                            <p className="text-xl font-bold font-mono text-slate-900">{formatFriendlyVND(historyData.kpis.totalRevenue)}</p>
                            <p className="text-[11px] text-slate-500 mt-1">
                                Chính xác: {formatVND(historyData.kpis.totalRevenue)}
                            </p>
                        </div>

                        {/* Số đơn & Sản lượng chai */}
                        <div className="p-3.5 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '3px solid #D4A853' }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Đơn Hàng & Sản Lượng</p>
                            <p className="text-xl font-bold font-mono text-slate-900">
                                {historyData.kpis.totalOrders} <span className="text-xs font-normal text-slate-500">đơn</span> &bull; {historyData.kpis.totalBottles.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">chai</span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1">
                                TB: {historyData.kpis.totalOrders > 0 ? Math.round(historyData.kpis.totalBottles / historyData.kpis.totalOrders) : 0} chai / đơn
                            </p>
                        </div>

                        {/* Lần mua gần nhất */}
                        <div className="p-3.5 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '3px solid #5BA88A' }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Lần Mua Gần Nhất</p>
                            <p className="text-base font-bold text-slate-900">
                                {historyData.kpis.lastOrderDate ? new Date(historyData.kpis.lastOrderDate).toLocaleDateString('vi-VN') : 'Chưa có'}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1 truncate">
                                Mã SO: <span className="font-semibold text-cyan-700">{historyData.kpis.lastOrderNo ?? '—'}</span>
                            </p>
                        </div>

                        {/* Công nợ hiện tại AR */}
                        <div className="p-3.5 rounded-md" style={{
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderLeft: `3px solid ${historyData.kpis.overdueArDebt > 0 ? '#E05252' : '#5BA88A'}`
                        }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Dư Nợ Phải Thu (AR)</p>
                            <p className={`text-xl font-bold font-mono ${historyData.kpis.totalArDebt > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {formatFriendlyVND(historyData.kpis.totalArDebt)}
                            </p>
                            <p className="text-[11px] mt-1 font-medium">
                                {historyData.kpis.overdueArDebt > 0 ? (
                                    <span className="text-rose-600 font-semibold">⚠️ Quá hạn: {formatFriendlyVND(historyData.kpis.overdueArDebt)}</span>
                                ) : (
                                    <span className="text-emerald-600">Đang trong hạn mức</span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* 3. TABS SWITCHER */}
                    <div className="border-b border-slate-200 flex items-center justify-between gap-4 pt-1">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab('ORDERS')}
                                className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
                                    activeTab === 'ORDERS'
                                        ? 'border-cyan-600 text-cyan-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <FileText size={14} />
                                Lịch Sử Đơn Hàng ({historyData.orders.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('WINES')}
                                className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
                                    activeTab === 'WINES'
                                        ? 'border-cyan-600 text-cyan-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Wine size={14} />
                                Rượu Đã Từng Mua ({historyData.topProducts.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('TREND')}
                                className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
                                    activeTab === 'TREND'
                                        ? 'border-cyan-600 text-cyan-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <TrendingUp size={14} />
                                Xu Hướng Nhập Hàng ({historyData.monthlyTrend.length} tháng)
                            </button>
                        </div>

                        {/* Direct module link */}
                        <Link
                            href={`/dashboard/sales?search=${encodeURIComponent(historyData.customer.code)}`}
                            className="text-[11px] font-medium text-cyan-700 hover:text-cyan-800 flex items-center gap-1 hover:underline pb-1"
                        >
                            Mở module Sales <ExternalLink size={11} />
                        </Link>
                    </div>

                    {/* 4. TAB CONTENTS */}

                    {/* ═══ TAB 1: SALES ORDERS LIST ═══ */}
                    {activeTab === 'ORDERS' && (
                        <div className="space-y-3">
                            {/* Filter bar for orders */}
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-slate-500">Lọc đơn:</span>
                                    {['ALL', 'DELIVERED', 'PAID', 'PENDING'].map(st => (
                                        <button
                                            key={st}
                                            type="button"
                                            onClick={() => setSoFilterStatus(st)}
                                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                                                soFilterStatus === st
                                                    ? 'bg-slate-800 text-white'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            {st === 'ALL' ? 'Tất cả' : st === 'DELIVERED' ? 'Đã giao đủ' : st === 'PAID' ? 'Đã thanh toán' : 'Chờ xử lý'}
                                        </button>
                                    ))}
                                </div>
                                <span className="text-[11px] text-slate-500">
                                    Hiển thị {filteredOrders.length} / {historyData.orders.length} đơn
                                </span>
                            </div>

                            {/* Orders Table */}
                            {filteredOrders.length === 0 ? (
                                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-md">
                                    Không có đơn hàng nào phù hợp với bộ lọc
                                </div>
                            ) : (
                                <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                                                <tr>
                                                    <th className="py-2.5 px-3">Mã Đơn (SO)</th>
                                                    <th className="py-2.5 px-3">Ngày Đặt</th>
                                                    {historyData.customer.entityType === 'COMPANY' && (
                                                        <th className="py-2.5 px-3">Điểm Giao / Chi Nhánh</th>
                                                    )}
                                                    <th className="py-2.5 px-3">Sale Phụ Trách</th>
                                                    <th className="py-2.5 px-3 text-right">Sản Lượng</th>
                                                    <th className="py-2.5 px-3 text-right">Tổng Tiền</th>
                                                    <th className="py-2.5 px-3 text-center">Trạng Thái Đơn</th>
                                                    <th className="py-2.5 px-3 text-center">Giao Hàng</th>
                                                    <th className="py-2.5 px-3 text-center">Hóa Đơn VAT</th>
                                                    <th className="py-2.5 px-3 text-center">Chi Tiết</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredOrders.map(order => {
                                                    const isExpanded = expandedSoId === order.id
                                                    const statusCfg = STATUS_BADGES[order.status] ?? STATUS_BADGES.DRAFT
                                                    const delivCfg = DELIVERY_BADGES[order.deliveryStatus] ?? DELIVERY_BADGES.UNDELIVERED
                                                    const hasVat = order.arInvoices.length > 0

                                                    return (
                                                        <>
                                                            <tr
                                                                key={order.id}
                                                                className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-cyan-50/20' : ''}`}
                                                            >
                                                                <td className="py-2.5 px-3 font-semibold font-mono text-cyan-700">
                                                                    <Link href={`/dashboard/sales?search=${encodeURIComponent(order.soNo)}`} className="hover:underline flex items-center gap-1">
                                                                        {order.soNo}
                                                                    </Link>
                                                                </td>
                                                                <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                                                    {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                                                                </td>
                                                                {historyData.customer.entityType === 'COMPANY' && (
                                                                    <td className="py-2.5 px-3 text-slate-700 max-w-[140px] truncate">
                                                                        {order.branchName ?? 'Trụ sở chính'}
                                                                    </td>
                                                                )}
                                                                <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                                                    {order.salesRepName}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-right font-medium text-slate-900 whitespace-nowrap">
                                                                    {order.totalBottles} chai <span className="text-[10px] text-slate-400">({order.lineCount} dòng)</span>
                                                                </td>
                                                                <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900 whitespace-nowrap">
                                                                    {formatVND(order.totalAmount)}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block"
                                                                        style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>
                                                                        {statusCfg.label}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded inline-block"
                                                                        style={{ background: delivCfg.bg, color: delivCfg.color }}>
                                                                        {delivCfg.label}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                    {hasVat ? (
                                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-emerald-700 bg-emerald-50 border border-emerald-200">
                                                                            {order.arInvoices[0].invoiceNo || 'Đã xuất HĐ'}
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
                                                                        title={isExpanded ? 'Thu gọn' : 'Xem các mặt hàng'}
                                                                    >
                                                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                    </button>
                                                                </td>
                                                            </tr>

                                                            {/* EXPANDABLE INLINE ITEMS */}
                                                            {isExpanded && (
                                                                <tr key={`${order.id}-detail`} className="bg-slate-50/70 border-t border-slate-100">
                                                                    <td colSpan={historyData.customer.entityType === 'COMPANY' ? 10 : 9} className="p-3">
                                                                        <div className="bg-white rounded border border-slate-200 p-3 shadow-xs">
                                                                            <p className="text-[11px] font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                                                                <Wine size={13} className="text-cyan-600" /> Chi tiết {order.lines.length} sản phẩm trong đơn {order.soNo}:
                                                                            </p>
                                                                            <div className="overflow-x-auto">
                                                                                <table className="w-full text-xs">
                                                                                    <thead className="bg-slate-50 text-[10px] text-slate-500 font-semibold border-b border-slate-200">
                                                                                        <tr>
                                                                                            <th className="py-1 px-2 text-left">Mã SKU</th>
                                                                                            <th className="py-1 px-2 text-left">Tên Rượu</th>
                                                                                            <th className="py-1 px-2 text-center">Loại Rượu</th>
                                                                                            <th className="py-1 px-2 text-right">Số Lượng</th>
                                                                                            <th className="py-1 px-2 text-right">Đơn Giá</th>
                                                                                            <th className="py-1 px-2 text-right">Chiết Khấu</th>
                                                                                            <th className="py-1 px-2 text-right">Thành Tiền</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                                                                        {order.lines.map(l => (
                                                                                            <tr key={l.id}>
                                                                                                <td className="py-1.5 px-2 font-mono text-[10px] text-slate-500">{l.skuCode}</td>
                                                                                                <td className="py-1.5 px-2 font-medium text-slate-900">{l.productName}</td>
                                                                                                <td className="py-1.5 px-2 text-center text-slate-600">{l.wineType || '—'}</td>
                                                                                                <td className="py-1.5 px-2 text-right font-semibold">{l.qtyOrdered} chai</td>
                                                                                                <td className="py-1.5 px-2 text-right font-mono">{formatVND(l.unitPrice)}</td>
                                                                                                <td className="py-1.5 px-2 text-right text-slate-500">
                                                                                                    {l.lineDiscountPct > 0 ? `${l.lineDiscountPct}%` : '—'}
                                                                                                </td>
                                                                                                <td className="py-1.5 px-2 text-right font-mono font-semibold text-slate-900">{formatVND(l.lineTotal)}</td>
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

                    {/* ═══ TAB 2: WINES & TOP SKUS ═══ */}
                    {activeTab === 'WINES' && (
                        <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <p className="text-xs text-slate-600">
                                    Khách hàng đã nhập tổng cộng <strong className="text-slate-900">{historyData.topProducts.length}</strong> dòng rượu khác nhau
                                </p>
                                <div className="relative w-full sm:w-64">
                                    <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Lọc theo tên vang, SKU, xuất xứ..."
                                        value={wineSearch}
                                        onChange={(e) => setWineSearch(e.target.value)}
                                        className="w-full text-xs pl-7 pr-3 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    />
                                </div>
                            </div>

                            {filteredWines.length === 0 ? (
                                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-md">
                                    Không tìm thấy dòng rượu nào phù hợp
                                </div>
                            ) : (
                                <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                                                <tr>
                                                    <th className="py-2.5 px-3 text-center w-12">#</th>
                                                    <th className="py-2.5 px-3">Mã SKU & Tên Rượu</th>
                                                    <th className="py-2.5 px-3">Xuất Xứ / Vùng</th>
                                                    <th className="py-2.5 px-3 text-right">Tổng Chai Đã Nhập</th>
                                                    <th className="py-2.5 px-3 text-right">Đơn Giá Mua Gần Nhất</th>
                                                    <th className="py-2.5 px-3 text-right">Tổng Tiền Đã Chi</th>
                                                    <th className="py-2.5 px-3 text-center">Lần Mua Gần Nhất</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredWines.map((wine, idx) => (
                                                    <tr key={wine.productId} className="hover:bg-slate-50 transition-colors">
                                                        <td className="py-2.5 px-3 text-center text-slate-400 font-bold text-[11px]">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="py-2.5 px-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                                                                    {wine.skuCode}
                                                                </span>
                                                                <span className="font-semibold text-slate-900">{wine.name}</span>
                                                                {wine.wineType && (
                                                                    <span className="text-[10px] px-1 py-0.2 rounded font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                                                        {wine.wineType}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-slate-600">
                                                            {wine.originCountry || '—'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                                            {wine.totalQty.toLocaleString('vi-VN')} chai
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                                            {formatVND(wine.lastUnitPrice)}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-800">
                                                            {formatVND(wine.totalSpend)}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center text-slate-500 whitespace-nowrap">
                                                            {new Date(wine.lastPurchasedAt).toLocaleDateString('vi-VN')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══ TAB 3: MONTHLY TREND ═══ */}
                    {activeTab === 'TREND' && (
                        <div className="space-y-4">
                            <p className="text-xs text-slate-600">
                                Thống kê biến động doanh thu & sản lượng nhập hàng của khách hàng theo từng tháng:
                            </p>

                            {historyData.monthlyTrend.length === 0 ? (
                                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-md">
                                    Chưa đủ dữ liệu xu hướng theo tháng
                                </div>
                            ) : (
                                <div className="p-4 rounded-md border border-slate-200 bg-slate-50/50 space-y-4">
                                    {/* Trend Bars */}
                                    {(() => {
                                        const maxRev = Math.max(...historyData.monthlyTrend.map(m => m.revenue), 1)
                                        return (
                                            <div className="space-y-2.5">
                                                {historyData.monthlyTrend.map(m => {
                                                    const pct = Math.max(3, (m.revenue / maxRev) * 100)
                                                    return (
                                                        <div key={m.month} className="space-y-1">
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className="font-semibold text-slate-800 w-20">{m.label}</span>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-slate-500 text-[11px]">{m.orders} đơn &bull; {m.bottles} chai</span>
                                                                    <span className="font-bold font-mono text-cyan-800 text-xs w-28 text-right">
                                                                        {formatVND(m.revenue)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full transition-all duration-500"
                                                                    style={{ width: `${pct}%`, background: '#0891B2' }}
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
            )}
        </div>
    )
}
