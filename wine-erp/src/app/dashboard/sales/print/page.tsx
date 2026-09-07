'use client'

import { useEffect, useState, use } from 'react'
import { getSalesOrderDetail } from '../actions'
import { formatVND, formatDateTime } from '@/lib/utils'
import { Loader2, Printer, ArrowLeft, Globe } from 'lucide-react'

interface Props {
    searchParams: Promise<{ id?: string; lang?: string }>
}

type Lang = 'vi' | 'en'

const CHANNEL_MAP: Record<string, { vi: string; en: string }> = {
    'HORECA': { vi: 'HORECA', en: 'HORECA' },
    'WHOLESALE_DISTRIBUTOR': { vi: 'Bán sỉ / Nhà phân phối', en: 'Wholesale / Distributor' },
    'VIP_RETAIL': { vi: 'Khách VIP', en: 'VIP Retail' },
    'DIRECT_INDIVIDUAL': { vi: 'Khách lẻ trực tiếp', en: 'Direct Individual' },
    'CORPORATE': { vi: 'Khách hàng doanh nghiệp', en: 'Corporate Client' },
    'RETAIL': { vi: 'Bán lẻ', en: 'Retail' },
}

const STATUS_MAP: Record<string, { vi: string; en: string }> = {
    'DRAFT': { vi: 'Nháp', en: 'Draft' },
    'PENDING_APPROVAL': { vi: 'Chờ Duyệt', en: 'Pending Approval' },
    'PENDING_ACCOUNTING': { vi: 'Chờ Kế Toán Duyệt', en: 'Pending Accounting' },
    'CONFIRMED': { vi: 'Đã Xác Nhận', en: 'Confirmed' },
    'PARTIALLY_DELIVERED': { vi: 'Giao Hàng Một Phần', en: 'Partially Delivered' },
    'DELIVERED': { vi: 'Đã Giao Hàng', en: 'Delivered' },
    'INVOICED': { vi: 'Đã Xuất Hóa Đơn', en: 'Invoiced' },
    'PAID': { vi: 'Đã Thu Tiền', en: 'Paid' },
    'CANCELLED': { vi: 'Đã Hủy', en: 'Cancelled' },
}

