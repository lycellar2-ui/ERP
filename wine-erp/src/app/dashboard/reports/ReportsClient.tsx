'use client'

import { useState } from 'react'
import {
    BarChart3, TrendingUp, Package, Wine, Download, Loader2,
    FileSpreadsheet, CheckCircle2, Clock, Calendar, Users, Wallet,
    AlertTriangle, Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppLocale } from '@/lib/i18n'
import { exportReportExcel, getReportSchedules, toggleScheduleStatus, type ScheduleRow } from './actions'
import { REPORT_CATALOG, type ReportKey } from './constants'
import { getReportsDictionary } from './i18n'

const CHANNEL_COLOR: Record<string, string> = {
    HORECA: '#87CBB9',
    WHOLESALE_DISTRIBUTOR: '#4A8FAB',
    VIP_RETAIL: '#D4A853',
    DIRECT_INDIVIDUAL: '#5BA88A',
}

const WINE_TYPE_COLOR: Record<string, string> = {
    RED: '#8B1A2E',
    WHITE: '#D4A853',
    ROSE: '#C45A2A',
    SPARKLING: '#87CBB9',
    FORTIFIED: '#4A8FAB',
    DESSERT: '#A5DED0',
}

const MODULE_COLORS: Record<string, string> = {
    WMS: '#5BA88A',
    SLS: '#87CBB9',
    FIN: '#D4A853',
    CST: '#4A8FAB',
    PRC: '#475569',
    CRM: '#C45A2A',
    STM: '#A5DED0',
    TAX: '#E05252',
}

type TabKey = 'overview' | 'export' | 'schedule'

interface Props {
    topSKUs: { productId: string; skuCode: string; productName: string; wineType: string; qtyOrdered: number }[]
    monthlyRevenue: { month: string; label: string; revenue: number }[]
    channelBreakdown: { channel: string; revenue: number; orders: number }[]
    stockValuation: { totalQty: number; totalValue: number; productCount: number }
    brandBreakdown: { brand: string; revenue: number; orderCount: number; avgOrderValue: number }[]
    topCustomers: { customerId: string; name: string; code: string; type: string; revenue: number; orders: number }[]
    financialSummary: { ar: { unpaid: number; overdue: number }; ap: { unpaid: number; overdue: number } }
    lowStockAlerts: { productId: string; skuCode: string; productName: string; qtyAvailable: number }[]
    salesRepPerformance: { salesRepId: string; name: string; email: string; revenue: number; orders: number }[]
}

function formatFriendlyShort(val: number, isEn: boolean): string {
    const b = val / 1e9
    if (b >= 1) {
        return isEn ? `${b.toFixed(2)}B VND` : `₫${b.toFixed(2).replace('.', ',')}T`
    }
    const m = val / 1e6
    return isEn ? `${m.toFixed(0)}M VND` : `₫${m.toFixed(0)} Tr`
}

