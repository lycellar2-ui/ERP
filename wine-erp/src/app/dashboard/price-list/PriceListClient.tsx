'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Tag, Search, Trash2, Loader2, X, DollarSign, Edit3, ChevronRight, Package } from 'lucide-react'
import { PriceListRow, getPriceLists, getPriceListDetail, createPriceList, upsertPriceListLine, removePriceListLine, getProductsForPriceList, deletePriceList } from './actions'
import { formatVND } from '@/lib/utils'

const CHANNEL_CFG: Record<string, { label: string; color: string; bg: string }> = {
    HORECA: { label: 'HORECA', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    WHOLESALE_DISTRIBUTOR: { label: 'Đại Lý', color: '#87CBB9', bg: 'rgba(135,203,185,0.12)' },
    VIP_RETAIL: { label: 'VIP Retail', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' },
    DIRECT_INDIVIDUAL: { label: 'Trực Tiếp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)' },
}

function ChannelBadge({ channel }: { channel: string }) {
    const cfg = CHANNEL_CFG[channel] ?? { label: channel, color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)' }
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
}

interface Props {
    initialLists: PriceListRow[]
}

export function PriceListClient({ initialLists }: Props) {
    const [lists, setLists] = useState(initialLists)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [detail, setDetail] = useState<Awaited<ReturnType<typeof getPriceListDetail>>>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [addProductOpen, setAddProductOpen] = useState(false)
    const [products, setProducts] = useState<{ id: string; skuCode: string; productName: string }[]>([])

    // Form state
    const [formName, setFormName] = useState('')
    const [formChannel, setFormChannel] = useState('HORECA')
    const [formEffective, setFormEffective] = useState(new Date().toISOString().slice(0, 10))
    const [formExpiry, setFormExpiry] = useState('')
    const [saving, setSaving] = useState(false)

    // Add product form
    const [addProductId, setAddProductId] = useState('')
    const [addPrice, setAddPrice] = useState('')
    const [addSearch, setAddSearch] = useState('')

    const reload = useCallback(async () => {
        const data = await getPriceLists()
        setLists(data)
    }, [])

    const loadDetail = useCallback(async (id: string) => {
        setDetailLoading(true)
        setSelectedId(id)
        const data = await getPriceListDetail(id)
        setDetail(data)
        setDetailLoading(false)
    }, [])

    const handleCreate = async () => {
        if (!formName.trim()) return
        setSaving(true)
        const res = await createPriceList({
            name: formName,
            channel: formChannel,
            effectiveDate: formEffective,
            expiryDate: formExpiry || undefined,
        })
        if (res.success) {
            setCreateOpen(false)
            setFormName('')
            setFormExpiry('')
            await reload()
            if (res.id) loadDetail(res.id)
        }
        setSaving(false)
    }

    const handleAddProduct = async () => {
        if (!addProductId || !addPrice || !selectedId) return
        setSaving(true)
        await upsertPriceListLine({
            priceListId: selectedId,
            productId: addProductId,
            unitPrice: Number(addPrice),
        })
        setAddProductId('')
        setAddPrice('')
        setAddSearch('')
        setAddProductOpen(false)
        await loadDetail(selectedId)
        setSaving(false)
    }

    const handleRemoveLine = async (lineId: string) => {
        if (!selectedId || !confirm('Xóa dòng giá này?')) return
        await removePriceListLine(lineId)
        await loadDetail(selectedId)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa bảng giá này và tất cả dòng giá?')) return
        await deletePriceList(id)
        if (selectedId === id) { setSelectedId(null); setDetail(null) }
        await reload()
    }

    const openAddProduct = async () => {
        if (products.length === 0) {
            const data = await getProductsForPriceList()
            setProducts(data)
        }
        setAddProductOpen(true)
    }

    const filteredProducts = addSearch
        ? products.filter(p => p.productName.toLowerCase().includes(addSearch.toLowerCase()) || p.skuCode.toLowerCase().includes(addSearch.toLowerCase()))
        : products

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Bảng Giá (PRC)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Quản lý bảng giá theo kênh bán hàng — HORECA, Đại Lý, VIP, Trực Tiếp
                    </p>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all"
                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}
                >
                    <Plus size={16} /> Tạo Bảng Giá
                </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
                {Object.entries(CHANNEL_CFG).map(([key, cfg]) => {
                    const count = lists.filter(l => l.channel === key).length
                    return (
                        <div key={key} className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: cfg.color }} />
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>{cfg.label}</p>
                            </div>
                            <p className="text-xl font-bold" style={{ fontFamily: '"DM Mono", monospace', color: '#E8F1F2' }}>{count}</p>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>bảng giá</p>
                        </div>
                    )
                })}
            </div>

            {/* Main content: list + detail */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left: Price Lists */}
                <div className="lg:col-span-1 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A6A7A' }}>DANH SÁCH BẢNG GIÁ</p>
                    {lists.length === 0 ? (
                        <div className="text-center py-12 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <Tag size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                            <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có bảng giá nào</p>
                        </div>
                    ) : lists.map(pl => (
                        <div
                            key={pl.id}
                            onClick={() => loadDetail(pl.id)}
                            className="p-3.5 rounded-md cursor-pointer transition-all"
                            style={{
                                background: selectedId === pl.id ? 'rgba(135,203,185,0.08)' : '#1B2E3D',
                                border: `1px solid ${selectedId === pl.id ? 'rgba(135,203,185,0.3)' : '#2A4355'}`,
                            }}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{pl.name}</p>
                                <ChannelBadge channel={pl.channel} />
                            </div>
                            <div className="flex items-center justify-between text-xs" style={{ color: '#4A6A7A' }}>
                                <span>{pl.itemCount} sản phẩm</span>
                                <span>{new Date(pl.effectiveDate).toLocaleDateString('vi-VN')}</span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <ChevronRight size={12} style={{ color: '#4A6A7A' }} />
                                <button
                                    onClick={e => { e.stopPropagation(); handleDelete(pl.id) }}
                                    className="p-1 rounded hover:bg-red-500/10 transition"
                                    title="Xóa bảng giá"
                                >
                                    <Trash2 size={12} style={{ color: '#8B1A2E' }} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right: Detail */}
                <div className="lg:col-span-2">
                    {detailLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                        </div>
                    ) : !selectedId ? (
                        <div className="text-center py-20 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <DollarSign size={40} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                            <p className="text-sm" style={{ color: '#4A6A7A' }}>Chọn bảng giá bên trái để xem chi tiết</p>
                        </div>
                    ) : detail ? (
                        <div className="space-y-4">
                            {/* Detail header */}
                            <div className="flex items-center justify-between p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <div>
                                    <h3 className="text-lg font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>{detail.name}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <ChannelBadge channel={detail.channel} />
                                        <span className="text-xs" style={{ color: '#4A6A7A' }}>
                                            Hiệu lực: {new Date(detail.effectiveDate).toLocaleDateString('vi-VN')}
                                            {detail.expiryDate && ` → ${new Date(detail.expiryDate).toLocaleDateString('vi-VN')}`}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={openAddProduct}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-all"
                                    style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)', borderRadius: '6px' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.25)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.15)')}
                                >
                                    <Plus size={14} /> Thêm Sản Phẩm
                                </button>
                            </div>

                            {/* Price lines table */}
                            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                                <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#142433' }}>
                                            {['SKU', 'Sản Phẩm', 'Giá Bán', 'Tiền Tệ', 'Hành Động'].map(h => (
                                                <th key={h} className="px-4 py-2.5 text-xs uppercase tracking-wider text-left font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detail.lines.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center py-12" style={{ color: '#4A6A7A' }}>
                                                    <Package size={28} className="mx-auto mb-2" style={{ color: '#2A4355' }} />
                                                    <p className="text-xs">Chưa có sản phẩm. Bấm "Thêm Sản Phẩm" để bắt đầu.</p>
                                                </td>
                                            </tr>
                                        ) : detail.lines.map(line => (
                                            <tr key={line.id} style={{ borderTop: '1px solid #2A4355' }}>
                                                <td className="px-4 py-2.5">
                                                    <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{line.skuCode}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs" style={{ color: '#E8F1F2' }}>{line.productName}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="text-sm font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>{formatVND(line.unitPrice)}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>{line.currency}</td>
                                                <td className="px-4 py-2.5">
                                                    <button onClick={() => handleRemoveLine(line.id)} className="p-1.5 rounded transition hover:bg-red-500/10">
                                                        <Trash2 size={13} style={{ color: '#8B1A2E' }} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Create drawer */}
            {createOpen && (
                <>
                    <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={() => setCreateOpen(false)} />
                    <div className="fixed top-0 right-0 h-full z-50 flex flex-col" style={{ width: 'min(420px,95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                            <h3 className="text-lg font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>Tạo Bảng Giá Mới</h3>
                            <button onClick={() => setCreateOpen(false)} className="p-1.5 rounded" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        <div className="flex-1 px-6 py-5 space-y-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Tên Bảng Giá</label>
                                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="VD: Bảng giá HORECA Q1/2026"
                                    className="w-full mt-1 px-3 py-2.5 text-sm outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Kênh Bán Hàng</label>
                                <select value={formChannel} onChange={e => setFormChannel(e.target.value)}
                                    className="w-full mt-1 px-3 py-2.5 text-sm outline-none cursor-pointer" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}>
                                    {Object.entries(CHANNEL_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Ngày Hiệu Lực</label>
                                    <input type="date" value={formEffective} onChange={e => setFormEffective(e.target.value)}
                                        className="w-full mt-1 px-3 py-2.5 text-sm outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Ngày Hết Hạn</label>
                                    <input type="date" value={formExpiry} onChange={e => setFormExpiry(e.target.value)}
                                        className="w-full mt-1 px-3 py-2.5 text-sm outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }} />
                                </div>
                            </div>
                            <button onClick={handleCreate} disabled={saving || !formName.trim()}
                                className="w-full py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                                style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                                {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Tạo Bảng Giá'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Add product modal */}
            {addProductOpen && (
                <>
                    <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={() => setAddProductOpen(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 rounded-lg"
                        style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Thêm Sản Phẩm vào Bảng Giá</h3>
                            <button onClick={() => setAddProductOpen(false)} className="p-1" style={{ color: '#4A6A7A' }}><X size={16} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                                <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Tìm SKU hoặc tên sản phẩm..."
                                    className="w-full pl-9 pr-3 py-2 text-xs outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }} />
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-1 rounded-md p-1" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                {filteredProducts.slice(0, 20).map(p => (
                                    <div key={p.id}
                                        onClick={() => setAddProductId(p.id)}
                                        className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-xs transition"
                                        style={{
                                            background: addProductId === p.id ? 'rgba(135,203,185,0.12)' : 'transparent',
                                            color: addProductId === p.id ? '#87CBB9' : '#8AAEBB',
                                        }}>
                                        <span className="font-bold" style={{ fontFamily: '"DM Mono"' }}>{p.skuCode}</span>
                                        <span className="truncate" style={{ color: '#E8F1F2' }}>{p.productName}</span>
                                    </div>
                                ))}
                                {filteredProducts.length === 0 && (
                                    <p className="text-center py-4 text-xs" style={{ color: '#4A6A7A' }}>Không tìm thấy sản phẩm</p>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Giá Bán (VND)</label>
                                <input type="number" value={addPrice} onChange={e => setAddPrice(e.target.value)} placeholder="VD: 1500000"
                                    className="w-full mt-1 px-3 py-2 text-sm outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#D4A853', fontFamily: '"DM Mono"', borderRadius: '6px' }} />
                            </div>
                            <button onClick={handleAddProduct} disabled={saving || !addProductId || !addPrice}
                                className="w-full py-2 text-sm font-semibold transition-all disabled:opacity-50"
                                style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                                {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Thêm Giá'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
