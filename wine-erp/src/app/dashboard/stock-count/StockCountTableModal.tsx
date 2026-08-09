'use client'

import React, { useState, useEffect } from 'react'
import {
    Table, Smartphone, Plus, Search, MapPin, CheckCircle2,
    Save, RefreshCw, X, AlertCircle, FileSpreadsheet, Filter,
    UserCheck, Users, Activity, ChevronDown, ChevronUp, Clock, AlertTriangle, ShieldCheck, Zap
} from 'lucide-react'
import { recordCountLine, completeZoneCount, getStockCountDetail, startStockCount } from './actions'
import { AddUnlistedModal } from './AddUnlistedModal'

type Props = {
    sessionId: string
    onClose: () => void
    onOpenMobileView: (sessionId: string) => void
    onRefreshSession?: () => void
}

export function StockCountTableModal({ sessionId, onClose, onOpenMobileView, onRefreshSession }: Props) {
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

    const loadDetail = async (showSpinner = true) => {
        if (showSpinner) setIsLoading(true)
        const d = await getStockCountDetail(sessionId)
        setDetail(d)
        setLastSyncTime(new Date())
        if (showSpinner) setIsLoading(false)
    }

    const handleStartSession = async () => {
        setIsLoading(true)
        const res = await startStockCount(sessionId)
        if (res.success) {
            await loadDetail()
            if (onRefreshSession) onRefreshSession()
        } else {
            alert(res.error || 'Lỗi khi bắt đầu kiểm kê')
            setIsLoading(false)
        }
    }

    if (isLoading || !detail) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-2xl flex items-center gap-3 text-slate-700 font-bold shadow-2xl">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                    Đang tải Bảng Theo Dõi Kiểm Kê Real-time...
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
            alert('Vui lòng chọn 1 vị trí/khu vực cụ thể trong dropdown để chốt kiểm kê khu vực đó')
            return
        }
        setIsCompletingZone(true)
        const res = await completeZoneCount(detail.id, selectedZone)
        setIsCompletingZone(false)
        if (res.success && res.summary) {
            setZoneReport(res.summary)
            setShowZoneReportModal(true)
        } else {
            alert(res.error || 'Không thể tạo báo cáo chốt khu vực')
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-7xl h-[94vh] flex flex-col text-slate-900 shadow-2xl overflow-hidden">
                {/* MODAL HEADER FOR LEAD COMMAND CENTER */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#87CBB9] text-[#0A1926] flex items-center justify-center font-black shrink-0 shadow-2xs">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-md">
                                    {detail.sessionNo}
                                </span>
                                <span className="text-xs font-extrabold text-slate-700">
                                    📍 {detail.warehouseName}
                                </span>

                                {/* LIVE SYNC BADGE */}
                                <button
                                    onClick={() => setIsLiveSync(!isLiveSync)}
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 border transition cursor-pointer ${
                                        isLiveSync ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'
                                    }`}
                                    title="Tắt/Bật tự động đồng bộ kết quả nhân viên đang đếm"
                                >
                                    <span className={`w-2 h-2 rounded-full ${isLiveSync ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                                    {isLiveSync ? '🔴 LIVE SYNC (5s)' : '⏸ SYNC TẠM DỪNG'}
                                </button>
                            </div>
                            <h2 className="text-base font-extrabold text-slate-900 mt-0.5 flex items-center gap-2">
                                {detail.title}
                                <span className="text-xs font-normal text-slate-500">
                                    (Cập nhật lúc: {lastSyncTime.toLocaleTimeString('vi-VN')})
                                </span>
                            </h2>
                        </div>
                    </div>

                    {/* Mode & Action Controls */}
                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                        {detail.status === 'DRAFT' && (
                            <button
                                onClick={handleStartSession}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs transition cursor-pointer active:scale-95 whitespace-nowrap animate-bounce"
                            >
                                <Zap className="w-4 h-4" /> ⚡ Bắt Đầu Kiểm Kê Ngay
                            </button>
                        )}

                        <button
                            onClick={() => loadDetail(false)}
                            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-extrabold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
                        >
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" /> Làm mới
                        </button>

                        <button
                            onClick={() => {
                                onClose()
                                onOpenMobileView(sessionId)
                            }}
                            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition cursor-pointer whitespace-nowrap"
                        >
                            <Smartphone className="w-4 h-4" /> 📱 Chuyển Đếm ĐT
                        </button>

                        <button
                            onClick={() => setShowAddUnlistedModal(true)}
                            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition cursor-pointer whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" /> + Chèn Mã Bổ Sung
                        </button>

                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl cursor-pointer">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {detail.status === 'DRAFT' && (
                    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-900 font-extrabold shrink-0">
                        <span className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            PHIẾU ĐANG Ở TRẠNG THÁI NHÁP — Bạn cần bấm "Bắt Đầu Kiểm Kê" để kích hoạt cho phép nhập số lượng!
                        </span>
                        <button
                            onClick={handleStartSession}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-black shrink-0 cursor-pointer"
                        >
                            ⚡ Bắt Đầu Kiểm Kê
                        </button>
                    </div>
                )}

                {/* LEAD MONITORING DASHBOARD WIDGET (BẢNG THEO DÕI NHÂN VIÊN & KỆ) */}
                <div className="bg-slate-100 border-b border-slate-200 p-3 sm:p-4 space-y-3 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs font-extrabold text-slate-800">
                            <button
                                onClick={() => setShowLeaderboard(!showLeaderboard)}
                                className="flex items-center gap-1 text-slate-900 hover:text-emerald-700 cursor-pointer"
                            >
                                <Users className="w-4 h-4 text-emerald-600" />
                                <span>TIẾN ĐỘ ĐẾM NHÂN SỰ & CÁC KHO</span>
                                {showLeaderboard ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            <span className="text-slate-500">|</span>
                            <span>Đã đếm: <strong className="text-emerald-800 font-mono">{countedLinesCount}/{totalLinesCount} mã ({overallProgressPercent}%)</strong></span>
                            <span>Khớp 100%: <strong className="text-emerald-700 font-mono">{matchedLinesCount} mã</strong></span>
                            <span>Chênh lệch: <strong className="text-amber-800 font-mono">{varianceLinesCount} mã</strong></span>
                        </div>

                        {/* Overall Progress Bar */}
                        <div className="w-48 bg-white h-3 rounded-full overflow-hidden border border-slate-300 hidden sm:block p-0.5">
                            <div className="bg-[#87CBB9] h-full rounded-full transition-all duration-300" style={{ width: `${overallProgressPercent}%` }} />
                        </div>
                    </div>

                    {/* COLLAPSIBLE STAFF LEADERBOARD WIDGET */}
                    {showLeaderboard && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                            {staffProgressStats.length === 0 ? (
                                <div className="col-span-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                                    Chưa gán phân công nhân viên cho từng vị trí.
                                </div>
                            ) : (
                                staffProgressStats.map(st => (
                                    <div
                                        key={st.id}
                                        onClick={() => setSelectedStaff(selectedStaff === st.id ? 'ALL' : st.id)}
                                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition ${
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
                                            <div className="bg-[#87CBB9] h-full rounded-full" style={{ width: `${st.percent}%` }} />
                                        </div>

                                        <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                                            <span>Đã đếm: <strong className="text-slate-900 font-mono">{st.counted}/{st.total}</strong></span>
                                            {st.varianceCount > 0 && (
                                                <span className="text-amber-700 font-bold bg-amber-50 px-1 rounded border border-amber-200">
                                                    ⚠️ {st.varianceCount} chênh
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
                            className="bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none font-bold focus:border-[#87CBB9] cursor-pointer"
                        >
                            <option value="ALL">📍 Tất cả vị trí ({zones.length} khu vực)</option>
                            {zones.map((z: string) => {
                                const countInZone = detail.lines.filter((l: any) => (l.zone || l.locationCode || 'Khu vực chung') === z).length
                                return (
                                    <option key={z} value={z}>
                                        📍 {z} ({countInZone} mã)
                                    </option>
                                )
                            })}
                        </select>

                        {/* Filter 2: Staff Member */}
                        <select
                            value={selectedStaff}
                            onChange={e => setSelectedStaff(e.target.value)}
                            className="bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none font-bold focus:border-[#87CBB9] cursor-pointer"
                        >
                            <option value="ALL">👤 Tất cả nhân viên</option>
                            {staffMembers.map(st => (
                                <option key={st.id} value={st.id}>
                                    👤 {st.name}
                                </option>
                            ))}
                        </select>

                        {/* Filter 3: Status */}
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as any)}
                            className="bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none font-bold focus:border-[#87CBB9] cursor-pointer"
                        >
                            <option value="ALL">⚡ Tất cả trạng thái</option>
                            <option value="UNCOUNTED">⚪ Chưa đếm</option>
                            <option value="MATCHED">✓ Khớp 100%</option>
                            <option value="VARIANCE">⚠️ Có chênh lệch</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                placeholder="Tìm SKU, tên rượu, nhân viên..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 text-slate-900 font-bold rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-[#87CBB9]"
                            />
                        </div>

                        {selectedZone !== 'ALL' && (
                            <button
                                onClick={handleFinishZone}
                                disabled={isCompletingZone}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                                {isCompletingZone ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Chốt Khu Vực Này
                            </button>
                        )}
                    </div>
                </div>

                {/* EDITABLE SPREADSHEET TABLE GRID FOR LEAD */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                    <th className="p-3 text-center">STT</th>
                                    <th className="p-3">Vị Trí Kệ</th>
                                    <th className="p-3">Mã SKU & Tên Sản Phẩm</th>
                                    <th className="p-3">Nhân Viên & Thời Gian Đếm</th>
                                    <th className="p-3 text-center">Tồn Sổ</th>
                                    <th className="p-3 text-center w-48">Thực Tế (Chai)</th>
                                    <th className="p-3 text-center">Chênh Lệch</th>
                                    <th className="p-3">Ghi Chú Chi Tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {filteredLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400">
                                            Không có mã nào phù hợp với bộ lọc được chọn.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLines.map((line: any, idx: number) => {
                                        const upc = line.product?.unitsPerCase || 6
                                        const actual = line.qtyActual !== null ? line.qtyActual : ''
                                        const systemQty = line.qtySystem
                                        const variance = line.variance
                                        const countTimeStr = line.countedAt ? new Date(line.countedAt).toLocaleTimeString('vi-VN') : null

                                        return (
                                            <tr key={line.id} className="hover:bg-amber-50/50 transition">
                                                <td className="p-3 text-center font-mono font-bold text-slate-500 text-[11px]">
                                                    {idx + 1}
                                                </td>

                                                <td className="p-3">
                                                    <span className="font-mono text-[11px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                                        📍 {line.zone || line.locationCode || 'Chung'}
                                                    </span>
                                                </td>

                                                <td className="p-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono font-extrabold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                                                            {line.skuCode}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                                                            🍇 {line.vintage ?? 'NV'}
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
                                                        <span className="text-slate-400 italic text-[11px]">Chưa phân công</span>
                                                    )}
                                                    {countTimeStr && (
                                                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                                                            <Clock className="w-3 h-3 text-slate-400" /> {countTimeStr}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="p-3 text-center font-mono font-extrabold text-slate-700">
                                                    {systemQty} chai
                                                    <span className="block text-[10px] text-slate-400 font-semibold">
                                                        ({Math.floor(systemQty / upc)} thùng + {systemQty % upc} lẻ)
                                                    </span>
                                                </td>

                                                {/* Interactive Input Cell */}
                                                <td className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-300">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQtyChange(line.id, (line.qtyActual || 0) - 1)}
                                                            className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer active:scale-95 shadow-2xs"
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
                                                            className="w-20 text-center font-mono font-black text-sm text-emerald-800 bg-white border border-slate-300 rounded-lg p-1 outline-none focus:border-[#87CBB9]"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQtyChange(line.id, (line.qtyActual || 0) + 1)}
                                                            className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer active:scale-95 shadow-2xs"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    {savingLineId === line.id && (
                                                        <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Đã lưu...</span>
                                                    )}
                                                </td>

                                                <td className="p-3 text-center font-mono font-bold">
                                                    {line.qtyActual === null ? (
                                                        <span className="text-slate-400 text-[11px] italic">Chưa đếm</span>
                                                    ) : variance === 0 ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                                            ✓ Khớp
                                                        </span>
                                                    ) : variance > 0 ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap">
                                                            ⚠️ Thừa +{variance}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                                                            🚨 Thiếu {variance}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="p-3 text-xs text-slate-500">
                                                    {line.notes || <span className="italic text-slate-400">Không có ghi chú</span>}
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
                <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-slate-700 shrink-0">
                    <div className="flex items-center gap-4">
                        <span>Hiển thị: <strong className="text-slate-900 font-mono">{filteredLines.length}/{totalLinesCount} dòng</strong></span>
                        <span>Đã đếm: <strong className="text-emerald-700 font-mono">{countedLinesCount}</strong></span>
                        <span>Khớp 100%: <strong className="text-emerald-800 font-mono">{matchedLinesCount}</strong></span>
                        <span>Chênh lệch: <strong className="text-amber-800 font-mono">{varianceLinesCount}</strong></span>
                    </div>

                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-[#87CBB9] hover:bg-[#76BAA8] text-[#0A1926] font-black text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                        Hoàn Tất & Đóng Bảng
                    </button>
                </div>
            </div>

            {/* MODAL CHÈN MÃ / VINTAGE NGOÀI DANH SÁCH */}
            {showAddUnlistedModal && (
                <AddUnlistedModal
                    sessionId={detail.id}
                    sessionNo={detail.sessionNo}
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
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 text-slate-900 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                    BÁO CÁO CHỐT KHU VỰC
                                </span>
                                <h3 className="text-base font-extrabold text-slate-900 mt-1">📍 {zoneReport.zoneName}</h3>
                            </div>
                            <button onClick={() => setShowZoneReportModal(false)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100">✕</button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-2xl">
                                <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">✓ KHỚP 100%</span>
                                <strong className="text-xl font-black text-emerald-800">{zoneReport.matchedCount} mã</strong>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-2xl">
                                <span className="text-[10px] font-extrabold uppercase text-amber-700 block">⚠️ THỪA</span>
                                <strong className="text-xl font-black text-amber-800">{zoneReport.overCount} mã</strong>
                            </div>
                            <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-2xl">
                                <span className="text-[10px] font-extrabold uppercase text-rose-700 block">🚨 THIẾU</span>
                                <strong className="text-xl font-black text-rose-800">{zoneReport.underCount} mã</strong>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-xs font-extrabold text-slate-800">DANH SÁCH CHÊNH LỆCH:</h4>
                            {zoneReport.varianceLines.length === 0 ? (
                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800 font-bold">
                                    🎉 Tuyệt vời! Tất cả sản phẩm trong khu vực này đều khớp 100%.
                                </div>
                            ) : (
                                zoneReport.varianceLines.map((v: any) => (
                                    <div key={v.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                                        <div>
                                            <div className="font-mono font-extrabold text-amber-900">{v.skuCode}</div>
                                            <div className="font-bold text-slate-900">{v.productName}</div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold ${v.variance > 0 ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900'}`}>
                                            {v.variance > 0 ? `+${v.variance}` : v.variance} chai
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-3 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setShowZoneReportModal(false)}
                                className="px-5 py-2 bg-[#87CBB9] text-[#0A1926] font-extrabold text-xs rounded-xl shadow-xs"
                            >
                                Đã Hiểu & Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
