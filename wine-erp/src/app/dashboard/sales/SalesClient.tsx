'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, FileText, CheckCircle2, XCircle, Clock, Truck, ReceiptText, DollarSign, Eye, Loader2, X, AlertTriangle, TrendingUp, TrendingDown, Pencil, Copy, Download, ArrowUpDown, Calendar, ChevronUp, ChevronDown, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { SalesOrderRow, SOStatus, confirmSalesOrder, cancelSalesOrder, getSalesOrderDetailWithMargin, getSalesOrderDetailWithMarginAndTimeline, SOMarginData, approveSalesOrder, rejectSalesOrder, getSOTimeline, SOTimelineEvent, cloneSalesOrder, exportSalesOrdersExcel, accountingApproveSO, accountingRejectSO, getLegalEntities, LegalEntityRow, deleteSalesOrder, getSalesPageData, getAvailableVintagesForProducts, getSimpleWarehouses, getSalesOrderDetail, getCustomersForSO, getProductsWithStock } from './actions'
import { formatVND, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import dynamic from 'next/dynamic'
const CreateSODrawer = dynamic(() => import('./CreateSODrawer').then(m => m.CreateSODrawer), {
    loading: () => null,
    ssr: false,
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

const stepLabelMap: Record<string, string> = {
    DRAFT: 'Tạo đơn',
    PENDING_ACCOUNTING: 'QL Duyệt',
    CONFIRMED: 'KT Duyệt',
    DELIVERED: 'Giao hàng',
    INVOICED: 'Xuất HĐ',
    PAID: 'Thu tiền'
}

const formatStepTime = (d: Date | string | number) => {
    const dateObj = new Date(d)
    if (isNaN(dateObj.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    const day = pad(dateObj.getDate())
    const month = pad(dateObj.getMonth() + 1)
    const hours = pad(dateObj.getHours())
    const minutes = pad(dateObj.getMinutes())
    return `${day}/${month} ${hours}:${minutes}`
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
    UNPAID: 'Chưa thanh toán',
    PARTIALLY_PAID: 'Thanh toán 1 phần',
    PAID: 'Đã thanh toán',
    OVERDUE: 'Quá hạn',
}

const getInvoiceStatusStyle = (status: string) => {
    switch (status) {
        case 'PAID':
            return { background: 'rgba(91,168,138,0.15)', color: '#5BA88A' }
        case 'PARTIALLY_PAID':
            return { background: 'rgba(74,143,171,0.15)', color: '#4A8FAB' }
        case 'OVERDUE':
            return { background: 'rgba(224,82,82,0.15)', color: '#E05252' }
        default:
            return { background: 'rgba(212,168,83,0.15)', color: '#D4A853' }
    }
}

const SODetailSkeleton = () => (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 animate-pulse">
        {/* Progress bar skeleton */}
        <div className="py-3 px-4 rounded-lg space-y-3 animate-pulse" style={{ background: '#142433', border: '1px solid #2A4355' }}>
            <div className="flex justify-between">
                <div className="h-3 w-24 bg-[#2A4355] rounded animate-pulse" />
                <div className="h-4 w-16 bg-[#2A4355] rounded-full animate-pulse" />
            </div>
            <div className="h-6 bg-[#2A4355] rounded w-full animate-pulse" />
        </div>

        {/* Two column layout skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#2A4355]/40 animate-pulse">
            <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-[#2A4355] rounded w-1/3 font-bold animate-pulse" />
                <div className="space-y-2 animate-pulse">
                    <div className="h-3 bg-[#2A4355] rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-[#2A4355] rounded w-1/2 animate-pulse" />
                    <div className="h-3 bg-[#2A4355] rounded w-2/3 animate-pulse" />
                </div>
            </div>
            <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-[#2A4355] rounded w-1/3 font-bold animate-pulse" />
                <div className="space-y-2 animate-pulse">
                    <div className="h-3 bg-[#2A4355] rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-[#2A4355] rounded w-1/2 animate-pulse" />
                    <div className="h-3 bg-[#2A4355] rounded w-2/3 animate-pulse" />
                </div>
            </div>
        </div>

        {/* Lines/Items list table skeleton */}
        <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-[#2A4355] rounded w-1/4 animate-pulse" />
            <div className="space-y-2 animate-pulse">
                <div className="h-10 bg-[#2A4355] rounded w-full animate-pulse" />
                <div className="h-10 bg-[#2A4355] rounded w-full animate-pulse" />
                <div className="h-10 bg-[#2A4355] rounded w-full animate-pulse" />
            </div>
        </div>
    </div>
)

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
                <p className="text-xl font-bold mt-0.5 font-mono" style={{ color: '#E8F1F2' }}>{value}</p>
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
function SortHeader({ label, field, current, dir, onSort, style }: { label: string; field: string; current: string; dir: string; onSort: (f: string) => void; style?: React.CSSProperties }) {
    const isActive = current === field
    return (
        <th className="px-4 py-1.5 text-xs uppercase tracking-wider font-semibold cursor-pointer select-none"
            style={{ color: isActive ? '#87CBB9' : '#8AAEBB', ...style }}
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

    const getStepTimestamp = (step: SOStatus, orderCreatedAt: Date | string, orderUpdatedAt: Date | string, orderStatus: string): Date | null => {
        if (step === 'DRAFT') return new Date(orderCreatedAt)
        
        if (step === 'PENDING_ACCOUNTING') {
            const ev = timeline.find(e => e.action === 'APPROVE')
            if (ev) return new Date(ev.createdAt)
            
            // Fallback for auto-approved orders that bypass manager approval
            const confirmEv = timeline.find(e => e.action === 'CONFIRM' && e.entityType === 'SalesOrder')
            return confirmEv ? new Date(confirmEv.createdAt) : null
        }
        if (step === 'CONFIRMED') {
            const ev = timeline.find(e => e.action === 'ACCOUNTING_APPROVE')
            return ev ? new Date(ev.createdAt) : null
        }
        if (step === 'DELIVERED') {
            const steps = ['DRAFT', 'PENDING_ACCOUNTING', 'CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID']
            const currentIdx = steps.indexOf(orderStatus as SOStatus)
            if (currentIdx >= 3) {
                const ev = timeline.find(e => e.action === 'CONFIRM' && e.description?.includes('Phiếu xuất'))
                return ev ? new Date(ev.createdAt) : new Date(orderUpdatedAt)
            }
            return null
        }
        if (step === 'INVOICED') {
            const steps = ['DRAFT', 'PENDING_ACCOUNTING', 'CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID']
            const currentIdx = steps.indexOf(orderStatus as SOStatus)
            if (currentIdx >= 4) {
                const ev = timeline.find(e => e.description?.includes('Hóa đơn'))
                return ev ? new Date(ev.createdAt) : new Date(orderUpdatedAt)
            }
            return null
        }
        if (step === 'PAID') {
            if (orderStatus === 'PAID') {
                const ev = timeline.find(e => e.action === 'PAYMENT' || e.action === 'COLLECT_COD' || e.description?.includes('PAID'))
                return ev ? new Date(ev.createdAt) : new Date(orderUpdatedAt)
            }
            return null
        }
        return null
    }

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
                        <h3 className="font-semibold" style={{ color: '#E8F1F2', fontSize: 18 }}>
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
                    <SODetailSkeleton />
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

                        {/* Tiến Trình Đơn Hàng */}
                        <div className="py-3 px-4 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                            <div className="flex items-center justify-between text-xs mb-4">
                                <span className="font-bold uppercase tracking-wider text-[10px]" style={{ color: '#4A6A7A' }}>Tiến Trình Đơn Hàng</span>
                                <span className="font-semibold text-xs px-2 py-0.5 rounded-full"
                                    style={{ background: STATUS_CFG[detail.status as SOStatus]?.bg, color: STATUS_CFG[detail.status as SOStatus]?.color }}>
                                    {STATUS_CFG[detail.status as SOStatus]?.label}
                                </span>
                            </div>
                            
                            <div className="relative pt-2 pb-1">
                                <div className="absolute top-[12px] h-[2px] z-0" style={{ background: '#2A4355', left: '8.33%', right: '8.33%' }}>
                                    {(() => {
                                        let activeIdx = 0
                                        switch (detail.status) {
                                            case 'DRAFT': activeIdx = 0; break;
                                            case 'PENDING_APPROVAL': activeIdx = 1; break;
                                            case 'PENDING_ACCOUNTING': activeIdx = 2; break;
                                            case 'CONFIRMED': activeIdx = 3; break;
                                            case 'PARTIALLY_DELIVERED': activeIdx = 3; break;
                                            case 'DELIVERED': activeIdx = 4; break;
                                            case 'INVOICED': activeIdx = 5; break;
                                            case 'PAID': activeIdx = 6; break;
                                            case 'CANCELLED': activeIdx = -1; break;
                                        }
                                        return (
                                            <div className="h-full transition-all duration-300" 
                                                style={{ 
                                                    width: `${activeIdx >= 0 ? (Math.min(activeIdx, 5) / 5) * 100 : 0}%`, 
                                                    background: '#5BA88A' 
                                                }} 
                                            />
                                        )
                                    })()}
                                </div>
                                
                                <div className="flex justify-between items-start relative z-10 w-full">
                                    {(() => {
                                        const steps = [
                                            { s: 'DRAFT', label: 'Tạo đơn' },
                                            { s: 'PENDING_ACCOUNTING', label: 'QL Duyệt' },
                                            { s: 'CONFIRMED', label: 'KT Duyệt' },
                                            { s: 'DELIVERED', label: 'Giao hàng' },
                                            { s: 'INVOICED', label: 'Xuất HĐ' },
                                            { s: 'PAID', label: 'Thu tiền' }
                                        ]
                                        
                                        let activeIdx = 0
                                        switch (detail.status) {
                                            case 'DRAFT': activeIdx = 0; break;
                                            case 'PENDING_APPROVAL': activeIdx = 1; break;
                                            case 'PENDING_ACCOUNTING': activeIdx = 2; break;
                                            case 'CONFIRMED': activeIdx = 3; break;
                                            case 'PARTIALLY_DELIVERED': activeIdx = 3; break;
                                            case 'DELIVERED': activeIdx = 4; break;
                                            case 'INVOICED': activeIdx = 5; break;
                                            case 'PAID': activeIdx = 6; break;
                                            case 'CANCELLED': activeIdx = -1; break;
                                        }

                                        return steps.map((stepInfo, i) => {
                                            const { s, label } = stepInfo
                                            const isDone = activeIdx > i
                                            const isCurrent = activeIdx === i
                                            const ts = getStepTimestamp(s as SOStatus, detail.createdAt, detail.updatedAt, detail.status)
                                            
                                            return (
                                                <div key={s} className="flex flex-col items-center flex-1 text-center relative">
                                                    {/* Vòng tròn trạng thái */}
                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all relative z-10"
                                                        style={{
                                                            backgroundColor: isDone ? '#5ba889' : '#1B2E3D',
                                                            color: isDone ? '#0d1e2c' : '#4a6a79',
                                                            border: isCurrent ? '2px solid #87cbb8' : isDone ? 'none' : '2px solid #2a4354',
                                                            boxShadow: isCurrent ? '0 0 8px rgba(135,203,185,0.4)' : 'none',
                                                            boxSizing: 'border-box'
                                                        }}>
                                                        {isDone ? '✓' : i + 1}
                                                    </div>
                                                    
                                                    {/* Nhãn bước */}
                                                    <span className="text-[10px] font-bold mt-2 whitespace-nowrap block" 
                                                        style={{ color: isCurrent ? '#87CBB9' : isDone ? '#E8F1F2' : '#4A6A7A' }}>
                                                        {label}
                                                    </span>
                                                    
                                                    {/* Mốc thời gian */}
                                                    <span className="text-[8px] font-mono mt-0.5 block leading-none h-2" 
                                                        style={{ color: isDone ? '#8AAEBB' : '#2A4355' }}>
                                                        {ts ? formatStepTime(ts) : '—'}
                                                    </span>
                                                </div>
                                            )
                                        })
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* General Info & Financials (Two-Column Grid) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#2A4355]/40">
                            {/* Column 1: Customer details */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#4A6A7A' }}>Thông tin chung</h4>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                        <span style={{ color: '#4A6A7A' }}>Khách hàng:</span>
                                        <span className="font-semibold text-right" style={{ color: '#E8F1F2' }}>{detail.customer.name}</span>
                                    </div>
                                    {detail.customer.parent && (
                                        <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                            <span style={{ color: '#4A6A7A' }}>Khách hàng cha:</span>
                                            <span className="font-semibold text-right" style={{ color: '#E8F1F2' }}>{detail.customer.parent.name}</span>
                                        </div>
                                    )}
                                    {detail.customer.taxId && (
                                        <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                            <span style={{ color: '#4A6A7A' }}>MST:</span>
                                            <span className="font-semibold font-mono" style={{ color: '#8AAEBB' }}>{detail.customer.taxId}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                        <span style={{ color: '#4A6A7A' }}>Mã KH / Kênh:</span>
                                        <span className="font-semibold" style={{ color: '#8AAEBB' }}>{detail.customer.code} ({CHANNEL_LABEL[detail.channel] ?? detail.channel})</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                        <span style={{ color: '#4A6A7A' }}>Nhân viên Sales:</span>
                                        <span className="font-semibold" style={{ color: '#E8F1F2' }}>{detail.salesRep.name}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                        <span style={{ color: '#4A6A7A' }}>Kỳ hạn thanh toán:</span>
                                        <span className="font-semibold" style={{ color: '#D4A853' }}>{detail.paymentTerm}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                        <span style={{ color: '#4A6A7A' }}>Ngày tạo đơn:</span>
                                        <span className="font-semibold" style={{ color: '#8AAEBB' }}>{formatDate(detail.createdAt)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Financial summary */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#4A6A7A' }}>Chỉ số tài chính</h4>
                                {canSeeMargin && !marginData ? (
                                    <div className="py-6 rounded-lg flex flex-col items-center justify-center gap-2 border border-[#2A4355]/30 bg-[#142433]/40">
                                        <Loader2 size={16} className="animate-spin text-[#87CBB9]" />
                                        <span className="text-[11px]" style={{ color: '#4A6A7A' }}>Đang tính toán tỷ suất lợi nhuận...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                            <span style={{ color: '#4A6A7A' }}>Tổng tiền trước thuế (Sau CK):</span>
                                            <span className="font-bold font-mono text-sm" style={{ color: '#E8F1F2' }}>{formatVND(Number(detail.totalAmount))}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                            <span style={{ color: '#4A6A7A' }}>Tiền thuế VAT:</span>
                                            <span className="font-bold font-mono" style={{ color: '#8AAEBB' }}>{formatVND(Number(detail.vatAmount ?? 0))}</span>
                                        </div>
                                        <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                            <span style={{ color: '#4A6A7A' }}>Tổng thanh toán (Có VAT):</span>
                                            <span className="font-bold font-mono text-sm text-[#87CBB9]">{formatVND(Number(detail.totalAmount) + Number(detail.vatAmount ?? 0))}</span>
                                        </div>
                                        {marginData && canSeeMargin ? (
                                            <>
                                                <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                                    <span style={{ color: '#4A6A7A' }}>Doanh thu Net (trước VAT):</span>
                                                    <span className="font-bold font-mono" style={{ color: '#87CBB9' }}>{formatVND(marginData.totalRevenue)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                                    <span style={{ color: '#4A6A7A' }}>Tổng giá vốn (COGS):</span>
                                                    <span className="font-bold font-mono" style={{ color: '#D4A853' }}>{formatVND(marginData.totalCOGS)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                                    <span style={{ color: '#4A6A7A' }}>Lợi nhuận gộp:</span>
                                                    <span className={`font-bold font-mono ${marginData.totalMargin >= 0 ? 'text-[#5BA88A]' : 'text-[#EF4444]'}`}>
                                                        {marginData.totalMargin >= 0 ? '' : '-'}{formatVND(Math.abs(marginData.totalMargin))}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-[#2A4355]/20">
                                                    <span style={{ color: '#4A6A7A' }}>Biên lợi nhuận gộp:</span>
                                                    <span className="font-semibold flex items-center gap-1" style={{ color: marginData.totalMarginPct >= 20 ? '#5BA88A' : marginData.totalMarginPct >= 0 ? '#D4A853' : '#EF4444' }}>
                                                        {marginData.totalMarginPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                                        {marginData.totalMarginPct.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </>
                                        ) : !canSeeMargin ? (
                                            <div className="py-3 px-3 rounded text-[11px] leading-relaxed bg-[#142433]/40 border border-[#2A4355]/30" style={{ color: '#4A6A7A' }}>
                                                🔒 Chi tiết biên lợi nhuận bị ẩn đối với tài khoản Nhân viên Sales / Trợ lý Sales.
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>
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
                                                    <td className="px-2.5 py-2 text-right" style={{ color: '#E8F1F2' }}>{ml.qty}</td>
                                                    <td className="px-2.5 py-2 text-right" style={{ color: '#8AAEBB' }}>{formatVND(ml.unitPrice)}</td>
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
                                                    <td className="px-2.5 py-2 text-right font-bold" style={{ color: '#87CBB9' }}>{formatVND(ml.revenue)}</td>
                                                    {canSeeMargin && (
                                                        <td className="px-2.5 py-2 text-right" style={{ color: '#D4A853' }}>
                                                            {ml.avgCost > 0 ? formatVND(ml.avgCost) : <span style={{ color: '#2A4355' }}>—</span>}
                                                        </td>
                                                    )}
                                                    {canSeeMargin && (
                                                        <td className="px-2.5 py-2 text-right font-bold" style={{ color: ml.margin > 0 ? '#5BA88A' : ml.margin < 0 ? '#EF4444' : '#4A6A7A' }}>
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
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold"
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
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold inline-block mt-0.5" style={getInvoiceStatusStyle(inv.status)}>
                                                        {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. HISTORY & AUDIT LOGS */}
                        <div className="p-4 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A6A7A' }}>Nhật Ký Hoạt Động</p>
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
                                                    <span className="text-xs ml-auto" style={{ color: '#4A6A7A' }}>{formatDate(ev.createdAt)}</span>
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
                <span className="text-xs font-bold font-mono" style={{ color: '#87CBB9' }}>
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
                <p className="text-[10px] mt-0.5 font-mono" style={{ color: '#4A6A7A' }}>
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
                    <span className="text-sm font-bold font-mono" style={{ color: '#E8F1F2' }}>
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

type SalesPageResult = { rows: SalesOrderRow[]; total: number; stats: { monthRevenue: number; monthOrders: number; pendingApproval: number; draft: number; confirmed: number }; statusCounts: Record<string, number> }

type Props = {
    initialData?: SalesPageResult
    userId: string
    userRoles: string[]
}

export function SalesClient({ initialData, userId, userRoles }: Props) {
    const queryClient = useQueryClient()
    const canSeeMargin = MARGIN_ROLES.some(r => userRoles.includes(r))
    const isCEO = userRoles.includes('CEO')
    const isSaleAdminOrMgr = userRoles.includes('Sales Admin') || userRoles.includes('Sales Manager') || userRoles.includes('SALES_ADMIN') || userRoles.includes('SALES_MGR')
    const canAcctApprove = userRoles.includes('Kế Toán') || userRoles.includes('KE_TOAN')

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
    const [showStats, setShowStats] = useState(false)
    const [showFilters, setShowFilters] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [legalEntities, setLegalEntities] = useState<LegalEntityRow[]>([])
    const [acctModalId, setAcctModalId] = useState<string | null>(null)
    const [acctEntityId, setAcctEntityId] = useState('')
    const [approvalModalId, setApprovalModalId] = useState<string | null>(null)

    // Advanced filters
    const [salesRepFilter, setSalesRepFilter] = useState<string>('')
    const [channelFilter, setChannelFilter] = useState<string>('')
    const [legalEntityFilter, setLegalEntityFilter] = useState<string>('')
    const [warehouseFilter, setWarehouseFilter] = useState<string>('')
    const [paymentTermFilter, setPaymentTermFilter] = useState<string>('')
    const [pendingActionFilter, setPendingActionFilter] = useState<boolean>(false)

    // TanStack Query — cache sales data, survive tab switches
    const queryKey = [
        'sales', 
        { 
            search: search || undefined, 
            status: statusFilter || undefined, 
            page, 
            sortBy, 
            sortDir, 
            dateFrom: dateFrom || undefined, 
            dateTo: dateTo || undefined,
            salesRepId: salesRepFilter || undefined,
            channel: channelFilter || undefined,
            legalEntityId: legalEntityFilter || undefined,
            warehouseId: warehouseFilter || undefined,
            paymentTerm: paymentTermFilter || undefined,
            pendingAction: pendingActionFilter || undefined
        }
    ]
    const { data: queryData, isLoading: loading, refetch } = useQuery({
        queryKey,
        queryFn: () => getSalesPageData({
            search: search || undefined,
            status: statusFilter as SOStatus || undefined,
            page,
            pageSize: 20,
            sortBy: sortBy as any,
            sortDir: sortDir as any,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            salesRepId: salesRepFilter || undefined,
            channel: channelFilter as any || undefined,
            legalEntityId: legalEntityFilter || undefined,
            warehouseId: warehouseFilter || undefined,
            paymentTerm: paymentTermFilter || undefined,
            pendingAction: pendingActionFilter || undefined
        }),
        initialData: !search && !statusFilter && page === 1 && sortBy === 'createdAt' && sortDir === 'desc' && !dateFrom && !dateTo && !salesRepFilter && !channelFilter && !legalEntityFilter && !warehouseFilter && !paymentTermFilter && !pendingActionFilter
            ? initialData
            : undefined,
        staleTime: 30_000,
    })

    const rows = queryData?.rows ?? []
    const total = queryData?.total ?? 0
    const stats = queryData?.stats ?? { monthRevenue: 0, monthOrders: 0, pendingApproval: 0, draft: 0, confirmed: 0 }
    const counts = queryData?.statusCounts ?? {}

    const salesReps = (queryData as any)?.salesReps ?? (initialData as any)?.salesReps ?? []
    const pageLegalEntities = (queryData as any)?.legalEntities ?? (initialData as any)?.legalEntities ?? []
    const pageWarehouses = (queryData as any)?.warehouses ?? (initialData as any)?.warehouses ?? []
    const paymentTerms = (queryData as any)?.paymentTerms ?? (initialData as any)?.paymentTerms ?? []

    const hasActiveFilters = !!(search || statusFilter || dateFrom || dateTo || salesRepFilter || channelFilter || legalEntityFilter || warehouseFilter || paymentTermFilter || pendingActionFilter)

    const handleClearFilters = () => {
        setSearchInput('')
        setSearch('')
        setStatusFilter('')
        setDateFrom('')
        setDateTo('')
        setSalesRepFilter('')
        setChannelFilter('')
        setLegalEntityFilter('')
        setWarehouseFilter('')
        setPaymentTermFilter('')
        setPendingActionFilter(false)
        setPage(1)
        reload({
            search: '', status: '', page: 1, dateFrom: '', dateTo: '',
            salesRepId: '', channel: '', legalEntityId: '', warehouseId: '', paymentTerm: '', pendingAction: false
        }, true)
    }

    // Realtime Supabase Database Listener + Drawer data prefetching
    useEffect(() => {
        getLegalEntities().then(setLegalEntities).catch(() => { })
        getCustomersForSO().catch(() => { })
        getProductsWithStock().catch(() => { })

        // Initialize Supabase realtime channel for live sales_orders updates
        const supabase = createClient()
        const channel = supabase
            .channel('realtime_sales_orders')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'sales_orders',
                },
                () => {
                    // Automatically invalidate cache and refresh list in background when orders change
                    queryClient.invalidateQueries({ queryKey: ['sales'] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [queryClient])

    // Legacy reload — now triggers query refetch
    const reload = useCallback(async (
        overrides?: Partial<{ 
            search: string; status: string; page: number; sortBy: string; sortDir: string; dateFrom: string; dateTo: string;
            salesRepId: string; channel: string; legalEntityId: string; warehouseId: string; paymentTerm: string; pendingAction: boolean
        }>,
        _onlyRows = false
    ) => {
        // Update filter state → queryKey changes → auto refetch
        if (overrides?.search !== undefined) setSearch(overrides.search)
        if (overrides?.status !== undefined) setStatusFilter(overrides.status as SOStatus | '')
        if (overrides?.page !== undefined) setPage(overrides.page)
        if (overrides?.sortBy !== undefined) setSortBy(overrides.sortBy as any)
        if (overrides?.sortDir !== undefined) setSortDir(overrides.sortDir as any)
        if (overrides?.dateFrom !== undefined) setDateFrom(overrides.dateFrom)
        if (overrides?.dateTo !== undefined) setDateTo(overrides.dateTo)
        if (overrides?.salesRepId !== undefined) setSalesRepFilter(overrides.salesRepId)
        if (overrides?.channel !== undefined) setChannelFilter(overrides.channel)
        if (overrides?.legalEntityId !== undefined) setLegalEntityFilter(overrides.legalEntityId)
        if (overrides?.warehouseId !== undefined) setWarehouseFilter(overrides.warehouseId)
        if (overrides?.paymentTerm !== undefined) setPaymentTermFilter(overrides.paymentTerm)
        if (overrides?.pendingAction !== undefined) setPendingActionFilter(overrides.pendingAction)
        // If no overrides, just refetch current query
        if (!overrides || Object.keys(overrides).length === 0) {
            refetch()
        }
    }, [refetch])

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

    // Helper function for optimistic update of order status across all cached pages/queries
    const updateCachedOrderStatus = useCallback(async (id: string, newStatus: SOStatus | null) => {
        await queryClient.cancelQueries({ queryKey: ['sales'] })
        const previousQueries = queryClient.getQueriesData({ queryKey: ['sales'] })
        
        queryClient.setQueriesData({ queryKey: ['sales'] }, (old: any) => {
            if (!old) return old
            return {
                ...old,
                rows: newStatus 
                    ? old.rows.map((row: any) => row.id === id ? { ...row, status: newStatus } : row)
                    : old.rows.filter((row: any) => row.id !== id),
                total: newStatus ? old.total : Math.max(0, old.total - 1),
            }
        })
        
        return { previousQueries }
    }, [queryClient])

    // Rollback utility in case of mutation errors
    const rollbackQueries = useCallback((context: any) => {
        if (context?.previousQueries) {
            context.previousQueries.forEach(([key, value]: any) => {
                queryClient.setQueryData(key, value)
            })
        }
    }, [queryClient])

    const confirmMutation = useMutation({
        mutationFn: confirmSalesOrder,
        onMutate: (id) => updateCachedOrderStatus(id, 'PENDING_ACCOUNTING'),
        onError: (err, id, context) => rollbackQueries(context),
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['sales'] }),
    })

    const cancelMutation = useMutation({
        mutationFn: cancelSalesOrder,
        onMutate: (id) => updateCachedOrderStatus(id, 'CANCELLED'),
        onError: (err, id, context) => rollbackQueries(context),
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['sales'] }),
    })

    const rejectMutation = useMutation({
        mutationFn: rejectSalesOrder,
        onMutate: (id) => updateCachedOrderStatus(id, 'DRAFT'),
        onError: (err, id, context) => rollbackQueries(context),
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['sales'] }),
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const r = await deleteSalesOrder(id)
            if (!r.success) throw new Error(r.error || 'Lỗi không xác định')
            return r
        },
        onMutate: (id) => updateCachedOrderStatus(id, null),
        onError: (err, id, context) => rollbackQueries(context),
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['sales'] }),
    })

    const handleConfirm = async (id: string) => {
        setActionLoading(id)
        toast.promise(confirmMutation.mutateAsync(id), {
            loading: 'Đang xác nhận...',
            success: 'Đã chuyển sang Chờ KT Duyệt (Cập nhật tức thì)!',
            error: 'Không thể xác nhận đơn hàng',
            finally: () => setActionLoading(null),
        })
    }

    const handleCancel = async (id: string) => {
        if (!confirm('Huỷ đơn hàng này?')) return
        setActionLoading(id)
        toast.promise(cancelMutation.mutateAsync(id), {
            loading: 'Đang huỷ...',
            success: 'Đã huỷ đơn hàng (Cập nhật tức thì)!',
            error: 'Không thể huỷ',
            finally: () => setActionLoading(null),
        })
    }

    const handleApprove = async (id: string) => {
        setApprovalModalId(id)
    }

    const handleReject = async (id: string) => {
        if (!confirm('Từ chối đơn hàng này?')) return
        setActionLoading(id)
        toast.promise(rejectMutation.mutateAsync(id), {
            loading: 'Đang từ chối...',
            success: 'Đã từ chối (Cập nhật tức thì)!',
            error: 'Không thể từ chối',
            finally: () => setActionLoading(null),
        })
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa vĩnh viễn đơn hàng nháp này?')) return
        setActionLoading(id)
        toast.promise(deleteMutation.mutateAsync(id), {
            loading: 'Đang xóa đơn nháp...',
            success: 'Đã xóa đơn hàng nháp thành công (Cập nhật tức thì)!',
            error: (e: any) => `Không thể xóa: ${e.message}`,
            finally: () => setActionLoading(null),
        })
    }

    const handleClone = async (id: string) => {
        toast.promise(cloneSalesOrder(id).then(r => { if (!r.success) throw new Error(r.error); reload(); return r }), {
            loading: 'Đang tạo bản sao...', success: (r) => `Clone thành công: ${r.soNo}`, error: (e: any) => `Lỗi: ${e.message}`,
        })
    }

    const handleExport = async () => {
        toast.promise(
            exportSalesOrdersExcel({
                status: statusFilter || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                salesRepId: salesRepFilter || undefined,
                channel: channelFilter as any || undefined,
                legalEntityId: legalEntityFilter || undefined,
                warehouseId: warehouseFilter || undefined,
                paymentTerm: paymentTermFilter || undefined,
                pendingAction: pendingActionFilter || undefined,
            }).then(({ base64 }) => {
                const byteCharacters = atob(base64)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `sales-orders-${new Date().toISOString().split('T')[0]}.xlsx`
                a.click()
                URL.revokeObjectURL(url)
            }),
            { loading: 'Đang xuất file Excel...', success: 'Đã tải xuống file Excel!', error: 'Lỗi xuất file Excel' }
        )
    }

    return (
        <div className="space-y-4 max-w-screen-2xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {/* Inline Quick Stats */}
                    <div className="hidden lg:flex items-center gap-x-4 text-xs">
                        <span style={{ color: '#8AAEBB' }}>Doanh Thu: <strong className="font-mono text-sm ml-1" style={{ color: '#87CBB9' }}>₫{(stats.monthRevenue / 1e9).toFixed(1)}T</strong></span>
                        <span style={{ color: '#8AAEBB' }}>Đơn: <strong className="font-mono text-sm ml-1" style={{ color: '#5BA88A' }}>{stats.monthOrders}</strong></span>
                        <span style={{ color: '#8AAEBB' }}>Chờ duyệt: <strong className="font-mono text-sm ml-1" style={{ color: '#D4A853' }}>{stats.pendingApproval}</strong></span>
                        <span style={{ color: '#8AAEBB' }}>Xác nhận: <strong className="font-mono text-sm ml-1" style={{ color: '#4A8FAB' }}>{stats.confirmed}</strong></span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowStats(!showStats)}
                        className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-all rounded-md"
                        style={{ 
                            background: showStats ? 'rgba(135,203,185,0.15)' : 'rgba(138,174,187,0.1)', 
                            color: showStats ? '#87CBB9' : '#8AAEBB', 
                            border: `1px solid ${showStats ? 'rgba(135,203,185,0.3)' : 'rgba(138,174,187,0.25)'}` 
                        }}
                        onMouseEnter={e => {
                            if (!showStats) e.currentTarget.style.background = 'rgba(138,174,187,0.2)'
                        }}
                        onMouseLeave={e => {
                            if (!showStats) e.currentTarget.style.background = 'rgba(138,174,187,0.1)'
                        }}
                    >
                        📊 Thống Kê
                    </button>
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

            {/* Collapsible Stats Section */}
            {showStats && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4A6A7A' }}>Thống Kê Chi Tiết</span>
                        <button onClick={() => setShowStats(false)} className="text-xs font-semibold hover:underline flex items-center gap-1" style={{ color: '#87CBB9' }}>
                            Thu gọn chỉ số ✕
                        </button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <SOStatCard label="Doanh Thu Tháng" value={`₫${(stats.monthRevenue / 1e9).toFixed(1)}T`} accent="#87CBB9" />
                        <SOStatCard label="Đơn Tháng Này" value={stats.monthOrders} accent="#5BA88A" />
                        <SOStatCard label="Chờ Duyệt" value={stats.pendingApproval} accent="#D4A853" />
                        <SOStatCard label="Đã Xác Nhận" value={stats.confirmed} accent="#4A8FAB" />
                        <SOStatCard label="Bản Nháp" value={stats.draft} accent="#8AAEBB" />
                    </div>
                </div>
            )}

            {/* Toolbar: Tabs & Main Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-[#2A4355]/30">
                {/* Left side: Quick Filter Tabs */}
                <div className="flex-1 min-w-0">
                    <FilterTabs active={statusFilter} counts={counts} onChange={handleStatusTab} />
                </div>

                {/* Right side: Search + Date inputs + Filter button */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Search input */}
                    <div className="relative w-full sm:w-48 xl:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
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
                            className="w-full pl-9 pr-3 py-1.5 text-xs outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}
                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                    </div>

                    {/* Compact Date inputs */}
                    <div className="flex items-center gap-1 bg-[#1B2E3D] px-2 py-1 border border-[#2A4355] rounded-[4px]">
                        <Calendar size={12} style={{ color: '#4A6A7A' }} />
                        <input type="date" value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(1); reload({ dateFrom: e.target.value, page: 1 }, true) }}
                            className="bg-transparent border-none text-[11px] text-[#8AAEBB] outline-none w-[95px] p-0" />
                        <span className="text-[10px]" style={{ color: '#4A6A7A' }}>→</span>
                        <input type="date" value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(1); reload({ dateTo: e.target.value, page: 1 }, true) }}
                            className="bg-transparent border-none text-[11px] text-[#8AAEBB] outline-none w-[95px] p-0" />
                    </div>

                    {/* Filter Toggle Button */}
                    {(() => {
                        const hasAdvancedFilters = !!(salesRepFilter || channelFilter || legalEntityFilter || warehouseFilter || paymentTermFilter || pendingActionFilter);
                        return (
                            <button onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded transition-all"
                                style={{
                                    background: (showFilters || hasAdvancedFilters) ? 'rgba(135,203,185,0.15)' : '#1B2E3D',
                                    color: (showFilters || hasAdvancedFilters) ? '#87CBB9' : '#8AAEBB',
                                    border: `1px solid ${(showFilters || hasAdvancedFilters) ? 'rgba(135,203,185,0.3)' : '#2A4355'}`,
                                }}
                            >
                                <Plus size={12} style={{ transform: showFilters ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                Bộ lọc
                                {hasAdvancedFilters && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#87CBB9]" />
                                )}
                            </button>
                        );
                    })()}
                </div>
            </div>

            {/* Collapsible Advanced Filters */}
            {showFilters && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-3 rounded-lg animate-in slide-in-from-top-2 duration-150" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: '#4A6A7A' }}>Nhân viên Sales</label>
                        <select value={salesRepFilter} 
                            onChange={e => { setSalesRepFilter(e.target.value); setPage(1); reload({ salesRepId: e.target.value, page: 1 }, true) }}
                            className="w-full px-2 py-1.5 text-xs outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB', borderRadius: '4px' }}>
                            <option value="">Tất cả Sales</option>
                            {salesReps.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: '#4A6A7A' }}>Kênh</label>
                        <select value={channelFilter} 
                            onChange={e => { setChannelFilter(e.target.value); setPage(1); reload({ channel: e.target.value, page: 1 }, true) }}
                            className="w-full px-2 py-1.5 text-xs outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB', borderRadius: '4px' }}>
                            <option value="">Tất cả kênh</option>
                            <option value="HORECA">HORECA</option>
                            <option value="WHOLESALE_DISTRIBUTOR">Đại Lý</option>
                            <option value="VIP_RETAIL">VIP</option>
                            <option value="DIRECT_INDIVIDUAL">Trực Tiếp</option>
                            <option value="CORPORATE">Doanh Nghiệp</option>
                            <option value="RETAIL">Bán Lẻ</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: '#4A6A7A' }}>Pháp nhân</label>
                        <select value={legalEntityFilter} 
                            onChange={e => { setLegalEntityFilter(e.target.value); setPage(1); reload({ legalEntityId: e.target.value, page: 1 }, true) }}
                            className="w-full px-2 py-1.5 text-xs outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB', borderRadius: '4px' }}>
                            <option value="">Tất cả pháp nhân</option>
                            {pageLegalEntities.map((le: any) => (
                                <option key={le.id} value={le.id}>{le.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: '#4A6A7A' }}>Kho xuất</label>
                        <select value={warehouseFilter} 
                            onChange={e => { setWarehouseFilter(e.target.value); setPage(1); reload({ warehouseId: e.target.value, page: 1 }, true) }}
                            className="w-full px-2 py-1.5 text-xs outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB', borderRadius: '4px' }}>
                            <option value="">Tất cả kho</option>
                            {pageWarehouses.map((wh: any) => (
                                <option key={wh.id} value={wh.id}>{wh.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: '#4A6A7A' }}>Điều khoản</label>
                        <select value={paymentTermFilter} 
                            onChange={e => { setPaymentTermFilter(e.target.value); setPage(1); reload({ paymentTerm: e.target.value, page: 1 }, true) }}
                            className="w-full px-2 py-1.5 text-xs outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB', borderRadius: '4px' }}>
                            <option value="">Tất cả</option>
                            {paymentTerms.map((pt: string) => (
                                <option key={pt} value={pt}>{pt}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-1.5 cursor-pointer py-1.5 text-xs font-semibold" style={{ color: '#8AAEBB' }}>
                            <input type="checkbox" checked={pendingActionFilter} 
                                onChange={e => { setPendingActionFilter(e.target.checked); setPage(1); reload({ pendingAction: e.target.checked, page: 1 }, true) }}
                                className="rounded border-[#2A4355] text-[#87CBB9] focus:ring-0 focus:ring-offset-0 bg-[#1B2E3D] w-4 h-4" />
                            <span>⚠️ Cần xử lý</span>
                        </label>
                    </div>
                </div>
            )}

            {/* Table (Desktop View) */}
            <div className="hidden md:block rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse', minWidth: 950 }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                <SortHeader label="Số SO" field="soNo" current={sortBy} dir={sortDir} onSort={handleSort} style={{ width: '10%' }} />
                                <th className="px-4 py-1.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#8AAEBB', width: '22%' }}>Khách Hàng</th>
                                <th className="px-4 py-1.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#8AAEBB', width: '8%' }}>Kênh</th>
                                <th className="px-4 py-1.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#8AAEBB', width: '8%' }}>Pháp Nhân</th>
                                <SortHeader label="Doanh Số" field="totalAmount" current={sortBy} dir={sortDir} onSort={handleSort} style={{ width: '12%' }} />
                                <th className="px-4 py-1.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#8AAEBB', width: '12%' }}>Nhân viên Sales</th>
                                <th className="px-4 py-1.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#8AAEBB', width: '12%' }}>Trạng Thái</th>
                                <SortHeader label="Ngày Tạo" field="createdAt" current={sortBy} dir={sortDir} onSort={handleSort} style={{ width: '8%' }} />
                                <th className="px-4 py-1.5 text-xs uppercase tracking-wider font-semibold text-center" style={{ color: '#8AAEBB', width: '18%' }}>Hành Động</th>
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
                                    <p className="text-sm font-semibold">{hasActiveFilters ? 'Không tìm thấy đơn hàng phù hợp với bộ lọc' : 'Hệ thống chưa có đơn hàng nào'}</p>
                                    {hasActiveFilters && (
                                         <button onClick={handleClearFilters} className="mt-3 px-3 py-1.5 text-xs font-semibold rounded transition-all" style={{ background: '#87CBB9', color: '#0A1926' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                             Xóa Bộ Lọc
                                         </button>
                                    )}
                                </td></tr>
                            ) : rows.map(row => (
                                <tr key={row.id}
                                    style={{ borderBottom: '1px solid rgba(42,67,85,0.5)', background: 'transparent' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <td className="px-4 py-1.5 whitespace-nowrap">
                                        <span className="text-[11px] font-bold font-mono" style={{ color: '#87CBB9' }}>{row.soNo}</span>
                                    </td>
                                    <td className="px-4 py-1.5">
                                        <p className="text-[13px] font-semibold truncate max-w-[240px]" style={{ color: '#E8F1F2' }} title={row.customerName}>{row.customerName}</p>
                                        <p className="text-[10px] font-mono" style={{ color: '#4A6A7A' }}>{row.customerCode}</p>
                                    </td>
                                    <td className="px-4 py-1.5 whitespace-nowrap">
                                        <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
                                            style={{ background: 'rgba(135,203,185,0.1)', color: '#8AAEBB' }}>
                                            {CHANNEL_LABEL[row.channel] ?? row.channel}
                                        </span>
                                    </td>
                                    <td className="px-4 py-1.5 whitespace-nowrap">
                                        {row.legalEntityCode ? (
                                            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold"
                                                style={{ background: row.legalEntityCode === 'TA' ? 'rgba(212,168,83,0.12)' : 'rgba(135,203,185,0.12)', color: row.legalEntityCode === 'TA' ? '#D4A853' : '#87CBB9' }}>
                                                {row.legalEntityCode}
                                            </span>
                                        ) : (
                                            <span className="text-[11px]" style={{ color: '#2A4355' }}>—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-1.5 whitespace-nowrap">
                                        <p className="text-[13px] font-bold font-mono" style={{ color: '#E8F1F2' }}>{formatVND(row.totalAmount)}</p>
                                        {row.orderDiscount > 0 && <p className="text-[10px]" style={{ color: '#5BA88A' }}>CK {row.orderDiscount}%</p>}
                                    </td>
                                    <td className="px-4 py-1.5 text-xs whitespace-nowrap" style={{ color: '#8AAEBB' }}>{row.salesRepName}</td>
                                    <td className="px-4 py-1.5 whitespace-nowrap"><StatusBadge status={row.status} approvalStep={row.approvalStep} /></td>
                                    <td className="px-4 py-1.5 text-xs whitespace-nowrap" style={{ color: '#4A6A7A' }}>{formatDate(row.createdAt)}</td>
                                    <td className="px-4 py-1.5">
                                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                            <button onClick={() => setDetailId(row.id)} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded transition-all"
                                                style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.25)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.15)')}>
                                                <Eye size={11} /> Xem
                                            </button>
                                            <button onClick={() => window.open(`/dashboard/sales/print?id=${row.id}`, '_blank')} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded transition-all"
                                                style={{ background: 'rgba(138,174,187,0.15)', color: '#8AAEBB', border: '1px solid rgba(138,174,187,0.3)' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(138,174,187,0.25)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(138,174,187,0.15)')}>
                                                <Printer size={11} /> In
                                            </button>
                                            {row.status === 'PENDING_APPROVAL' && (
                                                ((isSaleAdminOrMgr && row.approvalStep === 1) || (isCEO && row.approvalStep === 2) || (!row.approvalStep && (isCEO || isSaleAdminOrMgr)))
                                            ) && (
                                                <>
                                                    <button onClick={() => handleApprove(row.id)} disabled={actionLoading === row.id}
                                                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded transition-all"
                                                        style={{ background: 'rgba(91,168,138,0.2)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.45)' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(91,168,138,0.3)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(91,168,138,0.2)')}>
                                                        {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : <><CheckCircle2 size={11} /> Duyệt</>}
                                                    </button>
                                                    <button onClick={() => handleReject(row.id)} disabled={actionLoading === row.id}
                                                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded transition-all"
                                                        style={{ background: 'rgba(139,26,46,0.15)', color: '#E85D5D', border: '1px solid rgba(139,26,46,0.4)' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,26,46,0.25)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,26,46,0.15)')}>
                                                        {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : <><XCircle size={11} /> Từ Chối</>}
                                                    </button>
                                                </>
                                            )}
                                            {row.status === 'DRAFT' && (
                                                <>
                                                    <button onClick={() => handleConfirm(row.id)} disabled={actionLoading === row.id}
                                                        className="px-1.5 py-1 text-[10px] font-bold"
                                                        style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)', borderRadius: '4px' }}>
                                                        {actionLoading === row.id ? <Loader2 size={10} className="animate-spin" /> : 'Xác Nhận'}
                                                    </button>
                                                    <button onClick={() => setEditId(row.id)}
                                                        className="flex items-center gap-0.5 px-1.5 py-1 text-[10px] font-bold"
                                                        style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', borderRadius: '4px' }}>
                                                        <Pencil size={10} /> Sửa
                                                    </button>
                                                    <button onClick={() => handleDelete(row.id)} disabled={actionLoading === row.id}
                                                        className="px-1.5 py-1 text-[10px] font-bold border"
                                                        style={{ background: 'rgba(220,38,38,0.1)', color: '#EF4444', borderColor: 'rgba(220,38,38,0.25)', borderRadius: '4px' }}>
                                                        Xóa
                                                    </button>
                                                </>
                                            )}
                                            {row.status === 'PENDING_ACCOUNTING' && canAcctApprove && (
                                                <>
                                                    <button onClick={() => { setAcctModalId(row.id); setAcctEntityId((row as any).legalEntityId ?? '') }}
                                                        className="flex items-center gap-0.5 px-1.5 py-1 text-[10px] font-bold"
                                                        style={{ background: 'rgba(8,145,178,0.15)', color: '#0891B2', border: '1px solid rgba(8,145,178,0.35)', borderRadius: '4px' }}>
                                                        <CheckCircle2 size={10} /> KT Duyệt
                                                    </button>
                                                    <button onClick={async () => {
                                                        if (!confirm('Trả đơn về DRAFT cho sales sửa?')) return
                                                        setActionLoading(row.id)
                                                        toast.promise(accountingRejectSO(row.id).then(() => reload()), {
                                                            loading: 'Đang trả về...', success: 'Đã trả về DRAFT', error: 'Lỗi', finally: () => setActionLoading(null)
                                                        })
                                                    }} disabled={actionLoading === row.id}
                                                        className="flex items-center gap-0.5 px-1.5 py-1 text-[10px] font-bold"
                                                        style={{ background: 'rgba(139,26,46,0.12)', color: '#E85D5D', border: '1px solid rgba(139,26,46,0.3)', borderRadius: '4px' }}>
                                                        <XCircle size={10} /> KT Trả Về
                                                    </button>
                                                </>
                                            )}
                                            {['PENDING_APPROVAL', 'CONFIRMED'].includes(row.status) && (
                                                <button onClick={() => handleCancel(row.id)} disabled={actionLoading === row.id}
                                                    className="px-1.5 py-1 text-[10px] font-bold"
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
                        <p className="text-sm font-semibold">{hasActiveFilters ? 'Không tìm thấy đơn hàng phù hợp với bộ lọc' : 'Hệ thống chưa có đơn hàng nào'}</p>
                        {hasActiveFilters && (
                             <button onClick={handleClearFilters} className="mt-3 px-3 py-1.5 text-xs font-semibold rounded transition-all" style={{ background: '#87CBB9', color: '#0A1926' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                 Xóa Bộ Lọc
                             </button>
                        )}
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
                        <h3 className="text-lg font-bold mb-4" style={{ color: '#E8F1F2' }}>
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
                    <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>
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