export function ReportsClient({
    topSKUs,
    monthlyRevenue,
    channelBreakdown,
    stockValuation,
    brandBreakdown,
    topCustomers,
    financialSummary,
    lowStockAlerts,
    salesRepPerformance,
}: Props) {
    const { locale, isEn, formatCurrency, formatDate } = useAppLocale()
    const t = getReportsDictionary(locale)

    const [tab, setTab] = useState<TabKey>('overview')
    const [downloading, setDownloading] = useState<string | null>(null)
    const [lastDownloaded, setLastDownloaded] = useState<string | null>(null)
    const [schedules, setSchedules] = useState<ScheduleRow[] | null>(null)
    const [scheduleLoading, setScheduleLoading] = useState(false)

    const tabs = [
        { key: 'overview' as const, label: t.tabs.overview, icon: BarChart3 },
        { key: 'export' as const, label: t.tabs.export, icon: FileSpreadsheet },
        { key: 'schedule' as const, label: t.tabs.schedule, icon: Calendar },
    ]

    const loadSchedules = async () => {
        setTab('schedule')
        if (schedules) return
        setScheduleLoading(true)
        const data = await getReportSchedules()
        setSchedules(data)
        setScheduleLoading(false)
    }

    const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1)
    const maxQty = Math.max(...topSKUs.map((s) => s.qtyOrdered), 1)
    const totalRevenue = monthlyRevenue.reduce((s, m) => s + m.revenue, 0)
    const totalChannelRevenue = channelBreakdown.reduce((s, c) => s + c.revenue, 0)

    const handleExport = async (key: ReportKey) => {
        setDownloading(key)
        setLastDownloaded(null)
        const result = await exportReportExcel(key)
        if (result.success && result.buffer && result.fileName) {
            const blob = new Blob(
                [Uint8Array.from(atob(result.buffer), (c) => c.charCodeAt(0))],
                { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
            )
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = result.fileName
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            setLastDownloaded(key)
        } else {
            toast.error(result.error || t.export.exportError)
        }
        setDownloading(null)
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div>
                <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>
                    {t.title}
                </h2>
                <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
                    {t.subtitle}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                {tabs.map((tabItem) => {
                    const Icon = tabItem.icon
                    const isActive = tab === tabItem.key
                    return (
                        <button
                            key={tabItem.key}
                            onClick={() => (tabItem.key === 'schedule' ? loadSchedules() : setTab(tabItem.key))}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md transition-all flex-1 justify-center cursor-pointer"
                            style={{
                                background: isActive ? 'rgba(8, 145, 178, 0.08)' : 'transparent',
                                color: isActive ? '#0891B2' : '#64748B',
                                border: isActive ? '1px solid rgba(8, 145, 178, 0.2)' : '1px solid transparent',
                            }}
                        >
                            <Icon size={14} />
                            {tabItem.label}
                        </button>
                    )
                })}
            </div>

            {tab === 'overview' && (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div
                            className="p-4 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '3px solid #87CBB9' }}
                        >
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                {t.kpiCards.rev6m}
                            </p>
                            <p className="text-xl font-bold mt-1 font-mono" style={{ color: '#0891B2' }}>
                                {formatFriendlyShort(totalRevenue, isEn)}
                            </p>
                        </div>
                        <div
                            className="p-4 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '3px solid #5BA88A' }}
                        >
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                {t.kpiCards.stockValue}
                            </p>
                            <p className="text-xl font-bold mt-1 font-mono" style={{ color: '#5BA88A' }}>
                                {formatFriendlyShort(stockValuation.totalValue, isEn)}
                            </p>
                        </div>
                        <div
                            className="p-4 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '3px solid #D4A853' }}
                        >
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                {t.kpiCards.totalStock}
                            </p>
                            <p className="text-xl font-bold mt-1 font-mono" style={{ color: '#D4A853' }}>
                                {stockValuation.totalQty.toLocaleString(isEn ? 'en-US' : 'vi-VN')} {t.kpiCards.bottlesUnit}
                            </p>
                        </div>
                        <div
                            className="p-4 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '3px solid #4A8FAB' }}
                        >
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                {t.kpiCards.activeSkus}
                            </p>
                            <p className="text-xl font-bold mt-1 font-mono" style={{ color: '#4A8FAB' }}>
                                {stockValuation.productCount}
                            </p>
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div
                            className="p-4 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '3px solid #5BA88A' }}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                    {t.financial.arTitle}
                                </p>
                                <Wallet size={16} style={{ color: '#5BA88A' }} />
                            </div>
                            <div className="flex items-center gap-8">
                                <div>
                                    <p className="text-[11px]" style={{ color: '#64748B' }}>
                                        {t.financial.totalUnpaid}
                                    </p>
                                    <p className="text-lg font-bold font-mono" style={{ color: '#0F172A' }}>
                                        {formatCurrency(financialSummary.ar.unpaid)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px]" style={{ color: '#E05252' }}>
                                        {t.financial.overdue}
                                    </p>
                                    <p className="text-lg font-bold font-mono" style={{ color: '#E05252' }}>
                                        {formatCurrency(financialSummary.ar.overdue)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div
                            className="p-4 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '3px solid #C45A2A' }}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                    {t.financial.apTitle}
                                </p>
                                <Wallet size={16} style={{ color: '#C45A2A' }} />
                            </div>
                            <div className="flex items-center gap-8">
                                <div>
                                    <p className="text-[11px]" style={{ color: '#64748B' }}>
                                        {t.financial.totalUnpaidAP}
                                    </p>
                                    <p className="text-lg font-bold font-mono" style={{ color: '#0F172A' }}>
                                        {formatCurrency(financialSummary.ap.unpaid)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px]" style={{ color: '#E05252' }}>
                                        {t.financial.overdue}
                                    </p>
                                    <p className="text-lg font-bold font-mono" style={{ color: '#E05252' }}>
                                        {formatCurrency(financialSummary.ap.overdue)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-5">
                        {/* Monthly revenue bar chart */}
                        <div
                            className="col-span-12 lg:col-span-8 p-5 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                        >
                            <div className="flex items-center gap-2 mb-5">
                                <BarChart3 size={18} style={{ color: '#0891B2' }} />
                                <h3 className="font-semibold" style={{ color: '#0F172A' }}>
                                    {t.analytics.monthlyRevTitle}
                                </h3>
                            </div>
                            <div className="flex items-end gap-3 h-48">
                                {monthlyRevenue.map((m) => {
                                    const pct = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0
                                    const monthLabel = isEn ? m.label.replace(/^T/, 'M') : m.label
                                    return (
                                        <div
                                            key={m.month}
                                            className="flex-1 flex flex-col items-center justify-end gap-1 group relative cursor-pointer"
                                        >
                                            {/* Tooltip on hover */}
                                            <div
                                                className="absolute bottom-full mb-2 hidden group-hover:block z-10 px-2 py-1 rounded shadow-lg text-[10px] font-bold"
                                                style={{
                                                    background: '#F8FAFC',
                                                    color: '#0891B2',
                                                    border: '1px solid #E2E8F0',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {formatCurrency(m.revenue)}
                                            </div>
                                            <p className="text-[10px] font-bold text-center w-full font-mono" style={{ color: '#0891B2' }}>
                                                {m.revenue > 0 ? `${(m.revenue / 1e6).toFixed(0)}M` : ''}
                                            </p>
                                            <div
                                                className="w-full rounded-t-md transition-all duration-500 group-hover:opacity-90"
                                                style={{
                                                    height: `${Math.max(4, (pct / 100) * 140)}px`,
                                                    background: pct > 70 ? '#87CBB9' : pct > 40 ? '#5BA88A' : '#E2E8F0',
                                                }}
                                            />
                                            <p className="text-xs font-medium" style={{ color: '#64748B' }}>
                                                {monthLabel}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Channel breakdown */}
                        <div
                            className="col-span-12 lg:col-span-4 p-5 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                        >
                            <div className="flex items-center gap-2 mb-5">
                                <TrendingUp size={18} style={{ color: '#0891B2' }} />
                                <h3 className="font-semibold" style={{ color: '#0F172A' }}>
                                    {t.analytics.channelTitle}
                                </h3>
                            </div>
                            {channelBreakdown.length === 0 ? (
                                <p className="text-xs text-center py-8" style={{ color: '#64748B' }}>
                                    {t.analytics.noData}
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {channelBreakdown.map((c) => {
                                        const pct = totalChannelRevenue > 0 ? (c.revenue / totalChannelRevenue) * 100 : 0
                                        const color = CHANNEL_COLOR[c.channel] ?? '#475569'
                                        const channelName = t.channels[c.channel as keyof typeof t.channels] ?? c.channel
                                        return (
                                            <div key={c.channel}>
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-xs" style={{ color: '#0F172A' }}>
                                                        {channelName}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold font-mono" style={{ color }}>
                                                            {(c.revenue / 1e6).toFixed(0)}M
                                                        </span>
                                                        <span className="text-xs" style={{ color: '#64748B' }}>
                                                            {pct.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${pct}%`, background: color }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top SKUs & Brand Breakdown Grid */}
                    <div className="grid grid-cols-12 gap-5">
                        {/* Top SKUs */}
                        <div
                            className="col-span-12 lg:col-span-7 p-5 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                        >
                            <div className="flex items-center gap-2 mb-5">
                                <Wine size={18} style={{ color: '#0891B2' }} />
                                <h3 className="font-semibold" style={{ color: '#0F172A' }}>
                                    {t.analytics.topSkusTitle}
                                </h3>
                            </div>
                            {topSKUs.length === 0 ? (
                                <p className="text-xs text-center py-8" style={{ color: '#64748B' }}>
                                    {t.analytics.noSalesData}
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {topSKUs.map((sku, i) => {
                                        const pct = (sku.qtyOrdered / maxQty) * 100
                                        const typeColor = WINE_TYPE_COLOR[sku.wineType] ?? '#475569'
                                        const wineTypeName = t.wineTypes[sku.wineType as keyof typeof t.wineTypes] ?? sku.wineType
                                        return (
                                            <div key={sku.productId} className="flex items-center gap-3 py-1 group relative">
                                                {/* Tooltip */}
                                                <div
                                                    className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-10 px-2 py-1 rounded shadow-lg text-[10px] font-bold"
                                                    style={{
                                                        background: '#F8FAFC',
                                                        color: '#0F172A',
                                                        border: '1px solid #E2E8F0',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {sku.productName}
                                                </div>
                                                <span
                                                    className="text-[10px] font-bold w-4 text-center flex-shrink-0 rounded-full"
                                                    style={{
                                                        color: i < 3 ? '#FFFFFF' : '#64748B',
                                                        background: i === 0 ? '#D4A853' : i === 1 ? '#475569' : i === 2 ? '#C45A2A' : 'transparent',
                                                    }}
                                                >
                                                    {i + 1}
                                                </span>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="text-xs px-1.5 py-0.5 rounded font-semibold"
                                                                style={{ background: `${typeColor}20`, color: typeColor }}
                                                            >
                                                                {wineTypeName}
                                                            </span>
                                                            <span className="text-xs font-semibold" style={{ color: '#0F172A' }}>
                                                                {sku.skuCode}
                                                            </span>
                                                            <span
                                                                className="text-[11px] hidden md:block truncate max-w-[200px]"
                                                                style={{ color: '#64748B' }}
                                                            >
                                                                {sku.productName}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs font-bold flex-shrink-0 font-mono" style={{ color: '#0891B2' }}>
                                                            {sku.qtyOrdered.toLocaleString(isEn ? 'en-US' : 'vi-VN')} {t.analytics.bottlesSold}
                                                        </span>
                                                    </div>
                                                    <div className="h-1 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${pct}%`, background: typeColor }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Brand Breakdown */}
                        <div
                            className="col-span-12 lg:col-span-5 p-5 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                        >
                            <div className="flex items-center gap-2 mb-5">
                                <TrendingUp size={18} style={{ color: '#0891B2' }} />
                                <h3 className="font-semibold" style={{ color: '#0F172A' }}>
                                    {t.analytics.brandTitle}
                                </h3>
                            </div>
                            {brandBreakdown.length === 0 ? (
                                <p className="text-xs text-center py-8" style={{ color: '#64748B' }}>
                                    {t.analytics.noData}
                                </p>
                            ) : (() => {
                                const totalBrandRevenue = brandBreakdown.reduce((sum, x) => sum + x.revenue, 0)
                                return (
                                    <div
                                        className="space-y-4 max-h-80 overflow-y-auto pr-2"
                                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#E2E8F0 transparent' }}
                                    >
                                        {brandBreakdown.map((b) => {
                                            const pct = totalBrandRevenue > 0 ? (b.revenue / totalBrandRevenue) * 100 : 0
                                            return (
                                                <div key={b.brand} className="group relative">
                                                    {/* Tooltip */}
                                                    <div
                                                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 px-2 py-1 rounded shadow-lg text-[10px] font-bold"
                                                        style={{
                                                            background: '#F8FAFC',
                                                            color: '#0F172A',
                                                            border: '1px solid #E2E8F0',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {b.orderCount} {t.analytics.ordersCount} • {t.analytics.avgPerOrder} {formatCurrency(b.avgOrderValue)}/{isEn ? 'order' : 'đơn'}
                                                    </div>
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-xs font-semibold" style={{ color: '#0F172A' }}>
                                                            {b.brand}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-[#0891B2] font-mono">
                                                                {formatCurrency(b.revenue)}
                                                            </span>
                                                            <span className="text-xs" style={{ color: '#64748B' }}>
                                                                {pct.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500 bg-[#87CBB9]"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })()}
                        </div>
                    </div>

                    {/* Low Stock & Sales Rep & Top Customers */}
                    <div className="grid grid-cols-12 gap-5">
                        {/* Top Customers */}
                        <div
                            className="col-span-12 lg:col-span-5 p-5 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                        >
                            <div className="flex items-center gap-2 mb-5">
                                <Users size={18} style={{ color: '#0891B2' }} />
                                <h3 className="font-semibold" style={{ color: '#0F172A' }}>
                                    {t.analytics.topCustomersTitle}
                                </h3>
                            </div>
                            {topCustomers.length === 0 ? (
                                <p className="text-xs text-center py-8" style={{ color: '#64748B' }}>
                                    {t.analytics.noData}
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {topCustomers.map((c) => {
                                        const maxRev = Math.max(...topCustomers.map((x) => x.revenue))
                                        const pct = maxRev > 0 ? (c.revenue / maxRev) * 100 : 0
                                        return (
                                            <div key={c.customerId}>
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-xs font-semibold truncate max-w-[200px]" style={{ color: '#0F172A' }}>
                                                        {c.name}
                                                    </span>
                                                    <span className="text-xs font-bold font-mono" style={{ color: '#0891B2' }}>
                                                        {formatCurrency(c.revenue)}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${pct}%`, background: '#87CBB9' }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Sales Rep Performance */}
                        <div
                            className="col-span-12 lg:col-span-3 p-5 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                        >
                            <div className="flex items-center gap-2 mb-5">
                                <Trophy size={18} style={{ color: '#D4A853' }} />
                                <h3 className="font-semibold" style={{ color: '#0F172A' }}>
                                    {t.analytics.topSalesRepsTitle}
                                </h3>
                            </div>
                            {salesRepPerformance.length === 0 ? (
                                <p className="text-xs text-center py-8" style={{ color: '#64748B' }}>
                                    {t.analytics.noData}
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {salesRepPerformance.map((r, i) => (
                                        <div key={r.salesRepId} className="flex items-center gap-3">
                                            <div
                                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                                                style={{
                                                    background: i === 0 ? '#D4A853' : i === 1 ? '#475569' : i === 2 ? '#C45A2A' : '#F1F5F9',
                                                    color: i < 3 ? '#FFFFFF' : '#64748B',
                                                }}
                                            >
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate" style={{ color: '#0F172A' }}>
                                                    {r.name}
                                                </p>
                                                <p className="text-[10px] truncate" style={{ color: '#64748B' }}>
                                                    {r.orders} {t.analytics.ordersCount}
                                                </p>
                                            </div>
                                            <span className="text-xs font-bold font-mono" style={{ color: '#0891B2' }}>
                                                {(r.revenue / 1e6).toFixed(0)}M
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Low Stock Alerts */}
                        <div
                            className="col-span-12 lg:col-span-4 p-5 rounded-md"
                            style={{ background: 'rgba(224, 82, 82, 0.05)', border: '1px solid rgba(224, 82, 82, 0.2)' }}
                        >
                            <div className="flex items-center gap-2 mb-5">
                                <AlertTriangle size={18} style={{ color: '#E05252' }} />
                                <h3 className="font-semibold" style={{ color: '#0F172A' }}>
                                    {t.analytics.lowStockTitle}
                                </h3>
                            </div>
                            {lowStockAlerts.length === 0 ? (
                                <p className="text-xs text-center py-8" style={{ color: '#64748B' }}>
                                    {t.analytics.noLowStock}
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {lowStockAlerts.map((l) => (
                                        <div
                                            key={l.productId}
                                            className="flex items-center justify-between p-2 rounded"
                                            style={{ background: 'rgba(224, 82, 82, 0.1)' }}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold truncate" style={{ color: '#0F172A' }}>
                                                    {l.skuCode}
                                                </p>
                                                <p className="text-[10px] truncate" style={{ color: '#64748B' }}>
                                                    {l.productName}
                                                </p>
                                            </div>
                                            <div className="text-right ml-3 flex-shrink-0">
                                                <p className="text-xs font-bold font-mono" style={{ color: '#E05252' }}>
                                                    {l.qtyAvailable.toLocaleString(isEn ? 'en-US' : 'vi-VN')} {t.analytics.bottlesSold}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {tab === 'export' && (
                <div className="space-y-4">
                    <div
                        className="p-4 rounded-md"
                        style={{ background: 'rgba(135,203,185,0.06)', border: '1px solid rgba(8, 145, 178, 0.15)' }}
                    >
                        <p className="text-xs" style={{ color: '#0891B2' }}>
                            <FileSpreadsheet size={14} className="inline mr-1.5" />
                            {t.export.bannerText}
                        </p>
                    </div>

                    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                    {[t.export.thCode, t.export.thName, t.export.thModule, t.export.thAction].map((h) => (
                                        <th
                                            key={h}
                                            className="px-4 py-3 text-xs uppercase tracking-wider font-semibold"
                                            style={{ color: '#64748B' }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {REPORT_CATALOG.map((r) => {
                                    const isDownloading = downloading === r.key
                                    const justDownloaded = lastDownloaded === r.key
                                    const moduleColor = MODULE_COLORS[r.module] ?? '#475569'
                                    const reportName = t.reports[r.key] ?? r.name
                                    return (
                                        <tr
                                            key={r.key}
                                            style={{ borderBottom: '1px solid #E2E8F0' }}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(8, 145, 178, 0.03)')}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <td className="px-4 py-3">
                                                <span
                                                    className="text-xs font-bold px-2 py-0.5 rounded font-mono"
                                                    style={{ color: '#0891B2', background: 'rgba(8, 145, 178, 0.08)' }}
                                                >
                                                    {r.code}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium" style={{ color: '#0F172A' }}>
                                                {reportName}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className="text-xs font-semibold px-2 py-0.5 rounded"
                                                    style={{ color: moduleColor, background: `${moduleColor}18` }}
                                                >
                                                    {r.module}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleExport(r.key)}
                                                    disabled={isDownloading}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all disabled:opacity-50 cursor-pointer"
                                                    style={{
                                                        background: justDownloaded ? 'rgba(91,168,138,0.15)' : 'rgba(8, 145, 178, 0.08)',
                                                        color: justDownloaded ? '#5BA88A' : '#0891B2',
                                                        border: `1px solid ${justDownloaded ? 'rgba(91,168,138,0.3)' : 'rgba(8, 145, 178, 0.2)'}`,
                                                    }}
                                                >
                                                    {isDownloading ? (
                                                        <>
                                                            <Loader2 size={12} className="animate-spin" /> {t.export.exportingBtn}
                                                        </>
                                                    ) : justDownloaded ? (
                                                        <>
                                                            <CheckCircle2 size={12} /> {t.export.downloadedBtn}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Download size={12} /> {t.export.exportBtn}
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab: Scheduled Reports */}
            {tab === 'schedule' && (
                <div className="space-y-4">
                    <div
                        className="p-4 rounded-md"
                        style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)' }}
                    >
                        <p className="text-xs" style={{ color: '#D4A853' }}>
                            <Calendar size={14} className="inline mr-1.5" />
                            {t.schedules.bannerText}
                        </p>
                    </div>

                    {scheduleLoading ? (
                        <div className="flex items-center justify-center py-16 gap-2">
                            <Loader2 size={16} className="animate-spin" style={{ color: '#D4A853' }} />
                            <span className="text-sm" style={{ color: '#64748B' }}>
                                {t.schedules.loading}
                            </span>
                        </div>
                    ) : schedules && schedules.length > 0 ? (
                        <div className="rounded-md overflow-hidden" style={{ border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                        {[
                                            t.schedules.thTemplate,
                                            t.schedules.thFreq,
                                            t.schedules.thRecipients,
                                            t.schedules.thLastRun,
                                            t.schedules.thNextRun,
                                            t.schedules.thStatus,
                                        ].map((h) => (
                                            <th
                                                key={h}
                                                className="px-4 py-3 text-xs uppercase tracking-wider font-semibold"
                                                style={{ color: '#64748B' }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {schedules.map((s) => {
                                        const freqLabel =
                                            s.frequency === 'DAILY'
                                                ? t.schedules.freqDaily
                                                : s.frequency === 'WEEKLY'
                                                ? t.schedules.freqWeekly
                                                : t.schedules.freqMonthly
                                        const isActive = s.status === 'ACTIVE'
                                        return (
                                            <tr key={s.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                                <td className="px-4 py-3 text-sm font-medium" style={{ color: '#0F172A' }}>
                                                    {s.templateName}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#D4A853' }}>
                                                        <Clock size={11} /> {freqLabel}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {s.recipients.map((r) => (
                                                            <span
                                                                key={r}
                                                                className="text-xs px-1.5 py-0.5 rounded border border-slate-200"
                                                                style={{ background: '#F8FAFC', color: '#475569' }}
                                                            >
                                                                {r}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>
                                                    {s.lastRunAt ? formatDate(s.lastRunAt, true) : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-medium" style={{ color: '#0891B2' }}>
                                                    {s.nextRunAt ? formatDate(s.nextRunAt, true) : '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={async () => {
                                                            await toggleScheduleStatus(s.id)
                                                            const updated = await getReportSchedules()
                                                            setSchedules(updated)
                                                        }}
                                                        className="text-xs font-semibold px-2 py-1 rounded transition-all cursor-pointer"
                                                        style={{
                                                            background: isActive ? 'rgba(91,168,138,0.15)' : 'rgba(139,26,46,0.15)',
                                                            color: isActive ? '#5BA88A' : '#8B1A2E',
                                                            border: `1px solid ${isActive ? 'rgba(91,168,138,0.3)' : 'rgba(139,26,46,0.3)'}`,
                                                        }}
                                                    >
                                                        {isActive ? t.schedules.active : t.schedules.paused}
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-16 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <Calendar size={28} style={{ color: '#CBD5E1', margin: '0 auto' }} />
                            <p className="text-sm mt-3 font-medium" style={{ color: '#64748B' }}>
                                {t.schedules.noSchedules}
                            </p>
                            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                                {t.schedules.apiHint}{' '}
                                <code className="text-xs font-mono" style={{ color: '#0891B2' }}>
                                    createReportSchedule()
                                </code>
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
