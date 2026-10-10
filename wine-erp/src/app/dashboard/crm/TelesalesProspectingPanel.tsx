'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    Phone, PhoneCall, PhoneForwarded, PhoneMissed, PhoneOff, CheckCircle2,
    Clock, Users, Building2, UserPlus, Target, Award, TrendingUp, Calendar,
    Search, Filter, Plus, RefreshCw, X, FileText, ChevronRight, ArrowUpRight,
    Sparkles, ShieldCheck, AlertCircle, Briefcase, Zap, Check, CalendarCheck
} from 'lucide-react'
import { DailyCallPlannerView } from './DailyCallPlannerView'
import { toast } from 'sonner'
import {
    TelesalesDashboardData,
    getTelesalesProspectingDashboard,
    logSalesCallAction,
    setSalesQuotaAction,
    convertProspectToCustomerAction
} from './actions'

interface TelesalesProspectingPanelProps {
    initialData?: TelesalesDashboardData | null
}

const CALL_TYPES = [
    { id: 'CORPORATE_GIFT', label: '🎁 Quà Tết & Sự Kiện Doanh Nghiệp', channel: 'CORPORATE' },
    { id: 'COLD_PROSPECTING', label: '🤝 Chào hàng danh mục vang B2B', channel: 'CORPORATE' },
    { id: 'CONTRACT_NEGOTIATION', label: '📝 Đàm phán hợp đồng / Chiết khấu', channel: 'CORPORATE' },
    { id: 'RETAIL_CARE', label: '💎 Chăm sóc khách VIP / Nhà sưu tập', channel: 'RETAIL' },
    { id: 'TASTING_INVITE', label: '🍷 Mời thử rượu Tasting / Event', channel: 'ALL' },
    { id: 'QUOTE_FOLLOWUP', label: '📄 Theo dõi phản hồi báo giá', channel: 'ALL' },
    { id: 'REORDER_AR', label: '📦 Chốt đơn tái đặt / Công nợ', channel: 'ALL' },
]

const CALL_OUTCOMES = [
    {
        id: 'CONNECTED_INTERESTED',
        label: 'Quan tâm báo giá / Catalog',
        shortLabel: 'Quan tâm',
        color: '#0891B2',
        bg: 'rgba(8, 145, 178, 0.1)',
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
        icon: Sparkles
    },
    {
        id: 'CONNECTED_MEETING_SET',
        label: 'Đã chốt lịch hẹn / Tasting',
        shortLabel: 'Chốt hẹn',
        color: '#15803D',
        bg: 'rgba(5, 150, 105, 0.1)',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: Calendar
    },
    {
        id: 'CONNECTED_CLOSED_DEAL',
        label: 'Chốt đơn hàng thành công!',
        shortLabel: 'Chốt đơn 🎯',
        color: '#15803D',
        bg: 'rgba(21,128,61, 0.15)',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
        icon: CheckCircle2
    },
    {
        id: 'CONNECTED_BUSY_CALLBACK',
        label: 'Khách bận – Hẹn gọi lại',
        shortLabel: 'Hẹn gọi lại',
        color: '#D97706',
        bg: 'rgba(217, 119, 6, 0.1)',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Clock
    },
    {
        id: 'NOT_ANSWERED_MISSED',
        label: 'Không nghe máy / Máy bận',
        shortLabel: 'Không nghe máy',
        color: '#64748B',
        bg: 'rgba(100, 116, 139, 0.1)',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        icon: PhoneMissed
    },
    {
        id: 'WRONG_NUMBER_INVALID',
        label: 'Sai số / Không có nhu cầu',
        shortLabel: 'Từ chối / Sai số',
        color: '#B91C1C',
        bg: 'rgba(185,28,28, 0.1)',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: PhoneOff
    },
]

