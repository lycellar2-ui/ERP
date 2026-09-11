'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    MapPin, Camera, Clock, CheckCircle2, AlertCircle, Search, Filter,
    Building2, User, ChevronRight, Eye, RefreshCw, FileText, Navigation,
    ExternalLink, Calendar, Plus, X, Download, ShieldCheck, ChevronLeft,
    Check, Send, Award, TrendingUp, AlertTriangle, Sparkles, Phone, MessageSquare,
    Wifi, WifiOff, UploadCloud
} from 'lucide-react'
import {
    checkInSalesVisit, checkOutSalesVisit, getSalesVisits, getActiveVisit,
    reverseGeocodeAction, quickCreateProspectCustomer, getWeeklyPlanWithVisits,
    saveWeeklyPlanAction, submitWeeklyReportAction, saveManagerFeedbackAction,
    getTeamWeeklySalesOverview, getSalesVisitFullPhoto
} from './actions'
import { LiveCameraModal } from './LiveCameraModal'
import { toast } from 'sonner'

interface Props {
    initialVisits: any[]
    customers: { id: string; code: string; name: string; channel: string | null; address?: string | null; phone?: string | null }[]
    users?: { id: string; name: string; email: string }[]
    currentUserId: string
    currentUserName: string
    isManager: boolean
}

// Activity Presets for Wine ERP
export const ACTIVITY_PRESETS = [
    { value: 'PERIODIC_CARE', label: 'Chăm sóc khách hàng định kỳ', icon: '🤝', color: '#87CBB9' },
    { value: 'WINE_TASTING', label: 'Thử rượu & Giới thiệu mẫu mới', icon: '🍷', color: '#D4A853' },
    { value: 'MERCHANDISE_CHECK', label: 'Kiểm tra tồn kho & Trưng bày điểm bán', icon: '📦', color: '#4A8FAB' },
    { value: 'DEBT_COLLECTION', label: 'Thu hồi công nợ / Đối soát hóa đơn', icon: '💵', color: '#E57373' },
    { value: 'CONTRACT_NEGOTIATION', label: 'Ký kết hợp đồng / Đàm phán giá', icon: '📝', color: '#BA68C8' },
    { value: 'COMPLAINT_HANDLING', label: 'Xử lý khiếu nại & Hậu mãi', icon: '⚠️', color: '#FFB74D' },
    { value: 'OTHER', label: 'Mục đích khác', icon: '📌', color: '#90A4AE' },
]

