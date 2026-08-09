'use client'

import React, { useState } from 'react'
import { Printer, ShieldCheck, X, CheckCircle2 } from 'lucide-react'
import { approveAndCreateAdjustment } from './actions'
import { formatCasesAndBottles } from '@/lib/utils'

type AuditLine = {
    id: string
    productId: string
    skuCode: string
    productName: string
    unitsPerCase: number
    vintage?: number | string | null
    locationCode: string
    zone: string
    qtySystem: number
    qtyActual: number | null
    variance: number | null
    varianceReason: string | null
    unitCost: number
    varianceValueVND: number
    notes: string | null
}

type AuditDetail = {
    id: string
    sessionNo: string
    title: string
    warehouseName: string
    warehouseCode: string
    legalEntityName?: string | null
    legalEntityAddress?: string | null
    legalEntityTaxId?: string | null
    scopeType: string
    status: string
    assignedToName?: string | null
    createdByName?: string | null
    startedAt?: string | null
    completedAt?: string | null
    createdAt: string
    notes?: string | null
    lines: AuditLine[]
}

type Props = {
    detail: AuditDetail
    onClose: () => void
    onRefreshed?: () => void
}

export default function PrintableAuditReport({ detail, onClose, onRefreshed }: Props) {
    const [isApproving, setIsApproving] = useState(false)

    const totalSystemQty = detail.lines.reduce((sum, l) => sum + Number(l.qtySystem || 0), 0)
    const totalActualQty = detail.lines.reduce((sum, l) => sum + Number(l.qtyActual ?? 0), 0)
    const totalVarianceQty = detail.lines.reduce((sum, l) => sum + Number(l.variance ?? 0), 0)
    const totalVarianceValue = detail.lines.reduce((sum, l) => sum + Number(l.varianceValueVND || 0), 0)

    const handlePrint = () => {
        window.print()
    }

    const handleApprove = async () => {
        if (!confirm('Bạn có chắc chắn muốn Phê Duyệt phiên kiểm kê này? Hệ thống sẽ tự động cập nhật tồn kho gốc và tạo Phiếu Điều Chỉnh Kế Toán.')) return
        setIsApproving(true)
        const res = await approveAndCreateAdjustment(detail.id)
        setIsApproving(false)
        if (res.success) {
            alert(`Duyệt thành công! Đã tạo Phiếu điều chỉnh mã ${res.adjustmentNo}`)
            if (onRefreshed) onRefreshed()
            onClose()
        } else {
            alert(res.error || 'Lỗi phê duyệt kiểm kê')
        }
    }

    const createdDateObj = new Date(detail.createdAt)
    const dayStr = createdDateObj.getDate().toString().padStart(2, '0')
    const monthStr = (createdDateObj.getMonth() + 1).toString().padStart(2, '0')
    const yearStr = createdDateObj.getFullYear().toString()

    const legalName = detail.legalEntityName || 'CÔNG TY TNHH LY CELLARS'

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 overflow-y-auto p-4 sm:p-6 print:p-0 print:bg-white print:overflow-visible print:inset-auto print:static">
            {/* Top Toolbar (Hidden on Print) */}
            <div className="max-w-4xl mx-auto mb-4 bg-white border border-slate-200 text-slate-900 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl print:hidden">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-base font-extrabold text-slate-900">BIÊN BẢN KIỂM KÊ KHO HÀNG HÓA A4</h2>
                        <p className="text-xs text-slate-500">Đơn vị: {legalName} | Kho: {detail.warehouseName}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {detail.status !== 'APPROVED' && (
                        <button
                            onClick={handleApprove}
                            disabled={isApproving}
                            className="px-4 py-2 bg-[#87CBB9] hover:bg-[#76BAA8] text-[#0A1926] text-xs font-black rounded-xl flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-95"
                        >
                            <ShieldCheck className="w-4 h-4" />
                            {isApproving ? 'Đang duyệt...' : 'Duyệt & Tạo Bút Toán ADJ'}
                        </button>
                    )}

                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-95"
                    >
                        <Printer className="w-4 h-4" />
                        In Biên Bản (A4)
                    </button>
                </div>
            </div>

            {/* REAL A4 FORM DOCUMENT PRINT CONTAINER */}
            <div className="max-w-4xl mx-auto bg-white text-black p-8 sm:p-12 shadow-2xl rounded-none print:shadow-none print:p-0 print:max-w-none font-serif leading-normal">
                {/* Header: Company & Quốc Hiệu */}
                <div className="flex justify-between items-start border-b border-black pb-4 mb-6">
                    <div>
                        <div className="font-extrabold uppercase text-sm tracking-wide">{legalName.toUpperCase()}</div>
                        {detail.legalEntityTaxId && (
                            <div className="text-xs font-semibold mt-0.5">MST: {detail.legalEntityTaxId}</div>
                        )}
                        <div className="text-xs font-bold mt-0.5">KHO HÀNG: {detail.warehouseName.toUpperCase()}</div>
                        {detail.legalEntityAddress && (
                            <div className="text-[11px] text-slate-700 italic mt-0.5">ĐC: {detail.legalEntityAddress}</div>
                        )}
                        <div className="text-xs italic mt-0.5">Mã phiếu: {detail.sessionNo}</div>
                    </div>
                    <div className="text-center">
                        <div className="font-extrabold uppercase text-xs">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                        <div className="font-bold text-xs mt-0.5">Độc lập - Tự do - Hạnh phúc</div>
                        <div className="text-xs mt-1">***</div>
                    </div>
                </div>

                {/* Main Title */}
                <div className="text-center my-6 space-y-1">
                    <h1 className="text-xl font-extrabold uppercase tracking-wide">BIÊN BẢN KIỂM KÊ KHO HÀNG HÓA</h1>
                    <p className="text-xs italic">Vào lúc .... giờ .... phút, Ngày {dayStr} tháng {monthStr} năm {yearStr}</p>
                    <p className="text-xs font-bold">
                        Phạm vi kiểm kê: {
                            detail.scopeType === 'FULL_WAREHOUSE' ? 'Kiểm kê toàn bộ kho (Full Warehouse)' :
                            detail.scopeType === 'CYCLE_COUNT' ? 'Kiểm kê chu kỳ (Cycle Count)' :
                            detail.scopeType === 'TRANSACTED_ITEMS' ? 'Mã có phát sinh giao dịch' : 'Kiểm kê đột xuất'
                        }
                    </p>
                </div>

                {/* Inventory Committee */}
                <div className="text-xs space-y-1 mb-6 border border-black p-3">
                    <div className="font-extrabold uppercase mb-1">I. THÀNH PHẦN BAN KIỂM KÊ:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>1. Ông/Bà: <span className="font-bold">{detail.createdByName || '................................'}</span> (Trưởng Ban)</div>
                        <div>2. Ông/Bà: <span className="font-bold">{detail.assignedToName || '................................'}</span> (Người kiểm)</div>
                        <div>3. Ông/Bà: <span className="font-bold">.........................................</span> (Kế toán kho)</div>
                    </div>
                </div>

                {/* Detail Table */}
                <div className="mb-6">
                    <div className="font-extrabold uppercase text-xs mb-2">II. KẾT QUẢ KIỂM KÊ CHI TIẾT:</div>
                    <table className="w-full text-left border-collapse border border-black text-xs font-serif">
                        <thead>
                            <tr className="bg-slate-100 text-black font-extrabold text-[11px] text-center border-b border-black">
                                <th className="border border-black p-1.5 w-8">STT</th>
                                <th className="border border-black p-1.5 w-20">Vị Trí</th>
                                <th className="border border-black p-1.5 w-24">Mã SKU</th>
                                <th className="border border-black p-1.5">Tên Sản Phẩm & Vintage</th>
                                <th className="border border-black p-1.5 w-16">ĐVT</th>
                                <th className="border border-black p-1.5 w-24 text-right">Tồn Sổ Sách</th>
                                <th className="border border-black p-1.5 w-24 text-right">Kiểm Thực Tế</th>
                                <th className="border border-black p-1.5 w-20 text-center">Chênh Lệch</th>
                                <th className="border border-black p-1.5">Ghi Chú / Lý Do</th>
                            </tr>
                        </thead>
                        <tbody>
                            {detail.lines.map((line, idx) => {
                                const upc = line.unitsPerCase || 6
                                const sysFormatted = formatCasesAndBottles(line.qtySystem, upc)
                                const actFormatted = line.qtyActual !== null ? formatCasesAndBottles(line.qtyActual, upc) : '-'
                                const variance = line.variance

                                return (
                                    <tr key={line.id} className="border-b border-black">
                                        <td className="border border-black p-1.5 text-center font-mono">{idx + 1}</td>
                                        <td className="border border-black p-1.5 font-bold">{line.zone || line.locationCode || 'Chung'}</td>
                                        <td className="border border-black p-1.5 font-mono font-bold">{line.skuCode}</td>
                                        <td className="border border-black p-1.5">
                                            <div className="font-bold">{line.productName}</div>
                                            <div className="text-[10px] text-slate-700 italic">Vintage: {line.vintage ?? 'NV'}</div>
                                        </td>
                                        <td className="border border-black p-1.5 text-center">Chai</td>
                                        <td className="border border-black p-1.5 text-right font-mono">
                                            <div className="font-bold">{line.qtySystem}</div>
                                            <div className="text-[10px] text-slate-600">({sysFormatted})</div>
                                        </td>
                                        <td className="border border-black p-1.5 text-right font-mono">
                                            <div className="font-bold">{line.qtyActual !== null ? line.qtyActual : '-'}</div>
                                            {line.qtyActual !== null && (
                                                <div className="text-[10px] text-slate-600">({actFormatted})</div>
                                            )}
                                        </td>
                                        <td className="border border-black p-1.5 text-center font-mono font-bold">
                                            {variance === null || variance === 0 ? (
                                                'Khớp'
                                            ) : variance > 0 ? (
                                                `+${variance}`
                                            ) : (
                                                `${variance}`
                                            )}
                                        </td>
                                        <td className="border border-black p-1.5 text-[11px]">
                                            {line.varianceReason ? line.varianceReason : (line.notes || '-')}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="font-extrabold text-xs bg-slate-50 border-t-2 border-black">
                                <td colSpan={5} className="border border-black p-2 text-right uppercase">CỘNG TỔNG CỘNG:</td>
                                <td className="border border-black p-2 text-right font-mono">{totalSystemQty} chai</td>
                                <td className="border border-black p-2 text-right font-mono">{totalActualQty} chai</td>
                                <td className="border border-black p-2 text-center font-mono">
                                    {totalVarianceQty === 0 ? '0' : totalVarianceQty > 0 ? `+${totalVarianceQty}` : totalVarianceQty} chai
                                </td>
                                <td className="border border-black p-2 text-[11px]">
                                    Giá trị lệch: {totalVarianceValue.toLocaleString('vi-VN')} đ
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Conclusion & Recommendations */}
                <div className="text-xs space-y-1.5 mb-8">
                    <div className="font-extrabold uppercase">III. ĐÁNH GIÁ & KẾT LUẬN CỦA BAN KIỂM KÊ:</div>
                    <p>- Biên bản kiểm kê lập xong hồi .... giờ .... phút cùng ngày, đã được đọc lại cho mọi người cùng nghe và ký tên xác nhận.</p>
                    <p>- Ý kiến kiến nghị xử lý chênh lệch (nếu có): ................................................................................................................................................</p>
                </div>

                {/* Authentic Manual Ink Signatures Block (4 Columns) */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs mt-10 pt-4 break-inside-avoid">
                    <div className="space-y-1">
                        <div className="font-extrabold uppercase">NGƯỜI LẬP PHIẾU</div>
                        <div className="text-[10px] italic">(Ký, ghi rõ họ tên)</div>
                        <div className="h-20" />
                        <div className="font-bold border-t border-dotted border-black pt-1 mx-2">{detail.createdByName || '...........................'}</div>
                    </div>

                    <div className="space-y-1">
                        <div className="font-extrabold uppercase">NGƯỜI KIỂM KÊ</div>
                        <div className="text-[10px] italic">(Ký, ghi rõ họ tên)</div>
                        <div className="h-20" />
                        <div className="font-bold border-t border-dotted border-black pt-1 mx-2">{detail.assignedToName || '...........................'}</div>
                    </div>

                    <div className="space-y-1">
                        <div className="font-extrabold uppercase">THỦ KHO / BQL KHO</div>
                        <div className="text-[10px] italic">(Ký, ghi rõ họ tên)</div>
                        <div className="h-20" />
                        <div className="font-bold border-t border-dotted border-black pt-1 mx-2">...........................</div>
                    </div>

                    <div className="space-y-1">
                        <div className="font-extrabold uppercase">KẾ TOÁN KHO</div>
                        <div className="text-[10px] italic">(Ký, đóng dấu, họ tên)</div>
                        <div className="h-20" />
                        <div className="font-bold border-t border-dotted border-black pt-1 mx-2">...........................</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
