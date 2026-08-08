'use client'

import { useState, useEffect } from 'react'
import { X, Printer, CheckCircle2, ArrowRightLeft, Clock, Building2, Calendar, FileText, Check, ShieldAlert, Truck, PackageCheck, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
    type TransferOrderDetail,
    getTransferDetail,
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
    const [actionLoading, setActionLoading] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [showRejectInput, setShowRejectInput] = useState(false)
    const [printModalOpen, setPrintModalOpen] = useState(false)

    const loadData = async (id: string) => {
        setLoading(true)
        try {
            const data = await getTransferDetail(id)
            setDetail(data)
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

    const isAccountingOrAdmin = currentUserRoles.some(r => ['Kế Toán', 'KE_TOAN', 'CEO', 'Admin', 'ADMIN'].includes(r))

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
            <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10,25,38,0.7)', backdropFilter: 'blur(4px)' }}>
                <div className="bg-white w-full max-w-3xl h-full flex flex-col shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200">
                    {/* Header */}
                    <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                                <ArrowRightLeft size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                                    PHIẾU CHUYỂN KHO: <span className="font-mono text-amber-700">{detail?.transferNo || '...'}</span>
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1"
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
                                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                                    title="In phiếu chuyển kho ra giấy A4 để ký tên 4 bên"
                                >
                                    <Printer size={15} /> In Phiếu (A4)
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
                                <Loader2 size={32} className="animate-spin text-amber-600" />
                                <span className="text-xs font-bold">Đang tải thông tin chi tiết phiếu...</span>
                            </div>
                        ) : detail ? (
                            <>
                                {/* Status Timeline Bar */}
                                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Tiến Trình Phiếu Chuyển Kho</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                                        <div className={`p-2 rounded-xl border font-bold ${['PENDING_ACCOUNTING', 'CONFIRMED', 'IN_TRANSIT', 'RECEIVED'].includes(detail.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            1. Lập Phiếu
                                        </div>
                                        <div className={`p-2 rounded-xl border font-bold ${['CONFIRMED', 'IN_TRANSIT', 'RECEIVED'].includes(detail.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : detail.status === 'PENDING_ACCOUNTING' ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            2. Kế Toán Duyệt
                                        </div>
                                        <div className={`p-2 rounded-xl border font-bold ${['IN_TRANSIT', 'RECEIVED'].includes(detail.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : detail.status === 'CONFIRMED' ? 'bg-sky-50 text-sky-800 border-sky-300' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            3. Xuất Kho (Đi)
                                        </div>
                                        <div className={`p-2 rounded-xl border font-bold ${detail.status === 'RECEIVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            4. Nhận Kho (Đến)
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Action Box Based on Status & User Role */}
                                {detail.status === 'DRAFT' && (
                                    <div className="p-4 rounded-2xl bg-slate-100 border border-slate-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-extrabold text-slate-900">Phiếu đang ở trạng thái Nháp</p>
                                            <p className="text-[11px] text-slate-500">Vui lòng kiểm tra kỹ danh mục rượu trước khi gửi Kế toán phê duyệt</p>
                                        </div>
                                        <button
                                            disabled={actionLoading}
                                            onClick={handleSubmitDraft}
                                            className="px-4 py-2 rounded-xl bg-amber-500 text-white font-extrabold text-xs hover:bg-amber-600 transition-colors shadow-xs cursor-pointer active:scale-95"
                                        >
                                            Gửi Kế Toán Duyệt
                                        </button>
                                    </div>
                                )}

                                {detail.status === 'PENDING_ACCOUNTING' && (
                                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300 space-y-3">
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                                                    <Clock size={16} className="text-amber-600" /> Cần Kế Toán Phê Duyệt Phiếu Chuyển Kho
                                                </p>
                                                <p className="text-[11px] text-amber-800 mt-0.5">
                                                    Kế toán kiểm tra danh mục hàng hóa, số lượng & tính hợp lệ để xác nhận duyệt phiếu
                                                </p>
                                            </div>
                                            {isAccountingOrAdmin && !showRejectInput && (
                                                <div className="flex items-center gap-2 justify-end">
                                                    <button
                                                        onClick={() => setShowRejectInput(true)}
                                                        className="px-3 py-2 rounded-xl border border-rose-300 bg-white text-rose-700 font-bold text-xs hover:bg-rose-50 cursor-pointer"
                                                    >
                                                        Từ Chối
                                                    </button>
                                                    <button
                                                        disabled={actionLoading}
                                                        onClick={handleApprove}
                                                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700 transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Check size={15} /> Duyệt Phiếu Chuyển Kho
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {showRejectInput && (
                                            <div className="p-3 bg-white rounded-xl border border-rose-200 space-y-2">
                                                <input
                                                    type="text"
                                                    value={rejectReason}
                                                    onChange={e => setRejectReason(e.target.value)}
                                                    placeholder="Nhập lý do từ chối phiếu chuyển kho này..."
                                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none focus:border-rose-500"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setShowRejectInput(false)} className="px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Hủy</button>
                                                    <button onClick={handleReject} disabled={actionLoading} className="px-3 py-1 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700">Xác Nhận Từ Chối</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {detail.status === 'CONFIRMED' && (
                                    <div className="p-4 rounded-2xl bg-sky-50 border border-sky-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-extrabold text-sky-900 flex items-center gap-1.5">
                                                <CheckCircle2 size={16} className="text-sky-600" /> Kế toán đã phê duyệt — Sẵn sàng xuất kho
                                            </p>
                                            <p className="text-[11px] text-sky-700 mt-0.5">
                                                Thủ kho xuất hàng bấm "In Phiếu A4" để ký nhận giấy & nhấp "Xuất Kho & Vận Chuyển"
                                            </p>
                                        </div>
                                        <button
                                            disabled={actionLoading}
                                            onClick={handleDispatch}
                                            className="px-4 py-2.5 rounded-xl bg-sky-600 text-white font-extrabold text-xs hover:bg-sky-700 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <Truck size={15} /> Xuất Kho & Vận Chuyển
                                        </button>
                                    </div>
                                )}

                                {detail.status === 'IN_TRANSIT' && (
                                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                                                <Truck size={16} className="text-blue-600" /> Hàng đang vận chuyển trên đường
                                            </p>
                                            <p className="text-[11px] text-blue-700 mt-0.5">
                                                Khi hàng đến Kho Nhận, Thủ kho đến kiểm đếm và bấm "Xác Nhận Nhận Hàng"
                                            </p>
                                        </div>
                                        <button
                                            disabled={actionLoading}
                                            onClick={handleReceive}
                                            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <PackageCheck size={15} /> Xác Nhận Đã Nhận Hàng
                                        </button>
                                    </div>
                                )}

                                {/* Overview Metadata Table */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">🔴 Kho Xuất (Kho Đi)</p>
                                        <p className="text-xs sm:text-sm font-extrabold text-slate-900">{detail.fromWarehouse}</p>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">🟢 Kho Nhận (Kho Đến)</p>
                                        <p className="text-xs sm:text-sm font-extrabold text-slate-900">{detail.toWarehouse}</p>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">👤 Người Yêu Cầu / Chuyển Kho</p>
                                        <p className="text-xs font-extrabold text-slate-900">{detail.requesterName}</p>
                                        <p className="text-[11px] text-slate-500 font-mono">{formatDate(detail.transferDate)}</p>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">💼 Kế Toán Phê Duyệt</p>
                                        <p className="text-xs font-extrabold text-slate-900">{detail.accountingApprovedBy || 'Chưa duyệt'}</p>
                                        {detail.accountingApprovedAt && (
                                            <p className="text-[11px] text-emerald-600 font-mono">Duyệt lúc {formatDate(detail.accountingApprovedAt)}</p>
                                        )}
                                    </div>
                                </div>

                                {detail.notes && (
                                    <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 text-xs">
                                        <span className="font-bold text-amber-900">📝 Lý do / Ghi chú:</span> <span className="text-slate-800">{detail.notes}</span>
                                    </div>
                                )}

                                {/* Products Table */}
                                <div className="space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                                            🍷 Chi Tiết Sản Phẩm Chuyển Kho ({detail.lines.length} sản phẩm)
                                        </h4>
                                        <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-block w-fit">
                                            Tổng: {detail.totalQty} chai • {formatVND(detail.totalValue)}
                                        </span>
                                    </div>

                                    <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                                                    <th className="p-3 font-extrabold uppercase text-[11px] w-10 text-center">STT</th>
                                                    <th className="p-3 font-extrabold uppercase text-[11px]">Mã SKU</th>
                                                    <th className="p-3 font-extrabold uppercase text-[11px]">Sản Phẩm & Rượu Vang</th>
                                                    <th className="p-3 font-extrabold uppercase text-[11px] text-center">Tồn Kho Đi</th>
                                                    <th className="p-3 font-extrabold uppercase text-[11px] text-center">SL Chuyển</th>
                                                    <th className="p-3 font-extrabold uppercase text-[11px] text-right">Đơn Giá Vốn</th>
                                                    <th className="p-3 font-extrabold uppercase text-[11px] text-right">Thành Tiền</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 bg-white">
                                                {detail.lines.map((l, i) => (
                                                    <tr key={l.id} className="hover:bg-slate-50">
                                                        <td className="p-3 text-center font-bold text-slate-500">{i + 1}</td>
                                                        <td className="p-3 font-mono font-extrabold text-slate-900 whitespace-nowrap">{l.skuCode}</td>
                                                        <td className="p-3">
                                                            <p className="font-bold text-slate-900 text-xs">{l.productName}</p>
                                                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                                                {l.vintage ? `Vintage ${l.vintage}` : 'NV'} {l.country ? `• ${l.country}` : ''}
                                                            </p>
                                                        </td>
                                                        <td className="p-3 text-center font-mono font-bold text-slate-700 whitespace-nowrap">
                                                            {l.qtyAvailableFromWH} chai
                                                        </td>
                                                        <td className="p-3 text-center font-mono font-extrabold text-amber-700 text-sm whitespace-nowrap">
                                                            {l.qtyTransferred} chai
                                                        </td>
                                                        <td className="p-3 text-right font-mono text-slate-600 whitespace-nowrap">
                                                            {formatVND(l.unitCost)}
                                                        </td>
                                                        <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                                            {formatVND(l.totalValue)}
                                                        </td>
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
                    <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                        <button
                            onClick={() => setPrintModalOpen(true)}
                            className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                            <Printer size={15} /> In Phiếu Giấy A4
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>

            {/* 🖨️ A4 PRINTABLE MODAL FOR PAPER SIGNING */}
            {printModalOpen && detail && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-transparent">
                    <div className="bg-white rounded-2xl max-w-4xl w-full p-8 text-slate-900 space-y-6 shadow-2xl relative print:shadow-none print:w-full print:max-w-none print:p-0">
                        {/* Non-printable action bar */}
                        <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
                            <h3 className="font-extrabold text-base flex items-center gap-2 text-slate-900">
                                🖨️ Xem Trước Bản In Phiếu Chuyển Kho A4
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="px-5 py-2 rounded-xl bg-amber-500 text-white font-extrabold text-xs hover:bg-amber-600 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                    <Printer size={16} /> Bấm Để In Phiếu Giấy (A4)
                                </button>
                                <button
                                    onClick={() => setPrintModalOpen(false)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* 📄 PRINTABLE VOUCHER CONTENT (A4 FORM STYLING) */}
                        <div className="printable-voucher space-y-6 font-sans text-slate-900">
                            {/* Header Company Info */}
                            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                                <div>
                                    <h2 className="font-black text-xl text-amber-800 tracking-wide uppercase">CÔNG TY CỔ PHẦN LY CELLARS</h2>
                                    <p className="text-xs text-slate-600 mt-0.5">Địa chỉ: 15 Giang Văn Minh, Ba Đình, Hà Nội</p>
                                    <p className="text-xs text-slate-600">Hotline: 090 123 4567 • Email: accounting@lycellars.vn</p>
                                </div>
                                <div className="text-right">
                                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">PHIẾU CHUYỂN KHO NỘI BỘ</h1>
                                    <p className="text-sm font-mono font-bold text-amber-700 mt-1">Mã Phiếu: {detail.transferNo}</p>
                                    <p className="text-xs text-slate-500 font-mono">Ngày lập: {formatDate(detail.createdAt)}</p>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-6 text-xs p-4 rounded-xl bg-slate-50 border border-slate-300">
                                <div>
                                    <p className="mb-1"><strong className="text-slate-900">🔴 Kho Xuất (Kho đi):</strong> <span className="font-bold text-amber-900">{detail.fromWarehouse}</span></p>
                                    <p className="mb-1"><strong className="text-slate-900">🟢 Kho Nhận (Kho đến):</strong> <span className="font-bold text-emerald-900">{detail.toWarehouse}</span></p>
                                    <p><strong className="text-slate-900">👤 Người yêu cầu chuyển:</strong> {detail.requesterName}</p>
                                </div>
                                <div>
                                    <p className="mb-1"><strong className="text-slate-900">📅 Ngày chuyển dự kiến:</strong> {formatDate(detail.transferDate)}</p>
                                    <p className="mb-1"><strong className="text-slate-900">💼 Kế toán phê duyệt:</strong> {detail.accountingApprovedBy || 'Đã duyệt'}</p>
                                    <p><strong className="text-slate-900">📝 Lý do chuyển kho:</strong> {detail.notes || 'Cân bằng kho nội bộ'}</p>
                                </div>
                            </div>

                            {/* Product List Table */}
                            <table className="w-full text-left text-xs border-collapse border border-slate-900">
                                <thead>
                                    <tr className="bg-slate-200 border-b border-slate-900 text-slate-900 font-bold uppercase text-[11px]">
                                        <th className="p-2.5 border-r border-slate-900 text-center w-10">STT</th>
                                        <th className="p-2.5 border-r border-slate-900 w-28">Mã SKU</th>
                                        <th className="p-2.5 border-r border-slate-900">Tên Sản Phẩm / Rượu Vang</th>
                                        <th className="p-2.5 border-r border-slate-900 text-center w-16">VTG</th>
                                        <th className="p-2.5 border-r border-slate-900 text-center w-24">Số Lượng</th>
                                        <th className="p-2.5 border-r border-slate-900 text-right w-28">Đơn Giá Vốn</th>
                                        <th className="p-2.5 text-right w-32">Thành Tiền</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detail.lines.map((line, idx) => (
                                        <tr key={line.id} className="border-b border-slate-300">
                                            <td className="p-2.5 border-r border-slate-300 text-center font-bold">{idx + 1}</td>
                                            <td className="p-2.5 border-r border-slate-300 font-mono font-bold">{line.skuCode}</td>
                                            <td className="p-2.5 border-r border-slate-300 font-bold">{line.productName}</td>
                                            <td className="p-2.5 border-r border-slate-300 text-center font-mono">{line.vintage || 'NV'}</td>
                                            <td className="p-2.5 border-r border-slate-300 text-center font-mono font-bold text-amber-900">{line.qtyTransferred} chai</td>
                                            <td className="p-2.5 border-r border-slate-300 text-right font-mono">{formatVND(line.unitCost)}</td>
                                            <td className="p-2.5 text-right font-mono font-bold">{formatVND(line.totalValue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-100 font-bold text-xs border-t border-slate-900">
                                        <td colSpan={4} className="p-2.5 text-right uppercase border-r border-slate-900">TỔNG CỘNG HÀNG CHUYỂN KHO:</td>
                                        <td className="p-2.5 text-center font-mono font-extrabold text-amber-900 border-r border-slate-900">{detail.totalQty} chai</td>
                                        <td colSpan={2} className="p-2.5 text-right font-mono font-extrabold text-slate-900">{formatVND(detail.totalValue)}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* ✍️ PHYSICAL SIGNATURE BOXES FOR PRINTING (4 BÊN KÝ TÊN) */}
                            <div className="pt-6">
                                <p className="text-right text-xs italic mb-4">Hà Nội, Ngày ..... tháng ..... năm 2026</p>
                                <div className="grid grid-cols-4 gap-4 text-center text-xs font-bold">
                                    <div className="space-y-12">
                                        <p className="uppercase">NGƯỜI LẬP PHIẾU</p>
                                        <p className="text-slate-400 font-normal italic">(Ký, ghi rõ họ tên)</p>
                                    </div>
                                    <div className="space-y-12">
                                        <p className="uppercase">KẾ TOÁN PHÊ DUYỆT</p>
                                        <p className="text-slate-400 font-normal italic">(Ký, ghi rõ họ tên)</p>
                                    </div>
                                    <div className="space-y-12">
                                        <p className="uppercase">THỦ KHO XUẤT (KHO ĐỊ)</p>
                                        <p className="text-slate-400 font-normal italic">(Ký khi giao hàng)</p>
                                    </div>
                                    <div className="space-y-12">
                                        <p className="uppercase">THỦ KHO NHẬN (KHO ĐẾN)</p>
                                        <p className="text-slate-400 font-normal italic">(Ký khi nhận đủ hàng)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
