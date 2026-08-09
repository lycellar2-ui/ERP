'use client'

import React, { useState, useEffect } from 'react'
import {
    Smartphone, QrCode, CheckCircle2, ChevronLeft, MapPin,
    Plus, Minus, Save, Eye, EyeOff, Camera, AlertTriangle, RefreshCw,
    ChevronRight, ArrowRight, Grid, Layers, ListFilter, Check, Volume2, Sparkles, AlertCircle
} from 'lucide-react'
import { recordMobileCountLine } from './actions'
import { formatCasesAndBottles } from '@/lib/utils'

type LineItem = {
    id: string
    productId: string
    skuCode: string
    productName: string
    unitsPerCase: number
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
        lines: LineItem[]
    }
    onBack: () => void
    onRefreshed?: () => void
}

const REASONS = [
    { code: 'BREAKAGE', label: 'Vỡ / Hỏng chai' },
    { code: 'WRONG_SKU', label: 'Nhầm mã SKU / Tem nhãn' },
    { code: 'UNRECORDED_DO', label: 'Xuất chưa ghi sổ DO' },
    { code: 'UNRECORDED_GR', label: 'Nhập chưa ghi sổ GR' },
    { code: 'LOSS', label: 'Thất thoát chưa rõ nguyên nhân' },
    { code: 'OTHER', label: 'Lý do khác' }
]

function playBeepSound() {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtx) return
        const ctx = new AudioCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        gain.gain.setValueAtTime(0.12, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.1)
    } catch (e) {
        // Audio fallback ignore
    }
}

function triggerHaptic() {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
        try { navigator.vibrate(40) } catch (e) {}
    }
}

