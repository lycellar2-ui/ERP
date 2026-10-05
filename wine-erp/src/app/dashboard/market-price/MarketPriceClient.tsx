'use client'

import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Plus, X, AlertTriangle, DollarSign, Search, Tag, Globe, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, StatGrid, StatCard, Button } from '@/components/ui'
import { type MarketPriceRow, getMarketPrices, addMarketPrice, getProductOptions } from './actions'
import { formatVND, formatDate } from '@/lib/utils'

export function MarketPriceClient({ initialRows, stats }: {
    initialRows: MarketPriceRow[]
    stats: { totalEntries: number; trackedProducts: number; sourceBreakdown: { source: string; count: number }[] }
}) {
    const [rows, setRows] = useState(initialRows)
    const [search, setSearch] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [form, setForm] = useState({ productId: '', price: '', source: 'Manual', priceDate: new Date().toISOString().slice(0, 10), currency: 'VND' })

    const reload = async () => { const data = await getMarketPrices(); setRows(data) }

    const openDrawer = async () => {
        const prods = await getProductOptions()
        setProducts(prods)
        setDrawerOpen(true)
    }

    const handleAdd = async () => {
        if (!form.productId || !form.price) return toast.error('Chọn SP và nhập giá')
        const res = await addMarketPrice({
            productId: form.productId,
            price: Number(form.price),
            currency: form.currency,
            source: form.source,
            priceDate: form.priceDate,
            enteredBy: 'system',
        })
        if (res.success) {
            setDrawerOpen(false)
            setForm({ productId: '', price: '', source: 'Manual', priceDate: new Date().toISOString().slice(0, 10), currency: 'VND' })
            reload()
        } else toast.error(res.error || 'Lỗi lưu giá thị trường')
    }

    const filtered = rows.filter(r =>
        !search || r.skuCode.toLowerCase().includes(search.toLowerCase()) || r.productName.toLowerCase().includes(search.toLowerCase())
    )

    const belowCostCount = rows.filter(r => r.isBelowCost).length

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <PageHeader
                title="Giá Thị Trường"
                description="So sánh Giá Thị Trường vs Giá Vốn vs Giá Bán — Phát hiện rủi ro margin"
                actions={
                    <Button variant="primary" size="sm" onClick={openDrawer}>
                        <Plus size={14} className="mr-1.5" /> Thêm Giá TT
                    </Button>
                }
            />

            {/* Stats */}
            <StatGrid>
                <StatCard
                    label="Tổng Entries"
                    value={stats.totalEntries}
                    icon={Tag}
                />
                <StatCard
                    label="SP Tracked"
                    value={stats.trackedProducts}
                    icon={TrendingUp}
                />
                <StatCard
                    label="Dưới Cost"
                    value={belowCostCount}
                    icon={belowCostCount > 0 ? AlertTriangle : CheckCircle2}
                    tone={belowCostCount > 0 ? 'danger' : 'success'}
                />
                <StatCard
                    label="Nguồn"
                    value={stats.sourceBreakdown.map(s => s.source).join(', ') || '—'}
                    icon={Globe}
                />
            </StatGrid>

            {/* Search */}
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded text-sm"
                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                    placeholder="Tìm theo SKU hoặc tên sản phẩm..." />
            </div>

            {/* Table */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                            {['SKU', 'Sản Phẩm', 'Giá TT', 'Giá Vốn', 'Giá Bán', 'Margin Gap', 'Nguồn', 'Ngày', 'Alert'].map(h => (
                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: '#64748B' }}>
                                <DollarSign size={28} className="mx-auto mb-2" style={{ color: '#E2E8F0' }} />
                                Chưa có dữ liệu giá thị trường
                            </td></tr>
                        ) : filtered.map(r => (
                            <tr key={r.id} style={{
                                borderBottom: '1px solid #E2E8F0',
                                background: r.isBelowCost ? 'rgba(185,28,28,0.04)' : 'transparent',
                            }}>
                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#0891B2' }}>{r.skuCode}</td>
                                <td className="px-3 py-2.5 text-xs" style={{ color: '#0F172A' }}>{r.productName}</td>
                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#B45309' }}>
                                    {formatVND(r.marketPrice)}
                                </td>
                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#475569' }}>
                                    {r.landedCost !== null ? formatVND(r.landedCost) : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: r.isBelowCost ? '#B91C1C' : '#15803D' }}>
                                    {r.listPrice !== null ? formatVND(r.listPrice) : '—'}
                                </td>
                                <td className="px-3 py-2.5">
                                    {r.marginGap !== null ? (
                                        <div className="flex items-center gap-1">
                                            {r.marginGap >= 0
                                                ? <TrendingUp size={12} style={{ color: '#15803D' }} />
                                                : <TrendingDown size={12} style={{ color: '#B91C1C' }} />}
                                            <span className="text-xs font-bold" style={{ color: r.marginGap >= 20 ? '#15803D' : r.marginGap >= 0 ? '#B45309' : '#B91C1C' }}>
                                                {r.marginGap > 0 ? '+' : ''}{r.marginGap.toFixed(1)}%
                                            </span>
                                        </div>
                                    ) : <span className="text-xs" style={{ color: '#64748B' }}>—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-xs" style={{ color: '#475569' }}>{r.source}</td>
                                <td className="px-3 py-2.5 text-xs" style={{ color: '#64748B' }}>{formatDate(r.priceDate)}</td>
                                <td className="px-3 py-2.5">
                                    {r.isBelowCost && (
                                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded"
                                            style={{ background: 'rgba(185,28,28,0.15)', color: '#B91C1C' }}>
                                            <AlertTriangle size={10} /> Lỗ
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Drawer */}
            {drawerOpen && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[420px] h-full overflow-y-auto bg-white border-l border-slate-200 shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-slate-200">
                            <h3 className="text-base font-bold text-slate-900">Thêm Giá Thị Trường</h3>
                            <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1"><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1 text-slate-700">Sản Phẩm *</label>
                                <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-md text-sm bg-white border border-slate-200 text-slate-900">
                                    <option value="">— Chọn SP —</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.skuCode} — {p.productName}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-slate-700">Giá *</label>
                                    <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-md text-sm bg-white border border-slate-200 text-slate-900"
                                        placeholder="VD: 500000" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-slate-700">Tiền Tệ</label>
                                    <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-md text-sm bg-white border border-slate-200 text-slate-900">
                                        <option value="VND">VND</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-slate-700">Nguồn</label>
                                    <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-md text-sm bg-white border border-slate-200 text-slate-900">
                                        {['Manual', 'Wine-Searcher', 'Competitor', 'Vivino', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-slate-700">Ngày</label>
                                    <input type="date" value={form.priceDate} onChange={e => setForm(f => ({ ...f, priceDate: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-md text-sm bg-white border border-slate-200 text-slate-900" />
                                </div>
                            </div>
                            <Button variant="primary" size="md" onClick={handleAdd} className="w-full flex items-center justify-center gap-2">
                                <DollarSign size={14} /> Lưu Giá Thị Trường
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
