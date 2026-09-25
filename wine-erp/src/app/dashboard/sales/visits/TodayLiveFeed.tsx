'use client'

import React, { useState, useMemo } from 'react'
import {
    FileText, User, Clock, MapPin, Eye, Camera,
    Search, Filter, CheckCircle2, AlertCircle, Sparkles, Navigation
} from 'lucide-react'
import { type VisitLocale } from './i18n'

export interface TodayFeedItem {
    id: string
    visitNo?: string
    customerId?: string
    customerName: string
    customerCode?: string
    customerChannel?: string | null
    salespersonId?: string
    salespersonName: string
    salespersonEmail?: string
    checkInTime: string
    checkInAddress?: string | null
    checkInLat?: number | null
    checkInLng?: number | null
    checkInPhoto?: string | null
    purpose?: string | null
    notes?: string | null
    isUnplanned?: boolean
    status?: string
}

interface TodayLiveFeedProps {
    visits: TodayFeedItem[]
    repsList: { id: string; name: string }[]
    onViewPhoto: (title: string, url: string, visitId: string) => void
    locale?: VisitLocale
    onOpenEditReport?: (visit: TodayFeedItem) => void
}

export function TodayLiveFeed({
    visits,
    repsList,
    onViewPhoto,
    locale = 'vi',
    onOpenEditReport,
}: TodayLiveFeedProps) {
    const [selectedRepId, setSelectedRepId] = useState<string>('ALL')
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'WITH_NOTES' | 'WITHOUT_NOTES'>('ALL')
    const [searchQuery, setSearchQuery] = useState('')

    // Statistics
    const totalVisits = visits.length
    const withNotesCount = useMemo(() => visits.filter(v => !!v.notes?.trim()).length, [visits])
    const withoutNotesCount = totalVisits - withNotesCount

    // Filtered Visits
    const filteredVisits = useMemo(() => {
        return visits.filter(v => {
            // Filter by Rep
            if (selectedRepId !== 'ALL' && v.salespersonId !== selectedRepId) {
                return false
            }

            // Filter by Notes presence
            if (filterStatus === 'WITH_NOTES' && !v.notes?.trim()) {
                return false
            }
            if (filterStatus === 'WITHOUT_NOTES' && !!v.notes?.trim()) {
                return false
            }

            // Search by Customer, Code or Notes
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase()
                const nameMatch = v.customerName?.toLowerCase().includes(q)
                const codeMatch = v.customerCode?.toLowerCase().includes(q)
                const repMatch = v.salespersonName?.toLowerCase().includes(q)
                const notesMatch = v.notes?.toLowerCase().includes(q)
                if (!nameMatch && !codeMatch && !repMatch && !notesMatch) {
                    return false
                }
            }

            return true
        })
    }, [visits, selectedRepId, filterStatus, searchQuery])

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-4 sm:p-5">
            {/* 1. Header with Live Pulse */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono border border-emerald-200">
                            {locale === 'en' ? 'LIVE FIELD FEED' : 'BẢNG TIN THỰC ĐỊA HÔM NAY'}
                        </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                        {locale === 'en' ? "Today's Quick Store Reports & Field Updates" : 'Báo Cáo Nhanh Điểm Bán Trong Ngày'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {locale === 'en'
                            ? 'Real-time feed of sales rep notes, customer feedback and store visit results'
                            : 'Theo dõi trực tiếp ghi chú trao đổi, nhu cầu khách hàng và hình ảnh điểm bán từ đội ngũ Sale'}
                    </p>
                </div>

                {/* Counter Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <span className="text-slate-500 mr-1">{locale === 'en' ? 'Check-ins:' : 'Lượt đi:'}</span>
                        <strong className="font-mono text-slate-900">{totalVisits}</strong>
                    </div>

                    <div className="px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200/80 text-xs text-teal-800">
                        <span className="text-teal-600 mr-1">{locale === 'en' ? 'Reported:' : 'Đã báo cáo:'}</span>
                        <strong className="font-mono text-teal-900">{withNotesCount}</strong>
                    </div>

                    {withoutNotesCount > 0 && (
                        <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-xs text-amber-800">
                            <span className="text-amber-600 mr-1">{locale === 'en' ? 'Pending:' : 'Chưa báo cáo:'}</span>
                            <strong className="font-mono text-amber-900">{withoutNotesCount}</strong>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Filter & Search Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                    {/* Rep filter dropdown */}
                    <div className="relative min-w-[160px]">
                        <select
                            value={selectedRepId}
                            onChange={e => setSelectedRepId(e.target.value)}
                            className="w-full pl-3 pr-8 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-teal-500 cursor-pointer"
                        >
                            <option value="ALL">👥 {locale === 'en' ? 'All Sales Reps' : 'Tất cả nhân sự'}</option>
                            {repsList.map(r => (
                                <option key={r.id} value={r.id}>
                                    👤 {r.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filter pills: All / With notes / Without notes */}
                    <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => setFilterStatus('ALL')}
                            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                filterStatus === 'ALL'
                                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {locale === 'en' ? 'All' : 'Tất cả'} ({totalVisits})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('WITH_NOTES')}
                            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                filterStatus === 'WITH_NOTES'
                                    ? 'bg-white text-teal-800 font-bold shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            💬 {locale === 'en' ? 'With notes' : 'Có báo cáo'} ({withNotesCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('WITHOUT_NOTES')}
                            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                filterStatus === 'WITHOUT_NOTES'
                                    ? 'bg-white text-amber-800 font-bold shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            ⏳ {locale === 'en' ? 'Pending' : 'Chưa ghi'} ({withoutNotesCount})
                        </button>
                    </div>
                </div>

                {/* Search Box */}
                <div className="relative w-full sm:w-64">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={locale === 'en' ? 'Search client or note content...' : 'Tìm khách hoặc nội dung báo cáo...'}
                        className="w-full pl-8 pr-3 py-1.5 text-xs outline-none rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white transition"
                    />
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
            </div>

            {/* 3. Cards Grid Feed */}
            {totalVisits === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <FileText size={32} className="mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700">
                        {locale === 'en' ? 'No field visits recorded today.' : 'Hôm nay chưa có lượt check-in nào từ đội ngũ Sale.'}
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        {locale === 'en'
                            ? 'When sales reps check in at stores and submit quick reports, their live activity will stream here in chronological order.'
                            : 'Khi nhân viên Sale đến điểm bán check-in và ghi chú kết quả, thông tin sẽ tự động hiển thị trực tiếp tại đây theo dòng thời gian.'}
                    </p>
                </div>
            ) : filteredVisits.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    <p className="font-semibold text-slate-600">
                        {locale === 'en' ? 'No visits match your filter criteria.' : 'Không có lượt viếng thăm nào khớp với bộ lọc.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    {filteredVisits.map(v => {
                        const timeStr = new Date(v.checkInTime).toLocaleTimeString(locale === 'en' ? 'en-US' : 'vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })

                        return (
                            <div
                                key={v.id}
                                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 shadow-2xs ${
                                    v.notes?.trim()
                                        ? 'bg-white border-slate-200 hover:border-teal-400'
                                        : 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300'
                                }`}
                            >
                                <div className="space-y-2.5">
                                    {/* Card Top: Rep Name, Time, Plan/Ad-hoc */}
                                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <div className="p-1 rounded-lg bg-teal-50 text-teal-700 shrink-0">
                                                <User size={13} />
                                            </div>
                                            <span className="font-bold text-xs text-slate-900 truncate">
                                                {v.salespersonName}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {v.isUnplanned ? (
                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                                                    {locale === 'en' ? '⚡ AD-HOC' : '⚡ ĐỘT XUẤT'}
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                                                    {locale === 'en' ? '📋 PLANNED' : '📋 KẾ HOẠCH'}
                                                </span>
                                            )}
                                            <span className="font-mono text-xs font-bold text-teal-700 flex items-center gap-0.5">
                                                <Clock size={11} /> {timeStr}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Customer Name, Code & Channel */}
                                    <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {v.customerCode && (
                                                <span className="font-mono text-[11px] font-bold text-teal-700">
                                                    [{v.customerCode}]
                                                </span>
                                            )}
                                            {v.customerChannel && (
                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                                                    {v.customerChannel}
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-1" title={v.customerName}>
                                            {v.customerName}
                                        </h4>
                                    </div>

                                    {/* Store Photo & Address */}
                                    <div className="flex items-center gap-2.5">
                                        {v.checkInPhoto ? (
                                            <div
                                                onClick={() => onViewPhoto(
                                                    `${locale === 'en' ? 'Check-in Photo:' : 'Ảnh Check-in:'} ${v.customerName} (${v.salespersonName})`,
                                                    v.checkInPhoto!,
                                                    v.id
                                                )}
                                                className="relative w-20 h-14 rounded-xl overflow-hidden bg-slate-900 shrink-0 cursor-pointer group shadow-2xs border border-slate-200"
                                            >
                                                <img
                                                    src={v.checkInPhoto}
                                                    alt="Photo"
                                                    className="w-full h-full object-cover group-hover:scale-105 transition"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                                                    <Eye size={14} />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-20 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                                <Camera size={16} />
                                            </div>
                                        )}

                                        <div className="min-w-0 flex-1 text-xs">
                                            {v.checkInAddress ? (
                                                <div className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                                                    <MapPin size={11} className="inline text-teal-600 mr-1" />
                                                    {v.checkInAddress}
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-slate-400 italic">
                                                    {locale === 'en' ? 'GPS address recording...' : 'Đang cập nhật địa chỉ GPS...'}
                                                </span>
                                            )}

                                            {v.checkInLat && v.checkInLng && (
                                                <a
                                                    href={`https://www.google.com/maps?q=${v.checkInLat},${v.checkInLng}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-[10px] text-teal-700 hover:underline font-bold mt-1"
                                                >
                                                    <Navigation size={10} /> {locale === 'en' ? 'Open in Google Maps' : 'Xem Google Maps'}
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* 4. Highlighted Quick Report Content */}
                                    {v.notes?.trim() ? (
                                        <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/80 text-xs space-y-1">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-teal-900 uppercase">
                                                <span className="flex items-center gap-1">
                                                    <FileText size={12} className="text-teal-600" />
                                                    {locale === 'en' ? 'Quick Field Report:' : 'Báo Cáo Nhanh Thực Địa:'}
                                                </span>
                                                {onOpenEditReport && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenEditReport(v)}
                                                        className="text-teal-700 hover:underline cursor-pointer lowercase"
                                                    >
                                                        {locale === 'en' ? 'edit' : 'sửa'}
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-slate-800 leading-relaxed font-medium whitespace-pre-wrap text-xs">
                                                {v.notes}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="p-2.5 rounded-xl bg-amber-50/50 border border-dashed border-amber-200/80 flex items-center justify-between gap-2 text-xs text-amber-700">
                                            <div className="flex items-center gap-1.5 truncate text-[11px]">
                                                <AlertCircle size={13} className="shrink-0 text-amber-500" />
                                                <span className="truncate">
                                                    {locale === 'en' ? 'No quick report yet (Pending rep update)' : 'Chưa có báo cáo nhanh (Đang chờ Sale ghi kết quả)'}
                                                </span>
                                            </div>
                                            {onOpenEditReport && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenEditReport(v)}
                                                    className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] shrink-0 cursor-pointer"
                                                >
                                                    + {locale === 'en' ? 'Add note' : 'Ghi chú'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
