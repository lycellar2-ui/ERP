﻿export const revalidate = 30

import {
    getDashboardStats, getMonthlyRevenue, approveSO, rejectSO,
    getPLSummary, getCashPosition, getARAgingChart, getPendingApprovalDetails,
    exportDashboardExcel, getCostWaterfall, WaterfallBar, getRevenueYoY,
    getDashboardConfig, type DashboardSection, getMySales, getWarehouseDashboard,
    getRealtimeChannels,
} from './actions'
import { getKpiSummary } from './kpi/actions'
import { getCurrentUser } from '@/lib/session'
import {
    TrendingUp, TrendingDown, AlertCircle, Ship, Package, CheckCircle2,
    ArrowDownLeft, ArrowUpRight, DollarSign, BarChart3, Wallet, Target, ClipboardCheck, Download,
    Link as LinkIcon
} from 'lucide-react'
import { formatVND } from '@/lib/utils'
import Link from 'next/link'

function KpiCard({ label, value, sub, trend, trendUp, accentColor = '#87CBB9' }: {
    label: string; value: string; sub?: string
    trend?: string; trendUp?: boolean; accentColor?: string
}) {
    return (
        <div className="rounded-md p-6 relative overflow-hidden"
            style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: `3px solid ${accentColor}` }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A6A7A' }}>
                {label}
            </p>
            <p className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-mono), monospace', color: '#E8F1F2' }}>
                {value}
            </p>
            {sub && <p className="text-xs" style={{ color: '#4A6A7A' }}>{sub}</p>}
            {trend && (
                <div className="flex items-center gap-1 mt-2">
                    {trendUp
                        ? <TrendingUp size={13} style={{ color: '#5BA88A' }} />
                        : <TrendingDown size={13} style={{ color: '#8B1A2E' }} />
                    }
                    <span className="text-xs font-medium" style={{ color: trendUp ? '#5BA88A' : '#8B1A2E' }}>
                        {trend}
                    </span>
                </div>
            )}
        </div>
    )
}

const SHIPMENT_STATUS: Record<string, { label: string; color: string }> = {
    BOOKED: { label: 'Đã đặt', color: '#4A8FAB' },
    ON_VESSEL: { label: 'Trên biển', color: '#87CBB9' },
    ARRIVED_PORT: { label: 'Sắp đến cảng', color: '#D4A853' },
    CUSTOMS_CLEARED: { label: 'Đã thông quan', color: '#5BA88A' },
    DELIVERED_TO_WAREHOUSE: { label: 'Đã về kho', color: '#4A6A7A' },
}

