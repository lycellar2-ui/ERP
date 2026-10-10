'use client'

import React, { useState } from 'react'
import { Printer, X, CheckCircle2, FileText, Stamp, Sliders, ArrowLeft, Download } from 'lucide-react'
import { formatVND, formatDate, numberToWordsVN } from '@/lib/utils'

interface PrintablePaymentRequestProps {
    detail: any
    onClose: () => void
    initialTitleType?: 'GIAY_DE_NGHI' | 'TO_TRINH'
    isBlankTemplate?: boolean
}

export function PrintablePaymentRequest({
    detail,
    onClose,
    initialTitleType = 'GIAY_DE_NGHI',
    isBlankTemplate = false,
}: PrintablePaymentRequestProps) {
    const [titleType, setTitleType] = useState<'GIAY_DE_NGHI' | 'TO_TRINH'>(initialTitleType)
    const [showStamp, setShowStamp] = useState(!isBlankTemplate)
    const [showBlank, setShowBlank] = useState(isBlankTemplate)

    const isPaid = detail?.status === 'PAID'
    const isApproved = ['APPROVED', 'PAID'].includes(detail?.status)

    // Find approvers from logs
    const logs = detail?.approvalLogs || []
    const deptLog = logs.find((l: any) => l.action === 'APPROVE' && l.toStatus === 'REVIEWING_L1')
    const acctLog = logs.find((l: any) => l.action === 'APPROVE' && (l.toStatus === 'REVIEWING_L2' || l.toStatus === 'APPROVED'))
    const ceoLog = logs.find((l: any) => l.action === 'APPROVE' && l.toStatus === 'APPROVED')

    const legalEntity = detail?.legalEntity || {}
    const creator = detail?.creator || {}
    const department = detail?.department || {}
    const supplier = detail?.supplier || {}
    const items = showBlank ? [] : (detail?.items || [])
    const attachments = showBlank ? [] : (detail?.attachments || [])

    const totalAmountVND = showBlank ? 0 : Number(detail?.totalAmountVND || 0)
    const totalVAT = showBlank ? 0 : items.reduce((sum: number, it: any) => sum + Number(it.vatAmount || 0), 0)
    const totalSub = showBlank ? 0 : items.reduce((sum: number, it: any) => sum + Number(it.amount || 0), 0)

    const handlePrint = () => {
        window.print()
    }

    const createdDate = detail?.createdAt ? new Date(detail.createdAt) : new Date()
    const day = createdDate.getDate().toString().padStart(2, '0')
    const month = (createdDate.getMonth() + 1).toString().padStart(2, '0')
    const year = createdDate.getFullYear()

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 overflow-y-auto p-4 sm:p-6 print:p-0 print:bg-white print:overflow-visible print:inset-auto print:static">
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 12mm 10mm 12mm 10mm;
                    }
                    body {
                        font-family: 'Times New Roman', Times, 'Liberation Serif', serif !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background: #fff !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
                .font-serif-doc {
                    font-family: 'Times New Roman', Times, 'Liberation Serif', serif;
                }
            `}</style>

            {/* Top Toolbar (Hidden on Print) */}
            <div className="max-w-[210mm] mx-auto mb-4 bg-white/95 backdrop-blur-md border border-slate-200 text-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xl print:hidden">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                        title="Quay lại"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-burgundy" />
                        <div>
                            <div className="font-semibold text-sm text-slate-900">
                                {showBlank ? 'Phôi Mẫu Trắng Tờ Trình' : `In Phiếu: ${detail?.requestNo || 'Đề nghị thanh toán'}`}
                            </div>
                            <div className="text-xs text-slate-500">
                                Chuẩn Mẫu 05-TT Bộ Tài Chính & Quy chế nội bộ
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                    {/* Switch Form Title */}
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-medium">
                        <button
                            type="button"
                            onClick={() => setTitleType('GIAY_DE_NGHI')}
                            className={`px-2.5 py-1.5 rounded-md transition-all ${titleType === 'GIAY_DE_NGHI' ? 'bg-white text-burgundy font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Giấy Đề Nghị
                        </button>
                        <button
                            type="button"
                            onClick={() => setTitleType('TO_TRINH')}
                            className={`px-2.5 py-1.5 rounded-md transition-all ${titleType === 'TO_TRINH' ? 'bg-white text-burgundy font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Tờ Trình Duyệt Chi
                        </button>
                    </div>

                    {/* Toggle Stamp */}
                    {!showBlank && (
                        <button
                            type="button"
                            onClick={() => setShowStamp(!showStamp)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${showStamp ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                        >
                            <Stamp className="w-3.5 h-3.5" />
                            {showStamp ? 'Mộc Duyệt: BẬT' : 'Mộc Duyệt: TẮT'}
                        </button>
                    )}

                    {/* Toggle Blank Template */}
                    <button
                        type="button"
                        onClick={() => setShowBlank(!showBlank)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showBlank ? 'bg-amber-50 border-amber-200 text-amber-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                    >
                        {showBlank ? 'Xem Bản Có Dữ Liệu' : 'In Phôi Mẫu Trống'}
                    </button>

                    {/* Print Button */}
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="px-4 py-1.5 bg-burgundy hover:bg-burgundy/90 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                        <Printer className="w-4 h-4" />
                        In Ngay (Print)
                    </button>

                    {/* Close */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* A4 Paper Container */}
            <div className="max-w-[210mm] mx-auto bg-white border border-slate-300 shadow-2xl p-[12mm] text-slate-900 font-serif-doc text-[11pt] leading-[1.35] print:border-none print:shadow-none print:p-0 print:m-0">
                {/* 1. Header: Enterprise Info & Legal Form Reference */}
                <div className="grid grid-cols-12 gap-2 mb-4 border-b border-black/20 pb-3">
                    <div className="col-span-7 pr-2">
                        <div className="font-bold text-[11.5pt] uppercase text-black leading-tight">
                            {legalEntity.name || 'CÔNG TY CỔ PHẦN RƯỢU VANG LY CELLARS'}
                        </div>
                        <div className="text-[10pt] text-slate-700 mt-0.5">
                            <span className="font-semibold">Đ/c:</span> {legalEntity.address || 'Tòa nhà Wine Tower, 128 Nguyễn Đình Chiểu, P. Võ Thị Sáu, Q.3, TP.HCM'}
                        </div>
                        <div className="text-[10pt] text-slate-700">
                            <span className="font-semibold">Mã số thuế:</span> {legalEntity.taxId || '0315897462'} &nbsp;|&nbsp; <span className="font-semibold">ĐT:</span> {legalEntity.phone || '028 3822 9999'}
                        </div>
                        <div className="text-[10pt] text-slate-700">
                            <span className="font-semibold">Bộ phận đề xuất:</span> {department.name || (showBlank ? '...................................................' : 'Khối Vận Hành & Tài Chính')}
                        </div>
                    </div>

                    <div className="col-span-5 text-right pl-2">
                        <div className="font-bold text-[10.5pt] text-black">
                            Mẫu số 05 - TT
                        </div>
                        <div className="text-[8.5pt] italic text-slate-600 leading-snug">
                            (Ban hành theo Thông tư số 200/2014/TT-BTC<br />
                            và TT 133/2016/TT-BTC của Bộ Tài chính)
                        </div>
                        <div className="mt-1.5 font-bold text-[10.5pt] text-slate-900">
                            Số: <span className="text-burgundy font-mono">{showBlank ? 'PR-2026-.......' : (detail?.requestNo || 'PR-2026-0001')}</span>
                        </div>
                        <div className="text-[9.5pt] italic text-slate-600">
                            Ngày {day} tháng {month} năm {year}
                        </div>
                    </div>
                </div>

                {/* 2. Main Title */}
                <div className="text-center my-4">
                    <div className="font-bold text-[16pt] uppercase tracking-wide text-black">
                        {titleType === 'GIAY_DE_NGHI' ? 'GIẤY ĐỀ NGHỊ THANH TOÁN' : 'TỜ TRÌNH ĐỀ NGHỊ PHÊ DUYỆT THANH TOÁN'}
                    </div>
                    <div className="text-[10pt] italic text-slate-600 mt-0.5">
                        {titleType === 'GIAY_DE_NGHI'
                            ? '(Áp dụng cho mọi khoản chi phí mua hàng, vận hành và dịch vụ)'
                            : '(Kính trình Ban Tổng Giám Đốc và Hội đồng Phê duyệt Tài chính)'}
                    </div>
                </div>

                {/* 3. Salutation (Kính gửi) */}
                <div className="mb-3 text-[10.5pt]">
                    <div className="font-semibold">Kính gửi:</div>
                    <div className="pl-6 space-y-0.5">
                        <div>— Ban Tổng Giám Đốc Công ty</div>
                        <div>— Phòng Tài chính - Kế toán</div>
                        <div>— Trưởng bộ phận: <span className="italic">{department.name || (showBlank ? '.........................................................' : 'Bộ phận liên quan')}</span></div>
                    </div>
                </div>

                {/* 4. Proposer Info & Reason */}
                <div className="space-y-1.5 mb-3 text-[10.5pt]">
                    <div className="flex">
                        <span className="w-48 font-semibold">Họ và tên người đề nghị:</span>
                        <span className="flex-1 font-bold">{showBlank ? '....................................................................................................' : (creator.name || creator.email || '....................................................')}</span>
                    </div>
                    <div className="flex">
                        <span className="w-48 font-semibold">Bộ phận / Phòng ban:</span>
                        <span className="flex-1">{showBlank ? '....................................................................................................' : (department.name || '....................................................')}</span>
                    </div>
                    <div className="flex">
                        <span className="w-48 font-semibold">Nội dung thanh toán:</span>
                        <span className="flex-1 font-semibold text-slate-900">{showBlank ? '................................................................................................................................................................................' : (detail?.title || '....................................................')}</span>
                    </div>
                    {detail?.notes && !showBlank && (
                        <div className="flex">
                            <span className="w-48 font-semibold">Diễn giải chi tiết:</span>
                            <span className="flex-1 italic text-slate-800">{detail.notes}</span>
                        </div>
                    )}
                    <div className="flex text-[10pt]">
                        <span className="w-48 font-semibold">Căn cứ văn bản kèm theo:</span>
                        <span className="flex-1">
                            {showBlank ? (
                                'Hợp đồng / Đơn đặt hàng PO / Tờ trình số: .......................................................................'
                            ) : (
                                <>
                                    {detail?.po?.poNo && <span className="mr-3 font-medium">Đơn mua PO: <b>{detail.po.poNo}</b></span>}
                                    {detail?.apInvoice?.invoiceNo && <span className="mr-3 font-medium">Hóa đơn AP: <b>{detail.apInvoice.invoiceNo}</b></span>}
                                    {detail?.proposal?.proposalNo && <span className="font-medium">Tờ trình: <b>{detail.proposal.proposalNo}</b> ({detail.proposal.title})</span>}
                                    {!detail?.po?.poNo && !detail?.apInvoice?.invoiceNo && !detail?.proposal?.proposalNo && 'Theo thỏa thuận & chứng từ đính kèm'}
                                </>
                            )}
                        </span>
                    </div>
                </div>

                {/* 5. Detailed Items Table */}
                <div className="mb-3">
                    <div className="font-bold text-[10.5pt] mb-1 uppercase tracking-wide">
                        BẢNG KÊ CHI TIẾT CÁC KHOẢN THANH TOÁN:
                    </div>
                    <table className="w-full border-collapse border border-black text-[9.5pt]">
                        <thead>
                            <tr className="bg-slate-100 font-bold text-center">
                                <th className="border border-black p-1.5 w-8">STT</th>
                                <th className="border border-black p-1.5">Nội dung chi tiết</th>
                                <th className="border border-black p-1.5 w-32">Hạng mục chi phí</th>
                                <th className="border border-black p-1.5 w-16">TK Nợ</th>
                                <th className="border border-black p-1.5 w-12">ĐVT</th>
                                <th className="border border-black p-1.5 w-14">SL</th>
                                <th className="border border-black p-1.5 w-24">Đơn giá</th>
                                <th className="border border-black p-1.5 w-24">Tiền chưa thuế</th>
                                <th className="border border-black p-1.5 w-20">Thuế VAT</th>
                                <th className="border border-black p-1.5 w-28">Thành tiền (VNĐ)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {showBlank || items.length === 0 ? (
                                <>
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <tr key={i} className="h-7 text-center">
                                            <td className="border border-black p-1">{i}</td>
                                            <td className="border border-black p-1 text-left"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                        </tr>
                                    ))}
                                </>
                            ) : (
                                items.map((it: any, idx: number) => (
                                    <tr key={it.id || idx}>
                                        <td className="border border-black p-1 text-center">{idx + 1}</td>
                                        <td className="border border-black p-1 leading-snug">
                                            <div className="font-semibold">{it.description}</div>
                                            {it.invoiceNo && (
                                                <div className="text-[8.5pt] text-slate-600">
                                                    HĐ số: {it.invoiceNo} {it.invoiceDate && `(${formatDate(it.invoiceDate)})`}
                                                </div>
                                            )}
                                        </td>
                                        <td className="border border-black p-1 text-center font-medium">
                                            {it.category?.name || 'Chi phí chung'}
                                        </td>
                                        <td className="border border-black p-1 text-center font-mono font-bold">
                                            {it.accountCode || it.category?.defaultAccount || '642'}
                                        </td>
                                        <td className="border border-black p-1 text-center">Lần</td>
                                        <td className="border border-black p-1 text-center">{Number(it.quantity || 1)}</td>
                                        <td className="border border-black p-1 text-right">{formatVND(Number(it.unitPrice || it.amount))}</td>
                                        <td className="border border-black p-1 text-right">{formatVND(Number(it.amount))}</td>
                                        <td className="border border-black p-1 text-right">{formatVND(Number(it.vatAmount || 0))}</td>
                                        <td className="border border-black p-1 text-right font-bold">{formatVND(Number(it.totalAmount))}</td>
                                    </tr>
                                ))
                            )}

                            {/* Totals Row */}
                            <tr className="font-bold bg-slate-50">
                                <td colSpan={7} className="border border-black p-1.5 text-right uppercase">
                                    Cộng tiền hàng / chi phí chưa thuế:
                                </td>
                                <td className="border border-black p-1.5 text-right font-mono">
                                    {showBlank ? '' : formatVND(totalSub)}
                                </td>
                                <td className="border border-black p-1.5 text-right font-mono">
                                    {showBlank ? '' : formatVND(totalVAT)}
                                </td>
                                <td className="border border-black p-1.5 text-right font-mono text-burgundy">
                                    {showBlank ? '' : formatVND(totalAmountVND)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 6. Amount in words & Payment Details */}
                <div className="border border-black/30 rounded-xs p-2.5 mb-3 bg-slate-50/50 space-y-1.5 text-[10.5pt]">
                    <div className="flex">
                        <span className="font-bold w-48">Số tiền đề nghị:</span>
                        <span className="flex-1 font-bold text-[11.5pt] text-burgundy">
                            {showBlank ? '................................................... VNĐ' : `${formatVND(totalAmountVND)}`}
                        </span>
                    </div>
                    <div className="flex">
                        <span className="font-semibold w-48">Số tiền viết bằng chữ:</span>
                        <span className="flex-1 italic font-medium">
                            {showBlank ? '................................................................................................................................................................' : numberToWordsVN(totalAmountVND)}
                        </span>
                    </div>
                    <div className="flex items-center gap-6 pt-1">
                        <span className="font-semibold w-44">Hình thức thanh toán:</span>
                        <label className="flex items-center gap-1.5 font-medium">
                            <input type="checkbox" checked={!showBlank && detail?.paymentMethod === 'BANK_TRANSFER'} readOnly className="w-3.5 h-3.5" />
                            Chuyển khoản ngân hàng
                        </label>
                        <label className="flex items-center gap-1.5 font-medium">
                            <input type="checkbox" checked={!showBlank && detail?.paymentMethod === 'CASH'} readOnly className="w-3.5 h-3.5" />
                            Tiền mặt
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 pt-1 text-[10pt]">
                        <div>
                            <span className="font-semibold">Đơn vị / Người thụ hưởng:</span>{' '}
                            <b>{showBlank ? '................................................................' : (detail?.beneficiaryName || supplier.name || '................................................')}</b>
                        </div>
                        <div>
                            <span className="font-semibold">Tại Ngân hàng:</span>{' '}
                            {showBlank ? '................................................................' : (detail?.beneficiaryBank || '................................................')}
                        </div>
                        <div>
                            <span className="font-semibold">Số tài khoản thụ hưởng:</span>{' '}
                            <b className="font-mono">{showBlank ? '................................................................' : (detail?.beneficiaryAccount || '................................................')}</b>
                        </div>
                        <div>
                            <span className="font-semibold">Hạn thanh toán:</span>{' '}
                            {showBlank ? '...... / ...... / 2026' : (detail?.dueDate ? formatDate(detail.dueDate) : 'Theo quy định')}
                        </div>
                    </div>
                </div>

                {/* 7. Attachments checklist */}
                <div className="mb-3 text-[10pt] border-b border-black/20 pb-2">
                    <span className="font-semibold">Chứng từ gốc kèm theo: </span>
                    {showBlank ? (
                        <span>[  ] Hóa đơn GTGT &nbsp;&nbsp; [  ] Hợp đồng / PO &nbsp;&nbsp; [  ] Biên bản nghiệm thu &nbsp;&nbsp; [  ] Tờ khai Hải quan &nbsp;&nbsp; [  ] Báo giá</span>
                    ) : (
                        <span>
                            {attachments.length > 0 ? (
                                attachments.map((att: any, idx: number) => (
                                    <span key={att.id || idx} className="inline-block mr-2.5">
                                        • {att.fileName} ({att.docType})
                                    </span>
                                ))
                            ) : (
                                <span className="italic text-slate-500">Đã kiểm tra chứng từ hợp lệ trên hệ thống</span>
                            )}
                            <span className="ml-1 font-semibold">(Tổng: {attachments.length} chứng từ scan đính kèm)</span>
                        </span>
                    )}
                </div>

                {/* 8. Signature Blocks (5 columns) with E-Stamps */}
                <div className="mt-4 pt-2">
                    <table className="w-full text-center table-fixed text-[10pt] border-collapse">
                        <thead>
                            <tr className="font-bold uppercase text-[9.5pt]">
                                <th className="p-1 w-[20%]">Người đề nghị</th>
                                <th className="p-1 w-[20%]">Trưởng bộ phận</th>
                                <th className="p-1 w-[20%]">Kế toán thanh toán</th>
                                <th className="p-1 w-[20%]">Kế toán trưởng</th>
                                <th className="p-1 w-[20%]">Tổng Giám Đốc</th>
                            </tr>
                            <tr className="italic text-[8.5pt] text-slate-500 font-normal">
                                <td className="pb-1">(Ký, ghi rõ họ tên)</td>
                                <td className="pb-1">(Ký, duyệt nhu cầu)</td>
                                <td className="pb-1">(Kiểm tra chứng từ)</td>
                                <td className="pb-1">(Kiểm soát ngân sách)</td>
                                <td className="pb-1">(Phê duyệt chi)</td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="h-24 align-middle">
                                {/* Proposer */}
                                <td className="p-1 relative">
                                    {showStamp && !showBlank && (
                                        <div className="inline-flex flex-col items-center justify-center p-1.5 border border-dashed border-emerald-600 rounded bg-emerald-50/60 text-emerald-800 text-[8pt] font-sans">
                                            <div className="font-bold flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                ĐÃ LẬP PHIẾU
                                            </div>
                                            <div className="text-[7pt] text-slate-500 mt-0.5">{day}/{month}/{year}</div>
                                        </div>
                                    )}
                                </td>

                                {/* Dept Manager */}
                                <td className="p-1 relative">
                                    {showStamp && !showBlank && deptLog && (
                                        <div className="inline-flex flex-col items-center justify-center p-1.5 border border-emerald-600 rounded bg-emerald-50/80 text-emerald-800 text-[8pt] font-sans">
                                            <div className="font-bold flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                DUYỆT CẤP 1
                                            </div>
                                            <div className="font-medium text-[7.5pt] text-slate-700">{deptLog.actor?.name}</div>
                                            <div className="text-[7pt] text-slate-500">{formatDate(deptLog.createdAt)}</div>
                                        </div>
                                    )}
                                </td>

                                {/* Payment Accountant */}
                                <td className="p-1 relative">
                                    {showStamp && !showBlank && (acctLog || isPaid) && (
                                        <div className="inline-flex flex-col items-center justify-center p-1.5 border border-emerald-600 rounded bg-emerald-50/80 text-emerald-800 text-[8pt] font-sans">
                                            <div className="font-bold flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                KIỂM TRA HỢP LỆ
                                            </div>
                                            <div className="font-medium text-[7.5pt] text-slate-700">{acctLog?.actor?.name || 'Kế toán viên'}</div>
                                            <div className="text-[7pt] text-slate-500">{acctLog ? formatDate(acctLog.createdAt) : ''}</div>
                                        </div>
                                    )}
                                </td>

                                {/* Chief Accountant */}
                                <td className="p-1 relative">
                                    {showStamp && !showBlank && isApproved && (
                                        <div className="inline-flex flex-col items-center justify-center p-1.5 border border-emerald-600 rounded bg-emerald-50/80 text-emerald-800 text-[8pt] font-sans">
                                            <div className="font-bold flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                DUYỆT NGÂN SÁCH
                                            </div>
                                            <div className="font-medium text-[7.5pt] text-slate-700">Kế Toán Trưởng</div>
                                        </div>
                                    )}
                                </td>

                                {/* CEO Approval */}
                                <td className="p-1 relative">
                                    {showStamp && !showBlank && isApproved && (
                                        <div className="inline-flex flex-col items-center justify-center p-2 border-2 border-burgundy rounded bg-rose-50 text-burgundy text-[8pt] font-sans shadow-xs">
                                            <div className="font-extrabold tracking-wide uppercase flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3 text-burgundy" />
                                                PHÊ DUYỆT CHI
                                            </div>
                                            <div className="font-bold text-[8pt] text-slate-900 mt-0.5">{ceoLog?.actor?.name || 'Tổng Giám Đốc'}</div>
                                            <div className="text-[7pt] text-slate-600">{ceoLog ? formatDate(ceoLog.createdAt) : ''}</div>
                                        </div>
                                    )}
                                </td>
                            </tr>

                            {/* Signer Names */}
                            <tr className="font-bold text-[10pt]">
                                <td className="pt-2">{showBlank ? '' : (creator.name || creator.email || '')}</td>
                                <td className="pt-2">{showBlank ? '' : (deptLog?.actor?.name || '')}</td>
                                <td className="pt-2">{showBlank ? '' : (acctLog?.actor?.name || '')}</td>
                                <td className="pt-2"></td>
                                <td className="pt-2">{showBlank ? '' : (ceoLog?.actor?.name || '')}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 9. Payment Confirmation (Thủ quỹ / Kế toán thanh toán sau khi chi) */}
                <div className="mt-5 pt-3 border-t border-dashed border-black/40 text-[9pt] grid grid-cols-2 gap-4 bg-slate-50/60 p-2.5 rounded-xs">
                    <div>
                        <div className="font-bold uppercase text-[9.5pt] mb-1">PHẦN GHI NHẬN CỦA THỦ QUỸ / NGÂN HÀNG:</div>
                        <div>— Ngày thực chi / chuyển tiền: <b>{showBlank ? '....... / ....... / 2026' : (detail?.paidDate ? formatDate(detail.paidDate) : '................................')}</b></div>
                        <div>— Số chứng từ / Lệnh UNC: <b className="font-mono">{showBlank ? '................................................' : (detail?.uncVoucherNo || '................................')}</b></div>
                        <div>— Số tiền đã chi thực tế: <b>{showBlank ? '................................................ VNĐ' : (detail?.paidAmount ? formatVND(Number(detail.paidAmount)) : '................................')}</b></div>
                    </div>
                    <div className="text-right flex flex-col justify-between">
                        <div className="italic text-slate-600">
                            Hệ thống ERP xác thực chứng từ điện tử — Khóa sổ kế toán
                        </div>
                        <div className="font-semibold text-slate-700">
                            Thủ quỹ / Kế toán viên thực hiện chi (Ký, ghi rõ họ tên)
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
