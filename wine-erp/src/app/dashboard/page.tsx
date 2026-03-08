

import {
    getDashboardStats, getMonthlyRevenue, approveSO, rejectSO,
    getPLSummary, getCashPosition, getARAgingChart, getPendingApprovalDetails,
    exportDashboardExcel, getCostWaterfall, WaterfallBar, getRevenueYoY,
    getDashboardConfig, type DashboardSection, getMySales, getWarehouseDashboard,
    getRealtimeChannels, getTopCustomers, getTopProducts, getRevenueByChannel,
} from './actions'
import { getComplianceWarnings } from './contracts/reg-doc-actions'
import { REG_DOC_TYPE_LABELS } from './contracts/reg-doc-constants'
import { getKpiSummary } from './kpi/actions'
import { getPendingProposalsForCEO } from './proposals/actions'
import { CATEGORY_LABELS, PRIORITY_LABELS } from './proposals/constants'
import { getCurrentUser } from '@/lib/session'
import {
    TrendingUp, TrendingDown, AlertCircle, Ship, Package, CheckCircle2,
    ArrowDownLeft, ArrowUpRight, DollarSign, BarChart3, Wallet, Target, ClipboardCheck, Download,
    Link as LinkIcon, Shield, AlertTriangle, FileText, Users, Wine, Trophy,
} from 'lucide-react'
import { formatVND } from '@/lib/utils'
import Link from 'next/link'
import { AICeoSummary } from './AICeoSummary'

