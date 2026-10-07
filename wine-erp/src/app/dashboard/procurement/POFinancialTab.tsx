'use client'

import React, { useState, useMemo } from 'react'
import {
    DollarSign, TrendingUp, Ship, FileText, CheckCircle2,
    Clock, HelpCircle, Layers, ArrowRight
} from 'lucide-react'
import type { PODetail } from './types'
import { formatVND } from '@/lib/utils'

interface POFinancialTabProps {
    po: PODetail
}

export function POFinancialTab({ po }: POFinancialTabProps) {
    // Cho phép setup tỷ giá dự kiến cho PO này
    const defaultRate = po.exchangeRate || (po.currency === 'EUR' ? 27200 : po.currency === 'USD' ? 25450 : 1)
    const [forecastRate, setForecastRate] = useState<number>(defaultRate)

    // Cho phép tự do điền % các loại thuế (mặc định: NK 20%, TTĐB 65%, VAT 10%)
    const [importTaxPct, setImportTaxPct] = useState<number>(20)
    const [sctPct, setSctPct] = useState<number>(65)
    const [vatPct, setVatPct] = useState<number>(10)

    // Tính toán dự trù chi phí & thuế cho đơn hàng này
    const calc = useMemo(() => {
        const foreignAmount = po.totalAmount || 0
        const rate = forecastRate > 0 ? forecastRate : 1
        const goodsVND = Math.round(foreignAmount * rate)

        // Phí cước quốc tế ước tính (Nếu Incoterms là EXW/FOB -> khoảng 7% tiền hàng)
        const isIncoIncluded = po.incoterms === 'CIF' || po.incoterms === 'DDP'
        const freightRate = isIncoIncluded ? 0 : 0.07
        const estimatedFreightVND = Math.round(goodsVND * freightRate)

        const cifVND = goodsVND + estimatedFreightVND

        // Thuế 3 tầng tùy chỉnh %
        const importTaxRate = (importTaxPct || 0) / 100
        const importTaxVND = Math.round(cifVND * importTaxRate)

        const sctBaseVND = cifVND + importTaxVND
        const sctRate = (sctPct || 0) / 100
        const sctVND = Math.round(sctBaseVND * sctRate)

        const vatBaseVND = sctBaseVND + sctVND
        const vatRate = (vatPct || 0) / 100
        const vatVND = Math.round(vatBaseVND * vatRate)

        const totalTaxVND = importTaxVND + sctVND + vatVND

        // Phí nội địa, kiểm dịch, kéo xe, tem rượu
        const estimatedLocalVND = Math.max(10000000, Math.round(goodsVND * 0.03))

        // Tổng chi phí (Landed Cost)
        const grandTotalLandedVND = goodsVND + estimatedFreightVND + totalTaxVND + estimatedLocalVND

        // Chi phí trung bình mỗi chai
        const totalBottles = po.lines.reduce((acc, l) => acc + l.qtyOrdered, 0)
        const landedCostPerBottle = totalBottles > 0 ? Math.round(grandTotalLandedVND / totalBottles) : 0

        // 4 Mốc giải ngân
        const depositAmount = Math.round(goodsVND * 0.30)
        const finalGoodsAmount = goodsVND - depositAmount

        return {
            goodsVND,
            estimatedFreightVND,
            cifVND,
            importTaxVND,
            sctVND,
            vatVND,
            totalTaxVND,
            estimatedLocalVND,
            grandTotalLandedVND,
            landedCostPerBottle,
            totalBottles,
            milestones: [
                {
                    step: 1,
                    title: 'Đợt 1: Đặt Cọc Hợp Đồng (30%)',
                    desc: 'Thanh toán ngoại tệ ngay khi ký kết PO với Nhà sản xuất.',
                    amountVND: depositAmount,
                    foreignAmount: foreignAmount * 0.30,
                    status: po.status !== 'DRAFT' ? 'PAID' : 'PLANNED',
                    date: po.createdAt ? new Date(po.createdAt).toLocaleDateString('vi-VN') : '—',
                },
                {
                    step: 2,
                    title: 'Đợt 2: Tiền Hàng Còn Lại (70%)',
                    desc: 'Thanh toán ngoại tệ khi xuất xưởng hoặc nhận Vận đơn (Bill of Lading).',
                    amountVND: finalGoodsAmount,
                    foreignAmount: foreignAmount * 0.70,
                    status: ['IN_TRANSIT', 'RECEIVED', 'PARTIALLY_RECEIVED'].includes(po.status) ? 'PAID' : 'PLANNED',
                    date: 'Trước khi tàu rời cảng (ETD)',
                },
                {
                    step: 3,
                    title: 'Đợt 3: Nộp Thuế Hải Quan 3 Tầng',
                    desc: `Nộp tiền mặt VNĐ vào Kho bạc: Thuế NK (${importTaxPct}%) + TTĐB (${sctPct}%) + VAT (${vatPct}%).`,
                    amountVND: totalTaxVND,
                    foreignAmount: null,
                    status: ['RECEIVED', 'PARTIALLY_RECEIVED'].includes(po.status) ? 'PAID' : 'PLANNED',
                    date: po.estimatedDelivery ? `Trước ngày ${new Date(po.estimatedDelivery).toLocaleDateString('vi-VN')} (ETA)` : 'Trước khi cập cảng',
                },
                {
                    step: 4,
                    title: 'Đợt 4: Logistics Cảng & Kéo Hàng Về Kho',
                    desc: 'Cước tàu biển Forwarder + Phí THC/DO + Kéo xe cont lạnh + Chi phí tem nhãn rượu.',
                    amountVND: estimatedFreightVND + estimatedLocalVND,
                    foreignAmount: null,
                    status: po.status === 'RECEIVED' ? 'PAID' : 'PLANNED',
                    date: 'Khi hàng giao về kho',
                }
            ]
        }
    }, [po, forecastRate, importTaxPct, sctPct, vatPct])

    return (
        <div className="space-y-4">
            {/* Thanh chỉnh Tỷ Giá Dự Kiến cho riêng PO này */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-md bg-teal-100 text-teal-800">
                        <TrendingUp size={16} />
                    </span>
                    <div>
                        <div className="text-xs font-bold text-slate-800">
                            Cấu Hình Tỷ Giá Dự Kiến ({po.currency} / VNĐ)
                        </div>
                        <div className="text-[11px] text-slate-500">
                            Thay đổi tỷ giá dự trù để mô phỏng tức thì tác động lên chi phí & thuế của lô hàng
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">1 {po.currency} =</span>
                    <input
                        type="number"
                        value={forecastRate || ''}
                        onChange={e => setForecastRate(Number(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-xs font-mono font-bold text-teal-900 border border-slate-300 rounded bg-white text-right focus:ring-1 focus:ring-teal-600 focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500">₫</span>
                    <button
                        onClick={() => setForecastRate(defaultRate)}
                        className="text-[11px] text-teal-700 hover:underline font-semibold ml-1"
                        title="Đặt lại tỷ giá mặc định lúc tạo PO"
                    >
                        Mặc định
                    </button>
                </div>
            </div>

            {/* 4 Thẻ KPI Tài chính của PO */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg">
                    <span className="text-[11px] font-bold text-blue-800 uppercase block">1. Tiền Hàng (FOB)</span>
                    <span className="font-mono text-base font-bold text-blue-900 block mt-0.5">
                        {formatVND(calc.goodsVND)}
                    </span>
                    <span className="text-[10px] text-blue-600 font-mono block">
                        {po.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {po.currency}
                    </span>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg">
                    <span className="text-[11px] font-bold text-amber-800 uppercase block">2. Thuế Hải Quan 3 Tầng</span>
                    <span className="font-mono text-base font-bold text-amber-900 block mt-0.5">
                        {formatVND(calc.totalTaxVND)}
                    </span>
                    <span className="text-[10px] text-amber-700 block">
                        NK + TTĐB (65%) + VAT
                    </span>
                </div>

                <div className="p-3 bg-cyan-50/70 border border-cyan-100 rounded-lg">
                    <span className="text-[11px] font-bold text-cyan-800 uppercase block">3. Vận Tải & Phí Cảng</span>
                    <span className="font-mono text-base font-bold text-cyan-900 block mt-0.5">
                        {formatVND(calc.estimatedFreightVND + calc.estimatedLocalVND)}
                    </span>
                    <span className="text-[10px] text-cyan-700 block">
                        Cước tàu + THC/DO + Tem
                    </span>
                </div>

                <div className="p-3 bg-teal-900 text-white rounded-lg">
                    <span className="text-[11px] font-bold text-teal-200 uppercase block">🎯 Tổng Dự Trù Lô (Landed)</span>
                    <span className="font-mono text-base font-bold text-white block mt-0.5">
                        {formatVND(calc.grandTotalLandedVND)}
                    </span>
                    <span className="text-[10px] text-teal-300 font-mono block">
                        ~{formatVND(calc.landedCostPerBottle)} / chai ({calc.totalBottles} chai)
                    </span>
                </div>
            </div>

            {/* Thanh tỷ trọng cơ cấu chi phí */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Cơ Cấu Tỷ Trọng Chi Phí Về Kho (Landed Cost Breakdown):</span>
                    <span className="text-teal-800 font-mono">100% Tổng Chi Phí</span>
                </div>

                {calc.grandTotalLandedVND > 0 && (
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                        <div
                            style={{ width: `${(calc.goodsVND / calc.grandTotalLandedVND) * 100}%` }}
                            className="bg-blue-600 h-full"
                            title={`Tiền hàng: ${Math.round((calc.goodsVND / calc.grandTotalLandedVND) * 100)}%`}
                        />
                        <div
                            style={{ width: `${(calc.totalTaxVND / calc.grandTotalLandedVND) * 100}%` }}
                            className="bg-amber-500 h-full"
                            title={`Thuế Hải quan: ${Math.round((calc.totalTaxVND / calc.grandTotalLandedVND) * 100)}%`}
                        />
                        <div
                            style={{ width: `${((calc.estimatedFreightVND + calc.estimatedLocalVND) / calc.grandTotalLandedVND) * 100}%` }}
                            className="bg-cyan-600 h-full"
                            title={`Logistics: ${Math.round(((calc.estimatedFreightVND + calc.estimatedLocalVND) / calc.grandTotalLandedVND) * 100)}%`}
                        />
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 pt-1">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        Tiền hàng: <strong>{calc.grandTotalLandedVND > 0 ? Math.round((calc.goodsVND / calc.grandTotalLandedVND) * 100) : 0}%</strong> ({formatVND(calc.goodsVND)})
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        Thuế 3 tầng: <strong>{calc.grandTotalLandedVND > 0 ? Math.round((calc.totalTaxVND / calc.grandTotalLandedVND) * 100) : 0}%</strong> ({formatVND(calc.totalTaxVND)})
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-600" />
                        Logistics: <strong>{calc.grandTotalLandedVND > 0 ? Math.round(((calc.estimatedFreightVND + calc.estimatedLocalVND) / calc.grandTotalLandedVND) * 100) : 0}%</strong> ({formatVND(calc.estimatedFreightVND + calc.estimatedLocalVND)})
                    </span>
                </div>
            </div>

            {/* Bảng Chi Tiết Thuế 3 Tầng - Cho phép tự do điền % */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3">
                <div className="text-xs font-bold text-slate-800 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                        <FileText size={14} className="text-amber-700" /> Bóc Tách Dự Trù 3 Tầng Thuế (Tự Do Điều Chỉnh %)
                    </span>
                    <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        Nhập trực tiếp % để mô phỏng
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-mono text-xs">
                    {/* Thuế Nhập Khẩu */}
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between font-sans">
                            <span className="text-[10px] text-slate-600 font-bold">1. Thuế Nhập Khẩu</span>
                            <div className="flex items-center bg-white border border-slate-300 rounded px-1.5 py-0.5 shadow-xs">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="any"
                                    value={importTaxPct}
                                    onChange={e => {
                                        const val = e.target.value === '' ? 0 : Number(e.target.value)
                                        setImportTaxPct(isNaN(val) ? 0 : val)
                                    }}
                                    className="w-12 text-right font-bold font-mono text-slate-800 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-400 ml-0.5">%</span>
                            </div>
                        </div>
                        <div className="text-sm font-bold text-slate-900 mt-1">{formatVND(calc.importTaxVND)}</div>
                        <div className="text-[10px] text-slate-500 font-sans">{importTaxPct}% × CIF ({formatVND(calc.cifVND)})</div>
                        <div className="flex gap-1 pt-1 font-sans text-[10px]">
                            {[0, 12, 20, 50].map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setImportTaxPct(p)}
                                    className={`px-1.5 py-0.2 rounded border text-[9px] transition-all ${
                                        importTaxPct === p
                                            ? 'bg-slate-800 text-white border-slate-800 font-bold'
                                             : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {p === 0 ? '0% EVFTA' : `${p}%`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Thuế TTĐB */}
                    <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-200 space-y-1">
                        <div className="flex items-center justify-between font-sans">
                            <span className="text-[10px] text-amber-900 font-bold">2. Thuế TTĐB</span>
                            <div className="flex items-center bg-white border border-amber-300 rounded px-1.5 py-0.5 shadow-xs">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="any"
                                    value={sctPct}
                                    onChange={e => {
                                        const val = e.target.value === '' ? 0 : Number(e.target.value)
                                        setSctPct(isNaN(val) ? 0 : val)
                                    }}
                                    className="w-12 text-right font-bold font-mono text-amber-950 focus:outline-none"
                                />
                                <span className="text-[10px] text-amber-600 ml-0.5">%</span>
                            </div>
                        </div>
                        <div className="text-sm font-bold text-amber-900 mt-1">{formatVND(calc.sctVND)}</div>
                        <div className="text-[10px] text-amber-700 font-sans">{sctPct}% × (CIF + Thuế NK)</div>
                        <div className="flex gap-1 pt-1 font-sans text-[10px]">
                            {[35, 65].map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setSctPct(p)}
                                    className={`px-1.5 py-0.2 rounded border text-[9px] transition-all ${
                                        sctPct === p
                                            ? 'bg-amber-800 text-white border-amber-800 font-bold'
                                            : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-100'
                                    }`}
                                >
                                    {p}% {p === 65 ? '(Rượu vang)' : ''}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Thuế VAT */}
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between font-sans">
                            <span className="text-[10px] text-slate-600 font-bold">3. Thuế GTGT (VAT)</span>
                            <div className="flex items-center bg-white border border-slate-300 rounded px-1.5 py-0.5 shadow-xs">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="any"
                                    value={vatPct}
                                    onChange={e => {
                                        const val = e.target.value === '' ? 0 : Number(e.target.value)
                                        setVatPct(isNaN(val) ? 0 : val)
                                    }}
                                    className="w-12 text-right font-bold font-mono text-slate-800 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-400 ml-0.5">%</span>
                            </div>
                        </div>
                        <div className="text-sm font-bold text-slate-800 mt-1">{formatVND(calc.vatVND)}</div>
                        <div className="text-[10px] text-slate-500 font-sans">{vatPct}% × (CIF + NK + TTĐB)</div>
                        <div className="flex gap-1 pt-1 font-sans text-[10px]">
                            {[0, 8, 10].map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setVatPct(p)}
                                    className={`px-1.5 py-0.2 rounded border text-[9px] transition-all ${
                                        vatPct === p
                                            ? 'bg-slate-800 text-white border-slate-800 font-bold'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {p}%
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bảng Kế Hoạch 4 Mốc Giải Ngân Dòng Tiền */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3">
                <div className="text-xs font-bold text-slate-800 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-teal-700" /> Kế Hoạch 4 Đợt Giải Ngân Dòng Tiền Của Đơn Hàng
                    </span>
                    <span className="text-[11px] font-semibold text-teal-700">
                        Tổng tiền mặt cần chuẩn bị: {formatVND(calc.grandTotalLandedVND)}
                    </span>
                </div>

                <div className="space-y-2">
                    {calc.milestones.map(ms => (
                        <div
                            key={ms.step}
                            className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                        >
                            <div className="flex items-start gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                    ms.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                }`}>
                                    {ms.step}
                                </span>
                                <div>
                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                        {ms.title}
                                        {ms.status === 'PAID' ? (
                                            <span className="px-1.5 py-0.2 text-[10px] bg-emerald-100 text-emerald-800 font-semibold rounded flex items-center gap-1">
                                                <CheckCircle2 size={10} /> Đã hoàn thành
                                            </span>
                                        ) : (
                                            <span className="px-1.5 py-0.2 text-[10px] bg-slate-200 text-slate-600 font-semibold rounded">
                                                Dự kiến
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                        {ms.desc}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                        Thời điểm: <span className="font-medium text-slate-600">{ms.date}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-right font-mono">
                                <div className="text-sm font-bold text-slate-900">
                                    {formatVND(ms.amountVND)}
                                </div>
                                {ms.foreignAmount !== null && (
                                    <div className="text-[10px] text-slate-500">
                                        {ms.foreignAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {po.currency}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