export default function MobileLocationCounter({ detail, onBack, onRefreshed }: Props) {
    const [lines, setLines] = useState<LineItem[]>(detail.lines)
    const [viewMode, setViewMode] = useState<'FOCUS' | 'ZONES' | 'LIST'>('ZONES')
    const [selectedZone, setSelectedZone] = useState<string>('ALL')
    const [isBlind, setIsBlind] = useState<boolean>(detail.isBlindCount)
    const [activeIdx, setActiveIdx] = useState<number>(0)
    const [savingLineId, setSavingLineId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [showSuccessToast, setShowSuccessToast] = useState(false)

    // Extract unique zones
    const zones = Array.from(new Set(lines.map(l => l.zone || l.locationCode)))

    // Filter lines by selected zone & search
    const filteredLines = lines.filter(l => {
        const matchZone = selectedZone === 'ALL' || l.zone === selectedZone || l.locationCode === selectedZone
        const matchSearch = !searchTerm || l.skuCode.toLowerCase().includes(searchTerm.toLowerCase()) || l.productName.toLowerCase().includes(searchTerm.toLowerCase())
        return matchZone && matchSearch
    })

    const currentItem = filteredLines[activeIdx] || filteredLines[0]

    // Reset active index if out of bounds
    useEffect(() => {
        if (activeIdx >= filteredLines.length && filteredLines.length > 0) {
            setActiveIdx(0)
        }
    }, [filteredLines.length])

    // Handle quantity update
    const updateQty = (lineId: string, delta: number) => {
        playBeepSound()
        triggerHaptic()

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

    const setExactQty = (lineId: string, val: number) => {
        playBeepSound()
        triggerHaptic()

        setLines(prev => prev.map(l => {
            if (l.id === lineId) {
                const next = Math.max(0, val)
                const variance = next - l.qtySystem
                return { ...l, qtyActual: next, variance }
            }
            return l
        }))
    }

    const saveCurrentLineAndNext = async (line: LineItem) => {
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
            triggerHaptic()
            setLines(prev => prev.map(l => l.id === line.id ? { ...l, countedAt: new Date().toISOString() } : l))
            if (onRefreshed) onRefreshed()

            setShowSuccessToast(true)
            setTimeout(() => setShowSuccessToast(false), 1500)

            // Auto advance to next item
            if (activeIdx < filteredLines.length - 1) {
                setActiveIdx(prev => prev + 1)
            }
        } else {
            alert(res.error || 'Không thể lưu dòng kiểm kê')
        }
    }

    // Stats per zone
    const getZoneStats = (zoneName: string) => {
        const zLines = lines.filter(l => zoneName === 'ALL' || l.zone === zoneName || l.locationCode === zoneName)
        const counted = zLines.filter(l => l.qtyActual !== null).length
        const hasDiff = zLines.some(l => l.variance !== null && l.variance !== 0)
        return { total: zLines.length, counted, percent: zLines.length > 0 ? Math.round((counted / zLines.length) * 100) : 0, hasDiff }
    }

    const overallCounted = lines.filter(l => l.qtyActual !== null).length
    const overallPercent = lines.length > 0 ? Math.round((overallCounted / lines.length) * 100) : 0

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-24 select-none max-w-md mx-auto">
            {/* Top Fixed Header */}
            <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 p-3 sticky top-0 z-30 shadow-2xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <button
                        onClick={onBack}
                        className="p-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl flex items-center gap-1 text-xs font-extrabold transition cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4" /> Thoát
                    </button>

                    <div className="text-center flex-1 min-w-0 px-2">
                        <div className="flex items-center justify-center gap-1.5 truncate">
                            <span className="text-[10px] font-mono font-extrabold uppercase bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                                {detail.sessionNo}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900 truncate">{detail.warehouseName}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsBlind(!isBlind)}
                        className={`p-2 rounded-xl text-xs font-extrabold flex items-center gap-1 border transition cursor-pointer ${isBlind ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
                        title="Tắt/Bật giấu tồn sổ sách"
                    >
                        {isBlind ? <EyeOff className="w-4 h-4 text-amber-700" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>

                {/* Progress Bar Header */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 px-0.5">
                        <span>Tiến độ đếm: <strong className="text-slate-900 font-mono">{overallCounted}/{lines.length}</strong> mã</span>
                        <span className="text-emerald-700 font-extrabold">{overallPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200 p-0.5">
                        <div className="bg-[#87CBB9] h-full rounded-full transition-all duration-300" style={{ width: `${overallPercent}%` }} />
                    </div>
                </div>
            </div>

            {/* Success Toast Notification */}
            {showSuccessToast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#87CBB9] text-[#0A1926] font-extrabold text-xs px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-1.5 animate-bounce">
                    <CheckCircle2 className="w-4 h-4" /> Đã lưu số lượng thành công!
                </div>
            )}

            {/* MODE 1: VISUAL LOCATION ZONES GRID */}
            {viewMode === 'ZONES' && (
                <div className="p-4 space-y-4 flex-1">
                    <div>
                        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">VỊ TRÍ KHO HÀNG</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Chọn vị trí bạn đang đứng để bắt đầu đếm tập trung</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* All Zone Card */}
                        <button
                            onClick={() => {
                                setSelectedZone('ALL')
                                setActiveIdx(0)
                                setViewMode('FOCUS')
                            }}
                            className="p-4 bg-white rounded-2xl border-2 border-emerald-400 hover:border-emerald-500 text-left relative overflow-hidden shadow-2xs active:scale-95 transition cursor-pointer space-y-2"
                        >
                            <div className="flex justify-between items-center">
                                <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                                    <MapPin className="w-5 h-5" />
                                </span>
                                <span className="text-[10px] font-mono font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    TẤT CẢ
                                </span>
                            </div>
                            <div>
                                <h4 className="text-sm font-extrabold text-slate-900">Toàn Bộ Kho</h4>
                                <p className="text-xs text-slate-500 mt-0.5">{lines.length} sản phẩm</p>
                            </div>
                            <div className="text-[10px] font-extrabold text-emerald-700 flex items-center gap-1 pt-1">
                                Đếm liên tục ➔
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
                                    }}
                                    className={`p-4 rounded-2xl border-2 text-left relative overflow-hidden shadow-2xs active:scale-95 transition cursor-pointer space-y-2 ${
                                        isDone ? 'bg-emerald-50/60 border-emerald-400' :
                                        zStats.hasDiff ? 'bg-amber-50/60 border-amber-300' : 'bg-white border-slate-200'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`p-2 rounded-xl ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                            <Grid className="w-4 h-4" />
                                        </span>
                                        {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-extrabold text-slate-900 truncate">{zName}</h4>
                                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{zStats.counted}/{zStats.total} mã đã đếm</p>
                                    </div>

                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                        <div className={`h-full ${isDone ? 'bg-emerald-600' : 'bg-emerald-500'}`} style={{ width: `${zStats.percent}%` }} />
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* MODE 2: SINGLE-ITEM FOCUS CARD VIEW (STREAMLINED & SPACIOUS) */}
            {viewMode === 'FOCUS' && currentItem && (
                <div className="p-4 flex-1 flex flex-col space-y-3">
                    {/* Zone & Index Breadcrumb */}
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs shadow-2xs">
                        <div className="flex items-center gap-1.5 font-extrabold text-slate-700">
                            <MapPin className="w-4 h-4 text-emerald-600" />
                            <span>Vị trí: <strong className="text-emerald-800 font-mono font-extrabold">{currentItem.zone}</strong></span>
                        </div>

                        <span className="text-[11px] font-mono text-slate-700 font-extrabold bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                            Mã {activeIdx + 1} / {filteredLines.length}
                        </span>
                    </div>

                    {/* FOCUS HERO ITEM CARD */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
                        {/* SKU + Vintage Badges */}
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-extrabold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl">
                                {currentItem.skuCode}
                            </span>
                            
                            <span className="text-xs font-bold font-mono text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-xl flex items-center gap-1">
                                🍇 Vintage: {(currentItem as any).vintage ?? 'NV'}
                            </span>
                        </div>

                        {/* Wine Title & Packaging */}
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900 leading-snug">{currentItem.productName}</h3>
                            <p className="text-xs text-slate-500 font-semibold mt-1">
                                Quy cách: <strong className="text-slate-900 font-extrabold">{currentItem.unitsPerCase || 6} chai / thùng</strong>
                            </p>
                        </div>

                        {/* System Stock vs Actual Count Input */}
                        {(() => {
                            const upc = currentItem.unitsPerCase || 6
                            const total = currentItem.qtyActual !== null ? currentItem.qtyActual : 0
                            const currentCases = Math.floor(total / upc)
                            const currentLoose = total % upc

                            return (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center justify-between text-xs font-extrabold text-slate-700 border-b border-slate-200 pb-2">
                                        <span className="uppercase text-[10px] tracking-wider text-emerald-800">SỐ LƯỢNG ĐẾM THỰC TẾ</span>
                                        {!isBlind && (
                                            <span className="text-slate-500 text-[11px] font-mono">
                                                Tồn sổ: <strong className="text-slate-900">{formatCasesAndBottles(currentItem.qtySystem, upc)}</strong>
                                            </span>
                                        )}
                                    </div>

                                    {/* 2-Column Quantity Controls (Thùng + Chai) */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Cases Box */}
                                        <div className="bg-white border border-slate-300 rounded-xl p-3 text-center space-y-1 shadow-2xs">
                                            <span className="text-[10px] font-extrabold uppercase text-slate-500 block">📦 SỐ THÙNG</span>
                                            <div className="flex items-center justify-between gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setExactQty(currentItem.id, Math.max(0, total - upc))}
                                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-base flex items-center justify-center active:scale-95 cursor-pointer"
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={currentItem.qtyActual !== null ? currentCases : ''}
                                                    placeholder="0"
                                                    onChange={e => {
                                                        const newCases = parseInt(e.target.value, 10) || 0
                                                        setExactQty(currentItem.id, newCases * upc + currentLoose)
                                                    }}
                                                    className="w-full text-center text-2xl font-black font-mono text-emerald-800 bg-transparent outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setExactQty(currentItem.id, total + upc)}
                                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-base flex items-center justify-center active:scale-95 cursor-pointer"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-semibold block">({upc} chai/thùng)</span>
                                        </div>

                                        {/* Loose Bottles Box */}
                                        <div className="bg-white border border-slate-300 rounded-xl p-3 text-center space-y-1 shadow-2xs">
                                            <span className="text-[10px] font-extrabold uppercase text-slate-500 block">🍾 CHAI LẺ</span>
                                            <div className="flex items-center justify-between gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setExactQty(currentItem.id, Math.max(0, total - 1))}
                                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-base flex items-center justify-center active:scale-95 cursor-pointer"
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={currentItem.qtyActual !== null ? currentLoose : ''}
                                                    placeholder="0"
                                                    onChange={e => {
                                                        const newLoose = parseInt(e.target.value, 10) || 0
                                                        setExactQty(currentItem.id, currentCases * upc + newLoose)
                                                    }}
                                                    className="w-full text-center text-2xl font-black font-mono text-emerald-800 bg-transparent outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setExactQty(currentItem.id, total + 1)}
                                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-base flex items-center justify-center active:scale-95 cursor-pointer"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-semibold block">chai rời</span>
                                        </div>
                                    </div>

                                    {/* Total Count Pill & Variance Summary */}
                                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-extrabold px-1">
                                        <span className="text-emerald-800 font-mono">
                                            Tổng thực tế: {formatCasesAndBottles(total, upc)}
                                        </span>

                                        {!isBlind && currentItem.qtyActual !== null && (
                                            <span className={currentItem.variance === 0 ? 'text-emerald-700' : currentItem.variance! > 0 ? 'text-amber-700' : 'text-rose-600'}>
                                                Lệch: {currentItem.variance! > 0 ? `+${currentItem.variance}` : currentItem.variance} chai
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })()}

                        {/* SAVE & GO NEXT MAIN CTA BUTTON */}
                        <button
                            onClick={() => saveCurrentLineAndNext(currentItem)}
                            disabled={savingLineId === currentItem.id}
                            className="w-full py-4 bg-[#87CBB9] hover:bg-[#76BAA8] active:scale-98 text-[#0A1926] font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                        >
                            {savingLineId === currentItem.id ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    LƯU VÀ SANG CHAI TIẾP THEO ➔
                                </>
                            )}
                        </button>
                    </div>

                    {/* Prev / Next Slider Navigation */}
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
                        <button
                            disabled={activeIdx === 0}
                            onClick={() => setActiveIdx(prev => Math.max(0, prev - 1))}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-30 text-slate-800 rounded-xl font-extrabold text-xs flex items-center gap-1 cursor-pointer"
                        >
                            ◄ Chai Trước
                        </button>
                        <span className="text-xs font-mono font-extrabold text-slate-600">
                            {activeIdx + 1} / {filteredLines.length}
                        </span>
                        <button
                            disabled={activeIdx >= filteredLines.length - 1}
                            onClick={() => setActiveIdx(prev => Math.min(filteredLines.length - 1, prev + 1))}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-30 text-slate-800 rounded-xl font-extrabold text-xs flex items-center gap-1 cursor-pointer"
                        >
                            Chai Sau ►
                        </button>
                    </div>
                </div>
            )}

            {/* MODE 3: FULL COMPACT LIST VIEW */}
            {viewMode === 'LIST' && (
                <div className="p-4 space-y-3 flex-1">
                    <input
                        type="text"
                        placeholder="Tìm SKU hoặc tên rượu..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-3 text-xs outline-none focus:border-[#87CBB9] focus:ring-2 focus:ring-[#87CBB9]/20 mb-2 shadow-2xs"
                    />

                    {filteredLines.map((line, idx) => (
                        <div
                            key={line.id}
                            onClick={() => {
                                setActiveIdx(idx)
                                setViewMode('FOCUS')
                            }}
                            className={`p-3.5 rounded-2xl border transition cursor-pointer active:scale-98 ${line.qtyActual !== null ? 'bg-emerald-50/50 border-emerald-300' : 'bg-white border-slate-200'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                        {line.skuCode}
                                    </span>
                                    <h4 className="text-xs font-extrabold text-slate-900 mt-1">{line.productName}</h4>
                                </div>

                                <div className="text-right">
                                    <span className="text-[10px] text-slate-500 block font-mono">📍 {line.zone}</span>
                                    <span className="text-xs font-bold text-emerald-700 font-mono mt-0.5 block">
                                        {line.qtyActual !== null ? `${line.qtyActual} chai` : 'Chưa đếm'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* FLOATING BOTTOM NAVIGATION BAR */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 p-2 z-40 shadow-lg">
                <div className="max-w-md mx-auto grid grid-cols-3 gap-1">
                    <button
                        onClick={() => setViewMode('ZONES')}
                        className={`py-2 rounded-xl flex flex-col items-center gap-1 font-extrabold text-[10px] transition cursor-pointer ${viewMode === 'ZONES' ? 'bg-[#0A1926] text-[#87CBB9] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <Grid className="w-4 h-4" />
                        Vị Trí Kho
                    </button>

                    <button
                        onClick={() => setViewMode('FOCUS')}
                        className={`py-2 rounded-xl flex flex-col items-center gap-1 font-extrabold text-[10px] transition cursor-pointer ${viewMode === 'FOCUS' ? 'bg-[#0A1926] text-[#87CBB9] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <Sparkles className="w-4 h-4" />
                        Đếm Tập Trung
                    </button>

                    <button
                        onClick={() => setViewMode('LIST')}
                        className={`py-2 rounded-xl flex flex-col items-center gap-1 font-extrabold text-[10px] transition cursor-pointer ${viewMode === 'LIST' ? 'bg-[#0A1926] text-[#87CBB9] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                        <ListFilter className="w-4 h-4" />
                        Danh Sách
                    </button>
                </div>
            </div>
        </div>
    )
}
