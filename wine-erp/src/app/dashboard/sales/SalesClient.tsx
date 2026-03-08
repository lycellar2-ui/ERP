'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Search, FileText, CheckCircle2, XCircle, Clock, Truck, ReceiptText, DollarSign, Eye, Loader2, X, AlertTriangle, TrendingUp, TrendingDown, Pencil, Copy, Download, ArrowUpDown, Calendar, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { SalesOrderRow, SOStatus, getSalesOrders, confirmSalesOrder, cancelSalesOrder, getSalesOrderDetailWithMargin, SOMarginData, approveSalesOrder, rejectSalesOrder, getSOTimeline, SOTimelineEvent, cloneSalesOrder, exportSalesOrdersCSV } from './actions'
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
    HORECA: 'HORECA', WHOLESALE_DISTRIBUTOR: 'Đại Lý', VIP_RETAIL: 'VIP', DIRECT_INDIVIDUAL: 'Trực Tiếp',
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

// ── Quick Filter Tabs ────────────────────────────
const TAB_ORDER: (SOStatus | 'ALL')[] = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID', 'CANCELLED']
const TAB_LABELS: Record<string, string> = {
    ALL: 'Tất cả', DRAFT: 'Nháp', PENDING_APPROVAL: 'Chờ Duyệt', CONFIRMED: 'Đã XN',
    PARTIALLY_DELIVERED: 'Giao 1 phần', DELIVERED: 'Đã Giao', INVOICED: 'Xuất HĐ', PAID: 'Đã TT', CANCELLED: 'Huỷ',
}

