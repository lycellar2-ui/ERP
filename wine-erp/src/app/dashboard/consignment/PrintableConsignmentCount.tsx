'use client'

import React from 'react'
import { Printer, X } from 'lucide-react'

export type ConsignmentCountItem = {
    productId: string
    skuCode: string
    productName: string
    vintage?: number | string | null
    unit?: string
    qtySystem: number
}

export type ConsignmentCountHeader = {
    warehouseId: string
    warehouseCode: string
    warehouseName: string
    warehouseAddress?: string | null
    customerId: string
    customerCode: string
    customerName: string
    customerAddress?: string | null
    customerPhone?: string | null
    customerTaxId?: string | null
    countedAt: string
    legalEntityName?: string
    legalEntityAddress?: string
    legalEntityTaxId?: string
    items: ConsignmentCountItem[]
}

type Props = {
    data: ConsignmentCountHeader
    onClose: () => void
}

export default function PrintableConsignmentCount({ data, onClose }: Props) {
    const handlePrint = () => {
        window.print()
    }

    const totalSystemBottles = data.items.reduce((sum, item) => sum + Number(item.qtySystem || 0), 0)

    const dateObj = new Date(data.countedAt || Date.now())
    const dayStr = dateObj.getDate().toString().padStart(2, '0')
    const monthStr = (dateObj.getMonth() + 1).toString().padStart(2, '0')
    const yearStr = dateObj.getFullYear().toString()

    const legalName = data.legalEntityName || 'CÔNG TY TNHH LY CELLARS'

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 overflow-y-auto p-4 sm:p-6 print:p-0 print:bg-white print:overflow-visible print:inset-auto print:static">
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
                    }
                }
                .font-times {
                    font-family: 'Times New Roman', Times, 'Liberation Serif', serif;
                }
            `}</style>

            {/* Top Toolbar (Hidden on Print) */}
            <div className="max-w-4xl mx-auto mb-4 bg-white border border-slate-200 text-slate-900 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl print:hidden">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-base font-extrabold text-slate-900">
                            BIÊN BẢN KIỂM KÊ HÀNG HÓA KÝ GỬI (A4)
                        </h2>
                        <p className="text-xs text-slate-500">
                            Khách hàng: <span className="font-bold text-slate-800">{data.customerName}</span> ({data.customerCode}) — Kho: {data.warehouseName}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-95"
                    >
                        <Printer className="w-4 h-4" />
                        In Biên Bản Kiểm Kê (A4)
                    </button>
                </div>
            </div>

            {/* REAL A4 DOCUMENT PRINT CONTAINER */}
            <div
                className="max-w-4xl mx-auto bg-white text-black p-8 sm:p-12 shadow-2xl rounded-none print:shadow-none print:p-0 print:max-w-none font-times leading-normal"
                style={{ fontFamily: '"Times New Roman", Times, "Liberation Serif", serif' }}
            >
                {/* Header: Đơn vị gửi & Quốc hiệu */}
                <div className="flex justify-between items-start border-b border-black pb-4 mb-4">
                    <div className="w-[58%]">
                        <div className="font-extrabold uppercase text-xs tracking-wide">{legalName}</div>
                        {data.legalEntityTaxId && (
                            <div className="text-[11px] font-semibold mt-0.5">MST: {data.legalEntityTaxId}</div>
                        )}
                        {data.legalEntityAddress && (
                            <div className="text-[11px] text-slate-800 italic mt-0.5">ĐC: {data.legalEntityAddress}</div>
                        )}
                        <div className="text-xs font-bold mt-1 text-slate-900">
                            KHO KÝ GỬI: {data.warehouseName.toUpperCase()} ({data.warehouseCode})
                        </div>
                    </div>
                    <div className="w-[42%] text-center">
                        <div className="font-extrabold uppercase text-[11px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                        <div className="font-bold text-[11px] mt-0.5">Độc lập - Tự do - Hạnh phúc</div>
                        <div className="text-[10px] mt-0.5">---o0o---</div>
                    </div>
                </div>

                {/* Tiêu đề chính */}
                <div className="text-center my-4 space-y-1">
                    <h1 className="text-lg font-extrabold uppercase tracking-wide">
                        BIÊN BẢN KIỂM KÊ HÀNG HÓA KÝ GỬI
                    </h1>
                    <p className="text-xs italic">
                        Hôm nay, ngày {dayStr} tháng {monthStr} năm {yearStr}, tại địa điểm kho hàng ký gửi:
                    </p>
                </div>

                {/* Thông tin 2 bên tham gia đối soát kiểm kê */}
                <div className="text-xs space-y-2 mb-4 border border-black p-3">
                    <div className="font-extrabold uppercase text-[11px]">I. THÀNH PHẦN THAM GIA KIỂM KÊ:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                            <div className="font-bold underline text-[11px]">1. ĐẠI DIỆN BÊN GIAO (BÊN KÝ GỬI):</div>
                            <div>- Đơn vị: <span className="font-bold">{legalName}</span></div>
                            <div>- Ông/Bà: ..........................................................................</div>
                            <div>- Chức vụ: ........................................................................</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-bold underline text-[11px]">2. ĐẠI DIỆN BÊN NHẬN KÝ GỬI:</div>
                            <div>- Khách hàng / Đại lý: <span className="font-bold">{data.customerName}</span></div>
                            <div>- Mã KH: <span className="font-semibold">{data.customerCode}</span> {data.customerTaxId ? `| MST: ${data.customerTaxId}` : ''}</div>
                            <div>- Địa chỉ điểm gửi: {data.customerAddress || data.warehouseAddress || 'Tại điểm kinh doanh của khách hàng'}</div>
                            <div>- Ông/Bà: ..........................................................................</div>
                            <div>- Chức vụ: ........................................................................</div>
                        </div>
                    </div>
                </div>

                {/* Nội dung kết quả kiểm kê */}
                <div className="mb-4">
                    <div className="font-extrabold uppercase text-xs mb-1.5 flex justify-between items-center">
                        <span>II. BẢNG KIỂM ĐẾM THỰC TẾ CHI TIẾT:</span>
                        <span className="text-[11px] font-normal italic">(Đơn vị tính: Chai)</span>
                    </div>

                    <table className="w-full text-left border-collapse border border-black text-xs">
                        <thead>
                            <tr className="bg-slate-100 text-black font-extrabold text-[11px] text-center border-b border-black">
                                <th className="border border-black p-1.5 w-8">STT</th>
                                <th className="border border-black p-1.5 w-24">Mã SKU</th>
                                <th className="border border-black p-1.5">Tên Sản Phẩm (Rượu Vang)</th>
                                <th className="border border-black p-1.5 w-16 text-center">Niên Vụ</th>
                                <th className="border border-black p-1.5 w-12 text-center">ĐVT</th>
                                <th className="border border-black p-1.5 w-20 text-center bg-amber-50/50">Tồn Sổ Sách</th>
                                <th className="border border-black p-1.5 w-24 text-center">Tồn Thực Tế (Kiểm đếm)</th>
                                <th className="border border-black p-1.5 w-20 text-center">Chênh Lệch (+/-)</th>
                                <th className="border border-black p-1.5 w-28 text-center">Tình Trạng / Tem Mác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="border border-black p-4 text-center italic text-slate-500">
                                        Kho ký gửi hiện tại chưa có số dư hàng hóa tồn kho.
                                    </td>
                                </tr>
                            ) : (
                                data.items.map((item, idx) => (
                                    <tr key={item.productId + (item.vintage || '')} className="border-b border-black">
                                        <td className="border border-black p-1 text-center">{idx + 1}</td>
                                        <td className="border border-black p-1 font-mono font-semibold">{item.skuCode}</td>
                                        <td className="border border-black p-1 font-medium">{item.productName}</td>
                                        <td className="border border-black p-1 text-center font-mono">{item.vintage || 'NV'}</td>
                                        <td className="border border-black p-1 text-center">{item.unit || 'Chai'}</td>
                                        <td className="border border-black p-1 text-center font-bold font-mono bg-amber-50/50">
                                            {Number(item.qtySystem).toLocaleString('vi-VN')}
                                        </td>
                                        <td className="border border-black p-1 text-center">
                                            {/* Chỗ trống cho người kiểm kê điền tay */}
                                            <div className="h-6 w-full"></div>
                                        </td>
                                        <td className="border border-black p-1 text-center">
                                            <div className="h-6 w-full"></div>
                                        </td>
                                        <td className="border border-black p-1 text-left text-[10px]">
                                            {/* Chỗ ghi chú tem mác */}
                                            <div className="h-6 w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            )}

                            {/* Dòng tổng cộng */}
                            <tr className="border-t-2 border-black font-extrabold bg-slate-50">
                                <td colSpan={5} className="border border-black p-1.5 text-right uppercase">
                                    Tổng cộng ({data.items.length} mặt hàng):
                                </td>
                                <td className="border border-black p-1.5 text-center font-mono text-sm">
                                    {totalSystemBottles.toLocaleString('vi-VN')}
                                </td>
                                <td className="border border-black p-1.5 text-center"></td>
                                <td className="border border-black p-1.5 text-center"></td>
                                <td className="border border-black p-1.5"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Kết luận và ý kiến các bên */}
                <div className="text-xs space-y-2 mb-6 border border-black p-3">
                    <div className="font-extrabold uppercase text-[11px]">III. Ý KIẾN VÀ KẾT LUẬN:</div>
                    <div className="space-y-2 text-[11px]">
                        <div>- Hai bên đã cùng tiến hành kiểm đếm thực tế số lượng hàng hóa ký gửi còn lưu giữ tại kho của Bên Nhận.</div>
                        <div>- Tình trạng bao bì, nhãn mác, tem phụ/tem rượu nhập khẩu: ............................................................................</div>
                        <div>- Các ý kiến khác (nếu có): ................................................................................................................................</div>
                        <div>Biên bản được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản làm cơ sở đối soát định kỳ.</div>
                    </div>
                </div>

                {/* Chữ ký 2 bên */}
                <div className="pt-2">
                    <div className="grid grid-cols-2 text-center text-xs">
                        <div className="space-y-1">
                            <div className="font-extrabold uppercase text-[11px]">ĐẠI DIỆN BÊN KÝ GỬI</div>
                            <div className="text-[11px] italic">(Ký, ghi rõ họ tên)</div>
                            <div className="h-20"></div>
                            <div className="font-bold">......................................................</div>
                        </div>

                        <div className="space-y-1">
                            <div className="font-extrabold uppercase text-[11px]">ĐẠI DIỆN BÊN NHẬN KÝ GỬI</div>
                            <div className="text-[11px] italic">(Ký, đóng dấu & ghi rõ họ tên)</div>
                            <div className="h-20"></div>
                            <div className="font-bold">......................................................</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
