'use client'

import React, { useState } from 'react'
import { Calendar, TrendingUp, ShoppingBag, DollarSign, Award, Clock } from 'lucide-react'
import { formatVND } from '@/lib/utils'
import type { DailyRevenueSummary, DailyRevenueItem } from './actions'

interface Props {
    data: DailyRevenueSummary
}

function formatCompactVND(amount: number): string {
    if (!amount || amount === 0) return ''
    if (amount >= 1_000_000_000) {
        return `${(amount / 1_000_000_000).toFixed(1)}B`
    }
    if (amount >= 1_000_000) {
        return `${(amount / 1_000_000).toFixed(1)}M`
    }
    if (amount >= 1_000) {
        return `${(amount / 1_000).toFixed(0)}k`
    }
    return `${amount}`
}

export function DailyRevenueChart({ data }: Props) {
    const [hoveredItem, setHoveredItem] = useState<DailyRevenueItem | null>(null)
    const { items, totalRevenue, totalOrders, avgOrderValue, peakDay } = data

    const maxRevenue = Math.max(...items.map((it) => it.revenue), 1)
    const isSingleDay = items.length === 1

    return (
        <div
            className="rounded-lg p-5 space-y-4"
            style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
            }}
        >
            {/* ─── Header ─── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-[#0891B2]" />
                    <h3 className="font-semibold text-sm text-slate-900">Biến Động Doanh Số Theo Ngày</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#87CBB9]/10 text-[#0891B2] border border-[#87CBB9]/20">
                        {items.length} ngày
                    </span>
                </div>
                {peakDay && (
                    <div className="flex items-center gap-1.5 text-xs text-[#D4A853] bg-[#D4A853]/10 px-2.5 py-1 rounded-md border border-[#D4A853]/25 font-medium">
                        <Award size={13} />
                        <span>Đỉnh kỳ:</span>
                        <strong>{peakDay.label}</strong>
                        <span>({formatVND(peakDay.revenue)})</span>
                    </div>
                )}
            </div>

            {/* ─── 4 Quick Summary Pills ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white p-3 rounded-md border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">
                        Tổng Doanh Số Kỳ
                    </span>
                    <span className="text-base font-bold text-[#0891B2] font-mono">
                        {formatVND(totalRevenue)}
                    </span>
                </div>
                <div className="bg-white p-3 rounded-md border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">
                        Tổng Đơn Hàng
                    </span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                        {totalOrders} đơn
                    </span>
                </div>
                <div className="bg-white p-3 rounded-md border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">
                        Giá Trị TB / Đơn (AOV)
                    </span>
                    <span className="text-base font-bold text-[#D4A853] font-mono">
                        {formatVND(avgOrderValue)}
                    </span>
                </div>
                <div className="bg-white p-3 rounded-md border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">
                        Ngày Cao Điểm Nhất
                    </span>
                    <span className="text-base font-bold text-[#5BA88A] font-mono truncate block">
                        {peakDay ? peakDay.label : '—'}
                    </span>
                </div>
            </div>

            {/* ─── Main Chart Visual ─── */}
            {items.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                    Không có dữ liệu trong khoảng thời gian đã chọn
                </div>
            ) : isSingleDay ? (
                /* Single Day View (e.g. Today / Yesterday) */
                <div className="bg-white p-5 rounded-lg border border-slate-200 text-center space-y-3">
                    <p className="text-xs text-slate-600 font-medium">
                        Chi tiết ngày <strong className="text-slate-900">{items[0].label}</strong> ({items[0].dayOfWeek})
                    </p>
                    <div className="flex items-center justify-center gap-6">
                        <div>
                            <span className="text-[10px] uppercase text-slate-500 block">Doanh thu ngày</span>
                            <span className="text-2xl font-bold text-[#0891B2] font-mono">
                                {formatVND(items[0].revenue)}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-[#E2E8F0]" />
                        <div>
                            <span className="text-[10px] uppercase text-slate-500 block">Số đơn phát sinh</span>
                            <span className="text-2xl font-bold text-slate-900 font-mono">
                                {items[0].orderCount} đơn
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                /* Multi-Day Bar Chart View */
                <div className="space-y-2 pt-2">
                    <div className="flex items-end gap-1 sm:gap-1.5 h-44 w-full px-1 overflow-x-auto">
                        {items.map((it) => {
                            const isPeak = peakDay && it.date === peakDay.date && it.revenue > 0
                            const heightPct = maxRevenue > 0 ? (it.revenue / maxRevenue) * 100 : 0
                            const barHeight = Math.max(it.revenue > 0 ? 8 : 2, (heightPct / 100) * 130)

                            const barColor = isPeak
                                ? '#D4A853'
                                : heightPct > 60
                                ? '#87CBB9'
                                : heightPct > 20
                                ? '#5BA88A'
                                : it.revenue > 0
                                ? '#4A8FAB'
                                : it.isWeekend
                                ? '#223847'
                                : '#1E3342'

                            return (
                                <div
                                    key={it.date}
                                    onMouseEnter={() => setHoveredItem(it)}
                                    onMouseLeave={() => setHoveredItem(null)}
                                    className="flex-1 min-w-[14px] flex flex-col items-center justify-end h-full group relative cursor-pointer"
                                >
                                    {/* Number pill above bar on hover / peak */}
                                    <div
                                        className={`text-[9px] font-mono font-bold transition-all mb-1 truncate text-center ${
                                            isPeak
                                                ? 'text-[#D4A853]'
                                                : it.revenue > 0
                                                ? 'text-[#0891B2]'
                                                : 'text-transparent'
                                        }`}
                                    >
                                        {formatCompactVND(it.revenue)}
                                    </div>

                                    {/* Bar element */}
                                    <div
                                        className="w-full rounded-t-sm transition-all duration-300 group-hover:opacity-100 group-hover:scale-x-110"
                                        style={{
                                            height: `${barHeight}px`,
                                            background: barColor,
                                            boxShadow: isPeak
                                                ? '0 0 10px rgba(212,168,83,0.35)'
                                                : undefined,
                                        }}
                                    />

                                    {/* Day label */}
                                    <span
                                        className={`text-[9px] sm:text-[10px] mt-1.5 transition-colors text-center ${
                                            it.isWeekend ? 'text-[#D4A853]/70 font-medium' : 'text-slate-500'
                                        } group-hover:text-slate-900`}
                                    >
                                        {items.length > 20
                                            ? it.label.split('/')[0] // Only show day e.g. "01", "15"
                                            : it.label}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* ── Hover Tooltip Banner ── */}
                    <div
                        className="p-2.5 rounded-md border flex items-center justify-between text-xs min-h-[38px] transition-all"
                        style={{
                            background: '#FFFFFF',
                            borderColor: hoveredItem ? '#87CBB9' : '#E2E8F0',
                        }}
                    >
                        {hoveredItem ? (
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-900">
                                        {hoveredItem.dayOfWeek}, ngày {hoveredItem.date}
                                    </span>
                                    {hoveredItem.isWeekend && (
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#D4A853]/15 text-[#D4A853]">
                                            Cuối tuần
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-slate-600">
                                        Số đơn:{' '}
                                        <strong className="text-slate-900">{hoveredItem.orderCount}</strong>
                                    </span>
                                    <span className="text-[#0891B2] font-bold text-sm font-mono">
                                        {formatVND(hoveredItem.revenue)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-[11px] text-slate-500 italic flex items-center gap-1.5">
                                <Clock size={12} />
                                <span>Rê chuột vào từng cột để xem chi tiết doanh số và số lượng đơn hàng của ngày đó</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
