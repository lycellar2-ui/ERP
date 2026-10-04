'use client'

import React, { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    TrendingUp, TrendingDown, Ship, Package, CheckCircle2,
    ArrowDownLeft, ArrowUpRight, DollarSign, BarChart3, Wallet, Target, ClipboardCheck,
    Link as LinkIcon, Shield, AlertTriangle, FileText, Users, Wine, Trophy, AlertCircle,
} from 'lucide-react'
import { formatVND } from '@/lib/utils'
import { useAppLocale } from '@/lib/i18n'
import { getDashboardDictionary } from './i18n'
import { DailyRevenueChart } from './DailyRevenueChart'
import { approveSO, rejectSO, type WaterfallBar, type DailyRevenueSummary } from './actions'
import { REG_DOC_TYPE_LABELS } from './contracts/reg-doc-constants'
import { CATEGORY_LABELS, PRIORITY_LABELS } from './proposals/constants'
import type { PresetKey } from './DashboardFilterBar'

function formatFriendlyVND(amount: number | null | undefined, isEn = false): string {
    if (!amount || amount === 0) return isEn ? '0 VND' : '0 đ'
    const abs = Math.abs(amount)
    const sign = amount < 0 ? '−' : ''

    if (abs >= 1_000_000_000) {
        const billions = abs / 1_000_000_000
        const formatted = billions >= 10 ? billions.toFixed(1) : billions.toFixed(2)
        return isEn ? `${sign}${formatted}B VND` : `${sign}${formatted.replace('.', ',')} Tỷ`
    } else if (abs >= 1_000_000) {
        const millions = abs / 1_000_000
        const formatted = millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)
        return isEn ? `${sign}${formatted}M VND` : `${sign}${formatted.replace('.', ',')} Tr`
    }
    return isEn ? `${sign}${abs.toLocaleString('en-US')} VND` : `${sign}${abs.toLocaleString('vi-VN')} đ`
}

function KpiCard({ label, value, sub, trend, trendUp, accentColor = '#87CBB9' }: {
    label: string; value: string; sub?: string
    trend?: string; trendUp?: boolean; accentColor?: string
}) {
    return (
        <div className="rounded-md p-5 relative overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: `3px solid ${accentColor}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>{label}</p>
            <p className="text-2xl font-bold mb-0.5 font-mono" style={{ color: '#0F172A' }}>{value}</p>
            {sub && <p className="text-[11px]" style={{ color: '#64748B' }}>{sub}</p>}
            {trend && (
                <div className="flex items-center gap-1 mt-1.5">
                    {trendUp ? <TrendingUp size={12} style={{ color: '#5BA88A' }} /> : <TrendingDown size={12} style={{ color: '#8B1A2E' }} />}
                    <span className="text-[11px] font-medium" style={{ color: trendUp ? '#5BA88A' : '#8B1A2E' }}>{trend}</span>
                </div>
            )}
        </div>
    )
}

function SectionHead({ icon, title, badge, children }: { icon: React.ReactNode; title: string; badge?: React.ReactNode; children?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                {icon}
                <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>{title}</h3>
                {badge}
            </div>
            {children}
        </div>
    )
}

const SHIP_STATUS_TRANSLATIONS: Record<string, { vi: string; en: string; color: string }> = {
    BOOKED: { vi: 'Đã đặt', en: 'Booked', color: '#4A8FAB' },
    ON_VESSEL: { vi: 'Trên biển', en: 'On Vessel', color: '#0891B2' },
    ARRIVED_PORT: { vi: 'Sắp đến cảng', en: 'Arrived Port', color: '#D4A853' },
    CUSTOMS_CLEARED: { vi: 'Đã thông quan', en: 'Customs Cleared', color: '#5BA88A' },
    DELIVERED_TO_WAREHOUSE: { vi: 'Đã về kho', en: 'In Warehouse', color: '#64748B' },
}

interface CeoOverviewContentProps {
    primaryRevenue: number
    revenueSource: string
    stats: any
    pl: any
    cash: any
    ar: any
    arMax: number
    arOverdue: number
    totalPending: number
    pendingSub: string
    pendingProposals: any[]
    pendingApprovalReqs: any[]
    topCustomers: any[]
    topProducts: any[]
    channels: any
    yoyData: any
    wf: any
    kpis: any[]
    preset: PresetKey
    displayRangeText: string
    complianceWarnings: any[]
    mySales: any
    warehouseData: any
    dashConfig: any
    dailyRevenueData: DailyRevenueSummary
}