const I18N = {
    vi: {
        back: 'Trở về',
        printDoc: 'In tài liệu',
        langLabel: 'Ngôn ngữ in:',
        viBtn: 'Tiếng Việt',
        enBtn: 'English',
        orderTitleStandard: 'ĐƠN BÁN HÀNG',
        orderTitleTasting: 'ĐƠN HÀNG TASTING (KHÔNG THU TIỀN)',
        draftPrefix: 'DỰ THẢO - ',
        basedOnProposal: 'Căn cứ Tờ trình',
        dateCreated: 'Ngày lập',
        custInfoTitle: 'Thông tin khách hàng',
        customer: 'Khách hàng',
        custCode: 'Mã KH',
        contactPhone: 'SĐT liên hệ',
        vatTaxId: 'MST VAT',
        parentCompany: 'Cty Cha',
        vatCompany: 'Đơn vị VAT',
        salesChannel: 'Phân kênh',
        deliveryInfoTitle: 'Thông tin giao nhận',
        receiver: 'Người nhận',
        receiverPhone: 'SĐT nhận hàng',
        shippingAddress: 'Địa chỉ giao',
        pickupAtWarehouse: 'Nhận tại kho',
        salesRep: 'Sales Rep',
        paymentTerm: 'Thanh toán',
        orderStatus: 'Trạng thái',
        deliveryNotePrefix: '📦 Lưu ý giao hàng: ',
        orderNotesPrefix: 'Ghi chú / Diễn giải: ',
        colIndex: 'STT',
        colCustomerItemCode: 'Mã Khách',
        colSku: 'Mã AX',
        colProductName: 'Tên sản phẩm',
        colQty: 'SL',
        colUnitPrice: 'Đơn giá',
        colDiscountPct: 'CK %',
        colVatPct: 'VAT %',
        colLineTotal: 'Thành tiền',
        totalQtyLabel: 'Tổng số lượng hàng hóa:',
        bottlesUnit: 'chai',
        subtotalRetail: 'Cộng tiền hàng (Đã gồm VAT):',
        subtotalB2B: 'Cộng tiền hàng (chưa VAT):',
        orderDiscountLabel: 'Chiết khấu đơn',
        netAmountExtracted: 'Giá trị trước thuế (bóc tách):',
        vatLabel: 'Thuế GTGT',
        vatExtractedSuffix: ' (bóc tách)',
        totalVatLabel: 'Tổng tiền thuế VAT',
        grandTotalLabel: 'Tổng cộng thanh toán:',
        bankInfoTitle: 'Thông tin chuyển khoản thanh toán (COD):',
        bankAccountName: 'Chủ tài khoản',
        bankAccountNumber: 'Số tài khoản',
        bankName: 'Ngân hàng',
        bankTransferNote: 'Nội dung CK',
        bankTransferNoteContent: 'Thanh toán đơn hàng',
        signSaleAdmin: 'Sale Admin duyệt',
        signAccounting: 'Kế toán kiểm soát',
        signWarehouse: 'Thủ kho',
        signReceiver: 'Người nhận hàng',
        signHint: '(Ký, ghi rõ họ tên)',
        companyAddressPrefix: 'Địa chỉ: ',
        taxIdPrefix: 'MST: ',
        phonePrefix: 'SĐT: ',
        emailPrefix: 'Email: ',
    },
    en: {
        back: 'Back',
        printDoc: 'Print Document',
        langLabel: 'Print Language:',
        viBtn: 'Tiếng Việt',
        enBtn: 'English',
        orderTitleStandard: 'SALES ORDER',
        orderTitleTasting: 'TASTING ORDER (COMPLIMENTARY)',
        draftPrefix: 'DRAFT - ',
        basedOnProposal: 'Based on Proposal',
        dateCreated: 'Date',
        custInfoTitle: 'Customer Information',
        customer: 'Customer',
        custCode: 'Customer ID',
        contactPhone: 'Contact Phone',
        vatTaxId: 'Tax ID (VAT)',
        parentCompany: 'Parent Co.',
        vatCompany: 'VAT Invoice Entity',
        salesChannel: 'Sales Channel',
        deliveryInfoTitle: 'Delivery & Shipping',
        receiver: 'Attention To',
        receiverPhone: 'Receiver Phone',
        shippingAddress: 'Delivery Address',
        pickupAtWarehouse: 'Warehouse Pickup',
        salesRep: 'Sales Rep',
        paymentTerm: 'Payment Term',
        orderStatus: 'Status',
        deliveryNotePrefix: '📦 Delivery Notice: ',
        orderNotesPrefix: 'Notes / Description: ',
        colIndex: 'No.',
        colCustomerItemCode: 'Cust Code',
        colSku: 'SKU Code',
        colProductName: 'Product Description',
        colQty: 'Qty',
        colUnitPrice: 'Unit Price',
        colDiscountPct: 'Disc %',
        colVatPct: 'VAT %',
        colLineTotal: 'Amount',
        totalQtyLabel: 'Total Quantity:',
        bottlesUnit: 'btls',
        subtotalRetail: 'Subtotal (VAT-inclusive):',
        subtotalB2B: 'Subtotal (excl. VAT):',
        orderDiscountLabel: 'Order Discount',
        netAmountExtracted: 'Net Before VAT (Breakdown):',
        vatLabel: 'VAT',
        vatExtractedSuffix: ' (Breakdown)',
        totalVatLabel: 'Total VAT',
        grandTotalLabel: 'Total Payable Amount:',
        bankInfoTitle: 'Bank Transfer Instructions (COD):',
        bankAccountName: 'Beneficiary Name',
        bankAccountNumber: 'Account Number',
        bankName: 'Bank Name',
        bankTransferNote: 'Transfer Memo',
        bankTransferNoteContent: 'Payment for order',
        signSaleAdmin: 'Sale Admin Approved',
        signAccounting: 'Chief Accountant',
        signWarehouse: 'Warehouse Keeper',
        signReceiver: 'Received By',
        signHint: '(Signature & Full Name)',
        companyAddressPrefix: 'Address: ',
        taxIdPrefix: 'Tax ID: ',
        phonePrefix: 'Tel: ',
        emailPrefix: 'Email: ',
    }
}

type OrderDetailType = NonNullable<Awaited<ReturnType<typeof getSalesOrderDetail>>>

