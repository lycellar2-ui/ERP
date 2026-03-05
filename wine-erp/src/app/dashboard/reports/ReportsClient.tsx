'use client'

import { useState } from 'react'
import { BarChart3, TrendingUp, Package, Wine, Download, Loader2, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { formatVND } from '@/lib/utils'
import { exportReportExcel } from './actions'
import { REPORT_CATALOG, type ReportKey } from './constants'

const CHANNEL_LABEL: Record<string, string> = {
    HORECA: 'HORECA',
    WHOLESALE_DISTRIBUTOR: 'Đại Lý',
    VIP_RETAIL: 'VIP Retail',
    DIRECT_INDIVIDUAL: 'Trực Tiếp',
}

const CHANNEL_COLOR: Record<string, string> = {
    HORECA: '#87CBB9',
    WHOLESALE_DISTRIBUTOR: '#4A8FAB',
    VIP_RETAIL: '#D4A853',
    DIRECT_INDIVIDUAL: '#5BA88A',
}

const WINE_TYPE_COLOR: Record<string, string> = {
    RED: '#8B1A2E', WHITE: '#D4A853', ROSE: '#C45A2A',
    SPARKLING: '#87CBB9', FORTIFIED: '#4A8FAB', DESSERT: '#A5DED0',
}

const MODULE_COLORS: Record<string, string> = {
    WMS: '#5BA88A', SLS: '#87CBB9', FIN: '#D4A853', CST: '#4A8FAB',
    PRC: '#8AAEBB', CRM: '#C45A2A', STM: '#A5DED0', TAX: '#E05252',
}

const TABS = [
    { key: 'overview', label: 'Tổng Quan', icon: BarChart3 },
    { key: 'export', label: 'Xuất Excel (15 Báo Cáo)', icon: FileSpreadsheet },
] as const

type TabKey = typeof TABS[number]['key']

interface Props {
    topSKUs: { productId: string; skuCode: string; productName: string; wineType: string; qtyOrdered: number }[]
    monthlyRevenue: { month: string; label: string; revenue: number }[]
    channelBreakdown: { channel: string; revenue: number; orders: number }[]
    stockValuation: { totalQty: number; totalValue: number; productCount: number }
}

export function ReportsClient({ topSKUs, monthlyRevenue, channelBreakdown, stockValuation }: Props) {
    const [tab, setTab] = useState<TabKey>('overview')
    const [downloading, setDownloading] = useState<string | null>(null)
    const [lastDownloaded, setLastDownloaded] = useState<string | null>(null)

    const maxRevenue = Math.max(...monthlyRevenue.map(m => m.revenue), 1)
    const maxQty = Math.max(...topSKUs.map(s => s.qtyOrdered), 1)
    const totalRevenue = monthlyRevenue.reduce((s, m) => s + m.revenue, 0)
    const totalChannelRevenue = channelBreakdown.reduce((s, c) => s + c.revenue, 0)

    const handleExport = async (key: ReportKey) => {
        setDownloading(key)
        setLastDownloaded(null)
        const result = await exportReportExcel(key)
        if (result.success && result.buffer && result.fileName) {
            const blob = new Blob(
                [Uint8Array.from(atob(result.buffer), c => c.charCodeAt(0))],
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
            alert(result.error || 'Lỗi xuất báo cáo')
        }
        setDownloading(null)
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div>
                <h2 className="text-2xl font-bold"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                    Báo Cáo & Phân Tích (RPT)
                </h2>
                <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                    Doanh thu, sản phẩm bán chạy, kênh, tồn kho — Tổng hợp từ mọi module
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#142433' }}>
                {TABS.map(t => {
                    const Icon = t.icon
                    const isActive = tab === t.key
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md transition-all flex-1 justify-center"
                            style={{
                                background: isActive ? '#1B2E3D' : 'transparent',
                                color: isActive ? '#87CBB9' : '#4A6A7A',
                                border: isActive ? '1px solid #2A4355' : '1px solid transparent',
                            }}>
                            <Icon size={14} />
                            {t.label}
                        </button>
                    )
                })}
            </div>

            {tab === 'overview' && (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: '3px solid #87CBB9' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Doanh Thu 6 Tháng</p>
                            <p className="text-xl font-bold mt-1" style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>
                                ₫{(totalRevenue / 1e9).toFixed(2)}T
                            </p>
                        </div>
                        <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: '3px solid #5BA88A' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Giá Trị Tồn Kho</p>
                            <p className="text-xl font-bold mt-1" style={{ fontFamily: '"DM Mono"', color: '#5BA88A' }}>
                                ₫{(stockValuation.totalValue / 1e9).toFixed(2)}T
                            </p>
                        </div>
                        <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: '3px solid #D4A853' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Tổng Tồn Kho</p>
                            <p className="text-xl font-bold mt-1" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                {stockValuation.totalQty.toLocaleString()} chai
                            </p>
                        </div>
                        <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: '3px solid #4A8FAB' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>SKU Đang Có Hàng</p>
                            <p className="text-xl font-bold mt-1" style={{ fontFamily: '"DM Mono"', color: '#4A8FAB' }}>
                                {stockValuation.productCount}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-5">
                        {/* Monthly revenue bar chart */}
                        <div className="col-span-12 lg:col-span-8 p-5 rounded-md"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center gap-2 mb-5">
                                <BarChart3 size={18} style={{ color: '#87CBB9' }} />
                                <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>Doanh Thu 6 Tháng Gần Nhất</h3>
                            </div>
                            <div className="flex items-end gap-3 h-48">
                                {monthlyRevenue.map((m) => {
                                    const pct = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0
                                    return (
                                        <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                                            <p className="text-xs font-bold text-right w-full" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                                {m.revenue > 0 ? `${(m.revenue / 1e6).toFixed(0)}M` : '—'}
                                            </p>
                                            <div className="w-full rounded-t-md transition-all duration-500"
                                                style={{
                                                    height: `${Math.max(4, (pct / 100) * 140)}px`,
                                                    background: pct > 70 ? '#87CBB9' : pct > 40 ? '#5BA88A' : '#2A4355',
                                                }}
                                            />
                                            <p className="text-xs font-medium" style={{ color: '#4A6A7A' }}>{m.label}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Channel breakdown */}
                        <div className="col-span-12 lg:col-span-4 p-5 rounded-md"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center gap-2 mb-5">
                                <TrendingUp size={18} style={{ color: '#87CBB9' }} />
                                <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>Theo Kênh Bán</h3>
                            </div>
                            {channelBreakdown.length === 0 ? (
                                <p className="text-xs text-center py-8" style={{ color: '#4A6A7A' }}>Chưa có dữ liệu</p>
                            ) : (
                                <div className="space-y-3">
                                    {channelBreakdown.map(c => {
                                        const pct = totalChannelRevenue > 0 ? (c.revenue / totalChannelRevenue) * 100 : 0
                                        const color = CHANNEL_COLOR[c.channel] ?? '#8AAEBB'
                                        return (
                                            <div key={c.channel}>
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-xs" style={{ color: '#E8F1F2' }}>{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold" style={{ fontFamily: '"DM Mono"', color }}>
                                                            {(c.revenue / 1e6).toFixed(0)}M
                                                        </span>
                                                        <span className="text-xs" style={{ color: '#4A6A7A' }}>{pct.toFixed(0)}%</span>
                                                    </div>
                                                </div>
                                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#142433' }}>
                                                    <div className="h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${pct}%`, background: color }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top SKUs */}
                    <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="flex items-center gap-2 mb-5">
                            <Wine size={18} style={{ color: '#87CBB9' }} />
                            <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>Top 10 SKU Bán Chạy Nhất</h3>
                        </div>
                        {topSKUs.length === 0 ? (
                            <p className="text-xs text-center py-8" style={{ color: '#4A6A7A' }}>Chưa có dữ liệu bán hàng</p>
                        ) : (
                            <div className="space-y-2">
                                {topSKUs.map((sku, i) => {
                                    const pct = (sku.qtyOrdered / maxQty) * 100
                                    const typeColor = WINE_TYPE_COLOR[sku.wineType] ?? '#8AAEBB'
                                    return (
                                        <div key={sku.productId} className="flex items-center gap-4">
                                            <span className="text-xs font-bold w-5 text-right" style={{ color: '#4A6A7A' }}>
                                                {i + 1}
                                            </span>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                                                            style={{ background: `${typeColor}20`, color: typeColor }}>
                                                            {sku.wineType}
                                                        </span>
                                                        <span className="text-xs font-semibold" style={{ color: '#E8F1F2' }}>{sku.skuCode}</span>
                                                        <span className="text-xs hidden md:block truncate max-w-[200px]" style={{ color: '#4A6A7A' }}>
                                                            {sku.productName}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold flex-shrink-0" style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>
                                                        {sku.qtyOrdered.toLocaleString()} chai
                                                    </span>
                                                </div>
                                                <div className="h-1 rounded-full overflow-hidden" style={{ background: '#142433' }}>
                                                    <div className="h-full rounded-full transition-all duration-500"
                                                        style={{ width: `${pct}%`, background: typeColor }} />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}

            {tab === 'export' && (
                <div className="space-y-4">
                    <div className="p-4 rounded-md" style={{ background: 'rgba(135,203,185,0.06)', border: '1px solid rgba(135,203,185,0.15)' }}>
                        <p className="text-xs" style={{ color: '#87CBB9' }}>
                            <FileSpreadsheet size={14} className="inline mr-1.5" />
                            15 báo cáo chuẩn — Xuất file Excel (.xlsx) với header công ty, format VND, auto-filter. Nhấn vào nút Xuất để tải.
                        </p>
                    </div>

                    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                    {['Mã', 'Tên Báo Cáo', 'Module', 'Hành Động'].map(h => (
                                        <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold"
                                            style={{ color: '#4A6A7A' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {REPORT_CATALOG.map(r => {
                                    const isDownloading = downloading === r.key
                                    const justDownloaded = lastDownloaded === r.key
                                    const moduleColor = MODULE_COLORS[r.module] ?? '#8AAEBB'
                                    return (
                                        <tr key={r.key}
                                            style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded"
                                                    style={{ fontFamily: '"DM Mono"', color: '#87CBB9', background: 'rgba(135,203,185,0.1)' }}>
                                                    {r.code}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium" style={{ color: '#E8F1F2' }}>
                                                {r.name}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded"
                                                    style={{ color: moduleColor, background: `${moduleColor}18` }}>
                                                    {r.module}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleExport(r.key)}
                                                    disabled={isDownloading}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all disabled:opacity-50"
                                                    style={{
                                                        background: justDownloaded ? 'rgba(91,168,138,0.15)' : 'rgba(135,203,185,0.1)',
                                                        color: justDownloaded ? '#5BA88A' : '#87CBB9',
                                                        border: `1px solid ${justDownloaded ? 'rgba(91,168,138,0.3)' : 'rgba(135,203,185,0.2)'}`,
                                                    }}
                                                    onMouseEnter={e => { if (!isDownloading) e.currentTarget.style.background = 'rgba(135,203,185,0.2)' }}
                                                    onMouseLeave={e => { if (!isDownloading) e.currentTarget.style.background = justDownloaded ? 'rgba(91,168,138,0.15)' : 'rgba(135,203,185,0.1)' }}>
                                                    {isDownloading ? (
                                                        <><Loader2 size={12} className="animate-spin" /> Đang xuất...</>
                                                    ) : justDownloaded ? (
                                                        <><CheckCircle2 size={12} /> Đã tải</>
                                                    ) : (
                                                        <><Download size={12} /> Xuất Excel</>
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
        </div>
    )
}
