'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Wine, Package, ArrowDownCircle, ArrowUpCircle, Search, Filter,
    Plus, Download, RefreshCw, FileText, CheckCircle2, AlertCircle,
    User, Calendar, Layers, ShieldCheck, Gift, Camera, Microscope, Trash2, X, Loader2
} from 'lucide-react'
import {
    SampleProductItem, SampleInventoryStats, SampleTransactionItem,
    getSampleProducts, getSampleInventoryStats, createSampleProduct,
    createSampleTransaction, getSampleTransactions
} from './actions-sample'
import { getProductSearchOptions, ProductOption } from './actions-nxt'
import { formatVND, formatDate } from '@/lib/utils'

const REASON_LABELS: Record<string, { label: string; icon: any; color: string }> = {
    SUPPLIER_SAMPLE: { label: 'Mẫu Winery Gửi', icon: Wine, color: '#87CBB9' },
    FORMAL_IMPORT: { label: 'Nhập Chính Ngạch', icon: ShieldCheck, color: '#5BA88A' },
    TASTING: { label: 'Thử Rượu / Sommelier', icon: Wine, color: '#D4A853' },
    CUSTOMER_GIFT: { label: 'Tặng Khách VIP', icon: Gift, color: '#E5989B' },
    MARKETING_MEDIA: { label: 'Marketing / Media', icon: Camera, color: '#4A8FAB' },
    QUALITY_TESTING: { label: 'Kiểm Định Chất Lượng', icon: Microscope, color: '#A06CD5' },
    DAMAGE_LOSS: { label: 'Hỏng / Vỡ / Hủy Mẫu', icon: Trash2, color: '#C74B50' },
    OTHER: { label: 'Mục Đích Khác', icon: FileText, color: '#8AAEBB' },
}