export function TelesalesProspectingPanel({ initialData }: TelesalesProspectingPanelProps) {
    const [data, setData] = useState<TelesalesDashboardData | null>(initialData || null)
    const [loading, setLoading] = useState(!initialData)
    const [channelFilter, setChannelFilter] = useState<'ALL' | 'CORPORATE' | 'RETAIL'>('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [activeSubTab, setActiveSubTab] = useState<'planner' | 'metrics'>('planner')

    // Quick Call Logger Modal State
    const [loggerOpen, setLoggerOpen] = useState(false)
    const [loggerChannel, setLoggerChannel] = useState<'CORPORATE' | 'RETAIL'>('CORPORATE')
    const [loggerCustomerType, setLoggerCustomerType] = useState<'EXISTING' | 'PROSPECT'>('PROSPECT')
    const [selectedCustomerId, setSelectedCustomerId] = useState('')
    const [prospectName, setProspectName] = useState('')
    const [prospectCompany, setProspectCompany] = useState('')
    const [phone, setPhone] = useState('')
    const [callType, setCallType] = useState('CORPORATE_GIFT')
    const [outcome, setOutcome] = useState('CONNECTED_INTERESTED')
    const [notes, setNotes] = useState('')
    const [followUpDate, setFollowUpDate] = useState('')
    const [savingCall, setSavingCall] = useState(false)

    // Quota Settings Modal State (Manager only)
    const [quotaModalOpen, setQuotaModalOpen] = useState(false)
    const [targetRepId, setTargetRepId] = useState('')
    const [dailyCallTargetInput, setDailyCallTargetInput] = useState(15)
    const [monthlyLeadTargetInput, setMonthlyLeadTargetInput] = useState(10)
    const [monthlyDealTargetInput, setMonthlyDealTargetInput] = useState(5)
    const [savingQuota, setSavingQuota] = useState(false)

    // Convert Prospect Modal State
    const [convertModalOpen, setConvertModalOpen] = useState(false)
    const [convertingLog, setConvertingLog] = useState<any | null>(null)
    const [convertTaxId, setConvertTaxId] = useState('')
    const [convertAddress, setConvertAddress] = useState('')
    const [savingConvert, setSavingConvert] = useState(false)

    const loadDashboard = async () => {
        setLoading(true)
        try {
            const res = await getTelesalesProspectingDashboard({
                channel: channelFilter === 'ALL' ? undefined : channelFilter,
            })
            if (res.success) {
                setData(res)
            } else {
                toast.error(res.error || 'Lỗi khi tải dữ liệu Telesales')
            }
        } catch {
            toast.error('Lỗi kết nối máy chủ')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadDashboard()
    }, [channelFilter])

    // Filtered team matrix based on channel filter
    const filteredTeam = useMemo(() => {
        if (!data?.teamMatrix) return []
        return data.teamMatrix.filter(m => {
            if (channelFilter !== 'ALL' && m.channel !== channelFilter) return false
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase()
                return m.repName.toLowerCase().includes(q) || m.repEmail.toLowerCase().includes(q)
            }
            return true
        })
    }, [data?.teamMatrix, channelFilter, searchQuery])

    // Filtered call logs
    const filteredLogs = useMemo(() => {
        if (!data?.recentCallLogs) return []
        return data.recentCallLogs.filter(log => {
            if (channelFilter !== 'ALL' && log.channel !== channelFilter) return false
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase()
                return (
                    log.prospectName.toLowerCase().includes(q) ||
                    log.phone.includes(q) ||
                    (log.prospectCompany && log.prospectCompany.toLowerCase().includes(q)) ||
                    (log.customerName && log.customerName.toLowerCase().includes(q)) ||
                    log.salespersonName.toLowerCase().includes(q) ||
                    (log.notes && log.notes.toLowerCase().includes(q))
                )
            }
            return true
        })
    }, [data?.recentCallLogs, channelFilter, searchQuery])

    // Customer selection in logger
    const handleSelectExistingCustomer = (custId: string) => {
        setSelectedCustomerId(custId)
        const cust = data?.customersList.find(c => c.id === custId)
        if (cust) {
            setProspectName(cust.name)
            setPhone(cust.phone || '')
            setLoggerChannel(cust.channel === 'CORPORATE' ? 'CORPORATE' : 'RETAIL')
        }
    }

    const handleOpenLogger = (prefChannel?: 'CORPORATE' | 'RETAIL') => {
        setLoggerChannel(prefChannel || (channelFilter !== 'ALL' ? channelFilter : 'CORPORATE'))
        setLoggerCustomerType('PROSPECT')
        setSelectedCustomerId('')
        setProspectName('')
        setProspectCompany('')
        setPhone('')
        setCallType(prefChannel === 'RETAIL' ? 'RETAIL_CARE' : 'CORPORATE_GIFT')
        setOutcome('CONNECTED_INTERESTED')
        setNotes('')
        setFollowUpDate('')
        setLoggerOpen(true)
    }

    const handleSubmitCall = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!phone.trim() || phone.trim().length < 8) {
            toast.error('Vui lòng nhập số điện thoại hợp lệ (tối thiểu 8 số)')
            return
        }
        if (!prospectName.trim()) {
            toast.error('Vui lòng nhập tên người liên hệ / khách hàng')
            return
        }

        setSavingCall(true)
        try {
            const res = await logSalesCallAction({
                channel: loggerChannel,
                customerId: loggerCustomerType === 'EXISTING' ? selectedCustomerId : undefined,
                prospectName: prospectName.trim(),
                prospectCompany: loggerChannel === 'CORPORATE' ? prospectCompany.trim() : undefined,
                phone: phone.trim(),
                callType,
                outcome,
                notes: notes.trim(),
                followUpDate: followUpDate || undefined,
            })

            if (res.success) {
                toast.success('Đã lưu nhật ký cuộc gọi thành công!')
                setLoggerOpen(false)
                loadDashboard()
            } else {
                toast.error(res.error || 'Lỗi khi lưu cuộc gọi')
            }
        } catch {
            toast.error('Lỗi kết nối máy chủ')
        } finally {
            setSavingCall(false)
        }
    }

    // Save KPI Quota
    const handleSaveQuota = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!targetRepId) {
            toast.error('Vui lòng chọn nhân viên')
            return
        }
        setSavingQuota(true)
        try {
            const res = await setSalesQuotaAction({
                salesRepId: targetRepId,
                year: data?.currentYear || new Date().getFullYear(),
                month: data?.currentMonth || (new Date().getMonth() + 1),
                dailyCallTarget: Number(dailyCallTargetInput),
                monthlyLeadTarget: Number(monthlyLeadTargetInput),
                monthlyDealTarget: Number(monthlyDealTargetInput),
            })
            if (res.success) {
                toast.success('Đã cập nhật chỉ tiêu KPI thành công!')
                setQuotaModalOpen(false)
                loadDashboard()
            } else {
                toast.error(res.error || 'Lỗi khi lưu KPI')
            }
        } catch {
            toast.error('Lỗi kết nối máy chủ')
        } finally {
            setSavingQuota(false)
        }
    }

    // Convert Prospect to Customer
    const handleConvertCustomer = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!convertingLog) return
        setSavingConvert(true)
        try {
            const res = await convertProspectToCustomerAction({
                callLogId: convertingLog.id,
                customerName: convertingLog.prospectName,
                companyName: convertingLog.prospectCompany || undefined,
                phone: convertingLog.phone,
                channel: convertingLog.channel as any,
                taxId: convertTaxId.trim() || undefined,
                address: convertAddress.trim() || undefined,
            })
            if (res.success) {
                toast.success(`Đã tạo thành công khách hàng mới: [${res.code}]`)
                setConvertModalOpen(false)
                setConvertingLog(null)
                loadDashboard()
            } else {
                toast.error(res.error || 'Lỗi khi chuyển đổi khách hàng')
            }
        } catch {
            toast.error('Lỗi kết nối máy chủ')
        } finally {
            setSavingConvert(false)
        }
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            {/* 1. Header Toolbar & Quick Actions */}
            <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-md bg-teal-500/10 text-teal-600">
                            <PhoneCall size={20} />
                        </span>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                                    Mục Tiêu Tìm Kiếm & Cuộc Gọi Bán Hàng
                                </h3>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-mono">
                                    Telesales & Prospecting Hub
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Quản lý định mức cuộc gọi ngày, kế hoạch tiếp cận khách hàng mới Corporate (B2B) & Retail (B2C)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {data?.isManager && (
                        <button
                            type="button"
                            onClick={() => {
                                if (data?.teamMatrix[0]) {
                                    setTargetRepId(data.teamMatrix[0].repId)
                                    setDailyCallTargetInput(data.teamMatrix[0].dailyCallTarget)
                                    setMonthlyLeadTargetInput(data.teamMatrix[0].monthlyLeadTarget)
                                    setMonthlyDealTargetInput(data.teamMatrix[0].monthlyDealTarget)
                                }
                                setQuotaModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200"
                        >
                            <Target size={14} className="text-teal-600" />
                            <span>Thiết Lập Chỉ Tiêu KPI</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => handleOpenLogger('CORPORATE')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                        <Plus size={14} />
                        <span>+ Ghi Cuộc Gọi Mới</span>
                    </button>

                    <button
                        type="button"
                        onClick={loadDashboard}
                        disabled={loading}
                        className="p-2 rounded-md border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
                        title="Làm mới dữ liệu"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* View Sub-Tab Switcher */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 border border-slate-200 w-fit">
                <button
                    type="button"
                    onClick={() => setActiveSubTab('planner')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition cursor-pointer ${
                        activeSubTab === 'planner'
                            ? 'bg-white text-teal-700 shadow-xs border border-slate-200/60'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <CalendarCheck size={14} className={activeSubTab === 'planner' ? 'text-teal-600' : 'text-slate-400'} />
                    <span>📋 Kế Hoạch Cuộc Gọi Trong Ngày (To-Call List)</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSubTab('metrics')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition cursor-pointer ${
                        activeSubTab === 'metrics'
                            ? 'bg-white text-teal-700 shadow-xs border border-slate-200/60'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <TrendingUp size={14} className={activeSubTab === 'metrics' ? 'text-teal-600' : 'text-slate-400'} />
                    <span>📊 Tổng Quan & Chỉ Tiêu Đội Ngũ</span>
                </button>
            </div>

            {/* Sub-Tab 1: Daily Calling Planner & Quick Call with Auto-Report */}
            {activeSubTab === 'planner' && (
                <DailyCallPlannerView
                    isManager={data?.isManager || false}
                    currentUserId={data?.currentUserId}
                    customersList={data?.customersList}
                    onCallCompleted={loadDashboard}
                />
            )}

            {/* Sub-Tab 2: Metrics, Leaderboard & Live Call Activity Feed */}
            {activeSubTab === 'metrics' && (
                <div className="space-y-5 animate-in fade-in duration-200">
            {/* 2. Top Channel Filter & 4 KPI Metric Cards */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Channel Switcher */}
                <div className="flex items-center gap-1 p-1 rounded-md bg-white border border-slate-200 shadow-2xs">
                    <button
                        type="button"
                        onClick={() => setChannelFilter('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            channelFilter === 'ALL'
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        Toàn Bộ Đội Ngũ
                    </button>
                    <button
                        type="button"
                        onClick={() => setChannelFilter('CORPORATE')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            channelFilter === 'CORPORATE'
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <Building2 size={13} />
                        <span>Corporate (Doanh Nghiệp)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setChannelFilter('RETAIL')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                            channelFilter === 'RETAIL'
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                        <Users size={13} />
                        <span>Retail (Khách Lẻ VIP)</span>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[240px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Tìm nhân viên, khách hàng, SĐT..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 outline-none focus:border-teal-500 transition shadow-2xs"
                    />
                </div>
            </div>

            {/* 4 Metric Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-md bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
                        <PhoneCall size={20} />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Cuộc Gọi Hôm Nay
                        </p>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                                {data?.stats.totalCallsToday || 0}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                                (🏢 {data?.stats.corporateCallsToday || 0} • 🍷 {data?.stats.retailCallsToday || 0})
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={20} />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Tỷ Lệ Kết Nối Thành Công
                        </p>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
                                {data?.stats.connectionRate || 0}%
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                                ({data?.stats.connectedCallsToday || 0} cuộc)
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                        <UserPlus size={20} />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Lead Mới Tìm Được (Tháng)
                        </p>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                                {data?.stats.leadsFoundThisMonth || 0}
                            </span>
                            <span className="text-[11px] text-slate-500">khách tiềm năng</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Cơ Hội (Deals) Mới (Tháng)
                        </p>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                                {data?.stats.dealsCreatedThisMonth || 0}
                            </span>
                            <span className="text-[11px] text-slate-500">cơ hội bán hàng</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Team Daily Progress & Matrix Table */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Award size={18} className="text-teal-600" />
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">
                            Bảng Theo Dõi Cuộc Gọi & Chỉ Tiêu Tìm Kiếm Khách Hàng
                        </h4>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                        Hôm nay: {data?.todayStr || '2026-09-25'}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                                <th className="p-3.5 pl-5">Nhân viên Sales</th>
                                <th className="p-3.5">Kênh phụ trách</th>
                                <th className="p-3.5 text-center">Tiến độ cuộc gọi hôm nay</th>
                                <th className="p-3.5 text-center">Cuộc gọi kết nối</th>
                                <th className="p-3.5 text-center">Lead mới (Tháng)</th>
                                <th className="p-3.5 text-center">Deals tạo mới</th>
                                <th className="p-3.5 text-right pr-5">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTeam.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400">
                                        Không tìm thấy nhân viên bán hàng nào phù hợp bộ lọc.
                                    </td>
                                </tr>
                            ) : (
                                filteredTeam.map(rep => {
                                    const isReached = rep.callsToday >= rep.dailyCallTarget
                                    return (
                                        <tr key={rep.repId} className="hover:bg-slate-50/70 transition">
                                            {/* Rep Info */}
                                            <td className="p-3.5 pl-5">
                                                <div className="font-bold text-slate-900">{rep.repName}</div>
                                                <div className="text-[11px] text-slate-400 font-mono">{rep.repEmail}</div>
                                            </td>

                                            {/* Channel Badge */}
                                            <td className="p-3.5">
                                                {rep.channel === 'CORPORATE' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                        <Building2 size={11} /> Corporate
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        <Users size={11} /> Retail
                                                    </span>
                                                )}
                                            </td>

                                            {/* Daily Progress */}
                                            <td className="p-3.5 text-center">
                                                <div className="inline-block w-44">
                                                    <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                                                        <span className="font-bold text-slate-800">
                                                            {rep.callsToday} / {rep.dailyCallTarget} cuộc
                                                        </span>
                                                        <span className={`font-black ${isReached ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                            {rep.todayProgressPct}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/60">
                                                        <div
                                                            className={`h-full transition-all duration-300 rounded-full ${
                                                                isReached ? 'bg-emerald-500' : 'bg-teal-500'
                                                            }`}
                                                            style={{ width: `${Math.min(100, rep.todayProgressPct)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Connected calls */}
                                            <td className="p-3.5 text-center font-mono">
                                                <span className="font-bold text-emerald-600">{rep.connectedToday}</span>
                                                <span className="text-slate-400 text-[11px]"> / {rep.callsToday}</span>
                                            </td>

                                            {/* Leads target vs actual */}
                                            <td className="p-3.5 text-center font-mono">
                                                <span className="font-bold text-slate-800">{rep.leadsFoundMonth}</span>
                                                <span className="text-slate-400 text-[11px]"> / {rep.monthlyLeadTarget} KH</span>
                                            </td>

                                            {/* Deals count */}
                                            <td className="p-3.5 text-center font-mono">
                                                <span className="font-bold text-slate-800">{rep.dealsCreatedMonth}</span>
                                                <span className="text-slate-400 text-[11px]"> / {rep.monthlyDealTarget} deal</span>
                                            </td>

                                            {/* Action buttons */}
                                            <td className="p-3.5 text-right pr-5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setLoggerChannel(rep.channel === 'CORPORATE' ? 'CORPORATE' : 'RETAIL')
                                                            handleOpenLogger(rep.channel === 'CORPORATE' ? 'CORPORATE' : 'RETAIL')
                                                        }}
                                                        className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold transition cursor-pointer"
                                                        title="Ghi cuộc gọi cho nhân viên này"
                                                    >
                                                        + Gọi
                                                    </button>
                                                    {data?.isManager && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setTargetRepId(rep.repId)
                                                                setDailyCallTargetInput(rep.dailyCallTarget)
                                                                setMonthlyLeadTargetInput(rep.monthlyLeadTarget)
                                                                setMonthlyDealTargetInput(rep.monthlyDealTarget)
                                                                setQuotaModalOpen(true)
                                                            }}
                                                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                                            title="Chỉnh sửa KPI"
                                                        >
                                                            <Target size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Live Call Feed (Nhật Ký Cuộc Gọi Trực Tiếp) */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">
                            Nhật Ký Cuộc Gọi Thực Hiện Gần Nhất
                        </h4>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                        {filteredLogs.length} cuộc gọi ghi nhận
                    </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                    {filteredLogs.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                            Chưa có cuộc gọi nào được ghi nhận trong khoảng thời gian này.
                        </div>
                    ) : (
                        filteredLogs.map(log => {
                            const outcomeCfg = CALL_OUTCOMES.find(o => o.id === log.outcome) || CALL_OUTCOMES[0]
                            const OutcomeIcon = outcomeCfg.icon
                            const callTime = new Date(log.calledAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                            const callDate = new Date(log.calledAt).toLocaleDateString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit'
                            })

                            return (
                                <div key={log.id} className="p-3.5 sm:p-4 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div
                                            className="w-10 h-10 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                                            style={{ background: outcomeCfg.bg, color: outcomeCfg.color }}
                                        >
                                            <OutcomeIcon size={18} />
                                        </div>

                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${outcomeCfg.badgeClass}`}>
                                                    {outcomeCfg.shortLabel}
                                                </span>

                                                {log.channel === 'CORPORATE' ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                        🏢 Corporate
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        🍷 Retail
                                                    </span>
                                                )}

                                                <span className="font-bold text-xs text-slate-900 truncate">
                                                    {log.prospectName}
                                                </span>

                                                {log.prospectCompany && (
                                                    <span className="text-xs text-slate-500 font-medium">
                                                        – {log.prospectCompany}
                                                    </span>
                                                )}

                                                {log.customerCode && (
                                                    <span className="text-[10px] font-mono text-teal-600 font-bold bg-teal-50 px-1.5 py-0.2 rounded">
                                                        [{log.customerCode}]
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono flex-wrap">
                                                <span className="text-slate-800 font-bold flex items-center gap-1">
                                                    <Phone size={11} className="text-teal-600" />
                                                    {log.phone}
                                                </span>
                                                <span>• Sale: <strong>{log.salespersonName}</strong></span>
                                                <span>• {log.callType}</span>
                                                <span>• {callTime}, {callDate}</span>
                                            </div>

                                            {log.notes && (
                                                <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-md border border-slate-200/80">
                                                    💬 {log.notes}
                                                </div>
                                            )}

                                            {log.followUpDate && (
                                                <div className="text-[11px] text-amber-700 font-medium flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md inline-flex border border-amber-200">
                                                    <Calendar size={11} />
                                                    Lịch hẹn gọi lại: {new Date(log.followUpDate).toLocaleString('vi-VN')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action button: Convert to Customer if not linked */}
                                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                        {!log.customerId ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setConvertingLog(log)
                                                    setConvertTaxId('')
                                                    setConvertAddress('')
                                                    setConvertModalOpen(true)
                                                }}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold transition cursor-pointer border border-teal-200"
                                            >
                                                <UserPlus size={13} />
                                                <span>+ Mở Mã Khách</span>
                                            </button>
                                        ) : (
                                            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                                <Check size={12} /> Đã có hồ sơ KH
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
            </div>
            )}

            {/* ============================================================== */}
            {/* MODAL 1: QUICK CALL LOGGER FORM */}
            {/* ============================================================== */}
            {loggerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div
                        className="w-full max-w-lg bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-md bg-teal-500/10 text-teal-600">
                                    <PhoneCall size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Ghi Nhanh Nhật Ký Cuộc Gọi
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Ghi nhận ngay sau khi kết thúc cuộc đàm thoại với khách hàng
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLoggerOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSubmitCall} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                            {/* Kênh bán hàng */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1.5">
                                    Kênh Bán Hàng <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setLoggerChannel('CORPORATE')}
                                        className={`p-2.5 rounded-md border font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                                            loggerChannel === 'CORPORATE'
                                                ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-2xs'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Building2 size={15} />
                                        <span>Corporate (Doanh Nghiệp)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLoggerChannel('RETAIL')}
                                        className={`p-2.5 rounded-md border font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                                            loggerChannel === 'RETAIL'
                                                ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-2xs'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Users size={15} />
                                        <span>Retail (Khách Lẻ VIP)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Khách hàng có sẵn hay Prospect mới */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="font-bold text-slate-700">
                                        Đối tượng liên hệ <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setLoggerCustomerType('PROSPECT')}
                                            className={`text-[11px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                                                loggerCustomerType === 'PROSPECT' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            Đầu Mối Mới (Prospect)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLoggerCustomerType('EXISTING')}
                                            className={`text-[11px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                                                loggerCustomerType === 'EXISTING' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            Khách Hàng Có Sẵn
                                        </button>
                                    </div>
                                </div>

                                {loggerCustomerType === 'EXISTING' ? (
                                    <select
                                        value={selectedCustomerId}
                                        onChange={e => handleSelectExistingCustomer(e.target.value)}
                                        className="w-full p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500 font-bold"
                                    >
                                        <option value="">-- Chọn khách hàng từ hệ thống --</option>
                                        {data?.customersList.map(c => (
                                            <option key={c.id} value={c.id}>
                                                [{c.code}] {c.name} {c.phone ? `(${c.phone})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div>
                                            <label className="block text-slate-500 text-[11px] mb-1">
                                                Tên người liên hệ / Người nhận quà
                                            </label>
                                            <input
                                                type="text"
                                                value={prospectName}
                                                onChange={e => setProspectName(e.target.value)}
                                                placeholder="VD: Anh Minh / Chị Linh HR"
                                                className="w-full p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 text-[11px] mb-1">
                                                Tên Công Ty / Đơn Vị (nếu có)
                                            </label>
                                            <input
                                                type="text"
                                                value={prospectCompany}
                                                onChange={e => setProspectCompany(e.target.value)}
                                                placeholder="VD: Tập đoàn X / Công ty Y"
                                                className="w-full p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Số điện thoại */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Số điện thoại gọi <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="VD: 0912345678"
                                    className="w-full p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 font-mono outline-none focus:border-teal-500"
                                    required
                                />
                            </div>

                            {/* Loại cuộc gọi */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Mục Đích / Phân Loại Cuộc Gọi <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={callType}
                                    onChange={e => setCallType(e.target.value)}
                                    className="w-full p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500 font-semibold"
                                >
                                    {CALL_TYPES.map(t => (
                                        <option key={t.id} value={t.label}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Kết quả cuộc gọi (Chip 1-chạm) */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1.5">
                                    Kết Quả Cuộc Gọi <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CALL_OUTCOMES.map(o => {
                                        const isSelected = outcome === o.id
                                        return (
                                            <button
                                                key={o.id}
                                                type="button"
                                                onClick={() => setOutcome(o.id)}
                                                className={`p-2.5 rounded-md border text-left flex items-start gap-2 cursor-pointer transition ${
                                                    isSelected
                                                        ? 'bg-teal-50/80 border-teal-500 text-teal-900 shadow-2xs ring-1 ring-teal-500/20'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                                                    style={{ background: o.color }}
                                                />
                                                <div className="min-w-0">
                                                    <div className="font-bold text-[11px] truncate">
                                                        {o.shortLabel}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 line-clamp-1">
                                                        {o.label}
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Ghi chú chi tiết */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Ghi Chú Trao Đổi
                                </label>
                                <textarea
                                    rows={2}
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Khách cần báo giá set 100 hộp quà Tết vang Ý, ngân sách 1tr - 1.5tr/hộp..."
                                    className="w-full p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500 resize-y"
                                />
                            </div>

                            {/* Lịch hẹn gọi lại nếu bận */}
                            {outcome === 'CONNECTED_BUSY_CALLBACK' || outcome === 'CONNECTED_MEETING_SET' ? (
                                <div className="p-3 rounded-md bg-amber-50/60 border border-amber-200 space-y-1">
                                    <label className="block font-bold text-amber-900 text-[11px]">
                                        📅 Đặt Lịch Hẹn / Gọi Lại
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={followUpDate}
                                        onChange={e => setFollowUpDate(e.target.value)}
                                        className="w-full p-2 rounded-lg bg-white border border-amber-300 text-slate-900 text-xs outline-none"
                                    />
                                </div>
                            ) : null}

                            {/* Modal Footer */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setLoggerOpen(false)}
                                    className="px-4 py-2 rounded-md text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingCall}
                                    className="px-5 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    {savingCall ? 'Đang lưu...' : 'Lưu Cuộc Gọi'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL 2: SET SALES QUOTA & TARGETS (MANAGER ONLY) */}
            {/* ============================================================== */}
            {quotaModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div
                        className="w-full max-w-md bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-md bg-teal-500/10 text-teal-600">
                                    <Target size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Thiết Lập Chỉ Tiêu KPI Bán Hàng
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Phân bổ chỉ tiêu cuộc gọi ngày và mục tiêu tìm kiếm khách hàng
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setQuotaModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveQuota} className="p-4 sm:p-5 space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Nhân Viên Sales <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={targetRepId}
                                    onChange={e => {
                                        setTargetRepId(e.target.value)
                                        const rep = data?.teamMatrix.find(m => m.repId === e.target.value)
                                        if (rep) {
                                            setDailyCallTargetInput(rep.dailyCallTarget)
                                            setMonthlyLeadTargetInput(rep.monthlyLeadTarget)
                                            setMonthlyDealTargetInput(rep.monthlyDealTarget)
                                        }
                                    }}
                                    className="w-full p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 font-bold outline-none"
                                >
                                    {data?.teamMatrix.map(m => (
                                        <option key={m.repId} value={m.repId}>
                                            {m.repName} ({m.channel === 'CORPORATE' ? 'Corporate' : 'Retail'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Định mức cuộc gọi tối thiểu / ngày (cuộc)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={dailyCallTargetInput}
                                    onChange={e => setDailyCallTargetInput(Number(e.target.value))}
                                    className="w-full p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold outline-none"
                                    required
                                />
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                    Khuyến nghị: Corporate 10–15 cuộc/ngày; Retail 20–30 cuộc/ngày
                                </span>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Chỉ tiêu Lead mới tìm kiếm trong tháng (Khách Hàng)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={200}
                                    value={monthlyLeadTargetInput}
                                    onChange={e => setMonthlyLeadTargetInput(Number(e.target.value))}
                                    className="w-full p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Chỉ tiêu Cơ Hội (Deals / Opps) tạo mới trong tháng
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={monthlyDealTargetInput}
                                    onChange={e => setMonthlyDealTargetInput(Number(e.target.value))}
                                    className="w-full p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold outline-none"
                                    required
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setQuotaModalOpen(false)}
                                    className="px-4 py-2 rounded-md text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingQuota}
                                    className="px-5 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-bold transition shadow-xs cursor-pointer"
                                >
                                    {savingQuota ? 'Đang lưu...' : 'Lưu Chỉ Tiêu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL 3: CONVERT PROSPECT TO ACTIVE CUSTOMER */}
            {/* ============================================================== */}
            {convertModalOpen && convertingLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div
                        className="w-full max-w-md bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-md bg-teal-500/10 text-teal-600">
                                    <UserPlus size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Mở Mã Khách Hàng Từ Cuộc Gọi
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Chuyển đầu mối tiềm năng thành khách hàng chính thức trên ERP
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setConvertModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleConvertCustomer} className="p-4 sm:p-5 space-y-3.5 text-xs">
                            <div className="p-3 rounded-md bg-teal-50/70 border border-teal-200/80 space-y-1">
                                <div className="font-bold text-slate-900 text-sm">
                                    {convertingLog.prospectName}
                                </div>
                                {convertingLog.prospectCompany && (
                                    <div className="text-slate-600 font-medium">
                                        Công ty: {convertingLog.prospectCompany}
                                    </div>
                                )}
                                <div className="font-mono text-teal-700">
                                    SĐT: {convertingLog.phone} • Kênh: {convertingLog.channel}
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Mã Số Thuế (nếu có hóa đơn VAT)
                                </label>
                                <input
                                    type="text"
                                    value={convertTaxId}
                                    onChange={e => setConvertTaxId(e.target.value)}
                                    placeholder="VD: 0101234567"
                                    className="w-full p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 font-mono outline-none focus:border-teal-500"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Địa Chỉ Giao Hàng / Văn Phòng
                                </label>
                                <input
                                    type="text"
                                    value={convertAddress}
                                    onChange={e => setConvertAddress(e.target.value)}
                                    placeholder="VD: Tòa nhà Keangnam, Mễ Trì, Nam Từ Liêm, HN"
                                    className="w-full p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setConvertModalOpen(false)}
                                    className="px-4 py-2 rounded-md text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingConvert}
                                    className="px-5 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    {savingConvert ? 'Đang tạo...' : 'Tạo Khách Hàng Ngay'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
