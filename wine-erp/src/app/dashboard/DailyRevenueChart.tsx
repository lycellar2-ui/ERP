'use client'

import React, { useState } from 'react'
import { TrendingUp, Award, Clock } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { getDashboardDictionary } from './i18n'
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

function translateDayLabel(label: string, isEn: boolean): string {
    if (!isEn || !label) return label
    return label
        .replace('Thứ 2', 'Mon')
        .replace('Thứ 3', 'Tue')
        .replace('Thứ 4', 'Wed')
        .replace('Thứ 5', 'Thu')
        .replace('Thứ 6', 'Fri')
        .replace('Thứ 7', 'Sat')
        .replace('Chủ Nhật', 'Sun')
        .replace('CN', 'Sun')
}

export function DailyRevenueChart({ data }: Props) {
    const [hoveredItem, setHoveredItem] = useState<DailyRevenueItem | null>(null)
    const { items, totalRevenue, totalOrders, avgOrderValue, peakDay } = data
    const { locale, isEn, formatCurrency } = useAppLocale()
    const t = getDashboardDictionary(locale)

    const maxRevenue = Math.max(...items.map((it) => it.revenue), 1)
    const isSingleDay = items.length === 1

    return (
        <Card className="p-5 space-y-4">
            {/* ─── Header ─── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-lys-teal-strong" aria-hidden />
                    <h3 className="type-section-title text-lys-primary">{t.dailyChart.title}</h3>
                    <Badge tone="brand">
                        {items.length} {t.dailyChart.daysUnit}
                    </Badge>
                </div>
                {peakDay && (
                    <Badge tone="warning" icon={Award} className="h-auto py-1 px-2.5 text-xs font-medium">
                        <span>{t.dailyChart.peakDay}</span>
                        <strong>{translateDayLabel(peakDay.label, isEn)}</strong>
                        <span>({formatCurrency(peakDay.revenue)})</span>
                    </Badge>
                )}
            </div>

            {/* ─── 4 Quick Summary Pills ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-lys-bg/60 p-3 rounded-md border border-lys-border">
                    <span className="text-[11px] text-lys-muted uppercase tracking-wide font-semibold block mb-0.5">
                        {t.dailyChart.totalRevenue}
                    </span>
                    <span className="text-base font-bold text-lys-teal-strong type-number">
                        {formatCurrency(totalRevenue)}
                    </span>
                </div>
                <div className="bg-lys-bg/60 p-3 rounded-md border border-lys-border">
                    <span className="text-[11px] text-lys-muted uppercase tracking-wide font-semibold block mb-0.5">
                        {t.dailyChart.totalOrders}
                    </span>
                    <span className="text-base font-bold text-lys-primary type-number">
                        {totalOrders} {t.dailyChart.ordersUnit}
                    </span>
                </div>
                <div className="bg-lys-bg/60 p-3 rounded-md border border-lys-border">
                    <span className="text-[11px] text-lys-muted uppercase tracking-wide font-semibold block mb-0.5">
                        {t.dailyChart.avgOrderValue}
                    </span>
                    <span className="text-base font-bold text-tone-warning-fg type-number">
                        {formatCurrency(avgOrderValue)}
                    </span>
                </div>
                <div className="bg-lys-bg/60 p-3 rounded-md border border-lys-border">
                    <span className="text-[11px] text-lys-muted uppercase tracking-wide font-semibold block mb-0.5">
                        {t.dailyChart.peakDate}
                    </span>
                    <span className="text-base font-bold text-tone-success-fg type-number truncate block">
                        {peakDay ? translateDayLabel(peakDay.label, isEn) : '—'}
                    </span>
                </div>
            </div>

            {/* ─── Main Chart Visual ─── */}
            {items.length === 0 ? (
                <div className="py-12 text-center text-xs text-lys-muted">
                    {t.dailyChart.noDataPeriod}
                </div>
            ) : isSingleDay ? (
                /* Single Day View (e.g. Today / Yesterday) */
                <div className="bg-lys-bg/50 p-5 rounded-lg border border-lys-border text-center space-y-3">
                    <p className="text-xs text-lys-secondary font-medium">
                        {isEn ? 'Date details' : 'Chi tiết ngày'}{' '}
                        <strong className="text-lys-primary">{items[0].label}</strong> ({translateDayLabel(items[0].dayOfWeek, isEn)})
                    </p>
                    <div className="flex items-center justify-center gap-6">
                        <div>
                            <span className="text-[11px] uppercase text-lys-muted block">
                                {isEn ? 'Day Revenue' : 'Doanh thu ngày'}
                            </span>
                            <span className="text-2xl font-bold text-lys-teal-strong type-number">
                                {formatCurrency(items[0].revenue)}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-lys-border" />
                        <div>
                            <span className="text-[11px] uppercase text-lys-muted block">
                                {isEn ? 'Order Count' : 'Số đơn phát sinh'}
                            </span>
                            <span className="text-2xl font-bold text-lys-primary type-number">
                                {items[0].orderCount} {t.dailyChart.ordersUnit}
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

                            const barClass = isPeak
                                ? 'bg-tone-warning-fg shadow-xs'
                                : heightPct > 60
                                ? 'bg-lys-teal-strong'
                                : heightPct > 20
                                ? 'bg-tone-success-fg'
                                : it.revenue > 0
                                ? 'bg-tone-info-fg'
                                : it.isWeekend
                                ? 'bg-lys-border'
                                : 'bg-lys-subtle'

                            return (
                                <div
                                    key={it.date}
                                    onMouseEnter={() => setHoveredItem(it)}
                                    onMouseLeave={() => setHoveredItem(null)}
                                    className="flex-1 min-w-[14px] flex flex-col items-center justify-end h-full group relative cursor-pointer"
                                >
                                    {/* Number pill above bar */}
                                    <div
                                        className={`text-[11px] font-mono font-bold transition-all mb-1 truncate text-center ${
                                            isPeak
                                                ? 'text-tone-warning-fg'
                                                : it.revenue > 0
                                                ? 'text-lys-teal-strong'
                                                : 'text-transparent'
                                        }`}
                                    >
                                        {formatCompactVND(it.revenue)}
                                    </div>

                                    {/* Bar element */}
                                    <div
                                        className={`w-full rounded-t-sm transition-all duration-300 group-hover:scale-x-110 ${barClass}`}
                                        style={{ height: `${barHeight}px` }}
                                    />

                                    {/* Day label */}
                                    <span
                                        className={`text-[11px] mt-1.5 transition-colors text-center ${
                                            it.isWeekend ? 'text-tone-warning-fg/80 font-medium' : 'text-lys-muted'
                                        } group-hover:text-lys-primary`}
                                    >
                                        {items.length > 20
                                            ? it.label.split('/')[0]
                                            : it.label}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* ── Hover Tooltip Banner ── */}
                    <div
                        className={`p-2.5 rounded-md border bg-white flex items-center justify-between text-xs min-h-[38px] transition-colors ${
                            hoveredItem ? 'border-lys-teal' : 'border-lys-border'
                        }`}
                    >
                        {hoveredItem ? (
                            <div className="flex items-center justify-between w-full gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-lys-primary">
                                        {translateDayLabel(hoveredItem.dayOfWeek, isEn)}, {hoveredItem.date}
                                    </span>
                                    {hoveredItem.isWeekend && (
                                        <Badge tone="warning">{isEn ? 'Weekend' : 'Cuối tuần'}</Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-lys-secondary">
                                        {isEn ? 'Orders:' : 'Số đơn:'}{' '}
                                        <strong className="text-lys-primary">{hoveredItem.orderCount}</strong>
                                    </span>
                                    <span className="text-lys-teal-strong font-bold text-sm type-number">
                                        {formatCurrency(hoveredItem.revenue)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-[11px] text-lys-muted italic flex items-center gap-1.5">
                                <Clock size={12} aria-hidden />
                                <span>
                                    {isEn
                                        ? 'Hover over any bar to view net sales and order volume for that date'
                                        : 'Rê chuột vào từng cột để xem chi tiết doanh thu và số lượng đơn hàng của ngày đó'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    )
}
