'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, FileText, CheckCircle2, XCircle, Clock, Truck, ReceiptText, DollarSign, Eye, Loader2, X, AlertTriangle, TrendingUp, TrendingDown, Pencil, Copy, Download, ArrowUpDown, Calendar, ChevronUp, ChevronDown, Printer, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileX2, RotateCcw, AlertCircle, CloudUpload, ShieldCheck, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { SalesOrderRow, SOStatus, SOType, confirmSalesOrder, cancelSalesOrder, getSalesOrderDetailWithMargin, getSalesOrderDetailWithMarginAndTimeline, SOMarginData, approveSalesOrder, rejectSalesOrder, getSOTimeline, SOTimelineEvent, cloneSalesOrder, exportSalesOrdersExcel, exportMisaSmeExcel, exportVnptInvoiceExcel, accountingApproveSO, accountingRejectSO, getLegalEntities, LegalEntityRow, deleteSalesOrder, getSalesPageData, getAvailableVintagesForProducts, getSimpleWarehouses, getSalesOrderDetail, getCustomersForSO, getProductsWithStock, createARInvoiceForSO, updateARInvoiceNo, deleteARInvoice, SalesChannel, toggleInvoiceExempt, markSalesOrderPaid } from './actions'
import { uploadDraftInvoiceToVnpt, deleteDraftInvoiceFromVnpt, syncVnptInvoiceForOrder } from './actions-vnpt'
import { checkInvoiceDateDiscrepancy } from '@/lib/vnpt/date-utils'
import type { InvoiceDateWarning } from '@/lib/vnpt/types'
import { formatVND, formatDate, formatDateTime } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { CloneSOData } from './CreateSODrawer'
const CreateSODrawer = dynamic(() => import('./CreateSODrawer').then(m => m.CreateSODrawer), {
    loading: () => null,
    ssr: false,
})
const EditSODrawer = dynamic(() => import('./EditSODrawer').then(m => m.EditSODrawer), {
    loading: () => null,
    ssr: false
})

const STATUS_CFG: Record<SOStatus, { label: string; color: string; bg: string; icon: React.FC<any> }> = {
    DRAFT: { label: 'Nháp', color: '#475569', bg: 'rgba(138,174,187,0.12)', icon: FileText },
    PENDING_APPROVAL: { label: 'Chờ Duyệt', color: '#D4A853', bg: 'rgba(212,168,83,0.15)', icon: Clock },
    PENDING_ACCOUNTING: { label: 'Chờ KT Duyệt', color: '#0891B2', bg: 'rgba(8,145,178,0.12)', icon: Clock },
    CONFIRMED: { label: 'Đã Xác Nhận', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)', icon: CheckCircle2 },
    PARTIALLY_DELIVERED: { label: 'Giao 1 Phần', color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)', icon: Truck },
    DELIVERED: { label: 'Đã Giao', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)', icon: Truck },
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

export type DatePresetKey = 
    | 'ALL' 
    | 'TODAY' 
    | 'YESTERDAY' 
    | 'THIS_WEEK' 
    | 'LAST_WEEK' 
    | 'THIS_MONTH' 
    | 'LAST_MONTH' 
    | 'THIS_QUARTER' 
    | 'LAST_QUARTER' 
    | 'THIS_YEAR' 
    | 'LAST_YEAR' 
    | 'CUSTOM'

export const DATE_PRESET_OPTIONS: { key: DatePresetKey; label: string }[] = [
    { key: 'ALL', label: 'Tất cả thời gian' },
    { key: 'TODAY', label: 'Hôm nay' },
    { key: 'YESTERDAY', label: 'Hôm qua' },
    { key: 'THIS_WEEK', label: 'Tuần này' },
    { key: 'LAST_WEEK', label: 'Tuần trước' },
    { key: 'THIS_MONTH', label: 'Tháng này' },
    { key: 'LAST_MONTH', label: 'Tháng trước' },
    { key: 'THIS_QUARTER', label: 'Quý này' },
    { key: 'LAST_QUARTER', label: 'Quý trước' },
    { key: 'THIS_YEAR', label: 'Năm nay' },
    { key: 'LAST_YEAR', label: 'Năm trước' },
    { key: 'CUSTOM', label: 'Tùy chỉnh' },
]

export function getDatePresetRange(preset: DatePresetKey): { dateFrom: string; dateTo: string } {
    const now = new Date()
    const formatDateStr = (d: Date) => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    switch (preset) {
        case 'TODAY': {
            const todayStr = formatDateStr(now)
            return { dateFrom: todayStr, dateTo: todayStr }
        }
        case 'YESTERDAY': {
            const y = new Date(now)
            y.setDate(y.getDate() - 1)
            const yStr = formatDateStr(y)
            return { dateFrom: yStr, dateTo: yStr }
        }
        case 'THIS_WEEK': {
            const dayOfWeek = now.getDay()
            const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
            const mon = new Date(now)
            mon.setDate(now.getDate() + diffToMon)
            return { dateFrom: formatDateStr(mon), dateTo: formatDateStr(now) }
        }
        case 'LAST_WEEK': {
            const dayOfWeek = now.getDay()
            const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
            const lastMon = new Date(now)
            lastMon.setDate(now.getDate() + diffToMon - 7)
            const lastSun = new Date(lastMon)
            lastSun.setDate(lastMon.getDate() + 6)
            return { dateFrom: formatDateStr(lastMon), dateTo: formatDateStr(lastSun) }
        }
        case 'THIS_MONTH': {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
            return { dateFrom: formatDateStr(firstDay), dateTo: formatDateStr(now) }
        }
        case 'LAST_MONTH': {
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
            return { dateFrom: formatDateStr(firstDay), dateTo: formatDateStr(lastDay) }
        }
        case 'THIS_QUARTER': {
            const currentMonth = now.getMonth()
            const qStartMonth = Math.floor(currentMonth / 3) * 3
            const firstDay = new Date(now.getFullYear(), qStartMonth, 1)
            return { dateFrom: formatDateStr(firstDay), dateTo: formatDateStr(now) }
        }
        case 'LAST_QUARTER': {
            const currentMonth = now.getMonth()
            const qStartMonth = Math.floor(currentMonth / 3) * 3 - 3
            const firstDay = new Date(now.getFullYear(), qStartMonth, 1)
            const lastDay = new Date(now.getFullYear(), qStartMonth + 3, 0)
            return { dateFrom: formatDateStr(firstDay), dateTo: formatDateStr(lastDay) }
        }
        case 'THIS_YEAR': {
            const firstDay = new Date(now.getFullYear(), 0, 1)
            return { dateFrom: formatDateStr(firstDay), dateTo: formatDateStr(now) }
        }
        case 'LAST_YEAR': {
            const firstDay = new Date(now.getFullYear() - 1, 0, 1)
            const lastDay = new Date(now.getFullYear() - 1, 11, 31)
            return { dateFrom: formatDateStr(firstDay), dateTo: formatDateStr(lastDay) }
        }
        case 'ALL':
        default:
            return { dateFrom: '', dateTo: '' }
    }
}

const SODetailSkeleton = () => (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 animate-pulse">
        {/* Progress bar skeleton */}
        <div className="py-3 px-4 rounded-lg space-y-3 animate-pulse" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="flex justify-between">
                <div className="h-3 w-24 bg-[#E2E8F0] rounded animate-pulse" />
                <div className="h-4 w-16 bg-[#E2E8F0] rounded-full animate-pulse" />
            </div>
            <div className="h-6 bg-[#E2E8F0] rounded w-full animate-pulse" />
        </div>

        {/* Two column layout skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200/40 animate-pulse">
            <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-[#E2E8F0] rounded w-1/3 font-bold animate-pulse" />
                <div className="space-y-2 animate-pulse">
                    <div className="h-3 bg-[#E2E8F0] rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-[#E2E8F0] rounded w-1/2 animate-pulse" />
                    <div className="h-3 bg-[#E2E8F0] rounded w-2/3 animate-pulse" />
                </div>
            </div>
            <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-[#E2E8F0] rounded w-1/3 font-bold animate-pulse" />
                <div className="space-y-2 animate-pulse">
                    <div className="h-3 bg-[#E2E8F0] rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-[#E2E8F0] rounded w-1/2 animate-pulse" />
                    <div className="h-3 bg-[#E2E8F0] rounded w-2/3 animate-pulse" />
                </div>
            </div>
        </div>

        {/* Lines/Items list table skeleton */}
        <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-[#E2E8F0] rounded w-1/4 animate-pulse" />
            <div className="space-y-2 animate-pulse">
                <div className="h-10 bg-[#E2E8F0] rounded w-full animate-pulse" />
                <div className="h-10 bg-[#E2E8F0] rounded w-full animate-pulse" />
                <div className="h-10 bg-[#E2E8F0] rounded w-full animate-pulse" />
            </div>
        </div>
    </div>
)

const getPriceBadgeStyle = (source: string | null) => {
    switch (source) {
        case 'SPECIAL_PRICE':
            return { background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)' }
        case 'FIXED_PRICE':
            return { background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.25)' }
        case 'FIXED_DISCOUNT':
            return { background: 'rgba(230,138,0,0.15)', color: '#E68A00', border: '1px solid rgba(230,138,0,0.3)' }
        case 'CHANNEL_BASE':
            return { background: 'rgba(91,168,138,0.1)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.2)' }
        case 'RETAIL_FALLBACK':
            return { background: 'rgba(138,180,248,0.1)', color: '#8AB4F8', border: '1px solid rgba(138,180,248,0.2)' }
        default:
            return { background: 'rgba(74,106,122,0.1)', color: '#64748B', border: '1px solid rgba(74,106,122,0.2)' }
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
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap"
            style={{ color: cfg.color, background: cfg.bg }}>
            <Icon size={11} />
            {label}
        </span>
    )
}

function DeliveryStatusBadge({ 
    status, 
    shipped, 
    ordered 
}: { 
    status?: 'UNDELIVERED' | 'PREPARING' | 'PARTIALLY_DELIVERED' | 'DELIVERED'; 
    shipped?: number; 
    ordered?: number 
}) {
    switch (status) {
        case 'DELIVERED':
            return (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
                    style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                    <Truck size={11} /> Đã Giao
                </span>
            )
        case 'PARTIALLY_DELIVERED':
            return (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
                    style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB', border: '1px solid rgba(74,143,171,0.3)' }}>
                    <Truck size={11} /> Giao 1 phần {ordered ? `(${shipped}/${ordered})` : ''}
                </span>
            )
        case 'PREPARING':
            return (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
                    style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)' }}>
                    <Clock size={11} /> Đang soạn
                </span>
            )
        case 'UNDELIVERED':
        default:
            return (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                    style={{ background: 'rgba(138,174,187,0.06)', color: '#6A8A9A', border: '1px solid rgba(138,174,187,0.15)' }}>
                    Chưa giao
                </span>
            )
    }
}

function SOStatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
    return (
        <div className="p-4 rounded-md flex items-center gap-4"
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: `${accent}20` }}>
                <div className="w-3 h-3 rounded-sm" style={{ background: accent }} />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>{label}</p>
                <p className="text-xl font-bold mt-0.5 font-mono" style={{ color: '#0F172A' }}>{value}</p>
                {sub && <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{sub}</p>}
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
                            background: isActive ? 'rgba(8, 145, 178, 0.08)' : 'transparent',
                            color: isActive ? '#87CBB9' : '#64748B',
                            border: `1px solid ${isActive ? 'rgba(8, 145, 178, 0.25)' : 'transparent'}`,
                        }}
                        onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'rgba(135,203,185,0.06)')}
                        onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}>
                        {TAB_LABELS[tab]}
                        <span className="px-1.5 py-0.5 text-[10px] rounded-full font-bold"
                            style={{ background: isActive ? 'rgba(8, 145, 178, 0.15)' : 'rgba(74,106,122,0.15)', color: isActive ? '#87CBB9' : '#64748B' }}>
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
            style={{ color: isActive ? '#87CBB9' : '#475569', ...style }}
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

