'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
    MapPin, Camera, Clock, CheckCircle2, AlertCircle, Search, Filter,
    User, ChevronRight, Eye, RefreshCw, FileText, Navigation,
    Calendar, Plus, X, Download, ShieldCheck, ChevronLeft,
    Check, Send, Award, TrendingUp, Sparkles, Phone,
    Wifi, WifiOff, UploadCloud, Target, Save, LayoutGrid, List, Lock
} from 'lucide-react'
import {
    checkInSalesVisit, getSalesVisits,
    reverseGeocodeAction, quickCreateProspectCustomer, getWeeklyPlanWithVisits,
    saveWeeklyPlanAction, submitWeeklyReportAction, saveManagerFeedbackAction,
    getTeamWeeklySalesOverview, getSalesVisitFullPhoto, updateSalesVisitReportAction
} from './actions'
import { LiveCameraModal } from './LiveCameraModal'
import { QuickReportModal } from './QuickReportModal'
import { TodayLiveFeed, type TodayFeedItem } from './TodayLiveFeed'
import { toast } from 'sonner'
import { useVisitLocale, getVisitLocale, getLocalizedDayName, getLocalizedShortDayName, getActivityPresetLabel, type VisitLocale, VISIT_I18N } from './i18n'

interface Props {
    initialVisits: any[]
    customers: { id: string; code: string; name: string; channel: string | null; address?: string | null; phone?: string | null }[]
    currentUserId: string
    currentUserName: string
    isManager: boolean
    initialTeamData?: any
    initialPlan?: any
}

// Activity Presets for Wine ERP
export const ACTIVITY_PRESETS = [
    { value: 'PERIODIC_CARE', label: 'Chăm sóc khách hàng định kỳ', icon: '🤝', color: '#0891B2' },
    { value: 'WINE_TASTING', label: 'Thử rượu & Giới thiệu mẫu mới', icon: '🍷', color: '#D4A853' },
    { value: 'MERCHANDISE_CHECK', label: 'Kiểm tra tồn kho & Trưng bày điểm bán', icon: '📦', color: '#4A8FAB' },
    { value: 'DEBT_COLLECTION', label: 'Thu hồi công nợ / Đối soát hóa đơn', icon: '💵', color: '#E57373' },
    { value: 'CONTRACT_NEGOTIATION', label: 'Ký kết hợp đồng / Đàm phán giá', icon: '📝', color: '#BA68C8' },
    { value: 'COMPLAINT_HANDLING', label: 'Xử lý khiếu nại & Hậu mãi', icon: '⚠️', color: '#FFB74D' },
    { value: 'OTHER', label: 'Mục đích khác', icon: '📌', color: '#90A4AE' },
]

