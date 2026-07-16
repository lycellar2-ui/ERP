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

    const isQuotation = ['DRAFT', 'PENDING_APPROVAL', 'PENDING_ACCOUNTING'].includes(order.status)

    return (
        <div className="min-h-screen bg-[#0A1926] text-slate-100 p-0 sm:p-6 print:bg-white print:text-black print:p-0">
            {/* Top Toolbar (Hidden on print) */}
            <div className="max-w-[850px] mx-auto mb-4 px-4 py-3 bg-[#1B2E3D] border border-[#2A4355] rounded-md flex items-center justify-between no-print">
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
            <div className="max-w-[850px] mx-auto bg-white text-black p-8 sm:p-12 shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0">
                {/* Print Header */}
                <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                    <div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src="/logo/Ly's Cellars - Logo_tagline blue green.png" 
                            alt="Ly's Cellars Logo" 
                            className="h-12 w-auto object-contain mb-2"
                        />
                        <h2 className="font-bold text-[11px] text-slate-800 uppercase tracking-wide">
                            {(order as any).legalEntity?.name || "LY'S CELLARS"}
                        </h2>
                        <p className="text-[10px] text-slate-600 leading-relaxed mt-0.5">
                            Địa chỉ: {(order as any).legalEntity?.address || "123 Đường Pasteur, Phường Bến Nghé, Quận 1, TP. HCM"}<br />
                            MST: {(order as any).legalEntity?.taxId || "0313456789"} &nbsp;|&nbsp; Email: orders@lyscellars.com
                        </p>
                    </div>
                    <div className="text-right">
                        <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">
                            {isQuotation ? 'BÁO GIÁ' : 'ĐƠN BÁN HÀNG'}
                        </h1>
                        <p className="text-xs font-bold font-mono" style={{ color: '#124967' }}>{order.soNo}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Ngày lập: {formatDateTime(order.createdAt)}</p>
                    </div>
                </div>

                {/* Customer & Info Grid */}
                <div className="grid grid-cols-2 gap-8 mb-6 text-xs leading-relaxed">
                    <div>
                        <h3 className="font-bold border-b border-slate-300 pb-1 mb-2 text-slate-700 uppercase tracking-wide">Thông tin khách hàng</h3>
                        <table className="w-full text-[11px]">
                            <tbody>
                                <tr>
                                    <td className="text-slate-500 pr-2 w-24">Khách hàng:</td>
                                    <td className="font-semibold">{order.customer.name}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-500 pr-2">Mã KH:</td>
                                    <td className="font-mono">{order.customer.code}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-500 pr-2">Phân kênh:</td>
                                    <td>{order.customer.channel ? (CHANNEL_MAP[order.customer.channel] || order.customer.channel) : '—'}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-500 pr-2">Hạn mức nợ:</td>
                                    <td className="font-mono tabular-nums">{Number(order.customer.creditLimit) > 0 ? formatVND(Number(order.customer.creditLimit)) : 'Không giới hạn'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <h3 className="font-bold border-b border-slate-300 pb-1 mb-2 text-slate-700 uppercase tracking-wide">Thông tin giao nhận</h3>
                        <table className="w-full text-[11px]">
                            <tbody>
                                <tr>
                                    <td className="text-slate-500 pr-2 w-24">Địa chỉ giao:</td>
                                    <td>{fullAddress}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-500 pr-2">Sales Rep:</td>
                                    <td>{order.salesRep.name}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-500 pr-2">Thanh toán:</td>
                                    <td className="font-semibold">{order.paymentTerm}</td>
                                </tr>
                                <tr>
                                    <td className="text-slate-500 pr-2">Trạng thái:</td>
                                    <td className="font-semibold" style={{ color: '#124967' }}>{STATUS_MAP[order.status] || order.status}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Product Lines Table */}
                <table className="w-full text-[11px] mb-6 border-collapse">
                    <thead>
                        <tr className="font-bold" style={{ backgroundColor: '#124967', color: '#FFFFFF' }}>
                            <td className="px-2 py-2 text-center w-8">STT</td>
                            <td className="px-2 py-2 w-20">Mã AX</td>
                            <td className="px-2 py-2 text-center w-14">Ảnh</td>
                            <td className="px-2 py-2">Tên sản phẩm & Đặc tính</td>
                            <td className="px-2 py-2 text-right w-10">SL</td>
                            <td className="px-2 py-2 text-right w-24">Đơn giá</td>
                            <td className="px-2 py-2 text-center w-12">CK %</td>
                            <td className="px-2 py-2 text-right w-28">Thành tiền</td>
                        </tr>
                    </thead>
                    <tbody>
                        {order.lines.map((line, idx) => {
                            const lineTotal = Number(line.qtyOrdered) * Number(line.unitPrice) * (1 - Number(line.lineDiscountPct) / 100)
                            const product = line.product
                            
                            const imgUrl = product.media?.[0]?.url || null
                            const grapes = product.profile?.grapes || null
                            const abv = product.abvPercent ? `${Number(product.abvPercent)}%` : null
                            
                            const wineTypeLabel = WINE_TYPE_MAP[product.wineType] || product.wineType

                            const details = [
                                wineTypeLabel ? `Loại: ${wineTypeLabel}` : null,
                                product.country ? `Xuất xứ: ${product.country}` : null,
                                grapes ? `Giống nho: ${grapes}` : null,
                                abv ? `Độ cồn: ${abv}` : null,
                            ].filter(Boolean).join('  |  ')

                            return (
                                <tr key={line.id} className="border-b border-slate-200 align-middle">
                                    <td className="px-2 py-3 text-center text-slate-500">{idx + 1}</td>
                                    <td className="px-2 py-3 font-mono font-semibold text-[10px]">{product.skuCode}</td>
                                    <td className="px-2 py-2 text-center">
                                        {imgUrl ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img 
                                                src={imgUrl} 
                                                alt={product.productName} 
                                                className="h-12 w-auto object-contain mx-auto border border-slate-100 rounded bg-white p-0.5 shadow-sm"
                                            />
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">No pic</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="font-semibold text-slate-900 leading-tight mb-1">{product.productName}</div>
                                        <div className="text-[10px] text-slate-500 leading-normal">{details}</div>
                                    </td>
                                    <td className="px-2 py-3 text-right font-mono font-semibold tabular-nums">{Number(line.qtyOrdered)}</td>
                                    <td className="px-2 py-3 text-right font-mono tabular-nums">{formatVND(Number(line.unitPrice))}</td>
                                    <td className="px-2 py-3 text-center font-mono text-slate-600 tabular-nums">{Number(line.lineDiscountPct) > 0 ? `${line.lineDiscountPct}%` : '—'}</td>
                                    <td className="px-2 py-3 text-right font-mono font-bold tabular-nums">{formatVND(lineTotal)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {/* Totals Section */}
                <div className="flex justify-end mb-6">
                    <table className="w-80 text-xs border-collapse">
                        <tbody>
                            <tr className="border-b border-slate-200">
                                <td className="py-2 text-slate-500">Cộng tiền hàng (chưa VAT):</td>
                                <td className="py-2 text-right font-mono tabular-nums">{formatVND(subtotal)}</td>
                            </tr>
                            {discountAmount > 0 && (
                                <tr className="border-b border-slate-200">
                                    <td className="py-2 text-slate-500">Chiết khấu đơn ({Number(order.orderDiscount)}%):</td>
                                    <td className="py-2 text-right font-mono text-red-600 tabular-nums">-{formatVND(discountAmount)}</td>
                                </tr>
                            )}
                            {!vatIncluded && (
                                <tr className="border-b border-slate-200">
                                    <td className="py-2 text-slate-500">Thuế VAT (10%):</td>
                                    <td className="py-2 text-right font-mono tabular-nums">{formatVND(vatAmount)}</td>
                                </tr>
                            )}
                            <tr className="font-bold border-t-2 border-black">
                                <td className="py-3 text-slate-800 text-sm">Tổng cộng thanh toán:</td>
                                <td className="py-3 text-right font-mono text-sm tabular-nums" style={{ color: '#124967' }}>{formatVND(grandTotal)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Bank Account Details */}
                <div className="border border-slate-200 rounded p-3 mb-6 bg-slate-50 text-[10px] leading-relaxed">
                    <p className="font-bold text-slate-700 uppercase mb-1">Thông tin chuyển khoản thanh toán:</p>
                    <table className="w-full">
                        <tbody>
                            <tr>
                                <td className="text-slate-500 w-24">Chủ tài khoản:</td>
                                <td className="font-semibold text-slate-800">
                                    {(order as any).legalEntity?.bankAccountName || "CÔNG TY TNHH LY'S CELLARS"}
                                </td>
                            </tr>
                            <tr>
                                <td className="text-slate-500">Số tài khoản:</td>
                                <td className="font-semibold font-mono text-slate-800">
                                    {(order as any).legalEntity?.bankAccountNumber || "1023456789"}
                                </td>
                            </tr>
                            <tr>
                                <td className="text-slate-500">Ngân hàng:</td>
                                <td className="text-slate-800 font-semibold">
                                    {(order as any).legalEntity?.bankName || "Vietcombank (VCB) - Chi nhánh TP. Hồ Chí Minh"}
                                </td>
                            </tr>
                            <tr>
                                <td className="text-slate-500">Nội dung CK:</td>
                                <td className="font-mono text-slate-800 font-semibold">Thanh toán đơn hàng <span className="font-bold">{order.soNo}</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Dynamic Footer Block */}
                {isQuotation ? (
                    <div className="mt-8 pt-4 border-t border-dashed border-slate-300 text-[10px] text-slate-600 leading-relaxed space-y-1.5">
                        <p className="font-bold text-slate-700 uppercase tracking-wide">Điều khoản báo giá / Quotation terms:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                            <li>Giá bán trên chưa bao gồm 10% VAT / Price listed above excludes 10% VAT.</li>
                            <li>Báo giá này có giá trị hiệu lực trong vòng 01 tháng kể từ ngày lập / This quotation is valid for 01 month from the date of issue.</li>
                            <li>Vui lòng liên hệ nhân viên phụ trách kinh doanh để nhận thông tin về tình trạng tồn kho hiện tại và chính sách ưu đãi bổ sung nếu có.</li>
                        </ul>
                    </div>
                ) : (
                    /* Signatures for confirmed Sales Orders */
                    <div className="grid grid-cols-5 gap-1 text-center text-xs mt-10 pt-4 border-t border-dashed border-slate-300">
                        <div className="flex flex-col justify-between h-24">
                            <p className="font-bold text-slate-800 uppercase tracking-wide">Người lập đơn</p>
                            <p className="font-semibold text-slate-700">{order.salesRep.name}</p>
                        </div>
                        <div className="flex flex-col justify-between h-24">
                            <p className="font-bold text-slate-800 uppercase tracking-wide">Sale Admin duyệt</p>
                            <p className="text-slate-400 italic">(Ký, ghi rõ họ tên)</p>
                        </div>
                        <div className="flex flex-col justify-between h-24">
                            <p className="font-bold text-slate-800 uppercase tracking-wide">Kế toán kiểm soát</p>
                            <p className="text-slate-400 italic">(Ký, ghi rõ họ tên)</p>
                        </div>
                        <div className="flex flex-col justify-between h-24">
                            <p className="font-bold text-slate-800 uppercase tracking-wide">Giám đốc phê duyệt</p>
                            <p className="text-slate-400 italic">(Ký, đóng dấu)</p>
                        </div>
                        <div className="flex flex-col justify-between h-24">
                            <p className="font-bold text-slate-800 uppercase tracking-wide">Người nhận hàng</p>
                            <p className="text-slate-400 italic">(Ký, ghi rõ họ tên)</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
