'use client'

import { useEffect, useState, use } from 'react'
import { getSalesOrderDetailWithMargin, getSalesOrderDetail } from '../actions'
import { formatVND, formatDateTime } from '@/lib/utils'
import { Loader2, Printer, ArrowLeft } from 'lucide-react'

interface Props {
    searchParams: Promise<{ id?: string }>
}

const CHANNEL_MAP: Record<string, string> = {
    'HORECA': 'HORECA',
    'WHOLESALE_DISTRIBUTOR': 'Bán sỉ / Nhà phân phối',
    'VIP_RETAIL': 'Khách VIP',
    'DIRECT_INDIVIDUAL': 'Khách lẻ trực tiếp',
    'CORPORATE': 'Khách hàng doanh nghiệp',
    'RETAIL': 'Bán lẻ',
}

const STATUS_MAP: Record<string, string> = {
    'DRAFT': 'Nháp',
    'PENDING_APPROVAL': 'Chờ Duyệt',
    'PENDING_ACCOUNTING': 'Chờ Kế Toán Duyệt',
    'CONFIRMED': 'Đã Xác Nhận',
    'PARTIALLY_DELIVERED': 'Giao Hàng Một Phần',
    'DELIVERED': 'Đã Giao Hàng',
    'INVOICED': 'Đã Xuất Hóa Đơn',
    'PAID': 'Đã Thu Tiền',
    'CANCELLED': 'Đã Hủy',
}

const WINE_TYPE_MAP: Record<string, string> = {
    'RED': 'Vang đỏ',
    'WHITE': 'Vang trắng',
    'ROSE': 'Vang hồng',
    'SPARKLING': 'Vang sủi',
    'DESSERT': 'Vang ngọt',
    'FORTIFIED': 'Vang cường hóa',
}

type OrderDetailType = NonNullable<Awaited<ReturnType<typeof getSalesOrderDetail>>>