export function SampleInventoryTab() {
    const [subTab, setSubTab] = useState<'INVENTORY' | 'TRANSACTIONS'>('INVENTORY')

    // ── Filters State ────────────────────────────────
    const [search, setSearch] = useState('')
    const [originType, setOriginType] = useState('ALL')
    const [skuFilter, setSkuFilter] = useState<'ALL' | 'HAS_SKU' | 'NO_SKU'>('ALL')
    const [hideZeroStock, setHideZeroStock] = useState(false)

    // ── Data States ──────────────────────────────────
    const [products, setProducts] = useState<SampleProductItem[]>([])
    const [stats, setStats] = useState<SampleInventoryStats | null>(null)
    const [transactions, setTransactions] = useState<SampleTransactionItem[]>([])
    const [loading, setLoading] = useState(false)

    // ── Modal States ─────────────────────────────────
    const [showAddModal, setShowAddModal] = useState(false)
    const [showOutboundModal, setShowOutboundModal] = useState(false)
    const [selectedProductForOutbound, setSelectedProductForOutbound] = useState<SampleProductItem | null>(null)

    // Add Form State
    const [useExistingSku, setUseExistingSku] = useState(false)
    const [skuSearchTerm, setSkuSearchTerm] = useState('')
    const [skuOptions, setSkuOptions] = useState<ProductOption[]>([])
    const [selectedSkuProduct, setSelectedSkuProduct] = useState<ProductOption | null>(null)

    const [formProductName, setFormProductName] = useState('')
    const [formWineType, setFormWineType] = useState('Rượu Đỏ')
    const [formVintage, setFormVintage] = useState<number | ''>('')
    const [formCountry, setFormCountry] = useState('Pháp')
    const [formProducer, setFormProducer] = useState('')
    const [formOriginType, setFormOriginType] = useState<'FORMAL' | 'INFORMAL'>('INFORMAL')
    const [formEstimatedValue, setFormEstimatedValue] = useState<number | ''>('')
    const [formInitialQty, setFormInitialQty] = useState<number | ''>(1)
    const [formNotes, setFormNotes] = useState('')
    const [submittingAdd, setSubmittingAdd] = useState(false)

    // Outbound Form State
    const [outboundProductId, setOutboundProductId] = useState('')
    const [outboundReason, setOutboundReason] = useState<string>('TASTING')
    const [outboundQty, setOutboundQty] = useState<number | ''>(1)
    const [outboundRecipient, setOutboundRecipient] = useState('')
    const [outboundRequestedBy, setOutboundRequestedBy] = useState('')
    const [outboundNotes, setOutboundNotes] = useState('')
    const [submittingOutbound, setSubmittingOutbound] = useState(false)

    // ── Load Inventory Data ──────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const hasSku = skuFilter === 'HAS_SKU' ? true : skuFilter === 'NO_SKU' ? false : undefined
            const [prodsRes, statsRes, txsRes] = await Promise.all([
                getSampleProducts({ search, originType, hasSku, hideZeroStock }),
                getSampleInventoryStats(),
                getSampleTransactions({ search }),
            ])
            setProducts(prodsRes)
            setStats(statsRes)
            setTransactions(txsRes)
        } finally {
            setLoading(false)
        }
    }, [search, originType, skuFilter, hideZeroStock])

    useEffect(() => {
        loadData()
    }, [loadData])

    // ── SKU Search Debounce ──────────────────────────
    useEffect(() => {
        if (!useExistingSku || skuSearchTerm.length < 2) {
            setSkuOptions([])
            return
        }
        const timer = setTimeout(async () => {
            const results = await getProductSearchOptions(skuSearchTerm)
            setSkuOptions(results)
        }, 300)
        return () => clearTimeout(timer)
    }, [useExistingSku, skuSearchTerm])

    // ── Handle Add Sample Submit ──────────────────────
    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const name = useExistingSku ? selectedSkuProduct?.productName : formProductName
        if (!name) return alert('Vui lòng nhập tên rượu mẫu')

        setSubmittingAdd(true)
        try {
            await createSampleProduct({
                productId: useExistingSku ? selectedSkuProduct?.id : undefined,
                productName: name,
                wineType: formWineType,
                vintage: formVintage ? Number(formVintage) : undefined,
                country: formCountry,
                producer: formProducer,
                originType: formOriginType,
                estimatedValue: formEstimatedValue ? Number(formEstimatedValue) : 0,
                initialQty: formInitialQty ? Number(formInitialQty) : 0,
                notes: formNotes,
            })
            setShowAddModal(false)
            resetAddForm()
            loadData()
        } catch (err: any) {
            alert(err.message || 'Lỗi khi tạo hàng mẫu')
        } finally {
            setSubmittingAdd(false)
        }
    }

    const resetAddForm = () => {
        setUseExistingSku(false)
        setSkuSearchTerm('')
        setSelectedSkuProduct(null)
        setFormProductName('')
        setFormWineType('Rượu Đỏ')
        setFormVintage('')
        setFormCountry('Pháp')
        setFormProducer('')
        setFormOriginType('INFORMAL')
        setFormEstimatedValue('')
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

    const inputCls = "px-3 py-2 rounded-lg text-sm outline-none transition-colors w-full"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    return (
        <div className="space-y-5">
            {/* ═════════════════════════════════════════════════════ */}
            {/* TOP HEADER & ACTION BAR                              */}
            {/* ═════════════════════════════════════════════════════ */}
            <div className="p-4 sm:p-5 rounded-2xl space-y-4" style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3" style={{ borderBottom: '1px solid rgba(42,67,85,0.6)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853' }}>
                            <Wine size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold" style={{ color: '#E8F1F2' }}>
                                Quản Lý Tồn Kho Hàng Mẫu (Sample Wine)
                            </h3>
                            <p className="text-xs" style={{ color: '#8AAEBB' }}>
                                Kho riêng biệt không dùng bán hàng — Theo dõi nguồn ngạch & giao dịch xuất mẫu
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            <Plus size={14} /> Khai Báo / Nhập Mẫu
                        </button>
                        <button onClick={() => { setSelectedProductForOutbound(null); setShowOutboundModal(true) }}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
                            style={{ background: 'rgba(229,152,155,0.2)', color: '#E5989B', border: '1px solid rgba(229,152,155,0.3)' }}>
                            <ArrowUpCircle size={14} /> Xuất Sử Dụng Mẫu
                        </button>
                    </div>
                </div>

                {/* KPI Stat Cards */}
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="p-3 rounded-xl space-y-1" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>
                                <span>Mặt Hàng Mẫu</span>
                                <Layers size={14} style={{ color: '#87CBB9' }} />
                            </div>
                            <p className="text-lg font-bold font-mono" style={{ color: '#E8F1F2' }}>{stats.totalProducts.toLocaleString()} SKU</p>
                        </div>

                        <div className="p-3 rounded-xl space-y-1" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>
                                <span>Chính Ngạch</span>
                                <ShieldCheck size={14} style={{ color: '#5BA88A' }} />
                            </div>
                            <p className="text-lg font-bold font-mono" style={{ color: '#5BA88A' }}>{stats.totalFormalQty.toLocaleString()} chai</p>
                        </div>

                        <div className="p-3 rounded-xl space-y-1" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>
                                <span>Tiểu Ngạch / Xách Tay</span>
                                <Wine size={14} style={{ color: '#D4A853' }} />
                            </div>
                            <p className="text-lg font-bold font-mono" style={{ color: '#D4A853' }}>{stats.totalInformalQty.toLocaleString()} chai</p>
                        </div>

                        <div className="p-3 rounded-xl space-y-1" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>
                                <span>Tổng Giá Trị Ước Tính</span>
                                <Package size={14} style={{ color: '#87CBB9' }} />
                            </div>
                            <p className="text-lg font-bold font-mono truncate" style={{ color: '#87CBB9' }}>{formatVND(stats.totalEstimatedValue)}</p>
                        </div>

                        <div className="p-3 rounded-xl space-y-1" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center justify-between text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>
                                <span>Xuất Mẫu Tháng Này</span>
                                <ArrowUpCircle size={14} style={{ color: '#E5989B' }} />
                            </div>
                            <p className="text-lg font-bold font-mono" style={{ color: '#E5989B' }}>{stats.monthlyOutboundQty.toLocaleString()} chai</p>
                        </div>
                    </div>
                )}

                {/* Sub Tab Switcher & Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2 p-1 rounded-xl" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        <button onClick={() => setSubTab('INVENTORY')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subTab === 'INVENTORY' ? 'bg-[#87CBB9] text-[#0A1926]' : 'text-[#8AAEBB]'}`}>
                            📦 Danh Mục Tồn Kho ({products.length})
                        </button>
                        <button onClick={() => setSubTab('TRANSACTIONS')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subTab === 'TRANSACTIONS' ? 'bg-[#87CBB9] text-[#0A1926]' : 'text-[#8AAEBB]'}`}>
                            📜 Lịch Sử Giao Dịch ({transactions.length})
                        </button>
                    </div>

                    {/* Filter controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[200px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                            <input
                                placeholder="Tìm tên rượu, mã mẫu, SKU..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className={`pl-9 py-1.5 text-xs ${inputCls}`}
                                style={inputStyle}
                            />
                        </div>

                        {subTab === 'INVENTORY' && (
                            <>
                                <select value={originType} onChange={e => setOriginType(e.target.value)}
                                    className="py-1.5 text-xs rounded-lg outline-none px-2" style={{ ...inputStyle, width: 'auto' }}>
                                    <option value="ALL">Tất cả nguồn ngạch</option>
                                    <option value="FORMAL">Chính ngạch</option>
                                    <option value="INFORMAL">Tiểu ngạch / Xách tay</option>
                                </select>

                                <select value={skuFilter} onChange={e => setSkuFilter(e.target.value as any)}
                                    className="py-1.5 text-xs rounded-lg outline-none px-2" style={{ ...inputStyle, width: 'auto' }}>
                                    <option value="ALL">Tất cả mã SKU</option>
                                    <option value="HAS_SKU">Đã có SKU</option>
                                    <option value="NO_SKU">Chưa có SKU</option>
                                </select>

                                <button onClick={loadData} disabled={loading}
                                    className="p-1.5 rounded-lg text-xs flex items-center justify-center"
                                    style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════ */}
            {/* SUB TAB 1: DANH MỤC TỒN KHO HÀNG MẪU                 */}
            {/* ═════════════════════════════════════════════════════ */}
            {subTab === 'INVENTORY' && (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                    {loading ? (
                        <div className="flex items-center justify-center py-20 gap-3">
                            <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                            <span className="text-sm font-medium" style={{ color: '#8AAEBB' }}>Đang nạp kho hàng mẫu...</span>
                        </div>
                    ) : products.length === 0 ? (
                        <div className="flex flex-col items-center py-16 gap-3">
                            <Wine size={36} style={{ color: '#2A4355' }} />
                            <p className="text-sm font-medium" style={{ color: '#4A6A7A' }}>Chưa có hàng mẫu nào trong kho</p>
                            <button onClick={() => setShowAddModal(true)} className="text-xs underline" style={{ color: '#87CBB9' }}>
                                + Nhấp vào đây để thêm mẫu mới
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                            <table className="w-full text-left border-collapse min-w-[950px]">
                                <thead>
                                    <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355', position: 'sticky', top: 0, zIndex: 10 }}>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>Mã Mẫu</th>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>Tên Rượu Mẫu</th>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>Nguồn Ngạch</th>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>Mã SKU Hệ Thống</th>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-right" style={{ color: '#87CBB9' }}>Tồn Kho Mẫu</th>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-right" style={{ color: '#4A6A7A' }}>Giá Trị Ước Tính</th>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-center" style={{ color: '#4A6A7A' }}>Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map(item => (
                                        <tr key={item.id} className="transition-colors hover:bg-[#142433]" style={{ borderBottom: '1px solid rgba(42,67,85,0.4)' }}>
                                            <td className="px-3 py-3">
                                                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded"
                                                    style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)' }}>
                                                    {item.sampleCode}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold" style={{ color: '#E8F1F2' }}>{item.productName}</p>
                                                    <p className="text-[10px]" style={{ color: '#8AAEBB' }}>
                                                        {item.wineType || 'Rượu'} {item.vintage ? `· Niên vụ ${item.vintage}` : ''} {item.country ? `· ${item.country}` : ''} {item.producer ? `(${item.producer})` : ''}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                {item.originType === 'FORMAL' ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                        style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                                        <ShieldCheck size={10} /> Chính Ngạch
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                        style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)' }}>
                                                        <Wine size={10} /> Tiểu Ngạch / Xách Tay
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                {item.skuCode ? (
                                                    <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: '#1B2E3D', color: '#87CBB9' }}>
                                                        {item.skuCode}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs italic" style={{ color: '#4A6A7A' }}>— Chưa có SKU</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className="text-sm font-bold font-mono" style={{ color: item.qtyOnHand > 0 ? '#87CBB9' : '#C74B50' }}>
                                                    {item.qtyOnHand.toLocaleString()} {item.unit}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-right text-xs font-mono" style={{ color: '#8AAEBB' }}>
                                                {formatVND(item.estimatedValue)}
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <button
                                                    onClick={() => openOutboundQuick(item)}
                                                    disabled={item.qtyOnHand <= 0}
                                                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-all hover:bg-[#E5989B] hover:text-[#0A1926] disabled:opacity-30 disabled:pointer-events-none"
                                                    style={{ background: 'rgba(229,152,155,0.15)', color: '#E5989B', border: '1px solid rgba(229,152,155,0.3)' }}>
                                                    <ArrowUpCircle size={12} /> Xuất Mẫu
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═════════════════════════════════════════════════════ */}
            {/* SUB TAB 2: LỊCH SỬ GIAO DỊCH NHẬP XUẤT                */}
            {/* ═════════════════════════════════════════════════════ */}
            {subTab === 'TRANSACTIONS' && (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                    <div className="p-3 bg-[#142433]" style={{ borderBottom: '1px solid #2A4355' }}>
                        <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8AAEBB' }}>
                            Nhật Ký Nhập Kho & Xuất Sử Dụng Hàng Mẫu ({transactions.length} chứng từ)
                        </h4>
                    </div>

                    {transactions.length === 0 ? (
                        <div className="flex flex-col items-center py-16 gap-3">
                            <FileText size={36} style={{ color: '#2A4355' }} />
                            <p className="text-sm font-medium" style={{ color: '#4A6A7A' }}>Chưa có giao dịch nhập/xuất mẫu nào</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead>
                                    <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355', position: 'sticky', top: 0, zIndex: 10 }}>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>Ngày Thực Hiện</th>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>Số Chứng Từ</th>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>Tên Rượu Mẫu</th>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>Loại & Mục Đích</th>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-center" style={{ color: '#4A6A7A' }}>Số Lượng</th>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>Người/Đối Tác Nhận</th>
                                        <th className="px-3 py-3 text-[11px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>Nhân Viên Đề Xuất</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map(tx => {
                                        const reasonCfg = REASON_LABELS[tx.reason] || { label: tx.reason, icon: FileText, color: '#8AAEBB' }
                                        const Icon = reasonCfg.icon
                                        return (
                                            <tr key={tx.id} className="transition-colors hover:bg-[#142433]" style={{ borderBottom: '1px solid rgba(42,67,85,0.4)' }}>
                                                <td className="px-3 py-3 text-xs" style={{ color: '#8AAEBB' }}>{formatDate(tx.performedAt)}</td>
                                                <td className="px-3 py-3 text-xs font-bold font-mono" style={{ color: tx.type === 'INBOUND' ? '#5BA88A' : '#E5989B' }}>
                                                    {tx.docNo}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <p className="text-xs font-semibold" style={{ color: '#E8F1F2' }}>{tx.sampleProductName}</p>
                                                    <p className="text-[10px] font-mono" style={{ color: '#D4A853' }}>{tx.sampleProductCode}</p>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                        style={{ color: reasonCfg.color, background: `${reasonCfg.color}15` }}>
                                                        <Icon size={10} /> {reasonCfg.label}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    {tx.type === 'INBOUND' ? (
                                                        <span className="text-xs font-bold font-mono" style={{ color: '#5BA88A' }}>+{tx.qty}</span>
                                                    ) : (
                                                        <span className="text-xs font-bold font-mono" style={{ color: '#E5989B' }}>-{tx.qty}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-xs" style={{ color: '#E8F1F2' }}>{tx.recipient || '—'}</td>
                                                <td className="px-3 py-3 text-xs" style={{ color: '#8AAEBB' }}>{tx.requestedBy || '—'}</td>
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
            {/* MODAL 1: KHAI BÁO / NHẬP HÀNG MẪU MỚI                 */}
            {/* ═════════════════════════════════════════════════════ */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl space-y-4 p-6 overflow-y-auto max-h-[90vh]"
                        style={{ background: '#0D1E2B', border: '1px solid #2A4355', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
                        <div className="flex items-center justify-between pb-3 border-b border-[#2A4355]">
                            <h3 className="text-base font-bold flex items-center gap-2" style={{ color: '#E8F1F2' }}>
                                <Plus size={18} style={{ color: '#87CBB9' }} /> Khai Báo & Nhập Hàng Mẫu Mới
                            </h3>
                            <button onClick={() => setShowAddModal(false)} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleAddSubmit} className="space-y-4">
                            {/* Toggle SKU source */}
                            <div className="p-3 rounded-xl flex items-center justify-between text-xs" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                <span>Loại mẫu:</span>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setUseExistingSku(false)}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${!useExistingSku ? 'bg-[#87CBB9] text-[#0A1926]' : 'text-[#8AAEBB]'}`}>
                                        Chưa Có SKU (Tự Nhập)
                                    </button>
                                    <button type="button" onClick={() => setUseExistingSku(true)}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${useExistingSku ? 'bg-[#87CBB9] text-[#0A1926]' : 'text-[#8AAEBB]'}`}>
                                        Đã Có SKU Hệ Thống
                                    </button>
                                </div>
                            </div>

                            {/* If Existing SKU */}
                            {useExistingSku ? (
                                <div className="space-y-1 relative">
                                    <label className="text-[10px] uppercase tracking-wider font-bold block" style={{ color: '#4A6A7A' }}>
                                        Tìm & Chọn SKU Sản Phẩm Thương Mại
                                    </label>
                                    {selectedSkuProduct ? (
                                        <div className="flex items-center justify-between p-2.5 rounded-lg border" style={{ background: 'rgba(135,203,185,0.1)', borderColor: '#87CBB9' }}>
                                            <div>
                                                <span className="text-xs font-mono font-bold" style={{ color: '#87CBB9' }}>{selectedSkuProduct.skuCode}</span>
                                                <p className="text-xs" style={{ color: '#E8F1F2' }}>{selectedSkuProduct.productName}</p>
                                            </div>
                                            <button type="button" onClick={() => setSelectedSkuProduct(null)} style={{ color: '#4A6A7A' }}><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <input
                                                placeholder="Gõ mã SKU hoặc tên rượu..."
                                                value={skuSearchTerm}
                                                onChange={e => setSkuSearchTerm(e.target.value)}
                                                className={inputCls}
                                                style={inputStyle}
                                            />
                                            {skuOptions.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl z-50 max-h-48 overflow-y-auto"
                                                    style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                                    {skuOptions.map(opt => (
                                                        <button key={opt.id} type="button" onClick={() => { setSelectedSkuProduct(opt); setSkuSearchTerm('') }}
                                                            className="w-full text-left p-2.5 hover:bg-white/10 text-xs border-b border-[#2A4355] flex justify-between">
                                                            <span className="font-bold font-mono" style={{ color: '#87CBB9' }}>{opt.skuCode}</span>
                                                            <span className="truncate flex-1 ml-2" style={{ color: '#E8F1F2' }}>{opt.productName}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Free Text Product Name */
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider font-bold block" style={{ color: '#4A6A7A' }}>
                                        Tên Rượu Mẫu (Tự Nhập) *
                                    </label>
                                    <input
                                        placeholder="Ví dụ: Château Margaux 2018 (Hàng Winery Gửi Thử)"
                                        value={formProductName}
                                        onChange={e => setFormProductName(e.target.value)}
                                        className={inputCls}
                                        style={inputStyle}
                                        required
                                    />
                                </div>
                            )}

                            {/* Origin Type */}
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider font-bold block" style={{ color: '#4A6A7A' }}>
                                    Hình Thức Nguồn Ngạch *
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => setFormOriginType('INFORMAL')}
                                        className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 ${formOriginType === 'INFORMAL' ? 'border-[#D4A853] bg-[rgba(212,168,83,0.15)] text-[#D4A853]' : 'border-[#2A4355] text-[#8AAEBB]'}`}>
                                        <Wine size={16} />
                                        <div>
                                            <p>Tiểu Ngạch / Xách Tay</p>
                                            <p className="text-[9px] font-normal opacity-70">Winery gửi thử / Quà tặng</p>
                                        </div>
                                    </button>
                                    <button type="button" onClick={() => setFormOriginType('FORMAL')}
                                        className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 ${formOriginType === 'FORMAL' ? 'border-[#5BA88A] bg-[rgba(91,168,138,0.15)] text-[#5BA88A]' : 'border-[#2A4355] text-[#8AAEBB]'}`}>
                                        <ShieldCheck size={16} />
                                        <div>
                                            <p>Chính Ngạch</p>
                                            <p className="text-[9px] font-normal opacity-70">Có tờ khai Hải quan</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Wine info grid */}
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Loại Rượu</label>
                                    <select value={formWineType} onChange={e => setFormWineType(e.target.value)} className={inputCls} style={inputStyle}>
                                        <option value="Rượu Đỏ">Rượu Đỏ</option>
                                        <option value="Rượu Trắng">Rượu Trắng</option>
                                        <option value="Rượu Hồng">Rượu Hồng</option>
                                        <option value="Sâm Panh / Vang Sủi">Sâm Panh / Vang Sủi</option>
                                        <option value="Rượu Ngọt / Fortified">Rượu Ngọt</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Niên Vụ</label>
                                    <input type="number" placeholder="2018" value={formVintage} onChange={e => setFormVintage(e.target.value ? Number(e.target.value) : '')} className={inputCls} style={inputStyle} />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Quốc Gia</label>
                                    <input placeholder="Pháp, Ý..." value={formCountry} onChange={e => setFormCountry(e.target.value)} className={inputCls} style={inputStyle} />
                                </div>
                            </div>

                            {/* Producer & Estimated Value */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Nhà Sản Xuất (Producer)</label>
                                    <input placeholder="VD: Château Margaux" value={formProducer} onChange={e => setFormProducer(e.target.value)} className={inputCls} style={inputStyle} />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Giá Trị Ước Tính (VND/Chai)</label>
                                    <input type="number" placeholder="500000" value={formEstimatedValue} onChange={e => setFormEstimatedValue(e.target.value ? Number(e.target.value) : '')} className={inputCls} style={inputStyle} />
                                </div>
                            </div>

                            {/* Initial Qty */}
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider font-bold block" style={{ color: '#4A6A7A' }}>
                                    Số Lượng Khởi Tạo Nhập Kho (Chai) *
                                </label>
                                <input type="number" min="0" value={formInitialQty} onChange={e => setFormInitialQty(e.target.value ? Number(e.target.value) : '')} className={inputCls} style={inputStyle} required />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-[#2A4355]">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ color: '#8AAEBB' }}>
                                    Hủy
                                </button>
                                <button type="submit" disabled={submittingAdd} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: '#87CBB9', color: '#0A1926' }}>
                                    {submittingAdd ? <Loader2 size={14} className="animate-spin" /> : 'Xác Nhận Khai Báo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════ */}
            {/* MODAL 2: XUẤT SỬ DỤNG HÀNG MẪU                        */}
            {/* ═════════════════════════════════════════════════════ */}
            {showOutboundModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl space-y-4 p-6 overflow-y-auto max-h-[90vh]"
                        style={{ background: '#0D1E2B', border: '1px solid #2A4355', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
                        <div className="flex items-center justify-between pb-3 border-b border-[#2A4355]">
                            <h3 className="text-base font-bold flex items-center gap-2" style={{ color: '#E8F1F2' }}>
                                <ArrowUpCircle size={18} style={{ color: '#E5989B' }} /> Tạo Phiếu Xuất Sử Dụng Hàng Mẫu
                            </h3>
                            <button onClick={() => setShowOutboundModal(false)} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleOutboundSubmit} className="space-y-4">
                            {/* Product Selector */}
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider font-bold block" style={{ color: '#4A6A7A' }}>
                                    Chọn Sản Phẩm Mẫu Cần Xuất *
                                </label>
                                {selectedProductForOutbound ? (
                                    <div className="p-3 rounded-xl border flex items-center justify-between" style={{ background: 'rgba(212,168,83,0.1)', borderColor: '#D4A853' }}>
                                        <div>
                                            <span className="text-xs font-mono font-bold" style={{ color: '#D4A853' }}>{selectedProductForOutbound.sampleCode}</span>
                                            <p className="text-xs font-bold" style={{ color: '#E8F1F2' }}>{selectedProductForOutbound.productName}</p>
                                            <p className="text-[10px]" style={{ color: '#8AAEBB' }}>Tồn hiện tại: <span className="font-mono text-[#87CBB9]">{selectedProductForOutbound.qtyOnHand} chai</span></p>
                                        </div>
                                        <button type="button" onClick={() => setSelectedProductForOutbound(null)} style={{ color: '#4A6A7A' }}><X size={14} /></button>
                                    </div>
                                ) : (
                                    <select value={outboundProductId} onChange={e => setOutboundProductId(e.target.value)} className={inputCls} style={inputStyle} required>
                                        <option value="">-- Chọn hàng mẫu từ danh sách kho --</option>
                                        {products.filter(p => p.qtyOnHand > 0).map(p => (
                                            <option key={p.id} value={p.id}>
                                                [{p.sampleCode}] {p.productName} (Còn {p.qtyOnHand} chai)
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Purpose / Reason */}
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider font-bold block" style={{ color: '#4A6A7A' }}>
                                    Mục Đích Xuất Sử Dụng *
                                </label>
                                <select value={outboundReason} onChange={e => setOutboundReason(e.target.value)} className={inputCls} style={inputStyle}>
                                    <option value="TASTING">🍷 Thử Rượu / Sommelier Tasting Event</option>
                                    <option value="CUSTOMER_GIFT">🎁 Tặng Khách Hàng VIP / Khách Mua Lớn</option>
                                    <option value="MARKETING_MEDIA">📸 Marketing / Chụp Ảnh / Media</option>
                                    <option value="QUALITY_TESTING">🔬 Kiểm Định Chất Lượng / Thử Nghiệm</option>
                                    <option value="DAMAGE_LOSS">❌ Hỏng / Vỡ / Hủy Mẫu</option>
                                    <option value="OTHER">💬 Mục Đích Khác</option>
                                </select>
                            </div>

                            {/* Qty & Recipient */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Số Lượng Xuất (Chai) *</label>
                                    <input type="number" min="1" value={outboundQty} onChange={e => setOutboundQty(e.target.value ? Number(e.target.value) : '')} className={inputCls} style={inputStyle} required />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Người / Khách / Sự Kiện Nhận</label>
                                    <input placeholder="VD: Khách VIP Nguyễn Văn A" value={outboundRecipient} onChange={e => setOutboundRecipient(e.target.value)} className={inputCls} style={inputStyle} />
                                </div>
                            </div>

                            {/* Requested by & Notes */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Nhân Viên Đề Xuất</label>
                                    <input placeholder="VD: NVKD Trần Văn B" value={outboundRequestedBy} onChange={e => setOutboundRequestedBy(e.target.value)} className={inputCls} style={inputStyle} />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Ghi Chú Chi Tiết</label>
                                    <input placeholder="Lý do chi tiết..." value={outboundNotes} onChange={e => setOutboundNotes(e.target.value)} className={inputCls} style={inputStyle} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-[#2A4355]">
                                <button type="button" onClick={() => setShowOutboundModal(false)} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ color: '#8AAEBB' }}>
                                    Hủy
                                </button>
                                <button type="submit" disabled={submittingOutbound} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: '#E5989B', color: '#0A1926' }}>
                                    {submittingOutbound ? <Loader2 size={14} className="animate-spin" /> : 'Xác Nhận Xuất Mẫu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
