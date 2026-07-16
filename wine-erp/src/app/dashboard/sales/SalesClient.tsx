'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Plus, Search, FileText, CheckCircle2, XCircle, Clock, Truck, ReceiptText, DollarSign, Eye, Loader2, X, AlertTriangle, TrendingUp, TrendingDown, Pencil, Copy, Download, ArrowUpDown, Calendar, ChevronUp, ChevronDown, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { SalesOrderRow, SOStatus, confirmSalesOrder, cancelSalesOrder, getSalesOrderDetailWithMargin, getSalesOrderDetailWithMarginAndTimeline, SOMarginData, approveSalesOrder, rejectSalesOrder, getSOTimeline, SOTimelineEvent, cloneSalesOrder, exportSalesOrdersCSV, accountingApproveSO, accountingRejectSO, getLegalEntities, LegalEntityRow, deleteSalesOrder, getSalesPageData, getAvailableVintagesForProducts, getSimpleWarehouses, getSalesOrderDetail } from './actions'
import { formatVND, formatDate } from '@/lib/utils'
import dynamic from 'next/dynamic'

const CreateSODrawer = dynamic(() => import('./CreateSODrawer').then(m => m.CreateSODrawer), {
    loading: () => null,
    ssr: false
})
const EditSODrawer = dynamic(() => import('./EditSODrawer').then(m => m.EditSODrawer), {
    loading: () => null,
    ssr: false
})

const STATUS_CFG: Record<SOStatus, { label: string; color: string; bg: string; icon: React.FC<any> }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)', icon: FileText },
    PENDING_APPROVAL: { label: 'Chờ Duyệt', color: '#D4A853', bg: 'rgba(212,168,83,0.15)', icon: Clock },
    PENDING_ACCOUNTING: { label: 'Chờ KT Duyệt', color: '#0891B2', bg: 'rgba(8,145,178,0.12)', icon: Clock },
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

const getPriceBadgeStyle = (source: string | null) => {
    switch (source) {
        case 'SPECIAL_PRICE':
            return { background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)' }
        case 'FIXED_PRICE':
            return { background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }
        case 'FIXED_DISCOUNT':
            return { background: 'rgba(230,138,0,0.15)', color: '#E68A00', border: '1px solid rgba(230,138,0,0.3)' }
        case 'CHANNEL_BASE':
            return { background: 'rgba(91,168,138,0.1)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.2)' }
        case 'RETAIL_FALLBACK':
            return { background: 'rgba(138,180,248,0.1)', color: '#8AB4F8', border: '1px solid rgba(138,180,248,0.2)' }
        default:
            return { background: 'rgba(74,106,122,0.1)', color: '#4A6A7A', border: '1px solid rgba(74,106,122,0.2)' }
    }
}

const getPriceBadgeLabel = (source: string | null) => {
    switch (source) {
        case 'SPECIAL_PRICE':
            return 'Giá Đặc Biệt'
        case 'FIXED_PRICE':
            return 'Giá Riêng'
        case 'FIXED_DISCOUNT':
            return 'CK Cố Định'
        case 'CHANNEL_BASE':
            return 'Giá Kênh'
        case 'RETAIL_FALLBACK':
            return 'Bán Lẻ Mặc Định'
        default:
            return 'Mặc Định'
    }
}

