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
                        <button
                            onClick={() => setPrintModalOpen(true)}
                            className="px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#0F172A' }}
                        >
                            <Printer size={15} /> In Phiếu Giấy A4
                        </button>
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
