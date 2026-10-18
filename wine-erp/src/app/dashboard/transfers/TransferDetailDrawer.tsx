'use client'

import { useState, useEffect } from 'react'
import { X, Printer, CheckCircle2, ArrowRightLeft, ArrowRight, Clock, Building2, Calendar, FileText, Check, ShieldAlert, Truck, PackageCheck, AlertCircle, AlertTriangle, Loader2, MapPin, Layers, Boxes, ListChecks, RotateCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
    type TransferOrderDetail,
    type TransferPickingItem,
    getTransferDetail,
    getTransferPickingLocations,
    accountingApproveTransfer,
    accountingRejectTransfer,
    dispatchTransferOrder,
    receiveTransferOrder,
    getWarehouseLocations,
    submitTransferForAccounting,
    updateTransferLineVintage,
    autoFixTransferVintages,
} from './actions'
import { formatDate, formatVND } from '@/lib/utils'
import { useAppLocale } from '@/lib/i18n'
import { getTransfersDict } from './i18n'

interface TransferDetailDrawerProps {
    transferId: string | null
    onClose: () => void
    onRefresh: () => void
    currentUserRoles?: string[]
}

const STATUS_MAP: Record<string, { label: string; labelEn: string; color: string; bg: string; border: string }> = {
    DRAFT: { label: 'Nháp (Chưa gửi)', labelEn: 'Draft (Unsent)', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
    PENDING_ACCOUNTING: { label: 'Chờ Kế Toán Duyệt', labelEn: 'Pending Accounting', color: '#B47816', bg: 'rgba(180,83,9,0.15)', border: '#F59E0B' },
    CONFIRMED: { label: 'Kế Toán Đã Duyệt (Sẵn sàng)', labelEn: 'Approved (Ready)', color: '#0284C7', bg: 'rgba(2,132,199,0.12)', border: '#38BDF8' },
    IN_TRANSIT: { label: 'Đang Vận Chuyển', labelEn: 'In Transit', color: '#2563EB', bg: 'rgba(37,99,235,0.12)', border: '#60A5FA' },
    RECEIVED: { label: 'Đã Nhận Hàng (Hoàn tất)', labelEn: 'Received (Completed)', color: '#16A34A', bg: 'rgba(22,163,74,0.12)', border: '#4ADE80' },
    CANCELLED: { label: 'Đã Hủy / Từ Chối', labelEn: 'Cancelled / Rejected', color: '#B91C1C', bg: 'rgba(185,28,28,0.12)', border: '#B91C1C' },
}

export function TransferDetailDrawer({ transferId, onClose, onRefresh, currentUserRoles = [] }: TransferDetailDrawerProps) {
    const { locale } = useAppLocale()
    const t = getTransfersDict(locale)
    const [loading, setLoading] = useState(false)
    const [detail, setDetail] = useState<TransferOrderDetail | null>(null)
    const [pickingLocations, setPickingLocations] = useState<TransferPickingItem[]>([])
    const [actionLoading, setActionLoading] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [showRejectInput, setShowRejectInput] = useState(false)
    const [printModalOpen, setPrintModalOpen] = useState(false)
    const [printDocType, setPrintDocType] = useState<'VOUCHER' | 'PICK_LIST'>('VOUCHER')
    const [activeTab, setActiveTab] = useState<'ITEMS' | 'PICKING'>('ITEMS')

    // Actual receipt verification state
    const [showReceiveModal, setShowReceiveModal] = useState(false)
    const [destLocations, setDestLocations] = useState<Array<{ id: string; locationCode: string; zone?: string | null; rack?: string | null }>>([])
    const [receiveLines, setReceiveLines] = useState<Array<{
        lineId: string
        productName: string
        skuCode: string
        vintage: number | null
        qtyTransferred: number
        qtyReceived: number
        locationId: string
    }>>([])
    const [receiptNotes, setReceiptNotes] = useState('')
    const [loadingLocations, setLoadingLocations] = useState(false)
    const [bulkLocationId, setBulkLocationId] = useState('')

    // Vintage editing states
    const [editingVintageLineId, setEditingVintageLineId] = useState<string | null>(null)
    const [selectedNewVintage, setSelectedNewVintage] = useState<string>('')
    const [vintageUpdating, setVintageUpdating] = useState(false)
    const [autoFixing, setAutoFixing] = useState(false)

    const loadData = async (id: string) => {
        setLoading(true)
        try {
            const [data, picks] = await Promise.all([
                getTransferDetail(id),
                getTransferPickingLocations(id),
            ])
            setDetail(data)
            setPickingLocations(picks)
        } catch (err: any) {
            toast.error('Lỗi tải chi tiết phiếu chuyển kho: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (transferId) loadData(transferId)
    }, [transferId])

    if (!transferId) return null

    const isAccountingOrAdmin = currentUserRoles.length === 0 || currentUserRoles.some(r => {
        const u = String(r).toUpperCase()
        return u.includes('KE_TOAN') || u.includes('ACCOUNT') || u.includes('KT') || u.includes('ADMIN') || u.includes('CEO') || u.includes('DIRECTOR') || u.includes('BOD') || u.includes('MANAGER') || u.includes('TOAN')
    })

    // Handle Kế Toán Approve
    const handleApprove = async () => {
        setActionLoading(true)
        try {
            const res = await accountingApproveTransfer(transferId)
            if (!res.success) throw new Error(res.error)
            toast.success('Đã phê duyệt Phiếu Chuyển Kho thành công')
            loadData(transferId)
            onRefresh()
        } catch (err: any) {
            toast.error('Lỗi duyệt phiếu: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    // Handle Kế Toán Reject
    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.error('Vui lòng nhập lý do từ chối')
            return
        }
        setActionLoading(true)
        try {
            const res = await accountingRejectTransfer(transferId, rejectReason)
            if (!res.success) throw new Error(res.error)
            toast.success('Đã từ chối phiếu chuyển kho')
            setShowRejectInput(false)
            loadData(transferId)
            onRefresh()
        } catch (err: any) {
            toast.error('Lỗi từ chối phiếu: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    // Handle Dispatch (Xuất Kho & Vận chuyển)
    const handleDispatch = async () => {
        setActionLoading(true)
        try {
            const res = await dispatchTransferOrder(transferId)
            if (!res.success) throw new Error(res.error)
            toast.success('Đã xuất kho & trừ tồn kho tại Kho Xuất thành công')
            loadData(transferId)
            onRefresh()
        } catch (err: any) {
            toast.error('Lỗi xuất kho: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    // Handle Receive (Nhận hàng tại Kho Đến)
    const openReceiveModal = async () => {
        if (!detail) return
        setLoadingLocations(true)
        try {
            const locs = await getWarehouseLocations(detail.toWarehouseId)
            setDestLocations(locs)
            const defaultLocId = locs[0]?.id || ''
            setBulkLocationId(defaultLocId)
            setReceiveLines(
                detail.lines.map(l => ({
                    lineId: l.id,
                    productName: l.productName,
                    skuCode: l.skuCode,
                    vintage: l.vintage,
                    qtyTransferred: l.qtyTransferred,
                    qtyReceived: l.qtyTransferred,
                    locationId: defaultLocId,
                }))
            )
            setReceiptNotes('')
            setShowReceiveModal(true)
        } catch (err: any) {
            toast.error('Lỗi tải vị trí kho nhận: ' + err.message)
        } finally {
            setLoadingLocations(false)
        }
    }

    const handleConfirmReceive = async () => {
        if (!transferId) return
        setActionLoading(true)
        try {
            const res = await receiveTransferOrder({
                transferOrderId: transferId,
                lines: receiveLines.map(r => ({
                    lineId: r.lineId,
                    qtyReceived: Number(r.qtyReceived),
                    locationId: r.locationId || undefined,
                })),
                receiptNotes,
            })
            if (!res.success) throw new Error(res.error)
            toast.success('Đã xác nhận kiểm đếm & nhận kho thành công')
            setShowReceiveModal(false)
            loadData(transferId)
            onRefresh()
        } catch (err: any) {
            toast.error('Lỗi nhận kho: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    const handleApplyBulkLocation = (locId: string) => {
        setBulkLocationId(locId)
        setReceiveLines(prev => prev.map(l => ({ ...l, locationId: locId })))
    }

    // Handle Submit Draft
    const handleSubmitDraft = async () => {
        setActionLoading(true)
        try {
            const res = await submitTransferForAccounting(transferId)
            if (!res.success) throw new Error(res.error)
            toast.success('Đã gửi Kế toán phê duyệt')
            loadData(transferId)
            onRefresh()
        } catch (err: any) {
            toast.error('Lỗi gửi duyệt: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }


    const handleUpdateVintage = async (lineId: string, vintageVal: string) => {
        if (!transferId) return
        setVintageUpdating(true)
        try {
            const vNum = vintageVal === 'NV' || vintageVal === '' ? null : parseInt(vintageVal, 10)
            const res = await updateTransferLineVintage({
                transferOrderId: transferId,
                lineId,
                newVintage: vNum,
            })
            if (res.success) {
                toast.success('Đã cập nhật niên vụ thành công')
                setEditingVintageLineId(null)
                await loadData(transferId)
                onRefresh()
            } else {
                toast.error(res.error || 'Lỗi đổi niên vụ')
            }
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message)
        } finally {
            setVintageUpdating(false)
        }
    }

    const handleAutoFixVintages = async () => {
        if (!transferId) return
        setAutoFixing(true)
        try {
            const res = await autoFixTransferVintages(transferId)
            if (res.success) {
                if (res.updatedCount && res.updatedCount > 0) {
                    toast.success(`Đã tự động khớp ${res.updatedCount} dòng sang niên vụ có sẵn tồn kho`)
                    await loadData(transferId)
                    onRefresh()
                } else {
                    toast.info('Tất cả các dòng đã có đủ tồn kho niên vụ hoặc không tìm thấy niên vụ thay thế.')
                }
            } else {
                toast.error(res.error || 'Lỗi tự động khớp niên vụ')
            }
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message)
        } finally {
            setAutoFixing(false)
        }
    }

    const st = detail ? (STATUS_MAP[detail.status] ?? STATUS_MAP.DRAFT) : STATUS_MAP.DRAFT
    const hasVintageMismatch = Boolean(
        detail &&
        ['DRAFT', 'PENDING_ACCOUNTING', 'CONFIRMED'].includes(detail.status) &&
        detail.lines.some(l => (l.vintageAvailableStock ?? 0) < l.qtyTransferred)
    )

    return (
        <>
            <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(15, 23, 42, 0.4)' }}>
                <div className="w-full max-w-3xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
                    style={{ background: '#FFFFFF', borderLeft: '1px solid #E2E8F0' }}>
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0" style={{ background: '#FFFFFF' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold" style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0F172A', border: '1px solid rgba(8, 145, 178, 0.25)' }}>
                                <ArrowRightLeft size={18} style={{ color: '#0F172A' }} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold" style={{ color: '#0F172A' }}>
                                    {t.detailTitle}: <span className="font-mono" style={{ color: '#B47816' }}>{detail?.transferNo || '...'}</span>
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                                        style={{ color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                                        {locale === 'en' ? st.labelEn : st.label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {detail && (
                                <button
                                    onClick={() => { setPrintDocType('VOUCHER'); setPrintModalOpen(true) }}
                                    className="px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700"
                                >
                                    <Printer size={15} /> {t.printVoucher}
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: '#64748B' }}>
                                <Loader2 size={32} className="animate-spin" style={{ color: '#B47816' }} />
                                <span className="text-xs font-bold">{t.loadingDetail}</span>
                            </div>
                        ) : detail ? (
                            <>
                                {/* Status Timeline Bar */}
                                <div className="p-4 rounded-lg space-y-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>
                                        {locale === 'en' ? 'Transfer Order Progress' : 'Tiến Trình Phiếu Chuyển Kho'}
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                                        <div className={`p-2 rounded-lg border font-bold ${['PENDING_ACCOUNTING', 'CONFIRMED', 'IN_TRANSIT', 'RECEIVED'].includes(detail.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            {locale === 'en' ? '1. Created' : '1. Lập Phiếu'}
                                        </div>
                                        <div className={`p-2 rounded-lg border font-bold ${['CONFIRMED', 'IN_TRANSIT', 'RECEIVED'].includes(detail.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : detail.status === 'PENDING_ACCOUNTING' ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            {locale === 'en' ? '2. Accounting' : '2. Kế Toán Duyệt'}
                                        </div>
                                        <div className={`p-2 rounded-lg border font-bold ${['IN_TRANSIT', 'RECEIVED'].includes(detail.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : detail.status === 'CONFIRMED' ? 'bg-sky-50 text-sky-800 border-sky-300' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            {locale === 'en' ? '3. Dispatched' : '3. Xuất Kho (Đi)'}
                                        </div>
                                        <div className={`p-2 rounded-lg border font-bold ${detail.status === 'RECEIVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            {locale === 'en' ? '4. Received' : '4. Nhận Kho (Đến)'}
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Action Box Based on Status & User Role */}
                                {detail.status === 'DRAFT' && (
                                    <div className="p-4 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                        <div>
                                            <p className="text-xs font-bold" style={{ color: '#0F172A' }}>
                                                {locale === 'en' ? 'Transfer Order is in Draft' : 'Phiếu đang ở trạng thái Nháp'}
                                            </p>
                                            <p className="text-[11px]" style={{ color: '#64748B' }}>
                                                {locale === 'en' ? 'Review the wine items carefully before submitting to Accounting for approval' : 'Vui lòng kiểm tra kỹ danh mục rượu trước khi gửi Kế toán phê duyệt'}
                                            </p>
                                        </div>
                                        <button
                                            disabled={actionLoading}
                                            onClick={handleSubmitDraft}
                                            className="px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs"
                                            style={{ background: '#0E7490', color: '#FFFFFF' }}
                                        >
                                            {locale === 'en' ? 'Submit for Accounting' : 'Gửi Kế Toán Duyệt'}
                                        </button>
                                    </div>
                                )}

                                {detail.status === 'PENDING_ACCOUNTING' && (
                                    <div className="p-4 rounded-lg space-y-3" style={{ background: 'rgba(180,83,9,0.1)', border: '1px solid rgba(180,83,9,0.3)' }}>
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#B47816' }}>
                                                    <Clock size={16} style={{ color: '#B47816' }} /> {locale === 'en' ? 'Pending Accounting Approval' : 'Cần Kế Toán Phê Duyệt Phiếu Chuyển Kho'}
                                                </p>
                                                <p className="text-[11px] mt-0.5" style={{ color: '#475569' }}>
                                                    {locale === 'en' ? 'Accounting verifies items, quantities & validity to approve this transfer' : 'Kế toán kiểm tra danh mục hàng hóa, số lượng & tính hợp lệ để xác nhận duyệt phiếu'}
                                                </p>
                                            </div>
                                            {isAccountingOrAdmin && !showRejectInput && (
                                                <div className="flex items-center gap-2 justify-end">
                                                    <button
                                                        onClick={() => setShowRejectInput(true)}
                                                        className="px-3.5 py-2 rounded-lg border border-rose-300 bg-white text-rose-700 font-bold text-xs hover:bg-rose-50 cursor-pointer"
                                                    >
                                                        {locale === 'en' ? 'Reject' : 'Từ Chối'}
                                                    </button>
                                                    <button
                                                        disabled={actionLoading}
                                                        onClick={handleApprove}
                                                        className="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                                                        style={{ background: '#0E7490', color: '#FFFFFF' }}
                                                    >
                                                        <Check size={15} /> {t.btnApprove}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {showRejectInput && (
                                            <div className="p-3 bg-white rounded-lg border border-rose-200 space-y-2">
                                                <input
                                                    type="text"
                                                    value={rejectReason}
                                                    onChange={e => setRejectReason(e.target.value)}
                                                    placeholder={locale === 'en' ? 'Enter reason for rejecting this transfer order...' : 'Nhập lý do từ chối phiếu chuyển kho này...'}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:border-rose-500"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setShowRejectInput(false)} className="inline-block px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg whitespace-nowrap shrink-0">{t.cancelBtn}</button>
                                                    <button onClick={handleReject} disabled={actionLoading} className="px-3.5 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700">{locale === 'en' ? 'Confirm Reject' : 'Xác Nhận Từ Chối'}</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {detail.status === 'CONFIRMED' && (
                                    <div className="p-4 rounded-lg bg-sky-50 border border-sky-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                                                <CheckCircle2 size={16} className="text-sky-600" /> {locale === 'en' ? 'Accounting Approved — Ready for Dispatch' : 'Kế toán đã phê duyệt — Sẵn sàng xuất kho'}
                                            </p>
                                            <p className="text-[11px] text-sky-700 mt-0.5">
                                                {locale === 'en' ? 'Print the A4 voucher for 4-party signatures and click Confirm Shipment' : 'Thủ kho xuất hàng bấm "In Phiếu A4" để ký nhận giấy & nhấp "Xuất Kho & Vận Chuyển"'}
                                            </p>
                                        </div>
                                        <button
                                            disabled={actionLoading}
                                            onClick={handleDispatch}
                                            className="px-4 py-2.5 rounded-lg bg-sky-600 text-white font-bold text-xs hover:bg-sky-700 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <Truck size={15} /> {t.btnConfirmShip}
                                        </button>
                                    </div>
                                )}

                                {detail.status === 'IN_TRANSIT' && (
                                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                                <Truck size={16} className="text-blue-600" /> {locale === 'en' ? 'Goods are currently In Transit' : 'Hàng đang vận chuyển trên đường'}
                                            </p>
                                            <p className="text-[11px] text-blue-700 mt-0.5">
                                                {locale === 'en' ? 'Upon arrival at Destination Warehouse, inspect physical bottles and click Inspect & Confirm Receipt' : 'Khi hàng đến Kho Nhận, Thủ kho kiểm đếm thực tế và bấm "Kiểm Đếm & Nhận Hàng"'}
                                            </p>
                                        </div>
                                        <button
                                            disabled={actionLoading || loadingLocations}
                                            onClick={openReceiveModal}
                                            className="px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                            style={{ background: '#0E7490', color: '#FFFFFF' }}
                                        >
                                            {loadingLocations ? <Loader2 size={15} className="animate-spin" /> : <PackageCheck size={15} />}
                                            {t.btnOpenReceiveModal}
                                        </button>
                                    </div>
                                )}

                                {/* Overview Metadata Summary Card - Sleek & Compact */}
                                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                                        <div className="flex items-center gap-2 font-semibold">
                                            <span className="text-rose-700 font-bold">{detail.fromWarehouse}</span>
                                            <ArrowRight size={14} className="text-slate-400 shrink-0" />
                                            <span className="text-emerald-700 font-bold">{detail.toWarehouse}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                                            <span>{detail.lines.length} {t.unitLine}</span>
                                            <span>•</span>
                                            <span className="font-bold text-emerald-700">{detail.lines.reduce((s, l) => s + Number(l.qtyTransferred), 0)} {t.unitBottle}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-slate-400">{t.requesterLabel}:</span>
                                            <span className="font-bold text-slate-800">{detail.requesterName}</span>
                                            <span className="text-slate-400 font-mono">({formatDate(detail.transferDate)})</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 sm:justify-end">
                                            <span className="text-slate-400">{locale === 'en' ? 'Accounting Approved:' : 'Kế toán duyệt:'}</span>
                                            {detail.accountingApprovedBy ? (
                                                <span className="font-bold text-emerald-700">
                                                    {detail.accountingApprovedBy} {detail.accountingApprovedAt && `(${formatDate(detail.accountingApprovedAt)})`}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 italic">{locale === 'en' ? 'Not approved yet' : 'Chưa phê duyệt'}</span>
                                            )}
                                        </div>
                                    </div>
                                    {detail.notes && (
                                        <div className="pt-1 text-[11px] text-slate-600 border-t border-slate-200/60">
                                            <span className="font-bold text-slate-500 mr-1">{t.notesSectionTitle}:</span>
                                            <span>{detail.notes}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Navigation Tabs */}
                                <div className="flex items-center gap-2 border-b border-slate-200 pt-1 overflow-x-auto no-scrollbar whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('ITEMS')}
                                        className={`px-4 py-2.5 text-xs font-extrabold border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                                            activeTab === 'ITEMS'
                                                ? 'border-amber-500 text-amber-900 bg-amber-50/50 rounded-t-lg'
                                                : 'border-transparent text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        <Boxes size={15} className={activeTab === 'ITEMS' ? 'text-amber-600' : 'text-slate-400'} />
                                        <span>{t.tabItems}</span>
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                                            activeTab === 'ITEMS' ? 'bg-amber-200/80 text-amber-950' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {detail.lines.length}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('PICKING')}
                                        className={`px-4 py-2.5 text-xs font-extrabold border-b-2 flex items-center gap-2 transition cursor-pointer ${
                                            activeTab === 'PICKING'
                                                ? 'border-sky-500 text-sky-900 bg-sky-50/50 rounded-t-lg'
                                                : 'border-transparent text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        <MapPin size={15} className={activeTab === 'PICKING' ? 'text-sky-600' : 'text-slate-400'} />
                                        <span>{locale === 'en' ? 'Picking Locations (FIFO Pick List)' : 'Vị Trí Nhặt Hàng (Pick List)'}</span>
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                                            activeTab === 'PICKING' ? 'bg-sky-200/80 text-sky-950' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {pickingLocations.length}
                                        </span>
                                    </button>
                                </div>

                                {/* TAB 1: DANH SÁCH MẶT HÀNG */}
                                {activeTab === 'ITEMS' && (
                                    <div className="space-y-4">
                                        {/* Vintage Mismatch Warning Banner */}
                                        {hasVintageMismatch && (
                                            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                                                <div className="flex items-start gap-2.5 text-amber-900">
                                                    <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs font-bold text-amber-950">
                                                            {locale === 'en'
                                                                ? 'Vintage mismatch detected against physical stock at source warehouse!'
                                                                : 'Phát hiện Niên Vụ (Vintage) không khớp với tồn kho thực tế tại kho xuất!'}
                                                        </p>
                                                        <p className="text-[11px] text-amber-800 mt-0.5">
                                                            {locale === 'en'
                                                                ? 'Some lines request a vintage that is out of stock. Click "Auto-Match" to switch to an available vintage or update each line manually below.'
                                                                : 'Có sản phẩm đang yêu cầu niên vụ mà kho xuất đã hết hàng. Bạn có thể bấm "Tự Động Khớp" để hệ thống tự chuyển sang niên vụ có sẵn hàng, hoặc đổi thủ công từng dòng ở bảng bên dưới.'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={autoFixing}
                                                    onClick={handleAutoFixVintages}
                                                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
                                                >
                                                    {autoFixing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                                    {locale === 'en' ? 'Auto-match available vintage' : 'Tự động khớp niên vụ còn hàng'}
                                                </button>
                                            </div>
                                        )}

                                        {/* Line Items Table */}
                                        <div className="rounded-lg overflow-hidden shadow-2xs border border-slate-200 bg-white">
                                            {/* Desktop Table View (>= 768px) */}
                                            <div className="hidden md:block overflow-x-auto">
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead>
                                                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                                                            <th className="p-3 font-semibold uppercase text-[10px] w-10 text-center">{t.colStt}</th>
                                                            <th className="p-3 font-semibold uppercase text-[10px]">SKU</th>
                                                            <th className="p-3 font-semibold uppercase text-[10px]">{t.colProductInfo}</th>
                                                            <th className="p-3 font-semibold uppercase text-[10px] text-center">VTG</th>
                                                            <th className="p-3 font-semibold uppercase text-[10px] text-center">{t.colQtyTransferred}</th>
                                                            <th className="p-3 font-semibold uppercase text-[10px] text-right">{t.colUnitCost}</th>
                                                            <th className="p-3 font-semibold uppercase text-[10px] text-right">{t.colLineTotalCost}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                                                        {detail.lines.map((l, idx) => {
                                                            const isEditable = ['DRAFT', 'PENDING_ACCOUNTING', 'CONFIRMED'].includes(detail.status)
                                                            const isLowOrZeroStock = (l.vintageAvailableStock ?? 0) < l.qtyTransferred

                                                            return (
                                                                <tr key={l.id} className={`hover:bg-slate-50 ${isEditable && isLowOrZeroStock ? 'bg-amber-50/40' : ''}`}>
                                                                    <td className="p-3 text-center font-bold" style={{ color: '#64748B' }}>{idx + 1}</td>
                                                                    <td className="p-3 font-mono font-bold" style={{ color: '#B47816' }}>{l.skuCode}</td>
                                                                    <td className="p-3 font-bold" style={{ color: '#0F172A' }}>{l.productName}</td>
                                                                    <td className="p-3 text-center font-mono">
                                                                        {editingVintageLineId === l.id ? (
                                                                            <div className="flex items-center gap-1 justify-center">
                                                                                <select
                                                                                    value={selectedNewVintage}
                                                                                    onChange={e => setSelectedNewVintage(e.target.value)}
                                                                                    className="px-2 py-1 text-base sm:text-xs rounded border border-slate-300 bg-white text-slate-900 font-mono shadow-2xs outline-none focus:border-amber-500"
                                                                                >
                                                                                    {l.availableVintages && l.availableVintages.length > 0 ? (
                                                                                        l.availableVintages.map(v => (
                                                                                            <option key={v.vintage ?? 'NV'} value={v.vintage !== null && v.vintage !== undefined ? String(v.vintage) : 'NV'}>
                                                                                                {v.vintage ? `VTG ${v.vintage}` : 'NV'} ({v.qtyAvailable})
                                                                                            </option>
                                                                                        ))
                                                                                    ) : (
                                                                                        <option value="NV">{locale === 'en' ? 'Out of stock' : 'Kho hết hàng'}</option>
                                                                                    )}
                                                                                </select>
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={vintageUpdating}
                                                                                    onClick={() => handleUpdateVintage(l.id, selectedNewVintage)}
                                                                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                                                                >
                                                                                    {vintageUpdating ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setEditingVintageLineId(null)}
                                                                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                                                                >
                                                                                    <X size={13} />
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex flex-col items-center gap-0.5">
                                                                                <div className="flex items-center gap-1.5 font-bold">
                                                                                    <span style={{ color: isEditable && isLowOrZeroStock ? '#B91C1C' : '#475569' }}>
                                                                                        {l.vintage || 'NV'}
                                                                                    </span>
                                                                                    {isEditable && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setEditingVintageLineId(l.id)
                                                                                                const candidate = l.availableVintages?.find(v => v.qtyAvailable >= l.qtyTransferred)?.vintage
                                                                                                setSelectedNewVintage(
                                                                                                    candidate !== undefined
                                                                                                        ? (candidate !== null ? String(candidate) : 'NV')
                                                                                                        : (l.vintage !== null && l.vintage !== undefined ? String(l.vintage) : 'NV')
                                                                                                )
                                                                                            }}
                                                                                            className="px-1.5 py-0.5 text-[10px] font-sans font-semibold rounded bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors flex items-center gap-1 cursor-pointer"
                                                                                        >
                                                                                            <RotateCw size={10} /> {locale === 'en' ? 'Change' : 'Đổi'}
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                {isEditable && isLowOrZeroStock && (
                                                                                    <span className="text-[10px] text-rose-600 bg-rose-50 px-1 py-0.5 rounded font-semibold whitespace-nowrap border border-rose-100">
                                                                                        {l.vintageAvailableStock ?? 0} {t.unitBottle}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-3 text-center font-mono font-bold" style={{ color: '#B47816' }}>{l.qtyTransferred} {t.unitBottle}</td>
                                                                    <td className="p-3 text-right font-mono" style={{ color: '#64748B' }}>{formatVND(l.unitCost)}</td>
                                                                    <td className="p-3 text-right font-mono font-bold" style={{ color: '#0F172A' }}>{formatVND(l.totalValue)}</td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                                                            <td colSpan={4} className="p-3 text-right uppercase text-[10px] text-slate-500 font-bold">
                                                                {t.totalValFooter} ({detail.lines.length} {t.unitLine}):
                                                            </td>
                                                            <td className="p-3 text-center font-mono font-extrabold text-amber-700">
                                                                {detail.lines.reduce((s, l) => s + Number(l.qtyTransferred), 0)} {t.unitBottle}
                                                            </td>
                                                            <td></td>
                                                            <td className="p-3 text-right font-mono font-extrabold text-slate-900">
                                                                {formatVND(detail.lines.reduce((s, l) => s + Number(l.totalValue || 0), 0))}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>

                                            {/* Mobile Card View (< 768px) */}
                                            <div className="block md:hidden p-3 space-y-3">
                                                {detail.lines.map((l, idx) => {
                                                    const isEditable = ['DRAFT', 'PENDING_ACCOUNTING', 'CONFIRMED'].includes(detail.status)
                                                    const isLowOrZeroStock = (l.vintageAvailableStock ?? 0) < l.qtyTransferred

                                                    return (
                                                        <div key={l.id} className="p-3 rounded-lg border border-slate-200 bg-white shadow-xs space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-bold text-slate-500 font-mono">#{idx + 1}</span>
                                                                    <span className="inline-block text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 whitespace-nowrap shrink-0">
                                                                        {l.skuCode}
                                                                    </span>
                                                                </div>
                                                                <span className="inline-block text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
                                                                    VTG: {l.vintage || 'NV'}
                                                                </span>
                                                            </div>
                                                            <p className="font-bold text-slate-900 text-xs leading-snug">
                                                                {l.productName}
                                                            </p>
                                                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
                                                                <span className="text-slate-500">{t.colQtyTransferred}:</span>
                                                                <span className="font-mono font-bold text-amber-800 text-sm">
                                                                    {l.qtyTransferred} {t.unitBottle}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-slate-500">{t.colUnitCost}:</span>
                                                                <span className="font-mono text-slate-700">
                                                                    {formatVND(l.unitCost)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 font-bold">
                                                                <span className="text-slate-900">{t.colLineTotalCost}:</span>
                                                                <span className="font-mono text-slate-900">
                                                                    {formatVND(l.totalValue)}
                                                                </span>
                                                            </div>
                                                            {isEditable && isLowOrZeroStock && (
                                                                <div className="text-[10px] text-rose-600 bg-rose-50 p-1.5 rounded font-semibold border border-rose-200">
                                                                    {locale === 'en' ? `Stock alert: ${l.vintageAvailableStock ?? 0} btls available` : `Cảnh báo tồn: Lô còn ${l.vintageAvailableStock ?? 0} chai`}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-bold">
                                                    <span>{t.totalValFooter} ({detail.lines.length} {t.unitLine}):</span>
                                                    <span className="font-mono text-amber-800 text-sm">
                                                        {detail.lines.reduce((s, l) => s + Number(l.qtyTransferred), 0)} {t.unitBottle}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick link to Picking tab */}
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-sky-50/70 border border-sky-200 text-xs">
                                            <div className="flex items-center gap-2 text-sky-900">
                                                <MapPin size={15} className="text-sky-600 shrink-0" />
                                                <span>{locale === 'en' ? 'Need to check bin/pallet picking locations at source warehouse?' : 'Cần kiểm tra vị trí kệ/pallet nhặt hàng tại kho xuất?'}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('PICKING')}
                                                className="font-bold text-sky-700 hover:text-sky-900 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                                            >
                                                <span>{locale === 'en' ? 'View Pick List' : 'Xem vị trí nhặt hàng'}</span>
                                                <ArrowRight size={13} className="shrink-0" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: VỊ TRÍ NHẶT HÀNG (FIFO PICK LIST) */}
                                {activeTab === 'PICKING' && (
                                    <div className="space-y-4">
                                        {(() => {
                                            const isReceived = detail.status === 'RECEIVED'
                                            const isInTransit = detail.status === 'IN_TRANSIT'
                                            const isCancelled = detail.status === 'CANCELLED'
                                            const isDispatchedOrDone = isReceived || isInTransit

                                            if (isCancelled) {
                                                return (
                                                    <div className="p-4 rounded-lg space-y-2 bg-rose-50 border border-rose-200">
                                                        <div className="flex items-center gap-2 text-rose-800">
                                                            <ShieldAlert size={16} className="text-rose-600" />
                                                            <h4 className="text-xs font-extrabold uppercase tracking-wide">
                                                                {locale === 'en' ? 'Transfer Order Cancelled / Rejected' : 'Phiếu Chuyển Kho Đã Hủy / Bị Từ Chối'}
                                                            </h4>
                                                        </div>
                                                        <p className="text-xs text-rose-700">
                                                            {locale === 'en' ? 'This transfer order is no longer valid. Goods were not dispatched.' : 'Phiếu chuyển kho này không còn hiệu lực. Hàng hóa chưa hoặc không được xuất kho.'}
                                                        </p>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div
                                                    className="p-4 rounded-lg space-y-3"
                                                    style={
                                                        isReceived
                                                            ? { background: '#F0FDF4', border: '1px solid #BBF7D0' }
                                                            : isInTransit
                                                            ? { background: '#EFF6FF', border: '1px solid #BFDBFE' }
                                                            : { background: '#F0F9FF', border: '1px solid #BAE6FD' }
                                                    }
                                                >
                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                        <div className="flex items-center gap-2">
                                                            {isReceived ? (
                                                                <PackageCheck size={18} className="text-emerald-600 shrink-0" />
                                                            ) : isInTransit ? (
                                                                <Truck size={18} className="text-blue-600 shrink-0" />
                                                            ) : (
                                                                <MapPin size={16} className="text-sky-600 shrink-0" />
                                                            )}
                                                            <div>
                                                                <h4
                                                                    className={`text-xs font-extrabold uppercase tracking-wide ${
                                                                        isReceived ? 'text-emerald-950' : isInTransit ? 'text-blue-950' : 'text-sky-950'
                                                                    }`}
                                                                >
                                                                    {isReceived
                                                                        ? (locale === 'en' ? 'Picking Status: Dispatched & Received in Full' : 'Trạng Thái Nhặt Hàng: Đã Xuất Kho & Nhập Kho Hoàn Tất')
                                                                        : isInTransit
                                                                        ? (locale === 'en' ? `Picking Status: Dispatched (${detail.fromWarehouse}) — In Transit` : `Trạng Thái Nhặt Hàng: Đã Xuất Kho (${detail.fromWarehouse}) — Đang Vận Chuyển`)
                                                                        : (locale === 'en' ? `FIFO Pick List Suggestions at ${detail.fromWarehouse}` : `Gợi Ý Vị Trí Nhặt Hàng (Pick List FIFO tại ${detail.fromWarehouse})`)}
                                                                </h4>
                                                                <p className="text-[11px] text-slate-600 mt-0.5">
                                                                    {isReceived
                                                                        ? (locale === 'en' ? `All goods were dispatched from ${detail.fromWarehouse} and received into ${detail.toWarehouse}.` : `Toàn bộ hàng đã được xuất thành công từ ${detail.fromWarehouse} và nhập đủ vào ${detail.toWarehouse}.`)
                                                                        : isInTransit
                                                                        ? (locale === 'en' ? `Stock deducted from ${detail.fromWarehouse}, currently in transit to ${detail.toWarehouse}.` : `Hàng đã được trừ tồn tại ${detail.fromWarehouse}, đang trên đường chuyển đến ${detail.toWarehouse}.`)
                                                                        : (locale === 'en' ? 'Available stock lots ordered by FIFO at source warehouse.' : 'Vị trí các lô hàng khả dụng theo nguyên tắc FIFO tại kho xuất.')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => { setPrintDocType('PICK_LIST'); setPrintModalOpen(true) }}
                                                            className={`px-2.5 py-1 text-[11px] font-bold rounded text-white flex items-center gap-1 shadow-2xs cursor-pointer ${
                                                                isReceived ? 'bg-emerald-600 hover:bg-emerald-700' : isInTransit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-sky-600 hover:bg-sky-700'
                                                            }`}
                                                        >
                                                            <Printer size={12} /> {t.printPickList}
                                                        </button>
                                                    </div>

                                                    {pickingLocations.length === 0 ? (
                                                        <p className="text-xs text-slate-500 italic">{t.loadingDetail}</p>
                                                    ) : (
                                                        <div className="space-y-2.5">
                                                            {pickingLocations.map(p => (
                                                                <div
                                                                    key={p.productId}
                                                                    className={`p-3 bg-white rounded-lg shadow-2xs space-y-2 border ${
                                                                        isReceived ? 'border-emerald-200' : isInTransit ? 'border-blue-200' : 'border-sky-200'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center justify-between flex-wrap gap-1">
                                                                        <div>
                                                                            <span className="font-mono font-bold text-amber-700 text-xs mr-1.5">[{p.skuCode}]</span>
                                                                            <span className="font-bold text-slate-900 text-xs">{p.productName}</span>
                                                                            {p.vintageRequested && (
                                                                                <span className="ml-2 font-mono text-[10px] text-slate-500 font-semibold">
                                                                                    ({p.vintageRequested})
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[11px] font-mono font-bold text-slate-900">
                                                                                {locale === 'en' ? 'Requested:' : 'Yêu cầu:'} {p.qtyRequested} {t.unitBottle}
                                                                            </span>
                                                                            {isReceived ? (
                                                                                <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                                                                                    <CheckCircle2 size={10} /> {t.statusReceived} ({p.qtyRequested})
                                                                                </span>
                                                                            ) : isInTransit ? (
                                                                                <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                                                                                    <Truck size={10} /> {t.statusInTransit} ({p.qtyRequested})
                                                                                </span>
                                                                            ) : p.isSufficient ? (
                                                                                <span className="inline-block px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-700 whitespace-nowrap shrink-0">
                                                                                    FIFO OK ({p.totalAvailableInWH} {t.unitBottle})
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-block px-2 py-0.5 text-[9px] font-bold rounded bg-rose-100 text-rose-700 whitespace-nowrap shrink-0">
                                                                                    {t.statusShortage} ({p.totalAvailableInWH} {t.unitBottle})
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Locations list or Completed Status */}
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                                                                        {isDispatchedOrDone && p.pickingLocations.length === 0 ? (
                                                                            <div
                                                                                className={`p-2 rounded text-xs flex items-center gap-2 col-span-2 ${
                                                                                    isReceived
                                                                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                                                                        : 'bg-blue-50 text-blue-800 border border-blue-100'
                                                                                }`}
                                                                            >
                                                                                {isReceived ? (
                                                                                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                                                                ) : (
                                                                                    <Truck size={14} className="text-blue-600 shrink-0" />
                                                                                )}
                                                                                <span>
                                                                                    {locale === 'en'
                                                                                        ? `Dispatched ${p.qtyRequested} btls in full from ${detail.fromWarehouse}.`
                                                                                        : `Đã xuất kho đủ ${p.qtyRequested} chai từ ${detail.fromWarehouse}.`}
                                                                                </span>
                                                                            </div>
                                                                        ) : p.pickingLocations.length === 0 ? (
                                                                            <div className="text-[11px] text-rose-600 font-semibold col-span-2">
                                                                                {t.noStockInWarehouse}
                                                                            </div>
                                                                        ) : (
                                                                            p.pickingLocations.map((loc, i) => (
                                                                                <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-xs">
                                                                                    <div className="space-y-0.5">
                                                                                        <div className="flex items-center gap-1 font-mono font-extrabold text-slate-900">
                                                                                            <Layers size={12} className="text-sky-600" />
                                                                                            <span>{locale === 'en' ? 'Bin:' : 'Kệ/Vị trí:'} <span className="text-blue-700 font-bold">{loc.locationCode}</span></span>
                                                                                        </div>
                                                                                        <div className="text-[10px] text-slate-500 font-mono">
                                                                                            Lot: {loc.lotNo} {loc.vintage ? `· VTG ${loc.vintage}` : ''}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-right font-mono">
                                                                                        <span className="font-bold text-emerald-700 text-xs block">
                                                                                            {isDispatchedOrDone ? (locale === 'en' ? 'Picked' : 'Đã nhặt') : (locale === 'en' ? 'Pick' : 'Nhặt')} {loc.qtyToPick} {t.unitBottle}
                                                                                        </span>
                                                                                        <span className="text-[10px] text-slate-400">
                                                                                            {locale === 'en' ? `Bin avail: ${loc.qtyAvailable}` : `Tồn kệ: ${loc.qtyAvailable}`}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="p-12 text-center text-slate-400">{t.notFoundDetail}</div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setPrintDocType('VOUCHER'); setPrintModalOpen(true) }}
                                className="px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#0F172A' }}
                            >
                                <Printer size={14} /> {t.printVoucher}
                            </button>
                            <button
                                onClick={() => { setPrintDocType('PICK_LIST'); setPrintModalOpen(true) }}
                                className="px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                style={{ background: '#E0F2FE', border: '1px solid #7DD3FC', color: '#0369A1' }}
                            >
                                <MapPin size={14} /> {t.printPickList}
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-lg text-xs font-semibold transition-all"
                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#64748B' }}
                        >
                            {t.closeBtn}
                        </button>
                    </div>
                </div>
            </div>

            {/* Printable A4 Modal for signing and picking */}
            {printModalOpen && detail && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print-modal print:block print:p-0 print:bg-transparent">
                    <div className="bg-white border border-slate-200 rounded-lg max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:shadow-none print:border-none print:max-h-none print:bg-white print:m-0 print:w-full print:max-w-none">
                        {/* Header bar (Non-printable) */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white print:hidden">
                            <div className="flex items-center gap-3">
                                <div className="flex p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                                    <button
                                        onClick={() => setPrintDocType('VOUCHER')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition-colors ${printDocType === 'VOUCHER' ? 'bg-[#0E7490] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Phiếu Chuyển Kho A4
                                    </button>
                                    <button
                                        onClick={() => setPrintDocType('PICK_LIST')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition-colors ${printDocType === 'PICK_LIST' ? 'bg-[#38BDF8] text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Danh Sách Nhặt Hàng (Pick List)
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded transition-colors shadow cursor-pointer"
                                >
                                    <Printer size={14} /> In / Xuất PDF
                                </button>
                                <button
                                    onClick={() => setPrintModalOpen(false)}
                                    className="p-1 text-slate-400 hover:text-slate-900 rounded bg-slate-50 cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Invoice Content Area */}
                        <div className="p-0 bg-white text-black font-sans w-full h-full overflow-y-auto print:overflow-visible">
                            <div className="max-w-[850px] mx-auto p-4 sm:p-12 print:p-0 print:max-w-none">

                                {printDocType === 'VOUCHER' ? (
                                    <>
                                        {/* Print Header - Dynamic Company Info from Source Warehouse */}
                                        <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
                                            <div>
                                                <h2 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                                                    {detail.fromWarehouseEntity?.companyName || detail.fromWarehouse || "CÔNG TY CỔ PHẦN LYS CELLARS"}
                                                </h2>
                                                <p className="text-[10px] text-slate-700 leading-snug mt-0.5">
                                                    Địa chỉ: {detail.fromWarehouseEntity?.address || "15 Giang Văn Minh, Phường Đội Cấn, Q. Ba Đình, TP. Hà Nội"}<br />
                                                    MST: {detail.fromWarehouseEntity?.taxId || "0109579480"} &nbsp;|&nbsp; 
                                                    SĐT: {detail.fromWarehouseEntity?.phone || "024.3933.8888"} &nbsp;|&nbsp; 
                                                    Email: {detail.fromWarehouseEntity?.email || "accounting@lyscellars.com"}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <h1 className="text-xl font-bold uppercase tracking-wider mb-0.5 text-black">
                                                    PHIẾU CHUYỂN KHO NỘI BỘ
                                                </h1>
                                                <p className="text-xs font-bold font-mono text-slate-900">Mã: {detail.transferNo}</p>
                                                <p className="text-[9px] text-slate-600 mt-0.5">Ngày lập: {formatDate(detail.createdAt)}</p>
                                            </div>
                                        </div>

                                        {/* Transfer Route & Detail Grid */}
                                        <div className="grid grid-cols-2 gap-4 mb-3 text-xs leading-tight">
                                            <div>
                                                <h3 className="font-bold border-b border-slate-300 pb-0.5 mb-1.5 text-slate-800 uppercase tracking-wide text-[10px]">Tuyến đường chuyển kho</h3>
                                                <table className="w-full text-[10px]">
                                                    <tbody>
                                                        <tr>
                                                            <td className="text-slate-600 pr-2 w-24 py-0.5">Kho xuất (Kho đi):</td>
                                                            <td className="font-semibold text-slate-900 py-0.5">{detail.fromWarehouse}</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="text-slate-600 pr-2 py-0.5">Kho nhận (Kho đến):</td>
                                                            <td className="font-semibold text-slate-900 py-0.5">{detail.toWarehouse}</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="text-slate-600 pr-2 py-0.5">Người lập phiếu:</td>
                                                            <td className="py-0.5 text-slate-900">{detail.requesterName}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div>
                                                <h3 className="font-bold border-b border-slate-300 pb-0.5 mb-1.5 text-slate-800 uppercase tracking-wide text-[10px]">Thông tin phê duyệt</h3>
                                                <table className="w-full text-[10px]">
                                                    <tbody>
                                                        <tr>
                                                            <td className="text-slate-600 pr-2 w-28 py-0.5">Ngày chuyển dự kiến:</td>
                                                            <td className="font-semibold text-slate-900 py-0.5">{formatDate(detail.transferDate)}</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="text-slate-600 pr-2 py-0.5">Kế toán phê duyệt:</td>
                                                            <td className="py-0.5 text-slate-900 font-semibold">{detail.accountingApprovedBy || 'Đã duyệt'}</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="text-slate-600 pr-2 py-0.5">Trạng thái phiếu:</td>
                                                            <td className="py-0.5 font-bold text-slate-900">{detail.status}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Ghi chú / Lý do chuyển kho */}
                                        {detail.notes && (
                                            <div className="mb-3 text-[10px] p-2 bg-slate-50 border border-slate-300 rounded leading-relaxed">
                                                <span className="font-bold text-slate-900 uppercase">Lý do / Diễn giải chuyển kho: </span>
                                                <span className="text-slate-800 italic">{detail.notes}</span>
                                            </div>
                                        )}

                                        {/* Product Lines Table */}
                                        <table className="w-full text-[10px] mb-3 border-collapse border border-slate-300">
                                            <thead>
                                                <tr className="bg-white text-black font-bold border-b-2 border-slate-800">
                                                    <td className="px-2 py-1.5 text-center w-8 border-r border-slate-300">STT</td>
                                                    <td className="px-2 py-1.5 w-28 border-r border-slate-300">Mã SKU</td>
                                                    <td className="px-2 py-1.5 border-r border-slate-300">Tên sản phẩm / Rượu vang</td>
                                                    <td className="px-2 py-1.5 text-center w-12 border-r border-slate-300">VTG</td>
                                                    <td className="px-2 py-1.5 text-right w-20 border-r border-slate-300">Số lượng</td>
                                                    <td className="px-2 py-1.5 text-right w-28 border-r border-slate-300">Đơn giá vốn</td>
                                                    <td className="px-2 py-1.5 text-right w-32">Thành tiền</td>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.lines.map((line, idx) => (
                                                    <tr key={line.id} className="border-b border-slate-200 align-middle">
                                                        <td className="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200">{idx + 1}</td>
                                                        <td className="px-2 py-1.5 font-mono font-semibold text-[10px] text-slate-900 border-r border-slate-200">{line.skuCode}</td>
                                                        <td className="px-2 py-1.5 border-r border-slate-200 font-semibold text-slate-900">
                                                            {line.productName}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center font-mono text-slate-600 border-r border-slate-200">{line.vintage || 'NV'}</td>
                                                        <td className="px-2 py-1.5 text-right font-mono font-semibold tabular-nums text-slate-900 border-r border-slate-200">{line.qtyTransferred} chai</td>
                                                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-900 border-r border-slate-200">{formatVND(line.unitCost)}</td>
                                                        <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums text-slate-900">{formatVND(line.totalValue)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Totals Section */}
                                        <div className="flex justify-end mb-3 break-inside-avoid print:break-inside-avoid">
                                            <table className="w-full sm:w-80 text-[11px] border-collapse">
                                                <tbody>
                                                    <tr className="border-b border-slate-200 font-semibold">
                                                        <td className="py-1 text-slate-700">Tổng số lượng rượu chuyển:</td>
                                                        <td className="py-1 text-right font-mono font-bold text-slate-900 tabular-nums">
                                                            {detail.totalQty} chai
                                                        </td>
                                                    </tr>
                                                    <tr className="font-bold border-t-2 border-black">
                                                        <td className="py-1.5 text-slate-900 text-xs">Tổng giá trị chuyển kho (giá vốn):</td>
                                                        <td className="py-1.5 text-right font-mono text-xs tabular-nums text-black">{formatVND(detail.totalValue)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Signatures */}
                                        <div className="grid grid-cols-4 gap-2 text-center text-xs mt-4 pt-2 border-t border-dashed border-slate-300 pb-4 break-inside-avoid print:break-inside-avoid">
                                            <div className="flex flex-col pb-12">
                                                <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Người lập phiếu</p>
                                                <p className="text-slate-400 italic text-[9px] mt-0.5">(Ký, ghi rõ họ tên)</p>
                                            </div>
                                            <div className="flex flex-col pb-12">
                                                <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Kế toán phê duyệt</p>
                                                <p className="text-slate-400 italic text-[9px] mt-0.5">(Ký, ghi rõ họ tên)</p>
                                            </div>
                                            <div className="flex flex-col pb-12">
                                                <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Thủ kho xuất (kho đi)</p>
                                                <p className="text-slate-400 italic text-[9px] mt-0.5">(Ký khi giao hàng)</p>
                                            </div>
                                            <div className="flex flex-col pb-12">
                                                <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Thủ kho nhận (kho đến)</p>
                                                <p className="text-slate-400 italic text-[9px] mt-0.5">(Ký khi nhận đủ hàng)</p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    /* Printable Pick List for warehouse picker */
                                    <>
                                        <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
                                            <div>
                                                <h2 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                                                    {detail.fromWarehouseEntity?.companyName || detail.fromWarehouse || "CÔNG TY CỔ PHẦN LYS CELLARS"}
                                                </h2>
                                                <p className="text-[10px] text-slate-700 leading-snug mt-0.5">
                                                    Kho xuất: <strong className="text-slate-900">{detail.fromWarehouse}</strong> &nbsp;|&nbsp;
                                                    Kho nhận: <strong className="text-slate-900">{detail.toWarehouse}</strong>
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <h1 className="text-lg font-bold uppercase tracking-wider mb-0.5 text-black">
                                                    DANH SÁCH NHẶT HÀNG (PICK LIST)
                                                </h1>
                                                <p className="text-xs font-bold font-mono text-slate-900">Phiếu: {detail.transferNo}</p>
                                                <p className="text-[9px] text-slate-600 mt-0.5">Ngày nhặt hàng: {formatDate(new Date())}</p>
                                            </div>
                                        </div>

                                        <div className="mb-3 text-[10px] p-2 bg-slate-100 border border-slate-300 rounded font-medium">
                                            <strong>Hướng dẫn thủ kho:</strong> Nhặt hàng theo thứ tự Vị trí Kệ (FIFO). Đánh dấu [x] khi đã nhặt xong từng vị trí.
                                        </div>

                                        {/* Picking Table */}
                                        <table className="w-full text-[10px] mb-4 border-collapse border border-slate-400">
                                            <thead>
                                                <tr className="bg-slate-200 text-black font-bold border-b-2 border-slate-800">
                                                    <td className="px-2 py-1.5 text-center w-8 border-r border-slate-400">STT</td>
                                                    <td className="px-2 py-1.5 w-24 border-r border-slate-400">SKU Code</td>
                                                    <td className="px-2 py-1.5 border-r border-slate-400">Tên Rượu Vang</td>
                                                    <td className="px-2 py-1.5 text-center w-28 border-r border-slate-400 bg-sky-100">VỊ TRÍ KỆ (LOCATION)</td>
                                                    <td className="px-2 py-1.5 text-center w-28 border-r border-slate-400">MÃ LÔ (LOT NO)</td>
                                                    <td className="px-2 py-1.5 text-center w-12 border-r border-slate-400">VTG</td>
                                                    <td className="px-2 py-1.5 text-right w-16 border-r border-slate-400 bg-emerald-100">CẦN NHẶT</td>
                                                    <td className="px-2 py-1.5 text-center w-12 font-bold">XÁC NHẬN</td>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pickingLocations.flatMap(p => 
                                                    p.pickingLocations.length > 0 
                                                        ? p.pickingLocations.map((loc, idx) => ({ ...loc, skuCode: p.skuCode, productName: p.productName, isFirst: idx === 0, count: p.pickingLocations.length }))
                                                        : [{ lotId: '', lotNo: '—', locationId: '', locationCode: (detail.status === 'RECEIVED' || detail.status === 'IN_TRANSIT') ? 'Đã xuất kho' : 'Chưa xếp kệ', zone: '', rack: '', bin: '', vintage: p.vintageRequested, qtyAvailable: 0, qtyToPick: p.qtyRequested, skuCode: p.skuCode, productName: p.productName, isFirst: true, count: 1 }]
                                                ).map((row, idx) => (
                                                    <tr key={idx} className="border-b border-slate-300 align-middle">
                                                        <td className="px-2 py-2 text-center text-slate-600 border-r border-slate-300 font-mono">{idx + 1}</td>
                                                        <td className="px-2 py-2 font-mono font-bold text-slate-900 border-r border-slate-300">{row.skuCode}</td>
                                                        <td className="px-2 py-2 border-r border-slate-300 font-semibold text-slate-900">{row.productName}</td>
                                                        <td className="px-2 py-2 text-center font-mono font-extrabold text-blue-900 border-r border-slate-300 bg-sky-50">{row.locationCode}</td>
                                                        <td className="px-2 py-2 text-center font-mono text-slate-700 border-r border-slate-300">{row.lotNo}</td>
                                                        <td className="px-2 py-2 text-center font-mono text-slate-600 border-r border-slate-300">{row.vintage || 'NV'}</td>
                                                        <td className="px-2 py-2 text-right font-mono font-bold text-slate-900 border-r border-slate-300 bg-emerald-50">{row.qtyToPick} chai</td>
                                                        <td className="px-2 py-2 text-center font-bold text-slate-400">[ &nbsp; ]</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Total Summary & Signatures */}
                                        <div className="flex justify-between items-end mt-4 pt-2 border-t border-slate-300">
                                            <div className="text-xs font-bold">
                                                Tổng số mặt hàng: {detail.lines.length} SKU &nbsp;|&nbsp; Tổng số lượng nhặt: {detail.totalQty} chai
                                            </div>
                                            <div className="grid grid-cols-2 gap-8 text-center text-xs w-full sm:w-80">
                                                <div className="pb-12">
                                                    <p className="font-bold text-slate-800 uppercase text-[10px]">Thủ Kho Xuất Hàng</p>
                                                    <p className="text-slate-400 italic text-[9px]">(Ký & ghi rõ họ tên)</p>
                                                </div>
                                                <div className="pb-12">
                                                    <p className="font-bold text-slate-800 uppercase text-[10px]">Nhân Viên Nhặt Hàng</p>
                                                    <p className="text-slate-400 italic text-[9px]">(Ký xác nhận)</p>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Kiểm Đếm Thực Nhận & Chọn Vị Trí Kệ */}
            {showReceiveModal && detail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                                        <PackageCheck size={18} />
                                    </span>
                                    <h3 className="text-base font-bold text-slate-900">
                                        {t.receiveModalTitle}
                                    </h3>
                                </div>
                                <p className="text-xs text-slate-600 mt-1">
                                    {t.receiveModalVoucher} <span className="font-mono font-bold text-amber-800">{detail.transferNo}</span> &nbsp;|&nbsp; 
                                    {t.receiveModalDest} <strong className="text-emerald-700">{detail.toWarehouse}</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setShowReceiveModal(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Guide banner & Bulk location selector */}
                        {destLocations.length === 0 ? (
                            <div className="p-4 bg-rose-50 border-b border-rose-200 text-xs text-rose-900 flex items-center gap-2">
                                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                                <span>
                                    {t.noDestLocationWarn}
                                </span>
                            </div>
                        ) : (
                            <div className="p-4 bg-amber-50/70 border-b border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={16} className="text-amber-700 shrink-0" />
                                    <span>
                                        {t.receiveGuideText}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[11px] font-bold text-slate-700">{t.quickAssignLoc}</span>
                                    <select
                                        value={bulkLocationId}
                                        onChange={e => handleApplyBulkLocation(e.target.value)}
                                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white font-mono font-medium outline-none focus:border-emerald-500"
                                    >
                                        {destLocations.map(loc => (
                                            <option key={loc.id} value={loc.id}>
                                                {loc.locationCode} {loc.zone ? `(${loc.zone})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Items Table */}
                        <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                        <th className="px-3 py-2.5 w-10 text-center">{t.colStt}</th>
                                        <th className="px-3 py-2.5">{t.colProductInfo}</th>
                                        <th className="px-3 py-2.5 w-16 text-center">{t.colVintage}</th>
                                        <th className="px-3 py-2.5 w-24 text-right">{t.colQtyTransferred}</th>
                                        <th className="px-3 py-2.5 w-32 text-center">{t.colQtyReceived}</th>
                                        <th className="px-3 py-2.5 w-32 text-center">{t.colVariance}</th>
                                        <th className="px-3 py-2.5 w-44">{t.colDestLoc}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {receiveLines.map((line, idx) => {
                                        const diff = line.qtyTransferred - line.qtyReceived
                                        return (
                                            <tr key={line.lineId} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-3 py-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                                                <td className="px-3 py-3">
                                                    <span className="font-mono font-bold text-amber-800 text-[11px] mr-1.5">[{line.skuCode}]</span>
                                                    <span className="font-bold text-slate-900">{line.productName}</span>
                                                </td>
                                                <td className="px-3 py-3 text-center font-mono text-slate-600">{line.vintage || 'NV'}</td>
                                                <td className="px-3 py-3 text-right font-mono font-bold text-slate-700">
                                                    {line.qtyTransferred} <span className="text-[10px] text-slate-400">{t.unitBottle}</span>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={line.qtyTransferred}
                                                        value={line.qtyReceived === 0 ? '' : line.qtyReceived}
                                                        placeholder="0"
                                                        onChange={e => {
                                                            const raw = e.target.value
                                                            if (raw === '') {
                                                                setReceiveLines(prev => prev.map(l => l.lineId === line.lineId ? { ...l, qtyReceived: 0 } : l))
                                                                return
                                                            }
                                                            const parsed = parseInt(raw, 10)
                                                            if (!isNaN(parsed)) {
                                                                const clamped = Math.min(line.qtyTransferred, Math.max(0, parsed))
                                                                setReceiveLines(prev => prev.map(l => l.lineId === line.lineId ? { ...l, qtyReceived: clamped } : l))
                                                            }
                                                        }}
                                                        className="w-24 px-2 py-1 text-center font-mono font-extrabold text-xs rounded border border-slate-300 bg-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    {diff === 0 ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap shrink-0">
                                                            <CheckCircle2 size={11} /> {t.statusMatch}
                                                        </span>
                                                    ) : diff > 0 ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 whitespace-nowrap shrink-0">
                                                            <AlertTriangle size={11} /> {t.statusShortage} {diff} {t.unitBottle}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 whitespace-nowrap shrink-0">
                                                            {t.statusSurplus} {Math.abs(diff)} {t.unitBottle}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {destLocations.length > 0 ? (
                                                        <select
                                                            value={line.locationId}
                                                            onChange={e => {
                                                                const locId = e.target.value
                                                                setReceiveLines(prev => prev.map(l => l.lineId === line.lineId ? { ...l, locationId: locId } : l))
                                                            }}
                                                            className="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white font-mono outline-none focus:border-emerald-500"
                                                        >
                                                            {destLocations.map(loc => (
                                                                <option key={loc.id} value={loc.id}>
                                                                    {loc.locationCode} {loc.zone ? `(${loc.zone})` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="text-[11px] text-rose-500 italic">{t.noLocText}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>

                            {/* Receipt Notes / Damage Report */}
                            <div className="mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                                <label className="block text-xs font-bold text-slate-800">
                                    {t.receiptNotesLabel}
                                </label>
                                <textarea
                                    value={receiptNotes}
                                    onChange={e => setReceiptNotes(e.target.value)}
                                    rows={2}
                                    placeholder={t.receiptNotesPlaceholder}
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Footer Summary & Action */}
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4 text-xs">
                                <div>
                                    <span className="text-slate-500">{t.summaryShipped} </span>
                                    <strong className="font-mono text-slate-900">{receiveLines.reduce((s, l) => s + l.qtyTransferred, 0)} {t.unitBottle}</strong>
                                </div>
                                <div>
                                    <span className="text-slate-500">{t.summaryReceived} </span>
                                    <strong className="font-mono text-emerald-700">{receiveLines.reduce((s, l) => s + l.qtyReceived, 0)} {t.unitBottle}</strong>
                                </div>
                                {receiveLines.reduce((s, l) => s + (l.qtyTransferred - l.qtyReceived), 0) > 0 && (
                                    <div className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                                        {t.summaryShortage} -{receiveLines.reduce((s, l) => s + (l.qtyTransferred - l.qtyReceived), 0)} {t.unitBottle}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    onClick={() => setShowReceiveModal(false)}
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                                >
                                    {t.closeBtn}
                                </button>
                                <button
                                    onClick={handleConfirmReceive}
                                    disabled={actionLoading || destLocations.length === 0}
                                    className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    {t.confirmReceiveBtn}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