function StatusBadge({ status, approvalStep }: { status: SOStatus; approvalStep?: number | null }) {
    const cfg = STATUS_CFG[status]
    const Icon = cfg.icon
    let label = cfg.label
    if (status === 'PENDING_APPROVAL') {
        if (approvalStep === 1) {
            label = 'Chờ Sale Admin duyệt'
        } else if (approvalStep === 2) {
            label = 'Chờ CEO duyệt'
        } else {
            label = 'Chờ Duyệt'
        }
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full"
            style={{ color: cfg.color, background: cfg.bg }}>
            <Icon size={11} />
            {label}
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
const TAB_ORDER: (SOStatus | 'ALL')[] = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'PENDING_ACCOUNTING', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID', 'CANCELLED']
const TAB_LABELS: Record<string, string> = {
    ALL: 'Tất cả', DRAFT: 'Nháp', PENDING_APPROVAL: 'Chờ CEO', PENDING_ACCOUNTING: 'Chờ KT',
    CONFIRMED: 'Đã XN',
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
type DetailType = Awaited<ReturnType<typeof getSalesOrderDetail>>

function SODetailDrawer({ soId, onClose, onClone, canSeeMargin }: { soId: string; onClose: () => void; onClone: (id: string) => void; canSeeMargin: boolean }) {
    const [detail, setDetail] = useState<DetailType>(null)
    const [marginData, setMarginData] = useState<SOMarginData | null>(null)
    const [timeline, setTimeline] = useState<SOTimelineEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [timelineLoading, setTimelineLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setTimelineLoading(true)
        setMarginData(null)
        setTimeline([])

        // 1. Fetch basic details concurrently (Instant response!)
        getSalesOrderDetail(soId).then(detailData => {
            if (cancelled) return
            setDetail(detailData)
            setLoading(false)
        }).catch(err => {
            if (!cancelled) {
                toast.error('Lỗi khi tải chi tiết đơn hàng: ' + err.message)
                setLoading(false)
            }
        })

        // 2. Fetch timeline concurrently
        getSOTimeline(soId).then(timelineData => {
            if (cancelled) return
            setTimeline(timelineData)
            setTimelineLoading(false)
        }).catch(() => {
            if (!cancelled) setTimelineLoading(false)
        })

        // 3. Fetch margins concurrently (only if allowed)
        if (canSeeMargin) {
            getSalesOrderDetailWithMargin(soId).then(res => {
                if (cancelled) return
                setMarginData(res.margin)
            }).catch(() => {})
        }

        return () => { cancelled = true }
    }, [soId, canSeeMargin])

    const ACTION_ICON: Record<string, string> = {
        CREATE: '📝', UPDATE: '✏️', CONFIRM: '✅', APPROVE: '👍', REJECT: '❌',
        STATUS_CHANGE: '🔄', DELETE: '🗑️', EXPORT: '📤', SIGN: '🖊️',
    }

    return (
        <>
            <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col w-full md:w-[740px]" style={{ background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div>
                        <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>
                            {loading ? 'Chi Tiết Đơn Hàng' : `SO: ${detail?.soNo}`}
                        </h3>
                        {detail && (
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs" style={{ color: '#4A6A7A' }}>{detail.customer.name} · {detail.paymentTerm}</p>
                                <StatusBadge status={detail.status as SOStatus} approvalStep={(detail as any).approvalStep} />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {detail && (
                            <>
                                <button onClick={() => window.open(`/dashboard/sales/print?id=${soId}`, '_blank')}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md"
                                    style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.25)' }}
                                    title="In ấn đơn hàng">
                                    <Printer size={12} /> In Đơn
                                </button>
                                <button onClick={() => onClone(soId)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md"
                                    style={{ background: 'rgba(138,174,187,0.12)', color: '#8AAEBB', border: '1px solid rgba(138,174,187,0.25)' }}
                                    title="Tạo đơn tương tự">
                                    <Copy size={12} /> Clone
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center flex-1">
                        <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                    </div>
                ) : !detail ? (
                    <p className="text-center py-8" style={{ color: '#4A6A7A' }}>Không tìm thấy đơn</p>
                ) : (
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                        
                        {/* 1. WARNING BANNER & PROGRESS STATUS */}
                        {marginData?.hasNegativeMargin && canSeeMargin && (
                            <div className="flex items-center gap-3 px-4 py-3 rounded-md"
                                style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.35)' }}>
                                <AlertTriangle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                                <div>
                                    <p className="text-sm font-bold" style={{ color: '#EF4444' }}>⚠️ Cảnh Báo Biên Âm</p>
                                    <p className="text-xs mt-0.5" style={{ color: '#FCA5A5' }}>Một hoặc nhiều dòng có giá bán thấp hơn giá vốn!</p>
                                </div>
                            </div>
                        )}

                        <div className="p-4 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A6A7A' }}>Tiến Trình Đơn Hàng</p>
                            <div className="flex items-center gap-1">
                                {(['DRAFT', 'PENDING_ACCOUNTING', 'CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID'] as SOStatus[]).map((s, i) => {
                                    const steps: SOStatus[] = ['DRAFT', 'PENDING_ACCOUNTING', 'CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID']
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
                                                <p className="text-[9px] mt-1 text-center hidden sm:block" style={{ color: isDone ? '#87CBB9' : '#4A6A7A' }}>
                                                    {STATUS_CFG[s]?.label}
                                                </p>
                                            </div>
                                            {i < 5 && <div className="h-[2px] flex-1 rounded mb-0 sm:mb-4" style={{ background: isDone && stepIdx < currentIdx ? '#5BA88A' : '#2A4355' }} />}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* 2. GENERAL INFO & FINANCES MARGIN */}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Thông Tin Tổng Quan</p>
                            
                            {canSeeMargin && !marginData && (
                                <div className="p-3 rounded-md flex items-center justify-center gap-2" style={{ background: '#142433', border: '1px dashed #2A4355' }}>
                                    <Loader2 size={12} className="animate-spin text-[#D4A853]" />
                                    <span className="text-xs" style={{ color: '#4A6A7A' }}>Đang tính toán giá vốn & margin trong nền...</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    { label: 'Tổng Giá Trị Đơn', value: formatVND(Number(detail.totalAmount)), color: '#87CBB9' },
                                    { label: 'Nhân Viên Kinh Doanh', value: detail.salesRep.name, color: '#8AAEBB' },
                                    { label: 'Kênh Bán Hàng', value: CHANNEL_LABEL[detail.channel] ?? detail.channel, color: '#8AAEBB' },
                                ].map(kpi => (
                                    <div key={kpi.label} className="p-3 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>{kpi.label}</p>
                                        <p className="text-sm font-bold mt-1" style={{ color: kpi.color, fontFamily: '"DM Mono"' }}>{kpi.value}</p>
                                    </div>
                                ))}
                            </div>

                            {marginData && canSeeMargin && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div className="p-2.5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                        <p className="text-[10px] uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Doanh Thu Net</p>
                                        <p className="text-xs font-bold mt-1" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{formatVND(marginData.totalRevenue)}</p>
                                    </div>
                                    <div className="p-2.5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                        <p className="text-[10px] uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Tổng Giá Vốn</p>
                                        <p className="text-xs font-bold mt-1" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>{formatVND(marginData.totalCOGS)}</p>
                                    </div>
                                    <div className="p-2.5 rounded-md" style={{ background: marginData.totalMargin >= 0 ? 'rgba(91,168,138,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${marginData.totalMargin >= 0 ? 'rgba(91,168,138,0.3)' : 'rgba(220,38,38,0.3)'}` }}>
                                        <p className="text-[10px] uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Lợi Nhuận Gộp</p>
                                        <p className="text-xs font-bold mt-1" style={{ color: marginData.totalMargin >= 0 ? '#5BA88A' : '#EF4444', fontFamily: '"DM Mono"' }}>
                                            {marginData.totalMargin >= 0 ? '' : '-'}{formatVND(Math.abs(marginData.totalMargin))}
                                        </p>
                                    </div>
                                    <div className="p-2.5 rounded-md flex items-center justify-between gap-1" style={{ background: marginData.totalMarginPct >= 0 ? 'rgba(91,168,138,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${marginData.totalMarginPct >= 0 ? 'rgba(91,168,138,0.3)' : 'rgba(220,38,38,0.3)'}` }}>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Biên Lợi Nhuận</p>
                                            <p className="text-xs font-bold mt-1" style={{ color: marginData.totalMarginPct >= 0 ? '#5BA88A' : '#EF4444', fontFamily: '"DM Mono"' }}>
                                                {marginData.totalMarginPct.toFixed(1)}%
                                            </p>
                                        </div>
                                        {marginData.totalMarginPct >= 0 ? <TrendingUp size={14} style={{ color: '#5BA88A' }} /> : <TrendingDown size={14} style={{ color: '#EF4444' }} />}
                                    </div>
                                </div>
                            )}

                            {marginData && !canSeeMargin && (
                                <div className="p-3 rounded-md flex items-center justify-center gap-2" style={{ background: 'rgba(74,106,122,0.08)', border: '1px dashed #2A4355' }}>
                                    <span className="text-xs text-center" style={{ color: '#4A6A7A' }}>🔒 Chi tiết giá vốn và biên lợi nhuận được ẩn đối với tài khoản phân quyền Sales Rep/Sales Admin.</span>
                                </div>
                            )}
                        </div>

                        {/* 3. PRODUCTS LIST */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: '#4A6A7A' }}>Sản Phẩm Trong Đơn Hàng ({detail.lines.length} dòng)</p>
                            
                            {/* Desktop Table View */}
                            <div className="hidden md:block rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: 640 }}>
                                        <thead><tr style={{ background: '#142433' }}>
                                            {(canSeeMargin ? ['SKU / Tên Sản Phẩm', 'SL', 'Giá Bán', 'Nguồn Giá', 'Thành Tiền', 'Giá Vốn', 'Lãi Gộp', 'Biên %'] : ['SKU / Tên Sản Phẩm', 'SL', 'Giá Bán', 'Nguồn Giá', 'Thành Tiền']).map(h => (
                                                <th key={h} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap" style={{ color: '#4A6A7A' }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {(marginData?.lines ?? detail.lines.map(l => ({
                                                lineId: l.id, skuCode: l.product.skuCode, productName: l.product.productName,
                                                qty: Number(l.qtyOrdered), unitPrice: Number(l.unitPrice), lineDiscountPct: Number(l.lineDiscountPct),
                                                revenue: Number(l.qtyOrdered) * Number(l.unitPrice) * (1 - Number(l.lineDiscountPct) / 100),
                                                avgCost: 0, cogs: 0, margin: 0, marginPct: 0, isNegative: false, productId: l.productId,
                                                priceSource: (l as any).priceSource ?? null,
                                            }))).map(ml => (
                                                <tr key={ml.lineId} style={{ borderTop: '1px solid #2A4355', background: ml.isNegative ? 'rgba(220,38,38,0.06)' : 'transparent' }}>
                                                    <td className="px-2.5 py-2">
                                                        <div className="font-semibold text-[#87CBB9] font-mono">{ml.skuCode}</div>
                                                        <div className="text-[10px] text-[#8AAEBB] mt-0.5 max-w-[200px] truncate" title={ml.productName}>{ml.productName}</div>
                                                    </td>
                                                    <td className="px-2.5 py-2 text-right" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{ml.qty}</td>
                                                    <td className="px-2.5 py-2 text-right" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{formatVND(ml.unitPrice)}</td>
                                                    <td className="px-2.5 py-2">
                                                        {ml.priceSource ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                                                style={getPriceBadgeStyle(ml.priceSource)}>
                                                                {getPriceBadgeLabel(ml.priceSource)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px]" style={{ color: '#4A6A7A' }}>Mặc định</span>
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-2 text-right font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{formatVND(ml.revenue)}</td>
                                                    {canSeeMargin && (
                                                        <td className="px-2.5 py-2 text-right" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                                                            {ml.avgCost > 0 ? formatVND(ml.avgCost) : <span style={{ color: '#2A4355' }}>—</span>}
                                                        </td>
                                                    )}
                                                    {canSeeMargin && (
                                                        <td className="px-2.5 py-2 text-right font-bold" style={{ color: ml.margin > 0 ? '#5BA88A' : ml.margin < 0 ? '#EF4444' : '#4A6A7A', fontFamily: '"DM Mono"' }}>
                                                            {ml.avgCost > 0 ? (ml.margin >= 0 ? '' : '-') + formatVND(Math.abs(ml.margin)) : '—'}
                                                        </td>
                                                    )}
                                                    {canSeeMargin && (
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
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Card View */}
                            <div className="block md:hidden space-y-2">
                                {(marginData?.lines ?? detail.lines.map(l => ({
                                    lineId: l.id, skuCode: l.product.skuCode, productName: l.product.productName,
                                    qty: Number(l.qtyOrdered), unitPrice: Number(l.unitPrice), lineDiscountPct: Number(l.lineDiscountPct),
                                    revenue: Number(l.qtyOrdered) * Number(l.unitPrice) * (1 - Number(l.lineDiscountPct) / 100),
                                    avgCost: 0, cogs: 0, margin: 0, marginPct: 0, isNegative: false, productId: l.productId,
                                    priceSource: (l as any).priceSource ?? null,
                                }))).map(ml => (
                                    <div key={ml.lineId} className="p-3 rounded-md space-y-1.5" 
                                        style={{ background: '#1B2E3D', border: `1px solid ${ml.isNegative ? 'rgba(220,38,38,0.35)' : '#2A4355'}` }}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-[#87CBB9] font-mono">{ml.skuCode}</p>
                                                <p className="text-[11px] text-[#E8F1F2] truncate mt-0.5" title={ml.productName}>{ml.productName}</p>
                                            </div>
                                            {ml.priceSource && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                                                    style={getPriceBadgeStyle(ml.priceSource)}>
                                                    {getPriceBadgeLabel(ml.priceSource)}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#2A4355]/30 text-xs">
                                            <div>
                                                <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Số Lượng</p>
                                                <p className="font-bold font-mono text-[#E8F1F2] mt-0.5">{ml.qty}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Đơn Giá</p>
                                                <p className="font-semibold font-mono text-[#E8F1F2] mt-0.5">{formatVND(ml.unitPrice)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Thành Tiền</p>
                                                <p className="font-bold font-mono text-[#87CBB9] mt-0.5">{formatVND(ml.revenue)}</p>
                                            </div>
                                        </div>

                                        {canSeeMargin && ml.avgCost > 0 && (
                                            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#2A4355]/20 text-xs">
                                                <div>
                                                    <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Giá Vốn</p>
                                                    <p className="font-semibold font-mono text-[#D4A853] mt-0.5">{formatVND(ml.avgCost)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Lãi Gộp</p>
                                                    <p className="font-bold font-mono mt-0.5" style={{ color: ml.margin >= 0 ? '#5BA88A' : '#EF4444' }}>
                                                        {ml.margin >= 0 ? '' : '-'}{formatVND(Math.abs(ml.margin))}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Biên %</p>
                                                    <p className="font-bold font-mono mt-0.5" style={{ color: ml.marginPct >= 20 ? '#5BA88A' : ml.marginPct >= 0 ? '#D4A853' : '#EF4444' }}>
                                                        {ml.marginPct.toFixed(1)}%
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 4. DELIVERY ORDERS & AR INVOICES */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A6A7A' }}>Lệnh Giao Hàng (DO)</p>
                                {detail.deliveryOrders.length === 0 ? (
                                    <p className="text-xs py-4 text-center" style={{ color: '#4A6A7A' }}>Chưa có lệnh giao hàng</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {detail.deliveryOrders.map(do_ => (
                                            <div key={do_.id} className="flex items-center justify-between py-2 px-3 rounded" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                                <span className="text-xs font-bold font-mono" style={{ color: '#87CBB9' }}>{do_.doNo}</span>
                                                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>{do_.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A6A7A' }}>Hóa Đơn Công Nợ (AR)</p>
                                {detail.arInvoices.length === 0 ? (
                                    <p className="text-xs py-4 text-center" style={{ color: '#4A6A7A' }}>Chưa xuất hóa đơn</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {detail.arInvoices.map(inv => (
                                            <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                                <div>
                                                    <span className="text-xs font-bold font-mono block" style={{ color: '#87CBB9' }}>{inv.invoiceNo}</span>
                                                    <span className="text-[10px] block mt-0.5" style={{ color: '#4A6A7A' }}>Hạn: {formatDate(inv.dueDate)}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs font-bold font-mono block" style={{ color: '#E8F1F2' }}>{formatVND(Number(inv.amount))}</span>
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold inline-block mt-0.5" style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853' }}>{inv.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. HISTORY & AUDIT LOGS */}
                        <div className="p-4 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A6A7A' }}>Nhật Ký Đơn Hàng (Timeline)</p>
                            {timelineLoading ? (
                                <div className="flex items-center justify-center py-6 gap-2 text-xs" style={{ color: '#4A6A7A' }}>
                                    <Loader2 size={14} className="animate-spin text-[#87CBB9]" />
                                    <span>Đang tải nhật ký hoạt động...</span>
                                </div>
                            ) : timeline.length === 0 ? (
                                <p className="text-xs py-4 text-center" style={{ color: '#4A6A7A' }}>Chưa ghi nhận hoạt động nào</p>
                            ) : (
                                <div className="space-y-0 relative pl-1">
                                    <div className="absolute left-3 top-2 bottom-2 w-[1px]" style={{ background: '#2A4355' }} />
                                    {timeline.map((ev, i) => (
                                        <div key={ev.id} className="flex gap-3 py-2 relative">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 z-10"
                                                style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                                {ACTION_ICON[ev.action] ?? '●'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold" style={{ color: '#87CBB9' }}>{ev.action}</span>
                                                    {ev.userName && <span className="text-[10px]" style={{ color: '#4A6A7A' }}>— {ev.userName}</span>}
                                                    <span className="text-[9px] ml-auto" style={{ color: '#4A6A7A' }}>{formatDate(ev.createdAt)}</span>
                                                </div>
                                                {ev.description && <p className="text-xs mt-0.5" style={{ color: '#8AAEBB' }}>{ev.description}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </>
    )
}

// ── Mobile Card Component ────────────────────────
function SalesOrderMobileCard({
    row,
    onViewDetail,
    onApprove,
    onReject,
    onConfirm,
    onEdit,
    onDelete,
    onAcctApprove,
    onAcctReject,
    onCancel,
    canApprove,
    canAcctApprove,
    actionLoading
}: {
    row: SalesOrderRow
    onViewDetail: () => void
    onApprove: () => void
    onReject: () => void
    onConfirm: () => void
    onEdit: () => void
    onDelete: () => void
    onAcctApprove: () => void
    onAcctReject: () => void
    onCancel: () => void
    canApprove: boolean
    canAcctApprove: boolean
    actionLoading: string | null
}) {
    const isActLoading = actionLoading === row.id

    return (
        <div className="p-3.5 flex flex-col gap-2.5 rounded-lg border transition-all duration-150 relative bg-[#0D1E2B]"
            style={{ borderColor: '#2A4355' }}
            onClick={onViewDetail}>
            
            {/* Header: SO code & Date */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>
                    {row.soNo}
                </span>
                <span className="text-[10px]" style={{ color: '#4A6A7A' }}>
                    {formatDate(row.createdAt)}
                </span>
            </div>

            {/* Customer information */}
            <div>
                <p className="text-sm font-semibold leading-snug" style={{ color: '#E8F1F2' }}>
                    {row.customerName}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>
                    {row.customerCode}
                </p>
            </div>

            {/* Channel, Legal Entity, Sales Rep */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Channel Badge */}
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(135,203,185,0.08)', color: '#8AAEBB' }}>
                    {CHANNEL_LABEL[row.channel] ?? row.channel}
                </span>

                {/* Legal Entity Badge */}
                {row.legalEntityCode && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ 
                            background: row.legalEntityCode === 'TA' ? 'rgba(212,168,83,0.12)' : 'rgba(135,203,185,0.12)', 
                            color: row.legalEntityCode === 'TA' ? '#D4A853' : '#87CBB9' 
                        }}>
                        {row.legalEntityCode}
                    </span>
                )}

                {/* Sales Rep Name */}
                <span className="text-[10px] ml-auto" style={{ color: '#8AAEBB' }}>
                    Rep: <span className="font-medium">{row.salesRepName}</span>
                </span>
            </div>

            {/* Financial summary & Status */}
            <div className="flex items-center justify-between pt-1.5 border-t border-[#2A4355]/30">
                {/* Total amount & discount */}
                <div>
                    <span className="text-sm font-bold" style={{ fontFamily: '"DM Mono", monospace', color: '#E8F1F2' }}>
                        {formatVND(row.totalAmount)}
                    </span>
                    {row.orderDiscount > 0 && (
                        <span className="text-[10px] ml-1.5 font-semibold" style={{ color: '#5BA88A' }}>
                            (CK {row.orderDiscount}%)
                        </span>
                    )}
                </div>

                {/* StatusBadge component */}
                <div className="scale-90 origin-right">
                    <StatusBadge status={row.status} approvalStep={row.approvalStep} />
                </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-1.5 flex-wrap pt-2 border-t border-[#2A4355]/30"
                onClick={e => e.stopPropagation() /* Prevent card click onViewDetail */}>
                
                {/* Eye Detail button (always shown) */}
                <button onClick={onViewDetail}
                    className="p-1.5 rounded transition-all flex items-center justify-center border"
                    style={{ background: 'rgba(135,203,185,0.06)', color: '#87CBB9', borderColor: 'rgba(135,203,185,0.2)' }}
                    title="Chi tiết">
                    <Eye size={12} />
                </button>

                {/* Approval Actions */}
                {row.status === 'PENDING_APPROVAL' && canApprove && (
                    <>
                        <button onClick={onApprove} disabled={isActLoading}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold transition-all border"
                            style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', borderColor: 'rgba(91,168,138,0.3)', borderRadius: '4px' }}>
                            {isActLoading ? <Loader2 size={10} className="animate-spin" /> : <><CheckCircle2 size={10} /> Duyệt</>}
                        </button>
                        <button onClick={onReject} disabled={isActLoading}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold transition-all border"
                            style={{ background: 'rgba(139,26,46,0.12)', color: '#E85D5D', borderColor: 'rgba(139,26,46,0.25)', borderRadius: '4px' }}>
                            {isActLoading ? <Loader2 size={10} className="animate-spin" /> : <><XCircle size={10} /> Từ chối</>}
                        </button>
                    </>
                )}

                {/* Draft Actions */}
                {row.status === 'DRAFT' && (
                    <>
                        <button onClick={onConfirm} disabled={isActLoading}
                            className="px-2 py-1 text-[11px] font-semibold transition-all border"
                            style={{ background: 'rgba(91,168,138,0.12)', color: '#5BA88A', borderColor: 'rgba(91,168,138,0.25)', borderRadius: '4px' }}>
                            {isActLoading ? <Loader2 size={10} className="animate-spin" /> : 'Xác nhận'}
                        </button>
                        <button onClick={onEdit}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold transition-all border"
                            style={{ background: 'rgba(212,168,83,0.1)', color: '#D4A853', borderColor: 'rgba(212,168,83,0.2)', borderRadius: '4px' }}>
                            <Pencil size={10} /> Sửa
                        </button>
                    </>
                )}

                {/* Accountant Approval Actions */}
                {row.status === 'PENDING_ACCOUNTING' && canAcctApprove && (
                    <>
                        <button onClick={onAcctApprove} disabled={isActLoading}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold transition-all border"
                            style={{ background: 'rgba(8,145,178,0.12)', color: '#0891B2', borderColor: 'rgba(8,145,178,0.25)', borderRadius: '4px' }}>
                            <CheckCircle2 size={10} /> KT Duyệt
                        </button>
                        <button onClick={onAcctReject} disabled={isActLoading}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold transition-all border"
                            style={{ background: 'rgba(139,26,46,0.1)', color: '#E85D5D', borderColor: 'rgba(139,26,46,0.2)', borderRadius: '4px' }}>
                            {isActLoading ? <Loader2 size={10} className="animate-spin" /> : <><XCircle size={10} /> Trả về</>}
                        </button>
                    </>
                )}

                {/* Delete / Cancel Actions */}
                {row.status === 'DRAFT' ? (
                    <button onClick={onDelete} disabled={isActLoading}
                        className="px-2 py-1 text-[11px] font-semibold transition-all border"
                        style={{ background: 'rgba(220,38,38,0.08)', color: '#EF4444', borderColor: 'rgba(220,38,38,0.2)', borderRadius: '4px' }}>
                        Xóa
                    </button>
                ) : (
                    ['PENDING_APPROVAL', 'PENDING_ACCOUNTING', 'CONFIRMED'].includes(row.status) && (
                        <button onClick={onCancel} disabled={isActLoading}
                            className="px-2 py-1 text-[11px] font-semibold transition-all border"
                            style={{ background: 'rgba(139,26,46,0.08)', color: '#8B1A2E', borderColor: 'rgba(139,26,46,0.2)', borderRadius: '4px' }}>
                            Huỷ
                        </button>
                    )
                )}
            </div>
        </div>
    )
}

// ── Main Component ───────────────────────────────
// Roles allowed to see cost/margin data
const MARGIN_ROLES = ['CEO', 'KE_TOAN', 'Kế Toán', 'SALES_MGR', 'Sales Manager']

interface Props {
    initialRows: SalesOrderRow[]
    initialTotal: number
    stats: { monthRevenue: number; monthOrders: number; pendingApproval: number; draft: number; confirmed: number }
    userId: string
    userRoles: string[]
    statusCounts: Record<string, number>
}

export function SalesClient({ initialRows, initialTotal, stats: initialStats, userId, userRoles, statusCounts: initialStatusCounts }: Props) {
    const canSeeMargin = MARGIN_ROLES.some(r => userRoles.includes(r))
    const isCEO = userRoles.includes('CEO')
    const isSaleAdminOrMgr = userRoles.includes('Sales Admin') || userRoles.includes('Sales Manager') || userRoles.includes('SALES_ADMIN') || userRoles.includes('SALES_MGR')
    const canAcctApprove = userRoles.includes('Kế Toán') || userRoles.includes('KE_TOAN')

    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [loading, setLoading] = useState(initialRows.length === 0)
    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<SOStatus | ''>('')
    
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])
    const [page, setPage] = useState(1)
    const [sortBy, setSortBy] = useState<'createdAt' | 'totalAmount' | 'soNo'>('createdAt')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [createOpen, setCreateOpen] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [editId, setEditId] = useState<string | null>(null)
    const [stats, setStats] = useState(initialStats)
    const [counts, setCounts] = useState(initialStatusCounts)
    const [legalEntities, setLegalEntities] = useState<LegalEntityRow[]>([])
    const [acctModalId, setAcctModalId] = useState<string | null>(null)
    const [acctEntityId, setAcctEntityId] = useState('')
    const [approvalModalId, setApprovalModalId] = useState<string | null>(null)

    // Load legal entities on mount
    useEffect(() => {
        getLegalEntities().then(setLegalEntities).catch(() => { })
    }, [])

    const reload = useCallback(async (
        overrides?: Partial<{ search: string; status: string; page: number; sortBy: string; sortDir: string; dateFrom: string; dateTo: string }>,
        onlyRows = false
    ) => {
        setLoading(true)
        try {
            const result = await getSalesPageData({
                search: (overrides?.search ?? search) || undefined,
                status: (overrides?.status ?? statusFilter) as SOStatus || undefined,
                page: overrides?.page ?? page,
                pageSize: 20,
                sortBy: (overrides?.sortBy ?? sortBy) as any,
                sortDir: (overrides?.sortDir ?? sortDir) as any,
                dateFrom: (overrides?.dateFrom ?? dateFrom) || undefined,
                dateTo: (overrides?.dateTo ?? dateTo) || undefined,
            }, onlyRows)
            setRows(result.rows)
            setTotal(result.total)
            if (!onlyRows) {
                setStats(result.stats)
                setCounts(result.statusCounts)
            }
        } finally {
            setLoading(false)
        }
    }, [search, statusFilter, page, sortBy, sortDir, dateFrom, dateTo])

    // Load initial sales data on mount
    useEffect(() => {
        if (initialRows.length === 0) {
            reload()
        }
    }, [initialRows.length, reload])

    const handleSort = (field: string) => {
        const newDir = sortBy === field && sortDir === 'desc' ? 'asc' : 'desc'
        setSortBy(field as any)
        setSortDir(newDir)
        reload({ sortBy: field, sortDir: newDir, page: 1 }, true)
        setPage(1)
    }

    const handleStatusTab = (s: SOStatus | '') => {
        setStatusFilter(s)
        setPage(1)
        reload({ status: s, page: 1 }, true)
    }

    const handleConfirm = async (id: string) => {
        setActionLoading(id)
        toast.promise(confirmSalesOrder(id).then(() => reload()), {
            loading: 'Đang xác nhận...', success: 'Đã chuyển sang Chờ KT Duyệt!', error: 'Không thể xác nhận đơn hàng', finally: () => setActionLoading(null)
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
        setApprovalModalId(id)
    }

    const handleReject = async (id: string) => {
        if (!confirm('Từ chối đơn hàng này?')) return
        setActionLoading(id)
        toast.promise(rejectSalesOrder(id).then(() => reload()), {
            loading: 'Đang từ chối...', success: 'Đã từ chối!', error: 'Không thể từ chối', finally: () => setActionLoading(null)
        })
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa vĩnh viễn đơn hàng nháp này?')) return
        setActionLoading(id)
        toast.promise(deleteSalesOrder(id).then((r) => {
            if (!r.success) throw new Error(r.error || 'Lỗi không xác định')
            reload()
        }), {
            loading: 'Đang xóa đơn nháp...',
            success: 'Đã xóa đơn hàng nháp thành công!',
            error: (e: any) => `Không thể xóa: ${e.message}`,
            finally: () => setActionLoading(null)
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
                        value={searchInput}
                        onChange={e => {
                            const val = e.target.value
                            setSearchInput(val)
                            if (debounceRef.current) clearTimeout(debounceRef.current)
                            debounceRef.current = setTimeout(() => {
                                setSearch(val)
                                setPage(1)
                                reload({ search: val, page: 1 }, true)
                            }, 300)
                        }}
                        className="w-full pl-9 pr-4 py-2.5 text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                </div>
                <div className="flex items-center gap-2">
                    <Calendar size={14} style={{ color: '#4A6A7A' }} />
                    <input type="date" value={dateFrom}
                        onChange={e => { setDateFrom(e.target.value); setPage(1); reload({ dateFrom: e.target.value, page: 1 }, true) }}
                        className="px-2.5 py-2 text-xs outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB', borderRadius: '4px' }} />
                    <span className="text-xs" style={{ color: '#4A6A7A' }}>→</span>
                    <input type="date" value={dateTo}
                        onChange={e => { setDateTo(e.target.value); setPage(1); reload({ dateTo: e.target.value, page: 1 }, true) }}
                        className="px-2.5 py-2 text-xs outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB', borderRadius: '4px' }} />
                </div>
            </div>

            {/* Table (Desktop View) */}
            <div className="hidden md:block rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse', minWidth: 900 }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                <SortHeader label="Số SO" field="soNo" current={sortBy} dir={sortDir} onSort={handleSort} />
                                <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>Khách Hàng</th>
                                <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>Kênh</th>
                                <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>Pháp Nhân</th>
                                <SortHeader label="Doanh Số" field="totalAmount" current={sortBy} dir={sortDir} onSort={handleSort} />
                                <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>Sales Rep</th>
                                <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>Trạng Thái</th>
                                <SortHeader label="Ngày Tạo" field="createdAt" current={sortBy} dir={sortDir} onSort={handleSort} />
                                <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>Hành Động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} className="text-center py-12" style={{ color: '#4A6A7A' }}>
                                    <Loader2 size={20} className="inline animate-spin mr-2" />Đang tải...
                                </td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={9} className="text-center py-16" style={{ color: '#4A6A7A' }}>
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
                                        {row.legalEntityCode ? (
                                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                                style={{ background: row.legalEntityCode === 'TA' ? 'rgba(212,168,83,0.12)' : 'rgba(135,203,185,0.12)', color: row.legalEntityCode === 'TA' ? '#D4A853' : '#87CBB9' }}>
                                                {row.legalEntityCode}
                                            </span>
                                        ) : (
                                            <span className="text-xs" style={{ color: '#2A4355' }}>—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-sm font-bold" style={{ fontFamily: '"DM Mono", monospace', color: '#E8F1F2' }}>{formatVND(row.totalAmount)}</p>
                                        {row.orderDiscount > 0 && <p className="text-xs" style={{ color: '#5BA88A' }}>CK {row.orderDiscount}%</p>}
                                    </td>
                                    <td className="px-4 py-3 text-sm" style={{ color: '#8AAEBB' }}>{row.salesRepName}</td>
                                    <td className="px-4 py-3"><StatusBadge status={row.status} approvalStep={row.approvalStep} /></td>
                                    <td className="px-4 py-3 text-xs" style={{ color: '#4A6A7A' }}>{formatDate(row.createdAt)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <button onClick={() => setDetailId(row.id)} className="p-1.5 rounded" title="Chi tiết"
                                                style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.2)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.1)')}>
                                                <Eye size={13} />
                                            </button>
                                            <button onClick={() => window.open(`/dashboard/sales/print?id=${row.id}`, '_blank')} className="p-1.5 rounded" title="In đơn hàng"
                                                style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.2)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.1)')}>
                                                <Printer size={13} />
                                            </button>
                                            {row.status === 'PENDING_APPROVAL' && (
                                                ((isSaleAdminOrMgr && row.approvalStep === 1) || (isCEO && row.approvalStep === 2) || (!row.approvalStep && (isCEO || isSaleAdminOrMgr)))
                                            ) && (
                                                <>
                                                    <button onClick={() => handleApprove(row.id)} disabled={actionLoading === row.id}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold"
                                                        style={{ background: 'rgba(91,168,138,0.2)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.4)', borderRadius: '5px' }}>
                                                        {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : <><CheckCircle2 size={12} /> Duyệt</>}
                                                    </button>
                                                    <button onClick={() => handleReject(row.id)} disabled={actionLoading === row.id}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold"
                                                        style={{ background: 'rgba(139,26,46,0.15)', color: '#E85D5D', border: '1px solid rgba(139,26,46,0.35)', borderRadius: '5px' }}>
                                                        {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : <><XCircle size={12} /> Từ Chối</>}
                                                    </button>
                                                </>
                                            )}
                                            {row.status === 'DRAFT' && (
                                                <>
                                                    <button onClick={() => handleConfirm(row.id)} disabled={actionLoading === row.id}
                                                        className="px-2 py-1 text-xs font-semibold"
                                                        style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)', borderRadius: '4px' }}>
                                                        {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : 'Xác Nhận'}
                                                    </button>
                                                    <button onClick={() => setEditId(row.id)}
                                                        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold"
                                                        style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', borderRadius: '4px' }}>
                                                        <Pencil size={11} /> Sửa
                                                    </button>
                                                    <button onClick={() => handleDelete(row.id)} disabled={actionLoading === row.id}
                                                        className="px-2 py-1 text-xs font-semibold border"
                                                        style={{ background: 'rgba(220,38,38,0.1)', color: '#EF4444', borderColor: 'rgba(220,38,38,0.25)', borderRadius: '4px' }}>
                                                        Xóa
                                                    </button>
                                                </>
                                            )}
                                            {row.status === 'PENDING_ACCOUNTING' && canAcctApprove && (
                                                <>
                                                    <button onClick={() => { setAcctModalId(row.id); setAcctEntityId((row as any).legalEntityId ?? '') }}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold"
                                                        style={{ background: 'rgba(8,145,178,0.15)', color: '#0891B2', border: '1px solid rgba(8,145,178,0.35)', borderRadius: '5px' }}>
                                                        <CheckCircle2 size={12} /> KT Duyệt
                                                    </button>
                                                    <button onClick={async () => {
                                                        if (!confirm('Trả đơn về DRAFT cho sales sửa?')) return
                                                        setActionLoading(row.id)
                                                        toast.promise(accountingRejectSO(row.id).then(() => reload()), {
                                                            loading: 'Đang trả về...', success: 'Đã trả về DRAFT', error: 'Lỗi', finally: () => setActionLoading(null)
                                                        })
                                                    }} disabled={actionLoading === row.id}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold"
                                                        style={{ background: 'rgba(139,26,46,0.12)', color: '#E85D5D', border: '1px solid rgba(139,26,46,0.3)', borderRadius: '5px' }}>
                                                        <XCircle size={12} /> KT Trả Về
                                                    </button>
                                                </>
                                            )}
                                            {['PENDING_APPROVAL', 'CONFIRMED'].includes(row.status) && (
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

            {/* Mobile View */}
            <div className={`block md:hidden space-y-3 ${loading && rows.length > 0 ? 'opacity-40 pointer-events-none' : ''}`}>
                {rows.length === 0 && loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="p-4 space-y-3 rounded-lg border border-[#2A4355]/30 bg-[#0D1E2B] animate-pulse">
                            <div className="flex justify-between">
                                <div className="h-4 bg-[#1B2E3D] rounded w-1/3" />
                                <div className="h-3 bg-[#1B2E3D] rounded w-1/4" />
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 bg-[#1B2E3D] rounded w-3/4" />
                                <div className="h-3 bg-[#1B2E3D] rounded w-1/2" />
                            </div>
                            <div className="flex gap-2">
                                <div className="h-5 bg-[#1B2E3D] rounded w-16" />
                                <div className="h-5 bg-[#1B2E3D] rounded w-12" />
                            </div>
                            <div className="flex justify-between pt-2 border-t border-[#2A4355]/20">
                                <div className="h-4 bg-[#1B2E3D] rounded w-24" />
                                <div className="h-5 bg-[#1B2E3D] rounded w-20" />
                            </div>
                        </div>
                    ))
                ) : rows.length === 0 ? (
                    <div className="text-center py-16 rounded-md border border-[#2A4355] bg-[#0D1E2B]" style={{ color: '#4A6A7A' }}>
                        <FileText size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                        <p className="text-sm">Chưa có đơn hàng nào</p>
                    </div>
                ) : (
                    rows.map(row => (
                        <SalesOrderMobileCard
                            key={row.id}
                            row={row}
                            onViewDetail={() => setDetailId(row.id)}
                            onApprove={() => handleApprove(row.id)}
                            onReject={() => handleReject(row.id)}
                            onConfirm={() => handleConfirm(row.id)}
                            onEdit={() => setEditId(row.id)}
                            onDelete={() => handleDelete(row.id)}
                            onAcctApprove={() => { setAcctModalId(row.id); setAcctEntityId((row as any).legalEntityId ?? '') }}
                            onAcctReject={async () => {
                                if (!confirm('Trả đơn về DRAFT cho sales sửa?')) return
                                setActionLoading(row.id)
                                toast.promise(accountingRejectSO(row.id).then(() => reload()), {
                                    loading: 'Đang trả về...', success: 'Đã trả về DRAFT', error: 'Lỗi', finally: () => setActionLoading(null)
                                })
                            }}
                            onCancel={() => handleCancel(row.id)}
                            canApprove={((isSaleAdminOrMgr && row.approvalStep === 1) || (isCEO && row.approvalStep === 2) || (!row.approvalStep && (isCEO || isSaleAdminOrMgr)))}
                            canAcctApprove={canAcctApprove}
                            actionLoading={actionLoading}
                        />
                    ))
                )}
            </div>

            {/* Pagination */}
            {total > 20 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-[#142433] border border-[#2A4355] rounded-md animate-none">
                    <p className="text-xs text-center sm:text-left" style={{ color: '#4A6A7A' }}>
                        Hiển thị <span style={{ color: '#8AAEBB' }}>{(page - 1) * 20 + 1}–{Math.min(page * 20, total)}</span> trong <span style={{ color: '#8AAEBB' }}>{total}</span> đơn hàng
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                        {Array.from({ length: Math.ceil(total / 20) }, (_, i) => i + 1).slice(0, 8).map(p => (
                            <button key={p} onClick={() => { setPage(p); reload({ page: p }, true) }}
                                className="min-w-[32px] h-8 px-2 rounded text-xs font-semibold transition-all"
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

            <CreateSODrawer open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); reload() }} userId={userId} userRoles={userRoles} />
            {detailId && <SODetailDrawer soId={detailId} onClose={() => setDetailId(null)} onClone={handleClone} canSeeMargin={canSeeMargin} />}
            {editId && <EditSODrawer open={!!editId} soId={editId} onClose={() => setEditId(null)} onSaved={() => { setEditId(null); reload() }} userId={userId} />}
            {approvalModalId && (
                <ApproveSOModal
                    soId={approvalModalId}
                    onClose={() => setApprovalModalId(null)}
                    onApproved={() => { setApprovalModalId(null); reload() }}
                />
            )}

            {/* Accounting Approval Modal */}
            {acctModalId && (
                <>
                    <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={() => setAcctModalId(null)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 rounded-lg"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <h3 className="text-lg font-bold mb-4" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>
                            Kế Toán Duyệt Đơn
                        </h3>
                        <div className="mb-4">
                            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#4A6A7A' }}>
                                Pháp Nhân Xuất Hoá Đơn
                            </label>
                            <select value={acctEntityId} onChange={e => setAcctEntityId(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm outline-none"
                                style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}>
                                <option value="">— Chưa chọn —</option>
                                {legalEntities.map(e => (
                                    <option key={e.id} value={e.id}>{e.name} ({e.code}) — {e.code === 'TA' ? 'Nhập Khẩu' : 'Phân Phối'}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setAcctModalId(null)}
                                className="px-4 py-2 text-sm" style={{ color: '#8AAEBB', border: '1px solid #2A4355', borderRadius: '6px' }}>
                                Huỷ
                            </button>
                            <button onClick={async () => {
                                if (!acctEntityId) return toast.error('Vui lòng chọn pháp nhân')
                                setActionLoading(acctModalId)
                                toast.promise(accountingApproveSO(acctModalId, acctEntityId).then(r => {
                                    if (!r.success) throw new Error(r.error)
                                    setAcctModalId(null)
                                    reload()
                                }), {
                                    loading: 'Đang duyệt...',
                                    success: 'KT duyệt thành công — chuyển CONFIRMED!',
                                    error: (e: any) => `Lỗi: ${e.message}`,
                                    finally: () => setActionLoading(null),
                                })
                            }}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white"
                                style={{ background: '#0891B2', borderRadius: '6px' }}>
                                <CheckCircle2 size={14} /> Duyệt & Xác Nhận
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

// ── Approve SO Modal with Vintage Selection ──────
function ApproveSOModal({ soId, onClose, onApproved }: ApproveSOModalProps) {
    const [detail, setDetail] = useState<any>(null)
    const [availableVintages, setAvailableVintages] = useState<Record<string, number[]>>({})
    const [selectedVintages, setSelectedVintages] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('')

    useEffect(() => {
        let active = true
        setLoading(true)
        // Load warehouses
        getSimpleWarehouses().then((whs) => {
            if (active) {
                setWarehouses(whs)
            }
        })
        
        getSalesOrderDetailWithMargin(soId).then(async (res) => {
            if (!active) return
            const detailObj = res.detail
            if (detailObj) {
                setDetail(detailObj)
                const initialVintages: Record<string, number> = {}
                for (const line of detailObj.lines) {
                    initialVintages[line.id] = (line as any).vintage || 0
                }
                setSelectedVintages(initialVintages)
                
                const productIds = detailObj.lines.map(l => l.productId)
                const vintagesData = await getAvailableVintagesForProducts(productIds)
                if (active) {
                    setAvailableVintages(vintagesData)
                    setSelectedVintages(prev => {
                        const updated = { ...prev }
                        for (const line of detailObj.lines) {
                            const avail = vintagesData[line.productId] || []
                            if (avail.length > 0 && !updated[line.id]) {
                                updated[line.id] = avail[0] // Default to the lowest (first) vintage
                            }
                        }
                        return updated
                    })
                }
            }
            if (active) setLoading(false)
        }).catch(err => {
            if (active) {
                toast.error('Lỗi khi tải chi tiết đơn hàng: ' + err.message)
                setLoading(false)
            }
        })
        return () => { active = false }
    }, [soId])

    const handleConfirm = async () => {
        if (!detail) return
        
        // Filter warehouses owned by the SO's LegalEntity
        const filteredWarehouses = warehouses.filter(w => w.legalEntityId === detail.legalEntityId)
        if (filteredWarehouses.length > 0 && !selectedWarehouseId) {
            toast.error('Vui lòng chọn Kho xuất hàng')
            return
        }

        const vintagesList: { lineId: string; vintage: number }[] = []
        for (const line of detail.lines) {
            const avail = availableVintages[line.productId] || []
            const selected = selectedVintages[line.id]
            if (avail.length > 0 && !selected) {
                toast.error(`Vui lòng chỉ định Vintage cho: ${line.product.productName}`)
                return
            }
            if (selected) {
                vintagesList.push({ lineId: line.id, vintage: Number(selected) })
            }
        }

        setSubmitting(true)
        try {
            const res = await approveSalesOrder(soId, vintagesList, selectedWarehouseId || undefined)
            if (res.success) {
                toast.success('Đã duyệt đơn hàng thành công!')
                onApproved()
            } else {
                toast.error(res.error || 'Lỗi khi duyệt đơn')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi hệ thống')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg p-6 rounded-lg shadow-2xl"
                style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between mb-4 border-b border-[#2A4355] pb-3">
                    <h3 className="text-lg font-bold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>
                        Duyệt Đơn Hàng & Chỉ Định Vintage
                    </h3>
                    <button onClick={onClose} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-sm" style={{ color: '#8AAEBB' }}>
                        <Loader2 size={24} className="animate-spin text-[#87CBB9]" />
                        Đang tải thông tin sản phẩm và tồn kho...
                    </div>
                ) : !detail ? (
                    <p className="text-center py-8 text-sm" style={{ color: '#4A6A7A' }}>Không tìm thấy đơn hàng</p>
                ) : (
                    <div className="space-y-4">
                        <p className="text-xs" style={{ color: '#8AAEBB' }}>
                            Mã đơn: <span className="font-bold text-[#87CBB9]">{detail.soNo}</span> · Khách hàng: <span className="font-semibold text-white">{detail.customer.name}</span>
                        </p>

                        {/* Warehouse selector */}
                        <div className="p-3 rounded-lg flex flex-col gap-1.5" style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)' }}>
                            <label className="text-xs font-semibold" style={{ color: '#D4A853' }}>
                                Kho Xuất Hàng * (Pháp nhân: {detail.legalEntity?.name || detail.legalEntity?.code || '—'})
                            </label>
                            <select
                                value={selectedWarehouseId}
                                onChange={e => setSelectedWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 text-xs outline-none rounded"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            >
                                <option value="">— Chọn kho xuất hàng —</option>
                                {warehouses
                                    .filter(w => w.legalEntityId === detail.legalEntityId)
                                    .map(w => (
                                        <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                                    ))
                                }
                            </select>
                        </div>
                        
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                            {detail.lines.map((line: any) => {
                                const avail = availableVintages[line.productId] || []
                                return (
                                    <div key={line.id} className="p-3 rounded-lg flex flex-col gap-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold truncate text-[#E8F1F2]" title={line.product.productName}>
                                                    {line.product.productName}
                                                </p>
                                                <p className="text-[10px] text-[#4A6A7A] mt-0.5 font-mono">
                                                    SKU: {line.product.skuCode} · Số lượng: {Number(line.qtyOrdered)}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] uppercase font-semibold whitespace-nowrap" style={{ color: '#8AAEBB' }}>
                                                Vintage *
                                            </label>
                                            {avail.length > 0 ? (
                                                <select
                                                    value={selectedVintages[line.id] || ''}
                                                    onChange={e => {
                                                        const val = Number(e.target.value)
                                                        setSelectedVintages(prev => ({ ...prev, [line.id]: val }))
                                                    }}
                                                    className="flex-1 px-2.5 py-1.5 text-xs outline-none rounded"
                                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                                >
                                                    <option value="">— Chọn Vintage khả dụng —</option>
                                                    {avail.map(v => (
                                                        <option key={v} value={v}>{v}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px]" style={{ background: 'rgba(138,174,187,0.06)', color: '#8AAEBB', border: '1px dashed rgba(138,174,187,0.2)' }}>
                                                    Không Vintage (Sản phẩm không Vintage hoặc Hết tồn kho)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-[#2A4355]">
                            <button onClick={onClose} disabled={submitting}
                                className="px-4 py-2 text-xs rounded transition-all"
                                style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(138,174,187,0.05)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                Huỷ
                            </button>
                            <button onClick={handleConfirm} disabled={submitting}
                                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded text-[#0A1926] transition-all"
                                style={{ background: '#87CBB9' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                                {submitting ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin" /> Đang duyệt...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={13} /> Duyệt Đơn Hàng
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

interface ApproveSOModalProps {
    soId: string
    onClose: () => void
    onApproved: () => void
}