export default async function DashboardPage() {
    const user = await getCurrentUser()
    const roles = user?.roles ?? ['CEO'] // fallback for dev
    const dashConfig = await getDashboardConfig(roles)
    const has = (s: DashboardSection) => dashConfig.sections.includes(s)

    // Batch 1: Core KPIs (max 5 concurrent queries)
    const [stats, monthlyRevenue, plSummary, cashPosition, kpiSummary] = await Promise.all([
        getDashboardStats('month'),
        getMonthlyRevenue(),
        has('pl_summary') ? getPLSummary() : null,
        has('cash_position') ? getCashPosition() : null,
        has('kpi_targets') ? getKpiSummary() : null,
    ])

    // Batch 2: Secondary widgets (max 5 concurrent queries)
    const [arAging, pendingApprovalReqs, waterfall, yoy] = await Promise.all([
        has('ar_aging') ? getARAgingChart() : null,
        has('pending_approvals') ? getPendingApprovalDetails() : [],
        has('cost_waterfall') ? getCostWaterfall() : [],
        has('revenue_yoy') ? getRevenueYoY() : null,
    ])

    // Batch 3: Role-specific data (sequential to avoid pool exhaustion)
    const mySales = has('my_sales') && user ? await getMySales(user.id) : null
    const warehouseData = has('warehouse_summary') ? await getWarehouseDashboard() : null
    const realtimeChannels = getRealtimeChannels(roles)

    const _kpiSummary = kpiSummary ?? []
    const _plSummary = plSummary ?? { revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, grossMargin: 0 }
    const _cashPosition = cashPosition ?? { netCashFlow: 0, cashIn: 0, cashOutAP: 0, cashOutExpenses: 0, arOutstanding: 0, apOutstanding: 0 }
    const _arAging = arAging ?? { invoiceCount: 0, totalOutstanding: 0, buckets: [] as { label: string; amount: number; color: string }[] }
    const _waterfall = Array.isArray(waterfall) ? { bars: [] as WaterfallBar[], revenue: 0, cogs: 0, totalExpenses: 0, netProfit: 0 } : waterfall
    const _yoy = yoy ?? { thisYear: new Date().getFullYear(), lastYear: new Date().getFullYear() - 1, current: [] as { month: number; label: string; revenue: number }[], previous: [] as { month: number; label: string; revenue: number }[], totalCurrent: 0, totalPrevious: 0, yoyGrowth: 0 }

    // Use P&L (accounting TK 511) as primary revenue source for consistency
    // Falls back to SO-based stats.revenue when P&L is unavailable
    const primaryRevenue = _plSummary.revenue > 0 ? _plSummary.revenue : stats.revenue
    const revenueSource = _plSummary.revenue > 0 ? 'Từ sổ kế toán (TK 511)' : 'Từ đơn hàng (SO)'
    const maxBar = Math.max(...monthlyRevenue.map(m => m.revenue), 1)
    const arMax = _arAging.buckets.length > 0 ? Math.max(..._arAging.buckets.map(b => b.amount), 1) : 1

    return (
        <div className="space-y-6 max-w-7xl mx-auto">

            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold"
                        style={{ fontFamily: 'var(--font-display), Georgia, serif', color: '#E8F1F2' }}>
                        {dashConfig.greeting}
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        {user?.name ?? 'Dashboard'} · {roles.join(', ')} &bull; {new Date().toLocaleString('vi-VN')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <form action={async () => {
                        'use server'
                        await exportDashboardExcel()
                    }}>
                        <button type="submit" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md"
                            style={{ background: 'rgba(91,168,138,0.12)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.25)' }}>
                            <Download size={14} /> Xuất Excel
                        </button>
                    </form>
                    {['Tháng này', 'Quý này', 'Năm này'].map((opt, i) => (
                        <div key={opt} className="px-4 py-2 text-sm font-medium"
                            style={{
                                background: i === 0 ? 'rgba(135,203,185,0.15)' : '#1B2E3D',
                                color: i === 0 ? '#87CBB9' : '#8AAEBB',
                                border: `1px solid ${i === 0 ? '#87CBB9' : '#2A4355'}`,
                                borderRadius: '6px',
                            }}>
                            {opt}
                        </div>
                    ))}
                </div>
            </div>

            {/* Row 1 — KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="DOANH THU THÁNG"
                    value={`${(primaryRevenue / 1e9).toFixed(2)}T`}
                    sub={`${formatVND(primaryRevenue)} · ${revenueSource}`}
                    trend={stats.revenueGrowth !== 0
                        ? `${stats.revenueGrowth > 0 ? '+' : ''}${stats.revenueGrowth.toFixed(1)}% so tháng trước`
                        : 'Chưa có dữ liệu tháng trước'}
                    trendUp={stats.revenueGrowth >= 0}
                    accentColor="#87CBB9"
                />
                <KpiCard
                    label="ĐƠN HÀNG THÁNG"
                    value={String(stats.monthOrders)}
                    sub="Tất cả trạng thái"
                    accentColor="#5BA88A"
                />
                <KpiCard
                    label="GIÁ TRỊ TỒN KHO"
                    value={`${(stats.stockTotalValue / 1e9).toFixed(2)}T`}
                    sub={`${stats.stockQty.toLocaleString()} chai có hàng`}
                    accentColor="#4A8FAB"
                />
                <KpiCard
                    label="CHỜ CEO DUYỆT"
                    value={String(stats.pendingApprovals + stats.pendingSOs.length)}
                    sub={`${stats.pendingApprovals} approval requests`}
                    accentColor="#8B1A2E"
                />
            </div>

            {/* Row 1.5 — KPI Progress Bars */}
            <div className="rounded-md p-6" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="flex items-center gap-2 mb-4">
                    <Target size={16} style={{ color: '#87CBB9' }} />
                    <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>KPI Tháng Này</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full ml-auto"
                        style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>
                        {_kpiSummary.filter(k => k.progressPct >= 100).length}/{_kpiSummary.length} đạt
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                    {_kpiSummary.map(kpi => {
                        const pct = Math.min(kpi.progressPct, 100)
                        const statusColor = kpi.status === 'ON_TRACK' ? '#5BA88A' : kpi.status === 'AT_RISK' ? '#D4A853' : '#8B1A2E'
                        const statusLabel = kpi.status === 'ON_TRACK' ? 'Đạt' : kpi.status === 'AT_RISK' ? 'Cận' : 'Chậm'
                        return (
                            <div key={kpi.metric} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold truncate" style={{ color: '#8AAEBB' }}>{kpi.label}</p>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                                        style={{ background: `${statusColor}18`, color: statusColor }}>{statusLabel}</span>
                                </div>
                                <div className="h-2.5 rounded-full" style={{ background: '#142433' }}>
                                    <div className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${pct}%`, background: kpi.color ?? '#87CBB9' }} />
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#E8F1F2' }}>
                                        {kpi.unit === 'VND' ? `${(kpi.actual / 1e6).toFixed(0)}M` : kpi.actual}
                                    </span>
                                    <span className="text-[10px]" style={{ color: '#4A6A7A' }}>
                                        / {kpi.unit === 'VND' ? `${(kpi.target / 1e6).toFixed(0)}M` : kpi.target} {kpi.unit !== 'VND' ? kpi.unit : ''}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Row 2 — Revenue Chart + In-transit */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Revenue chart */}
                <div className="lg:col-span-2 rounded-md p-6"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>Doanh Thu 6 Tháng Gần Nhất</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>
                            Từ DB thực
                        </span>
                    </div>
                    <div className="flex items-end gap-3 h-40">
                        {monthlyRevenue.map((m) => {
                            const pct = (m.revenue / maxBar) * 100
                            return (
                                <div key={m.label} className="flex-1 flex flex-col items-center gap-2">
                                    <p className="text-xs font-bold w-full text-center"
                                        style={{ color: '#87CBB9', fontFamily: 'var(--font-mono)' }}>
                                        {m.revenue > 0 ? `${(m.revenue / 1e6).toFixed(0)}M` : '--'}
                                    </p>
                                    <div className="w-full rounded-t-md transition-all duration-500"
                                        style={{
                                            height: `${Math.max(4, (pct / 100) * 110)}px`,
                                            background: pct > 70 ? '#87CBB9' : pct > 40 ? '#5BA88A' : '#2A4355',
                                        }}
                                    />
                                    <p className="text-xs font-medium" style={{ color: '#4A6A7A' }}>{m.label}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* In-transit shipments */}
                <div className="rounded-md p-6" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-2 mb-4">
                        <Ship size={16} style={{ color: '#87CBB9' }} />
                        <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>Container Đang Về</h3>
                        <span className="text-xs ml-auto px-1.5 py-0.5 rounded font-bold"
                            style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB' }}>
                            {stats.inTransitShipments.length}
                        </span>
                    </div>

                    {stats.inTransitShipments.length === 0 ? (
                        <div className="flex flex-col items-center py-8 gap-2">
                            <Package size={28} style={{ color: '#2A4355' }} />
                            <p className="text-xs text-center" style={{ color: '#4A6A7A' }}>
                                Không có container nào đang về
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {stats.inTransitShipments.map(s => {
                                const cfg = SHIPMENT_STATUS[s.status] ?? { label: s.status, color: '#8AAEBB' }
                                const etaDate = s.eta ? new Date(s.eta).toLocaleDateString('vi-VN') : '--'
                                return (
                                    <div key={s.id} className="p-3" style={{ background: '#142433', border: '1px solid #2A4355', borderRadius: '6px' }}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: 'var(--font-mono), monospace' }}>
                                                    {s.billOfLading}
                                                </p>
                                                <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>ETA: {etaDate}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono), monospace', color: '#E8F1F2' }}>
                                                    ${s.cifAmount.toLocaleString()} {s.cifCurrency}
                                                </p>
                                                <span className="text-xs px-2 py-0.5 rounded-full"
                                                    style={{ background: `${cfg.color}20`, color: cfg.color }}>
                                                    {cfg.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Row 3 — P&L Summary + Cash Position + AR Aging */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* P&L Summary Widget */}
                <div className="rounded-md p-6" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-2 mb-5">
                        <BarChart3 size={16} style={{ color: '#87CBB9' }} />
                        <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>P&L Tháng Này</h3>
                    </div>
                    <div className="space-y-3">
                        {[
                            { label: 'Doanh thu (TK 511)', value: _plSummary.revenue, color: '#87CBB9' },
                            { label: 'COGS (TK 632)', value: -_plSummary.cogs, color: '#E05252', prefix: '−' },
                            { label: 'Lãi gộp', value: _plSummary.grossProfit, color: '#D4A853', bold: true, divider: true },
                            { label: 'Chi phí (641+642+635)', value: -_plSummary.expenses, color: '#8AAEBB', prefix: '−' },
                            { label: 'Lãi ròng', value: _plSummary.netProfit, color: _plSummary.netProfit >= 0 ? '#5BA88A' : '#8B1A2E', bold: true, divider: true },
                        ].map((row) => (
                            <div key={row.label}>
                                {row.divider && <div className="mb-2" style={{ borderTop: '1px solid #2A4355' }} />}
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs ${row.bold ? 'font-bold uppercase' : ''}`} style={{ color: row.bold ? row.color : '#4A6A7A' }}>
                                        {row.label}
                                    </span>
                                    <span className={`text-sm ${row.bold ? 'font-bold' : 'font-medium'}`}
                                        style={{ fontFamily: 'var(--font-mono)', color: row.color }}>
                                        {row.prefix ?? ''}{formatVND(Math.abs(row.value))}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {/* Gross Margin badge */}
                        <div className="flex justify-end mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                style={{
                                    background: _plSummary.grossMargin >= 30 ? 'rgba(91,168,138,0.15)' : 'rgba(212,168,83,0.15)',
                                    color: _plSummary.grossMargin >= 30 ? '#5BA88A' : '#D4A853',
                                }}>
                                Biên lãi gộp: {_plSummary.grossMargin.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Cash Position Widget */}
                <div className="rounded-md p-6" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-2 mb-5">
                        <Wallet size={16} style={{ color: '#87CBB9' }} />
                        <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>Vị Thế Tiền Mặt</h3>
                    </div>

                    {/* Net Cash Flow — hero number */}
                    <div className="p-4 rounded-md mb-4" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#4A6A7A' }}>
                            Dòng Tiền Ròng Tháng Này
                        </p>
                        <p className="text-2xl font-bold" style={{
                            fontFamily: 'var(--font-mono)',
                            color: _cashPosition.netCashFlow >= 0 ? '#5BA88A' : '#8B1A2E',
                        }}>
                            {_cashPosition.netCashFlow >= 0 ? '+' : ''}{formatVND(_cashPosition.netCashFlow)}
                        </p>
                    </div>

                    <div className="space-y-3">
                        {/* Cash In */}
                        <div className="flex items-center justify-between p-3 rounded-md" style={{ background: 'rgba(91,168,138,0.06)' }}>
                            <div className="flex items-center gap-2">
                                <ArrowDownLeft size={14} style={{ color: '#5BA88A' }} />
                                <span className="text-xs" style={{ color: '#5BA88A' }}>Thu AR (Thanh toán KH)</span>
                            </div>
                            <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#5BA88A' }}>
                                +{formatVND(_cashPosition.cashIn)}
                            </span>
                        </div>

                        {/* Cash Out AP */}
                        <div className="flex items-center justify-between p-3 rounded-md" style={{ background: 'rgba(139,26,46,0.04)' }}>
                            <div className="flex items-center gap-2">
                                <ArrowUpRight size={14} style={{ color: '#E05252' }} />
                                <span className="text-xs" style={{ color: '#E05252' }}>Trả NCC (AP)</span>
                            </div>
                            <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#E05252' }}>
                                −{formatVND(_cashPosition.cashOutAP)}
                            </span>
                        </div>

                        {/* Cash Out Expenses */}
                        <div className="flex items-center justify-between p-3 rounded-md" style={{ background: 'rgba(139,26,46,0.04)' }}>
                            <div className="flex items-center gap-2">
                                <ArrowUpRight size={14} style={{ color: '#D4A853' }} />
                                <span className="text-xs" style={{ color: '#D4A853' }}>Chi phí hoạt động</span>
                            </div>
                            <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#D4A853' }}>
                                −{formatVND(_cashPosition.cashOutExpenses)}
                            </span>
                        </div>

                        <div style={{ borderTop: '1px solid #2A4355' }} className="pt-2">
                            <div className="flex justify-between text-xs">
                                <span style={{ color: '#4A6A7A' }}>AR Chưa Thu</span>
                                <span style={{ fontFamily: 'var(--font-mono)', color: '#8AAEBB' }}>{formatVND(_cashPosition.arOutstanding)}</span>
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                                <span style={{ color: '#4A6A7A' }}>AP Chưa Trả</span>
                                <span style={{ fontFamily: 'var(--font-mono)', color: '#8AAEBB' }}>{formatVND(_cashPosition.apOutstanding)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AR Aging Chart */}
                <div className="rounded-md p-6" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <DollarSign size={16} style={{ color: '#87CBB9' }} />
                            <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>AR Aging</h3>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB' }}>
                            {_arAging.invoiceCount} hoá đơn
                        </span>
                    </div>

                    {/* Total outstanding */}
                    <div className="p-3 rounded-md mb-4" style={{ background: '#142433' }}>
                        <p className="text-xs uppercase mb-0.5" style={{ color: '#4A6A7A' }}>Tổng Công Nợ</p>
                        <p className="text-xl font-bold"
                            style={{ fontFamily: 'var(--font-mono)', color: '#D4A853' }}>
                            {formatVND(_arAging.totalOutstanding)}
                        </p>
                    </div>

                    {/* Horizontal bars */}
                    <div className="space-y-3">
                        {_arAging.buckets.map((b) => {
                            const pct = arMax > 0 ? (b.amount / arMax) * 100 : 0
                            return (
                                <div key={b.label}>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-xs" style={{ color: '#8AAEBB' }}>{b.label}</span>
                                        <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: b.color }}>
                                            {b.amount > 0 ? formatVND(b.amount) : '—'}
                                        </span>
                                    </div>
                                    <div className="h-2.5 rounded-full" style={{ background: '#142433' }}>
                                        <div className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${Math.max(pct > 0 ? 4 : 0, pct)}%`, background: b.color }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Row 3.5 — Cost Structure Waterfall */}
            <div className="rounded-md p-6" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={16} style={{ color: '#D4A853' }} />
                        <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>Cơ Cấu Chi Phí — Waterfall</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: _waterfall.netProfit >= 0 ? 'rgba(91,168,138,0.15)' : 'rgba(139,26,46,0.15)', color: _waterfall.netProfit >= 0 ? '#5BA88A' : '#8B1A2E' }}>
                        Net Margin: {_waterfall.revenue > 0 ? ((_waterfall.netProfit / _waterfall.revenue) * 100).toFixed(1) : 0}%
                    </span>
                </div>

                {/* Waterfall chart */}
                <div className="flex items-end gap-2 h-48 mb-4">
                    {_waterfall.bars.map((bar: WaterfallBar) => {
                        const absMax = Math.max(..._waterfall.bars.map((b: WaterfallBar) => Math.abs(b.value)), 1)
                        const barH = Math.max(8, (Math.abs(bar.value) / absMax) * 160)
                        const isNeg = bar.type === 'negative'
                        return (
                            <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-[9px] font-bold" style={{ color: bar.color, fontFamily: 'var(--font-mono)' }}>
                                    {bar.value !== 0 ? `${(Math.abs(bar.value) / 1e6).toFixed(0)}M` : '0'}
                                </span>
                                <div className="w-full relative" style={{ height: 160 }}>
                                    <div className="absolute bottom-0 w-full rounded-t-sm transition-all duration-500"
                                        style={{
                                            height: barH,
                                            background: isNeg ? `${bar.color}35` : `${bar.color}60`,
                                            borderLeft: `2px solid ${bar.color}`,
                                            borderTop: `2px solid ${bar.color}`,
                                            borderRight: `2px solid ${bar.color}`,
                                        }} />
                                </div>
                                <p className="text-[9px] text-center leading-tight font-medium" style={{ color: '#8AAEBB' }}>
                                    {bar.label.split(' (')[0]}
                                </p>
                                <span className="text-[8px] font-bold" style={{ color: bar.color }}>
                                    {isNeg ? '-' : ''}{bar.pct}%
                                </span>
                            </div>
                        )
                    })}
                </div>

                {/* Legend row */}
                <div className="flex items-center justify-center gap-6 pt-3" style={{ borderTop: '1px solid #2A4355' }}>
                    {[
                        { label: 'Doanh Thu', color: '#5BA88A', val: _waterfall.revenue },
                        { label: 'COGS', color: '#E05252', val: _waterfall.cogs },
                        { label: 'Chi Phí', color: '#D4A853', val: _waterfall.totalExpenses },
                        { label: 'Lãi Ròng', color: _waterfall.netProfit >= 0 ? '#5BA88A' : '#8B1A2E', val: _waterfall.netProfit },
                    ].map(l => (
                        <div key={l.label} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                            <span className="text-[10px]" style={{ color: '#4A6A7A' }}>{l.label}</span>
                            <span className="text-[10px] font-bold" style={{ color: l.color, fontFamily: 'var(--font-mono)' }}>
                                {formatVND(Math.abs(l.val))}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Row 3.75 — Revenue YoY Comparison */}
            {(() => {
                const yoyMax = Math.max(
                    ..._yoy.current.map(m => m.revenue),
                    ..._yoy.previous.map(m => m.revenue),
                    1
                )
                const currentMonth = new Date().getMonth() + 1
                return (
                    <div className="rounded-md p-6" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={16} style={{ color: '#87CBB9' }} />
                                <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>
                                    Doanh Thu YoY — {_yoy.thisYear} vs {_yoy.lastYear}
                                </h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-2 rounded-sm" style={{ background: '#87CBB9' }} />
                                    <span className="text-[10px]" style={{ color: '#8AAEBB' }}>{_yoy.thisYear}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-2 rounded-sm" style={{ background: '#2A4355' }} />
                                    <span className="text-[10px]" style={{ color: '#4A6A7A' }}>{_yoy.lastYear}</span>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                    style={{
                                        background: _yoy.yoyGrowth >= 0 ? 'rgba(91,168,138,0.15)' : 'rgba(139,26,46,0.15)',
                                        color: _yoy.yoyGrowth >= 0 ? '#5BA88A' : '#8B1A2E',
                                    }}>
                                    {_yoy.yoyGrowth >= 0 ? '↑' : '↓'}{Math.abs(_yoy.yoyGrowth).toFixed(1)}% YoY
                                </span>
                            </div>
                        </div>

                        <div className="flex items-end gap-1 h-40">
                            {_yoy.current.map((m, i) => {
                                const prev = _yoy.previous[i]
                                const curH = Math.max(2, (m.revenue / yoyMax) * 130)
                                const prevH = Math.max(2, (prev.revenue / yoyMax) * 130)
                                const isFuture = m.month > currentMonth
                                return (
                                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                        <div className="w-full flex gap-0.5" style={{ height: 130, alignItems: 'flex-end' }}>
                                            <div className="flex-1 rounded-t-sm transition-all" style={{
                                                height: prevH,
                                                background: '#2A4355',
                                            }} />
                                            <div className="flex-1 rounded-t-sm transition-all" style={{
                                                height: isFuture ? 0 : curH,
                                                background: isFuture ? 'transparent' : m.revenue > prev.revenue ? '#87CBB9' : '#D4A853',
                                            }} />
                                        </div>
                                        <span className="text-[9px] font-medium" style={{
                                            color: m.month === currentMonth ? '#87CBB9' : '#4A6A7A'
                                        }}>{m.label}</span>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex justify-center gap-8 pt-3 mt-3" style={{ borderTop: '1px solid #2A4355' }}>
                            <div className="text-center">
                                <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>{_yoy.thisYear} Tổng</p>
                                <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#87CBB9' }}>{formatVND(_yoy.totalCurrent)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>{_yoy.lastYear} Tổng</p>
                                <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#4A6A7A' }}>{formatVND(_yoy.totalPrevious)}</p>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* Row 4 — Pending approvals */}
            <div className="rounded-md p-6" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>Chờ CEO Duyệt</h3>
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full"
                            style={{ background: 'rgba(139,26,46,0.2)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.3)' }}>
                            {stats.pendingSOs.length + pendingApprovalReqs.length}
                        </span>
                    </div>
                </div>

                {stats.pendingSOs.length === 0 && pendingApprovalReqs.length === 0 ? (
                    <div className="flex flex-col items-center py-8 gap-2">
                        <CheckCircle2 size={28} style={{ color: '#5BA88A' }} />
                        <p className="text-sm" style={{ color: '#4A6A7A' }}>Không có mục nào chờ duyệt</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Approval Engine Requests */}
                        {pendingApprovalReqs.map(ar => (
                            <div key={ar.id} className="flex items-center justify-between py-3 px-4"
                                style={{ background: '#142433', border: '1px solid #2A4355', borderRadius: '6px' }}>
                                <div className="flex items-center gap-3">
                                    <ClipboardCheck size={14} style={{ color: '#87CBB9' }} />
                                    <div>
                                        <span className="text-xs px-2 py-0.5 rounded-full mr-2 font-medium"
                                            style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853' }}>
                                            {ar.docType}
                                        </span>
                                        <span className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{ar.templateName}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs" style={{ color: '#8AAEBB' }}>Bước {ar.currentStep}</p>
                                    <p className="text-xs" style={{ color: '#4A6A7A' }}>Bởi {ar.requestedBy}</p>
                                </div>
                            </div>
                        ))}

                        {/* Pending SOs */}
                        {stats.pendingSOs.map(so => (
                            <div key={so.id} className="flex items-center justify-between py-3 px-4"
                                style={{ background: '#142433', border: '1px solid #2A4355', borderRadius: '6px' }}>
                                <div className="flex items-center gap-3">
                                    {so.status === 'PENDING_APPROVAL' && (
                                        <AlertCircle size={14} style={{ color: '#D4A853' }} />
                                    )}
                                    <div>
                                        <span className="text-xs px-2 py-0.5 rounded-full mr-2 font-medium"
                                            style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>
                                            SO
                                        </span>
                                        <span className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{so.soNo}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono), monospace', color: '#E8F1F2' }}>
                                            {formatVND(so.amount)}
                                        </p>
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>{so.customerName}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <form action={async () => {
                                            'use server'
                                            await approveSO(so.id)
                                        }}>
                                            <button type="submit" className="px-3 py-1.5 text-xs font-semibold"
                                                style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)', borderRadius: '4px' }}>
                                                Duyệt
                                            </button>
                                        </form>
                                        <form action={async () => {
                                            'use server'
                                            await rejectSO(so.id)
                                        }}>
                                            <button type="submit" className="px-3 py-1.5 text-xs font-semibold"
                                                style={{ background: 'rgba(139,26,46,0.12)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.25)', borderRadius: '4px' }}>
                                                Từ Chối
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Quick Links (Role-based) ─────────────── */}
            {dashConfig.quickLinks.length > 0 && (
                <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A6A7A' }}>
                        Truy Cập Nhanh
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                        {dashConfig.quickLinks.map(link => (
                            <Link key={link.href} href={link.href}
                                className="flex items-center gap-3 p-3 rounded-md transition-all hover:scale-[1.01]"
                                style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.1)' }}>
                                    <LinkIcon size={14} style={{ color: '#87CBB9' }} />
                                </div>
                                <span className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{link.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* ── My Sales (SALES_MGR / SALES_REP) ─────── */}
            {mySales && (
                <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#D4A853' }}>
                            📊 Doanh Số Của Tôi (Tháng Này)
                        </p>
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                {mySales.orderCount} đơn
                            </span>
                            <span className="text-sm font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>
                                {formatVND(mySales.totalRevenue)}
                            </span>
                        </div>
                    </div>
                    <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                        {mySales.orders.map(o => (
                            <div key={o.soNo} className="flex items-center justify-between py-2 px-3 rounded" style={{ background: '#142433' }}>
                                <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{o.soNo}</span>
                                <span className="text-xs" style={{ color: '#8AAEBB' }}>{o.customerName}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{
                                    background: o.status === 'PAID' ? 'rgba(91,168,138,0.15)' : 'rgba(138,174,187,0.15)',
                                    color: o.status === 'PAID' ? '#5BA88A' : '#8AAEBB',
                                }}>{o.status}</span>
                                <span className="text-xs font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{formatVND(o.amount)}</span>
                            </div>
                        ))}
                        {mySales.orders.length === 0 && (
                            <p className="text-xs text-center py-4" style={{ color: '#4A6A7A' }}>Chưa có đơn hàng tháng này</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── Warehouse Summary (THU_KHO) ──────────── */}
            {warehouseData && (
                <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#4A8FAB' }}>
                        📦 Tổng Quan Kho
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        {[
                            { label: 'Tổng Chai', value: warehouseData.totalBottles.toLocaleString('vi-VN'), color: '#87CBB9' },
                            { label: 'SKU Sắp Hết', value: warehouseData.lowStockSKUs, color: '#D4A853' },
                            { label: 'Cách Ly', value: warehouseData.quarantinedLots, color: '#8B1A2E' },
                            { label: 'GR Chờ Duyệt', value: warehouseData.pendingGoodsReceipts, color: '#4A8FAB' },
                            { label: 'DO Chờ Duyệt', value: warehouseData.pendingDeliveryOrders, color: '#5BA88A' },
                        ].map(s => (
                            <div key={s.label} className="text-center p-3 rounded-md" style={{ background: '#142433' }}>
                                <p className="text-xl font-bold" style={{ color: s.color, fontFamily: '"DM Mono"' }}>{s.value}</p>
                                <p className="text-xs mt-1" style={{ color: '#4A6A7A' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    )
}