export function CeoOverviewContent({
    primaryRevenue,
    revenueSource,
    stats,
    pl,
    cash,
    ar,
    arMax,
    arOverdue,
    totalPending,
    pendingSub,
    pendingProposals,
    pendingApprovalReqs,
    topCustomers,
    topProducts,
    channels,
    yoyData,
    wf,
    kpis,
    preset,
    displayRangeText,
    complianceWarnings,
    mySales,
    warehouseData,
    dashConfig,
    dailyRevenueData,
}: CeoOverviewContentProps) {
    const router = useRouter()
    const [isPendingAction, startTransition] = useTransition()
    const { locale, isEn, formatCurrency, formatDate } = useAppLocale()
    const t = getDashboardDictionary(locale)

    const revenueKpiLabel = preset === 'THIS_MONTH'
        ? t.kpis.revenueMonth
        : preset === 'TODAY'
        ? t.kpis.revenueToday
        : preset === 'YESTERDAY'
        ? t.kpis.revenueYesterday
        : preset === '7DAYS'
        ? t.kpis.revenue7Days
        : t.kpis.revenuePeriod

    const handleApproveSo = (id: string) => {
        startTransition(async () => {
            await approveSO(id)
            router.refresh()
        })
    }

    const handleRejectSo = (id: string) => {
        startTransition(async () => {
            await rejectSO(id)
            router.refresh()
        })
    }

    const translateBucketLabel = (label: string) => {
        if (!isEn) return label
        if (label === 'Chưa đến hạn') return t.arAging.buckets.notDue
        if (label === '1-30 ngày' || label === '1–30 ngày') return t.arAging.buckets['1_30']
        if (label === '31-60 ngày' || label === '31–60 ngày') return t.arAging.buckets['31_60']
        if (label === '61-90 ngày' || label === '61–90 ngày') return t.arAging.buckets['61_90']
        if (label.includes('> 90') || label.includes('>90')) return t.arAging.buckets.over90
        return label
    }

    return (
        <div className="space-y-5">
            {/* ═══ LAYER 1 — 6 KPI CARDS ═══ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard
                    label={revenueKpiLabel}
                    value={formatFriendlyVND(primaryRevenue, isEn)}
                    sub={revenueSource}
                    trend={stats.revenueGrowth !== 0 ? `${stats.revenueGrowth > 0 ? '+' : ''}${stats.revenueGrowth.toFixed(1)}% ${t.kpis.vsPrevPeriod}` : undefined}
                    trendUp={stats.revenueGrowth >= 0}
                    accentColor="#87CBB9"
                />
                <KpiCard
                    label={t.kpis.grossProfit}
                    value={formatFriendlyVND(pl.grossProfit, isEn)}
                    sub={`${t.kpis.margin}: ${pl.grossMargin.toFixed(1)}%`}
                    trend={pl.grossMargin >= 25 ? t.kpis.good : t.kpis.fair}
                    trendUp={pl.grossMargin >= 25}
                    accentColor="#D4A853"
                />
                <KpiCard
                    label={t.kpis.netCashFlow}
                    value={`${cash.netCashFlow >= 0 ? '+' : ''}${formatFriendlyVND(cash.netCashFlow, isEn)}`}
                    sub={`${t.kpis.cashIn}: ${formatFriendlyVND(cash.cashIn, isEn)} · ${t.kpis.cashOut}: ${formatFriendlyVND(cash.cashOutAP + cash.cashOutExpenses, isEn)}`}
                    accentColor={cash.netCashFlow >= 0 ? '#5BA88A' : '#8B1A2E'}
                />
                <KpiCard
                    label={t.kpis.inventoryValue}
                    value={formatFriendlyVND(stats.stockTotalValue, isEn)}
                    sub={`${stats.stockQty.toLocaleString(isEn ? 'en-US' : 'vi-VN')} ${t.kpis.bottlesUnit}`}
                    accentColor="#4A8FAB"
                />
                <KpiCard
                    label={t.kpis.arOutstanding}
                    value={formatFriendlyVND(ar.totalOutstanding, isEn)}
                    sub={arOverdue > 0 ? `${formatFriendlyVND(arOverdue, isEn)} ${t.kpis.overdue}` : t.kpis.onTime}
                    accentColor={arOverdue > 0 ? '#E05252' : '#5BA88A'}
                />
                <KpiCard
                    label={t.kpis.pendingApprovals}
                    value={String(totalPending)}
                    sub={pendingSub}
                    accentColor="#8B1A2E"
                />
            </div>

            {/* ═══ DAILY REVENUE TREND CHART ═══ */}
            <DailyRevenueChart data={dailyRevenueData} />

            {/* ═══ LAYER 2 — FINANCIAL PULSE (2 cols) ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* P&L Summary */}
                <div className="rounded-md p-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <SectionHead
                        icon={<BarChart3 size={15} style={{ color: '#0891B2' }} />}
                        title={preset === 'THIS_MONTH' ? t.pnl.monthlyTitle : `${t.pnl.periodTitle} (${displayRangeText})`}
                        badge={
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold ml-1" style={{ background: pl.grossMargin >= 25 ? 'rgba(91,168,138,0.15)' : 'rgba(212,168,83,0.15)', color: pl.grossMargin >= 25 ? '#5BA88A' : '#D4A853' }}>
                                {t.pnl.marginBadge} {pl.grossMargin.toFixed(1)}%
                            </span>
                        }
                    />
                    <div className="space-y-2.5">
                        {[
                            { label: t.pnl.netRevenue, value: primaryRevenue, color: '#0891B2' },
                            { label: t.pnl.cogs, value: -pl.cogs, color: '#E05252', neg: true },
                            { label: t.pnl.grossProfit, value: pl.grossProfit, color: pl.grossProfit >= 0 ? '#D4A853' : '#E05252', bold: true, line: true },
                            { label: t.pnl.expenses, value: -pl.expenses, color: '#475569', neg: true },
                            { label: t.pnl.netProfit, value: pl.netProfit, color: pl.netProfit >= 0 ? '#5BA88A' : '#8B1A2E', bold: true, line: true },
                        ].map((r, idx) => (
                            <div key={idx}>
                                {r.line && <div className="mb-2" style={{ borderTop: '1px dashed #E2E8F0' }} />}
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs ${r.bold ? 'font-bold' : ''}`} style={{ color: r.bold ? r.color : '#475569' }}>{r.label}</span>
                                    <span className={`text-sm ${r.bold ? 'font-bold' : 'font-medium'}`} style={{ color: r.color }}>
                                        {r.value < 0 ? `− ${formatCurrency(Math.abs(r.value))}` : formatCurrency(r.value)}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {stats.revenueGrowth !== 0 && (
                            <p className="text-[10px] text-right mt-1" style={{ color: '#64748B' }}>
                                {t.kpis.vsPrevPeriod}: {stats.revenueGrowth > 0 ? '+' : ''}{stats.revenueGrowth.toFixed(1)}%
                            </p>
                        )}
                    </div>
                </div>

                {/* Cash Position */}
                <div className="rounded-md p-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <SectionHead icon={<Wallet size={15} style={{ color: '#0891B2' }} />} title={t.cashFlow.title} />
                    <div className="p-3 rounded-md mb-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#64748B' }}>{t.cashFlow.periodNetCash}</p>
                        <p className="text-xl font-bold font-mono" style={{ color: cash.netCashFlow >= 0 ? '#5BA88A' : '#8B1A2E' }}>
                            {cash.netCashFlow >= 0 ? '+' : ''}{formatCurrency(cash.netCashFlow)}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between p-2.5 rounded" style={{ background: 'rgba(91,168,138,0.06)' }}>
                            <div className="flex items-center gap-2">
                                <ArrowDownLeft size={13} style={{ color: '#5BA88A' }} />
                                <span className="text-xs" style={{ color: '#5BA88A' }}>{t.cashFlow.inflowSub}</span>
                            </div>
                            <span className="text-xs font-bold font-mono" style={{ color: '#5BA88A' }}>+{formatCurrency(cash.cashIn)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded" style={{ background: 'rgba(139,26,46,0.04)' }}>
                            <div className="flex items-center gap-2">
                                <ArrowUpRight size={13} style={{ color: '#E05252' }} />
                                <span className="text-xs" style={{ color: '#E05252' }}>{t.cashFlow.outflowAP}</span>
                            </div>
                            <span className="text-xs font-bold font-mono" style={{ color: '#E05252' }}>−{formatCurrency(cash.cashOutAP)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded" style={{ background: 'rgba(139,26,46,0.04)' }}>
                            <div className="flex items-center gap-2">
                                <ArrowUpRight size={13} style={{ color: '#D4A853' }} />
                                <span className="text-xs" style={{ color: '#D4A853' }}>{t.cashFlow.outflowExpense}</span>
                            </div>
                            <span className="text-xs font-bold font-mono" style={{ color: '#D4A853' }}>−{formatCurrency(cash.cashOutExpenses)}</span>
                        </div>
                        <div style={{ borderTop: '1px solid #E2E8F0' }} className="pt-2 flex justify-between text-xs">
                            <span style={{ color: '#64748B' }}>{t.cashFlow.workingCapital}</span>
                            <span style={{ color: '#475569' }} className="font-mono">{formatCurrency(cash.arOutstanding)} / {formatCurrency(cash.apOutstanding)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ LAYER 3 — OPERATIONS (3 cols) ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Container Tracker */}
                <div className="rounded-md p-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <SectionHead
                        icon={<Ship size={15} style={{ color: '#0891B2' }} />}
                        title={t.containers.title}
                        badge={<span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB' }}>{stats.inTransitShipments.length}</span>}
                    />
                    {stats.inTransitShipments.length === 0 ? (
                        <div className="flex flex-col items-center py-6 gap-1">
                            <Package size={24} style={{ color: '#E2E8F0' }} />
                            <p className="text-xs" style={{ color: '#64748B' }}>{t.containers.empty}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {stats.inTransitShipments.map((s: any) => {
                                const cfg = SHIP_STATUS_TRANSLATIONS[s.status] ?? { vi: s.status, en: s.status, color: '#475569' }
                                const statusLabel = isEn ? (t.containers.statuses[s.status as keyof typeof t.containers.statuses] ?? cfg.en) : cfg.vi
                                return (
                                    <div key={s.id} className="p-2.5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-xs font-bold" style={{ color: '#0891B2' }}>{s.billOfLading}</p>
                                                <p className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>
                                                    {t.containers.eta}: {s.eta ? formatDate(s.eta) : '--'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold font-mono" style={{ color: '#0F172A' }}>${s.cifAmount.toLocaleString(isEn ? 'en-US' : 'vi-VN')} {s.cifCurrency}</p>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${cfg.color}20`, color: cfg.color }}>
                                                    {statusLabel}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* AR Aging */}
                <div className="rounded-md p-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <SectionHead
                        icon={<DollarSign size={15} style={{ color: '#0891B2' }} />}
                        title={t.arAging.title}
                        badge={<span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB' }}>{ar.invoiceCount} {t.arAging.invoicesCount}</span>}
                    />
                    <div className="p-2.5 rounded mb-3" style={{ background: '#FFFFFF' }}>
                        <p className="text-[10px] uppercase mb-0.5" style={{ color: '#64748B' }}>{t.arAging.totalOutstanding}</p>
                        <p className="text-lg font-bold font-mono" style={{ color: '#D4A853' }}>{formatCurrency(ar.totalOutstanding)}</p>
                    </div>
                    <div className="space-y-2.5">
                        {ar.buckets.map((b: any) => (
                            <div key={b.label}>
                                <div className="flex justify-between mb-0.5">
                                    <span className="text-[11px]" style={{ color: '#475569' }}>{translateBucketLabel(b.label)}</span>
                                    <span className="text-[11px] font-bold font-mono" style={{ color: b.color }}>{b.amount > 0 ? formatCurrency(b.amount) : '—'}</span>
                                </div>
                                <div className="h-2 rounded-full" style={{ background: '#F1F5F9' }}>
                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(b.amount > 0 ? 4 : 0, (b.amount / arMax) * 100)}%`, background: b.color }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Customers & Top Products */}
                <div className="rounded-md p-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <SectionHead
                        icon={<Trophy size={15} style={{ color: '#D4A853' }} />}
                        title={preset === 'THIS_MONTH' ? t.rankings.monthTitle : t.rankings.periodTitle}
                    />
                    {/* Top Customers */}
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>
                        <Users size={11} className="inline mr-1" />{t.rankings.topCustomers}
                    </p>
                    {topCustomers.length === 0 ? (
                        <p className="text-xs mb-3" style={{ color: '#64748B' }}>{t.noData}</p>
                    ) : (
                        <div className="space-y-1 mb-4">
                            {topCustomers.map((c: any, i: number) => (
                                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: i === 0 ? 'rgba(135,203,185,0.06)' : 'transparent' }}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[10px] font-bold w-4" style={{ color: i === 0 ? '#D4A853' : '#64748B' }}>{i + 1}.</span>
                                        <span className="text-xs truncate" style={{ color: '#0F172A' }}>{c.name}</span>
                                    </div>
                                    <span className="text-[11px] font-bold font-mono flex-shrink-0" style={{ color: '#0891B2' }}>{formatFriendlyVND(c.revenue, isEn)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* Top Products */}
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>
                        <Wine size={11} className="inline mr-1" />{t.rankings.topProducts}
                    </p>
                    {topProducts.length === 0 ? (
                        <p className="text-xs" style={{ color: '#64748B' }}>{t.noData}</p>
                    ) : (
                        <div className="space-y-1">
                            {topProducts.map((p: any, i: number) => (
                                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: i === 0 ? 'rgba(212,168,83,0.06)' : 'transparent' }}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[10px] font-bold w-4" style={{ color: i === 0 ? '#D4A853' : '#64748B' }}>{i + 1}.</span>
                                        <span className="text-xs truncate" style={{ color: '#0F172A' }}>{p.name}</span>
                                    </div>
                                    <span className="text-[10px] font-mono flex-shrink-0" style={{ color: '#475569' }}>
                                        {p.qty} {t.rankings.bottlesSold} · {formatFriendlyVND(p.revenue, isEn)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ LAYER 4 — CEO ACTION HUB ═══ */}
            <div className="rounded-md p-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                            ⏳ {t.approvals.title}
                        </h3>
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full" style={{ background: 'rgba(139,26,46,0.2)', color: '#8B1A2E' }}>
                            {totalPending}
                        </span>
                    </div>
                    <Link
                        href="/dashboard/proposals"
                        className="text-xs font-medium px-3 py-1.5 rounded transition-colors"
                        style={{ background: 'rgba(135,203,185,0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.08)' }}
                    >
                        {t.approvals.viewAll}
                    </Link>
                </div>
                {totalPending === 0 ? (
                    <div className="flex flex-col items-center py-6 gap-1">
                        <CheckCircle2 size={24} style={{ color: '#5BA88A' }} />
                        <p className="text-xs" style={{ color: '#64748B' }}>
                            {t.approvals.noPending}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Proposals */}
                        {pendingProposals.map((p: any) => {
                            const prioCfg = PRIORITY_LABELS[p.priority] ?? PRIORITY_LABELS.NORMAL
                            return (
                                <div key={p.id} className="flex items-center justify-between py-2.5 px-3" style={{ background: 'rgba(212,168,83,0.03)', border: '1px solid rgba(212,168,83,0.15)', borderRadius: '6px', borderLeft: `3px solid ${prioCfg.color}` }}>
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <FileText size={14} style={{ color: '#D4A853' }} className="flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: prioCfg.bg, color: prioCfg.color }}>{prioCfg.label}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(74,143,171,0.1)', color: '#4A8FAB' }}>{CATEGORY_LABELS[p.category] ?? p.category}</span>
                                                <span className="text-xs font-bold" style={{ color: '#0891B2' }}>{p.proposalNo}</span>
                                            </div>
                                            <p className="text-sm truncate" style={{ color: '#0F172A' }}>{p.title}</p>
                                            <span className="text-[10px]" style={{ color: '#64748B' }}>{p.creatorName}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        {p.estimatedAmount && <span className="text-sm font-bold font-mono" style={{ color: '#0F172A' }}>{formatCurrency(p.estimatedAmount)}</span>}
                                        <Link href="/dashboard/proposals" className="px-2.5 py-1 text-xs font-semibold rounded" style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                            {t.approvals.reviewAndApprove}
                                        </Link>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Approval Engine */}
                        {Array.isArray(pendingApprovalReqs) && pendingApprovalReqs.map((arItem: any) => (
                            <div key={arItem.id} className="flex items-center justify-between py-2.5 px-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                                <div className="flex items-center gap-2">
                                    <ClipboardCheck size={13} style={{ color: '#0891B2' }} />
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853' }}>{arItem.docType}</span>
                                    <span className="text-sm" style={{ color: '#0F172A' }}>{arItem.templateName}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px]" style={{ color: '#475569' }}>{t.approvals.step} {arItem.currentStep}</p>
                                    <p className="text-[10px]" style={{ color: '#64748B' }}>{arItem.requestedBy}</p>
                                </div>
                            </div>
                        ))}

                        {/* Pending SOs */}
                        {stats.pendingSOs.map((so: any) => (
                            <div key={so.id} className="flex items-center justify-between py-2.5 px-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                                <div className="flex items-center gap-2">
                                    {so.status === 'PENDING_APPROVAL' && <AlertCircle size={13} style={{ color: '#D4A853' }} />}
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2' }}>SO</span>
                                    <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>{so.soNo}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-sm font-bold font-mono" style={{ color: '#0F172A' }}>{formatCurrency(so.amount)}</p>
                                        <p className="text-[10px]" style={{ color: '#64748B' }}>{so.customerName}</p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button
                                            type="button"
                                            disabled={isPendingAction}
                                            onClick={() => handleApproveSo(so.id)}
                                            className="px-2.5 py-1 text-xs font-semibold cursor-pointer disabled:opacity-50"
                                            style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)', borderRadius: '4px' }}
                                        >
                                            {t.approvals.approve}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isPendingAction}
                                            onClick={() => handleRejectSo(so.id)}
                                            className="px-2.5 py-1 text-xs font-semibold cursor-pointer disabled:opacity-50"
                                            style={{ background: 'rgba(139,26,46,0.12)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.25)', borderRadius: '4px' }}
                                        >
                                            {t.approvals.reject}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ═══ LAYER 5 — DEEP ANALYSIS (Grid of cards) ═══ */}
            <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
                    📈 {t.inDepth.title}
                </h3>

                {/* KPI Progress + Channel Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    {/* KPI Targets — 3 cols */}
                    <div className="lg:col-span-3 rounded-md p-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <SectionHead
                            icon={<Target size={15} style={{ color: '#0891B2' }} />}
                            title={t.inDepth.monthlyKpiTargets}
                            badge={
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2' }}>
                                    {kpis.filter((k: any) => k.progressPct >= 100).length}/{kpis.length} {t.inDepth.achieved}
                                </span>
                            }
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                            {kpis.map((kpi: any) => {
                                const pct = Math.min(kpi.progressPct, 100)
                                const sc = kpi.status === 'ON_TRACK' ? '#5BA88A' : kpi.status === 'AT_RISK' ? '#D4A853' : '#8B1A2E'
                                const sl = kpi.status === 'ON_TRACK' ? t.inDepth.onTrack : kpi.status === 'AT_RISK' ? t.inDepth.atRisk : t.inDepth.behind
                                return (
                                    <div key={kpi.metric} className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-semibold truncate" style={{ color: '#475569' }}>{kpi.label}</p>
                                            <span className="text-[10px] px-1 py-0.5 rounded font-bold" style={{ background: `${sc}18`, color: sc }}>{sl}</span>
                                        </div>
                                        <div className="h-2 rounded-full" style={{ background: '#F1F5F9' }}>
                                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: kpi.color ?? '#87CBB9' }} />
                                        </div>
                                        <div className="flex justify-between font-mono">
                                            <span className="text-[10px] font-bold" style={{ color: '#0F172A' }}>
                                                {kpi.unit === 'VND' ? formatFriendlyVND(kpi.actual, isEn) : kpi.actual}
                                            </span>
                                            <span className="text-[10px]" style={{ color: '#64748B' }}>/ {kpi.unit === 'VND' ? formatFriendlyVND(kpi.target, isEn) : kpi.target}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Channel Breakdown — 2 cols */}
                    <div className="lg:col-span-2 rounded-md p-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <SectionHead icon={<BarChart3 size={15} style={{ color: '#D4A853' }} />} title={t.rankings.channelTitle} />
                        {channels.channels.length === 0 ? (
                            <p className="text-xs py-4 text-center" style={{ color: '#64748B' }}>{t.noData}</p>
                        ) : (
                            <div className="space-y-2.5">
                                {channels.channels.map((ch: any) => (
                                    <div key={ch.channel}>
                                        <div className="flex justify-between mb-0.5">
                                            <span className="text-xs" style={{ color: '#475569' }}>{ch.label}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold font-mono" style={{ color: ch.color }}>{formatFriendlyVND(ch.revenue, isEn)}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${ch.color}18`, color: ch.color }}>{ch.pct}%</span>
                                            </div>
                                        </div>
                                        <div className="h-2 rounded-full" style={{ background: '#F1F5F9' }}>
                                            <div className="h-full rounded-full transition-all" style={{ width: `${ch.pct}%`, background: ch.color }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Revenue YoY + Cost Waterfall */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Revenue YoY */}
                    {(() => {
                        const yoyMax = Math.max(...yoyData.current.map((m: any) => m.revenue), ...yoyData.previous.map((m: any) => m.revenue), 1)
                        const cm = new Date().getMonth() + 1
                        return (
                            <div className="rounded-md p-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <SectionHead
                                    icon={<TrendingUp size={15} style={{ color: '#0891B2' }} />}
                                    title={`${t.inDepth.revenueYoY} ${yoyData.thisYear} vs ${yoyData.lastYear}`}
                                >
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: yoyData.yoyGrowth >= 0 ? 'rgba(91,168,138,0.15)' : 'rgba(139,26,46,0.15)', color: yoyData.yoyGrowth >= 0 ? '#5BA88A' : '#8B1A2E' }}>
                                        {yoyData.yoyGrowth >= 0 ? '↑' : '↓'}{Math.abs(yoyData.yoyGrowth).toFixed(1)}% YoY
                                    </span>
                                </SectionHead>
                                <div className="flex items-end gap-0.5 h-32 mb-2">
                                    {yoyData.current.map((m: any, i: number) => {
                                        const prev = yoyData.previous[i]
                                        const curH = Math.max(2, (m.revenue / yoyMax) * 110)
                                        const prevH = Math.max(2, (prev.revenue / yoyMax) * 110)
                                        return (
                                            <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                                                <div className="w-full flex gap-px" style={{ height: 110, alignItems: 'flex-end' }}>
                                                    <div className="flex-1 rounded-t-sm" style={{ height: prevH, background: '#E2E8F0' }} />
                                                    <div className="flex-1 rounded-t-sm" style={{ height: m.month > cm ? 0 : curH, background: m.month > cm ? 'transparent' : m.revenue > prev.revenue ? '#87CBB9' : '#D4A853' }} />
                                                </div>
                                                <span className="text-[10px]" style={{ color: m.month === cm ? '#0891B2' : '#64748B', fontWeight: m.month === cm ? 'bold' : 'normal' }}>
                                                    {m.label}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-center gap-6 pt-2" style={{ borderTop: '1px solid #E2E8F0' }}>
                                    <div className="text-center">
                                        <p className="text-[10px] uppercase font-semibold" style={{ color: '#64748B' }}>{yoyData.thisYear}</p>
                                        <p className="text-xs font-bold font-mono" style={{ color: '#0891B2' }}>{formatCurrency(yoyData.totalCurrent)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] uppercase font-semibold" style={{ color: '#64748B' }}>{yoyData.lastYear}</p>
                                        <p className="text-xs font-bold font-mono" style={{ color: '#64748B' }}>{formatCurrency(yoyData.totalPrevious)}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })()}

                    {/* Cost Waterfall */}
                    <div className="rounded-md p-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <SectionHead icon={<BarChart3 size={15} style={{ color: '#D4A853' }} />} title={t.waterfall.title}>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: wf.netProfit >= 0 ? 'rgba(91,168,138,0.15)' : 'rgba(139,26,46,0.15)', color: wf.netProfit >= 0 ? '#5BA88A' : '#8B1A2E' }}>
                                Net {wf.revenue > 0 ? ((wf.netProfit / wf.revenue) * 100).toFixed(1) : 0}%
                            </span>
                        </SectionHead>
                        <div className="flex items-end gap-1.5 h-36 mb-3">
                            {wf.bars.map((bar: WaterfallBar) => {
                                const absMax = Math.max(...wf.bars.map((b: WaterfallBar) => Math.abs(b.value)), 1)
                                const barH = Math.max(6, (Math.abs(bar.value) / absMax) * 120)
                                return (
                                    <div key={bar.label} className="flex-1 flex flex-col items-center gap-0.5">
                                        <span className="text-[10px] font-bold font-mono" style={{ color: bar.color }}>
                                            {bar.value !== 0 ? formatFriendlyVND(Math.abs(bar.value), isEn) : (isEn ? '0 VND' : '0 đ')}
                                        </span>
                                        <div className="w-full relative" style={{ height: 120 }}>
                                            <div className="absolute bottom-0 w-full rounded-t-sm" style={{ height: barH, background: `${bar.color}${bar.type === 'negative' ? '35' : '60'}`, borderLeft: `2px solid ${bar.color}`, borderTop: `2px solid ${bar.color}`, borderRight: `2px solid ${bar.color}` }} />
                                        </div>
                                        <p className="text-[10px] text-center leading-tight truncate w-full" style={{ color: '#475569' }}>
                                            {bar.label.split(' (')[0]}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex items-center justify-center gap-4 pt-2" style={{ borderTop: '1px solid #E2E8F0' }}>
                            {[
                                { label: t.waterfall.revenue, color: '#5BA88A', val: wf.revenue },
                                { label: 'COGS', color: '#E05252', val: wf.cogs },
                                { label: isEn ? 'OPEX' : 'CP', color: '#D4A853', val: wf.totalExpenses },
                                { label: t.waterfall.netProfit, color: wf.netProfit >= 0 ? '#5BA88A' : '#8B1A2E', val: wf.netProfit },
                            ].map(l => (
                                <div key={l.label} className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
                                    <span className="text-[10px]" style={{ color: '#64748B' }}>{l.label}</span>
                                    <span className="text-[10px] font-bold font-mono" style={{ color: l.color }}>{formatCurrency(Math.abs(l.val))}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Legal Compliance */}
                {complianceWarnings.length > 0 && (
                    <div className="rounded-md p-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <SectionHead
                            icon={<Shield size={15} style={{ color: '#D4A853' }} />}
                            title={t.compliance.title}
                            badge={
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: complianceWarnings.some((w: any) => w.severity === 'critical') ? 'rgba(224,82,82,0.2)' : 'rgba(212,168,83,0.2)', color: complianceWarnings.some((w: any) => w.severity === 'critical') ? '#E05252' : '#D4A853' }}>
                                    {complianceWarnings.length} {t.compliance.documents}
                                </span>
                            }
                        >
                            <Link href="/dashboard/contracts" className="text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(135,203,185,0.1)', color: '#0891B2' }}>
                                {t.compliance.viewAll}
                            </Link>
                        </SectionHead>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {complianceWarnings.slice(0, 6).map((w: any) => {
                                const sev = w.severity === 'critical' ? { bg: 'rgba(224,82,82,0.06)', border: 'rgba(224,82,82,0.2)', c: '#E05252' } : w.severity === 'warning' ? { bg: 'rgba(212,168,83,0.06)', border: 'rgba(212,168,83,0.2)', c: '#D4A853' } : { bg: 'rgba(135,203,185,0.06)', border: 'rgba(8, 145, 178, 0.15)', c: '#87CBB9' }
                                return (
                                    <div key={w.id} className="flex items-center justify-between p-2.5 rounded" style={{ background: sev.bg, border: `1px solid ${sev.border}` }}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <AlertTriangle size={13} style={{ color: sev.c }} />
                                            <div className="min-w-0">
                                                <p className="text-xs truncate font-medium" style={{ color: '#0F172A' }}>{w.name}</p>
                                                <p className="text-[10px]" style={{ color: '#64748B' }}>{REG_DOC_TYPE_LABELS[w.type] ?? w.type}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold flex-shrink-0" style={{ color: sev.c }}>
                                            {w.daysRemaining !== null && w.daysRemaining <= 0 ? `${t.compliance.overdue} ${Math.abs(w.daysRemaining)}d` : `${w.daysRemaining}${t.compliance.daysRemaining}`}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ QUICK LINKS (Bottom) ═══ */}
            {dashConfig.quickLinks.length > 0 && (
                <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>
                        {t.quickAccess.title}
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {dashConfig.quickLinks.map((link: any) => (
                            <Link key={link.href} href={link.href} className="flex items-center gap-2 p-2.5 rounded hover:border-[#0891B2] transition-all" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.1)' }}>
                                    <LinkIcon size={12} style={{ color: '#0891B2' }} />
                                </div>
                                <span className="text-xs font-medium" style={{ color: '#0F172A' }}>{link.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ ROLE-SPECIFIC: My Sales ═══ */}
            {mySales && (
                <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#D4A853' }}>
                            📊 {t.mySales.title}
                        </p>
                        <div className="flex items-center gap-3 font-mono">
                            <span className="text-xs font-bold" style={{ color: '#0891B2' }}>{mySales.orderCount} {t.mySales.orders}</span>
                            <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{formatCurrency(mySales.totalRevenue)}</span>
                        </div>
                    </div>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {mySales.orders.map((o: any) => (
                            <div key={o.soNo} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}>
                                <span className="text-xs font-bold" style={{ color: '#0891B2' }}>{o.soNo}</span>
                                <span className="text-xs" style={{ color: '#475569' }}>{o.customerName}</span>
                                <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: o.status === 'PAID' ? 'rgba(91,168,138,0.15)' : 'rgba(138,174,187,0.15)', color: o.status === 'PAID' ? '#5BA88A' : '#475569' }}>{o.status}</span>
                                <span className="text-xs font-bold font-mono" style={{ color: '#0F172A' }}>{formatCurrency(o.amount)}</span>
                            </div>
                        ))}
                        {mySales.orders.length === 0 && <p className="text-xs text-center py-3" style={{ color: '#64748B' }}>{t.noData}</p>}
                    </div>
                </div>
            )}

            {/* ═══ ROLE-SPECIFIC: Warehouse ═══ */}
            {warehouseData && (
                <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A8FAB' }}>
                        📦 {t.warehouseOverview.title}
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                        {[
                            { label: t.warehouseOverview.totalBottles, value: warehouseData.totalBottles.toLocaleString(isEn ? 'en-US' : 'vi-VN'), color: '#0891B2' },
                            { label: t.warehouseOverview.lowStockSKUs, value: warehouseData.lowStockSKUs, color: '#D4A853' },
                            { label: t.warehouseOverview.quarantined, value: warehouseData.quarantinedLots, color: '#8B1A2E' },
                            { label: t.warehouseOverview.pendingGRs, value: warehouseData.pendingGoodsReceipts, color: '#4A8FAB' },
                            { label: t.warehouseOverview.pendingDOs, value: warehouseData.pendingDeliveryOrders, color: '#5BA88A' },
                        ].map(s => (
                            <div key={s.label} className="text-center p-2.5 rounded" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}>
                                <p className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
