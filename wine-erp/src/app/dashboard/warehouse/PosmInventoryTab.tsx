'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Sparkles, Plus, ArrowUpRight, ArrowDownLeft, Search, RefreshCw,
    AlertTriangle, Tag, History, X, Layers, Boxes, Edit2, ShieldAlert,
    CheckCircle2, DollarSign, Package, AlertCircle, Building2, Store,
    Wine, Gift, BookOpen, Printer
} from 'lucide-react'
import {
    PosmProductItem, PosmTransactionItem, PosmStats,
    getPosmProducts, getPosmTransactions, getPosmStats,
    createPosmProduct, updatePosmProduct, createPosmTransaction
} from './actions-posm'
import { formatVND, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { PosmCategory, PosmReason } from '@prisma/client'

// ── POSM Category Visual Configurations ──────────────────────
export const POSM_CATEGORY_CONFIG: Record<PosmCategory, { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
    GLASSWARE_TOOLS: {
        label: 'Ly & Dụng Cụ Rượu',
        color: '#0284C7',
        bg: '#F0F9FF',
        border: '#BAE6FD',
        icon: Wine
    },
    DISPLAY_STAND: {
        label: 'Kệ & Trưng Bày',
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A',
        icon: Tag
    },
    PACKAGING_GIFT: {
        label: 'Bao Bì & Hộp Quà',
        color: '#0E7490',
        bg: '#ECFEFF',
        border: '#A5F3FC',
        icon: Gift
    },
    MARKETING_COLLATERAL: {
        label: 'Ấn Phẩm & Marketing',
        color: '#15803D',
        bg: '#ECFDF5',
        border: '#A7F3D0',
        icon: BookOpen
    },
    OTHER: {
        label: 'Vật Phẩm Khác',
        color: '#475569',
        bg: '#F8FAFC',
        border: '#E2E8F0',
        icon: Package
    }
}

// ── POSM Reason Labels ────────────────────────────────────────
export const POSM_REASON_LABELS: Record<PosmReason, { label: string; type: 'IN' | 'OUT' | 'ADJ' }> = {
    PURCHASE_INBOUND: { label: 'Mua mới nhập kho', type: 'IN' },
    SUPPLIER_SPONSOR: { label: 'Hãng / Nhà cung cấp tài trợ', type: 'IN' },
    EVENT_RETURN: { label: 'Hoàn trả tồn sau sự kiện', type: 'IN' },
    SALES_ALLOCATION: { label: 'Cấp phát Sales / PG đi thị trường', type: 'OUT' },
    HORECA_PLACEMENT: { label: 'Trang bị điểm bán / HORECA', type: 'OUT' },
    PROMO_GIFT: { label: 'Quà tặng CTKM kèm đơn hàng', type: 'OUT' },
    EVENT_WORKSHOP: { label: 'Sự kiện / Workshop nếm thử', type: 'OUT' },
    DAMAGE_LOSS: { label: 'Hư hỏng / Bể vỡ / Móp méo', type: 'OUT' },
    INVENTORY_ADJUST: { label: 'Kiểm kê điều chỉnh kho', type: 'ADJ' },
    OTHER: { label: 'Mục đích khác', type: 'OUT' }
}

export function PosmInventoryTab() {
    const [subTab, setSubTab] = useState<'ITEMS' | 'TX_LOG'>('ITEMS')
    const [loading, setLoading] = useState(true)

    const [products, setProducts] = useState<PosmProductItem[]>([])
    const [transactions, setTransactions] = useState<PosmTransactionItem[]>([])
    const [stats, setStats] = useState<PosmStats | null>(null)

    // Filters
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
    const [lowStockFilter, setLowStockFilter] = useState(false)

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editItem, setEditItem] = useState<PosmProductItem | null>(null)
    const [showInboundModal, setShowInboundModal] = useState(false)
    const [showOutboundModal, setShowOutboundModal] = useState(false)
    const [showPrintVoucherModal, setShowPrintVoucherModal] = useState(false)
    const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<PosmTransactionItem | null>(null)
    const [targetProduct, setTargetProduct] = useState<PosmProductItem | null>(null)

    // Master Data Form
    const [formName, setFormName] = useState('')
    const [formCategory, setFormCategory] = useState<PosmCategory>('GLASSWARE_TOOLS')
    const [formUnit, setFormUnit] = useState('Cái')
    const [formBrand, setFormBrand] = useState('')
    const [formLocation, setFormLocation] = useState('')
    const [formCostPrice, setFormCostPrice] = useState<number | string>('')
    const [formMinAlert, setFormMinAlert] = useState<number | string>(5)
    const [formInitialQty, setFormInitialQty] = useState<number | string>(0)
    const [formNotes, setFormNotes] = useState('')
    const [formSubmitting, setFormSubmitting] = useState(false)

    // Inbound Form
    const [inboundProductId, setInboundProductId] = useState('')
    const [inboundQty, setInboundQty] = useState<number | string>(1)
    const [inboundReason, setInboundReason] = useState<PosmReason>('PURCHASE_INBOUND')
    const [inboundUnitCost, setInboundUnitCost] = useState<number | string>('')
    const [inboundNotes, setInboundNotes] = useState('')
    const [inboundSubmitting, setInboundSubmitting] = useState(false)

    // Outbound Form
    const [outboundProductId, setOutboundProductId] = useState('')
    const [outboundQty, setOutboundQty] = useState<number | string>(1)
    const [outboundReason, setOutboundReason] = useState<PosmReason>('SALES_ALLOCATION')
    const [outboundRecipient, setOutboundRecipient] = useState('')
    const [outboundRequestedBy, setOutboundRequestedBy] = useState('')
    const [outboundNotes, setOutboundNotes] = useState('')
    const [outboundSubmitting, setOutboundSubmitting] = useState(false)

    // Load data
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [prods, txs, st] = await Promise.all([
                getPosmProducts({
                    search: search || undefined,
                    category: categoryFilter,
                    lowStockOnly: lowStockFilter
                }),
                getPosmTransactions(),
                getPosmStats()
            ])
            setProducts(prods)
            setTransactions(txs)
            setStats(st)
        } catch (error: any) {
            toast.error(error?.message || 'Không thể tải dữ liệu kho POSM')
        } finally {
            setLoading(false)
        }
    }, [search, categoryFilter, lowStockFilter])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Reset Master Data Form
    const resetMasterForm = () => {
        setFormName('')
        setFormCategory('GLASSWARE_TOOLS')
        setFormUnit('Cái')
        setFormBrand('')
        setFormLocation('')
        setFormCostPrice('')
        setFormMinAlert(5)
        setFormInitialQty(0)
        setFormNotes('')
        setEditItem(null)
    }

    const openCreateMaster = () => {
        resetMasterForm()
        setShowCreateModal(true)
    }

    const openEditMaster = (item: PosmProductItem) => {
        setEditItem(item)
        setFormName(item.name)
        setFormCategory(item.category)
        setFormUnit(item.unit)
        setFormBrand(item.brand || '')
        setFormLocation(item.location || '')
        setFormCostPrice(item.costPrice || '')
        setFormMinAlert(item.minStockAlert)
        setFormNotes(item.notes || '')
        setShowCreateModal(true)
    }

    const handleSaveMaster = async () => {
        if (!formName.trim()) {
            toast.error('Vui lòng nhập tên vật phẩm POSM')
            return
        }
        setFormSubmitting(true)
        try {
            if (editItem) {
                await updatePosmProduct(editItem.id, {
                    name: formName,
                    category: formCategory,
                    unit: formUnit,
                    brand: formBrand || undefined,
                    location: formLocation || undefined,
                    costPrice: formCostPrice ? Number(formCostPrice) : 0,
                    minStockAlert: formMinAlert ? Number(formMinAlert) : 0,
                    notes: formNotes || undefined
                })
                toast.success('Cập nhật Master Data POSM thành công')
            } else {
                await createPosmProduct({
                    name: formName,
                    category: formCategory,
                    unit: formUnit,
                    brand: formBrand || undefined,
                    location: formLocation || undefined,
                    costPrice: formCostPrice ? Number(formCostPrice) : 0,
                    minStockAlert: formMinAlert ? Number(formMinAlert) : 0,
                    initialQty: formInitialQty ? Number(formInitialQty) : 0,
                    notes: formNotes || undefined
                })
                toast.success('Thêm mới vật phẩm POSM vào Master Data thành công')
            }
            setShowCreateModal(false)
            resetMasterForm()
            await loadData()
        } catch (error: any) {
            toast.error(error?.message || 'Lỗi khi lưu vật phẩm POSM')
        } finally {
            setFormSubmitting(false)
        }
    }

    // Open Quick Inbound
    const openInbound = (item?: PosmProductItem) => {
        setTargetProduct(item || null)
        setInboundProductId(item ? item.id : products[0]?.id || '')
        setInboundQty(1)
        setInboundReason('PURCHASE_INBOUND')
        setInboundUnitCost(item ? item.costPrice : '')
        setInboundNotes('')
        setShowInboundModal(true)
    }

    const handleSaveInbound = async () => {
        if (!inboundProductId) {
            toast.error('Vui lòng chọn vật phẩm POSM cần nhập')
            return
        }
        const qtyNum = Number(inboundQty)
        if (isNaN(qtyNum) || qtyNum <= 0) {
            toast.error('Số lượng nhập phải lớn hơn 0')
            return
        }

        setInboundSubmitting(true)
        try {
            await createPosmTransaction({
                posmProductId: inboundProductId,
                type: 'INBOUND',
                reason: inboundReason,
                qty: qtyNum,
                unitCost: inboundUnitCost ? Number(inboundUnitCost) : 0,
                notes: inboundNotes || undefined
            })
            toast.success(`Đã nhập ${qtyNum} sản phẩm vào Kho POSM`)
            setShowInboundModal(false)
            await loadData()
        } catch (error: any) {
            toast.error(error?.message || 'Không thể tạo phiếu nhập kho POSM')
        } finally {
            setInboundSubmitting(false)
        }
    }

    // Open Quick Outbound
    const openOutbound = (item?: PosmProductItem) => {
        setTargetProduct(item || null)
        setOutboundProductId(item ? item.id : products[0]?.id || '')
        setOutboundQty(1)
        setOutboundReason('SALES_ALLOCATION')
        setOutboundRecipient('')
        setOutboundRequestedBy('')
        setOutboundNotes('')
        setShowOutboundModal(true)
    }

    const selectedOutboundProduct = useMemo(() => {
        return products.find(p => p.id === outboundProductId)
    }, [products, outboundProductId])

    const isDeficit = useMemo(() => {
        if (!selectedOutboundProduct) return false
        return Number(outboundQty) > selectedOutboundProduct.qtyOnHand
    }, [selectedOutboundProduct, outboundQty])

    const handleSaveOutbound = async (openPrintVoucher = false) => {
        if (!outboundProductId) {
            toast.error('Vui lòng chọn vật phẩm POSM cần xuất')
            return
        }
        const qtyNum = Number(outboundQty)
        if (isNaN(qtyNum) || qtyNum <= 0) {
            toast.error('Số lượng xuất phải lớn hơn 0')
            return
        }

        setOutboundSubmitting(true)
        try {
            const createdTx = await createPosmTransaction({
                posmProductId: outboundProductId,
                type: 'OUTBOUND',
                reason: outboundReason,
                qty: qtyNum,
                recipient: outboundRecipient || undefined,
                requestedBy: outboundRequestedBy || undefined,
                notes: outboundNotes || undefined,
                allowDeficit: true
            })
            toast.success(`Đã xuất ${qtyNum} vật phẩm khỏi Kho POSM (${createdTx.docNo})`)
            setShowOutboundModal(false)
            await loadData()

            if (openPrintVoucher && createdTx) {
                setSelectedVoucherForPrint(createdTx)
                setShowPrintVoucherModal(true)
            }
        } catch (error: any) {
            toast.error(error?.message || 'Không thể tạo phiếu xuất kho POSM')
        } finally {
            setOutboundSubmitting(false)
        }
    }

    return (
        <div className="space-y-5">
            {/* ═══ TOP BANNER & STATS ═══ */}
            <div className="bg-white border border-slate-200 rounded-md p-5 shadow-2xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                                <Sparkles size={20} />
                            </span>
                            <h2 className="text-lg font-bold text-slate-900">
                                Kho Vật Phẩm Tiếp Thị & Quà Tặng (POSM)
                            </h2>
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
                                Độc Lập Với Tồn Rượu
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Quản lý toàn diện vật phẩm quảng cáo, ly rượu, khui, bình Decanter, bao bì hộp quà cao cấp, kệ trưng bày tại điểm bán và ấn phẩm tiếp thị.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={openCreateMaster}
                            className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                        >
                            <Plus size={15} />
                            <span>Thêm Mã POSM</span>
                        </button>
                        <button
                            onClick={() => openInbound()}
                            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                        >
                            <ArrowDownLeft size={15} />
                            <span>Nhập Kho POSM</span>
                        </button>
                        <button
                            onClick={() => openOutbound()}
                            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                        >
                            <ArrowUpRight size={15} />
                            <span>Xuất Kho POSM</span>
                        </button>
                        <button
                            onClick={loadData}
                            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                            title="Làm mới"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-4">
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="text-xs font-medium">Danh Mục POSM</span>
                            <Boxes size={16} className="text-slate-400" />
                        </div>
                        <div className="text-xl font-bold text-slate-900">
                            {stats?.totalItems ?? 0} <span className="text-xs font-normal text-slate-500">mã</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Danh mục vật phẩm tiếp thị</div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="text-xs font-medium">Tổng Tồn Kho POSM</span>
                            <Package size={16} className="text-amber-600" />
                        </div>
                        <div className="text-xl font-bold text-amber-700">
                            {stats?.totalOnHandQty ?? 0} <span className="text-xs font-normal text-slate-500">vật phẩm</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Sẵn sàng xuất cấp phát</div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="text-xs font-medium">Giá Trị Tồn Dự Toán</span>
                            <DollarSign size={16} className="text-emerald-600" />
                        </div>
                        <div className="text-xl font-bold text-emerald-700">
                            {formatVND(stats?.totalInventoryValue ?? 0)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Theo giá vốn ước tính</div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="text-xs font-medium">Cảnh Báo Chạm Đáy</span>
                            <AlertTriangle size={16} className={stats?.lowStockAlertCount ? 'text-rose-600' : 'text-slate-400'} />
                        </div>
                        <div className={`text-xl font-bold ${stats?.lowStockAlertCount ? 'text-rose-600' : 'text-slate-900'}`}>
                            {stats?.lowStockAlertCount ?? 0} <span className="text-xs font-normal text-slate-500">mã</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Dưới ngưỡng tối thiểu</div>
                    </div>
                </div>
            </div>

            {/* ═══ SUB-TAB SWITCHER & FILTER BAR ═══ */}
            <div className="bg-white border border-slate-200 rounded-md p-4 shadow-2xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSubTab('ITEMS')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                subTab === 'ITEMS'
                                    ? 'bg-amber-500/10 text-amber-800 border border-amber-200 shadow-2xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <Boxes size={14} />
                            <span>Danh Mục & Tồn Kho POSM ({products.length})</span>
                        </button>
                        <button
                            onClick={() => setSubTab('TX_LOG')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                subTab === 'TX_LOG'
                                    ? 'bg-amber-500/10 text-amber-800 border border-amber-200 shadow-2xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <History size={14} />
                            <span>Nhật Ký Nhập / Xuất ({transactions.length})</span>
                        </button>
                    </div>

                    {/* Low Stock Toggle */}
                    {subTab === 'ITEMS' && (
                        <button
                            onClick={() => setLowStockFilter(prev => !prev)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                                lowStockFilter
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-2xs'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <AlertCircle size={14} className={lowStockFilter ? 'text-rose-600' : 'text-slate-400'} />
                            <span>Lọc hàng sắp hết ({stats?.lowStockAlertCount ?? 0})</span>
                        </button>
                    )}
                </div>

                {/* Filter Inputs */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <div className="relative flex-1 w-full">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm mã POSM, tên vật phẩm, thương hiệu tài trợ, vị trí kho..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                        />
                    </div>

                    {subTab === 'ITEMS' && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <select
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
                            >
                                <option value="ALL">Tất cả nhóm POSM</option>
                                {Object.entries(POSM_CATEGORY_CONFIG).map(([key, cfg]) => (
                                    <option key={key} value={key}>
                                        {cfg.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ TAB CONTENT: MASTER DATA & STOCK LIST ═══ */}
            {subTab === 'ITEMS' && (
                <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-2xs">
                    <div className="hidden md:block overflow-x-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                    <th className="py-2.5 px-2.5">Mã & Vật Phẩm POSM</th>
                                    <th className="py-2.5 px-2.5">Nhóm Phân Loại</th>
                                    <th className="py-2.5 px-2.5">ĐVT / Hãng</th>
                                    <th className="py-2.5 px-2.5 text-right">Đơn Giá Vốn</th>
                                    <th className="py-2.5 px-2.5 text-center">Tồn Kho Hiện Tại</th>
                                    <th className="py-2.5 px-2.5 text-center">Ngưỡng Tối Thiểu</th>
                                    <th className="py-2.5 px-2.5">Vị Trí Lưu Kho</th>
                                    <th className="py-2.5 px-2.5 text-right">Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {products.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-slate-400">
                                            <Boxes size={36} className="mx-auto mb-2 text-slate-300 stroke-1" />
                                            <p className="font-semibold text-slate-600">Chưa có vật phẩm POSM nào</p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Bấm nút &quot;Thêm Mã POSM&quot; để khởi tạo danh mục vật phẩm tiếp thị độc lập.
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    products.map(item => {
                                        const cat = POSM_CATEGORY_CONFIG[item.category] || POSM_CATEGORY_CONFIG.OTHER
                                        const isLow = item.isLowStock
                                        const CatIcon = cat.icon
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/80 transition group">
                                                <td className="py-2.5 px-2.5">
                                                    <div className="font-bold text-slate-900 group-hover:text-amber-700 transition">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                                        {item.posmCode}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-2.5">
                                                    <span
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border"
                                                        style={{
                                                            background: cat.bg,
                                                            color: cat.color,
                                                            borderColor: cat.border
                                                        }}
                                                    >
                                                        <CatIcon size={12} className="shrink-0" />
                                                        <span>{cat.label}</span>
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2.5">
                                                    <div className="text-slate-900 font-semibold">{item.unit}</div>
                                                    {item.brand && (
                                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                                            Brand: <span className="font-medium text-slate-700">{item.brand}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-2.5 text-right font-medium text-slate-700">
                                                    {formatVND(item.costPrice)}
                                                </td>
                                                <td className="py-2.5 px-2.5 text-center">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <span className={`text-sm font-extrabold ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                                                            {item.qtyOnHand}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500">{item.unit}</span>
                                                        {isLow && (
                                                            <span className="text-rose-500" title="Chạm ngưỡng tồn tối thiểu">
                                                                <AlertTriangle size={14} />
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-2.5 text-center text-slate-500 font-mono text-xs">
                                                    {item.minStockAlert > 0 ? item.minStockAlert : '—'}
                                                </td>
                                                <td className="py-2.5 px-2.5">
                                                    <span className="text-xs text-slate-600 font-medium">
                                                        {item.location || 'Kho Tổng'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2.5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => openInbound(item)}
                                                            className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-700 transition cursor-pointer"
                                                            title="Nhập thêm kho"
                                                        >
                                                            <ArrowDownLeft size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => openOutbound(item)}
                                                            className="p-1.5 rounded-md hover:bg-blue-50 text-blue-700 transition cursor-pointer"
                                                            title="Xuất cấp phát"
                                                        >
                                                            <ArrowUpRight size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => openEditMaster(item)}
                                                            className="p-1.5 rounded-md hover:bg-amber-50 text-amber-700 transition cursor-pointer"
                                                            title="Chỉnh sửa thông tin POSM"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards (< 768px) */}
                    <div className="block md:hidden divide-y divide-slate-100 p-2.5 space-y-2">
                        {products.length === 0 ? (
                            <div className="py-10 text-center text-slate-400 text-xs">Chưa có vật phẩm POSM nào</div>
                        ) : (
                            products.map(item => {
                                const cat = POSM_CATEGORY_CONFIG[item.category] || POSM_CATEGORY_CONFIG.OTHER
                                const isLow = item.isLowStock
                                return (
                                    <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-2 shadow-2xs">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                                {item.posmCode}
                                            </span>
                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded border"
                                                style={{ background: cat.bg, color: cat.color, borderColor: cat.border }}>
                                                {cat.label}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 leading-snug">{item.name}</p>
                                        <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                                            <span>Vị trí: <strong className="text-slate-800">{item.location || 'Kho Tổng'}</strong></span>
                                            <span>Tồn: <strong className={`font-mono text-sm ${isLow ? 'text-rose-600' : 'text-emerald-700'}`}>{item.qtyOnHand} {item.unit}</strong></span>
                                        </div>
                                        <div className="flex items-center justify-end gap-1.5 pt-1">
                                            <button onClick={() => openInbound(item)} className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                + Nhập
                                            </button>
                                            <button onClick={() => openOutbound(item)} className="px-2.5 py-1 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                - Xuất
                                            </button>
                                            <button onClick={() => openEditMaster(item)} className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                                                Sửa
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ═══ TAB CONTENT: TRANSACTION LOG ═══ */}
            {subTab === 'TX_LOG' && (
                <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-2xs">
                    <div className="overflow-x-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                    <th className="py-2.5 px-2.5">Số Phiếu</th>
                                    <th className="py-2.5 px-2.5">Thời Gian</th>
                                    <th className="py-2.5 px-2.5">Loại Phiếu</th>
                                    <th className="py-2.5 px-2.5">Vật Phẩm POSM</th>
                                    <th className="py-2.5 px-2.5 text-center">Số Lượng</th>
                                    <th className="py-2.5 px-2.5">Lý Do / Mục Đích</th>
                                    <th className="py-2.5 px-2.5">Người Nhận / Bộ Phận</th>
                                    <th className="py-2.5 px-2.5">Ghi Chú</th>
                                    <th className="py-2.5 px-2.5 text-center">Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-12 text-center text-slate-400">
                                            <History size={36} className="mx-auto mb-2 text-slate-300 stroke-1" />
                                            <p className="font-semibold text-slate-600">Chưa có giao dịch nhập/xuất kho POSM nào</p>
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map(tx => {
                                        const isOut = tx.type === 'OUTBOUND'
                                        const reasonInfo = POSM_REASON_LABELS[tx.reason] || { label: tx.reason, type: 'OUT' }
                                        return (
                                            <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                                                <td className="py-2.5 px-2.5 font-mono font-bold text-slate-900">
                                                    {isOut ? (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedVoucherForPrint(tx)
                                                                setShowPrintVoucherModal(true)
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-bold font-mono"
                                                            title="Bấm để xem và in phiếu xuất kho POSM"
                                                        >
                                                            {tx.docNo}
                                                        </button>
                                                    ) : (
                                                        tx.docNo
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-2.5 text-slate-500 font-medium">
                                                    {formatDate(tx.performedAt)}
                                                </td>
                                                <td className="py-2.5 px-2.5">
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                            isOut
                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        }`}
                                                    >
                                                        {isOut ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                                        <span>{isOut ? 'Xuất Kho' : 'Nhập Kho'}</span>
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2.5">
                                                    <div className="font-bold text-slate-900">{tx.posmProductName}</div>
                                                    <div className="text-[11px] text-slate-400 font-mono">{tx.posmProductCode}</div>
                                                </td>
                                                <td className="py-2.5 px-2.5 text-center">
                                                    <span className={`font-bold ${isOut ? 'text-blue-700' : 'text-emerald-700'}`}>
                                                        {isOut ? `-${tx.qty}` : `+${tx.qty}`}
                                                    </span>{' '}
                                                    <span className="text-[11px] text-slate-500">{tx.unit}</span>
                                                </td>
                                                <td className="py-2.5 px-2.5">
                                                    <span className="text-xs font-semibold text-slate-700">
                                                        {reasonInfo.label}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2.5 text-slate-600">
                                                    {tx.recipient ? (
                                                        <span className="font-medium text-slate-900">{tx.recipient}</span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-2.5 text-slate-500 text-[11px]">
                                                    {tx.notes || '—'}
                                                </td>
                                                <td className="py-2.5 px-2.5 text-center">
                                                    {isOut ? (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedVoucherForPrint(tx)
                                                                setShowPrintVoucherModal(true)
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                                                            title="In / Xem Phiếu Xuất Kho POSM"
                                                        >
                                                            <Printer size={12} />
                                                            <span>In Phiếu</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ MODAL 1: CREATE / EDIT POSM MASTER DATA ═══ */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                    <div className="bg-white rounded-md shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                                    <Sparkles size={18} />
                                </span>
                                <h3 className="font-bold text-slate-900 text-sm">
                                    {editItem ? 'Chỉnh Sửa Vật Phẩm POSM' : 'Thêm Mới Vật Phẩm POSM'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Tên vật phẩm POSM <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="VD: Ly Vang Bordeaux Riedel 650ml, Kệ Gỗ Trưng Bày 6 Chai..."
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Nhóm phân loại
                                    </label>
                                    <select
                                        value={formCategory}
                                        onChange={e => setFormCategory(e.target.value as PosmCategory)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    >
                                        {Object.entries(POSM_CATEGORY_CONFIG).map(([k, v]) => (
                                            <option key={k} value={k}>
                                                {v.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Đơn vị tính (ĐVT)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Cái, Chiếc, Bộ, Hộp, Cuộn..."
                                        value={formUnit}
                                        onChange={e => setFormUnit(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Hãng / Thương hiệu tài trợ
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="VD: Riedel, Penfolds, Banfi..."
                                        value={formBrand}
                                        onChange={e => setFormBrand(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Vị trí lưu kho
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="VD: Kệ POSM-A1, Ngăn 3..."
                                        value={formLocation}
                                        onChange={e => setFormLocation(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Đơn giá vốn ước tính (VNĐ)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={formCostPrice}
                                        onChange={e => setFormCostPrice(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Ngưỡng cảnh báo tồn tối thiểu
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="5"
                                        value={formMinAlert}
                                        onChange={e => setFormMinAlert(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            {!editItem && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Số lượng tồn ban đầu nhập kho
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={formInitialQty}
                                        onChange={e => setFormInitialQty(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        Nếu &gt; 0, hệ thống tự động sinh 1 phiếu nhập kho ban đầu (PIR-...)
                                    </span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Ghi chú thêm
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Quy cách đóng gói, hướng dẫn bảo quản vật phẩm..."
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                onClick={handleSaveMaster}
                                disabled={formSubmitting}
                                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                            >
                                <CheckCircle2 size={14} />
                                <span>{formSubmitting ? 'Đang lưu...' : editItem ? 'Cập Nhật' : 'Tạo Mã POSM'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL 2: INBOUND (NHẬP KHO POSM) ═══ */}
            {showInboundModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                    <div className="bg-white rounded-md shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-emerald-50/50">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                                    <ArrowDownLeft size={18} />
                                </span>
                                <h3 className="font-bold text-slate-900 text-sm">
                                    Lập Phiếu Nhập Kho POSM (PIR)
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowInboundModal(false)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Chọn vật phẩm POSM <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={inboundProductId}
                                    onChange={e => {
                                        setInboundProductId(e.target.value)
                                        const found = products.find(p => p.id === e.target.value)
                                        if (found) setInboundUnitCost(found.costPrice)
                                    }}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 font-semibold"
                                >
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>
                                            [{p.posmCode}] {p.name} (Tồn: {p.qtyOnHand} {p.unit})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Lý do nhập kho
                                    </label>
                                    <select
                                        value={inboundReason}
                                        onChange={e => setInboundReason(e.target.value as PosmReason)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="PURCHASE_INBOUND">Mua mới nhập kho</option>
                                        <option value="SUPPLIER_SPONSOR">Hãng / Nhà cung cấp tài trợ</option>
                                        <option value="EVENT_RETURN">Hoàn trả sau sự kiện</option>
                                        <option value="INVENTORY_ADJUST">Điều chỉnh kiểm kê</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Số lượng nhập <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={inboundQty}
                                        onChange={e => setInboundQty(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Đơn giá nhập (VNĐ)
                                </label>
                                <input
                                    type="number"
                                    value={inboundUnitCost}
                                    onChange={e => setInboundUnitCost(e.target.value)}
                                    placeholder="Giá vốn / Chi phí mua"
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Ghi chú phiếu nhập
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Số hóa đơn mua hàng, tên nhà tài trợ, sự kiện..."
                                    value={inboundNotes}
                                    onChange={e => setInboundNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setShowInboundModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                onClick={handleSaveInbound}
                                disabled={inboundSubmitting}
                                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                            >
                                <CheckCircle2 size={14} />
                                <span>{inboundSubmitting ? 'Đang xử lý...' : 'Xác Nhận Nhập Kho'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL 3: OUTBOUND (XUẤT KHO POSM) ═══ */}
            {showOutboundModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
                    <div className="bg-white rounded-md shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-blue-50/50">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                                    <ArrowUpRight size={18} />
                                </span>
                                <h3 className="font-bold text-slate-900 text-sm">
                                    Lập Phiếu Xuất Kho POSM (PIO)
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowOutboundModal(false)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Chọn vật phẩm POSM <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={outboundProductId}
                                    onChange={e => setOutboundProductId(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 font-semibold"
                                >
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>
                                            [{p.posmCode}] {p.name} (Tồn: {p.qtyOnHand} {p.unit})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Mục đích xuất kho
                                    </label>
                                    <select
                                        value={outboundReason}
                                        onChange={e => setOutboundReason(e.target.value as PosmReason)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="SALES_ALLOCATION">Cấp phát Sales / PG thị trường</option>
                                        <option value="HORECA_PLACEMENT">Trang bị điểm bán / HORECA</option>
                                        <option value="PROMO_GIFT">Quà tặng CTKM đơn hàng</option>
                                        <option value="EVENT_WORKSHOP">Sự kiện / Workshop nếm thử</option>
                                        <option value="DAMAGE_LOSS">Hư hỏng / Bể vỡ / Móp méo</option>
                                        <option value="OTHER">Mục đích khác</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Số lượng xuất <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={outboundQty}
                                        onChange={e => setOutboundQty(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 font-bold"
                                    />
                                </div>
                            </div>

                            {/* Warning if deficit (as decided in Socratic Gate) */}
                            {isDeficit && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
                                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div className="text-[11px] text-amber-800 leading-relaxed">
                                        <span className="font-bold">Cảnh báo thiếu tồn kho:</span> Số lượng xuất ({outboundQty}) vượt quá tồn thực tế ({selectedOutboundProduct?.qtyOnHand} {selectedOutboundProduct?.unit}). Hệ thống cho phép thủ kho xuất trước và làm phiếu nhập bù sau.
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Người nhận / Đại lý
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Tên khách, Bar, Showroom..."
                                        value={outboundRecipient}
                                        onChange={e => setOutboundRecipient(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Nhân viên đề xuất
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Sales rep / Marketing..."
                                        value={outboundRequestedBy}
                                        onChange={e => setOutboundRequestedBy(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Ghi chú xuất kho
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Mã đơn hàng SO liên quan, tên sự kiện..."
                                    value={outboundNotes}
                                    onChange={e => setOutboundNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setShowOutboundModal(false)}
                                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                onClick={() => handleSaveOutbound(false)}
                                disabled={outboundSubmitting}
                                className="px-3.5 py-2 text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md transition cursor-pointer flex items-center gap-1.5"
                            >
                                <CheckCircle2 size={14} />
                                <span>Chỉ Lưu Kho</span>
                            </button>
                            <button
                                onClick={() => handleSaveOutbound(true)}
                                disabled={outboundSubmitting}
                                className="px-4 py-2 text-xs font-bold bg-[#0E7490] hover:bg-[#155E75] text-white rounded-md transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                            >
                                <Printer size={14} />
                                <span>Xác Nhận & In Phiếu Xuất</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL 4: PHIẾU XUẤT KHO POSM (PRINTABLE VOUCHER) ═══ */}
            {showPrintVoucherModal && selectedVoucherForPrint && (
                <div className="print-modal fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:static print:bg-white print:p-0 print:overflow-visible">
                    <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-3xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:my-0 print:shadow-none print:border-0">
                        {/* Top Toolbar (No-Print) */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 no-print">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                                    <Printer size={16} />
                                </span>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                                        Phiếu Xuất Kho POSM & Biên Bản Bàn Giao
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-mono">
                                        Mã số: {selectedVoucherForPrint.docNo}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                                >
                                    <Printer size={14} />
                                    <span>In Phiếu Xuất (Print)</span>
                                </button>
                                <button
                                    onClick={() => setShowPrintVoucherModal(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Printable Paper Area */}
                        <div
                            id="posm-print-voucher"
                            className="p-6 sm:p-10 bg-white text-slate-900 text-xs space-y-6"
                            style={{ fontFamily: "'Times New Roman', Times, serif" }}
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                                <div>
                                    <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                                        CÔNG TY TNHH LY&apos;S CELLAR
                                    </h4>
                                    <p className="text-[11px] text-slate-600">
                                        Hệ Thống Nhập Khẩu & Phân Phối Vang Cao Cấp
                                    </p>
                                    <p className="text-[11px] text-slate-600">
                                        Bộ Phận: Kho Vận & Tiếp Thị (WMS - Marketing POSM)
                                    </p>
                                </div>
                                <div className="text-right text-[11px] space-y-0.5">
                                    <p className="font-bold">Mẫu số: 02 - VT</p>
                                    <p className="italic text-slate-500">(Ban hành theo TT 200/2014/TT-BTC)</p>
                                    <p className="font-mono font-bold text-slate-900 mt-1">
                                        Số: <span className="text-blue-900">{selectedVoucherForPrint.docNo}</span>
                                    </p>
                                    <p className="text-slate-600">
                                        Ngày: {formatDate(selectedVoucherForPrint.performedAt)}
                                    </p>
                                </div>
                            </div>

                            {/* Title */}
                            <div className="text-center space-y-1 py-1">
                                <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-slate-900">
                                    PHIẾU XUẤT KHO VẬT PHẨM POSM
                                </h2>
                                <p className="italic text-slate-600 text-xs">
                                    (Kiêm Biên Bản Bàn Giao Vật Phẩm Tiếp Thị & Quà Tặng)
                                </p>
                            </div>

                            {/* Meta Information */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs">
                                <div>
                                    <span className="font-bold">Người nhận / Đơn vị: </span>
                                    <span>{selectedVoucherForPrint.recipient || '....................................................................'}</span>
                                </div>
                                <div>
                                    <span className="font-bold">Nhân viên đề xuất: </span>
                                    <span>{selectedVoucherForPrint.requestedBy || '....................................................................'}</span>
                                </div>
                                <div>
                                    <span className="font-bold">Mục đích xuất: </span>
                                    <span>{POSM_REASON_LABELS[selectedVoucherForPrint.reason]?.label || selectedVoucherForPrint.reason}</span>
                                </div>
                                <div>
                                    <span className="font-bold">Kho xuất: </span>
                                    <span>Kho Tổng Ly&apos;s Cellar (Khu Vực POSM)</span>
                                </div>
                                <div className="sm:col-span-2">
                                    <span className="font-bold">Ghi chú / Đơn hàng liên quan: </span>
                                    <span>{selectedVoucherForPrint.notes || 'Cấp phát sử dụng theo quy định quản lý tiếp thị.'}</span>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="border border-slate-800">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-800 bg-slate-100 text-slate-900 font-bold text-center">
                                            <th className="p-2 border-r border-slate-800 w-10">STT</th>
                                            <th className="p-2 border-r border-slate-800 w-28">Mã POSM</th>
                                            <th className="p-2 border-r border-slate-800">Tên Vật Phẩm Tiếp Thị</th>
                                            <th className="p-2 border-r border-slate-800 w-24">Danh Mục</th>
                                            <th className="p-2 border-r border-slate-800 w-16">ĐVT</th>
                                            <th className="p-2 border-r border-slate-800 w-20">Số Lượng</th>
                                            <th className="p-2 border-r border-slate-800 w-24">Đơn Giá</th>
                                            <th className="p-2 w-28">Thành Tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-slate-300">
                                            <td className="p-2 border-r border-slate-800 text-center">1</td>
                                            <td className="p-2 border-r border-slate-800 font-mono font-bold text-center">
                                                {selectedVoucherForPrint.posmProductCode}
                                            </td>
                                            <td className="p-2 border-r border-slate-800 font-semibold">
                                                {selectedVoucherForPrint.posmProductName}
                                            </td>
                                            <td className="p-2 border-r border-slate-800 text-center">
                                                {POSM_CATEGORY_CONFIG[selectedVoucherForPrint.category]?.label || selectedVoucherForPrint.category}
                                            </td>
                                            <td className="p-2 border-r border-slate-800 text-center">
                                                {selectedVoucherForPrint.unit}
                                            </td>
                                            <td className="p-2 border-r border-slate-800 text-center font-bold">
                                                {selectedVoucherForPrint.qty}
                                            </td>
                                            <td className="p-2 border-r border-slate-800 text-right font-mono">
                                                {selectedVoucherForPrint.unitCost > 0 ? formatVND(selectedVoucherForPrint.unitCost) : '—'}
                                            </td>
                                            <td className="p-2 text-right font-mono font-bold">
                                                {selectedVoucherForPrint.totalCost > 0 ? formatVND(selectedVoucherForPrint.totalCost) : '—'}
                                            </td>
                                        </tr>
                                        {/* Filler row for classic form aesthetic */}
                                        <tr className="border-b border-slate-200">
                                            <td className="p-2 border-r border-slate-800 text-center text-slate-300">2</td>
                                            <td className="p-2 border-r border-slate-800"></td>
                                            <td className="p-2 border-r border-slate-800"></td>
                                            <td className="p-2 border-r border-slate-800"></td>
                                            <td className="p-2 border-r border-slate-800"></td>
                                            <td className="p-2 border-r border-slate-800"></td>
                                            <td className="p-2 border-r border-slate-800"></td>
                                            <td className="p-2"></td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr className="font-bold border-t border-slate-800 bg-slate-50">
                                            <td colSpan={5} className="p-2 text-right border-r border-slate-800">
                                                Tổng cộng:
                                            </td>
                                            <td className="p-2 text-center border-r border-slate-800">
                                                {selectedVoucherForPrint.qty}
                                            </td>
                                            <td className="p-2 border-r border-slate-800"></td>
                                            <td className="p-2 text-right font-mono">
                                                {selectedVoucherForPrint.totalCost > 0 ? formatVND(selectedVoucherForPrint.totalCost) : '—'}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Amount in words & terms */}
                            <div className="space-y-1 text-xs">
                                <p>
                                    <span className="font-bold">Tổng số lượng (viết bằng chữ): </span>
                                    <span className="italic">{selectedVoucherForPrint.qty} ({selectedVoucherForPrint.unit})</span>
                                </p>
                                <p className="italic text-slate-600 text-[11px]">
                                    * Vật phẩm POSM bàn giao đúng quy cách, bên nhận có trách nhiệm bảo quản và sử dụng đúng mục đích.
                                </p>
                            </div>

                            {/* Signature Blocks */}
                            <div className="grid grid-cols-4 gap-2 pt-6 text-center text-xs">
                                <div>
                                    <p className="font-bold">Người Lập Phiếu</p>
                                    <p className="italic text-[10px] text-slate-500">(Ký, họ tên)</p>
                                    <div className="h-16"></div>
                                    <p className="font-semibold text-slate-700">{selectedVoucherForPrint.requestedBy || 'Người lập'}</p>
                                </div>
                                <div>
                                    <p className="font-bold">Người Nhận Hàng</p>
                                    <p className="italic text-[10px] text-slate-500">(Ký, họ tên)</p>
                                    <div className="h-16"></div>
                                    <p className="font-semibold text-slate-700">{selectedVoucherForPrint.recipient || 'Người nhận'}</p>
                                </div>
                                <div>
                                    <p className="font-bold">Thủ Kho Xuất</p>
                                    <p className="italic text-[10px] text-slate-500">(Ký, họ tên)</p>
                                    <div className="h-16"></div>
                                    <p className="font-semibold text-slate-700">Thủ kho</p>
                                </div>
                                <div>
                                    <p className="font-bold">Kế Toán / Quản Lý</p>
                                    <p className="italic text-[10px] text-slate-500">(Ký, họ tên)</p>
                                    <div className="h-16"></div>
                                    <p className="font-semibold text-slate-700">Quản lý kho</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scoped CSS for printing */}
                    <style jsx global>{`
                        @media print {
                            body * {
                                visibility: hidden !important;
                            }
                            #posm-print-voucher, #posm-print-voucher * {
                                visibility: visible !important;
                            }
                            #posm-print-voucher {
                                position: fixed !important;
                                left: 0 !important;
                                top: 0 !important;
                                width: 100% !important;
                                height: auto !important;
                                margin: 0 !important;
                                padding: 15mm 15mm !important;
                                background: #ffffff !important;
                                color: #000000 !important;
                                border: none !important;
                                box-shadow: none !important;
                                z-index: 999999 !important;
                            }
                            .no-print {
                                display: none !important;
                            }
                        }
                    `}</style>
                </div>
            )}
        </div>
    )
}
