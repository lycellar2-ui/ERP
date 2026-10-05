'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    Phone, PhoneCall, CheckCircle2, Clock, Users, Building2, UserPlus,
    Target, Calendar, Search, Filter, Plus, RefreshCw, X, Download,
    Sparkles, AlertCircle, Check, Smartphone, ArrowRight, Trash2,
    CalendarCheck, UserCheck, PhoneMissed, PhoneOff, MoreVertical
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ui'
import {
    SalesCallPlanItem,
    getDailyCallPlanAction,
    createCallPlanItemAction,
    assignCallPlanBatchAction,
    completeCallPlanWithReportAction,
    updateCallPlanStatusAction,
    deleteCallPlanItemAction
} from './actions'

interface DailyCallPlannerViewProps {
    isManager: boolean
    currentUserId?: string
    customersList?: Array<{ id: string; code: string; name: string; channel: string; phone: string | null }>
    onCallCompleted?: () => void
}

const CALL_OUTCOMES_CFG = [
    {
        id: 'CONNECTED_INTERESTED',
        label: 'Quan tâm báo giá / Muốn nhận mẫu',
        shortLabel: 'Quan tâm',
        color: '#0891B2',
        bg: 'rgba(8, 145, 178, 0.1)',
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
        icon: Sparkles
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
        id: 'CONNECTED_MEETING_SET',
        label: 'Đã chốt lịch hẹn gặp / Thử rượu (Tasting)',
        shortLabel: 'Chốt hẹn',
        color: '#15803D',
        bg: 'rgba(5, 150, 105, 0.1)',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: Calendar
    },
    {
        id: 'CONNECTED_BUSY_CALLBACK',
        label: 'Khách bận – Hẹn gọi lại vào lúc khác',
        shortLabel: 'Hẹn gọi lại',
        color: '#D97706',
        bg: 'rgba(217, 119, 6, 0.1)',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Clock
    },
    {
        id: 'NOT_ANSWERED_MISSED',
        label: 'Không nghe máy / Máy bận / Thuê bao',
        shortLabel: 'Không nghe máy',
        color: '#64748B',
        bg: 'rgba(100, 116, 139, 0.1)',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        icon: PhoneMissed
    },
    {
        id: 'WRONG_NUMBER_INVALID',
        label: 'Từ chối / Sai số / Không có nhu cầu',
        shortLabel: 'Từ chối / Sai số',
        color: '#B91C1C',
        bg: 'rgba(185,28,28, 0.1)',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: PhoneOff
    },
]

