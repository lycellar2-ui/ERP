'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    ChevronLeft, MapPin,
    Plus, Minus, Save, Eye, EyeOff, AlertTriangle, RefreshCw,
    ChevronRight, Grid, Layers, ListFilter, Check,
    Package, Wine, Search, X, CheckCheck, Tag, ArrowRight
} from 'lucide-react'
import { AddUnlistedModal } from './AddUnlistedModal'
import { recordMobileCountLine, completeZoneCount, startStockCount } from './actions'
import { formatCasesAndBottles } from '@/lib/utils'

export type LineItem = {
    id: string
    productId: string
    skuCode: string
    productName: string
    unitsPerCase: number
    vintage?: number | null
    locationCode: string
    zone: string
    qtySystem: number
    qtyActual: number | null
    variance: number | null
    varianceReason: string | null
    photoUrl: string | null
    countedAt: string | null
    notes: string | null
}

type Props = {
    detail: {
        id: string
        sessionNo: string
        title: string
        warehouseName: string
        scopeType: string
        isBlindCount: boolean
        status?: string
        lines: LineItem[]
    }
    onBack: () => void
    onRefreshed?: () => void
    onOpenTableModal?: () => void
    onOpenReport?: (sessionId: string) => void
}

const REASONS = [
    { code: 'BREAKAGE', label: 'Vỡ, hỏng chai' },
    { code: 'WRONG_SKU', label: 'Nhầm mã SKU / Tem nhãn' },
    { code: 'UNRECORDED_DO', label: 'Xuất kho chưa lập DO' },
    { code: 'UNRECORDED_GR', label: 'Nhập kho chưa lập GR' },
    { code: 'LOSS', label: 'Thất thoát chưa rõ nguyên nhân' },
    { code: 'OTHER', label: 'Lý do khác' }
]

// ─── AUDIO & HAPTIC SYSTEM (SINGLETON TO PREVENT SAFARI/CHROME LEAKS) ────
let sharedAudioCtx: AudioContext | null = null

function getSharedAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return null
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
        sharedAudioCtx = new AudioCtx()
    }
    if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {})
    }
    return sharedAudioCtx
}

