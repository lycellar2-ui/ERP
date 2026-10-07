'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FileText, CheckCircle2, XCircle, Clock, Truck, ReceiptText, DollarSign, Eye, Loader2, X, AlertTriangle, TrendingUp, TrendingDown, Pencil, Copy, Download, Calendar, Printer, FileX2, RotateCcw, AlertCircle, CloudUpload, ShieldCheck, ExternalLink, BarChart3, SlidersHorizontal } from 'lucide-react'
import { Badge, Button, Card, Drawer, EmptyState, Field, FilterPanel, PageHeader, Pagination, SearchInput, Select, StatCard, StatGrid, StatusTabs, Table, TableMessageRow, TableSkeleton, TBody, Td, Th, THead, Toolbar, Tr, useConfirmDialog } from '@/components/ui'
import { getStatusTone, type Tone } from '@/lib/ui/status'
import { toast } from 'sonner'
import { SalesOrderRow, SOStatus, SOType, confirmSalesOrder, cancelSalesOrder, getSalesOrderDetailWithMargin, getSalesOrderDetailWithMarginAndTimeline, SOMarginData, approveSalesOrder, rejectSalesOrder, getSOTimeline, SOTimelineEvent, cloneSalesOrder, exportSalesOrdersExcel, exportMisaSmeExcel, exportVnptInvoiceExcel, accountingApproveSO, accountingRejectSO, getLegalEntities, LegalEntityRow, deleteSalesOrder, getSalesPageData, getAvailableVintagesForProducts, getSimpleWarehouses, getSalesOrderDetail, getCustomersForSO, getProductsWithStock, createARInvoiceForSO, updateARInvoiceNo, deleteARInvoice, SalesChannel, toggleInvoiceExempt, markSalesOrderPaid } from './actions'
import { uploadDraftInvoiceToVnpt, deleteDraftInvoiceFromVnpt, syncVnptInvoiceForOrder } from './actions-vnpt'
import { checkInvoiceDateDiscrepancy } from '@/lib/vnpt/date-utils'
import type { InvoiceDateWarning } from '@/lib/vnpt/types'
import { formatVND, formatDate, formatDateTime } from '@/lib/utils'
import { useAppLocale, type AppLocale } from '@/lib/i18n'
import { SALES_I18N, getSOStatusLabel, getSOChannelLabel } from './i18n'
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

const STATUS_CFG: Record<SOStatus, { label: string; icon: React.FC<any> }> = {
    DRAFT: { label: 'Nháp', icon: FileText },
    PENDING_APPROVAL: { label: 'Chờ Duyệt', icon: Clock },
    PENDING_ACCOUNTING: { label: 'Chờ KT Duyệt', icon: Clock },
    CONFIRMED: { label: 'Đã Xác Nhận', icon: CheckCircle2 },
    PARTIALLY_DELIVERED: { label: 'Giao 1 Phần', icon: Truck },
    DELIVERED: { label: 'Đã Giao', icon: Truck },
    INVOICED: { label: 'Đã Xuất HĐ', icon: ReceiptText },
    PAID: { label: 'Đã Thu Tiền', icon: DollarSign },
    CANCELLED: { label: 'Huỷ', icon: XCircle },
}

/** In the SO flow only PAID is final; DELIVERED is an intermediate business-positive step. */
const SO_TONE_OVERRIDES: Record<string, Tone> = { DELIVERED: 'brand' }

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
            return { background: 'rgba(180,83,9,0.15)', color: '#B45309', border: '1px solid rgba(180,83,9,0.3)' }
        case 'FIXED_PRICE':
            return { background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.25)' }
        case 'FIXED_DISCOUNT':
            return { background: 'rgba(230,138,0,0.15)', color: '#E68A00', border: '1px solid rgba(230,138,0,0.3)' }
        case 'CHANNEL_BASE':
            return { background: 'rgba(21,128,61,0.1)', color: '#15803D', border: '1px solid rgba(21,128,61,0.2)' }
        case 'RETAIL_FALLBACK':
            return { background: 'rgba(138,180,248,0.1)', color: '#8AB4F8', border: '1px solid rgba(138,180,248,0.2)' }
        default:
            return { background: 'rgba(100,116,139,0.1)', color: '#64748B', border: '1px solid rgba(100,116,139,0.2)' }
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
    const { locale } = useAppLocale()
    const cfg = STATUS_CFG[status]
    const Icon = cfg?.icon || FileText
    let label = SALES_I18N[locale]?.statuses?.[status] || cfg?.label || status
    if (status === 'PENDING_APPROVAL') {
        if (approvalStep === 1) {
            label = locale === 'en' ? 'Pending Sales Admin' : 'Chờ Sale Admin duyệt'
        } else if (approvalStep === 2) {
            label = locale === 'en' ? 'Pending CEO' : 'Chờ CEO duyệt'
        } else {
            label = locale === 'en' ? 'Pending Approval' : 'Chờ Duyệt'
        }
    }
    return (
        <Badge tone={getStatusTone(status, SO_TONE_OVERRIDES)} icon={Icon}>
            {label}
        </Badge>
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
    const { locale } = useAppLocale()
    const isEn = locale === 'en'
    switch (status) {
        case 'DELIVERED':
            return <Badge tone="success" icon={Truck}>{isEn ? 'Delivered' : 'Đã Giao'}</Badge>
        case 'PARTIALLY_DELIVERED':
            return (
                <Badge tone="info" icon={Truck}>
                    {isEn ? 'Partially Delivered' : 'Giao 1 phần'} {ordered ? `(${shipped}/${ordered})` : ''}
                </Badge>
            )
        case 'PREPARING':
            return <Badge tone="warning" icon={Clock}>{isEn ? 'Preparing' : 'Đang soạn'}</Badge>
        case 'UNDELIVERED':
        default:
            return <Badge tone="neutral">{isEn ? 'Undelivered' : 'Chưa giao'}</Badge>
    }
}



// ── Quick Filter Tabs ────────────────────────────
const TAB_ORDER: (SOStatus | 'ALL')[] = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'PENDING_ACCOUNTING', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID', 'CANCELLED']
const TAB_LABELS: Record<string, string> = {
    ALL: 'Tất cả', DRAFT: 'Nháp', PENDING_APPROVAL: 'Chờ CEO', PENDING_ACCOUNTING: 'Chờ KT',
    CONFIRMED: 'Đã XN',
    PARTIALLY_DELIVERED: 'Giao 1 phần', DELIVERED: 'Đã Giao', INVOICED: 'Xuất HĐ', PAID: 'Đã TT', CANCELLED: 'Huỷ',
}

function FilterTabs({ active, counts, onChange }: { active: string; counts: Record<string, number>; onChange: (s: SOStatus | '') => void }) {
    const { locale } = useAppLocale()
    const sI18n = SALES_I18N[locale]
    const items = TAB_ORDER.map(tab => ({
        value: tab,
        count: tab === 'ALL' ? counts.ALL ?? 0 : counts[tab] ?? 0,
        label: tab === 'ALL'
            ? sI18n.tabs.all
            : (sI18n.tabs[tab === 'PENDING_APPROVAL' ? 'pendingApproval' : tab === 'PENDING_ACCOUNTING' ? 'pendingAccounting' : tab === 'PARTIALLY_DELIVERED' ? 'delivering' : tab.toLowerCase() as keyof typeof sI18n.tabs] || TAB_LABELS[tab] || tab),
    }))
    return (
        <StatusTabs
            items={items}
            value={(active || 'ALL') as SOStatus | 'ALL'}
            onChange={tab => onChange(tab === 'ALL' ? '' : tab)}
            hideEmpty
        />
    )
}

