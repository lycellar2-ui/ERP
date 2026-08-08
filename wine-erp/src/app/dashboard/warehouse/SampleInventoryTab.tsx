'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Wine, Plus, ArrowUpCircle, Search, Filter, RefreshCw,
    ShieldCheck, AlertTriangle, Tag, History, CheckCircle2,
    X, FileText, Layers, TrendingDown, Clock, UserCheck, ChevronDown
} from 'lucide-react'
import {
    SampleProductItem, SampleTxItem, SampleInventoryStats,
    getSampleProducts, getSampleTransactions, getSampleInventoryStats,
    createSampleProduct, createSampleTransaction
} from './actions-sample'
import { formatVND, formatDate } from '@/lib/utils'

const ORIGIN_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    CHINH_NGACH: { label: 'Chính Ngạch', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
    TIEU_NGACH: { label: 'Tiểu Ngạch / Xách Tay', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
}

const REASON_CFG: Record<string, string> = {
    TASTING: 'Thử Rượu (Tasting)',
    CLIENT_GIFT: 'Tặng Khách Hàng (Gift)',
    EVENT: 'Sự Kiện / Workshop',
    MARKETING: 'Chụp Ảnh / Marketing',
    DAMAGE: 'Hư Hỏng / Bể Vỡ',
    OTHER: 'Khác',
}

export function SampleInventoryTab() {
    const [tab, setTab] = useState<'ITEMS' | 'TX_LOG'>('ITEMS')
    const [loading, setLoading] = useState(true)

    const [products, setProducts] = useState<SampleProductItem[]>([])
    const [transactions, setTransactions] = useState<SampleTxItem[]>([])
    const [stats, setStats] = useState<SampleInventoryStats | null>(null)

    // Filter states
    const [search, setSearch] = useState('')
    const [originFilter, setOriginFilter] = useState<'ALL' | 'CHINH_NGACH' | 'TIEU_NGACH'>('ALL')
    const [hasSkuFilter, setHasSkuFilter] = useState<'ALL' | 'WITH_SKU' | 'NO_SKU'>('ALL')

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false)
    const [showOutboundModal, setShowOutboundModal] = useState(false)
    const [selectedProductForOutbound, setSelectedProductForOutbound] = useState<SampleProductItem | null>(null)

    // Add Form states
    const [formName, setFormName] = useState('')
    const [formSku, setFormSku] = useState('')
    const [formOrigin, setFormOrigin] = useState<'CHINH_NGACH' | 'TIEU_NGACH'>('CHINH_NGACH')
    const [formEstCost, setFormEstCost] = useState<number | string>('')
    const [formInitialQty, setFormInitialQty] = useState<number | string>(1)
    const [formNotes, setFormNotes] = useState('')
    const [submittingAdd, setSubmittingAdd] = useState(false)

    // Outbound Form states
    const [outboundProductId, setOutboundProductId] = useState('')
    const [outboundReason, setOutboundReason] = useState('TASTING')
    const [outboundQty, setOutboundQty] = useState<number | string>(1)
    const [outboundRecipient, setOutboundRecipient] = useState('')
    const [outboundRequestedBy, setOutboundRequestedBy] = useState('')
    const [outboundNotes, setOutboundNotes] = useState('')
    const [submittingOutbound, setSubmittingOutbound] = useState(false)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [prods, txs, st] = await Promise.all([
                getSampleProducts({
                    search: search || undefined,
                    originType: originFilter !== 'ALL' ? originFilter : undefined,
                    hasSku: hasSkuFilter === 'WITH_SKU' ? true : hasSkuFilter === 'NO_SKU' ? false : undefined,
                }),
                getSampleTransactions({ limit: 100 }),
                getSampleInventoryStats(),
            ])
            setProducts(prods)
            setTransactions(txs)
            setStats(st)
        } catch (err: any) {
            console.error('Lỗi khi tải dữ liệu hàng mẫu:', err)
        } finally {
            setLoading(false)
        }
    }, [search, originFilter, hasSkuFilter])

    useEffect(() => { loadData() }, [loadData])

    // ── Handle Add Submit ─────────────────────────────
    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formName.trim()) return alert('Vui lòng nhập tên sản phẩm mẫu')
        setSubmittingAdd(true)
        try {
            await createSampleProduct({
                name: formName.trim(),
                skuCode: formSku.trim() || undefined,
                originType: formOrigin,
                estimatedCost: formEstCost ? Number(formEstCost) : undefined,
                initialQty: Number(formInitialQty) || 0,
                notes: formNotes.trim() || undefined,
            })
            setShowAddModal(false)
            resetAddForm()
            loadData()
        } catch (err: any) {
            alert(err.message || 'Lỗi khi khai báo hàng mẫu')
        } finally {
            setSubmittingAdd(false)
        }
    }

    const resetAddForm = () => {
        setFormName('')
        setFormSku('')
        setFormOrigin('CHINH_NGACH')
        setFormEstCost('')
        setFormInitialQty(1)
        setFormNotes('')
    }

    // ── Handle Outbound Submit ────────────────────────
    const handleOutboundSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const prodId = selectedProductForOutbound?.id || outboundProductId
        if (!prodId) return alert('Vui lòng chọn hàng mẫu cần xuất')
        if (!outboundQty || Number(outboundQty) <= 0) return alert('Số lượng xuất phải lớn hơn 0')

        setSubmittingOutbound(true)
        try {
            await createSampleTransaction({
                sampleProductId: prodId,
                type: 'OUTBOUND',
                reason: outboundReason as any,
                qty: Number(outboundQty),
                recipient: outboundRecipient,
                requestedBy: outboundRequestedBy,
                notes: outboundNotes,
            })
            setShowOutboundModal(false)
            resetOutboundForm()
            loadData()
        } catch (err: any) {
            alert(err.message || 'Lỗi khi tạo phiếu xuất hàng mẫu')
        } finally {
            setSubmittingOutbound(false)
        }
    }

    const resetOutboundForm = () => {
        setSelectedProductForOutbound(null)
        setOutboundProductId('')
        setOutboundReason('TASTING')
        setOutboundQty(1)
        setOutboundRecipient('')
        setOutboundRequestedBy('')
        setOutboundNotes('')
    }

    const openOutboundQuick = (prod: SampleProductItem) => {
        setSelectedProductForOutbound(prod)
        setOutboundProductId(prod.id)
        setShowOutboundModal(true)
    }

    const inputCls = "px-3 py-2 rounded-xl text-xs outline-none transition-colors w-full bg-white border border-slate-200 text-slate-900 focus:border-emerald-500 shadow-2xs"

    return (
        <div className="space-y-5">
            {/* ═════════════════════════════════════════════════════ */}
            {/* TOP HEADER & ACTION BAR (Light Theme)                */}
            {/* ═════════════════════════════════════════════════════ */}
            <div className="p-4 sm:p-5 rounded-2xl space-y-4 bg-white border border-slate-200 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                            <Wine size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900">
                                Quản Lý Tồn Kho Hàng Mẫu (Sample Wine)
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Kho riêng biệt không dùng bán hàng — Theo dõi nguồn ngạch & giao dịch xuất mẫu
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer active:scale-95">
                            <Plus size={15} /> Khai Báo / Nhập Mẫu
                        </button>
                        <button onClick={() => { setSelectedProductForOutbound(null); setShowOutboundModal(true) }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer active:scale-95">
                            <ArrowUpCircle size={15} /> Xuất Sử Dụng Mẫu
                        </button>
                    </div>
                </div>

                {/* KPI Stat Cards */}
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                <span>Mặt Hàng Mẫu</span>
                                <Layers size={14} className="text-emerald-600" />
                            </div>
                            <p className="text-xl font-extrabold font-mono text-slate-900">{stats.totalProducts.toLocaleString()} SKU</p>
                            <p className="text-[10px] text-slate-500 font-medium">Tổng danh mục hàng mẫu</p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                <span>Chính Ngạch</span>
                                <ShieldCheck size={14} className="text-emerald-600" />
                            </div>
                            <p className="text-xl font-extrabold font-mono text-emerald-600">{stats.chinhNgachQty.toLocaleString()} chai</p>
                            <p className="text-[10px] text-slate-500 font-medium">{stats.chinhNgachCount} mặt hàng</p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                <span>Tiểu Ngạch / Xách Tay</span>
                                <AlertTriangle size={14} className="text-amber-600" />
                            </div>
                            <p className="text-xl font-extrabold font-mono text-amber-600">{stats.tieuNgachQty.toLocaleString()} chai</p>
                            <p className="text-[10px] text-slate-500 font-medium">{stats.tieuNgachCount} mặt hàng</p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                <span>Giá Trị Ước Tính</span>
                                <Tag size={14} className="text-teal-600" />
                            </div>
                            <p className="text-xl font-extrabold font-mono text-teal-600">{formatVND(stats.totalEstValue)}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Tổng giá vốn ước tính</p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                <span>Xuất Tháng Này</span>
                                <TrendingDown size={14} className="text-rose-600" />
                            </div>
                            <p className="text-xl font-extrabold font-mono text-rose-600">-{stats.outboundThisMonth.toLocaleString()} chai</p>
                            <p className="text-[10px] text-slate-500 font-medium">Thử rượu & quà tặng</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Filter Tabs & Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
                    <button
                        onClick={() => setTab('ITEMS')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            tab === 'ITEMS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}>
                        <Wine size={14} /> Danh Sách Tồn Kho Mẫu ({products.length})
                    </button>
                    <button
                        onClick={() => setTab('TX_LOG')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            tab === 'TX_LOG' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}>
                        <History size={14} /> Nhật Ký Giao Dịch ({transactions.length})
                    </button>
                </div>

                {tab === 'ITEMS' && (
                    <div className="flex items-center gap-2 overflow-x-auto">
                        <div className="relative w-48 sm:w-60">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                placeholder="Tìm mã SKU, tên mẫu..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className={`pl-9 ${inputCls}`}
                            />
                        </div>

                        <select value={originFilter} onChange={e => setOriginFilter(e.target.value as any)} className={`w-36 ${inputCls}`}>
                            <option value="ALL">Tất cả Nguồn</option>
                            <option value="CHINH_NGACH">Chính Ngạch</option>
                            <option value="TIEU_NGACH">Tiểu Ngạch</option>
                        </select>

                        <select value={hasSkuFilter} onChange={e => setHasSkuFilter(e.target.value as any)} className={`w-36 ${inputCls}`}>
                            <option value="ALL">Tất cả SKU</option>
                            <option value="WITH_SKU">Có Mã SKU</option>
                            <option value="NO_SKU">Không Mã SKU</option>
                        </select>

                        <button onClick={loadData} disabled={loading}
                            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                )}
            </div>

            {/* ═════════════════════════════════════════════════════ */}
            {/* TAB 1: DANH SÁCH HÀNG MẪU (ITEMS)                     */}
            {/* ═════════════════════════════════════════════════════ */}
            {tab === 'ITEMS' && (
                <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 gap-3">
                            <RefreshCw size={20} className="animate-spin text-emerald-600" />
                            <span className="text-xs font-semibold text-slate-600">Đang tải tồn kho hàng mẫu...</span>
                        </div>
                    ) : products.length === 0 ? (
                        <div className="flex flex-col items-center py-16 gap-3">
                            <Wine size={36} className="text-slate-300" />
                            <p className="text-sm font-semibold text-slate-500">Chưa có sản phẩm hàng mẫu nào phù hợp bộ lọc</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold">Mã SKU</th>
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold">Tên Sản Phẩm Mẫu</th>
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-center">Nguồn Ngạch</th>
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-right">Tồn Kho Hiện Tại</th>
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-right">Giá Ước Tính</th>
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-right">Giá Trị Tồn Mẫu</th>
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-center">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {products.map(p => {
                                        const orig = ORIGIN_CFG[p.originType] || ORIGIN_CFG.CHINH_NGACH
                                        return (
                                            <tr key={p.id} className="transition-colors hover:bg-slate-50">
                                                <td className="px-3.5 py-3">
                                                    {p.skuCode ? (
                                                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            {p.skuCode}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] italic text-slate-400 font-medium">Không có SKU</span>
                                                    )}
                                                </td>
                                                <td className="px-3.5 py-3">
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900">{p.name}</p>
                                                        {p.notes && <p className="text-[10px] text-slate-400">{p.notes}</p>}
                                                    </div>
                                                </td>
                                                <td className="px-3.5 py-3 text-center">
                                                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full border"
                                                        style={{ color: orig.color, background: orig.bg, borderColor: orig.border }}>
                                                        {orig.label}
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-3 text-right">
                                                    <span className={`text-xs font-extrabold font-mono ${p.currentQty > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                        {p.currentQty.toLocaleString()} chai
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-3 text-right text-xs font-mono text-slate-600 font-medium">
                                                    {p.estimatedCost ? formatVND(p.estimatedCost) : '—'}
                                                </td>
                                                <td className="px-3.5 py-3 text-right text-xs font-bold font-mono text-teal-700">
                                                    {p.estimatedCost ? formatVND(p.currentQty * p.estimatedCost) : '—'}
                                                </td>
                                                <td className="px-3.5 py-3 text-center">
                                                    <button onClick={() => openOutboundQuick(p)}
                                                        disabled={p.currentQty <= 0}
                                                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-bold transition-all bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white cursor-pointer disabled:opacity-40">
                                                        <ArrowUpCircle size={12} /> Xuất Mẫu
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═════════════════════════════════════════════════════ */}
            {/* TAB 2: NHẬT KÝ GIAO DỊCH (TX_LOG)                    */}
            {/* ═════════════════════════════════════════════════════ */}
            {tab === 'TX_LOG' && (
                <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
                    {transactions.length === 0 ? (
                        <div className="flex flex-col items-center py-16 gap-3">
                            <History size={36} className="text-slate-300" />
                            <p className="text-sm font-semibold text-slate-500">Chưa có nhật ký giao dịch nhập/xuất mẫu nào</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[850px]">
                                <thead>
                                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold">Ngày GD</th>
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold">Loại GD</th>
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold">Sản Phẩm Mẫu</th>
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-center">Lý Do Xuất</th>
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold text-right">Số Lượng</th>
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold">Người Nhận / Yêu Cầu</th>
                                        <th className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold">Ghi Chú</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {transactions.map(tx => (
                                        <tr key={tx.id} className="transition-colors hover:bg-slate-50">
                                            <td className="px-3.5 py-3 text-xs text-slate-600 font-medium">{formatDate(tx.createdAt)}</td>
                                            <td className="px-3.5 py-3">
                                                {tx.type === 'INBOUND' ? (
                                                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        Nhập Mẫu
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                                        Xuất Mẫu
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3.5 py-3">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900">{tx.sampleProduct.name}</p>
                                                    {tx.sampleProduct.skuCode && (
                                                        <span className="text-[10px] font-mono text-emerald-700 font-bold">{tx.sampleProduct.skuCode}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3.5 py-3 text-center text-xs text-slate-600 font-medium">
                                                {tx.reason ? REASON_CFG[tx.reason] || tx.reason : '—'}
                                            </td>
                                            <td className="px-3.5 py-3 text-right">
                                                <span className={`text-xs font-extrabold font-mono ${tx.type === 'INBOUND' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {tx.type === 'INBOUND' ? `+${tx.qty}` : `-${tx.qty}`} chai
                                                </span>
                                            </td>
                                            <td className="px-3.5 py-3 text-xs text-slate-700 font-medium">
                                                {tx.recipient && <div>Nhận: {tx.recipient}</div>}
                                                {tx.requestedBy && <div className="text-[10px] text-slate-400">Yêu cầu: {tx.requestedBy}</div>}
                                                {!tx.recipient && !tx.requestedBy && <span className="text-slate-400">—</span>}
                                            </td>
                                            <td className="px-3.5 py-3 text-xs text-slate-500">{tx.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═════════════════════════════════════════════════════ */}
            {/* MODAL 1: KHAI BÁO / NHẬP HÀNG MẪU NGUYÊN LÔ           */}
            {/* ═════════════════════════════════════════════════════ */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="w-full max-w-lg p-6 rounded-2xl space-y-4 bg-white border border-slate-200 shadow-xl">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <Plus size={18} className="text-emerald-600" /> Khai Báo / Nhập Hàng Mẫu Mới
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleAddSubmit} className="space-y-3.5">
                            <div>
                                <label className="text-xs font-bold block mb-1 text-slate-700">Tên Sản Phẩm Mẫu *</label>
                                <input
                                    required
                                    placeholder="Ví dụ: Chateau Margaux 2018 (Chai mẫu thử)..."
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    className={inputCls}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold block mb-1 text-slate-700">Mã SKU (Nếu có)</label>
                                    <input
                                        placeholder="Để trống nếu không có SKU..."
                                        value={formSku}
                                        onChange={e => setFormSku(e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold block mb-1 text-slate-700">Nguồn Ngạch *</label>
                                    <select value={formOrigin} onChange={e => setFormOrigin(e.target.value as any)} className={inputCls}>
                                        <option value="CHINH_NGACH">Chính Ngạch</option>
                                        <option value="TIEU_NGACH">Tiểu Ngạch / Xách Tay</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold block mb-1 text-slate-700">Số Lượng Ban Đầu *</label>
                                    <input
                                        type="number"
                                        min={1}
                                        required
                                        value={formInitialQty}
                                        onChange={e => setFormInitialQty(e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold block mb-1 text-slate-700">Giá Vốn Ước Tính (VND)</label>
                                    <input
                                        type="number"
                                        placeholder="Ví dụ: 1500000"
                                        value={formEstCost}
                                        onChange={e => setFormEstCost(e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold block mb-1 text-slate-700">Ghi Chú Chi Tiết</label>
                                <textarea
                                    rows={2}
                                    placeholder="Nguồn gốc mẫu, ai gửi, lưu giữ ghi chú..."
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                    className={inputCls}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button type="button" onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                                    Hủy Bỏ
                                </button>
                                <button type="submit" disabled={submittingAdd}
                                    className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs">
                                    {submittingAdd ? 'Đang lưu...' : 'Khai Báo Hàng Mẫu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════ */}
            {/* MODAL 2: XUẤT SỬ DỤNG HÀNG MẪU                       */}
            {/* ═════════════════════════════════════════════════════ */}
            {showOutboundModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="w-full max-w-lg p-6 rounded-2xl space-y-4 bg-white border border-slate-200 shadow-xl">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <ArrowUpCircle size={18} className="text-rose-600" /> Xuất Sử Dụng Hàng Mẫu (Sample Out)
                            </h3>
                            <button onClick={() => setShowOutboundModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleOutboundSubmit} className="space-y-3.5">
                            <div>
                                <label className="text-xs font-bold block mb-1 text-slate-700">Chọn Hàng Mẫu Xuất *</label>
                                {selectedProductForOutbound ? (
                                    <div className="p-3 rounded-xl flex items-center justify-between bg-slate-50 border border-slate-200">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900">{selectedProductForOutbound.name}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">Tồn khả dụng: <span className="font-bold text-emerald-600">{selectedProductForOutbound.currentQty} chai</span></p>
                                        </div>
                                        <button type="button" onClick={() => setSelectedProductForOutbound(null)} className="text-xs text-rose-600 hover:underline">
                                            Chọn lại
                                        </button>
                                    </div>
                                ) : (
                                    <select
                                        required
                                        value={outboundProductId}
                                        onChange={e => setOutboundProductId(e.target.value)}
                                        className={inputCls}>
                                        <option value="">-- Chọn mặt hàng mẫu --</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id} disabled={p.currentQty <= 0}>
                                                {p.name} {p.skuCode ? `(${p.skuCode})` : ''} - Tồn: {p.currentQty} chai
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold block mb-1 text-slate-700">Lý Do Xuất *</label>
                                    <select value={outboundReason} onChange={e => setOutboundReason(e.target.value)} className={inputCls}>
                                        <option value="TASTING">Thử Rượu (Tasting)</option>
                                        <option value="CLIENT_GIFT">Tặng Khách Hàng (Gift)</option>
                                        <option value="EVENT">Sự Kiện / Workshop</option>
                                        <option value="MARKETING">Chụp Ảnh / Marketing</option>
                                        <option value="DAMAGE">Hư Hỏng / Bể Vỡ</option>
                                        <option value="OTHER">Khác</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold block mb-1 text-slate-700">Số Lượng Xuất (Chai) *</label>
                                    <input
                                        type="number"
                                        min={1}
                                        required
                                        value={outboundQty}
                                        onChange={e => setOutboundQty(e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold block mb-1 text-slate-700">Người Nhận / Đối Tác</label>
                                    <input
                                        placeholder="Tên khách hàng, đối tác..."
                                        value={outboundRecipient}
                                        onChange={e => setOutboundRecipient(e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold block mb-1 text-slate-700">Người Yêu Cầu (NV Sales)</label>
                                    <input
                                        placeholder="Tên nhân viên yêu cầu..."
                                        value={outboundRequestedBy}
                                        onChange={e => setOutboundRequestedBy(e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold block mb-1 text-slate-700">Ghi Chú Mục Đích</label>
                                <textarea
                                    rows={2}
                                    placeholder="Nội dung sự kiện, mục đích thử rượu..."
                                    value={outboundNotes}
                                    onChange={e => setOutboundNotes(e.target.value)}
                                    className={inputCls}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button type="button" onClick={() => setShowOutboundModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                                    Hủy Bỏ
                                </button>
                                <button type="submit" disabled={submittingOutbound}
                                    className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs">
                                    {submittingOutbound ? 'Đang tạo...' : 'Xác Nhận Xuất Mẫu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