function playFeedbackSound(type: 'tap' | 'chip' | 'success' | 'alert' = 'tap') {
    try {
        const ctx = getSharedAudioContext()
        if (!ctx) return
        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)

        if (type === 'tap') {
            osc.type = 'sine'
            osc.frequency.setValueAtTime(800, now)
            gain.gain.setValueAtTime(0.08, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
            osc.start(now)
            osc.stop(now + 0.05)
        } else if (type === 'chip') {
            osc.type = 'sine'
            osc.frequency.setValueAtTime(950, now)
            gain.gain.setValueAtTime(0.09, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
            osc.start(now)
            osc.stop(now + 0.07)
        } else if (type === 'success') {
            // Dual-tone ascending chime: C5 (523Hz) -> G5 (784Hz)
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(523.25, now)
            osc.frequency.setValueAtTime(783.99, now + 0.08)
            gain.gain.setValueAtTime(0.12, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
            osc.start(now)
            osc.stop(now + 0.25)
        } else if (type === 'alert') {
            osc.type = 'sawtooth'
            osc.frequency.setValueAtTime(440, now)
            osc.frequency.exponentialRampToValueAtTime(280, now + 0.16)
            gain.gain.setValueAtTime(0.1, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
            osc.start(now)
            osc.stop(now + 0.16)
        }
    } catch {
        // Fallback ignore
    }
}

function triggerHaptic(type: 'light' | 'medium' | 'success' = 'light') {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
        try {
            if (type === 'light') navigator.vibrate(25)
            else if (type === 'medium') navigator.vibrate(45)
            else if (type === 'success') navigator.vibrate([30, 50, 40])
        } catch {
            // Fallback ignore
        }
    }
}

export default function MobileLocationCounter({ detail, onBack, onRefreshed, onOpenTableModal, onOpenReport }: Props) {
    const [lines, setLines] = useState<LineItem[]>(detail.lines)
    const [viewMode, setViewMode] = useState<'FOCUS' | 'ZONES' | 'LIST'>('FOCUS')
    const [selectedZone, setSelectedZone] = useState<string>('ALL')
    const isBlindLocked = Boolean(detail.isBlindCount)
    const [isBlind, setIsBlind] = useState<boolean>(detail.isBlindCount)
    const [activeIdx, setActiveIdx] = useState<number>(0)
    const [savingLineId, setSavingLineId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [listFilter, setListFilter] = useState<'ALL' | 'UNCOUNTED' | 'MATCHED' | 'VARIANCE'>('ALL')
    const [showSuccessToast, setShowSuccessToast] = useState(false)
    const [toastMessage, setToastMessage] = useState('Đã lưu số lượng kiểm kê')

    // Unlisted modal & zone completion states
    const [showAddUnlistedModal, setShowAddUnlistedModal] = useState(false)
    const [showZoneReportModal, setShowZoneReportModal] = useState(false)
    const [zoneReport, setZoneReport] = useState<any>(null)
    const [isCompletingZone, setIsCompletingZone] = useState(false)

    // Sync lines from detail props when parent refreshes
    useEffect(() => {
        setLines(detail.lines)
    }, [detail.lines])

    // Extract unique zones
    const zones = useMemo(() => {
        return Array.from(new Set(lines.map(l => l.zone || l.locationCode || 'Chung')))
    }, [lines])

    // Filter lines by selected zone & search
    const filteredLines = useMemo(() => {
        return lines.filter(l => {
            const s = searchTerm.trim().toLowerCase()
            const matchZone = s ? true : (selectedZone === 'ALL' || l.zone === selectedZone || l.locationCode === selectedZone)
            const matchSearch = !s ||
                l.skuCode.toLowerCase().includes(s) ||
                l.productName.toLowerCase().includes(s) ||
                (l.vintage !== null && l.vintage !== undefined && String(l.vintage).includes(s)) ||
                (l.locationCode && l.locationCode.toLowerCase().includes(s))

            if (!matchZone || !matchSearch) return false

            if (viewMode === 'LIST') {
                if (listFilter === 'UNCOUNTED') return l.qtyActual === null
                if (listFilter === 'MATCHED') return l.qtyActual !== null && l.variance === 0
                if (listFilter === 'VARIANCE') return l.qtyActual !== null && l.variance !== 0
            }
            return true
        })
    }, [lines, searchTerm, selectedZone, viewMode, listFilter])

    const currentItem = filteredLines[activeIdx] || filteredLines[0] || null

    // Reset active index if out of bounds
    useEffect(() => {
        if (activeIdx >= filteredLines.length && filteredLines.length > 0) {
            setActiveIdx(0)
        }
    }, [filteredLines.length, activeIdx])

    // Count statistics
    const overallCounted = lines.filter(l => l.qtyActual !== null).length
    const overallPercent = lines.length > 0 ? Math.round((overallCounted / lines.length) * 100) : 0
    const remainingUncountedInZone = useMemo(() => {
        return filteredLines.filter(l => l.qtyActual === null).length
    }, [filteredLines])

    // Quick jump to next uncounted item
    const jumpToNextUncounted = () => {
        if (filteredLines.length === 0) return
        const nextIdx = filteredLines.findIndex((l, i) => i > activeIdx && l.qtyActual === null)
        if (nextIdx !== -1) {
            playFeedbackSound('chip')
            triggerHaptic('light')
            setActiveIdx(nextIdx)
            return
        }
        // Circular search from beginning
        const firstUncounted = filteredLines.findIndex(l => l.qtyActual === null)
        if (firstUncounted !== -1) {
            playFeedbackSound('chip')
            triggerHaptic('light')
            setActiveIdx(firstUncounted)
        } else {
            playFeedbackSound('alert')
            setToastMessage('Đã hoàn thành kiểm đếm tất cả sản phẩm trong danh sách.')
            setShowSuccessToast(true)
            setTimeout(() => setShowSuccessToast(false), 2000)
        }
    }

    // Set exact actual quantity
    const setExactQty = (lineId: string, val: number | null) => {
        playFeedbackSound('tap')
        triggerHaptic('light')

        setLines(prev => prev.map(l => {
            if (l.id === lineId) {
                if (val === null) {
                    return { ...l, qtyActual: null, variance: null }
                }
                const next = Math.max(0, val)
                const variance = next - l.qtySystem
                return { ...l, qtyActual: next, variance }
            }
            return l
        }))
    }

    // Quick increment chip handler
    const addDeltaQty = (lineId: string, delta: number) => {
        playFeedbackSound('chip')
        triggerHaptic('medium')

        setLines(prev => prev.map(l => {
            if (l.id === lineId) {
                const current = l.qtyActual !== null ? l.qtyActual : 0
                const next = Math.max(0, current + delta)
                const variance = next - l.qtySystem
                return { ...l, qtyActual: next, variance }
            }
            return l
        }))
    }

    // Set variance reason
    const setVarianceReason = (lineId: string, reasonCode: string) => {
        playFeedbackSound('tap')
        triggerHaptic('light')
        setLines(prev => prev.map(l => {
            if (l.id === lineId) {
                const nextReason = l.varianceReason === reasonCode ? null : reasonCode
                return { ...l, varianceReason: nextReason }
            }
            return l
        }))
    }

    // Save current line and advance
    const saveCurrentLineAndNext = async (line: LineItem) => {
        if (line.qtyActual === null && line.qtySystem > 0) {
            const confirmed = window.confirm(
                `Chưa nhập số lượng thực tế cho sản phẩm:\n"${line.productName}".\n\nTồn sổ sách: ${line.qtySystem} chai.\nXác nhận ghi nhận số lượng thực tế bằng 0?`
            )
            if (!confirmed) return
        }

        setSavingLineId(line.id)
        const qtyActual = line.qtyActual !== null ? line.qtyActual : 0
        const res = await recordMobileCountLine({
            lineId: line.id,
            qtyActual,
            varianceReason: line.varianceReason || undefined,
            photoUrl: line.photoUrl || undefined,
            notes: line.notes || undefined
        })
        setSavingLineId(null)

        if (res.success) {
            playFeedbackSound('success')
            triggerHaptic('success')
            setLines(prev => prev.map(l => l.id === line.id ? { ...l, countedAt: new Date().toISOString() } : l))
            if (onRefreshed) onRefreshed()

            setToastMessage('Đã lưu số lượng kiểm kê')
            setShowSuccessToast(true)
            setTimeout(() => setShowSuccessToast(false), 1200)

            // Auto advance: prioritize next uncounted item
            const nextUncountedIdx = filteredLines.findIndex((l, i) => i > activeIdx && l.qtyActual === null)
            if (nextUncountedIdx !== -1) {
                setActiveIdx(nextUncountedIdx)
            } else if (activeIdx < filteredLines.length - 1) {
                setActiveIdx(prev => prev + 1)
            }
        } else {
            playFeedbackSound('alert')
            alert(res.error || 'Không thể lưu dòng kiểm kê')
        }
    }

    const handleFinishZone = async (zoneName: string) => {
        setIsCompletingZone(true)
        const res = await completeZoneCount(detail.id, zoneName)
        setIsCompletingZone(false)
        if (res.success && res.summary) {
            playFeedbackSound('success')
            triggerHaptic('success')
            setZoneReport(res.summary)
            setShowZoneReportModal(true)
        } else {
            playFeedbackSound('alert')
            alert(res.error || 'Không thể tạo báo cáo đối soát khu vực')
        }
    }

    const getZoneStats = (zoneName: string) => {
        const zLines = lines.filter(l => zoneName === 'ALL' || l.zone === zoneName || l.locationCode === zoneName)
        const counted = zLines.filter(l => l.qtyActual !== null).length
        const hasDiff = zLines.some(l => l.variance !== null && l.variance !== 0)
        return {
            total: zLines.length,
            counted,
            percent: zLines.length > 0 ? Math.round((counted / zLines.length) * 100) : 0,
            hasDiff
        }
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans pb-36 select-none max-w-md mx-auto relative antialiased">
            {/* ─── TOP STICKY AUDIT HEADER ─── */}
            <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 p-3 sticky top-0 z-30 shadow-xs space-y-2">
                <div className="flex items-center justify-between gap-1.5">
                    <button
                        onClick={onBack}
                        className="min-h-[44px] px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl flex items-center gap-1.5 text-xs font-bold transition cursor-pointer shrink-0"
                    >
                        <ChevronLeft className="w-4 h-4" /> Quay lại
                    </button>

                    <div className="text-center flex-1 min-w-0 px-1">
                        <div className="flex items-center justify-center gap-1.5 truncate">
                            <span className="text-[10px] font-mono font-bold uppercase bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md border border-teal-200 shrink-0">
                                {detail.sessionNo}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">{detail.warehouseName}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {/* Blind count indicator or toggle */}
                        <button
                            onClick={() => {
                                if (isBlindLocked) {
                                    playFeedbackSound('alert')
                                    alert('Chế độ kiểm kê giấu tồn sổ: Tồn sổ sách và chênh lệch được bảo mật theo quy định kiểm toán, không hiển thị trên thiết bị đếm hiện trường.')
                                    return
                                }
                                setIsBlind(!isBlind)
                            }}
                            className={`min-h-[44px] px-2.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition cursor-pointer ${
                                isBlind ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                            title={isBlindLocked ? 'Kiểm kê giấu tồn sổ (Blind count)' : 'Bật/Tắt hiển thị tồn sổ sách'}
                        >
                            {isBlind ? <EyeOff className="w-4 h-4 text-amber-700" /> : <Eye className="w-4 h-4" />}
                            <span className="text-[11px] font-bold">{isBlind ? 'Giấu sổ' : 'Hiện sổ'}</span>
                        </button>
                    </div>
                </div>

                {/* Progress Bar & Quick Stats */}
                <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                        <span className="flex items-center gap-1.5">
                            Tiến độ: <strong className="text-slate-900 font-mono font-bold">{overallCounted}/{lines.length}</strong> mã
                        </span>
                        <div className="flex items-center gap-2">
                            {remainingUncountedInZone > 0 && (
                                <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                                    Còn {remainingUncountedInZone}
                                </span>
                            )}
                            <span className="text-[#0E7490] font-bold">{overallPercent}%</span>
                        </div>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden p-0.5">
                        <div
                            className="bg-[#0E7490] h-full rounded-full transition-all duration-300"
                            style={{ width: `${overallPercent}%` }}
                        />
                    </div>
                </div>

                {/* Utility Buttons Bar */}
                <div className="flex items-center gap-1.5 pt-0.5">
                    {onOpenTableModal && (
                        <button
                            onClick={onOpenTableModal}
                            className="flex-1 min-h-[40px] bg-[#0891B2] hover:bg-[#0E7490] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition"
                        >
                            Bảng kiểm kê dạng lưới
                        </button>
                    )}
                    {onOpenReport && (
                        <button
                            onClick={() => onOpenReport(detail.id)}
                            className="flex-1 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition"
                            title="Xem biên bản đối soát chênh lệch A4"
                        >
                            Báo cáo A4
                        </button>
                    )}
                    <button
                        onClick={() => setShowAddUnlistedModal(true)}
                        className="min-h-[40px] px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition shrink-0"
                    >
                        <Plus className="w-4 h-4" /> Thêm mã
                    </button>
                </div>

                {/* Draft Alert Banner */}
                {detail.status === 'DRAFT' && (
                    <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs font-bold text-amber-900 shadow-2xs">
                        <span className="flex items-center gap-1.5 truncate">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            Phiếu đang ở trạng thái Nháp
                        </span>
                        <button
                            onClick={async () => {
                                const res = await startStockCount(detail.id)
                                if (res.success && onRefreshed) onRefreshed()
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0 active:scale-95 shadow-2xs cursor-pointer"
                        >
                            Bắt đầu kiểm kê
                        </button>
                    </div>
                )}
            </header>

            {/* ─── TOAST NOTIFICATION ─── */}
            {showSuccessToast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#0891B2] text-white font-bold text-xs px-4 py-2.5 rounded-full shadow-xl z-50 flex items-center gap-2 border border-cyan-300/40">
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                MODE 1: ZONES OVERVIEW (VỊ TRÍ KHO HÀNG)
            ═══════════════════════════════════════════════════════════════ */}
            {viewMode === 'ZONES' && (
                <main className="p-4 space-y-4 flex-1">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-[#0E7490]" />
                            Vị trí kho và dãy kệ
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Chọn vị trí kiểm đếm để hiển thị danh sách sản phẩm tương ứng</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* All Zones Card */}
                        <button
                            onClick={() => {
                                setSelectedZone('ALL')
                                setActiveIdx(0)
                                setViewMode('FOCUS')
                                playFeedbackSound('tap')
                            }}
                            className="p-4 bg-white rounded-2xl border-2 border-[#0E7490] hover:border-[#0891B2] text-left relative overflow-hidden shadow-xs active:scale-98 transition cursor-pointer space-y-2.5"
                        >
                            <div className="flex justify-between items-center">
                                <span className="p-2 bg-teal-50 text-[#0E7490] rounded-xl">
                                    <MapPin className="w-5 h-5" />
                                </span>
                                <span className="text-[10px] font-mono font-bold text-[#0E7490] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                                    TẤT CẢ
                                </span>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-900">Toàn bộ kho</h4>
                                <p className="text-xs text-slate-500 font-semibold mt-0.5">{lines.length} sản phẩm</p>
                            </div>
                            <div className="text-[11px] font-bold text-[#0891B2] flex items-center gap-1 pt-1">
                                Đếm liên tục <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                        </button>

                        {/* Specific Location Zone Cards */}
                        {zones.map(zName => {
                            const zStats = getZoneStats(zName)
                            const isDone = zStats.percent === 100

                            return (
                                <button
                                    key={zName}
                                    onClick={() => {
                                        setSelectedZone(zName)
                                        setActiveIdx(0)
                                        setViewMode('FOCUS')
                                        playFeedbackSound('tap')
                                    }}
                                    className={`p-4 rounded-2xl border-2 text-left relative overflow-hidden shadow-xs active:scale-98 transition cursor-pointer space-y-2.5 ${
                                        isDone
                                            ? 'bg-emerald-50/70 border-emerald-400'
                                            : zStats.hasDiff
                                                ? 'bg-amber-50/70 border-amber-300'
                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`p-2 rounded-xl ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                            <Grid className="w-4 h-4" />
                                        </span>
                                        {isDone ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                                                <CheckCheck className="w-3.5 h-3.5" /> Hoàn thành
                                            </span>
                                        ) : zStats.hasDiff ? (
                                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md">
                                                Có lệch
                                            </span>
                                        ) : null}
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900 truncate">{zName}</h4>
                                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                            {zStats.counted}/{zStats.total} mã đã đếm
                                        </p>
                                    </div>

                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                        <div
                                            className={`h-full ${isDone ? 'bg-emerald-600' : 'bg-[#0E7490]'}`}
                                            style={{ width: `${zStats.percent}%` }}
                                        />
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </main>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                MODE 2: FOCUS VIEW (KIỂM ĐẾM CHI TIẾT TỪNG MÃ)
            ═══════════════════════════════════════════════════════════════ */}
            {viewMode === 'FOCUS' && (
                <main className="p-3.5 flex-1 flex flex-col space-y-3">
                    {/* Fast SKU / Barcode Quick Finder Bar */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Search className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            placeholder="Nhập mã SKU, tên rượu hoặc quét barcode..."
                            value={searchTerm}
                            onChange={e => {
                                setSearchTerm(e.target.value)
                                setActiveIdx(0)
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    if (filteredLines.length > 0) {
                                        playFeedbackSound('chip')
                                        triggerHaptic('light')
                                        setActiveIdx(0)
                                        setSearchTerm('')
                                    }
                                }
                            }}
                            className="w-full bg-white border border-slate-300 text-slate-900 font-bold rounded-2xl pl-9 pr-12 py-3 text-base sm:text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/20 shadow-2xs transition"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => {
                                    setSearchTerm('')
                                    setActiveIdx(0)
                                }}
                                className="absolute right-2 top-2 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {!currentItem ? (
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-3 shadow-xs my-4">
                            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
                            <h4 className="text-sm font-bold text-slate-900">Không tìm thấy mã khớp với từ khóa "{searchTerm}"</h4>
                            <p className="text-xs text-slate-500">Vui lòng kiểm tra lại mã SKU hoặc niên vụ sản phẩm</p>
                            <button
                                onClick={() => {
                                    setSearchTerm('')
                                    setActiveIdx(0)
                                }}
                                className="min-h-[48px] px-5 bg-[#0891B2] hover:bg-[#0E7490] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer active:scale-95 transition"
                            >
                                Hiển thị lại toàn bộ {lines.length} sản phẩm
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Location & Quick Jump Header */}
                            <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs shadow-2xs gap-2">
                                <div className="flex items-center gap-1.5 font-bold text-slate-700 min-w-0">
                                    <MapPin className="w-4 h-4 text-[#0E7490] shrink-0" />
                                    <span className="truncate">
                                        Kệ: <strong className="text-[#0E7490] font-mono font-bold">{currentItem.zone || currentItem.locationCode}</strong>
                                    </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[11px] font-mono text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                        {activeIdx + 1}/{filteredLines.length}
                                    </span>

                                    {/* Quick jump to next uncounted item directly in top pill */}
                                    {remainingUncountedInZone > 0 && currentItem.qtyActual !== null && (
                                        <button
                                            onClick={jumpToNextUncounted}
                                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer active:scale-95 transition border border-amber-300"
                                            title="Chuyển nhanh tới mã tiếp theo chưa đếm"
                                        >
                                            <ArrowRight className="w-3 h-3 text-amber-700" />
                                            <span>Mã chưa đếm</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ─── HERO PRODUCT & VINTAGE CARD ─── */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3.5">
                                {/* Vintage Hero Pill & SKU Bar */}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl whitespace-nowrap">
                                        {currentItem.skuCode}
                                    </span>

                                    {/* Clean Vintage Badge */}
                                    <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 text-slate-900 px-3 py-1 rounded-xl shadow-2xs">
                                        <span className="text-xs font-bold font-mono tracking-wide">
                                            {currentItem.vintage ? `Niên vụ: ${currentItem.vintage}` : 'Không niên vụ (NV)'}
                                        </span>
                                    </div>
                                </div>

                                {/* Product Name & Spec */}
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                                        {currentItem.productName}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5 text-slate-400" />
                                        Quy cách đóng thùng: <strong className="text-slate-800 font-bold">{currentItem.unitsPerCase || 6} chai / thùng</strong>
                                    </p>
                                </div>

                                {/* ─── COUNTING PODS: CASES & LOOSE BOTTLES ─── */}
                                {(() => {
                                    const upc = currentItem.unitsPerCase || 6
                                    const total = currentItem.qtyActual !== null ? currentItem.qtyActual : 0
                                    const currentCases = Math.floor(total / upc)
                                    const currentLoose = total % upc

                                    return (
                                        <div className="space-y-3">
                                            {/* System Book Stock Bar (if not blind) */}
                                            {!isBlind && (
                                                <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">
                                                    <span className="text-slate-500">
                                                        Tồn sổ sách: <strong className="text-slate-900 font-mono font-bold">{formatCasesAndBottles(currentItem.qtySystem, upc)}</strong>
                                                    </span>

                                                    {currentItem.qtySystem > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setExactQty(currentItem.id, currentItem.qtySystem)}
                                                            className="min-h-[32px] px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-300 cursor-pointer active:scale-95 transition flex items-center gap-1"
                                                        >
                                                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                                                            Khớp theo tồn sổ
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Dual Ergonomic Counter Pods (Cases vs Loose) */}
                                            <div className="grid grid-cols-2 gap-2.5">
                                                {/* POD 1: SỐ THÙNG */}
                                                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 text-center space-y-2 shadow-2xs">
                                                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase text-slate-600 tracking-wider">
                                                        <Package className="w-3.5 h-3.5 text-[#0E7490]" />
                                                        <span>Số thùng</span>
                                                    </div>

                                                    {/* Steppers & Big Display */}
                                                    <div className="flex items-center justify-between gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setExactQty(currentItem.id, Math.max(0, total - upc))}
                                                            className="min-h-[48px] min-w-[48px] rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xl flex items-center justify-center active:scale-95 cursor-pointer border border-slate-300 shadow-2xs"
                                                            aria-label="Giảm 1 thùng"
                                                        >
                                                            <Minus className="w-5 h-5 text-slate-700" />
                                                        </button>

                                                        <input
                                                            type="number"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            min="0"
                                                            value={currentItem.qtyActual !== null ? currentCases : ''}
                                                            placeholder="0"
                                                            onFocus={e => e.target.select()}
                                                            onChange={e => {
                                                                const newCases = parseInt(e.target.value, 10) || 0
                                                                setExactQty(currentItem.id, newCases * upc + currentLoose)
                                                            }}
                                                            className="w-full text-center text-3xl font-bold font-mono text-[#0E7490] bg-transparent outline-none py-1"
                                                        />

                                                        <button
                                                            type="button"
                                                            onClick={() => setExactQty(currentItem.id, total + upc)}
                                                            className="min-h-[48px] min-w-[48px] rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xl flex items-center justify-center active:scale-95 cursor-pointer border border-slate-300 shadow-2xs"
                                                            aria-label="Tăng 1 thùng"
                                                        >
                                                            <Plus className="w-5 h-5 text-slate-700" />
                                                        </button>
                                                    </div>

                                                    <span className="text-[10px] text-slate-400 font-semibold block">
                                                        ({upc} chai / thùng)
                                                    </span>

                                                    {/* Quick Multi-Add Chips for Cases */}
                                                    <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-200">
                                                        {[1, 2, 5, 10].map(cDelta => (
                                                            <button
                                                                key={`case_${cDelta}`}
                                                                type="button"
                                                                onClick={() => addDeltaQty(currentItem.id, cDelta * upc)}
                                                                className="min-h-[36px] py-1 bg-white hover:bg-teal-50 active:scale-90 text-[#0E7490] border border-slate-200 hover:border-teal-300 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                                                            >
                                                                +{cDelta}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* POD 2: CHAI LẺ */}
                                                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 text-center space-y-2 shadow-2xs">
                                                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase text-slate-600 tracking-wider">
                                                        <Wine className="w-3.5 h-3.5 text-slate-700" />
                                                        <span>Chai lẻ</span>
                                                    </div>

                                                    {/* Steppers & Big Display */}
                                                    <div className="flex items-center justify-between gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setExactQty(currentItem.id, Math.max(0, total - 1))}
                                                            className="min-h-[48px] min-w-[48px] rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xl flex items-center justify-center active:scale-95 cursor-pointer border border-slate-300 shadow-2xs"
                                                            aria-label="Giảm 1 chai"
                                                        >
                                                            <Minus className="w-5 h-5 text-slate-700" />
                                                        </button>

                                                        <input
                                                            type="number"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            min="0"
                                                            value={currentItem.qtyActual !== null ? currentLoose : ''}
                                                            placeholder="0"
                                                            onFocus={e => e.target.select()}
                                                            onChange={e => {
                                                                const newLoose = parseInt(e.target.value, 10) || 0
                                                                setExactQty(currentItem.id, currentCases * upc + newLoose)
                                                            }}
                                                            className="w-full text-center text-3xl font-bold font-mono text-slate-800 bg-transparent outline-none py-1"
                                                        />

                                                        <button
                                                            type="button"
                                                            onClick={() => setExactQty(currentItem.id, total + 1)}
                                                            className="min-h-[48px] min-w-[48px] rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xl flex items-center justify-center active:scale-95 cursor-pointer border border-slate-300 shadow-2xs"
                                                            aria-label="Tăng 1 chai"
                                                        >
                                                            <Plus className="w-5 h-5 text-slate-700" />
                                                        </button>
                                                    </div>

                                                    <span className="text-[10px] text-slate-400 font-semibold block">
                                                        (chai lẻ rời)
                                                    </span>

                                                    {/* Quick Multi-Add Chips for Bottles */}
                                                    <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-200">
                                                        {[1, 2, 3, 5].map(bDelta => (
                                                            <button
                                                                key={`bottle_${bDelta}`}
                                                                type="button"
                                                                onClick={() => addDeltaQty(currentItem.id, bDelta)}
                                                                className="min-h-[36px] py-1 bg-white hover:bg-slate-100 active:scale-90 text-slate-800 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                                                            >
                                                                +{bDelta}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick Action Helpers */}
                                            <div className="flex items-center justify-between gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setExactQty(currentItem.id, 0)}
                                                    className="flex-1 min-h-[38px] bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer border border-slate-300"
                                                >
                                                    Xác nhận kệ trống (0 chai)
                                                </button>

                                                {currentItem.qtyActual !== null && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExactQty(currentItem.id, null)}
                                                        className="px-3 min-h-[38px] bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer border border-rose-200"
                                                        title="Hủy kết quả đếm của mã này"
                                                    >
                                                        Xóa số đếm
                                                    </button>
                                                )}
                                            </div>

                                            {/* ─── VISUAL MATH & VARIANCE COCKPIT ─── */}
                                            <div className="bg-slate-900 text-white rounded-2xl p-3.5 space-y-2 shadow-sm">
                                                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                                                    <span>Công thức quy đổi:</span>
                                                    <span className="font-mono text-cyan-300 text-xs">
                                                        [{currentCases} thùng × {upc}] + [{currentLoose} chai lẻ]
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between pt-1 border-t border-slate-700/80">
                                                    <div className="text-left">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Tổng thực tế</span>
                                                        <span className="text-2xl font-bold font-mono text-cyan-300">
                                                            {total} <span className="text-xs font-semibold text-slate-300">chai</span>
                                                        </span>
                                                    </div>

                                                    {!isBlind && currentItem.qtyActual !== null && (
                                                        <div className="text-right">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Chênh lệch tồn sổ</span>
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono font-bold ${
                                                                currentItem.variance === 0
                                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                                                    : currentItem.variance! > 0
                                                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                                                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                                            }`}>
                                                                {currentItem.variance === 0
                                                                    ? 'Khớp số liệu'
                                                                    : currentItem.variance! > 0
                                                                        ? `Thừa: +${currentItem.variance} chai`
                                                                        : `Thiếu: ${currentItem.variance} chai`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* ─── VARIANCE REASON PICKER ─── */}
                                            {currentItem.qtyActual !== null && currentItem.variance !== 0 && (
                                                <div className="bg-amber-50/70 border border-amber-300 rounded-2xl p-3 space-y-2">
                                                    <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                                                        <span className="flex items-center gap-1.5">
                                                            <Tag className="w-4 h-4 text-amber-700" />
                                                            Lý do chênh lệch:
                                                        </span>
                                                        <span className="text-[10px] text-amber-700 font-semibold">(Chọn nguyên nhân)</span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {REASONS.map(r => {
                                                            const isSelected = currentItem.varianceReason === r.code
                                                            return (
                                                                <button
                                                                    key={r.code}
                                                                    type="button"
                                                                    onClick={() => setVarianceReason(currentItem.id, r.code)}
                                                                    className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold text-left flex items-center transition cursor-pointer border ${
                                                                        isSelected
                                                                            ? 'bg-[#0E7490] text-white border-[#0E7490] shadow-2xs'
                                                                            : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                                                                    }`}
                                                                >
                                                                    <span className="truncate">{r.label}</span>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}

                                {/* ─── PRIMARY THUMB ACTION: SAVE & NEXT ─── */}
                                <button
                                    onClick={() => saveCurrentLineAndNext(currentItem)}
                                    disabled={savingLineId === currentItem.id}
                                    className="w-full min-h-[52px] bg-[#0E7490] hover:bg-[#0A738D] active:scale-98 text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-md transition cursor-pointer disabled:opacity-50"
                                >
                                    {savingLineId === currentItem.id ? (
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5 text-white" />
                                            Lưu và tiếp tục
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* ─── THUMB STEPPER NAVIGATION ─── */}
                            <div className="grid grid-cols-3 gap-2 pt-1">
                                <button
                                    disabled={activeIdx === 0}
                                    onClick={() => {
                                        playFeedbackSound('tap')
                                        triggerHaptic('light')
                                        setActiveIdx(prev => Math.max(0, prev - 1))
                                    }}
                                    className="min-h-[48px] bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-30 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Mã trước
                                </button>

                                <button
                                    onClick={jumpToNextUncounted}
                                    className="min-h-[48px] bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                                    title="Chuyển tới mã tiếp theo chưa đếm"
                                >
                                    <span>Chưa đếm ({remainingUncountedInZone})</span>
                                </button>

                                <button
                                    disabled={activeIdx >= filteredLines.length - 1}
                                    onClick={() => {
                                        playFeedbackSound('tap')
                                        triggerHaptic('light')
                                        setActiveIdx(prev => Math.min(filteredLines.length - 1, prev + 1))
                                    }}
                                    className="min-h-[48px] bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-30 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                                >
                                    Mã sau <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* ─── FINISH ZONE CTA ─── */}
                            <div className="pt-2">
                                <button
                                    onClick={() => handleFinishZone(selectedZone)}
                                    disabled={isCompletingZone}
                                    className="w-full min-h-[48px] bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-slate-300 shadow-2xs cursor-pointer active:scale-98 transition"
                                >
                                    {isCompletingZone ? (
                                        <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 text-emerald-600" />
                                            Hoàn thành kiểm đếm khu vực
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </main>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                MODE 3: FULL LIST VIEW WITH QUICK FILTERS (DANH SÁCH)
            ═══════════════════════════════════════════════════════════════ */}
            {viewMode === 'LIST' && (
                <main className="p-3.5 space-y-3 flex-1">
                    {/* Search Bar */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Search className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            placeholder="Tìm kiếm mã SKU, tên rượu, niên vụ..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-slate-300 text-slate-900 rounded-2xl pl-9 pr-10 py-3 text-base sm:text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/20 shadow-2xs"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-2xl border border-slate-200">
                        <button
                            onClick={() => { setListFilter('ALL'); playFeedbackSound('tap') }}
                            className={`min-h-[36px] rounded-xl text-xs font-bold transition cursor-pointer ${
                                listFilter === 'ALL' ? 'bg-[#0E7490] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Tất cả ({lines.length})
                        </button>

                        <button
                            onClick={() => { setListFilter('UNCOUNTED'); playFeedbackSound('tap') }}
                            className={`min-h-[36px] rounded-xl text-xs font-bold transition cursor-pointer ${
                                listFilter === 'UNCOUNTED' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Chưa đếm ({lines.filter(l => l.qtyActual === null).length})
                        </button>

                        <button
                            onClick={() => { setListFilter('MATCHED'); playFeedbackSound('tap') }}
                            className={`min-h-[36px] rounded-xl text-xs font-bold transition cursor-pointer ${
                                listFilter === 'MATCHED' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Khớp ({lines.filter(l => l.qtyActual !== null && l.variance === 0).length})
                        </button>

                        <button
                            onClick={() => { setListFilter('VARIANCE'); playFeedbackSound('tap') }}
                            className={`min-h-[36px] rounded-xl text-xs font-bold transition cursor-pointer ${
                                listFilter === 'VARIANCE' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Lệch ({lines.filter(l => l.qtyActual !== null && l.variance !== 0).length})
                        </button>
                    </div>

                    {/* List Items */}
                    <div className="space-y-2">
                        {filteredLines.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 text-xs font-bold">
                                Không có sản phẩm nào khớp với bộ lọc
                            </div>
                        ) : (
                            filteredLines.map((line) => {
                                const realIdx = lines.findIndex(l => l.id === line.id)
                                const isCounted = line.qtyActual !== null
                                const isMatched = isCounted && line.variance === 0

                                return (
                                    <div
                                        key={line.id}
                                        onClick={() => {
                                            setActiveIdx(realIdx !== -1 ? realIdx : 0)
                                            setViewMode('FOCUS')
                                            playFeedbackSound('tap')
                                        }}
                                        className={`p-3.5 rounded-2xl border transition cursor-pointer active:scale-98 ${
                                            !isCounted
                                                ? 'bg-white border-slate-200 hover:border-slate-300'
                                                : isMatched
                                                    ? 'bg-emerald-50/50 border-emerald-300'
                                                    : 'bg-amber-50/50 border-amber-300'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                        {line.skuCode}
                                                    </span>
                                                    <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300">
                                                        NV: {line.vintage ?? 'NV'}
                                                    </span>
                                                </div>
                                                <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-2">
                                                    {line.productName}
                                                </h4>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className="text-[10px] text-slate-500 font-mono block">
                                                    Kệ: {line.zone || line.locationCode}
                                                </span>
                                                <span className={`text-xs font-mono font-bold mt-1 inline-block px-2 py-0.5 rounded-md ${
                                                    !isCounted
                                                        ? 'bg-slate-100 text-slate-600'
                                                        : isMatched
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-amber-100 text-amber-900'
                                                }`}>
                                                    {isCounted ? `${line.qtyActual} chai` : 'Chưa đếm'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </main>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                ZONE VARIANCE REPORT MODAL (ĐỐI SOÁT TẠI CHỖ)
            ═══════════════════════════════════════════════════════════════ */}
            {showZoneReportModal && zoneReport && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-5 text-slate-900 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                            <div>
                                <span className="text-[10px] font-mono uppercase font-bold text-[#0E7490] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                                    Báo cáo đối soát khu vực
                                </span>
                                <h3 className="text-base font-bold text-slate-900 mt-1">{zoneReport.zoneName}</h3>
                            </div>
                            <button
                                onClick={() => setShowZoneReportModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* KPI Summary Grid */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-center">
                                <span className="text-[10px] font-bold text-emerald-800 uppercase block">Khớp số liệu</span>
                                <strong className="text-lg font-bold text-emerald-700 font-mono">{zoneReport.matchedCount}</strong>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-center">
                                <span className="text-[10px] font-bold text-amber-800 uppercase block">Thừa</span>
                                <strong className="text-lg font-bold text-amber-700 font-mono">{zoneReport.overCount}</strong>
                            </div>
                            <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-center">
                                <span className="text-[10px] font-bold text-rose-800 uppercase block">Thiếu</span>
                                <strong className="text-lg font-bold text-rose-700 font-mono">{zoneReport.underCount}</strong>
                            </div>
                        </div>

                        {/* Variance Line Items Table */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                Danh sách mã chênh lệch cần rà soát:
                            </h4>

                            {zoneReport.varianceLines.length === 0 ? (
                                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center text-xs font-bold text-emerald-800">
                                    Số liệu thực tế khớp hoàn toàn với sổ sách. Không có chênh lệch.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {zoneReport.varianceLines.map((vl: any) => (
                                        <div key={vl.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded">
                                                            {vl.skuCode}
                                                        </span>
                                                        <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">
                                                            NV: {vl.vintage ?? 'NV'}
                                                        </span>
                                                    </div>
                                                    <h5 className="font-bold text-slate-900 mt-1">{vl.productName}</h5>
                                                </div>

                                                <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                                                    vl.variance > 0
                                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                                                }`}>
                                                    {vl.variance > 0 ? `+${vl.variance}` : vl.variance} chai
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center text-[11px] text-slate-600 font-mono pt-1 border-t border-slate-200">
                                                <span>Tồn sổ: {vl.qtySystem} · Thực tế: {vl.qtyActual}</span>
                                                <button
                                                    onClick={() => {
                                                        const targetIdx = lines.findIndex(l => l.id === vl.id)
                                                        if (targetIdx !== -1) {
                                                            setActiveIdx(targetIdx)
                                                            setViewMode('FOCUS')
                                                            setShowZoneReportModal(false)
                                                            playFeedbackSound('tap')
                                                        }
                                                    }}
                                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-[#0E7490] font-bold rounded-lg border border-slate-300 shadow-2xs cursor-pointer active:scale-95"
                                                >
                                                    Kiểm đếm lại mã này
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 pt-2">
                            {onOpenReport && (
                                <button
                                    onClick={() => {
                                        setShowZoneReportModal(false)
                                        onOpenReport(detail.id)
                                    }}
                                    className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 transition"
                                >
                                    Báo cáo đối soát A4
                                </button>
                            )}
                            <button
                                onClick={() => setShowZoneReportModal(false)}
                                className="flex-1 min-h-[44px] bg-[#0E7490] hover:bg-[#0891B2] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer active:scale-95 transition"
                            >
                                Tiếp tục kiểm kê
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                MODAL CHÈN MÃ / VINTAGE NGOÀI DANH SÁCH
            ═══════════════════════════════════════════════════════════════ */}
            {showAddUnlistedModal && (
                <AddUnlistedModal
                    sessionId={detail.id}
                    sessionNo={detail.sessionNo}
                    zones={zones}
                    onClose={() => setShowAddUnlistedModal(false)}
                    onSuccess={() => {
                        if (onRefreshed) onRefreshed()
                    }}
                />
            )}

            {/* ═══════════════════════════════════════════════════════════════
                FLOATING BOTTOM NAVIGATION BAR (THUMB ZONE)
            ═══════════════════════════════════════════════════════════════ */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] z-40 shadow-lg">
                <div className="max-w-md mx-auto grid grid-cols-3 gap-1.5">
                    <button
                        onClick={() => {
                            setViewMode('ZONES')
                            playFeedbackSound('tap')
                        }}
                        className={`min-h-[48px] py-1.5 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition cursor-pointer active:scale-95 ${
                            viewMode === 'ZONES'
                                ? 'bg-[#0E7490] text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 bg-transparent'
                        }`}
                    >
                        <Grid className="w-4 h-4" />
                        Vị trí kho
                    </button>

                    <button
                        onClick={() => {
                            setViewMode('FOCUS')
                            playFeedbackSound('tap')
                        }}
                        className={`min-h-[48px] py-1.5 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition cursor-pointer active:scale-95 ${
                            viewMode === 'FOCUS'
                                ? 'bg-[#0E7490] text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 bg-transparent'
                        }`}
                    >
                        <Layers className="w-4 h-4" />
                        Kiểm đếm chi tiết
                    </button>

                    <button
                        onClick={() => {
                            setViewMode('LIST')
                            playFeedbackSound('tap')
                        }}
                        className={`min-h-[48px] py-1.5 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition cursor-pointer active:scale-95 ${
                            viewMode === 'LIST'
                                ? 'bg-[#0E7490] text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 bg-transparent'
                        }`}
                    >
                        <ListFilter className="w-4 h-4" />
                        Danh sách mã
                    </button>
                </div>
            </nav>
        </div>
    )
}