export default function SalesOrderPrintPage({ searchParams }: Props) {
    const params = use(searchParams)
    const id = params.id

    const [order, setOrder] = useState<OrderDetailType | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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
            document.title = `${order.soNo}`
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

    // Calculations
    const subtotal = order.lines.reduce((s: number, l) => {
        const qty = Number(l.qtyOrdered)
        const price = Number(l.unitPrice)
        const disc = Number(l.lineDiscountPct)
        return s + qty * price * (1 - disc / 100)
    }, 0)
    const discountAmount = subtotal * (Number(order.orderDiscount) / 100)
    const afterDiscount = subtotal - discountAmount
    const vatIncluded = false
    const vatAmount = vatIncluded ? 0 : afterDiscount * 0.1
    const grandTotal = afterDiscount + vatAmount

    // Address combination
    const fullAddress = order.shippingAddress 
        ? [order.shippingAddress.address, order.shippingAddress.ward, order.shippingAddress.district, order.shippingAddress.city].filter(Boolean).join(', ')
        : 'Nhận tại kho'

    const totalQty = order.lines.reduce((sum, l) => sum + Number(l.qtyOrdered), 0)

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
            <div className="max-w-[850px] mx-auto mb-3 px-4 py-2 bg-[#1B2E3D] border border-[#2A4355] rounded-md flex items-center justify-between no-print">
                <button 
                    onClick={() => window.close()} 
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded text-[#8AAEBB] hover:text-[#E8F1F2] transition-colors"
                >
                    <ArrowLeft size={14} /> Trở về
                </button>
                <div className="flex gap-2">
                    <button 
                        onClick={() => window.print()} 
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded bg-[#87CBB9] text-[#0A1926] hover:bg-[#A5DED0] transition-colors shadow-sm"
                    >
                        <Printer size={14} /> In tài liệu
                    </button>
                </div>
            </div>

            {/* A4 Sheet Wrapper */}
            <div className="max-w-[850px] mx-auto bg-white text-black p-6 sm:p-8 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0 min-h-[297mm]">
                {/* Print Header - No Logo, Clean Company Info */}
                <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
                    <div>
                        <h2 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                            {(order as any).legalEntity?.name || "CÔNG TY CỔ PHẦN THƯƠNG MẠI THẮNG ÂN"}
                        </h2>
                        <p className="text-[10px] text-slate-700 leading-snug mt-0.5">
                            Địa chỉ: {(order as any).legalEntity?.address || "Số 10 ngõ 52 Giang Văn Minh, Phường Đội Cấn, Q. Ba Đình, TP. Hà Nội"}<br />
                            MST: {(order as any).legalEntity?.taxId || "0316123456"} &nbsp;|&nbsp; 
                            SĐT: {(order as any).legalEntity?.phone || "024.3933.8888"} &nbsp;|&nbsp; 
                            Email: {(order as any).legalEntity?.email || "orders@lyscellars.com"}
                        </p>
                    </div>
                    <div className="text-right">
                        <h1 className="text-xl font-bold uppercase tracking-wider mb-0.5 text-black">
                            ĐƠN BÁN HÀNG
                        </h1>
                        <p className="text-xs font-bold font-mono text-slate-900">
                            {['DRAFT', 'PENDING_APPROVAL'].includes(order.status) ? 'DỰ THẢO - ' : ''}{order.soNo}
                        </p>
                        <p className="text-[9px] text-slate-600 mt-0.5">Ngày lập: {formatDateTime(order.createdAt)}</p>
                    </div>
                </div>

                {/* Customer & Info Grid */}
                <div className="grid grid-cols-2 gap-4 mb-3 text-xs leading-tight">
                    <div>
                        <h3 className="font-bold border-b border-slate-300 pb-0.5 mb-1.5 text-slate-800 uppercase tracking-wide text-[10px]">Thông tin khách hàng</h3>
                        <table className="w-full text-[10px]">
                            <tbody>
                                <tr>
                                    <td className="text-slate-600 pr-2 w-20 py-0.5">Khách hàng:</td>
                                    <td className="font-semibold text-slate-900 py-0.5">{order.customer.name}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">Mã KH:</td>
                                    <td className="font-mono text-slate-900 py-0.5">{order.customer.code}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">Phân kênh:</td>
                                    <td className="py-0.5 text-slate-900">{order.customer.channel ? (CHANNEL_MAP[order.customer.channel] || order.customer.channel) : '—'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <h3 className="font-bold border-b border-slate-300 pb-0.5 mb-1.5 text-slate-800 uppercase tracking-wide text-[10px]">Thông tin giao nhận</h3>
                        <table className="w-full text-[10px]">
                            <tbody>
                                <tr>
                                    <td className="text-slate-600 pr-2 w-20 py-0.5">Địa chỉ giao:</td>
                                    <td className="py-0.5 text-slate-900">{fullAddress}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">Sales Rep:</td>
                                    <td className="py-0.5 text-slate-900">{order.salesRep.name}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">Thanh toán:</td>
                                    <td className="font-semibold text-slate-900 py-0.5">{order.paymentTerm}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 pr-2 py-0.5">Trạng thái:</td>
                                    <td className="font-semibold text-slate-900 py-0.5">{STATUS_MAP[order.status] || order.status}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Product Lines Table - WHITE HEADER WITH BLACK TEXT */}
                <table className="w-full text-[10px] mb-3 border-collapse border border-slate-300">
                    <thead>
                        <tr className="bg-white text-black font-bold border-b-2 border-slate-800">
                            <td className="px-2 py-1.5 text-center w-8 border-r border-slate-300">STT</td>
                            <td className="px-2 py-1.5 w-24 border-r border-slate-300">Mã AX</td>
                            <td className="px-2 py-1.5 border-r border-slate-300">Tên sản phẩm</td>
                            <td className="px-2 py-1.5 text-right w-10 border-r border-slate-300">SL</td>
                            <td className="px-2 py-1.5 text-right w-24 border-r border-slate-300">Đơn giá</td>
                            <td className="px-2 py-1.5 text-center w-12 border-r border-slate-300">CK %</td>
                            <td className="px-2 py-1.5 text-right w-28">Thành tiền</td>
                        </tr>
                    </thead>
                    <tbody>
                        {order.lines.map((line, idx) => {
                            const lineTotal = Number(line.qtyOrdered) * Number(line.unitPrice) * (1 - Number(line.lineDiscountPct) / 100)
                            const product = line.product

                            return (
                                <tr key={line.id} className="border-b border-slate-200 align-middle">
                                    <td className="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200">{idx + 1}</td>
                                    <td className="px-2 py-1.5 font-mono font-semibold text-[10px] text-slate-900 border-r border-slate-200">{product.skuCode}</td>
                                    <td className="px-2 py-1.5 border-r border-slate-200">
                                        <div className="font-semibold text-slate-900 leading-tight">{product.productName}</div>
                                    </td>
                                    <td className="px-2 py-1.5 text-right font-mono font-semibold tabular-nums text-slate-900 border-r border-slate-200">{Number(line.qtyOrdered)}</td>
                                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-900 border-r border-slate-200">{formatVND(Number(line.unitPrice))}</td>
                                    <td className="px-2 py-1.5 text-center font-mono text-slate-600 tabular-nums border-r border-slate-200">{Number(line.lineDiscountPct) > 0 ? `${line.lineDiscountPct}%` : '—'}</td>
                                    <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums text-slate-900">{formatVND(lineTotal)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {/* Totals Section */}
                <div className="flex justify-end mb-3 break-inside-avoid print:break-inside-avoid">
                    <table className="w-80 text-[11px] border-collapse">
                        <tbody>
                            <tr className="border-b border-slate-200 font-semibold">
                                <td className="py-1 text-slate-700">Tổng số lượng hàng hóa:</td>
                                <td className="py-1 text-right font-mono font-bold text-slate-900 tabular-nums">{totalQty} chai</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                                <td className="py-1 text-slate-600">Cộng tiền hàng (chưa VAT):</td>
                                <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(subtotal)}</td>
                            </tr>
                            {discountAmount > 0 && (
                                <tr className="border-b border-slate-200">
                                    <td className="py-1 text-slate-600">Chiết khấu đơn ({Number(order.orderDiscount)}%):</td>
                                    <td className="py-1 text-right font-mono text-red-600 tabular-nums">-{formatVND(discountAmount)}</td>
                                </tr>
                            )}
                            {!vatIncluded && (
                                <tr className="border-b border-slate-200">
                                    <td className="py-1 text-slate-600">Thuế VAT (10%):</td>
                                    <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(vatAmount)}</td>
                                </tr>
                            )}
                            <tr className="font-bold border-t-2 border-black">
                                <td className="py-1.5 text-slate-900 text-xs">Tổng cộng thanh toán:</td>
                                <td className="py-1.5 text-right font-mono text-xs tabular-nums text-black">{formatVND(grandTotal)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Bank Account Details - ONLY FOR COD ORDERS */}
                {(order.paymentTerm === 'COD' || order.paymentTerm?.toUpperCase().includes('COD')) && (
                    <div className="border border-slate-300 rounded p-2.5 mb-3 bg-white text-[10px] leading-relaxed break-inside-avoid print:break-inside-avoid">
                        <p className="font-bold text-slate-900 uppercase mb-1 text-[9px]">Thông tin chuyển khoản thanh toán (COD):</p>
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="text-slate-600 w-20 py-0.5">Chủ tài khoản:</td>
                                    <td className="font-semibold text-slate-900 py-0.5">
                                        {(order as any).legalEntity?.bankAccountName || "CÔNG TY TNHH LY'S CELLARS"}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 py-0.5">Số tài khoản:</td>
                                    <td className="font-semibold font-mono text-slate-900 py-0.5">
                                        {(order as any).legalEntity?.bankAccountNumber || "1023456789"}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 py-0.5">Ngân hàng:</td>
                                    <td className="text-slate-900 font-semibold py-0.5">
                                        {(order as any).legalEntity?.bankName || "Vietcombank (VCB) - Chi nhánh TP. Hồ Chí Minh"}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="text-slate-600 py-0.5">Nội dung CK:</td>
                                    <td className="font-mono text-slate-900 font-semibold py-0.5">Thanh toán đơn hàng <span className="font-bold">{order.soNo}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Dynamic Footer Block */}
                {/* Signatures for Sales Orders */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs mt-4 pt-2 border-t border-dashed border-slate-400 break-inside-avoid print:break-inside-avoid">
                    <div className="flex flex-col pb-12">
                        <p className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">Sale Admin duyệt</p>
                        <p className="text-slate-500 italic text-[9px] mt-0.5">(Ký, ghi rõ họ tên)</p>
                    </div>
                    <div className="flex flex-col pb-12">
                        <p className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">Kế toán kiểm soát</p>
                        <p className="text-slate-500 italic text-[9px] mt-0.5">(Ký, ghi rõ họ tên)</p>
                    </div>
                    <div className="flex flex-col pb-12">
                        <p className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">Thủ kho</p>
                        <p className="text-slate-500 italic text-[9px] mt-0.5">(Ký, ghi rõ họ tên)</p>
                    </div>
                    <div className="flex flex-col pb-12">
                        <p className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">Người nhận hàng</p>
                        <p className="text-slate-500 italic text-[9px] mt-0.5">(Ký, ghi rõ họ tên)</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