export function getVietnameseDayName(date: Date | string, locale: VisitLocale = 'vi'): string {
    return getLocalizedDayName(date, locale)
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
    onOpenQuickCreate,
    locale = 'vi'
}: {
    customers: { id: string; code: string; name: string; channel: string | null }[]
    selectedCustomerId: string
    onSelect: (customer: any) => void
    onOpenQuickCreate?: () => void
    locale?: VisitLocale
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
                className="w-full p-2.5 sm:p-3 text-xs outline-none rounded-xl bg-slate-50 dark:bg-white border border-slate-300 dark:border-slate-200 text-slate-800 dark:text-slate-900 hover:border-[#87CBB9] cursor-pointer flex items-center justify-between transition group shadow-xs"
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Search size={14} className="text-[#0891B2] shrink-0" />
                    {selectedCust ? (
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                            <strong className="text-[#0D8275] dark:text-[#0891B2] font-mono mr-1.5">[{selectedCust.code}]</strong>
                            {selectedCust.name}
                        </span>
                    ) : (
                        <span className="text-slate-400 dark:text-slate-600 font-medium truncate">
                            {locale === 'en' ? '🔍 Click to select client...' : '🔍 Bấm chọn khách hàng...'}
                        </span>
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
                    <ChevronRight size={14} className="text-slate-400 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-white transition rotate-90 shrink-0" />
                )}
            </div>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl shadow-2xl p-2 space-y-2 border border-slate-200 dark:border-slate-200 bg-white dark:bg-white">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    autoFocus
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder={locale === 'en' ? 'Type client name or code...' : 'Gõ tên hoặc mã khách hàng...'}
                                    className="w-full pl-8 pr-3 py-2 text-base sm:text-xs outline-none rounded-lg bg-slate-100 dark:bg-[#0D1A24] border border-slate-200 dark:border-slate-200 text-slate-900 dark:text-white focus:border-[#87CBB9] placeholder:text-slate-400"
                                />
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                            {onOpenQuickCreate && (
                                <button
                                    type="button"
                                    onClick={() => { setOpen(false); onOpenQuickCreate(); }}
                                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-[#0891B2] text-white hover:bg-[#72bca9] flex items-center gap-1 shrink-0 cursor-pointer"
                                    title={locale === 'en' ? 'Create new client' : 'Tạo khách mới'}
                                >
                                    <Plus size={13} /> {locale === 'en' ? 'New Client' : 'Khách mới'}
                                </button>
                            )}
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-1">
                            {filtered.length === 0 ? (
                                <div className="p-3 text-xs text-center text-slate-500 dark:text-slate-600">
                                    {locale === 'en' ? `No client found matching "${query}"` : `Không tìm thấy khách hàng khớp "${query}"`}
                                    {onOpenQuickCreate && (
                                        <button
                                            type="button"
                                            onClick={() => { setOpen(false); onOpenQuickCreate(); }}
                                            className="mt-2 block mx-auto text-xs text-[#0D8275] dark:text-[#0891B2] font-bold underline cursor-pointer"
                                        >
                                            {locale === 'en' ? '+ Quick create new client now' : '+ Tạo nhanh khách mới ngay'}
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
                                        className={`w-full text-left p-2.5 rounded-lg transition flex items-center justify-between text-xs cursor-pointer ${selectedCustomerId === c.id ? 'bg-[#87CBB9]/20 text-[#0D8275] dark:text-[#0891B2] font-bold' : 'hover:bg-slate-100 dark:hover:bg-white text-slate-700 dark:text-slate-900'}`}
                                    >
                                        <div className="min-w-0 flex-1 pr-2">
                                            <span className="font-mono font-bold text-[#0D8275] dark:text-[#0891B2] mr-2">[{c.code}]</span>
                                            <span className="font-semibold">{c.name}</span>
                                        </div>
                                        {c.channel && (
                                            <span className="text-[10px] uppercase bg-slate-200 dark:bg-white px-2 py-0.5 rounded font-mono text-slate-600 dark:text-slate-600">
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
    locale = 'vi',
}: {
    isOpen: boolean
    onClose: () => void
    onRetryGps: () => Promise<any>
    gettingLocation: boolean
    locale?: VisitLocale
}) {
    const [tab, setTab] = useState<'IOS' | 'ANDROID'>('IOS')
    if (!isOpen) return null

    const isEn = locale === 'en'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150" onClick={onClose}>
            <div className="w-full max-w-md bg-white dark:bg-slate-50 rounded-2xl border border-slate-200 dark:border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-200 flex items-center justify-between bg-amber-500/10">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500 text-white font-bold">
                            📍
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {isEn ? 'How to Enable GPS Location Permissions' : 'Hướng Dẫn Bật Quyền Vị Trí (GPS)'}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {isEn ? 'Required to watermark field coordinates onto check-in photos' : 'Bắt buộc để gắn toạ độ thực địa vào ảnh check-in'}
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
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162534] border border-slate-200/60 dark:border-slate-200">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center shrink-0">
                                    1
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {isEn ? 'Tap "aA" or website settings icon' : 'Bấm nút "aA" hoặc biểu tượng trang web'}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {isEn ? 'Located on the left side of Safari address bar.' : 'Nằm ở góc trái trên thanh nhập địa chỉ URL của trình duyệt Safari.'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162534] border border-slate-200/60 dark:border-slate-200">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center shrink-0">
                                    2
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {isEn ? 'Select "Website Settings"' : 'Chọn "Cài đặt trang web" (Website Settings)'}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {isEn ? <>Find <strong>Location</strong> ➔ Change to <strong>Allow</strong>.</> : <>Tìm mục <strong>Vị trí (Location)</strong> ➔ Chuyển thành <strong>Cho phép (Allow)</strong>.</>}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162534] border border-slate-200/60 dark:border-slate-200">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center shrink-0">
                                    3
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {isEn ? 'Enable iOS Device Location' : 'Bật dịch vụ định vị của máy'}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {isEn ? 'Go to Settings ➔ Privacy & Security ➔ Location Services ➔ Turn ON.' : 'Vào Cài đặt máy ➔ Quyền riêng tư & Bảo mật ➔ Dịch vụ định vị ➔ Gạt BẬT.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162534] border border-slate-200/60 dark:border-slate-200">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center shrink-0">
                                    1
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {isEn ? 'Tap the 🔒 (Lock) or ⚙️ icon' : 'Bấm vào biểu tượng 🔒 (Khóa) hoặc ⚙️'}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {isEn ? 'Located on the left side of Chrome address bar.' : 'Nằm ngay bên trái thanh địa chỉ URL của Google Chrome.'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162534] border border-slate-200/60 dark:border-slate-200">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center shrink-0">
                                    2
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {isEn ? 'Select "Permissions" ➔ "Location"' : 'Chọn "Quyền" (Permissions) ➔ "Vị trí"'}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {isEn ? <>Turn <strong>Location</strong> switch to <strong>Allow</strong> (blue/green).</> : <>Bật công tắc <strong>Vị trí</strong> thành <strong>Cho phép</strong> (màu xanh).</>}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162534] border border-slate-200/60 dark:border-slate-200">
                                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center shrink-0">
                                    3
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {isEn ? 'Turn on phone GPS' : 'Bật GPS của điện thoại'}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {isEn ? 'Swipe down notification shade, tap to enable Location (GPS).' : 'Kéo thanh thông báo từ trên xuống, chạm bật biểu tượng Vị trí (GPS).'}
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
                                    toast.success(isEn ? 'GPS coordinates acquired' : 'Đã nhận toạ độ GPS')
                                    onClose()
                                } else {
                                    toast.warning(isEn ? 'GPS coordinates not acquired yet. Please check device location settings.' : 'Chưa nhận được toạ độ GPS. Vui lòng kiểm tra định vị trên thiết bị.')
                                }
                            }}
                            disabled={gettingLocation}
                            className="w-full py-3 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw size={15} className={gettingLocation ? 'animate-spin' : ''} />
                            {gettingLocation ? (isEn ? 'Acquiring GPS location...' : 'Đang xác định vị trí...') : (isEn ? 'Retry GPS Location' : 'Thử lại định vị GPS')}
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
    loadingFullPhoto,
    locale = 'vi'
}: {
    viewPhoto: { title: string; url: string; visitId?: string } | null
    onClose: () => void
    loadingFullPhoto: boolean
    locale?: VisitLocale
}) {
    if (!viewPhoto) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md" onClick={onClose}>
            <div
                className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-200 shadow-2xl flex flex-col space-y-3 animate-in zoom-in-95"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-200 pb-3">
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate pr-2">
                            {viewPhoto.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            {loadingFullPhoto ? (
                                <span className="text-amber-500 font-medium flex items-center gap-1">
                                    <RefreshCw size={11} className="animate-spin" /> {locale === 'en' ? 'Loading original photo...' : 'Đang tải ảnh gốc...'}
                                </span>
                            ) : (
                                <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                                    {locale === 'en' ? 'Store check-in photo' : 'Ảnh check-in tại điểm bán'}
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <a
                            href={viewPhoto.url}
                            download={`Sales_Visit_${Date.now()}.jpg`}
                            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-teal-600 text-white dark:bg-[#87CBB9] dark:text-slate-900 hover:opacity-90 flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                        >
                            <Download size={14} /> {locale === 'en' ? 'Download' : 'Tải Ảnh'}
                        </a>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white cursor-pointer">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex items-center justify-center bg-black/70 rounded-xl p-2 border border-slate-200 relative min-h-[260px]">
                    <img
                        src={viewPhoto.url}
                        alt="Enlarged"
                        className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-2xl transition-all duration-300"
                    />
                    {loadingFullPhoto && (
                        <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-2 border border-amber-500/40 shadow-xl animate-pulse">
                            <RefreshCw size={13} className="animate-spin text-amber-400" />
                            <span>{locale === 'en' ? 'Loading original photo...' : 'Đang tải ảnh gốc...'}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export function SalesVisitsClient({ initialVisits, customers, currentUserId, currentUserName, isManager, initialTeamData, initialPlan }: Props) {
    const { locale, setLocale, toggleLocale, t } = useVisitLocale()
    const [activeTab, setActiveTab] = useState<'PLANNING' | 'CHECKIN' | 'REVIEW' | 'HISTORY'>('CHECKIN')
    const [localCustomers, setLocalCustomers] = useState(customers)
    const selectedSalespersonId = currentUserId

    // Team Overview State (Exclusively for Manager / CEO)
    const [teamData, setTeamData] = useState<any | null>(initialTeamData || null)
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
    const [weeklyPlan, setWeeklyPlan] = useState<any | null>(initialPlan?.plan || null)
    const [planVisits, setPlanVisits] = useState<any[]>(initialPlan?.plan?.visits || [])
    const [weekActualVisits, setWeekActualVisits] = useState<any[]>(initialPlan?.actualVisits || [])
    const [loadingPlan, setLoadingPlan] = useState(false)
    const [savingPlan, setSavingPlan] = useState(false)
    const [planNote, setPlanNote] = useState(initialPlan?.plan?.note || '')

    // Self review & Manager feedback state
    const [selfReviewText, setSelfReviewText] = useState(initialPlan?.plan?.selfReview || '')
    const [submittingReport, setSubmittingReport] = useState(false)
    const [managerFeedbackText, setManagerFeedbackText] = useState('')
    const [savingFeedback, setSavingFeedback] = useState(false)

    // Daily visits & history (filterDate empty by default to show all latest visits)
    const [historyVisits, setHistoryVisits] = useState<any[]>(initialVisits || [])
    const [filterDate, setFilterDate] = useState('')
    const [filterStatus, setFilterStatus] = useState('ALL')
    const [filterSearch, setFilterSearch] = useState('')
    const [historyViewMode, setHistoryViewMode] = useState<'GRID' | 'TABLE'>('GRID')

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

    // Quick Report Modal State (Field Report by Sales Rep / Manager)
    const [quickReportTarget, setQuickReportTarget] = useState<any | null>(null)

    const handleSaveQuickReport = useCallback(async (visitId: string, notes: string): Promise<boolean> => {
        try {
            const res = await updateSalesVisitReportAction(visitId, notes)
            if (!res.success) {
                toast.error(res.error || (locale === 'en' ? 'Failed to save report' : 'Không thể lưu báo cáo'))
                return false
            }
            toast.success(locale === 'en' ? 'Quick report saved successfully!' : 'Đã lưu báo cáo thực địa thành công!')

            // 1. Update historyVisits
            setHistoryVisits(prev => prev.map(v => v.id === visitId ? { ...v, notes: res.notes } : v))

            // 2. Update planVisits (if linked)
            setPlanVisits(prev => prev.map(pv => pv.salesVisitId === visitId ? { ...pv, resultNotes: res.notes } : pv))

            // 3. Update teamData if manager
            setTeamData((prev: any) => {
                if (!prev?.items) return prev
                return {
                    ...prev,
                    items: prev.items.map((rep: any) => ({
                        ...rep,
                        actualVisits: rep.actualVisits?.map((av: any) => av.id === visitId ? { ...av, notes: res.notes } : av)
                    }))
                }
            })

            // 4. Update inspectingSale if open
            setInspectingSale((prev: any) => {
                if (!prev) return prev
                return {
                    ...prev,
                    actualVisits: prev.actualVisits?.map((av: any) => av.id === visitId ? { ...av, notes: res.notes } : av)
                }
            })

            return true
        } catch (e: any) {
            toast.error(e.message || 'Lỗi khi lưu báo cáo')
            return false
        }
    }, [locale])

    // Monday of the current week (Vietnam timezone) to allow editing reports within the active week
    const currentWeekMondayStr = useMemo(() => {
        try {
            const [y, m, d] = todayStr.split('-').map(Number)
            const dObj = new Date(y, m - 1, d)
            const dayOfWeek = dObj.getDay()
            const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
            const currentMonObj = new Date(dObj)
            currentMonObj.setDate(dObj.getDate() + diffToMon)
            return `${currentMonObj.getFullYear()}-${String(currentMonObj.getMonth() + 1).padStart(2, '0')}-${String(currentMonObj.getDate()).padStart(2, '0')}`
        } catch {
            return todayStr
        }
    }, [todayStr])

    // Determine whether the target quick report is read-only (past weeks or submitted/approved plans are locked for Sales Rep)
    const isQuickReportReadOnly = useMemo(() => {
        if (!quickReportTarget) return false
        if (isManager) return false // Manager can edit any report

        // If the weekly plan has already been submitted or approved, lock it
        if (weeklyPlan?.status === 'SUBMITTED' || weeklyPlan?.status === 'APPROVED') {
            return true
        }

        const timeVal = quickReportTarget.checkInTime || quickReportTarget.visitDate
        if (!timeVal) return false
        try {
            const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(timeVal))
            // Editable within current week. Only locked if belongs to a past week:
            return dStr < currentWeekMondayStr
        } catch {
            return String(timeVal).slice(0, 10) < currentWeekMondayStr
        }
    }, [quickReportTarget, isManager, currentWeekMondayStr, weeklyPlan?.status])

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
            toast.success(getVisitLocale() === 'en' ? '📶 Network connection restored! Checking offline sync...' : '📶 Đã có kết nối mạng trở lại! Hệ thống đang tự động kiểm tra đồng bộ...')
        }
        const handleOffline = () => {
            setIsNetworkOnline(false)
            toast.warning(getVisitLocale() === 'en' ? '📶 Network disconnected. Cellar check-in drafts will be saved offline.' : '📶 Bạn đã mất kết nối mạng. Các lượt check-in hầm rượu sẽ được lưu ngoại tuyến trên máy.')
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
        let cancelled = false
        setLoadingFullPhoto(true)

        getSalesVisitFullPhoto(viewPhoto.visitId).then(res => {
            if (!cancelled && res.success && res.photo) {
                setViewPhoto(prev => prev ? { ...prev, url: res.photo! } : null)
            }
        }).catch(err => {
            console.warn('Full photo load err', err)
        }).finally(() => {
            if (!cancelled) setLoadingFullPhoto(false)
        })

        return () => { cancelled = true }
    }, [viewPhoto?.visitId])

    // -----------------------------------------------------------------
    // GPS & LOCATION RETRIEVAL
    // -----------------------------------------------------------------
    const requestGPS = useCallback(async (): Promise<{ lat?: number; lng?: number; address?: string }> => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            setGpsError(locale === 'en' ? 'Browser does not support Geolocation.' : 'Trình duyệt không hỗ trợ Geolocation.')
            return {}
        }

        setGettingLocation(true)
        setGpsError(null)

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const lat = pos.coords.latitude
                    const lng = pos.coords.longitude
                    let address = locale === 'en' ? `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}` : `Toạ độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
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
                    let msg = locale === 'en' ? 'Unable to acquire GPS. Please check location permissions on browser/phone!' : 'Không thể lấy GPS. Bạn hãy kiểm tra quyền Vị trí trên trình duyệt/điện thoại!'
                    if (err.code === 1) msg = locale === 'en' ? 'GPS permission was denied in browser settings!' : 'Quyền GPS đã bị từ chối trong Cài đặt trình duyệt!'
                    if (err.code === 2) msg = locale === 'en' ? 'Device location is turned off. Please turn on GPS on your phone!' : 'Thiết bị đang tắt định vị GPS. Vui lòng bật GPS trên máy!'
                    if (err.code === 3) msg = locale === 'en' ? 'GPS location request timed out.' : 'Hết thời gian chờ lấy toạ độ GPS (Timeout).'
                    setGpsError(msg)
                    setGettingLocation(false)
                    resolve({})
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            )
        })
    }, [])

    useEffect(() => {
        // Fast, non-blocking GPS pre-warm only for Sales Reps (Managers do not check in)
        if (!isManager && typeof window !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude
                    const lng = pos.coords.longitude
                    setCoords({ lat, lng, address: `Toạ độ: ${lat.toFixed(4)}, ${lng.toFixed(4)}` })
                },
                () => {},
                { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 }
            )
        }
    }, [isManager])

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

    const isFirstWeeklyRef = useRef(true)
    useEffect(() => {
        if (isManager) return // Manager doesn't need rep weekly plan
        if (isFirstWeeklyRef.current && initialPlan) {
            isFirstWeeklyRef.current = false
            return
        }
        loadWeeklyData()
    }, [isManager, loadWeeklyData, initialPlan])

    // Load History
    const fetchHistoryVisits = useCallback(async () => {
        const data = await getSalesVisits({
            salespersonId: (isManager && selectedSalespersonId === 'ALL') ? undefined : selectedSalespersonId,
            date: filterDate ? filterDate : undefined,
            status: filterStatus
        })
        setHistoryVisits(data || [])
    }, [isManager, selectedSalespersonId, filterDate, filterStatus])

    const isFirstHistoryRef = useRef(true)
    useEffect(() => {
        if (isFirstHistoryRef.current) {
            isFirstHistoryRef.current = false
            return
        }
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
            toast.error(res.error || (locale === 'en' ? 'Error loading sales team overview' : 'Lỗi tải tổng quan đội sale'))
        }
        setLoadingTeam(false)
    }, [isManager, currentWeek, locale])

    const isFirstTeamRef = useRef(true)
    useEffect(() => {
        if (!isManager) return
        if (isFirstTeamRef.current && initialTeamData) {
            isFirstTeamRef.current = false
            return
        }
        loadTeamData()
    }, [isManager, currentWeek, loadTeamData, initialTeamData])

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

    // Derive Today's Team Visits for Manager's Live Feed
    const todayTeamVisits: TodayFeedItem[] = useMemo(() => {
        if (!teamData?.items) return []
        const list: TodayFeedItem[] = []
        for (const item of teamData.items) {
            if (!item.actualVisits) continue
            for (const v of item.actualVisits) {
                if (!v.checkInTime) continue
                let dateStr = ''
                try {
                    dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(v.checkInTime))
                } catch {
                    dateStr = v.checkInTime.slice(0, 10)
                }
                if (dateStr === todayStr) {
                    list.push({
                        id: v.id,
                        visitNo: v.visitNo,
                        customerId: v.customerId,
                        customerName: v.customerName,
                        customerCode: v.customerCode,
                        customerChannel: v.customerChannel,
                        salespersonId: item.salespersonId,
                        salespersonName: item.salespersonName,
                        salespersonEmail: item.salespersonEmail,
                        checkInTime: v.checkInTime,
                        checkInAddress: v.checkInAddress,
                        checkInLat: v.checkInLat,
                        checkInLng: v.checkInLng,
                        checkInPhoto: v.checkInPhoto,
                        purpose: v.purpose,
                        notes: v.notes,
                        isUnplanned: v.isUnplanned,
                        status: v.status
                    })
                }
            }
        }
        return list.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime())
    }, [teamData, todayStr])

    const repsList = useMemo(() => {
        if (!teamData?.items) return []
        return teamData.items.map((i: any) => ({
            id: i.salespersonId,
            name: i.salespersonName
        }))
    }, [teamData])

    const handleSaveInspectFeedback = async () => {
        if (!inspectingSale?.planId) {
            toast.error(locale === 'en' ? 'This sales rep does not have a weekly plan to review' : 'Nhân viên này chưa có bản ghi kế hoạch tuần để duyệt')
            return
        }
        if (!inspectFeedbackText.trim()) {
            toast.error(locale === 'en' ? 'Please enter feedback notes' : 'Vui lòng nhập nội dung nhận xét')
            return
        }
        setSavingInspectFeedback(true)
        const res = await saveManagerFeedbackAction({
            planId: inspectingSale.planId,
            managerFeedback: inspectFeedbackText.trim(),
            managerId: currentUserId,
        })
        if (res.success) {
            toast.success(locale === 'en' ? `Feedback saved for ${inspectingSale.salespersonName}` : `Đã lưu nhận xét cho ${inspectingSale.salespersonName}`)
            await loadTeamData()
            setInspectingSale((prev: any) => prev ? {
                ...prev,
                planStatus: 'APPROVED',
                managerFeedback: inspectFeedbackText.trim(),
                reviewedAt: new Date().toISOString()
            } : null)
        } else {
            toast.error(res.error || (locale === 'en' ? 'Error saving feedback' : 'Lỗi khi lưu nhận xét'))
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
            toast.error(locale === 'en' ? 'Please enter customer / client name' : 'Vui lòng nhập tên khách hàng')
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
            toast.success(locale === 'en' ? `Prospect client created: ${res.customer.name}` : `Đã tạo nhanh khách hàng tiềm năng: ${res.customer.name}`)
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
            toast.error(res.error || (locale === 'en' ? 'Error creating new customer' : 'Lỗi tạo khách hàng mới'))
        }
        setCreatingCustomer(false)
    }

    // -----------------------------------------------------------------
    // WEEKLY PLAN OPERATIONS
    // -----------------------------------------------------------------
    const handleAddVisitToPlan = () => {
        if (!quickAddModal || !addCustomerId) {
            toast.error(locale === 'en' ? 'Please select a customer' : 'Vui lòng chọn khách hàng')
            return
        }

        const selectedCust = localCustomers.find(c => c.id === addCustomerId)
        const purpose = addCustomPurpose.trim() || getActivityPresetLabel(addActivityType, locale) || (locale === 'en' ? 'Periodic Customer Care' : 'Chăm sóc khách hàng định kỳ')

        const newScheduleItem = {
            id: `temp_${Date.now()}`,
            customerId: addCustomerId,
            customer: selectedCust ? { id: selectedCust.id, code: selectedCust.code, name: selectedCust.name, channel: selectedCust.channel } : undefined,
            visitDate: quickAddModal.dateStr,
            purpose,
            status: 'PLANNED',
        }

        setPlanVisits(prev => [...prev, newScheduleItem])
        toast.success(locale === 'en' ? `Added to schedule: ${getLocalizedDayName(quickAddModal.dateStr, locale)}` : `Đã thêm vào lịch ${quickAddModal.dayName}`)
        setQuickAddModal(null)
        setAddCustomerId('')
        setAddCustomPurpose('')
    }

    const handleRemovePlanVisit = (visitId: string) => {
        const target = planVisits.find(v => v.id === visitId)
        if (!isManager && target) {
            const vDateStr = target.visitDate?.slice(0, 10)
            if (vDateStr && vDateStr < todayStr) {
                toast.error(locale === 'en' ? 'Cannot delete plan for past days' : 'Không thể xóa kế hoạch của các ngày đã qua')
                return
            }
        }
        setPlanVisits(prev => prev.filter(v => v.id !== visitId))
        toast.info(locale === 'en' ? 'Visit removed from schedule' : 'Đã xóa điểm viếng thăm khỏi kế hoạch')
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
            toast.success(locale === 'en' ? 'Weekly plan saved successfully!' : 'Đã lưu thành công kế hoạch tuần!')
            await loadWeeklyData()
        } else {
            toast.error((locale === 'en' ? 'Error saving plan: ' : 'Lỗi khi lưu kế hoạch: ') + res.error)
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
            toast.error(locale === 'en' ? 'Please select a customer' : 'Vui lòng chọn khách hàng')
            return
        }
        const cust = localCustomers.find(c => c.id === unplannedCustomerId)
        const purpose = unplannedPurpose.trim() || getActivityPresetLabel(unplannedActivityType, locale) || (locale === 'en' ? 'Periodic Customer Care' : 'Chăm sóc khách hàng định kỳ')

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
            toast.success(locale === 'en' ? `Synced ${successCount} offline check-in draft(s)` : `Đã đồng bộ ${successCount} lượt check-in ngoại tuyến`)
            await loadWeeklyData()
            await fetchHistoryVisits()
        }
    }, [selectedSalespersonId, loadWeeklyData, fetchHistoryVisits, locale])

    // Auto-sync offline drafts when network recovers or when mounted online
    useEffect(() => {
        if (isNetworkOnline && offlineDrafts.length > 0 && !syncingOffline) {
            syncOfflineDrafts()
        }
    }, [isNetworkOnline, offlineDrafts.length, syncingOffline, syncOfflineDrafts])

    const handleConfirmCheckInPhoto = async (photoBase64: string, thumbnailBase64?: string) => {
        if (!cameraTarget || !cameraTarget.customerId) return
        const customerId = cameraTarget.customerId
        const customerName = cameraTarget.customerName || (locale === 'en' ? 'Customer' : 'Khách hàng')
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
                toast.warning(locale === 'en' ? `📶 No 4G connection (cellar). Check-in at ${customerName} saved offline! Will auto-sync when online.` : `📶 Bạn đang mất sóng 4G (hầm rượu). Đã lưu tạm lượt check-in tại ${customerName} vào bộ nhớ máy! Hệ thống sẽ tự động đồng bộ khi có sóng trở lại.`, {
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
                toast.success(locale === 'en' ? `Check-in successful at ${customerName}!` : `Check-in thành công tại ${customerName}!`)
                await loadWeeklyData()
                await fetchHistoryVisits()
            } else {
                toast.error((locale === 'en' ? 'Check-in error: ' : 'Lỗi Check-in: ') + res.error)
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
                toast.warning(locale === 'en' ? `📶 Network transmission error. Check-in at ${customerName} safely saved offline!` : `📶 Lỗi đường truyền mạng (hầm rượu/mất sóng). Đã lưu an toàn lượt check-in tại ${customerName} trên máy!`, {
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
            toast.error(locale === 'en' ? 'You need to click "Save Plan" before submitting weekly report' : 'Bạn cần bấm "Lưu Kế Hoạch" trước khi nộp báo cáo tuần')
            return
        }
        if (!selfReviewText.trim() || selfReviewText.trim().length < 5) {
            toast.error(locale === 'en' ? 'Please enter self-evaluation content (at least 5 characters)' : 'Vui lòng nhập nội dung tự đánh giá tuần (tối thiểu 5 ký tự)')
            return
        }

        setSubmittingReport(true)
        const res = await submitWeeklyReportAction({
            planId: weeklyPlan.id,
            salespersonId: selectedSalespersonId,
            selfReview: selfReviewText,
        })

        if (res.success) {
            toast.success(locale === 'en' ? 'Weekly report submitted successfully!' : 'Đã nộp chốt báo cáo tuần thành công!')
            await loadWeeklyData()
        } else {
            toast.error((locale === 'en' ? 'Report submission error: ' : 'Lỗi chốt báo cáo: ') + res.error)
        }
        setSubmittingReport(false)
    }

    const handleSaveManagerFeedback = async () => {
        if (!weeklyPlan?.id) {
            toast.error(locale === 'en' ? 'No weekly plan data to add review' : 'Chưa có dữ liệu kế hoạch tuần để nhận xét')
            return
        }
        if (!managerFeedbackText.trim()) {
            toast.error(locale === 'en' ? 'Please enter feedback notes' : 'Vui lòng nhập nội dung nhận xét')
            return
        }

        setSavingFeedback(true)
        const res = await saveManagerFeedbackAction({
            planId: weeklyPlan.id,
            managerFeedback: managerFeedbackText,
            managerId: currentUserId,
        })

        if (res.success) {
            toast.success(locale === 'en' ? 'Feedback saved and weekly plan approved for Sales Rep!' : 'Đã lưu nhận xét và phê duyệt tuần cho Sale!')
            await loadWeeklyData()
        } else {
            toast.error((locale === 'en' ? 'Error saving feedback: ' : 'Lỗi lưu nhận xét: ') + res.error)
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

        return {
            plannedCount,
            completedCount,
            unplannedCount,
            rate,
            newLeads,
        }
    }, [planVisits, weekActualVisits])

    // -----------------------------------------------------------------
    // DEDICATED MANAGER VIEW (EXECUTIVE FIELD OPERATIONS REPORT)
    // Managers do NOT check in, no tabs, direct team report matrix & photos
    // -----------------------------------------------------------------
    if (isManager) {
        return (
            <div className="space-y-3 sm:space-y-4 max-w-screen-xl mx-auto pb-16">
                {/* 1. TOP COMPACT HEADER & CONTROLS */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-50 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-200 shadow-xs">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-[#0891B2]">
                            <MapPin size={17} />
                        </div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                {t.header.title}
                            </h2>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                {t.header.managerBadge}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center flex-wrap gap-2">
                        {/* Week Switcher */}
                        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-white p-0.5 rounded-lg border border-slate-200 dark:border-slate-200">
                            <button
                                type="button"
                                onClick={handlePrevWeek}
                                className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1F3342] cursor-pointer"
                                title={t.header.prevWeek}
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={handleCurrentWeek}
                                className="px-2.5 py-1 rounded-md text-xs font-bold text-slate-800 dark:text-white hover:bg-white dark:hover:bg-[#1F3342] cursor-pointer"
                            >
                                {t.header.weekLabel} {currentWeek.week} / {currentWeek.year}
                            </button>
                            <button
                                type="button"
                                onClick={handleNextWeek}
                                className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1F3342] cursor-pointer"
                                title={t.header.nextWeek}
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>

                        {/* Quick Language Toggle */}
                        <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-white border border-slate-200 dark:border-slate-200 text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setLocale('vi')}
                                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                    locale === 'vi'
                                        ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white font-black shadow-xs'
                                        : 'text-slate-500 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="Tiếng Việt"
                            >
                                VI
                            </button>
                            <button
                                type="button"
                                onClick={() => setLocale('en')}
                                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                    locale === 'en'
                                        ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white font-black shadow-xs'
                                        : 'text-slate-500 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="English"
                            >
                                EN
                            </button>
                        </div>

                        {/* Refresh Button */}
                        <button
                            type="button"
                            onClick={loadTeamData}
                            disabled={loadingTeam}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-[#87CBB9] dark:text-slate-900 text-white flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={loadingTeam ? "animate-spin" : ""} />
                            <span>{loadingTeam ? t.header.refreshing : t.header.refresh}</span>
                        </button>
                    </div>
                </div>

                {/* 2. COMPACT KPI SUMMARY CARDS */}
                {teamMetrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
                        <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 space-y-0.5 shadow-xs">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{t.kpis.totalSalesReps}</span>
                            <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                                {teamMetrics.totalSales}
                            </div>
                            <span className="text-[9px] text-slate-400">{t.kpis.repsDesc}</span>
                        </div>

                        <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 space-y-0.5 shadow-xs">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{t.kpis.totalTargetVisits}</span>
                            <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                                {teamMetrics.totalPlanned}
                            </div>
                            <span className="text-[9px] text-slate-400">{t.kpis.targetDesc}</span>
                        </div>

                        <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 space-y-0.5 shadow-xs">
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{t.kpis.actualCheckins}</span>
                            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                {teamMetrics.totalCompleted}
                            </div>
                            <span className="text-[9px] text-slate-400">{t.kpis.actualCheckinsDesc}</span>
                        </div>

                        <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 space-y-0.5 shadow-xs">
                            <span className="text-[10px] font-semibold text-teal-600 dark:text-[#0891B2]">{t.kpis.completionRate}</span>
                            <div className="text-xl font-black text-teal-600 dark:text-[#0891B2] font-mono">
                                {teamMetrics.overallRate}%
                            </div>
                            <span className="text-[9px] text-slate-400">{t.kpis.completionDesc}</span>
                        </div>

                        <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 space-y-0.5 shadow-xs">
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{t.kpis.pendingReports}</span>
                            <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                                {teamMetrics.pendingReview}
                            </div>
                            <span className="text-[9px] text-slate-400">{t.kpis.pendingReportsDesc}</span>
                        </div>
                    </div>
                )}

                {/* 2.5 BẢNG TIN BÁO CÁO THỰC ĐỊA HÔM NAY (TODAY'S LIVE FIELD FEED) */}
                <TodayLiveFeed
                    visits={todayTeamVisits}
                    repsList={repsList}
                    onViewPhoto={(title, url, visitId) => setViewPhoto({ title, url, visitId })}
                    locale={locale}
                    onOpenEditReport={(v) => setQuickReportTarget(v)}
                />

                {/* 3. Team Matrix Table */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-200 bg-white dark:bg-slate-50 shadow-xs overflow-hidden">
                    <div className="p-4 bg-slate-50/50 dark:bg-white/50 border-b border-slate-200 dark:border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                {locale === 'en' ? 'Weekly Target Progress by Sales Rep' : 'Tiến Độ Kế Hoạch Theo Nhân Viên'}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-600">
                                {locale === 'en' ? 'Click "Audit" to inspect visit logs and GPS photos' : 'Bấm "Thẩm định" để xem lịch trình và hình ảnh check-in của nhân viên'}
                            </p>
                        </div>

                        <div className="relative w-full sm:w-64">
                            <input
                                type="text"
                                value={teamFilterSearch}
                                onChange={e => setTeamFilterSearch(e.target.value)}
                                placeholder={locale === 'en' ? 'Search sales rep name or email...' : 'Tìm tên hoặc email sale...'}
                                className="w-full pl-8 pr-3 py-1.5 text-xs outline-none rounded-xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 text-slate-900 dark:text-white focus:border-teal-500"
                            />
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>

                    {loadingTeam ? (
                        <div className="py-16 text-center text-xs text-slate-400">
                            <RefreshCw size={24} className="mx-auto animate-spin text-teal-600 mb-2" />
                            {locale === 'en' ? 'Loading data...' : 'Đang tải dữ liệu...'}
                        </div>
                    ) : filteredTeamItems.length === 0 ? (
                        <div className="py-16 text-center text-xs text-slate-400">
                            {locale === 'en' ? 'No sales representatives found matching your search.' : 'Không tìm thấy nhân viên nào khớp với tìm kiếm.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-white text-slate-500 dark:text-slate-600 border-b border-slate-200 dark:border-slate-200">
                                        <th className="p-3.5 font-bold">{t.manager.colStaff}</th>
                                        <th className="p-3.5 font-bold text-center">{t.manager.colPlan}</th>
                                        <th className="p-3.5 font-bold text-center">{t.manager.colActual}</th>
                                        <th className="p-3.5 font-bold text-center">{locale === 'en' ? 'Ad-hoc' : 'Đột xuất'}</th>
                                        <th className="p-3.5 font-bold">{locale === 'en' ? 'Progress' : 'Tiến độ'}</th>
                                        <th className="p-3.5 font-bold text-center">{locale === 'en' ? 'Status' : 'Trạng thái'}</th>
                                        <th className="p-3.5 font-bold text-right">{t.manager.colAction}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-[#E2E8F0]">
                                    {filteredTeamItems.map((item: any) => (
                                        <tr key={item.salespersonId} className="hover:bg-slate-50/80 dark:hover:bg-white transition">
                                            <td className="p-3.5">
                                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                    <User size={13} className="text-teal-600 dark:text-[#0891B2]" />
                                                    {item.salespersonName}
                                                    {item.salespersonId === currentUserId && (
                                                        <span className="text-[10px] text-slate-400 font-normal">
                                                            {locale === 'en' ? '(Me)' : '(Tôi)'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                    {item.salespersonEmail}
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                                {item.plannedCount} {locale === 'en' ? 'pts' : 'điểm'}
                                            </td>
                                            <td className="p-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                {item.completedCount} {locale === 'en' ? 'pts' : 'điểm'}
                                            </td>
                                            <td className="p-3.5 text-center font-mono text-amber-600 dark:text-amber-400 font-bold">
                                                {item.unplannedCount > 0 ? `+${item.unplannedCount}` : '—'}
                                            </td>
                                            <td className="p-3.5 min-w-[140px]">
                                                <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                                                    <span className="font-bold text-teal-600 dark:text-[#0891B2]">{item.completionRate}%</span>
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
                                                    {item.planStatus === 'APPROVED' ? (locale === 'en' ? '✓ Approved' : '✓ Đã Duyệt') :
                                                     item.planStatus === 'SUBMITTED' ? (locale === 'en' ? '⏳ Pending' : '⏳ Chờ Duyệt') :
                                                     item.planStatus === 'DRAFT' ? (locale === 'en' ? 'Draft' : 'Bản Nháp') : (locale === 'en' ? 'Not Scheduled' : 'Chưa Lên Lịch')}
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
                                                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white dark:bg-[#87CBB9] dark:text-slate-900 inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                                                >
                                                    <Eye size={13} />
                                                    {locale === 'en' ? 'Audit & Photos' : 'Xem chi tiết & Ảnh'}
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
                            className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-50 p-5 rounded-2xl border border-slate-200 dark:border-slate-200 shadow-2xl flex flex-col space-y-4 animate-in zoom-in-95"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-200 pb-4">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-teal-500/20 text-teal-600 dark:text-[#0891B2] uppercase">
                                            {locale === 'en' ? 'Itinerary Details' : 'Chi Tiết Lịch Trình'}
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono">
                                            {t.header.weekLabel} {currentWeek.week} / {currentWeek.year}
                                        </span>
                                    </div>
                                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                                        <User size={18} className="text-teal-600 dark:text-[#0891B2]" />
                                        {inspectingSale.salespersonName}
                                        <span className="text-xs font-normal font-mono text-slate-400">({inspectingSale.salespersonEmail})</span>
                                    </h3>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="text-right text-xs">
                                        <div className="font-bold text-teal-600 dark:text-[#0891B2]">
                                            {inspectingSale.completedCount}/{inspectingSale.plannedCount} {locale === 'en' ? 'Points' : 'Điểm'} ({inspectingSale.completionRate}%)
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {inspectingSale.unplannedCount > 0 ? (locale === 'en' ? `+${inspectingSale.unplannedCount} ad-hoc` : `+${inspectingSale.unplannedCount} đột xuất`) : (locale === 'en' ? '0 ad-hoc' : '0 đột xuất')}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setInspectingSale(null)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-white cursor-pointer"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Sub-Tabs */}
                            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-200 pb-2 text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setInspectSubTab('PHOTOS')}
                                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer ${
                                        inspectSubTab === 'PHOTOS'
                                            ? 'bg-teal-600 text-white dark:bg-[#87CBB9] dark:text-slate-900'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                    }`}
                                >
                                    <Camera size={14} />
                                    <span>{locale === 'en' ? 'Check-in photos' : 'Ảnh check-in'} ({inspectingSale.actualVisits?.length || 0})</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setInspectSubTab('PLAN')}
                                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer ${
                                        inspectSubTab === 'PLAN'
                                            ? 'bg-teal-600 text-white dark:bg-[#87CBB9] dark:text-slate-900'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                    }`}
                                >
                                    <Calendar size={14} />
                                    <span>{locale === 'en' ? 'Weekly plan' : 'Kế hoạch tuần'} ({inspectingSale.plannedVisits?.length || 0})</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setInspectSubTab('APPROVAL')}
                                    className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer ${
                                        inspectSubTab === 'APPROVAL'
                                            ? 'bg-teal-600 text-white dark:bg-[#87CBB9] dark:text-slate-900'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                                    }`}
                                >
                                    <CheckCircle2 size={14} />
                                    <span>{locale === 'en' ? 'Review & Approve' : 'Đánh giá & Phê duyệt'}</span>
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                                {inspectSubTab === 'PHOTOS' && (
                                    <div className="space-y-4">
                                        {(!inspectingSale.actualVisits || inspectingSale.actualVisits.length === 0) ? (
                                            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                                                <Camera size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                                                <p className="font-semibold text-slate-600 dark:text-slate-300">
                                                    {locale === 'en' ? 'No check-in photos recorded this week.' : 'Chưa có ảnh check-in trong tuần này.'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {inspectingSale.actualVisits.map((v: any) => (
                                                    <div
                                                        key={v.id}
                                                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-200 bg-slate-50/50 dark:bg-white/50 space-y-3"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-mono text-xs font-bold text-teal-600 dark:text-[#0891B2]">
                                                                        {v.visitNo}
                                                                    </span>
                                                                    {v.isUnplanned && (
                                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                                                            {locale === 'en' ? 'Ad-hoc' : 'Đột xuất'}
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

                                                            <div className="text-right font-mono text-xs font-bold text-teal-600 dark:text-[#0891B2]">
                                                                {new Date(v.checkInTime).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', { day: '2-digit', month: '2-digit' })} {' '}
                                                                {new Date(v.checkInTime).toLocaleTimeString(locale === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>

                                                        {/* Photo Thumbnail */}
                                                        {v.checkInPhoto ? (
                                                            <div
                                                                className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-200 bg-black/40 group cursor-pointer shadow-xs"
                                                                onClick={() => setViewPhoto({ title: `${locale === 'en' ? 'Check-in Photo:' : 'Ảnh Check-in:'} ${v.customerName} (${locale === 'en' ? 'Rep:' : 'Sale:'} ${inspectingSale.salespersonName})`, url: v.checkInPhoto, visitId: v.id })}
                                                            >
                                                                <img
                                                                    src={v.checkInPhoto}
                                                                    alt="Check-in Photo"
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[11px] font-bold gap-1.5 backdrop-blur-xs">
                                                                    <Eye size={16} /> {locale === 'en' ? 'View Photo' : 'Xem ảnh chi tiết'}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="aspect-video rounded-xl bg-slate-100 dark:bg-white flex items-center justify-center text-[10px] text-slate-400">
                                                                {locale === 'en' ? 'No photo' : 'Chưa có ảnh'}
                                                            </div>
                                                        )}

                                                        {/* GPS & Address */}
                                                        {v.checkInAddress && (
                                                            <div className="text-[11px] text-slate-600 dark:text-slate-600 flex items-center gap-1.5">
                                                                <MapPin size={12} className="text-teal-600 shrink-0" />
                                                                <span className="truncate" title={v.checkInAddress}>{v.checkInAddress}</span>
                                                                {v.checkInLat && v.checkInLng && (
                                                                    <a
                                                                        href={`https://www.google.com/maps?q=${v.checkInLat},${v.checkInLng}`}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="text-teal-600 dark:text-[#0891B2] hover:underline font-mono text-[10px] shrink-0 font-bold ml-1"
                                                                    >
                                                                        [Maps]
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Báo Cáo Nhanh / Ghi Chú Thực Địa */}
                                                        <div className="p-2.5 rounded-xl bg-white dark:bg-white text-[11px] border border-slate-200/80 shadow-2xs space-y-1.5">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-bold text-[10px] text-teal-700 uppercase flex items-center gap-1">
                                                                    <FileText size={12} className="text-teal-600" />
                                                                    {locale === 'en' ? 'Quick Field Report:' : 'Báo Cáo Nhanh Thực Địa:'}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setQuickReportTarget(v)}
                                                                    className="text-[11px] font-bold text-teal-600 hover:text-teal-800 hover:underline cursor-pointer"
                                                                >
                                                                    {v.notes ? (locale === 'en' ? '✏️ Edit' : '✏️ Sửa báo cáo') : (locale === 'en' ? '+ Write' : '+ Ghi báo cáo')}
                                                                </button>
                                                            </div>
                                                            {v.notes ? (
                                                                <p className="text-slate-800 font-medium leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                                    {v.notes}
                                                                </p>
                                                            ) : (
                                                                <p className="text-slate-400 italic text-[10px]">
                                                                    {locale === 'en' ? 'No quick report submitted yet.' : 'Chưa có báo cáo nhanh từ nhân viên.'}
                                                                </p>
                                                            )}
                                                        </div>
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
                                                {locale === 'en' ? 'No visits scheduled by sales rep for this week.' : 'Nhân viên chưa lên lịch khách nào trong kế hoạch tuần này.'}
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-100 dark:divide-[#E2E8F0] border border-slate-200 dark:border-slate-200 rounded-xl overflow-hidden bg-white dark:bg-slate-50">
                                                {inspectingSale.plannedVisits.map((pv: any, pvIdx: number) => (
                                                    <div key={pv.id || pvIdx} className="p-3 text-xs flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-white">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-teal-600 dark:text-[#0891B2] font-bold">
                                                                    {pv.visitDate} ({getVietnameseDayName(pv.visitDate, locale)})
                                                                </span>
                                                                <span className="font-bold text-slate-900 dark:text-white">
                                                                    [{pv.customerCode}] {pv.customerName}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                                {locale === 'en' ? 'Purpose:' : 'Mục tiêu:'} {pv.purpose}
                                                            </p>
                                                        </div>

                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                                            pv.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white text-slate-500'
                                                        }`}>
                                                            {pv.status === 'COMPLETED' ? (locale === 'en' ? '✓ Visited' : '✓ Đã viếng thăm') : (locale === 'en' ? 'Pending' : 'Chưa đi')}
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
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-200 space-y-1.5">
                                            <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                                                <span>{locale === 'en' ? 'Sales Rep Self-Evaluation:' : 'Nhân viên tự đánh giá:'}</span>
                                                <span className="text-[10px] font-mono text-slate-400">
                                                    {inspectingSale.submittedAt ? (locale === 'en' ? `Submitted: ${new Date(inspectingSale.submittedAt).toLocaleDateString('en-US')}` : `Nộp lúc: ${new Date(inspectingSale.submittedAt).toLocaleDateString('vi-VN')} ${new Date(inspectingSale.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`) : (locale === 'en' ? 'Not submitted' : 'Chưa nộp')}
                                                </span>
                                            </div>
                                            <p className="text-slate-800 dark:text-slate-100 italic bg-white dark:bg-slate-50 p-3 rounded-lg border border-slate-200/70 dark:border-slate-200">
                                                {inspectingSale.selfReview || (locale === 'en' ? 'No self-evaluation submitted yet.' : 'Chưa có nội dung tự đánh giá.')}
                                            </p>
                                        </div>

                                        {/* Manager Feedback Form */}
                                        <div className="space-y-2">
                                            <label className="block font-bold text-slate-700 dark:text-slate-200">
                                                {locale === 'en' ? 'Manager Feedback:' : 'Nhận xét của Quản lý:'}
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={inspectFeedbackText}
                                                onChange={e => setInspectFeedbackText(e.target.value)}
                                                placeholder={locale === 'en' ? 'Enter feedback or notes for this sales rep...' : 'Nhập nhận xét hoặc lưu ý cho nhân viên...'}
                                                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-200 text-slate-900 dark:text-slate-900 outline-none focus:border-teal-500 text-xs"
                                            />
                                            <div className="flex items-center justify-between pt-2">
                                                <span className="text-[11px] text-slate-400">
                                                    {inspectingSale.reviewedAt && (locale === 'en' ? `Last reviewed: ${new Date(inspectingSale.reviewedAt).toLocaleDateString('en-US')}` : `Đã duyệt lần cuối: ${new Date(inspectingSale.reviewedAt).toLocaleDateString('vi-VN')}`)}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveInspectFeedback}
                                                    disabled={savingInspectFeedback || !inspectingSale.planId}
                                                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                                                >
                                                    <CheckCircle2 size={15} />
                                                    {savingInspectFeedback ? (locale === 'en' ? 'Saving...' : 'Đang lưu...') : (locale === 'en' ? 'Save Review & Approve' : 'Lưu đánh giá & Duyệt')}
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
                    locale={locale}
                />

                {/* 6. MODAL: QUICK REPORT (FOR MANAGER AUDIT & UPDATE) */}
                <QuickReportModal
                    isOpen={!!quickReportTarget}
                    visit={quickReportTarget}
                    onClose={() => setQuickReportTarget(null)}
                    onSave={handleSaveQuickReport}
                    locale={locale}
                />
            </div>
        )
    }

    // -----------------------------------------------------------------
    // SALES REPRESENTATIVE VIEW (FIELD EXECUTION SHELL)
    // Account scoping: Rep only sees own data ("tài khoản nào biết tài khoản đó")
    // -----------------------------------------------------------------
    return (
        <div className="space-y-3 sm:space-y-4 max-w-screen-xl mx-auto pb-28 md:pb-16">
            {/* 1. COMPACT UNIFIED TOP BAR & NAVIGATION TABS */}
            <div className="bg-white dark:bg-slate-50 px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                {/* Module Identity */}
                <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-[#0891B2]">
                            <MapPin size={17} />
                        </div>
                        <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                            {t.header.title}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2 md:hidden">
                        {/* Mobile Quick Language Toggle */}
                        <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-white border border-slate-200 dark:border-slate-200 text-[10px] font-bold">
                            <button
                                type="button"
                                onClick={() => setLocale('vi')}
                                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                    locale === 'vi' ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white font-black shadow-xs' : 'text-slate-500'
                                }`}
                            >
                                VI
                            </button>
                            <button
                                type="button"
                                onClick={() => setLocale('en')}
                                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                    locale === 'en' ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white font-black shadow-xs' : 'text-slate-500'
                                }`}
                            >
                                EN
                            </button>
                        </div>

                        {/* Mobile Only: Quick Action */}
                        <button
                            type="button"
                            onClick={() => setShowQuickCreateModal(true)}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-teal-600 text-white dark:bg-[#87CBB9] dark:text-slate-900 flex items-center gap-1 cursor-pointer shrink-0 shadow-xs active:scale-95"
                        >
                            <Plus size={13} /> {t.header.quickCreateCustomer}
                        </button>
                    </div>
                </div>

                {/* Desktop Slim Segmented Tabs & Action Button */}
                <div className="hidden md:flex items-center gap-2">
                    <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-white border border-slate-200 dark:border-slate-200 gap-0.5">
                        <button
                            type="button"
                            onClick={() => setActiveTab('CHECKIN')}
                            className={`py-1.5 px-3 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'CHECKIN'
                                    ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-200'
                                    : 'text-slate-500 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <MapPin size={13} className={activeTab === 'CHECKIN' ? 'text-teal-600 dark:text-[#0891B2]' : ''} />
                            <span>{t.tabs.today}</span>
                            {todayPlanVisits.length > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-teal-500/20 text-teal-600 dark:text-[#0891B2] font-mono font-bold">
                                    {todayPlanVisits.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('PLANNING')}
                            className={`py-1.5 px-3 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'PLANNING'
                                    ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-200'
                                    : 'text-slate-500 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Calendar size={13} className={activeTab === 'PLANNING' ? 'text-teal-600 dark:text-[#0891B2]' : ''} />
                            <span>{t.tabs.planning}</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold">
                                {planVisits.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('REVIEW')}
                            className={`py-1.5 px-3 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'REVIEW'
                                    ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-200'
                                    : 'text-slate-500 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <TrendingUp size={13} className={activeTab === 'REVIEW' ? 'text-teal-600 dark:text-[#0891B2]' : ''} />
                            <span>{t.tabs.summary}</span>
                            {weeklyPlan?.status === 'SUBMITTED' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('HISTORY')}
                            className={`py-1.5 px-3 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'HISTORY'
                                    ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-200'
                                    : 'text-slate-500 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <FileText size={13} className={activeTab === 'HISTORY' ? 'text-teal-600 dark:text-[#0891B2]' : ''} />
                            <span>{t.tabs.photos}</span>
                        </button>
                    </div>

                    {/* Desktop Language Switcher */}
                    <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-white border border-slate-200 dark:border-slate-200 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setLocale('vi')}
                            className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                locale === 'vi' ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white font-black shadow-xs' : 'text-slate-500 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Tiếng Việt"
                        >
                            VI
                        </button>
                        <button
                            type="button"
                            onClick={() => setLocale('en')}
                            className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                locale === 'en' ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white font-black shadow-xs' : 'text-slate-500 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="English"
                        >
                            EN
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowQuickCreateModal(true)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-[#87CBB9] dark:text-slate-900 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                    >
                        <Plus size={14} /> {t.header.quickCreateCustomer}
                    </button>
                </div>
            </div>

            {/* ============================================================== */}
            {/* TAB 1: CHECK-IN HÔM NAY (DAILY FIELD WORK) */}
            {/* ============================================================== */}
            {activeTab === 'CHECKIN' && (
                <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-200">
                    {/* OFFLINE QUEUE STATUS BANNER (hầm rượu / mất sóng 4G) */}
                    {(offlineDrafts.length > 0 || !isNetworkOnline) && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs animate-in fade-in">
                            <div className="flex items-start sm:items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-amber-500 text-white font-bold shrink-0">
                                    {!isNetworkOnline ? <WifiOff size={16} /> : <UploadCloud size={16} />}
                                </div>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span>
                                            {!isNetworkOnline
                                                ? (locale === 'en' ? 'Offline Mode (No Internet Connection)' : 'Mất kết nối mạng (Chế độ ngoại tuyến)')
                                                : (locale === 'en' ? `${offlineDrafts.length} check-in drafts pending sync` : `Có ${offlineDrafts.length} lượt check-in đang chờ đồng bộ`)}
                                        </span>
                                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">
                                            {offlineDrafts.length} {locale === 'en' ? 'drafts' : 'bản ghi'}
                                        </span>
                                    </h4>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {!isNetworkOnline
                                            ? (locale === 'en' ? 'Check-in data is saved locally on device and will sync automatically once connection is restored.' : 'Dữ liệu check-in được lưu tạm trên thiết bị và sẽ tự động gửi khi có kết nối mạng.')
                                            : (locale === 'en' ? 'Offline drafts ready to sync to cloud system.' : 'Dữ liệu ngoại tuyến sẵn sàng đồng bộ lên hệ thống.')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {offlineDrafts.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={syncOfflineDrafts}
                                        disabled={syncingOffline || !isNetworkOnline}
                                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                                    >
                                        <RefreshCw size={12} className={syncingOffline ? 'animate-spin' : ''} />
                                        {syncingOffline ? (locale === 'en' ? 'Syncing...' : 'Đang đồng bộ...') : (locale === 'en' ? 'Sync Now' : 'Đồng bộ ngay')}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Header Controls for Today & Integrated GPS Bar */}
                    <div className="bg-white dark:bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-200 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] uppercase tracking-wider text-teal-600 dark:text-[#0891B2] font-black font-mono">
                                    {locale === 'en' ? 'TODAY:' : 'HÔM NAY:'} {getVietnameseDayName(today, locale).toUpperCase()}, {locale === 'en' ? today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : today.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                                <span className="text-slate-300 dark:text-[#E2E8F0] hidden sm:inline">•</span>
                                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                    {locale === 'en' ? 'Today Scheduled Store Visits' : 'Danh Sách Điểm Viếng Thăm Trong Ngày'}
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
                                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                                >
                                    <Sparkles size={13} /> {t.today.adHocCheckin}
                                </button>
                            </div>
                        </div>

                        {/* GPS Status Indicator embedded in Today's view */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-200 text-xs">
                            <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                                <Navigation size={13} className={coords.lat ? "text-emerald-500 shrink-0" : "text-amber-500 shrink-0 animate-pulse"} />
                                <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                                    {locale === 'en' ? 'Current Location:' : 'Vị trí hiện tại:'}
                                </span>
                                {gettingLocation ? (
                                    <span className="text-slate-500 dark:text-slate-400 italic">
                                        {locale === 'en' ? 'Acquiring GPS coordinates...' : 'Đang xác định toạ độ...'}
                                    </span>
                                ) : coords.lat ? (
                                    <span className="font-mono text-slate-900 dark:text-white truncate text-[11px]" title={coords.address}>
                                        {coords.address || `${coords.lat.toFixed(5)}, ${coords.lng?.toFixed(5)}`}
                                    </span>
                                ) : (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-amber-600 dark:text-amber-400 text-[11px] font-medium">
                                            {gpsError || (locale === 'en' ? 'No GPS coordinates acquired.' : 'Chưa nhận toạ độ GPS.')}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowGpsGuideModal(true)}
                                            className="text-amber-600 dark:text-amber-400 hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer bg-amber-500/10 px-2 py-0.5 rounded-md"
                                        >
                                            <AlertCircle size={12} /> {locale === 'en' ? 'How to enable GPS' : 'Xem cách bật quyền GPS'}
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
                                        <AlertCircle size={12} /> {locale === 'en' ? 'GPS Guide' : 'Hướng dẫn GPS'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={requestGPS}
                                    disabled={gettingLocation}
                                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-white hover:bg-slate-100 dark:hover:bg-[#E2E8F0] text-slate-700 dark:text-slate-600 border border-slate-200 dark:border-slate-200 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                                >
                                    <RefreshCw size={11} className={gettingLocation ? "animate-spin" : ""} />
                                    {locale === 'en' ? 'Refresh GPS' : 'Làm mới GPS'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Today's Scheduled Visits Cards */}
                    {todayPlanVisits.length === 0 ? (
                        <div className="p-8 text-center bg-white dark:bg-slate-50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-200 space-y-3">
                            <Calendar size={36} className="mx-auto text-slate-400 dark:text-slate-500" />
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                {locale === 'en' ? 'No store visits scheduled for today' : 'Chưa có điểm viếng thăm nào trong kế hoạch ngày hôm nay'}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-600 max-w-md mx-auto">
                                {locale === 'en'
                                    ? 'You can switch to the Weekly Plan tab to schedule client stops, or tap the "+ Ad-hoc Check-in" button above to visit newly added clients.'
                                    : 'Bạn có thể chuyển sang tab Kế Hoạch Tuần để lên lịch các điểm cần đi, hoặc bấm nút Check-in Đột Xuất bên trên để ghé thăm khách phát sinh.'}
                            </p>
                            <div className="flex items-center justify-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('PLANNING')}
                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-white hover:bg-slate-200 dark:hover:bg-[#E2E8F0] text-slate-800 dark:text-slate-900 transition cursor-pointer"
                                >
                                    📅 {locale === 'en' ? 'Weekly Plan' : 'Lập Kế Hoạch Tuần'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowUnplannedModal(true)}
                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition cursor-pointer"
                                >
                                    ⚡ {locale === 'en' ? 'Check-in Now' : 'Check-in Ngay'}
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
                                        className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3.5 bg-white dark:bg-slate-50 shadow-xs ${
                                            isItemCompleted
                                                ? 'border-emerald-500/40 bg-emerald-500/5'
                                                : 'border-slate-200 dark:border-slate-200 hover:border-teal-500/50'
                                        }`}
                                    >
                                        <div className="space-y-3">
                                            {/* Header of card: Code, Channel, Name & Status */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-mono text-[11px] font-bold text-teal-600 dark:text-[#0891B2]">
                                                            [{cust?.code || 'KH'}]
                                                        </span>
                                                        {cust?.channel && (
                                                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white text-slate-500 dark:text-slate-600 font-mono">
                                                                {cust.channel}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="text-base sm:text-sm font-black text-slate-900 dark:text-white mt-1 line-clamp-2" title={cust?.name}>
                                                        {cust?.name || (locale === 'en' ? 'Client' : 'Khách hàng')}
                                                    </h4>
                                                </div>

                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                                                    isItemCompleted
                                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                        : 'bg-slate-100 dark:bg-white text-slate-500 dark:text-slate-400'
                                                }`}>
                                                    {isItemCompleted ? (locale === 'en' ? '✓ Completed' : '✓ Đã hoàn thành') : (locale === 'en' ? 'Pending' : 'Chưa đi')}
                                                </span>
                                            </div>

                                            {/* Address & 1-Tap Google Maps Navigation / Call Buttons */}
                                            {(addressStr || phoneStr) && (
                                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white border border-slate-100 dark:border-slate-200/60 space-y-2 text-xs">
                                                    {addressStr && (
                                                        <div className="flex items-start gap-1.5">
                                                            <MapPin size={13} className="text-teal-600 dark:text-[#0891B2] shrink-0 mt-0.5" />
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
                                                                className="flex-1 py-2 px-3 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 active:bg-teal-500/25 text-teal-700 dark:text-[#0891B2] font-bold text-xs flex items-center justify-center gap-1.5 transition min-h-[40px] active:scale-95 shadow-2xs cursor-pointer"
                                                            >
                                                                <Navigation size={13} /> {locale === 'en' ? 'Directions' : 'Chỉ đường Maps'}
                                                            </a>
                                                        )}
                                                        {phoneStr && (
                                                            <a
                                                                href={`tel:${phoneStr}`}
                                                                className="py-2 px-3.5 rounded-xl bg-slate-200 dark:bg-[#1F3342] hover:bg-slate-300 active:bg-slate-400/50 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 transition min-h-[40px] active:scale-95 shadow-2xs cursor-pointer"
                                                                title={`${locale === 'en' ? 'Call' : 'Gọi'} ${phoneStr}`}
                                                            >
                                                                <Phone size={13} className="text-emerald-500" /> {locale === 'en' ? 'Call' : 'Gọi điện'}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Purpose & Activity */}
                                            <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-white/70 border border-slate-100 dark:border-slate-200/60 text-xs">
                                                <div className="text-slate-400 text-[10px] font-semibold uppercase">
                                                    {locale === 'en' ? 'Planned Activity:' : 'Hoạt động dự kiến:'}
                                                </div>
                                                <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
                                                    <span>{item.purpose || (locale === 'en' ? 'Periodic Customer Care' : 'Chăm sóc khách hàng định kỳ')}</span>
                                                </div>
                                            </div>

                                            {/* Completed result notes if any */}
                                            {item.resultNotes && (
                                                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                                                    <div className="font-bold text-[10px] uppercase flex items-center gap-1">
                                                        <Check size={11} /> {locale === 'en' ? 'Work Result:' : 'Kết quả làm việc:'}
                                                    </div>
                                                    <p className="mt-0.5 leading-relaxed">{item.resultNotes}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Button: Touch Ergonomics (Min height 48px on mobile) */}
                                        <div className="pt-1">
                                            {isItemCompleted ? (
                                                <div className="space-y-2">
                                                    <div className="py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5 min-h-[42px]">
                                                        <CheckCircle2 size={16} /> {locale === 'en' ? '✓ Visit Completed' : '✓ Đã Hoàn Thành Viếng Thăm'}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const matchVisit = todayActualVisits.find(v => v.scheduleId === item.id || v.customerId === item.customerId) || {
                                                                id: item.salesVisitId || '',
                                                                scheduleId: item.id,
                                                                customerId: item.customerId,
                                                                customerName: item.customer?.name || item.customerName,
                                                                customerCode: item.customer?.code || item.customerCode,
                                                                customerChannel: item.customer?.channel || item.customerChannel,
                                                                notes: item.resultNotes || ''
                                                            }
                                                            setQuickReportTarget(matchVisit)
                                                        }}
                                                        className="w-full py-2 px-3 rounded-xl bg-teal-50 dark:bg-teal-950/20 hover:bg-teal-100 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-[#0891B2] font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                                                    >
                                                        <FileText size={14} />
                                                        <span>{item.resultNotes ? (locale === 'en' ? 'Edit Quick Report' : 'Sửa Báo Cáo Nhanh') : (locale === 'en' ? '+ Write Quick Report' : '+ Ghi Báo Cáo Nhanh')}</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={submittingAction}
                                                    onClick={() => startCheckInPlanned(item)}
                                                    className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-[#87CBB9] dark:text-slate-900 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md active:scale-[0.98] disabled:opacity-40 cursor-pointer min-h-[48px]"
                                                >
                                                    <Camera size={18} />
                                                    <span>{locale === 'en' ? 'CHECK-IN & TAKE 1 PHOTO' : 'CHECK-IN & CHỤP 1 ẢNH'}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* SECTION: NHẬT KÝ & ẢNH CHECK-IN THỰC TẾ HÔM NAY */}
                    <div className="bg-white dark:bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-200 space-y-4 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-[#0891B2]">
                                    <Camera size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        {locale === 'en' ? "Today's Photos & Actual Check-ins" : 'Ảnh & Lượt Check-in Thực Tế Hôm Nay'}
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-600 dark:text-[#0891B2] font-mono">
                                            {todayActualVisits.length} {locale === 'en' ? 'visits' : 'lượt'}
                                        </span>
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-600">
                                        {locale === 'en' ? 'Live camera photo at store, GPS coordinates and work result' : 'Ảnh chụp camera thực tế tại điểm bán, toạ độ GPS và kết quả làm việc'}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={fetchHistoryVisits}
                                className="self-end sm:self-auto px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-white hover:bg-slate-200 dark:hover:bg-[#E2E8F0] text-slate-700 dark:text-slate-600 flex items-center gap-1 transition cursor-pointer"
                            >
                                <RefreshCw size={12} /> {locale === 'en' ? 'Reload' : 'Tải lại dữ liệu'}
                            </button>
                        </div>

                        {todayActualVisits.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2">
                                <Camera size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
                                <p className="font-semibold text-slate-600 dark:text-slate-300">
                                    {locale === 'en' ? 'No check-in photos yet today.' : 'Chưa có ảnh check-in nào trong ngày hôm nay.'}
                                </p>
                                <p className="text-[11px]">
                                    {locale === 'en'
                                        ? 'Click "Check-in & Take Photo" or "+ Ad-hoc Check-in" above to record field visits.'
                                        : 'Bấm nút Check-in Điểm Này hoặc Check-in Đột Xuất bên trên để bắt đầu ghi lại hình ảnh thực địa.'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {todayActualVisits.map((v) => (
                                    <div
                                        key={v.id}
                                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-200 bg-slate-50/50 dark:bg-white/50 flex flex-col justify-between space-y-3 hover:border-teal-500/40 transition shadow-xs"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-mono text-xs font-bold text-teal-600 dark:text-[#0891B2]">
                                                            {v.visitNo}
                                                        </span>
                                                        {v.isUnplanned && (
                                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                                                {locale === 'en' ? 'Ad-hoc' : 'Đột xuất'}
                                                            </span>
                                                        )}
                                                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                                            {locale === 'en' ? '✓ Checked-in' : '✓ Đã Check-in'}
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
                                                    <div className="font-mono font-bold text-teal-600 dark:text-[#0891B2]">
                                                        {new Date(v.checkInTime).toLocaleTimeString(locale === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                                        {locale === 'en' ? '✓ Completed' : '✓ Hoàn thành'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Single Photo Display: Ảnh Thực Tế Check-in */}
                                            <div className="space-y-1.5 pt-1">
                                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                                    {locale === 'en' ? 'Store photo:' : 'Hình ảnh tại điểm bán:'}
                                                </span>
                                                {v.checkInPhoto || v.checkOutPhoto ? (
                                                    <div
                                                        className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-200 bg-black/40 group cursor-pointer shadow-xs"
                                                        onClick={() => setViewPhoto({ title: `${locale === 'en' ? 'Check-in Photo:' : 'Ảnh Check-in:'} ${v.customerName}`, url: (v.checkInPhoto || v.checkOutPhoto)!, visitId: v.id })}
                                                    >
                                                        <img
                                                            src={v.checkInPhoto || v.checkOutPhoto}
                                                            alt="Check-in Photo"
                                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[11px] font-bold gap-1.5 backdrop-blur-xs">
                                                            <Eye size={16} /> {locale === 'en' ? 'View details' : 'Xem ảnh chi tiết'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="aspect-video rounded-xl bg-slate-100 dark:bg-white flex items-center justify-center text-[10px] text-slate-400">
                                                        {locale === 'en' ? 'No photo' : 'Chưa có ảnh'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* GPS Address & Map link */}
                                            {v.checkInAddress && (
                                                <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-600 pt-1">
                                                    <MapPin size={12} className="text-teal-600 shrink-0" />
                                                    <span className="truncate" title={v.checkInAddress}>{v.checkInAddress}</span>
                                                    {v.checkInLat && v.checkInLng && (
                                                        <a
                                                            href={`https://www.google.com/maps?q=${v.checkInLat},${v.checkInLng}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 active:bg-teal-500/30 text-teal-700 dark:text-[#0891B2] font-bold text-[11px] shrink-0 active:scale-95 transition min-h-[32px]"
                                                        >
                                                            <Navigation size={11} /> {locale === 'en' ? 'Map' : 'Bản đồ'}
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                            {/* Quick Field Report Box */}
                                            <div className="p-3 rounded-xl bg-white dark:bg-white border border-slate-200/90 dark:border-slate-200 text-xs space-y-2 shadow-2xs">
                                                <div className="flex items-center justify-between">
                                                    <div className="font-bold text-[10px] text-teal-700 dark:text-teal-600 uppercase flex items-center gap-1.5">
                                                        <FileText size={13} className="text-teal-600" />
                                                        <span>{locale === 'en' ? 'Field Report / Result:' : 'Báo Cáo Nhanh Thực Địa:'}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQuickReportTarget(v)}
                                                        className="text-[11px] font-bold text-teal-600 dark:text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer hover:underline"
                                                    >
                                                        <span>{v.notes ? (locale === 'en' ? '✏️ Edit' : '✏️ Sửa báo cáo') : (locale === 'en' ? '+ Write' : '+ Ghi báo cáo')}</span>
                                                    </button>
                                                </div>
                                                {v.notes ? (
                                                    <p className="text-slate-800 dark:text-slate-900 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                        {v.notes}
                                                    </p>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setQuickReportTarget(v)}
                                                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-teal-300 dark:border-teal-400 bg-teal-50/50 hover:bg-teal-50 text-teal-700 dark:text-teal-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                                                    >
                                                        <Plus size={13} />
                                                        <span>{locale === 'en' ? 'Tap to write quick report for manager' : 'Chạm để ghi báo cáo nhanh gửi quản lý'}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Mobile Floating Action Button (FAB): Check-in Đột Xuất Quick Trigger */}
                    <button
                        type="button"
                        onClick={() => {
                            setUnplannedCustomerId('')
                            setUnplannedPurpose('')
                            setShowUnplannedModal(true)
                        }}
                        className="md:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-3 rounded-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-black text-xs shadow-2xl ring-4 ring-amber-500/25 active:scale-95 transition-all cursor-pointer"
                        aria-label={locale === 'en' ? 'Ad-Hoc Check-in' : 'Check-in Đột Xuất'}
                    >
                        <Sparkles size={16} />
                        <span>{locale === 'en' ? '+ Ad-hoc Check-in' : '+ Check-in Đột Xuất'}</span>
                    </button>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: KẾ HOẠCH TUẦN (WEEKLY PLANNING) */}
            {/* ============================================================== */}
            {activeTab === 'PLANNING' && (
                <div className="space-y-3 sm:space-y-3.5 animate-in fade-in duration-200">
                    {/* Ultra-compact Week Navigation & Focus Goal Bar */}
                    <div className="bg-white dark:bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-200 shadow-xs space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            {/* Left: Quick Week Switcher & Range */}
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <div className="flex items-center bg-slate-100 dark:bg-white rounded-lg border border-slate-200 dark:border-slate-200 p-0.5">
                                    <button
                                        type="button"
                                        onClick={handlePrevWeek}
                                        className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1F3342] transition cursor-pointer"
                                        title={locale === 'en' ? 'Previous week' : 'Tuần trước'}
                                    >
                                        <ChevronLeft size={13} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCurrentWeek}
                                        className="px-2 py-0.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-white dark:hover:bg-[#1F3342] transition cursor-pointer"
                                    >
                                        {locale === 'en' ? `Week ${currentWeek.week}` : `Tuần ${currentWeek.week}`}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleNextWeek}
                                        className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1F3342] transition cursor-pointer"
                                        title={locale === 'en' ? 'Next week' : 'Tuần sau'}
                                    >
                                        <ChevronRight size={13} />
                                    </button>
                                </div>

                                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                                    {weekDates[0]?.dateStr.slice(5).replace('-', '/')} – {weekDates[6]?.dateStr.slice(5).replace('-', '/')}
                                </span>

                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-teal-500/15 text-teal-600 dark:text-[#0891B2] font-mono">
                                    {planVisits.length} {locale === 'en' ? 'stops' : 'điểm'}
                                </span>

                                {weeklyPlan?.status && (
                                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                        weeklyPlan.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                                        weeklyPlan.status === 'SUBMITTED' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
                                        'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                    }`}>
                                        {weeklyPlan.status === 'APPROVED' ? (locale === 'en' ? 'Approved' : 'Đã duyệt') :
                                         weeklyPlan.status === 'SUBMITTED' ? (locale === 'en' ? 'Pending' : 'Chờ duyệt') :
                                         (locale === 'en' ? 'Draft' : 'Nháp')}
                                    </span>
                                )}
                            </div>

                            {/* Right: Save Plan Button */}
                            <button
                                type="button"
                                onClick={handleSavePlan}
                                disabled={savingPlan}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-[#87CBB9] dark:text-slate-900 text-white flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
                            >
                                <Save size={13} className={savingPlan ? "animate-spin" : ""} />
                                <span>{savingPlan ? (locale === 'en' ? 'Saving...' : 'Đang lưu...') : (locale === 'en' ? 'Save' : 'Lưu')}</span>
                            </button>
                        </div>

                        {/* Inline Focus Goal Row */}
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 dark:bg-white border border-slate-200/70 dark:border-slate-200 focus-within:border-teal-500 transition">
                            <Target size={13} className="text-teal-600 dark:text-[#0891B2] shrink-0" />
                            <input
                                type="text"
                                value={planNote}
                                onChange={e => setPlanNote(e.target.value)}
                                placeholder={locale === 'en' ? 'Weekly target (sales pitches, debt collection...)' : 'Mục tiêu tuần (chào hàng, công nợ...)'}
                                className="w-full text-base sm:text-xs bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                            />
                        </div>
                    </div>

                    {/* MOBILE HORIZONTAL DATE STRIP + ACTIVE DAY SCHEDULE */}
                    <div className="md:hidden space-y-2.5">
                        {/* Horizontal Date Strip with Snap Scroll (Sleek Calendar Chips) */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
                            {weekDates.map(day => {
                                const dayVisits = planVisits.filter(v => v.visitDate === day.dateStr)
                                const isSelected = (mobileSelectedDate || todayStr) === day.dateStr
                                const shortDay = getLocalizedShortDayName(getDayOfWeek(day.dateStr), locale)
                                const dayNum = day.dateStr.split('-')[2]
                                const monthNum = day.dateStr.split('-')[1]

                                return (
                                    <button
                                        key={day.dateStr}
                                        type="button"
                                        onClick={() => setMobileSelectedDate(day.dateStr)}
                                        className={`shrink-0 snap-center flex flex-col items-center py-1.5 px-2.5 rounded-xl border transition-all text-center min-w-[50px] cursor-pointer active:scale-95 ${
                                            isSelected
                                                ? 'bg-teal-600 text-white border-teal-600 shadow-sm font-bold'
                                                : day.isToday
                                                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-[#0891B2]'
                                                    : 'bg-white dark:bg-slate-50 border-slate-200 dark:border-slate-200 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                                            {shortDay}
                                        </span>
                                        <span className="text-xs font-black font-mono mt-0.5">
                                            {dayNum}/{monthNum}
                                        </span>
                                        {dayVisits.length > 0 ? (
                                            <span className={`mt-0.5 px-1 py-0.1 rounded-full text-[9px] font-bold font-mono ${
                                                isSelected
                                                    ? 'bg-white/25 text-white'
                                                    : 'bg-teal-500/20 text-teal-600 dark:text-[#0891B2]'
                                            }`}>
                                                {dayVisits.length}
                                            </span>
                                        ) : (
                                            <span className="mt-0.5 text-[9px] text-transparent select-none">-</span>
                                        )}
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
                                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-200 bg-white dark:bg-slate-50 space-y-2.5 shadow-xs">
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-200 pb-2">
                                        <div>
                                            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                                <span>{getLocalizedDayName(currentSelectedDay.dateStr, locale)}</span>
                                                <span className="text-[11px] font-mono text-slate-400 font-normal">({currentSelectedDay.dateStr.slice(5).replace('-', '/')})</span>
                                                {currentSelectedDay.isToday && (
                                                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-teal-500/15 text-teal-600 dark:text-[#0891B2]">
                                                        {locale === 'en' ? 'Today' : 'Hôm nay'}
                                                    </span>
                                                )}
                                            </h4>
                                            <p className="text-[10px] text-slate-400">
                                                {dayVisits.length} {locale === 'en' ? 'stops scheduled' : 'điểm đã lên lịch'}
                                            </p>
                                        </div>

                                        {currentSelectedDay.dateStr < todayStr && !isManager ? (
                                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white text-slate-400 font-semibold text-xs flex items-center gap-1 border border-slate-200/80">
                                                <Lock size={12} /> {locale === 'en' ? 'Locked' : 'Đã khóa'}
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setQuickAddModal({ open: true, dateStr: currentSelectedDay.dateStr, dayName: getLocalizedDayName(currentSelectedDay.dateStr, locale) })
                                                    setAddCustomerId('')
                                                    setAddActivityType('PERIODIC_CARE')
                                                    setAddCustomPurpose('')
                                                }}
                                                className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs min-h-[34px]"
                                            >
                                                <Plus size={13} /> {locale === 'en' ? 'Add Stop' : 'Thêm Điểm'}
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        {dayVisits.length === 0 ? (
                                            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-white rounded-xl border border-dashed border-slate-200 dark:border-slate-200">
                                                {locale === 'en'
                                                    ? `No visits scheduled for ${getLocalizedDayName(currentSelectedDay.dateStr, locale)}. Tap "Add Stop" to schedule.`
                                                    : `Chưa lên lịch điểm nào cho ngày ${currentSelectedDay.dayName}. Bấm "Thêm Điểm" để lên lịch.`}
                                            </div>
                                        ) : (
                                            dayVisits.map((item, vIdx) => {
                                                const cust = item.customer || localCustomers.find(c => c.id === item.customerId)
                                                return (
                                                    <div
                                                        key={item.id || vIdx}
                                                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-white border border-slate-200/80 dark:border-slate-200 text-xs flex items-start justify-between gap-2"
                                                    >
                                                        <div className="min-w-0 flex-1 space-y-0.5">
                                                            <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                                                                <span className="font-mono text-[10px] text-teal-600 dark:text-[#0891B2] mr-1">
                                                                    [{cust?.code || 'KH'}]
                                                                </span>
                                                                {cust?.name || (locale === 'en' ? 'Client' : 'Khách hàng')}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 dark:text-slate-600 line-clamp-1">
                                                                {item.purpose}
                                                            </div>
                                                        </div>
                                                        {currentSelectedDay.dateStr < todayStr && !isManager ? (
                                                            <span
                                                                className="text-slate-300 dark:text-slate-400 p-1 flex items-center"
                                                                title={locale === 'en' ? 'Locked: Past days cannot be deleted' : 'Đã khóa: Kế hoạch ngày đã qua không thể xóa'}
                                                            >
                                                                <Lock size={13} />
                                                            </span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemovePlanVisit(item.id)}
                                                                className="text-slate-400 hover:text-red-500 p-1 transition cursor-pointer"
                                                                title={locale === 'en' ? 'Remove from schedule' : 'Xóa khỏi lịch'}
                                                            >
                                                                <X size={15} />
                                                            </button>
                                                        )}
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
                                    className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 bg-white dark:bg-slate-50 transition-all ${
                                        day.isToday
                                            ? 'border-teal-500/60 ring-2 ring-teal-500/20 shadow-sm'
                                            : 'border-slate-200 dark:border-slate-200'
                                    }`}
                                >
                                    <div className="space-y-3">
                                        {/* Day Header */}
                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-200 pb-2.5">
                                            <div>
                                                <span className={`text-xs font-black ${day.isToday ? 'text-teal-600 dark:text-[#0891B2]' : 'text-slate-800 dark:text-white'}`}>
                                                    {getLocalizedDayName(day.dateStr, locale)} {day.isToday ? (locale === 'en' ? '(Today)' : '(Hôm nay)') : ''}
                                                </span>
                                                <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                                    {day.dateStr}
                                                </div>
                                            </div>

                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-white text-slate-600 dark:text-slate-300 font-mono">
                                                {dayVisits.length} {locale === 'en' ? 'stops' : 'điểm'}
                                            </span>
                                        </div>

                                        {/* Visits List in this day */}
                                        <div className="space-y-2 min-h-[140px]">
                                            {dayVisits.length === 0 ? (
                                                <div className="h-full flex items-center justify-center text-center p-4 text-[11px] text-slate-400 dark:text-slate-500 italic">
                                                    {locale === 'en' ? 'No visits scheduled' : 'Chưa lên lịch điểm nào'}
                                                </div>
                                            ) : (
                                                dayVisits.map((item, vIdx) => {
                                                    const cust = item.customer || localCustomers.find(c => c.id === item.customerId)
                                                    return (
                                                        <div
                                                            key={item.id || vIdx}
                                                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-200 text-xs space-y-1 relative group"
                                                        >
                                                            <div className="flex items-start justify-between gap-1">
                                                                <div className="font-bold text-slate-900 dark:text-white line-clamp-1 pr-4" title={cust?.name}>
                                                                    <span className="font-mono text-[10px] text-teal-600 dark:text-[#0891B2] mr-1">
                                                                        [{cust?.code || 'KH'}]
                                                                    </span>
                                                                    {cust?.name || (locale === 'en' ? 'Client' : 'Khách hàng')}
                                                                </div>
                                                                {day.dateStr < todayStr && !isManager ? (
                                                                    <span
                                                                        className="text-slate-300 dark:text-slate-400 p-0.5 flex items-center"
                                                                        title={locale === 'en' ? 'Locked: Past days cannot be deleted' : 'Đã khóa: Kế hoạch ngày đã qua không thể xóa'}
                                                                    >
                                                                        <Lock size={12} />
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemovePlanVisit(item.id)}
                                                                        className="text-slate-400 hover:text-red-500 p-0.5 transition cursor-pointer"
                                                                        title={locale === 'en' ? 'Remove from schedule' : 'Xóa khỏi lịch'}
                                                                    >
                                                                        <X size={13} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 dark:text-slate-600 line-clamp-1">
                                                                {item.purpose}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Add button for this day */}
                                    {day.dateStr < todayStr && !isManager ? (
                                        <div className="w-full py-2 rounded-xl bg-slate-50 dark:bg-white border border-slate-200/60 text-slate-400 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs">
                                            <Lock size={12} />
                                            <span>{locale === 'en' ? 'Locked (Past Day)' : 'Đã khóa (Ngày đã qua)'}</span>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setQuickAddModal({ open: true, dateStr: day.dateStr, dayName: getLocalizedDayName(day.dateStr, locale) })
                                                setAddCustomerId('')
                                                setAddActivityType('PERIODIC_CARE')
                                                setAddCustomPurpose('')
                                            }}
                                            className="w-full py-2 rounded-xl bg-slate-100 dark:bg-white hover:bg-slate-200 dark:hover:bg-[#E2E8F0] text-slate-700 dark:text-slate-600 font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                                        >
                                            <Plus size={13} /> {locale === 'en' ? 'Add Stop' : 'Thêm Điểm'}
                                        </button>
                                    )}
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
                <div className="space-y-3 sm:space-y-3.5 animate-in fade-in duration-200">
                    {/* 1. Header Controls for Review */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-50 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-200 shadow-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-white p-0.5 rounded-lg border border-slate-200 dark:border-slate-200">
                                <button type="button" onClick={handlePrevWeek} className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1F3342] cursor-pointer" title={locale === 'en' ? 'Previous week' : 'Tuần trước'}>
                                    <ChevronLeft size={14} />
                                </button>
                                <button type="button" onClick={handleCurrentWeek} className="px-2.5 py-1 rounded-md text-xs font-bold text-slate-800 dark:text-white hover:bg-white dark:hover:bg-[#1F3342] cursor-pointer">
                                    {locale === 'en' ? `Week ${currentWeek.week} / ${currentWeek.year}` : `Tuần ${currentWeek.week} / ${currentWeek.year}`}
                                </button>
                                <button type="button" onClick={handleNextWeek} className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1F3342] cursor-pointer" title={locale === 'en' ? 'Next week' : 'Tuần sau'}>
                                    <ChevronRight size={14} />
                                </button>
                            </div>

                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white px-2 py-1 rounded-md border border-slate-200 dark:border-slate-200">
                                {weekDates[0]?.dateStr.slice(5).replace('-', '/')} – {weekDates[6]?.dateStr.slice(5).replace('-', '/')}
                            </span>

                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-900 dark:text-white">
                                    {locale === 'en' ? 'Weekly Summary' : 'Tổng Kết Tuần'}
                                </span>
                                <span className="text-[11px] text-slate-400 font-normal hidden md:inline">
                                    {locale === 'en' ? '• Plan vs Actual Reconciliation' : '• Đối soát Kế Hoạch vs Thực Tế'}
                                </span>
                            </div>
                        </div>

                        {/* Status badge */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                                weeklyPlan?.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' :
                                weeklyPlan?.status === 'SUBMITTED' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30' :
                                'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            }`}>
                                {weeklyPlan?.status === 'APPROVED' ? (locale === 'en' ? '✓ MANAGER APPROVED' : '✓ QUẢN LÝ ĐÃ DUYỆT') :
                                 weeklyPlan?.status === 'SUBMITTED' ? (locale === 'en' ? '⏳ PENDING APPROVAL' : '⏳ ĐANG CHỜ DUYỆT') :
                                 (locale === 'en' ? '📝 REPORT NOT SUBMITTED' : '📝 CHƯA CHỐT BÁO CÁO')}
                            </span>
                        </div>
                    </div>

                    {/* 2. Compact KPI Metrics Ribbon (Thanh chỉ số KPI liền mạch) */}
                    <div className="bg-white dark:bg-slate-50 rounded-xl border border-slate-200 dark:border-slate-200 shadow-xs p-2 sm:p-2.5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-[#1E3040]">
                            {/* 1. Kế hoạch */}
                            <div className="px-3 py-1.5 flex flex-col justify-center">
                                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                                    {locale === 'en' ? 'Planned' : 'Kế hoạch'}
                                </span>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                    <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">{reviewStats.plannedCount}</span>
                                    <span className="text-[10px] text-slate-400">{locale === 'en' ? 'stops' : 'điểm'}</span>
                                </div>
                            </div>

                            {/* 2. Thực tế */}
                            <div className="px-3 py-1.5 flex flex-col justify-center">
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                    {locale === 'en' ? 'Completed' : 'Đã thực tế'}
                                </span>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                    <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{reviewStats.completedCount}</span>
                                    <span className="text-[10px] text-slate-400">{locale === 'en' ? 'stops' : 'điểm'}</span>
                                </div>
                            </div>

                            {/* 3. Tỷ lệ hoàn thành */}
                            <div className="px-3 py-1.5 flex flex-col justify-center">
                                <span className="text-[10px] font-semibold text-teal-600 dark:text-[#0891B2] uppercase tracking-wider">
                                    {locale === 'en' ? 'Completion' : 'Tỷ lệ đạt'}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-lg sm:text-xl font-black text-teal-600 dark:text-[#0891B2] font-mono">{reviewStats.rate}%</span>
                                    <div className="flex-1 max-w-[48px] bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-teal-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, reviewStats.rate)}%` }} />
                                    </div>
                                </div>
                            </div>

                            {/* 4. Đi đột xuất */}
                            <div className="px-3 py-1.5 flex flex-col justify-center">
                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                    {locale === 'en' ? 'Ad-hoc' : 'Đi đột xuất'}
                                </span>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                    <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono">{reviewStats.unplannedCount}</span>
                                    <span className="text-[10px] text-slate-400">{locale === 'en' ? 'unscheduled' : 'ngoài KH'}</span>
                                </div>
                            </div>

                            {/* 5. Khách mới mở */}
                            <div className="px-3 py-1.5 flex flex-col justify-center">
                                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                    {locale === 'en' ? 'New Clients' : 'Khách mới'}
                                </span>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                    <span className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">{reviewStats.newLeads}</span>
                                    <span className="text-[10px] text-slate-400">leads</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Detailed Comparison: Planned vs Actual by Day */}
                    <div className="bg-white dark:bg-slate-50 rounded-xl border border-slate-200 dark:border-slate-200 overflow-hidden shadow-xs">
                        <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-200 bg-slate-50/60 dark:bg-white/60 flex items-center justify-between">
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                {locale === 'en' ? 'Weekly Schedule Reconciliation Details' : 'Chi Tiết Đối Soát Lịch Trình Tuần'}
                            </h4>
                            <span className="text-[11px] text-slate-400 font-mono">
                                {weekDates[0]?.dateStr.slice(5).replace('-', '/')} – {weekDates[6]?.dateStr.slice(5).replace('-', '/')}
                            </span>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-[#E2E8F0]">
                            {weekDates.map(day => {
                                const dayPlanned = planVisits.filter(v => v.visitDate === day.dateStr)
                                const dayActual = weekActualVisits.filter(v => {
                                    if (!v.checkInTime) return false
                                    try {
                                        const vnDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(v.checkInTime))
                                        return vnDate === day.dateStr
                                    } catch {
                                        return v.checkInTime.slice(0, 10) === day.dateStr
                                    }
                                })
                                const hasActivity = dayPlanned.length > 0 || dayActual.length > 0

                                if (!hasActivity) {
                                    return (
                                        <div key={day.dateStr} className="px-3.5 py-2 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 bg-slate-50/20 dark:bg-white/20">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-500 dark:text-slate-400">{getLocalizedDayName(day.dateStr, locale)}</span>
                                                <span className="text-[11px] font-mono">({day.dateStr.slice(5).replace('-', '/')})</span>
                                                {day.isToday && (
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-500/20 text-teal-600 dark:text-[#0891B2]">
                                                        {locale === 'en' ? 'Today' : 'Hôm nay'}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] italic text-slate-400">
                                                {locale === 'en' ? 'No schedule & check-in activity' : 'Không có lịch trình & check-in'}
                                            </span>
                                        </div>
                                    )
                                }

                                // Gộp Kế hoạch và Thực tế thành danh sách khách hàng duy nhất trong ngày
                                const matchedActualIds = new Set<string>()

                                const plannedRows = dayPlanned.map((p, idx) => {
                                    const cust = p.customer || localCustomers.find(c => c.id === p.customerId)
                                    // Tìm lượt check-in thực tế khớp theo scheduleId hoặc customerId
                                    const actual = dayActual.find(a =>
                                        !matchedActualIds.has(a.id) &&
                                        ((a.scheduleId && a.scheduleId === p.id) || a.customerId === p.customerId)
                                    )
                                    if (actual) matchedActualIds.add(actual.id)

                                    return {
                                        key: p.id || `plan_${idx}`,
                                        customerId: p.customerId,
                                        customerName: cust?.name || (locale === 'en' ? 'Client' : 'Khách hàng'),
                                        customerCode: cust?.code || '',
                                        customerChannel: cust?.channel || null,
                                        isPlanned: true,
                                        plannedPurpose: p.purpose || (locale === 'en' ? 'Periodic Customer Care' : 'Chăm sóc khách hàng định kỳ'),
                                        actualVisit: actual || null,
                                        isCompleted: !!actual && (actual.status === 'COMPLETED' || !!actual.checkInTime),
                                    }
                                })

                                const unplannedRows = dayActual
                                    .filter(a => !matchedActualIds.has(a.id))
                                    .map(a => {
                                        const cust = a.customer || localCustomers.find(c => c.id === a.customerId)
                                        return {
                                            key: a.id,
                                            customerId: a.customerId,
                                            customerName: cust?.name || a.customerName || (locale === 'en' ? 'Client' : 'Khách hàng'),
                                            customerCode: cust?.code || a.customerCode || '',
                                            customerChannel: cust?.channel || a.customerChannel || null,
                                            isPlanned: false,
                                            plannedPurpose: '',
                                            actualVisit: a,
                                            isCompleted: true,
                                        }
                                    })

                                const unifiedItems = [...plannedRows, ...unplannedRows]
                                const completedCount = unifiedItems.filter(i => i.isCompleted).length
                                const unplannedCount = unplannedRows.length

                                return (
                                    <div key={day.dateStr} className="p-3 sm:p-3.5 space-y-2.5">
                                        {/* Tiêu đề ngày & Tóm tắt số liệu */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1 border-b border-slate-100 dark:border-[#1E3040]">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                                                    {getLocalizedDayName(day.dateStr, locale)} ({day.dateStr.slice(5).replace('-', '/')})
                                                </span>
                                                {day.isToday && (
                                                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-teal-500/20 text-teal-600 dark:text-[#0891B2] font-bold">
                                                        {locale === 'en' ? 'Today' : 'Hôm nay'}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    ({unifiedItems.length} {locale === 'en' ? 'clients' : 'khách'})
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-[11px] font-mono flex-wrap">
                                                <span className="text-slate-500 dark:text-slate-400">
                                                    {locale === 'en' ? 'Planned:' : 'Kế hoạch:'} <strong className="text-slate-800 dark:text-slate-200">{dayPlanned.length}</strong>
                                                </span>
                                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                                <span className="text-emerald-600 dark:text-emerald-400">
                                                    {locale === 'en' ? 'Actual:' : 'Thực tế:'} <strong>{completedCount}</strong>
                                                </span>
                                                {unplannedCount > 0 && (
                                                    <>
                                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                                                            +{unplannedCount} {locale === 'en' ? 'ad-hoc' : 'đột xuất'}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Danh sách khách hàng hợp nhất trong ngày */}
                                        <div className="space-y-2">
                                            {unifiedItems.map(item => {
                                                const visitTime = item.actualVisit?.checkInTime
                                                    ? new Date(item.actualVisit.checkInTime).toLocaleTimeString(locale === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' })
                                                    : null

                                                return (
                                                    <div
                                                        key={item.key}
                                                        className={`p-2.5 sm:p-3 rounded-xl border transition-all text-xs ${
                                                            item.isCompleted
                                                                ? 'bg-white dark:bg-white border-slate-200 dark:border-[#243B4D] shadow-2xs'
                                                                : 'bg-slate-50/50 dark:bg-[#101A22]/50 border-dashed border-slate-200 dark:border-slate-200'
                                                        }`}
                                                    >
                                                        {/* Dòng đầu: Phân loại, Mã, Tên khách, Kênh & Trạng thái hoàn thành */}
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                                                                {item.isPlanned ? (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 shrink-0">
                                                                        {locale === 'en' ? '📋 PLANNED' : '📋 THEO KẾ HOẠCH'}
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 shrink-0">
                                                                        {locale === 'en' ? '⚡ AD-HOC' : '⚡ ĐỘT XUẤT'}
                                                                    </span>
                                                                )}

                                                                {item.customerCode && (
                                                                    <span className="text-[10px] font-mono text-teal-600 dark:text-[#0891B2] font-bold shrink-0">
                                                                        [{item.customerCode}]
                                                                    </span>
                                                                )}

                                                                <span className="font-bold text-slate-900 dark:text-white truncate" title={item.customerName}>
                                                                    {item.customerName}
                                                                </span>

                                                                {item.customerChannel && (
                                                                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-[#1C2E3D] text-slate-500 dark:text-slate-400 shrink-0">
                                                                        {item.customerChannel}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="shrink-0">
                                                                {item.isCompleted ? (
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                                        <CheckCircle2 size={11} />
                                                                        <span>{locale === 'en' ? 'Completed' : 'Đã hoàn thành'}</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                                        <Clock size={11} />
                                                                        <span>{locale === 'en' ? 'Not visited / Missed' : 'Chưa đi / Bỏ lỡ'}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Lưới con: Mục tiêu kế hoạch vs Kết quả thực tế của khách hàng này */}
                                                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-slate-100 dark:border-[#1E3040]">
                                                            {/* Cột Kế hoạch dự kiến */}
                                                            <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-50/60">
                                                                <span className="text-slate-400 shrink-0 font-bold">
                                                                    {locale === 'en' ? '🎯 Planned:' : '🎯 Kế hoạch:'}
                                                                </span>
                                                                {item.isPlanned ? (
                                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                                        {item.plannedPurpose}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-amber-600 dark:text-amber-400 italic">
                                                                        {locale === 'en' ? 'Not in initial plan (Ad-hoc field visit)' : 'Không có trong kế hoạch ban đầu (Phát sinh tại thị trường)'}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Cột Thực tế thực hiện */}
                                                            <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-50/60">
                                                                <span className="text-slate-400 shrink-0 font-bold">
                                                                    {locale === 'en' ? '📍 Actual:' : '📍 Thực tế:'}
                                                                </span>
                                                                {item.actualVisit ? (
                                                                    <div className="space-y-1 flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                                                                {locale === 'en' ? 'Check-in time:' : 'Giờ check-in:'} {visitTime}
                                                                            </span>
                                                                            <div className="flex items-center gap-1.5 ml-auto">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setQuickReportTarget(item.actualVisit)}
                                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-[10px] font-bold hover:bg-teal-100 dark:hover:bg-teal-900/50 transition cursor-pointer"
                                                                                    title={locale === 'en' ? 'Edit or record field report' : 'Sửa hoặc ghi báo cáo thực địa'}
                                                                                >
                                                                                    <FileText size={10} />
                                                                                    <span>{item.actualVisit.notes ? (locale === 'en' ? 'Edit report' : 'Sửa báo cáo') : (locale === 'en' ? 'Add report' : 'Ghi báo cáo')}</span>
                                                                                </button>
                                                                                {item.actualVisit.checkInPhoto && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setViewPhoto({
                                                                                            title: `${locale === 'en' ? 'Check-in Photo:' : 'Ảnh Check-in:'} ${item.customerName}`,
                                                                                            url: item.actualVisit.checkInPhoto,
                                                                                            visitId: item.actualVisit.id
                                                                                        })}
                                                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold hover:underline cursor-pointer"
                                                                                        title={locale === 'en' ? 'View actual check-in photo' : 'Xem ảnh check-in thực tế'}
                                                                                    >
                                                                                        <Camera size={10} /> {locale === 'en' ? 'View photo' : 'Xem ảnh'}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {item.actualVisit.notes && (
                                                                            <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-white dark:bg-[#172633] p-1.5 rounded border border-slate-200/80 dark:border-[#243B4D] break-words">
                                                                                💬 {item.actualVisit.notes}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 italic">
                                                                        {locale === 'en' ? 'No actual check-in recorded yet' : 'Chưa có lượt check-in thực tế nào'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* 4. Section: Sale Self-Review (Sale Tự Chốt Báo Cáo Tuần) */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 space-y-2.5 shadow-xs">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Award size={15} className="text-teal-600 dark:text-[#0891B2]" />
                                {locale === 'en' ? "Staff's Weekly Self-Evaluation" : 'Tự Đánh Giá Tuần Của Nhân Viên'}
                            </h4>
                            {weeklyPlan?.submittedAt && (
                                <span className="text-[10px] font-mono text-slate-400">
                                    {locale === 'en' ? 'Submitted at:' : 'Đã gửi:'} {new Date(weeklyPlan.submittedAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}
                                </span>
                            )}
                        </div>

                        <textarea
                            rows={3}
                            value={selfReviewText}
                            onChange={e => setSelfReviewText(e.target.value)}
                            placeholder={locale === 'en' ? 'Weekly summary: Achievements, market challenges, requested support...' : 'Tổng kết tuần: Kết quả đạt được, khó khăn tại điểm bán, đề xuất hỗ trợ...'}
                            className="w-full p-2.5 text-base sm:text-xs rounded-lg bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-200 text-slate-900 dark:text-slate-900 placeholder:text-slate-400 outline-none focus:border-teal-500 transition resize-y"
                        />

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                            <span className="text-[10px] text-slate-400">
                                {locale === 'en' ? 'Submit report at the end of the week for Manager review and approval.' : 'Gửi báo cáo vào cuối tuần để Quản lý kiểm tra và phê duyệt.'}
                            </span>

                            <button
                                type="button"
                                onClick={handleSubmitWeeklyReport}
                                disabled={submittingReport}
                                className="self-end sm:self-auto px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                <Send size={13} />
                                <span>{submittingReport ? (locale === 'en' ? 'Submitting...' : 'Đang gửi...') : (locale === 'en' ? 'Submit Weekly Report' : 'Gửi Báo Cáo Tuần')}</span>
                            </button>
                        </div>
                    </div>

                    {/* 5. Section: Manager Feedback & Approval */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/60 dark:bg-white/60 border border-slate-200 dark:border-slate-200 space-y-2 shadow-xs">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <ShieldCheck size={15} className="text-teal-600 dark:text-[#0891B2]" />
                            {locale === 'en' ? "Manager's Feedback & Review" : 'Nhận Xét Của Quản Lý'}
                        </h4>

                        {isManager ? (
                            <div className="space-y-2">
                                <textarea
                                    rows={2}
                                    value={managerFeedbackText}
                                    onChange={e => setManagerFeedbackText(e.target.value)}
                                    placeholder={locale === 'en' ? 'Enter feedback or instructions for staff...' : 'Nhập nhận xét hoặc lưu ý cho nhân viên...'}
                                    className="w-full p-2.5 text-base sm:text-xs rounded-lg bg-white dark:bg-white border border-slate-200 dark:border-slate-200 text-slate-900 dark:text-slate-900 placeholder:text-slate-400 outline-none focus:border-teal-500 transition"
                                />
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSaveManagerFeedback}
                                        disabled={savingFeedback}
                                        className="px-4 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                                    >
                                        <Check size={13} />
                                        <span>{savingFeedback ? (locale === 'en' ? 'Saving...' : 'Đang lưu...') : (locale === 'en' ? 'Save Feedback & Approve' : 'Lưu Nhận Xét & Duyệt')}</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 rounded-lg bg-white dark:bg-white border border-slate-200 dark:border-slate-200 text-xs">
                                {managerFeedbackText ? (
                                    <div className="space-y-1">
                                        <p className="font-semibold text-slate-800 dark:text-white">{managerFeedbackText}</p>
                                        {weeklyPlan?.reviewedAt && (
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                {locale === 'en' ? 'Approved at:' : 'Đã duyệt lúc:'} {new Date(weeklyPlan.reviewedAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-slate-400 italic">
                                        {locale === 'en' ? 'Manager has not left any feedback for this week yet.' : 'Quản lý chưa để lại nhận xét cho tuần này.'}
                                    </span>
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
                <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-200">
                    {/* 1. Header Toolbar & Filters */}
                    <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={filterSearch}
                                    onChange={e => setFilterSearch(e.target.value)}
                                    placeholder={locale === 'en' ? 'Search by client, code, notes...' : 'Tìm theo tên khách, mã KH, ghi chú...'}
                                    className="w-full pl-9 pr-3 py-2 text-base sm:text-xs rounded-xl bg-slate-100 dark:bg-white border border-slate-200 dark:border-slate-200 text-slate-900 dark:text-slate-900 outline-none focus:border-teal-500 transition"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Quick Date Filter Chips */}
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white p-1 rounded-xl border border-slate-200 dark:border-slate-200 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setFilterDate('')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                        !filterDate
                                            ? 'bg-white dark:bg-[#1F3342] text-slate-900 dark:text-white shadow-xs'
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    {locale === 'en' ? 'All' : 'Tất Cả'}
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
                                    {locale === 'en' ? 'Today' : 'Hôm Nay'}
                                </button>
                            </div>

                            {/* Date Picker Input */}
                            <div className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-200">
                                <Calendar size={13} className="text-slate-400" />
                                <input
                                    type="date"
                                    value={filterDate}
                                    onChange={e => setFilterDate(e.target.value)}
                                    className="bg-transparent text-slate-800 dark:text-white font-bold outline-none cursor-pointer text-base sm:text-xs"
                                />
                                {filterDate && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterDate('')}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 cursor-pointer"
                                        title={locale === 'en' ? 'Clear date' : 'Bỏ chọn ngày'}
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>

                            {/* Status Filter */}
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                className="px-2.5 py-1.5 text-base sm:text-xs rounded-xl bg-slate-100 dark:bg-white border border-slate-200 dark:border-slate-200 text-slate-800 dark:text-slate-900 outline-none cursor-pointer font-bold"
                            >
                                <option value="ALL">{locale === 'en' ? 'All statuses' : 'Tất cả trạng thái'}</option>
                                <option value="IN_PROGRESS">{locale === 'en' ? 'In progress' : 'Đang viếng thăm'}</option>
                                <option value="COMPLETED">{locale === 'en' ? 'Completed' : 'Đã hoàn thành'}</option>
                            </select>

                            {/* View Switcher: Grid vs Table */}
                            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-white p-0.5 rounded-xl border border-slate-200 dark:border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setHistoryViewMode('GRID')}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                        historyViewMode === 'GRID'
                                            ? 'bg-white dark:bg-[#1F3342] text-teal-600 dark:text-[#0891B2] shadow-xs'
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                    title={locale === 'en' ? 'Photo grid view' : 'Chế độ Lưới ảnh trực quan'}
                                >
                                    <LayoutGrid size={13} />
                                    <span className="hidden sm:inline">{locale === 'en' ? 'Grid' : 'Lưới ảnh'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHistoryViewMode('TABLE')}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                        historyViewMode === 'TABLE'
                                            ? 'bg-white dark:bg-[#1F3342] text-teal-600 dark:text-[#0891B2] shadow-xs'
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                    title={locale === 'en' ? 'Table audit view' : 'Chế độ Bảng danh sách'}
                                >
                                    <List size={13} />
                                    <span className="hidden sm:inline">{locale === 'en' ? 'Table' : 'Bảng'}</span>
                                </button>
                            </div>

                            {/* Refresh button */}
                            <button
                                type="button"
                                onClick={fetchHistoryVisits}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-white border border-slate-200 dark:border-slate-200 text-slate-600 dark:text-slate-600 hover:bg-slate-200 dark:hover:bg-white transition cursor-pointer"
                                title={locale === 'en' ? 'Refresh list' : 'Làm mới danh sách'}
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>

                    {/* 2. Sub-summary & Quick Stats */}
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-600 px-1">
                        <div className="flex items-center gap-2">
                            <span>{locale === 'en' ? 'Showing' : 'Hiển thị'} <strong>{filteredHistoryVisits.length}</strong> {locale === 'en' ? 'visits' : 'lượt viếng thăm'}</span>
                            <span>•</span>
                            <span className="text-teal-600 dark:text-[#0891B2] font-bold">
                                {locale === 'en'
                                    ? `${filteredHistoryVisits.filter(v => !!(v.checkInPhoto || v.checkOutPhoto)).length} with verified photo`
                                    : `${filteredHistoryVisits.filter(v => !!(v.checkInPhoto || v.checkOutPhoto)).length} có ảnh chụp thực tế`}
                            </span>
                        </div>
                        {filterDate && (
                            <span className="font-mono text-[11px] bg-slate-100 dark:bg-white px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-200">
                                {locale === 'en' ? 'Date:' : 'Ngày:'} {filterDate}
                            </span>
                        )}
                    </div>

                    {/* 3. Main Content: Grid Mode vs Table Mode */}
                    {filteredHistoryVisits.length === 0 ? (
                        <div className="py-16 text-center rounded-2xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 p-6 space-y-3 shadow-xs">
                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#1E3040] text-slate-400 flex items-center justify-center mx-auto">
                                <Camera size={24} />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {locale === 'en' ? 'No check-in visits or photos matched the current filter.' : 'Không tìm thấy hình ảnh hoặc lượt check-in nào phù hợp bộ lọc.'}
                            </p>
                            {(filterDate || filterSearch || filterStatus !== 'ALL') && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilterDate('')
                                        setFilterSearch('')
                                        setFilterStatus('ALL')
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-[#0891B2] text-xs font-bold cursor-pointer hover:underline"
                                >
                                    {locale === 'en' ? 'Clear filters to view all' : 'Xóa bộ lọc để xem tất cả'}
                                </button>
                            )}
                        </div>
                    ) : historyViewMode === 'GRID' ? (
                        /* ================== GRID PHOTO GALLERY ================== */
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                            {filteredHistoryVisits.map(v => {
                                const photoUrl = v.checkInPhoto || v.checkOutPhoto
                                const timeStr = v.checkInTime ? new Date(v.checkInTime).toLocaleTimeString(locale === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''
                                const dateStr = v.checkInTime ? new Date(v.checkInTime).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', { day: '2-digit', month: '2-digit' }) : ''

                                return (
                                    <div
                                        key={v.id}
                                        className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-200 bg-white dark:bg-slate-50 shadow-xs hover:shadow-md transition-all flex flex-col group"
                                    >
                                        {/* Photo Box with Overlay and Watermark */}
                                        <div
                                            className="relative aspect-4/3 bg-slate-900 overflow-hidden cursor-pointer flex items-center justify-center"
                                            onClick={() => {
                                                if (photoUrl) {
                                                    setViewPhoto({
                                                        title: `${locale === 'en' ? 'Check-in Photo:' : 'Ảnh Check-in:'} ${v.customerName}`,
                                                        url: photoUrl,
                                                        visitId: v.id
                                                    })
                                                }
                                            }}
                                        >
                                            {photoUrl ? (
                                                <>
                                                    <img
                                                        src={photoUrl}
                                                        alt={v.customerName}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        loading="lazy"
                                                    />

                                                    {/* Shadow Gradient */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

                                                    {/* Top Badges */}
                                                    <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/60 backdrop-blur-xs text-white border border-white/10 flex items-center gap-1 shadow-xs">
                                                            <Clock size={10} className="text-teal-400" />
                                                            <span>{timeStr} • {dateStr}</span>
                                                        </span>

                                                        {v.isUnplanned ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-white shadow-xs">
                                                                ⚡ {locale === 'en' ? 'AD-HOC' : 'ĐỘT XUẤT'}
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-600 text-white shadow-xs">
                                                                📋 {locale === 'en' ? 'PLANNED' : 'KẾ HOẠCH'}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Bottom Location Overlay */}
                                                    <div className="absolute bottom-2.5 inset-x-2.5 text-white pointer-events-none space-y-0.5">
                                                        {v.checkInAddress ? (
                                                            <p className="text-[10px] truncate text-slate-200 flex items-center gap-1" title={v.checkInAddress}>
                                                                <MapPin size={10} className="text-teal-400 shrink-0" />
                                                                <span className="truncate">{v.checkInAddress}</span>
                                                            </p>
                                                        ) : v.checkInLat && v.checkInLng ? (
                                                            <p className="text-[10px] font-mono text-slate-300 flex items-center gap-1">
                                                                <MapPin size={10} className="text-teal-400 shrink-0" />
                                                                <span>{v.checkInLat.toFixed(4)}, {v.checkInLng.toFixed(4)}</span>
                                                            </p>
                                                        ) : null}
                                                    </div>

                                                    {/* Hover Overlay Zoom Icon */}
                                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1">
                                                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-lg">
                                                            <Eye size={18} />
                                                        </div>
                                                        <span className="text-[10px] font-bold tracking-wide">{locale === 'en' ? 'Enlarge photo' : 'Xem ảnh lớn'}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5 p-4 text-center">
                                                    <Camera size={26} className="opacity-40" />
                                                    <span className="text-[10px] italic">{locale === 'en' ? 'No check-in photo' : 'Chưa có ảnh check-in'}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Details Body */}
                                        <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                                            <div className="space-y-1.5">
                                                {/* Customer title & Channel */}
                                                <div className="flex items-start justify-between gap-1.5">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            {v.customerCode && (
                                                                <span className="text-[10px] font-mono text-teal-600 dark:text-[#0891B2] font-bold">
                                                                    [{v.customerCode}]
                                                                </span>
                                                            )}
                                                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate" title={v.customerName}>
                                                                {v.customerName}
                                                            </span>
                                                        </div>
                                                        {v.customerChannel && (
                                                            <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#1A2C3A] text-slate-500 dark:text-slate-400">
                                                                {v.customerChannel}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Notes or Purpose */}
                                                {v.notes ? (
                                                    <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#162534] p-1.5 rounded-lg border border-slate-100 dark:border-slate-200 line-clamp-2" title={v.notes}>
                                                        💬 {v.notes}
                                                    </div>
                                                ) : v.purpose ? (
                                                    <div className="text-[11px] text-slate-400 italic line-clamp-1" title={v.purpose}>
                                                        🎯 {v.purpose}
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* Action Footer */}
                                            <div className="pt-2 border-t border-slate-100 dark:border-[#1E3040] flex items-center justify-between gap-2 text-xs">
                                                <span className="text-[10px] text-slate-400 font-mono truncate">
                                                    #{v.visitNo || v.id?.slice(-6)}
                                                </span>

                                                <div className="flex items-center gap-2">
                                                    {v.checkInLat && v.checkInLng && (
                                                        <a
                                                            href={`https://www.google.com/maps?q=${v.checkInLat},${v.checkInLng}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-[10px] font-bold text-slate-500 hover:text-teal-600 dark:hover:text-[#0891B2] flex items-center gap-0.5 transition"
                                                            title={locale === 'en' ? 'View on Google Maps' : 'Xem vị trí trên Google Maps'}
                                                        >
                                                            <Navigation size={10} />
                                                            <span>Maps</span>
                                                        </a>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => setQuickReportTarget(v)}
                                                        className="text-[10px] font-bold text-teal-600 dark:text-[#0891B2] hover:underline flex items-center gap-0.5 cursor-pointer"
                                                        title={locale === 'en' ? 'Edit or record field report' : 'Sửa hoặc ghi báo cáo thực địa'}
                                                    >
                                                        <FileText size={10} />
                                                        <span>{v.notes ? (locale === 'en' ? 'Report' : 'Báo cáo') : (locale === 'en' ? 'Add note' : 'Ghi báo cáo')}</span>
                                                    </button>

                                                    {photoUrl && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewPhoto({
                                                                title: `${locale === 'en' ? 'Check-in Photo:' : 'Ảnh Check-in:'} ${v.customerName}`,
                                                                url: photoUrl,
                                                                visitId: v.id
                                                            })}
                                                            className="text-[10px] font-bold text-teal-600 dark:text-[#0891B2] hover:underline flex items-center gap-0.5 cursor-pointer"
                                                        >
                                                            <Eye size={11} />
                                                            <span>{locale === 'en' ? 'View photo' : 'Xem ảnh'}</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        /* ================== TABLE VIEW (AUDIT MODE) ================== */
                        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-200 bg-white dark:bg-slate-50 shadow-xs">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-white text-slate-500 dark:text-slate-600 border-b border-slate-200 dark:border-slate-200">
                                            <th className="p-3.5 font-bold">{locale === 'en' ? 'Visit Code' : 'Mã Visit'}</th>
                                            <th className="p-3.5 font-bold">{locale === 'en' ? 'Client & Sales Rep' : 'Khách Hàng & Sale'}</th>
                                            <th className="p-3.5 font-bold text-center">{locale === 'en' ? 'Check-in Photo' : 'Ảnh Check-in'}</th>
                                            <th className="p-3.5 font-bold text-center">{locale === 'en' ? 'Check-in Time' : 'Giờ Check-in'}</th>
                                            <th className="p-3.5 font-bold">{locale === 'en' ? 'Coordinates & GPS' : 'Toạ Độ & Vị Trí'}</th>
                                            <th className="p-3.5 font-bold">{locale === 'en' ? 'Activity & Notes' : 'Hoạt Động & Ghi Chú'}</th>
                                            <th className="p-3.5 font-bold text-center">{locale === 'en' ? 'Status' : 'Trạng Thái'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-[#E2E8F0]">
                                        {filteredHistoryVisits.map(v => (
                                            <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-white transition">
                                                <td className="p-3.5 font-mono font-bold text-teal-600 dark:text-[#0891B2]">
                                                    {v.visitNo}
                                                    {v.isUnplanned && (
                                                        <span className="block text-[9px] font-sans font-bold text-amber-500">
                                                            {locale === 'en' ? 'Ad-hoc' : 'Đột xuất'}
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
                                                            className="w-14 h-14 object-cover rounded-xl border border-slate-200 dark:border-slate-200 cursor-pointer mx-auto hover:scale-105 transition shadow-xs"
                                                            onClick={() => setViewPhoto({ title: `${locale === 'en' ? 'Check-in Photo:' : 'Ảnh Check-in:'} ${v.customerName}`, url: (v.checkInPhoto || v.checkOutPhoto)!, visitId: v.id })}
                                                        />
                                                    ) : <span className="text-slate-400 italic">{locale === 'en' ? 'None' : 'Chưa có'}</span>}
                                                </td>
                                                <td className="p-3.5 text-center font-bold font-mono text-teal-600 dark:text-[#0891B2] whitespace-nowrap">
                                                    {new Date(v.checkInTime).toLocaleTimeString(locale === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="p-3.5 max-w-xs">
                                                    {v.checkInLat && v.checkInLng ? (
                                                        <div className="space-y-0.5">
                                                            <a
                                                                href={`https://www.google.com/maps?q=${v.checkInLat},${v.checkInLng}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 text-teal-600 dark:text-[#0891B2] hover:underline font-mono text-[11px]"
                                                            >
                                                                <Navigation size={11} /> {v.checkInLat.toFixed(4)}, {v.checkInLng.toFixed(4)}
                                                            </a>
                                                            {v.checkInAddress && (
                                                                <p className="text-[10px] text-slate-500 truncate" title={v.checkInAddress}>
                                                                    {v.checkInAddress}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : <span className="text-slate-400">{locale === 'en' ? 'No GPS' : 'Không có GPS'}</span>}
                                                </td>
                                                <td className="p-3.5 max-w-xs text-slate-700 dark:text-slate-200 text-xs">
                                                    <div className="flex items-center justify-between gap-1.5">
                                                        <div className="line-clamp-2 flex-1 min-w-0" title={v.notes || v.purpose}>
                                                            {v.notes || v.purpose || <span className="text-slate-400 italic">{locale === 'en' ? 'None' : 'Chưa có'}</span>}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setQuickReportTarget(v)}
                                                            className="p-1 rounded-md text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 shrink-0 cursor-pointer transition"
                                                            title={locale === 'en' ? 'Edit or record field report' : 'Sửa hoặc ghi báo cáo thực địa'}
                                                        >
                                                            <FileText size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="p-3.5 text-center whitespace-nowrap">
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                                        ✓ {locale === 'en' ? 'Completed' : 'Hoàn thành'}
                                                    </span>
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

            {/* ============================================================== */}
            {/* MODAL: UNPLANNED CHECK-IN (BOTTOM SHEET ON MOBILE) */}
            {/* ============================================================== */}
            {showUnplannedModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/80 backdrop-blur-xs transition-opacity animate-in fade-in" onClick={() => setShowUnplannedModal(false)}>
                    <div
                        className="w-full max-w-md bg-white dark:bg-slate-50 p-5 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 safe-area-pb"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Mobile Pull Handle Indicator */}
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto sm:hidden -mt-1 mb-1" />

                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-200 pb-3">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Sparkles size={18} className="text-amber-500" />
                                {locale === 'en' ? 'Ad-Hoc Unplanned Check-in' : 'Check-in Đột Xuất Ngoài Kế Hoạch'}
                            </h3>
                            <button onClick={() => setShowUnplannedModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3.5 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    {locale === 'en' ? 'Select customer / client:' : 'Chọn khách hàng:'}
                                </label>
                                <SearchableCustomerCombobox
                                    customers={localCustomers}
                                    selectedCustomerId={unplannedCustomerId}
                                    onSelect={c => setUnplannedCustomerId(c.id)}
                                    onOpenQuickCreate={() => setShowQuickCreateModal(true)}
                                    locale={locale}
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    {locale === 'en' ? 'Activity type:' : 'Loại hoạt động:'}
                                </label>
                                <select
                                    value={unplannedActivityType}
                                    onChange={e => setUnplannedActivityType(e.target.value)}
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white border border-slate-300 dark:border-slate-200 text-slate-900 dark:text-slate-900 outline-none font-medium text-base sm:text-xs"
                                >
                                    {ACTIVITY_PRESETS.map(p => (
                                        <option key={p.value} value={p.value}>
                                            {p.icon} {getActivityPresetLabel(p.value, locale)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    {locale === 'en' ? 'Specific purpose (optional):' : 'Mục đích cụ thể (tùy chọn):'}
                                </label>
                                <input
                                    type="text"
                                    value={unplannedPurpose}
                                    onChange={e => setUnplannedPurpose(e.target.value)}
                                    placeholder={locale === 'en' ? 'Describe planned tasks at this client...' : 'Ghi rõ việc sẽ làm tại khách này...'}
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white border border-slate-300 dark:border-slate-200 text-slate-900 dark:text-slate-900 outline-none text-base sm:text-xs"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-200">
                            <button
                                type="button"
                                onClick={() => setShowUnplannedModal(false)}
                                className="px-4 py-2.5 text-xs font-medium rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white cursor-pointer min-h-[42px]"
                            >
                                {locale === 'en' ? 'Cancel' : 'Hủy'}
                            </button>
                            <button
                                type="button"
                                onClick={startCheckInUnplanned}
                                className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-[#87CBB9] dark:text-slate-900 text-white flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer min-h-[44px]"
                            >
                                <Camera size={16} /> {locale === 'en' ? 'Open Check-in Camera' : 'Mở Camera Check-in'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL: QUICK ADD VISIT TO PLANNING DAY */}
            {/* ============================================================== */}
            {quickAddModal && (
                <div 
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/80 backdrop-blur-xs transition-opacity animate-in fade-in"
                    onClick={() => setQuickAddModal(null)}
                >
                    <div 
                        className="w-full max-w-md bg-white dark:bg-slate-50 p-5 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 safe-area-pb"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Mobile Drag Indicator Bar */}
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto sm:hidden -mt-1 mb-1" />

                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-200 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    {locale === 'en' ? 'Add Destination:' : 'Thêm Điểm Đến:'} {getLocalizedDayName(quickAddModal.dateStr, locale)}
                                </h3>
                                <p className="text-[11px] font-mono text-slate-400">{quickAddModal.dateStr}</p>
                            </div>
                            <button onClick={() => setQuickAddModal(null)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3.5 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    {locale === 'en' ? 'Select customer / client:' : 'Chọn khách hàng:'}
                                </label>
                                <SearchableCustomerCombobox
                                    customers={localCustomers}
                                    selectedCustomerId={addCustomerId}
                                    onSelect={c => setAddCustomerId(c.id)}
                                    onOpenQuickCreate={() => setShowQuickCreateModal(true)}
                                    locale={locale}
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    {locale === 'en' ? 'Planned activity:' : 'Hoạt động dự kiến:'}
                                </label>
                                <select
                                    value={addActivityType}
                                    onChange={e => setAddActivityType(e.target.value)}
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white border border-slate-300 dark:border-slate-200 text-slate-900 dark:text-slate-900 outline-none font-medium text-base sm:text-xs"
                                >
                                    {ACTIVITY_PRESETS.map(p => (
                                        <option key={p.value} value={p.value}>
                                            {p.icon} {getActivityPresetLabel(p.value, locale)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    {locale === 'en' ? 'Additional notes (optional):' : 'Ghi chú bổ sung (tùy chọn):'}
                                </label>
                                <input
                                    type="text"
                                    value={addCustomPurpose}
                                    onChange={e => setAddCustomPurpose(e.target.value)}
                                    placeholder={locale === 'en' ? 'e.g. Introduce new vintage, collect payment...' : 'Ví dụ: Giới thiệu vang trắng mới, thu công nợ 5 triệu...'}
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white border border-slate-300 dark:border-slate-200 text-slate-900 dark:text-slate-900 outline-none text-base sm:text-xs"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-200">
                            <button
                                type="button"
                                onClick={() => setQuickAddModal(null)}
                                className="px-4 py-2.5 text-xs font-medium rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white cursor-pointer min-h-[42px]"
                            >
                                {locale === 'en' ? 'Cancel' : 'Hủy'}
                            </button>
                            <button
                                type="button"
                                onClick={handleAddVisitToPlan}
                                className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer min-h-[44px]"
                            >
                                <Plus size={15} /> {locale === 'en' ? 'Add to Schedule' : 'Thêm Vào Lịch'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL: QUICK CREATE PROSPECT CUSTOMER */}
            {/* ============================================================== */}
            {showQuickCreateModal && (
                <div 
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/80 backdrop-blur-xs transition-opacity animate-in fade-in"
                    onClick={() => setShowQuickCreateModal(false)}
                >
                    <form 
                        onSubmit={handleQuickCreateCustomer} 
                        className="w-full max-w-md bg-white dark:bg-slate-50 p-5 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-200 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 safe-area-pb"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Mobile Drag Indicator Bar */}
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto sm:hidden -mt-1 mb-1" />

                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-200 pb-3">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Plus size={18} className="text-teal-600 dark:text-[#0891B2]" />
                                {locale === 'en' ? 'Quick Create Prospect Client' : 'Tạo Nhanh Khách Hàng Tiềm Năng'}
                            </h3>
                            <button type="button" onClick={() => setShowQuickCreateModal(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    {locale === 'en' ? <>Restaurant / Client Name <span className="text-red-500">*</span></> : <>Tên nhà hàng / Khách hàng <span className="text-red-500">*</span></>}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={quickCustName}
                                    onChange={e => setQuickCustName(e.target.value)}
                                    placeholder={locale === 'en' ? 'e.g. La Maison Restaurant, Wine Bar 1985...' : 'Ví dụ: Nhà hàng La Maison, Wine Bar 1985...'}
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white border border-slate-300 dark:border-slate-200 text-slate-900 dark:text-slate-900 outline-none focus:border-teal-500 text-base sm:text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                        {locale === 'en' ? 'Business channel:' : 'Kênh kinh doanh:'}
                                    </label>
                                    <select
                                        value={quickCustChannel}
                                        onChange={e => setQuickCustChannel(e.target.value)}
                                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white border border-slate-300 dark:border-slate-200 text-slate-900 dark:text-slate-900 outline-none text-base sm:text-xs"
                                    >
                                        <option value="HORECA">{locale === 'en' ? 'HORECA (Restaurant/Bar/Hotel)' : 'HORECA (Nhà hàng/Bar)'}</option>
                                        <option value="WHOLESALE_DISTRIBUTOR">{locale === 'en' ? 'Wholesale Distributor' : 'Đại lý phân phối'}</option>
                                        <option value="VIP_RETAIL">{locale === 'en' ? 'VIP Retail' : 'Bán lẻ VIP'}</option>
                                        <option value="RETAIL">{locale === 'en' ? 'General Retail' : 'Bán lẻ thông thường'}</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                        {locale === 'en' ? 'Contact person:' : 'Người liên hệ:'}
                                    </label>
                                    <input
                                        type="text"
                                        value={quickCustContact}
                                        onChange={e => setQuickCustContact(e.target.value)}
                                        placeholder={locale === 'en' ? 'Manager, Sommelier, Owner...' : 'Quản lý, Sommelier...'}
                                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white border border-slate-300 dark:border-slate-200 text-slate-900 dark:text-slate-900 outline-none text-base sm:text-xs"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    {locale === 'en' ? 'Contact phone number:' : 'Số điện thoại liên hệ:'}
                                </label>
                                <input
                                    type="text"
                                    value={quickCustPhone}
                                    onChange={e => setQuickCustPhone(e.target.value)}
                                    placeholder="0901234567"
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white border border-slate-300 dark:border-slate-200 text-slate-900 dark:text-slate-900 outline-none font-mono text-base sm:text-xs"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                                    {locale === 'en' ? 'Outlet / Store address:' : 'Địa chỉ điểm bán:'}
                                </label>
                                <input
                                    type="text"
                                    value={quickCustAddress}
                                    onChange={e => setQuickCustAddress(e.target.value)}
                                    placeholder={locale === 'en' ? 'Street, ward, district, city...' : 'Số nhà, đường, phường, quận...'}
                                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white border border-slate-300 dark:border-slate-200 text-slate-900 dark:text-slate-900 outline-none text-base sm:text-xs"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-200">
                            <button
                                type="button"
                                onClick={() => setShowQuickCreateModal(false)}
                                className="px-4 py-2.5 text-xs font-medium rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white cursor-pointer min-h-[42px]"
                            >
                                {locale === 'en' ? 'Cancel' : 'Hủy'}
                            </button>
                            <button
                                type="submit"
                                disabled={creatingCustomer}
                                className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer disabled:opacity-50 min-h-[44px]"
                            >
                                <Plus size={15} />
                                {creatingCustomer ? (locale === 'en' ? 'Creating...' : 'Đang tạo...') : (locale === 'en' ? 'Create Prospect' : 'Tạo Khách Tiềm Năng')}
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
                    title={locale === 'en' ? 'Field Check-in & GPS Capture' : 'Chụp Ảnh Check-in & Toạ Độ GPS'}
                    subtitle={locale === 'en' ? 'Capture real-time photo of storefront or wine display shelf' : 'Chụp ảnh thực tế mặt tiền hoặc quầy trưng bày rượu tại khách hàng'}
                    customerName={cameraTarget.customerName}
                    salespersonName={currentUserName}
                    locationInfo={coords.address}
                    onCapture={handleConfirmCheckInPhoto}
                    onClose={() => setCameraTarget(null)}
                    onOpenGpsGuide={() => setShowGpsGuideModal(true)}
                    gpsError={gpsError}
                    locale={locale}
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
                locale={locale}
            />

            {/* ============================================================== */}
            {/* PHOTO VIEWER MODAL (WITH ON-DEMAND FULL HD RESOLUTION) */}
            {/* ============================================================== */}
            <PhotoViewerModal
                viewPhoto={viewPhoto}
                onClose={() => setViewPhoto(null)}
                loadingFullPhoto={loadingFullPhoto}
                locale={locale}
            />

            {/* ============================================================== */}
            {/* QUICK REPORT MODAL (SALES REP FIELD VISIT REPORT) */}
            {/* ============================================================== */}
            <QuickReportModal
                isOpen={!!quickReportTarget}
                visit={quickReportTarget}
                onClose={() => setQuickReportTarget(null)}
                onSave={handleSaveQuickReport}
                locale={locale}
                readOnly={isQuickReportReadOnly}
            />

            {/* ============================================================== */}
            {/* MOBILE FIXED BOTTOM NAVIGATION BAR (TOUCH-OPTIMIZED APP SHELL) */}
            {/* ============================================================== */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-50/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-200 px-1.5 py-1.5 flex items-center justify-around md:hidden shadow-2xl safe-area-pb">
                <button
                    type="button"
                    onClick={() => setActiveTab('CHECKIN')}
                    className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative min-h-[46px] ${
                        activeTab === 'CHECKIN'
                            ? 'text-teal-600 dark:text-[#0891B2] font-bold'
                            : 'text-slate-500 dark:text-slate-600 hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'CHECKIN' ? 'bg-teal-500/15 ring-1 ring-teal-500/30' : ''}`}>
                        <MapPin size={18} />
                    </div>
                    <span className="text-[10px] mt-0.5 tracking-tight">{locale === 'en' ? 'Today' : 'Hôm nay'}</span>
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
                            ? 'text-teal-600 dark:text-[#0891B2] font-bold'
                            : 'text-slate-500 dark:text-slate-600 hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'PLANNING' ? 'bg-teal-500/15 ring-1 ring-teal-500/30' : ''}`}>
                        <Calendar size={18} />
                    </div>
                    <span className="text-[10px] mt-0.5 tracking-tight">{locale === 'en' ? 'Plan' : 'Lịch tuần'}</span>
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
                            ? 'text-teal-600 dark:text-[#0891B2] font-bold'
                            : 'text-slate-500 dark:text-slate-600 hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'REVIEW' ? 'bg-teal-500/15 ring-1 ring-teal-500/30' : ''}`}>
                        <TrendingUp size={18} />
                    </div>
                    <span className="text-[10px] mt-0.5 tracking-tight">{locale === 'en' ? 'Summary' : 'Tổng kết'}</span>
                    {weeklyPlan?.status === 'SUBMITTED' && (
                        <span className="absolute top-1 right-3 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0E1A24]" />
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('HISTORY')}
                    className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer relative min-h-[46px] ${
                        activeTab === 'HISTORY'
                            ? 'text-teal-600 dark:text-[#0891B2] font-bold'
                            : 'text-slate-500 dark:text-slate-600 hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'HISTORY' ? 'bg-teal-500/15 ring-1 ring-teal-500/30' : ''}`}>
                        <Camera size={18} />
                    </div>
                    <span className="text-[10px] mt-0.5 tracking-tight">{locale === 'en' ? 'Photos' : 'Hình ảnh'}</span>
                </button>
            </div>
        </div>
    )
}