export default function SalesOrderPrintPage({ searchParams }: Props) {
    const params = use(searchParams)
    const id = params.id
    const initialLang: Lang = params.lang === 'en' ? 'en' : 'vi'

    const [order, setOrder] = useState<OrderDetailType | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lang, setLang] = useState<Lang>(initialLang)

    useEffect(() => {
        if (!id) {
            const timer = setTimeout(() => {
                setError('Thiếu mã đơn hàng (ID)')
                setLoading(false)
            }, 0)
            return () => clearTimeout(timer)
        }

        getSalesOrderDetail(id)
            .then((res) => {
                if (!res) {
                    setError('Không tìm thấy đơn hàng')
                } else {
                    setOrder(res as OrderDetailType)
                }
            })
            .catch((err) => {
                setError(err.message || 'Lỗi tải chi tiết đơn hàng')
            })
            .finally(() => {
                setLoading(false)
            })
    }, [id])

    // Auto trigger print when loaded successfully
    useEffect(() => {
        if (order) {
            document.title = `${order.soNo}${lang === 'en' ? '-EN' : ''}`
            const timer = setTimeout(() => {
                window.print()
            }, 800)
            return () => clearTimeout(timer)
        }
    }, [order])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A1926] text-white">
                <Loader2 className="animate-spin text-[#87CBB9] mb-4" size={36} />
                <p className="text-sm text-[#8AAEBB]">Đang tải dữ liệu đơn hàng...</p>
            </div>
        )
    }

    if (error || !order) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A1926] text-white px-4">
                <div className="p-6 rounded-lg max-w-md w-full bg-[#1B2E3D] border border-[#EF4444]/30 text-center">
                    <p className="text-sm font-bold text-[#EF4444] mb-4">⚠ Lỗi hệ thống</p>
                    <p className="text-sm text-[#E8F1F2] mb-6">{error || 'Không tìm thấy dữ liệu'}</p>
                    <button onClick={() => window.close()} className="px-4 py-2 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-500 transition-colors">
                        Đóng cửa sổ
                    </button>
                </div>
            </div>
        )
    }

    const t = I18N[lang]

    // Calculations with robust support for old/new, Multi-VAT, and Tasting orders
    const isRetail = order.channel === 'RETAIL' || order.channel === 'DIRECT_INDIVIDUAL' || (order.channel as string) === 'POS'

    const subtotal = order.lines.reduce((s: number, l) => {
        const qty = Number(l.qtyOrdered)
        const price = Number(l.unitPrice)
        const disc = Number(l.lineDiscountPct)
        return s + qty * price * (1 - disc / 100)
    }, 0)
    const discountAmount = subtotal * (Number(order.orderDiscount ?? 0) / 100)
    const afterDiscount = subtotal - discountAmount
    const discountMultiplier = 1 - Number(order.orderDiscount ?? 0) / 100

    // Multi-VAT Rate Breakdown
    const vatRateMap: Record<number, number> = {}
    let calculatedNet = 0
    let calculatedVat = 0

    for (const l of order.lines) {
        const rate = (l as any).vatRate !== undefined && (l as any).vatRate !== null ? Number((l as any).vatRate) : 10
        const lineVal = Number(l.qtyOrdered) * Number(l.unitPrice) * (1 - Number(l.lineDiscountPct) / 100) * discountMultiplier

        if (isRetail) {
            const lineNet = lineVal / (1 + rate / 100)
            const lineVat = lineVal - lineNet
            calculatedNet += lineNet
            calculatedVat += lineVat
            vatRateMap[rate] = (vatRateMap[rate] || 0) + lineVat
        } else {
            const lineNet = lineVal
            const lineVat = lineNet * (rate / 100)
            calculatedNet += lineNet
            calculatedVat += lineVat
            vatRateMap[rate] = (vatRateMap[rate] || 0) + lineVat
        }
    }

    const vatBreakdown = Object.entries(vatRateMap)
        .map(([rateStr, amt]) => ({ rate: Number(rateStr), amount: Math.round(amt) }))
        .sort((a, b) => a.rate - b.rate)

    const vatAmount = (order as any).vatAmount !== undefined && (order as any).vatAmount !== null && Number((order as any).vatAmount) > 0
        ? Number((order as any).vatAmount)
        : Math.round(calculatedVat)

    const grandTotal = (order as any).orderType === 'TASTING'
        ? 0
        : (isRetail ? afterDiscount : afterDiscount + vatAmount)

    // Address combination with fallback to customer default address
    const defaultAddr = order.customer.addresses?.[0]
    const addr = order.shippingAddress || defaultAddr
    const fullAddress = addr 
        ? [addr.address, addr.ward, addr.district, addr.city].filter(Boolean).join(', ')
        : t.pickupAtWarehouse

    const totalQty = order.lines.reduce((sum, l) => sum + Number(l.qtyOrdered), 0)
    const hasMixedVat = vatBreakdown.length > 1
    const hasCustomerItemCodes = order.lines.some((l: any) => Boolean(l.customerItemCode))

    const orderTitle = (order as any).orderType === 'TASTING' 
        ? t.orderTitleTasting 
        : t.orderTitleStandard

    const statusText = STATUS_MAP[order.status] 
        ? STATUS_MAP[order.status][lang] 
        : order.status

    const channelText = order.customer.channel && CHANNEL_MAP[order.customer.channel]
        ? CHANNEL_MAP[order.customer.channel][lang]
        : (order.customer.channel || '—')

    return (
        <div className="min-h-screen bg-[#0A1926] text-slate-100 p-0 sm:p-4 print:bg-white print:text-black print:p-0">
            {/* Embedded Print CSS to force pure white background and hide browser header/footer */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm 10mm !important;
                    }
                    header, nav, aside, .no-print {
                        display: none !important;
                    }
                    html, body, #__next, div {
                        background: #ffffff !important;
                        color: #000000 !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>

            {/* Top Toolbar (Hidden on print) */}
            <div className="max-w-[850px] mx-auto mb-3 px-4 py-2 bg-[#1B2E3D] border border-[#2A4355] rounded-md flex flex-wrap items-center justify-between gap-2 no-print">
                <button 
                    onClick={() => window.close()} 
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded text-[#8AAEBB] hover:text-[#E8F1F2] transition-colors cursor-pointer"
                >
                    <ArrowLeft size={14} /> {t.back}
                </button>

                {/* Language Switcher Bar */}
                <div className="flex items-center gap-1 bg-[#0F1E2A] p-1 rounded-lg border border-[#2A4355]">
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#8AAEBB] px-2">
                        <Globe size={13} className="text-[#87CBB9]" /> {t.langLabel}
                    </span>
                    <button
                        type="button"
                        onClick={() => setLang('vi')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                            lang === 'vi' 
                                ? 'bg-[#87CBB9] text-[#0A1926] shadow-xs' 
                                : 'text-slate-300 hover:text-white hover:bg-[#1B2E3D]'
                        }`}
                    >
                        🇻🇳 {t.viBtn}
                    </button>
                    <button
                        type="button"
                        onClick={() => setLang('en')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                            lang === 'en' 
                                ? 'bg-[#87CBB9] text-[#0A1926] shadow-xs' 
                                : 'text-slate-300 hover:text-white hover:bg-[#1B2E3D]'
                        }`}
                    >
                        🇬🇧 {t.enBtn}
                    </button>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => window.print()} 
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded bg-[#87CBB9] text-[#0A1926] hover:bg-[#A5DED0] transition-colors shadow-sm cursor-pointer"
                    >
                        <Printer size={14} /> {t.printDoc}
                    </button>
                </div>
            </div>

            {/* A4 Sheet Wrapper */}
            <div className="max-w-[850px] mx-auto bg-white text-black p-6 sm:p-8 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0 min-h-[297mm]">
                {/* Print Header - No Logo, Clean Company Info */}
                <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
                    <div>
                        <h2 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                            {(order as any).legalEntity?.name || (lang === 'en' ? 'THANG AN COMMERCIAL JOINT STOCK COMPANY' : 'CÔNG TY CỔ PHẦN THƯƠNG MẠI THẮNG ÂN')}
                        </h2>
                        <p className="text-[10px] text-slate-700 leading-snug mt-0.5">
                            {t.companyAddressPrefix}{(order as any).legalEntity?.address || (lang === 'en' ? 'No 10, Alley 52 Giang Van Minh, Doi Can Ward, Ba Dinh Dist, Hanoi' : 'Số 10 ngõ 52 Giang Văn Minh, Phường Đội Cấn, Q. Ba Đình, TP. Hà Nội')}<br />
                            {t.taxIdPrefix}{(order as any).legalEntity?.taxId || "0316123456"} &nbsp;|&nbsp; 
                            {t.phonePrefix}{(order as any).legalEntity?.phone || "024.3933.8888"} &nbsp;|&nbsp; 
                            {t.emailPrefix}{(order as any).legalEntity?.email || "orders@lyscellars.com"}
                        </p>
                    </div>
                    <div className="text-right">
                        <h1 className="text-xl font-bold uppercase tracking-wider mb-0.5 text-black">
                            {orderTitle}
                        </h1>
                        <p className="text-xs font-bold font-mono text-slate-900">
                            {['DRAFT', 'PENDING_APPROVAL'].includes(order.status) ? t.draftPrefix : ''}{order.soNo}
                        </p>
                        {(order as any).proposal && (
                            <p className="text-[10px] font-bold text-amber-900 mt-0.5">
                                {t.basedOnProposal}: [{(order as any).proposal.proposalNo}] {(order as any).proposal.title}
                            </p>
                        )}
                        <p className="text-[9px] text-slate-600 mt-0.5">{t.dateCreated}: {formatDateTime(order.createdAt)}</p>
                    </div>
                </div>

                {/* Customer & Info Grid */}
                <div className="grid grid-cols-2 gap-4 mb-3 text-xs leading-tight">
                    <div>
                        <h3 className="font-bold border-b border-slate-300 pb-0.5 mb-1.5 text-slate-800 uppercase tracking-wide text-[10px]">
                            {t.custInfoTitle}
                        </h3>
                        <table className="w-full text-[10px]">
                            <tbody>
                                <tr>
                                    <td className="text-slate-600 pr-2 w-24 py-0.5">{t.customer}:</td>
                                    <td className="font-semibold text-slate-900 py-0.5">{order.customer.name}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">{t.custCode}:</td>
                                    <td className="font-mono text-slate-900 py-0.5">{order.customer.code}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">{t.contactPhone}:</td>
                                    <td className="font-semibold font-mono text-slate-900 py-0.5">
                                        {(order.customer as any).purchasingPhone || (order.customer as any).contacts?.find((c: any) => c.isPrimary)?.phone || (order.customer as any).contacts?.[0]?.phone || '—'}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">{t.vatTaxId}:</td>
                                    <td className="font-mono text-slate-900 py-0.5">
                                        {(order.customer as any).taxId ? (
                                            (order.customer as any).taxId
                                        ) : (order.customer as any).parent?.taxId ? (
                                            <span>{(order.customer as any).parent.taxId} ({t.parentCompany})</span>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                </tr>
                                {((order.customer as any).vatCompanyName || (order.customer as any).parent?.vatCompanyName || (order.customer as any).parent?.name) && (
                                    <tr>
                                        <td className="text-slate-600 pr-2 py-0.5">{t.vatCompany}:</td>
                                        <td className="font-semibold text-slate-900 py-0.5">
                                            {(order.customer as any).vatCompanyName || (order.customer as any).parent?.vatCompanyName || (order.customer as any).parent?.name}
                                        </td>
                                    </tr>
                                )}
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">{t.salesChannel}:</td>
                                    <td className="py-0.5 text-slate-900">{channelText}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <h3 className="font-bold border-b border-slate-300 pb-0.5 mb-1.5 text-slate-800 uppercase tracking-wide text-[10px]">
                            {t.deliveryInfoTitle}
                        </h3>
                        <table className="w-full text-[10px]">
                            <tbody>
                                <tr>
                                    <td className="text-slate-600 pr-2 w-24 py-0.5">{t.receiver}:</td>
                                    <td className="font-semibold text-slate-900 py-0.5">{(order.customer as any).receiverName || order.customer.name}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">{t.receiverPhone}:</td>
                                    <td className="font-bold font-mono text-slate-900 py-0.5">
                                        {(order.customer as any).receiverPhone || (order.customer as any).purchasingPhone || (order.customer as any).contacts?.find((c: any) => c.isPrimary)?.phone || '—'}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">{t.shippingAddress}:</td>
                                    <td className="py-0.5 text-slate-900">{fullAddress}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">{t.salesRep}:</td>
                                    <td className="py-0.5 text-slate-900">{order.salesRep?.name || '—'}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">{t.paymentTerm}:</td>
                                    <td className="font-semibold text-slate-900 py-0.5">{order.paymentTerm}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">{t.orderStatus}:</td>
                                    <td className="font-semibold text-slate-900 py-0.5">{statusText}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Ghi chú giao hàng & Diễn giải đơn hàng */}
                {((order.customer as any).deliveryNotes || order.notes) && (
                    <div className="mb-3 text-[10px] p-2 bg-slate-50 border border-slate-300 rounded leading-relaxed space-y-1">
                        {(order.customer as any).deliveryNotes && (
                            <div>
                                <span className="font-bold text-amber-900 uppercase">{t.deliveryNotePrefix}</span>
                                <span className="text-slate-900 font-medium">{(order.customer as any).deliveryNotes}</span>
                            </div>
                        )}
                        {order.notes && (
                            <div>
                                <span className="font-bold text-slate-900 uppercase">{t.orderNotesPrefix}</span>
                                <span className="text-slate-800 italic">{order.notes}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Product Lines Table */}
                <table className="w-full text-[10px] mb-3 border-collapse border border-slate-300">
                    <thead>
                        <tr className="bg-white text-black font-bold border-b-2 border-slate-800">
                            <td className="px-2 py-1.5 text-center w-8 border-r border-slate-300">{t.colIndex}</td>
                            {hasCustomerItemCodes && (
                                <td className="px-2 py-1.5 w-20 text-center font-bold text-amber-900 border-r border-slate-300">{t.colCustomerItemCode}</td>
                            )}
                            <td className="px-2 py-1.5 w-24 border-r border-slate-300">{t.colSku}</td>
                            <td className="px-2 py-1.5 border-r border-slate-300">{t.colProductName}</td>
                            <td className="px-2 py-1.5 text-right w-10 border-r border-slate-300">{t.colQty}</td>
                            <td className="px-2 py-1.5 text-right w-24 border-r border-slate-300">{t.colUnitPrice}</td>
                            <td className="px-2 py-1.5 text-center w-12 border-r border-slate-300">{t.colDiscountPct}</td>
                            {hasMixedVat && <td className="px-2 py-1.5 text-center w-12 border-r border-slate-300">{t.colVatPct}</td>}
                            <td className="px-2 py-1.5 text-right w-28">{t.colLineTotal}</td>
                        </tr>
                    </thead>
                    <tbody>
                        {order.lines.map((line, idx) => {
                            const lineTotal = Number(line.qtyOrdered) * Number(line.unitPrice) * (1 - Number(line.lineDiscountPct) / 100)
                            const product = line.product
                            const lineVat = (line as any).vatRate !== undefined && (line as any).vatRate !== null ? Number((line as any).vatRate) : 10

                            return (
                                <tr key={line.id} className="border-b border-slate-200 align-middle">
                                    <td className="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200">{idx + 1}</td>
                                    {hasCustomerItemCodes && (
                                        <td className="px-2 py-1.5 text-center font-mono font-bold text-[10px] text-amber-900 border-r border-slate-200">
                                            {(line as any).customerItemCode || '—'}
                                        </td>
                                    )}
                                    <td className="px-2 py-1.5 font-mono font-semibold text-[10px] text-slate-900 border-r border-slate-200">{product.skuCode}</td>
                                    <td className="px-2 py-1.5 border-r border-slate-200">
                                        <div className="font-semibold text-slate-900 leading-tight">
                                            {product.productName}
                                            {(line as any).vintage ? ` (${(line as any).vintage})` : ''}
                                        </div>
                                    </td>
                                    <td className="px-2 py-1.5 text-right font-mono font-semibold tabular-nums text-slate-900 border-r border-slate-200">{Number(line.qtyOrdered)}</td>
                                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-900 border-r border-slate-200">{formatVND(Number(line.unitPrice))}</td>
                                    <td className="px-2 py-1.5 text-center font-mono text-slate-600 tabular-nums border-r border-slate-200">{Number(line.lineDiscountPct) > 0 ? `${line.lineDiscountPct}%` : '—'}</td>
                                    {hasMixedVat && (
                                        <td className="px-2 py-1.5 text-center font-mono text-slate-600 tabular-nums border-r border-slate-200">
                                            {lineVat}%
                                        </td>
                                    )}
                                    <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums text-slate-900">{formatVND(lineTotal)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {/* Totals Section */}
                <div className="flex justify-end mb-3 break-inside-avoid print:break-inside-avoid">
                    <table className="w-84 text-[11px] border-collapse">
                        <tbody>
                            <tr className="border-b border-slate-200 font-semibold">
                                <td className="py-1 text-slate-700">{t.totalQtyLabel}</td>
                                <td className="py-1 text-right font-mono font-bold text-slate-900 tabular-nums">{totalQty} {t.bottlesUnit}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                                <td className="py-1 text-slate-600">{isRetail ? t.subtotalRetail : t.subtotalB2B}</td>
                                <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(subtotal)}</td>
                            </tr>
                            {discountAmount > 0 && (
                                <tr className="border-b border-slate-200">
                                    <td className="py-1 text-slate-600">{t.orderDiscountLabel} ({Number(order.orderDiscount ?? 0)}%):</td>
                                    <td className="py-1 text-right font-mono text-red-600 tabular-nums">-{formatVND(discountAmount)}</td>
                                </tr>
                            )}
                            {isRetail && (
                                <tr className="border-b border-slate-200">
                                    <td className="py-1 text-slate-600">{t.netAmountExtracted}</td>
                                    <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(Math.round(calculatedNet))}</td>
                                </tr>
                            )}
                            {vatBreakdown.length > 1 ? (
                                <>
                                    {vatBreakdown.map(item => (
                                        <tr key={item.rate} className="border-b border-slate-200">
                                            <td className="py-1 text-slate-600">{t.vatLabel} ({item.rate}%){isRetail ? t.vatExtractedSuffix : ''}:</td>
                                            <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(item.amount)}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-b border-slate-200 font-semibold">
                                        <td className="py-1 text-slate-700">{t.totalVatLabel}{isRetail ? t.vatExtractedSuffix : ''}:</td>
                                        <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(vatAmount)}</td>
                                    </tr>
                                </>
                            ) : (
                                <tr className="border-b border-slate-200">
                                    <td className="py-1 text-slate-600">{t.vatLabel} ({vatBreakdown[0]?.rate ?? (order as any).vatRate ?? 10}%){isRetail ? t.vatExtractedSuffix : ''}:</td>
                                    <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(vatAmount)}</td>
                                </tr>
                            )}
                            <tr className="font-bold border-t-2 border-black">
                                <td className="py-1.5 text-slate-900 text-xs">{t.grandTotalLabel}</td>
                                <td className="py-1.5 text-right font-mono text-xs tabular-nums text-black">{formatVND(grandTotal)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Bank Account Details - ONLY FOR COD ORDERS */}
                {(order.paymentTerm === 'COD' || order.paymentTerm?.toUpperCase().includes('COD')) && (
                    <div className="border border-slate-300 rounded p-2.5 mb-3 bg-white text-[10px] leading-relaxed break-inside-avoid print:break-inside-avoid">
                        <p className="font-bold text-slate-900 uppercase mb-1 text-[9px]">{t.bankInfoTitle}</p>
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="text-slate-600 w-24 py-0.5">{t.bankAccountName}:</td>
                                    <td className="font-semibold text-slate-900 py-0.5">
                                        {(order as any).legalEntity?.bankAccountName || "CÔNG TY CỔ PHẦN THƯƠNG MẠI THẮNG ÂN"}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 py-0.5">{t.bankAccountNumber}:</td>
                                    <td className="font-semibold font-mono text-slate-900 py-0.5">
                                        {(order as any).legalEntity?.bankAccountNumber || "1023456789"}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 py-0.5">{t.bankName}:</td>
                                    <td className="text-slate-900 font-semibold py-0.5">
                                        {(order as any).legalEntity?.bankName || "Vietcombank (VCB) - Chi nhánh TP. Hà Nội"}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 py-0.5">{t.bankTransferNote}:</td>
                                    <td className="font-mono text-slate-900 font-semibold py-0.5">{t.bankTransferNoteContent} <span className="font-bold">{order.soNo}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Dynamic Footer Block */}
                {/* Signatures for Sales Orders */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs mt-4 pt-2 border-t border-dashed border-slate-400 break-inside-avoid print:break-inside-avoid">
                    <div className="flex flex-col pb-12">
                        <p className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">{t.signSaleAdmin}</p>
                        <p className="text-slate-500 italic text-[9px] mt-0.5">{t.signHint}</p>
                    </div>
                    <div className="flex flex-col pb-12">
                        <p className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">{t.signAccounting}</p>
                        <p className="text-slate-500 italic text-[9px] mt-0.5">{t.signHint}</p>
                    </div>
                    <div className="flex flex-col pb-12">
                        <p className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">{t.signWarehouse}</p>
                        <p className="text-slate-500 italic text-[9px] mt-0.5">{t.signHint}</p>
                    </div>
                    <div className="flex flex-col pb-12">
                        <p className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">{t.signReceiver}</p>
                        <p className="text-slate-500 italic text-[9px] mt-0.5">{t.signHint}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}


