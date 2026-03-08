'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Search, FileText, CheckCircle2, XCircle, Clock, Truck, ReceiptText, DollarSign, Eye, ChevronRight, Loader2, X, AlertTriangle, TrendingUp, TrendingDown, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { SalesOrderRow, SOStatus, getSalesOrders, confirmSalesOrder, cancelSalesOrder, advanceSalesOrderStatus, getSalesOrderDetailWithMargin, SOMarginData, approveSalesOrder, rejectSalesOrder } from './actions'
import { formatVND, formatDate } from '@/lib/utils'
import { CreateSODrawer } from './CreateSODrawer'
import { EditSODrawer } from './EditSODrawer'

const STATUS_CFG: Record<SOStatus, { label: string; color: string; bg: string; icon: React.FC<any> }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)', icon: FileText },
    PENDING_APPROVAL: { label: 'Chờ Duyệt', color: '#D4A853', bg: 'rgba(212,168,83,0.15)', icon: Clock },
    CONFIRMED: { label: 'Đã Xác Nhận', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)', icon: CheckCircle2 },
    PARTIALLY_DELIVERED: { label: 'Giao 1 Phần', color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)', icon: Truck },
    DELIVERED: { label: 'Đã Giao', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)', icon: Truck },
    INVOICED: { label: 'Đã Xuất HĐ', color: '#A5DED0', bg: 'rgba(165,222,208,0.12)', icon: ReceiptText },
    PAID: { label: 'Đã Thu Tiền', color: '#5BA88A', bg: 'rgba(91,168,138,0.2)', icon: DollarSign },
    CANCELLED: { label: 'Huỷ', color: '#8B1A2E', bg: 'rgba(139,26,46,0.12)', icon: XCircle },
}

const CHANNEL_LABEL: Record<string, string> = {
    HORECA: 'HORECA',
    WHOLESALE_DISTRIBUTOR: 'Đại Lý',
    VIP_RETAIL: 'VIP',
    DIRECT_INDIVIDUAL: 'Trực Tiếp',
}

function StatusBadge({ status }: { status: SOStatus }) {
    const cfg = STATUS_CFG[status]
    const Icon = cfg.icon
    return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full"
            style={{ color: cfg.color, background: cfg.bg }}>
            <Icon size={11} />
            {cfg.label}
        </span>
    )
}

function SOStatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
    return (
        <div className="p-4 rounded-md flex items-center gap-4"
            style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: `${accent}20` }}>
                <div className="w-3 h-3 rounded-sm" style={{ background: accent }} />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>{label}</p>
                <p className="text-xl font-bold mt-0.5" style={{ fontFamily: '"DM Mono", monospace', color: '#E8F1F2' }}>{value}</p>
                {sub && <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>{sub}</p>}
            </div>
        </div>
    )
}

const SO_NEXT_STATUS: Partial<Record<SOStatus, { status: SOStatus; label: string; color: string }>> = {
    CONFIRMED: { status: 'DELIVERED', label: '→ Đã Giao', color: '#87CBB9' },
    PARTIALLY_DELIVERED: { status: 'DELIVERED', label: '→ Đã Giao', color: '#87CBB9' },
    DELIVERED: { status: 'INVOICED', label: '→ Xuất HĐ', color: '#A5DED0' },
    INVOICED: { status: 'PAID', label: '→ Thu Tiền', color: '#5BA88A' },
}

// ── SO Detail Drawer ─────────────────────────────
type DetailType = Awaited<ReturnType<typeof getSalesOrderDetailWithMargin>>['detail']

