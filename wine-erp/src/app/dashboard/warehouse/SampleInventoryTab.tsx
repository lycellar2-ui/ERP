'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Wine, Plus, ArrowUpCircle, Search, RefreshCw,
    ShieldCheck, AlertTriangle, Tag, History,
    X, Layers, TrendingDown, ClipboardCheck,
    CheckCircle2, XCircle, Clock
} from 'lucide-react'
import {
    SampleProductItem, SampleTransactionItem, SampleInventoryStats,
    getSampleProducts, getSampleTransactions, getSampleInventoryStats,
    createSampleProduct, createSampleTransaction,
    recordSampleInspection, updateSampleOrigin
} from './actions-sample'
import { formatVND, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

const ORIGIN_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    FORMAL: { label: 'Chính Ngạch', color: '#15803D', bg: '#ECFDF5', border: '#A7F3D0' },
    INFORMAL: { label: 'Tiểu Ngạch / Xách Tay', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
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
    const [transactions, setTransactions] = useState<SampleTransactionItem[]>([])
    const [stats, setStats] = useState<SampleInventoryStats | null>(null)

    // Filter states
    const [search, setSearch] = useState('')
    const [originFilter, setOriginFilter] = useState<'ALL' | 'FORMAL' | 'INFORMAL'>('ALL')
    const [inspectionFilter, setInspectionFilter] = useState<'ALL' | 'PASSED' | 'PENDING' | 'FAILED'>('ALL')
    const [hasSkuFilter, setHasSkuFilter] = useState<'ALL' | 'WITH_SKU' | 'NO_SKU'>('ALL')

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false)
    const [showOutboundModal, setShowOutboundModal] = useState(false)
    const [showInspectionModal, setShowInspectionModal] = useState(false)

    // Selection states
    const [selectedProductForOutbound, setSelectedProductForOutbound] = useState<SampleProductItem | null>(null)
    const [selectedProductForInspection, setSelectedProductForInspection] = useState<SampleProductItem | null>(null)
    const [togglingOriginId, setTogglingOriginId] = useState<string | null>(null)

    // Add Form states
    const [formName, setFormName] = useState('')
    const [formSku, setFormSku] = useState('')
    const [formOrigin, setFormOrigin] = useState<'FORMAL' | 'INFORMAL'>('FORMAL')
    const [formEstCost, setFormEstCost] = useState<number | string>('')
    const [formInitialQty, setFormInitialQty] = useState<number | string>(1)
    const [formNotes, setFormNotes] = useState('')
    const [formIsInspected, setFormIsInspected] = useState(true)
    const [submittingAdd, setSubmittingAdd] = useState(false)

    // Outbound Form states
    const [outboundProductId, setOutboundProductId] = useState('')
    const [outboundReason, setOutboundReason] = useState('TASTING')
    const [outboundQty, setOutboundQty] = useState<number | string>(1)
    const [outboundRecipient, setOutboundRecipient] = useState('')
    const [outboundRequestedBy, setOutboundRequestedBy] = useState('')
    const [outboundNotes, setOutboundNotes] = useState('')
    const [submittingOutbound, setSubmittingOutbound] = useState(false)

    // Inspection Form states
    const [inspOrigin, setInspOrigin] = useState<'FORMAL' | 'INFORMAL'>('FORMAL')
    const [inspStatus, setInspStatus] = useState<'PASSED' | 'FAILED' | 'PENDING'>('PASSED')
    const [inspCheckSeal, setInspCheckSeal] = useState(true)
    const [inspCheckLabel, setInspCheckLabel] = useState(true)
    const [inspCheckTaste, setInspCheckTaste] = useState(true)
    const [inspNotes, setInspNotes] = useState('')
    const [submittingInspection, setSubmittingInspection] = useState(false)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [prods, txs, st] = await Promise.all([
                getSampleProducts({
                    search: search || undefined,
                    originType: originFilter !== 'ALL' ? originFilter : undefined,
                    inspectionStatus: inspectionFilter !== 'ALL' ? inspectionFilter : undefined,
                    hasSku: hasSkuFilter === 'WITH_SKU' ? true : hasSkuFilter === 'NO_SKU' ? false : undefined,
                }),
                getSampleTransactions({
                    search: search || undefined,
                }),
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
    }, [search, originFilter, inspectionFilter, hasSkuFilter])

    useEffect(() => { loadData() }, [loadData])

    // ── Handle Add Submit ─────────────────────────────
    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formName.trim()) return toast.error('Vui lòng nhập tên sản phẩm mẫu')
        setSubmittingAdd(true)
        try {
            await createSampleProduct({
                productName: formName.trim(),
                skuCode: formSku.trim() || undefined,
                originType: formOrigin,
                estimatedValue: formEstCost ? Number(formEstCost) : undefined,
                initialQty: Number(formInitialQty) || 0,
                notes: formNotes.trim() || undefined,
                isInspected: formIsInspected,
            })
            toast.success('Đã khai báo hàng mẫu thành công!')
            setShowAddModal(false)
            resetAddForm()
            loadData()
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi khai báo hàng mẫu')
        } finally {
            setSubmittingAdd(false)
        }
    }

    const resetAddForm = () => {
        setFormName('')
        setFormSku('')
        setFormOrigin('FORMAL')
        setFormEstCost('')
        setFormInitialQty(1)
        setFormNotes('')
        setFormIsInspected(true)
    }

    // ── Handle Outbound Submit ────────────────────────
    const handleOutboundSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const prodId = selectedProductForOutbound?.id || outboundProductId
        if (!prodId) return toast.error('Vui lòng chọn hàng mẫu cần xuất')
        if (!outboundQty || Number(outboundQty) <= 0) return toast.error('Số lượng xuất phải lớn hơn 0')

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
            toast.success('Đã xuất sử dụng hàng mẫu thành công!')
            setShowOutboundModal(false)
            resetOutboundForm()
            loadData()
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi tạo phiếu xuất hàng mẫu')
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

    // ── Handle Inspection Modal Open & Submit ──────────
    const openInspectionModal = (prod: SampleProductItem) => {
        setSelectedProductForInspection(prod)
        setInspOrigin(prod.originType)
        setInspStatus(prod.inspectionStatus === 'FAILED' ? 'FAILED' : 'PASSED')
        setInspCheckSeal(true)
        setInspCheckLabel(true)
        setInspCheckTaste(true)
        setInspNotes(prod.cleanNotes || '')
        setShowInspectionModal(true)
    }

    const handleInspectionSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProductForInspection) return
        setSubmittingInspection(true)
        try {
            const checks: string[] = []
            if (inspCheckSeal) checks.push('Seal nắp nguyên vẹn')
            if (inspCheckLabel) checks.push('Nhãn mác chai rõ ràng')
            if (inspCheckTaste) checks.push('Cảm quan/Thử nếm đạt')

            const checkSummary = checks.length > 0 ? `Tiêu chí: ${checks.join(', ')}` : ''
            const finalNote = [checkSummary, inspNotes.trim()].filter(Boolean).join(' - ')

            await recordSampleInspection({
                sampleProductId: selectedProductForInspection.id,
                originType: inspOrigin,
                inspectionStatus: inspStatus,
                notes: finalNote,
            })

            toast.success(`Đã lưu kết quả kiểm tra mẫu (${inspStatus === 'PASSED' ? 'Đạt chuẩn' : 'Chưa đạt'})`)
            setShowInspectionModal(false)
            loadData()
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi lưu kết quả kiểm tra mẫu')
        } finally {
            setSubmittingInspection(false)
        }
    }

    // ── Handle Quick Toggle Origin ────────────────────
    const handleQuickToggleOrigin = async (prod: SampleProductItem) => {
        const nextOrigin = prod.originType === 'FORMAL' ? 'INFORMAL' : 'FORMAL'
        setTogglingOriginId(prod.id)
        try {
            await updateSampleOrigin(prod.id, nextOrigin)
            toast.success(`Đã cập nhật nguồn: ${nextOrigin === 'FORMAL' ? 'Chính Ngạch' : 'Tiểu Ngạch / Xách Tay'}`)
            loadData()
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi cập nhật nguồn hàng')
        } finally {
            setTogglingOriginId(null)
        }
    }

    const inputCls = "px-3 py-2 rounded-lg text-sm outline-none transition-colors w-full bg-white border border-slate-200 text-slate-900 focus:border-emerald-500 shadow-2xs"

    return (
        <div className="space-y-4 pb-6">
            {/* TOP HEADER & KPI STATS */}
            <div className="p-4 sm:p-5 rounded-lg space-y-4 bg-white border border-slate-200 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                            <Wine size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900">
                                Kho & Kiểm Hàng Mẫu (Wine Sample Management)
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Quản lý phân loại Chính ngạch vs Tiểu ngạch — Kiểm tra nghiệm thu chất lượng & xuất dùng mẫu
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs cursor-pointer active:scale-95">
                            <Plus size={14} className="text-slate-500" /> Khai Báo / Nhập Mẫu
                        </button>
                        <button onClick={() => { setSelectedProductForOutbound(null); setShowOutboundModal(true) }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer active:scale-95">
                            <ArrowUpCircle size={15} /> Xuất Sử Dụng Mẫu
                        </button>
                    </div>
                </div>

                {/* KPI Stat Cards */}
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                <span>Mặt Hàng Mẫu</span>
                                <Layers size={14} className="text-emerald-600" />
                            </div>
                            <p className="text-xl font-extrabold font-mono text-slate-900">{stats.totalProducts.toLocaleString()} SKU</p>
                            <p className="text-[10px] text-slate-500 font-medium">Tổng danh mục hàng mẫu</p>
                        </div>

                        <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-emerald-700">
                                <span>Chính Ngạch</span>
                                <ShieldCheck size={14} className="text-emerald-600" />
                            </div>
                            <p className="text-xl font-extrabold font-mono text-emerald-600">{stats.totalFormalQty.toLocaleString()} chai</p>
                            <p className="text-[10px] text-emerald-600 font-medium">Hàng mẫu nhập chính ngạch</p>
                        </div>

                        <div className="p-3.5 rounded-lg bg-amber-50/50 border border-amber-200 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-amber-700">
                                <span>Tiểu Ngạch / Xách Tay</span>
                                <AlertTriangle size={14} className="text-amber-600" />
                            </div>
                            <p className="text-xl font-extrabold font-mono text-amber-600">{stats.totalInformalQty.toLocaleString()} chai</p>
                            <p className="text-[10px] text-amber-600 font-medium">Mẫu winery gửi / xách tay</p>
                        </div>

                        <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                <span>Giá Trị Ước Tính</span>
                                <Tag size={14} className="text-teal-600" />
                            </div>
                            <p className="text-xl font-extrabold font-mono text-teal-600">{formatVND(stats.totalEstimatedValue)}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Tổng giá vốn tồn kho mẫu</p>
                        </div>

                        <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                                <span>Xuất Tháng Này</span>
                                <TrendingDown size={14} className="text-rose-600" />
                            </div>
                            <p className="text-xl font-extrabold font-mono text-rose-600">-{stats.monthlyOutboundQty.toLocaleString()} chai</p>
                            <p className="text-[10px] text-slate-500 font-medium">Thử nếm & biếu tặng</p>
                        </div>
                    </div>
                )}
            </div>

            {/* TAB SELECTOR & FILTER BAR */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 border border-slate-200">
                    <button
                        onClick={() => setTab('ITEMS')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            tab === 'ITEMS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}>
                        <Wine size={14} /> Danh Sách Tồn Kho Mẫu ({products.length})
                    </button>
                    <button
                        onClick={() => setTab('TX_LOG')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            tab === 'TX_LOG' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}>
                        <History size={14} /> Nhật Ký Giao Dịch ({transactions.length})
                    </button>
                </div>

                {tab === 'ITEMS' && (
                    <div className="flex items-center gap-2 overflow-x-auto flex-wrap sm:flex-nowrap">
                        <div className="relative min-w-[200px] flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                placeholder="Tìm mã SMP, tên mẫu..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className={`pl-9 ${inputCls}`}
                            />
                        </div>

                        {/* Filter Origin */}
                        <select value={originFilter} onChange={e => setOriginFilter(e.target.value as any)} className={`w-36 ${inputCls}`}>
                            <option value="ALL">Nguồn: Tất cả</option>
                            <option value="FORMAL">Chính Ngạch</option>
                            <option value="INFORMAL">Tiểu Ngạch</option>
                        </select>

                        {/* Filter Inspection Status */}
                        <select value={inspectionFilter} onChange={e => setInspectionFilter(e.target.value as any)} className={`w-36 ${inputCls}`}>
                            <option value="ALL">Kiểm Hàng: Tất cả</option>
                            <option value="PASSED">Đã kiểm đạt</option>
                            <option value="PENDING">Chưa kiểm tra</option>
                            <option value="FAILED">Không đạt</option>
                        </select>

                        {/* Filter SKU */}
                        <select value={hasSkuFilter} onChange={e => setHasSkuFilter(e.target.value as any)} className={`w-36 ${inputCls}`}>
                            <option value="ALL">Mã SKU: Tất cả</option>
                            <option value="WITH_SKU">Có mã SKU</option>
                            <option value="NO_SKU">Chưa có SKU</option>
                        </select>

                        <button onClick={loadData} disabled={loading}
                            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer shrink-0">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                )}
            </div>

            {/* TAB 1: DANH SÁCH HÀNG MẪU (ITEMS) */}
            {tab === 'ITEMS' && (
                <div className="rounded-lg overflow-hidden bg-white border border-slate-200 shadow-xs">
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
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold">Mã Mẫu</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold">Tên Rượu Mẫu</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold text-center">Ô Đánh Dấu Nguồn</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold text-center">Kiểm Hàng Mẫu</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold text-right">Tồn Kho</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold text-right">Giá Vốn Ước Tính</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold text-right">Tổng Giá Trị</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold text-center">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {products.map(p => {
                                        const orig = ORIGIN_CFG[p.originType] || ORIGIN_CFG.FORMAL
                                        const isFormal = p.originType === 'FORMAL'
                                        const isUpdating = togglingOriginId === p.id

                                        return (
                                            <tr key={p.id} className="transition-colors hover:bg-slate-50">
                                                <td className="px-3 py-2.5">
                                                    <span className="inline-block text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                                        {p.sampleCode}
                                                    </span>
                                                    {p.skuCode && (
                                                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                                                            SKU: {p.skuCode}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900">{p.productName}</p>
                                                        {p.cleanNotes && (
                                                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{p.cleanNotes}</p>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Ô ĐÁNH DẤU CHÍNH NGẠCH / TIỂU NGẠCH */}
                                                <td className="px-3 py-2.5 text-center">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <button
                                                            onClick={() => handleQuickToggleOrigin(p)}
                                                            disabled={isUpdating}
                                                            title="Bấm để chuyển đổi nhanh Chính ngạch / Tiểu ngạch"
                                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold transition-all cursor-pointer hover:shadow-2xs active:scale-95 ${
                                                                isFormal
                                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                                                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                                            } ${isUpdating ? 'opacity-50' : ''}`}
                                                        >
                                                            {isFormal ? (
                                                                <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                                                            ) : (
                                                                <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                                                            )}
                                                            <span>{orig.label}</span>
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* CỘT KIỂM HÀNG MẪU */}
                                                <td className="px-3 py-2.5 text-center">
                                                    {p.inspectionStatus === 'PASSED' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <CheckCircle2 size={12} className="text-emerald-600" />
                                                            <span>Đã kiểm đạt</span>
                                                            {p.inspectionDate && <span className="text-[9px] text-emerald-600 opacity-80">({p.inspectionDate})</span>}
                                                        </span>
                                                    ) : p.inspectionStatus === 'FAILED' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                            <XCircle size={12} className="text-rose-600" />
                                                            <span>Không đạt</span>
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => openInspectionModal(p)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 cursor-pointer transition-colors"
                                                        >
                                                            <Clock size={11} className="text-slate-400" />
                                                            <span>Chưa kiểm tra</span>
                                                        </button>
                                                    )}
                                                </td>

                                                <td className="px-3 py-2.5 text-right">
                                                    <span className={`text-xs font-extrabold font-mono ${p.qtyOnHand > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                        {p.qtyOnHand.toLocaleString()} chai
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-xs font-mono text-slate-600 font-medium">
                                                    {p.estimatedValue ? formatVND(p.estimatedValue) : '—'}
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-xs font-bold font-mono text-teal-700">
                                                    {p.estimatedValue ? formatVND(p.qtyOnHand * p.estimatedValue) : '—'}
                                                </td>

                                                {/* THAO TÁC */}
                                                <td className="px-3 py-2.5 text-center">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <button onClick={() => openInspectionModal(p)}
                                                            title="Kiểm tra & nghiệm thu chất lượng mẫu"
                                                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-bold transition-all bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 cursor-pointer">
                                                            <ClipboardCheck size={13} className="text-slate-500" /> Kiểm Mẫu
                                                        </button>
                                                        <button onClick={() => openOutboundQuick(p)}
                                                            disabled={p.qtyOnHand <= 0}
                                                            title="Xuất sử dụng mẫu thử nếm / biếu tặng"
                                                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-bold transition-all bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white cursor-pointer disabled:opacity-40">
                                                            <ArrowUpCircle size={13} /> Xuất
                                                        </button>
                                                    </div>
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

            {/* TAB 2: NHẬT KÝ GIAO DỊCH (TX_LOG) */}
            {tab === 'TX_LOG' && (
                <div className="rounded-lg overflow-hidden bg-white border border-slate-200 shadow-xs">
                    {transactions.length === 0 ? (
                        <div className="flex flex-col items-center py-16 gap-3">
                            <History size={36} className="text-slate-300" />
                            <p className="text-sm font-semibold text-slate-500">Chưa có nhật ký giao dịch nhập/xuất mẫu nào</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold">Ngày GD</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold">Số CT</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold">Loại GD</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold">Nguồn Mẫu</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold">Sản Phẩm Mẫu</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold text-center">Lý Do</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold text-right">Số Lượng</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold">Người Nhận / Yêu Cầu</th>
                                        <th className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold">Ghi Chú</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {transactions.map(tx => {
                                        const orig = ORIGIN_CFG[tx.originType] || ORIGIN_CFG.FORMAL
                                        return (
                                            <tr key={tx.id} className="transition-colors hover:bg-slate-50">
                                                <td className="px-3 py-2.5 text-xs text-slate-600 font-medium">{formatDate(tx.performedAt)}</td>
                                                <td className="px-3 py-2.5 text-xs font-mono font-bold text-emerald-700">{tx.docNo}</td>
                                                <td className="px-3 py-2.5">
                                                    {tx.type === 'INBOUND' ? (
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                                            Nhập Mẫu
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                                                            Xuất Mẫu
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap"
                                                        style={{ color: orig.color, background: orig.bg, borderColor: orig.border }}>
                                                        {orig.label}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900">{tx.sampleProductName}</p>
                                                        <span className="text-[10px] font-mono text-emerald-700 font-bold">{tx.sampleProductCode}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-center text-xs text-slate-600 font-medium">
                                                    {tx.reason ? REASON_CFG[tx.reason] || tx.reason : '—'}
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    <span className={`text-xs font-extrabold font-mono ${tx.type === 'INBOUND' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {tx.type === 'INBOUND' ? `+${tx.qty}` : `-${tx.qty}`} chai
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-xs text-slate-700 font-medium">
                                                    {tx.recipient && <div>Nhận: {tx.recipient}</div>}
                                                    {tx.requestedBy && <div className="text-[10px] text-slate-400">Yêu cầu: {tx.requestedBy}</div>}
                                                    {!tx.recipient && !tx.requestedBy && <span className="text-slate-400">—</span>}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs text-slate-500">{tx.notes || '—'}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL 1: KHAI BÁO / NHẬP HÀNG MẪU NGUYÊN LÔ */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="w-full max-w-lg p-5 sm:p-6 rounded-lg space-y-4 bg-white border border-slate-200 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <Plus size={18} className="text-emerald-600" /> Khai Báo / Nhập Hàng Mẫu Mới
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleAddSubmit} className="space-y-4">
                            {/* Ô ĐÁNH DẤU CHÍNH NGẠCH HAY TIỂU NGẠCH */}
                            <div>
                                <label className="text-xs font-bold block mb-1.5 text-slate-800">
                                    Nguồn Gốc Hàng Mẫu (Ô Đánh Dấu) *
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <label
                                        onClick={() => setFormOrigin('FORMAL')}
                                        className={`flex items-start gap-2.5 p-3 rounded-lg border text-left cursor-pointer transition-all ${
                                            formOrigin === 'FORMAL'
                                                ? 'bg-emerald-50/70 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500 shadow-2xs'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="formOriginOption"
                                            checked={formOrigin === 'FORMAL'}
                                            onChange={() => setFormOrigin('FORMAL')}
                                            className="accent-emerald-600 w-4 h-4 mt-0.5 cursor-pointer shrink-0"
                                        />
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <ShieldCheck size={14} className="text-emerald-700" />
                                                <span className="text-xs font-extrabold text-slate-900">Chính Ngạch</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                Nhập khẩu chính ngạch (có tờ khai Hải quan)
                                            </p>
                                        </div>
                                    </label>

                                    <label
                                        onClick={() => setFormOrigin('INFORMAL')}
                                        className={`flex items-start gap-2.5 p-3 rounded-lg border text-left cursor-pointer transition-all ${
                                            formOrigin === 'INFORMAL'
                                                ? 'bg-amber-50/70 border-amber-500 text-amber-950 ring-1 ring-amber-500 shadow-2xs'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="formOriginOption"
                                            checked={formOrigin === 'INFORMAL'}
                                            onChange={() => setFormOrigin('INFORMAL')}
                                            className="accent-amber-600 w-4 h-4 mt-0.5 cursor-pointer shrink-0"
                                        />
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <AlertTriangle size={14} className="text-amber-700" />
                                                <span className="text-xs font-extrabold text-slate-900">Tiểu Ngạch / Xách Tay</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                Hàng winery gửi thử, xách tay (chỉ dùng nội bộ & tasting)
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold block mb-1 text-slate-700">Tên Rượu Mẫu *</label>
                                <input
                                    required
                                    placeholder="Ví dụ: Chateau Margaux 2018 (Chai mẫu thử)..."
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    className={inputCls}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold block mb-1 text-slate-700">Mã SKU (Nếu có)</label>
                                    <input
                                        placeholder="Để trống nếu chưa có SKU..."
                                        value={formSku}
                                        onChange={e => setFormSku(e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold block mb-1 text-slate-700">Số Lượng Ban Đầu (Chai) *</label>
                                    <input
                                        type="number"
                                        min={1}
                                        required
                                        value={formInitialQty}
                                        onChange={e => setFormInitialQty(e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold block mb-1 text-slate-700">Giá Vốn Ước Tính (VND/Chai)</label>
                                <input
                                    type="number"
                                    placeholder="Ví dụ: 1500000"
                                    value={formEstCost}
                                    onChange={e => setFormEstCost(e.target.value)}
                                    className={inputCls}
                                />
                            </div>

                            {/* Ô ĐÁNH DẤU KIỂM HÀNG KHI NHẬP */}
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={formIsInspected}
                                        onChange={e => setFormIsInspected(e.target.checked)}
                                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                    />
                                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                        <ClipboardCheck size={14} className="text-emerald-600" />
                                        <span>Đã kiểm hàng & nghiệm thu chất lượng mẫu khi nhập kho</span>
                                    </div>
                                </label>
                                <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                                    Tự động gắn cờ Đã kiểm đạt (Passed) cho lô mẫu nhập lần này
                                </p>
                            </div>

                            <div>
                                <label className="text-xs font-bold block mb-1 text-slate-700">Ghi Chú Nguồn Gốc / Lô Hàng</label>
                                <textarea
                                    rows={2}
                                    placeholder="Winery gửi kèm đơn hàng, ai bàn giao, tình trạng chai..."
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                    className={inputCls}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button type="button" onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                                    Hủy Bỏ
                                </button>
                                <button type="submit" disabled={submittingAdd}
                                    className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs">
                                    {submittingAdd ? 'Đang lưu...' : 'Khai Báo Hàng Mẫu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: KIỂM TRA & NGHIỆM THU HÀNG MẪU */}
            {showInspectionModal && selectedProductForInspection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="w-full max-w-lg p-5 sm:p-6 rounded-lg space-y-4 bg-white border border-slate-200 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <ClipboardCheck size={18} className="text-emerald-600" /> Kiểm Tra & Nghiệm Thu Hàng Mẫu
                            </h3>
                            <button onClick={() => setShowInspectionModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Thông tin mẫu đang kiểm */}
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-bold text-emerald-700 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                                    {selectedProductForInspection.sampleCode}
                                </span>
                                <span className="text-xs font-bold text-slate-600">
                                    Tồn: <span className="text-emerald-600 font-mono">{selectedProductForInspection.qtyOnHand}</span> chai
                                </span>
                            </div>
                            <p className="text-sm font-extrabold text-slate-900">{selectedProductForInspection.productName}</p>
                        </div>

                        <form onSubmit={handleInspectionSubmit} className="space-y-4">
                            {/* Ô ĐÁNH DẤU CHÍNH NGẠCH HAY TIỂU NGẠCH TRONG MODAL KIỂM */}
                            <div>
                                <label className="text-xs font-bold block mb-1.5 text-slate-800">
                                    Phân Loại Nguồn Hàng (Ô Đánh Dấu) *
                                </label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <label
                                        onClick={() => setInspOrigin('FORMAL')}
                                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                                            inspOrigin === 'FORMAL'
                                                ? 'bg-emerald-50/70 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500 shadow-2xs'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="inspOriginOption"
                                            checked={inspOrigin === 'FORMAL'}
                                            onChange={() => setInspOrigin('FORMAL')}
                                            className="accent-emerald-600 w-4 h-4 cursor-pointer shrink-0"
                                        />
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                                                <ShieldCheck size={13} className="text-emerald-700" /> Chính Ngạch
                                            </p>
                                            <p className="text-[10px] text-slate-500">Tờ khai Hải quan</p>
                                        </div>
                                    </label>

                                    <label
                                        onClick={() => setInspOrigin('INFORMAL')}
                                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                                            inspOrigin === 'INFORMAL'
                                                ? 'bg-amber-50/70 border-amber-500 text-amber-950 ring-1 ring-amber-500 shadow-2xs'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="inspOriginOption"
                                            checked={inspOrigin === 'INFORMAL'}
                                            onChange={() => setInspOrigin('INFORMAL')}
                                            className="accent-amber-600 w-4 h-4 cursor-pointer shrink-0"
                                        />
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                                                <AlertTriangle size={13} className="text-amber-700" /> Tiểu Ngạch
                                            </p>
                                            <p className="text-[10px] text-slate-500">Winery tặng, xách tay</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* CHECKLIST KIỂM TRA MẪU */}
                            <div className="space-y-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                                <p className="text-xs font-bold text-slate-800">Tiêu Chí Kiểm Tra Ngoại Quan & Cảm Quan</p>
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={inspCheckSeal}
                                            onChange={e => setInspCheckSeal(e.target.checked)}
                                            className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                        />
                                        <span>Nút bần & seal nắp chai nguyên vẹn, không nứt mẻ, không rò rỉ</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={inspCheckLabel}
                                            onChange={e => setInspCheckLabel(e.target.checked)}
                                            className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                        />
                                        <span>
                                            Nhãn mác chai nguyên vẹn, thông tin niên vụ & xuất xứ rõ ràng
                                        </span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={inspCheckTaste}
                                            onChange={e => setInspCheckTaste(e.target.checked)}
                                            className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                        />
                                        <span>Cảm quan màu sắc, độ trong & chất lượng rượu đạt chuẩn (Tasting QC)</span>
                                    </label>
                                </div>
                            </div>

                            {/* KẾT QUẢ NGHIỆM THU */}
                            <div>
                                <label className="text-xs font-bold block mb-1.5 text-slate-800">Kết Luận Nghiệm Thu *</label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <label
                                        onClick={() => setInspStatus('PASSED')}
                                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                                            inspStatus === 'PASSED'
                                                ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="inspStatusOption"
                                            checked={inspStatus === 'PASSED'}
                                            onChange={() => setInspStatus('PASSED')}
                                            className="accent-emerald-600 w-4 h-4 cursor-pointer"
                                        />
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle2 size={15} className="text-emerald-600" />
                                            <span className="text-xs font-bold">Đạt Chuẩn (Passed)</span>
                                        </div>
                                    </label>

                                    <label
                                        onClick={() => setInspStatus('FAILED')}
                                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                                            inspStatus === 'FAILED'
                                                ? 'bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="inspStatusOption"
                                            checked={inspStatus === 'FAILED'}
                                            onChange={() => setInspStatus('FAILED')}
                                            className="accent-rose-600 w-4 h-4 cursor-pointer"
                                        />
                                        <div className="flex items-center gap-1.5">
                                            <XCircle size={15} className="text-rose-600" />
                                            <span className="text-xs font-bold">Không Đạt / Hỏng</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold block mb-1 text-slate-700">Ghi Chú Đánh Giá / Chi Tiết Kiểm Tra</label>
                                <textarea
                                    rows={2}
                                    placeholder="Nhận xét ngoại quan chai, thử nếm, ghi chú kiểm định..."
                                    value={inspNotes}
                                    onChange={e => setInspNotes(e.target.value)}
                                    className={inputCls}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button type="button" onClick={() => setShowInspectionModal(false)}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                                    Hủy Bỏ
                                </button>
                                <button type="submit" disabled={submittingInspection}
                                    className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs">
                                    {submittingInspection ? 'Đang lưu...' : 'Lưu Kết Quả Kiểm Tra'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: XUẤT SỬ DỤNG HÀNG MẪU */}
            {showOutboundModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="w-full max-w-lg p-5 sm:p-6 rounded-lg space-y-4 bg-white border border-slate-200 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                <ArrowUpCircle size={18} className="text-rose-600" /> Xuất Sử Dụng Hàng Mẫu (Sample Out)
                            </h3>
                            <button onClick={() => setShowOutboundModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleOutboundSubmit} className="space-y-3.5">
                            <div>
                                <label className="text-xs font-bold block mb-1 text-slate-700">Chọn Hàng Mẫu Xuất *</label>
                                {selectedProductForOutbound ? (
                                    <div className="p-3 rounded-lg flex items-center justify-between bg-slate-50 border border-slate-200">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900">{selectedProductForOutbound.productName}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">Tồn khả dụng: <span className="font-bold text-emerald-600">{selectedProductForOutbound.qtyOnHand} chai</span></p>
                                        </div>
                                        <button type="button" onClick={() => setSelectedProductForOutbound(null)} className="text-xs text-rose-600 hover:underline cursor-pointer">
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
                                            <option key={p.id} value={p.id} disabled={p.qtyOnHand <= 0}>
                                                {p.productName} ({p.sampleCode}) - Tồn: {p.qtyOnHand} chai [{p.originType === 'FORMAL' ? 'Chính ngạch' : 'Tiểu ngạch'}]
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                                    Hủy Bỏ
                                </button>
                                <button type="submit" disabled={submittingOutbound}
                                    className="px-5 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs">
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