function FilterTabs({ active, counts, onChange }: { active: string; counts: Record<string, number>; onChange: (s: SOStatus | '') => void }) {
    return (
        <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {TAB_ORDER.filter(t => t === 'ALL' || (counts[t] ?? 0) > 0).map(tab => {
                const isActive = (tab === 'ALL' && active === '') || tab === active
                const count = tab === 'ALL' ? counts.ALL ?? 0 : counts[tab] ?? 0
                return (
                    <button key={tab} onClick={() => onChange(tab === 'ALL' ? '' : tab as SOStatus)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-all"
                        style={{
                            background: isActive ? 'rgba(135,203,185,0.15)' : 'transparent',
                            color: isActive ? '#87CBB9' : '#4A6A7A',
                            border: `1px solid ${isActive ? 'rgba(135,203,185,0.3)' : 'transparent'}`,
                        }}
                        onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'rgba(135,203,185,0.06)')}
                        onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}>
                        {TAB_LABELS[tab]}
                        <span className="px-1.5 py-0.5 text-[10px] rounded-full font-bold"
                            style={{ background: isActive ? 'rgba(135,203,185,0.2)' : 'rgba(74,106,122,0.15)', color: isActive ? '#87CBB9' : '#4A6A7A' }}>
                            {count}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

// ── Sortable Column Header ───────────────────────
function SortHeader({ label, field, current, dir, onSort }: { label: string; field: string; current: string; dir: string; onSort: (f: string) => void }) {
    const isActive = current === field
    return (
        <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold cursor-pointer select-none"
            style={{ color: isActive ? '#87CBB9' : '#4A6A7A' }}
            onClick={() => onSort(field)}>
            <span className="inline-flex items-center gap-1">
                {label}
                {isActive ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={10} style={{ opacity: 0.4 }} />}
            </span>
        </th>
    )
}

// ── SO Detail Drawer (Enhanced with Tabs) ────────
type DetailType = Awaited<ReturnType<typeof getSalesOrderDetailWithMargin>>['detail']

function SODetailDrawer({ soId, onClose, onClone }: { soId: string; onClose: () => void; onClone: (id: string) => void }) {
    const [detail, setDetail] = useState<DetailType>(null)
    const [marginData, setMarginData] = useState<SOMarginData | null>(null)
    const [timeline, setTimeline] = useState<SOTimelineEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'docs' | 'history'>('overview')

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setActiveTab('overview')
        Promise.all([
            getSalesOrderDetailWithMargin(soId),
            getSOTimeline(soId),
        ]).then(([result, tl]) => {
            if (cancelled) return
            setDetail(result.detail)
            setMarginData(result.margin)
            setTimeline(tl)
            setLoading(false)
        })
        return () => { cancelled = true }
    }, [soId])

    const TABS = [
        { key: 'overview', label: 'Tổng Quan' },
        { key: 'products', label: `Sản Phẩm (${detail?.lines.length ?? 0})` },
        { key: 'docs', label: 'Giao Hàng & Tài Chính' },
        { key: 'history', label: `Lịch Sử (${timeline.length})` },
    ] as const

    const ACTION_ICON: Record<string, string> = {
        CREATE: '📝', UPDATE: '✏️', CONFIRM: '✅', APPROVE: '👍', REJECT: '❌',
        STATUS_CHANGE: '🔄', DELETE: '🗑️', EXPORT: '📤', SIGN: '🖊️',
    }

    return (
        <>
            <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col" style={{ width: 'min(720px,95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div>
                        <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>
                            {loading ? 'Chi Tiết Đơn Hàng' : `SO: ${detail?.soNo}`}
                        </h3>
                        {detail && (
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs" style={{ color: '#4A6A7A' }}>{detail.customer.name} · {detail.paymentTerm}</p>
                                <StatusBadge status={detail.status as SOStatus} />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {detail && (
                            <button onClick={() => onClone(soId)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md"
                                style={{ background: 'rgba(138,174,187,0.12)', color: '#8AAEBB', border: '1px solid rgba(138,174,187,0.25)' }}
                                title="Tạo đơn tương tự">
                                <Copy size={12} /> Clone
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                    </div>
                </div>

                {/* Tabs */}
                {!loading && detail && (
                    <div className="flex gap-0 px-6" style={{ borderBottom: '1px solid #2A4355' }}>
                        {TABS.map(t => (
                            <button key={t.key} onClick={() => setActiveTab(t.key)}
                                className="px-4 py-2.5 text-xs font-semibold transition-all relative"
                                style={{ color: activeTab === t.key ? '#87CBB9' : '#4A6A7A' }}>
                                {t.label}
                                {activeTab === t.key && <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ background: '#87CBB9' }} />}
                            </button>
                        ))}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center flex-1">
                        <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                    </div>
                ) : !detail ? (
                    <p className="text-center py-8" style={{ color: '#4A6A7A' }}>Không tìm thấy đơn</p>
                ) : (
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                        {/* ── TAB: Overview ── */}
                        {activeTab === 'overview' && (
                            <>
                                {marginData?.hasNegativeMargin && (
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-md"
                                        style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.35)' }}>
                                        <AlertTriangle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: '#EF4444' }}>⚠ Cảnh Báo Biên Âm</p>
                                            <p className="text-xs mt-0.5" style={{ color: '#FCA5A5' }}>Một hoặc nhiều dòng có giá bán thấp hơn giá vốn!</p>
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Tổng Tiền', value: formatVND(Number(detail.totalAmount)), color: '#87CBB9' },
                                        { label: 'Sales Rep', value: detail.salesRep.name, color: '#8AAEBB' },
                                        { label: 'Kênh', value: CHANNEL_LABEL[detail.channel] ?? detail.channel, color: '#8AAEBB' },
                                    ].map(kpi => (
                                        <div key={kpi.label} className="p-3 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                            <p className="text-xs" style={{ color: '#4A6A7A' }}>{kpi.label}</p>
                                            <p className="text-sm font-bold mt-1" style={{ color: kpi.color, fontFamily: '"DM Mono"' }}>{kpi.value}</p>
                                        </div>
                                    ))}
                                </div>
                                {marginData && (
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="p-2.5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                            <p className="text-[10px] uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Doanh Thu</p>
                                            <p className="text-xs font-bold mt-1" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{formatVND(marginData.totalRevenue)}</p>
                                        </div>
                                        <div className="p-2.5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                            <p className="text-[10px] uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Giá Vốn</p>
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
                                            {marginData.totalMarginPct >= 0 ? <TrendingUp size={14} style={{ color: '#5BA88A' }} /> : <TrendingDown size={14} style={{ color: '#EF4444' }} />}
                                        </div>
                                    </div>
                                )}
                                {/* Status Progress */}
                                <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A6A7A' }}>Tiến Trình</p>
                                    <div className="flex items-center gap-1">
                                        {(['DRAFT', 'CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID'] as SOStatus[]).map((s, i) => {
                                            const steps: SOStatus[] = ['DRAFT', 'CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID']
                                            const currentIdx = steps.indexOf(detail.status as SOStatus)
                                            const stepIdx = i
                                            const isDone = stepIdx <= currentIdx
                                            const isCurrent = s === detail.status
                                            return (
                                                <div key={s} className="flex items-center gap-1 flex-1">
                                                    <div className="flex flex-col items-center flex-1">
                                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                                                            style={{
                                                                background: isDone ? 'rgba(91,168,138,0.25)' : 'rgba(42,67,85,0.5)',
                                                                color: isDone ? '#5BA88A' : '#4A6A7A',
                                                                border: isCurrent ? '2px solid #87CBB9' : '1px solid transparent',
                                                            }}>
                                                            {isDone ? '✓' : stepIdx + 1}
                                                        </div>
                                                        <p className="text-[9px] mt-1 text-center" style={{ color: isDone ? '#87CBB9' : '#4A6A7A' }}>
                                                            {STATUS_CFG[s]?.label}
                                                        </p>
                                                    </div>
                                                    {i < 4 && <div className="h-[2px] flex-1 rounded" style={{ background: isDone && stepIdx < currentIdx ? '#5BA88A' : '#2A4355', marginBottom: 16 }} />}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── TAB: Products ── */}
                        {activeTab === 'products' && (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A6A7A' }}>Sản Phẩm & Biên Lợi Nhuận ({detail.lines.length} dòng)</p>
                                <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: 640 }}>
                                            <thead><tr style={{ background: '#142433' }}>
                                                {['SKU', 'SL', 'Giá Bán', 'Thành Tiền', 'Giá Vốn TB', 'Margin', 'Biên %'].map(h => (
                                                    <th key={h} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap" style={{ color: '#4A6A7A' }}>{h}</th>
                                                ))}
                                            </tr></thead>
                                            <tbody>
                                                {(marginData?.lines ?? detail.lines.map(l => ({
                                                    lineId: l.id, skuCode: l.product.skuCode, productName: l.product.productName,
                                                    qty: Number(l.qtyOrdered), unitPrice: Number(l.unitPrice), lineDiscountPct: Number(l.lineDiscountPct),
                                                    revenue: Number(l.qtyOrdered) * Number(l.unitPrice) * (1 - Number(l.lineDiscountPct) / 100),
                                                    avgCost: 0, cogs: 0, margin: 0, marginPct: 0, isNegative: false, productId: l.productId,
                                                }))).map(ml => (
                                                    <tr key={ml.lineId} style={{ borderTop: '1px solid #2A4355', background: ml.isNegative ? 'rgba(220,38,38,0.06)' : 'transparent' }}>
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
                                                        <td className="px-2.5 py-2 text-right font-bold" style={{ color: ml.margin > 0 ? '#5BA88A' : ml.margin < 0 ? '#EF4444' : '#4A6A7A', fontFamily: '"DM Mono"' }}>
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
                        )}

                        {/* ── TAB: Delivery & Finance ── */}
                        {activeTab === 'docs' && (
                            <>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A6A7A' }}>Lệnh Giao Hàng ({detail.deliveryOrders.length})</p>
                                    {detail.deliveryOrders.length === 0 ? (
                                        <p className="text-xs py-4 text-center" style={{ color: '#2A4355' }}>Chưa tạo DO</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {detail.deliveryOrders.map(do_ => (
                                                <div key={do_.id} className="flex items-center justify-between py-2 px-3 rounded" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                                    <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{do_.doNo}</span>
                                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>{do_.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A6A7A' }}>Hóa Đơn AR ({detail.arInvoices.length})</p>
                                    {detail.arInvoices.length === 0 ? (
                                        <p className="text-xs py-4 text-center" style={{ color: '#2A4355' }}>Chưa có hóa đơn</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {detail.arInvoices.map(inv => (
                                                <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                                    <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{inv.invoiceNo}</span>
                                                    <span className="text-xs font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{formatVND(Number(inv.amount))}</span>
                                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853' }}>{inv.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* ── TAB: Timeline ── */}
                        {activeTab === 'history' && (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A6A7A' }}>Lịch Sử Hoạt Động</p>
                                {timeline.length === 0 ? (
                                    <p className="text-xs py-8 text-center" style={{ color: '#2A4355' }}>Chưa có lịch sử</p>
                                ) : (
                                    <div className="space-y-0 relative">
                                        <div className="absolute left-3 top-2 bottom-2 w-[2px]" style={{ background: '#2A4355' }} />
                                        {timeline.map((ev, i) => (
                                            <div key={ev.id} className="flex gap-3 py-2 relative">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0 z-10"
                                                    style={{ background: '#1B2E3D', border: '2px solid #2A4355' }}>
                                                    {ACTION_ICON[ev.action] ?? '●'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold" style={{ color: '#87CBB9' }}>{ev.action}</span>
                                                        {ev.userName && <span className="text-xs" style={{ color: '#4A6A7A' }}>— {ev.userName}</span>}
                                                    </div>
                                                    {ev.description && <p className="text-xs mt-0.5 truncate" style={{ color: '#8AAEBB' }}>{ev.description}</p>}
                                                    <p className="text-[10px] mt-0.5" style={{ color: '#2A4355' }}>{formatDate(ev.createdAt)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}

// ── Main Component ───────────────────────────────
interface Props {
    initialRows: SalesOrderRow[]
    initialTotal: number
    stats: { monthRevenue: number; monthOrders: number; pendingApproval: number; draft: number; confirmed: number }
    userId: string
    statusCounts: Record<string, number>
}

export function SalesClient({ initialRows, initialTotal, stats, userId, statusCounts }: Props) {
    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<SOStatus | ''>('')
    const [page, setPage] = useState(1)
    const [sortBy, setSortBy] = useState<'createdAt' | 'totalAmount' | 'soNo'>('createdAt')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [createOpen, setCreateOpen] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [editId, setEditId] = useState<string | null>(null)
    const [counts, setCounts] = useState(statusCounts)

    const reload = useCallback(async (overrides?: Partial<{ search: string; status: string; page: number; sortBy: string; sortDir: string; dateFrom: string; dateTo: string }>) => {
        setLoading(true)
        try {
            const result = await getSalesOrders({
                search: (overrides?.search ?? search) || undefined,
                status: (overrides?.status ?? statusFilter) as SOStatus || undefined,
                page: overrides?.page ?? page,
                pageSize: 20,
                sortBy: (overrides?.sortBy ?? sortBy) as any,
                sortDir: (overrides?.sortDir ?? sortDir) as any,
                dateFrom: (overrides?.dateFrom ?? dateFrom) || undefined,
                dateTo: (overrides?.dateTo ?? dateTo) || undefined,
            })
            setRows(result.rows)
            setTotal(result.total)
        } finally {
            setLoading(false)
        }
    }, [search, statusFilter, page, sortBy, sortDir, dateFrom, dateTo])

    const handleSort = (field: string) => {
        const newDir = sortBy === field && sortDir === 'desc' ? 'asc' : 'desc'
        setSortBy(field as any)
        setSortDir(newDir)
        reload({ sortBy: field, sortDir: newDir, page: 1 })
        setPage(1)
    }

    const handleStatusTab = (s: SOStatus | '') => {
        setStatusFilter(s)
        setPage(1)
        reload({ status: s, page: 1 })
    }

    const handleConfirm = async (id: string) => {
        setActionLoading(id)
        toast.promise(confirmSalesOrder(id).then(() => reload()), {
            loading: 'Đang xác nhận...', success: 'Xác nhận thành công!', error: 'Không thể xác nhận đơn hàng', finally: () => setActionLoading(null)
        })
    }

    const handleCancel = async (id: string) => {
        if (!confirm('Huỷ đơn hàng này?')) return
        setActionLoading(id)
        toast.promise(cancelSalesOrder(id).then(() => reload()), {
            loading: 'Đang huỷ...', success: 'Đã huỷ đơn hàng!', error: 'Không thể huỷ', finally: () => setActionLoading(null)
        })
    }

    const handleApprove = async (id: string) => {
        setActionLoading(id)
        toast.promise(approveSalesOrder(id).then(() => reload()), {
            loading: 'Đang phê duyệt...', success: 'Đã phê duyệt!', error: 'Không thể phê duyệt', finally: () => setActionLoading(null)
        })
    }

    const handleReject = async (id: string) => {
        if (!confirm('Từ chối đơn hàng này?')) return
        setActionLoading(id)
        toast.promise(rejectSalesOrder(id).then(() => reload()), {
            loading: 'Đang từ chối...', success: 'Đã từ chối!', error: 'Không thể từ chối', finally: () => setActionLoading(null)
        })
    }

    const handleClone = async (id: string) => {
        toast.promise(cloneSalesOrder(id).then(r => { if (!r.success) throw new Error(r.error); reload(); return r }), {
            loading: 'Đang tạo bản sao...', success: (r) => `Clone thành công: ${r.soNo}`, error: (e: any) => `Lỗi: ${e.message}`,
        })
    }

    const handleExport = async () => {
        toast.promise(
            exportSalesOrdersCSV({ status: statusFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }).then(({ csv }) => {
                const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `sales-orders-${new Date().toISOString().split('T')[0]}.csv`
                a.click(); URL.revokeObjectURL(url)
            }),
            { loading: 'Đang xuất...', success: 'Đã tải xuống!', error: 'Lỗi xuất file' }
        )
    }

    return (
        <div className="space-y-5 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Đơn Bán Hàng (SLS)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Quản lý toàn bộ chu trình — Quotation → SO → Delivery → Invoice → Payment
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleExport}
                        className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-all rounded-md"
                        style={{ background: 'rgba(138,174,187,0.1)', color: '#8AAEBB', border: '1px solid rgba(138,174,187,0.25)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(138,174,187,0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(138,174,187,0.1)')}>
                        <Download size={14} /> Excel
                    </button>
                    <button onClick={() => setCreateOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all duration-150"
                        style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                        <Plus size={16} /> Tạo Đơn Mới
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <SOStatCard label="Doanh Thu Tháng" value={`₫${(stats.monthRevenue / 1e9).toFixed(1)}T`} accent="#87CBB9" />
                <SOStatCard label="Đơn Tháng Này" value={stats.monthOrders} accent="#5BA88A" />
                <SOStatCard label="Chờ Duyệt" value={stats.pendingApproval} accent="#D4A853" />
                <SOStatCard label="Đã Xác Nhận" value={stats.confirmed} accent="#4A8FAB" />
                <SOStatCard label="Bản Nháp" value={stats.draft} accent="#8AAEBB" />
            </div>

            {/* Quick Filter Tabs */}
            <FilterTabs active={statusFilter} counts={counts} onChange={handleStatusTab} />

            {/* Search + Date Range */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input type="text" placeholder="Tìm số SO, khách hàng..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); reload({ search: e.target.value, page: 1 }) }}
                        className="w-full pl-9 pr-4 py-2.5 text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                </div>
                <div className="flex items-center gap-2">
                    <Calendar size={14} style={{ color: '#4A6A7A' }} />
                    <input type="date" value={dateFrom}
                        onChange={e => { setDateFrom(e.target.value); setPage(1); reload({ dateFrom: e.target.value, page: 1 }) }}
                        className="px-2.5 py-2 text-xs outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB', borderRadius: '4px' }} />
                    <span className="text-xs" style={{ color: '#4A6A7A' }}>→</span>
                    <input type="date" value={dateTo}
                        onChange={e => { setDateTo(e.target.value); setPage(1); reload({ dateTo: e.target.value, page: 1 }) }}
                        className="px-2.5 py-2 text-xs outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB', borderRadius: '4px' }} />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse', minWidth: 900 }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                <SortHeader label="Số SO" field="soNo" current={sortBy} dir={sortDir} onSort={handleSort} />
                                <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>Khách Hàng</th>
                                <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>Kênh</th>
                                <SortHeader label="Doanh Số" field="totalAmount" current={sortBy} dir={sortDir} onSort={handleSort} />
                                <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>Sales Rep</th>
                                <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>Trạng Thái</th>
                                <SortHeader label="Ngày Tạo" field="createdAt" current={sortBy} dir={sortDir} onSort={handleSort} />
                                <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>Hành Động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="text-center py-12" style={{ color: '#4A6A7A' }}>
                                    <Loader2 size={20} className="inline animate-spin mr-2" />Đang tải...
                                </td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-16" style={{ color: '#4A6A7A' }}>
                                    <FileText size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                                    <p className="text-sm">Chưa có đơn hàng nào</p>
                                </td></tr>
                            ) : rows.map(row => (
                                <tr key={row.id}
                                    style={{ borderBottom: '1px solid rgba(42,67,85,0.5)', background: 'transparent' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{row.soNo}</span>
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
                                        <p className="text-sm font-bold" style={{ fontFamily: '"DM Mono", monospace', color: '#E8F1F2' }}>{formatVND(row.totalAmount)}</p>
                                        {row.orderDiscount > 0 && <p className="text-xs" style={{ color: '#5BA88A' }}>CK {row.orderDiscount}%</p>}
                                    </td>
                                    <td className="px-4 py-3 text-sm" style={{ color: '#8AAEBB' }}>{row.salesRepName}</td>
                                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                                    <td className="px-4 py-3 text-xs" style={{ color: '#4A6A7A' }}>{formatDate(row.createdAt)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <button onClick={() => setDetailId(row.id)} className="p-1.5 rounded" title="Chi tiết"
                                                style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.2)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.1)')}>
                                                <Eye size={13} />
                                            </button>
                                            {row.status === 'PENDING_APPROVAL' && (
                                                <button onClick={() => handleApprove(row.id)} disabled={actionLoading === row.id}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold"
                                                    style={{ background: 'rgba(91,168,138,0.2)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.4)', borderRadius: '5px' }}>
                                                    {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : <><CheckCircle2 size={12} /> Duyệt</>}
                                                </button>
                                            )}
                                            {row.status === 'PENDING_APPROVAL' && (
                                                <button onClick={() => handleReject(row.id)} disabled={actionLoading === row.id}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold"
                                                    style={{ background: 'rgba(139,26,46,0.15)', color: '#E85D5D', border: '1px solid rgba(139,26,46,0.35)', borderRadius: '5px' }}>
                                                    {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : <><XCircle size={12} /> Từ Chối</>}
                                                </button>
                                            )}
                                            {row.status === 'DRAFT' && (
                                                <button onClick={() => handleConfirm(row.id)} disabled={actionLoading === row.id}
                                                    className="px-2 py-1 text-xs font-semibold"
                                                    style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)', borderRadius: '4px' }}>
                                                    {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : 'Xác Nhận'}
                                                </button>
                                            )}
                                            {row.status === 'DRAFT' && (
                                                <button onClick={() => setEditId(row.id)}
                                                    className="flex items-center gap-1 px-2 py-1 text-xs font-semibold"
                                                    style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', borderRadius: '4px' }}>
                                                    <Pencil size={11} /> Sửa
                                                </button>
                                            )}
                                            {['DRAFT', 'CONFIRMED'].includes(row.status) && (
                                                <button onClick={() => handleCancel(row.id)} disabled={actionLoading === row.id}
                                                    className="px-2 py-1 text-xs font-semibold"
                                                    style={{ background: 'rgba(139,26,46,0.1)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.25)', borderRadius: '4px' }}>
                                                    Huỷ
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {total > 20 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>
                        Hiển thị {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} / {total} đơn hàng
                    </p>
                    <div className="flex gap-2">
                        {Array.from({ length: Math.ceil(total / 20) }, (_, i) => i + 1).slice(0, 8).map(p => (
                            <button key={p} onClick={() => { setPage(p); reload({ page: p }) }}
                                className="w-8 h-8 text-sm flex items-center justify-center transition-all"
                                style={{
                                    background: p === page ? 'rgba(135,203,185,0.15)' : 'transparent',
                                    color: p === page ? '#87CBB9' : '#8AAEBB',
                                    border: `1px solid ${p === page ? '#87CBB9' : '#2A4355'}`, borderRadius: '4px',
                                }}>
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <CreateSODrawer open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); reload() }} userId={userId} />
            {detailId && <SODetailDrawer soId={detailId} onClose={() => setDetailId(null)} onClone={handleClone} />}
            {editId && <EditSODrawer open={!!editId} soId={editId} onClose={() => setEditId(null)} onSaved={() => { setEditId(null); reload() }} />}
        </div>
    )
}
