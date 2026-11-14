'use client'

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
    ChevronLeft, MapPin, Search, Check, AlertTriangle,
    Save, Plus, Minus, FileText, CheckCircle2, RotateCcw,
    Printer, ShieldCheck, Layers, Loader2, ArrowLeft,
    Clock, Flag, MessageSquare, X, RefreshCw
} from 'lucide-react'
import { recordMobileCountLine, approveAndCreateAdjustment, addUnlistedProductToStockCountSession } from './actions'
import { AddUnlistedModal } from './AddUnlistedModal'
import { formatFriendlyLocationName } from './location-names'
import { toast } from 'sonner'

export type ModernCountLine = {
    id: string
    productId: string
    skuCode: string
    productName: string
    unitsPerCase: number
    vintage?: number | null
    locationId?: string | null
    locationCode: string
    locationName?: string
    zone: string
    qtySystem: number
    qtyActual: number | null
    variance: number | null
    varianceReason?: string | null
    unitCost?: number
    varianceValueVND?: number
    countedAt?: string | null
    notes?: string | null
}

export type ModernSessionDetail = {
    id: string
    sessionNo: string
    title: string
    warehouseId: string
    warehouseName: string
    scopeType: string
    isBlindCount: boolean
    status: string
    lines: ModernCountLine[]
}

type Props = {
    detail: ModernSessionDetail
    onBack: () => void
    onRefreshed?: () => void
}

type ActiveView = 'spots' | 'count' | 'summary'
type CountFilter = 'all' | 'counted' | 'uncounted' | 'variance'

const fmtNum = (n: number) => n.toLocaleString('vi-VN')
const fmtVnd = (n: number) => `${fmtNum(Math.round(n))} đ`

