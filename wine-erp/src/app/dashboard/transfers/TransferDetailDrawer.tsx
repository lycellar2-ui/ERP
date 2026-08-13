'use client'

import { useState, useEffect } from 'react'
import { X, Printer, CheckCircle2, ArrowRightLeft, Clock, Building2, Calendar, FileText, Check, ShieldAlert, Truck, PackageCheck, AlertCircle, Loader2, MapPin, Layers, Boxes, ListChecks } from 'lucide-react'
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
    submitTransferForAccounting,
} from './actions'
import { formatDate, formatVND } from '@/lib/utils'

interface TransferDetailDrawerProps {
    transferId: string | null
    onClose: () => void
    onRefresh: () => void
    currentUserRoles?: string[]
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
    DRAFT: { label: 'Nháp (Chưa gửi)', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
    PENDING_ACCOUNTING: { label: 'Chờ Kế Toán Duyệt', color: '#B47816', bg: 'rgba(212,168,83,0.15)', border: '#F59E0B' },
    CONFIRMED: { label: 'Kế Toán Đã Duyệt (Sẵn sàng)', color: '#0284C7', bg: 'rgba(2,132,199,0.12)', border: '#38BDF8' },
    IN_TRANSIT: { label: 'Đang Vận Chuyển', color: '#2563EB', bg: 'rgba(37,99,235,0.12)', border: '#60A5FA' },
    RECEIVED: { label: 'Đã Nhận Hàng (Hoàn tất)', color: '#16A34A', bg: 'rgba(22,163,74,0.12)', border: '#4ADE80' },
    CANCELLED: { label: 'Đã Hủy / Từ Chối', color: '#DC2626', bg: 'rgba(220,38,38,0.12)', border: '#F87171' },
}

export function TransferDetailDrawer({ transferId, onClose, onRefresh, currentUserRoles = [] }: TransferDetailDrawerProps) {
    const [loading, setLoading] = useState(false)
    const [detail, setDetail] = useState<TransferOrderDetail | null>(null)
    const [pickingLocations, setPickingLocations] = useState<TransferPickingItem[]>([])
    const [actionLoading, setActionLoading] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [showRejectInput, setShowRejectInput] = useState(false)
    const [printModalOpen, setPrintModalOpen] = useState(false)
    const [printDocType, setPrintDocType] = useState<'VOUCHER' | 'PICK_LIST'>('VOUCHER')

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
            toast.success('✅ Đã phê duyệt Phiếu Chuyển Kho thành công!')
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
            toast.success('🚚 Đã xuất kho & trừ tồn kho tại Kho Xuất thành công!')
            loadData(transferId)
            onRefresh()
        } catch (err: any) {
            toast.error('Lỗi xuất kho: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    // Handle Receive (Nhận hàng tại Kho Đến)
    const handleReceive = async () => {
        setActionLoading(true)
        try {
            const res = await receiveTransferOrder(transferId)
            if (!res.success) throw new Error(res.error)
            toast.success('📥 Đã xác nhận nhận đủ hàng & tạo Stock Lot tại Kho Nhận thành công!')
            loadData(transferId)
            onRefresh()
        } catch (err: any) {
            toast.error('Lỗi nhận kho: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    // Handle Submit Draft
    const handleSubmitDraft = async () => {
        setActionLoading(true)
        try {
            const res = await submitTransferForAccounting(transferId)
            if (!res.success) throw new Error(res.error)
            toast.success('✅ Đã gửi Kế toán phê duyệt!')
            loadData(transferId)
            onRefresh()
        } catch (err: any) {
            toast.error('Lỗi gửi duyệt: ' + err.message)
        } finally {
            setActionLoading(false)
        }
    }

    const st = detail ? (STATUS_MAP[detail.status] ?? STATUS_MAP.DRAFT) : STATUS_MAP.DRAFT

    return (
        <>
            <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(15, 23, 42, 0.4)' }}>
                <div className="w-full max-w-3xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
                    style={{ background: '#FFFFFF', borderLeft: '1px solid #E2E8F0' }}>
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0" style={{ background: '#FFFFFF' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold" style={{ background: 'rgba(135, 203, 185, 0.15)', color: '#0A1926', border: '1px solid rgba(135, 203, 185, 0.3)' }}>
                                <ArrowRightLeft size={18} style={{ color: '#0A1926' }} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold" style={{ color: '#0F172A' }}>
                                    PHIẾU CHUYỂN KHO: <span className="font-mono" style={{ color: '#B47816' }}>{detail?.transferNo || '...'}</span>
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1"
                                        style={{ color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                                        {st.label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {detail && (
                                <button
                                    onClick={() => setPrintModalOpen(true)}
                                    className="px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#334155' }}
                                    title="In phiếu chuyển kho ra giấy A4 để ký tên 4 bên"
                                >
                                    <Printer size={15} /> In Phiếu (A4)
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                style={{ color: '#64748B' }}
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
                                <span className="text-xs font-bold">Đang tải thông tin chi tiết phiếu...</span>
                            </div>
                        ) : detail ? (
                            <>
                                {/* Status Timeline Bar */}
                                <div className="p-4 rounded-xl space-y-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                    <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Tiến Trình Phiếu Chuyển Kho</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                                        <div className={`p-2 rounded-lg border font-bold ${['PENDING_ACCOUNTING', 'CONFIRMED', 'IN_TRANSIT', 'RECEIVED'].includes(detail.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            1. Lập Phiếu
                                        </div>
                                        <div className={`p-2 rounded-lg border font-bold ${['CONFIRMED', 'IN_TRANSIT', 'RECEIVED'].includes(detail.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : detail.status === 'PENDING_ACCOUNTING' ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            2. Kế Toán Duyệt
                                        </div>
                                        <div className={`p-2 rounded-lg border font-bold ${['IN_TRANSIT', 'RECEIVED'].includes(detail.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : detail.status === 'CONFIRMED' ? 'bg-sky-50 text-sky-800 border-sky-300' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            3. Xuất Kho (Đi)
                                        </div>
                                        <div className={`p-2 rounded-lg border font-bold ${detail.status === 'RECEIVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            4. Nhận Kho (Đến)
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Action Box Based on Status & User Role */}
                                {detail.status === 'DRAFT' && (
                                    <div className="p-4 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                        <div>
                                            <p className="text-xs font-bold" style={{ color: '#0F172A' }}>Phiếu đang ở trạng thái Nháp</p>
                                            <p className="text-[11px]" style={{ color: '#64748B' }}>Vui lòng kiểm tra kỹ danh mục rượu trước khi gửi Kế toán phê duyệt</p>
                                        </div>
                                        <button
                                            disabled={actionLoading}
                                            onClick={handleSubmitDraft}
                                            className="px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs"
                                            style={{ background: '#87CBB9', color: '#0A1926' }}
                                        >
                                            Gửi Kế Toán Duyệt
                                        </button>
                                    </div>
                                )}

                                {detail.status === 'PENDING_ACCOUNTING' && (
                                    <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.3)' }}>
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#B47816' }}>
                                                    <Clock size={16} style={{ color: '#B47816' }} /> Cần Kế Toán Phê Duyệt Phiếu Chuyển Kho
                                                </p>
                                                <p className="text-[11px] mt-0.5" style={{ color: '#475569' }}>
                                                    Kế toán kiểm tra danh mục hàng hóa, số lượng & tính hợp lệ để xác nhận duyệt phiếu
                                                </p>
                                            </div>
                                            {isAccountingOrAdmin && !showRejectInput && (
                                                <div className="flex items-center gap-2 justify-end">
                                                    <button
                                                        onClick={() => setShowRejectInput(true)}
                                                        className="px-3.5 py-2 rounded-lg border border-rose-300 bg-white text-rose-700 font-bold text-xs hover:bg-rose-50 cursor-pointer"
                                                    >
                                                        Từ Chối
                                                    </button>
                                                    <button
                                                        disabled={actionLoading}
                                                        onClick={handleApprove}
                                                        className="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                                                        style={{ background: '#87CBB9', color: '#0A1926' }}
                                                    >
                                                        <Check size={15} /> Duyệt Phiếu Chuyển Kho
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
                                                    placeholder="Nhập lý do từ chối phiếu chuyển kho này..."
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:border-rose-500"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setShowRejectInput(false)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
                                                    <button onClick={handleReject} disabled={actionLoading} className="px-3.5 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700">Xác Nhận Từ Chối</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {detail.status === 'CONFIRMED' && (
                                    <div className="p-4 rounded-xl bg-sky-50 border border-sky-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                                                <CheckCircle2 size={16} className="text-sky-600" /> Kế toán đã phê duyệt — Sẵn sàng xuất kho
                                            </p>
                                            <p className="text-[11px] text-sky-700 mt-0.5">
                                                Thủ kho xuất hàng bấm "In Phiếu A4" để ký nhận giấy & nhấp "Xuất Kho & Vận Chuyển"
                                            </p>
                                        </div>
                                        <button
                                            disabled={actionLoading}
                                            onClick={handleDispatch}
                                            className="px-4 py-2.5 rounded-lg bg-sky-600 text-white font-bold text-xs hover:bg-sky-700 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <Truck size={15} /> Xuất Kho & Vận Chuyển
                                        </button>
                                    </div>
                                )}

                                {detail.status === 'IN_TRANSIT' && (
                                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                                <Truck size={16} className="text-blue-600" /> Hàng đang vận chuyển trên đường
                                            </p>
                                            <p className="text-[11px] text-blue-700 mt-0.5">
                                                Khi hàng đến Kho Nhận, Thủ kho đến kiểm đếm và bấm "Xác Nhận Nhận Hàng"
                                            </p>
                                        </div>
                                        <button
                                            disabled={actionLoading}
                                            onClick={handleReceive}
                                            className="px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                            style={{ background: '#87CBB9', color: '#0A1926' }}
                                        >
                                            <PackageCheck size={15} /> Xác Nhận Đã Nhận Hàng
                                        </button>
                                    </div>
                                )}

                                {/* Overview Metadata Table */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-3.5 rounded-xl space-y-1" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                        <p className="text-[10px] font-bold uppercase" style={{ color: '#64748B' }}>🔴 Kho Xuất (Kho Đi)</p>
                                        <p className="text-sm font-bold" style={{ color: '#0F172A' }}>{detail.fromWarehouse}</p>
                                    </div>

                                    <div className="p-3.5 rounded-xl space-y-1" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                        <p className="text-[10px] font-bold uppercase" style={{ color: '#64748B' }}>🟢 Kho Nhận (Kho Đến)</p>
                                        <p className="text-sm font-bold" style={{ color: '#0F172A' }}>{detail.toWarehouse}</p>
                                    </div>

                                    <div className="p-3.5 rounded-xl space-y-1" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                        <p className="text-[10px] font-bold uppercase" style={{ color: '#64748B' }}>👤 Người Yêu Cầu / Chuyển Kho</p>
                                        <p className="text-xs font-bold" style={{ color: '#0F172A' }}>{detail.requesterName}</p>
                                        <p className="text-[11px] font-mono" style={{ color: '#64748B' }}>{formatDate(detail.transferDate)}</p>
                                    </div>

                                    <div className="p-3.5 rounded-xl space-y-1" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                        <p className="text-[10px] font-bold uppercase" style={{ color: '#64748B' }}>💼 Kế Toán Phê Duyệt</p>
                                        <p className="text-xs font-bold" style={{ color: '#0F172A' }}>{detail.accountingApprovedBy || 'Chưa duyệt'}</p>
                                        {detail.accountingApprovedAt && (
                                            <p className="text-[11px] font-mono" style={{ color: '#16A34A' }}>Duyệt lúc {formatDate(detail.accountingApprovedAt)}</p>
                                        )}
                                    </div>
                                </div>

                                {detail.notes && (
                                    <div className="p-3.5 rounded-xl space-y-1" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                        <p className="text-[10px] font-bold uppercase" style={{ color: '#64748B' }}>📝 Ghi Chú</p>
                                        <p className="text-xs font-medium" style={{ color: '#0F172A' }}>{detail.notes}</p>
                                    </div>
                                )}

                                {/* 📍 FIFO PICKING LOCATION SUGGESTIONS (GỢI Ý VỊ TRÍ NHẶT HÀNG CHO THỦ KHO) */}
                                <div className="p-4 rounded-xl space-y-3" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <MapPin size={16} className="text-sky-600" />
                                            <h4 className="text-xs font-extrabold text-sky-950 uppercase tracking-wide">
                                                Gợi Ý Vị Trí Nhặt Hàng (Pick List FIFO tại {detail.fromWarehouse})
                                            </h4>
                                        </div>
                                        <button
                                            onClick={() => { setPrintDocType('PICK_LIST'); setPrintModalOpen(true) }}
                                            className="px-2.5 py-1 text-[11px] font-bold rounded bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-1 shadow-2xs cursor-pointer"
                                        >
                                            <Printer size={12} /> In Phiếu Nhặt Hàng
                                        </button>
                                    </div>

                                    {pickingLocations.length === 0 ? (
                                        <p className="text-xs text-sky-700 italic">Đang tải gợi ý vị trí nhặt hàng...</p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {pickingLocations.map(p => (
                                                <div key={p.productId} className="p-3 bg-white rounded-lg border border-sky-200 shadow-2xs space-y-2">
                                                    <div className="flex items-center justify-between flex-wrap gap-1">
                                                        <div>
                                                            <span className="font-mono font-bold text-amber-700 text-xs mr-1.5">[{p.skuCode}]</span>
                                                            <span className="font-bold text-slate-900 text-xs">{p.productName}</span>
                                                            {p.vintageRequested && <span className="ml-2 font-mono text-[10px] text-slate-500 font-semibold">({p.vintageRequested})</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-mono font-bold text-sky-900">Yêu cầu: {p.qtyRequested} chai</span>
                                                            {p.isSufficient ? (
                                                                <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-700">🟢 Đủ Tồn FIFO ({p.totalAvailableInWH} chai sẵn)</span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-rose-100 text-rose-700">⚠️ Thiếu Tồn ({p.totalAvailableInWH} chai sẵn)</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Locations list for this product */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                                                        {p.pickingLocations.length === 0 ? (
                                                            <div className="text-[11px] text-rose-600 font-semibold col-span-2">Không tìm thấy lô hàng khả dụng ở Kho Xuất</div>
                                                        ) : p.pickingLocations.map((loc, i) => (
                                                            <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-xs">
                                                                <div className="space-y-0.5">
                                                                    <div className="flex items-center gap-1 font-mono font-extrabold text-slate-900">
                                                                        <Layers size={12} className="text-sky-600" />
                                                                        <span>Kệ/Vị trí: <span className="text-blue-700 font-bold">{loc.locationCode}</span></span>
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500 font-mono">Lô: {loc.lotNo} {loc.vintage ? `· Vintage ${loc.vintage}` : ''}</div>
                                                                </div>
                                                                <div className="text-right font-mono">
                                                                    <span className="font-bold text-emerald-700 text-xs block">Nhặt {loc.qtyToPick} chai</span>
                                                                    <span className="text-[10px] text-slate-400">Tồn kệ: {loc.qtyAvailable}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Line Items Table */}
                                <div className="rounded-xl overflow-hidden shadow-2xs" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                                                    <th className="p-3 font-semibold uppercase text-[10px] w-10 text-center">STT</th>
                                                    <th className="p-3 font-semibold uppercase text-[10px]">Mã SKU</th>
                                                    <th className="p-3 font-semibold uppercase text-[10px]">Sản Phẩm</th>
                                                    <th className="p-3 font-semibold uppercase text-[10px] text-center">VTG</th>
                                                    <th className="p-3 font-semibold uppercase text-[10px] text-center">Số Lượng</th>
                                                    <th className="p-3 font-semibold uppercase text-[10px] text-right">Đơn Giá Vốn</th>
                                                    <th className="p-3 font-semibold uppercase text-[10px] text-right">Thành Tiền</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                                                {detail.lines.map((l, idx) => (
                                                    <tr key={l.id} className="hover:bg-slate-50">
                                                        <td className="p-3 text-center font-bold" style={{ color: '#64748B' }}>{idx + 1}</td>
                                                        <td className="p-3 font-mono font-bold" style={{ color: '#B47816' }}>{l.skuCode}</td>
                                                        <td className="p-3 font-bold" style={{ color: '#0F172A' }}>{l.productName}</td>
                                                        <td className="p-3 text-center font-mono" style={{ color: '#475569' }}>{l.vintage || 'NV'}</td>
                                                        <td className="p-3 text-center font-mono font-bold" style={{ color: '#B47816' }}>{l.qtyTransferred} chai</td>
                                                        <td className="p-3 text-right font-mono" style={{ color: '#64748B' }}>{formatVND(l.unitCost)}</td>
                                                        <td className="p-3 text-right font-mono font-bold" style={{ color: '#0F172A' }}>{formatVND(l.totalValue)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="p-12 text-center text-slate-400">Không tìm thấy dữ liệu phiếu</div>
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
                                <Printer size={14} /> In Phiếu Chuyển Kho A4
                            </button>
                            <button
                                onClick={() => { setPrintDocType('PICK_LIST'); setPrintModalOpen(true) }}
                                className="px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                style={{ background: '#E0F2FE', border: '1px solid #7DD3FC', color: '#0369A1' }}
                            >
                                <MapPin size={14} /> In Phiếu Nhặt Hàng
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-lg text-xs font-semibold transition-all"
                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#64748B' }}
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>

            {/* 🖨️ A4 PRINTABLE MODAL FOR PAPER SIGNING & PICKING */}
            {printModalOpen && detail && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print-modal print:block print:p-0 print:bg-transparent">
                    <div className="bg-[#0D1821] border border-[#2A4355] rounded-xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:shadow-none print:border-none print:max-h-none print:bg-white print:m-0 print:w-full print:max-w-none">
                        {/* Header bar (Non-printable) */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F3547] bg-[#142433] print:hidden">
                            <div className="flex items-center gap-3">
                                <div className="flex p-0.5 rounded-lg bg-[#0D1821] border border-[#2A4355]">
                                    <button
                                        onClick={() => setPrintDocType('VOUCHER')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition-colors ${printDocType === 'VOUCHER' ? 'bg-[#87CBB9] text-[#0A1926]' : 'text-slate-300 hover:text-white'}`}
                                    >
                                        📄 Phiếu Chuyển Kho A4
                                    </button>
                                    <button
                                        onClick={() => setPrintDocType('PICK_LIST')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition-colors ${printDocType === 'PICK_LIST' ? 'bg-[#38BDF8] text-[#0A1926]' : 'text-slate-300 hover:text-white'}`}
                                    >
                                        📋 Danh Sách Nhặt Hàng (Pick List)
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
                                    className="p-1 text-slate-400 hover:text-white rounded bg-[#1F3547] cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Invoice Content Area */}
                        <div className="p-0 bg-white text-black font-sans w-full h-full overflow-y-auto print:overflow-visible">
                            <div className="max-w-[850px] mx-auto p-8 sm:p-12 print:p-0 print:max-w-none">

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
                                            <table className="w-80 text-[11px] border-collapse">
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
                                    /* 📋 PRINTABLE PICK LIST FOR WAREHOUSE PICKER */
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
                                            ⚠️ <strong>Hướng dẫn thủ kho:</strong> Nhặt hàng theo thứ tự Vị trí Kệ (FIFO). Đánh dấu [✓] khi đã nhặt xong từng vị trí.
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
                                                        : [{ lotId: '', lotNo: '—', locationId: '', locationCode: 'Chưa xếp kệ', zone: '', rack: '', bin: '', vintage: p.vintageRequested, qtyAvailable: 0, qtyToPick: p.qtyRequested, skuCode: p.skuCode, productName: p.productName, isFirst: true, count: 1 }]
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
                                            <div className="grid grid-cols-2 gap-8 text-center text-xs w-80">
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
        </>
    )
}