/* ─── Reusable KPI Card ──────────────────────────── */
function KpiCard({ label, value, sub, trend, trendUp, accentColor = '#87CBB9' }: {
    label: string; value: string; sub?: string
    trend?: string; trendUp?: boolean; accentColor?: string
}) {
    return (
        <div className="rounded-md p-5 relative overflow-hidden"
            style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: `3px solid ${accentColor}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#4A6A7A' }}>{label}</p>
            <p className="text-2xl font-bold mb-0.5" style={{ fontFamily: 'var(--font-mono), monospace', color: '#E8F1F2' }}>{value}</p>
            {sub && <p className="text-[11px]" style={{ color: '#4A6A7A' }}>{sub}</p>}
            {trend && (
                <div className="flex items-center gap-1 mt-1.5">
                    {trendUp ? <TrendingUp size={12} style={{ color: '#5BA88A' }} /> : <TrendingDown size={12} style={{ color: '#8B1A2E' }} />}
                    <span className="text-[11px] font-medium" style={{ color: trendUp ? '#5BA88A' : '#8B1A2E' }}>{trend}</span>
                </div>
            )}
        </div>
    )
}

const SHIP_STATUS: Record<string, { label: string; color: string }> = {
    BOOKED: { label: 'Đã đặt', color: '#4A8FAB' },
    ON_VESSEL: { label: 'Trên biển', color: '#87CBB9' },
    ARRIVED_PORT: { label: 'Sắp đến cảng', color: '#D4A853' },
    CUSTOMS_CLEARED: { label: 'Đã thông quan', color: '#5BA88A' },
    DELIVERED_TO_WAREHOUSE: { label: 'Đã về kho', color: '#4A6A7A' },
}

/* ─── Section Header ─────────────────────────────── */
function SectionHead({ icon, title, badge, children }: { icon: React.ReactNode; title: string; badge?: React.ReactNode; children?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                {icon}
                <h3 className="font-semibold text-sm" style={{ color: '#E8F1F2' }}>{title}</h3>
                {badge}
            </div>
            {children}
        </div>
    )
}

/* ═══════════════════════════════════════════════════ */
export default async function DashboardPage() {
    const user = await getCurrentUser()
    const roles = user?.roles ?? ['CEO']
    const dashConfig = await getDashboardConfig(roles)
    const has = (s: DashboardSection) => dashConfig.sections.includes(s)

    // Batch 1
    const [stats, plSummary, cashPosition, kpiSummary] = await Promise.all([
        getDashboardStats('month'),
        has('pl_summary') ? getPLSummary() : null,
        has('cash_position') ? getCashPosition() : null,
        has('kpi_targets') ? getKpiSummary() : null,
    ])
    // Batch 2
    const [arAging, pendingApprovalReqs, waterfall, yoy, topCust, topProd, channelData] = await Promise.all([
        has('ar_aging') ? getARAgingChart() : null,
        has('pending_approvals') ? getPendingApprovalDetails() : [],
        has('cost_waterfall') ? getCostWaterfall() : [],
        has('revenue_yoy') ? getRevenueYoY() : null,
        has('pl_summary') ? getTopCustomers() : [],
        has('pl_summary') ? getTopProducts() : [],
        has('revenue_chart') ? getRevenueByChannel() : null,
    ])
    // Batch 3 (parallelized — was sequential, 4x ~100ms = ~400ms waste)
    const [mySales, warehouseData, complianceWarnings, pendingProposals] = await Promise.all([
        has('my_sales') && user ? getMySales(user.id) : null,
        has('warehouse_summary') ? getWarehouseDashboard() : null,
        has('legal_compliance') ? getComplianceWarnings() : [],
        has('pending_approvals') ? getPendingProposalsForCEO() : [],
    ])

    // Defaults
    const pl = plSummary ?? { revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, grossMargin: 0 }
    const cash = cashPosition ?? { netCashFlow: 0, cashIn: 0, cashOutAP: 0, cashOutExpenses: 0, arOutstanding: 0, apOutstanding: 0 }
    const ar = arAging ?? { invoiceCount: 0, totalOutstanding: 0, buckets: [] as { label: string; amount: number; color: string }[] }
    const wf = Array.isArray(waterfall) ? { bars: [] as WaterfallBar[], revenue: 0, cogs: 0, totalExpenses: 0, netProfit: 0 } : waterfall
    const yoyData = yoy ?? { thisYear: new Date().getFullYear(), lastYear: new Date().getFullYear() - 1, current: [] as { month: number; label: string; revenue: number }[], previous: [] as { month: number; label: string; revenue: number }[], totalCurrent: 0, totalPrevious: 0, yoyGrowth: 0 }
    const kpis = kpiSummary ?? []
    const topCustomers = Array.isArray(topCust) ? topCust : []
    const topProducts = Array.isArray(topProd) ? topProd : []
    const channels = channelData ?? { total: 0, channels: [] }

    const primaryRevenue = pl.revenue > 0 ? pl.revenue : stats.revenue
    const revenueSource = pl.revenue > 0 ? 'TK 511' : 'SO'
    const arMax = ar.buckets.length > 0 ? Math.max(...ar.buckets.map(b => b.amount), 1) : 1
    const arOverdue = ar.buckets.filter(b => b.label !== 'Chưa đến hạn').reduce((s, b) => s + b.amount, 0)
    const totalPending = pendingProposals.length + stats.pendingSOs.length + (Array.isArray(pendingApprovalReqs) ? pendingApprovalReqs.length : 0)

    return (
        <div className="space-y-5 max-w-7xl mx-auto">

            {/* ═══ HEADER ═══ */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display), Georgia, serif', color: '#E8F1F2' }}>
                        {dashConfig.greeting}
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>
                        {user?.name ?? 'Dashboard'} · {roles.join(', ')} &bull; {new Date().toLocaleString('vi-VN')}
                    </p>
                </div>
                <form action={async () => { 'use server'; await exportDashboardExcel() }}>
                    <button type="submit" className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md"
                        style={{ background: 'rgba(91,168,138,0.12)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.25)' }}>
                        <Download size={14} /> Xuất Excel
                    </button>
                </form>
            </div>

            {/* ═══ LAYER 1 — 6 KPI CARDS ═══ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label="DOANH THU THÁNG" value={`${(primaryRevenue / 1e9).toFixed(2)}T`}
                    sub={revenueSource}
                    trend={stats.revenueGrowth !== 0 ? `${stats.revenueGrowth > 0 ? '+' : ''}${stats.revenueGrowth.toFixed(1)}% vs T.trước` : undefined}
                    trendUp={stats.revenueGrowth >= 0} accentColor="#87CBB9" />
                <KpiCard label="LÃI GỘP" value={`${(pl.grossProfit / 1e6).toFixed(0)}M`}
                    sub={`Biên: ${pl.grossMargin.toFixed(1)}%`}
                    trend={pl.grossMargin >= 25 ? '🟢 Tốt' : '🟡 Cận'} trendUp={pl.grossMargin >= 25} accentColor="#D4A853" />
                <KpiCard label="DÒNG TIỀN RÒNG" value={`${cash.netCashFlow >= 0 ? '+' : ''}${(cash.netCashFlow / 1e6).toFixed(0)}M`}
                    sub={`Thu: ${(cash.cashIn / 1e6).toFixed(0)}M · Chi: ${((cash.cashOutAP + cash.cashOutExpenses) / 1e6).toFixed(0)}M`}
                    accentColor={cash.netCashFlow >= 0 ? '#5BA88A' : '#8B1A2E'} />
                <KpiCard label="GIÁ TRỊ TỒN KHO" value={`${(stats.stockTotalValue / 1e9).toFixed(2)}T`}
                    sub={`${stats.stockQty.toLocaleString()} chai`} accentColor="#4A8FAB" />
                <KpiCard label="CÔNG NỢ PHẢI THU" value={`${(ar.totalOutstanding / 1e6).toFixed(0)}M`}
                    sub={arOverdue > 0 ? `${(arOverdue / 1e6).toFixed(0)}M quá hạn` : 'Chưa quá hạn'}
                    accentColor={arOverdue > 0 ? '#E05252' : '#5BA88A'} />
                <KpiCard label="CHỜ CEO DUYỆT" value={String(totalPending)}
                    sub={`${pendingProposals.length} tờ trình · ${stats.pendingSOs.length} SO`}
                    accentColor="#8B1A2E" />
            </div>

            {/* ═══ AI CEO BRIEFING ═══ */}
            {roles.includes('CEO') && <AICeoSummary />}

            {/* ═══ LAYER 2 — FINANCIAL PULSE (2 cols) ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* P&L Summary */}
                <div className="rounded-md p-5" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <SectionHead icon={<BarChart3 size={15} style={{ color: '#87CBB9' }} />} title="Kết Quả Kinh Doanh Tháng"
                        badge={<span className="text-[10px] px-2 py-0.5 rounded-full font-bold ml-1" style={{ background: pl.grossMargin >= 25 ? 'rgba(91,168,138,0.15)' : 'rgba(212,168,83,0.15)', color: pl.grossMargin >= 25 ? '#5BA88A' : '#D4A853' }}>Biên {pl.grossMargin.toFixed(1)}%</span>} />
                    <div className="space-y-2.5">
                        {[
                            { label: '(+) Doanh thu thuần', value: pl.revenue, color: '#87CBB9' },
                            { label: '(−) Giá vốn hàng bán', value: -pl.cogs, color: '#E05252', neg: true },
                            { label: '(=) LỢI NHUẬN GỘP', value: pl.grossProfit, color: '#D4A853', bold: true, line: true },
                            { label: '(−) Chi phí hoạt động', value: -pl.expenses, color: '#8AAEBB', neg: true },
                            { label: '(=) LỢI NHUẬN RÒNG', value: pl.netProfit, color: pl.netProfit >= 0 ? '#5BA88A' : '#8B1A2E', bold: true, line: true },
                        ].map(r => (
                            <div key={r.label}>
                                {r.line && <div className="mb-2" style={{ borderTop: '1px dashed #2A4355' }} />}
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs ${r.bold ? 'font-bold' : ''}`} style={{ color: r.bold ? r.color : '#8AAEBB' }}>{r.label}</span>
                                    <span className={`text-sm ${r.bold ? 'font-bold' : 'font-medium'}`} style={{ fontFamily: 'var(--font-mono)', color: r.color }}>
                                        {r.neg ? '−' : ''}{formatVND(Math.abs(r.value))}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {stats.revenueGrowth !== 0 && (
                            <p className="text-[10px] text-right mt-1" style={{ color: '#4A6A7A' }}>vs tháng trước: {stats.revenueGrowth > 0 ? '+' : ''}{stats.revenueGrowth.toFixed(1)}%</p>
                        )}
                    </div>
                </div>

                {/* Cash Position */}
                <div className="rounded-md p-5" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <SectionHead icon={<Wallet size={15} style={{ color: '#87CBB9' }} />} title="Vị Thế Tiền Mặt" />
                    <div className="p-3 rounded-md mb-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#4A6A7A' }}>Dòng Tiền Ròng Tháng</p>
                        <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: cash.netCashFlow >= 0 ? '#5BA88A' : '#8B1A2E' }}>
                            {cash.netCashFlow >= 0 ? '+' : ''}{formatVND(cash.netCashFlow)}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between p-2.5 rounded" style={{ background: 'rgba(91,168,138,0.06)' }}>
                            <div className="flex items-center gap-2"><ArrowDownLeft size={13} style={{ color: '#5BA88A' }} /><span className="text-xs" style={{ color: '#5BA88A' }}>Thu AR</span></div>
                            <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#5BA88A' }}>+{formatVND(cash.cashIn)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded" style={{ background: 'rgba(139,26,46,0.04)' }}>
                            <div className="flex items-center gap-2"><ArrowUpRight size={13} style={{ color: '#E05252' }} /><span className="text-xs" style={{ color: '#E05252' }}>Trả NCC</span></div>
                            <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#E05252' }}>−{formatVND(cash.cashOutAP)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded" style={{ background: 'rgba(139,26,46,0.04)' }}>
                            <div className="flex items-center gap-2"><ArrowUpRight size={13} style={{ color: '#D4A853' }} /><span className="text-xs" style={{ color: '#D4A853' }}>Chi phí</span></div>
                            <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#D4A853' }}>−{formatVND(cash.cashOutExpenses)}</span>
                        </div>
                        <div style={{ borderTop: '1px solid #2A4355' }} className="pt-2 flex justify-between text-xs">
                            <span style={{ color: '#4A6A7A' }}>AR chưa thu / AP chưa trả</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: '#8AAEBB' }}>{formatVND(cash.arOutstanding)} / {formatVND(cash.apOutstanding)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ LAYER 3 — OPERATIONS (3 cols) ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Container Tracker */}
                <div className="rounded-md p-5" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <SectionHead icon={<Ship size={15} style={{ color: '#87CBB9' }} />} title="Container Đang Về"
                        badge={<span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB' }}>{stats.inTransitShipments.length}</span>} />
                    {stats.inTransitShipments.length === 0 ? (
                        <div className="flex flex-col items-center py-6 gap-1"><Package size={24} style={{ color: '#2A4355' }} /><p className="text-xs" style={{ color: '#4A6A7A' }}>Không có container đang về</p></div>
                    ) : (
                        <div className="space-y-2">
                            {stats.inTransitShipments.map(s => {
                                const cfg = SHIP_STATUS[s.status] ?? { label: s.status, color: '#8AAEBB' }
                                return (
                                    <div key={s.id} className="p-2.5" style={{ background: '#142433', border: '1px solid #2A4355', borderRadius: '6px' }}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: 'var(--font-mono)' }}>{s.billOfLading}</p>
                                                <p className="text-[10px] mt-0.5" style={{ color: '#4A6A7A' }}>ETA: {s.eta ? new Date(s.eta).toLocaleDateString('vi-VN') : '--'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#E8F1F2' }}>${s.cifAmount.toLocaleString()} {s.cifCurrency}</p>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${cfg.color}20`, color: cfg.color }}>{cfg.label}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* AR Aging */}
                <div className="rounded-md p-5" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <SectionHead icon={<DollarSign size={15} style={{ color: '#87CBB9' }} />} title="Tuổi Nợ (AR Aging)"
                        badge={<span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB' }}>{ar.invoiceCount} HĐ</span>} />
                    <div className="p-2.5 rounded mb-3" style={{ background: '#142433' }}>
                        <p className="text-[10px] uppercase mb-0.5" style={{ color: '#4A6A7A' }}>Tổng Công Nợ</p>
                        <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#D4A853' }}>{formatVND(ar.totalOutstanding)}</p>
                    </div>
                    <div className="space-y-2.5">
                        {ar.buckets.map(b => (
                            <div key={b.label}>
                                <div className="flex justify-between mb-0.5">
                                    <span className="text-[11px]" style={{ color: '#8AAEBB' }}>{b.label}</span>
                                    <span className="text-[11px] font-bold" style={{ fontFamily: 'var(--font-mono)', color: b.color }}>{b.amount > 0 ? formatVND(b.amount) : '—'}</span>
                                </div>
                                <div className="h-2 rounded-full" style={{ background: '#142433' }}>
                                    <div className="h-full rounded-full" style={{ width: `${Math.max(b.amount > 0 ? 4 : 0, (b.amount / arMax) * 100)}%`, background: b.color }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top KH + Top SP */}
                <div className="rounded-md p-5" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <SectionHead icon={<Trophy size={15} style={{ color: '#D4A853' }} />} title="Top Tháng Này" />
                    {/* Top Customers */}
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#4A6A7A' }}>
                        <Users size={11} className="inline mr-1" />Top Khách Hàng
                    </p>
                    {topCustomers.length === 0 ? (
                        <p className="text-xs mb-3" style={{ color: '#4A6A7A' }}>Chưa có dữ liệu</p>
                    ) : (
                        <div className="space-y-1 mb-4">
                            {topCustomers.map((c, i) => (
                                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: i === 0 ? 'rgba(135,203,185,0.06)' : 'transparent' }}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[10px] font-bold w-4" style={{ color: i === 0 ? '#D4A853' : '#4A6A7A' }}>{i + 1}.</span>
                                        <span className="text-xs truncate" style={{ color: '#E8F1F2' }}>{c.name}</span>
                                    </div>
                                    <span className="text-[11px] font-bold flex-shrink-0" style={{ fontFamily: 'var(--font-mono)', color: '#87CBB9' }}>{(c.revenue / 1e6).toFixed(0)}M</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* Top Products */}
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#4A6A7A' }}>
                        <Wine size={11} className="inline mr-1" />Top Sản Phẩm
                    </p>
                    {topProducts.length === 0 ? (
                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Chưa có dữ liệu</p>
                    ) : (
                        <div className="space-y-1">
                            {topProducts.map((p, i) => (
                                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: i === 0 ? 'rgba(212,168,83,0.06)' : 'transparent' }}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[10px] font-bold w-4" style={{ color: i === 0 ? '#D4A853' : '#4A6A7A' }}>{i + 1}.</span>
                                        <span className="text-xs truncate" style={{ color: '#E8F1F2' }}>{p.name}</span>
                                    </div>
                                    <span className="text-[10px] flex-shrink-0" style={{ fontFamily: 'var(--font-mono)', color: '#8AAEBB' }}>{p.qty} chai · {(p.revenue / 1e6).toFixed(0)}M</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ LAYER 4 — CEO ACTION HUB ═══ */}
            <div className="rounded-md p-5" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-sm" style={{ color: '#E8F1F2' }}>⏳ Chờ CEO Duyệt</h3>
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full" style={{ background: 'rgba(139,26,46,0.2)', color: '#8B1A2E' }}>{totalPending}</span>
                    </div>
                    <Link href="/dashboard/proposals" className="text-xs font-medium px-3 py-1.5 rounded" style={{ background: 'rgba(135,203,185,0.08)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.15)' }}>Xem tất cả →</Link>
                </div>
                {totalPending === 0 ? (
                    <div className="flex flex-col items-center py-6 gap-1"><CheckCircle2 size={24} style={{ color: '#5BA88A' }} /><p className="text-xs" style={{ color: '#4A6A7A' }}>Không có mục nào chờ duyệt</p></div>
                ) : (
                    <div className="space-y-2">
                        {/* Proposals */}
                        {pendingProposals.map(p => {
                            const prioCfg = PRIORITY_LABELS[p.priority] ?? PRIORITY_LABELS.NORMAL
                            return (
                                <div key={p.id} className="flex items-center justify-between py-2.5 px-3" style={{ background: 'rgba(212,168,83,0.03)', border: '1px solid rgba(212,168,83,0.15)', borderRadius: '6px', borderLeft: `3px solid ${prioCfg.color}` }}>
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <FileText size={14} style={{ color: '#D4A853' }} className="flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: prioCfg.bg, color: prioCfg.color }}>{prioCfg.label}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(74,143,171,0.1)', color: '#4A8FAB' }}>{CATEGORY_LABELS[p.category] ?? p.category}</span>
                                                <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#87CBB9' }}>{p.proposalNo}</span>
                                            </div>
                                            <p className="text-sm truncate" style={{ color: '#E8F1F2' }}>{p.title}</p>
                                            <span className="text-[10px]" style={{ color: '#4A6A7A' }}>{p.creatorName}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        {p.estimatedAmount && <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#E8F1F2' }}>{formatVND(p.estimatedAmount)}</span>}
                                        <Link href="/dashboard/proposals" className="px-2.5 py-1 text-xs font-semibold rounded" style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>Xem & Duyệt</Link>
                                    </div>
                                </div>
                            )
                        })}
                        {/* Approval Engine */}
                        {Array.isArray(pendingApprovalReqs) && pendingApprovalReqs.map(ar => (
                            <div key={ar.id} className="flex items-center justify-between py-2.5 px-3" style={{ background: '#142433', border: '1px solid #2A4355', borderRadius: '6px' }}>
                                <div className="flex items-center gap-2">
                                    <ClipboardCheck size={13} style={{ color: '#87CBB9' }} />
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853' }}>{ar.docType}</span>
                                    <span className="text-sm" style={{ color: '#E8F1F2' }}>{ar.templateName}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px]" style={{ color: '#8AAEBB' }}>Bước {ar.currentStep}</p>
                                    <p className="text-[10px]" style={{ color: '#4A6A7A' }}>{ar.requestedBy}</p>
                                </div>
                            </div>
                        ))}
                        {/* Pending SOs */}
                        {stats.pendingSOs.map(so => (
                            <div key={so.id} className="flex items-center justify-between py-2.5 px-3" style={{ background: '#142433', border: '1px solid #2A4355', borderRadius: '6px' }}>
                                <div className="flex items-center gap-2">
                                    {so.status === 'PENDING_APPROVAL' && <AlertCircle size={13} style={{ color: '#D4A853' }} />}
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>SO</span>
                                    <span className="text-sm" style={{ color: '#E8F1F2' }}>{so.soNo}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#E8F1F2' }}>{formatVND(so.amount)}</p>
                                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>{so.customerName}</p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <form action={async () => { 'use server'; await approveSO(so.id) }}>
                                            <button type="submit" className="px-2.5 py-1 text-xs font-semibold" style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)', borderRadius: '4px' }}>Duyệt</button>
                                        </form>
                                        <form action={async () => { 'use server'; await rejectSO(so.id) }}>
                                            <button type="submit" className="px-2.5 py-1 text-xs font-semibold" style={{ background: 'rgba(139,26,46,0.12)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.25)', borderRadius: '4px' }}>Từ Chối</button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ═══ LAYER 5 — DEEP ANALYSIS (Grid of cards) ═══ */}
            <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4A6A7A' }}>📈 Phân Tích Chuyên Sâu</h3>

                {/* KPI Progress + Channel Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    {/* KPI Targets — 3 cols */}
                    <div className="lg:col-span-3 rounded-md p-5" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <SectionHead icon={<Target size={15} style={{ color: '#87CBB9' }} />} title="KPI Tháng Này"
                            badge={<span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>{kpis.filter(k => k.progressPct >= 100).length}/{kpis.length} đạt</span>} />
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                            {kpis.map(kpi => {
                                const pct = Math.min(kpi.progressPct, 100)
                                const sc = kpi.status === 'ON_TRACK' ? '#5BA88A' : kpi.status === 'AT_RISK' ? '#D4A853' : '#8B1A2E'
                                const sl = kpi.status === 'ON_TRACK' ? 'Đạt' : kpi.status === 'AT_RISK' ? 'Cận' : 'Chậm'
                                return (
                                    <div key={kpi.metric} className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-semibold truncate" style={{ color: '#8AAEBB' }}>{kpi.label}</p>
                                            <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: `${sc}18`, color: sc }}>{sl}</span>
                                        </div>
                                        <div className="h-2 rounded-full" style={{ background: '#142433' }}>
                                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: kpi.color ?? '#87CBB9' }} />
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#E8F1F2' }}>
                                                {kpi.unit === 'VND' ? `${(kpi.actual / 1e6).toFixed(0)}M` : kpi.actual}
                                            </span>
                                            <span className="text-[9px]" style={{ color: '#4A6A7A' }}>/ {kpi.unit === 'VND' ? `${(kpi.target / 1e6).toFixed(0)}M` : kpi.target}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Channel Breakdown — 2 cols */}
                    <div className="lg:col-span-2 rounded-md p-5" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <SectionHead icon={<BarChart3 size={15} style={{ color: '#D4A853' }} />} title="Kênh Bán Hàng" />
                        {channels.channels.length === 0 ? (
                            <p className="text-xs py-4 text-center" style={{ color: '#4A6A7A' }}>Chưa có dữ liệu</p>
                        ) : (
                            <div className="space-y-2.5">
                                {channels.channels.map(ch => (
                                    <div key={ch.channel}>
                                        <div className="flex justify-between mb-0.5">
                                            <span className="text-xs" style={{ color: '#8AAEBB' }}>{ch.label}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold" style={{ fontFamily: 'var(--font-mono)', color: ch.color }}>{(ch.revenue / 1e6).toFixed(0)}M</span>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${ch.color}18`, color: ch.color }}>{ch.pct}%</span>
                                            </div>
                                        </div>
                                        <div className="h-2 rounded-full" style={{ background: '#142433' }}>
                                            <div className="h-full rounded-full" style={{ width: `${ch.pct}%`, background: ch.color }} />
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
                        const yoyMax = Math.max(...yoyData.current.map(m => m.revenue), ...yoyData.previous.map(m => m.revenue), 1)
                        const cm = new Date().getMonth() + 1
                        return (
                            <div className="rounded-md p-5" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <SectionHead icon={<TrendingUp size={15} style={{ color: '#87CBB9' }} />} title={`Doanh Thu ${yoyData.thisYear} vs ${yoyData.lastYear}`}>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: yoyData.yoyGrowth >= 0 ? 'rgba(91,168,138,0.15)' : 'rgba(139,26,46,0.15)', color: yoyData.yoyGrowth >= 0 ? '#5BA88A' : '#8B1A2E' }}>
                                        {yoyData.yoyGrowth >= 0 ? '↑' : '↓'}{Math.abs(yoyData.yoyGrowth).toFixed(1)}% YoY
                                    </span>
                                </SectionHead>
                                <div className="flex items-end gap-0.5 h-32 mb-2">
                                    {yoyData.current.map((m, i) => {
                                        const prev = yoyData.previous[i]
                                        const curH = Math.max(2, (m.revenue / yoyMax) * 110)
                                        const prevH = Math.max(2, (prev.revenue / yoyMax) * 110)
                                        return (
                                            <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                                                <div className="w-full flex gap-px" style={{ height: 110, alignItems: 'flex-end' }}>
                                                    <div className="flex-1 rounded-t-sm" style={{ height: prevH, background: '#2A4355' }} />
                                                    <div className="flex-1 rounded-t-sm" style={{ height: m.month > cm ? 0 : curH, background: m.month > cm ? 'transparent' : m.revenue > prev.revenue ? '#87CBB9' : '#D4A853' }} />
                                                </div>
                                                <span className="text-[8px]" style={{ color: m.month === cm ? '#87CBB9' : '#4A6A7A' }}>{m.label}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-center gap-6 pt-2" style={{ borderTop: '1px solid #2A4355' }}>
                                    <div className="text-center">
                                        <p className="text-[9px] uppercase" style={{ color: '#4A6A7A' }}>{yoyData.thisYear}</p>
                                        <p className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#87CBB9' }}>{formatVND(yoyData.totalCurrent)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] uppercase" style={{ color: '#4A6A7A' }}>{yoyData.lastYear}</p>
                                        <p className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#4A6A7A' }}>{formatVND(yoyData.totalPrevious)}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })()}

                    {/* Cost Waterfall */}
                    <div className="rounded-md p-5" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <SectionHead icon={<BarChart3 size={15} style={{ color: '#D4A853' }} />} title="Cơ Cấu Chi Phí">
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
                                        <span className="text-[8px] font-bold" style={{ color: bar.color, fontFamily: 'var(--font-mono)' }}>
                                            {bar.value !== 0 ? `${(Math.abs(bar.value) / 1e6).toFixed(0)}M` : '0'}
                                        </span>
                                        <div className="w-full relative" style={{ height: 120 }}>
                                            <div className="absolute bottom-0 w-full rounded-t-sm" style={{ height: barH, background: `${bar.color}${bar.type === 'negative' ? '35' : '60'}`, borderLeft: `2px solid ${bar.color}`, borderTop: `2px solid ${bar.color}`, borderRight: `2px solid ${bar.color}` }} />
                                        </div>
                                        <p className="text-[8px] text-center leading-tight" style={{ color: '#8AAEBB' }}>{bar.label.split(' (')[0]}</p>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex items-center justify-center gap-4 pt-2" style={{ borderTop: '1px solid #2A4355' }}>
                            {[
                                { label: 'DT', color: '#5BA88A', val: wf.revenue },
                                { label: 'COGS', color: '#E05252', val: wf.cogs },
                                { label: 'CP', color: '#D4A853', val: wf.totalExpenses },
                                { label: 'Lãi', color: wf.netProfit >= 0 ? '#5BA88A' : '#8B1A2E', val: wf.netProfit },
                            ].map(l => (
                                <div key={l.label} className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
                                    <span className="text-[9px]" style={{ color: '#4A6A7A' }}>{l.label}</span>
                                    <span className="text-[9px] font-bold" style={{ color: l.color, fontFamily: 'var(--font-mono)' }}>{formatVND(Math.abs(l.val))}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Legal Compliance */}
                {complianceWarnings.length > 0 && (
                    <div className="rounded-md p-5" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <SectionHead icon={<Shield size={15} style={{ color: '#D4A853' }} />} title="Cảnh Báo Tuân Thủ"
                            badge={<span className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: complianceWarnings.some(w => w.severity === 'critical') ? 'rgba(224,82,82,0.2)' : 'rgba(212,168,83,0.2)', color: complianceWarnings.some(w => w.severity === 'critical') ? '#E05252' : '#D4A853' }}>{complianceWarnings.length} giấy tờ</span>}>
                            <Link href="/dashboard/contracts" className="text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}>Xem tất cả →</Link>
                        </SectionHead>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {complianceWarnings.slice(0, 6).map(w => {
                                const sev = w.severity === 'critical' ? { bg: 'rgba(224,82,82,0.06)', border: 'rgba(224,82,82,0.2)', c: '#E05252' } : w.severity === 'warning' ? { bg: 'rgba(212,168,83,0.06)', border: 'rgba(212,168,83,0.2)', c: '#D4A853' } : { bg: 'rgba(135,203,185,0.06)', border: 'rgba(135,203,185,0.2)', c: '#87CBB9' }
                                return (
                                    <div key={w.id} className="flex items-center justify-between p-2.5 rounded" style={{ background: sev.bg, border: `1px solid ${sev.border}` }}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <AlertTriangle size={13} style={{ color: sev.c }} />
                                            <div className="min-w-0">
                                                <p className="text-xs truncate" style={{ color: '#E8F1F2' }}>{w.name}</p>
                                                <p className="text-[10px]" style={{ color: '#4A6A7A' }}>{REG_DOC_TYPE_LABELS[w.type] ?? w.type}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold flex-shrink-0" style={{ color: sev.c, fontFamily: 'var(--font-mono)' }}>
                                            {w.daysRemaining !== null && w.daysRemaining <= 0 ? `Quá hạn ${Math.abs(w.daysRemaining)}d` : `${w.daysRemaining}d`}
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
                <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#4A6A7A' }}>Truy Cập Nhanh</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {dashConfig.quickLinks.map(link => (
                            <Link key={link.href} href={link.href} className="flex items-center gap-2 p-2.5 rounded hover:scale-[1.01] transition-all" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.1)' }}>
                                    <LinkIcon size={12} style={{ color: '#87CBB9' }} />
                                </div>
                                <span className="text-xs font-medium" style={{ color: '#E8F1F2' }}>{link.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ ROLE-SPECIFIC: My Sales ═══ */}
            {mySales && (
                <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#D4A853' }}>📊 Doanh Số Của Tôi</p>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: 'var(--font-mono)' }}>{mySales.orderCount} đơn</span>
                            <span className="text-sm font-bold" style={{ color: '#E8F1F2', fontFamily: 'var(--font-mono)' }}>{formatVND(mySales.totalRevenue)}</span>
                        </div>
                    </div>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {mySales.orders.map(o => (
                            <div key={o.soNo} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: '#142433' }}>
                                <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: 'var(--font-mono)' }}>{o.soNo}</span>
                                <span className="text-xs" style={{ color: '#8AAEBB' }}>{o.customerName}</span>
                                <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: o.status === 'PAID' ? 'rgba(91,168,138,0.15)' : 'rgba(138,174,187,0.15)', color: o.status === 'PAID' ? '#5BA88A' : '#8AAEBB' }}>{o.status}</span>
                                <span className="text-xs font-bold" style={{ color: '#E8F1F2', fontFamily: 'var(--font-mono)' }}>{formatVND(o.amount)}</span>
                            </div>
                        ))}
                        {mySales.orders.length === 0 && <p className="text-xs text-center py-3" style={{ color: '#4A6A7A' }}>Chưa có đơn hàng</p>}
                    </div>
                </div>
            )}

            {/* ═══ ROLE-SPECIFIC: Warehouse ═══ */}
            {warehouseData && (
                <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A8FAB' }}>📦 Tổng Quan Kho</p>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                        {[
                            { label: 'Tổng Chai', value: warehouseData.totalBottles.toLocaleString('vi-VN'), color: '#87CBB9' },
                            { label: 'SKU Sắp Hết', value: warehouseData.lowStockSKUs, color: '#D4A853' },
                            { label: 'Cách Ly', value: warehouseData.quarantinedLots, color: '#8B1A2E' },
                            { label: 'GR Chờ', value: warehouseData.pendingGoodsReceipts, color: '#4A8FAB' },
                            { label: 'DO Chờ', value: warehouseData.pendingDeliveryOrders, color: '#5BA88A' },
                        ].map(s => (
                            <div key={s.label} className="text-center p-2.5 rounded" style={{ background: '#142433' }}>
                                <p className="text-lg font-bold" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: '#4A6A7A' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
