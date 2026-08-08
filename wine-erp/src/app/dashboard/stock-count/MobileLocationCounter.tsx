'use client'

import React, { useState, useEffect } from 'react'
import {
    Smartphone, QrCode, CheckCircle2, ChevronLeft, MapPin,
    Plus, Minus, Save, Eye, EyeOff, Camera, AlertTriangle, RefreshCw
} from 'lucide-react'
import { recordMobileCountLine } from './actions'
import BarcodeLookupModal from './BarcodeLookupModal'

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

export default function MobileLocationCounter({ detail, onBack, onRefreshed }: Props) {
    const [lines, setLines] = useState<LineItem[]>(detail.lines)
    const [selectedZone, setSelectedZone] = useState<string>('ALL')
    const [isBlind, setIsBlind] = useState<boolean>(detail.isBlindCount)
    const [activeLineId, setActiveLineId] = useState<string | null>(null)
    const [savingLineId, setSavingLineId] = useState<string | null>(null)
    const [showBarcodeModal, setShowBarcodeModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Extract unique zones / location names
    const zones = Array.from(new Set(lines.map(l => l.zone || l.locationCode)))

    // Filter lines by selected zone & search
    const filteredLines = lines.filter(l => {
        const matchZone = selectedZone === 'ALL' || l.zone === selectedZone || l.locationCode === selectedZone
        const matchSearch = !searchTerm || l.skuCode.toLowerCase().includes(searchTerm.toLowerCase()) || l.productName.toLowerCase().includes(searchTerm.toLowerCase())
        return matchZone && matchSearch
    })

    const activeLine = lines.find(l => l.id === activeLineId)

    // Handle count change
    const updateQty = async (lineId: string, delta: number) => {
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

    const setExactQty = async (lineId: string, val: number) => {
        setLines(prev => prev.map(l => {
            if (l.id === lineId) {
                const next = Math.max(0, val)
                const variance = next - l.qtySystem
                return { ...l, qtyActual: next, variance }
            }
            return l
        }))
    }

    const saveLineData = async (line: LineItem) => {
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
            setLines(prev => prev.map(l => l.id === line.id ? { ...l, countedAt: new Date().toISOString() } : l))
            if (onRefreshed) onRefreshed()
        } else {
            alert(res.error || 'Không thể lưu dòng kiểm kê')
        }
    }

    // Zone completion progress
    const zoneLines = lines.filter(l => selectedZone === 'ALL' || l.zone === selectedZone)
    const countedInZone = zoneLines.filter(l => l.qtyActual !== null).length
    const progressPercent = zoneLines.length > 0 ? Math.round((countedInZone / zoneLines.length) * 100) : 0

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-24">
            {/* Header Sticky Bar */}
            <div className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition flex items-center gap-1 text-xs font-semibold"
                    >
                        <ChevronLeft className="w-4 h-4" /> Quay lại
                    </button>

                    <div className="text-center flex-1 min-w-0">
                        <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">
                            {detail.sessionNo}
                        </span>
                        <h2 className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">{detail.warehouseName}</h2>
                    </div>

                    <button
                        onClick={() => setIsBlind(!isBlind)}
                        className={`p-2 rounded-xl transition text-xs font-semibold flex items-center gap-1 ${isBlind ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}
                        title="Tắt/Bật giấu tồn sổ sách"
                    >
                        {isBlind ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>

                {/* Location Zone Picker Pills */}
                <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-semibold whitespace-nowrap">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Vị trí:
                    </span>
                    <button
                        onClick={() => setSelectedZone('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${selectedZone === 'ALL' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                        Tất cả ({lines.length})
                    </button>
                    {zones.map(z => (
                        <button
                            key={z}
                            onClick={() => setSelectedZone(z)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${selectedZone === z ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        >
                            {z}
                        </button>
                    ))}
                </div>

                {/* Zone Progress Bar */}
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span>Đã kiểm: {countedInZone}/{zoneLines.length} mã</span>
                    <span className="text-emerald-400 font-bold">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
                </div>
            </div>

            {/* Search and Action Bar */}
            <div className="p-4 flex items-center gap-2">
                <input
                    type="text"
                    placeholder="Tìm theo SKU hoặc Tên rượu..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                    onClick={() => setShowBarcodeModal(true)}
                    className="px-4 py-2.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition"
                >
                    <QrCode className="w-4 h-4" /> Camera Barcode
                </button>
            </div>

            {/* Product Lines List for Selected Location */}
            <div className="flex-1 p-4 pt-0 space-y-3">
                {filteredLines.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                        Không có sản phẩm nào ở vị trí này.
                    </div>
                ) : (
                    filteredLines.map(line => {
                        const isCounted = line.qtyActual !== null
                        const hasDiff = line.variance !== null && line.variance !== 0
                        const isSaving = savingLineId === line.id

                        return (
                            <div
                                key={line.id}
                                className={`p-4 rounded-2xl border transition-all ${isCounted ? (hasDiff ? 'bg-amber-950/20 border-amber-500/40' : 'bg-slate-900/80 border-emerald-500/40') : 'bg-slate-900 border-slate-800'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                                                {line.skuCode}
                                            </span>
                                            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-mono">
                                                📍 {line.zone}
                                            </span>
                                        </div>
                                        <h3 className="text-xs sm:text-sm font-bold text-white mt-1">{line.productName}</h3>
                                    </div>

                                    {!isBlind && (
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Tồn Sổ Sách</span>
                                            <span className="text-xs font-bold text-slate-200 font-mono">{line.qtySystem} chai</span>
                                        </div>
                                    )}
                                </div>

                                {/* Touch Counting Controls */}
                                <div className="mt-3 flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800">
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => updateQty(line.id, -1)}
                                            className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center active:scale-90 transition text-base"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => updateQty(line.id, 1)}
                                            className="w-10 h-10 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold flex items-center justify-center active:scale-90 transition text-base shadow-md shadow-emerald-500/20"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => updateQty(line.id, line.unitsPerCase || 6)}
                                            className="px-2.5 h-10 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl font-bold text-xs flex items-center justify-center active:scale-90 transition border border-slate-700"
                                        >
                                            +{line.unitsPerCase || 6} (Thùng)
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={line.qtyActual !== null ? line.qtyActual : ''}
                                            placeholder="0"
                                            onChange={e => setExactQty(line.id, parseInt(e.target.value, 10) || 0)}
                                            className="w-16 h-10 bg-slate-900 border border-slate-700 text-white text-center font-mono font-bold text-base rounded-xl focus:border-emerald-500 focus:outline-none"
                                        />
                                        <button
                                            onClick={() => saveLineData(line)}
                                            disabled={isSaving}
                                            className="h-10 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1 transition shadow"
                                        >
                                            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            Lưu
                                        </button>
                                    </div>
                                </div>

                                {/* Variance and Note Options */}
                                {line.qtyActual !== null && (
                                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                                        {!isBlind && (
                                            <div className="flex items-center gap-1.5 font-bold">
                                                <span>Chênh lệch:</span>
                                                <span className={line.variance === 0 ? 'text-emerald-400' : line.variance! > 0 ? 'text-amber-400' : 'text-rose-400'}>
                                                    {line.variance! > 0 ? `+${line.variance}` : line.variance} chai
                                                </span>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => setActiveLineId(activeLineId === line.id ? null : line.id)}
                                            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
                                        >
                                            <Camera className="w-3.5 h-3.5 text-amber-400" />
                                            {line.varianceReason ? 'Sửa lý do / Ảnh' : '+ Thêm lý do vỡ/hỏng'}
                                        </button>
                                    </div>
                                )}

                                {/* Variance Reason Drawer Sub-form */}
                                {activeLineId === line.id && (
                                    <div className="mt-3 bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
                                        <label className="text-slate-400 block text-[10px] font-bold uppercase">Nguyên nhân chênh lệch:</label>
                                        <select
                                            value={line.varianceReason || ''}
                                            onChange={e => setLines(prev => prev.map(l => l.id === line.id ? { ...l, varianceReason: e.target.value } : l))}
                                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none"
                                        >
                                            <option value="">-- Chọn nguyên nhân --</option>
                                            {REASONS.map(r => (
                                                <option key={r.code} value={r.label}>{r.label}</option>
                                            ))}
                                        </select>

                                        <label className="text-slate-400 block text-[10px] font-bold uppercase mt-2">Ghi chú giải trình:</label>
                                        <input
                                            type="text"
                                            placeholder="Ghi chú chi tiết..."
                                            value={line.notes || ''}
                                            onChange={e => setLines(prev => prev.map(l => l.id === line.id ? { ...l, notes: e.target.value } : l))}
                                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs focus:outline-none"
                                        />

                                        <button
                                            onClick={() => {
                                                saveLineData(line)
                                                setActiveLineId(null)
                                            }}
                                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs mt-2"
                                        >
                                            Xác Nhận Cập Nhật Dòng
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Barcode Camera Lookup Modal */}
            {showBarcodeModal && (
                <BarcodeLookupModal
                    sessionId={detail.id}
                    onClose={() => setShowBarcodeModal(false)}
                    onRecorded={() => {
                        if (onRefreshed) onRefreshed()
                    }}
                />
            )}
        </div>
    )
}