function SODetailDrawer({ 
    soId, 
    onClose, 
    onClone, 
    canSeeMargin,
    canAcctApprove,
    canApprove,
    canCreateInvoice,
    canToggleInvoiceExempt,
    onAcctApprove,
    onAcctReject,
    onApprove,
    onReject,
    onReloadList
}: { 
    soId: string; 
    onClose: () => void; 
    onClone: (id: string) => void; 
    canSeeMargin: boolean;
    canAcctApprove?: boolean;
    canApprove?: boolean;
    canCreateInvoice?: boolean;
    canToggleInvoiceExempt?: boolean;
    onAcctApprove?: (id: string, legalEntityId?: string) => void;
    onAcctReject?: (id: string) => void;
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
    onReloadList?: () => void;
}) {
    const [detail, setDetail] = useState<DetailType>(null)
    const [marginData, setMarginData] = useState<SOMarginData | null>(null)
    const [timeline, setTimeline] = useState<SOTimelineEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [timelineLoading, setTimelineLoading] = useState(true)
    const [creatingInvoice, setCreatingInvoice] = useState(false)
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null)
    const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null)
    const [togglingExempt, setTogglingExempt] = useState(false)
    const [markingPaid, setMarkingPaid] = useState(false)
    const [uploadingVnpt, setUploadingVnpt] = useState(false)
    const [deletingVnpt, setDeletingVnpt] = useState(false)
    const [syncingVnpt, setSyncingVnpt] = useState(false)
    const [dateWarningModal, setDateWarningModal] = useState<InvoiceDateWarning | null>(null)

    const handleToggleExempt = async () => {
        if (!soId || !detail || togglingExempt) return
        if (detail.isInvoiceExempt) {
            if (!window.confirm('Bạn có chắc chắn muốn hủy đánh dấu miễn hóa đơn? Kế toán sẽ có thể xuất hóa đơn VAT sau khi hủy.')) return
            setTogglingExempt(true)
            try {
                const res = await toggleInvoiceExempt(soId, false)
                if (res.success) {
                    toast.success('Đã hủy miễn hóa đơn VAT cho đơn hàng!')
                    const updated = await getSalesOrderDetail(soId)
                    setDetail(updated)
                    getSOTimeline(soId).then(setTimeline).catch(() => {})
                    onReloadList?.()
                } else {
                    toast.error(res.error || 'Lỗi thao tác')
                }
            } catch (err: any) {
                toast.error(err.message || 'Lỗi hệ thống')
            } finally {
                setTogglingExempt(false)
            }
        } else {
            const reason = window.prompt(
                'Nhập lý do không xuất hóa đơn VAT (ví dụ: Khách lẻ không lấy HĐ, tiêu dùng nội bộ, quà biếu tặng...):',
                'Khách lẻ không lấy hóa đơn'
            )
            if (reason === null) return
            setTogglingExempt(true)
            try {
                const res = await toggleInvoiceExempt(soId, true, reason)
                if (res.success) {
                    toast.success('Đã đánh dấu không xuất hóa đơn VAT thành công!')
                    const updated = await getSalesOrderDetail(soId)
                    setDetail(updated)
                    getSOTimeline(soId).then(setTimeline).catch(() => {})
                    onReloadList?.()
                } else {
                    toast.error(res.error || 'Lỗi thao tác')
                }
            } catch (err: any) {
                toast.error(err.message || 'Lỗi hệ thống')
            } finally {
                setTogglingExempt(false)
            }
        }
    }

    const handleMarkPaid = async () => {
        if (!soId || !detail || markingPaid) return
        const totalVatIncluded = Number(detail.totalAmount) + Number(detail.vatAmount ?? 0)
        if (!window.confirm(`Xác nhận đã thu đủ tiền (${formatVND(totalVatIncluded)}) cho đơn hàng ${detail.soNo}? Đơn hàng sẽ chuyển sang trạng thái ĐÃ THU TIỀN (PAID).`)) return
        setMarkingPaid(true)
        try {
            const res = await markSalesOrderPaid(soId)
            if (res.success) {
                toast.success('Đã xác nhận thu tiền cho đơn hàng!')
                const updated = await getSalesOrderDetail(soId)
                setDetail(updated)
                getSOTimeline(soId).then(setTimeline).catch(() => {})
                onReloadList?.()
            } else {
                toast.error(res.error || 'Lỗi xác nhận thu tiền')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi hệ thống')
        } finally {
            setMarkingPaid(false)
        }
    }

    const handleCreateInvoice = async () => {
        if (!soId || creatingInvoice) return
        const customNo = window.prompt(
            'Nhập mã hóa đơn điện tử VAT (ví dụ: VAT-001234, hoặc để trống để tự động sinh mã hệ thống):',
            ''
        )
        if (customNo === null) return

        setCreatingInvoice(true)
        try {
            const res = await createARInvoiceForSO(soId, customNo || undefined)
            if (res.success) {
                toast.success(`Đã xuất hóa đơn ${res.invoiceNo} cho đơn hàng thành công!`)
                const updated = await getSalesOrderDetail(soId)
                setDetail(updated)
                getSOTimeline(soId).then(setTimeline).catch(() => {})
            } else {
                toast.error(res.error || 'Lỗi xuất hóa đơn')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi kết nối hệ thống')
        } finally {
            setCreatingInvoice(false)
        }
    }

    const handleEditInvoice = async (invId: string, currentInvoiceNo: string) => {
        const newNo = window.prompt('Nhập mã số hóa đơn mới:', currentInvoiceNo)
        if (newNo === null) return
        const trimmed = newNo.trim()
        if (!trimmed) {
            toast.error('Mã số hóa đơn không được để trống')
            return
        }
        if (trimmed === currentInvoiceNo) return

        setEditingInvoiceId(invId)
        try {
            const res = await updateARInvoiceNo(invId, trimmed)
            if (res.success) {
                toast.success(`Đã cập nhật mã hóa đơn thành ${res.invoiceNo}!`)
                const updated = await getSalesOrderDetail(soId)
                setDetail(updated)
                getSOTimeline(soId).then(setTimeline).catch(() => {})
            } else {
                toast.error(res.error || 'Lỗi cập nhật hóa đơn')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi kết nối hệ thống')
        } finally {
            setEditingInvoiceId(null)
        }
    }

    const handleDeleteInvoice = async (invId: string, invNo: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn gỡ bỏ hóa đơn ${invNo} khỏi đơn hàng này không? Trạng thái đơn hàng sẽ được hoàn trả lại.`)) {
            return
        }

        setDeletingInvoiceId(invId)
        try {
            const res = await deleteARInvoice(invId)
            if (res.success) {
                toast.success(`Đã gỡ bỏ hóa đơn ${invNo} thành công!`)
                const updated = await getSalesOrderDetail(soId)
                setDetail(updated)
                getSOTimeline(soId).then(setTimeline).catch(() => {})
            } else {
                toast.error(res.error || 'Lỗi gỡ hóa đơn')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi kết nối hệ thống')
        } finally {
            setDeletingInvoiceId(null)
        }
    }

    const triggerUploadVnptDraft = () => {
        if (!detail) return
        const warn = checkInvoiceDateDiscrepancy(detail.createdAt)
        if (warn.hasWarning) {
            setDateWarningModal(warn)
        } else {
            executeUploadVnptDraft()
        }
    }

    const executeUploadVnptDraft = async () => {
        if (!soId || !detail || uploadingVnpt) return
        setDateWarningModal(null)
        setUploadingVnpt(true)
        try {
            const res = await uploadDraftInvoiceToVnpt(soId)
            if (res.success) {
                toast.success(res.message || 'Đã đẩy hóa đơn nháp lên VNPT thành công!')
                const updated = await getSalesOrderDetail(soId)
                setDetail(updated)
                getSOTimeline(soId).then(setTimeline).catch(() => {})
                onReloadList?.()
            } else {
                toast.error(res.error || 'Lỗi khi đẩy hóa đơn nháp lên VNPT')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi kết nối máy chủ VNPT')
        } finally {
            setUploadingVnpt(false)
        }
    }

    const handleDeleteVnptDraft = async () => {
        if (!soId || !detail || deletingVnpt) return
        if (!window.confirm('Bạn có chắc chắn muốn xóa bản nháp hóa đơn này trên hệ thống VNPT không?')) {
            return
        }
        setDeletingVnpt(true)
        try {
            const res = await deleteDraftInvoiceFromVnpt(soId)
            if (res.success) {
                toast.success(res.message || 'Đã xóa bản nháp VNPT thành công!')
                const updated = await getSalesOrderDetail(soId)
                setDetail(updated)
                getSOTimeline(soId).then(setTimeline).catch(() => {})
                onReloadList?.()
            } else {
                toast.error(res.error || 'Lỗi xóa bản nháp VNPT')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi kết nối')
        } finally {
            setDeletingVnpt(false)
        }
    }

    const handleSyncVnptInvoice = async () => {
        if (!soId || !detail || syncingVnpt) return
        setSyncingVnpt(true)
        try {
            const res = await syncVnptInvoiceForOrder(soId)
            if (res.success) {
                toast.success(res.message || 'Đã đồng bộ số hóa đơn từ VNPT thành công!')
                const updated = await getSalesOrderDetail(soId)
                setDetail(updated)
                getSOTimeline(soId).then(setTimeline).catch(() => {})
                onReloadList?.()
            } else {
                toast.error(res.error || 'Chưa thể đồng bộ số hóa đơn VNPT')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi kết nối kiểm tra VNPT')
        } finally {
            setSyncingVnpt(false)
        }
    }


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

    const detailVatBreakdown = useMemo(() => {
        if (!detail?.lines) return []
        const map: Record<number, number> = {}
        const discountMultiplier = 1 - Number(detail.orderDiscount ?? 0) / 100
        for (const l of detail.lines) {
            const rate = (l as any).vatRate !== undefined && (l as any).vatRate !== null ? Number((l as any).vatRate) : 10
            const lineVal = Number(l.qtyOrdered) * Number(l.unitPrice) * (1 - Number(l.lineDiscountPct ?? 0) / 100) * discountMultiplier
            map[rate] = (map[rate] || 0) + lineVal * (rate / 100)
        }
        return Object.entries(map)
            .map(([rateStr, amt]) => ({ rate: Number(rateStr), amount: Math.round(amt) }))
            .sort((a, b) => a.rate - b.rate)
    }, [detail])

    const getStepTimestamp = (step: SOStatus, orderCreatedAt: Date | string, orderUpdatedAt: Date | string, orderStatus: string): Date | null => {
        if (step === 'DRAFT') return new Date(orderCreatedAt)
        
        if (step === 'PENDING_ACCOUNTING') {
            const ev = timeline.find(e => e.action === 'APPROVE')
            if (ev) return new Date(ev.createdAt)
            
            // Fallback for auto-approved orders that bypass manager approval
            const confirmEv = timeline.find(e => e.action === 'CONFIRM')
            return confirmEv ? new Date(confirmEv.createdAt) : null
        }
        if (step === 'CONFIRMED') {
            const ev = timeline.find(e => e.action === 'ACCOUNTING_APPROVE')
            return ev ? new Date(ev.createdAt) : null
        }
        if (step === 'DELIVERED') {
            const hasDelivery = detail?.deliveryOrders?.some((d: any) => d.status === 'SHIPPED' || d.status === 'DELIVERED')
            const ev = timeline.find(e => (e.action === 'CONFIRM' && e.description?.includes('Phiếu xuất')) || (e as any).entityType === 'DeliveryOrder')
            if (ev) return new Date(ev.createdAt)
            if (hasDelivery) return new Date(orderUpdatedAt)
            return null
        }
        if (step === 'INVOICED') {
            const hasInvoice = (detail?.arInvoices && detail.arInvoices.length > 0)
            const ev = timeline.find(e => e.description?.includes('Hóa đơn') || (e.action === 'CREATE' && (e as any).entityType === 'ARInvoice'))
            if (ev) return new Date(ev.createdAt)
            if (hasInvoice || orderStatus === 'INVOICED' || orderStatus === 'PAID') return new Date(orderUpdatedAt)
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
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col w-full md:w-[740px]" style={{ background: '#F8FAFC', borderLeft: '1px solid #E2E8F0' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <div>
                        <h3 className="font-semibold" style={{ color: '#0F172A', fontSize: 18 }}>
                            {loading ? 'Chi Tiết Đơn Hàng' : `SO: ${detail?.soNo}`}
                        </h3>
                        {detail && (
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs" style={{ color: '#64748B' }}>{detail.customer.name} · {detail.paymentTerm}</p>
                                <StatusBadge status={detail.status as SOStatus} approvalStep={(detail as any).approvalStep} />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {detail && (
                            <>
                                {detail.status === 'PENDING_ACCOUNTING' && canAcctApprove && (
                                    <>
                                        <button onClick={() => onAcctApprove?.(soId, detail.legalEntityId)}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all shadow-sm"
                                            style={{ background: '#0891B2', color: '#FFFFFF' }}>
                                            <CheckCircle2 size={13} /> KT Duyệt
                                        </button>
                                        <button onClick={() => onAcctReject?.(soId)}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all border"
                                            style={{ background: 'rgba(139,26,46,0.15)', color: '#E85D5D', borderColor: 'rgba(139,26,46,0.3)' }}>
                                            <XCircle size={13} /> Trả Về
                                        </button>
                                    </>
                                )}
                                {detail.status === 'PENDING_APPROVAL' && canApprove && (
                                    <>
                                        <button onClick={() => onApprove?.(soId)}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all shadow-sm"
                                            style={{ background: '#5BA88A', color: '#FFFFFF' }}>
                                            <CheckCircle2 size={13} /> Duyệt Đơn
                                        </button>
                                        <button onClick={() => onReject?.(soId)}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all border"
                                            style={{ background: 'rgba(139,26,46,0.15)', color: '#E85D5D', borderColor: 'rgba(139,26,46,0.3)' }}>
                                            <XCircle size={13} /> Từ Chối
                                        </button>
                                    </>
                                )}
                                <button onClick={() => window.open(`/dashboard/sales/print?id=${soId}`, '_blank')}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md"
                                    style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(135,203,185,0.25)' }}
                                    title="In ấn đơn hàng">
                                    <Printer size={12} /> In Đơn
                                </button>
                                <button onClick={() => onClone(soId)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md"
                                    style={{ background: 'rgba(138,174,187,0.12)', color: '#475569', border: '1px solid rgba(138,174,187,0.25)' }}
                                    title="Tạo đơn tương tự">
                                    <Copy size={12} /> Clone
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded" style={{ color: '#64748B' }}><X size={18} /></button>
                    </div>

                </div>

                {loading ? (
                    <SODetailSkeleton />
                ) : !detail ? (
                    <p className="text-center py-8" style={{ color: '#64748B' }}>Không tìm thấy đơn</p>
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
                        <div className="py-3 px-4 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <div className="flex items-center justify-between text-xs mb-4">
                                <span className="font-bold uppercase tracking-wider text-[10px]" style={{ color: '#64748B' }}>Tiến Trình Đơn Hàng</span>
                                <span className="font-semibold text-xs px-2 py-0.5 rounded-full"
                                    style={{ background: STATUS_CFG[detail.status as SOStatus]?.bg, color: STATUS_CFG[detail.status as SOStatus]?.color }}>
                                    {STATUS_CFG[detail.status as SOStatus]?.label}
                                </span>
                            </div>
                            
                            <div className="relative pt-2 pb-1">
                                <div className="absolute top-[12px] h-[2px] z-0" style={{ background: '#E2E8F0', left: '8.33%', right: '8.33%' }}>
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
                                            { s: 'INVOICED', label: detail.isInvoiceExempt ? 'Miễn HĐ' : 'Xuất HĐ' },
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

                                        const hasDelivery = detail.deliveryOrders?.some((d: any) => d.status === 'SHIPPED' || d.status === 'DELIVERED')
                                        const hasInvoice = detail.arInvoices && detail.arInvoices.length > 0

                                        return steps.map((stepInfo, i) => {
                                            const { s, label } = stepInfo
                                            let isDone = activeIdx > i
                                            let isCurrent = activeIdx === i

                                            if (s === 'DELIVERED') {
                                                isDone = !!hasDelivery || detail.status === 'DELIVERED'
                                                isCurrent = (detail.status === 'CONFIRMED' || detail.status === 'PARTIALLY_DELIVERED') && !hasDelivery
                                            } else if (s === 'INVOICED') {
                                                isDone = detail.isInvoiceExempt || hasInvoice || detail.status === 'INVOICED' || detail.status === 'PAID'
                                                isCurrent = detail.status === 'INVOICED' || (detail.status === 'DELIVERED' && !hasInvoice && !detail.isInvoiceExempt)
                                            }

                                            const ts = getStepTimestamp(s as SOStatus, detail.createdAt, detail.updatedAt, detail.status)
                                            
                                            return (
                                                <div key={s} className="flex flex-col items-center flex-1 text-center relative">
                                                    {/* Vòng tròn trạng thái */}
                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all relative z-10"
                                                        style={{
                                                            backgroundColor: isDone ? '#5ba889' : '#FFFFFF',
                                                            color: isDone ? '#0d1e2c' : '#4a6a79',
                                                            border: isCurrent ? '2px solid #87cbb8' : isDone ? 'none' : '2px solid #2a4354',
                                                            boxShadow: isCurrent ? '0 0 8px rgba(135,203,185,0.4)' : 'none',
                                                            boxSizing: 'border-box'
                                                        }}>
                                                        {isDone ? '✓' : i + 1}
                                                    </div>
                                                    
                                                    {/* Nhãn bước */}
                                                    <span className="text-[10px] font-bold mt-2 whitespace-nowrap block" 
                                                        style={{ color: isCurrent ? '#87CBB9' : isDone ? '#0F172A' : '#64748B' }}>
                                                        {label}
                                                    </span>
                                                    
                                                    {/* Mốc thời gian */}
                                                    <span className="text-[8px] font-mono mt-0.5 block leading-none h-2" 
                                                        style={{ color: isDone ? '#475569' : '#E2E8F0' }}>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200/40">
                            {/* Column 1: Customer details */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>Thông tin chung</h4>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-1 border-b border-slate-200/20">
                                        <span style={{ color: '#64748B' }}>Khách hàng:</span>
                                        <span className="font-semibold text-right" style={{ color: '#0F172A' }}>{detail.customer.name}</span>
                                    </div>
                                    {detail.orderType === 'TASTING' && (
                                        <div className="flex justify-between py-1.5 px-2.5 rounded-lg border border-amber-500/50 bg-amber-950/40 text-xs">
                                            <span className="font-bold text-amber-400">Loại Đơn Hàng:</span>
                                            <span className="font-extrabold text-amber-300">🍷 Đơn Hàng Tasting</span>
                                        </div>
                                    )}
                                    {detail.proposal && (
                                        <div className="flex justify-between py-1.5 px-2.5 rounded-lg border border-amber-500/30 bg-amber-950/20 text-xs mt-1">
                                            <span className="font-bold text-amber-400">Số Tờ Trình:</span>
                                            <span className="font-extrabold text-amber-300 font-mono">[{detail.proposal.proposalNo}] {detail.proposal.title}</span>
                                        </div>
                                    )}
                                    {detail.customer.parent && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/20">
                                            <span style={{ color: '#64748B' }}>Khách hàng cha:</span>
                                            <span className="font-semibold text-right" style={{ color: '#0F172A' }}>{detail.customer.parent.name}</span>
                                        </div>
                                    )}
                                    {(detail.customer.taxId || (detail.customer as any).parent?.taxId) && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/20">
                                            <span style={{ color: '#64748B' }}>MST:</span>
                                            <span className="font-semibold font-mono" style={{ color: '#475569' }}>
                                                {detail.customer.taxId ? (
                                                    detail.customer.taxId
                                                ) : (
                                                    <span>{(detail.customer as any).parent.taxId} <span className="text-[10px] text-amber-400 font-sans font-normal">(Cty Cha)</span></span>
                                                )}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between py-1 border-b border-slate-200/20">
                                        <span style={{ color: '#64748B' }}>Mã KH / Kênh:</span>
                                        <span className="font-semibold" style={{ color: '#475569' }}>{detail.customer.code} ({CHANNEL_LABEL[detail.channel] ?? detail.channel})</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/20">
                                        <span style={{ color: '#64748B' }}>Nhân viên Sales:</span>
                                        <span className="font-semibold" style={{ color: '#0F172A' }}>{detail.salesRep.name}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/20">
                                        <span style={{ color: '#64748B' }}>SĐT nhận hàng:</span>
                                        <span className="font-semibold font-mono" style={{ color: '#0891B2' }}>
                                            {(detail.customer as any).receiverPhone || (detail.customer as any).purchasingPhone || (detail.customer as any).contacts?.find((c: any) => c.isPrimary)?.phone || '—'}
                                            {(detail.customer as any).receiverName && (detail.customer as any).receiverName !== detail.customer.name && (
                                                <span className="text-[10px] ml-1 text-slate-600">({(detail.customer as any).receiverName})</span>
                                            )}
                                        </span>
                                    </div>
                                    {detail.shippingAddress && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/20">
                                            <span style={{ color: '#64748B' }} className="shrink-0">Địa chỉ giao:</span>
                                            <span className="font-medium text-right text-slate-900 text-[11px] ml-2">
                                                {[detail.shippingAddress.address, detail.shippingAddress.ward, detail.shippingAddress.district, detail.shippingAddress.city].filter(Boolean).join(', ')}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between py-1 border-b border-slate-200/20">
                                        <span style={{ color: '#64748B' }}>Kỳ hạn thanh toán:</span>
                                        <span className="font-semibold" style={{ color: '#D4A853' }}>{detail.paymentTerm}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/20">
                                        <span style={{ color: '#64748B' }}>Ngày tạo đơn:</span>
                                        <span className="font-semibold" style={{ color: '#475569' }}>{formatDate(detail.createdAt)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Financial summary */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>Chỉ số tài chính</h4>
                                {canSeeMargin && !marginData ? (
                                    <div className="py-6 rounded-lg flex flex-col items-center justify-center gap-2 border border-slate-200/30 bg-white/40">
                                        <Loader2 size={16} className="animate-spin text-[#0891B2]" />
                                        <span className="text-[11px]" style={{ color: '#64748B' }}>Đang tính toán tỷ suất lợi nhuận...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/20">
                                            <span style={{ color: '#64748B' }}>Tổng tiền trước thuế (Sau CK):</span>
                                            <span className="font-bold font-mono text-sm" style={{ color: '#0F172A' }}>{formatVND(Number(detail.totalAmount))}</span>
                                        </div>
                                        {detailVatBreakdown.length > 1 ? (
                                            <>
                                                {detailVatBreakdown.map((vb: { rate: number; amount: number }) => (
                                                    <div key={vb.rate} className="flex justify-between py-0.5 pl-2 text-[11px]" style={{ color: '#475569' }}>
                                                        <span>↳ Thuế GTGT ({vb.rate}%):</span>
                                                        <span className="font-mono">{formatVND(vb.amount)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between py-1 border-b border-slate-200/20">
                                                    <span style={{ color: '#64748B' }}>Tổng tiền thuế VAT:</span>
                                                    <span className="font-bold font-mono" style={{ color: '#475569' }}>{formatVND(Number(detail.vatAmount ?? 0))}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex justify-between py-1 border-b border-slate-200/20">
                                                <span style={{ color: '#64748B' }}>Tiền thuế VAT ({detailVatBreakdown[0]?.rate ?? (detail as any).vatRate ?? 10}%):</span>
                                                <span className="font-bold font-mono" style={{ color: '#475569' }}>{formatVND(Number(detail.vatAmount ?? 0))}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between py-1 border-b border-slate-200/20">
                                            <span style={{ color: '#64748B' }}>Tổng thanh toán (Có VAT):</span>
                                            <span className="font-bold font-mono text-sm text-[#0891B2]">{formatVND(Number(detail.totalAmount) + Number(detail.vatAmount ?? 0))}</span>
                                        </div>
                                        {detail.isInvoiceExempt && (
                                            <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 mt-2 flex items-start gap-2">
                                                <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-400" />
                                                <div className="leading-snug">
                                                    <span className="font-bold block text-amber-400 mb-0.5">Đơn hàng không xuất HĐ VAT</span>
                                                    Giá bán và tổng thanh toán vẫn giữ nguyên và tính đủ 100% thuế VAT theo đúng yêu cầu.
                                                </div>
                                            </div>
                                        )}
                                        {marginData && canSeeMargin ? (
                                            <>
                                                <div className="flex justify-between py-1 border-b border-slate-200/20">
                                                    <span style={{ color: '#64748B' }}>Doanh thu Net (trước VAT):</span>
                                                    <span className="font-bold font-mono" style={{ color: '#0891B2' }}>{formatVND(marginData.totalRevenue)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-200/20">
                                                    <span style={{ color: '#64748B' }}>Tổng giá vốn (COGS):</span>
                                                    <span className="font-bold font-mono" style={{ color: '#D4A853' }}>{formatVND(marginData.totalCOGS)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-200/20">
                                                    <span style={{ color: '#64748B' }}>Lợi nhuận gộp:</span>
                                                    <span className={`font-bold font-mono ${marginData.totalMargin >= 0 ? 'text-[#5BA88A]' : 'text-[#EF4444]'}`}>
                                                        {marginData.totalMargin >= 0 ? '' : '-'}{formatVND(Math.abs(marginData.totalMargin))}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-200/20">
                                                    <span style={{ color: '#64748B' }}>Biên lợi nhuận gộp:</span>
                                                    <span className="font-semibold flex items-center gap-1" style={{ color: marginData.totalMarginPct >= 20 ? '#5BA88A' : marginData.totalMarginPct >= 0 ? '#D4A853' : '#EF4444' }}>
                                                        {marginData.totalMarginPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                                        {marginData.totalMarginPct.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </>
                                        ) : !canSeeMargin ? (
                                            <div className="py-3 px-3 rounded text-[11px] leading-relaxed bg-white/40 border border-slate-200/30" style={{ color: '#64748B' }}>
                                                🔒 Chi tiết biên lợi nhuận bị ẩn đối với tài khoản Nhân viên Sales / Trợ lý Sales.
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Diễn giải / Ghi chú đơn hàng */}
                        {detail.notes && (
                            <div className="p-3 rounded-md bg-white border border-slate-200/40 text-xs">
                                <span className="font-bold text-[10px] uppercase tracking-wider block mb-1" style={{ color: '#64748B' }}>
                                    📝 Ghi Chú / Diễn Giải Đơn Hàng
                                </span>
                                <p className="text-slate-900 leading-relaxed whitespace-pre-wrap">{detail.notes}</p>
                            </div>
                        )}

                        {/* 3. PRODUCTS LIST */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: '#64748B' }}>Sản Phẩm Trong Đơn Hàng ({detail.lines.length} dòng)</p>
                            
                            {/* Desktop Table View */}
                            <div className="hidden md:block rounded-md overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: 640 }}>
                                        <thead><tr style={{ background: '#FFFFFF' }}>
                                            {(canSeeMargin ? ['SKU / Tên Sản Phẩm', 'SL', 'Giá Bán', 'Nguồn Giá', 'Thành Tiền', 'Giá Vốn', 'Lãi Gộp', 'Biên %'] : ['SKU / Tên Sản Phẩm', 'SL', 'Giá Bán', 'Nguồn Giá', 'Thành Tiền']).map(h => (
                                                <th key={h} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap" style={{ color: '#64748B' }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {(marginData?.lines ?? detail.lines.map(l => ({
                                                lineId: l.id, skuCode: l.product.skuCode, productName: l.product.productName,
                                                qty: Number(l.qtyOrdered), unitPrice: Number(l.unitPrice), lineDiscountPct: Number(l.lineDiscountPct),
                                                revenue: Number(l.qtyOrdered) * Number(l.unitPrice) * (1 - Number(l.lineDiscountPct) / 100),
                                                avgCost: 0, cogs: 0, margin: 0, marginPct: 0, isNegative: false, productId: l.productId,
                                                priceSource: (l as any).priceSource ?? null,
                                                customerItemCode: (l as any).customerItemCode ?? null,
                                            }))).map(ml => {
                                                const custCode = (ml as any).customerItemCode || detail.lines.find(l => l.id === ml.lineId)?.customerItemCode
                                                return (
                                                <tr key={ml.lineId} style={{ borderTop: '1px solid #E2E8F0', background: ml.isNegative ? 'rgba(220,38,38,0.06)' : 'transparent' }}>
                                                    <td className="px-2.5 py-2">
                                                        <div className="font-semibold text-[#0891B2] font-mono flex items-center gap-1.5">
                                                            {custCode && (
                                                                <span className="text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40 text-[10px] font-bold">
                                                                    [{custCode}]
                                                                </span>
                                                            )}
                                                            {ml.skuCode}
                                                        </div>
                                                        <div className="text-[10px] text-slate-600 mt-0.5 max-w-[200px] truncate" title={ml.productName}>{ml.productName}</div>
                                                    </td>
                                                    <td className="px-2.5 py-2 text-right" style={{ color: '#0F172A' }}>{ml.qty}</td>
                                                    <td className="px-2.5 py-2 text-right" style={{ color: '#475569' }}>{formatVND(ml.unitPrice)}</td>
                                                    <td className="px-2.5 py-2">
                                                        {ml.priceSource ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                                                style={getPriceBadgeStyle(ml.priceSource)}>
                                                                {getPriceBadgeLabel(ml.priceSource)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px]" style={{ color: '#64748B' }}>Mặc định</span>
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-2 text-right font-bold" style={{ color: '#0891B2' }}>{formatVND(ml.revenue)}</td>
                                                    {canSeeMargin && (
                                                        <td className="px-2.5 py-2 text-right" style={{ color: '#D4A853' }}>
                                                            {ml.avgCost > 0 ? formatVND(ml.avgCost) : <span style={{ color: '#E2E8F0' }}>—</span>}
                                                        </td>
                                                    )}
                                                    {canSeeMargin && (
                                                        <td className="px-2.5 py-2 text-right font-bold" style={{ color: ml.margin > 0 ? '#5BA88A' : ml.margin < 0 ? '#EF4444' : '#64748B' }}>
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
                                                            ) : <span style={{ color: '#E2E8F0' }}>—</span>}
                                                        </td>
                                                    )}
                                                </tr>
                                                )
                                            })}
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
                                    customerItemCode: (l as any).customerItemCode ?? null,
                                }))).map(ml => {
                                    const custCode = (ml as any).customerItemCode || detail.lines.find(l => l.id === ml.lineId)?.customerItemCode
                                    return (
                                    <div key={ml.lineId} className="p-3 rounded-md space-y-1.5" 
                                        style={{ background: '#FFFFFF', border: `1px solid ${ml.isNegative ? 'rgba(220,38,38,0.35)' : '#E2E8F0'}` }}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-[#0891B2] font-mono flex items-center gap-1.5">
                                                    {custCode && (
                                                        <span className="text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40 text-[10px] font-bold">
                                                            [{custCode}]
                                                        </span>
                                                    )}
                                                    {ml.skuCode}
                                                </p>
                                                <p className="text-[11px] text-slate-900 truncate mt-0.5" title={ml.productName}>{ml.productName}</p>
                                            </div>
                                            {ml.priceSource && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold"
                                                    style={getPriceBadgeStyle(ml.priceSource)}>
                                                    {getPriceBadgeLabel(ml.priceSource)}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/30 text-xs">
                                            <div>
                                                <p className="text-[10px]" style={{ color: '#64748B' }}>Số Lượng</p>
                                                <p className="font-bold font-mono text-slate-900 mt-0.5">{ml.qty}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px]" style={{ color: '#64748B' }}>Đơn Giá</p>
                                                <p className="font-semibold font-mono text-slate-900 mt-0.5">{formatVND(ml.unitPrice)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px]" style={{ color: '#64748B' }}>Thành Tiền</p>
                                                <p className="font-bold font-mono text-[#0891B2] mt-0.5">{formatVND(ml.revenue)}</p>
                                            </div>
                                        </div>

                                        {canSeeMargin && ml.avgCost > 0 && (
                                            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/20 text-xs">
                                                <div>
                                                    <p className="text-[10px]" style={{ color: '#64748B' }}>Giá Vốn</p>
                                                    <p className="font-semibold font-mono text-[#D4A853] mt-0.5">{formatVND(ml.avgCost)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px]" style={{ color: '#64748B' }}>Lãi Gộp</p>
                                                    <p className="font-bold font-mono mt-0.5" style={{ color: ml.margin >= 0 ? '#5BA88A' : '#EF4444' }}>
                                                        {ml.margin >= 0 ? '' : '-'}{formatVND(Math.abs(ml.margin))}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px]" style={{ color: '#64748B' }}>Biên %</p>
                                                    <p className="font-bold font-mono mt-0.5" style={{ color: ml.marginPct >= 20 ? '#5BA88A' : ml.marginPct >= 0 ? '#D4A853' : '#EF4444' }}>
                                                        {ml.marginPct.toFixed(1)}%
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* 4. DELIVERY ORDERS & AR INVOICES */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>Lệnh Giao Hàng (DO)</p>
                                {detail.deliveryOrders.length === 0 ? (
                                    <p className="text-xs py-4 text-center" style={{ color: '#64748B' }}>Chưa có lệnh giao hàng</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {detail.deliveryOrders.map(do_ => (
                                            <div key={do_.id} className="flex items-center justify-between py-2 px-3 rounded" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                <span className="text-xs font-bold font-mono" style={{ color: '#0891B2' }}>{do_.doNo}</span>
                                                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2' }}>{do_.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Hóa Đơn Công Nợ (AR)</p>
                                        {detail.arInvoices.length > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-[#E2E8F0]/60 text-[#0891B2]">
                                                {detail.arInvoices.length}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {detail.isInvoiceExempt && canToggleInvoiceExempt && (
                                            <button
                                                onClick={handleToggleExempt}
                                                disabled={togglingExempt}
                                                className="text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 shadow-xs cursor-pointer"
                                                title="Chỉ Kế toán & Admin: Hủy miễn HĐ để cho phép xuất hóa đơn VAT"
                                            >
                                                {togglingExempt ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                                Hủy miễn HĐ
                                            </button>
                                        )}
                                        {!detail.isInvoiceExempt && detail.arInvoices.length > 0 && canCreateInvoice && (
                                            <button
                                                onClick={handleCreateInvoice}
                                                disabled={creatingInvoice}
                                                className="text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all border border-[#87CBB9]/40 text-[#0891B2] hover:bg-[#87CBB9]/10 shadow-xs cursor-pointer disabled:opacity-50"
                                                title="Gắn thêm mã hóa đơn VAT cho đơn hàng này"
                                            >
                                                {creatingInvoice ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                                                + Thêm HĐ
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {detail.isInvoiceExempt ? (
                                    <div className="p-3.5 rounded-md bg-amber-500/10 border border-amber-500/30">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                                <FileX2 size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-amber-400">Đơn Hàng Không Xuất Hóa Đơn VAT</span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                        Đã duyệt miễn HĐ
                                                    </span>
                                                </div>
                                                <p className="text-xs mt-1 text-slate-900">
                                                    <span className="text-slate-600">Lý do: </span>
                                                    {detail.invoiceExemptReason || 'Khách không lấy hóa đơn VAT'}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
                                                    {detail.invoiceExemptBy && (
                                                        <span>Người duyệt: <strong className="text-slate-600">{detail.invoiceExemptBy}</strong></span>
                                                    )}
                                                    {detail.invoiceExemptAt && (
                                                        <span>Thời gian: <strong className="text-slate-600">{formatDateTime(detail.invoiceExemptAt)}</strong></span>
                                                    )}
                                                </div>
                                                {detail.status === 'DELIVERED' && canToggleInvoiceExempt && (
                                                    <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-between">
                                                        <span className="text-[11px] text-amber-300/90">Đơn hàng đã giao thành công. Kế toán/Admin có thể xác nhận thu tiền.</span>
                                                        <button
                                                            onClick={handleMarkPaid}
                                                            disabled={markingPaid}
                                                            className="text-xs px-3 py-1.5 rounded font-bold flex items-center gap-1.5 bg-[#5BA88A] hover:bg-[#4d9377] text-white shadow-sm transition-all cursor-pointer"
                                                        >
                                                            {markingPaid ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={12} />}
                                                            Xác Nhận Thu Tiền (PAID)
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : detail.arInvoices.length === 0 ? (
                                    <div className="py-5 px-4 rounded-lg text-center" style={{ background: 'rgba(27,46,61,0.4)', border: '1px dashed #E2E8F0' }}>
                                        <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-2">
                                            <ReceiptText size={18} />
                                        </div>
                                        <h5 className="text-xs font-bold text-slate-900 mb-0.5">Chưa xuất hóa đơn cho đơn hàng này</h5>
                                        <p className="text-[11px] text-slate-600 max-w-sm mx-auto mb-3.5">
                                            Bạn có thể phát hành hóa đơn điện tử tự động qua VNPT hoặc gắn số hóa đơn thủ công.
                                        </p>
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            {canCreateInvoice && (
                                                <button
                                                    onClick={triggerUploadVnptDraft}
                                                    disabled={uploadingVnpt}
                                                    className="text-xs px-3.5 py-1.5 rounded-md font-bold inline-flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer text-white bg-[#2563EB] hover:bg-[#1D4ED8]"
                                                    title="Đẩy dữ liệu hóa đơn nháp lên cổng VNPT e-Invoice (TT78/NĐ70)"
                                                >
                                                    {uploadingVnpt ? <Loader2 size={13} className="animate-spin" /> : <CloudUpload size={13} />}
                                                    Đẩy Nháp Lên VNPT
                                                </button>
                                            )}
                                            {canCreateInvoice && (
                                                <button
                                                    onClick={handleCreateInvoice}
                                                    disabled={creatingInvoice}
                                                    className="text-xs px-3 py-1.5 rounded-md font-semibold inline-flex items-center gap-1.5 transition-all border border-[#87CBB9]/40 text-[#0891B2] bg-[#87CBB9]/10 hover:bg-[#87CBB9]/20 shadow-xs cursor-pointer disabled:opacity-50"
                                                    title="Gắn số hóa đơn VAT xuất từ hệ thống khác (MISA, Viettel, v.v.)"
                                                >
                                                    {creatingInvoice ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                                                    Gắn HĐ Thủ Công
                                                </button>
                                            )}
                                            {canToggleInvoiceExempt && (
                                                <button
                                                    onClick={handleToggleExempt}
                                                    disabled={togglingExempt}
                                                    className="text-xs px-2.5 py-1.5 rounded-md font-medium inline-flex items-center gap-1 transition-all text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-500/10 cursor-pointer disabled:opacity-50"
                                                    title="Chỉ Kế toán & Admin: Đánh dấu đơn hàng này không cần xuất hóa đơn VAT"
                                                >
                                                    {togglingExempt ? <Loader2 size={12} className="animate-spin" /> : <FileX2 size={12} />}
                                                    Không xuất HĐ
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {detail.arInvoices.map(inv => {
                                            const isDraftVnpt = inv.invoiceNo.startsWith('NHAP-')
                                            let vnptMeta: any = null
                                            try {
                                                const parsed = JSON.parse((inv as any).notes || '{}')
                                                vnptMeta = parsed.vnpt || null
                                            } catch {}
                                            const isVnptPublished = Boolean(vnptMeta && (vnptMeta.status === 'PUBLISHED' || vnptMeta.pdfUrl || vnptMeta.taxAuthorityCode))

                                            return (
                                                <div
                                                    key={inv.id}
                                                    className="p-3 rounded-md transition-all"
                                                    style={{
                                                        background: isDraftVnpt ? 'rgba(37,99,235,0.08)' : isVnptPublished ? 'rgba(16,185,129,0.06)' : '#FFFFFF',
                                                        border: isDraftVnpt ? '1px solid rgba(59,130,246,0.4)' : isVnptPublished ? '1px solid rgba(16,185,129,0.35)' : '1px solid #E2E8F0',
                                                    }}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`text-xs font-bold font-mono truncate ${isDraftVnpt ? 'text-blue-400' : isVnptPublished ? 'text-emerald-300' : 'text-[#0891B2]'}`}>
                                                                    {inv.invoiceNo}
                                                                </span>
                                                                {isDraftVnpt ? (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                                                        <CloudUpload size={10} />
                                                                        Nháp VNPT
                                                                    </span>
                                                                ) : isVnptPublished ? (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                                                        <ShieldCheck size={10} />
                                                                        VNPT Đã Ký Số
                                                                    </span>
                                                                ) : (
                                                                    canCreateInvoice && (
                                                                        <button
                                                                            onClick={() => handleEditInvoice(inv.id, inv.invoiceNo)}
                                                                            disabled={editingInvoiceId === inv.id || deletingInvoiceId === inv.id}
                                                                            className="p-1 rounded text-slate-600 hover:text-[#0891B2] hover:bg-[#E2E8F0]/40 transition-colors"
                                                                            title="Chỉnh sửa mã số hóa đơn"
                                                                        >
                                                                            {editingInvoiceId === inv.id ? <Loader2 size={11} className="animate-spin" /> : <Pencil size={11} />}
                                                                        </button>
                                                                    )
                                                                )}
                                                                {canCreateInvoice && inv.status !== 'PAID' && (
                                                                    <button
                                                                        onClick={() => isDraftVnpt ? handleDeleteVnptDraft() : handleDeleteInvoice(inv.id, inv.invoiceNo)}
                                                                        disabled={editingInvoiceId === inv.id || deletingInvoiceId === inv.id || deletingVnpt}
                                                                        className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                                        title={isDraftVnpt ? "Xóa bản nháp trên cổng VNPT" : "Gỡ bỏ hóa đơn"}
                                                                    >
                                                                        {(deletingInvoiceId === inv.id || (isDraftVnpt && deletingVnpt)) ? (
                                                                            <Loader2 size={11} className="animate-spin text-red-400" />
                                                                        ) : (
                                                                            <X size={11} />
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] mt-1 text-slate-600">
                                                                {isDraftVnpt
                                                                    ? 'Đã tải lên VNPT e-Invoice. Sau khi ký số trên Portal VNPT, bấm "Kéo Số HĐ" bên dưới.'
                                                                    : isVnptPublished && vnptMeta?.taxAuthorityCode
                                                                    ? `Mã CQT: ${vnptMeta.taxAuthorityCode}`
                                                                    : `Hạn thanh toán: ${formatDate(inv.dueDate)}`}
                                                            </p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <span className="text-xs font-bold font-mono block" style={{ color: '#0F172A' }}>
                                                                {formatVND(Number(inv.amount))}
                                                            </span>
                                                            <span
                                                                className="text-[10px] px-2 py-0.5 rounded-full font-bold inline-block mt-0.5"
                                                                style={isDraftVnpt ? { background: 'rgba(59,130,246,0.15)', color: '#60A5FA' } : isVnptPublished ? { background: 'rgba(16,185,129,0.2)', color: '#34D399' } : getInvoiceStatusStyle(inv.status)}
                                                            >
                                                                {isDraftVnpt ? 'CHỜ KÝ SỐ' : isVnptPublished ? 'ĐÃ PHÁT HÀNH' : (INVOICE_STATUS_LABELS[inv.status] ?? inv.status)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {isDraftVnpt && (
                                                        <div className="mt-2.5 pt-2 border-t border-blue-500/20 flex flex-wrap items-center justify-between gap-2">
                                                            <span className="text-[10px] text-blue-300/80">
                                                                FKey: <code className="font-mono text-blue-200">SO_{detail.soNo.replace(/[^A-Za-z0-9_-]/g, '_')}</code>
                                                            </span>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {canCreateInvoice && (
                                                                    <button
                                                                        onClick={handleSyncVnptInvoice}
                                                                        disabled={syncingVnpt}
                                                                        className="text-[11px] px-2.5 py-1 rounded font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                                        title="Kiểm tra trạng thái ký số trên VNPT và kéo số hóa đơn chính thức về ERP"
                                                                    >
                                                                        {syncingVnpt ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                                                                        Kéo Số HĐ Từ VNPT
                                                                    </button>
                                                                )}
                                                                {canCreateInvoice && (
                                                                    <button
                                                                        onClick={triggerUploadVnptDraft}
                                                                        disabled={uploadingVnpt}
                                                                        className="text-[10px] px-2 py-1 rounded font-semibold text-blue-300 hover:bg-blue-500/20 transition-all flex items-center gap-1 cursor-pointer"
                                                                        title="Cập nhật lại thông tin mới nhất lên bản nháp VNPT"
                                                                    >
                                                                        {uploadingVnpt ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                                                                        Đồng Bộ Lại
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {isVnptPublished && vnptMeta && (
                                                        <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2 text-[10px] text-slate-600">
                                                                <span>Ký hiệu: <code className="font-mono text-emerald-200">{vnptMeta.pattern} / {vnptMeta.serial}</code></span>
                                                                {vnptMeta.syncedAt && <span>• {formatDateTime(vnptMeta.syncedAt)}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {vnptMeta.pdfUrl && (
                                                                    <a
                                                                        href={vnptMeta.pdfUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="text-[10px] px-2 py-1 rounded font-bold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/30 transition-all flex items-center gap-1 cursor-pointer"
                                                                        title="Tải / Xem file PDF hóa đơn điện tử có chữ ký số từ VNPT"
                                                                    >
                                                                        <Download size={10} />
                                                                        Tải PDF
                                                                    </a>
                                                                )}
                                                                {vnptMeta.viewUrl && (
                                                                    <a
                                                                        href={vnptMeta.viewUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="text-[10px] px-2 py-1 rounded font-semibold text-blue-300 hover:bg-blue-500/20 border border-blue-500/30 transition-all flex items-center gap-1 cursor-pointer"
                                                                        title="Xem hóa đơn trực tuyến trên portal VNPT"
                                                                    >
                                                                        <ExternalLink size={10} />
                                                                        Portal
                                                                    </a>
                                                                )}
                                                                {canCreateInvoice && (
                                                                    <button
                                                                        onClick={handleSyncVnptInvoice}
                                                                        disabled={syncingVnpt}
                                                                        className="text-[10px] px-1.5 py-1 rounded text-slate-600 hover:text-white hover:bg-[#E2E8F0]/40 transition-all flex items-center gap-1 cursor-pointer"
                                                                        title="Kiểm tra lại trạng thái CQT từ VNPT"
                                                                    >
                                                                        {syncingVnpt ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. HISTORY & AUDIT LOGS */}
                        <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>Nhật Ký Hoạt Động</p>
                            {timelineLoading ? (
                                <div className="flex items-center justify-center py-6 gap-2 text-xs" style={{ color: '#64748B' }}>
                                    <Loader2 size={14} className="animate-spin text-[#0891B2]" />
                                    <span>Đang tải nhật ký hoạt động...</span>
                                </div>
                            ) : timeline.length === 0 ? (
                                <p className="text-xs py-4 text-center" style={{ color: '#64748B' }}>Chưa ghi nhận hoạt động nào</p>
                            ) : (
                                <div className="space-y-0 relative pl-1">
                                    <div className="absolute left-3 top-2 bottom-2 w-[1px]" style={{ background: '#E2E8F0' }} />
                                    {timeline.map((ev, i) => (
                                        <div key={ev.id} className="flex gap-3 py-2 relative">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 z-10"
                                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                {ACTION_ICON[ev.action] ?? '●'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold" style={{ color: '#0891B2' }}>{ev.action}</span>
                                                    {ev.userName && <span className="text-[10px]" style={{ color: '#64748B' }}>— {ev.userName}</span>}
                                                    <span className="text-xs ml-auto" style={{ color: '#64748B' }}>{formatDate(ev.createdAt)}</span>
                                                </div>
                                                {ev.description && <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{ev.description}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>

            {/* Modal Cảnh Báo Lệch Ngày Xuất Hóa Đơn (Nghị định 123 / Nghị định 70) */}
            {dateWarningModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div 
                        className="relative w-full max-w-lg rounded-xl overflow-hidden shadow-2xl border bg-white dark:bg-slate-50 border-slate-200 dark:border-slate-200"
                    >
                        {/* Header */}
                        <div 
                            className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${
                                dateWarningModal.level === 'DANGER'
                                    ? 'bg-rose-50/80 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/40'
                                    : 'bg-amber-50/80 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                {dateWarningModal.level === 'DANGER' ? (
                                    <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-300 dark:border-rose-500/40 shadow-2xs">
                                        <AlertTriangle size={20} />
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-300 dark:border-amber-500/40 shadow-2xs">
                                        <AlertCircle size={20} />
                                    </div>
                                )}
                                <div>
                                    <h3 className={`text-sm font-bold tracking-tight ${
                                        dateWarningModal.level === 'DANGER'
                                            ? 'text-rose-900 dark:text-rose-400'
                                            : 'text-amber-900 dark:text-amber-300'
                                    }`}>
                                        {dateWarningModal.level === 'DANGER' 
                                            ? 'CẢNH BÁO LỆCH KỲ THUẾ (KHÁC THÁNG)' 
                                            : 'LƯU Ý THỜI ĐIỂM LẬP HÓA ĐƠN'}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-600 mt-0.5">
                                        Đơn hàng: <span className="font-mono font-bold text-slate-800 dark:text-white">{detail?.soNo}</span>
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setDateWarningModal(null)}
                                className="text-slate-400 hover:text-slate-700 dark:text-slate-600 dark:hover:text-white p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4 text-xs text-slate-700 dark:text-slate-900">
                            {/* Legal Entity & Date Comparison */}
                            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-200/60 space-y-3">
                                <div className="flex justify-between items-center pb-2.5 border-b border-slate-200 dark:border-slate-200/30">
                                    <span className="text-slate-500 dark:text-slate-600 font-medium">Pháp nhân phát hành:</span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                        {detail?.legalEntity?.name || (detail?.legalEntity?.code === 'TA' ? 'Công ty Cổ phần Thắng Ân (TA)' : detail?.legalEntity?.code === 'LC' ? "Công ty TNHH Phân phối Ly's Cellar (LC)" : 'Thắng Ân (TA)')}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-0.5">
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200/40 text-center shadow-2xs">
                                        <span className="text-[10px] text-slate-500 dark:text-slate-600 block uppercase tracking-wider font-semibold mb-1">Ngày lập đơn ERP</span>
                                        <span className="font-mono font-bold text-sm text-teal-700 dark:text-[#0891B2]">{dateWarningModal.orderDateFormatted}</span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200/40 text-center shadow-2xs">
                                        <span className="text-[10px] text-slate-500 dark:text-slate-600 block uppercase tracking-wider font-semibold mb-1">Ngày xuất HĐ VNPT</span>
                                        <span className="font-mono font-bold text-sm text-amber-700 dark:text-amber-400">
                                            {dateWarningModal.invoiceDateFormatted} <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">(Hôm nay)</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="text-center pt-1 text-[11px] text-slate-500 dark:text-slate-600 flex items-center justify-center gap-1.5">
                                    <span>Khoảng cách thời gian:</span>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs ${
                                        dateWarningModal.level === 'DANGER'
                                            ? 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40'
                                            : 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                                    }`}>
                                        {dateWarningModal.diffDays} ngày
                                    </span>
                                </div>
                            </div>

                            {/* Message / Policy explanation */}
                            <div className={`p-3.5 rounded-lg border text-xs leading-relaxed ${
                                dateWarningModal.level === 'DANGER' 
                                    ? 'bg-rose-50 border-rose-200 text-rose-950 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-200' 
                                    : 'bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200'
                            }`}>
                                <p className={`font-bold mb-1.5 text-xs flex items-center gap-1.5 ${
                                    dateWarningModal.level === 'DANGER' ? 'text-rose-900 dark:text-rose-300' : 'text-amber-900 dark:text-amber-300'
                                }`}>
                                    {dateWarningModal.level === 'DANGER' ? '⚠️ Căn cứ Nghị định 123/2020/NĐ-CP & Nghị định 70/2025/NĐ-CP:' : 'ℹ️ Quy định pháp luật về thời điểm xuất hóa đơn:'}
                                </p>
                                <p className="text-xs leading-normal">
                                    {dateWarningModal.message}
                                </p>
                                {dateWarningModal.level === 'DANGER' && (
                                    <p className="mt-2.5 pt-2 border-t border-rose-200 dark:border-rose-800/40 text-[11px] text-rose-800 dark:text-rose-300/90 italic leading-normal">
                                        * Lưu ý: Việc xuất hóa đơn khác kỳ kê khai thuế GTGT so với thời điểm phát sinh có thể dẫn đến rủi ro bị cơ quan thuế xử phạt về hóa đơn theo Điều 24 Nghị định 125/2020/NĐ-CP. Kế toán cần đối chiếu kỹ trước khi bấm xác nhận.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="px-5 py-3.5 bg-slate-50 dark:bg-white border-t border-slate-200 dark:border-slate-200 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setDateWarningModal(null)}
                                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 dark:text-slate-600 dark:hover:text-white dark:bg-transparent dark:border-slate-200 dark:hover:bg-white/5 transition-all cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                type="button"
                                onClick={executeUploadVnptDraft}
                                disabled={uploadingVnpt}
                                className={`px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.98] ${
                                    dateWarningModal.level === 'DANGER'
                                        ? 'bg-rose-600 hover:bg-rose-500'
                                        : 'bg-amber-600 hover:bg-amber-500'
                                }`}
                            >
                                {uploadingVnpt ? <Loader2 size={13} className="animate-spin" /> : <CloudUpload size={13} />}
                                Tôi Đã Rà Soát & Tiếp Tục Đẩy Nháp
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
    onClone,
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
    onClone: () => void
    canApprove: boolean
    canAcctApprove: boolean
    actionLoading: string | null
}) {
    const isActLoading = actionLoading === row.id

    return (
        <div className="p-3.5 flex flex-col gap-2.5 rounded-lg border transition-all duration-150 relative bg-slate-50"
            style={{ borderColor: '#E2E8F0' }}
            onClick={onViewDetail}>
            
            {/* Header: SO code & Date */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold font-mono" style={{ color: '#0891B2' }}>
                        {row.soNo}
                    </span>
                    {row.orderType === 'TASTING' && (
                        <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-amber-950/80 text-amber-300 border border-amber-500/40">
                            🍷 Tasting
                        </span>
                    )}
                </div>
                <span className="text-[10px]" style={{ color: '#64748B' }}>
                    {formatDateTime(row.createdAt)}
                </span>
            </div>

            {/* Customer information */}
            <div>
                <p className="text-sm font-semibold leading-snug" style={{ color: '#0F172A' }}>
                    {row.customerName}
                </p>
                <p className="text-[10px] mt-0.5 font-mono" style={{ color: '#64748B' }}>
                    {row.customerCode}
                </p>
            </div>

            {/* Channel, Legal Entity, Sales Rep */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Channel Badge */}
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(135,203,185,0.08)', color: '#475569' }}>
                    {CHANNEL_LABEL[row.channel] ?? row.channel}
                </span>

                {/* Legal Entity Badge */}
                {row.legalEntityCode && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ 
                            background: row.legalEntityCode === 'TA' ? 'rgba(212,168,83,0.12)' : 'rgba(8, 145, 178, 0.08)', 
                            color: row.legalEntityCode === 'TA' ? '#D4A853' : '#87CBB9' 
                        }}>
                        {row.legalEntityCode}
                    </span>
                )}

                {/* Invoice Number Badge */}
                {row.invoiceNo ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold"
                        style={{ background: 'rgba(135,203,185,0.1)', color: '#0891B2', border: '1px solid rgba(135,203,185,0.25)' }}
                        title={`Số hóa đơn: ${row.invoiceNo}`}>
                        HĐ: {row.invoiceNo}
                    </span>
                ) : row.isInvoiceExempt ? (
                    <span className="text-[9px] px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1"
                        style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}
                        title={row.invoiceExemptReason || 'Đơn hàng không xuất HĐ VAT'}>
                        🚫 Không HĐ
                    </span>
                ) : null}

                {/* Sales Rep Name */}
                <span className="text-[10px] ml-auto" style={{ color: '#475569' }}>
                    Rep: <span className="font-medium">{row.salesRepName}</span>
                </span>
            </div>

            {/* Financial summary & Status */}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/30">
                {/* Total amount & discount */}
                <div>
                    <span className="text-sm font-bold font-mono" style={{ color: '#0F172A' }}>
                        {formatVND(row.totalAmount)}
                    </span>
                    {row.orderDiscount > 0 && (
                        <span className="text-[10px] ml-1.5 font-semibold" style={{ color: '#5BA88A' }}>
                            (CK {row.orderDiscount}%)
                        </span>
                    )}
                </div>

                {/* StatusBadge component & DeliveryStatusBadge */}
                <div className="flex items-center gap-1.5 scale-90 origin-right flex-wrap justify-end">
                    <StatusBadge status={row.status} approvalStep={row.approvalStep} />
                    <DeliveryStatusBadge status={row.deliveryStatus} shipped={row.totalQtyShipped} ordered={row.totalQtyOrdered} />
                </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-1.5 flex-wrap pt-2 border-t border-slate-200/30"
                onClick={e => e.stopPropagation() /* Prevent card click onViewDetail */}>
                
                {/* Eye Detail button (always shown) */}
                <button onClick={onViewDetail}
                    className="p-1.5 rounded transition-all flex items-center justify-center border"
                    style={{ background: 'rgba(135,203,185,0.06)', color: '#0891B2', borderColor: 'rgba(8, 145, 178, 0.15)' }}
                    title="Chi tiết">
                    <Eye size={12} />
                </button>

                {/* Clone button */}
                <button onClick={onClone} disabled={actionLoading === row.id}
                    className="p-1.5 rounded transition-all flex items-center justify-center border"
                    style={{ background: 'rgba(138,174,187,0.12)', color: '#475569', borderColor: 'rgba(138,174,187,0.25)' }}
                    title="Nhân bản đơn hàng">
                    <Copy size={12} />
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
const MARGIN_ROLES = ['CEO', 'KE_TOAN', 'Kế Toán', 'SALES_MGR', 'Sales Manager', 'Trợ Lý', 'TRO_LY']

type SalesPageResult = { 
    rows: SalesOrderRow[]
    total: number
    stats: { 
        monthRevenue: number
        monthOrders: number
        revenueWithInvoice?: number
        ordersWithInvoice?: number
        revenueExemptInvoice?: number
        ordersExemptInvoice?: number
        revenuePendingInvoice?: number
        pendingApproval: number
        draft: number
        confirmed: number 
    }
    statusCounts: Record<string, number> 
}

type Props = {
    initialData?: SalesPageResult
    userId: string
    userRoles: string[]
    userPermissions?: string[]
}

export function SalesClient({ initialData, userId, userRoles, userPermissions = [] }: Props) {
    const queryClient = useQueryClient()
    const canSeeMargin = MARGIN_ROLES.some(r => userRoles.includes(r))
    const isCEO = userRoles.includes('CEO')
    const isSaleAdminOrMgr = userRoles.includes('Sales Admin') || userRoles.includes('Sales Manager') || userRoles.includes('SALES_ADMIN') || userRoles.includes('SALES_MGR')
    const canAcctApprove = userRoles.includes('Kế Toán') || userRoles.includes('KE_TOAN') || userRoles.includes('ACCOUNTANT')

    const isAccountant = canAcctApprove || 
                         userPermissions.includes('TAX:WRITE') || 
                         userPermissions.includes('FIN:WRITE')

    const isAdmin = isCEO || 
                    userRoles.includes('Admin') || 
                    userRoles.includes('ADMIN') || 
                    userRoles.includes('DIRECTOR') || 
                    userRoles.includes('Trợ Lý') || 
                    userRoles.includes('TRO_LY') || 
                    userPermissions.includes('SYS:ADMIN')

    const canToggleInvoiceExempt = isAccountant || isAdmin

    const canCreateInvoice = isCEO || 
                             canAcctApprove || 
                             userPermissions.includes('TAX:CREATE') || 
                             userPermissions.includes('TAX:WRITE') || 
                             userPermissions.includes('FIN:WRITE') || 
                             userPermissions.includes('SYS:ADMIN')

    const canCreateSO = isCEO || 
                        isSaleAdminOrMgr || 
                        userRoles.includes('Sales Rep') || 
                        userRoles.includes('SALES_REP') || 
                        userPermissions.includes('SLS:CREATE') || 
                        userPermissions.includes('SLS:WRITE') || 
                        userPermissions.includes('SYS:ADMIN')

    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<SOStatus | ''>('')
    
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    const searchParams = useSearchParams()

    useEffect(() => {
        if (searchParams?.get('action') === 'createTasting') {
            const pId = searchParams.get('proposalId') || ''
            const cId = searchParams.get('customerId') || ''
            setCloneData({
                customerId: cId,
                channel: 'HORECA',
                paymentTerm: 'TASTING - Không thu tiền',
                orderDiscount: 0,
                legalEntityId: '',
                orderType: 'TASTING',
                proposalId: pId,
                notes: pId ? `Đơn Tasting theo Tờ trình` : 'Đơn Tasting',
                lines: []
            })
            setCreateOpen(true)
        }
    }, [searchParams])

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [sortBy, setSortBy] = useState<'createdAt' | 'totalAmount' | 'soNo'>('createdAt')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [datePreset, setDatePreset] = useState<DatePresetKey>('ALL')

    const handleDatePresetChange = (preset: DatePresetKey) => {
        setDatePreset(preset)
        const { dateFrom: df, dateTo: dt } = getDatePresetRange(preset)
        setDateFrom(df)
        setDateTo(dt)
        setPage(1)
        reload({ dateFrom: df, dateTo: dt, page: 1 }, true)
    }

    const [createOpen, setCreateOpen] = useState(false)
    const [cloneData, setCloneData] = useState<CloneSOData | null>(null)
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
    const [orderTypeFilter, setOrderTypeFilter] = useState<string>('ALL')
    const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'INVOICED' | 'EXEMPT' | 'PENDING'>('ALL')

    // TanStack Query — cache sales data, survive tab switches
    const queryKey = [
        'sales', 
        { 
            search: search || undefined, 
            status: statusFilter || undefined, 
            page, 
            pageSize,
            sortBy, 
            sortDir, 
            dateFrom: dateFrom || undefined, 
            dateTo: dateTo || undefined,
            salesRepId: salesRepFilter || undefined,
            channel: channelFilter || undefined,
            legalEntityId: legalEntityFilter || undefined,
            warehouseId: warehouseFilter || undefined,
            paymentTerm: paymentTermFilter || undefined,
            pendingAction: pendingActionFilter || undefined,
            orderType: orderTypeFilter !== 'ALL' ? orderTypeFilter : undefined,
            invoiceFilter: invoiceFilter !== 'ALL' ? invoiceFilter : undefined
        }
    ]
    const { data: queryData, isLoading: loading, refetch } = useQuery({
        queryKey,
        queryFn: () => getSalesPageData({
            search: search || undefined,
            status: statusFilter as SOStatus || undefined,
            page,
            pageSize,
            sortBy: sortBy as any,
            sortDir: sortDir as any,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            salesRepId: salesRepFilter || undefined,
            channel: channelFilter as any || undefined,
            legalEntityId: legalEntityFilter || undefined,
            warehouseId: warehouseFilter || undefined,
            paymentTerm: paymentTermFilter || undefined,
            pendingAction: pendingActionFilter || undefined,
            orderType: (orderTypeFilter as any) || 'ALL',
            invoiceFilter: invoiceFilter !== 'ALL' ? invoiceFilter : undefined
        }),
        initialData: !search && !statusFilter && page === 1 && pageSize === 20 && sortBy === 'createdAt' && sortDir === 'desc' && !dateFrom && !dateTo && !salesRepFilter && !channelFilter && !legalEntityFilter && !warehouseFilter && !paymentTermFilter && !pendingActionFilter && orderTypeFilter === 'ALL' && invoiceFilter === 'ALL'
            ? initialData
            : undefined,
        staleTime: 0,
    })

    const rows = queryData?.rows ?? []
    const total = queryData?.total ?? 0
    const stats: NonNullable<SalesPageResult['stats']> = (queryData?.stats as any) ?? { 
        monthRevenue: 0, 
        monthOrders: 0, 
        revenueWithInvoice: 0,
        ordersWithInvoice: 0,
        revenueExemptInvoice: 0,
        ordersExemptInvoice: 0,
        revenuePendingInvoice: 0,
        pendingApproval: 0, 
        draft: 0, 
        confirmed: 0 
    }
    const counts = queryData?.statusCounts ?? {}

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const getPageNumbers = () => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1)
        }
        const pages: (number | '...')[] = [1]
        if (page <= 4) {
            for (let i = 2; i <= 5; i++) {
                pages.push(i)
            }
            pages.push('...')
            pages.push(totalPages)
        } else if (page >= totalPages - 3) {
            pages.push('...')
            for (let i = totalPages - 4; i <= totalPages - 1; i++) {
                pages.push(i)
            }
            pages.push(totalPages)
        } else {
            pages.push('...')
            for (let i = page - 1; i <= page + 1; i++) {
                pages.push(i)
            }
            pages.push('...')
            pages.push(totalPages)
        }
        return pages
    }

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages || newPage === page) return
        setPage(newPage)
        reload({ page: newPage }, true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const salesReps = (queryData as any)?.salesReps ?? (initialData as any)?.salesReps ?? []
    const pageLegalEntities = (queryData as any)?.legalEntities ?? (initialData as any)?.legalEntities ?? []
    const pageWarehouses = (queryData as any)?.warehouses ?? (initialData as any)?.warehouses ?? []
    const paymentTerms = (queryData as any)?.paymentTerms ?? (initialData as any)?.paymentTerms ?? []

    const hasActiveFilters = !!(search || statusFilter || (invoiceFilter && invoiceFilter !== 'ALL') || dateFrom || dateTo || salesRepFilter || channelFilter || legalEntityFilter || warehouseFilter || paymentTermFilter || pendingActionFilter || (orderTypeFilter && orderTypeFilter !== 'ALL'))

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
        setOrderTypeFilter('ALL')
        setInvoiceFilter('ALL')
        setPage(1)
        reload({
            search: '', status: '', page: 1, dateFrom: '', dateTo: '',
            salesRepId: '', channel: '', legalEntityId: '', warehouseId: '', paymentTerm: '', pendingAction: false, orderType: 'ALL', invoiceFilter: 'ALL'
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
            search: string; status: string; page: number; pageSize: number; sortBy: string; sortDir: string; dateFrom: string; dateTo: string;
            salesRepId: string; channel: string; legalEntityId: string; warehouseId: string; paymentTerm: string; pendingAction: boolean; orderType: string; invoiceFilter: string
        }>,
        _onlyRows = false
    ) => {
        // Update filter state → queryKey changes → auto refetch
        if (overrides?.search !== undefined) setSearch(overrides.search)
        if (overrides?.status !== undefined) setStatusFilter(overrides.status as SOStatus | '')
        if (overrides?.page !== undefined) setPage(overrides.page)
        if (overrides?.pageSize !== undefined) setPageSize(overrides.pageSize)
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
        if (overrides?.orderType !== undefined) setOrderTypeFilter(overrides.orderType)
        if (overrides?.invoiceFilter !== undefined) setInvoiceFilter(overrides.invoiceFilter as any)
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

    const acctApproveMutation = useMutation({
        mutationFn: async ({ id, legalEntityId }: { id: string; legalEntityId?: string }) => {
            const r = await accountingApproveSO(id, legalEntityId)
            if (!r.success) throw new Error(r.error || 'Duyệt không thành công')
            return r
        },
        onMutate: ({ id }) => updateCachedOrderStatus(id, 'CONFIRMED'),
        onError: (err, variables, context) => rollbackQueries(context),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['sales'] })
            refetch()
        },
    })

    const acctRejectMutation = useMutation({
        mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
            const r = await accountingRejectSO(id, reason)
            if (!r.success) throw new Error(r.error || 'Từ chối không thành công')
            return r
        },
        onMutate: ({ id }) => updateCachedOrderStatus(id, 'DRAFT'),
        onError: (err, variables, context) => rollbackQueries(context),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['sales'] })
            refetch()
        },
    })

    const approveMutation = useMutation({
        mutationFn: async ({ id, vintages, warehouseId }: { id: string; vintages?: { lineId: string; vintage: number }[]; warehouseId?: string }) => {
            const r = await approveSalesOrder(id, vintages, warehouseId)
            if (!r.success) throw new Error(r.error || 'Duyệt không thành công')
            return r
        },
        onMutate: ({ id }) => updateCachedOrderStatus(id, 'PENDING_ACCOUNTING'),
        onError: (err, variables, context) => rollbackQueries(context),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['sales'] })
            refetch()
        },
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
        if (!confirm('Bạn có chắc chắn muốn nhân bản đơn hàng này không?')) return
        setActionLoading(id)
        try {
            const detail = await getSalesOrderDetail(id)
            if (!detail) {
                toast.error('Không tìm thấy thông tin đơn hàng để clone')
                return
            }
            setCloneData({
                customerId: detail.customerId,
                channel: detail.channel as SalesChannel,
                paymentTerm: detail.paymentTerm,
                orderDiscount: Number(detail.orderDiscount),
                legalEntityId: detail.legalEntityId,
                shippingAddressId: detail.shippingAddressId || '',
                notes: detail.notes ? `[Bản sao từ ${detail.soNo}] ${detail.notes}` : `Bản sao từ ${detail.soNo}`,
                lines: detail.lines.map(l => ({
                    productId: l.productId,
                    productName: l.product.productName,
                    skuCode: l.product.skuCode,
                    qtyOrdered: Number(l.qtyOrdered),
                    unitPrice: Number(l.unitPrice),
                    lineDiscountPct: Number(l.lineDiscountPct),
                    vatRate: Number(l.vatRate || 10),
                    priceSource: l.priceSource,
                    stock: (l.product as any).stock ?? 100,
                })),
            })
            setCreateOpen(true)
        } catch (err: any) {
            toast.error('Lỗi khi tải thông tin đơn hàng: ' + err.message)
        } finally {
            setActionLoading(null)
        }
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
                orderType: orderTypeFilter !== 'ALL' ? (orderTypeFilter as SOType) : undefined
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

    const handleExportMisaSme = async (orderIds?: string[]) => {
        toast.promise(
            exportMisaSmeExcel({
                orderIds,
                status: statusFilter || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                salesRepId: salesRepFilter || undefined,
                channel: channelFilter as any || undefined,
                legalEntityId: legalEntityFilter || undefined,
                warehouseId: warehouseFilter || undefined,
                paymentTerm: paymentTermFilter || undefined,
                pendingAction: pendingActionFilter || undefined,
                orderType: orderTypeFilter !== 'ALL' ? (orderTypeFilter as SOType) : undefined
            }).then(({ base64, filename }) => {
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
                a.download = filename || `MISA_SME_SalesOrders_${new Date().toISOString().split('T')[0]}.xlsx`
                a.click()
                URL.revokeObjectURL(url)
            }),
            {
                loading: 'Đang khởi tạo file Excel MISA SME...',
                success: 'Đã xuất file MISA SME thành công! Bạn có thể Nhập khẩu trực tiếp vào MISA SME Offline.',
                error: 'Lỗi xuất file MISA SME',
            }
        )
    }

    const handleExportVnptInvoice = async (orderIds?: string[]) => {
        toast.promise(
            exportVnptInvoiceExcel({
                orderIds,
                status: statusFilter || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                salesRepId: salesRepFilter || undefined,
                channel: channelFilter as any || undefined,
                legalEntityId: legalEntityFilter || undefined,
                warehouseId: warehouseFilter || undefined,
                paymentTerm: paymentTermFilter || undefined,
                pendingAction: pendingActionFilter || undefined,
                orderType: orderTypeFilter !== 'ALL' ? (orderTypeFilter as SOType) : undefined
            }).then(({ base64, filename }) => {
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
                a.download = filename || `VNPT_Einvoice_1Tax_${new Date().toISOString().split('T')[0]}.xlsx`
                a.click()
                URL.revokeObjectURL(url)
            }),
            {
                loading: 'Đang khởi tạo file Excel HĐĐT VNPT...',
                success: 'Đã xuất file VNPT HĐĐT thành công! Bạn có thể Upload trực tiếp lên Portal VNPT Invoice.',
                error: 'Lỗi xuất file HĐĐT VNPT',
            }
        )
    }

    return (
        <div className="space-y-4 max-w-screen-2xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {/* Inline Quick Stats */}
                    <div className="hidden xl:flex items-center gap-x-3 text-xs">
                        <span style={{ color: '#475569' }}>Tổng DT: <strong className="font-mono text-sm ml-1" style={{ color: '#0891B2' }}>₫{(stats.monthRevenue / 1e9).toFixed(2)}T</strong></span>
                        <span className="text-[#E2E8F0]">|</span>
                        <span style={{ color: '#475569' }} title="Doanh thu đã xuất hóa đơn VAT">Có HĐ: <strong className="font-mono text-sm ml-1 text-emerald-400">₫{((stats.revenueWithInvoice || 0) / 1e9).toFixed(2)}T</strong></span>
                        <span className="text-[#E2E8F0]">|</span>
                        <span style={{ color: '#475569' }} title="Doanh thu không xuất hóa đơn VAT (vẫn tính đủ 100% VAT)">Không HĐ: <strong className="font-mono text-sm ml-1 text-amber-400">₫{((stats.revenueExemptInvoice || 0) / 1e9).toFixed(2)}T</strong></span>
                        <span className="text-[#E2E8F0]">|</span>
                        <span style={{ color: '#475569' }}>Đơn: <strong className="font-mono text-sm ml-1" style={{ color: '#5BA88A' }}>{stats.monthOrders}</strong></span>
                        <span style={{ color: '#475569' }}>Chờ duyệt: <strong className="font-mono text-sm ml-1" style={{ color: '#D4A853' }}>{stats.pendingApproval}</strong></span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowStats(!showStats)}
                        className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-all rounded-md"
                        style={{ 
                            background: showStats ? 'rgba(8, 145, 178, 0.08)' : 'rgba(138,174,187,0.1)', 
                            color: showStats ? '#87CBB9' : '#475569', 
                            border: `1px solid ${showStats ? 'rgba(8, 145, 178, 0.25)' : 'rgba(138,174,187,0.25)'}` 
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
                        style={{ background: 'rgba(138,174,187,0.1)', color: '#475569', border: '1px solid rgba(138,174,187,0.25)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(138,174,187,0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(138,174,187,0.1)')}>
                        <Download size={14} /> Excel
                    </button>
                    <button onClick={() => handleExportMisaSme()}
                        className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-black transition-all rounded-md cursor-pointer shadow-2xs active:scale-95"
                        style={{ background: '#F59E0B', color: '#FFFFFF', border: '1px solid #D97706' }}
                        title="Xuất file Excel chuẩn MISA SME.NET Offline để Kế toán Import nhanh"
                        onMouseEnter={e => (e.currentTarget.style.background = '#D97706')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#F59E0B')}>
                        <Download size={14} /> ⚡ Xuất MISA SME
                    </button>
                    <button onClick={() => handleExportVnptInvoice()}
                        className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-black transition-all rounded-md cursor-pointer shadow-2xs active:scale-95"
                        style={{ background: '#2563EB', color: '#FFFFFF', border: '1px solid #1D4ED8' }}
                        title="Xuất file Excel Hóa Đơn Điện Tử VNPT (Mẫu 1 loại thuế) để Upload lên Portal VNPT"
                        onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}>
                        <Download size={14} /> 📜 VNPT HĐĐT
                    </button>
                    {canCreateSO && (
                        <button onClick={() => { setCloneData(null); setCreateOpen(true) }}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all duration-150"
                            style={{ background: '#0891B2', color: '#FFFFFF', borderRadius: '6px' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                            <Plus size={16} /> Tạo Đơn Mới
                        </button>
                    )}
                </div>
            </div>

            {/* Collapsible Stats Section */}
            {showStats && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>Thống Kê Chi Tiết Doanh Thu & Đơn Hàng</span>
                        <button onClick={() => setShowStats(false)} className="text-xs font-semibold hover:underline flex items-center gap-1" style={{ color: '#0891B2' }}>
                            Thu gọn chỉ số ✕
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <SOStatCard label="Tổng Doanh Thu" value={`₫${(stats.monthRevenue / 1e9).toFixed(2)}T`} sub="Bao gồm 100% VAT" accent="#87CBB9" />
                        <SOStatCard label="Doanh Thu Có HĐ" value={`₫${((stats.revenueWithInvoice || 0) / 1e9).toFixed(2)}T`} sub={`${stats.ordersWithInvoice || 0} đơn có HĐ`} accent="#10B981" />
                        <SOStatCard label="DT Không Xuất HĐ" value={`₫${((stats.revenueExemptInvoice || 0) / 1e9).toFixed(2)}T`} sub={`${stats.ordersExemptInvoice || 0} đơn miễn HĐ`} accent="#F59E0B" />
                        <SOStatCard label="Đơn Tháng Này" value={stats.monthOrders} accent="#5BA88A" />
                        <SOStatCard label="Chờ Duyệt" value={stats.pendingApproval} accent="#D4A853" />
                        <SOStatCard label="Đã Xác Nhận" value={stats.confirmed} accent="#4A8FAB" />
                    </div>
                </div>
            )}

            {/* Toolbar: Tabs & Main Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-200/30">
                {/* Left side: Quick Filter Tabs */}
                <div className="flex-1 min-w-0">
                    <FilterTabs active={statusFilter} counts={counts} onChange={handleStatusTab} />
                </div>

                {/* Right side: Search + Date inputs + Filter button */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Search input */}
                    <div className="relative w-full sm:w-48 xl:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                            className="w-full pl-9 pr-3 py-1.5 text-xs outline-none bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded focus:border-cyan-600 shadow-2xs"
                            style={{ color: '#0F172A' }} />
                    </div>

                    {/* MISA-style Date Period Preset Dropdown */}
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 border border-slate-300 rounded-[4px] shadow-2xs">
                        <Calendar size={13} style={{ color: datePreset !== 'ALL' ? '#0891B2' : '#64748B' }} />
                        <select
                            value={datePreset}
                            onChange={e => handleDatePresetChange(e.target.value as DatePresetKey)}
                            className="bg-transparent border-none text-xs font-semibold outline-none cursor-pointer pr-1 text-slate-800"
                            style={{ color: datePreset !== 'ALL' ? '#0891B2' : '#0F172A' }}
                        >
                            {DATE_PRESET_OPTIONS.map(opt => (
                                <option key={opt.key} value={opt.key} className="bg-white text-slate-900">
                                    {opt.label}
                                </option>
                            ))}
                        </select>

                        <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5 ml-0.5">
                            <input type="date" value={dateFrom}
                                onChange={e => {
                                    setDatePreset('CUSTOM')
                                    setDateFrom(e.target.value)
                                    setPage(1)
                                    reload({ dateFrom: e.target.value, dateTo, page: 1 }, true)
                                }}
                                className="bg-transparent border-none text-[11px] text-slate-700 outline-none w-[95px] p-0"
                                style={{ color: '#0F172A' }} />
                            <span className="text-[10px] text-slate-400">→</span>
                            <input type="date" value={dateTo}
                                onChange={e => {
                                    setDatePreset('CUSTOM')
                                    setDateTo(e.target.value)
                                    setPage(1)
                                    reload({ dateFrom, dateTo: e.target.value, page: 1 }, true)
                                }}
                                className="bg-transparent border-none text-[11px] text-slate-700 outline-none w-[95px] p-0"
                                style={{ color: '#0F172A' }} />
                        </div>
                    </div>

                    {/* Filter Toggle Button */}
                    {(() => {
                        const hasAdvancedFilters = !!(salesRepFilter || channelFilter || legalEntityFilter || warehouseFilter || paymentTermFilter || pendingActionFilter || (orderTypeFilter && orderTypeFilter !== 'ALL') || (invoiceFilter && invoiceFilter !== 'ALL'));
                        return (
                            <button onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded transition-all shadow-2xs"
                                style={{
                                    background: (showFilters || hasAdvancedFilters) ? 'rgba(8,145,178,0.1)' : '#FFFFFF',
                                    color: (showFilters || hasAdvancedFilters) ? '#0891B2' : '#475569',
                                    border: `1px solid ${(showFilters || hasAdvancedFilters) ? 'rgba(8,145,178,0.3)' : '#CBD5E1'}`,
                                }}
                            >
                                <Plus size={12} style={{ transform: showFilters ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                Bộ lọc
                                {hasAdvancedFilters && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#0891B2]" />
                                )}
                            </button>
                        );
                    })()}
                </div>
            </div>

            {/* Collapsible Advanced Filters */}
            {showFilters && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 p-3 rounded-lg animate-in slide-in-from-top-2 duration-150 bg-slate-50 border border-slate-200">
                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1 text-slate-600">Loại Đơn Hàng</label>
                        <select value={orderTypeFilter} 
                            onChange={e => { setOrderTypeFilter(e.target.value); setPage(1); reload({ orderType: e.target.value as any, page: 1 }, true) }}
                            className="w-full px-2 py-1.5 text-xs outline-none font-semibold bg-white border border-slate-300 rounded text-slate-800"
                            style={{ color: orderTypeFilter === 'TASTING' ? '#D97706' : '#0F172A' }}>
                            <option value="ALL">Tất cả loại đơn</option>
                            <option value="STANDARD">📦 Thương Mại</option>
                            <option value="TASTING">🍷 Tasting (Nếm thử)</option>
                            <option value="SAMPLE">🍾 Hàng Mẫu</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1 text-slate-600">Trạng Thái HĐ</label>
                        <select value={invoiceFilter} 
                            onChange={e => { setInvoiceFilter(e.target.value as any); setPage(1); reload({ invoiceFilter: e.target.value, page: 1 }, true) }}
                            className="w-full px-2 py-1.5 text-xs outline-none font-semibold bg-white border border-slate-300 rounded text-slate-800"
                            style={{ color: invoiceFilter === 'EXEMPT' ? '#D97706' : invoiceFilter === 'INVOICED' ? '#059669' : '#0F172A' }}>
                            <option value="ALL">Tất cả hóa đơn</option>
                            <option value="INVOICED">📜 Có hóa đơn VAT</option>
                            <option value="EXEMPT">🚫 Không xuất HĐ VAT</option>
                            <option value="PENDING">⏳ Chờ xuất HĐ</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1 text-slate-600">Nhân viên Sales</label>
                        <select value={salesRepFilter} 
                            onChange={e => { setSalesRepFilter(e.target.value); setPage(1); reload({ salesRepId: e.target.value, page: 1 }, true) }}
                            className="w-full px-2 py-1.5 text-xs outline-none bg-white border border-slate-300 rounded text-slate-800"
                            style={{ color: '#0F172A' }}>
                            <option value="">Tất cả Sales</option>
                            {salesReps.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1 text-slate-600">Kênh</label>
                        <select value={channelFilter} 
                            onChange={e => { setChannelFilter(e.target.value); setPage(1); reload({ channel: e.target.value, page: 1 }, true) }}
                            className="w-full px-2 py-1.5 text-xs outline-none bg-white border border-slate-300 rounded text-slate-800"
                            style={{ color: '#0F172A' }}>
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
                        <label className="text-[10px] font-bold uppercase block mb-1 text-slate-600">Pháp nhân</label>
                        <select value={legalEntityFilter} 
                            onChange={e => { setLegalEntityFilter(e.target.value); setPage(1); reload({ legalEntityId: e.target.value, page: 1 }, true) }}
                            className="w-full px-2 py-1.5 text-xs outline-none bg-white border border-slate-300 rounded text-slate-800"
                            style={{ color: '#0F172A' }}>
                            <option value="">Tất cả pháp nhân</option>
                            {pageLegalEntities.map((le: any) => (
                                <option key={le.id} value={le.id}>{le.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1 text-slate-600">Kho xuất</label>
                        <select value={warehouseFilter} 
                            onChange={e => { setWarehouseFilter(e.target.value); setPage(1); reload({ warehouseId: e.target.value, page: 1 }, true) }}
                            className="w-full px-2 py-1.5 text-xs outline-none bg-white border border-slate-300 rounded text-slate-800"
                            style={{ color: '#0F172A' }}>
                            <option value="">Tất cả kho</option>
                            {pageWarehouses.map((wh: any) => (
                                <option key={wh.id} value={wh.id}>{wh.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1 text-slate-600">Điều khoản</label>
                        <select value={paymentTermFilter} 
                            onChange={e => { setPaymentTermFilter(e.target.value); setPage(1); reload({ paymentTerm: e.target.value, page: 1 }, true) }}
                            className="w-full px-2 py-1.5 text-xs outline-none bg-white border border-slate-300 rounded text-slate-800"
                            style={{ color: '#0F172A' }}>
                            <option value="">Tất cả</option>
                            {paymentTerms.map((pt: string) => (
                                <option key={pt} value={pt}>{pt}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-1.5 cursor-pointer py-1.5 text-xs font-semibold text-slate-600">
                            <input type="checkbox" checked={pendingActionFilter} 
                                onChange={e => { setPendingActionFilter(e.target.checked); setPage(1); reload({ pendingAction: e.target.checked, page: 1 }, true) }}
                                className="rounded border-slate-200 text-[#0891B2] focus:ring-0 focus:ring-offset-0 bg-white w-4 h-4" />
                            <span>⚠️ Cần xử lý</span>
                        </label>
                    </div>
                </div>
            )}

            {/* Table (Desktop View) */}
            <div className="hidden md:block rounded-md overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse', minWidth: 1050 }}>
                        <thead>
                            <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                <SortHeader label="Số SO" field="soNo" current={sortBy} dir={sortDir} onSort={handleSort} style={{ width: '8%' }} />
                                <th className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#475569', width: '9%' }}>Số Hóa Đơn</th>
                                <th className="px-4 py-1.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#475569', width: '17%' }}>Khách Hàng</th>
                                <th className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#475569', width: '6%' }}>Kênh</th>
                                <th className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#475569', width: '6%' }}>Pháp Nhân</th>
                                <SortHeader label="Doanh Số" field="totalAmount" current={sortBy} dir={sortDir} onSort={handleSort} style={{ width: '10%' }} />
                                <th className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#475569', width: '9%' }}>Nhân viên Sales</th>
                                <th className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#475569', width: '9%' }}>Trạng Thái Đơn</th>
                                <th className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#475569', width: '9%' }}>Giao Hàng</th>
                                <SortHeader label="Ngày Tạo" field="createdAt" current={sortBy} dir={sortDir} onSort={handleSort} style={{ width: '7%' }} />
                                <th className="px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-center" style={{ color: '#475569', width: '15%' }}>Hành Động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={11} className="text-center py-12" style={{ color: '#64748B' }}>
                                    <Loader2 size={20} className="inline animate-spin mr-2" />Đang tải...
                                </td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={11} className="text-center py-16" style={{ color: '#64748B' }}>
                                    <FileText size={32} className="mx-auto mb-3" style={{ color: '#E2E8F0' }} />
                                    <p className="text-sm font-semibold">{hasActiveFilters ? 'Không tìm thấy đơn hàng phù hợp với bộ lọc' : 'Hệ thống chưa có đơn hàng nào'}</p>
                                    {hasActiveFilters && (
                                         <button onClick={handleClearFilters} className="mt-3 px-3 py-1.5 text-xs font-semibold rounded transition-all" style={{ background: '#0891B2', color: '#FFFFFF' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
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
                                        <span className="text-[11px] font-bold font-mono" style={{ color: '#0891B2' }}>{row.soNo}</span>
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                        {row.invoiceNo ? (
                                            <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded"
                                                style={{ background: 'rgba(135,203,185,0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.15)' }}
                                                title={row.invoiceNo}>
                                                {row.invoiceNo}
                                            </span>
                                        ) : row.isInvoiceExempt ? (
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                                                style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}
                                                title={`Miễn HĐ: ${row.invoiceExemptReason || 'Không có lý do'}${row.invoiceExemptBy ? ` (Duyệt bởi: ${row.invoiceExemptBy})` : ''}`}>
                                                <FileX2 size={11} /> Không HĐ
                                            </span>
                                        ) : null}
                                    </td>
                                    <td className="px-4 py-1.5">
                                        <p className="text-[13px] font-semibold truncate max-w-[220px]" style={{ color: '#0F172A' }} title={row.customerName}>{row.customerName}</p>
                                        <p className="text-[10px] font-mono" style={{ color: '#64748B' }}>{row.customerCode}</p>
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                        <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium"
                                            style={{ background: 'rgba(135,203,185,0.1)', color: '#475569' }}>
                                            {CHANNEL_LABEL[row.channel] ?? row.channel}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                        {row.legalEntityCode ? (
                                            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold"
                                                style={{ background: row.legalEntityCode === 'TA' ? 'rgba(212,168,83,0.12)' : 'rgba(8, 145, 178, 0.08)', color: row.legalEntityCode === 'TA' ? '#D4A853' : '#87CBB9' }}>
                                                {row.legalEntityCode}
                                            </span>
                                        ) : (
                                            <span className="text-[11px]" style={{ color: '#E2E8F0' }}>—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-1.5 whitespace-nowrap">
                                        <p className="text-[13px] font-bold font-mono" style={{ color: '#0F172A' }}>{formatVND(row.totalAmount)}</p>
                                        {row.orderDiscount > 0 && <p className="text-[10px]" style={{ color: '#5BA88A' }}>CK {row.orderDiscount}%</p>}
                                    </td>
                                    <td className="px-3 py-1.5 text-xs whitespace-nowrap" style={{ color: '#475569' }}>{row.salesRepName}</td>
                                    <td className="px-3 py-1.5 whitespace-nowrap"><StatusBadge status={row.status} approvalStep={row.approvalStep} /></td>
                                    <td className="px-3 py-1.5 whitespace-nowrap"><DeliveryStatusBadge status={row.deliveryStatus} shipped={row.totalQtyShipped} ordered={row.totalQtyOrdered} /></td>
                                    <td className="px-3 py-1.5 text-xs whitespace-nowrap" style={{ color: '#64748B' }}>{formatDateTime(row.createdAt)}</td>
                                    <td className="px-4 py-1.5">
                                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                            <button onClick={() => setDetailId(row.id)} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded transition-all"
                                                style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.25)' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.25)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(8, 145, 178, 0.08)')}>
                                                <Eye size={11} /> Xem
                                            </button>
                                            <button onClick={() => window.open(`/dashboard/sales/print?id=${row.id}`, '_blank')} className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded transition-all"
                                                style={{ background: 'rgba(138,174,187,0.15)', color: '#475569', border: '1px solid rgba(138,174,187,0.3)' }}
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
                                            {row.status === 'DRAFT' && canCreateSO && (
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
                                                        toast.promise(acctRejectMutation.mutateAsync({ id: row.id }).then(() => {
                                                            if (detailId === row.id) setDetailId(null)
                                                            reload()
                                                        }), {
                                                            loading: 'Đang trả về...', success: 'Đã trả về DRAFT', error: (e: any) => `Lỗi: ${e.message}`, finally: () => setActionLoading(null)
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
                        <div key={i} className="p-4 space-y-3 rounded-lg border border-slate-200/30 bg-slate-50 animate-pulse">
                            <div className="flex justify-between">
                                <div className="h-4 bg-white rounded w-1/3" />
                                <div className="h-3 bg-white rounded w-1/4" />
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 bg-white rounded w-3/4" />
                                <div className="h-3 bg-white rounded w-1/2" />
                            </div>
                            <div className="flex gap-2">
                                <div className="h-5 bg-white rounded w-16" />
                                <div className="h-5 bg-white rounded w-12" />
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-200/20">
                                <div className="h-4 bg-white rounded w-24" />
                                <div className="h-5 bg-white rounded w-20" />
                            </div>
                        </div>
                    ))
                ) : rows.length === 0 ? (
                    <div className="text-center py-16 rounded-md border border-slate-200 bg-slate-50" style={{ color: '#64748B' }}>
                        <FileText size={32} className="mx-auto mb-3" style={{ color: '#E2E8F0' }} />
                        <p className="text-sm font-semibold">{hasActiveFilters ? 'Không tìm thấy đơn hàng phù hợp với bộ lọc' : 'Hệ thống chưa có đơn hàng nào'}</p>
                        {hasActiveFilters && (
                             <button onClick={handleClearFilters} className="mt-3 px-3 py-1.5 text-xs font-semibold rounded transition-all" style={{ background: '#0891B2', color: '#FFFFFF' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.9'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
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
                                toast.promise(acctRejectMutation.mutateAsync({ id: row.id }).then(() => {
                                    if (detailId === row.id) setDetailId(null)
                                    reload()
                                }), {
                                    loading: 'Đang trả về...', success: 'Đã trả về DRAFT', error: (e: any) => `Lỗi: ${e.message}`, finally: () => setActionLoading(null)
                                })
                            }}
                            onCancel={() => handleCancel(row.id)}
                            onClone={() => handleClone(row.id)}
                            canApprove={((isSaleAdminOrMgr && row.approvalStep === 1) || (isCEO && row.approvalStep === 2) || (!row.approvalStep && (isCEO || isSaleAdminOrMgr)))}
                            canAcctApprove={canAcctApprove}
                            actionLoading={actionLoading}
                        />
                    ))
                )}
            </div>

            {/* Pagination */}
            {total > 0 && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border border-slate-200 rounded-md animate-none">
                    <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: '#64748B' }}>
                        <span>
                            Hiển thị <span style={{ color: '#475569' }}>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</span> trong <span style={{ color: '#475569' }}>{total}</span> đơn hàng
                        </span>
                        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                            <span>Hiển thị:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    const newSize = Number(e.target.value)
                                    setPageSize(newSize)
                                    setPage(1)
                                    reload({ pageSize: newSize, page: 1 }, true)
                                }}
                                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-[#87CBB9]"
                            >
                                <option value={20}>20 / trang</option>
                                <option value={50}>50 / trang</option>
                                <option value={100}>100 / trang</option>
                            </select>
                        </div>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                            <button
                                onClick={() => handlePageChange(1)}
                                disabled={page <= 1}
                                title="Trang đầu"
                                className="min-w-[32px] h-8 px-1.5 rounded text-xs font-semibold transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white"
                                style={{ color: '#475569', border: '1px solid #E2E8F0', borderRadius: '4px' }}
                            >
                                <ChevronsLeft size={15} />
                            </button>
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page <= 1}
                                title="Trang trước"
                                className="min-w-[32px] h-8 px-1.5 rounded text-xs font-semibold transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white"
                                style={{ color: '#475569', border: '1px solid #E2E8F0', borderRadius: '4px' }}
                            >
                                <ChevronLeft size={15} />
                            </button>
                            {getPageNumbers().map((p, i) =>
                                p === '...' ? (
                                    <span key={`dots-${i}`} className="px-1 text-xs select-none" style={{ color: '#64748B' }}>…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => handlePageChange(p as number)}
                                        className="min-w-[32px] h-8 px-2 rounded text-xs font-semibold transition-all"
                                        style={{
                                            background: p === page ? 'rgba(8, 145, 178, 0.08)' : 'transparent',
                                            color: p === page ? '#87CBB9' : '#475569',
                                            border: `1px solid ${p === page ? '#87CBB9' : '#E2E8F0'}`,
                                            borderRadius: '4px',
                                        }}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page >= totalPages}
                                title="Trang sau"
                                className="min-w-[32px] h-8 px-1.5 rounded text-xs font-semibold transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white"
                                style={{ color: '#475569', border: '1px solid #E2E8F0', borderRadius: '4px' }}
                            >
                                <ChevronRight size={15} />
                            </button>
                            <button
                                onClick={() => handlePageChange(totalPages)}
                                disabled={page >= totalPages}
                                title="Trang cuối"
                                className="min-w-[32px] h-8 px-1.5 rounded text-xs font-semibold transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white"
                                style={{ color: '#475569', border: '1px solid #E2E8F0', borderRadius: '4px' }}
                            >
                                <ChevronsRight size={15} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {detailId && (
                <SODetailDrawer 
                    soId={detailId} 
                    onClose={() => setDetailId(null)} 
                    onClone={handleClone} 
                    canSeeMargin={canSeeMargin}
                    canAcctApprove={canAcctApprove}
                    canApprove={isCEO || isSaleAdminOrMgr}
                    canCreateInvoice={canCreateInvoice}
                    canToggleInvoiceExempt={canToggleInvoiceExempt}
                    onReloadList={() => reload()}
                    onAcctApprove={(id, entityId) => {
                        setAcctModalId(id)
                        if (entityId) setAcctEntityId(entityId)
                    }}
                    onAcctReject={(id) => {
                        setActionLoading(id)
                        toast.promise(acctRejectMutation.mutateAsync({ id }).then(() => {
                            setDetailId(null)
                            reload()
                        }), {
                            loading: 'Đang trả về...', success: 'Đã trả về DRAFT', error: (e: any) => `Lỗi: ${e.message}`, finally: () => setActionLoading(null)
                        })
                    }}
                    onApprove={(id) => setApprovalModalId(id)}
                    onReject={(id) => {
                        setActionLoading(id)
                        toast.promise(rejectSalesOrder(id).then(() => reload()), {
                            loading: 'Đang từ chối...', success: 'Đã từ chối đơn', error: 'Lỗi', finally: () => setActionLoading(null)
                        })
                    }}
                />
            )}

            {createOpen && (
                <CreateSODrawer
                    open={createOpen}
                    onClose={() => { setCreateOpen(false); setCloneData(null) }}
                    cloneData={cloneData}
                    onSaved={(newSoId) => {
                        setCreateOpen(false)
                        setCloneData(null)
                        queryClient.invalidateQueries({ queryKey: ['sales'] })
                        setSearchInput('')
                        setSearch('')
                        setStatusFilter('')
                        setSortBy('createdAt')
                        setSortDir('desc')
                        setPage(1)
                        reload({ search: '', status: '', page: 1, sortBy: 'createdAt', sortDir: 'desc' }, true)
                        if (newSoId) {
                            setDetailId(newSoId)
                        }
                    }}
                    userId={userId}
                    userRoles={userRoles}
                />
            )}
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
                    <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => setAcctModalId(null)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center text-base font-bold">🏛️</span>
                            Kế Toán Duyệt Đơn
                        </h3>
                        <div className="mb-5">
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                                Pháp Nhân Xuất Hoá Đơn
                            </label>
                            <select
                                value={acctEntityId}
                                onChange={e => setAcctEntityId(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-200 bg-white dark:bg-white text-slate-900 dark:text-slate-900 shadow-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                            >
                                <option value="">— Chưa chọn —</option>
                                {legalEntities.map(e => (
                                    <option key={e.id} value={e.id}>{e.name} ({e.code}) — {e.code === 'TA' ? 'Nhập Khẩu' : 'Phân Phối'}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setAcctModalId(null)}
                                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-200 bg-white dark:bg-white text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                Huỷ
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!acctEntityId) return toast.error('Vui lòng chọn pháp nhân')
                                    setActionLoading(acctModalId)
                                    toast.promise(acctApproveMutation.mutateAsync({ id: acctModalId, legalEntityId: acctEntityId }).then(() => {
                                        setAcctModalId(null)
                                        if (detailId === acctModalId) setDetailId(null)
                                        reload()
                                    }), {
                                        loading: 'Đang duyệt...',
                                        success: 'KT duyệt thành công — chuyển CONFIRMED!',
                                        error: (e: any) => `Lỗi: ${e.message}`,
                                        finally: () => setActionLoading(null),
                                    })
                                }}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-sm cursor-pointer"
                            >
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
        // Load warehouses & auto select default sales warehouse for this legal entity
        Promise.all([
            getSimpleWarehouses(),
            getSalesOrderDetailWithMargin(soId)
        ]).then(([whs, res]) => {
            if (!active) return
            setWarehouses(whs)
            const detailObj = res.detail
            if (detailObj) {
                setDetail(detailObj)

                // Auto select matching default warehouse for this Legal Entity
                const entityWhs = whs.filter((w: any) => !w.legalEntityId || w.legalEntityId === detailObj.legalEntityId)
                const defaultWh = entityWhs.find((w: any) => w.legalEntityId === detailObj.legalEntityId && w.isDefault && w.allowSales !== false)
                    ?? entityWhs.find((w: any) => w.legalEntityId === detailObj.legalEntityId && w.allowSales !== false)
                    ?? entityWhs.find((w: any) => w.allowSales !== false)
                    ?? entityWhs[0]
                if (defaultWh) {
                    setSelectedWarehouseId(defaultWh.id)
                }

                const initialVintages: Record<string, number> = {}
                for (const line of detailObj.lines) {
                    initialVintages[line.id] = (line as any).vintage || 0
                }
                setSelectedVintages(initialVintages)
                
                const productIds = detailObj.lines.map(l => l.productId)
                getAvailableVintagesForProducts(productIds).then(vintagesData => {
                    if (active) {
                        setAvailableVintages(vintagesData)
                        setSelectedVintages(prev => {
                            const updated = { ...prev }
                            for (const line of detailObj.lines) {
                                const avail = vintagesData[line.productId] || []
                                if (avail.length > 0 && !updated[line.id]) {
                                    updated[line.id] = avail[0]
                                }
                            }
                            return updated
                        })
                    }
                })
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
            <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-200 pb-3">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center text-sm font-bold">🍷</span>
                        Duyệt Đơn Hàng & Chỉ Định Vintage
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 size={24} className="animate-spin text-teal-600" />
                        Đang tải thông tin sản phẩm và tồn kho...
                    </div>
                ) : !detail ? (
                    <p className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">Không tìm thấy đơn hàng</p>
                ) : (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Mã đơn: <span className="font-bold text-teal-600 dark:text-teal-400">{detail.soNo}</span> · Khách hàng: <span className="font-semibold text-slate-900 dark:text-white">{detail.customer.name}</span>
                        </p>

                        {/* Warehouse selector */}
                        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-amber-900 dark:text-amber-300">
                                Kho Xuất Bán Hàng * (Pháp nhân: {detail.legalEntity?.name || detail.legalEntity?.code || '—'})
                            </label>
                            <select
                                value={selectedWarehouseId}
                                onChange={e => setSelectedWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-200 bg-white dark:bg-white text-slate-900 dark:text-slate-900 shadow-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none font-medium"
                            >
                                <option value="">— Chọn kho xuất hàng —</option>
                                {warehouses
                                    .filter(w => !detail.legalEntityId || w.legalEntityId === detail.legalEntityId)
                                    .sort((a: any, b: any) => {
                                        if (a.allowSales !== b.allowSales) return a.allowSales ? -1 : 1
                                        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
                                        return a.name.localeCompare(b.name)
                                    })
                                    .map((w: any) => {
                                        const isAllowed = w.allowSales !== false
                                        return (
                                            <option key={w.id} value={w.id} disabled={!isAllowed}>
                                                {isAllowed
                                                    ? `${w.isDefault ? '⭐ [Kho Mặc Định]' : '✔️ [Kho Xuất Bán]'} ${w.code} — ${w.name}`
                                                    : `⛔ [Chỉ Điều Chuyển - Không Xuất Bán] ${w.code} — ${w.name}`
                                                }
                                            </option>
                                        )
                                    })
                                }
                            </select>
                        </div>
                        
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                            {detail.lines.map((line: any) => {
                                const avail = availableVintages[line.productId] || []
                                return (
                                    <div key={line.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white border border-slate-200 dark:border-slate-200 flex flex-col gap-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold truncate text-slate-900 dark:text-white" title={line.product.productName}>
                                                    {line.product.productName}
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                                    SKU: {line.product.skuCode} · Số lượng: {Number(line.qtyOrdered)}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] uppercase font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                Vintage *
                                            </label>
                                            {avail.length > 0 ? (
                                                <select
                                                    value={selectedVintages[line.id] || ''}
                                                    onChange={e => {
                                                        const val = Number(e.target.value)
                                                        setSelectedVintages(prev => ({ ...prev, [line.id]: val }))
                                                    }}
                                                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-200 bg-white dark:bg-slate-50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                >
                                                    <option value="">— Chọn Vintage khả dụng —</option>
                                                    {avail.map(v => (
                                                        <option key={v} value={v}>{v}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700">
                                                    Không Vintage (Sản phẩm không Vintage hoặc Hết tồn kho)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-200">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-200 bg-white dark:bg-white text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Huỷ
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={submitting}
                                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50"
                            >
                                {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                {submitting ? 'Đang duyệt...' : 'Xác Nhận Duyệt Đơn'}
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
