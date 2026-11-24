'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    TrendingUp, TrendingDown, Ship, Package, CheckCircle2,
    ArrowDownLeft, ArrowUpRight, DollarSign, BarChart3, Wallet, Target, ClipboardCheck,
    Link as LinkIcon, Shield, AlertTriangle, FileText, Users, Wine, Trophy, AlertCircle, Clock, LineChart,
    CreditCard, ExternalLink, Archive, X,
} from 'lucide-react'
import { Badge, Button, Card, Modal, StatusBadge, Textarea } from '@/components/ui'
import type { Tone } from '@/lib/ui/status'
import { useAppLocale } from '@/lib/i18n'
import { getDashboardDictionary } from './i18n'
import { DailyRevenueChart } from './DailyRevenueChart'
import {
    approveSO,
    rejectSO,
    approveProposalFromDashboard,
    rejectProposalFromDashboard,
    approvePaymentRequestFromDashboard,
    rejectPaymentRequestFromDashboard,
    approveEngineRequestFromDashboard,
    rejectEngineRequestFromDashboard,
    type WaterfallBar,
    type DailyRevenueSummary,
    type SkuReplenishmentAlertItem,
} from './actions'
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

const KPI_ACCENT_BORDER: Record<Tone, string> = {
    brand: 'border-l-lys-teal-strong',
    warning: 'border-l-tone-warning-fg',
    danger: 'border-l-tone-danger-fg',
    info: 'border-l-tone-info-fg',
    success: 'border-l-tone-success-fg',
    neutral: 'border-l-lys-muted',
}

function KpiCard({ label, value, sub, trend, trendUp, tone = 'brand' }: {
    label: string; value: string; sub?: string
    trend?: string; trendUp?: boolean; tone?: Tone
}) {
    return (
        <div
            className={`bg-lys-card border border-lys-border border-l-[3px] ${KPI_ACCENT_BORDER[tone]} rounded-lg shadow-xs p-3.5 sm:p-4 relative overflow-hidden flex flex-col justify-between`}
        >
            <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-lys-muted mb-1.5 truncate">{label}</p>
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-lys-primary type-number mb-0.5 truncate">{value}</p>
                {sub && <p className="text-[11px] text-lys-muted truncate">{sub}</p>}
            </div>
            {trend && (
                <div className="flex items-center gap-1 mt-1.5">
                    {trendUp ? (
                        <TrendingUp size={12} className="text-tone-success-fg shrink-0" aria-hidden />
                    ) : (
                        <TrendingDown size={12} className="text-tone-danger-fg shrink-0" aria-hidden />
                    )}
                    <span className={`text-[11px] font-medium truncate ${trendUp ? 'text-tone-success-fg' : 'text-tone-danger-fg'}`}>
                        {trend}
                    </span>
                </div>
            )}
        </div>
    )
}

function SectionHead({ icon, title, badge, children }: { icon: React.ReactNode; title: string; badge?: React.ReactNode; children?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                {icon}
                <h3 className="type-section-title text-lys-primary">{title}</h3>
                {badge}
            </div>
            {children}
        </div>
    )
}

const SHIP_STATUS_LABELS: Record<string, { vi: string; en: string }> = {
    BOOKED: { vi: 'Đã đặt', en: 'Booked' },
    ON_VESSEL: { vi: 'Trên biển', en: 'On Vessel' },
    ARRIVED_PORT: { vi: 'Sắp đến cảng', en: 'Arrived Port' },
    CUSTOMS_CLEARED: { vi: 'Đã thông quan', en: 'Customs Cleared' },
    DELIVERED_TO_WAREHOUSE: { vi: 'Đã về kho', en: 'In Warehouse' },
}

const SHIP_TONE_OVERRIDES: Record<string, Tone> = {
    BOOKED: 'info',
    ON_VESSEL: 'brand',
    ARRIVED_PORT: 'warning',
    CUSTOMS_CLEARED: 'success',
    DELIVERED_TO_WAREHOUSE: 'neutral',
}

type ApprovalFilterTab = 'ALL' | 'SO' | 'PROPOSAL' | 'PAYMENT' | 'SYSTEM'

