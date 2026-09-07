'use client'

import React from 'react'
import { Printer, X } from 'lucide-react'

export type ConsignmentDispatchLine = {
    productId: string
    skuCode: string
    productName: string
    vintage?: number | string | null
    unit?: string
    qtyTransferred: number
    notes?: string | null
}

export type ConsignmentDispatchData = {
    transferNo: string
    transferDate: string
    fromWarehouseName: string
    fromWarehouseCode: string
    fromWarehouseAddress?: string | null
    toWarehouseName: string
    toWarehouseCode: string
    toWarehouseAddress?: string | null
    customerName: string
    customerCode: string
    customerAddress?: string | null
    customerPhone?: string | null
    customerTaxId?: string | null
    notes?: string | null
    legalEntityName?: string
    legalEntityAddress?: string
    legalEntityTaxId?: string
    lines: ConsignmentDispatchLine[]
}

type Props = {
    data: ConsignmentDispatchData
    onClose: () => void
}

export default function PrintableConsignmentDispatch({ data, onClose }: Props) {
    const handlePrint = () => {
        window.print()
    }

    const totalBottles = data.lines.reduce((sum, line) => sum + Number(line.qtyTransferred || 0), 0)

    const dateObj = new Date(data.transferDate || Date.now())
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
                            PHIẾU XUẤT KHO GỬI BÁN HÀNG KÝ GỬI (A4)
                        </h2>
                        <p className="text-xs text-slate-500">
                            Số lệnh: <span className="font-bold text-slate-800 font-mono">{data.transferNo}</span> — Khách nhận: {data.customerName}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-95"
                    >
                        <Printer className="w-4 h-4" />
                        In Phiếu Xuất Kho (A4)
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
                        <div className="text-xs font-semibold mt-1">
                            Lệnh điều động số: <span className="font-bold font-mono">{data.transferNo}</span>
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
                        PHIẾU XUẤT KHO HÀNG GỬI BÁN ĐẠI LÝ / KÝ GỬI
                    </h1>
                    <p className="text-[11px] italic font-semibold">(Kiêm vận chuyển nội bộ — Không thu tiền / Không xuất hóa đơn VAT)</p>
                    <p className="text-xs italic">
                        Ngày {dayStr} tháng {monthStr} năm {yearStr}
                    </p>
                </div>

                {/* Thông tin luân chuyển */}
                <div className="text-xs space-y-1.5 mb-4 border border-black p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>- Kho xuất hàng: <span className="font-bold">{data.fromWarehouseName}</span> ({data.fromWarehouseCode})</div>
                        <div>- Kho nhận hàng ký gửi: <span className="font-bold">{data.toWarehouseName}</span> ({data.toWarehouseCode})</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>- Khách hàng nhận ký gửi: <span className="font-bold">{data.customerName}</span> ({data.customerCode})</div>
                        <div>- Địa điểm giao hàng: {data.toWarehouseAddress || data.customerAddress || 'Tại điểm kinh doanh của đối tác'}</div>
                    </div>
                    {data.notes && (
                        <div>- Lý do xuất kho / Ghi chú: <span className="italic">{data.notes}</span></div>
                    )}
                </div>

                {/* Bảng chi tiết danh mục hàng hóa */}
                <div className="mb-4">
                    <table className="w-full text-left border-collapse border border-black text-xs">
                        <thead>
                            <tr className="bg-slate-100 text-black font-extrabold text-[11px] text-center border-b border-black">
                                <th className="border border-black p-1.5 w-8">STT</th>
                                <th className="border border-black p-1.5 w-24">Mã SKU</th>
                                <th className="border border-black p-1.5">Tên Hàng Hóa, Quy Cách (Rượu Vang)</th>
                                <th className="border border-black p-1.5 w-16 text-center">Niên Vụ</th>
                                <th className="border border-black p-1.5 w-14 text-center">ĐVT</th>
                                <th className="border border-black p-1.5 w-24 text-center">Số Lượng Xuất</th>
                                <th className="border border-black p-1.5 w-32 text-center">Ghi Chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.lines.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="border border-black p-4 text-center italic text-slate-500">
                                        Không có mặt hàng nào trong phiếu xuất.
                                    </td>
                                </tr>
                            ) : (
                                data.lines.map((line, idx) => (
                                    <tr key={line.productId + (line.vintage || '')} className="border-b border-black">
                                        <td className="border border-black p-1 text-center">{idx + 1}</td>
                                        <td className="border border-black p-1 font-mono font-semibold">{line.skuCode}</td>
                                        <td className="border border-black p-1 font-medium">{line.productName}</td>
                                        <td className="border border-black p-1 text-center font-mono">{line.vintage || 'NV'}</td>
                                        <td className="border border-black p-1 text-center">{line.unit || 'Chai'}</td>
                                        <td className="border border-black p-1 text-center font-bold font-mono">
                                            {Number(line.qtyTransferred).toLocaleString('vi-VN')}
                                        </td>
                                        <td className="border border-black p-1 text-left text-[11px] italic">
                                            {line.notes || ''}
                                        </td>
                                    </tr>
                                ))
                            )}

                            {/* Dòng tổng cộng */}
                            <tr className="border-t-2 border-black font-extrabold bg-slate-50">
                                <td colSpan={5} className="border border-black p-1.5 text-right uppercase">
                                    Tổng cộng ({data.lines.length} mặt hàng):
                                </td>
                                <td className="border border-black p-1.5 text-center font-mono text-sm">
                                    {totalBottles.toLocaleString('vi-VN')}
                                </td>
                                <td className="border border-black p-1.5"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="text-xs italic mb-8">
                    * Số lượng xuất kho (viết bằng chữ): ............................................................................................................ chai.
                </div>

                {/* 4 Chữ ký */}
                <div className="pt-2">
                    <div className="grid grid-cols-4 text-center text-xs">
                        <div className="space-y-1">
                            <div className="font-extrabold uppercase text-[10px]">NGƯỜI LẬP PHIẾU</div>
                            <div className="text-[10px] italic">(Ký, họ tên)</div>
                            <div className="h-16"></div>
                            <div className="font-bold">...........................</div>
                        </div>

                        <div className="space-y-1">
                            <div className="font-extrabold uppercase text-[10px]">THỦ KHO XUẤT</div>
                            <div className="text-[10px] italic">(Ký, họ tên)</div>
                            <div className="h-16"></div>
                            <div className="font-bold">...........................</div>
                        </div>

                        <div className="space-y-1">
                            <div className="font-extrabold uppercase text-[10px]">NGƯỜI VẬN CHUYỂN</div>
                            <div className="text-[10px] italic">(Ký, họ tên)</div>
                            <div className="h-16"></div>
                            <div className="font-bold">...........................</div>
                        </div>

                        <div className="space-y-1">
                            <div className="font-extrabold uppercase text-[10px]">BÊN NHẬN KÝ GỬI</div>
                            <div className="text-[10px] italic">(Ký, đóng dấu, họ tên)</div>
                            <div className="h-16"></div>
                            <div className="font-bold">...........................</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