function SODetailDrawer({ soId, onClose }: { soId: string; onClose: () => void }) {
    const [detail, setDetail] = useState<DetailType>(null)
    const [marginData, setMarginData] = useState<SOMarginData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        getSalesOrderDetailWithMargin(soId).then(result => {
            if (cancelled) return
            setDetail(result.detail)
            setMarginData(result.margin)
            setLoading(false)
        })
        return () => { cancelled = true }
    }, [soId])

    return (
        <>
            <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col" style={{ width: 'min(680px,95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div>
                        <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>
                            {loading ? 'Chi Tiết Đơn Hàng' : `SO: ${detail?.soNo}`}
                        </h3>
                        {detail && <p className="text-xs" style={{ color: '#4A6A7A' }}>{detail.customer.name} · {detail.paymentTerm}</p>}
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center flex-1">
                        <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                    </div>
                ) : !detail ? (
                    <p className="text-center py-8" style={{ color: '#4A6A7A' }}>Không tìm thấy đơn</p>
                ) : (
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                        {/* Negative margin alert banner */}
                        {marginData?.hasNegativeMargin && (
                            <div className="flex items-center gap-3 px-4 py-3 rounded-md"
                                style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.35)' }}>
                                <AlertTriangle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                                <div>
                                    <p className="text-sm font-bold" style={{ color: '#EF4444' }}>⚠ Cảnh Báo Biên Âm</p>
                                    <p className="text-xs mt-0.5" style={{ color: '#FCA5A5' }}>Một hoặc nhiều dòng sản phẩm có giá bán thấp hơn giá vốn. Đơn hàng này đang lỗ!</p>
                                </div>
                            </div>
                        )}

                        {/* Summary KPIs */}
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Tổng Tiền', value: formatVND(Number(detail.totalAmount)), color: '#87CBB9' },
                                { label: 'Sales Rep', value: detail.salesRep.name, color: '#8AAEBB' },
                                { label: 'Kênh', value: detail.channel, color: '#8AAEBB' },
                            ].map(kpi => (
                                <div key={kpi.label} className="p-3 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                    <p className="text-xs" style={{ color: '#4A6A7A' }}>{kpi.label}</p>
                                    <p className="text-sm font-bold mt-1" style={{ color: kpi.color, fontFamily: '"DM Mono"' }}>{kpi.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Margin summary cards */}
                        {marginData && (
                            <div className="grid grid-cols-4 gap-2">
                                <div className="p-2.5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                    <p className="text-[10px] uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Doanh Thu</p>
                                    <p className="text-xs font-bold mt-1" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{formatVND(marginData.totalRevenue)}</p>
                                </div>
                                <div className="p-2.5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                    <p className="text-[10px] uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Giá Vốn (COGS)</p>
                                    <p className="text-xs font-bold mt-1" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>{formatVND(marginData.totalCOGS)}</p>
                                </div>
                                <div className="p-2.5 rounded-md" style={{ background: marginData.totalMargin >= 0 ? 'rgba(91,168,138,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${marginData.totalMargin >= 0 ? 'rgba(91,168,138,0.3)' : 'rgba(220,38,38,0.3)'}` }}>
                                    <p className="text-[10px] uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Lãi Gộp</p>
                                    <p className="text-xs font-bold mt-1" style={{ color: marginData.totalMargin >= 0 ? '#5BA88A' : '#EF4444', fontFamily: '"DM Mono"' }}>
                                        {marginData.totalMargin >= 0 ? '' : '-'}{formatVND(Math.abs(marginData.totalMargin))}
                                    </p>
                                </div>
                                <div className="p-2.5 rounded-md flex items-center gap-2" style={{ background: marginData.totalMarginPct >= 0 ? 'rgba(91,168,138,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${marginData.totalMarginPct >= 0 ? 'rgba(91,168,138,0.3)' : 'rgba(220,38,38,0.3)'}` }}>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Biên LN</p>
                                        <p className="text-xs font-bold mt-1" style={{ color: marginData.totalMarginPct >= 0 ? '#5BA88A' : '#EF4444', fontFamily: '"DM Mono"' }}>
                                            {marginData.totalMarginPct.toFixed(1)}%
                                        </p>
                                    </div>
                                    {marginData.totalMarginPct >= 0
                                        ? <TrendingUp size={14} style={{ color: '#5BA88A' }} />
                                        : <TrendingDown size={14} style={{ color: '#EF4444' }} />
                                    }
                                </div>
                            </div>
                        )}

                        {/* Line items with margin */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A6A7A' }}>Sản Phẩm & Biên Lợi Nhuận ({detail.lines.length} dòng)</p>
                            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: 640 }}>
                                        <thead>
                                            <tr style={{ background: '#142433' }}>
                                                {['SKU', 'SL', 'Giá Bán', 'Thành Tiền', 'Giá Vốn TB', 'Margin', 'Biên %'].map(h => (
                                                    <th key={h} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap" style={{ color: '#4A6A7A' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(marginData?.lines ?? detail.lines.map(l => ({
                                                lineId: l.id,
                                                skuCode: l.product.skuCode,
                                                productName: l.product.productName,
                                                qty: Number(l.qtyOrdered),
                                                unitPrice: Number(l.unitPrice),
                                                lineDiscountPct: Number(l.lineDiscountPct),
                                                revenue: Number(l.qtyOrdered) * Number(l.unitPrice) * (1 - Number(l.lineDiscountPct) / 100),
                                                avgCost: 0, cogs: 0, margin: 0, marginPct: 0, isNegative: false, productId: l.productId,
                                            }))).map(ml => (
                                                <tr key={ml.lineId} style={{
                                                    borderTop: '1px solid #2A4355',
                                                    background: ml.isNegative ? 'rgba(220,38,38,0.06)' : 'transparent',
                                                }}>
                                                    <td className="px-2.5 py-2" title={ml.productName}>
                                                        <span style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{ml.skuCode}</span>
                                                        {ml.isNegative && <AlertTriangle size={10} className="inline ml-1" style={{ color: '#EF4444' }} />}
                                                    </td>
                                                    <td className="px-2.5 py-2 text-right" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{ml.qty}</td>
                                                    <td className="px-2.5 py-2 text-right" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{formatVND(ml.unitPrice)}</td>
                                                    <td className="px-2.5 py-2 text-right font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{formatVND(ml.revenue)}</td>
                                                    <td className="px-2.5 py-2 text-right" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                                                        {ml.avgCost > 0 ? formatVND(ml.avgCost) : <span style={{ color: '#2A4355' }}>—</span>}
                                                    </td>
                                                    <td className="px-2.5 py-2 text-right font-bold" style={{
                                                        color: ml.margin > 0 ? '#5BA88A' : ml.margin < 0 ? '#EF4444' : '#4A6A7A',
                                                        fontFamily: '"DM Mono"',
                                                    }}>
                                                        {ml.avgCost > 0 ? (ml.margin >= 0 ? '' : '-') + formatVND(Math.abs(ml.margin)) : '—'}
                                                    </td>
                                                    <td className="px-2.5 py-2 text-right">
                                                        {ml.avgCost > 0 ? (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{
                                                                background: ml.marginPct >= 20 ? 'rgba(91,168,138,0.15)' : ml.marginPct >= 0 ? 'rgba(212,168,83,0.15)' : 'rgba(220,38,38,0.15)',
                                                                color: ml.marginPct >= 20 ? '#5BA88A' : ml.marginPct >= 0 ? '#D4A853' : '#EF4444',
                                                            }}>
                                                                {ml.marginPct >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                                                {ml.marginPct.toFixed(1)}%
                                                            </span>
                                                        ) : <span style={{ color: '#2A4355' }}>—</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Delivery orders */}
                        {detail.deliveryOrders.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A6A7A' }}>Lệnh Giao Hàng</p>
                                <div className="space-y-1">
                                    {detail.deliveryOrders.map(do_ => (
                                        <div key={do_.id} className="flex items-center justify-between py-1.5 px-3 rounded" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                            <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{do_.doNo}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>{do_.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AR Invoices */}
                        {detail.arInvoices.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A6A7A' }}>Hóa Đơn AR</p>
                                <div className="space-y-1">
                                    {detail.arInvoices.map(inv => (
                                        <div key={inv.id} className="flex items-center justify-between py-1.5 px-3 rounded" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                            <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{inv.invoiceNo}</span>
                                            <span className="text-xs font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{formatVND(Number(inv.amount))}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853' }}>{inv.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}

interface Props {
    initialRows: SalesOrderRow[]
    initialTotal: number
    stats: { monthRevenue: number; monthOrders: number; pendingApproval: number; draft: number; confirmed: number }
    userId: string
}

export function SalesClient({ initialRows, initialTotal, stats, userId }: Props) {
    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<SOStatus | ''>('')
    const [page, setPage] = useState(1)
    const [createOpen, setCreateOpen] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [editId, setEditId] = useState<string | null>(null)

    const reload = useCallback(async (newSearch?: string, newStatus?: string, newPage?: number) => {
        setLoading(true)
        try {
            const result = await getSalesOrders({
                search: (newSearch ?? search) || undefined,
                status: (newStatus ?? statusFilter) as SOStatus || undefined,
                page: newPage ?? page,
                pageSize: 20,
            })
            setRows(result.rows)
            setTotal(result.total)
        } finally {
            setLoading(false)
        }
    }, [search, statusFilter, page])

    const handleConfirm = async (id: string) => {
        setActionLoading(id)
        toast.promise(
            confirmSalesOrder(id).then(() => reload()),
            {
                loading: 'Đang xác nhận...',
                success: 'Xác nhận thành công!',
                error: 'Không thể xác nhận đơn hàng',
                finally: () => setActionLoading(null)
            }
        )
    }

    const handleAdvance = async (id: string, toStatus: SOStatus) => {
        setActionLoading(id)
        toast.promise(
            advanceSalesOrderStatus(id, toStatus).then(() => reload()),
            {
                loading: 'Đang cập nhật trạng thái...',
                success: 'Đã cập nhật trạng thái!',
                error: 'Lỗi cập nhật trạng thái',
                finally: () => setActionLoading(null)
            }
        )
    }

    const handleCancel = async (id: string) => {
        if (!confirm('Huỷ đơn hàng này?')) return
        setActionLoading(id)
        toast.promise(
            cancelSalesOrder(id).then(() => reload()),
            {
                loading: 'Đang huỷ đơn hàng...',
                success: 'Đã huỷ đơn hàng!',
                error: 'Không thể huỷ đơn hàng',
                finally: () => setActionLoading(null)
            }
        )
    }

    const handleApprove = async (id: string) => {
        setActionLoading(id)
        toast.promise(
            approveSalesOrder(id).then(() => reload()),
            {
                loading: 'Đang phê duyệt...',
                success: 'Đã phê duyệt đơn hàng!',
                error: 'Không thể phê duyệt',
                finally: () => setActionLoading(null)
            }
        )
    }

    const handleReject = async (id: string) => {
        if (!confirm('Từ chối đơn hàng này? SO sẽ bị huỷ.')) return
        setActionLoading(id)
        toast.promise(
            rejectSalesOrder(id).then(() => reload()),
            {
                loading: 'Đang từ chối...',
                success: 'Đã từ chối đơn hàng!',
                error: 'Không thể từ chối',
                finally: () => setActionLoading(null)
            }
        )
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Đơn Bán Hàng (SLS)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Quản lý toàn bộ chu trình bán hàng — Quotation → SO → Delivery → Invoice → Payment
                    </p>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all duration-150"
                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}
                >
                    <Plus size={16} /> Tạo Đơn Mới
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <SOStatCard label="Doanh Thu Tháng" value={`₫${(stats.monthRevenue / 1e9).toFixed(1)}T`} accent="#87CBB9" />
                <SOStatCard label="Đơn Tháng Này" value={stats.monthOrders} accent="#5BA88A" />
                <SOStatCard label="Chờ Duyệt" value={stats.pendingApproval} accent="#D4A853" />
                <SOStatCard label="Đã Xác Nhận" value={stats.confirmed} accent="#4A8FAB" />
                <SOStatCard label="Bản Nháp" value={stats.draft} accent="#8AAEBB" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input
                        type="text"
                        placeholder="Tìm số SO, khách hàng..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); reload(e.target.value, undefined, 1); setPage(1) }}
                        className="w-full pl-9 pr-4 py-2.5 text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value as SOStatus | ''); reload(undefined, e.target.value, 1); setPage(1) }}
                    className="px-3 py-2.5 text-sm outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: statusFilter ? '#E8F1F2' : '#4A6A7A', borderRadius: '6px' }}
                >
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(STATUS_CFG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['Số SO', 'Khách Hàng', 'Kênh', 'Doanh Số', 'PT Thanh Toán', 'Sales Rep', 'Trạng Thái', 'Ngày Tạo', 'Hành Động'].map(h => (
                                <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold"
                                    style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={9} className="text-center py-12" style={{ color: '#4A6A7A' }}>
                                    Đang tải...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-16" style={{ color: '#4A6A7A' }}>
                                    <FileText size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                                    <p className="text-sm">Chưa có đơn hàng nào</p>
                                </td>
                            </tr>
                        ) : rows.map(row => (
                            <tr key={row.id}
                                style={{ borderBottom: '1px solid rgba(42,67,85,0.5)', background: 'transparent' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <td className="px-4 py-3">
                                    <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>
                                        {row.soNo}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{row.customerName}</p>
                                    <p className="text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>{row.customerCode}</p>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={{ background: 'rgba(135,203,185,0.1)', color: '#8AAEBB' }}>
                                        {CHANNEL_LABEL[row.channel] ?? row.channel}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-sm font-bold" style={{ fontFamily: '"DM Mono", monospace', color: '#E8F1F2' }}>
                                        {formatVND(row.totalAmount)}
                                    </p>
                                    {row.orderDiscount > 0 && (
                                        <p className="text-xs" style={{ color: '#5BA88A' }}>CK {row.orderDiscount}%</p>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm" style={{ color: '#8AAEBB' }}>{row.paymentTerm}</td>
                                <td className="px-4 py-3 text-sm" style={{ color: '#8AAEBB' }}>{row.salesRepName}</td>
                                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                                <td className="px-4 py-3 text-xs" style={{ color: '#4A6A7A' }}>{formatDate(row.createdAt)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {/* View detail */}
                                        <button onClick={() => setDetailId(row.id)}
                                            className="p-1.5 rounded" title="Chi tiết"
                                            style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.2)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.1)')}>
                                            <Eye size={13} />
                                        </button>
                                        {/* CEO Approve */}
                                        {row.status === 'PENDING_APPROVAL' && (
                                            <button onClick={() => handleApprove(row.id)} disabled={actionLoading === row.id}
                                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold"
                                                style={{ background: 'rgba(91,168,138,0.2)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.4)', borderRadius: '5px' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(91,168,138,0.35)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(91,168,138,0.2)')}
                                            >
                                                {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : <><CheckCircle2 size={12} /> Duyệt</>}
                                            </button>
                                        )}
                                        {/* CEO Reject */}
                                        {row.status === 'PENDING_APPROVAL' && (
                                            <button onClick={() => handleReject(row.id)} disabled={actionLoading === row.id}
                                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold"
                                                style={{ background: 'rgba(139,26,46,0.15)', color: '#E85D5D', border: '1px solid rgba(139,26,46,0.35)', borderRadius: '5px' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,26,46,0.28)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,26,46,0.15)')}
                                            >
                                                {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : <><XCircle size={12} /> Từ Chối</>}
                                            </button>
                                        )}
                                        {/* Confirm */}
                                        {row.status === 'DRAFT' && (
                                            <button onClick={() => handleConfirm(row.id)} disabled={actionLoading === row.id}
                                                className="px-2 py-1 text-xs font-semibold"
                                                style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)', borderRadius: '4px' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(91,168,138,0.25)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(91,168,138,0.15)')}
                                            >
                                                {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : 'Xác Nhận'}
                                            </button>
                                        )}
                                        {/* Edit DRAFT */}
                                        {row.status === 'DRAFT' && (
                                            <button onClick={() => setEditId(row.id)}
                                                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold"
                                                style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', borderRadius: '4px' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,168,83,0.22)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(212,168,83,0.12)')}
                                            >
                                                <Pencil size={11} /> Sửa
                                            </button>
                                        )}
                                        {/* Advance status */}
                                        {SO_NEXT_STATUS[row.status] && (() => {
                                            const next = SO_NEXT_STATUS[row.status]!
                                            return (
                                                <button onClick={() => handleAdvance(row.id, next.status)} disabled={actionLoading === row.id}
                                                    className="flex items-center gap-0.5 px-2 py-1 text-xs font-semibold"
                                                    style={{ background: `${next.color}18`, color: next.color, border: `1px solid ${next.color}40`, borderRadius: '4px' }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = `${next.color}28`)}
                                                    onMouseLeave={e => (e.currentTarget.style.background = `${next.color}18`)}
                                                >
                                                    {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : <><ChevronRight size={11} />{next.label}</>}
                                                </button>
                                            )
                                        })()}
                                        {/* Cancel */}
                                        {['DRAFT', 'CONFIRMED'].includes(row.status) && (
                                            <button onClick={() => handleCancel(row.id)} disabled={actionLoading === row.id}
                                                className="px-2 py-1 text-xs font-semibold"
                                                style={{ background: 'rgba(139,26,46,0.1)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.25)', borderRadius: '4px' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,26,46,0.2)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,26,46,0.1)')}
                                            >Huỷ</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {total > 20 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>
                        Hiển thị {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} / {total} đơn hàng
                    </p>
                    <div className="flex gap-2">
                        {Array.from({ length: Math.ceil(total / 20) }, (_, i) => i + 1).slice(0, 8).map(p => (
                            <button
                                key={p}
                                onClick={() => { setPage(p); reload(undefined, undefined, p) }}
                                className="w-8 h-8 text-sm flex items-center justify-center transition-all"
                                style={{
                                    background: p === page ? 'rgba(135,203,185,0.15)' : 'transparent',
                                    color: p === page ? '#87CBB9' : '#8AAEBB',
                                    border: `1px solid ${p === page ? '#87CBB9' : '#2A4355'}`,
                                    borderRadius: '4px',
                                }}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Drawer */}
            <CreateSODrawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onSaved={() => { setCreateOpen(false); reload() }}
                userId={userId}
            />

            {/* Detail Drawer */}
            {detailId && (
                <SODetailDrawer soId={detailId} onClose={() => setDetailId(null)} />
            )}

            {/* Edit Drawer */}
            {editId && (
                <EditSODrawer
                    open={!!editId}
                    soId={editId}
                    onClose={() => setEditId(null)}
                    onSaved={() => { setEditId(null); reload() }}
                />
            )}
        </div>
    )
}
