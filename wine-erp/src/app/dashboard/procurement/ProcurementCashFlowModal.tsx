'use client'

import React, { useState, useMemo } from 'react'
import {
    X, DollarSign, Calendar, TrendingUp, CheckSquare, Square,
    Ship, Building2, Download, AlertCircle, ArrowRight,
    PieChart, Layers, RefreshCw, Info, HelpCircle, Percent
} from 'lucide-react'
import type { PORow } from './types'
import { formatVND } from '@/lib/utils'

interface ProcurementCashFlowModalProps {
    open: boolean
    onClose: () => void
    purchaseOrders: PORow[]
}

// Mặc định tỷ giá thị trường dự kiến (có thể sửa đổi tự do)
const DEFAULT_FORECAST_RATES: Record<string, number> = {
    USD: 25450,
    EUR: 27200,
    AUD: 16400,
    GBP: 32600,
    VND: 1,
}

export function ProcurementCashFlowModal({
    open,
    onClose,
    purchaseOrders,
}: ProcurementCashFlowModalProps) {
    if (!open) return null

    // ─── 1. BỘ LỌC THỜI ĐIỂM (TIME HORIZON) ─────────────────────
    const [periodFilter, setPeriodFilter] = useState<'ALL_OPEN' | 'THIS_MONTH' | 'NEXT_MONTH' | 'THIS_QUARTER'>('ALL_OPEN')

    // ─── 2. CẤU HÌNH TỶ GIÁ DỰ KIẾN (FORECAST FX RATES) ────────
    const [forecastRates, setForecastRates] = useState<Record<string, number>>(DEFAULT_FORECAST_RATES)

    // ─── 3. DANH SÁCH PO ĐƯỢC CHỌN (FLEXIBLE PO SELECTION) ──────
    // Mặc định ban đầu chọn tất cả các PO không bị huỷ
    const eligiblePOs = useMemo(() => {
        return purchaseOrders.filter(po => po.status !== 'CANCELLED')
    }, [purchaseOrders])

    const [selectedPoIds, setSelectedPoIds] = useState<Set<string>>(() => {
        return new Set(eligiblePOs.map(po => po.id))
    })

    // ─── 4. CẤU HÌNH % THUẾ DỰ KIẾN (CUSTOM TAX RATES) ──────────
    const [globalTaxRates, setGlobalTaxRates] = useState<{ importTax: number; sct: number; vat: number }>({
        importTax: 20, // 20% Thuế NK mặc định (EVFTA)
        sct: 65,       // 65% Thuế TTĐB mặc định (Rượu vang)
        vat: 10,       // 10% Thuế VAT mặc định
    })

    // Tùy chỉnh % thuế riêng cho từng PO
    const [poTaxOverrides, setPoTaxOverrides] = useState<Record<string, { importTax?: number; sct?: number; vat?: number }>>({})

    const updatePoTax = (poId: string, field: 'importTax' | 'sct' | 'vat', value: number) => {
        setPoTaxOverrides(prev => ({
            ...prev,
            [poId]: {
                ...(prev[poId] || {}),
                [field]: value
            }
        }))
    }

    // Filter POs theo thời điểm
    const filteredPOs = useMemo(() => {
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        return eligiblePOs.filter(po => {
            const date = po.estimatedDelivery ? new Date(po.estimatedDelivery) : new Date(po.createdAt)
            const m = date.getMonth()
            const y = date.getFullYear()

            if (periodFilter === 'THIS_MONTH') {
                return m === currentMonth && y === currentYear
            }
            if (periodFilter === 'NEXT_MONTH') {
                const nextM = (currentMonth + 1) % 12
                const nextY = currentMonth === 11 ? currentYear + 1 : currentYear
                return m === nextM && y === nextY
            }
            if (periodFilter === 'THIS_QUARTER') {
                const currentQ = Math.floor(currentMonth / 3)
                const poQ = Math.floor(m / 3)
                return poQ === currentQ && y === currentYear
            }
            return true // ALL_OPEN
        })
    }, [eligiblePOs, periodFilter])

    // Toggle PO
    const togglePo = (id: string) => {
        setSelectedPoIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectAll = () => {
        setSelectedPoIds(new Set(filteredPOs.map(p => p.id)))
    }

    const deselectAll = () => {
        setSelectedPoIds(new Set())
    }

    // ─── 4. TÍNH TOÁN DÒNG TIỀN DỰ TRÙ (REAL-TIME ENGINE) ────────
    const calculatedItems = useMemo(() => {
        return filteredPOs.map(po => {
            const isSelected = selectedPoIds.has(po.id)
            const curr = (po.currency || 'USD').toUpperCase()
            const rate = forecastRates[curr] || po.exchangeRate || 25450
            const foreignAmount = po.totalAmount || 0

            // 1. Tiền hàng quy đổi VND theo tỷ giá dự kiến
            const goodsVND = Math.round(foreignAmount * rate)

            // 2. Dự trù cước quốc tế (Freight)
            // Nếu FOB/EXW: cước khoảng 6% - 8% tiền hàng; nếu CIF/DDP: đã bao gồm trong tiền hàng
            const isIncoIncluded = po.incoterms === 'CIF' || po.incoterms === 'DDP'
            const freightRatePct = isIncoIncluded ? 0 : 0.07 // 7% FOB cho rượu vang đường biển
            const estimatedFreightVND = Math.round(goodsVND * freightRatePct)

            // Giá tính thuế CIF
            const cifVND = goodsVND + estimatedFreightVND

            // 3. Dự trù Thuế Nhập Khẩu 3 tầng (Tự do cấu hình %)
            const customTax = poTaxOverrides[po.id] || {}
            const importTaxPct = customTax.importTax !== undefined ? customTax.importTax : globalTaxRates.importTax
            const sctPct = customTax.sct !== undefined ? customTax.sct : globalTaxRates.sct
            const vatPct = customTax.vat !== undefined ? customTax.vat : globalTaxRates.vat

            const importTaxRate = (importTaxPct || 0) / 100
            const importTaxVND = Math.round(cifVND * importTaxRate)

            const sctBaseVND = cifVND + importTaxVND
            const sctRate = (sctPct || 0) / 100
            const sctVND = Math.round(sctBaseVND * sctRate)

            const vatBaseVND = sctBaseVND + sctVND
            const vatRate = (vatPct || 0) / 100
            const vatVND = Math.round(vatBaseVND * vatRate)

            const totalTaxVND = importTaxVND + sctVND + vatVND

            // 4. Chi phí nội địa & thủ tục cảng (Local charges THC/DO, Kéo cont lạnh, Tem rượu, Phí ATTP)
            // Ước tính khoảng 3% tiền hàng hoặc tối thiểu 12,000,000 VND / PO
            const estimatedLocalVND = Math.max(12000000, Math.round(goodsVND * 0.03))

            // 5. Tổng chi phí dự trù (Landed Cost Forecast)
            const totalLandedCostVND = goodsVND + estimatedFreightVND + totalTaxVND + estimatedLocalVND

            // 6. Kế hoạch giải ngân theo mốc vận hành (Cash Flow Milestones)
            const depositVND = Math.round(goodsVND * 0.30) // 30% Đặt cọc
            const finalGoodsVND = goodsVND - depositVND // 70% Tiền hàng còn lại

            return {
                po,
                isSelected,
                currency: curr,
                forecastRate: rate,
                foreignAmount,
                goodsVND,
                estimatedFreightVND,
                cifVND,
                importTaxPct,
                importTaxVND,
                sctPct,
                sctVND,
                vatPct,
                vatVND,
                totalTaxVND,
                estimatedLocalVND,
                totalLandedCostVND,
                milestones: {
                    depositVND,
                    finalGoodsVND,
                    taxVND: totalTaxVND,
                    logisticsVND: estimatedFreightVND + estimatedLocalVND,
                }
            }
        })
    }, [filteredPOs, selectedPoIds, forecastRates, globalTaxRates, poTaxOverrides])

    // Tổng hợp các PO đang được tick chọn
    const totals = useMemo(() => {
        const active = calculatedItems.filter(item => item.isSelected)
        const totalGoodsVND = active.reduce((acc, cur) => acc + cur.goodsVND, 0)
        const totalFreightVND = active.reduce((acc, cur) => acc + cur.estimatedFreightVND, 0)
        const totalImportTaxVND = active.reduce((acc, cur) => acc + cur.importTaxVND, 0)
        const totalSctVND = active.reduce((acc, cur) => acc + cur.sctVND, 0)
        const totalVatVND = active.reduce((acc, cur) => acc + cur.vatVND, 0)
        const totalTaxVND = active.reduce((acc, cur) => acc + cur.totalTaxVND, 0)
        const totalLocalVND = active.reduce((acc, cur) => acc + cur.estimatedLocalVND, 0)
        const grandTotalLandedVND = active.reduce((acc, cur) => acc + cur.totalLandedCostVND, 0)

        // Tổng theo từng ngoại tệ
        const foreignTotals: Record<string, number> = {}
        for (const item of active) {
            foreignTotals[item.currency] = (foreignTotals[item.currency] || 0) + item.foreignAmount
        }

        // Tổng mốc dòng tiền
        const totalDeposit = active.reduce((acc, cur) => acc + cur.milestones.depositVND, 0)
        const totalFinalGoods = active.reduce((acc, cur) => acc + cur.milestones.finalGoodsVND, 0)
        const totalLogistics = active.reduce((acc, cur) => acc + cur.milestones.logisticsVND, 0)

        return {
            count: active.length,
            foreignTotals,
            totalGoodsVND,
            totalFreightVND,
            totalImportTaxVND,
            totalSctVND,
            totalVatVND,
            totalTaxVND,
            totalLocalVND,
            grandTotalLandedVND,
            milestones: {
                totalDeposit,
                totalFinalGoods,
                totalTax: totalTaxVND,
                totalLogistics,
            }
        }
    }, [calculatedItems])

    // Tab chuyển đổi góc nhìn trong Modal
    const [viewMode, setViewMode] = useState<'MATRIX' | 'TIMELINE' | 'TAX_BREAKDOWN'>('MATRIX')

    // Xuất dữ liệu dòng tiền ra CSV
    const exportCSV = () => {
        const active = calculatedItems.filter(item => item.isSelected)
        if (!active.length) return

        let csv = 'Mã PO,Nhà Cung Cấp,Incoterms,Đồng Tiền,Giá Trị Ngoại Tệ,Tỷ Giá Dự Kiến,Tiền Hàng (VND),Thuế NK (VND),Thuế TTĐB (VND),VAT (VND),Tổng Thuế (VND),Vận Tải & Cảng (VND),Tổng Chi Phí (Landed Cost VND)\n'
        for (const row of active) {
            csv += `"${row.po.poNo}","${row.po.supplierName}","${row.po.incoterms || '—'}","${row.currency}",${row.foreignAmount},${row.forecastRate},${row.goodsVND},${row.importTaxVND},${row.sctVND},${row.vatVND},${row.totalTaxVND},${row.estimatedFreightVND + row.estimatedLocalVND},${row.totalLandedCostVND}\n`
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `Ke_Hoach_Dong_Tien_PO_${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 md:p-6 overflow-hidden animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-7xl max-h-[94vh] rounded-md shadow-2xl flex flex-col border border-slate-200 overflow-hidden">
                
                {/* ── HEADER ──────────────────────────────────────────────── */}
                <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-lg bg-teal-100 text-teal-800">
                                <DollarSign size={20} />
                            </span>
                            <div>
                                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    Kế Hoạch Dòng Tiền & Dự Trù Chi Phí Lô Hàng
                                    <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 rounded-full whitespace-nowrap shrink-0">
                                        Mô Phỏng Thời Điểm
                                    </span>
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Linh động chọn PO cần thanh toán • Cấu hình tỷ giá dự kiến • Phân tách Tiền hàng, Thuế 3 tầng, Cước vận tải
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportCSV}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-all shadow-sm"
                            title="Tải bảng tính Excel/CSV"
                        >
                            <Download size={14} /> Xuất CSV
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                            aria-label="Đóng modal"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* ── THANH CÔNG CỤ: KỲ THỜI GIAN & SETUP TỶ GIÁ ───────────── */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    {/* Chọn Thời Điểm */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
                            <Calendar size={13} className="text-slate-500" /> Thời Điểm:
                        </span>
                        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm text-xs">
                            {[
                                { key: 'ALL_OPEN', label: 'Tất cả PO đang mở' },
                                { key: 'THIS_MONTH', label: 'Tháng này' },
                                { key: 'NEXT_MONTH', label: 'Tháng tới' },
                                { key: 'THIS_QUARTER', label: 'Quý này' },
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setPeriodFilter(tab.key as any)}
                                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                                        periodFilter === tab.key
                                            ? 'bg-teal-700 text-white font-semibold shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Setup Tỷ Giá & Cấu Hình % Thuế Dự Kiến */}
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Tỷ Giá */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
                                <TrendingUp size={13} className="text-teal-600" /> Tỷ Giá:
                            </span>
                            <div className="flex items-center gap-1.5">
                                {['USD', 'EUR', 'AUD'].map(curr => (
                                    <div key={curr} className="inline-flex items-center bg-white border border-slate-300 rounded-md px-2 py-1 shadow-xs text-xs whitespace-nowrap shrink-0">
                                        <span className="font-bold text-slate-500 mr-1">{curr}:</span>
                                        <input
                                            type="number"
                                            value={forecastRates[curr] || ''}
                                            onChange={e => {
                                                const val = Number(e.target.value) || 0
                                                setForecastRates(prev => ({ ...prev, [curr]: val }))
                                            }}
                                            className="w-16 font-mono font-bold text-slate-800 focus:outline-none focus:text-teal-700 text-right"
                                        />
                                        <span className="text-[10px] text-slate-400 ml-1">₫</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Cấu Hình % Thuế Dự Kiến */}
                        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                            <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
                                <Percent size={13} className="text-amber-600" /> % Thuế Chung:
                            </span>
                            <div className="flex items-center gap-1.5">
                                <div className="inline-flex items-center bg-white border border-slate-300 rounded-md px-2 py-1 shadow-xs text-xs whitespace-nowrap shrink-0" title="Thuế Nhập Khẩu">
                                    <span className="font-bold text-slate-500 mr-1">NK:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="any"
                                        value={globalTaxRates.importTax}
                                        onChange={e => {
                                            const val = e.target.value === '' ? 0 : Number(e.target.value)
                                            setGlobalTaxRates(p => ({ ...p, importTax: isNaN(val) ? 0 : val }))
                                        }}
                                        className="w-10 font-mono font-bold text-slate-800 focus:outline-none focus:text-amber-700 text-right"
                                    />
                                    <span className="text-[10px] text-slate-400 ml-0.5">%</span>
                                </div>
                                <div className="inline-flex items-center bg-white border border-amber-300 bg-amber-50/30 rounded-md px-2 py-1 shadow-xs text-xs whitespace-nowrap shrink-0" title="Thuế Tiêu Thụ Đặc Biệt">
                                    <span className="font-bold text-amber-800 mr-1">TTĐB:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="any"
                                        value={globalTaxRates.sct}
                                        onChange={e => {
                                            const val = e.target.value === '' ? 0 : Number(e.target.value)
                                            setGlobalTaxRates(p => ({ ...p, sct: isNaN(val) ? 0 : val }))
                                        }}
                                        className="w-10 font-mono font-bold text-amber-950 focus:outline-none focus:text-amber-700 text-right"
                                    />
                                    <span className="text-[10px] text-amber-600 ml-0.5">%</span>
                                </div>
                                <div className="inline-flex items-center bg-white border border-slate-300 rounded-md px-2 py-1 shadow-xs text-xs whitespace-nowrap shrink-0" title="Thuế Giá Trị Gia Tăng (VAT)">
                                    <span className="font-bold text-slate-500 mr-1">VAT:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="any"
                                        value={globalTaxRates.vat}
                                        onChange={e => {
                                            const val = e.target.value === '' ? 0 : Number(e.target.value)
                                            setGlobalTaxRates(p => ({ ...p, vat: isNaN(val) ? 0 : val }))
                                        }}
                                        className="w-10 font-mono font-bold text-slate-800 focus:outline-none focus:text-amber-700 text-right"
                                    />
                                    <span className="text-[10px] text-slate-400 ml-0.5">%</span>
                                </div>

                                <button
                                    onClick={() => {
                                        setForecastRates(DEFAULT_FORECAST_RATES)
                                        setGlobalTaxRates({ importTax: 20, sct: 65, vat: 10 })
                                        setPoTaxOverrides({})
                                    }}
                                    title="Đặt lại tỷ giá & thuế mặc định"
                                    className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"
                                >
                                    <RefreshCw size={13} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── BỘ 4 THẺ CHỈ SỐ TÀI CHÍNH TỔNG HỢP ──────────────────── */}
                <div className="px-6 py-3.5 bg-white border-b border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Thẻ 1: Tiền hàng */}
                    <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg">
                        <div className="flex items-center justify-between text-xs text-blue-700 font-semibold mb-1">
                            <span>1. Tiền Hàng (FOB/EXW)</span>
                            <span className="text-[11px] font-normal text-blue-600">
                                {totals.count} PO chọn
                            </span>
                        </div>
                        <div className="text-lg font-bold font-mono text-blue-900">
                            {formatVND(totals.totalGoodsVND)}
                        </div>
                        <div className="text-[11px] text-blue-600/80 font-mono mt-0.5 truncate">
                            {Object.entries(totals.foreignTotals).map(([c, a]) => `${a.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${c}`).join(' • ') || '0 ngoại tệ'}
                        </div>
                    </div>

                    {/* Thẻ 2: Thuế 3 tầng */}
                    <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg">
                        <div className="flex items-center justify-between text-xs text-amber-800 font-semibold mb-1">
                            <span>2. Thuế Hải Quan 3 Tầng</span>
                            <span className="inline-block text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold whitespace-nowrap shrink-0">
                                Nộp Kho Bạc
                            </span>
                        </div>
                        <div className="text-lg font-bold font-mono text-amber-900">
                            {formatVND(totals.totalTaxVND)}
                        </div>
                        <div className="text-[11px] text-amber-700 mt-0.5 flex gap-1">
                            <span>NK: {formatVND(totals.totalImportTaxVND)}</span>
                            <span>• TTĐB: {formatVND(totals.totalSctVND)}</span>
                            <span>• VAT: {formatVND(totals.totalVatVND)}</span>
                        </div>
                    </div>

                    {/* Thẻ 3: Vận chuyển & Cảng */}
                    <div className="p-3 bg-cyan-50/70 border border-cyan-100 rounded-lg">
                        <div className="flex items-center justify-between text-xs text-cyan-800 font-semibold mb-1">
                            <span>3. Logistics & Phí Cảng</span>
                            <span className="text-[11px] text-cyan-600">Cước biển + Local</span>
                        </div>
                        <div className="text-lg font-bold font-mono text-cyan-900">
                            {formatVND(totals.totalFreightVND + totals.totalLocalVND)}
                        </div>
                        <div className="text-[11px] text-cyan-700 mt-0.5">
                            Cước: {formatVND(totals.totalFreightVND)} • Cảng & Tem: {formatVND(totals.totalLocalVND)}
                        </div>
                    </div>

                    {/* Thẻ 4: TỔNG VỐN DÒNG TIỀN */}
                    <div className="p-3 bg-teal-900 text-white rounded-lg shadow-sm">
                        <div className="flex items-center justify-between text-xs text-teal-200 font-semibold mb-1">
                            <span>Tổng vốn dòng tiền (Landed Cost)</span>
                            <span className="inline-block text-[10px] bg-teal-800 text-teal-100 px-1.5 py-0.2 rounded font-mono whitespace-nowrap shrink-0">
                                100% Vốn
                            </span>
                        </div>
                        <div className="text-xl font-bold font-mono text-teal-50">
                            {formatVND(totals.grandTotalLandedVND)}
                        </div>
                        <div className="text-[11px] text-teal-700 mt-0.5 flex items-center justify-between">
                            <span>Hàng: {totals.grandTotalLandedVND > 0 ? Math.round((totals.totalGoodsVND / totals.grandTotalLandedVND) * 100) : 0}%</span>
                            <span>Thuế: {totals.grandTotalLandedVND > 0 ? Math.round((totals.totalTaxVND / totals.grandTotalLandedVND) * 100) : 0}%</span>
                            <span>Logistics: {totals.grandTotalLandedVND > 0 ? Math.round(((totals.totalFreightVND + totals.totalLocalVND) / totals.grandTotalLandedVND) * 100) : 0}%</span>
                        </div>
                    </div>
                </div>

                {/* ── THANH CHỌN TAB & THAO TÁC HÀNG LOẠT ─────────────────── */}
                <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setViewMode('MATRIX')}
                            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                                viewMode === 'MATRIX'
                                    ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Layers size={14} /> Ma Trận Đơn Hàng & Thêm/Bớt PO
                        </button>
                        <button
                            onClick={() => setViewMode('TIMELINE')}
                            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                                viewMode === 'TIMELINE'
                                    ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Calendar size={14} /> Lịch Dòng Tiền Theo 4 Mốc Giải Ngân
                        </button>
                        <button
                            onClick={() => setViewMode('TAX_BREAKDOWN')}
                            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                                viewMode === 'TAX_BREAKDOWN'
                                    ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <PieChart size={14} /> Bóc Tách Cơ Cấu Thuế Rượu Vang
                        </button>
                    </div>

                    <div className="flex items-center gap-2 text-slate-500">
                        <span>Đã chọn <strong className="text-teal-700">{totals.count}</strong> / {filteredPOs.length} PO</span>
                        <span className="text-slate-300">|</span>
                        <button
                            onClick={selectAll}
                            className="text-teal-700 hover:underline font-semibold"
                        >
                            Chọn tất cả
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                            onClick={deselectAll}
                            className="text-slate-500 hover:underline"
                        >
                            Bỏ chọn
                        </button>
                    </div>
                </div>

                {/* ── NỘI DUNG CHÍNH (CONTENT AREA) ───────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                    
                    {/* VIEW 1: MA TRẬN ĐƠN HÀNG VÀ BẬT/TẮT PO ─────────────── */}
                    {viewMode === 'MATRIX' && (
                        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                        <th className="p-3 w-10 text-center">
                                            <span className="sr-only">Chọn</span>
                                        </th>
                                        <th className="p-3">Mã PO & Pháp Nhân</th>
                                        <th className="p-3">Nhà Cung Cấp</th>
                                        <th className="p-3 text-center">Incoterms</th>
                                        <th className="p-3 text-right">Tiền Hàng (Ngoại Tệ)</th>
                                        <th className="p-3 text-right">Tỷ Giá Dự Kiến</th>
                                        <th className="p-3 text-right">Tiền Hàng (VNĐ)</th>
                                        <th className="p-3 text-right text-amber-800">Dự Trù Thuế 3 Tầng</th>
                                        <th className="p-3 text-right text-cyan-800">Cước & Cảng</th>
                                        <th className="p-3 text-right font-bold text-teal-800">Tổng Dự Trù Lô</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-mono">
                                    {calculatedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="p-8 text-center text-slate-400 font-sans">
                                                Không có đơn mua hàng nào phù hợp với bộ lọc thời điểm này.
                                            </td>
                                        </tr>
                                    ) : (
                                        calculatedItems.map(item => (
                                            <tr
                                                key={item.po.id}
                                                onClick={() => togglePo(item.po.id)}
                                                className={`transition-colors cursor-pointer ${
                                                    item.isSelected
                                                        ? 'bg-teal-50/20 hover:bg-teal-50/40'
                                                        : 'opacity-50 bg-slate-50/50 hover:opacity-80'
                                                }`}
                                            >
                                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={item.isSelected}
                                                        onChange={() => togglePo(item.po.id)}
                                                        className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="p-3 font-sans">
                                                    <div className="font-bold text-slate-800 flex items-center gap-1.5 font-mono">
                                                        {item.po.poNo}
                                                        {item.po.legalEntityCode && (
                                                            <span className="inline-block px-1.5 py-0.2 text-[10px] bg-slate-100 text-slate-600 rounded border border-slate-200 whitespace-nowrap shrink-0">
                                                                {item.po.legalEntityCode}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400">
                                                        {item.po.estimatedDelivery ? `ETA: ${new Date(item.po.estimatedDelivery).toLocaleDateString('vi-VN')}` : 'Chưa có ETA'}
                                                    </div>
                                                </td>
                                                <td className="p-3 font-sans">
                                                    <div className="font-medium text-slate-800 truncate max-w-[180px]" title={item.po.supplierName}>
                                                        {item.po.supplierName}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400">
                                                        {item.po.supplierCountry || 'EU'}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center font-sans">
                                                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 whitespace-nowrap shrink-0">
                                                        {item.po.incoterms || 'FOB'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right font-bold text-slate-800">
                                                    {item.foreignAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {item.currency}
                                                </td>
                                                <td className="p-3 text-right text-slate-500">
                                                    {item.forecastRate.toLocaleString('vi-VN')} ₫
                                                </td>
                                                <td className="p-3 text-right font-bold text-blue-900">
                                                    {formatVND(item.goodsVND)}
                                                </td>
                                                <td className="p-3 text-right text-amber-900 font-medium">
                                                    <div>{formatVND(item.totalTaxVND)}</div>
                                                    <div className="text-[10px] text-amber-700/80 font-normal">
                                                        NK {item.importTaxPct}% • TTĐB {item.sctPct}% • VAT {item.vatPct}%
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right text-cyan-900">
                                                    {formatVND(item.estimatedFreightVND + item.estimatedLocalVND)}
                                                </td>
                                                <td className="p-3 text-right font-bold text-teal-800">
                                                    {formatVND(item.totalLandedCostVND)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {calculatedItems.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-100/90 font-mono font-bold text-slate-800 border-t-2 border-slate-300">
                                            <td colSpan={6} className="p-3 text-right font-sans uppercase">
                                                Tổng Cộng Các PO Đã Chọn ({totals.count} đơn):
                                            </td>
                                            <td className="p-3 text-right text-blue-900">
                                                {formatVND(totals.totalGoodsVND)}
                                            </td>
                                            <td className="p-3 text-right text-amber-900">
                                                {formatVND(totals.totalTaxVND)}
                                            </td>
                                            <td className="p-3 text-right text-cyan-900">
                                                {formatVND(totals.totalFreightVND + totals.totalLocalVND)}
                                            </td>
                                            <td className="p-3 text-right text-teal-900 text-sm">
                                                {formatVND(totals.grandTotalLandedVND)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}

                    {/* VIEW 2: LỊCH DÒNG TIỀN THEO 4 MỐC NGHIỆP VỤ ──────────── */}
                    {viewMode === 'TIMELINE' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Mốc 1 */}
                                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                                            1
                                        </span>
                                        <h3 className="font-bold text-slate-800 text-xs">ĐỢT 1: ĐẶT CỌC KÝ PO</h3>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mb-3">
                                        Thanh toán 20% - 30% tiền hàng ngoại tệ ngay khi ký hợp đồng mua hàng với Nhà sản xuất.
                                    </p>
                                    <div className="text-lg font-bold font-mono text-blue-900 mb-1">
                                        {formatVND(totals.milestones.totalDeposit)}
                                    </div>
                                    <span className="inline-block text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-semibold whitespace-nowrap shrink-0">
                                        Tiền mặt ngoại tệ
                                    </span>
                                </div>

                                {/* Mốc 2 */}
                                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                                            2
                                        </span>
                                        <h3 className="font-bold text-slate-800 text-xs">ĐỢT 2: TIỀN HÀNG CÒN LẠI</h3>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mb-3">
                                        Thanh toán 70% - 80% trước khi lấy Bill of Lading gốc hoặc giải phóng điện tử (Telex Release).
                                    </p>
                                    <div className="text-lg font-bold font-mono text-sky-900 mb-1">
                                        {formatVND(totals.milestones.totalFinalGoods)}
                                    </div>
                                    <span className="inline-block text-[10px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded font-semibold whitespace-nowrap shrink-0">
                                        Khi tàu khởi hành (ETD)
                                    </span>
                                </div>

                                {/* Mốc 3 */}
                                <div className="bg-white border border-amber-200 rounded-lg p-4 shadow-xs bg-amber-50/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                                            3
                                        </span>
                                        <h3 className="font-bold text-slate-800 text-xs">ĐỢT 3: THUẾ HẢI QUAN</h3>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mb-3">
                                        Bắt buộc nộp tiền mặt vào Kho Bạc Nhà Nước (Thuế NK + TTĐB 65% + VAT 10%) để thông quan.
                                    </p>
                                    <div className="text-lg font-bold font-mono text-amber-900 mb-1">
                                        {formatVND(totals.milestones.totalTax)}
                                    </div>
                                    <span className="inline-block text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-semibold whitespace-nowrap shrink-0">
                                        Trước ngày cập cảng (ETA)
                                    </span>
                                </div>

                                {/* Mốc 4 */}
                                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-xs">
                                            4
                                        </span>
                                        <h3 className="font-bold text-slate-800 text-xs">ĐỢT 4: LOGISTICS & CẢNG</h3>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mb-3">
                                        Cước tàu biển Forwarder, phí lưu cont THC/DO, cước kéo xe cont về kho và chi phí dán tem.
                                    </p>
                                    <div className="text-lg font-bold font-mono text-cyan-900 mb-1">
                                        {formatVND(totals.milestones.totalLogistics)}
                                    </div>
                                    <span className="inline-block text-[10px] text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded font-semibold whitespace-nowrap shrink-0">
                                        Khi giao hàng về kho
                                    </span>
                                </div>
                            </div>

                            {/* Bảng chi tiết từng đợt của các PO */}
                            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
                                <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase flex items-center gap-2">
                                    <Info size={14} className="text-teal-700" /> Kế Hoạch Chuẩn Bị Tiền Mặt Chi Tiết Theo Từng Đơn
                                </h4>
                                <div className="divide-y divide-slate-100">
                                    {calculatedItems.filter(i => i.isSelected).map(item => (
                                        <div key={item.po.id} className="py-2.5 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono font-bold text-teal-800 w-24">
                                                    {item.po.poNo}
                                                </span>
                                                <span className="text-slate-700 max-w-[200px] truncate" title={item.po.supplierName}>
                                                    {item.po.supplierName}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-4 gap-4 text-right font-mono text-[11px]">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block font-sans">1. Cọc (30%)</span>
                                                    <span className="text-blue-800 font-semibold">{formatVND(item.milestones.depositVND)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block font-sans">2. Hàng (70%)</span>
                                                    <span className="text-sky-800 font-semibold">{formatVND(item.milestones.finalGoodsVND)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block font-sans">3. Thuế Hải Quan</span>
                                                    <span className="text-amber-800 font-bold">{formatVND(item.milestones.taxVND)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block font-sans">4. Logistics & Cảng</span>
                                                    <span className="text-cyan-800">{formatVND(item.milestones.logisticsVND)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW 3: BÓC TÁCH CƠ CẤU THUẾ 3 TẦNG ────────────────── */}
                    {viewMode === 'TAX_BREAKDOWN' && (
                        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
                            <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                                <h4 className="font-bold flex items-center gap-1.5 text-amber-950">
                                    <HelpCircle size={15} /> Công Thức Tính Thuế Rượu Vang Nhập Khẩu Vào Việt Nam (3 Tầng Thuế Lồng Ghép):
                                </h4>
                                <p>• <strong>Thuế Nhập Khẩu</strong> = Giá CIF × Thuế suất NK (ước tính 20% theo C/O Form EUR.1 EVFTA).</p>
                                <p>• <strong>Thuế Tiêu Thụ Đặc Biệt (TTĐB 65%)</strong> = (Giá CIF + Thuế Nhập Khẩu) × 65%.</p>
                                <p>• <strong>Thuế Giá Trị Gia Tăng (VAT 10%)</strong> = (Giá CIF + Thuế Nhập Khẩu + Thuế TTĐB) × 10%.</p>
                                <p className="text-[11px] text-amber-700 italic pt-1">
                                    * Toàn bộ 3 loại thuế trên được nộp cùng lúc tại thời điểm mở tờ khai hải quan trước khi thông quan lấy hàng.
                                </p>
                            </div>

                            <table className="w-full text-left text-xs border-collapse font-mono">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                        <th className="p-2.5 font-sans">Mã PO</th>
                                        <th className="p-2.5 font-sans">Giá Tính Thuế (CIF)</th>
                                        <th className="p-2.5 text-center font-sans">Thuế NK (%)</th>
                                        <th className="p-2.5 text-center font-sans">Thuế TTĐB (%)</th>
                                        <th className="p-2.5 text-center font-sans">Thuế VAT (%)</th>
                                        <th className="p-2.5 text-right font-bold text-amber-900 font-sans">Tổng Thuế Phải Nộp</th>
                                        <th className="p-2.5 text-right font-sans">Tỷ Trọng / CIF</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {calculatedItems.filter(i => i.isSelected).map(item => {
                                        const taxRatio = item.cifVND > 0 ? Math.round((item.totalTaxVND / item.cifVND) * 100) : 0
                                        const hasCustomTax = !!poTaxOverrides[item.po.id]
                                        return (
                                            <tr key={item.po.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-2.5 font-bold text-slate-800">
                                                    <div>{item.po.poNo}</div>
                                                    {hasCustomTax && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setPoTaxOverrides(prev => {
                                                                    const next = { ...prev }
                                                                    delete next[item.po.id]
                                                                    return next
                                                                })
                                                            }}
                                                            className="text-[10px] font-normal text-teal-700 hover:underline"
                                                            title="Xoá thuế riêng, quay lại dùng % thuế chung"
                                                        >
                                                            ↩ Dùng % chung
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-slate-700">
                                                    {formatVND(item.cifVND)}
                                                </td>

                                                {/* Thuế NK có thể tự do chỉnh % */}
                                                <td className="p-2.5 text-center">
                                                    <div className="inline-flex items-center bg-white border border-slate-300 rounded px-1.5 py-0.5 shadow-xs">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="any"
                                                            value={item.importTaxPct}
                                                            onChange={e => {
                                                                const val = e.target.value === '' ? 0 : Number(e.target.value)
                                                                updatePoTax(item.po.id, 'importTax', isNaN(val) ? 0 : val)
                                                            }}
                                                            className="w-11 text-right font-bold font-mono text-slate-800 text-xs focus:outline-none"
                                                        />
                                                        <span className="text-[10px] text-slate-400 ml-0.5">%</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                        {formatVND(item.importTaxVND)}
                                                    </div>
                                                </td>

                                                {/* Thuế TTĐB có thể tự do chỉnh % */}
                                                <td className="p-2.5 text-center">
                                                    <div className="inline-flex items-center bg-amber-50 border border-amber-300 rounded px-1.5 py-0.5 shadow-xs">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="any"
                                                            value={item.sctPct}
                                                            onChange={e => {
                                                                const val = e.target.value === '' ? 0 : Number(e.target.value)
                                                                updatePoTax(item.po.id, 'sct', isNaN(val) ? 0 : val)
                                                            }}
                                                            className="w-11 text-right font-bold font-mono text-amber-950 text-xs focus:outline-none"
                                                        />
                                                        <span className="text-[10px] text-amber-700 ml-0.5">%</span>
                                                    </div>
                                                    <div className="text-[10px] text-amber-800 mt-0.5 font-semibold">
                                                        {formatVND(item.sctVND)}
                                                    </div>
                                                </td>

                                                {/* Thuế VAT có thể tự do chỉnh % */}
                                                <td className="p-2.5 text-center">
                                                    <div className="inline-flex items-center bg-white border border-slate-300 rounded px-1.5 py-0.5 shadow-xs">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="any"
                                                            value={item.vatPct}
                                                            onChange={e => {
                                                                const val = e.target.value === '' ? 0 : Number(e.target.value)
                                                                updatePoTax(item.po.id, 'vat', isNaN(val) ? 0 : val)
                                                            }}
                                                            className="w-11 text-right font-bold font-mono text-slate-800 text-xs focus:outline-none"
                                                        />
                                                        <span className="text-[10px] text-slate-400 ml-0.5">%</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                        {formatVND(item.vatVND)}
                                                    </div>
                                                </td>

                                                <td className="p-2.5 text-right font-bold text-amber-950 text-sm">
                                                    {formatVND(item.totalTaxVND)}
                                                </td>
                                                <td className="p-2.5 text-right font-bold text-slate-600">
                                                    +{taxRatio}%
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                        <td className="p-2.5 font-sans uppercase">Tổng Cộng:</td>
                                        <td className="p-2.5 text-slate-900">{formatVND(totals.totalGoodsVND + totals.totalFreightVND)}</td>
                                        <td className="p-2.5 text-right text-slate-900">{formatVND(totals.totalImportTaxVND)}</td>
                                        <td className="p-2.5 text-right text-amber-900">{formatVND(totals.totalSctVND)}</td>
                                        <td className="p-2.5 text-right text-slate-900">{formatVND(totals.totalVatVND)}</td>
                                        <td className="p-2.5 text-right text-amber-950 text-sm">{formatVND(totals.totalTaxVND)}</td>
                                        <td className="p-2.5 text-right text-slate-700">
                                            +{totals.totalGoodsVND + totals.totalFreightVND > 0 ? Math.round((totals.totalTaxVND / (totals.totalGoodsVND + totals.totalFreightVND)) * 100) : 0}%
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                </div>

                {/* ── FOOTER ──────────────────────────────────────────────── */}
                <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs">
                    <div className="text-slate-500 flex items-center gap-1.5">
                        <Info size={14} className="text-teal-700" />
                        <span>Mẹo: Bạn có thể thay đổi tỷ giá trực tiếp ở thanh trên để xem dự trù dòng tiền biến động theo thời gian thực.</span>
                    </div>

                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-md transition-all shadow-sm"
                    >
                        Hoàn tất & Đóng
                    </button>
                </div>

            </div>
        </div>
    )
}
