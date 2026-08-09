'use client'

import React, { useState, useEffect } from 'react'
import {
    Table, Smartphone, Plus, Search, MapPin, CheckCircle2,
    Save, RefreshCw, X, AlertCircle, FileSpreadsheet, Filter
} from 'lucide-react'
import { recordCountLine, completeZoneCount, getStockCountDetail } from './actions'
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
    const [selectedZone, setSelectedZone] = useState<string>('ALL')
    const [searchTerm, setSearchTerm] = useState('')
    const [savingLineId, setSavingLineId] = useState<string | null>(null)
    const [showAddUnlistedModal, setShowAddUnlistedModal] = useState(false)

    // Zone report modal state
    const [showZoneReportModal, setShowZoneReportModal] = useState(false)
    const [zoneReport, setZoneReport] = useState<any>(null)
    const [isCompletingZone, setIsCompletingZone] = useState(false)

    useEffect(() => {
        loadDetail()
    }, [sessionId])

    const loadDetail = async () => {
        setIsLoading(true)
        const d = await getStockCountDetail(sessionId)
        setDetail(d)
        setIsLoading(false)
    }

    if (isLoading || !detail) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-2xl flex items-center gap-3 text-slate-700 font-bold">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                    Đang tải bảng điền kiểm kê...
                </div>
            </div>
        )
    }

    // Extract unique zones
    const zones: string[] = Array.from(new Set(detail.lines.map((l: any) => (l.zone || l.locationCode || 'Khu vực chung') as string)))

    // Filter lines by selected zone & search term
    const filteredLines = detail.lines.filter((l: any) => {
        const matchZone = selectedZone === 'ALL' || (l.zone || l.locationCode || 'Khu vực chung') === selectedZone
        const s = searchTerm.trim().toLowerCase()
        const matchSearch = !s ||
            l.skuCode.toLowerCase().includes(s) ||
            l.productName.toLowerCase().includes(s) ||
            (l.locationCode && l.locationCode.toLowerCase().includes(s))
        return matchZone && matchSearch
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
                    return { ...l, qtyActual: validQty, variance }
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
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-6xl h-[92vh] flex flex-col text-slate-900 shadow-2xl overflow-hidden">
                {/* MODAL HEADER */}
                <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#87CBB9]/20 text-[#0A1926] flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-md">
                                    {detail.sessionNo}
                                </span>
                                <span className="text-xs font-bold text-slate-600">
                                    {detail.warehouseName}
                                </span>
                            </div>
                            <h2 className="text-base font-extrabold text-slate-900 mt-0.5">{detail.title}</h2>
                        </div>
                    </div>

                    {/* Mode Toggle Controls */}
                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                        <button
                            onClick={() => {
                                onClose()
                                onOpenMobileView(sessionId)
                            }}
                            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition cursor-pointer whitespace-nowrap"
                        >
                            <Smartphone className="w-4 h-4" /> 📱 Chuyển sang Đếm Điện Thoại
                        </button>

                        <button
                            onClick={() => setShowAddUnlistedModal(true)}
                            className="px-3.5 py-2 bg-[#87CBB9] hover:bg-[#76BAA8] text-[#0A1926] rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs transition cursor-pointer whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" /> + Chèn Mã / Vintage Ngoài Danh Sách
                        </button>

                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl cursor-pointer">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* FILTER TOOLBAR: LOCATION/ZONE + SEARCH */}
                <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1 shrink-0">
                            <MapPin className="w-4 h-4 text-emerald-600" /> Vị Trí Kệ:
                        </label>
                        <select
                            value={selectedZone}
                            onChange={e => setSelectedZone(e.target.value)}
                            className="bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none font-bold focus:border-[#87CBB9] cursor-pointer w-full sm:w-64"
                        >
                            <option value="ALL">-- Tất cả vị trí ({zones.length} khu vực) --</option>
                            {zones.map((z: string) => {
                                const countInZone = detail.lines.filter((l: any) => (l.zone || l.locationCode || 'Khu vực chung') === z).length
                                return (
                                    <option key={z} value={z}>
                                        📍 {z} ({countInZone} sản phẩm)
                                    </option>
                                )
                            })}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                placeholder="Lọc SKU hoặc tên sản phẩm..."
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

                {/* EDITABLE TABLE GRID CONTENT */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                    <th className="p-3 text-center">STT</th>
                                    <th className="p-3">Vị Trí Kệ</th>
                                    <th className="p-3">Mã SKU & Tên Sản Phẩm</th>
                                    <th className="p-3 text-center">Tồn Sổ</th>
                                    <th className="p-3 text-center w-52">Thực Tế (Chai)</th>
                                    <th className="p-3 text-center">Chênh Lệch</th>
                                    <th className="p-3">Lý Do / Ghi Chú</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {filteredLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-400">
                                            Không có mã nào phù hợp trong vị trí được chọn.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLines.map((line: any, idx: number) => {
                                        const upc = line.product?.unitsPerCase || 6
                                        const actual = line.qtyActual !== null ? line.qtyActual : ''
                                        const systemQty = line.qtySystem
                                        const variance = line.variance

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
                        <span>Tổng số dòng: <strong className="text-slate-900 font-mono">{filteredLines.length}</strong></span>
                        <span>Đã đếm: <strong className="text-emerald-700 font-mono">{filteredLines.filter((l: any) => l.qtyActual !== null).length}</strong></span>
                        <span>Khớp 100%: <strong className="text-emerald-800 font-mono">{filteredLines.filter((l: any) => l.qtyActual !== null && l.variance === 0).length}</strong></span>
                    </div>

                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer"
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
                        loadDetail()
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