// ── Sortable Column Header ───────────────────────
function SortHeader({ label, field, current, dir, onSort, style, align, className }: { label: string; field: string; current: string; dir: string; onSort: (f: string) => void; style?: React.CSSProperties; align?: 'left' | 'right' | 'center'; className?: string }) {
    const sort = current === field ? (dir === 'asc' ? 'asc' : 'desc') : false
    return (
        <Th sort={sort} onSort={() => onSort(field)} align={align} style={style} className={className}>
            {label}
        </Th>
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
    const { locale, isEn, formatCurrency, formatDate } = useAppLocale()
    const sI18n = SALES_I18N[locale]
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
    const { confirm: confirmDrawer, dialog: confirmDrawerDialog } = useConfirmDialog()

    const handleToggleExempt = async () => {
        if (!soId || !detail || togglingExempt) return
        if (detail.isInvoiceExempt) {
            confirmDrawer({
                title: isEn ? 'Cancel VAT Exemption' : 'Hủy đánh dấu miễn hóa đơn VAT',
                message: isEn ? 'Are you sure you want to cancel the VAT exemption for this order? Accounting will be able to issue VAT invoices afterwards.' : 'Bạn có chắc chắn muốn hủy đánh dấu miễn hóa đơn? Kế toán sẽ có thể xuất hóa đơn VAT sau khi hủy.',
                confirmLabel: isEn ? 'Cancel Exemption' : 'Hủy miễn hóa đơn',
                onConfirm: async () => {
                    setTogglingExempt(true)
                    try {
                        const res = await toggleInvoiceExempt(soId, false)
                        if (res.success) {
                            toast.success(isEn ? 'VAT exemption cancelled!' : 'Đã hủy miễn hóa đơn VAT cho đơn hàng!')
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
            })
            return
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

    const handleMarkPaid = () => {
        if (!soId || !detail || markingPaid) return
        const totalVatIncluded = Number(detail.totalAmount) + Number(detail.vatAmount ?? 0)
        confirmDrawer({
            title: isEn ? 'Confirm Payment Collection' : 'Xác nhận đã thu tiền',
            message: isEn
                ? `Confirm full payment received (${formatVND(totalVatIncluded)}) for order ${detail.soNo}? Status will change to PAID.`
                : `Xác nhận đã thu đủ tiền (${formatVND(totalVatIncluded)}) cho đơn hàng ${detail.soNo}? Đơn hàng sẽ chuyển sang trạng thái ĐÃ THU TIỀN (PAID).`,
            confirmLabel: isEn ? 'Confirm PAID' : 'Xác nhận ĐÃ THU TIỀN',
            onConfirm: async () => {
                setMarkingPaid(true)
                try {
                    const res = await markSalesOrderPaid(soId)
                    if (res.success) {
                        toast.success(isEn ? 'Payment confirmed!' : 'Đã xác nhận thu tiền cho đơn hàng!')
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
        })
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

    const handleDeleteInvoice = (invId: string, invNo: string) => {
        confirmDrawer({
            title: isEn ? `Remove Invoice ${invNo}` : `Gỡ bỏ hóa đơn ${invNo}`,
            message: isEn
                ? `Are you sure you want to remove invoice ${invNo} from this sales order? Order status will be updated accordingly.`
                : `Bạn có chắc chắn muốn gỡ bỏ hóa đơn ${invNo} khỏi đơn hàng này không? Trạng thái đơn hàng sẽ được hoàn trả lại.`,
            danger: true,
            confirmLabel: isEn ? 'Remove Invoice' : 'Gỡ hóa đơn',
            onConfirm: async () => {
                setDeletingInvoiceId(invId)
                try {
                    const res = await deleteARInvoice(invId)
                    if (res.success) {
                        toast.success(isEn ? `Invoice ${invNo} removed!` : `Đã gỡ bỏ hóa đơn ${invNo} thành công!`)
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
        })
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

    const handleDeleteVnptDraft = () => {
        if (!soId || !detail || deletingVnpt) return
        confirmDrawer({
            title: isEn ? 'Delete VNPT Draft' : 'Xóa bản nháp hóa đơn VNPT',
            message: isEn
                ? 'Are you sure you want to delete this draft invoice from VNPT system?'
                : 'Bạn có chắc chắn muốn xóa bản nháp hóa đơn này trên hệ thống VNPT không?',
            danger: true,
            confirmLabel: isEn ? 'Delete Draft' : 'Xóa bản nháp VNPT',
            onConfirm: async () => {
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
                        toast.error(res.error || 'Lỗi khi xóa bản nháp trên VNPT')
                    }
                } catch (err: any) {
                    toast.error(err.message || 'Lỗi kết nối máy chủ VNPT')
                } finally {
                    setDeletingVnpt(false)
                }
            }
        })
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
        CREATE: '•', UPDATE: '•', CONFIRM: '•', APPROVE: '•', REJECT: '•',
        STATUS_CHANGE: '•', DELETE: '•', EXPORT: '•', SIGN: '•',
    }

    return (
        <>
            <Drawer
                open
                onClose={onClose}
                size="lg"
                className="bg-lys-bg"
                title={loading ? (isEn ? 'Order Details' : 'Chi Tiết Đơn Hàng') : `SO: ${detail?.soNo}`}
                headerExtra={detail && <StatusBadge status={detail.status as SOStatus} approvalStep={(detail as any).approvalStep} />}
                description={detail ? `${detail.customer.name} · ${detail.paymentTerm}` : undefined}
                actions={detail && (
                    <>
                        {detail.status === 'PENDING_ACCOUNTING' && canAcctApprove && (
                            <>
                                <Button size="sm" onClick={() => onAcctApprove?.(soId, detail.legalEntityId)}>
                                    <CheckCircle2 size={13} /> {isEn ? 'Acct Approve' : 'KT Duyệt'}
                                </Button>
                                <Button size="sm" variant="danger-outline" onClick={() => onAcctReject?.(soId)}>
                                    <XCircle size={13} /> {isEn ? 'Return' : 'Trả Về'}
                                </Button>
                            </>
                        )}
                        {detail.status === 'PENDING_APPROVAL' && canApprove && (
                            <>
                                <Button size="sm" onClick={() => onApprove?.(soId)}>
                                    <CheckCircle2 size={13} /> {isEn ? 'Approve Order' : 'Duyệt Đơn'}
                                </Button>
                                <Button size="sm" variant="danger-outline" onClick={() => onReject?.(soId)}>
                                    <XCircle size={13} /> {isEn ? 'Reject' : 'Từ Chối'}
                                </Button>
                            </>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => window.open(`/dashboard/sales/print?id=${soId}`, '_blank')}
                            title={isEn ? 'Print order' : 'In ấn đơn hàng'}>
                            <Printer size={12} /> {isEn ? 'Print' : 'In Đơn'}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => onClone(soId)} title={isEn ? 'Clone order' : 'Tạo đơn tương tự'}>
                            <Copy size={12} /> Clone
                        </Button>
                    </>
                )}
            >
                {loading ? (
                    <SODetailSkeleton />
                ) : !detail ? (
                    <EmptyState icon={FileText} title={isEn ? 'Order not found' : 'Không tìm thấy đơn'} />
                ) : (
                    <div className="space-y-6">
                        
                        {/* 1. WARNING BANNER & PROGRESS STATUS */}
                        {marginData?.hasNegativeMargin && canSeeMargin && (
                            <div className="flex items-center gap-3 px-4 py-3 rounded-md border bg-tone-danger-bg border-tone-danger-border">
                                <AlertTriangle size={18} className="text-tone-danger-fg shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-tone-danger-fg">{isEn ? 'Negative Margin Warning' : 'Cảnh Báo Biên Âm'}</p>
                                    <p className="text-xs mt-0.5 text-tone-danger-fg">{isEn ? 'One or more lines have selling price below cost price!' : 'Một hoặc nhiều dòng có giá bán thấp hơn giá vốn!'}</p>
                                </div>
                            </div>
                        )}

                        {/* Tiến Trình Đơn Hàng */}
                        <div className="py-3 px-4 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <div className="flex items-center justify-between text-xs mb-4">
                                <span className="font-bold uppercase tracking-wider text-[10px]" style={{ color: '#64748B' }}>{isEn ? 'Order Progress' : 'Tiến Trình Đơn Hàng'}</span>
                                <StatusBadge status={detail.status as SOStatus} approvalStep={(detail as any).approvalStep} />
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
                                                    background: '#15803D' 
                                                }} 
                                            />
                                        )
                                    })()}
                                </div>
                                
                                <div className="flex justify-between items-start relative z-10 w-full">
                                    {(() => {
                                        const steps = [
                                            { s: 'DRAFT', label: sI18n.timelineSteps.DRAFT },
                                            { s: 'PENDING_ACCOUNTING', label: sI18n.timelineSteps.PENDING_ACCOUNTING },
                                            { s: 'CONFIRMED', label: sI18n.timelineSteps.CONFIRMED },
                                            { s: 'DELIVERED', label: sI18n.timelineSteps.DELIVERED },
                                            { s: 'INVOICED', label: detail.isInvoiceExempt ? (isEn ? 'Invoice Exempt' : 'Miễn HĐ') : sI18n.timelineSteps.INVOICED },
                                            { s: 'PAID', label: sI18n.timelineSteps.PAID }
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
                                                            boxShadow: isCurrent ? '0 0 8px rgba(8,145,178,0.4)' : 'none',
                                                            boxSizing: 'border-box'
                                                        }}>
                                                        {isDone ? '✓' : i + 1}
                                                    </div>
                                                    
                                                    {/* Nhãn bước */}
                                                    <span className="text-[10px] font-bold mt-2 whitespace-nowrap block" 
                                                        style={{ color: isCurrent ? '#0E7490' : isDone ? '#0F172A' : '#64748B' }}>
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
                                <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>
                                    {isEn ? 'General Information' : 'Thông tin chung'}
                                </h4>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-1 border-b border-slate-200/20">
                                        <span style={{ color: '#64748B' }}>{isEn ? 'Customer:' : 'Khách hàng:'}</span>
                                        <span className="font-semibold text-right" style={{ color: '#0F172A' }}>{detail.customer.name}</span>
                                    </div>
                                    {detail.orderType === 'TASTING' && (
                                        <div className="flex justify-between py-1.5 px-2.5 rounded-lg border border-amber-300 bg-amber-50 text-xs">
                                            <span className="font-bold text-amber-800">{isEn ? 'Order Type:' : 'Loại Đơn Hàng:'}</span>
                                            <span className="font-extrabold text-amber-900">{isEn ? 'Tasting Order' : 'Đơn Hàng Tasting'}</span>
                                        </div>
                                    )}
                                    {detail.proposal && (
                                        <div className="flex justify-between py-1.5 px-2.5 rounded-lg border border-amber-300 bg-amber-50 text-xs mt-1">
                                            <span className="font-bold text-amber-800">{isEn ? 'Proposal No:' : 'Số Tờ Trình:'}</span>
                                            <span className="font-extrabold text-amber-900 font-mono">[{detail.proposal.proposalNo}] {detail.proposal.title}</span>
                                        </div>
                                    )}
                                    {detail.customer.parent && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/20">
                                            <span style={{ color: '#64748B' }}>{isEn ? 'Parent Customer:' : 'Khách hàng cha:'}</span>
                                            <span className="font-semibold text-right" style={{ color: '#0F172A' }}>{detail.customer.parent.name}</span>
                                        </div>
                                    )}
                                    {(detail.customer.taxId || (detail.customer as any).parent?.taxId) && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/20">
                                            <span style={{ color: '#64748B' }}>{isEn ? 'Tax ID:' : 'MST:'}</span>
                                            <span className="font-semibold font-mono" style={{ color: '#475569' }}>
                                                {detail.customer.taxId ? (
                                                    detail.customer.taxId
                                                ) : (
                                                    <span>{(detail.customer as any).parent.taxId} <span className="text-[10px] text-amber-700 font-sans font-normal">{isEn ? '(Parent Co.)' : '(Cty Cha)'}</span></span>
                                                )}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between py-1 border-b border-slate-200/20">
                                        <span style={{ color: '#64748B' }}>{isEn ? 'Customer Code / Channel:' : 'Mã KH / Kênh:'}</span>
                                        <span className="font-semibold" style={{ color: '#475569' }}>{detail.customer.code} ({getSOChannelLabel(detail.channel, locale, false)})</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/20">
                                        <span style={{ color: '#64748B' }}>{isEn ? 'Sales Rep:' : 'Nhân viên Sales:'}</span>
                                        <span className="font-semibold" style={{ color: '#0F172A' }}>{detail.salesRep.name}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/20">
                                        <span style={{ color: '#64748B' }}>{isEn ? 'Receiver Phone:' : 'SĐT nhận hàng:'}</span>
                                        <span className="font-semibold font-mono" style={{ color: '#0891B2' }}>
                                            {(detail.customer as any).receiverPhone || (detail.customer as any).purchasingPhone || (detail.customer as any).contacts?.find((c: any) => c.isPrimary)?.phone || '—'}
                                            {(detail.customer as any).receiverName && (detail.customer as any).receiverName !== detail.customer.name && (
                                                <span className="text-[10px] ml-1 text-slate-600">({(detail.customer as any).receiverName})</span>
                                            )}
                                        </span>
                                    </div>
                                    {detail.shippingAddress && (
                                        <div className="flex justify-between py-1 border-b border-slate-200/20">
                                            <span style={{ color: '#64748B' }} className="shrink-0">{isEn ? 'Delivery Address:' : 'Địa chỉ giao:'}</span>
                                            <span className="font-medium text-right text-slate-900 text-[11px] ml-2">
                                                {[detail.shippingAddress.address, detail.shippingAddress.ward, detail.shippingAddress.district, detail.shippingAddress.city].filter(Boolean).join(', ')}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between py-1 border-b border-slate-200/20">
                                        <span style={{ color: '#64748B' }}>{isEn ? 'Payment Terms:' : 'Kỳ hạn thanh toán:'}</span>
                                        <span className="font-semibold" style={{ color: '#B45309' }}>{detail.paymentTerm}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-slate-200/20">
                                        <span style={{ color: '#64748B' }}>{isEn ? 'Order Date:' : 'Ngày tạo đơn:'}</span>
                                        <span className="font-semibold" style={{ color: '#475569' }}>{formatDate(detail.createdAt)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Financial summary */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>
                                    {isEn ? 'Financial Metrics' : 'Chỉ số tài chính'}
                                </h4>
                                {canSeeMargin && !marginData ? (
                                    <div className="py-6 rounded-lg flex flex-col items-center justify-center gap-2 border border-slate-200/30 bg-white/40">
                                        <Loader2 size={16} className="animate-spin text-[#0891B2]" />
                                        <span className="text-[11px]" style={{ color: '#64748B' }}>{isEn ? 'Calculating profit margins...' : 'Đang tính toán tỷ suất lợi nhuận...'}</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between py-1 border-b border-slate-200/20">
                                            <span style={{ color: '#64748B' }}>{isEn ? 'Subtotal (After Discount):' : 'Tổng tiền trước thuế (Sau CK):'}</span>
                                            <span className="font-bold font-mono text-sm" style={{ color: '#0F172A' }}>{formatCurrency(Number(detail.totalAmount))}</span>
                                        </div>
                                        {detailVatBreakdown.length > 1 ? (
                                            <>
                                                {detailVatBreakdown.map((vb: { rate: number; amount: number }) => (
                                                    <div key={vb.rate} className="flex justify-between py-0.5 pl-2 text-[11px]" style={{ color: '#475569' }}>
                                                        <span>{isEn ? `↳ VAT (${vb.rate}%):` : `↳ Thuế GTGT (${vb.rate}%):`}</span>
                                                        <span className="font-mono">{formatCurrency(vb.amount)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between py-1 border-b border-slate-200/20">
                                                    <span style={{ color: '#64748B' }}>{isEn ? 'Total VAT:' : 'Tổng tiền thuế VAT:'}</span>
                                                    <span className="font-bold font-mono" style={{ color: '#475569' }}>{formatCurrency(Number(detail.vatAmount ?? 0))}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex justify-between py-1 border-b border-slate-200/20">
                                                <span style={{ color: '#64748B' }}>{isEn ? `VAT (${detailVatBreakdown[0]?.rate ?? (detail as any).vatRate ?? 10}%):` : `Tiền thuế VAT (${detailVatBreakdown[0]?.rate ?? (detail as any).vatRate ?? 10}%):`}</span>
                                                <span className="font-bold font-mono" style={{ color: '#475569' }}>{formatCurrency(Number(detail.vatAmount ?? 0))}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between py-1 border-b border-slate-200/20">
                                            <span style={{ color: '#64748B' }}>{isEn ? 'Grand Total (Incl. VAT):' : 'Tổng thanh toán (Có VAT):'}</span>
                                            <span className="font-bold font-mono text-sm text-[#0891B2]">{formatCurrency(Number(detail.totalAmount) + Number(detail.vatAmount ?? 0))}</span>
                                        </div>
                                        {detail.isInvoiceExempt && (
                                            <div className="p-2.5 rounded bg-amber-50 border border-amber-300 text-[11px] text-amber-800 mt-2 flex items-start gap-2">
                                                <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                                                <div className="leading-snug">
                                                    <span className="font-bold block text-amber-900 mb-0.5">{isEn ? 'Order exempt from VAT invoice' : 'Đơn hàng không xuất HĐ VAT'}</span>
                                                    {isEn ? 'Selling price and grand total remain unchanged and include 100% VAT per regulations.' : 'Giá bán và tổng thanh toán vẫn giữ nguyên và tính đủ 100% thuế VAT theo đúng yêu cầu.'}
                                                </div>
                                            </div>
                                        )}
                                        {marginData && canSeeMargin ? (
                                            <>
                                                <div className="flex justify-between py-1 border-b border-slate-200/20">
                                                    <span style={{ color: '#64748B' }}>{isEn ? 'Net Revenue (Excl. VAT):' : 'Doanh thu Net (trước VAT):'}</span>
                                                    <span className="font-bold font-mono" style={{ color: '#0891B2' }}>{formatCurrency(marginData.totalRevenue)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-200/20">
                                                    <span style={{ color: '#64748B' }}>{isEn ? 'Total Cost (COGS):' : 'Tổng giá vốn (COGS):'}</span>
                                                    <span className="font-bold font-mono" style={{ color: '#B45309' }}>{formatCurrency(marginData.totalCOGS)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-200/20">
                                                    <span style={{ color: '#64748B' }}>{isEn ? 'Gross Profit:' : 'Lợi nhuận gộp:'}</span>
                                                    <span className={`font-bold font-mono ${marginData.totalMargin >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>
                                                        {marginData.totalMargin >= 0 ? '' : '-'}{formatCurrency(Math.abs(marginData.totalMargin))}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-slate-200/20">
                                                    <span style={{ color: '#64748B' }}>{isEn ? 'Gross Margin %:' : 'Biên lợi nhuận gộp:'}</span>
                                                    <span className="font-semibold flex items-center gap-1" style={{ color: marginData.totalMarginPct >= 20 ? '#15803D' : marginData.totalMarginPct >= 0 ? '#B45309' : '#B91C1C' }}>
                                                        {marginData.totalMarginPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                                        {marginData.totalMarginPct.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </>
                                        ) : !canSeeMargin ? (
                                            <div className="py-3 px-3 rounded text-[11px] leading-relaxed bg-white/40 border border-slate-200/30" style={{ color: '#64748B' }}>
                                                {isEn ? 'Profit margin details hidden for Sales Rep / Sales Assistant accounts.' : 'Chi tiết biên lợi nhuận bị ẩn đối với tài khoản Nhân viên Sales / Trợ lý Sales.'}
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
                                    {isEn ? 'Order Notes / Remarks' : 'Ghi Chú / Diễn Giải Đơn Hàng'}
                                </span>
                                <p className="text-slate-900 leading-relaxed whitespace-pre-wrap">{detail.notes}</p>
                            </div>
                        )}

                        {/* 3. PRODUCTS LIST */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: '#64748B' }}>
                                {isEn ? `Ordered Items (${detail.lines.length} lines)` : `Sản Phẩm Trong Đơn Hàng (${detail.lines.length} dòng)`}
                            </p>
                            
                            {/* Desktop Table View */}
                            <div className="hidden md:block rounded-md overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: 640 }}>
                                        <thead><tr style={{ background: '#FFFFFF' }}>
                                            {(canSeeMargin 
                                                ? (isEn ? ['SKU / Product Name', 'Qty', 'Unit Price', 'Price Source', 'Line Total', 'COGS', 'Profit', 'Margin %'] : ['SKU / Tên Sản Phẩm', 'SL', 'Giá Bán', 'Nguồn Giá', 'Thành Tiền', 'Giá Vốn', 'Lãi Gộp', 'Biên %']) 
                                                : (isEn ? ['SKU / Product Name', 'Qty', 'Unit Price', 'Price Source', 'Line Total'] : ['SKU / Tên Sản Phẩm', 'SL', 'Giá Bán', 'Nguồn Giá', 'Thành Tiền'])
                                            ).map(h => (
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
                                                <tr key={ml.lineId} style={{ borderTop: '1px solid #E2E8F0', background: ml.isNegative ? 'rgba(185,28,28,0.06)' : 'transparent' }}>
                                                    <td className="px-2.5 py-2">
                                                        <div className="font-semibold text-[#0891B2] font-mono flex items-center gap-1.5">
                                                            {custCode && (
                                                                <span className="text-amber-700 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40 text-[10px] font-bold">
                                                                    [{custCode}]
                                                                </span>
                                                            )}
                                                            {ml.skuCode}
                                                        </div>
                                                        <div className="text-[10px] text-slate-600 mt-0.5 max-w-[200px] truncate" title={ml.productName}>{ml.productName}</div>
                                                    </td>
                                                    <td className="px-2.5 py-2 text-right" style={{ color: '#0F172A' }}>{ml.qty}</td>
                                                    <td className="px-2.5 py-2 text-right" style={{ color: '#475569' }}>{formatCurrency(ml.unitPrice)}</td>
                                                    <td className="px-2.5 py-2">
                                                        {ml.priceSource ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                                                style={getPriceBadgeStyle(ml.priceSource)}>
                                                                {getPriceBadgeLabel(ml.priceSource)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px]" style={{ color: '#64748B' }}>{isEn ? 'Default' : 'Mặc định'}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-2 text-right font-bold" style={{ color: '#0891B2' }}>{formatCurrency(ml.revenue)}</td>
                                                    {canSeeMargin && (
                                                        <td className="px-2.5 py-2 text-right" style={{ color: '#B45309' }}>
                                                            {ml.avgCost > 0 ? formatCurrency(ml.avgCost) : <span style={{ color: '#94A3B8' }}>—</span>}
                                                        </td>
                                                    )}
                                                    {canSeeMargin && (
                                                        <td className="px-2.5 py-2 text-right font-bold" style={{ color: ml.margin > 0 ? '#15803D' : ml.margin < 0 ? '#B91C1C' : '#64748B' }}>
                                                            {ml.avgCost > 0 ? (ml.margin >= 0 ? '' : '-') + formatCurrency(Math.abs(ml.margin)) : '—'}
                                                        </td>
                                                    )}
                                                    {canSeeMargin && (
                                                        <td className="px-2.5 py-2 text-right">
                                                            {ml.avgCost > 0 ? (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{
                                                                    background: ml.marginPct >= 20 ? 'rgba(21,128,61,0.15)' : ml.marginPct >= 0 ? 'rgba(180,83,9,0.15)' : 'rgba(185,28,28,0.15)',
                                                                    color: ml.marginPct >= 20 ? '#15803D' : ml.marginPct >= 0 ? '#B45309' : '#B91C1C',
                                                                }}>
                                                                    {ml.marginPct >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                                                    {ml.marginPct.toFixed(1)}%
                                                                </span>
                                                            ) : <span style={{ color: '#94A3B8' }}>—</span>}
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
                                        style={{ background: '#FFFFFF', border: `1px solid ${ml.isNegative ? 'rgba(185,28,28,0.35)' : '#E2E8F0'}` }}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-[#0891B2] font-mono flex items-center gap-1.5">
                                                    {custCode && (
                                                        <span className="text-amber-700 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40 text-[10px] font-bold">
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
                                                <p className="text-[10px]" style={{ color: '#64748B' }}>{isEn ? 'Quantity' : 'Số Lượng'}</p>
                                                <p className="font-bold font-mono text-slate-900 mt-0.5">{ml.qty}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px]" style={{ color: '#64748B' }}>{isEn ? 'Unit Price' : 'Đơn Giá'}</p>
                                                <p className="font-semibold font-mono text-slate-900 mt-0.5">{formatCurrency(ml.unitPrice)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px]" style={{ color: '#64748B' }}>{isEn ? 'Line Total' : 'Thành Tiền'}</p>
                                                <p className="font-bold font-mono text-[#0891B2] mt-0.5">{formatCurrency(ml.revenue)}</p>
                                            </div>
                                        </div>

                                        {canSeeMargin && ml.avgCost > 0 && (
                                            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/20 text-xs">
                                                <div>
                                                    <p className="text-[10px]" style={{ color: '#64748B' }}>{isEn ? 'Unit Cost' : 'Giá Vốn'}</p>
                                                    <p className="font-semibold font-mono text-[#B45309] mt-0.5">{formatCurrency(ml.avgCost)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px]" style={{ color: '#64748B' }}>{isEn ? 'Profit' : 'Lãi Gộp'}</p>
                                                    <p className="font-bold font-mono mt-0.5" style={{ color: ml.margin >= 0 ? '#15803D' : '#B91C1C' }}>
                                                        {ml.margin >= 0 ? '' : '-'}{formatCurrency(Math.abs(ml.margin))}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px]" style={{ color: '#64748B' }}>{isEn ? 'Margin %' : 'Biên %'}</p>
                                                    <p className="font-bold font-mono mt-0.5" style={{ color: ml.marginPct >= 20 ? '#15803D' : ml.marginPct >= 0 ? '#B45309' : '#B91C1C' }}>
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
                                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>
                                    {isEn ? 'Delivery Orders (DO)' : 'Lệnh Giao Hàng (DO)'}
                                </p>
                                {detail.deliveryOrders.length === 0 ? (
                                    <p className="text-xs py-4 text-center" style={{ color: '#64748B' }}>
                                        {isEn ? 'No delivery orders yet' : 'Chưa có lệnh giao hàng'}
                                    </p>
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
                                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>
                                            {isEn ? 'AR Invoices' : 'Hóa Đơn Công Nợ (AR)'}
                                        </p>
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
                                                className="text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all border border-sky-500/40 text-sky-700 hover:bg-sky-500/10 shadow-xs cursor-pointer"
                                                title={isEn ? 'Accounting & Admin only: Cancel exemption to allow VAT invoice issuance' : 'Chỉ Kế toán & Admin: Hủy miễn HĐ để cho phép xuất hóa đơn VAT'}
                                            >
                                                {togglingExempt ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                                {isEn ? 'Cancel Exemption' : 'Hủy miễn HĐ'}
                                            </button>
                                        )}
                                        {!detail.isInvoiceExempt && detail.arInvoices.length > 0 && canCreateInvoice && (
                                            <button
                                                onClick={handleCreateInvoice}
                                                disabled={creatingInvoice}
                                                className="text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all border border-[#0E7490]/40 text-[#0891B2] hover:bg-[#0E7490]/10 shadow-xs cursor-pointer disabled:opacity-50"
                                                title={isEn ? 'Attach additional VAT invoice number to this order' : 'Gắn thêm mã hóa đơn VAT cho đơn hàng này'}
                                            >
                                                {creatingInvoice ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                                                {isEn ? '+ Add Invoice' : '+ Thêm HĐ'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {detail.isInvoiceExempt ? (
                                    <div className="p-3.5 rounded-md bg-amber-500/10 border border-amber-500/30">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                                                <FileX2 size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-amber-900">
                                                        {isEn ? 'Order Exempt from VAT Invoice' : 'Đơn Hàng Không Xuất Hóa Đơn VAT'}
                                                    </span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                        {isEn ? 'Exemption Approved' : 'Đã duyệt miễn HĐ'}
                                                    </span>
                                                </div>
                                                <p className="text-xs mt-1 text-slate-900">
                                                    <span className="text-slate-600">{isEn ? 'Reason: ' : 'Lý do: '}</span>
                                                    {detail.invoiceExemptReason || (isEn ? 'Customer did not request VAT invoice' : 'Khách không lấy hóa đơn VAT')}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
                                                    {detail.invoiceExemptBy && (
                                                        <span>{isEn ? 'Approved by: ' : 'Người duyệt: '}<strong className="text-slate-600">{detail.invoiceExemptBy}</strong></span>
                                                    )}
                                                    {detail.invoiceExemptAt && (
                                                        <span>{isEn ? 'Time: ' : 'Thời gian: '}<strong className="text-slate-600">{formatDateTime(detail.invoiceExemptAt)}</strong></span>
                                                    )}
                                                </div>
                                                {detail.status === 'DELIVERED' && canToggleInvoiceExempt && (
                                                    <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-between">
                                                        <span className="text-[11px] text-amber-800 font-medium">
                                                            {isEn ? 'Order delivered successfully. Accounting/Admin can confirm payment collection.' : 'Đơn hàng đã giao thành công. Kế toán/Admin có thể xác nhận thu tiền.'}
                                                        </span>
                                                        <button
                                                            onClick={handleMarkPaid}
                                                            disabled={markingPaid}
                                                            className="text-xs px-3 py-1.5 rounded font-bold flex items-center gap-1.5 bg-[#15803D] hover:bg-[#4d9377] text-white shadow-sm transition-all cursor-pointer"
                                                        >
                                                            {markingPaid ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={12} />}
                                                            {isEn ? 'Confirm Payment (PAID)' : 'Xác Nhận Thu Tiền (PAID)'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : detail.arInvoices.length === 0 ? (
                                    <div className="py-5 px-4 rounded-lg text-center" style={{ background: '#F8FAFC', border: '1px dashed #E2E8F0' }}>
                                        <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-700 flex items-center justify-center mx-auto mb-2">
                                            <ReceiptText size={18} />
                                        </div>
                                        <h5 className="text-xs font-bold text-slate-900 mb-0.5">
                                            {isEn ? 'No invoice issued for this order yet' : 'Chưa xuất hóa đơn cho đơn hàng này'}
                                        </h5>
                                        <p className="text-[11px] text-slate-600 max-w-sm mx-auto mb-3.5">
                                            {isEn ? 'You can issue electronic invoices automatically via VNPT or manually attach invoice numbers.' : 'Bạn có thể phát hành hóa đơn điện tử tự động qua VNPT hoặc gắn số hóa đơn thủ công.'}
                                        </p>
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            {canCreateInvoice && (
                                                <button
                                                    onClick={triggerUploadVnptDraft}
                                                    disabled={uploadingVnpt}
                                                    className="text-xs px-3.5 py-1.5 rounded-md font-bold inline-flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer text-white bg-[#2563EB] hover:bg-[#1D4ED8]"
                                                    title={isEn ? 'Upload draft invoice to VNPT e-Invoice portal (Decree 123/70)' : 'Đẩy dữ liệu hóa đơn nháp lên cổng VNPT e-Invoice (TT78/NĐ70)'}
                                                >
                                                    {uploadingVnpt ? <Loader2 size={13} className="animate-spin" /> : <CloudUpload size={13} />}
                                                    {isEn ? 'Upload Draft to VNPT' : 'Đẩy Nháp Lên VNPT'}
                                                </button>
                                            )}
                                            {canCreateInvoice && (
                                                <button
                                                    onClick={handleCreateInvoice}
                                                    disabled={creatingInvoice}
                                                    className="text-xs px-3 py-1.5 rounded-md font-semibold inline-flex items-center gap-1.5 transition-all border border-[#0E7490]/40 text-[#0891B2] bg-[#0E7490]/10 hover:bg-[#0E7490]/20 shadow-xs cursor-pointer disabled:opacity-50"
                                                    title={isEn ? 'Attach invoice number issued from other software (MISA, Viettel, etc.)' : 'Gắn số hóa đơn VAT xuất từ hệ thống khác (MISA, Viettel, v.v.)'}
                                                >
                                                    {creatingInvoice ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                                                    {isEn ? 'Attach Manual Invoice' : 'Gắn HĐ Thủ Công'}
                                                </button>
                                            )}
                                            {canToggleInvoiceExempt && (
                                                <button
                                                    onClick={handleToggleExempt}
                                                    disabled={togglingExempt}
                                                    className="text-xs px-2.5 py-1.5 rounded-md font-medium inline-flex items-center gap-1 transition-all text-amber-700 hover:text-amber-800 hover:bg-amber-50 cursor-pointer disabled:opacity-50"
                                                    title={isEn ? 'Accounting & Admin only: Mark this order as exempt from VAT invoice' : 'Chỉ Kế toán & Admin: Đánh dấu đơn hàng này không cần xuất hóa đơn VAT'}
                                                >
                                                    {togglingExempt ? <Loader2 size={12} className="animate-spin" /> : <FileX2 size={12} />}
                                                    {isEn ? 'Exempt Invoice' : 'Không xuất HĐ'}
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
                                                        background: isDraftVnpt ? 'rgba(37,99,235,0.08)' : isVnptPublished ? 'rgba(21,128,61,0.06)' : '#FFFFFF',
                                                        border: isDraftVnpt ? '1px solid rgba(59,130,246,0.4)' : isVnptPublished ? '1px solid rgba(21,128,61,0.35)' : '1px solid #E2E8F0',
                                                    }}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`text-xs font-bold font-mono truncate ${isDraftVnpt ? 'text-blue-700' : isVnptPublished ? 'text-emerald-700' : 'text-[#0891B2]'}`}>
                                                                    {inv.invoiceNo}
                                                                </span>
                                                                {isDraftVnpt ? (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                                                                        <CloudUpload size={10} />
                                                                        {isEn ? 'VNPT Draft' : 'Nháp VNPT'}
                                                                    </span>
                                                                ) : isVnptPublished ? (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                                                        <ShieldCheck size={10} />
                                                                        {isEn ? 'VNPT Signed' : 'VNPT Đã Ký Số'}
                                                                    </span>
                                                                ) : (
                                                                    canCreateInvoice && (
                                                                        <button
                                                                            onClick={() => handleEditInvoice(inv.id, inv.invoiceNo)}
                                                                            disabled={editingInvoiceId === inv.id || deletingInvoiceId === inv.id}
                                                                            className="p-1 rounded text-slate-600 hover:text-[#0891B2] hover:bg-slate-100 transition-colors"
                                                                            title={isEn ? 'Edit invoice number' : 'Chỉnh sửa mã số hóa đơn'}
                                                                        >
                                                                            {editingInvoiceId === inv.id ? <Loader2 size={11} className="animate-spin" /> : <Pencil size={11} />}
                                                                        </button>
                                                                    )
                                                                )}
                                                                {canCreateInvoice && inv.status !== 'PAID' && (
                                                                    <button
                                                                        onClick={() => isDraftVnpt ? handleDeleteVnptDraft() : handleDeleteInvoice(inv.id, inv.invoiceNo)}
                                                                        disabled={editingInvoiceId === inv.id || deletingInvoiceId === inv.id || deletingVnpt}
                                                                        className="p-1 rounded text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                                                        title={isDraftVnpt ? (isEn ? 'Delete draft on VNPT portal' : 'Xóa bản nháp trên cổng VNPT') : (isEn ? 'Remove invoice' : 'Gỡ bỏ hóa đơn')}
                                                                    >
                                                                        {(deletingInvoiceId === inv.id || (isDraftVnpt && deletingVnpt)) ? (
                                                                            <Loader2 size={11} className="animate-spin text-red-600" />
                                                                        ) : (
                                                                            <X size={11} />
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] mt-1 text-slate-600">
                                                                {isDraftVnpt
                                                                    ? (isEn ? 'Uploaded to VNPT e-Invoice. After signing on VNPT Portal, click "Fetch Invoice No." below.' : 'Đã tải lên VNPT e-Invoice. Sau khi ký số trên Portal VNPT, bấm "Kéo Số HĐ" bên dưới.')
                                                                    : isVnptPublished && vnptMeta?.taxAuthorityCode
                                                                    ? `${isEn ? 'Tax Auth Code' : 'Mã CQT'}: ${vnptMeta.taxAuthorityCode}`
                                                                    : `${isEn ? 'Due Date' : 'Hạn thanh toán'}: ${formatDate(inv.dueDate)}`}
                                                            </p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <span className="text-xs font-bold font-mono block" style={{ color: '#0F172A' }}>
                                                                {formatCurrency(Number(inv.amount))}
                                                            </span>
                                                            <Badge
                                                                className="mt-0.5"
                                                                tone={isDraftVnpt ? 'info' : isVnptPublished ? 'success' : getStatusTone(inv.status)}
                                                            >
                                                                {isDraftVnpt ? (isEn ? 'AWAITING SIGNATURE' : 'CHỜ KÝ SỐ') : isVnptPublished ? (isEn ? 'PUBLISHED' : 'ĐÃ PHÁT HÀNH') : (INVOICE_STATUS_LABELS[inv.status] ?? inv.status)}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    {isDraftVnpt && (
                                                        <div className="mt-2.5 pt-2 border-t border-blue-200 flex flex-wrap items-center justify-between gap-2">
                                                            <span className="text-[10px] text-slate-600">
                                                                FKey: <code className="font-mono text-blue-700 font-bold">SO_{detail.soNo.replace(/[^A-Za-z0-9_-]/g, '_')}</code>
                                                            </span>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {canCreateInvoice && (
                                                                    <button
                                                                        onClick={handleSyncVnptInvoice}
                                                                        disabled={syncingVnpt}
                                                                        className="text-[11px] px-2.5 py-1 rounded font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                                        title={isEn ? 'Check signature status on VNPT and pull official invoice number into ERP' : 'Kiểm tra trạng thái ký số trên VNPT và kéo số hóa đơn chính thức về ERP'}
                                                                    >
                                                                        {syncingVnpt ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                                                                        {isEn ? 'Fetch Invoice No.' : 'Kéo Số HĐ Từ VNPT'}
                                                                    </button>
                                                                )}
                                                                {canCreateInvoice && (
                                                                    <button
                                                                        onClick={triggerUploadVnptDraft}
                                                                        disabled={uploadingVnpt}
                                                                        className="text-[10px] px-2 py-1 rounded font-semibold text-blue-700 hover:bg-blue-50 border border-blue-200 transition-all flex items-center gap-1 cursor-pointer"
                                                                        title={isEn ? 'Update draft invoice with latest changes to VNPT' : 'Cập nhật lại thông tin mới nhất lên bản nháp VNPT'}
                                                                    >
                                                                        {uploadingVnpt ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                                                                        {isEn ? 'Re-sync' : 'Đồng Bộ Lại'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {isVnptPublished && vnptMeta && (
                                                        <div className="mt-2.5 pt-2 border-t border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2 text-[10px] text-slate-600">
                                                                <span>{isEn ? 'Pattern' : 'Ký hiệu'}: <code className="font-mono text-emerald-800 font-bold">{vnptMeta.pattern} / {vnptMeta.serial}</code></span>
                                                                {vnptMeta.syncedAt && <span>• {formatDateTime(vnptMeta.syncedAt)}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {vnptMeta.pdfUrl && (
                                                                    <a
                                                                        href={vnptMeta.pdfUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="text-[10px] px-2 py-1 rounded font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 transition-all flex items-center gap-1 cursor-pointer"
                                                                        title={isEn ? 'Download/View electronic invoice PDF from VNPT' : 'Tải / Xem file PDF hóa đơn điện tử có chữ ký số từ VNPT'}
                                                                    >
                                                                        <Download size={10} />
                                                                        {isEn ? 'Download PDF' : 'Tải PDF'}
                                                                    </a>
                                                                )}
                                                                {vnptMeta.viewUrl && (
                                                                    <a
                                                                        href={vnptMeta.viewUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="text-[10px] px-2 py-1 rounded font-semibold text-blue-700 hover:bg-blue-50 border border-blue-300 transition-all flex items-center gap-1 cursor-pointer"
                                                                        title={isEn ? 'View invoice on VNPT portal' : 'Xem hóa đơn trực tuyến trên portal VNPT'}
                                                                    >
                                                                        <ExternalLink size={10} />
                                                                        Portal
                                                                    </a>
                                                                )}
                                                                {canCreateInvoice && (
                                                                    <button
                                                                        onClick={handleSyncVnptInvoice}
                                                                        disabled={syncingVnpt}
                                                                        className="text-[10px] px-1.5 py-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center gap-1 cursor-pointer"
                                                                        title={isEn ? 'Check tax authority status from VNPT' : 'Kiểm tra lại trạng thái CQT từ VNPT'}
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
                            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>
                                {isEn ? 'Activity Logs' : 'Nhật Ký Hoạt Động'}
                            </p>
                            {timelineLoading ? (
                                <div className="flex items-center justify-center py-6 gap-2 text-xs" style={{ color: '#64748B' }}>
                                    <Loader2 size={14} className="animate-spin text-[#0891B2]" />
                                    <span>{isEn ? 'Loading activity logs...' : 'Đang tải nhật ký hoạt động...'}</span>
                                </div>
                            ) : timeline.length === 0 ? (
                                <p className="text-xs py-4 text-center" style={{ color: '#64748B' }}>
                                    {isEn ? 'No activities recorded yet' : 'Chưa ghi nhận hoạt động nào'}
                                </p>
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
            </Drawer>

            {/* Modal Cảnh Báo Lệch Ngày Xuất Hóa Đơn (Nghị định 123 / Nghị định 70) */}
            {dateWarningModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 animate-fade-in">
                    <div 
                        className="relative w-full max-w-lg rounded-xl overflow-hidden shadow-2xl border bg-white border-slate-200"
                    >
                        {/* Header */}
                        <div 
                            className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${
                                dateWarningModal.level === 'DANGER'
                                    ? 'bg-rose-50/80 border-rose-200'
                                    : 'bg-amber-50/80 border-amber-200'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                {dateWarningModal.level === 'DANGER' ? (
                                    <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-300 shadow-2xs">
                                        <AlertTriangle size={20} />
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300 shadow-2xs">
                                        <AlertCircle size={20} />
                                    </div>
                                )}
                                <div>
                                    <h3 className={`text-sm font-bold tracking-tight ${
                                        dateWarningModal.level === 'DANGER'
                                            ? 'text-rose-900'
                                            : 'text-amber-900'
                                    }`}>
                                        {dateWarningModal.level === 'DANGER' 
                                            ? (isEn ? 'TAX PERIOD MISMATCH WARNING (DIFFERENT MONTH)' : 'CẢNH BÁO LỆCH KỲ THUẾ (KHÁC THÁNG)') 
                                            : (isEn ? 'INVOICE ISSUE DATE ADVISORY' : 'LƯU Ý THỜI ĐIỂM LẬP HÓA ĐƠN')}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        {isEn ? 'Order: ' : 'Đơn hàng: '}<span className="font-mono font-bold text-slate-800">{detail?.soNo}</span>
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setDateWarningModal(null)}
                                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4 text-xs text-slate-700">
                            {/* Legal Entity & Date Comparison */}
                            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                                <div className="flex justify-between items-center pb-2.5 border-b border-slate-200">
                                    <span className="text-slate-500 font-medium">{isEn ? 'Issuing Legal Entity:' : 'Pháp nhân phát hành:'}</span>
                                    <span className="font-bold text-slate-900">
                                        {detail?.legalEntity?.name || (detail?.legalEntity?.code === 'TA' ? 'Công ty Cổ phần Thắng Ân (TA)' : detail?.legalEntity?.code === 'LC' ? "Công ty TNHH Phân phối Ly's Cellar (LC)" : 'Thắng Ân (TA)')}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-0.5">
                                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-center shadow-2xs">
                                        <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold mb-1">{isEn ? 'ERP Order Date' : 'Ngày lập đơn ERP'}</span>
                                        <span className="font-mono font-bold text-sm text-teal-700">{dateWarningModal.orderDateFormatted}</span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-center shadow-2xs">
                                        <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold mb-1">{isEn ? 'VNPT Invoice Date' : 'Ngày xuất HĐ VNPT'}</span>
                                        <span className="font-mono font-bold text-sm text-amber-700">
                                            {dateWarningModal.invoiceDateFormatted} <span className="text-xs font-semibold text-slate-600">({isEn ? 'Today' : 'Hôm nay'})</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="text-center pt-1 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
                                    <span>{isEn ? 'Time gap:' : 'Khoảng cách thời gian:'}</span>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs ${
                                        dateWarningModal.level === 'DANGER'
                                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                                    }`}>
                                        {dateWarningModal.diffDays} {isEn ? 'days' : 'ngày'}
                                    </span>
                                </div>
                            </div>

                            {/* Message / Policy explanation */}
                            <div className={`p-3.5 rounded-lg border text-xs leading-relaxed ${
                                dateWarningModal.level === 'DANGER' 
                                    ? 'bg-rose-50 border-rose-200 text-rose-950' 
                                    : 'bg-amber-50 border-amber-200 text-amber-950'
                            }`}>
                                <p className={`font-bold mb-1.5 text-xs flex items-center gap-1.5 ${
                                    dateWarningModal.level === 'DANGER' ? 'text-rose-900' : 'text-amber-900'
                                }`}>
                                    {dateWarningModal.level === 'DANGER' ? (isEn ? 'Pursuant to Decree 123/2020/ND-CP & Decree 70/2025/ND-CP:' : 'Căn cứ Nghị định 123/2020/NĐ-CP & Nghị định 70/2025/NĐ-CP:') : (isEn ? 'Legal regulations regarding invoice issuance date:' : 'Quy định pháp luật về thời điểm xuất hóa đơn:')}
                                </p>
                                <p className="text-xs leading-normal">
                                    {dateWarningModal.message}
                                </p>
                                {dateWarningModal.level === 'DANGER' && (
                                    <p className="mt-2.5 pt-2 border-t border-rose-200 text-[11px] text-rose-800 italic leading-normal">
                                        {isEn ? '* Note: Issuing an invoice in a different VAT tax filing period from the date of incurrence may incur penalties under Article 24 Decree 125/2020/ND-CP. Accountants must cross-check before confirming.' : '* Lưu ý: Việc xuất hóa đơn khác kỳ kê khai thuế GTGT so với thời điểm phát sinh có thể dẫn đến rủi ro bị cơ quan thuế xử phạt về hóa đơn theo Điều 24 Nghị định 125/2020/NĐ-CP. Kế toán cần đối chiếu kỹ trước khi bấm xác nhận.'}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setDateWarningModal(null)}
                                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 transition-all cursor-pointer"
                            >
                                {isEn ? 'Cancel' : 'Hủy Bỏ'}
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
                                {isEn ? 'I Have Reviewed & Proceed' : 'Tôi Đã Rà Soát & Tiếp Tục Đẩy Nháp'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDrawerDialog}
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
    const { locale, isEn, formatCurrency, formatDate } = useAppLocale()
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
                        <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-amber-950/80 text-amber-700 border border-amber-500/40">
                            Tasting
                        </span>
                    )}
                </div>
                <span className="text-[10px]" style={{ color: '#64748B' }}>
                    {formatDate(row.createdAt, true)}
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
                    style={{ background: 'rgba(8,145,178,0.08)', color: '#475569' }}>
                    {getSOChannelLabel(row.channel, locale, true)}
                </span>

                {/* Legal Entity Badge */}
                {row.legalEntityCode && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ 
                            background: row.legalEntityCode === 'TA' ? 'rgba(180,83,9,0.12)' : 'rgba(8, 145, 178, 0.08)', 
                            color: row.legalEntityCode === 'TA' ? '#B45309' : '#0E7490' 
                        }}>
                        {row.legalEntityCode}
                    </span>
                )}

                {/* Invoice Number Badge */}
                {row.invoiceNo ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold"
                        style={{ background: 'rgba(8,145,178,0.1)', color: '#0891B2', border: '1px solid rgba(8,145,178,0.25)' }}
                        title={`Số hóa đơn: ${row.invoiceNo}`}>
                        {isEn ? 'Inv:' : 'HĐ:'} {row.invoiceNo}
                    </span>
                ) : row.isInvoiceExempt ? (
                    <span className="text-[9px] px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1"
                        style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}
                        title={row.invoiceExemptReason || (isEn ? 'Invoice exempt order' : 'Đơn hàng không xuất HĐ VAT')}>
                        {isEn ? 'No Inv' : 'Không HĐ'}
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
                        {formatCurrency(row.totalAmount)}
                    </span>
                    {row.orderDiscount > 0 && (
                        <span className="text-[10px] ml-1.5 font-semibold" style={{ color: '#15803D' }}>
                            ({isEn ? 'Disc' : 'CK'} {row.orderDiscount}%)
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
                    style={{ background: 'rgba(8,145,178,0.06)', color: '#0891B2', borderColor: 'rgba(8, 145, 178, 0.15)' }}
                    title={isEn ? 'View Details' : 'Chi tiết'}>
                    <Eye size={12} />
                </button>

                {/* Clone button */}
                <button onClick={onClone} disabled={actionLoading === row.id}
                    className="p-1.5 rounded transition-all flex items-center justify-center border"
                    style={{ background: 'rgba(100,116,139,0.12)', color: '#475569', borderColor: 'rgba(100,116,139,0.25)' }}
                    title={isEn ? 'Clone Order' : 'Nhân bản đơn hàng'}>
                    <Copy size={12} />
                </button>

                {/* Approval Actions */}
                {row.status === 'PENDING_APPROVAL' && canApprove && (
                    <>
                        <button onClick={onApprove} disabled={isActLoading}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold transition-all border"
                            style={{ background: 'rgba(21,128,61,0.15)', color: '#15803D', borderColor: 'rgba(21,128,61,0.3)', borderRadius: '4px' }}>
                            {isActLoading ? <Loader2 size={10} className="animate-spin" /> : <><CheckCircle2 size={10} /> {isEn ? 'Approve' : 'Duyệt'}</>}
                        </button>
                        <button onClick={onReject} disabled={isActLoading}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold transition-all border"
                            style={{ background: 'rgba(185,28,28,0.12)', color: '#B91C1C', borderColor: 'rgba(185,28,28,0.25)', borderRadius: '4px' }}>
                            {isActLoading ? <Loader2 size={10} className="animate-spin" /> : <><XCircle size={10} /> {isEn ? 'Reject' : 'Từ chối'}</>}
                        </button>
                    </>
                )}

                {/* Draft Actions */}
                {row.status === 'DRAFT' && (
                    <>
                        <button onClick={onConfirm} disabled={isActLoading}
                            className="px-2 py-1 text-[11px] font-semibold transition-all border"
                            style={{ background: 'rgba(21,128,61,0.12)', color: '#15803D', borderColor: 'rgba(21,128,61,0.25)', borderRadius: '4px' }}>
                            {isActLoading ? <Loader2 size={10} className="animate-spin" /> : (isEn ? 'Confirm' : 'Xác nhận')}
                        </button>
                        <button onClick={onEdit}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold transition-all border"
                            style={{ background: 'rgba(180,83,9,0.1)', color: '#B45309', borderColor: 'rgba(180,83,9,0.2)', borderRadius: '4px' }}>
                            <Pencil size={10} /> {isEn ? 'Edit' : 'Sửa'}
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
                            style={{ background: 'rgba(185,28,28,0.1)', color: '#B91C1C', borderColor: 'rgba(185,28,28,0.2)', borderRadius: '4px' }}>
                            {isActLoading ? <Loader2 size={10} className="animate-spin" /> : <><XCircle size={10} /> Trả về</>}
                        </button>
                    </>
                )}

                {/* Delete / Cancel Actions */}
                {row.status === 'DRAFT' ? (
                    <button onClick={onDelete} disabled={isActLoading}
                        className="px-2 py-1 text-[11px] font-semibold transition-all border"
                        style={{ background: 'rgba(185,28,28,0.08)', color: '#B91C1C', borderColor: 'rgba(185,28,28,0.2)', borderRadius: '4px' }}>
                        Xóa
                    </button>
                ) : (
                    ['PENDING_APPROVAL', 'PENDING_ACCOUNTING', 'CONFIRMED'].includes(row.status) && (
                        <button onClick={onCancel} disabled={isActLoading}
                            className="px-2 py-1 text-[11px] font-semibold transition-all border"
                            style={{ background: 'rgba(185,28,28,0.08)', color: '#B91C1C', borderColor: 'rgba(185,28,28,0.2)', borderRadius: '4px' }}>
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
    const { locale, isEn, formatCurrency, formatDate } = useAppLocale()
    const sI18n = SALES_I18N[locale]
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

    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    const handleCancel = (id: string) => {
        confirm({
            title: isEn ? 'Cancel Sales Order' : 'Hủy đơn hàng',
            message: isEn ? 'Are you sure you want to cancel this sales order?' : 'Bạn có chắc chắn muốn huỷ đơn hàng này không?',
            danger: true,
            confirmLabel: isEn ? 'Cancel Order' : 'Huỷ đơn',
            onConfirm: async () => {
                setActionLoading(id)
                try {
                    await cancelMutation.mutateAsync(id)
                    toast.success(isEn ? 'Sales order cancelled!' : 'Đã huỷ đơn hàng (Cập nhật tức thì)!')
                } catch (e: any) {
                    toast.error(e.message || (isEn ? 'Failed to cancel' : 'Không thể huỷ'))
                } finally {
                    setActionLoading(null)
                }
            }
        })
    }

    const handleApprove = async (id: string) => {
        setApprovalModalId(id)
    }

    const handleReject = (id: string) => {
        confirm({
            title: isEn ? 'Reject Sales Order' : 'Từ chối đơn hàng',
            message: isEn ? 'Are you sure you want to reject this sales order?' : 'Bạn có chắc chắn muốn từ chối đơn hàng này không?',
            danger: true,
            confirmLabel: isEn ? 'Reject' : 'Từ chối',
            onConfirm: async () => {
                setActionLoading(id)
                try {
                    await rejectMutation.mutateAsync(id)
                    toast.success(isEn ? 'Order rejected!' : 'Đã từ chối (Cập nhật tức thì)!')
                } catch (e: any) {
                    toast.error(e.message || (isEn ? 'Failed to reject' : 'Không thể từ chối'))
                } finally {
                    setActionLoading(null)
                }
            }
        })
    }

    const handleDelete = (id: string) => {
        confirm({
            title: isEn ? 'Delete Draft Order' : 'Xóa vĩnh viễn đơn hàng nháp',
            message: isEn ? 'Are you sure you want to permanently delete this draft order? This action cannot be undone.' : 'Bạn có chắc chắn muốn xóa vĩnh viễn đơn hàng nháp này không? Thao tác này không thể hoàn tác.',
            danger: true,
            confirmLabel: isEn ? 'Delete' : 'Xóa đơn',
            onConfirm: async () => {
                setActionLoading(id)
                try {
                    await deleteMutation.mutateAsync(id)
                    toast.success(isEn ? 'Draft order deleted!' : 'Đã xóa đơn hàng nháp thành công (Cập nhật tức thì)!')
                } catch (e: any) {
                    toast.error(`Không thể xóa: ${e.message}`)
                } finally {
                    setActionLoading(null)
                }
            }
        })
    }

    const handleClone = (id: string) => {
        confirm({
            title: isEn ? 'Clone Sales Order' : 'Nhân bản đơn hàng',
            message: isEn ? 'Are you sure you want to clone this sales order to a new draft?' : 'Bạn có chắc chắn muốn nhân bản đơn hàng này sang một đơn hàng mới không?',
            confirmLabel: isEn ? 'Clone' : 'Nhân bản',
            onConfirm: async () => {
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
        })
    }

    const handleAcctReject = (id: string) => {
        confirm({
            title: isEn ? 'Return to DRAFT' : 'Trả đơn về DRAFT',
            message: isEn
                ? 'Are you sure you want to return this order back to DRAFT for sales to edit?'
                : 'Bạn có chắc chắn muốn trả đơn về DRAFT cho nhân viên kinh doanh chỉnh sửa lại?',
            danger: true,
            confirmLabel: isEn ? 'Return to DRAFT' : 'Trả về DRAFT',
            onConfirm: async () => {
                setActionLoading(id)
                try {
                    await acctRejectMutation.mutateAsync({ id })
                    if (detailId === id) setDetailId(null)
                    reload()
                    toast.success(isEn ? 'Order returned to DRAFT' : 'Đã trả về DRAFT thành công!')
                } catch (e: any) {
                    toast.error(`Lỗi: ${e.message}`)
                } finally {
                    setActionLoading(null)
                }
            }
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
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            {/* Header: inline summary + actions */}
            <PageHeader
                description={
                    <div className="hidden xl:flex items-center gap-x-3 type-caption">
                        <span>
                            {isEn ? 'Total Rev:' : 'Tổng DT:'}{' '}
                            <strong className="type-number text-sm ml-1 text-lys-teal-strong">
                                {isEn ? `${(stats.monthRevenue / 1e9).toFixed(2)}B VND` : `₫${(stats.monthRevenue / 1e9).toFixed(2)}T`}
                            </strong>
                        </span>
                        <span className="text-lys-border-strong">|</span>
                        <span title={isEn ? 'Revenue with VAT Invoice' : 'Doanh thu đã xuất hóa đơn VAT'}>
                            {isEn ? 'With Inv:' : 'Có HĐ:'}{' '}
                            <strong className="type-number text-sm ml-1 text-tone-success-fg">
                                {isEn ? `${((stats.revenueWithInvoice || 0) / 1e9).toFixed(2)}B VND` : `₫${((stats.revenueWithInvoice || 0) / 1e9).toFixed(2)}T`}
                            </strong>
                        </span>
                        <span className="text-lys-border-strong">|</span>
                        <span title={isEn ? 'Revenue without VAT Invoice' : 'Doanh thu không xuất hóa đơn VAT (vẫn tính đủ 100% VAT)'}>
                            {isEn ? 'No Inv:' : 'Không HĐ:'}{' '}
                            <strong className="type-number text-sm ml-1 text-tone-warning-fg">
                                {isEn ? `${((stats.revenueExemptInvoice || 0) / 1e9).toFixed(2)}B VND` : `₫${((stats.revenueExemptInvoice || 0) / 1e9).toFixed(2)}T`}
                            </strong>
                        </span>
                        <span className="text-lys-border-strong">|</span>
                        <span>
                            {isEn ? 'Orders:' : 'Đơn:'}{' '}
                            <strong className="type-number text-sm ml-1 text-lys-primary">{stats.monthOrders}</strong>
                        </span>
                        <span>
                            {isEn ? 'Pending:' : 'Chờ duyệt:'}{' '}
                            <strong className="type-number text-sm ml-1 text-tone-warning-fg">{stats.pendingApproval}</strong>
                        </span>
                    </div>
                }
                actions={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => setShowStats(!showStats)}
                            aria-pressed={showStats}
                            className={showStats ? 'border-lys-teal text-lys-teal-strong bg-lys-teal-soft hover:bg-lys-teal-soft' : undefined}
                        >
                            <BarChart3 size={14} /> {isEn ? 'Stats' : 'Thống Kê'}
                        </Button>
                        <Button variant="secondary" onClick={handleExport}>
                            <Download size={14} /> Excel
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => handleExportMisaSme()}
                            title={isEn ? 'Export MISA SME Excel' : 'Xuất file Excel chuẩn MISA SME.NET Offline để Kế toán Import nhanh'}
                        >
                            <Download size={14} /> {isEn ? 'MISA SME' : 'Xuất MISA SME'}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => handleExportVnptInvoice()}
                            title={isEn ? 'Export VNPT E-Invoice Excel' : 'Xuất file Excel Hóa Đơn Điện Tử VNPT'}
                        >
                            <Download size={14} /> {isEn ? 'VNPT E-Invoice' : 'VNPT HĐĐT'}
                        </Button>
                        {canCreateSO && (
                            <Button onClick={() => { setCloneData(null); setCreateOpen(true) }}>
                                <Plus size={16} /> {sI18n.newOrder}
                            </Button>
                        )}
                    </>
                }
            />

            {/* Collapsible Stats Section */}
            {showStats && (
                <div className="flex flex-col gap-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <span className="type-caption uppercase tracking-wide text-lys-muted">
                            {isEn ? 'Detailed Revenue & Orders Statistics' : 'Thống Kê Chi Tiết Doanh Thu & Đơn Hàng'}
                        </span>
                        <Button variant="link" size="sm" onClick={() => setShowStats(false)}>
                            {isEn ? 'Collapse' : 'Thu gọn'} <X size={12} />
                        </Button>
                    </div>
                    <StatGrid className="sm:grid-cols-3 lg:grid-cols-6">
                        <StatCard icon={DollarSign} tone="brand" label={sI18n.stats.totalRevenue} value={isEn ? `${(stats.monthRevenue / 1e9).toFixed(2)}B VND` : `₫${(stats.monthRevenue / 1e9).toFixed(2)}T`} sub={isEn ? 'Includes 100% VAT' : 'Bao gồm 100% VAT'} />
                        <StatCard icon={ReceiptText} tone="success" label={isEn ? 'Invoiced Revenue' : 'Doanh Thu Có HĐ'} value={isEn ? `${((stats.revenueWithInvoice || 0) / 1e9).toFixed(2)}B VND` : `₫${((stats.revenueWithInvoice || 0) / 1e9).toFixed(2)}T`} sub={isEn ? `${stats.ordersWithInvoice || 0} invoiced orders` : `${stats.ordersWithInvoice || 0} đơn có HĐ`} />
                        <StatCard icon={FileX2} tone="warning" label={isEn ? 'Non-Invoiced Revenue' : 'DT Không Xuất HĐ'} value={isEn ? `${((stats.revenueExemptInvoice || 0) / 1e9).toFixed(2)}B VND` : `₫${((stats.revenueExemptInvoice || 0) / 1e9).toFixed(2)}T`} sub={isEn ? `${stats.ordersExemptInvoice || 0} exempt orders` : `${stats.ordersExemptInvoice || 0} đơn miễn HĐ`} />
                        <StatCard icon={FileText} tone="neutral" label={isEn ? 'This Month Orders' : 'Đơn Tháng Này'} value={stats.monthOrders} />
                        <StatCard icon={Clock} tone="warning" label={sI18n.stats.pendingApproval} value={stats.pendingApproval} />
                        <StatCard icon={CheckCircle2} tone="brand" label={isEn ? 'Confirmed' : 'Đã Xác Nhận'} value={stats.confirmed} />
                    </StatGrid>
                </div>
            )}

            {/* Toolbar: Tabs & Main Filters */}
            {(() => {
                const hasAdvancedFilters = !!(salesRepFilter || channelFilter || legalEntityFilter || warehouseFilter || paymentTermFilter || pendingActionFilter || (orderTypeFilter && orderTypeFilter !== 'ALL') || (invoiceFilter && invoiceFilter !== 'ALL'))
                const filtersActive = showFilters || hasAdvancedFilters
                return (
                    <Toolbar
                        left={<FilterTabs active={statusFilter} counts={counts} onChange={handleStatusTab} />}
                        right={
                            <>
                                <SearchInput
                                    placeholder={sI18n.searchPlaceholder}
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
                                    className="sm:w-48 xl:w-64"
                                />

                                {/* Date Period Preset + custom range */}
                                <div className="flex items-center gap-1.5 h-11 sm:h-9 px-2.5 bg-white border border-lys-border-strong rounded-md">
                                    <Calendar size={13} className={datePreset !== 'ALL' ? 'text-lys-teal' : 'text-lys-muted'} aria-hidden />
                                    <select
                                        value={datePreset}
                                        onChange={e => handleDatePresetChange(e.target.value as DatePresetKey)}
                                        aria-label={isEn ? 'Date range' : 'Khoảng thời gian'}
                                        className={`bg-transparent border-none text-xs font-semibold outline-none cursor-pointer pr-1 ${datePreset !== 'ALL' ? 'text-lys-teal-strong' : 'text-lys-primary'}`}
                                    >
                                        {DATE_PRESET_OPTIONS.map(opt => (
                                            <option key={opt.key} value={opt.key}>
                                                {sI18n.datePresets[opt.key] || opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="flex items-center gap-1 border-l border-lys-border pl-1.5 ml-0.5">
                                        <input type="date" value={dateFrom}
                                            aria-label={isEn ? 'From date' : 'Từ ngày'}
                                            onChange={e => {
                                                setDatePreset('CUSTOM')
                                                setDateFrom(e.target.value)
                                                setPage(1)
                                                reload({ dateFrom: e.target.value, dateTo, page: 1 }, true)
                                            }}
                                            className="bg-transparent border-none text-[11px] text-lys-primary outline-none w-[95px] p-0" />
                                        <span className="text-[10px] text-lys-dim">→</span>
                                        <input type="date" value={dateTo}
                                            aria-label={isEn ? 'To date' : 'Đến ngày'}
                                            onChange={e => {
                                                setDatePreset('CUSTOM')
                                                setDateTo(e.target.value)
                                                setPage(1)
                                                reload({ dateFrom, dateTo: e.target.value, page: 1 }, true)
                                            }}
                                            className="bg-transparent border-none text-[11px] text-lys-primary outline-none w-[95px] p-0" />
                                    </div>
                                </div>

                                <Button
                                    variant="secondary"
                                    onClick={() => setShowFilters(!showFilters)}
                                    aria-expanded={showFilters}
                                    className={filtersActive ? 'border-lys-teal text-lys-teal-strong bg-lys-teal-soft hover:bg-lys-teal-soft' : undefined}
                                >
                                    <SlidersHorizontal size={14} />
                                    {isEn ? 'Filters' : 'Bộ lọc'}
                                    {hasAdvancedFilters && <span className="w-1.5 h-1.5 rounded-full bg-lys-teal" aria-hidden />}
                                </Button>
                            </>
                        }
                    />
                )
            })()}

            {/* Collapsible Advanced Filters */}
            {showFilters && (
                <FilterPanel className="animate-fade-in">
                    <Field label={isEn ? 'Order Type' : 'Loại Đơn Hàng'}>
                        {id => (
                            <Select id={id} value={orderTypeFilter}
                                onChange={e => { setOrderTypeFilter(e.target.value); setPage(1); reload({ orderType: e.target.value as any, page: 1 }, true) }}>
                                <option value="ALL">{isEn ? 'All order types' : 'Tất cả loại đơn'}</option>
                                <option value="STANDARD">{isEn ? 'Commercial' : 'Thương Mại'}</option>
                                <option value="TASTING">{isEn ? 'Tasting' : 'Tasting (Nếm thử)'}</option>
                                <option value="SAMPLE">{isEn ? 'Sample' : 'Hàng Mẫu'}</option>
                            </Select>
                        )}
                    </Field>

                    <Field label={isEn ? 'Invoice Status' : 'Trạng Thái HĐ'}>
                        {id => (
                            <Select id={id} value={invoiceFilter}
                                onChange={e => { setInvoiceFilter(e.target.value as any); setPage(1); reload({ invoiceFilter: e.target.value, page: 1 }, true) }}>
                                <option value="ALL">{isEn ? 'All invoices' : 'Tất cả hóa đơn'}</option>
                                <option value="INVOICED">{isEn ? 'Has VAT invoice' : 'Có hóa đơn VAT'}</option>
                                <option value="EXEMPT">{isEn ? 'Exempt from VAT invoice' : 'Không xuất HĐ VAT'}</option>
                                <option value="PENDING">{isEn ? 'Pending invoice' : 'Chờ xuất HĐ'}</option>
                            </Select>
                        )}
                    </Field>

                    <Field label={isEn ? 'Sales Rep' : 'Nhân viên Sales'}>
                        {id => (
                            <Select id={id} value={salesRepFilter}
                                onChange={e => { setSalesRepFilter(e.target.value); setPage(1); reload({ salesRepId: e.target.value, page: 1 }, true) }}>
                                <option value="">{isEn ? 'All Sales Reps' : 'Tất cả Sales'}</option>
                                {salesReps.map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </Select>
                        )}
                    </Field>

                    <Field label={isEn ? 'Channel' : 'Kênh'}>
                        {id => (
                            <Select id={id} value={channelFilter}
                                onChange={e => { setChannelFilter(e.target.value); setPage(1); reload({ channel: e.target.value, page: 1 }, true) }}>
                                <option value="">{isEn ? 'All channels' : 'Tất cả kênh'}</option>
                                <option value="HORECA">HORECA</option>
                                <option value="WHOLESALE_DISTRIBUTOR">{isEn ? 'Wholesale' : 'Đại Lý'}</option>
                                <option value="VIP_RETAIL">VIP</option>
                                <option value="DIRECT_INDIVIDUAL">{isEn ? 'Direct' : 'Trực Tiếp'}</option>
                                <option value="CORPORATE">{isEn ? 'Corporate' : 'Doanh Nghiệp'}</option>
                                <option value="RETAIL">{isEn ? 'Retail' : 'Bán Lẻ'}</option>
                            </Select>
                        )}
                    </Field>

                    <Field label={isEn ? 'Legal Entity' : 'Pháp nhân'}>
                        {id => (
                            <Select id={id} value={legalEntityFilter}
                                onChange={e => { setLegalEntityFilter(e.target.value); setPage(1); reload({ legalEntityId: e.target.value, page: 1 }, true) }}>
                                <option value="">{isEn ? 'All entities' : 'Tất cả pháp nhân'}</option>
                                {pageLegalEntities.map((le: any) => (
                                    <option key={le.id} value={le.id}>{le.name}</option>
                                ))}
                            </Select>
                        )}
                    </Field>

                    <Field label={isEn ? 'Warehouse' : 'Kho xuất'}>
                        {id => (
                            <Select id={id} value={warehouseFilter}
                                onChange={e => { setWarehouseFilter(e.target.value); setPage(1); reload({ warehouseId: e.target.value, page: 1 }, true) }}>
                                <option value="">{isEn ? 'All warehouses' : 'Tất cả kho'}</option>
                                {pageWarehouses.map((wh: any) => (
                                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                                ))}
                            </Select>
                        )}
                    </Field>

                    <Field label={isEn ? 'Payment Terms' : 'Điều khoản'}>
                        {id => (
                            <Select id={id} value={paymentTermFilter}
                                onChange={e => { setPaymentTermFilter(e.target.value); setPage(1); reload({ paymentTerm: e.target.value, page: 1 }, true) }}>
                                <option value="">{isEn ? 'All' : 'Tất cả'}</option>
                                {paymentTerms.map((pt: string) => (
                                    <option key={pt} value={pt}>{pt}</option>
                                ))}
                            </Select>
                        )}
                    </Field>

                    <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-2 h-11 sm:h-9 cursor-pointer type-caption text-lys-secondary">
                            <input type="checkbox" checked={pendingActionFilter}
                                onChange={e => { setPendingActionFilter(e.target.checked); setPage(1); reload({ pendingAction: e.target.checked, page: 1 }, true) }}
                                className="w-4 h-4 rounded border-lys-border-strong accent-lys-teal-strong" />
                            <AlertTriangle size={13} className="text-tone-warning-fg" aria-hidden />
                            <span>{isEn ? 'Requires Action' : 'Cần xử lý'}</span>
                        </label>
                    </div>
                </FilterPanel>
            )}

            {/* Table (Desktop View) */}
            <div className="hidden md:block">
                <Table className="w-full">
                    <THead>
                        <tr>
                            <SortHeader label={sI18n.table.soNo} field="soNo" current={sortBy} dir={sortDir} onSort={handleSort} className="px-2 whitespace-nowrap" />
                            <Th className="px-2">{sI18n.table.customer}</Th>
                            <Th className="px-2 whitespace-nowrap" align="center">{sI18n.table.invoice}</Th>
                            <SortHeader label={sI18n.table.total} field="totalAmount" current={sortBy} dir={sortDir} onSort={handleSort} align="right" className="px-2 whitespace-nowrap" />
                            <Th className="px-2 whitespace-nowrap">{sI18n.table.status}</Th>
                            <SortHeader label={isEn ? 'Sales Rep / Date' : 'Phụ trách / Ngày'} field="createdAt" current={sortBy} dir={sortDir} onSort={handleSort} className="px-2 whitespace-nowrap" />
                            <Th align="center" className="px-2 whitespace-nowrap">{sI18n.table.actions}</Th>
                        </tr>
                    </THead>
                    <TBody>
                        {loading ? (
                            <TableMessageRow colSpan={7}>
                                <TableSkeleton rows={8} cols={7} />
                            </TableMessageRow>
                        ) : rows.length === 0 ? (
                            <TableMessageRow colSpan={7}>
                                <EmptyState
                                    icon={FileText}
                                    title={hasActiveFilters ? (isEn ? 'No orders match the filter' : 'Không tìm thấy đơn hàng phù hợp với bộ lọc') : (isEn ? 'No sales orders in system' : 'Hệ thống chưa có đơn hàng nào')}
                                    action={hasActiveFilters && (
                                        <Button size="sm" onClick={handleClearFilters}>{isEn ? 'Clear Filters' : 'Xóa Bộ Lọc'}</Button>
                                    )}
                                />
                            </TableMessageRow>
                        ) : rows.map(row => (
                            <Tr key={row.id} onClick={() => setDetailId(row.id)}>
                                <Td className="px-2 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                        <button type="button" onClick={(e) => { e.stopPropagation(); setDetailId(row.id) }} className="type-code font-bold text-lys-teal-strong hover:underline cursor-pointer">
                                            {row.soNo}
                                        </button>
                                        {row.legalEntityCode && (
                                            <Badge tone={row.legalEntityCode === 'TA' ? 'warning' : 'brand'} className="text-[10px] px-1 py-0 font-bold">
                                                {row.legalEntityCode}
                                            </Badge>
                                        )}
                                    </div>
                                </Td>
                                <Td className="px-2">
                                    <p className="font-semibold truncate max-w-[160px] xl:max-w-[200px]" title={row.customerName}>{row.customerName}</p>
                                    <p className="type-caption text-lys-muted truncate max-w-[160px] xl:max-w-[200px]">
                                        {row.customerCode} · <span className="font-medium text-lys-secondary">{getSOChannelLabel(row.channel, locale, true)}</span>
                                    </p>
                                </Td>
                                <Td className="px-2 whitespace-nowrap text-center">
                                    {row.invoiceNo ? (
                                        <Badge tone="brand" title={row.invoiceNo} className="type-code text-[11px]">{row.invoiceNo}</Badge>
                                    ) : row.isInvoiceExempt ? (
                                        <Badge tone="danger" icon={FileX2} className="text-[11px]"
                                            title={`Miễn HĐ: ${row.invoiceExemptReason || 'Không có lý do'}${row.invoiceExemptBy ? ` (Duyệt bởi: ${row.invoiceExemptBy})` : ''}`}>
                                            {isEn ? 'No Inv' : 'Không HĐ'}
                                        </Badge>
                                    ) : (
                                        <span className="text-lys-dim text-xs">—</span>
                                    )}
                                </Td>
                                <Td align="right" className="px-2 whitespace-nowrap">
                                    <p className="font-bold">{formatCurrency(row.totalAmount)}</p>
                                    {row.orderDiscount > 0 && <p className="type-caption text-tone-success-fg font-medium">{isEn ? 'Disc' : 'CK'} {row.orderDiscount}%</p>}
                                </Td>
                                <Td className="px-2 whitespace-nowrap">
                                    <div className="flex flex-col gap-0.5 items-start">
                                        <StatusBadge status={row.status} approvalStep={row.approvalStep} />
                                        {row.deliveryStatus && row.deliveryStatus !== 'UNDELIVERED' && (
                                            <DeliveryStatusBadge status={row.deliveryStatus} shipped={row.totalQtyShipped} ordered={row.totalQtyOrdered} />
                                        )}
                                    </div>
                                </Td>
                                <Td className="px-2 whitespace-nowrap">
                                    <p className="text-xs font-medium text-lys-primary truncate max-w-[110px]" title={row.salesRepName || undefined}>{row.salesRepName || '—'}</p>
                                    <p className="type-caption text-lys-muted" title={formatDate(row.createdAt, true)}>{formatDate(row.createdAt)}</p>
                                </Td>
                                <Td className="px-1.5" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
                                        <Button size="icon-sm" variant="secondary" className="h-7 w-7" title={isEn ? 'View' : 'Xem'} aria-label={isEn ? 'View' : 'Xem'} onClick={() => setDetailId(row.id)}>
                                            <Eye size={13} />
                                        </Button>
                                        <Button size="icon-sm" variant="ghost" className="h-7 w-7" title={isEn ? 'Print' : 'In'} aria-label={isEn ? 'Print' : 'In'}
                                            onClick={() => window.open(`/dashboard/sales/print?id=${row.id}`, '_blank')}>
                                            <Printer size={13} />
                                        </Button>
                                        {row.status === 'PENDING_APPROVAL' && (
                                            ((isSaleAdminOrMgr && row.approvalStep === 1) || (isCEO && row.approvalStep === 2) || (!row.approvalStep && (isCEO || isSaleAdminOrMgr)))
                                        ) && (
                                            <>
                                                <Button size="sm" className="h-7 px-2" onClick={() => handleApprove(row.id)} loading={actionLoading === row.id}>
                                                    {actionLoading !== row.id && <CheckCircle2 size={12} />} {isEn ? 'Approve' : 'Duyệt'}
                                                </Button>
                                                <Button size="sm" variant="danger-outline" className="h-7 px-2" onClick={() => handleReject(row.id)} disabled={actionLoading === row.id}>
                                                    <XCircle size={12} /> {isEn ? 'Reject' : 'Từ Chối'}
                                                </Button>
                                            </>
                                        )}
                                        {row.status === 'DRAFT' && canCreateSO && (
                                            <>
                                                <Button size="sm" className="h-7 px-2" onClick={() => handleConfirm(row.id)} loading={actionLoading === row.id}>
                                                    {isEn ? 'Confirm' : 'Xác Nhận'}
                                                </Button>
                                                <Button size="icon-sm" variant="secondary" className="h-7 w-7" title={isEn ? 'Edit' : 'Sửa'} aria-label={isEn ? 'Edit' : 'Sửa'} onClick={() => setEditId(row.id)}>
                                                    <Pencil size={12} />
                                                </Button>
                                                <Button size="icon-sm" variant="danger-outline" className="h-7 w-7" title={isEn ? 'Delete' : 'Xóa'} aria-label={isEn ? 'Delete' : 'Xóa'} onClick={() => handleDelete(row.id)} disabled={actionLoading === row.id}>
                                                    <XCircle size={12} />
                                                </Button>
                                            </>
                                        )}
                                        {row.status === 'PENDING_ACCOUNTING' && canAcctApprove && (
                                            <>
                                                <Button size="sm" className="h-7 px-2" onClick={() => { setAcctModalId(row.id); setAcctEntityId((row as any).legalEntityId ?? '') }}>
                                                    <CheckCircle2 size={12} /> KT Duyệt
                                                </Button>
                                                <Button size="sm" variant="danger-outline" className="h-7 px-2" disabled={actionLoading === row.id}
                                                    onClick={() => handleAcctReject(row.id)}>
                                                    <XCircle size={12} /> KT Trả Về
                                                </Button>
                                            </>
                                        )}
                                        {['PENDING_APPROVAL', 'CONFIRMED'].includes(row.status) && (
                                            <Button size="sm" variant="danger-outline" className="h-7 px-2" onClick={() => handleCancel(row.id)} disabled={actionLoading === row.id}>
                                                {isEn ? 'Cancel' : 'Huỷ'}
                                            </Button>
                                        )}
                                    </div>
                                </Td>
                            </Tr>
                        ))}
                    </TBody>
                </Table>
            </div>

            {/* Mobile View */}
            <div className={`block md:hidden space-y-3 ${loading && rows.length > 0 ? 'opacity-40 pointer-events-none' : ''}`}>
                {rows.length === 0 && loading ? (
                    <Card><TableSkeleton rows={5} cols={3} /></Card>
                ) : rows.length === 0 ? (
                    <Card>
                        <EmptyState
                            icon={FileText}
                            title={hasActiveFilters ? (isEn ? 'No orders match the filter' : 'Không tìm thấy đơn hàng phù hợp với bộ lọc') : (isEn ? 'No sales orders in system' : 'Hệ thống chưa có đơn hàng nào')}
                            action={hasActiveFilters && (
                                <Button size="sm" onClick={handleClearFilters}>{isEn ? 'Clear Filters' : 'Xóa Bộ Lọc'}</Button>
                            )}
                        />
                    </Card>
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
                            onAcctReject={() => handleAcctReject(row.id)}
                            onCancel={() => handleCancel(row.id)}
                            onClone={() => handleClone(row.id)}
                            canApprove={((isSaleAdminOrMgr && row.approvalStep === 1) || (isCEO && row.approvalStep === 2) || (!row.approvalStep && (isCEO || isSaleAdminOrMgr)))}
                            canAcctApprove={canAcctApprove}
                            actionLoading={actionLoading}
                        />
                    ))
                )}
            </div>

            <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={handlePageChange}
                onPageSizeChange={newSize => {
                    setPageSize(newSize)
                    setPage(1)
                    reload({ pageSize: newSize, page: 1 }, true)
                }}
                itemLabel={isEn ? 'orders' : 'đơn hàng'}
                isEn={isEn}
            />

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
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 rounded-2xl bg-white border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
                                <ShieldCheck size={18} />
                            </span>
                            {isEn ? 'Accounting Order Approval' : 'Kế Toán Duyệt Đơn'}
                        </h3>
                        <div className="mb-5">
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                                {isEn ? 'Invoicing Legal Entity' : 'Pháp Nhân Xuất Hoá Đơn'}
                            </label>
                            <select
                                value={acctEntityId}
                                onChange={e => setAcctEntityId(e.target.value)}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 shadow-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                            >
                                <option value="">{isEn ? '— Select entity —' : '— Chưa chọn —'}</option>
                                {legalEntities.map(e => (
                                    <option key={e.id} value={e.id}>{e.name} ({e.code}) — {e.code === 'TA' ? (isEn ? 'Import' : 'Nhập Khẩu') : (isEn ? 'Distribution' : 'Phân Phối')}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setAcctModalId(null)}
                                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                                {isEn ? 'Cancel' : 'Huỷ'}
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!acctEntityId) return toast.error(isEn ? 'Please select a legal entity' : 'Vui lòng chọn pháp nhân')
                                    setActionLoading(acctModalId)
                                    toast.promise(acctApproveMutation.mutateAsync({ id: acctModalId, legalEntityId: acctEntityId }).then(() => {
                                        setAcctModalId(null)
                                        if (detailId === acctModalId) setDetailId(null)
                                        reload()
                                    }), {
                                        loading: isEn ? 'Approving...' : 'Đang duyệt...',
                                        success: isEn ? 'Accounting approved — status changed to CONFIRMED!' : 'KT duyệt thành công — chuyển CONFIRMED!',
                                        error: (e: any) => `${isEn ? 'Error:' : 'Lỗi:'} ${e.message}`,
                                        finally: () => setActionLoading(null),
                                    })
                                }}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-sm cursor-pointer"
                            >
                                <CheckCircle2 size={14} /> {isEn ? 'Approve & Confirm' : 'Duyệt & Xác Nhận'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {confirmDialog}
        </div>
    )
}

// ── Approve SO Modal with Vintage Selection ──────
function ApproveSOModal({ soId, onClose, onApproved }: ApproveSOModalProps) {
    const { isEn } = useAppLocale()
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
                toast.error(isEn ? 'Error loading order details: ' + err.message : 'Lỗi khi tải chi tiết đơn hàng: ' + err.message)
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
            toast.error(isEn ? 'Please select fulfillment warehouse' : 'Vui lòng chọn Kho xuất hàng')
            return
        }

        const vintagesList: { lineId: string; vintage: number }[] = []
        for (const line of detail.lines) {
            const avail = availableVintages[line.productId] || []
            const selected = selectedVintages[line.id]
            if (avail.length > 0 && !selected) {
                toast.error(isEn ? `Please specify Vintage for: ${line.product.productName}` : `Vui lòng chỉ định Vintage cho: ${line.product.productName}`)
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
                toast.success(isEn ? 'Order approved successfully!' : 'Đã duyệt đơn hàng thành công!')
                onApproved()
            } else {
                toast.error(res.error || (isEn ? 'Error approving order' : 'Lỗi khi duyệt đơn'))
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'System error' : 'Lỗi hệ thống'))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg p-6 rounded-2xl bg-white border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
                            <CheckCircle2 size={18} />
                        </span>
                        {isEn ? 'Approve Order & Assign Vintage' : 'Duyệt Đơn Hàng & Chỉ Định Vintage'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-sm text-slate-500">
                        <Loader2 size={24} className="animate-spin text-teal-600" />
                        {isEn ? 'Loading product info and stock...' : 'Đang tải thông tin sản phẩm và tồn kho...'}
                    </div>
                ) : !detail ? (
                    <p className="text-center py-8 text-sm text-slate-500">
                        {isEn ? 'Order not found' : 'Không tìm thấy đơn hàng'}
                    </p>
                ) : (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500">
                            {isEn ? 'SO No:' : 'Mã đơn:'} <span className="font-bold text-teal-600">{detail.soNo}</span> · {isEn ? 'Customer:' : 'Khách hàng:'} <span className="font-semibold text-slate-900">{detail.customer.name}</span>
                        </p>

                        {/* Warehouse selector */}
                        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-amber-900">
                                {isEn ? 'Fulfillment Warehouse *' : 'Kho Xuất Bán Hàng *'} ({isEn ? 'Legal Entity:' : 'Pháp nhân:'} {detail.legalEntity?.name || detail.legalEntity?.code || '—'})
                            </label>
                            <select
                                value={selectedWarehouseId}
                                onChange={e => setSelectedWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 shadow-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none font-medium"
                            >
                                <option value="">{isEn ? '— Select warehouse —' : '— Chọn kho xuất hàng —'}</option>
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
                                                    ? `${w.isDefault ? (isEn ? '[Default Warehouse]' : '[Kho Mặc Định]') : (isEn ? '[Sales Warehouse]' : '[Kho Xuất Bán]')} ${w.code} — ${w.name}`
                                                    : `${isEn ? '[Transfer Only - No Sales]' : '[Chỉ Điều Chuyển - Không Xuất Bán]'} ${w.code} — ${w.name}`
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
                                    <div key={line.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold truncate text-slate-900" title={line.product.productName}>
                                                    {line.product.productName}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                                    SKU: {line.product.skuCode} · {isEn ? 'Qty:' : 'Số lượng:'} {Number(line.qtyOrdered)}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] uppercase font-semibold text-slate-600 whitespace-nowrap">
                                                Vintage *
                                            </label>
                                            {avail.length > 0 ? (
                                                <select
                                                    value={selectedVintages[line.id] || ''}
                                                    onChange={e => {
                                                        const val = Number(e.target.value)
                                                        setSelectedVintages(prev => ({ ...prev, [line.id]: val }))
                                                    }}
                                                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                >
                                                    <option value="">{isEn ? '— Select available vintage —' : '— Chọn Vintage khả dụng —'}</option>
                                                    {avail.map(v => (
                                                        <option key={v} value={v}>{v}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] bg-slate-100 text-slate-500 border border-dashed border-slate-300">
                                                    {isEn ? 'Non-vintage (No vintage or Out of stock)' : 'Không Vintage (Sản phẩm không Vintage hoặc Hết tồn kho)'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {isEn ? 'Cancel' : 'Huỷ'}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={submitting}
                                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50"
                            >
                                {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                {submitting ? (isEn ? 'Approving...' : 'Đang duyệt...') : (isEn ? 'Confirm Approval' : 'Xác Nhận Duyệt Đơn')}
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