interface RejectTarget {
    type: 'SO' | 'PROPOSAL' | 'PAYMENT' | 'SYSTEM'
    id: string
    code: string
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
    pendingPaymentRequests?: any[]
    slowMovingStock?: any[]
    topCustomers: any[]
    topProducts: any[]
    channels: any
    yoyData: any
    wf: any
    kpis: any[]
    preset: PresetKey
    currentEntity?: string
    displayRangeText: string
    complianceWarnings: any[]
    mySales: any
    warehouseData: any
    dashConfig: any
    dailyRevenueData: DailyRevenueSummary
    replenishmentAlerts?: SkuReplenishmentAlertItem[]
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
    pendingPaymentRequests = [],
    slowMovingStock = [],
    topCustomers,
    topProducts,
    channels,
    yoyData,
    wf,
    kpis,
    preset,
    currentEntity,
    displayRangeText,
    complianceWarnings,
    mySales,
    warehouseData,
    dashConfig,
    dailyRevenueData,
    replenishmentAlerts = [],
}: CeoOverviewContentProps) {
    const router = useRouter()
    const [isPendingAction, startTransition] = useTransition()
    const { locale, isEn, formatCurrency, formatDate } = useAppLocale()
    const t = getDashboardDictionary(locale)

    const [approvalFilter, setApprovalFilter] = useState<ApprovalFilterTab>('ALL')
    const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [actionError, setActionError] = useState<string | null>(null)

    const revenueKpiLabel = preset === 'THIS_MONTH'
        ? t.kpis.revenueMonth
        : preset === 'TODAY'
        ? t.kpis.revenueToday
        : preset === 'YESTERDAY'
        ? t.kpis.revenueYesterday
        : preset === '7DAYS'
        ? t.kpis.revenue7Days
        : t.kpis.revenuePeriod

    const runAction = (fn: () => Promise<{ success: boolean; error?: string }>) => {
        setActionError(null)
        startTransition(async () => {
            const res = await fn()
            if (!res.success && res.error) {
                setActionError(res.error)
            }
            router.refresh()
        })
    }

    const handleApproveItem = (type: RejectTarget['type'], id: string) => {
        if (type === 'SO') runAction(() => approveSO(id))
        else if (type === 'PROPOSAL') runAction(() => approveProposalFromDashboard(id))
        else if (type === 'PAYMENT') runAction(() => approvePaymentRequestFromDashboard(id))
        else if (type === 'SYSTEM') runAction(() => approveEngineRequestFromDashboard(id))
    }

    const handleConfirmReject = () => {
        if (!rejectTarget) return
        const reason = rejectReason.trim() || (isEn ? 'Rejected by CEO' : 'CEO từ chối phê duyệt')
        const target = rejectTarget
        setRejectTarget(null)
        setRejectReason('')

        if (target.type === 'SO') runAction(() => rejectSO(target.id, reason))
        else if (target.type === 'PROPOSAL') runAction(() => rejectProposalFromDashboard(target.id, reason))
        else if (target.type === 'PAYMENT') runAction(() => rejectPaymentRequestFromDashboard(target.id, reason))
        else if (target.type === 'SYSTEM') runAction(() => rejectEngineRequestFromDashboard(target.id, reason))
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

    const canSeeFinancials = Boolean(!dashConfig?.sections || dashConfig.sections.includes('pl_summary') || dashConfig.sections.includes('cash_position'))
    const canSeeRevenueChart = Boolean(!dashConfig?.sections || dashConfig.sections.includes('revenue_chart'))
    const canSeeArAging = Boolean(!dashConfig?.sections || dashConfig.sections.includes('ar_aging'))
    const canSeePendingApprovals = Boolean(!dashConfig?.sections || dashConfig.sections.includes('pending_approvals'))
    const canSeeRankings = Boolean(!dashConfig?.sections || dashConfig.sections.includes('top_products'))
    const isWarehouseOnly = Boolean(dashConfig?.sections?.includes('warehouse_summary') && !canSeeFinancials)
    const isSalesOnly = Boolean(dashConfig?.sections?.includes('my_sales') && !canSeeFinancials)

    const showShipmentTracker = Boolean(!dashConfig?.sections || dashConfig.sections.includes('shipment_tracker'))
    const hasKpis = Array.isArray(kpis) && kpis.length > 0 && Boolean(!dashConfig?.sections || dashConfig.sections.includes('kpi_targets'))
    const hasChannels = Boolean(channels && Array.isArray(channels.channels) && channels.channels.length > 0 && (!dashConfig?.sections || dashConfig.sections.includes('revenue_chart')))
    const hasYoy = Boolean(yoyData && Array.isArray(yoyData.current) && Array.isArray(yoyData.previous) && (!dashConfig?.sections || dashConfig.sections.includes('revenue_yoy')))
    const hasWf = Boolean(wf && Array.isArray(wf.bars) && wf.bars.length > 0 && (!dashConfig?.sections || dashConfig.sections.includes('cost_waterfall')))
    const hasCompliance = Boolean(complianceWarnings && complianceWarnings.length > 0 && (!dashConfig?.sections || dashConfig.sections.includes('legal_compliance')))
    const hasSlowStock = Boolean(Array.isArray(slowMovingStock) && slowMovingStock.length > 0 && (!dashConfig?.sections || dashConfig.sections.includes('stock_alerts')))
    const hasReplenishmentAlerts = Boolean(Array.isArray(replenishmentAlerts) && replenishmentAlerts.length > 0)
    const hasLayer5 = hasKpis || hasChannels || hasYoy || hasWf || hasCompliance || hasSlowStock || hasReplenishmentAlerts

    return (
        <div className="space-y-5">
            {/* ═══ LAYER 1 — ROLE-AWARE KPI CARDS ═══ */}
            {isWarehouseOnly ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                    <KpiCard
                        label={t.warehouseOverview.totalBottles}
                        value={(warehouseData?.totalBottles ?? stats.stockQty).toLocaleString(isEn ? 'en-US' : 'vi-VN')}
                        sub={`${t.kpis.bottlesUnit} khả dụng`}
                        tone="brand"
                    />
                    <KpiCard
                        label={t.warehouseOverview.lowStockSKUs}
                        value={String(warehouseData?.lowStockSKUs ?? stats.lowStockCount)}
                        sub="Cần nhập thêm"
                        tone="warning"
                    />
                    <KpiCard
                        label={t.warehouseOverview.quarantined}
                        value={String(warehouseData?.quarantinedLots ?? 0)}
                        sub="Chờ kiểm định"
                        tone="danger"
                    />
                    <KpiCard
                        label={t.warehouseOverview.pendingGRs}
                        value={String(warehouseData?.pendingGoodsReceipts ?? 0)}
                        sub="Đang chờ vào kho"
                        tone="info"
                    />
                    <KpiCard
                        label={t.warehouseOverview.pendingDOs}
                        value={String(warehouseData?.pendingDeliveryOrders ?? 0)}
                        sub="Đang chờ xuất kho"
                        tone="success"
                    />
                </div>
            ) : isSalesOnly ? (
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    <KpiCard
                        label={isEn ? 'My Revenue' : 'Doanh số của tôi'}
                        value={formatFriendlyVND(mySales?.totalRevenue ?? 0, isEn)}
                        sub={isEn ? 'This month sales' : 'Doanh số tháng này'}
                        tone="brand"
                    />
                    <KpiCard
                        label={isEn ? 'My Orders' : 'Đơn hàng của tôi'}
                        value={String(mySales?.orderCount ?? 0)}
                        sub={isEn ? 'Total orders' : 'Số đơn phát sinh'}
                        tone="warning"
                    />
                    <KpiCard
                        label={isEn ? 'Pending Delivery' : 'Đơn chờ giao'}
                        value={String(mySales?.orders?.filter((o: any) => o.status === 'CONFIRMED').length ?? 0)}
                        sub={isEn ? 'Confirmed orders' : 'Chờ kho xuất'}
                        tone="info"
                    />
                    <KpiCard
                        label={isEn ? 'Completed Orders' : 'Đã hoàn tất'}
                        value={String(mySales?.orders?.filter((o: any) => o.status === 'PAID' || o.status === 'DELIVERED').length ?? 0)}
                        sub={isEn ? 'Delivered / Paid' : 'Đã thanh toán / giao'}
                        tone="success"
                    />
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6 gap-3">
                    <KpiCard
                        label={revenueKpiLabel}
                        value={formatFriendlyVND(primaryRevenue, isEn)}
                        sub={revenueSource}
                        trend={stats.revenueGrowth !== 0 ? `${stats.revenueGrowth > 0 ? '+' : ''}${stats.revenueGrowth.toFixed(1)}% ${t.kpis.vsPrevPeriod}` : undefined}
                        trendUp={stats.revenueGrowth >= 0}
                        tone="brand"
                    />
                    {canSeeFinancials ? (
                        <>
                            <KpiCard
                                label={t.kpis.grossProfit}
                                value={formatFriendlyVND(pl.grossProfit, isEn)}
                                sub={`${t.kpis.margin}: ${pl.grossMargin.toFixed(1)}%`}
                                trend={pl.grossMargin >= 25 ? t.kpis.good : t.kpis.fair}
                                trendUp={pl.grossMargin >= 25}
                                tone="warning"
                            />
                            <KpiCard
                                label={t.kpis.netCashFlow}
                                value={`${cash.netCashFlow >= 0 ? '+' : ''}${formatFriendlyVND(cash.netCashFlow, isEn)}`}
                                sub={`${t.kpis.cashIn}: ${formatFriendlyVND(cash.cashIn, isEn)} · ${t.kpis.cashOut}: ${formatFriendlyVND(cash.cashOutAP + cash.cashOutExpenses, isEn)}`}
                                tone={cash.netCashFlow >= 0 ? 'success' : 'danger'}
                            />
                            <KpiCard
                                label={t.kpis.inventoryValue}
                                value={formatFriendlyVND(stats.stockTotalValue, isEn)}
                                sub={`${stats.stockQty.toLocaleString(isEn ? 'en-US' : 'vi-VN')} ${t.kpis.bottlesUnit}`}
                                tone="info"
                            />
                            <KpiCard
                                label={t.kpis.arOutstanding}
                                value={formatFriendlyVND(ar.totalOutstanding, isEn)}
                                sub={arOverdue > 0 ? `${formatFriendlyVND(arOverdue, isEn)} ${t.kpis.overdue}` : t.kpis.onTime}
                                tone={arOverdue > 0 ? 'danger' : 'success'}
                            />
                        </>
                    ) : (
                        <>
                            <KpiCard
                                label={t.warehouseOverview.totalBottles}
                                value={`${stats.stockQty.toLocaleString(isEn ? 'en-US' : 'vi-VN')} ${t.kpis.bottlesUnit}`}
                                sub="Chai trong kho"
                                tone="info"
                            />
                            <KpiCard
                                label="Lô hàng đang về"
                                value={String(stats.inTransitShipments?.length ?? 0)}
                                sub="Đang trên biển / Cảng"
                                tone="brand"
                            />
                            <KpiCard
                                label="Cảnh báo tồn kho"
                                value={String(stats.lowStockCount ?? 0)}
                                sub="SKU dưới định mức"
                                tone="warning"
                            />
                            <KpiCard
                                label="Hàng cách ly"
                                value={String(stats.quarantinedLots ?? 0)}
                                sub="Chờ kiểm định"
                                tone="danger"
                            />
                        </>
                    )}
                    <KpiCard
                        label={t.kpis.pendingApprovals}
                        value={String(totalPending)}
                        sub={pendingSub}
                        tone="danger"
                    />
                </div>
            )}

            {/* ═══ DAILY REVENUE TREND CHART ═══ */}
            {canSeeRevenueChart && <DailyRevenueChart data={dailyRevenueData} />}

            {/* ═══ LAYER 2 — FINANCIAL PULSE (P&L & Cash Position) ═══ */}
            {canSeeFinancials && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* P&L Summary */}
                    <Card className="p-5">
                        <SectionHead
                            icon={<BarChart3 size={15} className="text-lys-teal-strong" aria-hidden />}
                            title={preset === 'THIS_MONTH' ? t.pnl.monthlyTitle : `${t.pnl.periodTitle} (${displayRangeText})`}
                            badge={
                                <Badge tone={pl.grossMargin >= 25 ? 'success' : 'warning'} className="ml-1">
                                    {t.pnl.marginBadge} {pl.grossMargin.toFixed(1)}%
                                </Badge>
                            }
                        />
                        <div className="space-y-2.5">
                            {[
                                { label: t.pnl.netRevenue, value: primaryRevenue, colorClass: 'text-lys-teal-strong', pct: primaryRevenue > 0 ? 100 : null },
                                { label: t.pnl.cogs, value: -pl.cogs, colorClass: 'text-tone-danger-fg', neg: true, pct: primaryRevenue > 0 ? (pl.cogs / primaryRevenue) * 100 : null },
                                { label: t.pnl.grossProfit, value: pl.grossProfit, colorClass: pl.grossProfit >= 0 ? 'text-tone-warning-fg' : 'text-tone-danger-fg', bold: true, line: true, pct: primaryRevenue > 0 ? (pl.grossProfit / primaryRevenue) * 100 : null },
                                { label: t.pnl.expenses, value: -pl.expenses, colorClass: 'text-lys-secondary', neg: true, pct: primaryRevenue > 0 ? (pl.expenses / primaryRevenue) * 100 : null },
                                { label: t.pnl.netProfit, value: pl.netProfit, colorClass: pl.netProfit >= 0 ? 'text-tone-success-fg' : 'text-tone-danger-fg', bold: true, line: true, pct: primaryRevenue > 0 ? (pl.netProfit / primaryRevenue) * 100 : null },
                            ].map((r, idx) => (
                                <div key={idx}>
                                    {r.line && <div className="mb-2 border-t border-dashed border-lys-border" />}
                                    <div className="flex justify-between items-center">
                                        <span className={`text-xs ${r.bold ? `font-bold ${r.colorClass}` : 'text-lys-secondary'}`}>{r.label}</span>
                                        <div className="flex items-center gap-2">
                                            {r.pct !== null && idx > 0 && (
                                                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-lys-bg text-lys-muted border border-lys-border">
                                                    {r.pct.toFixed(1)}%
                                                </span>
                                            )}
                                            <span className={`text-sm type-number ${r.bold ? 'font-bold' : 'font-medium'} ${r.colorClass}`}>
                                                {r.value < 0 ? `− ${formatCurrency(Math.abs(r.value))}` : formatCurrency(r.value)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {stats.revenueGrowth !== 0 && (
                                <p className="text-[11px] text-right mt-1 text-lys-muted">
                                    {t.kpis.vsPrevPeriod}: {stats.revenueGrowth > 0 ? '+' : ''}{stats.revenueGrowth.toFixed(1)}%
                                </p>
                            )}
                        </div>
                    </Card>

                    {/* Cash Position */}
                    <Card className="p-5">
                        <SectionHead icon={<Wallet size={15} className="text-lys-teal-strong" aria-hidden />} title={t.cashFlow.title} />
                        <div className="p-3 rounded-md mb-3 bg-lys-bg/60 border border-lys-border">
                            <p className="text-[11px] uppercase tracking-wider mb-0.5 text-lys-muted font-semibold">{t.cashFlow.periodNetCash}</p>
                            <p className={`text-xl font-bold type-number ${cash.netCashFlow >= 0 ? 'text-tone-success-fg' : 'text-tone-danger-fg'}`}>
                                {cash.netCashFlow >= 0 ? '+' : ''}{formatCurrency(cash.netCashFlow)}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-2.5 rounded-md bg-tone-success-bg/60 border border-tone-success-border/60">
                                <div className="flex items-center gap-2">
                                    <ArrowDownLeft size={13} className="text-tone-success-fg" aria-hidden />
                                    <span className="text-xs text-tone-success-fg">{t.cashFlow.inflowSub}</span>
                                </div>
                                <span className="text-xs font-bold type-number text-tone-success-fg">+{formatCurrency(cash.cashIn)}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-md bg-tone-danger-bg/60 border border-tone-danger-border/60">
                                <div className="flex items-center gap-2">
                                    <ArrowUpRight size={13} className="text-tone-danger-fg" aria-hidden />
                                    <span className="text-xs text-tone-danger-fg">{t.cashFlow.outflowAP}</span>
                                </div>
                                <span className="text-xs font-bold type-number text-tone-danger-fg">−{formatCurrency(cash.cashOutAP)}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-md bg-tone-warning-bg/60 border border-tone-warning-border/60">
                                <div className="flex items-center gap-2">
                                    <ArrowUpRight size={13} className="text-tone-warning-fg" aria-hidden />
                                    <span className="text-xs text-tone-warning-fg">{t.cashFlow.outflowExpense}</span>
                                </div>
                                <span className="text-xs font-bold type-number text-tone-warning-fg">−{formatCurrency(cash.cashOutExpenses)}</span>
                            </div>
                            <div className="pt-2 border-t border-lys-border space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-lys-muted">{t.cashFlow.workingCapital}</span>
                                    <span className="text-lys-secondary type-number">{formatCurrency(cash.arOutstanding)} / {formatCurrency(cash.apOutstanding)}</span>
                                </div>
                                {((cash.apDueWithin30d ?? 0) > 0 || (cash.pendingDisbursementPR ?? 0) > 0) && (
                                    <div className="p-2.5 rounded-md space-y-1 bg-lys-bg border border-lys-border">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-tone-warning-fg">
                                            {t.cashFlow.upcomingObligations}
                                        </p>
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-lys-muted">{t.cashFlow.apDue30d}</span>
                                            <span className="type-number font-semibold text-tone-danger-fg">{formatFriendlyVND(cash.apDueWithin30d ?? 0, isEn)}</span>
                                        </div>
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-lys-muted">{t.cashFlow.pendingPRDisbursement}</span>
                                            <span className="type-number font-semibold text-tone-warning-fg">{formatFriendlyVND(cash.pendingDisbursementPR ?? 0, isEn)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* ═══ LAYER 3 — OPERATIONS ═══ */}
            {([showShipmentTracker, canSeeArAging, canSeeRankings].some(Boolean)) && (
                <div className={`grid grid-cols-1 ${
                    [showShipmentTracker, canSeeArAging, canSeeRankings].filter(Boolean).length >= 3
                        ? 'lg:grid-cols-3'
                        : [showShipmentTracker, canSeeArAging, canSeeRankings].filter(Boolean).length === 2
                        ? 'lg:grid-cols-2'
                        : 'lg:grid-cols-1'
                } gap-4`}>
                    {/* Container Tracker */}
                    {showShipmentTracker && (
                        <Card className="p-5">
                            <SectionHead
                                icon={<Ship size={15} className="text-lys-teal-strong" aria-hidden />}
                                title={t.containers.title}
                                badge={<Badge tone="info">{stats.inTransitShipments.length}</Badge>}
                            >
                                {stats.inTransitShipments.length > 0 && (
                                    <span className="text-[11px] font-mono font-semibold text-lys-secondary">
                                        {t.containers.totalCif}: ${stats.inTransitShipments.reduce((s: number, sh: any) => s + Number(sh.cifAmount ?? 0), 0).toLocaleString(isEn ? 'en-US' : 'vi-VN')}
                                    </span>
                                )}
                            </SectionHead>
                            {stats.inTransitShipments.length === 0 ? (
                                <div className="flex flex-col items-center py-6 gap-1">
                                    <Package size={24} className="text-lys-border-strong" aria-hidden />
                                    <p className="text-xs text-lys-muted">{t.containers.empty}</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {stats.inTransitShipments.map((s: any) => {
                                        const lbl = SHIP_STATUS_LABELS[s.status]
                                        const statusLabel = isEn
                                            ? (t.containers.statuses[s.status as keyof typeof t.containers.statuses] ?? lbl?.en ?? s.status)
                                            : (lbl?.vi ?? s.status)
                                        return (
                                            <div key={s.id} className="p-2.5 bg-lys-bg/50 border border-lys-border rounded-md">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div>
                                                        <p className="text-xs font-bold text-lys-teal-strong font-mono">{s.billOfLading}</p>
                                                        <p className="text-[11px] mt-0.5 text-lys-muted">
                                                            {t.containers.eta}: {s.eta ? formatDate(s.eta) : '--'}
                                                        </p>
                                                    </div>
                                                    <div className="text-right space-y-1">
                                                        <p className="text-xs font-bold type-number text-lys-primary">${s.cifAmount.toLocaleString(isEn ? 'en-US' : 'vi-VN')} {s.cifCurrency}</p>
                                                        <StatusBadge
                                                            status={s.status}
                                                            label={statusLabel}
                                                            toneOverrides={SHIP_TONE_OVERRIDES}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </Card>
                    )}

                    {/* AR Aging */}
                    {canSeeArAging && (
                        <Card className="p-5">
                            <SectionHead
                                icon={<DollarSign size={15} className="text-lys-teal-strong" aria-hidden />}
                                title={t.arAging.title}
                                badge={<Badge tone="info">{ar.invoiceCount} {t.arAging.invoicesCount}</Badge>}
                            />
                            <div className="p-2.5 rounded-md mb-3 bg-lys-bg border border-lys-border">
                                <p className="text-[11px] uppercase mb-0.5 text-lys-muted font-semibold">{t.arAging.totalOutstanding}</p>
                                <p className="text-lg font-bold type-number text-tone-warning-fg">{formatCurrency(ar.totalOutstanding)}</p>
                            </div>
                            <div className="space-y-2.5">
                                {ar.buckets.map((b: any) => (
                                    <div key={b.label}>
                                        <div className="flex justify-between mb-0.5">
                                            <span className="text-[11px] text-lys-secondary">{translateBucketLabel(b.label)}</span>
                                            <span className="text-[11px] font-bold type-number" style={{ color: b.color }}>{b.amount > 0 ? formatCurrency(b.amount) : '—'}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-lys-subtle">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(b.amount > 0 ? 4 : 0, (b.amount / arMax) * 100)}%`, background: b.color }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Top Customers & Top Products */}
                    {canSeeRankings && (
                        <Card className="p-5">
                            <SectionHead
                                icon={<Trophy size={15} className="text-tone-warning-fg" aria-hidden />}
                                title={preset === 'THIS_MONTH' ? t.rankings.monthTitle : t.rankings.periodTitle}
                            />
                            {/* Top Customers (1-click drill-down to Customer 360) */}
                            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-lys-muted flex items-center gap-1">
                                <Users size={11} aria-hidden />{t.rankings.topCustomers}
                            </p>
                            {topCustomers.length === 0 ? (
                                <p className="text-xs mb-3 text-lys-muted">{t.noData}</p>
                            ) : (
                                <div className="space-y-1 mb-4">
                                    {topCustomers.map((c: any, i: number) => {
                                        const custHref = `/dashboard?tab=customers&customerId=${c.id}${preset ? `&preset=${preset}` : ''}${currentEntity && currentEntity !== 'ALL' ? `&entity=${currentEntity}` : ''}`
                                        return (
                                            <button
                                                type="button"
                                                key={c.id || i}
                                                onClick={() => router.push(custHref)}
                                                title={t.rankings.clickCustomerHint}
                                                className={`group w-full text-left flex items-center justify-between py-1.5 px-2 rounded-md transition-colors hover:bg-lys-teal-soft/70 cursor-pointer ${i === 0 ? 'bg-lys-teal-soft/50' : ''}`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`text-[11px] font-bold w-4 ${i === 0 ? 'text-tone-warning-fg' : 'text-lys-muted'}`}>{i + 1}.</span>
                                                    <span className="text-xs truncate group-hover:text-lys-teal-strong font-medium text-lys-primary">{c.name}</span>
                                                    <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-lys-teal-strong" aria-hidden />
                                                </div>
                                                <span className="text-[11px] font-bold type-number flex-shrink-0 text-lys-teal-strong">{formatFriendlyVND(c.revenue, isEn)}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                            {/* Top Products */}
                            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-lys-muted flex items-center gap-1">
                                <Wine size={11} aria-hidden />{t.rankings.topProducts}
                            </p>
                            {topProducts.length === 0 ? (
                                <p className="text-xs text-lys-muted">{t.noData}</p>
                            ) : (
                                <div className="space-y-1">
                                    {topProducts.map((p: any, i: number) => (
                                        <div key={p.sku || i} className={`flex items-center justify-between py-1.5 px-2 rounded-md ${i === 0 ? 'bg-tone-warning-bg/50' : ''}`}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={`text-[11px] font-bold w-4 ${i === 0 ? 'text-tone-warning-fg' : 'text-lys-muted'}`}>{i + 1}.</span>
                                                <button type="button" onClick={() => router.push(`/dashboard?tab=skus${p.id ? `&productId=${p.id}` : ''}`)} className="text-xs truncate hover:text-lys-teal-strong font-medium flex items-center gap-1 group cursor-pointer text-left text-lys-primary" title="Xem Báo Cáo Theo SKU (Nhà nào đang lấy)"><span className="truncate">{p.name}</span><ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-lys-teal-strong" aria-hidden /></button>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {typeof p.marginPct === 'number' && (
                                                    <Badge tone={p.marginPct >= 25 ? 'success' : 'warning'} className="px-1.5 py-0 type-number">
                                                        GM {p.marginPct}%
                                                    </Badge>
                                                )}
                                                <span className="text-[11px] type-number text-lys-secondary">
                                                    {p.qty} {t.rankings.bottlesSold} &middot; {formatFriendlyVND(p.revenue, isEn)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}
                </div>
            )}

            {/* ═══ LAYER 4 — UNIFIED CEO ACTION HUB ═══ */}
            {canSeePendingApprovals && (
                <Card className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                            <Clock size={15} className="text-tone-danger-fg" aria-hidden />
                            <h3 className="type-section-title text-lys-primary">
                                {t.approvals.title}
                            </h3>
                            <Badge tone="danger">{totalPending}</Badge>
                        </div>

                        {/* Filter Pills */}
                        {totalPending > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {([
                                    { key: 'ALL' as const, label: t.approvals.filterAll, count: totalPending },
                                    { key: 'SO' as const, label: t.approvals.filterSO, count: stats.pendingSOs.length },
                                    { key: 'PROPOSAL' as const, label: t.approvals.filterProposals, count: pendingProposals.length },
                                    { key: 'PAYMENT' as const, label: t.approvals.filterPayments, count: pendingPaymentRequests.length },
                                    { key: 'SYSTEM' as const, label: t.approvals.filterEngine, count: Array.isArray(pendingApprovalReqs) ? pendingApprovalReqs.length : 0 },
                                ]).filter(tab => tab.key === 'ALL' || tab.count > 0).map(tab => {
                                    const active = approvalFilter === tab.key
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setApprovalFilter(tab.key)}
                                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                                                active
                                                    ? 'bg-lys-teal-strong text-white border-lys-teal-strong'
                                                    : 'bg-lys-subtle text-lys-secondary border-lys-border hover:bg-white'
                                            }`}
                                        >
                                            {tab.label} ({tab.count})
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {actionError && (
                        <div className="mb-3 p-2.5 rounded-md text-xs flex items-center justify-between bg-tone-danger-bg text-tone-danger-fg border border-tone-danger-border">
                            <span>{actionError}</span>
                            <button type="button" onClick={() => setActionError(null)} aria-label="Đóng" className="cursor-pointer">
                                <X size={13} />
                            </button>
                        </div>
                    )}

                    {totalPending === 0 ? (
                        <div className="flex flex-col items-center py-6 gap-1">
                            <CheckCircle2 size={24} className="text-tone-success-fg" aria-hidden />
                            <p className="text-xs text-lys-muted">
                                {t.approvals.noPending}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Pending Sales Orders */}
                            {(approvalFilter === 'ALL' || approvalFilter === 'SO') && stats.pendingSOs.map((so: any) => {
                                const marginTone: Tone = (so.estimatedMarginPct ?? 0) >= 25 ? 'success' : (so.estimatedMarginPct ?? 0) >= 15 ? 'warning' : 'danger'
                                return (
                                    <div key={so.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-2.5 px-3 bg-white border border-lys-border border-l-[3px] border-l-lys-teal-strong rounded-md">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                <AlertCircle size={13} className="text-lys-teal-strong shrink-0" aria-hidden />
                                                <Badge tone="brand">SO</Badge>
                                                <button type="button" onClick={() => router.push('/dashboard/sales')} className="text-xs font-bold hover:underline cursor-pointer text-lys-teal-strong font-mono">{so.soNo}</button>
                                                <span className="text-xs font-medium truncate text-lys-secondary">&middot; {so.customerName}</span>
                                                {typeof so.estimatedMarginPct === 'number' && (
                                                    <Badge tone={marginTone} className="type-number">
                                                        {t.approvals.margin}: {so.estimatedMarginPct}%
                                                    </Badge>
                                                )}
                                                {(so.effectiveDiscountPct ?? 0) > 0 && (
                                                    <Badge tone="danger" className="type-number">
                                                        {t.approvals.discount}: -{so.effectiveDiscountPct}%
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-[11px] text-lys-muted">
                                                <span>{t.approvals.salesRep}: <strong className="text-lys-secondary">{so.salesRepName}</strong></span>
                                                <span>&middot; {t.approvals.paymentTerm}: <strong className="text-lys-secondary">{so.paymentTerm}</strong></span>
                                                {so.bottleCount > 0 && <span>&middot; {so.bottleCount} {t.kpis.bottlesUnit}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                                            <p className="text-sm font-bold type-number text-lys-primary">{formatCurrency(so.amount)}</p>
                                            <div className="flex gap-1.5">
                                                <button
                                                    type="button"
                                                    disabled={isPendingAction}
                                                    onClick={() => handleApproveItem('SO', so.id)}
                                                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-tone-success-bg text-tone-success-fg border border-tone-success-border hover:bg-emerald-100/70 transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    {t.approvals.approve}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isPendingAction}
                                                    onClick={() => setRejectTarget({ type: 'SO', id: so.id, code: so.soNo })}
                                                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-tone-danger-bg text-tone-danger-fg border border-tone-danger-border hover:bg-red-100/70 transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    {t.approvals.reject}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Proposals */}
                            {(approvalFilter === 'ALL' || approvalFilter === 'PROPOSAL') && pendingProposals.map((p: any) => {
                                const prioCfg = PRIORITY_LABELS[p.priority] ?? PRIORITY_LABELS.NORMAL
                                const prioTone: Tone = p.priority === 'URGENT' ? 'danger' : p.priority === 'HIGH' ? 'warning' : 'neutral'
                                const borderLeftClass = p.priority === 'URGENT' ? 'border-l-tone-danger-fg' : p.priority === 'HIGH' ? 'border-l-tone-warning-fg' : 'border-l-lys-teal-strong'
                                return (
                                    <div key={p.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-2.5 px-3 bg-tone-warning-bg/30 border border-tone-warning-border/60 border-l-[3px] ${borderLeftClass} rounded-md`}>
                                        <div className="flex items-start gap-2 min-w-0 flex-1">
                                            <FileText size={14} className="text-tone-warning-fg flex-shrink-0 mt-0.5" aria-hidden />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                    <Badge tone={prioTone}>{prioCfg.label}</Badge>
                                                    <Badge tone="info">{CATEGORY_LABELS[p.category] ?? p.category}</Badge>
                                                    <button type="button" onClick={() => router.push('/dashboard/proposals')} className="text-xs font-bold hover:underline cursor-pointer text-lys-teal-strong font-mono">{p.proposalNo}</button>
                                                </div>
                                                <p className="text-sm truncate font-medium text-lys-primary">{p.title}</p>
                                                <span className="text-[11px] text-lys-muted">{p.creatorName}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                                            {p.estimatedAmount && <span className="text-sm font-bold type-number text-lys-primary">{formatCurrency(p.estimatedAmount)}</span>}
                                            <div className="flex gap-1.5">
                                                <button
                                                    type="button"
                                                    disabled={isPendingAction}
                                                    onClick={() => handleApproveItem('PROPOSAL', p.id)}
                                                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-tone-success-bg text-tone-success-fg border border-tone-success-border hover:bg-emerald-100/70 transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    {t.approvals.approve}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isPendingAction}
                                                    onClick={() => setRejectTarget({ type: 'PROPOSAL', id: p.id, code: p.proposalNo })}
                                                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-tone-danger-bg text-tone-danger-fg border border-tone-danger-border hover:bg-red-100/70 transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    {t.approvals.reject}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Payment Requests */}
                            {(approvalFilter === 'ALL' || approvalFilter === 'PAYMENT') && pendingPaymentRequests.map((pr: any) => (
                                <div key={pr.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-2.5 px-3 bg-white border border-lys-border border-l-[3px] border-l-tone-info-fg rounded-md">
                                    <div className="flex items-start gap-2 min-w-0 flex-1">
                                        <CreditCard size={14} className="text-tone-info-fg flex-shrink-0 mt-0.5" aria-hidden />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                <Badge tone="info">{t.approvals.paymentReqBadge}</Badge>
                                                <Badge tone="neutral">{pr.purposeLabel}</Badge>
                                                <button type="button" onClick={() => router.push('/dashboard/payment-requests')} className="text-xs font-bold hover:underline cursor-pointer text-lys-teal-strong font-mono">
                                                    {pr.requestNo}
                                                </button>
                                            </div>
                                            <p className="text-xs truncate font-medium text-lys-primary">{pr.beneficiary}</p>
                                            <span className="text-[11px] text-lys-muted">
                                                {pr.requesterName} &middot; {formatDate(pr.dueDate)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                                        <span className="text-sm font-bold type-number text-lys-primary">{formatCurrency(pr.amount)}</span>
                                        <div className="flex gap-1.5">
                                            <button
                                                type="button"
                                                disabled={isPendingAction}
                                                onClick={() => handleApproveItem('PAYMENT', pr.id)}
                                                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-tone-success-bg text-tone-success-fg border border-tone-success-border hover:bg-emerald-100/70 transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                {t.approvals.approve}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isPendingAction}
                                                onClick={() => setRejectTarget({ type: 'PAYMENT', id: pr.id, code: pr.requestNo })}
                                                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-tone-danger-bg text-tone-danger-fg border border-tone-danger-border hover:bg-red-100/70 transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                {t.approvals.reject}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* System Approval Engine */}
                            {(approvalFilter === 'ALL' || approvalFilter === 'SYSTEM') && Array.isArray(pendingApprovalReqs) && pendingApprovalReqs.map((arItem: any) => (
                                <div key={arItem.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-2.5 px-3 bg-white border border-lys-border rounded-md">
                                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                        <ClipboardCheck size={13} className="text-lys-teal-strong shrink-0" aria-hidden />
                                        <Badge tone="warning">{arItem.docType}</Badge>
                                        <span className="text-xs font-medium truncate text-lys-primary">{arItem.templateName}</span>
                                        <span className="text-[11px] text-lys-muted">({t.approvals.step} {arItem.currentStep} &middot; {arItem.requestedBy})</span>
                                    </div>
                                    <div className="flex items-center justify-end gap-1.5 flex-shrink-0">
                                        <button
                                            type="button"
                                            disabled={isPendingAction}
                                            onClick={() => handleApproveItem('SYSTEM', arItem.id)}
                                            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-tone-success-bg text-tone-success-fg border border-tone-success-border hover:bg-emerald-100/70 transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            {t.approvals.approve}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isPendingAction}
                                            onClick={() => setRejectTarget({ type: 'SYSTEM', id: arItem.id, code: `${arItem.docType} #${arItem.docId?.slice(-6) ?? ''}` })}
                                            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-tone-danger-bg text-tone-danger-fg border border-tone-danger-border hover:bg-red-100/70 transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            {t.approvals.reject}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Reject Reason Modal */}
            <Modal
                open={!!rejectTarget}
                onClose={() => { setRejectTarget(null); setRejectReason('') }}
                title={
                    <span>
                        {t.approvals.rejectReasonTitle}:{' '}
                        <span className="text-tone-danger-fg font-mono">{rejectTarget?.code}</span>
                    </span>
                }
                footer={
                    <>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setRejectTarget(null); setRejectReason('') }}
                        >
                            {t.approvals.cancel}
                        </Button>
                        <Button
                            variant="danger"
                            size="sm"
                            loading={isPendingAction}
                            onClick={handleConfirmReject}
                        >
                            {t.approvals.confirmReject}
                        </Button>
                    </>
                }
            >
                <Textarea
                    rows={3}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder={t.approvals.rejectReasonPlaceholder}
                />
            </Modal>

            {/* ═══ LAYER 5 — DEEP ANALYSIS (Grid of cards) ═══ */}
            {hasLayer5 && (
                <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-lys-muted">
                        <LineChart size={13} className="text-lys-muted" aria-hidden />
                        <span>{t.inDepth.title}</span>
                    </h3>

                    {/* KPI Progress + Channel Breakdown */}
                    {(hasKpis || hasChannels) && (
                        <div className={hasKpis && hasChannels ? 'grid grid-cols-1 xl:grid-cols-5 gap-4' : 'space-y-4'}>
                            {/* KPI Targets */}
                            {hasKpis && (
                                <Card className={hasChannels ? 'xl:col-span-3 p-5' : 'w-full p-5'}>
                                    <SectionHead
                                        icon={<Target size={15} className="text-lys-teal-strong" aria-hidden />}
                                        title={t.inDepth.monthlyKpiTargets}
                                        badge={
                                            <Badge tone="brand">
                                                {kpis.filter((k: any) => k.progressPct >= 100).length}/{kpis.length} {t.inDepth.achieved}
                                            </Badge>
                                        }
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">
                                        {kpis.map((kpi: any) => {
                                            const pct = Math.min(kpi.progressPct, 100)
                                            const kpiTone: Tone = kpi.status === 'ON_TRACK' ? 'success' : kpi.status === 'AT_RISK' ? 'warning' : 'danger'
                                            const sl = kpi.status === 'ON_TRACK' ? t.inDepth.onTrack : kpi.status === 'AT_RISK' ? t.inDepth.atRisk : t.inDepth.behind
                                            return (
                                                <div key={kpi.metric} className="space-y-1.5">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <p className="text-[11px] font-semibold truncate text-lys-secondary">{kpi.label}</p>
                                                        <Badge tone={kpiTone} className="px-1.5 py-0">{sl}</Badge>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-lys-subtle">
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: kpi.color ?? '#0E7490' }} />
                                                    </div>
                                                    <div className="flex justify-between type-number text-[11px]">
                                                        <span className="font-bold text-lys-primary">
                                                            {kpi.unit === 'VND' ? formatFriendlyVND(kpi.actual, isEn) : kpi.actual}
                                                        </span>
                                                        <span className="text-lys-muted">/ {kpi.unit === 'VND' ? formatFriendlyVND(kpi.target, isEn) : kpi.target}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </Card>
                            )}

                            {/* Channel Breakdown */}
                            {hasChannels && (
                                <Card className={hasKpis ? 'xl:col-span-2 p-5' : 'w-full p-5'}>
                                    <SectionHead icon={<BarChart3 size={15} className="text-tone-warning-fg" aria-hidden />} title={t.rankings.channelTitle} />
                                    <div className="space-y-2.5">
                                        {channels.channels.map((ch: any) => (
                                            <div key={ch.channel}>
                                                <div className="flex justify-between mb-0.5">
                                                    <span className="text-xs text-lys-secondary">{ch.label}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-bold type-number" style={{ color: ch.color }}>{formatFriendlyVND(ch.revenue, isEn)}</span>
                                                        <span className="inline-block text-[11px] px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap shrink-0 type-number" style={{ background: `${ch.color}18`, color: ch.color }}>{ch.pct}%</span>
                                                    </div>
                                                </div>
                                                <div className="h-2 rounded-full bg-lys-subtle">
                                                    <div className="h-full rounded-full transition-all" style={{ width: `${ch.pct}%`, background: ch.color }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* Revenue YoY + Cost Waterfall */}
                    {(hasYoy || hasWf) && (
                        <div className={hasYoy && hasWf ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-4'}>
                            {/* Revenue YoY */}
                            {hasYoy && (() => {
                                const yoyMax = Math.max(...yoyData.current.map((m: any) => m.revenue), ...yoyData.previous.map((m: any) => m.revenue), 1)
                                const cm = new Date().getMonth() + 1
                                return (
                                    <Card className="p-5">
                                        <SectionHead
                                            icon={<TrendingUp size={15} className="text-lys-teal-strong" aria-hidden />}
                                            title={`${t.inDepth.revenueYoY} ${yoyData.thisYear} vs ${yoyData.lastYear}`}
                                        >
                                            <Badge tone={yoyData.yoyGrowth >= 0 ? 'success' : 'danger'} className="type-number">
                                                {yoyData.yoyGrowth >= 0 ? '↑' : '↓'}{Math.abs(yoyData.yoyGrowth).toFixed(1)}% YoY
                                            </Badge>
                                        </SectionHead>
                                        <div className="flex items-end gap-0.5 h-32 mb-2">
                                            {yoyData.current.map((m: any, i: number) => {
                                                const prev = yoyData.previous[i]
                                                const curH = Math.max(2, (m.revenue / yoyMax) * 110)
                                                const prevH = Math.max(2, (prev.revenue / yoyMax) * 110)
                                                return (
                                                    <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                                                        <div className="w-full flex gap-px h-[110px] items-end">
                                                            <div className="flex-1 rounded-t-sm bg-lys-border" style={{ height: prevH }} />
                                                            <div
                                                                className={`flex-1 rounded-t-sm ${
                                                                    m.month > cm ? 'bg-transparent' : m.revenue > prev.revenue ? 'bg-lys-teal-strong' : 'bg-tone-warning-fg'
                                                                }`}
                                                                style={{ height: m.month > cm ? 0 : curH }}
                                                            />
                                                        </div>
                                                        <span className={`text-[11px] ${m.month === cm ? 'text-lys-teal-strong font-bold' : 'text-lys-muted'}`}>
                                                            {m.label}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <div className="flex justify-center gap-6 pt-2 border-t border-lys-border">
                                            <div className="text-center">
                                                <p className="text-[11px] uppercase font-semibold text-lys-muted">{yoyData.thisYear}</p>
                                                <p className="text-xs font-bold type-number text-lys-teal-strong">{formatCurrency(yoyData.totalCurrent)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[11px] uppercase font-semibold text-lys-muted">{yoyData.lastYear}</p>
                                                <p className="text-xs font-bold type-number text-lys-muted">{formatCurrency(yoyData.totalPrevious)}</p>
                                            </div>
                                        </div>
                                    </Card>
                                )
                            })()}

                            {/* Cost Waterfall */}
                            {hasWf && (
                                <Card className="p-5">
                                    <SectionHead icon={<BarChart3 size={15} className="text-tone-warning-fg" aria-hidden />} title={t.waterfall.title}>
                                        <Badge tone={wf.netProfit >= 0 ? 'success' : 'danger'} className="type-number">
                                            Net {wf.revenue > 0 ? ((wf.netProfit / wf.revenue) * 100).toFixed(1) : 0}%
                                        </Badge>
                                    </SectionHead>
                                    <div className="flex items-end gap-1.5 h-36 mb-3">
                                        {wf.bars.map((bar: WaterfallBar) => {
                                            const absMax = Math.max(...wf.bars.map((b: WaterfallBar) => Math.abs(b.value)), 1)
                                            const barH = Math.max(6, (Math.abs(bar.value) / absMax) * 120)
                                            return (
                                                <div key={bar.label} className="flex-1 flex flex-col items-center gap-0.5">
                                                    <span className="text-[11px] font-bold type-number" style={{ color: bar.color }}>
                                                        {bar.value !== 0 ? formatFriendlyVND(Math.abs(bar.value), isEn) : (isEn ? '0 VND' : '0 đ')}
                                                    </span>
                                                    <div className="w-full relative h-[120px]">
                                                        <div className="absolute bottom-0 w-full rounded-t-sm" style={{ height: barH, background: `${bar.color}${bar.type === 'negative' ? '35' : '60'}`, borderLeft: `2px solid ${bar.color}`, borderTop: `2px solid ${bar.color}`, borderRight: `2px solid ${bar.color}` }} />
                                                    </div>
                                                    <p className="text-[11px] text-center leading-tight truncate w-full text-lys-secondary">
                                                        {bar.label.split(' (')[0]}
                                                    </p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-4 pt-2 border-t border-lys-border">
                                        {[
                                            { label: t.waterfall.revenue, dotClass: 'bg-tone-success-fg', textClass: 'text-tone-success-fg', val: wf.revenue },
                                            { label: 'COGS', dotClass: 'bg-tone-danger-fg', textClass: 'text-tone-danger-fg', val: wf.cogs },
                                            { label: isEn ? 'OPEX' : 'CP', dotClass: 'bg-tone-warning-fg', textClass: 'text-tone-warning-fg', val: wf.totalExpenses },
                                            { label: t.waterfall.netProfit, dotClass: wf.netProfit >= 0 ? 'bg-tone-success-fg' : 'bg-tone-danger-fg', textClass: wf.netProfit >= 0 ? 'text-tone-success-fg' : 'text-tone-danger-fg', val: wf.netProfit },
                                        ].map(l => (
                                            <div key={l.label} className="flex items-center gap-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${l.dotClass}`} />
                                                <span className="text-[11px] text-lys-muted">{l.label}</span>
                                                <span className={`text-[11px] font-bold type-number ${l.textClass}`}>{formatCurrency(Math.abs(l.val))}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* SKU Replenishment & Stock Alert Priority Queue */}
                    {hasReplenishmentAlerts && (
                        <Card className="p-5">
                            <SectionHead
                                icon={<Package size={15} className="text-tone-danger-fg" aria-hidden />}
                                title={
                                    isEn
                                        ? 'SKU Stock Alert & Replenishment Priority Queue (Sorted by Urgency)'
                                        : 'Cảnh Báo Tồn Kho & Đề Xuất Mua Hàng Theo SKU (Sắp Xếp Từ Trên Xuống Dưới)'
                                }
                                badge={
                                    <Badge tone="danger">
                                        {replenishmentAlerts.length} {isEn ? 'SKUs to Reorder' : 'SKU cần mua thêm'}
                                    </Badge>
                                }
                            >
                                <Link
                                    href="/dashboard?tab=skus"
                                    className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-lys-teal-soft text-lys-teal-strong border border-tone-brand-border hover:bg-cyan-100/70 transition-colors whitespace-nowrap"
                                >
                                    {isEn ? 'Open SKU 360°' : 'Mở Báo Cáo SKU 360°'}
                                </Link>
                            </SectionHead>

                            <div className="overflow-x-auto border border-lys-border rounded-lg max-h-[340px] overflow-y-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-lys-subtle border-b border-lys-border text-[11px] font-semibold uppercase text-lys-secondary whitespace-nowrap">
                                            <th className="py-2 px-3 w-10">#</th>
                                            <th className="py-2 px-3">{isEn ? 'Priority' : 'Mức Độ Ưu Tiên'}</th>
                                            <th className="py-2 px-3">{isEn ? 'SKU & Wine Name' : 'Mã SKU & Tên Rượu'}</th>
                                            <th className="py-2 px-3 text-right">{isEn ? 'Stock' : 'Tồn Kho'}</th>
                                            <th className="py-2 px-3 text-right">{isEn ? 'Avg Velocity' : 'Tốc Độ Bán TB'}</th>
                                            <th className="py-2 px-3 text-right">{isEn ? 'MOS' : 'MOS Hiện Tại'}</th>
                                            <th className="py-2 px-3 text-right">{isEn ? 'Suggested Reorder (6M)' : 'SL Cần Mua Thêm (Chuẩn 6T)'}</th>
                                            <th className="py-2 px-3 text-right">{isEn ? 'Est. Capital' : 'Dự Toán Vốn'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-lys-border">
                                        {replenishmentAlerts.slice(0, 20).map((item, idx) => {
                                            const tierTone: Tone =
                                                item.urgencyTier === 'OUT_OF_STOCK'
                                                    ? 'danger'
                                                    : item.urgencyTier === 'CRITICAL'
                                                    ? 'warning'
                                                    : item.urgencyTier === 'LOW'
                                                    ? 'brand'
                                                    : 'neutral'
                                            return (
                                                <tr key={item.id} className="hover:bg-lys-subtle/60 transition-colors whitespace-nowrap">
                                                    <td className="py-2 px-3 font-mono text-lys-muted tabular-nums">{idx + 1}</td>
                                                    <td className="py-2 px-3">
                                                        <Badge tone={tierTone}>
                                                            {isEn ? item.urgencyLabelEn : item.urgencyLabelVi}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <Link
                                                            href={`/dashboard?tab=skus&productId=${item.id}`}
                                                            className="flex items-center gap-2 group"
                                                        >
                                                            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-lys-subtle text-lys-primary border border-lys-border">
                                                                {item.skuCode}
                                                            </span>
                                                            <span className="font-semibold text-lys-primary group-hover:text-lys-teal-strong truncate max-w-[260px]">
                                                                {item.productName}
                                                            </span>
                                                            <ExternalLink size={12} className="text-lys-dim group-hover:text-lys-teal-strong shrink-0" aria-hidden />
                                                        </Link>
                                                    </td>
                                                    <td className="py-2 px-3 text-right type-number">
                                                        <span className={`font-bold ${item.totalStock <= 0 ? 'text-tone-danger-fg' : 'text-lys-primary'}`}>
                                                            {item.totalStock.toLocaleString('vi-VN')} {isEn ? 'btls' : 'chai'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-semibold text-lys-primary type-number">
                                                        {item.avgMonthlySales.toLocaleString('vi-VN')} {isEn ? 'btls/mo' : 'chai/tháng'}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-bold type-number">
                                                        <span className={item.mosCurrent < 2 ? 'text-tone-danger-fg' : item.mosCurrent < 3.5 ? 'text-tone-warning-fg' : 'text-lys-primary'}>
                                                            {item.mosCurrent} {isEn ? 'mos' : 'tháng'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-bold text-lys-teal-strong type-number">
                                                        {item.suggestedReorderBottles.toLocaleString('vi-VN')} {isEn ? 'btls' : 'chai'} ({item.suggestedReorderCases} {isEn ? 'cs' : 'thùng'})
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-semibold text-lys-primary type-number">
                                                        {item.estimatedReorderCostVnd > 0 ? formatCurrency(item.estimatedReorderCostVnd) : '—'}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* Slow-Moving & Dead Stock Capital Alert */}
                    {hasSlowStock && (() => {
                        const deadLots = slowMovingStock.filter((l: any) => l.status === 'DEAD')
                        const slowLots = slowMovingStock.filter((l: any) => l.status === 'SLOW')
                        const totalTiedCapital = slowMovingStock.reduce((s: number, l: any) => s + Number(l.stockValue ?? 0), 0)
                        return (
                            <Card className="p-5">
                                <SectionHead
                                    icon={<Archive size={15} className="text-tone-warning-fg" aria-hidden />}
                                    title={t.slowStock.title}
                                    badge={
                                        <Badge tone={deadLots.length > 0 ? 'danger' : 'warning'}>
                                            {t.slowStock.tiedCapital}: {formatFriendlyVND(totalTiedCapital, isEn)}
                                        </Badge>
                                    }
                                >
                                    <div className="flex items-center gap-2 text-[11px] font-semibold">
                                        <Badge tone="danger">{t.slowStock.deadLabel}: {deadLots.length}</Badge>
                                        <Badge tone="warning">{t.slowStock.slowLabel}: {slowLots.length}</Badge>
                                    </div>
                                </SectionHead>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {slowMovingStock.slice(0, 6).map((lot: any) => {
                                        const isDead = lot.status === 'DEAD'
                                        return (
                                            <div key={lot.lotId} className={`p-2.5 rounded-md border flex items-center justify-between gap-2 ${isDead ? 'bg-tone-danger-bg/40 border-tone-danger-border' : 'bg-lys-bg border-lys-border'}`}>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold truncate text-lys-primary">{lot.productName}</p>
                                                    <p className="text-[11px] font-mono truncate text-lys-muted">
                                                        {lot.sku} &middot; {lot.locationCode} &middot; {lot.qtyRemaining} {t.kpis.bottlesUnit}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0 space-y-0.5">
                                                    <p className={`text-xs font-bold type-number ${isDead ? 'text-tone-danger-fg' : 'text-tone-warning-fg'}`}>
                                                        {formatFriendlyVND(lot.stockValue, isEn)}
                                                    </p>
                                                    <Badge tone={isDead ? 'danger' : 'warning'} className="type-number">
                                                        {lot.daysInStock} {t.slowStock.daysInStock}
                                                    </Badge>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </Card>
                        )
                    })()}

                    {/* Legal Compliance */}
                    {hasCompliance && (
                        <Card className="p-5">
                            <SectionHead
                                icon={<Shield size={15} className="text-tone-warning-fg" aria-hidden />}
                                title={t.compliance.title}
                                badge={
                                    <Badge tone={complianceWarnings.some((w: any) => w.severity === 'critical') ? 'danger' : 'warning'}>
                                        {complianceWarnings.length} {t.compliance.documents}
                                    </Badge>
                                }
                            >
                                <Link href="/dashboard/contracts" className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-lys-teal-soft text-lys-teal-strong border border-tone-brand-border hover:bg-cyan-100/70 transition-colors">
                                    {t.compliance.viewAll}
                                </Link>
                            </SectionHead>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {complianceWarnings.slice(0, 6).map((w: any) => {
                                    const sevClass = w.severity === 'critical'
                                        ? 'bg-tone-danger-bg/50 border-tone-danger-border text-tone-danger-fg'
                                        : w.severity === 'warning'
                                        ? 'bg-tone-warning-bg/50 border-tone-warning-border text-tone-warning-fg'
                                        : 'bg-lys-teal-soft/50 border-tone-brand-border text-lys-teal-strong'
                                    return (
                                        <div key={w.id} className={`flex items-center justify-between p-2.5 rounded-md border ${sevClass}`}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <AlertTriangle size={13} className="shrink-0" aria-hidden />
                                                <div className="min-w-0">
                                                    <p className="text-xs truncate font-medium text-lys-primary">{w.name}</p>
                                                    <p className="text-[11px] text-lys-muted">{REG_DOC_TYPE_LABELS[w.type] ?? w.type}</p>
                                                </div>
                                            </div>
                                            <span className="text-[11px] font-bold flex-shrink-0 type-number">
                                                {w.daysRemaining !== null && w.daysRemaining <= 0 ? `${t.compliance.overdue} ${Math.abs(w.daysRemaining)}d` : `${w.daysRemaining}${t.compliance.daysRemaining}`}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* ═══ QUICK LINKS (Bottom) ═══ */}
            {dashConfig.quickLinks.length > 0 && (
                <Card className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-lys-muted">
                        {t.quickAccess.title}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {dashConfig.quickLinks.map((link: any) => (
                            <Link key={link.href} href={link.href} className="flex items-center gap-2 p-2.5 rounded-md bg-white border border-lys-border hover:border-lys-teal hover:bg-lys-teal-soft/30 transition-all">
                                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-lys-teal-soft text-lys-teal-strong">
                                    <LinkIcon size={12} aria-hidden />
                                </div>
                                <span className="text-xs font-medium truncate text-lys-primary">{link.label}</span>
                            </Link>
                        ))}
                    </div>
                </Card>
            )}

            {/* ═══ ROLE-SPECIFIC: My Sales ═══ */}
            {mySales && (
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 text-tone-warning-fg">
                            <BarChart3 size={13} aria-hidden />
                            <span>{t.mySales.title}</span>
                        </p>
                        <div className="flex items-center gap-3 type-number">
                            <span className="text-xs font-bold text-lys-teal-strong">{mySales.orderCount} {t.mySales.orders}</span>
                            <span className="text-sm font-bold text-lys-primary">{formatCurrency(mySales.totalRevenue)}</span>
                        </div>
                    </div>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {mySales.orders.map((o: any) => (
                            <div key={o.soNo} className="flex items-center justify-between py-1.5 px-2.5 rounded-md bg-lys-bg/50 border border-lys-border">
                                <span className="text-xs font-bold text-lys-teal-strong font-mono">{o.soNo}</span>
                                <span className="text-xs text-lys-secondary">{o.customerName}</span>
                                <StatusBadge status={o.status} />
                                <span className="text-xs font-bold type-number text-lys-primary">{formatCurrency(o.amount)}</span>
                            </div>
                        ))}
                        {mySales.orders.length === 0 && <p className="text-xs text-center py-3 text-lys-muted">{t.noData}</p>}
                    </div>
                </Card>
            )}

            {/* ═══ ROLE-SPECIFIC: Warehouse ═══ */}
            {warehouseData && (
                <Card className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5 text-tone-info-fg">
                        <Package size={13} aria-hidden />
                        <span>{t.warehouseOverview.title}</span>
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
                        {[
                            { label: t.warehouseOverview.totalBottles, value: warehouseData.totalBottles.toLocaleString(isEn ? 'en-US' : 'vi-VN'), textClass: 'text-lys-teal-strong' },
                            { label: t.warehouseOverview.lowStockSKUs, value: warehouseData.lowStockSKUs, textClass: 'text-tone-warning-fg' },
                            { label: t.warehouseOverview.quarantined, value: warehouseData.quarantinedLots, textClass: 'text-tone-danger-fg' },
                            { label: t.warehouseOverview.pendingGRs, value: warehouseData.pendingGoodsReceipts, textClass: 'text-tone-info-fg' },
                            { label: t.warehouseOverview.pendingDOs, value: warehouseData.pendingDeliveryOrders, textClass: 'text-tone-success-fg' },
                        ].map(s => (
                            <div key={s.label} className="text-center p-2.5 rounded-md bg-lys-bg/60 border border-lys-border">
                                <p className={`text-lg font-bold type-number ${s.textClass}`}>{s.value}</p>
                                <p className="text-[11px] mt-0.5 text-lys-muted">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    )
}
