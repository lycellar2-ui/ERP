'use client'

import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Plus, X, AlertTriangle, DollarSign, Search } from 'lucide-react'
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
        if (!form.productId || !form.price) return alert('Chọn SP và nhập giá')
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
        } else alert(res.error)
    }

    const filtered = rows.filter(r =>
        !search || r.skuCode.toLowerCase().includes(search.toLowerCase()) || r.productName.toLowerCase().includes(search.toLowerCase())
    )

    const belowCostCount = rows.filter(r => r.isBelowCost).length

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Giá Thị Trường
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        So sánh Giá Thị Trường vs Giá Vốn vs Giá Bán — Phát hiện rủi ro margin
                    </p>
                </div>
                <button onClick={openDrawer} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                    <Plus size={16} /> Thêm Giá TT
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Tổng Entries', value: stats.totalEntries, accent: '#87CBB9' },
                    { label: 'SP Tracked', value: stats.trackedProducts, accent: '#4A8FAB' },
                    { label: 'Dưới Cost', value: belowCostCount, accent: belowCostCount > 0 ? '#8B1A2E' : '#5BA88A' },
                    { label: 'Nguồn', value: stats.sourceBreakdown.map(s => s.source).join(', ') || '—', accent: '#D4A853' },
                ].map(s => (
                    <div key={s.label} className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{s.label}</p>
                        <p className="text-xl font-bold" style={{ fontFamily: '"DM Mono"', color: s.accent }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded text-sm"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                    placeholder="Tìm theo SKU hoặc tên sản phẩm..." />
            </div>

            {/* Table */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['SKU', 'Sản Phẩm', 'Giá TT', 'Giá Vốn', 'Giá Bán', 'Margin Gap', 'Nguồn', 'Ngày', 'Alert'].map(h => (
                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>
                                <DollarSign size={28} className="mx-auto mb-2" style={{ color: '#2A4355' }} />
                                Chưa có dữ liệu giá thị trường
                            </td></tr>
                        ) : filtered.map(r => (
                            <tr key={r.id} style={{
                                borderBottom: '1px solid rgba(42,67,85,0.5)',
                                background: r.isBelowCost ? 'rgba(139,26,46,0.04)' : 'transparent',
                            }}>
                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{r.skuCode}</td>
                                <td className="px-3 py-2.5 text-xs" style={{ color: '#E8F1F2' }}>{r.productName}</td>
                                <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                    {formatVND(r.marketPrice)}
                                </td>
                                <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#8AAEBB' }}>
                                    {r.landedCost !== null ? formatVND(r.landedCost) : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: r.isBelowCost ? '#8B1A2E' : '#5BA88A' }}>
                                    {r.listPrice !== null ? formatVND(r.listPrice) : '—'}
                                </td>
                                <td className="px-3 py-2.5">
                                    {r.marginGap !== null ? (
                                        <div className="flex items-center gap-1">
                                            {r.marginGap >= 0
                                                ? <TrendingUp size={12} style={{ color: '#5BA88A' }} />
                                                : <TrendingDown size={12} style={{ color: '#8B1A2E' }} />}
                                            <span className="text-xs font-bold" style={{
                                                fontFamily: '"DM Mono"',
                                                color: r.marginGap >= 20 ? '#5BA88A' : r.marginGap >= 0 ? '#D4A853' : '#8B1A2E',
                                            }}>
                                                {r.marginGap > 0 ? '+' : ''}{r.marginGap.toFixed(1)}%
                                            </span>
                                        </div>
                                    ) : <span className="text-xs" style={{ color: '#4A6A7A' }}>—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{r.source}</td>
                                <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>{formatDate(r.priceDate)}</td>
                                <td className="px-3 py-2.5">
                                    {r.isBelowCost && (
                                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded"
                                            style={{ background: 'rgba(139,26,46,0.15)', color: '#8B1A2E' }}>
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
                    <div className="w-[420px] h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                            <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>Thêm Giá Thị Trường</h3>
                            <button onClick={() => setDrawerOpen(false)} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Sản Phẩm *</label>
                                <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                                    className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                    <option value="">— Chọn SP —</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.skuCode} — {p.productName}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Giá *</label>
                                    <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                                        className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                        placeholder="VD: 500000" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Tiền Tệ</label>
                                    <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                                        className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                        <option value="VND">VND</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Nguồn</label>
                                    <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                                        className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                        {['Manual', 'Wine-Searcher', 'Competitor', 'Vivino', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Ngày</label>
                                    <input type="date" value={form.priceDate} onChange={e => setForm(f => ({ ...f, priceDate: e.target.value }))}
                                        className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                                </div>
                            </div>
                            <button onClick={handleAdd} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded"
                                style={{ background: '#87CBB9', color: '#0A1926' }}>
                                <DollarSign size={14} /> Lưu Giá Thị Trường
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