export function getVietnameseDayName(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T12:00:00+07:00`) : new Date(date)
    const day = d.getDay() // 0 = Chủ Nhật, 1 = Thứ Hai, 2 = Thứ Ba, 3 = Thứ Tư, 4 = Thứ Năm, 5 = Thứ Sáu, 6 = Thứ Bảy
    const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    return names[day]
}

export function formatLocalDateStr(d: Date): string {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function getWeekNumber(d: Date): { week: number; year: number } {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return { week: weekNo, year: date.getUTCFullYear() }
}

function getDayOfWeek(dateStr: string): number {
    const d = new Date(`${dateStr.slice(0, 10)}T12:00:00+07:00`)
    const day = d.getDay() // 0 = Sun, 1 = Mon ...
    return day === 0 ? 6 : day - 1 // 0 = Mon, 6 = Sun
}

// Searchable Customer Combobox
function SearchableCustomerCombobox({
    customers,
    selectedCustomerId,
    onSelect,
    onOpenQuickCreate
}: {
    customers: { id: string; code: string; name: string; channel: string | null }[]
    selectedCustomerId: string
    onSelect: (customer: any) => void
    onOpenQuickCreate?: () => void
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')

    const selectedCust = customers.find(c => c.id === selectedCustomerId)

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return customers.slice(0, 50)
        return customers.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q)
        ).slice(0, 50)
    }, [customers, query])

    return (
        <div className="relative">
            <div
                onClick={() => setOpen(true)}
                className="w-full p-2.5 sm:p-3 text-xs outline-none rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-300 dark:border-[#2A4355] text-slate-800 dark:text-white hover:border-[#87CBB9] cursor-pointer flex items-center justify-between transition group shadow-xs"
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Search size={14} className="text-[#87CBB9] shrink-0" />
                    {selectedCust ? (
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                            <strong className="text-[#0D8275] dark:text-[#87CBB9] font-mono mr-1.5">[{selectedCust.code}]</strong>
                            {selectedCust.name}
                        </span>
                    ) : (
                        <span className="text-slate-400 dark:text-[#8AAEBB] font-medium truncate">🔍 Bấm chọn khách hàng...</span>
                    )}
                </div>
                {selectedCust ? (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSelect({ id: '' }); }}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <ChevronRight size={14} className="text-slate-400 dark:text-[#8AAEBB] group-hover:text-slate-700 dark:group-hover:text-white transition rotate-90 shrink-0" />
                )}
            </div>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl shadow-2xl p-2 space-y-2 border border-slate-200 dark:border-[#2A4355] bg-white dark:bg-[#142433]">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    autoFocus
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Gõ tên hoặc mã khách hàng..."
                                    className="w-full pl-8 pr-3 py-2 text-xs outline-none rounded-lg bg-slate-100 dark:bg-[#0D1A24] border border-slate-200 dark:border-[#2A4355] text-slate-900 dark:text-white focus:border-[#87CBB9] placeholder:text-slate-400"
                                />
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                            {onOpenQuickCreate && (
                                <button
                                    type="button"
                                    onClick={() => { setOpen(false); onOpenQuickCreate(); }}
                                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-[#87CBB9] text-[#0A1926] hover:bg-[#72bca9] flex items-center gap-1 shrink-0 cursor-pointer"
                                    title="Tạo khách mới"
                                >
                                    <Plus size={13} /> Khách mới
                                </button>
                            )}
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-1">
                            {filtered.length === 0 ? (
                                <div className="p-3 text-xs text-center text-slate-500 dark:text-[#8AAEBB]">
                                    Không tìm thấy khách hàng khớp "{query}"
                                    {onOpenQuickCreate && (
                                        <button
                                            type="button"
                                            onClick={() => { setOpen(false); onOpenQuickCreate(); }}
                                            className="mt-2 block mx-auto text-xs text-[#0D8275] dark:text-[#87CBB9] font-bold underline cursor-pointer"
                                        >
                                            + Tạo nhanh khách mới ngay
                                        </button>
                                    )}
                                </div>
                            ) : (
                                filtered.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(c)
                                            setOpen(false)
                                            setQuery('')
                                        }}
                                        className={`w-full text-left p-2.5 rounded-lg transition flex items-center justify-between text-xs cursor-pointer ${selectedCustomerId === c.id ? 'bg-[#87CBB9]/20 text-[#0D8275] dark:text-[#87CBB9] font-bold' : 'hover:bg-slate-100 dark:hover:bg-[#1B2E3D] text-slate-700 dark:text-gray-200'}`}
                                    >
                                        <div className="min-w-0 flex-1 pr-2">
                                            <span className="font-mono font-bold text-[#0D8275] dark:text-[#87CBB9] mr-2">[{c.code}]</span>
                                            <span className="font-semibold">{c.name}</span>
                                        </div>
                                        {c.channel && (
                                            <span className="text-[10px] uppercase bg-slate-200 dark:bg-[#1B2E3D] px-2 py-0.5 rounded font-mono text-slate-600 dark:text-[#8AAEBB]">
                                                {c.channel}
                                            </span>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function GpsPermissionGuideModal({
    isOpen,
    onClose,
    onRetryGps,
    gettingLocation,
}: {
    isOpen: boolean
    onClose: () => void
    onRetryGps: () => Promise<any>
    gettingLocation: boolean
}) {
    const [tab, setTab] = useState<'IOS' | 'ANDROID'>('IOS')
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150" onClick={onClose}>
            <div className="w-full max-w-md bg-white dark:bg-[#111C24] rounded-2xl border border-slate-200 dark:border-[#223645] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-[#223645] flex items-center justify-between bg-amber-500/10">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500 text-white font-bold">
                            📍
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                Hướng Dẫn Bật Quyền Vị Trí (GPS)
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Bắt buộc để gắn toạ độ thực địa vào ảnh check-in
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Device Selector Tabs */}
                <div className="p-3 border-b border-slate-100 dark:border-[#1E3040] flex gap-2 bg-slate-50 dark:bg-[#142330]">
                    <button
                        type="button"
                        onClick={() => setTab('IOS')}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            tab === 'IOS'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-white dark:bg-[#1E2E3D] text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                    >
                        🍎 iPhone (Safari)
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('ANDROID')}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            tab === 'ANDROID'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-white dark:bg-[#1E2E3D] text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                    >
                        🤖 Android (Chrome)
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3.5 text-xs text-slate-700 dark:text-slate-200">
                    {tab === 'IOS' ? (
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162534] border border-slate-200/60 dark:border-[#223645]">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center shrink-0">
                                    1
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">Bấm nút "aA" hoặc biểu tượng trang web</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        Nằm ở góc trái trên thanh nhập địa chỉ URL của trình duyệt Safari.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162534] border border-slate-200/60 dark:border-[#223645]">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center shrink-0">
                                    2
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">Chọn "Cài đặt trang web" (Website Settings)</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        Tìm mục <strong>Vị trí (Location)</strong> ➔ Chuyển thành <strong>Cho phép (Allow)</strong>.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162534] border border-slate-200/60 dark:border-[#223645]">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center shrink-0">
                                    3
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">Bật dịch vụ định vị của máy</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        Vào Cài đặt máy ➔ Quyền riêng tư & Bảo mật ➔ Dịch vụ định vị ➔ Gạt BẬT.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162534] border border-slate-200/60 dark:border-[#223645]">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center shrink-0">
                                    1
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">Bấm vào biểu tượng 🔒 (Khóa) hoặc ⚙️</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        Nằm ngay bên trái thanh địa chỉ URL của Google Chrome.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162534] border border-slate-200/60 dark:border-[#223645]">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center shrink-0">
                                    2
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">Chọn "Quyền" (Permissions) ➔ "Vị trí"</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        Bật công tắc <strong>Vị trí</strong> thành <strong>Cho phép</strong> (màu xanh).
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162534] border border-slate-200/60 dark:border-[#223645]">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center shrink-0">
                                    3
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">Bật GPS của điện thoại</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        Kéo thanh thông báo từ trên xuống, chạm bật biểu tượng <strong>Vị trí (GPS)</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action button */}
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={async () => {
                                const loc = await onRetryGps()
                                if (loc?.lat) {
                                    toast.success('Đã lấy được toạ độ GPS chính xác!')
                                    onClose()
                                } else {
                                    toast.warning('Vẫn chưa nhận được toạ độ GPS. Hãy chắc chắn bạn đã bật định vị trên máy!')
                                }
                            }}
                            disabled={gettingLocation}
                            className="w-full py-3 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw size={15} className={gettingLocation ? 'animate-spin' : ''} />
                            {gettingLocation ? 'Đang dò tìm toạ độ vệ tinh...' : '🔄 Thử lại định vị GPS ngay'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function PhotoViewerModal({
    viewPhoto,
    onClose,
    loadingFullPhoto
}: {
    viewPhoto: { title: string; url: string; visitId?: string } | null
    onClose: () => void
    loadingFullPhoto: boolean
}) {
    if (!viewPhoto) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md" onClick={onClose}>
            <div
                className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#111C24] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#223645] shadow-2xl flex flex-col space-y-3 animate-in zoom-in-95"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#223645] pb-3">
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate pr-2">
                            {viewPhoto.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            {loadingFullPhoto ? 'Đang tải ảnh gốc phân giải cao HD...' : 'Ảnh chụp camera thực tế tại điểm bán'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <a
                            href={viewPhoto.url}
                            download={`Sales_Visit_${Date.now()}.jpg`}
                            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-teal-600 text-white dark:bg-[#87CBB9] dark:text-[#0A1926] hover:opacity-90 flex items-center gap-1.5 transition shadow-xs"
                        >
                            <Download size={14} /> Tải Ảnh
                        </a>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1B2E3D] cursor-pointer">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex items-center justify-center bg-black/60 rounded-xl p-2 border border-[#2A4355] relative">
                    <img src={viewPhoto.url} alt="Enlarged" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                    {loadingFullPhoto && (
                        <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur text-white text-[10px] font-semibold flex items-center gap-1.5 border border-white/20">
                            <RefreshCw size={12} className="animate-spin text-teal-400" />
                            Đang nạp ảnh nét HD...
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export function SalesVisitsClient({ initialVisits, customers, users, currentUserId, currentUserName, isManager }: Props) {
    const [activeTab, setActiveTab] = useState<'PLANNING' | 'CHECKIN' | 'REVIEW' | 'HISTORY'>('CHECKIN')
    const [localCustomers, setLocalCustomers] = useState(customers)
    const [selectedSalespersonId, setSelectedSalespersonId] = useState(currentUserId)
    const [activeVisit, setActiveVisit] = useState<any | null>(null)
    const [loadingActive, setLoadingActive] = useState(true)

    // Team Overview State (Exclusively for Manager / CEO)
    const [teamData, setTeamData] = useState<any | null>(null)
    const [loadingTeam, setLoadingTeam] = useState(false)
    const [inspectingSale, setInspectingSale] = useState<any | null>(null)
    const [teamFilterSearch, setTeamFilterSearch] = useState('')
    const [inspectSubTab, setInspectSubTab] = useState<'PHOTOS' | 'PLAN' | 'APPROVAL'>('PHOTOS')
    const [inspectFeedbackText, setInspectFeedbackText] = useState('')
    const [savingInspectFeedback, setSavingInspectFeedback] = useState(false)

    // Current Week state
    const today = useMemo(() => new Date(), [])
    const todayStr = useMemo(() => {
        try {
            return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(today)
        } catch {
            return today.toISOString().slice(0, 10)
        }
    }, [today])
    const initialWeekInfo = useMemo(() => getWeekNumber(today), [today])
    const [currentWeek, setCurrentWeek] = useState(initialWeekInfo)
    const [mobileSelectedDate, setMobileSelectedDate] = useState<string>('')

    // Weekly Plan state
    const [weeklyPlan, setWeeklyPlan] = useState<any | null>(null)
    const [planVisits, setPlanVisits] = useState<any[]>([])
    const [weekActualVisits, setWeekActualVisits] = useState<any[]>([])
    const [loadingPlan, setLoadingPlan] = useState(false)
    const [savingPlan, setSavingPlan] = useState(false)
    const [planNote, setPlanNote] = useState('')

    // Self review & Manager feedback state
    const [selfReviewText, setSelfReviewText] = useState('')
    const [submittingReport, setSubmittingReport] = useState(false)
    const [managerFeedbackText, setManagerFeedbackText] = useState('')
    const [savingFeedback, setSavingFeedback] = useState(false)

    // Daily visits & history (filterDate empty by default to show all latest visits)
    const [historyVisits, setHistoryVisits] = useState<any[]>(initialVisits || [])
    const [filterDate, setFilterDate] = useState('')
    const [filterStatus, setFilterStatus] = useState('ALL')
    const [filterSearch, setFilterSearch] = useState('')

    // Actual check-ins done today (for Today's feed & photo display)
    const todayActualVisits = useMemo(() => {
        return historyVisits.filter(v => {
            if (!v.checkInTime) return false
            try {
                const vnDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(v.checkInTime))
                return vnDateStr === todayStr
            } catch {
                return v.checkInTime.slice(0, 10) === todayStr
            }
        })
    }, [historyVisits, todayStr])

    // Filtered history visits for History Table
    const filteredHistoryVisits = useMemo(() => {
        return historyVisits.filter(v => {
            if (filterStatus !== 'ALL' && v.status !== filterStatus) return false
            if (filterDate) {
                try {
                    const vnDateStr = v.checkInTime ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(v.checkInTime)) : ''
                    if (vnDateStr !== filterDate) return false
                } catch {
                    if (!v.checkInTime || v.checkInTime.slice(0, 10) !== filterDate) return false
                }
            }
            if (filterSearch.trim()) {
                const q = filterSearch.toLowerCase()
                const matchName = (v.customerName || '').toLowerCase().includes(q)
                const matchCode = (v.customerCode || '').toLowerCase().includes(q)
                const matchSale = (v.salespersonName || '').toLowerCase().includes(q)
                const matchVisitNo = (v.visitNo || '').toLowerCase().includes(q)
                if (!matchName && !matchCode && !matchSale && !matchVisitNo) return false
            }
            return true
        })
    }, [historyVisits, filterStatus, filterDate, filterSearch])

    // Location / GPS State
    const [coords, setCoords] = useState<{ lat?: number; lng?: number; address?: string }>({})
    const [gettingLocation, setGettingLocation] = useState(false)
    const [gpsError, setGpsError] = useState<string | null>(null)

    // Active Visit Timer
    const [elapsedMinutes, setElapsedMinutes] = useState(0)

    // Camera Modal
    const [cameraTarget, setCameraTarget] = useState<{
        mode?: 'CHECKIN'
        customerId?: string
        customerName?: string
        purpose?: string
        activityType?: string
        scheduleId?: string
        isUnplanned?: boolean
        notes?: string
    } | null>(null)

    const [submittingAction, setSubmittingAction] = useState(false)

    // Quick Add Visit to Plan Modal
    const [quickAddModal, setQuickAddModal] = useState<{ open: boolean; dateStr: string; dayName: string } | null>(null)
    const [addCustomerId, setAddCustomerId] = useState('')
    const [addActivityType, setAddActivityType] = useState('PERIODIC_CARE')
    const [addCustomPurpose, setAddCustomPurpose] = useState('')

    // Unplanned Check-in Modal
    const [showUnplannedModal, setShowUnplannedModal] = useState(false)
    const [unplannedCustomerId, setUnplannedCustomerId] = useState('')
    const [unplannedActivityType, setUnplannedActivityType] = useState('PERIODIC_CARE')
    const [unplannedPurpose, setUnplannedPurpose] = useState('')

    // Quick Create Prospect Customer Modal
    const [showQuickCreateModal, setShowQuickCreateModal] = useState(false)
    const [quickCustName, setQuickCustName] = useState('')
    const [quickCustChannel, setQuickCustChannel] = useState('HORECA')
    const [quickCustContact, setQuickCustContact] = useState('')
    const [quickCustPhone, setQuickCustPhone] = useState('')
    const [quickCustAddress, setQuickCustAddress] = useState('')
    const [creatingCustomer, setCreatingCustomer] = useState(false)

    // Photo Viewer Modal
    const [viewPhoto, setViewPhoto] = useState<{ title: string; url: string; visitId?: string } | null>(null)
    const [loadingFullPhoto, setLoadingFullPhoto] = useState(false)

    // GPS Permission Guide Modal State
    const [showGpsGuideModal, setShowGpsGuideModal] = useState(false)

    // Offline Queue / Drafts State (for basement wine cellars / network loss)
    const [offlineDrafts, setOfflineDrafts] = useState<any[]>([])
    const [syncingOffline, setSyncingOffline] = useState(false)
    const [isNetworkOnline, setIsNetworkOnline] = useState(true)

    // Load offline drafts from localStorage on mount & listen to online/offline network events
    useEffect(() => {
        if (typeof window === 'undefined') return
        setIsNetworkOnline(navigator.onLine)
        try {
            const raw = localStorage.getItem('SALES_VISITS_OFFLINE_DRAFTS_V1')
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) setOfflineDrafts(parsed)
            }
        } catch (e) {
            console.warn('Error reading offline drafts', e)
        }

        const handleOnline = () => {
            setIsNetworkOnline(true)
            toast.success('📶 Đã có kết nối mạng trở lại! Hệ thống đang tự động kiểm tra đồng bộ...')
        }
        const handleOffline = () => {
            setIsNetworkOnline(false)
            toast.warning('📶 Bạn đã mất kết nối mạng. Các lượt check-in hầm rượu sẽ được lưu ngoại tuyến trên máy.')
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    // Lazy load full HD photo on demand when viewing enlarged photo
    useEffect(() => {
        if (!viewPhoto?.visitId) return
        let active = true
        setLoadingFullPhoto(true)
        getSalesVisitFullPhoto(viewPhoto.visitId)
            .then(res => {
                if (active && res.success && res.photo && res.photo !== viewPhoto.url) {
                    setViewPhoto(prev => prev ? { ...prev, url: res.photo! } : null)
                }
            })
            .catch(err => console.warn('Could not fetch full photo', err))
            .finally(() => {
                if (active) setLoadingFullPhoto(false)
            })
        return () => { active = false }
    }, [viewPhoto?.visitId])

    // -----------------------------------------------------------------
    // GPS & LOCATION RETRIEVAL
    // -----------------------------------------------------------------
    const requestGPS = useCallback(async (): Promise<{ lat?: number; lng?: number; address?: string }> => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            setGpsError('Trình duyệt không hỗ trợ Geolocation.')
            return {}
        }

        setGettingLocation(true)
        setGpsError(null)

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const lat = pos.coords.latitude
                    const lng = pos.coords.longitude
                    let address = `Toạ độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
                    try {
                        const geoRes = await reverseGeocodeAction(lat, lng)
                        if (geoRes.address) address = geoRes.address
                    } catch (e) {
                        console.warn('Geocode warning', e)
                    }
                    const loc = { lat, lng, address }
                    setCoords(loc)
                    setGettingLocation(false)
                    setGpsError(null)
                    resolve(loc)
                },
                (err) => {
                    console.warn('GPS error', err)
                    let msg = 'Không thể lấy GPS. Bạn hãy kiểm tra quyền Vị trí trên trình duyệt/điện thoại!'
                    if (err.code === 1) msg = 'Quyền GPS đã bị từ chối trong Cài đặt trình duyệt!'
                    if (err.code === 2) msg = 'Thiết bị đang tắt định vị GPS. Vui lòng bật GPS trên máy!'
                    if (err.code === 3) msg = 'Hết thời gian chờ lấy toạ độ GPS (Timeout).'
                    setGpsError(msg)
                    setGettingLocation(false)
                    resolve({})
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            )
        })
    }, [])

    useEffect(() => {
        requestGPS()
    }, [requestGPS])

    // -----------------------------------------------------------------
    // ACTIVE VISIT & POLLING TIMER
    // -----------------------------------------------------------------
    const fetchActive = useCallback(async () => {
        setLoadingActive(true)
        const active = await getActiveVisit(selectedSalespersonId)
        setActiveVisit(active)
        setLoadingActive(false)
    }, [selectedSalespersonId])

    useEffect(() => {
        fetchActive()
    }, [fetchActive])

    useEffect(() => {
        if (!activeVisit) return
        const checkInDate = new Date(activeVisit.checkInTime).getTime()
        const updateTimer = () => {
            const now = Date.now()
            const diff = Math.max(1, Math.round((now - checkInDate) / (1000 * 60)))
            setElapsedMinutes(diff)
        }
        updateTimer()
        const interval = setInterval(updateTimer, 30_000)
        return () => clearInterval(interval)
    }, [activeVisit])

    // -----------------------------------------------------------------
    // LOAD WEEKLY PLAN & REVIEWS
    // -----------------------------------------------------------------
    const loadWeeklyData = useCallback(async () => {
        setLoadingPlan(true)
        const res = await getWeeklyPlanWithVisits(selectedSalespersonId, currentWeek.week, currentWeek.year)
        if (res.success) {
            setWeeklyPlan(res.plan || null)
            setPlanVisits(res.plan?.visits || [])
            setPlanNote(res.plan?.note || '')
            setSelfReviewText(res.plan?.selfReview || '')
            setManagerFeedbackText(res.plan?.managerFeedback || '')
            setWeekActualVisits(res.actualVisits || [])
        }
        setLoadingPlan(false)
    }, [selectedSalespersonId, currentWeek])

    useEffect(() => {
        loadWeeklyData()
    }, [loadWeeklyData])

    // Load History
    const fetchHistoryVisits = useCallback(async () => {
        const data = await getSalesVisits({
            salespersonId: (isManager && selectedSalespersonId === 'ALL') ? undefined : selectedSalespersonId,
            date: filterDate ? filterDate : undefined,
            status: filterStatus
        })
        setHistoryVisits(data || [])
    }, [isManager, selectedSalespersonId, filterDate, filterStatus])

    useEffect(() => {
        fetchHistoryVisits()
    }, [fetchHistoryVisits])

    // Load Team Overview (Manager / CEO only)
    const loadTeamData = useCallback(async () => {
        if (!isManager) return
        setLoadingTeam(true)
        const res = await getTeamWeeklySalesOverview(currentWeek.week, currentWeek.year)
        if (res.success) {
            setTeamData(res)
        } else {
            toast.error(res.error || 'Lỗi tải tổng quan đội sale')
        }
        setLoadingTeam(false)
    }, [isManager, currentWeek])

    useEffect(() => {
        if (isManager) {
            loadTeamData()
        }
    }, [isManager, currentWeek, loadTeamData])

    const teamMetrics = useMemo(() => {
        if (!teamData || !teamData.items) return null
        const items = teamData.items as any[]
        const totalSales = items.length
        const totalPlanned = items.reduce((acc, i) => acc + (i.plannedCount || 0), 0)
        const totalCompleted = items.reduce((acc, i) => acc + (i.completedCount || 0), 0)
        const overallRate = totalPlanned > 0 ? Math.min(100, Math.round((totalCompleted / totalPlanned) * 100)) : 0
        const pendingReview = items.filter(i => i.planStatus === 'SUBMITTED').length
        return { totalSales, totalPlanned, totalCompleted, overallRate, pendingReview }
    }, [teamData])

    const filteredTeamItems = useMemo(() => {
        if (!teamData || !teamData.items) return []
        const q = teamFilterSearch.trim().toLowerCase()
        if (!q) return teamData.items
        return teamData.items.filter((i: any) =>
            i.salespersonName?.toLowerCase().includes(q) ||
            i.salespersonEmail?.toLowerCase().includes(q)
        )
    }, [teamData, teamFilterSearch])

    const handleSaveInspectFeedback = async () => {
        if (!inspectingSale?.planId) {
            toast.error('Nhân viên này chưa có bản ghi kế hoạch tuần để duyệt')
            return
        }
        if (!inspectFeedbackText.trim()) {
            toast.error('Vui lòng nhập nội dung nhận xét hoặc chỉ đạo của Quản lý / CEO')
            return
        }
        setSavingInspectFeedback(true)
        const res = await saveManagerFeedbackAction({
            planId: inspectingSale.planId,
            managerFeedback: inspectFeedbackText.trim(),
            managerId: currentUserId,
        })
        if (res.success) {
            toast.success(`Đã phê duyệt và lưu nhận xét cho ${inspectingSale.salespersonName}!`)
            await loadTeamData()
            setInspectingSale((prev: any) => prev ? {
                ...prev,
                planStatus: 'APPROVED',
                managerFeedback: inspectFeedbackText.trim(),
                reviewedAt: new Date().toISOString()
            } : null)
        } else {
            toast.error(res.error || 'Lỗi khi lưu nhận xét')
        }
        setSavingInspectFeedback(false)
    }

    // Compute dates for current selected week (Monday to Sunday)
    const weekDates = useMemo(() => {
        // Standard ISO 8601 week calculation: Jan 4 is always in week 1
        const jan4 = new Date(currentWeek.year, 0, 4)
        const dayOfWeek = jan4.getDay() || 7 // 1 = Mon ... 7 = Sun
        // Find Monday of Week 1
        const week1Monday = new Date(jan4)
        week1Monday.setDate(jan4.getDate() - dayOfWeek + 1)
        
        // Find Monday of currentWeek
        const currentMonday = new Date(week1Monday)
        currentMonday.setDate(week1Monday.getDate() + (currentWeek.week - 1) * 7)
        currentMonday.setHours(12, 0, 0, 0) // Midday avoids any DST/UTC shifts
        
        const dates: { dateStr: string; dayName: string; dayIndex: number; isToday: boolean }[] = []
        for (let i = 0; i < 7; i++) {
            const d = new Date(currentMonday)
            d.setDate(currentMonday.getDate() + i)
            const dateStr = formatLocalDateStr(d)
            dates.push({
                dateStr,
                dayName: getVietnameseDayName(d),
                dayIndex: i,
                isToday: dateStr === todayStr,
            })
        }
        return dates
    }, [currentWeek, todayStr])

    // Today's scheduled visits
    const todayPlanVisits = useMemo(() => {
        return planVisits.filter(v => v.visitDate === todayStr)
    }, [planVisits, todayStr])

    // Change week helper
    const handlePrevWeek = () => {
        setCurrentWeek(prev => {
            if (prev.week <= 1) return { week: 52, year: prev.year - 1 }
            return { week: prev.week - 1, year: prev.year }
        })
    }

    const handleNextWeek = () => {
        setCurrentWeek(prev => {
            if (prev.week >= 52) return { week: 1, year: prev.year + 1 }
            return { week: prev.week + 1, year: prev.year }
        })
    }

    const handleCurrentWeek = () => {
        setCurrentWeek(initialWeekInfo)
    }

    // -----------------------------------------------------------------
    // QUICK CREATE PROSPECT CUSTOMER
    // -----------------------------------------------------------------
    const handleQuickCreateCustomer = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!quickCustName.trim()) {
            toast.error('Vui lòng nhập tên khách hàng')
            return
        }

        setCreatingCustomer(true)
        const res = await quickCreateProspectCustomer({
            name: quickCustName,
            channel: quickCustChannel,
            contactName: quickCustContact,
            phone: quickCustPhone,
            address: quickCustAddress,
            salespersonId: selectedSalespersonId,
        })

        if (res.success && res.customer) {
            toast.success(`Đã tạo nhanh khách hàng tiềm năng: ${res.customer.name}`)
            setLocalCustomers(prev => [res.customer, ...prev])
            
            // Auto-select if in quick add modal or unplanned modal
            if (quickAddModal) {
                setAddCustomerId(res.customer.id)
            }
            if (showUnplannedModal) {
                setUnplannedCustomerId(res.customer.id)
            }

            // Reset form
            setQuickCustName('')
            setQuickCustContact('')
            setQuickCustPhone('')
            setQuickCustAddress('')
            setShowQuickCreateModal(false)
        } else {
            toast.error(res.error || 'Lỗi tạo khách hàng mới')
        }
        setCreatingCustomer(false)
    }

    // -----------------------------------------------------------------
    // WEEKLY PLAN OPERATIONS
    // -----------------------------------------------------------------
    const handleAddVisitToPlan = () => {
        if (!quickAddModal || !addCustomerId) {
            toast.error('Vui lòng chọn khách hàng')
            return
        }

        const selectedCust = localCustomers.find(c => c.id === addCustomerId)
        const preset = ACTIVITY_PRESETS.find(p => p.value === addActivityType)
        const purpose = addCustomPurpose.trim() || preset?.label || 'Chăm sóc khách hàng định kỳ'

        const newScheduleItem = {
            id: `temp_${Date.now()}`,
            customerId: addCustomerId,
            customer: selectedCust ? { id: selectedCust.id, code: selectedCust.code, name: selectedCust.name, channel: selectedCust.channel } : undefined,
            visitDate: quickAddModal.dateStr,
            purpose,
            status: 'PLANNED',
        }

        setPlanVisits(prev => [...prev, newScheduleItem])
        toast.success(`Đã thêm vào lịch ${quickAddModal.dayName}`)
        setQuickAddModal(null)
        setAddCustomerId('')
        setAddCustomPurpose('')
    }

    const handleRemovePlanVisit = (visitId: string) => {
        setPlanVisits(prev => prev.filter(v => v.id !== visitId))
        toast.info('Đã xóa điểm viếng thăm khỏi kế hoạch')
    }

    const handleSavePlan = async () => {
        setSavingPlan(true)
        const res = await saveWeeklyPlanAction({
            salespersonId: selectedSalespersonId,
            weekNumber: currentWeek.week,
            year: currentWeek.year,
            note: planNote,
            visits: planVisits.map(v => ({
                id: v.id?.startsWith('temp_') ? undefined : v.id,
                customerId: v.customerId,
                visitDate: v.visitDate,
                purpose: v.purpose,
                status: v.status,
            }))
        })

        if (res.success) {
            toast.success('Đã lưu thành công kế hoạch tuần!')
            await loadWeeklyData()
        } else {
            toast.error('Lỗi khi lưu kế hoạch: ' + res.error)
        }
        setSavingPlan(false)
    }

    // -----------------------------------------------------------------
    // CHECK-IN ACTIONS
    // -----------------------------------------------------------------
    const startCheckInPlanned = (item: any) => {
        const cust = item.customer || localCustomers.find(c => c.id === item.customerId)
        setCameraTarget({
            mode: 'CHECKIN',
            customerId: item.customerId,
            customerName: cust?.name,
            purpose: item.purpose,
            scheduleId: item.id?.startsWith('temp_') ? undefined : item.id,
            isUnplanned: false,
        })
    }

    const startCheckInUnplanned = () => {
        if (!unplannedCustomerId) {
            toast.error('Vui lòng chọn khách hàng')
            return
        }
        const cust = localCustomers.find(c => c.id === unplannedCustomerId)
        const preset = ACTIVITY_PRESETS.find(p => p.value === unplannedActivityType)
        const purpose = unplannedPurpose.trim() || preset?.label || 'Chăm sóc khách hàng định kỳ'

        setShowUnplannedModal(false)
        setCameraTarget({
            mode: 'CHECKIN',
            customerId: unplannedCustomerId,
            customerName: cust?.name,
            purpose,
            activityType: unplannedActivityType,
            isUnplanned: true,
        })
    }

    // -----------------------------------------------------------------
    // OFFLINE SYNC ENGINE (AUTO-SYNC WHEN BACK ONLINE)
    // -----------------------------------------------------------------
    const syncOfflineDrafts = useCallback(async () => {
        if (typeof window === 'undefined' || !navigator.onLine) return
        const raw = localStorage.getItem('SALES_VISITS_OFFLINE_DRAFTS_V1')
        if (!raw) return
        let drafts: any[] = []
        try {
            drafts = JSON.parse(raw)
        } catch {
            return
        }
        if (!drafts.length) return

        setSyncingOffline(true)
        let successCount = 0
        const remainingDrafts: any[] = []

        for (const draft of drafts) {
            if (!draft.customerId) continue
            try {
                const res = await checkInSalesVisit({
                    customerId: draft.customerId,
                    salespersonId: selectedSalespersonId,
                    purpose: draft.purpose,
                    activityType: draft.activityType,
                    scheduleId: draft.scheduleId,
                    isUnplanned: draft.isUnplanned,
                    lat: draft.lat,
                    lng: draft.lng,
                    address: draft.address,
                    photoBase64: draft.photoBase64,
                    thumbnailBase64: draft.thumbnailBase64,
                })
                if (res.success) {
                    successCount++
                } else {
                    remainingDrafts.push({
                        ...draft,
                        retryCount: (draft.retryCount || 0) + 1,
                        lastError: res.error,
                    })
                }
            } catch (err: any) {
                remainingDrafts.push({
                    ...draft,
                    retryCount: (draft.retryCount || 0) + 1,
                    lastError: err.message,
                })
            }
        }

        localStorage.setItem('SALES_VISITS_OFFLINE_DRAFTS_V1', JSON.stringify(remainingDrafts))
        setOfflineDrafts(remainingDrafts)
        setSyncingOffline(false)

        if (successCount > 0) {
            toast.success(`✓ Đã tự động đồng bộ thành công ${successCount} lượt check-in ngoại tuyến lên hệ thống!`)
            await fetchActive()
            await loadWeeklyData()
            await fetchHistoryVisits()
        }
    }, [selectedSalespersonId, fetchActive, loadWeeklyData, fetchHistoryVisits])

    // Auto-sync offline drafts when network recovers or when mounted online
    useEffect(() => {
        if (isNetworkOnline && offlineDrafts.length > 0 && !syncingOffline) {
            syncOfflineDrafts()
        }
    }, [isNetworkOnline, offlineDrafts.length, syncingOffline, syncOfflineDrafts])

    const handleConfirmCheckInPhoto = async (photoBase64: string, thumbnailBase64?: string) => {
        if (!cameraTarget || !cameraTarget.customerId) return
        const customerId = cameraTarget.customerId
        const customerName = cameraTarget.customerName || 'Khách hàng'
        const purpose = cameraTarget.purpose
        const activityType = cameraTarget.activityType
        const scheduleId = cameraTarget.scheduleId
        const isUnplanned = cameraTarget.isUnplanned

        setCameraTarget(null)
        setSubmittingAction(true)

        // Capture fresh GPS
        const loc = await requestGPS()

        const payload = {
            customerId,
            salespersonId: selectedSalespersonId,
            purpose,
            activityType,
            scheduleId,
            isUnplanned,
            lat: loc.lat || coords.lat,
            lng: loc.lng || coords.lng,
            address: loc.address || coords.address,
            photoBase64,
            thumbnailBase64,
        }

        // 1. Check if offline right now (e.g. In wine cellar without 4G)
        if (typeof window !== 'undefined' && !navigator.onLine) {
            const draft = {
                id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                timestamp: Date.now(),
                customerName,
                ...payload,
                retryCount: 0,
            }
            try {
                const existingRaw = localStorage.getItem('SALES_VISITS_OFFLINE_DRAFTS_V1')
                const existing = existingRaw ? JSON.parse(existingRaw) : []
                const updated = [draft, ...existing]
                localStorage.setItem('SALES_VISITS_OFFLINE_DRAFTS_V1', JSON.stringify(updated))
                setOfflineDrafts(updated)
                toast.warning(`📶 Bạn đang mất sóng 4G (hầm rượu). Đã lưu tạm lượt check-in tại ${customerName} vào bộ nhớ máy! Hệ thống sẽ tự động đồng bộ khi có sóng trở lại.`, {
                    duration: 8000
                })
            } catch (e) {
                console.error('Offline draft save error', e)
            }
            setSubmittingAction(false)
            return
        }

        // 2. Online attempt with network error fallback
        try {
            const res = await checkInSalesVisit(payload)
            if (res.success) {
                toast.success(`Check-in thành công tại ${customerName}!`)
                await fetchActive()
                await loadWeeklyData()
                await fetchHistoryVisits()
            } else {
                toast.error('Lỗi Check-in: ' + res.error)
            }
        } catch (err: any) {
            console.warn('Network error during checkin, saving to offline draft', err)
            const draft = {
                id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                timestamp: Date.now(),
                customerName,
                ...payload,
                retryCount: 0,
                lastError: err.message,
            }
            try {
                const existingRaw = localStorage.getItem('SALES_VISITS_OFFLINE_DRAFTS_V1')
                const existing = existingRaw ? JSON.parse(existingRaw) : []
                const updated = [draft, ...existing]
                localStorage.setItem('SALES_VISITS_OFFLINE_DRAFTS_V1', JSON.stringify(updated))
                setOfflineDrafts(updated)
                toast.warning(`📶 Lỗi đường truyền mạng (hầm rượu/mất sóng). Đã lưu an toàn lượt check-in tại ${customerName} trên máy!`, {
                    duration: 8000
                })
            } catch (e) {
                console.error('Offline draft save error', e)
            }
        }
        setSubmittingAction(false)
    }



    // -----------------------------------------------------------------
    // WEEKLY REPORT SUBMISSION & MANAGER FEEDBACK
    // -----------------------------------------------------------------
    const handleSubmitWeeklyReport = async () => {
        if (!weeklyPlan?.id) {
            toast.error('Bạn cần bấm "Lưu Kế Hoạch" trước khi nộp báo cáo tuần')
            return
        }
        if (!selfReviewText.trim() || selfReviewText.trim().length < 5) {
            toast.error('Vui lòng nhập nội dung tự đánh giá tuần (tối thiểu 5 ký tự)')
            return
        }

        setSubmittingReport(true)
        const res = await submitWeeklyReportAction({
            planId: weeklyPlan.id,
            salespersonId: selectedSalespersonId,
            selfReview: selfReviewText,
        })

        if (res.success) {
            toast.success('Đã nộp chốt báo cáo tuần thành công!')
            await loadWeeklyData()
        } else {
            toast.error('Lỗi chốt báo cáo: ' + res.error)
        }
        setSubmittingReport(false)
    }

    const handleSaveManagerFeedback = async () => {
        if (!weeklyPlan?.id) {
            toast.error('Chưa có dữ liệu kế hoạch tuần để nhận xét')
            return
        }
        if (!managerFeedbackText.trim()) {
            toast.error('Vui lòng nhập nội dung nhận xét')
            return
        }

        setSavingFeedback(true)
        const res = await saveManagerFeedbackAction({
            planId: weeklyPlan.id,
            managerFeedback: managerFeedbackText,
            managerId: currentUserId,
        })

        if (res.success) {
            toast.success('Đã lưu nhận xét và phê duyệt tuần cho Sale!')
            await loadWeeklyData()
        } else {
            toast.error('Lỗi lưu nhận xét: ' + res.error)
        }
        setSavingFeedback(false)
    }

    // -----------------------------------------------------------------
    // REVIEW CALCULATIONS (Planned vs Actual)
    // -----------------------------------------------------------------
    const reviewStats = useMemo(() => {
        const plannedCount = planVisits.length
        const completedActual = weekActualVisits.filter(v => v.status === 'COMPLETED')
        const completedCount = completedActual.length
        const unplannedCount = weekActualVisits.filter(v => v.isUnplanned).length
        const rate = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : (completedCount > 0 ? 100 : 0)
        
        // Count new leads
        const newLeads = weekActualVisits.filter(v => v.customer?.code?.startsWith('LEAD-')).length
        
        // Avg duration
        const totalDuration = completedActual.reduce((acc, v) => acc + (v.durationMinutes || 0), 0)
        const avgDuration = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0

        return {
            plannedCount,
            completedCount,
            unplannedCount,
            rate,
            newLeads,
            avgDuration,
        }
    }, [planVisits, weekActualVisits])

    // -----------------------------------------------------------------
    // DEDICATED MANAGER VIEW (EXECUTIVE FIELD OPERATIONS REPORT)
    // Managers do NOT check in, no tabs, direct team report matrix & photos
    // -----------------------------------------------------------------
    if (isManager) {
        return (
            <div className="space-y-4 sm:space-y-6 max-w-screen-xl mx-auto pb-16">
                {/* 1. TOP HEADER & CONTROLS */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#111C24] px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl border border-slate-200 dark:border-[#223645] shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-[#87CBB9]">
                            <MapPin size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    Quản Lý Check-in Thị Trường
                                </h2>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                    Báo Cáo Giám Sát
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-[#8AAEBB] mt-0.5">
                                Báo cáo tổng hợp: Kế hoạch tuần, đối soát lộ trình & kiểm tra ảnh check-in toàn đội Sales
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center flex-wrap gap-2.5">
                        {/* Week Switcher */}
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#142433] p-1 rounded-xl border border-slate-200 dark:border-[#2A4355]">
                            <button
                                type="button"
                                onClick={handlePrevWeek}
                                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1F3342] cursor-pointer"
                                title="Tuần trước"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={handleCurrentWeek}
                                className="px-3 py-1 rounded-lg text-xs font-bold text-slate-800 dark:text-white hover:bg-white dark:hover:bg-[#1F3342] cursor-pointer"
                            >
                                Tuần {currentWeek.week} / {currentWeek.year}
                            </button>
                            <button
                                type="button"
                                onClick={handleNextWeek}
                                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1F3342] cursor-pointer"
                                title="Tuần sau"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        {/* Refresh Button */}
                        <button
                            type="button"
                            onClick={loadTeamData}
                            disabled={loadingTeam}
                            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-[#87CBB9] dark:text-[#0A1926] text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw size={13} className={loadingTeam ? "animate-spin" : ""} />
                            <span>Làm mới dữ liệu</span>
                        </button>
                    </div>
                </div>

                {/* 2. KPI Summary Cards */}
                {teamMetrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                        <div className="p-4 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] space-y-1 shadow-xs">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Đội ngũ Sales</span>
                            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                                {teamMetrics.totalSales}
                            </div>
                            <span className="text-[10px] text-slate-400">Nhân sự hoạt động</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] space-y-1 shadow-xs">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng Kế Hoạch Tuần</span>
                            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                                {teamMetrics.totalPlanned}
                            </div>
                            <span className="text-[10px] text-slate-400">Điểm đã lên lịch</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] space-y-1 shadow-xs">
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Đã Check-in Thực Tế</span>
                            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                {teamMetrics.totalCompleted}
                            </div>
                            <span className="text-[10px] text-slate-400">Điểm có ảnh & GPS</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] space-y-1 shadow-xs">
                            <span className="text-[11px] font-semibold text-teal-600 dark:text-[#87CBB9]">Tỷ Lệ Hoàn Thành</span>
                            <div className="text-2xl font-black text-teal-600 dark:text-[#87CBB9] font-mono">
                                {teamMetrics.overallRate}%
                            </div>
                            <span className="text-[10px] text-slate-400">Tiến độ toàn đội</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] space-y-1 shadow-xs">
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Báo Cáo Chờ Duyệt</span>
                            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                                {teamMetrics.pendingReview}
                            </div>
                            <span className="text-[10px] text-slate-400">Chờ Quản lý/CEO duyệt</span>
                        </div>
                    </div>
                )}

                {/* 3. Team Matrix Table */}
                <div className="rounded-2xl border border-slate-200 dark:border-[#223645] bg-white dark:bg-[#111C24] shadow-xs overflow-hidden">
                    <div className="p-4 bg-slate-50/50 dark:bg-[#142433]/50 border-b border-slate-200 dark:border-[#223645] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                Bảng Ma Trận Kế Hoạch vs Thực Tế Từng Nhân Viên
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-[#8AAEBB]">
                                Bấm "Kiểm Tra Kế Hoạch & Soi Ảnh" để xem lịch chi tiết và duyệt ảnh thực địa của từng bạn
                            </p>
                        </div>

                        <div className="relative w-full sm:w-64">
                            <input
                                type="text"
                                value={teamFilterSearch}
                                onChange={e => setTeamFilterSearch(e.target.value)}
                                placeholder="Tìm tên hoặc email sale..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs outline-none rounded-xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#2A4355] text-slate-900 dark:text-white focus:border-teal-500"
                            />
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>

                    {loadingTeam ? (
                        <div className="py-16 text-center text-xs text-slate-400">
                            <RefreshCw size={24} className="mx-auto animate-spin text-teal-600 mb-2" />
                            Đang tổng hợp dữ liệu toàn đội sale...
                        </div>
                    ) : filteredTeamItems.length === 0 ? (
                        <div className="py-16 text-center text-xs text-slate-400">
                            Không tìm thấy nhân viên nào khớp với tìm kiếm.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-[#142433] text-slate-500 dark:text-[#8AAEBB] border-b border-slate-200 dark:border-[#223645]">
                                        <th className="p-3.5 font-bold">Nhân Viên Sale</th>
                                        <th className="p-3.5 font-bold text-center">Kế Hoạch (Lên Lịch)</th>
                                        <th className="p-3.5 font-bold text-center">Thực Tế (Đã Check-in)</th>
                                        <th className="p-3.5 font-bold text-center">Đột Xuất</th>
                                        <th className="p-3.5 font-bold">Tiến Độ Hoàn Thành</th>
                                        <th className="p-3.5 font-bold text-center">Trạng Thái Báo Cáo</th>
                                        <th className="p-3.5 font-bold text-right">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-[#223645]">
                                    {filteredTeamItems.map((item: any) => (
                                        <tr key={item.salespersonId} className="hover:bg-slate-50/80 dark:hover:bg-[#16232F] transition">
                                            <td className="p-3.5">
                                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                    <User size={13} className="text-teal-600 dark:text-[#87CBB9]" />
                                                    {item.salespersonName}
                                                    {item.salespersonId === currentUserId && (
                                                        <span className="text-[10px] text-slate-400 font-normal">(Tôi)</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                    {item.salespersonEmail}
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                                {item.plannedCount} điểm
                                            </td>
                                            <td className="p-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                {item.completedCount} điểm
                                            </td>
                                            <td className="p-3.5 text-center font-mono text-amber-600 dark:text-amber-400 font-bold">
                                                {item.unplannedCount > 0 ? `+${item.unplannedCount}` : '—'}
                                            </td>
                                            <td className="p-3.5 min-w-[140px]">
                                                <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                                                    <span className="font-bold text-teal-600 dark:text-[#87CBB9]">{item.completionRate}%</span>
                                                    <span className="text-slate-400">{item.completedCount}/{item.plannedCount}</span>
                                                </div>
                                                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-300 ${
                                                            item.completionRate >= 100 ? 'bg-emerald-500' :
                                                            item.completionRate >= 70 ? 'bg-teal-500' :
                                                            item.completionRate >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                                        }`}
                                                        style={{ width: `${Math.min(100, item.completionRate)}%` }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-center whitespace-nowrap">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                    item.planStatus === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                                                    item.planStatus === 'SUBMITTED' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 animate-pulse' :
                                                    item.planStatus === 'DRAFT' ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300' :
                                                    'bg-slate-100 dark:bg-slate-800/60 text-slate-400'
                                                }`}>
                                                    {item.planStatus === 'APPROVED' ? '✓ Đã Duyệt' :
                                                     item.planStatus === 'SUBMITTED' ? '⏳ Chờ Duyệt' :
                                                     item.planStatus === 'DRAFT' ? 'Bản Nháp' : 'Chưa Lên Lịch'}
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-right whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setInspectingSale(item)
                                                        setInspectSubTab('PHOTOS')
                                                        setInspectFeedbackText(item.managerFeedback || '')
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white dark:bg-[#87CBB9] dark:text-[#0A1926] inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                                                >
                                                    <Eye size={13} />
                                                    Kiểm Tra Kế Hoạch & Soi Ảnh
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 4. MODAL: INSPECT SALE'S PLAN, ACTUAL PHOTOS & APPROVAL */}
                {inspectingSale && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs" onClick={() => setInspectingSale(null)}>
                        <div
                            className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-[#111C24] p-5 rounded-2xl border border-slate-200 dark:border-[#223645] shadow-2xl flex flex-col space-y-4 animate-in zoom-in-95"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-[#223645] pb-4">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-teal-500/20 text-teal-600 dark:text-[#87CBB9] uppercase">
                                            Chi Tiết Đi Thực Địa
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono">
                                            Tuần {currentWeek.week} / {currentWeek.year}
                                        </span>
                                    </div>
                                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                                        <User size={18} className="text-teal-600 dark:text-[#87CBB9]" />
                                        {inspectingSale.salespersonName}
                                        <span className="text-xs font-normal font-mono text-slate-400">({inspectingSale.salespersonEmail})</span>
                                    </h3>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="text-right text-xs">
                                        <div className="font-bold text-teal-600 dark:text-[#87CBB9]">
                                            {inspectingSale.completedCount}/{inspectingSale.plannedCount} Điểm ({inspectingSale.completionRate}%)
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {inspectingSale.unplannedCount > 0 ? `+${inspectingSale.unplannedCount} đột xuất` : '0 đột xuất'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setInspectingSale(null)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1B2E3D] cursor-pointer"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Sub-Tabs */}
                            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#223645] pb-2 text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setInspectSubTab('PHOTOS')}
                                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer ${
                                        inspectSubTab === 'PHOTOS'
                                            ? 'bg-teal-600 text-white dark:bg-[#87CBB9] dark:text-[#0A1926]'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                    }`}
                                >
                                    <Camera size={14} />
                                    <span>Soi Ảnh Check-in Thực Tế ({inspectingSale.actualVisits?.length || 0})</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setInspectSubTab('PLAN')}
                                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer ${
                                        inspectSubTab === 'PLAN'
                                            ? 'bg-teal-600 text-white dark:bg-[#87CBB9] dark:text-[#0A1926]'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                    }`}
                                >
                                    <Calendar size={14} />
                                    <span>Kế Hoạch Cả Tuần ({inspectingSale.plannedVisits?.length || 0})</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setInspectSubTab('APPROVAL')}
                                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer ${
                                        inspectSubTab === 'APPROVAL'
                                            ? 'bg-teal-600 text-white dark:bg-[#87CBB9] dark:text-[#0A1926]'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                    }`}
                                >
                                    <CheckCircle2 size={14} />
                                    <span>Tự Đánh Giá & Phê Duyệt</span>
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                                {inspectSubTab === 'PHOTOS' && (
                                    <div className="space-y-4">
                                        {(!inspectingSale.actualVisits || inspectingSale.actualVisits.length === 0) ? (
                                            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                                                <Camera size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                                                <p className="font-semibold text-slate-600 dark:text-slate-300">Nhân viên này chưa có ảnh check-in nào trong tuần này.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {inspectingSale.actualVisits.map((v: any) => (
                                                    <div
                                                        key={v.id}
                                                        className="p-3.5 rounded-xl border border-slate-200 dark:border-[#223645] bg-slate-50/50 dark:bg-[#16232F]/50 space-y-3"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-mono text-xs font-bold text-teal-600 dark:text-[#87CBB9]">
                                                                        {v.visitNo}
                                                                    </span>
                                                                    {v.isUnplanned && (
                                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                                                            Đột xuất
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <h5 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                                                                    {v.customerName}
                                                                </h5>
                                                                <p className="text-[10px] text-slate-400 font-mono">
                                                                    [{v.customerCode}] • {v.customerChannel}
                                                                </p>
                                                            </div>

                                                            <div className="text-right font-mono text-xs font-bold text-teal-600 dark:text-[#87CBB9]">
                                                                {new Date(v.checkInTime).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} {' '}
                                                                {new Date(v.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>

                                                        {/* Photo Thumbnail */}
                                                        {v.checkInPhoto ? (
                                                            <div
                                                                className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-[#2A4355] bg-black/40 group cursor-pointer shadow-xs"
                                                                onClick={() => setViewPhoto({ title: `Ảnh Check-in: ${v.customerName} (Sale: ${inspectingSale.salespersonName})`, url: v.checkInPhoto, visitId: v.id })}
                                                            >
                                                                <img
                                                                    src={v.checkInPhoto}
                                                                    alt="Check-in Photo"
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[11px] font-bold gap-1.5 backdrop-blur-xs">
                                                                    <Eye size={16} /> Bấm xem ảnh lớn & watermark
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="aspect-video rounded-xl bg-slate-100 dark:bg-[#1B2E3D] flex items-center justify-center text-[10px] text-slate-400">
                                                                Chưa có ảnh
                                                            </div>
                                                        )}

                                                        {/* GPS & Address */}
                                                        {v.checkInAddress && (
                                                            <div className="text-[11px] text-slate-600 dark:text-[#8AAEBB] flex items-center gap-1.5">
                                                                <MapPin size={12} className="text-teal-600 shrink-0" />
                                                                <span className="truncate" title={v.checkInAddress}>{v.checkInAddress}</span>
                                                                {v.checkInLat && v.checkInLng && (
                                                                    <a
                                                                        href={`https://www.google.com/maps?q=${v.checkInLat},${v.checkInLng}`}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="text-teal-600 dark:text-[#87CBB9] hover:underline font-mono text-[10px] shrink-0 font-bold ml-1"
                                                                    >
                                                                        [Maps]
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Notes */}
                                                        {v.notes && (
                                                            <div className="p-2 rounded-lg bg-white dark:bg-[#1B2E3D] text-[11px] text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-[#2A4355]">
                                                                <strong>Ghi chú:</strong> {v.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {inspectSubTab === 'PLAN' && (
                                    <div className="space-y-3">
                                        {(!inspectingSale.plannedVisits || inspectingSale.plannedVisits.length === 0) ? (
                                            <div className="py-16 text-center text-xs text-slate-400">
                                                Nhân viên chưa lên lịch khách nào trong kế hoạch tuần này.
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-100 dark:divide-[#223645] border border-slate-200 dark:border-[#223645] rounded-xl overflow-hidden bg-white dark:bg-[#111C24]">
                                                {inspectingSale.plannedVisits.map((pv: any, pvIdx: number) => (
                                                    <div key={pv.id || pvIdx} className="p-3 text-xs flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-[#16232F]">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-teal-600 dark:text-[#87CBB9] font-bold">
                                                                    {pv.visitDate} ({getVietnameseDayName(pv.visitDate)})
                                                                </span>
                                                                <span className="font-bold text-slate-900 dark:text-white">
                                                                    [{pv.customerCode}] {pv.customerName}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                                Mục tiêu: {pv.purpose}
                                                            </p>
                                                        </div>

                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                                            pv.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-[#1B2E3D] text-slate-500'
                                                        }`}>
                                                            {pv.status === 'COMPLETED' ? '✓ Đã viếng thăm' : 'Chưa đi'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {inspectSubTab === 'APPROVAL' && (
                                    <div className="space-y-4 text-xs">
                                        {/* Self Review Box */}
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#16232F] border border-slate-200 dark:border-[#223645] space-y-1.5">
                                            <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                                                <span>Nội dung nhân viên tự đánh giá tuần:</span>
                                                <span className="text-[10px] font-mono text-slate-400">
                                                    {inspectingSale.submittedAt ? `Nộp lúc: ${new Date(inspectingSale.submittedAt).toLocaleDateString('vi-VN')} ${new Date(inspectingSale.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Chưa nộp'}
                                                </span>
                                            </div>
                                            <p className="text-slate-800 dark:text-slate-100 italic bg-white dark:bg-[#111C24] p-3 rounded-lg border border-slate-200/70 dark:border-[#223645]">
                                                {inspectingSale.selfReview || 'Nhân viên chưa viết tự đánh giá tuần này.'}
                                            </p>
                                        </div>

                                        {/* Manager Feedback Form */}
                                        <div className="space-y-2">
                                            <label className="block font-bold text-slate-700 dark:text-slate-200">
                                                Nhận xét & Chỉ đạo của Quản lý / CEO:
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={inspectFeedbackText}
                                                onChange={e => setInspectFeedbackText(e.target.value)}
                                                placeholder="Ghi nhận xét đánh giá hiệu suất, khen thưởng hoặc nhắc nhở điểm bán cần lưu ý tuần tới..."
                                                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none focus:border-teal-500 text-xs"
                                            />
                                            <div className="flex items-center justify-between pt-2">
                                                <span className="text-[11px] text-slate-400">
                                                    {inspectingSale.reviewedAt && `Đã duyệt lần cuối: ${new Date(inspectingSale.reviewedAt).toLocaleDateString('vi-VN')}`}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveInspectFeedback}
                                                    disabled={savingInspectFeedback || !inspectingSale.planId}
                                                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                                                >
                                                    <CheckCircle2 size={15} />
                                                    {savingInspectFeedback ? 'Đang lưu...' : '✓ Phê Duyệt Kế Hoạch Tuần & Lưu Đánh Giá'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. MODAL: VIEW FULL PHOTO */}
                <PhotoViewerModal
                    viewPhoto={viewPhoto}
                    onClose={() => setViewPhoto(null)}
                    loadingFullPhoto={loadingFullPhoto}
                />
            </div>
        )
    }

    // -----------------------------------------------------------------
    // SALES REPRESENTATIVE VIEW (FIELD EXECUTION SHELL)
    // Account scoping: Rep only sees own data ("tài khoản nào biết tài khoản đó")
    // -----------------------------------------------------------------
    return (
        <div className="space-y-4 sm:space-y-6 max-w-screen-xl mx-auto pb-28 md:pb-16">
            {/* 1. TOP HEADER & ACTIONS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#111C24] px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border border-slate-200 dark:border-[#223645] shadow-xs">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-[#87CBB9]">
                        <MapPin size={20} />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                            Quản Lý Check-in Thị Trường
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-[#8AAEBB]">
                            Kế hoạch tuần ➔ Check-in thực địa ➔ Tổng kết & Đánh giá KPI
                        </p>
                    </div>
                </div>

                {/* Quick Lead Button (Sales rep has no selector dropdown) */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowQuickCreateModal(true)}
                        className="px-3.5 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-[#87CBB9] dark:text-[#0A1926] text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                        <Plus size={14} /> Tạo Khách Mới
                    </button>
                </div>
            </div>

            {/* 2. NAVIGATION TABS (DESKTOP ONLY - ON MOBILE USE FIXED BOTTOM BAR) */}
            <div className="hidden md:flex items-center p-1.5 rounded-2xl bg-slate-100 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] gap-1 overflow-x-auto shadow-xs">
                <button
                    type="button"
                    onClick={() => setActiveTab('CHECKIN')}
                    className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        activeTab === 'CHECKIN'
                            ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-[#2A4355]'
                            : 'text-slate-500 dark:text-[#8AAEBB] hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <MapPin size={15} className={activeTab === 'CHECKIN' ? 'text-teal-600 dark:text-[#87CBB9]' : ''} />
                    <span>Check-in Hôm Nay</span>
                    {todayPlanVisits.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-teal-500/20 text-teal-600 dark:text-[#87CBB9] font-mono">
                            {todayPlanVisits.length}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('PLANNING')}
                    className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        activeTab === 'PLANNING'
                            ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-[#2A4355]'
                            : 'text-slate-500 dark:text-[#8AAEBB] hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <Calendar size={15} className={activeTab === 'PLANNING' ? 'text-teal-600 dark:text-[#87CBB9]' : ''} />
                    <span>Kế Hoạch Tuần</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                        {planVisits.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('REVIEW')}
                    className={`flex-1 min-w-[135px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        activeTab === 'REVIEW'
                            ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-[#2A4355]'
                            : 'text-slate-500 dark:text-[#8AAEBB] hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <TrendingUp size={15} className={activeTab === 'REVIEW' ? 'text-teal-600 dark:text-[#87CBB9]' : ''} />
                    <span>Tổng Kết & Review Tuần</span>
                    {weeklyPlan?.status === 'SUBMITTED' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('HISTORY')}
                    className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        activeTab === 'HISTORY'
                            ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-[#2A4355]'
                            : 'text-slate-500 dark:text-[#8AAEBB] hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <FileText size={15} className={activeTab === 'HISTORY' ? 'text-teal-600 dark:text-[#87CBB9]' : ''} />
                    <span>Lịch Sử & Hình Ảnh</span>
                </button>
            </div>

            {/* ============================================================== */}
            {/* TAB 1: CHECK-IN HÔM NAY (DAILY FIELD WORK) */}
            {/* ============================================================== */}
            {activeTab === 'CHECKIN' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* OFFLINE QUEUE STATUS BANNER (hầm rượu / mất sóng 4G) */}
                    {(offlineDrafts.length > 0 || !isNetworkOnline) && (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
                            <div className="flex items-start sm:items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-500 text-white font-bold shrink-0">
                                    {!isNetworkOnline ? <WifiOff size={18} /> : <UploadCloud size={18} />}
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span>
                                            {!isNetworkOnline
                                                ? 'Đang mất kết nối mạng (Khu vực hầm rượu)'
                                                : `Có ${offlineDrafts.length} lượt check-in ngoại tuyến đang chờ đồng bộ`}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">
                                            {offlineDrafts.length} bản ghi
                                        </span>
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {!isNetworkOnline
                                            ? 'Ảnh và GPS đã được lưu tạm an toàn trong bộ nhớ máy. Khi có 4G/Wifi trở lại, hệ thống sẽ tự động gửi lên server.'
                                            : 'Bản ghi ngoại tuyến sẵn sàng. Hệ thống sẽ tự động gửi hoặc bạn có thể bấm đồng bộ ngay.'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {offlineDrafts.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={syncOfflineDrafts}
                                        disabled={syncingOffline || !isNetworkOnline}
                                        className="px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                                    >
                                        <RefreshCw size={13} className={syncingOffline ? 'animate-spin' : ''} />
                                        {syncingOffline ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Header Controls for Today & Integrated GPS Bar */}
                    <div className="bg-white dark:bg-[#111C24] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#223645] space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <span className="text-[11px] uppercase tracking-wider text-teal-600 dark:text-[#87CBB9] font-black font-mono">
                                    HÔM NAY: {getVietnameseDayName(today).toUpperCase()}, {today.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                                    Danh Sách Điểm Viếng Thăm Trong Ngày
                                </h3>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setUnplannedCustomerId('')
                                        setUnplannedPurpose('')
                                        setShowUnplannedModal(true)
                                    }}
                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                                >
                                    <Sparkles size={14} /> Check-in Đột Xuất (Ngoài Kế Hoạch)
                                </button>
                            </div>
                        </div>

                        {/* GPS Status Indicator embedded in Today's view */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] text-xs">
                            <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                                <Navigation size={13} className={coords.lat ? "text-emerald-500 shrink-0" : "text-amber-500 shrink-0 animate-pulse"} />
                                <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">Vị trí hiện tại:</span>
                                {gettingLocation ? (
                                    <span className="text-slate-500 dark:text-slate-400 italic">Đang dò tìm toạ độ GPS...</span>
                                ) : coords.lat ? (
                                    <span className="font-mono text-slate-900 dark:text-white truncate text-[11px]" title={coords.address}>
                                        {coords.address || `${coords.lat.toFixed(5)}, ${coords.lng?.toFixed(5)}`}
                                    </span>
                                ) : (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-amber-600 dark:text-amber-400 text-[11px] font-medium">{gpsError || 'Chưa nhận toạ độ GPS.'}</span>
                                        <button
                                            type="button"
                                            onClick={() => setShowGpsGuideModal(true)}
                                            className="text-amber-600 dark:text-amber-400 hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer bg-amber-500/10 px-2 py-0.5 rounded-md"
                                        >
                                            <AlertCircle size={12} /> Xem cách bật quyền GPS
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                {(!coords.lat || gpsError) && (
                                    <button
                                        type="button"
                                        onClick={() => setShowGpsGuideModal(true)}
                                        className="hidden sm:flex text-amber-600 dark:text-amber-400 hover:underline font-bold text-[11px] items-center gap-1 cursor-pointer"
                                    >
                                        <AlertCircle size={12} /> Hướng dẫn GPS
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={requestGPS}
                                    disabled={gettingLocation}
                                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1B2E3D] hover:bg-slate-100 dark:hover:bg-[#2A4355] text-slate-700 dark:text-[#8AAEBB] border border-slate-200 dark:border-[#2A4355] text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                                >
                                    <RefreshCw size={11} className={gettingLocation ? "animate-spin" : ""} />
                                    Làm mới GPS
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Today's Scheduled Visits Cards */}
                    {todayPlanVisits.length === 0 ? (
                        <div className="p-8 text-center bg-white dark:bg-[#111C24] rounded-2xl border border-dashed border-slate-300 dark:border-[#223645] space-y-3">
                            <Calendar size={36} className="mx-auto text-slate-400 dark:text-slate-500" />
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                Chưa có điểm viếng thăm nào trong kế hoạch ngày hôm nay
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-[#8AAEBB] max-w-md mx-auto">
                                Bạn có thể chuyển sang tab <strong>Kế Hoạch Tuần</strong> để lên lịch các điểm cần đi, hoặc bấm nút <strong>Check-in Đột Xuất</strong> bên trên để ghé thăm khách phát sinh.
                            </p>
                            <div className="flex items-center justify-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('PLANNING')}
                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-[#1B2E3D] hover:bg-slate-200 dark:hover:bg-[#2A4355] text-slate-800 dark:text-white transition cursor-pointer"
                                >
                                    📅 Lập Kế Hoạch Tuần
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowUnplannedModal(true)}
                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition cursor-pointer"
                                >
                                    ⚡ Check-in Ngay
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {todayPlanVisits.map((item, idx) => {
                                const cust = item.customer || localCustomers.find(c => c.id === item.customerId)
                                const isItemCompleted = item.status === 'COMPLETED' || weekActualVisits.some(v => v.customerId === item.customerId && v.status === 'COMPLETED')
                                const addressStr = cust?.address || (cust as any)?.addresses?.[0]?.addressLine1 || null
                                const phoneStr = cust?.phone || (cust as any)?.purchasingPhone || null

                                return (
                                    <div
                                        key={item.id || idx}
                                        className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3.5 bg-white dark:bg-[#111C24] shadow-xs ${
                                            isItemCompleted
                                                ? 'border-emerald-500/40 bg-emerald-500/5'
                                                : 'border-slate-200 dark:border-[#223645] hover:border-teal-500/50'
                                        }`}
                                    >
                                        <div className="space-y-3">
                                            {/* Header of card: Code, Channel, Name & Status */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-mono text-[11px] font-bold text-teal-600 dark:text-[#87CBB9]">
                                                            [{cust?.code || 'KH'}]
                                                        </span>
                                                        {cust?.channel && (
                                                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1B2E3D] text-slate-500 dark:text-[#8AAEBB] font-mono">
                                                                {cust.channel}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="text-base sm:text-sm font-black text-slate-900 dark:text-white mt-1 line-clamp-2" title={cust?.name}>
                                                        {cust?.name || 'Khách hàng'}
                                                    </h4>
                                                </div>

                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                                                    isItemCompleted
                                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                        : 'bg-slate-100 dark:bg-[#1B2E3D] text-slate-500 dark:text-slate-400'
                                                }`}>
                                                    {isItemCompleted ? '✓ Đã hoàn thành' : 'Chưa đi'}
                                                </span>
                                            </div>

                                            {/* Address & 1-Tap Google Maps Navigation / Call Buttons */}
                                            {(addressStr || phoneStr) && (
                                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#16232F] border border-slate-100 dark:border-[#223645]/60 space-y-2 text-xs">
                                                    {addressStr && (
                                                        <div className="flex items-start gap-1.5">
                                                            <MapPin size={13} className="text-teal-600 dark:text-[#87CBB9] shrink-0 mt-0.5" />
                                                            <span className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-2 leading-relaxed">
                                                                {addressStr}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2 pt-0.5">
                                                        {addressStr && (
                                                            <a
                                                                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressStr)}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-[#87CBB9] font-bold text-[11px] flex items-center justify-center gap-1 transition"
                                                            >
                                                                <Navigation size={12} /> Chỉ đường Maps
                                                            </a>
                                                        )}
                                                        {phoneStr && (
                                                            <a
                                                                href={`tel:${phoneStr}`}
                                                                className="py-1.5 px-3 rounded-lg bg-slate-200 dark:bg-[#1F3342] hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1 transition"
                                                                title={`Gọi ${phoneStr}`}
                                                            >
                                                                <Phone size={12} className="text-emerald-500" /> Gọi điện
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Purpose & Activity */}
                                            <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-[#16232F]/70 border border-slate-100 dark:border-[#223645]/60 text-xs">
                                                <div className="text-slate-400 text-[10px] font-semibold uppercase">Hoạt động dự kiến:</div>
                                                <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                                                    <span>{item.purpose || 'Chăm sóc khách hàng định kỳ'}</span>
                                                </div>
                                            </div>

                                            {/* Completed result notes if any */}
                                            {item.resultNotes && (
                                                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                                                    <div className="font-bold text-[10px] uppercase flex items-center gap-1">
                                                        <Check size={11} /> Kết quả làm việc:
                                                    </div>
                                                    <p className="mt-0.5 leading-relaxed">{item.resultNotes}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Button: Touch Ergonomics (Min height 48px on mobile) */}
                                        <div className="pt-1">
                                            {isItemCompleted ? (
                                                <div className="py-3 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5 min-h-[46px]">
                                                    <CheckCircle2 size={16} /> ✓ Đã Hoàn Thành Viếng Thăm
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={submittingAction}
                                                    onClick={() => startCheckInPlanned(item)}
                                                    className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-[#87CBB9] dark:text-[#0A1926] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md active:scale-[0.98] disabled:opacity-40 cursor-pointer min-h-[48px]"
                                                >
                                                    <Camera size={18} />
                                                    <span>CHECK-IN & CHỤP 1 ẢNH</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* SECTION: NHẬT KÝ & ẢNH CHECK-IN THỰC TẾ HÔM NAY */}
                    <div className="bg-white dark:bg-[#111C24] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#223645] space-y-4 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-[#223645] pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-[#87CBB9]">
                                    <Camera size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Ảnh & Lượt Check-in Thực Tế Hôm Nay
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-600 dark:text-[#87CBB9] font-mono">
                                            {todayActualVisits.length} lượt
                                        </span>
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-[#8AAEBB]">
                                        Ảnh chụp camera thực tế tại điểm bán, toạ độ GPS và kết quả làm việc
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={fetchHistoryVisits}
                                className="self-end sm:self-auto px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-[#1B2E3D] hover:bg-slate-200 dark:hover:bg-[#2A4355] text-slate-700 dark:text-[#8AAEBB] flex items-center gap-1 transition cursor-pointer"
                            >
                                <RefreshCw size={12} /> Tải lại dữ liệu
                            </button>
                        </div>

                        {todayActualVisits.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2">
                                <Camera size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
                                <p className="font-semibold text-slate-600 dark:text-slate-300">Chưa có ảnh check-in nào trong ngày hôm nay.</p>
                                <p className="text-[11px]">Bấm nút <strong>Check-in Điểm Này</strong> hoặc <strong>Check-in Đột Xuất</strong> bên trên để bắt đầu ghi lại hình ảnh thực địa.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {todayActualVisits.map((v) => (
                                    <div
                                        key={v.id}
                                        className="p-4 rounded-xl border border-slate-200 dark:border-[#223645] bg-slate-50/50 dark:bg-[#16232F]/50 flex flex-col justify-between space-y-3 hover:border-teal-500/40 transition shadow-xs"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-mono text-xs font-bold text-teal-600 dark:text-[#87CBB9]">
                                                            {v.visitNo}
                                                        </span>
                                                        {v.isUnplanned && (
                                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                                                Đột xuất
                                                            </span>
                                                        )}
                                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                                            ✓ Đã Check-in
                                                        </span>
                                                    </div>
                                                    <h5 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                                                        {v.customerName}
                                                    </h5>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                                        [{v.customerCode}] • {v.salespersonName} • {v.customerChannel}
                                                    </p>
                                                </div>

                                                <div className="text-right text-xs">
                                                    <div className="font-mono font-bold text-teal-600 dark:text-[#87CBB9]">
                                                        {new Date(v.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">✓ Hoàn thành</span>
                                                </div>
                                            </div>

                                            {/* Single Photo Display: Ảnh Thực Tế Check-in */}
                                            <div className="space-y-1.5 pt-1">
                                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                                    📸 Ảnh chụp thực địa tại điểm bán (GPS, Địa chỉ & Giờ):
                                                </span>
                                                {v.checkInPhoto || v.checkOutPhoto ? (
                                                    <div
                                                        className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-[#2A4355] bg-black/40 group cursor-pointer shadow-xs"
                                                        onClick={() => setViewPhoto({ title: `Ảnh Check-in: ${v.customerName}`, url: (v.checkInPhoto || v.checkOutPhoto)! })}
                                                    >
                                                        <img
                                                            src={v.checkInPhoto || v.checkOutPhoto}
                                                            alt="Check-in Photo"
                                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[11px] font-bold gap-1.5 backdrop-blur-xs">
                                                            <Eye size={16} /> Bấm để phóng to ảnh
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="aspect-video rounded-xl bg-slate-100 dark:bg-[#1B2E3D] flex items-center justify-center text-[10px] text-slate-400">
                                                        Chưa có ảnh
                                                    </div>
                                                )}
                                            </div>

                                            {/* GPS Address & Map link */}
                                            {v.checkInAddress && (
                                                <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-[#8AAEBB] pt-1">
                                                    <MapPin size={12} className="text-teal-600 shrink-0" />
                                                    <span className="truncate" title={v.checkInAddress}>{v.checkInAddress}</span>
                                                    {v.checkInLat && v.checkInLng && (
                                                        <a
                                                            href={`https://www.google.com/maps?q=${v.checkInLat},${v.checkInLng}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-teal-600 dark:text-[#87CBB9] hover:underline font-mono text-[10px] shrink-0 font-bold ml-1"
                                                        >
                                                            [Bản đồ]
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                            {/* Result Notes */}
                                            {v.notes && (
                                                <div className="p-2.5 rounded-xl bg-white dark:bg-[#1B2E3D] border border-slate-200/80 dark:border-[#2A4355] text-xs">
                                                    <div className="font-bold text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                                        <Check size={11} className="text-emerald-500" /> Kết quả làm việc:
                                                    </div>
                                                    <p className="text-slate-800 dark:text-slate-200 mt-0.5 font-medium">{v.notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: KẾ HOẠCH TUẦN (WEEKLY PLANNING) */}
            {/* ============================================================== */}
            {activeTab === 'PLANNING' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Week Navigation Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#111C24] p-4 rounded-2xl border border-slate-200 dark:border-[#223645]">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#142433] p-1 rounded-xl border border-slate-200 dark:border-[#2A4355]">
                                <button
                                    type="button"
                                    onClick={handlePrevWeek}
                                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1F3342] transition cursor-pointer"
                                    title="Tuần trước"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCurrentWeek}
                                    className="px-3 py-1 rounded-lg text-xs font-bold text-slate-800 dark:text-white hover:bg-white dark:hover:bg-[#1F3342] transition cursor-pointer"
                                >
                                    Tuần Này
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNextWeek}
                                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1F3342] transition cursor-pointer"
                                    title="Tuần kế"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            <div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <span>Tuần {currentWeek.week} / Năm {currentWeek.year}</span>
                                    {weeklyPlan?.status && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            weeklyPlan.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                                            weeklyPlan.status === 'SUBMITTED' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                                            'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                        }`}>
                                            {weeklyPlan.status === 'APPROVED' ? 'Đã duyệt' : weeklyPlan.status === 'SUBMITTED' ? 'Đã nộp chốt' : 'Bản nháp'}
                                        </span>
                                    )}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-[#8AAEBB]">
                                    Từ {weekDates[0]?.dateStr} đến {weekDates[6]?.dateStr} • Tổng cộng {planVisits.length} điểm lên lịch
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSavePlan}
                                disabled={savingPlan}
                                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-[#87CBB9] dark:text-[#0A1926] text-white flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                            >
                                <Check size={15} />
                                {savingPlan ? 'Đang lưu kế hoạch...' : 'Lưu Kế Hoạch Tuần'}
                            </button>
                        </div>
                    </div>

                    {/* Note of the week */}
                    <div className="bg-white dark:bg-[#111C24] p-4 rounded-2xl border border-slate-200 dark:border-[#223645] space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <MessageSquare size={13} className="text-teal-600 dark:text-[#87CBB9]" />
                            Mục tiêu & Trọng tâm tuần này (Sales Focus):
                        </label>
                        <input
                            type="text"
                            value={planNote}
                            onChange={e => setPlanNote(e.target.value)}
                            placeholder="Ví dụ: Tập trung đẩy dòng vang Ý mới cho các nhà hàng Thảo Điền, chốt công nợ tháng trước..."
                            className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none focus:border-teal-500"
                        />
                    </div>

                    {/* MOBILE HORIZONTAL DATE STRIP + ACTIVE DAY SCHEDULE */}
                    <div className="md:hidden space-y-4">
                        {/* Horizontal Date Strip */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                            {weekDates.map(day => {
                                const dayVisits = planVisits.filter(v => v.visitDate === day.dateStr)
                                const isSelected = (mobileSelectedDate || todayStr) === day.dateStr

                                return (
                                    <button
                                        key={day.dateStr}
                                        type="button"
                                        onClick={() => setMobileSelectedDate(day.dateStr)}
                                        className={`shrink-0 flex flex-col items-center py-2.5 px-3.5 rounded-2xl border transition-all text-center min-w-[76px] cursor-pointer ${
                                            isSelected
                                                ? 'bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-500/30 font-bold'
                                                : day.isToday
                                                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-700 dark:text-[#87CBB9]'
                                                    : 'bg-white dark:bg-[#111C24] border-slate-200 dark:border-[#223645] text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <span className={`text-[11px] font-bold uppercase tracking-wider ${isSelected ? 'text-teal-100' : 'text-slate-400 dark:text-slate-400'}`}>
                                            {day.dayName}
                                        </span>
                                        <span className="text-sm font-black mt-0.5">
                                            {day.dateStr.split('-').slice(1).reverse().join('/')}
                                        </span>
                                        <span className={`mt-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold font-mono ${
                                            isSelected
                                                ? 'bg-white/20 text-white'
                                                : dayVisits.length > 0
                                                    ? 'bg-teal-500/20 text-teal-600 dark:text-[#87CBB9]'
                                                    : 'bg-slate-100 dark:bg-[#1B2E3D] text-slate-400'
                                        }`}>
                                            {dayVisits.length} điểm
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Selected Day Content Card on Mobile */}
                        {(() => {
                            const activeDateStr = mobileSelectedDate || todayStr
                            const currentSelectedDay = weekDates.find(d => d.dateStr === activeDateStr) || weekDates[0]
                            if (!currentSelectedDay) return null
                            const dayVisits = planVisits.filter(v => v.visitDate === currentSelectedDay.dateStr)

                            return (
                                <div className="p-4 rounded-2xl border border-teal-500/30 bg-white dark:bg-[#111C24] space-y-3.5 shadow-xs">
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#223645] pb-2.5">
                                        <div>
                                            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                                <span>{currentSelectedDay.dayName} ({currentSelectedDay.dateStr})</span>
                                                {currentSelectedDay.isToday && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-600 dark:text-[#87CBB9]">
                                                        Hôm nay
                                                    </span>
                                                )}
                                            </h4>
                                            <p className="text-[11px] text-slate-500 dark:text-[#8AAEBB]">
                                                Có {dayVisits.length} điểm viếng thăm đã lên lịch
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setQuickAddModal({ open: true, dateStr: currentSelectedDay.dateStr, dayName: currentSelectedDay.dayName })
                                                setAddCustomerId('')
                                                setAddActivityType('PERIODIC_CARE')
                                                setAddCustomPurpose('')
                                            }}
                                            className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-xs"
                                        >
                                            <Plus size={14} /> Thêm Điểm
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {dayVisits.length === 0 ? (
                                            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-[#142433] rounded-xl border border-dashed border-slate-200 dark:border-[#2A4355]">
                                                Chưa lên lịch điểm nào cho ngày {currentSelectedDay.dayName}. Bấm "Thêm Điểm" để lên lịch.
                                            </div>
                                        ) : (
                                            dayVisits.map((item, vIdx) => {
                                                const cust = item.customer || localCustomers.find(c => c.id === item.customerId)
                                                return (
                                                    <div
                                                        key={item.id || vIdx}
                                                        className="p-3 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] text-xs flex items-start justify-between gap-2"
                                                    >
                                                        <div className="min-w-0 flex-1 space-y-0.5">
                                                            <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                                                                <span className="font-mono text-[10px] text-teal-600 dark:text-[#87CBB9] mr-1">
                                                                    [{cust?.code || 'KH'}]
                                                                </span>
                                                                {cust?.name || 'Khách hàng'}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 dark:text-[#8AAEBB] line-clamp-1">
                                                                {item.purpose}
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePlanVisit(item.id)}
                                                            className="text-slate-400 hover:text-red-500 p-1 transition cursor-pointer"
                                                            title="Xóa khỏi lịch"
                                                        >
                                                            <X size={15} />
                                                        </button>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            )
                        })()}
                    </div>

                    {/* DESKTOP 7 DAYS GRID */}
                    <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {weekDates.map(day => {
                            const dayVisits = planVisits.filter(v => v.visitDate === day.dateStr)

                            return (
                                <div
                                    key={day.dateStr}
                                    className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 bg-white dark:bg-[#111C24] transition-all ${
                                        day.isToday
                                            ? 'border-teal-500/60 ring-2 ring-teal-500/20 shadow-sm'
                                            : 'border-slate-200 dark:border-[#223645]'
                                    }`}
                                >
                                    <div className="space-y-3">
                                        {/* Day Header */}
                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#223645] pb-2.5">
                                            <div>
                                                <span className={`text-xs font-black ${day.isToday ? 'text-teal-600 dark:text-[#87CBB9]' : 'text-slate-800 dark:text-white'}`}>
                                                    {day.dayName} {day.isToday ? '(Hôm nay)' : ''}
                                                </span>
                                                <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                                    {day.dateStr}
                                                </div>
                                            </div>

                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-[#1B2E3D] text-slate-600 dark:text-slate-300 font-mono">
                                                {dayVisits.length} điểm
                                            </span>
                                        </div>

                                        {/* Visits List in this day */}
                                        <div className="space-y-2 min-h-[140px]">
                                            {dayVisits.length === 0 ? (
                                                <div className="h-full flex items-center justify-center text-center p-4 text-[11px] text-slate-400 dark:text-slate-500 italic">
                                                    Chưa lên lịch điểm nào
                                                </div>
                                            ) : (
                                                dayVisits.map((item, vIdx) => {
                                                    const cust = item.customer || localCustomers.find(c => c.id === item.customerId)
                                                    return (
                                                        <div
                                                            key={item.id || vIdx}
                                                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] text-xs space-y-1 relative group"
                                                        >
                                                            <div className="flex items-start justify-between gap-1">
                                                                <div className="font-bold text-slate-900 dark:text-white line-clamp-1 pr-4" title={cust?.name}>
                                                                    <span className="font-mono text-[10px] text-teal-600 dark:text-[#87CBB9] mr-1">
                                                                        [{cust?.code || 'KH'}]
                                                                    </span>
                                                                    {cust?.name || 'Khách hàng'}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemovePlanVisit(item.id)}
                                                                    className="text-slate-400 hover:text-red-500 p-0.5 transition cursor-pointer"
                                                                    title="Xóa khỏi lịch"
                                                                >
                                                                    <X size={13} />
                                                                </button>
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 dark:text-[#8AAEBB] line-clamp-1">
                                                                {item.purpose}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Add button for this day */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQuickAddModal({ open: true, dateStr: day.dateStr, dayName: day.dayName })
                                            setAddCustomerId('')
                                            setAddActivityType('PERIODIC_CARE')
                                            setAddCustomPurpose('')
                                        }}
                                        className="w-full py-2 rounded-xl bg-slate-100 dark:bg-[#1B2E3D] hover:bg-slate-200 dark:hover:bg-[#2A4355] text-slate-700 dark:text-[#8AAEBB] font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                                    >
                                        <Plus size={13} /> Thêm Điểm
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 3: TỔNG KẾT & REVIEW TUẦN (WEEKLY REVIEW & AUDIT) */}
            {/* ============================================================== */}
            {activeTab === 'REVIEW' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Header Controls for Review */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#111C24] p-4 rounded-2xl border border-slate-200 dark:border-[#223645]">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#142433] p-1 rounded-xl border border-slate-200 dark:border-[#2A4355]">
                                <button type="button" onClick={handlePrevWeek} className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1F3342] cursor-pointer">
                                    <ChevronLeft size={16} />
                                </button>
                                <button type="button" onClick={handleCurrentWeek} className="px-3 py-1 rounded-lg text-xs font-bold text-slate-800 dark:text-white hover:bg-white dark:hover:bg-[#1F3342] cursor-pointer">
                                    Tuần Này
                                </button>
                                <button type="button" onClick={handleNextWeek} className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1F3342] cursor-pointer">
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white">
                                    Báo Cáo Tổng Kết Tuần {currentWeek.week} / {currentWeek.year}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-[#8AAEBB]">
                                    Đối soát Kế Hoạch vs Thực Tế (Planned vs Actual)
                                </p>
                            </div>
                        </div>

                        {/* Status badge */}
                        <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-xl text-xs font-black ${
                                weeklyPlan?.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                                weeklyPlan?.status === 'SUBMITTED' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                                'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            }`}>
                                {weeklyPlan?.status === 'APPROVED' ? '✓ QUẢN LÝ ĐÃ PHÊ DUYỆT' :
                                 weeklyPlan?.status === 'SUBMITTED' ? '⏳ ĐÃ CHỐT - ĐANG CHỜ DUYỆT' :
                                 '📝 CHƯA CHỐT BÁO CÁO'}
                            </span>
                        </div>
                    </div>

                    {/* KPI Metrics Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                        <div className="p-4 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] space-y-1">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Kế hoạch</span>
                            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                                {reviewStats.plannedCount}
                            </div>
                            <span className="text-[10px] text-slate-400">Điểm đã lên lịch</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] space-y-1">
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Đã đi thực tế</span>
                            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                {reviewStats.completedCount}
                            </div>
                            <span className="text-[10px] text-slate-400">Điểm đã check-out</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] space-y-1">
                            <span className="text-[11px] font-semibold text-teal-600 dark:text-[#87CBB9]">Tỷ lệ hoàn thành</span>
                            <div className="text-xl sm:text-2xl font-black text-teal-600 dark:text-[#87CBB9] font-mono">
                                {reviewStats.rate}%
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                                <div className="bg-teal-500 h-full rounded-full" style={{ width: `${Math.min(100, reviewStats.rate)}%` }} />
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] space-y-1">
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Đi đột xuất</span>
                            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                                {reviewStats.unplannedCount}
                            </div>
                            <span className="text-[10px] text-slate-400">Ngoài kế hoạch</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] space-y-1">
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">Khách mới mở</span>
                            <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                {reviewStats.newLeads}
                            </div>
                            <span className="text-[10px] text-slate-400">Leads tiềm năng</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] space-y-1">
                            <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">Thời gian TB</span>
                            <div className="text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400 font-mono">
                                {reviewStats.avgDuration}p
                            </div>
                            <span className="text-[10px] text-slate-400">Ở tại điểm bán</span>
                        </div>
                    </div>

                    {/* Detailed Comparison: Planned vs Actual by Day */}
                    <div className="bg-white dark:bg-[#111C24] rounded-2xl border border-slate-200 dark:border-[#223645] overflow-hidden shadow-xs">
                        <div className="p-4 border-b border-slate-200 dark:border-[#223645] bg-slate-50/50 dark:bg-[#16232F]/50">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                Chi Tiết Đối Soát Lịch Trình Tuần
                            </h4>
                        </div>

                        <div className="divide-y divide-slate-200 dark:divide-[#223645]">
                            {weekDates.map(day => {
                                const dayPlanned = planVisits.filter(v => v.visitDate === day.dateStr)
                                const dayActual = weekActualVisits.filter(v => v.checkInTime.startsWith(day.dateStr))

                                return (
                                    <div key={day.dateStr} className="p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-xs text-slate-900 dark:text-white">
                                                    {day.dayName} ({day.dateStr})
                                                </span>
                                                {day.isToday && (
                                                    <span className="px-2 py-0.2 rounded-full text-[10px] bg-teal-500/20 text-teal-600 dark:text-[#87CBB9] font-bold">
                                                        Hôm nay
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                                Kế hoạch: {dayPlanned.length} • Thực tế: {dayActual.length}
                                            </span>
                                        </div>

                                        {dayPlanned.length === 0 && dayActual.length === 0 ? (
                                            <div className="text-[11px] text-slate-400 dark:text-slate-500 italic pl-2">
                                                Không có hoạt động trong ngày này
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {/* Planned Column */}
                                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] space-y-2">
                                                    <div className="text-[11px] font-bold text-slate-500 uppercase">📋 Kế hoạch dự kiến</div>
                                                    {dayPlanned.length === 0 ? (
                                                        <div className="text-[11px] text-slate-400 italic">Không lên lịch trước</div>
                                                    ) : (
                                                        dayPlanned.map((p, idx) => {
                                                            const cust = p.customer || localCustomers.find(c => c.id === p.customerId)
                                                            const isDone = dayActual.some(a => a.customerId === p.customerId && a.status === 'COMPLETED')
                                                            return (
                                                                <div key={p.id || idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 dark:border-[#223645] last:border-0">
                                                                    <div className="min-w-0 flex-1 pr-2">
                                                                        <span className="font-semibold text-slate-900 dark:text-white">
                                                                            {cust?.name || 'Khách hàng'}
                                                                        </span>
                                                                        <div className="text-[10px] text-slate-500">{p.purpose}</div>
                                                                    </div>
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${isDone ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'}`}>
                                                                        {isDone ? '✓ Đã đi' : 'Bỏ lỡ'}
                                                                    </span>
                                                                </div>
                                                            )
                                                        })
                                                    )}
                                                </div>

                                                {/* Actual Column */}
                                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] space-y-2">
                                                    <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">📍 Thực tế thực hiện</div>
                                                    {dayActual.length === 0 ? (
                                                        <div className="text-[11px] text-slate-400 italic">Chưa có lượt check-in nào</div>
                                                    ) : (
                                                        dayActual.map(a => (
                                                            <div key={a.id} className="text-xs py-1.5 border-b border-slate-200/60 dark:border-[#223645] last:border-0 space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-bold text-slate-900 dark:text-white">
                                                                        {a.customer?.name}
                                                                        {a.isUnplanned && (
                                                                            <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600">
                                                                                ĐỘT XUẤT
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    <span className="text-[10px] font-mono text-emerald-600 font-bold">
                                                                        {a.durationMinutes ? `${a.durationMinutes} phút` : 'Đang ở tại chỗ'}
                                                                    </span>
                                                                </div>
                                                                {a.notes && (
                                                                    <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1B2E3D] p-1.5 rounded border border-slate-200 dark:border-[#2A4355]">
                                                                        💬 {a.notes}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Section: Sale Self-Review (Sale Tự Chốt Báo Cáo Tuần) */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] space-y-3 shadow-xs">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Award size={16} className="text-teal-600 dark:text-[#87CBB9]" />
                                Báo Cáo Tự Đánh Giá Tuần Của Sale (Weekly Self-Evaluation)
                            </h4>
                            {weeklyPlan?.submittedAt && (
                                <span className="text-[11px] font-mono text-slate-400">
                                    Đã nộp: {new Date(weeklyPlan.submittedAt).toLocaleString('vi-VN')}
                                </span>
                            )}
                        </div>

                        <textarea
                            rows={4}
                            value={selfReviewText}
                            onChange={e => setSelfReviewText(e.target.value)}
                            placeholder="Sale tự tổng kết tuần: Những điểm làm tốt, kết quả đạt được, khó khăn tại thị trường HORECA, đề xuất chính sách giá / hỗ trợ mẫu rượu..."
                            className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none focus:border-teal-500 resize-y"
                        />

                        <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-slate-400">
                                Bắt buộc sale tự chốt vào cuối mỗi tuần để Trưởng phòng phê duyệt.
                            </span>

                            <button
                                type="button"
                                onClick={handleSubmitWeeklyReport}
                                disabled={submittingReport}
                                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                            >
                                <Send size={14} />
                                {submittingReport ? 'Đang nộp...' : 'Chốt Báo Cáo Tuần'}
                            </button>
                        </div>
                    </div>

                    {/* Section: Manager Feedback & Approval */}
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] space-y-3">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <ShieldCheck size={16} className="text-teal-600 dark:text-[#87CBB9]" />
                            Nhận Xét & Chỉ Đạo Của Quản Lý (Manager Feedback)
                        </h4>

                        {isManager ? (
                            <div className="space-y-3">
                                <textarea
                                    rows={3}
                                    value={managerFeedbackText}
                                    onChange={e => setManagerFeedbackText(e.target.value)}
                                    placeholder="Quản lý nhập nhận xét, khen thưởng hoặc chỉ đạo bổ sung cho nhân viên..."
                                    className="w-full p-3 text-xs rounded-xl bg-white dark:bg-[#1B2E3D] border border-slate-200 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none focus:border-teal-500"
                                />
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSaveManagerFeedback}
                                        disabled={savingFeedback}
                                        className="px-5 py-2 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                                    >
                                        <Check size={14} />
                                        {savingFeedback ? 'Đang lưu...' : 'Lưu Nhận Xét & Phê Duyệt Tuần'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-white dark:bg-[#1B2E3D] border border-slate-200 dark:border-[#2A4355] text-xs">
                                {managerFeedbackText ? (
                                    <div className="space-y-1">
                                        <p className="font-semibold text-slate-800 dark:text-white">{managerFeedbackText}</p>
                                        {weeklyPlan?.reviewedAt && (
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                Đã duyệt lúc: {new Date(weeklyPlan.reviewedAt).toLocaleString('vi-VN')}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-slate-400 italic">Quản lý chưa để lại nhận xét cho tuần này.</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 4: LỊCH SỬ & HÌNH ẢNH (HISTORY & PHOTOS) */}
            {/* ============================================================== */}
            {activeTab === 'HISTORY' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Filters Bar */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={filterSearch}
                                    onChange={e => setFilterSearch(e.target.value)}
                                    placeholder="Tìm mã visit, tên khách, tên sale..."
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none focus:border-teal-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Quick Date Chips */}
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#142433] p-1 rounded-xl border border-slate-200 dark:border-[#2A4355] text-xs">
                                <button
                                    type="button"
                                    onClick={() => setFilterDate('')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                        !filterDate
                                            ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white shadow-xs'
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    Tất Cả
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterDate(todayStr)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                        filterDate === todayStr
                                            ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white shadow-xs'
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    Hôm Nay
                                </button>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-[#142433] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2A4355]">
                                <Calendar size={13} className="text-slate-400" />
                                <input
                                    type="date"
                                    value={filterDate}
                                    onChange={e => setFilterDate(e.target.value)}
                                    className="bg-transparent text-slate-800 dark:text-white font-bold outline-none cursor-pointer text-xs"
                                />
                                {filterDate && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterDate('')}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 cursor-pointer"
                                        title="Bỏ chọn ngày"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>

                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                className="px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] text-slate-800 dark:text-white outline-none cursor-pointer font-bold"
                            >
                                <option value="ALL">Tất cả trạng thái</option>
                                <option value="IN_PROGRESS">Đang viếng thăm</option>
                                <option value="COMPLETED">Đã hoàn thành</option>
                            </select>

                            <button
                                type="button"
                                onClick={fetchHistoryVisits}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] text-slate-600 dark:text-[#8AAEBB] hover:bg-slate-200 dark:hover:bg-[#1B2E3D] transition cursor-pointer"
                                title="Làm mới danh sách"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-[#223645] bg-white dark:bg-[#111C24] shadow-xs">
                        <div className="p-3 bg-slate-50/50 dark:bg-[#142433]/50 border-b border-slate-200 dark:border-[#223645] flex items-center justify-between text-xs text-slate-500 dark:text-[#8AAEBB]">
                            <span>Hiển thị <strong>{filteredHistoryVisits.length}</strong> lượt viếng thăm</span>
                            {filterDate && (
                                <span className="font-mono">Ngày: <strong>{filterDate}</strong></span>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-[#142433] text-slate-500 dark:text-[#8AAEBB] border-b border-slate-200 dark:border-[#223645]">
                                        <th className="p-3.5 font-bold">Mã Visit</th>
                                        <th className="p-3.5 font-bold">Khách Hàng & Sale</th>
                                        <th className="p-3.5 font-bold text-center">Ảnh Thực Tế (GPS)</th>
                                        <th className="p-3.5 font-bold text-center">Giờ Check-in</th>
                                        <th className="p-3.5 font-bold">Toạ Độ & Vị Trí</th>
                                        <th className="p-3.5 font-bold">Hoạt Động & Ghi Chú</th>
                                        <th className="p-3.5 font-bold text-center">Trạng Thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-[#223645]">
                                    {filteredHistoryVisits.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-400 space-y-2">
                                                <p>Không có lượt viếng thăm nào khớp với bộ lọc hiện tại.</p>
                                                {(filterDate || filterSearch || filterStatus !== 'ALL') && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFilterDate('')
                                                            setFilterSearch('')
                                                            setFilterStatus('ALL')
                                                        }}
                                                        className="px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-[#87CBB9] text-xs font-bold hover:underline cursor-pointer"
                                                    >
                                                        Xóa bộ lọc để xem tất cả
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ) : filteredHistoryVisits.map(v => (
                                        <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-[#16232F] transition">
                                            <td className="p-3.5 font-mono font-bold text-teal-600 dark:text-[#87CBB9]">
                                                {v.visitNo}
                                                {v.isUnplanned && (
                                                    <span className="block text-[9px] font-sans font-bold text-amber-500">
                                                        Đột xuất
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3.5">
                                                <div className="font-bold text-slate-900 dark:text-white">{v.customerName}</div>
                                                <div className="text-[10px] text-slate-500 font-mono">
                                                    [{v.customerCode}] • {v.salespersonName}
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                {v.checkInPhoto || v.checkOutPhoto ? (
                                                    <img
                                                        src={v.checkInPhoto || v.checkOutPhoto}
                                                        alt="Check-in"
                                                        className="w-14 h-14 object-cover rounded-xl border border-slate-200 dark:border-[#2A4355] cursor-pointer mx-auto hover:scale-105 transition shadow-xs"
                                                        onClick={() => setViewPhoto({ title: `Ảnh Check-in: ${v.customerName}`, url: (v.checkInPhoto || v.checkOutPhoto)! })}
                                                    />
                                                ) : <span className="text-slate-400 italic">Chưa có</span>}
                                            </td>
                                            <td className="p-3.5 text-center font-bold font-mono text-teal-600 dark:text-[#87CBB9] whitespace-nowrap">
                                                {new Date(v.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="p-3.5 max-w-xs">
                                                {v.checkInLat && v.checkInLng ? (
                                                    <div className="space-y-0.5">
                                                        <a
                                                            href={`https://www.google.com/maps?q=${v.checkInLat},${v.checkInLng}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1 text-teal-600 dark:text-[#87CBB9] hover:underline font-mono text-[11px]"
                                                        >
                                                            <Navigation size={11} /> {v.checkInLat.toFixed(4)}, {v.checkInLng.toFixed(4)}
                                                        </a>
                                                        {v.checkInAddress && (
                                                            <p className="text-[10px] text-slate-500 truncate" title={v.checkInAddress}>
                                                                {v.checkInAddress}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : <span className="text-slate-400">Không có GPS</span>}
                                            </td>
                                            <td className="p-3.5 max-w-xs text-slate-700 dark:text-slate-200 text-xs">
                                                <div className="line-clamp-2" title={v.notes || v.purpose}>
                                                    {v.notes || v.purpose || <span className="text-slate-400 italic">Chưa có</span>}
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-center whitespace-nowrap">
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                                    ✓ Hoàn thành
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL: UNPLANNED CHECK-IN */}
            {/* ============================================================== */}
            {showUnplannedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
                    <div className="w-full max-w-md bg-white dark:bg-[#111C24] p-5 rounded-2xl border border-slate-200 dark:border-[#223645] shadow-2xl space-y-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#223645] pb-3">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Sparkles size={18} className="text-amber-500" />
                                Check-in Đột Xuất Ngoài Kế Hoạch
                            </h3>
                            <button onClick={() => setShowUnplannedModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3.5 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    Chọn khách hàng:
                                </label>
                                <SearchableCustomerCombobox
                                    customers={localCustomers}
                                    selectedCustomerId={unplannedCustomerId}
                                    onSelect={c => setUnplannedCustomerId(c.id)}
                                    onOpenQuickCreate={() => setShowQuickCreateModal(true)}
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    Loại hoạt động:
                                </label>
                                <select
                                    value={unplannedActivityType}
                                    onChange={e => setUnplannedActivityType(e.target.value)}
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-300 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none font-medium"
                                >
                                    {ACTIVITY_PRESETS.map(p => (
                                        <option key={p.value} value={p.value}>
                                            {p.icon} {p.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    Mục đích cụ thể (tùy chọn):
                                </label>
                                <input
                                    type="text"
                                    value={unplannedPurpose}
                                    onChange={e => setUnplannedPurpose(e.target.value)}
                                    placeholder="Ghi rõ việc sẽ làm tại khách này..."
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-300 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#223645]">
                            <button
                                type="button"
                                onClick={() => setShowUnplannedModal(false)}
                                className="px-4 py-2 text-xs font-medium rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={startCheckInUnplanned}
                                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow cursor-pointer"
                            >
                                <Camera size={15} /> Mở Camera Check-in
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL: QUICK ADD VISIT TO PLANNING DAY */}
            {/* ============================================================== */}
            {quickAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
                    <div className="w-full max-w-md bg-white dark:bg-[#111C24] p-5 rounded-2xl border border-slate-200 dark:border-[#223645] shadow-2xl space-y-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#223645] pb-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    Thêm Điểm Đến: {quickAddModal.dayName}
                                </h3>
                                <p className="text-[11px] font-mono text-slate-400">{quickAddModal.dateStr}</p>
                            </div>
                            <button onClick={() => setQuickAddModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3.5 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    Chọn khách hàng:
                                </label>
                                <SearchableCustomerCombobox
                                    customers={localCustomers}
                                    selectedCustomerId={addCustomerId}
                                    onSelect={c => setAddCustomerId(c.id)}
                                    onOpenQuickCreate={() => setShowQuickCreateModal(true)}
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    Hoạt động dự kiến:
                                </label>
                                <select
                                    value={addActivityType}
                                    onChange={e => setAddActivityType(e.target.value)}
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-300 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none font-medium"
                                >
                                    {ACTIVITY_PRESETS.map(p => (
                                        <option key={p.value} value={p.value}>
                                            {p.icon} {p.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    Ghi chú bổ sung (tùy chọn):
                                </label>
                                <input
                                    type="text"
                                    value={addCustomPurpose}
                                    onChange={e => setAddCustomPurpose(e.target.value)}
                                    placeholder="Ví dụ: Giới thiệu vang trắng mới, thu công nợ 5 triệu..."
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-300 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#223645]">
                            <button
                                type="button"
                                onClick={() => setQuickAddModal(null)}
                                className="px-4 py-2 text-xs font-medium rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleAddVisitToPlan}
                                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow cursor-pointer"
                            >
                                <Plus size={15} /> Thêm Vào Lịch
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL: QUICK CREATE PROSPECT CUSTOMER */}
            {/* ============================================================== */}
            {showQuickCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
                    <form onSubmit={handleQuickCreateCustomer} className="w-full max-w-md bg-white dark:bg-[#111C24] p-5 rounded-2xl border border-slate-200 dark:border-[#223645] shadow-2xl space-y-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#223645] pb-3">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Plus size={18} className="text-teal-600 dark:text-[#87CBB9]" />
                                Tạo Nhanh Khách Hàng Tiềm Năng
                            </h3>
                            <button type="button" onClick={() => setShowQuickCreateModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    Tên nhà hàng / Khách hàng <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={quickCustName}
                                    onChange={e => setQuickCustName(e.target.value)}
                                    placeholder="Ví dụ: Nhà hàng La Maison, Wine Bar 1985..."
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-300 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none focus:border-teal-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                        Kênh kinh doanh:
                                    </label>
                                    <select
                                        value={quickCustChannel}
                                        onChange={e => setQuickCustChannel(e.target.value)}
                                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-300 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none"
                                    >
                                        <option value="HORECA">HORECA (Nhà hàng/Bar)</option>
                                        <option value="WHOLESALE_DISTRIBUTOR">Đại lý phân phối</option>
                                        <option value="VIP_RETAIL">Bán lẻ VIP</option>
                                        <option value="RETAIL">Bán lẻ thông thường</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                        Người liên hệ:
                                    </label>
                                    <input
                                        type="text"
                                        value={quickCustContact}
                                        onChange={e => setQuickCustContact(e.target.value)}
                                        placeholder="Quản lý, Sommelier..."
                                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-300 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    Số điện thoại liên hệ:
                                </label>
                                <input
                                    type="text"
                                    value={quickCustPhone}
                                    onChange={e => setQuickCustPhone(e.target.value)}
                                    placeholder="0901234567"
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-300 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none font-mono"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    Địa chỉ điểm bán:
                                </label>
                                <input
                                    type="text"
                                    value={quickCustAddress}
                                    onChange={e => setQuickCustAddress(e.target.value)}
                                    placeholder="Số nhà, đường, phường, quận..."
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-[#142433] border border-slate-300 dark:border-[#2A4355] text-slate-900 dark:text-white outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#223645]">
                            <button
                                type="button"
                                onClick={() => setShowQuickCreateModal(false)}
                                className="px-4 py-2 text-xs font-medium rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                disabled={creatingCustomer}
                                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                            >
                                <Plus size={15} />
                                {creatingCustomer ? 'Đang tạo...' : 'Tạo Khách Tiềm Năng'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ============================================================== */}
            {/* LIVE CAMERA MODAL */}
            {/* ============================================================== */}
            {cameraTarget && (
                <LiveCameraModal
                    title="Chụp Ảnh Check-in & Toạ Độ GPS"
                    subtitle="Chụp ảnh thực tế mặt tiền hoặc quầy trưng bày rượu tại khách hàng"
                    customerName={cameraTarget.customerName}
                    salespersonName={currentUserName}
                    locationInfo={coords.address}
                    onCapture={handleConfirmCheckInPhoto}
                    onClose={() => setCameraTarget(null)}
                    onOpenGpsGuide={() => setShowGpsGuideModal(true)}
                    gpsError={gpsError}
                />
            )}

            {/* ============================================================== */}
            {/* GPS PERMISSION GUIDE MODAL (1-TOUCH MOBILE SAFARI / CHROME) */}
            {/* ============================================================== */}
            <GpsPermissionGuideModal
                isOpen={showGpsGuideModal}
                onClose={() => setShowGpsGuideModal(false)}
                onRetryGps={requestGPS}
                gettingLocation={gettingLocation}
            />

            {/* ============================================================== */}
            {/* PHOTO VIEWER MODAL (WITH ON-DEMAND FULL HD RESOLUTION) */}
            {/* ============================================================== */}
            <PhotoViewerModal
                viewPhoto={viewPhoto}
                onClose={() => setViewPhoto(null)}
                loadingFullPhoto={loadingFullPhoto}
            />

            {/* ============================================================== */}
            {/* MOBILE FIXED BOTTOM NAVIGATION BAR (TOUCH-OPTIMIZED APP SHELL) */}
            {/* ============================================================== */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0E1A24]/95 backdrop-blur-lg border-t border-slate-200 dark:border-[#223645] px-1.5 py-1.5 flex items-center justify-around md:hidden shadow-2xl safe-area-pb">
                <button
                    type="button"
                    onClick={() => setActiveTab('CHECKIN')}
                    className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative min-h-[46px] ${
                        activeTab === 'CHECKIN'
                            ? 'text-teal-600 dark:text-[#87CBB9] font-bold'
                            : 'text-slate-500 dark:text-[#8AAEBB] hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'CHECKIN' ? 'bg-teal-500/15 ring-1 ring-teal-500/30' : ''}`}>
                        <MapPin size={18} />
                    </div>
                    <span className="text-[10px] mt-0.5 tracking-tight">Hôm nay</span>
                    {todayPlanVisits.length > 0 && (
                        <span className="absolute top-1 right-2 px-1.5 py-0.2 rounded-full text-[9px] bg-teal-500 text-white font-mono font-bold leading-tight shadow-xs">
                            {todayPlanVisits.length}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('PLANNING')}
                    className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative min-h-[46px] ${
                        activeTab === 'PLANNING'
                            ? 'text-teal-600 dark:text-[#87CBB9] font-bold'
                            : 'text-slate-500 dark:text-[#8AAEBB] hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'PLANNING' ? 'bg-teal-500/15 ring-1 ring-teal-500/30' : ''}`}>
                        <Calendar size={18} />
                    </div>
                    <span className="text-[10px] mt-0.5 tracking-tight">Lịch tuần</span>
                    {planVisits.length > 0 && (
                        <span className="absolute top-1 right-2 px-1.5 py-0.2 rounded-full text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono font-bold leading-tight">
                            {planVisits.length}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('REVIEW')}
                    className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative min-h-[46px] ${
                        activeTab === 'REVIEW'
                            ? 'text-teal-600 dark:text-[#87CBB9] font-bold'
                            : 'text-slate-500 dark:text-[#8AAEBB] hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'REVIEW' ? 'bg-teal-500/15 ring-1 ring-teal-500/30' : ''}`}>
                        <TrendingUp size={18} />
                    </div>
                    <span className="text-[10px] mt-0.5 tracking-tight">Tổng kết</span>
                    {weeklyPlan?.status === 'SUBMITTED' && (
                        <span className="absolute top-1 right-3 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0E1A24]" />
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('HISTORY')}
                    className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative min-h-[46px] ${
                        activeTab === 'HISTORY'
                            ? 'text-teal-600 dark:text-[#87CBB9] font-bold'
                            : 'text-slate-500 dark:text-[#8AAEBB] hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-teal-500/15 ring-1 ring-teal-500/30' : ''}`}>
                        <Camera size={18} />
                    </div>
                    <span className="text-[10px] mt-0.5 tracking-tight">Hình ảnh</span>
                </button>
            </div>
        </div>
    )
}
