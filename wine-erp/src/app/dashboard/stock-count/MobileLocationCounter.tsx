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
    const [showBarcodeModal, setShowBarcodeModal] = useState(false)
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
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-28 select-none">
            {/* Top Fixed Header */}
            <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-3.5 sticky top-0 z-30 shadow-2xl">
                <div className="flex items-center justify-between gap-2">
                    <button
                        onClick={onBack}
                        className="p-2 bg-slate-800 active:scale-95 text-slate-300 rounded-xl flex items-center gap-1 text-xs font-bold border border-slate-700"
                    >
                        <ChevronLeft className="w-4 h-4" /> Thoát
                    </button>

                    <div className="text-center flex-1 min-w-0">
                        <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-black border border-emerald-500/30">
                            {detail.sessionNo}
                        </span>
                        <h2 className="text-xs font-bold text-white truncate mt-0.5">{detail.warehouseName}</h2>
                    </div>

                    <button
                        onClick={() => setIsBlind(!isBlind)}
                        className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 border transition ${isBlind ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                        title="Tắt/Bật giấu tồn sổ sách"
                    >
                        {isBlind ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>

                {/* Top Overall Progress */}
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-semibold px-0.5">
                    <span>Đã đếm: <strong className="text-white font-mono">{overallCounted}/{lines.length}</strong> mã</span>
                    <span className="text-emerald-400 font-black">{overallPercent}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1 p-0.5 border border-slate-700">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300 shadow-lg shadow-emerald-500/30" style={{ width: `${overallPercent}%` }}></div>
                </div>
            </div>

            {/* Success Toast Notification */}
            {showSuccessToast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 font-black text-xs px-4 py-2 rounded-full shadow-2xl z-50 flex items-center gap-1.5 animate-bounce">
                    <CheckCircle2 className="w-4 h-4" /> Đã lưu số lượng thành công!
                </div>
            )}

            {/* MODE 1: VISUAL LOCATION ZONES GRID */}
            {viewMode === 'ZONES' && (
                <div className="p-4 space-y-4 flex-1">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">CHỌN VỊ TRÍ KHO ĐỂ ĐẾM</h3>
                            <p className="text-xs text-slate-400">Bấm chọn vị trí bạn đang đứng để bắt đầu đếm</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* All Zone Card */}
                        <button
                            onClick={() => {
                                setSelectedZone('ALL')
                                setActiveIdx(0)
                                setViewMode('FOCUS')
                            }}
                            className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border-2 border-emerald-500/50 hover:border-emerald-400 text-left relative overflow-hidden shadow-xl active:scale-95 transition"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                                    <MapPin className="w-5 h-5" />
                                </span>
                                <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                                    TẤT CẢ
                                </span>
                            </div>
                            <h4 className="text-sm font-black text-white mt-1">Toàn Bộ Kho</h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">{lines.length} sản phẩm</p>
                            <div className="mt-3 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
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
                                    className={`p-4 rounded-2xl border-2 text-left relative overflow-hidden shadow-xl active:scale-95 transition ${
                                        isDone ? 'bg-emerald-950/20 border-emerald-500/60' :
                                        zStats.hasDiff ? 'bg-amber-950/20 border-amber-500/60' : 'bg-slate-900 border-slate-800'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`p-2 rounded-xl ${isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                                            <Grid className="w-4 h-4" />
                                        </span>
                                        {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                    </div>

                                    <h4 className="text-xs font-black text-white truncate">{zName}</h4>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{zStats.counted}/{zStats.total} mã đã đếm</p>

                                    {/* Mini Progress */}
                                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                                        <div className={`h-full ${isDone ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${zStats.percent}%` }}></div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* MODE 2: SINGLE-ITEM FOCUS CARD VIEW (NATIVE APP FEEL) */}
            {viewMode === 'FOCUS' && currentItem && (
                <div className="p-4 flex-1 flex flex-col space-y-4">
                    {/* Active Zone Breadcrumb & Switcher */}
                    <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-300">
                            <MapPin className="w-4 h-4 text-emerald-400" />
                            <span>Vị trí: <strong className="text-emerald-400 font-mono">{currentItem.zone}</strong></span>
                        </div>

                        <span className="text-[11px] font-mono text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded">
                            Chai {activeIdx + 1}/{filteredLines.length}
                        </span>
                    </div>

                    {/* HERO FOCUS ITEM CARD */}
                    <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl relative space-y-4">
                        {/* Top Badges */}
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl">
                                    {currentItem.skuCode}
                                </span>
                                <span className="text-xs font-bold font-mono text-amber-300 bg-amber-950/80 border border-amber-500/40 px-2.5 py-1 rounded-xl flex items-center gap-1">
                                    🍇 Vintage: {(currentItem as any).vintage ?? 'NV'}
                                </span>
                            </div>

                            {!isBlind && (
                                <div className="text-right">
                                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Tồn Sổ Sách</span>
                                    <span className="text-xs font-black text-slate-200 font-mono">
                                        {formatCasesAndBottles(currentItem.qtySystem, currentItem.unitsPerCase || 6)}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Product Title */}
                        <div>
                            <h3 className="text-base font-black text-white leading-tight">{currentItem.productName}</h3>
                            <p className="text-xs text-slate-400 font-semibold mt-1">Quy cách đóng gói: <strong className="text-amber-400 font-bold">{currentItem.unitsPerCase || 6} chai / thùng</strong></p>
                        </div>

                        {/* DUAL INPUT QUANTITY DISPLAY (THÙNG + CHAI LẺ) */}
                        {(() => {
                            const upc = currentItem.unitsPerCase || 6
                            const total = currentItem.qtyActual !== null ? currentItem.qtyActual : 0
                            const currentCases = Math.floor(total / upc)
                            const currentLoose = total % upc

                            return (
                                <div className="bg-slate-950 border-2 border-emerald-500/40 rounded-2xl p-4 shadow-inner space-y-3">
                                    <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold block text-center">
                                        SỐ LƯỢNG ĐẾM THỰC TẾ (NHẬP THÙNG & CHAI LẺ)
                                    </span>

                                    {/* 2-Column Touch Input: Thùng & Chai Lẻ */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Input 1: Số Thùng */}
                                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-center focus-within:border-emerald-400">
                                            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">📦 SỐ THÙNG</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={currentItem.qtyActual !== null ? currentCases : ''}
                                                placeholder="0"
                                                onChange={e => {
                                                    const newCases = parseInt(e.target.value, 10) || 0
                                                    const newTotal = newCases * upc + currentLoose
                                                    setExactQty(currentItem.id, newTotal)
                                                }}
                                                className="w-full text-center text-3xl font-black font-mono text-emerald-400 bg-transparent focus:outline-none"
                                            />
                                            <span className="text-[10px] text-slate-500 font-semibold">x {upc} chai/thùng</span>
                                        </div>

                                        {/* Input 2: Chai Lẻ */}
                                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-center focus-within:border-emerald-400">
                                            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">🍾 CHAI LẺ</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={currentItem.qtyActual !== null ? currentLoose : ''}
                                                placeholder="0"
                                                onChange={e => {
                                                    const newLoose = parseInt(e.target.value, 10) || 0
                                                    const newTotal = currentCases * upc + newLoose
                                                    setExactQty(currentItem.id, newTotal)
                                                }}
                                                className="w-full text-center text-3xl font-black font-mono text-emerald-400 bg-transparent focus:outline-none"
                                            />
                                            <span className="text-[10px] text-slate-500 font-semibold">chai lẻ rời</span>
                                        </div>
                                    </div>

                                    {/* Total Summary & Variance Pill */}
                                    <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs font-bold px-1">
                                        <span className="text-emerald-400 font-mono">
                                            Quy đổi: {formatCasesAndBottles(total, upc)}
                                        </span>

                                        {!isBlind && currentItem.qtyActual !== null && (
                                            <span className={currentItem.variance === 0 ? 'text-emerald-400' : currentItem.variance! > 0 ? 'text-amber-400' : 'text-rose-400'}>
                                                Chênh lệch: {currentItem.variance! > 0 ? `+${currentItem.variance}` : currentItem.variance} chai ({formatCasesAndBottles(currentItem.variance, upc)})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })()}

                        {/* BIG TOUCHPAD CONTROLS (ONE-HANDED ERGONOMICS) */}
                        <div className="grid grid-cols-4 gap-2 pt-1">
                            <button
                                onClick={() => updateQty(currentItem.id, -1)}
                                className="h-12 bg-slate-800 hover:bg-slate-700 active:scale-90 text-slate-200 text-sm font-black rounded-2xl flex items-center justify-center border border-slate-700 transition cursor-pointer"
                            >
                                -1 Chai
                            </button>
                            <button
                                onClick={() => updateQty(currentItem.id, 1)}
                                className="h-12 bg-emerald-500 hover:bg-emerald-400 active:scale-90 text-slate-950 text-sm font-black rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                            >
                                +1 Chai
                            </button>
                            <button
                                onClick={() => updateQty(currentItem.id, currentItem.unitsPerCase || 6)}
                                className="h-12 bg-slate-800 hover:bg-slate-700 active:scale-90 text-emerald-400 text-xs font-black rounded-2xl flex items-center justify-center border border-slate-700 transition cursor-pointer"
                            >
                                +1 Thùng
                            </button>
                            <button
                                onClick={() => updateQty(currentItem.id, (currentItem.unitsPerCase || 6) * 2)}
                                className="h-12 bg-slate-800 hover:bg-slate-700 active:scale-90 text-emerald-400 text-xs font-black rounded-2xl flex items-center justify-center border border-slate-700 transition cursor-pointer"
                            >
                                +2 Thùng
                            </button>
                        </div>

                        {/* SAVE & AUTO ADVANCE BUTTON */}
                        <button
                            onClick={() => saveCurrentLineAndNext(currentItem)}
                            disabled={savingLineId === currentItem.id}
                            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 active:scale-98 transition mt-2 cursor-pointer"
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

                    {/* Bottom Item Navigator Slider */}
                    <div className="flex items-center justify-between gap-2 bg-slate-900 p-2 rounded-2xl border border-slate-800">
                        <button
                            disabled={activeIdx === 0}
                            onClick={() => setActiveIdx(prev => Math.max(0, prev - 1))}
                            className="px-4 py-2.5 bg-slate-800 disabled:opacity-30 text-white rounded-xl font-bold text-xs flex items-center gap-1"
                        >
                            ◄ Chai Trước
                        </button>
                        <span className="text-xs font-mono font-bold text-slate-400">
                            {activeIdx + 1} / {filteredLines.length}
                        </span>
                        <button
                            disabled={activeIdx >= filteredLines.length - 1}
                            onClick={() => setActiveIdx(prev => Math.min(filteredLines.length - 1, prev + 1))}
                            className="px-4 py-2.5 bg-slate-800 disabled:opacity-30 text-white rounded-xl font-bold text-xs flex items-center gap-1"
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
                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl p-3 text-xs focus:outline-none focus:border-emerald-500 mb-2"
                    />

                    {filteredLines.map((line, idx) => (
                        <div
                            key={line.id}
                            onClick={() => {
                                setActiveIdx(idx)
                                setViewMode('FOCUS')
                            }}
                            className={`p-3.5 rounded-2xl border transition cursor-pointer active:scale-98 ${line.qtyActual !== null ? 'bg-slate-900/90 border-emerald-500/40' : 'bg-slate-900 border-slate-800'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                                        {line.skuCode}
                                    </span>
                                    <h4 className="text-xs font-bold text-white mt-1">{line.productName}</h4>
                                </div>

                                <div className="text-right">
                                    <span className="text-[10px] text-slate-400 block font-mono">📍 {line.zone}</span>
                                    <span className="text-xs font-black text-emerald-400 font-mono mt-0.5 block">
                                        {line.qtyActual !== null ? `${line.qtyActual} chai` : 'Chưa đếm'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* FLOATING BOTTOM NAVIGATION BAR (TOUCH ERGONOMICS) */}
            <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-2 z-40 shadow-2xl">
                <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
                    <button
                        onClick={() => setViewMode('ZONES')}
                        className={`py-2 rounded-xl flex flex-col items-center gap-1 font-bold text-[10px] transition ${viewMode === 'ZONES' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Grid className="w-4 h-4" />
                        Vị Trí Kho
                    </button>

                    <button
                        onClick={() => setViewMode('FOCUS')}
                        className={`py-2 rounded-xl flex flex-col items-center gap-1 font-bold text-[10px] transition ${viewMode === 'FOCUS' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Sparkles className="w-4 h-4" />
                        Đếm Tập Trung
                    </button>

                    <button
                        onClick={() => setViewMode('LIST')}
                        className={`py-2 rounded-xl flex flex-col items-center gap-1 font-bold text-[10px] transition ${viewMode === 'LIST' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <ListFilter className="w-4 h-4" />
                        Danh Sách
                    </button>

                    <button
                        onClick={() => setShowBarcodeModal(true)}
                        className="py-2 rounded-xl bg-amber-500 text-slate-950 flex flex-col items-center gap-1 font-black text-[10px] shadow-lg shadow-amber-500/20 active:scale-95 transition"
                    >
                        <QrCode className="w-4 h-4" />
                        Quét Mã
                    </button>
                </div>
            </div>

            {/* Barcode Camera Modal */}
            <BarcodeLookupModal
                isOpen={showBarcodeModal}
                onClose={() => setShowBarcodeModal(false)}
            />
        </div>
    )
}
