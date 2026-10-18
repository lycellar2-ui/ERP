'use client'

import React, { useState, useEffect } from 'react'
import {
    Table, Smartphone, Plus, Search, MapPin, CheckCircle2,
    Save, RefreshCw, X, AlertCircle, FileSpreadsheet, Filter,
    UserCheck, Users, Activity, ChevronDown, ChevronUp, Clock, AlertTriangle, ShieldCheck, Zap, Printer
} from 'lucide-react'
import { recordCountLine, completeZoneCount, getStockCountDetail, startStockCount } from './actions'
import { toast } from 'sonner'
import { AddUnlistedModal } from './AddUnlistedModal'
import { useAppLocale } from '@/lib/i18n'
import { getStockCountDict } from './i18n'

type Props = {
    sessionId: string
    onClose: () => void
    onOpenMobileView: (sessionId: string) => void
    onOpenAssignModal?: (sessionId: string) => void
    onOpenPrintView?: (sessionId: string) => void
    onRefreshSession?: () => void
}

export function StockCountTableModal({ sessionId, onClose, onOpenMobileView, onOpenAssignModal, onOpenPrintView, onRefreshSession }: Props) {
    const { locale } = useAppLocale()
    const t = getStockCountDict(locale)
    const [detail, setDetail] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Filter states for Lead
    const [selectedZone, setSelectedZone] = useState<string>('ALL')
    const [selectedStaff, setSelectedStaff] = useState<string>('ALL')
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNCOUNTED' | 'MATCHED' | 'VARIANCE'>('ALL')
    const [searchTerm, setSearchTerm] = useState('')

    // Live Sync & Widget states
    const [isLiveSync, setIsLiveSync] = useState(true)
    const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date())
    const [showLeaderboard, setShowLeaderboard] = useState(true)

    const [savingLineId, setSavingLineId] = useState<string | null>(null)
    const [showAddUnlistedModal, setShowAddUnlistedModal] = useState(false)

    // Zone report modal state
    const [showZoneReportModal, setShowZoneReportModal] = useState(false)
    const [zoneReport, setZoneReport] = useState<any>(null)
    const [isCompletingZone, setIsCompletingZone] = useState(false)

    const loadDetail = async (showSpinner = true) => {
        if (showSpinner) setIsLoading(true)
        const d = await getStockCountDetail(sessionId)
        setDetail(d)
        setLastSyncTime(new Date())
        if (showSpinner) setIsLoading(false)
    }

    useEffect(() => {
        loadDetail()
    }, [sessionId])

    // Live Auto Polling Effect (every 5 seconds for Lead Dashboard)
    useEffect(() => {
        if (!isLiveSync) return
        const interval = setInterval(async () => {
            const d = await getStockCountDetail(sessionId)
            if (d) {
                setDetail(d)
                setLastSyncTime(new Date())
            }
        }, 5000)
        return () => clearInterval(interval)
    }, [sessionId, isLiveSync])

    const handleStartSession = async () => {
        setIsLoading(true)
        const res = await startStockCount(sessionId)
        if (res.success) {
            await loadDetail()
            if (onRefreshSession) onRefreshSession()
        } else {
            toast.error(res.error || 'Error starting stock count')
            setIsLoading(false)
        }
    }

    if (isLoading || !detail) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white p-6 rounded-lg flex items-center gap-3 text-slate-700 font-bold shadow-2xl animate-modal-in">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                    {t.tableModal.loading}
                </div>
            </div>
        )
    }

    // Extract unique zones
    const zones: string[] = Array.from(new Set(detail.lines.map((l: any) => (l.zone || l.locationCode || 'Khu vực chung') as string)))

    // Extract unique assigned staff members
    const staffMembers: Array<{ id: string; name: string }> = Array.from(
        new Set(
            detail.lines
                .filter((l: any) => l.assignedToId && l.assignedToName)
                .map((l: any) => JSON.stringify({ id: l.assignedToId, name: l.assignedToName }))
        )
    ).map((str: any) => JSON.parse(str))

    // Staff Leaderboard Stats for Lead Overview
    const staffProgressStats = staffMembers.map(st => {
        const stLines = detail.lines.filter((l: any) => l.assignedToId === st.id)
        const total = stLines.length
        const counted = stLines.filter((l: any) => l.qtyActual !== null).length
        const matched = stLines.filter((l: any) => l.qtyActual !== null && l.variance === 0).length
        const varianceCount = stLines.filter((l: any) => l.qtyActual !== null && l.variance !== 0).length
        const percent = total > 0 ? Math.round((counted / total) * 100) : 0
        return { ...st, total, counted, matched, varianceCount, percent }
    })

    // Overall session stats
    const totalLinesCount = detail.lines.length
    const countedLinesCount = detail.lines.filter((l: any) => l.qtyActual !== null).length
    const matchedLinesCount = detail.lines.filter((l: any) => l.qtyActual !== null && l.variance === 0).length
    const varianceLinesCount = detail.lines.filter((l: any) => l.qtyActual !== null && l.variance !== 0).length
    const overallProgressPercent = totalLinesCount > 0 ? Math.round((countedLinesCount / totalLinesCount) * 100) : 0

    // Filter lines by selected zone, staff, status & search term
    const filteredLines = detail.lines.filter((l: any) => {
        const matchZone = selectedZone === 'ALL' || (l.zone || l.locationCode || 'Khu vực chung') === selectedZone
        const matchStaff = selectedStaff === 'ALL' || l.assignedToId === selectedStaff
        const matchStatus = statusFilter === 'ALL' ? true :
            statusFilter === 'UNCOUNTED' ? l.qtyActual === null :
            statusFilter === 'MATCHED' ? (l.qtyActual !== null && l.variance === 0) :
            (l.qtyActual !== null && l.variance !== 0)

        const s = searchTerm.trim().toLowerCase()
        const matchSearch = !s ||
            l.skuCode.toLowerCase().includes(s) ||
            l.productName.toLowerCase().includes(s) ||
            (l.locationCode && l.locationCode.toLowerCase().includes(s)) ||
            (l.assignedToName && l.assignedToName.toLowerCase().includes(s))
        return matchZone && matchStaff && matchStatus && matchSearch
    })

    // Inline qty update handler
    const handleQtyChange = async (lineId: string, newQty: number) => {
        setSavingLineId(lineId)
        const validQty = Math.max(0, newQty)

        // Optimistic UI update
        setDetail((prev: any) => {
            if (!prev) return prev
            const nextLines = prev.lines.map((l: any) => {
                if (l.id === lineId) {
                    const variance = validQty - l.qtySystem
                    return { ...l, qtyActual: validQty, variance, countedAt: new Date().toISOString() }
                }
                return l
            })
            return { ...prev, lines: nextLines }
        })

        await recordCountLine(lineId, validQty)
        setSavingLineId(null)
        if (onRefreshSession) onRefreshSession()
    }

    // Handle Finish Zone
    const handleFinishZone = async () => {
        if (selectedZone === 'ALL') {
            toast.warning(t.tableModal.finishZoneWarn)
            return
        }
        setIsCompletingZone(true)
        const res = await completeZoneCount(detail.id, selectedZone)
        setIsCompletingZone(false)
        if (res.success && res.summary) {
            setZoneReport(res.summary)
            setShowZoneReportModal(true)
        } else {
            toast.error(res.error || 'Error completing zone count')
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-lg w-full max-w-[96vw] h-[94vh] flex flex-col text-slate-900 shadow-2xl overflow-hidden animate-modal-in">
                {/* MODAL HEADER FOR LEAD COMMAND CENTER */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#0E7490] text-white flex items-center justify-center font-black shrink-0 shadow-2xs">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="inline-block font-mono text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-md whitespace-nowrap shrink-0">
                                    {detail.sessionNo}
                                </span>
                                <span className="text-xs font-bold text-slate-700">
                                    {detail.warehouseName}
                                </span>

                                {/* LIVE SYNC BADGE */}
                                <button
                                    onClick={() => setIsLiveSync(!isLiveSync)}
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                                        isLiveSync ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'
                                    }`}
                                    title={t.tableModal.liveSyncTitle}
                                >
                                    <span className={`w-2 h-2 rounded-full ${isLiveSync ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                                    {isLiveSync ? t.tableModal.liveSyncOn : t.tableModal.liveSyncOff}
                                </button>
                            </div>
                            <h2 className="text-base font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                                {detail.title}
                                <span className="text-xs font-normal text-slate-500">
                                    ({t.tableModal.updatedAt} {lastSyncTime.toLocaleTimeString(locale === 'en' ? 'en-US' : 'vi-VN')})
                                </span>
                            </h2>
                        </div>
                    </div>

                    {/* Mode & Action Controls */}
                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                        {detail.status === 'DRAFT' && (
                            <button
                                onClick={handleStartSession}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer active:scale-95 whitespace-nowrap"
                            >
                                <Zap className="w-4 h-4" /> {t.tableModal.startBtn}
                            </button>
                        )}

                        <button
                            onClick={() => loadDetail(false)}
                            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
                        >
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" /> {t.common.refresh}
                        </button>

                        <button
                            onClick={() => {
                                onClose()
                                onOpenMobileView(sessionId)
                            }}
                            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                        >
                            <Smartphone className="w-4 h-4" /> {t.tableModal.mobileViewBtn}
                        </button>

                        {onOpenAssignModal && (
                            <button
                                onClick={() => {
                                    onClose()
                                    onOpenAssignModal(sessionId)
                                }}
                                className="px-3 py-2 bg-cyan-50 hover:bg-cyan-100 active:scale-95 text-cyan-800 border border-cyan-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                                title={t.tableModal.assignTitle}
                            >
                                <UserCheck className="w-3.5 h-3.5 text-cyan-700" /> {t.tableModal.assignBtn}
                            </button>
                        )}

                        {onOpenPrintView && (
                            <button
                                onClick={() => {
                                    onClose()
                                    onOpenPrintView(sessionId)
                                }}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                                title={t.tableModal.printTitle}
                            >
                                <Printer className="w-3.5 h-3.5 text-slate-600" /> {t.tableModal.printBtn}
                            </button>
                        )}

                        <button
                            onClick={() => setShowAddUnlistedModal(true)}
                            className="px-3.5 py-2 bg-[#0E7490] hover:bg-[#0E7490] active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" /> {t.tableModal.addUnlistedBtn}
                        </button>

                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 active:scale-90 transition-all rounded-lg cursor-pointer">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {detail.status === 'DRAFT' && (
                    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-900 font-extrabold shrink-0">
                        <span className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            {t.tableModal.draftBanner}
                        </span>
                        <button
                            onClick={handleStartSession}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shrink-0 cursor-pointer"
                        >
                            {t.tableModal.startBtn}
                        </button>
                    </div>
                )}

                {/* LEAD MONITORING DASHBOARD WIDGET */}
                <div className="bg-slate-100 border-b border-slate-200 p-3 sm:p-4 space-y-3 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-4 text-xs font-extrabold text-slate-800">
                            <button
                                onClick={() => setShowLeaderboard(!showLeaderboard)}
                                className="flex items-center gap-1 text-slate-900 hover:text-emerald-700 cursor-pointer"
                            >
                                <Users className="w-4 h-4 text-emerald-600" />
                                <span>{t.tableModal.leaderboardTitle}</span>
                                {showLeaderboard ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            <span className="text-slate-500">|</span>
                            <span>{t.tableModal.countedStat} <strong className="text-emerald-800 font-mono">{countedLinesCount}/{totalLinesCount} {t.common.skus} ({overallProgressPercent}%)</strong></span>
                            <span>{t.tableModal.matchedStat} <strong className="text-emerald-700 font-mono">{matchedLinesCount} {t.common.skus}</strong></span>
                            <span>{t.tableModal.varianceStat} <strong className="text-amber-800 font-mono">{varianceLinesCount} {t.common.skus}</strong></span>
                        </div>

                        {/* Overall Progress Bar */}
                        <div className="w-48 bg-white h-3 rounded-full overflow-hidden border border-slate-300 hidden sm:block p-0.5">
                            <div className="bg-[#0E7490] h-full rounded-full transition-all duration-300" style={{ width: `${overallProgressPercent}%` }} />
                        </div>
                    </div>

                    {/* COLLAPSIBLE STAFF LEADERBOARD WIDGET */}
                    {showLeaderboard && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                            {staffProgressStats.length === 0 ? (
                                <div className="col-span-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                                    {t.tableModal.noStaffAssigned}
                                </div>
                            ) : (
                                staffProgressStats.map(st => (
                                    <div
                                        key={st.id}
                                        onClick={() => setSelectedStaff(selectedStaff === st.id ? 'ALL' : st.id)}
                                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                                            selectedStaff === st.id ? 'bg-amber-50 border-amber-400 shadow-2xs' : 'bg-white border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center font-bold">
                                            <span className="text-slate-900 truncate flex items-center gap-1">
                                                <UserCheck className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                                                {st.name}
                                            </span>
                                            <span className="font-mono text-emerald-800 font-extrabold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                                {st.percent}%
                                            </span>
                                        </div>

                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden my-1.5 border border-slate-200">
                                            <div className="bg-[#0E7490] h-full rounded-full" style={{ width: `${st.percent}%` }} />
                                        </div>

                                        <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                                            <span>{t.tableModal.countedStat} <strong className="text-slate-900 font-mono">{st.counted}/{st.total}</strong></span>
                                            {st.varianceCount > 0 && (
                                                <span className="text-amber-700 font-bold bg-amber-50 px-1 rounded border border-amber-200">
                                                    {st.varianceCount} {t.tableModal.varianceSuffix}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* DUAL FILTER TOOLBAR FOR LEAD: LOCATION + STAFF + STATUS + SEARCH */}
                <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        {/* Filter 1: Zone/Location */}
                        <select
                            value={selectedZone}
                            onChange={e => setSelectedZone(e.target.value)}
                            className="bg-slate-50 border border-slate-300 text-slate-900 text-base sm:text-xs rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0E7490] cursor-pointer"
                        >
                            <option value="ALL">{t.tableModal.allZonesOption} ({zones.length} {t.tableModal.zonesUnit})</option>
                            {zones.map((z: string) => {
                                const countInZone = detail.lines.filter((l: any) => (l.zone || l.locationCode || 'Khu vực chung') === z).length
                                return (
                                    <option key={z} value={z}>
                                        {z} ({countInZone} {t.common.skus})
                                    </option>
                                )
                            })}
                        </select>

                        {/* Filter 2: Staff Member */}
                        <select
                            value={selectedStaff}
                            onChange={e => setSelectedStaff(e.target.value)}
                            className="bg-slate-50 border border-slate-300 text-slate-900 text-base sm:text-xs rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0E7490] cursor-pointer"
                        >
                            <option value="ALL">{t.tableModal.allStaffOption}</option>
                            {staffMembers.map(st => (
                                <option key={st.id} value={st.id}>
                                    {st.name}
                                </option>
                            ))}
                        </select>

                        {/* Filter 3: Status */}
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as any)}
                            className="bg-slate-50 border border-slate-300 text-slate-900 text-base sm:text-xs rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0E7490] cursor-pointer"
                        >
                            <option value="ALL">{t.tableModal.allStatusOption}</option>
                            <option value="UNCOUNTED">{t.tableModal.statusUncounted}</option>
                            <option value="MATCHED">{t.tableModal.statusMatched}</option>
                            <option value="VARIANCE">{t.tableModal.statusVariance}</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                placeholder={t.tableModal.searchPlaceholder}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 text-slate-900 font-bold rounded-lg pl-9 pr-3 py-2 text-base sm:text-xs outline-none focus:border-[#0E7490]"
                            />
                        </div>

                        {selectedZone !== 'ALL' && (
                            <button
                                onClick={handleFinishZone}
                                disabled={isCompletingZone}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-lg shadow-xs flex items-center gap-1 shrink-0 cursor-pointer transition-all"
                            >
                                {isCompletingZone ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                {t.tableModal.finishZoneBtn}
                            </button>
                        )}
                    </div>
                </div>

                {/* EDITABLE SPREADSHEET TABLE GRID FOR LEAD */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50/50">
                    <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                    <th className="p-3 text-center">{t.tableModal.colNo}</th>
                                    <th className="p-3">{t.tableModal.colLocation}</th>
                                    <th className="p-3">{t.tableModal.colProduct}</th>
                                    <th className="p-3">{t.tableModal.colStaffTime}</th>
                                    <th className="p-3 text-center">{t.tableModal.colSystemQty}</th>
                                    <th className="p-3 text-center w-48">{t.tableModal.colActualQty}</th>
                                    <th className="p-3 text-center">{t.tableModal.colVariance}</th>
                                    <th className="p-3">{t.tableModal.colNotes}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {filteredLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400">
                                            {t.tableModal.emptyFiltered}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLines.map((line: any, idx: number) => {
                                        const upc = line.product?.unitsPerCase || 6
                                        const actual = line.qtyActual !== null ? line.qtyActual : ''
                                        const systemQty = line.qtySystem
                                        const variance = line.variance
                                        const countTimeStr = line.countedAt ? new Date(line.countedAt).toLocaleTimeString(locale === 'en' ? 'en-US' : 'vi-VN') : null

                                        return (
                                            <tr key={line.id} className="hover:bg-amber-50/50 transition">
                                                <td className="p-3 text-center font-mono font-bold text-slate-500 text-[11px]">
                                                    {idx + 1}
                                                </td>

                                                <td className="p-3">
                                                    <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                                        {line.zone || line.locationCode || t.common.generalZone}
                                                    </span>
                                                </td>

                                                <td className="p-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="inline-block font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] whitespace-nowrap shrink-0">
                                                            {line.skuCode}
                                                        </span>
                                                        <span className="inline-block text-[10px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                                                            NV: {line.vintage ?? 'NV'}
                                                        </span>
                                                    </div>
                                                    <div className="font-bold text-slate-900 mt-1">{line.productName}</div>
                                                </td>

                                                {/* Staff Assignee & Timestamp Column */}
                                                <td className="p-3">
                                                    {line.assignedToName ? (
                                                        <span className="text-xs font-bold text-cyan-800 flex items-center gap-1">
                                                            <UserCheck className="w-3.5 h-3.5 text-cyan-600" />
                                                            {line.assignedToName}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[11px]">{t.common.unassigned}</span>
                                                    )}
                                                    {countTimeStr && (
                                                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                                                            <Clock className="w-3 h-3 text-slate-400" /> {countTimeStr}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="p-3 text-center font-mono font-bold text-slate-700">
                                                    {systemQty} {t.common.bottles}
                                                    <span className="block text-[10px] text-slate-400 font-semibold">
                                                        ({Math.floor(systemQty / upc)} {t.common.cases} + {systemQty % upc} {t.common.loose})
                                                    </span>
                                                </td>

                                                {/* Interactive Input Cell */}
                                                <td className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-300">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQtyChange(line.id, (line.qtyActual || 0) - 1)}
                                                            className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-sm flex items-center justify-center cursor-pointer active:scale-90 transition-transform select-none touch-manipulation shadow-2xs"
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={actual}
                                                            placeholder="0"
                                                            onChange={e => {
                                                                const val = parseInt(e.target.value, 10)
                                                                handleQtyChange(line.id, isNaN(val) ? 0 : val)
                                                            }}
                                                            className="w-20 text-center font-mono font-bold text-base sm:text-sm text-[#0E7490] bg-white border border-slate-300 rounded-lg p-1 outline-none focus:border-[#0E7490]"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQtyChange(line.id, (line.qtyActual || 0) + 1)}
                                                            className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-sm flex items-center justify-center cursor-pointer active:scale-90 transition-transform select-none touch-manipulation shadow-2xs"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    {savingLineId === line.id && (
                                                        <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">{t.tableModal.savedLabel}</span>
                                                    )}
                                                </td>

                                                <td className="p-3 text-center font-mono font-bold">
                                                    {line.qtyActual === null ? (
                                                        <span className="text-slate-400 text-[11px] italic">{t.tableModal.statusUncounted}</span>
                                                    ) : variance === 0 ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                                            {t.tableModal.matchedBadge}
                                                        </span>
                                                    ) : variance > 0 ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap">
                                                            {t.tableModal.overPrefix} +{variance}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                                                            {t.tableModal.underPrefix} {variance}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="p-3 text-xs text-slate-500">
                                                    {line.notes || <span className="italic text-slate-400">{t.common.noNotes}</span>}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FOOTER STATS SUMMARY BAR */}
                <div className="p-3 sm:p-4 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-slate-700 shrink-0">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-4">
                        <span>{t.tableModal.showingPrefix} <strong className="text-slate-900 font-mono">{filteredLines.length}/{totalLinesCount} {t.common.lines}</strong></span>
                        <span>{t.tableModal.countedStat} <strong className="text-emerald-700 font-mono">{countedLinesCount}</strong></span>
                        <span>{t.tableModal.matchedStat} <strong className="text-emerald-800 font-mono">{matchedLinesCount}</strong></span>
                        <span>{t.tableModal.varianceStat} <strong className="text-amber-800 font-mono">{varianceLinesCount}</strong></span>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-5 py-2 bg-[#0E7490] hover:bg-[#0E7490] active:scale-95 text-white font-black text-xs rounded-lg shadow-xs cursor-pointer transition-all"
                    >
                        {t.tableModal.doneCloseBtn}
                    </button>
                </div>
            </div>

            {/* MODAL CHÈN MÃ / VINTAGE NGOÀI DANH SÁCH */}
            {showAddUnlistedModal && (
                <AddUnlistedModal
                    sessionId={detail.id}
                    sessionNo={detail.sessionNo}
                    warehouseId={detail.warehouseId}
                    defaultZone={selectedZone !== 'ALL' ? selectedZone : undefined}
                    zones={zones}
                    onClose={() => setShowAddUnlistedModal(false)}
                    onSuccess={() => {
                        loadDetail(false)
                        if (onRefreshSession) onRefreshSession()
                    }}
                />
            )}

            {/* ZONE VARIANCE SUMMARY MODAL */}
            {showZoneReportModal && zoneReport && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 text-slate-900 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-modal-in">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                            <div>
                                <span className="inline-block text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap shrink-0">
                                    {t.tableModal.zoneReportBadge}
                                </span>
                                <h3 className="text-base font-bold text-slate-900 mt-1">{zoneReport.zoneName}</h3>
                            </div>
                            <button onClick={() => setShowZoneReportModal(false)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 active:scale-90 transition-all cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                                <span className="text-[10px] font-bold uppercase text-emerald-700 block">{t.tableModal.statusMatched}</span>
                                <strong className="text-xl font-bold text-emerald-800">{zoneReport.matchedCount} {t.common.skus}</strong>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                                <span className="text-[10px] font-bold uppercase text-amber-700 block">{t.tableModal.overPrefix}</span>
                                <strong className="text-xl font-bold text-amber-800">{zoneReport.overCount} {t.common.skus}</strong>
                            </div>
                            <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
                                <span className="text-[10px] font-bold uppercase text-rose-700 block">{t.tableModal.underPrefix}</span>
                                <strong className="text-xl font-bold text-rose-800">{zoneReport.underCount} {t.common.skus}</strong>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t.tableModal.varianceListTitle}</h4>
                            {zoneReport.varianceLines.length === 0 ? (
                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-xs text-emerald-800 font-bold">
                                    {t.tableModal.allMatchedMsg}
                                </div>
                            ) : (
                                zoneReport.varianceLines.map((v: any) => (
                                    <div key={v.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                                        <div>
                                            <div className="font-mono font-extrabold text-amber-900">{v.skuCode}</div>
                                            <div className="font-bold text-slate-900">{v.productName}</div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold ${v.variance > 0 ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900'}`}>
                                            {v.variance > 0 ? `+${v.variance}` : v.variance} {t.common.bottles}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-3 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setShowZoneReportModal(false)}
                                className="px-5 py-2 bg-[#0E7490] text-white font-extrabold text-xs rounded-lg shadow-xs"
                            >
                                {t.tableModal.understandCloseBtn}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
