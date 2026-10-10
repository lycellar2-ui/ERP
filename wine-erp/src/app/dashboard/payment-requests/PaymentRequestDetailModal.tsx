'use client'

import { useState } from 'react'
import {
    X, FileText, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw,
    CheckCircle2, XCircle, RotateCcw, DollarSign, Building2, User,
    Calendar, CreditCard, AlertTriangle, Paperclip, Eye, UploadCloud,
    Loader2, Printer, Package, Receipt
} from 'lucide-react'
import { toast } from 'sonner'
import { formatVND, formatDate, formatDateTime } from '@/lib/utils'
import { processPaymentApproval, settlePaymentRequest } from './actions'
import { uploadPaymentDoc, getPresignedUploadUrl } from '@/lib/storage-r2'
import { PrintablePaymentRequest } from './PrintablePaymentRequest'

interface PaymentRequestDetailModalProps {
    detail: any
    currentUser: any
    onClose: () => void
    onRefresh: () => void
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
    DRAFT: { label: 'Bản Nháp', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
    SUBMITTED: { label: 'Chờ TP Duyệt (Cấp 1)', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    REVIEWING_L1: { label: 'Chờ Kế Toán Duyệt (Cấp 2)', bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
    REVIEWING_L2: { label: 'Chờ CEO Phê Chuẩn (Cấp 3)', bg: '#FDF4FF', color: '#9333EA', border: '#F5D0FE' },
    APPROVED: { label: 'Đã Duyệt — Chờ Chi Tiền', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
    PAID: { label: 'Đã Giải Ngân / Đã Có UNC', bg: '#F0FDF4', color: '#15803D', border: '#86EFAC' },
    REJECTED: { label: 'Bị Từ Chối', bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
    CANCELLED: { label: 'Đã Hủy', bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
}

export function PaymentRequestDetailModal({
    detail,
    currentUser,
    onClose,
    onRefresh,
}: PaymentRequestDetailModalProps) {
    const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(0)
    const [zoom, setZoom] = useState(100)
    const [rotation, setRotation] = useState(0)

    // Approval action modal state
    const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'RETURN' | null>(null)
    const [comment, setComment] = useState('')
    const [submittingAction, setSubmittingAction] = useState(false)

    // Settlement (Chi tiền) modal state
    const [showSettleModal, setShowSettleModal] = useState(false)
    const [paidAmount, setPaidAmount] = useState(detail.totalAmountVND)
    const [paymentMethod, setPaymentMethod] = useState(detail.paymentMethod || 'BANK_TRANSFER')
    const [uncVoucherNo, setUncVoucherNo] = useState('')
    const [uncFile, setUncFile] = useState<File | null>(null)
    const [settling, setSettling] = useState(false)
    const [showPrintModal, setShowPrintModal] = useState(false)

    const attachments = detail.attachments || []
    const currentAttachment = attachments[selectedAttachmentIndex] || null

    const statusStyle = STATUS_CONFIG[detail.status] || STATUS_CONFIG.DRAFT

    // Check permissions
    const roles: string[] = currentUser?.roles || []
    const isCEO = roles.some(r => ['CEO', 'ADMIN', 'GIAM_DOC'].includes(r.toUpperCase()))
    const isAccountant = roles.some(r => ['KE_TOAN', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT', 'KETOAN_TRUONG'].includes(r.toUpperCase()))
    const isManager = roles.some(r => ['TRUONG_PHONG', 'MANAGER', 'DIRECTOR'].includes(r.toUpperCase()))

    const canApproveCurrentLevel =
        (detail.status === 'SUBMITTED' && (isManager || isCEO)) ||
        (detail.status === 'REVIEWING_L1' && (isAccountant || isCEO)) ||
        (detail.status === 'REVIEWING_L2' && isCEO)

    const canSettle = detail.status === 'APPROVED' && (isAccountant || isCEO)

    async function handleApprovalSubmit() {
        if (!actionType) return
        setSubmittingAction(true)
        try {
            const res = await processPaymentApproval({
                requestId: detail.id,
                action: actionType,
                comment: comment.trim(),
            })

            if (res.success) {
                toast.success(
                    actionType === 'APPROVE' ? 'Phê duyệt thành công' :
                    actionType === 'REJECT' ? 'Đã từ chối phiếu' : 'Đã trả lại phiếu để chỉnh sửa'
                )
                setActionType(null)
                onRefresh()
            } else {
                toast.error(res.error || 'Có lỗi xảy ra')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi xử lý phê duyệt')
        } finally {
            setSubmittingAction(false)
        }
    }

    async function handleSettlementSubmit() {
        setSettling(true)
        try {
            let uncUrl = null
            if (uncFile) {
                let uploadSuccess = false
                // 1. Direct Presigned PUT to Cloudflare R2
                try {
                    const presignedRes = await getPresignedUploadUrl(
                        uncFile.name,
                        uncFile.type || 'application/octet-stream',
                        uncFile.size,
                        'unc'
                    )
                    if (presignedRes.success && presignedRes.uploadUrl && presignedRes.viewUrl) {
                        const putRes = await fetch(presignedRes.uploadUrl, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': uncFile.type || 'application/octet-stream',
                            },
                            body: uncFile,
                        })
                        if (putRes.ok) {
                            uncUrl = presignedRes.viewUrl
                            uploadSuccess = true
                        }
                    }
                } catch (directErr) {
                    console.warn('[Direct UNC Upload] Direct PUT failed, trying server action:', directErr)
                }

                // 2. Fallback to Server Action upload
                if (!uploadSuccess) {
                    const formData = new FormData()
                    formData.append('file', uncFile)
                    const uploadRes = await uploadPaymentDoc(formData, 'unc')
                    if (!uploadRes.success) {
                        toast.error(uploadRes.error || 'Lỗi tải file UNC lên')
                        setSettling(false)
                        return
                    }
                    uncUrl = uploadRes.url
                }
            }

            const res = await settlePaymentRequest({
                requestId: detail.id,
                paidAmount: Number(paidAmount),
                paymentMethod,
                uncVoucherNo: uncVoucherNo.trim() || undefined,
                uncFileUrl: uncUrl || undefined,
            })

            if (res.success) {
                toast.success('Đã xác nhận giải ngân thành công!')
                setShowSettleModal(false)
                onRefresh()
            } else {
                toast.error(res.error || 'Lỗi khi giải ngân')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi xử lý')
        } finally {
            setSettling(false)
        }
    }

    const isPdf = currentAttachment?.mimeType === 'application/pdf' || currentAttachment?.fileName.toLowerCase().endsWith('.pdf')

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="flex h-[92vh] w-full max-w-[1450px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                {/* ═══ Header ═══ */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3.5">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-base font-bold text-[#8B1A2E]">{detail.requestNo}</span>
                        <div
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}
                        >
                            {statusStyle.label}
                        </div>
                        <h2 className="max-w-[450px] truncate text-sm font-semibold text-slate-800" title={detail.title}>
                            {detail.title}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        {canApproveCurrentLevel && (
                            <>
                                <button
                                    onClick={() => setActionType('APPROVE')}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 transition"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Duyệt
                                </button>
                                <button
                                    onClick={() => setActionType('RETURN')}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-amber-700 transition"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" /> Trả lại
                                </button>
                                <button
                                    onClick={() => setActionType('REJECT')}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 transition"
                                >
                                    <XCircle className="h-3.5 w-3.5" /> Từ chối
                                </button>
                            </>
                        )}

                        {canSettle && (
                            <button
                                onClick={() => setShowSettleModal(true)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A2E] px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#721526] transition"
                            >
                                <DollarSign className="h-3.5 w-3.5" /> Xác Nhận Giải Ngân (UNC)
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setShowPrintModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition"
                            title="In biểu mẫu tờ trình / đề nghị thanh toán (Mẫu 05-TT)"
                        >
                            <Printer className="h-3.5 w-3.5 text-burgundy" /> In Tờ Trình
                        </button>

                        <button
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* ═══ Body: Split View ═══ */}
                <div className="flex flex-1 overflow-hidden">
                    {/* ─── LEFT: Scanned Document Viewer (52% width) ─── */}
                    <div className="flex w-[52%] flex-col border-r border-slate-200 bg-slate-100">
                        {/* Attachment Tabs Bar */}
                        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
                            <div className="flex max-w-[80%] items-center gap-1.5 overflow-x-auto text-xs">
                                {attachments.length > 0 ? (
                                    attachments.map((att: any, idx: number) => (
                                        <button
                                            key={att.id || idx}
                                            onClick={() => {
                                                setSelectedAttachmentIndex(idx)
                                                setZoom(100)
                                                setRotation(0)
                                            }}
                                            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition ${
                                                selectedAttachmentIndex === idx
                                                    ? 'bg-[#8B1A2E] text-white shadow-xs'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                        >
                                            <Paperclip className="h-3 w-3" />
                                            <span className="max-w-[130px] truncate">{att.fileName}</span>
                                        </button>
                                    ))
                                ) : (
                                    <span className="text-xs italic text-slate-400">Không có chứng từ scan đính kèm</span>
                                )}
                            </div>

                            {/* Viewer Controls */}
                            {currentAttachment && (
                                <div className="flex items-center gap-1 text-slate-600">
                                    <button
                                        onClick={() => setZoom(z => Math.max(50, z - 25))}
                                        className="rounded p-1 hover:bg-slate-200"
                                        title="Thu nhỏ"
                                    >
                                        <ZoomOut className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="text-[11px] font-mono text-slate-500">{zoom}%</span>
                                    <button
                                        onClick={() => setZoom(z => Math.min(250, z + 25))}
                                        className="rounded p-1 hover:bg-slate-200"
                                        title="Phóng to"
                                    >
                                        <ZoomIn className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setRotation(r => (r + 90) % 360)}
                                        className="rounded p-1 hover:bg-slate-200"
                                        title="Xoay 90°"
                                    >
                                        <RotateCw className="h-3.5 w-3.5" />
                                    </button>
                                    <a
                                        href={currentAttachment.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded p-1 hover:bg-slate-200"
                                        title="Mở tab mới"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Viewer Canvas */}
                        <div className="relative flex flex-1 items-center justify-center overflow-auto p-4">
                            {currentAttachment ? (
                                isPdf ? (
                                    <iframe
                                        src={currentAttachment.fileUrl}
                                        className="h-full w-full rounded-lg border border-slate-300 bg-white shadow-xs"
                                        title={currentAttachment.fileName}
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center overflow-auto">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={currentAttachment.fileUrl}
                                            alt={currentAttachment.fileName}
                                            style={{
                                                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                                                transition: 'transform 0.15s ease-out',
                                                maxWidth: '100%',
                                                maxHeight: '100%',
                                                objectFit: 'contain',
                                            }}
                                            className="rounded-md shadow-md"
                                        />
                                    </div>
                                )
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-2 text-center text-slate-400">
                                    <FileText className="h-12 w-12 stroke-[1.2]" />
                                    <p className="text-sm font-medium">Chưa có chứng từ scan cho phiếu này</p>
                                    <p className="text-xs text-slate-500">Người lập có thể tải lên hóa đơn GTGT, biên bản nghiệm thu hoặc UNC scan</p>
                                </div>
                            )}
                        </div>

                        {/* Attachment Metadata Footer */}
                        {currentAttachment && (
                            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500">
                                <div>
                                    <span className="font-semibold text-slate-700">Loại: </span>
                                    {currentAttachment.docType === 'VAT_INVOICE' ? 'Hóa đơn GTGT điện tử' :
                                     currentAttachment.docType === 'DELIVERY_NOTE' ? 'Biên bản giao hàng / nghiệm thu' :
                                     currentAttachment.docType === 'CONTRACT_DOC' ? 'Hợp đồng / Báo giá' :
                                     currentAttachment.docType === 'BANK_UNC' ? 'Ủy nhiệm chi ngân hàng' : 'Chứng từ khác'}
                                    <span className="ml-3">({(currentAttachment.fileSize / 1024).toFixed(1)} KB)</span>
                                </div>
                                <div>Tải lên bởi: <span className="font-medium text-slate-700">{currentAttachment.uploadedByName}</span></div>
                            </div>
                        )}
                    </div>

                    {/* ─── RIGHT: Payment Details & Audit Trail (48% width) ─── */}
                    <div className="flex w-[48%] flex-col overflow-y-auto bg-white p-6">
                        {/* Beneficiary Card */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                                Thông Tin Người Thụ Hưởng & Ngân Hàng
                            </h3>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="text-slate-500">Đơn vị / Người nhận:</span>
                                    <p className="font-semibold text-slate-800 text-sm">{detail.beneficiaryName}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Số tài khoản ngân hàng:</span>
                                    <p className="font-mono font-bold text-slate-900 text-sm">{detail.beneficiaryAccount || 'Chưa cập nhật'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Ngân hàng & Chi nhánh:</span>
                                    <p className="font-medium text-slate-800">{detail.beneficiaryBank || 'Chuyển khoản'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Pháp nhân chi trả:</span>
                                    <p className="font-medium text-slate-800">{detail.legalEntity?.name || 'LYS CELLARS'}</p>
                                </div>
                            </div>

                            {/* Linked Supplier & PO / AP Invoice Badges */}
                            {(detail.supplier || detail.po || detail.apInvoice) && (
                                <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex flex-wrap gap-2 items-center text-[11px]">
                                    {detail.supplier && (
                                        <div className="flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2 py-1 text-slate-700">
                                            <Building2 className="h-3.5 w-3.5 text-[#8B1A2E]" />
                                            <span>NCC: <strong>[{detail.supplier.code}] {detail.supplier.name}</strong></span>
                                            {detail.supplier.taxId && <span className="text-slate-400 font-mono">(MST: {detail.supplier.taxId})</span>}
                                        </div>
                                    )}
                                    {detail.po && (
                                        <div className="flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-amber-800 font-medium">
                                            <Package className="h-3.5 w-3.5 text-amber-600" />
                                            <span>Đơn hàng: <strong>{detail.po.poNo}</strong></span>
                                        </div>
                                    )}
                                    {detail.apInvoice && (
                                        <div className="flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-blue-800 font-medium">
                                            <Receipt className="h-3.5 w-3.5 text-blue-600" />
                                            <span>Hóa đơn AP: <strong>{detail.apInvoice.invoiceNo}</strong></span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Amount Banner */}
                        <div className="mt-4 flex items-center justify-between rounded-lg bg-gradient-to-r from-[#8B1A2E]/10 via-[#8B1A2E]/5 to-transparent p-4 border border-[#8B1A2E]/20">
                            <div>
                                <span className="text-xs font-semibold uppercase text-slate-500">Tổng Số Tiền Đề Nghị</span>
                                <div className="text-2xl font-bold text-[#8B1A2E]">{formatVND(detail.totalAmountVND)}</div>
                                {detail.currency !== 'VND' && (
                                    <div className="text-xs text-slate-500">
                                        Nguyên tệ: {detail.totalAmount.toLocaleString()} {detail.currency} (Tỷ giá: {detail.exchangeRate.toLocaleString()})
                                    </div>
                                )}
                            </div>
                            <div className="text-right text-xs">
                                <div className="text-slate-500">Hạn thanh toán:</div>
                                <div className="font-semibold text-slate-800">{detail.dueDate ? formatDate(detail.dueDate) : 'Càng sớm càng tốt'}</div>
                                {detail.paidDate && (
                                    <div className="mt-1 text-emerald-700 font-medium">
                                        Đã chi ngày: {formatDate(detail.paidDate)}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Line Items Table */}
                        <div className="mt-5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                Chi Tiết Các Khoản Mục Thanh Toán
                            </h3>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 text-slate-600 font-semibold">
                                        <tr>
                                            <th className="p-2.5">Khoản mục / Diễn giải</th>
                                            <th className="p-2.5">Hạng mục chi</th>
                                            <th className="p-2.5 text-center">SL</th>
                                            <th className="p-2.5 text-right">Đơn giá</th>
                                            <th className="p-2.5 text-right">VAT</th>
                                            <th className="p-2.5 text-right">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {detail.items?.map((item: any, i: number) => (
                                            <tr key={item.id || i} className="hover:bg-slate-50/80">
                                                <td className="p-2.5 font-medium text-slate-800">
                                                    <div>{item.description}</div>
                                                    {item.invoiceNo && (
                                                        <div className="text-[10px] text-slate-400">
                                                            HĐ số: {item.invoiceNo} {item.invoiceDate ? `(${formatDate(item.invoiceDate)})` : ''}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-slate-600">
                                                    {item.categoryName ? (
                                                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                                                            {item.categoryName}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-center text-slate-700">{item.quantity}</td>
                                                <td className="p-2.5 text-right font-mono text-slate-700">{item.unitPrice.toLocaleString('vi-VN')}</td>
                                                <td className="p-2.5 text-right font-mono text-slate-500">{item.vatAmount.toLocaleString('vi-VN')}</td>
                                                <td className="p-2.5 text-right font-mono font-semibold text-slate-900">{formatVND(item.totalAmount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* UNC Settlement Box (if paid) */}
                        {detail.uncVoucherNo && (
                            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        <span className="text-xs font-bold text-emerald-900">
                                            Ủy Nhiệm Chi (UNC): {detail.uncVoucherNo}
                                        </span>
                                    </div>
                                    {detail.uncFileUrl && (
                                        <a
                                            href={detail.uncFileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                                        >
                                            <Eye className="h-3.5 w-3.5" /> Xem scan UNC
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Notes / Basis */}
                        {detail.notes && (
                            <div className="mt-4 text-xs">
                                <span className="font-semibold text-slate-500">Ghi chú / Căn cứ:</span>
                                <p className="mt-1 rounded bg-slate-50 p-2.5 text-slate-700 border border-slate-200">{detail.notes}</p>
                            </div>
                        )}

                        {detail.rejectReason && (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                                <span className="font-bold">Lý do từ chối / trả lại: </span>
                                {detail.rejectReason}
                            </div>
                        )}

                        {/* Approval Logs Timeline */}
                        <div className="mt-6 border-t border-slate-200 pt-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                                Nhật Ký Phê Duyệt & Diễn Biến
                            </h3>
                            <div className="space-y-3">
                                {detail.approvalLogs?.map((log: any, idx: number) => (
                                    <div key={log.id || idx} className="flex items-start gap-3 text-xs">
                                        <div className={`mt-0.5 rounded-full p-1 text-white ${
                                            log.action === 'APPROVE' ? 'bg-emerald-600' :
                                            log.action === 'REJECT' ? 'bg-red-600' :
                                            log.action === 'RETURN' ? 'bg-amber-600' :
                                            log.action === 'PAY' ? 'bg-blue-600' : 'bg-slate-500'
                                        }`}>
                                            {log.action === 'APPROVE' ? <CheckCircle2 className="h-3 w-3" /> :
                                             log.action === 'REJECT' ? <XCircle className="h-3 w-3" /> :
                                             log.action === 'PAY' ? <DollarSign className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-slate-800">{log.actorName}</span>
                                                <span className="text-[11px] text-slate-400">{formatDateTime(log.createdAt)}</span>
                                            </div>
                                            <p className="text-slate-600 font-medium">{log.comment || 'Không có ghi chú'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ Action Modal (Duyệt / Từ chối / Trả lại) ═══ */}
            {actionType && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl border border-slate-200 animate-in zoom-in-95">
                        <h3 className="text-base font-bold text-slate-900 mb-1">
                            {actionType === 'APPROVE' ? 'Xác nhận Phê Duyệt Đề Nghị' :
                             actionType === 'REJECT' ? 'Từ Chối Phê Duyệt' : 'Trả Lại Để Sửa Đổi'}
                        </h3>
                        <p className="text-xs text-slate-500 mb-3">
                            {actionType === 'APPROVE'
                                ? 'Phiếu sẽ được chuyển tiếp đến cấp duyệt tiếp theo hoặc chuyển sang hàng đợi chi tiền.'
                                : 'Vui lòng nêu rõ lý do để người lập hoặc bộ phận liên quan nắm thông tin.'}
                        </p>

                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder={actionType === 'APPROVE' ? 'Ý kiến duyệt (tùy chọn)...' : 'Nhập lý do chi tiết...'}
                            rows={3}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-[#8B1A2E] focus:outline-none"
                        />

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={() => setActionType(null)}
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleApprovalSubmit}
                                disabled={submittingAction}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition ${
                                    actionType === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                    actionType === 'REJECT' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                                }`}
                            >
                                {submittingAction && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Settlement Modal (Kế toán chi tiền) ═══ */}
            {showSettleModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 animate-in zoom-in-95">
                        <h3 className="text-base font-bold text-slate-900 mb-1">
                            Xác Nhận Giải Ngân & Đính Kèm Ủy Nhiệm Chi (UNC)
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Ghi nhận tiền đã xuất quỹ/chuyển khoản và đính kèm bản scan UNC để hoàn tất hồ sơ kiểm toán.
                        </p>

                        <div className="space-y-3.5 text-xs">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">Số tiền thực chi (VND) *</label>
                                <input
                                    type="number"
                                    value={paidAmount}
                                    onChange={e => setPaidAmount(Number(e.target.value))}
                                    className="w-full rounded-lg border border-slate-300 p-2 font-mono text-sm font-semibold text-slate-900 focus:border-[#8B1A2E] focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Hình thức thanh toán</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={e => setPaymentMethod(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                    >
                                        <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
                                        <option value="CASH">Tiền mặt</option>
                                        <option value="LC">Tín dụng thư (L/C)</option>
                                        <option value="TT_ADVANCE">Điện chuyển tiền (T/T)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Số hiệu UNC / Phiếu chi</label>
                                    <input
                                        type="text"
                                        placeholder="Vd: UNC-2026-VCB-088"
                                        value={uncVoucherNo}
                                        onChange={e => setUncVoucherNo(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono focus:border-[#8B1A2E] focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">Upload Chứng từ scan UNC / Biên lai</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={e => setUncFile(e.target.files?.[0] || null)}
                                        className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#8B1A2E] hover:file:bg-slate-200"
                                    />
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400">Hỗ trợ file PDF hoặc ảnh chụp UNC (tối đa 20MB)</p>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                onClick={() => setShowSettleModal(false)}
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSettlementSubmit}
                                disabled={settling}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B1A2E] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#721526] transition"
                            >
                                {settling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Hoàn Tất Giải Ngân
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Printable Proposal / Payment Request Form */}
            {showPrintModal && (
                <PrintablePaymentRequest
                    detail={detail}
                    onClose={() => setShowPrintModal(false)}
                />
            )}
        </div>
    )
}