export function DailyCallPlannerView({
    isManager,
    currentUserId,
    customersList = [],
    onCallCompleted
}: DailyCallPlannerViewProps) {
    const todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())

    // Filters
    const [planDate, setPlanDate] = useState(todayDateStr)
    const [channelFilter, setChannelFilter] = useState<'ALL' | 'CORPORATE' | 'RETAIL'>('ALL')
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'RESCHEDULED' | 'OVERDUE'>('ALL')
    const [selectedRepId, setSelectedRepId] = useState<string>('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    // Data
    const [loading, setLoading] = useState(false)
    const [plans, setPlans] = useState<SalesCallPlanItem[]>([])
    const [salesReps, setSalesReps] = useState<Array<{ id: string; name: string; email: string }>>([])
    const [stats, setStats] = useState({
        totalPlanned: 0,
        completed: 0,
        pending: 0,
        rescheduled: 0,
        overdue: 0,
        completionRate: 0,
        corporatePlanned: 0,
        retailPlanned: 0
    })

    // Modals
    const [addModalOpen, setAddModalOpen] = useState(false)
    const [assignBatchModalOpen, setAssignBatchModalOpen] = useState(false)
    const [reportModalOpen, setReportModalOpen] = useState(false)

    // Add Single Plan State
    const [newChannel, setNewChannel] = useState<'CORPORATE' | 'RETAIL'>('CORPORATE')
    const [newTargetRepId, setNewTargetRepId] = useState('')
    const [newCustType, setNewCustType] = useState<'EXISTING' | 'PROSPECT'>('PROSPECT')
    const [newCustomerId, setNewCustomerId] = useState('')
    const [newProspectName, setNewProspectName] = useState('')
    const [newProspectCompany, setNewProspectCompany] = useState('')
    const [newPhone, setNewPhone] = useState('')
    const [newCallType, setNewCallType] = useState('Chào hàng danh mục vang mới')
    const [newPriority, setNewPriority] = useState<'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'>('NORMAL')
    const [newScheduledTime, setNewScheduledTime] = useState('')
    const [newNotes, setNewNotes] = useState('')
    const [savingSingle, setSavingSingle] = useState(false)

    // Batch Assign State (Manager)
    const [batchTargetRepIds, setBatchTargetRepIds] = useState<string[]>([])
    const [batchChannel, setBatchChannel] = useState<'CORPORATE' | 'RETAIL'>('CORPORATE')
    const [batchCustomerIds, setBatchCustomerIds] = useState<string[]>([])
    const [batchCustomLeadsText, setBatchCustomLeadsText] = useState('')
    const [batchCallType, setBatchCallType] = useState('Chăm sóc khách hàng định kỳ')
    const [batchPriority, setBatchPriority] = useState<'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'>('NORMAL')
    const [batchNotes, setBatchNotes] = useState('')
    const [savingBatch, setSavingBatch] = useState(false)

    // Call Report & Tracking State
    const [activePlan, setActivePlan] = useState<SalesCallPlanItem | null>(null)
    const [activeCallStartTime, setActiveCallStartTime] = useState<number | null>(null)
    const [reportOutcome, setReportOutcome] = useState('CONNECTED_INTERESTED')
    const [reportDuration, setReportDuration] = useState(3)
    const [reportNotes, setReportNotes] = useState('')
    const [reportFollowUpDate, setReportFollowUpDate] = useState('')
    const [savingReport, setSavingReport] = useState(false)

    // Load Plan Action
    const loadPlans = async () => {
        setLoading(true)
        try {
            const res = await getDailyCallPlanAction({
                date: planDate,
                salesRepId: selectedRepId === 'ALL' ? undefined : selectedRepId,
                status: statusFilter === 'ALL' ? undefined : statusFilter,
                channel: channelFilter === 'ALL' ? undefined : channelFilter,
            })
            if (res.success) {
                setPlans(res.plans)
                setStats(res.stats)
                if (res.salesReps && res.salesReps.length > 0) {
                    setSalesReps(res.salesReps)
                }
            } else {
                toast.error(res.error || 'Lỗi tải danh sách kế hoạch gọi')
            }
        } catch {
            toast.error('Lỗi kết nối máy chủ')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadPlans()
    }, [planDate, selectedRepId, statusFilter, channelFilter])

    // =========================================================================
    // MOBILE CLICK-TO-CALL TRACKING & AUTO-POPUP DETECTION
    // =========================================================================
    const handleInitiateCall = (plan: SalesCallPlanItem) => {
        setActivePlan(plan)
        setActiveCallStartTime(Date.now())
        setReportOutcome('CONNECTED_INTERESTED')
        setReportNotes(plan.notes ? `Tiếp nối ghi chú: ${plan.notes}` : '')
        setReportFollowUpDate('')

        // Trigger phone dialer on mobile device
        const cleanPhone = plan.phone.replace(/\s+/g, '')
        window.location.href = `tel:${cleanPhone}`
    }

    // Auto-detect when user returns from Phone app
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && activePlan && activeCallStartTime) {
                const elapsedMs = Date.now() - activeCallStartTime
                // Away for >= 2.5 seconds indicates user opened the dialer
                if (elapsedMs >= 2500) {
                    const estMinutes = Math.max(1, Math.round(elapsedMs / 60000))
                    setReportDuration(estMinutes)
                    setReportModalOpen(true)
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [activePlan, activeCallStartTime])

    // Manual Open Report
    const handleOpenManualReport = (plan: SalesCallPlanItem) => {
        setActivePlan(plan)
        setActiveCallStartTime(null)
        setReportOutcome(plan.callOutcome || 'CONNECTED_INTERESTED')
        setReportDuration(plan.callDurationMinutes || 3)
        setReportNotes(plan.notes || '')
        setReportFollowUpDate('')
        setReportModalOpen(true)
    }

    // Save Call Report
    const handleSaveCallReport = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activePlan) return
        setSavingReport(true)
        try {
            const res = await completeCallPlanWithReportAction({
                planId: activePlan.id,
                outcome: reportOutcome,
                durationMinutes: Number(reportDuration),
                notes: reportNotes.trim() || undefined,
                followUpDate: reportFollowUpDate || undefined,
            })
            if (res.success) {
                toast.success(`Đã lưu báo cáo cuộc gọi với [${activePlan.prospectName}] thành công!`)
                setReportModalOpen(false)
                setActivePlan(null)
                setActiveCallStartTime(null)
                loadPlans()
                if (onCallCompleted) onCallCompleted()
            } else {
                toast.error(res.error || 'Lỗi khi lưu báo cáo cuộc gọi')
            }
        } catch {
            toast.error('Lỗi kết nối máy chủ')
        } finally {
            setSavingReport(false)
        }
    }

    // Save Single Plan Item
    const handleSaveSinglePlan = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newPhone.trim() || !newProspectName.trim()) {
            toast.error('Vui lòng nhập tên khách hàng và số điện thoại')
            return
        }
        setSavingSingle(true)
        try {
            const res = await createCallPlanItemAction({
                salespersonId: (isManager && newTargetRepId) ? newTargetRepId : undefined,
                planDate,
                channel: newChannel,
                customerId: newCustType === 'EXISTING' ? newCustomerId : undefined,
                prospectName: newProspectName,
                prospectCompany: newProspectCompany || undefined,
                phone: newPhone,
                callType: newCallType,
                priority: newPriority,
                notes: newNotes || undefined,
                scheduledTime: newScheduledTime || undefined,
            })
            if (res.success) {
                toast.success('Đã thêm khách vào kế hoạch gọi hôm nay!')
                setAddModalOpen(false)
                // Reset form
                setNewProspectName('')
                setNewProspectCompany('')
                setNewPhone('')
                setNewNotes('')
                setNewScheduledTime('')
                setNewCustomerId('')
                loadPlans()
            } else {
                toast.error(res.error || 'Lỗi khi tạo mục kế hoạch')
            }
        } catch {
            toast.error('Lỗi kết nối máy chủ')
        } finally {
            setSavingSingle(false)
        }
    }

    // Save Batch Assignment
    const handleSaveBatchAssign = async (e: React.FormEvent) => {
        e.preventDefault()
        if (batchTargetRepIds.length === 0) {
            toast.error('Vui lòng chọn ít nhất 1 Telesale nhận việc')
            return
        }

        // Parse custom leads text if any (Format: Name, Company, Phone)
        const customLeads: Array<{ name: string; company?: string; phone: string }> = []
        if (batchCustomLeadsText.trim()) {
            const lines = batchCustomLeadsText.split('\n')
            for (const line of lines) {
                const parts = line.split(',').map(s => s.trim())
                if (parts.length >= 2) {
                    const name = parts[0]
                    const phone = parts[parts.length - 1]
                    const company = parts.length > 2 ? parts[1] : undefined
                    if (name && phone) {
                        customLeads.push({ name, company, phone })
                    }
                }
            }
        }

        if (batchCustomerIds.length === 0 && customLeads.length === 0) {
            toast.error('Vui lòng chọn khách hàng CRM hoặc nhập danh sách đầu mối (Tên, SĐT)')
            return
        }

        setSavingBatch(true)
        try {
            const res = await assignCallPlanBatchAction({
                targetSalesRepIds: batchTargetRepIds,
                customerIds: batchCustomerIds,
                customLeads,
                planDate,
                channel: batchChannel,
                callType: batchCallType,
                priority: batchPriority,
                notes: batchNotes || undefined,
            })
            if (res.success) {
                toast.success(`Đã phân bổ thành công ${res.count} khách hàng vào kế hoạch gọi!`)
                setAssignBatchModalOpen(false)
                setBatchCustomerIds([])
                setBatchCustomLeadsText('')
                setBatchNotes('')
                loadPlans()
            } else {
                toast.error(res.error || 'Lỗi khi phân bổ kế hoạch')
            }
        } catch {
            toast.error('Lỗi kết nối máy chủ')
        } finally {
            setSavingBatch(false)
        }
    }

    // Delete Call Plan Item
    const handleDeleteItem = (planId: string, name: string) => {
        confirm({
            title: 'Xóa Khỏi Kế Hoạch Gọi',
            message: `Bạn có chắc muốn xóa khách hàng [${name}] khỏi kế hoạch gọi?`,
            confirmLabel: 'Xóa',
            cancelLabel: 'Bỏ qua',
            danger: true,
            onConfirm: async () => {
                try {
                    const res = await deleteCallPlanItemAction(planId)
                    if (res.success) {
                        toast.success('Đã xóa khỏi kế hoạch')
                        loadPlans()
                    } else {
                        toast.error(res.error || 'Lỗi khi xóa')
                    }
                } catch {
                    toast.error('Lỗi kết nối máy chủ')
                }
            }
        })
    }

    // Export CSV Report
    const handleExportCSV = () => {
        if (plans.length === 0) {
            toast.error('Không có dữ liệu kế hoạch cuộc gọi để xuất')
            return
        }
        const headers = ['Mã/ID', 'Nhân viên Telesale', 'Ngày kế hoạch', 'Kênh', 'Khách hàng/Đầu mối', 'Công ty', 'Số điện thoại', 'Mục đích gọi', 'Mức ưu tiên', 'Trạng thái', 'Khung giờ', 'Kết quả cuộc gọi', 'Thời lượng (phút)', 'Ghi chú']
        const rows = plans.map(p => [
            p.id,
            p.salespersonName,
            p.planDate.split('T')[0],
            p.channel,
            p.customerName || p.prospectName,
            p.prospectCompany || '',
            p.phone,
            p.callType,
            p.priority,
            p.status,
            p.scheduledTime || '',
            p.callOutcome || '',
            p.callDurationMinutes ? String(p.callDurationMinutes) : '',
            p.notes || ''
        ])
        const csvContent = "\ufeff" + [
            headers.join(','),
            ...rows.map(r => r.map(val => `"${(val || '').replace(/"/g, '""')}"`).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `Bao_cao_ke_hoach_cuoc_goi_${planDate}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success('Đã xuất báo cáo kế hoạch cuộc gọi (CSV)!')
    }

    // Filtered plans based on search
    const filteredPlans = useMemo(() => {
        if (!searchQuery.trim()) return plans
        const q = searchQuery.toLowerCase()
        return plans.filter(p =>
            p.prospectName.toLowerCase().includes(q) ||
            p.phone.includes(q) ||
            (p.prospectCompany && p.prospectCompany.toLowerCase().includes(q)) ||
            (p.customerName && p.customerName.toLowerCase().includes(q)) ||
            p.salespersonName.toLowerCase().includes(q) ||
            (p.notes && p.notes.toLowerCase().includes(q))
        )
    }, [plans, searchQuery])

    return (
        <div className="space-y-4">
            {/* Top Toolbar & Filter Bar */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600">
                                <CalendarCheck size={18} />
                            </span>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900">
                                Kế Hoạch Cuộc Gọi Trong Ngày (To-Call List)
                            </h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-bold">
                                Pure Light UI
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Danh sách khách hàng Telesale cần liên hệ theo ngày, tích hợp nút gọi 1-chạm & tự động bật form báo cáo kết quả
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {isManager && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (salesReps[0]) setBatchTargetRepIds([salesReps[0].id])
                                    setAssignBatchModalOpen(true)
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200"
                            >
                                <UserCheck size={14} className="text-teal-600" />
                                <span>Phân Bổ Danh Sách Gọi</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                setNewProspectName('')
                                setNewProspectCompany('')
                                setNewPhone('')
                                setNewCustomerId('')
                                setNewNotes('')
                                setAddModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                            <Plus size={14} />
                            <span>+ Thêm Vào Kế Hoạch</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportCSV}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition border border-slate-200 shadow-2xs cursor-pointer"
                            title="Xuất báo cáo kế hoạch gọi ra file CSV"
                        >
                            <Download size={14} className="text-slate-500" />
                            <span>Xuất CSV</span>
                        </button>

                        <button
                            type="button"
                            onClick={loadPlans}
                            disabled={loading}
                            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
                            title="Làm mới kế hoạch"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Filter Controls Row */}
                <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Date Picker */}
                        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                            <Calendar size={13} className="text-slate-400 ml-1.5" />
                            <input
                                type="date"
                                value={planDate}
                                onChange={e => setPlanDate(e.target.value)}
                                className="bg-transparent text-xs font-mono font-bold text-slate-800 outline-none pr-1.5 cursor-pointer"
                            />
                            {planDate !== todayDateStr && (
                                <button
                                    type="button"
                                    onClick={() => setPlanDate(todayDateStr)}
                                    className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 cursor-pointer"
                                >
                                    Hôm nay
                                </button>
                            )}
                        </div>

                        {/* Channel switcher */}
                        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                            {(['ALL', 'CORPORATE', 'RETAIL'] as const).map(ch => (
                                <button
                                    key={ch}
                                    type="button"
                                    onClick={() => setChannelFilter(ch)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                                        channelFilter === ch
                                            ? 'bg-teal-600 text-white shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {ch === 'ALL' ? 'Tất cả kênh' : ch === 'CORPORATE' ? 'Corporate' : 'Retail'}
                                </button>
                            ))}
                        </div>

                        {/* Status switcher */}
                        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                            {(['ALL', 'PENDING', 'COMPLETED', 'RESCHEDULED'] as const).map(st => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => setStatusFilter(st)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                                        statusFilter === st
                                            ? 'bg-slate-900 text-white shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {st === 'ALL' ? 'Tất cả' : st === 'PENDING' ? 'Chưa gọi' : st === 'COMPLETED' ? 'Đã gọi' : 'Hẹn lại'}
                                </button>
                            ))}
                        </div>

                        {/* Manager Rep Selector */}
                        {isManager && salesReps.length > 0 && (
                            <select
                                value={selectedRepId}
                                onChange={e => setSelectedRepId(e.target.value)}
                                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-1.5 outline-none focus:border-teal-500 cursor-pointer"
                            >
                                <option value="ALL">👤 Toàn bộ Telesale ({salesReps.length})</option>
                                {salesReps.map(rep => (
                                    <option key={rep.id} value={rep.id}>
                                        {rep.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Search query */}
                    <div className="relative min-w-[220px]">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Tìm khách hàng, SĐT, ghi chú..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400 outline-none focus:border-teal-500 transition"
                        />
                    </div>
                </div>
            </div>

            {/* Daily Execution Progress Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
                        <Target size={18} />
                    </div>
                    <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Kế Hoạch Ngày
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                            {stats.totalPlanned} <span className="text-xs font-normal text-slate-500">khách</span>
                        </div>
                    </div>
                </div>

                <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={18} />
                    </div>
                    <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Đã Hoàn Thành
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
                                {stats.completed}
                            </span>
                            <span className="text-xs font-bold text-slate-500 font-mono">
                                ({stats.completionRate}%)
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                        <Clock size={18} />
                    </div>
                    <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Chưa Thực Hiện
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-amber-600 font-mono">
                            {stats.pending} <span className="text-xs font-normal text-slate-500">cuộc</span>
                        </div>
                    </div>
                </div>

                <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                        <Building2 size={18} />
                    </div>
                    <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Phân Bổ Kênh
                        </div>
                        <div className="text-xs font-mono font-bold text-slate-700 mt-1">
                            🏢 {stats.corporatePlanned} Corp • 🍷 {stats.retailPlanned} Ret
                        </div>
                    </div>
                </div>
            </div>

            {/* List of Scheduled Calls (Mobile-first Cards) */}
            <div className="space-y-3">
                {loading ? (
                    <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-teal-600" />
                        <span className="text-xs font-medium">Đang tải danh sách kế hoạch gọi...</span>
                    </div>
                ) : filteredPlans.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-3">
                        <PhoneCall size={36} className="mx-auto text-slate-300" />
                        <div className="text-sm font-bold text-slate-700">
                            Chưa có khách hàng nào trong kế hoạch gọi ngày này
                        </div>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                            Telesale có thể bấm <strong>[+ Thêm Vào Kế Hoạch]</strong> để chọn khách chăm sóc hoặc Quản lý bấm <strong>[Phân Bổ Danh Sách Gọi]</strong> để giao việc.
                        </p>
                        <button
                            type="button"
                            onClick={() => setAddModalOpen(true)}
                            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                            + Thêm Khách Gọi Đầu Tiên
                        </button>
                    </div>
                ) : (
                    filteredPlans.map(plan => {
                        const isCompleted = plan.status === 'COMPLETED'
                        const isPending = plan.status === 'PENDING'
                        const outcomeCfg = CALL_OUTCOMES_CFG.find(o => o.id === plan.callOutcome)

                        return (
                            <div
                                key={plan.id}
                                className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-2xs ${
                                    isCompleted
                                        ? 'bg-slate-50/60 border-slate-200/80 opacity-90'
                                        : 'bg-white border-slate-200 hover:border-teal-300 hover:shadow-xs'
                                }`}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    {/* Left: Contact Info & Purpose */}
                                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                        <div
                                            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                                                isCompleted
                                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-200'
                                                    : 'bg-teal-500/10 text-teal-600 border border-teal-200'
                                            }`}
                                        >
                                            {isCompleted ? <CheckCircle2 size={20} /> : <PhoneCall size={20} />}
                                        </div>

                                        <div className="space-y-1.5 min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* Channel badge */}
                                                {plan.channel === 'CORPORATE' ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                        🏢 Corporate
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        🍷 Retail
                                                    </span>
                                                )}

                                                {/* Priority badge */}
                                                {plan.priority === 'URGENT' && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                        ⚡ Khẩn cấp
                                                    </span>
                                                )}
                                                {plan.priority === 'HIGH' && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        ⭐ Ưu tiên cao
                                                    </span>
                                                )}

                                                {/* Status badge */}
                                                {isCompleted ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        ✓ Đã hoàn thành
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                        Chưa gọi
                                                    </span>
                                                )}

                                                {/* Scheduled Time if any */}
                                                {plan.scheduledTime && (
                                                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                                        <Clock size={11} /> {plan.scheduledTime}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Prospect Name & Phone */}
                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                <h4 className="text-base font-bold text-slate-900">
                                                    {plan.prospectName}
                                                </h4>
                                                {plan.customerCode && (
                                                    <span className="text-[11px] font-mono text-slate-400 font-semibold">
                                                        [{plan.customerCode}]
                                                    </span>
                                                )}
                                                <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                                                    📞 {plan.phone}
                                                </span>
                                            </div>

                                            {/* Company (Corporate) */}
                                            {plan.prospectCompany && (
                                                <p className="text-xs text-slate-600 font-medium flex items-center gap-1">
                                                    <Building2 size={12} className="text-slate-400 shrink-0" />
                                                    <span>{plan.prospectCompany}</span>
                                                </p>
                                            )}

                                            {/* Purpose & Preparation Notes */}
                                            <div className="text-xs text-slate-600 space-y-0.5">
                                                <p className="font-semibold text-slate-800">
                                                    🎯 Mục đích: <span className="font-normal text-slate-600">{plan.callType}</span>
                                                </p>
                                                {plan.notes && (
                                                    <p className="text-slate-500 italic bg-slate-50 p-2 rounded-xl border border-slate-100 mt-1">
                                                        📝 Lưu ý: {plan.notes}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Rep & Assigner info */}
                                            <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1 font-mono">
                                                <span>👤 Phụ trách: <strong>{plan.salespersonName}</strong></span>
                                                {plan.assignedByName && (
                                                    <span>• Giao bởi: <em>{plan.assignedByName}</em></span>
                                                )}
                                            </div>

                                            {/* Call Outcome if completed */}
                                            {isCompleted && outcomeCfg && (
                                                <div className="mt-2 p-2.5 rounded-xl bg-white border border-emerald-200/80 shadow-2xs space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${outcomeCfg.badgeClass}`}>
                                                            {outcomeCfg.label}
                                                        </span>
                                                        {plan.callDurationMinutes && (
                                                            <span className="text-[10px] text-slate-500 font-mono">
                                                                ⏱ {plan.callDurationMinutes} phút
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Big Call Button & Actions (Optimized for Mobile) */}
                                    <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                                        {/* Big Mobile Click-to-Call Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleInitiateCall(plan)}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold transition shadow-xs cursor-pointer min-h-[44px]"
                                            title="Bấm gọi ngay trên điện thoại"
                                        >
                                            <PhoneCall size={16} />
                                            <span>GỌI NGAY</span>
                                        </button>

                                        {/* Fill Report Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenManualReport(plan)}
                                            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition border cursor-pointer min-h-[44px] ${
                                                isCompleted
                                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                                                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-300'
                                            }`}
                                        >
                                            <CheckCircle2 size={15} className={isCompleted ? 'text-slate-500' : 'text-emerald-600'} />
                                            <span>{isCompleted ? 'Sửa Báo Cáo' : 'Báo Cáo Cuộc Gọi'}</span>
                                        </button>

                                        {/* Delete Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteItem(plan.id, plan.prospectName)}
                                            className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer self-center"
                                            title="Xóa khỏi kế hoạch"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* ========================================================================= */}
            {/* MODAL 1: BÁO CÁO KẾT QUẢ CUỘC GỌI (CALL REPORT MODAL)                     */}
            {/* ========================================================================= */}
            {reportModalOpen && activePlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div
                        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                                    <CheckCircle2 size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Báo Cáo Kết Quả Cuộc Gọi
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Khách hàng: <strong>{activePlan.prospectName}</strong> • {activePlan.phone}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReportModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body Form */}
                        <form onSubmit={handleSaveCallReport} className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
                            {/* Duration & Call details banner */}
                            <div className="p-3 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                    <div className="text-[11px] text-teal-800 font-semibold">
                                        Thời lượng cuộc gọi ước tính:
                                    </div>
                                    <div className="text-xs text-teal-900">
                                        Tự động tính toán khi bạn vừa quay lại web
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-teal-200 shadow-2xs">
                                    <Clock size={13} className="text-teal-600" />
                                    <input
                                        type="number"
                                        min={1}
                                        max={120}
                                        value={reportDuration}
                                        onChange={e => setReportDuration(Number(e.target.value))}
                                        className="w-12 text-center font-mono font-bold text-slate-900 outline-none text-xs"
                                    />
                                    <span className="text-slate-500">phút</span>
                                </div>
                            </div>

                            {/* Call Outcome 1-Click Selector */}
                            <div>
                                <label className="block font-bold text-slate-800 mb-2">
                                    Kết Quả Cuộc Gọi (Chọn 1-chạm) <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {CALL_OUTCOMES_CFG.map(o => {
                                        const Icon = o.icon
                                        const isSelected = reportOutcome === o.id
                                        return (
                                            <button
                                                key={o.id}
                                                type="button"
                                                onClick={() => setReportOutcome(o.id)}
                                                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20'
                                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <div
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                                    style={{ background: o.bg, color: o.color }}
                                                >
                                                    <Icon size={14} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-slate-900 text-xs">
                                                        {o.shortLabel}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 truncate">
                                                        {o.label}
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Follow-up date (if busy or interested) */}
                            {(reportOutcome.includes('CALLBACK') || reportOutcome.includes('BUSY') || reportOutcome.includes('INTERESTED')) && (
                                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1.5 animate-in fade-in duration-150">
                                    <label className="block font-bold text-amber-900">
                                        📅 Lịch Hẹn Gọi Lại Tiếp Theo (Tự động lên kế hoạch ngày đó)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={reportFollowUpDate}
                                        onChange={e => setReportFollowUpDate(e.target.value)}
                                        className="w-full p-2 rounded-lg bg-white border border-amber-300 text-slate-800 outline-none text-xs font-mono"
                                    />
                                </div>
                            )}

                            {/* Report Notes */}
                            <div>
                                <label className="block font-bold text-slate-800 mb-1">
                                    Ghi Chú Chi Tiết Cuộc Gọi
                                </label>
                                <textarea
                                    rows={3}
                                    value={reportNotes}
                                    onChange={e => setReportNotes(e.target.value)}
                                    placeholder="Nội dung khách trao đổi, quan tâm dòng vang nào, mức giá, thời điểm cần hàng..."
                                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500 text-xs"
                                />
                            </div>

                            {/* Actions */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setReportModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                                >
                                    Đóng
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingReport}
                                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    {savingReport ? 'Đang lưu...' : '✓ Lưu Báo Cáo Cuộc Gọi'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 2: THÊM KHÁCH VÀO KẾ HOẠCH NGÀY (ADD SINGLE PLAN ITEM)               */}
            {/* ========================================================================= */}
            {addModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div
                        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600">
                                    <CalendarCheck size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Thêm Khách Vào Kế Hoạch Gọi Ngày
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Ngày thực hiện: <strong>{planDate}</strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAddModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSinglePlan} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto text-xs">
                            {/* Manager Target Rep Selector if applicable */}
                            {isManager && salesReps.length > 0 && (
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Giao cho Telesale phụ trách
                                    </label>
                                    <select
                                        value={newTargetRepId}
                                        onChange={e => setNewTargetRepId(e.target.value)}
                                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-teal-500"
                                    >
                                        <option value="">-- Mặc định (Tự nhận việc) --</option>
                                        {salesReps.map(rep => (
                                            <option key={rep.id} value={rep.id}>
                                                {rep.name} ({rep.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Channel & Customer Type */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Kênh Khách Hàng
                                    </label>
                                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setNewChannel('CORPORATE')}
                                            className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                                                newChannel === 'CORPORATE' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                                            }`}
                                        >
                                            🏢 Corporate
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewChannel('RETAIL')}
                                            className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                                                newChannel === 'RETAIL' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600'
                                            }`}
                                        >
                                            🍷 Retail
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Nguồn Dữ Liệu
                                    </label>
                                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setNewCustType('PROSPECT')}
                                            className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                                                newCustType === 'PROSPECT' ? 'bg-white text-teal-700 shadow-2xs' : 'text-slate-600'
                                            }`}
                                        >
                                            Đầu mối mới (Lead)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewCustType('EXISTING')}
                                            className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                                                newCustType === 'EXISTING' ? 'bg-white text-teal-700 shadow-2xs' : 'text-slate-600'
                                            }`}
                                        >
                                            Khách CRM cũ
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Existing Customer Selector */}
                            {newCustType === 'EXISTING' && (
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Chọn Khách Hàng CRM
                                    </label>
                                    <select
                                        value={newCustomerId}
                                        onChange={e => {
                                            const cid = e.target.value
                                            setNewCustomerId(cid)
                                            const cust = customersList.find(c => c.id === cid)
                                            if (cust) {
                                                setNewProspectName(cust.name)
                                                setNewPhone(cust.phone || '')
                                            }
                                        }}
                                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-teal-500 font-medium"
                                    >
                                        <option value="">-- Chọn khách hàng trong hệ thống --</option>
                                        {customersList.map(c => (
                                            <option key={c.id} value={c.id}>
                                                [{c.code}] {c.name} {c.phone ? `(${c.phone})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Name & Phone */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Tên Người Liên Hệ / Khách Hàng <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newProspectName}
                                        onChange={e => setNewProspectName(e.target.value)}
                                        placeholder="VD: Anh Minh / Chị Lan"
                                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Số Điện Thoại <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        value={newPhone}
                                        onChange={e => setNewPhone(e.target.value)}
                                        placeholder="VD: 0912345678"
                                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono outline-none focus:border-teal-500"
                                    />
                                </div>
                            </div>

                            {/* Company (if corporate) */}
                            {newChannel === 'CORPORATE' && (
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Tên Công Ty / Đơn Vị (Doanh nghiệp)
                                    </label>
                                    <input
                                        type="text"
                                        value={newProspectCompany}
                                        onChange={e => setNewProspectCompany(e.target.value)}
                                        placeholder="VD: Tập đoàn FPT / Ngân hàng Techcombank"
                                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500"
                                    />
                                </div>
                            )}

                            {/* Call Type & Priority */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Mục Đích Gọi
                                    </label>
                                    <input
                                        type="text"
                                        value={newCallType}
                                        onChange={e => setNewCallType(e.target.value)}
                                        placeholder="VD: Chào set quà tết, mời tasting..."
                                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Mức Ưu Tiên
                                    </label>
                                    <select
                                        value={newPriority}
                                        onChange={e => setNewPriority(e.target.value as any)}
                                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500"
                                    >
                                        <option value="NORMAL">Bình thường</option>
                                        <option value="HIGH">Ưu tiên cao ⭐</option>
                                        <option value="URGENT">Khẩn cấp ⚡</option>
                                        <option value="LOW">Thấp</option>
                                    </select>
                                </div>
                            </div>

                            {/* Scheduled Time & Preparation Notes */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Khung Giờ Dự Kiến
                                    </label>
                                    <input
                                        type="text"
                                        value={newScheduledTime}
                                        onChange={e => setNewScheduledTime(e.target.value)}
                                        placeholder="VD: 09:30 hoặc Sáng"
                                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Ghi Chú Chuẩn Bị
                                    </label>
                                    <input
                                        type="text"
                                        value={newNotes}
                                        onChange={e => setNewNotes(e.target.value)}
                                        placeholder="VD: Khách thích vang Ý, tầm giá 1.5tr..."
                                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-teal-500"
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAddModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingSingle}
                                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    {savingSingle ? 'Đang lưu...' : '+ Thêm Khách Vào Kế Hoạch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 3: QUẢN LÝ PHÂN BỔ DANH SÁCH GỌI HÀNG LOẠT (MANAGER BATCH ASSIGN)     */}
            {/* ========================================================================= */}
            {assignBatchModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div
                        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600">
                                    <UserCheck size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Phân Bổ Kế Hoạch Gọi Cho Telesales
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Chia đều danh sách khách hàng hoặc leads mới cho các Telesale nhận việc
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAssignBatchModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveBatchAssign} className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
                            {/* 1. Chọn nhân viên nhận việc */}
                            <div>
                                <label className="block font-bold text-slate-800 mb-1.5">
                                    1. Chọn Nhân Viên Telesale Nhận Việc <span className="text-rose-500">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                    {salesReps.map(rep => {
                                        const isSelected = batchTargetRepIds.includes(rep.id)
                                        return (
                                            <button
                                                key={rep.id}
                                                type="button"
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setBatchTargetRepIds(batchTargetRepIds.filter(id => id !== rep.id))
                                                    } else {
                                                        setBatchTargetRepIds([...batchTargetRepIds, rep.id])
                                                    }
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-teal-600 text-white shadow-2xs'
                                                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                {isSelected && <Check size={12} />}
                                                <span>{rep.name}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* 2. Kênh & Thông tin gọi */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Kênh Bán Hàng
                                    </label>
                                    <select
                                        value={batchChannel}
                                        onChange={e => setBatchChannel(e.target.value as any)}
                                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none"
                                    >
                                        <option value="CORPORATE">🏢 Corporate (Khách Doanh Nghiệp)</option>
                                        <option value="RETAIL">🍷 Retail (Khách Lẻ VIP / Showroom)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Mục Đích Gọi Chung
                                    </label>
                                    <input
                                        type="text"
                                        value={batchCallType}
                                        onChange={e => setBatchCallType(e.target.value)}
                                        className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none"
                                    />
                                </div>
                            </div>

                            {/* 3. Dán danh sách leads nhanh */}
                            <div>
                                <label className="block font-bold text-slate-800 mb-1">
                                    2. Dán Danh Sách Đầu Mối Mới (Mỗi dòng 1 khách: Tên, Công ty, SĐT)
                                </label>
                                <textarea
                                    rows={4}
                                    value={batchCustomLeadsText}
                                    onChange={e => setBatchCustomLeadsText(e.target.value)}
                                    placeholder="Ví dụ dán từ Excel:&#10;Nguyễn Văn An, Cty Bất Động Sản Á Châu, 0912345678&#10;Trần Thị Bình, Techcombank Chi nhánh Ba Đình, 0987654321&#10;Lê Hoàng Cường, Khách Lẻ VIP, 0905123456"
                                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs outline-none focus:border-teal-500"
                                />
                                <p className="text-[11px] text-slate-500 mt-1">
                                    💡 Hệ thống sẽ tự động tách từng dòng và chia đều cho {batchTargetRepIds.length || 0} nhân viên đã chọn.
                                </p>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAssignBatchModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingBatch}
                                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    {savingBatch ? 'Đang phân bổ...' : '🚀 Phân Bổ Danh Sách Cho Telesales'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {confirmDialog}
        </div>
    )
}
