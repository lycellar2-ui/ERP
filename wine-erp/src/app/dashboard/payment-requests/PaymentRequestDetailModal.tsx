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
import { useAppLocale } from '@/lib/i18n'

interface PaymentRequestDetailModalProps {
    detail: any
    currentUser: any
    onClose: () => void
    onRefresh: () => void
}

const STATUS_CONFIG: Record<string, { label: string; labelEn: string; bg: string; color: string; border: string }> = {
    DRAFT: { label: 'Bản Nháp', labelEn: 'Draft', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
    SUBMITTED: { label: 'Chờ TP Duyệt (Cấp 1)', labelEn: 'Pending Manager (L1)', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    REVIEWING_L1: { label: 'Chờ Kế Toán Duyệt (Cấp 2)', labelEn: 'Pending Accounting (L2)', bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
    REVIEWING_L2: { label: 'Chờ CEO Phê Chuẩn (Cấp 3)', labelEn: 'Pending CEO (L3)', bg: '#ECFEFF', color: '#0E7490', border: '#A5F3FC' },
    APPROVED: { label: 'Đã Duyệt — Chờ Chi Tiền', labelEn: 'Approved — Pending Payout', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
    PAID: { label: 'Đã Giải Ngân / Đã Có UNC', labelEn: 'Disbursed / UNC Attached', bg: '#F0FDF4', color: '#15803D', border: '#86EFAC' },
    REJECTED: { label: 'Bị Từ Chối', labelEn: 'Rejected', bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
    CANCELLED: { label: 'Đã Hủy', labelEn: 'Cancelled', bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
}

export function PaymentRequestDetailModal({
    detail,
    currentUser,
    onClose,
    onRefresh,
}: PaymentRequestDetailModalProps) {
    const { isEn } = useAppLocale()
    const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(0)
    const [zoom, setZoom] = useState(100)
    const [rotation, setRotation] = useState(0)
    const [mobileTab, setMobileTab] = useState<'DETAILS' | 'DOCS'>('DETAILS')

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
                    actionType === 'APPROVE'
                        ? (isEn ? 'Approved successfully' : 'Phê duyệt thành công')
                        : actionType === 'REJECT'
                        ? (isEn ? 'Request rejected' : 'Đã từ chối phiếu')
                        : (isEn ? 'Request returned for revision' : 'Đã trả lại phiếu để chỉnh sửa')
                )
                setActionType(null)
                onRefresh()
            } else {
                toast.error(res.error || (isEn ? 'An error occurred' : 'Có lỗi xảy ra'))
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'Approval error' : 'Lỗi xử lý phê duyệt'))
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
                        toast.error(uploadRes.error || (isEn ? 'Failed to upload UNC file' : 'Lỗi tải file UNC lên'))
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
                toast.success(isEn ? 'Disbursement confirmed successfully!' : 'Đã xác nhận giải ngân thành công!')
                setShowSettleModal(false)
                onRefresh()
            } else {
                toast.error(res.error || (isEn ? 'Disbursement error' : 'Lỗi khi giải ngân'))
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'Processing error' : 'Lỗi xử lý'))
        } finally {
            setSettling(false)
        }
    }

    const isPdf = currentAttachment?.mimeType === 'application/pdf' || currentAttachment?.fileName.toLowerCase().endsWith('.pdf')

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="flex h-full sm:h-[92vh] w-full max-w-[1450px] flex-col overflow-hidden rounded-none sm:rounded-md border border-slate-200 bg-white shadow-2xl">
                {/* ═══ Header ═══ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 bg-slate-50 px-4 sm:px-6 py-3 gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <span className="font-mono text-sm sm:text-base font-bold text-[#B91C1C]">{detail.requestNo}</span>
                        <div
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}
                        >
                            {isEn ? statusStyle.labelEn : statusStyle.label}
                        </div>
                        <h2 className="max-w-[280px] sm:max-w-[450px] truncate text-xs sm:text-sm font-semibold text-slate-800" title={detail.title}>
                            {detail.title}
                        </h2>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        {canApproveCurrentLevel && (
                            <>
                                <button
                                    onClick={() => setActionType('APPROVE')}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 transition"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> {isEn ? 'Approve' : 'Duyệt'}
                                </button>
                                <button
                                    onClick={() => setActionType('RETURN')}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-amber-700 transition"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" /> {isEn ? 'Return' : 'Trả lại'}
                                </button>
                                <button
                                    onClick={() => setActionType('REJECT')}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 transition"
                                >
                                    <XCircle className="h-3.5 w-3.5" /> {isEn ? 'Reject' : 'Từ chối'}
                                </button>
                            </>
                        )}

                        {canSettle && (
                            <button
                                onClick={() => setShowSettleModal(true)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#B91C1C] px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#721526] transition"
                            >
                                <DollarSign className="h-3.5 w-3.5" /> {isEn ? 'Confirm Disbursement' : 'Xác Nhận Giải Ngân'}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setShowPrintModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition"
                            title={isEn ? 'Print Payment Request Form (Form 05-TT)' : 'In biểu mẫu tờ trình / đề nghị thanh toán (Mẫu 05-TT)'}
                        >
                            <Printer className="h-3.5 w-3.5 text-burgundy" /> {isEn ? 'Print' : 'In'}
                        </button>

                        <button
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition ml-auto sm:ml-0"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* ═══ Mobile View Toggle Bar ═══ */}
                <div className="flex md:hidden border-b border-slate-200 bg-white">
                    <button
                        type="button"
                        onClick={() => setMobileTab('DETAILS')}
                        className={`flex-1 py-2.5 text-center text-xs font-semibold border-b-2 transition ${
                            mobileTab === 'DETAILS'
                                ? 'border-[#B91C1C] text-[#B91C1C]'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        {isEn ? 'Request Info' : 'Thông Tin Đề Nghị'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileTab('DOCS')}
                        className={`flex-1 py-2.5 text-center text-xs font-semibold border-b-2 transition ${
                            mobileTab === 'DOCS'
                                ? 'border-[#B91C1C] text-[#B91C1C]'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        {isEn ? `Scanned Docs (${attachments.length})` : `Chứng Từ Scan (${attachments.length})`}
                    </button>
                </div>

                {/* ═══ Body: Split View (Desktop) & Tabbed View (Mobile) ═══ */}
                <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
                    {/* ─── LEFT: Scanned Document Viewer (52% width on desktop) ─── */}
                    <div className={`w-full md:w-[52%] flex-col border-b md:border-b-0 md:border-r border-slate-200 bg-slate-100 ${
                        mobileTab === 'DOCS' ? 'flex flex-1' : 'hidden md:flex'
                    }`}>
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
                                                    ? 'bg-[#B91C1C] text-white shadow-xs'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                        >
                                            <Paperclip className="h-3 w-3" />
                                            <span className="max-w-[130px] truncate">{att.fileName}</span>
                                        </button>
                                    ))
                                ) : (
                                    <span className="text-xs italic text-slate-400">
                                        {isEn ? 'No scanned documents attached' : 'Không có chứng từ scan đính kèm'}
                                    </span>
                                )}
                            </div>

                            {/* Viewer Controls */}
                            {currentAttachment && (
                                <div className="flex items-center gap-1 text-slate-600">
                                    <button
                                        onClick={() => setZoom(z => Math.max(50, z - 25))}
                                        className="rounded p-1 hover:bg-slate-200"
                                        title={isEn ? 'Zoom Out' : 'Thu nhỏ'}
                                    >
                                        <ZoomOut className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="text-[11px] font-mono text-slate-500">{zoom}%</span>
                                    <button
                                        onClick={() => setZoom(z => Math.min(250, z + 25))}
                                        className="rounded p-1 hover:bg-slate-200"
                                        title={isEn ? 'Zoom In' : 'Phóng to'}
                                    >
                                        <ZoomIn className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setRotation(r => (r + 90) % 360)}
                                        className="rounded p-1 hover:bg-slate-200"
                                        title={isEn ? 'Rotate 90°' : 'Xoay 90°'}
                                    >
                                        <RotateCw className="h-3.5 w-3.5" />
                                    </button>
                                    <a
                                        href={currentAttachment.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded p-1 hover:bg-slate-200"
                                        title={isEn ? 'Open in new tab' : 'Mở tab mới'}
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
                                    <p className="text-sm font-medium">
                                        {isEn ? 'No scanned documents for this request' : 'Chưa có chứng từ scan cho phiếu này'}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {isEn
                                            ? 'Requester can upload VAT invoices, delivery notes, or scanned UNC'
                                            : 'Người lập có thể tải lên hóa đơn GTGT, biên bản nghiệm thu hoặc UNC scan'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Attachment Metadata Footer */}
                        {currentAttachment && (
                            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500">
                                <div>
                                    <span className="font-semibold text-slate-700">{isEn ? 'Type: ' : 'Loại: '}</span>
                                    {currentAttachment.docType === 'VAT_INVOICE' ? (isEn ? 'e-VAT Invoice' : 'Hóa đơn GTGT điện tử') :
                                     currentAttachment.docType === 'DELIVERY_NOTE' ? (isEn ? 'Delivery / Handover Note' : 'Biên bản giao hàng / nghiệm thu') :
                                     currentAttachment.docType === 'CONTRACT_DOC' ? (isEn ? 'Contract / Quotation' : 'Hợp đồng / Báo giá') :
                                     currentAttachment.docType === 'BANK_UNC' ? (isEn ? 'Bank Transfer Slip (UNC)' : 'Ủy nhiệm chi ngân hàng') :
                                     (isEn ? 'Other Document' : 'Chứng từ khác')}
                                    <span className="ml-3">({(currentAttachment.fileSize / 1024).toFixed(1)} KB)</span>
                                </div>
                                <div>{isEn ? 'Uploaded by: ' : 'Tải lên bởi: '}<span className="font-medium text-slate-700">{currentAttachment.uploadedByName}</span></div>
                            </div>
                        )}
                    </div>

                    {/* ─── RIGHT: Payment Details & Audit Trail (48% width) ─── */}
                    <div className={`w-full md:w-[48%] flex-col overflow-y-auto bg-white p-4 sm:p-6 ${
                        mobileTab === 'DETAILS' ? 'flex flex-1' : 'hidden md:flex'
                    }`}>
                        {/* Beneficiary Card */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                                {isEn ? 'Beneficiary & Bank Information' : 'Thông Tin Người Thụ Hưởng & Ngân Hàng'}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="text-slate-500">{isEn ? 'Beneficiary / Payee:' : 'Đơn vị / Người nhận:'}</span>
                                    <p className="font-semibold text-slate-800 text-sm">{detail.beneficiaryName}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">{isEn ? 'Bank Account No:' : 'Số tài khoản ngân hàng:'}</span>
                                    <p className="font-mono font-bold text-slate-900 text-sm">{detail.beneficiaryAccount || (isEn ? 'Not updated' : 'Chưa cập nhật')}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">{isEn ? 'Bank & Branch:' : 'Ngân hàng & Chi nhánh:'}</span>
                                    <p className="font-medium text-slate-800">{detail.beneficiaryBank || (isEn ? 'Bank Transfer' : 'Chuyển khoản')}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">{isEn ? 'Paying Legal Entity:' : 'Pháp nhân chi trả:'}</span>
                                    <p className="font-medium text-slate-800">{detail.legalEntity?.name || 'LYS CELLARS'}</p>
                                </div>
                            </div>

                            {/* Linked Supplier & PO / AP Invoice Badges */}
                            {(detail.supplier || detail.po || detail.apInvoice) && (
                                <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex flex-wrap gap-2 items-center text-[11px]">
                                    {detail.supplier && (
                                        <div className="flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2 py-1 text-slate-700">
                                            <Building2 className="h-3.5 w-3.5 text-[#B91C1C]" />
                                            <span>{isEn ? 'Supplier' : 'NCC'}: <strong>[{detail.supplier.code}] {detail.supplier.name}</strong></span>
                                            {detail.supplier.taxId && <span className="text-slate-400 font-mono">({isEn ? 'Tax ID' : 'MST'}: {detail.supplier.taxId})</span>}
                                        </div>
                                    )}
                                    {detail.po && (
                                        <div className="flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-amber-800 font-medium">
                                            <Package className="h-3.5 w-3.5 text-amber-600" />
                                            <span>{isEn ? 'PO' : 'Đơn hàng'}: <strong>{detail.po.poNo}</strong></span>
                                        </div>
                                    )}
                                    {detail.apInvoice && (
                                        <div className="flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-blue-800 font-medium">
                                            <Receipt className="h-3.5 w-3.5 text-blue-600" />
                                            <span>{isEn ? 'AP Invoice' : 'Hóa đơn AP'}: <strong>{detail.apInvoice.invoiceNo}</strong></span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Amount Banner */}
                        <div className="mt-4 flex items-center justify-between rounded-lg bg-gradient-to-r from-[#B91C1C]/10 via-[#B91C1C]/5 to-transparent p-4 border border-[#B91C1C]/20">
                            <div>
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                    {isEn ? 'Total Requested Amount' : 'Tổng Số Tiền Đề Nghị'}
                                </span>
                                <div className="text-2xl font-bold text-[#B91C1C]">{formatVND(detail.totalAmountVND)}</div>
                                {detail.currency !== 'VND' && (
                                    <div className="text-xs text-slate-500">
                                        {isEn ? 'Original currency' : 'Nguyên tệ'}: {detail.totalAmount.toLocaleString()} {detail.currency} ({isEn ? 'Rate' : 'Tỷ giá'}: {detail.exchangeRate.toLocaleString()})
                                    </div>
                                )}
                            </div>
                            <div className="text-right text-xs">
                                <div className="text-slate-500">{isEn ? 'Payment Due Date:' : 'Hạn thanh toán:'}</div>
                                <div className="font-semibold text-slate-800">{detail.dueDate ? formatDate(detail.dueDate) : (isEn ? 'ASAP' : 'Càng sớm càng tốt')}</div>
                                {detail.paidDate && (
                                    <div className="mt-1 text-emerald-700 font-medium">
                                        {isEn ? 'Paid on: ' : 'Đã chi ngày: '}{formatDate(detail.paidDate)}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Line Items Table */}
                        <div className="mt-5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                {isEn ? 'Payment Line Items Detail' : 'Chi Tiết Các Khoản Mục Thanh Toán'}
                            </h3>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 text-slate-600 font-semibold">
                                        <tr>
                                            <th className="p-2.5">{isEn ? 'Item / Description' : 'Khoản mục / Diễn giải'}</th>
                                            <th className="p-2.5">{isEn ? 'Expense Category' : 'Hạng mục chi'}</th>
                                            <th className="p-2.5 text-center">{isEn ? 'Qty' : 'SL'}</th>
                                            <th className="p-2.5 text-right">{isEn ? 'Unit Price' : 'Đơn giá'}</th>
                                            <th className="p-2.5 text-right">VAT</th>
                                            <th className="p-2.5 text-right">{isEn ? 'Total' : 'Thành tiền'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {detail.items?.map((item: any, i: number) => (
                                            <tr key={item.id || i} className="hover:bg-slate-50/80">
                                                <td className="p-2.5 font-medium text-slate-800">
                                                    <div>{item.description}</div>
                                                    {item.invoiceNo && (
                                                        <div className="text-[10px] text-slate-400">
                                                            {isEn ? 'Inv No: ' : 'HĐ số: '}{item.invoiceNo} {item.invoiceDate ? `(${formatDate(item.invoiceDate)})` : ''}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-slate-600">
                                                    {item.categoryName ? (
                                                        <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 whitespace-nowrap shrink-0">
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
                                            {isEn ? `Payment Order (UNC): ${detail.uncVoucherNo}` : `Ủy Nhiệm Chi (UNC): ${detail.uncVoucherNo}`}
                                        </span>
                                    </div>
                                    {detail.uncFileUrl && (
                                        <a
                                            href={detail.uncFileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                                        >
                                            <Eye className="h-3.5 w-3.5" /> {isEn ? 'View Scanned UNC' : 'Xem scan UNC'}
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Notes / Basis */}
                        {detail.notes && (
                            <div className="mt-4 text-xs">
                                <span className="font-semibold text-slate-500">{isEn ? 'Notes / Basis:' : 'Ghi chú / Căn cứ:'}</span>
                                <p className="mt-1 rounded bg-slate-50 p-2.5 text-slate-700 border border-slate-200">{detail.notes}</p>
                            </div>
                        )}

                        {detail.rejectReason && (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                                <span className="font-bold">{isEn ? 'Rejection / Return Reason: ' : 'Lý do từ chối / trả lại: '}</span>
                                {detail.rejectReason}
                            </div>
                        )}

                        {/* Approval Logs Timeline */}
                        <div className="mt-6 border-t border-slate-200 pt-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                                {isEn ? 'Approval Audit Trail & Timeline' : 'Nhật Ký Phê Duyệt & Diễn Biến'}
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
                                            <p className="text-slate-600 font-medium">{log.comment || (isEn ? 'No comment' : 'Không có ghi chú')}</p>
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
                    <div className="w-full max-w-md rounded-md bg-white p-5 shadow-xl border border-slate-200 animate-in zoom-in-95">
                        <h3 className="text-base font-bold text-slate-900 mb-1">
                            {actionType === 'APPROVE'
                                ? (isEn ? 'Confirm Approval' : 'Xác nhận Phê Duyệt Đề Nghị')
                                : actionType === 'REJECT'
                                ? (isEn ? 'Reject Request' : 'Từ Chối Phê Duyệt')
                                : (isEn ? 'Return for Revision' : 'Trả Lại Để Sửa Đổi')}
                        </h3>
                        <p className="text-xs text-slate-500 mb-3">
                            {actionType === 'APPROVE'
                                ? (isEn ? 'This request will advance to the next approval level or move to the disbursement queue.' : 'Phiếu sẽ được chuyển tiếp đến cấp duyệt tiếp theo hoặc chuyển sang hàng đợi chi tiền.')
                                : (isEn ? 'Please state the reason clearly so the requester or related department is informed.' : 'Vui lòng nêu rõ lý do để người lập hoặc bộ phận liên quan nắm thông tin.')}
                        </p>

                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder={actionType === 'APPROVE' ? (isEn ? 'Approval comment (optional)...' : 'Ý kiến duyệt (tùy chọn)...') : (isEn ? 'Enter detailed reason...' : 'Nhập lý do chi tiết...')}
                            rows={3}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-[#B91C1C] focus:outline-none"
                        />

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={() => setActionType(null)}
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                            >
                                {isEn ? 'Cancel' : 'Hủy'}
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
                                {isEn ? 'Confirm' : 'Xác nhận'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Settlement Modal (Kế toán chi tiền) ═══ */}
            {showSettleModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-md bg-white p-6 shadow-xl border border-slate-200 animate-in zoom-in-95">
                        <h3 className="text-base font-bold text-slate-900 mb-1">
                            {isEn ? 'Confirm Disbursement & Attach Payment Order (UNC)' : 'Xác Nhận Giải Ngân & Đính Kèm Ủy Nhiệm Chi (UNC)'}
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                            {isEn
                                ? 'Record disbursed funds and attach scanned UNC slip to complete audit documentation.'
                                : 'Ghi nhận tiền đã xuất quỹ/chuyển khoản và đính kèm bản scan UNC để hoàn tất hồ sơ kiểm toán.'}
                        </p>

                        <div className="space-y-3.5 text-xs">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    {isEn ? 'Actual Paid Amount (VND) *' : 'Số tiền thực chi (VND) *'}
                                </label>
                                <input
                                    type="number"
                                    value={paidAmount}
                                    onChange={e => setPaidAmount(Number(e.target.value))}
                                    className="w-full rounded-lg border border-slate-300 p-2 font-mono text-sm font-semibold text-slate-900 focus:border-[#B91C1C] focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Payment Method' : 'Hình thức thanh toán'}
                                    </label>
                                    <select
                                        value={paymentMethod}
                                        onChange={e => setPaymentMethod(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        <option value="BANK_TRANSFER">{isEn ? 'Bank Transfer' : 'Chuyển khoản ngân hàng'}</option>
                                        <option value="CASH">{isEn ? 'Cash' : 'Tiền mặt'}</option>
                                        <option value="LC">{isEn ? 'Letter of Credit (L/C)' : 'Tín dụng thư (L/C)'}</option>
                                        <option value="TT_ADVANCE">{isEn ? 'Telegraphic Transfer (T/T)' : 'Điện chuyển tiền (T/T)'}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'UNC / Voucher No' : 'Số hiệu UNC / Phiếu chi'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. UNC-2026-VCB-088"
                                        value={uncVoucherNo}
                                        onChange={e => setUncVoucherNo(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    {isEn ? 'Upload Scanned UNC / Receipt' : 'Upload Chứng từ scan UNC / Biên lai'}
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={e => setUncFile(e.target.files?.[0] || null)}
                                        className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#B91C1C] hover:file:bg-slate-200"
                                    />
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400">
                                    {isEn ? 'Supports PDF or image files (max 20MB)' : 'Hỗ trợ file PDF hoặc ảnh chụp UNC (tối đa 20MB)'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <button
                                onClick={() => setShowSettleModal(false)}
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                            >
                                {isEn ? 'Cancel' : 'Hủy'}
                            </button>
                            <button
                                onClick={handleSettlementSubmit}
                                disabled={settling}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#B91C1C] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#721526] transition"
                            >
                                {settling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {isEn ? 'Complete Disbursement' : 'Hoàn Tất Giải Ngân'}
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