export function ModernStockCountView({ detail, onBack, onRefreshed }: Props) {
    const [view, setView] = useState<ActiveView>('spots')
    const [selectedSpotKey, setSelectedSpotKey] = useState<string | null>(null)
    const [lines, setLines] = useState<ModernCountLine[]>(detail.lines || [])
    const [status, setStatus] = useState<string>(detail.status || 'DRAFT')
    
    // Filters
    const [spotSearch, setSpotSearch] = useState('')
    const [itemSearch, setItemSearch] = useState('')
    const [countFilter, setCountFilter] = useState<CountFilter>('all')
    const [summaryTab, setSummaryTab] = useState<'items' | 'spots' | 'variance'>('items')

    // Modals & In-flight states
    const [showAddModal, setShowAddModal] = useState(false)
    const [showApproveModal, setShowApproveModal] = useState(false)
    const [approving, setApproving] = useState(false)
    const [savingLineIds, setSavingLineIds] = useState<Set<string>>(new Set())
    const [activeNoteLine, setActiveNoteLine] = useState<ModernCountLine | null>(null)
    const [noteDraft, setNoteDraft] = useState('')

    // Debounce save timers
    const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

    // Update lines when detail changes
    useEffect(() => {
        setLines(detail.lines || [])
        setStatus(detail.status || 'DRAFT')
    }, [detail])

    // Group lines by friendly Location Name
    const spots = useMemo(() => {
        const map = new Map<string, {
            key: string
            name: string
            locationId: string | null
            locationCode: string
            zone: string
            lines: ModernCountLine[]
        }>()

        for (const line of lines) {
            const locName = line.locationName || formatFriendlyLocationName({
                locationCode: line.locationCode,
                zone: line.zone
            })
            const key = line.locationId || line.locationCode || locName

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    name: locName,
                    locationId: line.locationId || null,
                    locationCode: line.locationCode,
                    zone: line.zone,
                    lines: []
                })
            }
            map.get(key)!.lines.push(line)
        }

        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    }, [lines])

    // Filtered spots for spot list
    const filteredSpots = useMemo(() => {
        if (!spotSearch.trim()) return spots
        const s = spotSearch.trim().toLowerCase()
        return spots.filter(sp => sp.name.toLowerCase().includes(s))
    }, [spots, spotSearch])

    // Currently selected spot
    const currentSpot = useMemo(() => {
        if (!selectedSpotKey) return null
        return spots.find(sp => sp.key === selectedSpotKey) || null
    }, [spots, selectedSpotKey])

    // Items for current spot with filters
    const currentSpotItems = useMemo(() => {
        if (!currentSpot) return []
        return currentSpot.lines.filter(item => {
            if (itemSearch.trim()) {
                const s = itemSearch.trim().toLowerCase()
                const matchSku = item.skuCode.toLowerCase().includes(s)
                const matchName = item.productName.toLowerCase().includes(s)
                const matchVintage = item.vintage ? String(item.vintage).includes(s) : false
                if (!matchSku && !matchName && !matchVintage) return false
            }

            if (countFilter === 'counted') return item.qtyActual !== null
            if (countFilter === 'uncounted') return item.qtyActual === null
            if (countFilter === 'variance') return item.qtyActual !== null && item.variance !== 0
            return true
        })
    }, [currentSpot, itemSearch, countFilter])

    // Statistics across all lines
    const stats = useMemo(() => {
        let totalItems = lines.length
        let countedItems = 0
        let totalSys = 0
        let totalAct = 0
        let totalVarianceQty = 0
        let totalVarianceValue = 0

        for (const l of lines) {
            totalSys += l.qtySystem
            if (l.qtyActual !== null) {
                countedItems++
                totalAct += l.qtyActual
                const diff = l.qtyActual - l.qtySystem
                totalVarianceQty += diff
                totalVarianceValue += (l.varianceValueVND || (diff * (l.unitCost || 0)))
            }
        }

        const percent = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0
        return {
            totalItems,
            countedItems,
            totalSys,
            totalAct,
            totalVarianceQty,
            totalVarianceValue,
            percent
        }
    }, [lines])

    // Trigger save for a line with debounce
    const scheduleSave = useCallback((lineId: string, qty: number, notes?: string) => {
        // Immediate local state update for zero lag
        setLines(prev => prev.map(l => {
            if (l.id !== lineId) return l
            const variance = qty - l.qtySystem
            const unitCost = l.unitCost || 0
            return {
                ...l,
                qtyActual: qty,
                variance,
                varianceValueVND: variance * unitCost,
                notes: notes !== undefined ? notes : l.notes,
                countedAt: new Date().toISOString()
            }
        }))

        // Mark line as saving
        setSavingLineIds(prev => new Set(prev).add(lineId))

        // Clear existing debounce timer
        const oldTimer = saveTimers.current.get(lineId)
        if (oldTimer) clearTimeout(oldTimer)

        // Set 600ms debounce
        const timer = setTimeout(async () => {
            try {
                const res = await recordMobileCountLine({
                    lineId,
                    qtyActual: qty,
                    notes: notes
                })
                if (!res.success) {
                    toast.error(res.error || 'Lỗi khi lưu số lượng kiểm kê')
                } else {
                    if (status === 'DRAFT') setStatus('IN_PROGRESS')
                }
            } catch (err: any) {
                toast.error(err.message || 'Lỗi kết nối khi lưu')
            } finally {
                setSavingLineIds(prev => {
                    const next = new Set(prev)
                    next.delete(lineId)
                    return next
                })
                saveTimers.current.delete(lineId)
            }
        }, 600)

        saveTimers.current.set(lineId, timer)
    }, [status])

    // Update cases & loose for a line
    const handleCaseLooseChange = (line: ModernCountLine, deltaCases: number, deltaLoose: number) => {
        if (status === 'APPROVED') return
        const packSize = line.unitsPerCase > 0 ? line.unitsPerCase : 6
        const currentTotal = line.qtyActual ?? 0
        const currentCases = Math.floor(currentTotal / packSize)
        const currentLoose = currentTotal % packSize

        const newCases = Math.max(0, currentCases + deltaCases)
        const newLoose = Math.max(0, currentLoose + deltaLoose)
        const newTotal = newCases * packSize + newLoose

        scheduleSave(line.id, newTotal)
    }

    const handleDirectQtyChange = (line: ModernCountLine, rawValue: string) => {
        if (status === 'APPROVED') return
        const parsed = rawValue === '' ? null : parseInt(rawValue, 10)
        if (parsed === null) {
            // Cleared input
            setLines(prev => prev.map(l => l.id === line.id ? { ...l, qtyActual: null, variance: null } : l))
            return
        }
        if (isNaN(parsed) || parsed < 0) return
        scheduleSave(line.id, parsed)
    }

    // Save note for line
    const handleSaveNote = () => {
        if (!activeNoteLine) return
        const currentQty = activeNoteLine.qtyActual ?? Number(activeNoteLine.qtySystem)
        scheduleSave(activeNoteLine.id, currentQty, noteDraft.trim())
        setActiveNoteLine(null)
        setNoteDraft('')
        toast.success('Đã lưu ghi chú')
    }

    // Approve & Sync to ERP Stock
    const handleApproveSync = async () => {
        setApproving(true)
        try {
            const res = await approveAndCreateAdjustment(detail.id)
            if (!res.success) {
                toast.error(res.error || 'Không thể duyệt phiếu kiểm kê')
                setApproving(false)
                return
            }
            toast.success(`Đã duyệt kiểm kê và cập nhật tồn ERP thành công! (${res.adjustmentNo || 'ADJ'})`)
            setStatus('APPROVED')
            setShowApproveModal(false)
            if (onRefreshed) onRefreshed()
        } catch (err: any) {
            toast.error(err.message || 'Lỗi trong quá trình duyệt')
        } finally {
            setApproving(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-2xs">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Quay lại danh sách"
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                                    {detail.title}
                                </h1>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    status === 'APPROVED'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : status === 'IN_PROGRESS'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-100 text-slate-700'
                                }`}>
                                    {status === 'APPROVED' ? 'ĐÃ DUYỆT TỒN' : status === 'IN_PROGRESS' ? 'ĐANG KIỂM KÊ' : 'BẢN NHÁP'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                <span className="font-semibold text-slate-700">{detail.warehouseName}</span>
                                <span>•</span>
                                <span>Đã kiểm: {stats.countedItems}/{stats.totalItems} mã ({stats.percent}%)</span>
                            </div>
                        </div>
                    </div>

                    {/* View Switch Buttons */}
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setView('spots')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                view === 'spots' || view === 'count'
                                    ? 'bg-teal-700 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <MapPin size={14} />
                            <span>Vị trí</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('summary')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                view === 'summary'
                                    ? 'bg-teal-700 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <FileText size={14} />
                            <span>Tổng hợp & Duyệt</span>
                        </button>
                    </div>
                </div>

                {/* Global Progress Bar */}
                <div className="max-w-6xl mx-auto mt-2.5">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ${stats.percent === 100 ? 'bg-emerald-500' : 'bg-teal-600'}`}
                            style={{ width: `${stats.percent}%` }}
                        />
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-6xl w-full mx-auto p-4">
                {/* ────────────────────────────────────────────────────────── */}
                {/* VIEW 1: SPOTS GRID (DANH SÁCH THẺ VỊ TRÍ) */}
                {/* ────────────────────────────────────────────────────────── */}
                {view === 'spots' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Danh mục Vị trí lưu kho</h2>
                                <p className="text-xs text-slate-500">
                                    Chọn một vị trí để bắt đầu đếm số lượng thực tế tại kệ
                                </p>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={spotSearch}
                                    onChange={e => setSpotSearch(e.target.value)}
                                    placeholder="Tìm tên vị trí..."
                                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-teal-500"
                                />
                            </div>
                        </div>

                        {filteredSpots.length === 0 ? (
                            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-xs">
                                Không tìm thấy vị trí nào phù hợp với từ khóa.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {filteredSpots.map(sp => {
                                    const totalInSpot = sp.lines.length
                                    const countedInSpot = sp.lines.filter(l => l.qtyActual !== null).length
                                    const isDone = totalInSpot > 0 && countedInSpot === totalInSpot
                                    const isPartial = countedInSpot > 0 && countedInSpot < totalInSpot
                                    const totalBottles = sp.lines.reduce((s, l) => s + (l.qtyActual || 0), 0)

                                    return (
                                        <button
                                            key={sp.key}
                                            type="button"
                                            onClick={() => {
                                                setSelectedSpotKey(sp.key)
                                                setView('count')
                                            }}
                                            className={`p-4 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer group hover:shadow-xs active:scale-[0.99] ${
                                                isDone
                                                    ? 'bg-emerald-50/40 border-emerald-300/80 hover:border-emerald-400'
                                                    : isPartial
                                                    ? 'bg-amber-50/30 border-amber-300/80 hover:border-amber-400'
                                                    : 'bg-white border-slate-200 hover:border-teal-500'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                                    <div className="font-bold text-sm text-slate-900 group-hover:text-teal-700 transition-colors">
                                                        {sp.name}
                                                    </div>
                                                    {isDone ? (
                                                        <span className="shrink-0 p-1 rounded-full bg-emerald-100 text-emerald-700">
                                                            <Check size={12} strokeWidth={3} />
                                                        </span>
                                                    ) : isPartial ? (
                                                        <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                                            Đang đếm
                                                        </span>
                                                    ) : (
                                                        <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                                                            Chưa đếm
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    Tiến độ: <span className="font-semibold text-slate-800">{countedInSpot}/{totalInSpot} mã</span>
                                                    {countedInSpot > 0 && (
                                                        <span className="ml-2 font-medium text-teal-700">
                                                            ({fmtNum(totalBottles)} chai)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Progress bar inside card */}
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                                                <div
                                                    className={`h-full ${isDone ? 'bg-emerald-500' : 'bg-teal-600'}`}
                                                    style={{ width: `${totalInSpot > 0 ? (countedInSpot / totalInSpot) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────── */}
                {/* VIEW 2: COUNT ITEMS AT SELECTED SPOT */}
                {/* ────────────────────────────────────────────────────────── */}
                {view === 'count' && currentSpot && (
                    <div className="space-y-4">
                        {/* Spot Counting Header */}
                        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setView('spots')}
                                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <div>
                                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                            Đang kiểm đếm tại vị trí
                                        </div>
                                        <h2 className="text-lg font-bold text-slate-900">
                                            {currentSpot.name}
                                        </h2>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(true)}
                                        disabled={status === 'APPROVED'}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-teal-600 text-teal-700 hover:bg-teal-50 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                        <Plus size={14} />
                                        <span>Thêm mã phát sinh</span>
                                    </button>
                                </div>
                            </div>

                            {/* Search and Filters */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
                                <div className="relative w-full sm:w-72">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={itemSearch}
                                        onChange={e => setItemSearch(e.target.value)}
                                        placeholder="Tìm mã SKU, tên rượu, niên vụ..."
                                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-teal-500 focus:bg-white"
                                    />
                                </div>

                                <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                                    {(['all', 'uncounted', 'counted', 'variance'] as CountFilter[]).map(f => {
                                        const label = f === 'all' ? 'Tất cả' : f === 'uncounted' ? 'Chưa đếm' : f === 'counted' ? 'Đã đếm' : 'Có lệch'
                                        return (
                                            <button
                                                key={f}
                                                type="button"
                                                onClick={() => setCountFilter(f)}
                                                className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                                                    countFilter === f
                                                        ? 'bg-[#0E7490] text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Items List */}
                        {currentSpotItems.length === 0 ? (
                            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-xs">
                                Không có mặt hàng nào phù hợp với bộ lọc tại vị trí này.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {currentSpotItems.map(item => {
                                    const packSize = item.unitsPerCase > 0 ? item.unitsPerCase : 6
                                    const isCounted = item.qtyActual !== null
                                    const isSaving = savingLineIds.has(item.id)
                                    const actual = item.qtyActual ?? 0
                                    const cases = Math.floor(actual / packSize)
                                    const loose = actual % packSize
                                    const diff = isCounted ? (item.qtyActual! - item.qtySystem) : null

                                    return (
                                        <div
                                            key={item.id}
                                            className={`bg-white rounded-lg border p-4 shadow-2xs transition-all ${
                                                isCounted
                                                    ? 'border-slate-200'
                                                    : 'border-amber-200 bg-amber-50/10'
                                            }`}
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                {/* Left: Product Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                                            {item.skuCode}
                                                        </span>
                                                        {item.vintage && (
                                                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                                                                {item.vintage}
                                                            </span>
                                                        )}
                                                        <span className="text-[11px] text-slate-400">
                                                            Thùng {packSize} chai
                                                        </span>
                                                    </div>
                                                    <h3 className="font-bold text-sm text-slate-900 leading-snug">
                                                        {item.productName}
                                                    </h3>
                                                    
                                                    {/* Sổ sách vs Lệch */}
                                                    <div className="flex items-center gap-3 text-xs mt-1.5">
                                                        {!detail.isBlindCount && (
                                                            <span className="text-slate-500">
                                                                Sổ sách: <strong className="text-slate-800">{fmtNum(item.qtySystem)}</strong> chai
                                                            </span>
                                                        )}
                                                        {isCounted && !detail.isBlindCount && (
                                                            <span className={`font-semibold ${
                                                                diff === 0
                                                                    ? 'text-slate-500'
                                                                    : diff! > 0
                                                                    ? 'text-emerald-700'
                                                                    : 'text-rose-600'
                                                            }`}>
                                                                Lệch: {diff! > 0 ? `+${diff}` : diff} chai
                                                            </span>
                                                        )}
                                                        {item.notes && (
                                                            <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded italic">
                                                                "{item.notes}"
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right: Thùng & Chai Lẻ Steppers */}
                                                <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                                                    {/* Thùng */}
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                            Số Thùng
                                                        </span>
                                                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCaseLooseChange(item, -1, 0)}
                                                                disabled={status === 'APPROVED' || cases <= 0}
                                                                className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                                                            >
                                                                <Minus size={13} />
                                                            </button>
                                                            <span className="w-10 text-center font-bold text-xs text-slate-900 bg-white py-1">
                                                                {isCounted ? cases : '-'}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCaseLooseChange(item, 1, 0)}
                                                                disabled={status === 'APPROVED'}
                                                                className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                                                            >
                                                                <Plus size={13} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Chai Lẻ */}
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                            Chai Lẻ
                                                        </span>
                                                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCaseLooseChange(item, 0, -1)}
                                                                disabled={status === 'APPROVED' || loose <= 0}
                                                                className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                                                            >
                                                                <Minus size={13} />
                                                            </button>
                                                            <span className="w-10 text-center font-bold text-xs text-slate-900 bg-white py-1">
                                                                {isCounted ? loose : '-'}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCaseLooseChange(item, 0, 1)}
                                                                disabled={status === 'APPROVED'}
                                                                className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                                                            >
                                                                <Plus size={13} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Tổng số chai & Trạng thái lưu */}
                                                    <div className="flex flex-col items-center min-w-[70px]">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                            Tổng Chai
                                                        </span>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={item.qtyActual !== null ? item.qtyActual : ''}
                                                            onChange={e => handleDirectQtyChange(item, e.target.value)}
                                                            placeholder="0"
                                                            disabled={status === 'APPROVED'}
                                                            className="w-16 text-center font-bold text-sm text-teal-800 bg-teal-50/60 border border-teal-300 rounded-lg py-1 focus:outline-none focus:border-teal-600 focus:bg-white"
                                                        />
                                                        <div className="h-4 flex items-center justify-center mt-0.5">
                                                            {isSaving ? (
                                                                <span className="text-[10px] text-teal-600 flex items-center gap-1">
                                                                    <Loader2 size={10} className="animate-spin" />
                                                                    <span>Lưu...</span>
                                                                </span>
                                                            ) : isCounted ? (
                                                                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                                                                    <Check size={11} strokeWidth={3} />
                                                                    <span>Đã lưu</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400">
                                                                    Chưa đếm
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Nút ghi chú */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveNoteLine(item)
                                                            setNoteDraft(item.notes || '')
                                                        }}
                                                        className={`p-2 rounded-lg border transition-colors ${
                                                            item.notes
                                                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                                                : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                                        }`}
                                                        title="Ghi chú"
                                                    >
                                                        <MessageSquare size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────── */}
                {/* VIEW 3: SUMMARY & APPROVE ERP SYNC */}
                {/* ────────────────────────────────────────────────────────── */}
                {view === 'summary' && (
                    <div className="space-y-5">
                        {/* Summary KPI Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs">
                                <span className="text-[11px] font-bold text-slate-400 uppercase">
                                    Tổng mặt hàng
                                </span>
                                <div className="text-xl font-bold text-slate-900 mt-1">
                                    {stats.countedItems} / {stats.totalItems}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    Đã hoàn thành {stats.percent}%
                                </div>
                            </div>

                            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs">
                                <span className="text-[11px] font-bold text-slate-400 uppercase">
                                    Tổng chai thực tế
                                </span>
                                <div className="text-xl font-bold text-teal-800 mt-1">
                                    {fmtNum(stats.totalAct)} chai
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    Sổ sách: {fmtNum(stats.totalSys)} chai
                                </div>
                            </div>

                            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs">
                                <span className="text-[11px] font-bold text-slate-400 uppercase">
                                    Chênh lệch số lượng
                                </span>
                                <div className={`text-xl font-bold mt-1 ${
                                    stats.totalVarianceQty === 0
                                        ? 'text-slate-700'
                                        : stats.totalVarianceQty > 0
                                        ? 'text-emerald-700'
                                        : 'text-rose-600'
                                }`}>
                                    {stats.totalVarianceQty > 0 ? `+${fmtNum(stats.totalVarianceQty)}` : fmtNum(stats.totalVarianceQty)} chai
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    {stats.totalVarianceQty === 0 ? 'Khớp hoàn toàn' : stats.totalVarianceQty > 0 ? 'Thừa so với sổ' : 'Thiếu so với sổ'}
                                </div>
                            </div>

                            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs">
                                <span className="text-[11px] font-bold text-slate-400 uppercase">
                                    Giá trị chênh lệch
                                </span>
                                <div className={`text-xl font-bold mt-1 ${
                                    stats.totalVarianceValue >= 0 ? 'text-slate-900' : 'text-rose-600'
                                }`}>
                                    {fmtVnd(stats.totalVarianceValue)}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    Theo giá vốn đích danh
                                </div>
                            </div>
                        </div>

                        {/* Summary Action Bar */}
                        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-1 border-b sm:border-b-0 border-slate-100 pb-2 sm:pb-0">
                                <button
                                    type="button"
                                    onClick={() => setSummaryTab('items')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                        summaryTab === 'items' ? 'bg-[#0E7490] text-white' : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    Theo Mặt Hàng
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSummaryTab('spots')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                        summaryTab === 'spots' ? 'bg-[#0E7490] text-white' : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    Theo Vị Trí
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSummaryTab('variance')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                        summaryTab === 'variance' ? 'bg-[#0E7490] text-white' : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    Cảnh Báo Lệch Kho
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Printer size={14} />
                                    <span>In Biên Bản</span>
                                </button>

                                {status !== 'APPROVED' ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowApproveModal(true)}
                                        className="px-4 py-2 rounded-lg text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <ShieldCheck size={15} />
                                        <span>Phê Duyệt & Cập Nhật Tồn ERP</span>
                                    </button>
                                ) : (
                                    <div className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                                        <CheckCircle2 size={14} />
                                        <span>Đã Đồng Bộ Tồn Kho Thành Công</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Summary Tables */}
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                            {summaryTab === 'items' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                                            <tr>
                                                <th className="px-4 py-3">Mã SKU</th>
                                                <th className="px-4 py-3">Tên Rượu</th>
                                                <th className="px-4 py-3">Niên vụ</th>
                                                <th className="px-4 py-3">Vị Trí</th>
                                                <th className="px-4 py-3 text-right">Sổ Sách</th>
                                                <th className="px-4 py-3 text-right">Thực Tế</th>
                                                <th className="px-4 py-3 text-right">Chênh Lệch</th>
                                                <th className="px-4 py-3 text-right">Giá Trị Lệch</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {lines.map(line => {
                                                const diff = line.qtyActual !== null ? (line.qtyActual - line.qtySystem) : null
                                                const locName = line.locationName || formatFriendlyLocationName({
                                                    locationCode: line.locationCode,
                                                    zone: line.zone
                                                })
                                                return (
                                                    <tr key={line.id} className="hover:bg-slate-50/60">
                                                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">
                                                            {line.skuCode}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-medium text-slate-900 max-w-xs truncate">
                                                            {line.productName}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-slate-600">
                                                            {line.vintage || '-'}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-medium text-teal-700">
                                                            {locName}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                                                            {fmtNum(line.qtySystem)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                                                            {line.qtyActual !== null ? fmtNum(line.qtyActual) : '-'}
                                                        </td>
                                                        <td className={`px-4 py-2.5 text-right font-mono font-bold ${
                                                            diff === null
                                                                ? 'text-slate-400'
                                                                : diff === 0
                                                                ? 'text-slate-500'
                                                                : diff > 0
                                                                ? 'text-emerald-700'
                                                                : 'text-rose-600'
                                                        }`}>
                                                            {diff !== null ? (diff > 0 ? `+${diff}` : diff) : '-'}
                                                        </td>
                                                        <td className={`px-4 py-2.5 text-right font-mono ${
                                                            (line.varianceValueVND || 0) < 0 ? 'text-rose-600' : 'text-slate-700'
                                                        }`}>
                                                            {line.varianceValueVND !== undefined ? fmtVnd(line.varianceValueVND) : '-'}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {summaryTab === 'spots' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                                            <tr>
                                                <th className="px-4 py-3">Tên Vị Trí Kho</th>
                                                <th className="px-4 py-3 text-center">Số Mặt Hàng</th>
                                                <th className="px-4 py-3 text-center">Đã Kiểm</th>
                                                <th className="px-4 py-3 text-right">Tổng Chai Thực Tế</th>
                                                <th className="px-4 py-3 text-center">Trạng Thái</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {spots.map(sp => {
                                                const totalInSpot = sp.lines.length
                                                const countedInSpot = sp.lines.filter(l => l.qtyActual !== null).length
                                                const totalBottles = sp.lines.reduce((s, l) => s + (l.qtyActual || 0), 0)
                                                const isDone = totalInSpot > 0 && countedInSpot === totalInSpot

                                                return (
                                                    <tr key={sp.key} className="hover:bg-slate-50/60">
                                                        <td className="px-4 py-3 font-bold text-slate-900">
                                                            {sp.name}
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-mono">
                                                            {totalInSpot}
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-mono font-semibold text-teal-700">
                                                            {countedInSpot} / {totalInSpot}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                                                            {fmtNum(totalBottles)} chai
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {isDone ? (
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                                    Hoàn thành
                                                                </span>
                                                            ) : countedInSpot > 0 ? (
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                                                    Đang kiểm
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                                                                    Chưa đếm
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {summaryTab === 'variance' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                                            <tr>
                                                <th className="px-4 py-3">Mã SKU</th>
                                                <th className="px-4 py-3">Tên Rượu</th>
                                                <th className="px-4 py-3">Vị Trí</th>
                                                <th className="px-4 py-3 text-right">Sổ Sách</th>
                                                <th className="px-4 py-3 text-right">Thực Tế</th>
                                                <th className="px-4 py-3 text-right">Lệch (Chai)</th>
                                                <th className="px-4 py-3 text-right">Giá Trị Lệch</th>
                                                <th className="px-4 py-3">Ghi Chú</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {lines.filter(l => l.qtyActual !== null && (l.qtyActual - l.qtySystem) !== 0).map(line => {
                                                const diff = line.qtyActual! - line.qtySystem
                                                const locName = line.locationName || formatFriendlyLocationName({
                                                    locationCode: line.locationCode,
                                                    zone: line.zone
                                                })
                                                return (
                                                    <tr key={line.id} className="hover:bg-slate-50/60 bg-amber-50/20">
                                                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">
                                                            {line.skuCode}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-medium text-slate-900 max-w-xs truncate">
                                                            {line.productName}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-medium text-teal-700">
                                                            {locName}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                                                            {fmtNum(line.qtySystem)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                                                            {fmtNum(line.qtyActual!)}
                                                        </td>
                                                        <td className={`px-4 py-2.5 text-right font-mono font-bold ${
                                                            diff > 0 ? 'text-emerald-700' : 'text-rose-600'
                                                        }`}>
                                                            {diff > 0 ? `+${diff}` : diff}
                                                        </td>
                                                        <td className={`px-4 py-2.5 text-right font-mono ${
                                                            (line.varianceValueVND || 0) < 0 ? 'text-rose-600' : 'text-slate-700'
                                                        }`}>
                                                            {fmtVnd(line.varianceValueVND || 0)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-slate-500 italic">
                                                            {line.notes || '-'}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Note Edit Modal */}
            {activeNoteLine && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-900">
                                Ghi chú kiểm đếm
                            </h3>
                            <button
                                type="button"
                                onClick={() => setActiveNoteLine(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-slate-700 mb-1">
                                {activeNoteLine.skuCode} - {activeNoteLine.productName}
                            </div>
                            <textarea
                                rows={3}
                                value={noteDraft}
                                onChange={e => setNoteDraft(e.target.value)}
                                placeholder="Ghi chú về tình trạng chai, hư hại tem nhãn hoặc bất thường..."
                                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                            />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setActiveNoteLine(null)}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveNote}
                                className="px-4 py-1.5 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-lg cursor-pointer"
                            >
                                Lưu ghi chú
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Approve Confirmation Modal */}
            {showApproveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in-50">
                    <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                                <ShieldCheck size={22} />
                            </div>
                            <div>
                                <h3 className="font-bold text-base text-slate-900">
                                    Xác nhận Phê duyệt & Cập nhật Tồn ERP
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Hành động này sẽ chính thức ghi đè số lượng tồn khả dụng vào hệ thống.
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-2 border border-slate-200">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Kho hàng:</span>
                                <strong className="text-slate-800">{detail.warehouseName}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Tổng mã kiểm kê:</span>
                                <strong className="text-slate-800">{stats.countedItems} / {stats.totalItems} mã</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Chênh lệch tồn kho:</span>
                                <strong className={stats.totalVarianceQty === 0 ? 'text-slate-800' : 'text-amber-700'}>
                                    {stats.totalVarianceQty > 0 ? `+${stats.totalVarianceQty}` : stats.totalVarianceQty} chai
                                </strong>
                            </div>
                            <div className="pt-2 border-t border-slate-200 text-slate-600 leading-relaxed text-[11px]">
                                [x] Tự động cập nhật số lượng tồn khả dụng vào bảng Lô hàng tồn kho (<code>StockLot</code>).<br />
                                [x] Cập nhật lại vị trí lưu kho (<code>Location</code>) cho từng mã hàng.<br />
                                [x] Tự động sinh phiếu điều chỉnh kho (<code>ADJ</code>) chuẩn kiểm toán kế toán.
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowApproveModal(false)}
                                disabled={approving}
                                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={handleApproveSync}
                                disabled={approving}
                                className="px-5 py-2 rounded-lg text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                                {approving ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>Đang ghi đè dữ liệu...</span>
                                    </>
                                ) : (
                                    <span>Xác nhận Duyệt & Ghi đè</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Unlisted Product Modal */}
            {showAddModal && currentSpot && (
                <AddUnlistedModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    sessionId={detail.id}
                    targetLocationId={currentSpot.locationId || undefined}
                    targetLocationCode={currentSpot.locationCode}
                    onSuccess={() => {
                        setShowAddModal(false)
                        if (onRefreshed) onRefreshed()
                    }}
                />
            )}
        </div>
    )
}
