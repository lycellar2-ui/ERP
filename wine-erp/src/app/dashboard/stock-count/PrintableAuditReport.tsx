'use client'

import React, { useRef, useState } from 'react'
import { Printer, CheckCircle2, ShieldCheck, FileSpreadsheet, X, PenTool, RotateCcw } from 'lucide-react'
import { saveStockCountSignatures, approveAndCreateAdjustment } from './actions'
import { formatCasesAndBottles } from '@/lib/utils'

type AuditLine = {
    id: string
    productId: string
    skuCode: string
    productName: string
    unitsPerCase: number
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
    scopeType: string
    status: string
    assignedToName?: string | null
    createdByName?: string | null
    startedAt?: string | null
    completedAt?: string | null
    createdAt: string
    counterSignature?: string | null
    managerSignature?: string | null
    accountantSignature?: string | null
    adjustmentVoucherId?: string | null
    notes?: string | null
    lines: AuditLine[]
}

type Props = {
    detail: AuditDetail
    onClose: () => void
    onRefreshed?: () => void
}

export default function PrintableAuditReport({ detail, onClose, onRefreshed }: Props) {
    const [counterSig, setCounterSig] = useState<string>(detail.counterSignature || '')
    const [managerSig, setManagerSig] = useState<string>(detail.managerSignature || '')
    const [accountantSig, setAccountantSig] = useState<string>(detail.accountantSignature || '')
    const [isSavingSig, setIsSavingSig] = useState(false)
    const [isApproving, setIsApproving] = useState(false)
    const [sigSuccessMsg, setSigSuccessMsg] = useState('')

    const counterCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const managerCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const accountantCanvasRef = useRef<HTMLCanvasElement | null>(null)

    const [activeSigModal, setActiveSigModal] = useState<'counter' | 'manager' | 'accountant' | null>(null)
    const [isDrawing, setIsDrawing] = useState(false)

    const totalSystemQty = detail.lines.reduce((sum, l) => sum + l.qtySystem, 0)
    const totalActualQty = detail.lines.reduce((sum, l) => sum + (l.qtyActual ?? 0), 0)
    const totalVarianceQty = detail.lines.reduce((sum, l) => sum + (l.variance ?? 0), 0)
    const totalVarianceValue = detail.lines.reduce((sum, l) => sum + l.varianceValueVND, 0)

    const handlePrint = () => {
        window.print()
    }

    // Canvas drawing helpers
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        setIsDrawing(true)
        const canvas = e.currentTarget
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const rect = canvas.getBoundingClientRect()
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
        ctx.beginPath()
        ctx.moveTo(clientX - rect.left, clientY - rect.top)
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return
        const canvas = e.currentTarget
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const rect = canvas.getBoundingClientRect()
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
        ctx.lineTo(clientX - rect.left, clientY - rect.top)
        ctx.strokeStyle = '#1e293b'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.stroke()
    }

    const stopDrawing = () => {
        setIsDrawing(false)
    }

    const clearCanvas = (ref: React.RefObject<HTMLCanvasElement | null>) => {
        if (!ref.current) return
        const ctx = ref.current.getContext('2d')
        if (ctx) {
            ctx.clearRect(0, 0, ref.current.width, ref.current.height)
        }
    }

    const saveCanvasSig = (type: 'counter' | 'manager' | 'accountant', ref: React.RefObject<HTMLCanvasElement | null>) => {
        if (!ref.current) return
        const dataUrl = ref.current.toDataURL('image/png')
        if (type === 'counter') setCounterSig(dataUrl)
        if (type === 'manager') setManagerSig(dataUrl)
        if (type === 'accountant') setAccountantSig(dataUrl)
        setActiveSigModal(null)
    }

    const handleSaveAllSignatures = async () => {
        setIsSavingSig(true)
        setSigSuccessMsg('')
        const res = await saveStockCountSignatures({
            sessionId: detail.id,
            counterSignature: counterSig,
            managerSignature: managerSig,
            accountantSignature: accountantSig
        })
        setIsSavingSig(false)
        if (res.success) {
            setSigSuccessMsg('Đã lưu chữ ký thành công!')
            if (onRefreshed) onRefreshed()
        } else {
            alert(res.error || 'Không thể lưu chữ ký')
        }
    }

    const handleApprove = async () => {
        if (!confirm('Bạn có chắc chắn muốn Duyệt phiên kiểm kê này? Hệ thống sẽ tự động điều chỉnh tồn kho gốc và tạo Phiếu Điều Chỉnh Kế Toán.')) return
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

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 overflow-y-auto p-4 sm:p-6 print:p-0 print:bg-white print:overflow-visible">
            {/* Top Toolbar (Hidden on Print) */}
            <div className="max-w-5xl mx-auto mb-4 bg-white border border-slate-200 text-slate-900 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl print:hidden">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-base font-extrabold text-slate-900">BIÊN BẢN KIỂM KÊ KHO</h2>
                        <p className="text-xs text-slate-500">Mã phiếu: {detail.sessionNo} | Kho: {detail.warehouseName}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSaveAllSignatures}
                        disabled={isSavingSig}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                    >
                        <PenTool className="w-4 h-4 text-emerald-600" />
                        {isSavingSig ? 'Đang lưu...' : 'Lưu chữ ký'}
                    </button>

                    {detail.status !== 'APPROVED' && (
                        <button
                            onClick={handleApprove}
                            disabled={isApproving}
                            className="px-3.5 py-2 bg-[#87CBB9] hover:bg-[#76BAA8] text-[#0A1926] text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                        >
                            <ShieldCheck className="w-4 h-4" />
                            {isApproving ? 'Đang duyệt...' : 'Duyệt & Tạo Bút Toán ADJ'}
                        </button>
                    )}

                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                        <Printer className="w-4 h-4" />
                        In Biên Bản (A4)
                    </button>
                </div>
            </div>

            {sigSuccessMsg && (
                <div className="max-w-5xl mx-auto mb-3 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs p-3 rounded-xl print:hidden">
                    {sigSuccessMsg}
                </div>
            )}

            {/* A4 Document Printable Sheet */}
            <div className="max-w-5xl mx-auto bg-white text-slate-900 p-8 sm:p-12 shadow-2xl rounded-2xl print:shadow-none print:rounded-none print:p-0 font-sans text-xs leading-relaxed">
                {/* Document Header */}
                <div className="flex justify-between items-start border-b border-slate-300 pb-6 mb-6">
                    <div>
                        <h1 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">CÔNG TY TNHH HẦM RƯỢU LY'S / THẮNG ÂN</h1>
                        <p className="text-slate-600 font-medium">Hệ thống Quản lý Tồn kho & Kiểm toán ERP</p>
                        <p className="text-slate-500 mt-1">Kho áp dụng: <strong className="text-slate-900 font-bold">{detail.warehouseName}</strong> ({detail.warehouseCode})</p>
                    </div>
                    <div className="text-right">
                        <div className="inline-block bg-slate-100 border border-slate-300 px-3 py-1.5 rounded text-right">
                            <p className="font-mono font-bold text-slate-900 text-sm">{detail.sessionNo}</p>
                            <p className="text-[10px] text-slate-500">Mã Biên Bản Kiểm Kê</p>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-2">Ngày tạo: {new Date(detail.createdAt).toLocaleDateString('vi-VN')}</p>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center my-6">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">BIÊN BẢN KIỂM KÊ TỒN KHO THỰC TẾ</h2>
                    <p className="text-slate-600 text-xs mt-1 font-medium">
                        Phạm vi: <span className="font-bold text-slate-900">{detail.title}</span> ({detail.scopeType})
                    </p>
                </div>

                {/* Info Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs">
                    <div>
                        <span className="text-slate-500 block text-[10px]">Thời gian bắt đầu:</span>
                        <strong className="text-slate-800">{detail.startedAt ? new Date(detail.startedAt).toLocaleString('vi-VN') : 'N/A'}</strong>
                    </div>
                    <div>
                        <span className="text-slate-500 block text-[10px]">Thời gian hoàn thành:</span>
                        <strong className="text-slate-800">{detail.completedAt ? new Date(detail.completedAt).toLocaleString('vi-VN') : 'N/A'}</strong>
                    </div>
                    <div>
                        <span className="text-slate-500 block text-[10px]">Nhân viên kiểm kê:</span>
                        <strong className="text-slate-800">{detail.assignedToName || 'Chưa phân công'}</strong>
                    </div>
                    <div>
                        <span className="text-slate-500 block text-[10px]">Trạng thái phê duyệt:</span>
                        <strong className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${detail.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {detail.status === 'APPROVED' ? 'ĐÃ DUYỆT BÚT TOÁN' : 'ĐANG KIỂM KÊ / CHỜ DUYỆT'}
                        </strong>
                    </div>
                </div>

                {/* Summary Table Metrics */}
                <div className="grid grid-cols-4 gap-3 mb-6 text-center">
                    <div className="bg-slate-100 p-3 rounded-lg border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Tồn Sổ Sách</p>
                        <p className="text-lg font-black text-slate-800">{totalSystemQty.toLocaleString('vi-VN')} chai</p>
                    </div>
                    <div className="bg-slate-100 p-3 rounded-lg border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Tồn Thực Tế</p>
                        <p className="text-lg font-black text-slate-800">{totalActualQty.toLocaleString('vi-VN')} chai</p>
                    </div>
                    <div className={`p-3 rounded-lg border ${totalVarianceQty === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : totalVarianceQty > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                        <p className="text-[10px] uppercase font-bold">Chênh Lệch Lượng</p>
                        <p className="text-lg font-black">{totalVarianceQty > 0 ? `+${totalVarianceQty}` : totalVarianceQty} chai</p>
                    </div>
                    <div className={`p-3 rounded-lg border ${totalVarianceValue === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : totalVarianceValue > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                        <p className="text-[10px] uppercase font-bold">Giá Trị Chênh Lệch (VND)</p>
                        <p className="text-base font-black">{totalVarianceValue.toLocaleString('vi-VN')} ₫</p>
                    </div>
                </div>

                {/* Detailed Table */}
                <div className="overflow-x-auto mb-8">
                    <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                            <tr className="bg-slate-100 text-slate-900 uppercase text-[10px] tracking-wider font-extrabold">
                                <th className="p-2 border border-slate-300 w-8 text-center">STT</th>
                                <th className="p-2 border border-slate-300">Mã SKU</th>
                                <th className="p-2 border border-slate-300">Tên Sản Phẩm</th>
                                <th className="p-2 border border-slate-300 text-center">Vintage</th>
                                <th className="p-2 border border-slate-300">Vị Trí Kho</th>
                                <th className="p-2 border border-slate-300 text-right">Sổ Sách</th>
                                <th className="p-2 border border-slate-300 text-right">Thực Tế (Thùng + Lẻ)</th>
                                <th className="p-2 border border-slate-300 text-right">Chênh Lệch</th>
                                <th className="p-2 border border-slate-300 text-right">Giá Trị (VND)</th>
                                <th className="p-2 border border-slate-300">Giải Trình / Lý Do</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 border border-slate-300">
                            {detail.lines.map((line, index) => {
                                const isDiff = line.variance !== null && line.variance !== 0
                                const upc = line.unitsPerCase || 6
                                const sysCases = formatCasesAndBottles(line.qtySystem, upc)
                                const actCases = line.qtyActual !== null ? formatCasesAndBottles(line.qtyActual, upc) : '-'
                                const varCases = line.variance !== null ? formatCasesAndBottles(line.variance, upc) : '-'

                                return (
                                    <tr key={line.id} className={isDiff ? (line.variance! < 0 ? 'bg-rose-50/70' : 'bg-amber-50/70') : 'hover:bg-slate-50'}>
                                        <td className="p-2 border border-slate-300 text-center font-medium">{index + 1}</td>
                                        <td className="p-2 border border-slate-300 font-mono font-bold">{line.skuCode}</td>
                                        <td className="p-2 border border-slate-300 font-semibold">{line.productName}</td>
                                        <td className="p-2 border border-slate-300 text-center font-mono font-bold text-amber-900 bg-amber-50/50">
                                            {(line as any).vintage ?? 'NV'}
                                        </td>
                                        <td className="p-2 border border-slate-300 font-mono text-slate-700">{line.zone}</td>
                                        <td className="p-2 border border-slate-300 text-right font-medium" title={`${line.qtySystem} chai`}>{sysCases}</td>
                                        <td className="p-2 border border-slate-300 text-right font-bold" title={line.qtyActual !== null ? `${line.qtyActual} chai` : ''}>{actCases}</td>
                                        <td className={`p-2 border border-slate-300 text-right font-bold ${isDiff ? (line.variance! < 0 ? 'text-rose-600' : 'text-amber-600') : 'text-slate-700'}`}>
                                            {varCases}
                                        </td>
                                        <td className="p-2 border border-slate-300 text-right font-mono text-slate-800">
                                            {line.varianceValueVND !== 0 ? line.varianceValueVND.toLocaleString('vi-VN') : '0'} ₫
                                        </td>
                                        <td className="p-2 border border-slate-300 text-slate-600 italic">
                                            {line.varianceReason ? (
                                                <span className="font-semibold text-slate-800 block text-[10px]">{line.varianceReason}</span>
                                            ) : null}
                                            {line.notes || '-'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-slate-900">
                                <td colSpan={5} className="p-2 text-right uppercase">Tổng Cộng:</td>
                                <td className="p-2 text-right font-mono">{totalSystemQty.toLocaleString('vi-VN')} chai</td>
                                <td className="p-2 text-right font-mono">{totalActualQty.toLocaleString('vi-VN')} chai</td>
                                <td className="p-2 text-right font-mono">{totalVarianceQty > 0 ? `+${totalVarianceQty}` : totalVarianceQty} chai</td>
                                <td className="p-2 text-right font-mono text-emerald-700">{totalVarianceValue.toLocaleString('vi-VN')} ₫</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Signatures Section */}
                <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-300 text-center">
                    {/* Counter */}
                    <div className="flex flex-col items-center justify-between min-h-[160px]">
                        <div>
                            <p className="font-bold text-slate-900 uppercase">NGƯỜI KIỂM KÊ</p>
                            <p className="text-[10px] text-slate-500 italic">(Ký và ghi rõ họ tên)</p>
                        </div>
                        <div className="my-2 h-20 w-full flex items-center justify-center border border-dashed border-slate-300 rounded relative group">
                            {counterSig ? (
                                <img src={counterSig} alt="Chữ ký người kiểm kê" className="max-h-full max-w-full object-contain" />
                            ) : (
                                <button
                                    onClick={() => setActiveSigModal('counter')}
                                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 print:hidden"
                                >
                                    <PenTool className="w-3.5 h-3.5" /> Ký điện tử
                                </button>
                            )}
                        </div>
                        <p className="font-semibold text-slate-800">{detail.assignedToName || '...............................'}</p>
                    </div>

                    {/* Warehouse Manager */}
                    <div className="flex flex-col items-center justify-between min-h-[160px]">
                        <div>
                            <p className="font-bold text-slate-900 uppercase">THỦ KHO / BQL KHO</p>
                            <p className="text-[10px] text-slate-500 italic">(Ký và ghi rõ họ tên)</p>
                        </div>
                        <div className="my-2 h-20 w-full flex items-center justify-center border border-dashed border-slate-300 rounded relative group">
                            {managerSig ? (
                                <img src={managerSig} alt="Chữ ký thủ kho" className="max-h-full max-w-full object-contain" />
                            ) : (
                                <button
                                    onClick={() => setActiveSigModal('manager')}
                                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 print:hidden"
                                >
                                    <PenTool className="w-3.5 h-3.5" /> Ký điện tử
                                </button>
                            )}
                        </div>
                        <p className="font-semibold text-slate-800">...............................</p>
                    </div>

                    {/* Chief Accountant */}
                    <div className="flex flex-col items-center justify-between min-h-[160px]">
                        <div>
                            <p className="font-bold text-slate-900 uppercase">KẾ TOÁN KHO / KT TRƯỞNG</p>
                            <p className="text-[10px] text-slate-500 italic">(Ký và ghi rõ họ tên)</p>
                        </div>
                        <div className="my-2 h-20 w-full flex items-center justify-center border border-dashed border-slate-300 rounded relative group">
                            {accountantSig ? (
                                <img src={accountantSig} alt="Chữ ký kế toán" className="max-h-full max-w-full object-contain" />
                            ) : (
                                <button
                                    onClick={() => setActiveSigModal('accountant')}
                                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 print:hidden"
                                >
                                    <PenTool className="w-3.5 h-3.5" /> Ký điện tử
                                </button>
                            )}
                        </div>
                        <p className="font-semibold text-slate-800">...............................</p>
                    </div>
                </div>
            </div>

            {/* Signature Draw Modal */}
            {activeSigModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-900">
                        <h3 className="font-bold text-base mb-1 text-slate-900">Ký Điện Tử Trực Tiếp</h3>
                        <p className="text-xs text-slate-500 mb-4">Dùng chuột hoặc ngón tay vẽ chữ ký trên khung bên dưới</p>

                        <div className="border-2 border-slate-300 rounded-xl overflow-hidden touch-none bg-slate-50">
                            <canvas
                                ref={
                                    activeSigModal === 'counter' ? counterCanvasRef :
                                    activeSigModal === 'manager' ? managerCanvasRef : accountantCanvasRef
                                }
                                width={400}
                                height={200}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="w-full h-48 cursor-crosshair"
                            />
                        </div>

                        <div className="flex justify-between items-center mt-4">
                            <button
                                onClick={() => clearCanvas(
                                    activeSigModal === 'counter' ? counterCanvasRef :
                                    activeSigModal === 'manager' ? managerCanvasRef : accountantCanvasRef
                                )}
                                className="px-3 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 font-semibold"
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> Xóa vẽ lại
                            </button>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setActiveSigModal(null)}
                                    className="px-3 py-2 text-xs bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={() => saveCanvasSig(
                                        activeSigModal,
                                        activeSigModal === 'counter' ? counterCanvasRef :
                                        activeSigModal === 'manager' ? managerCanvasRef : accountantCanvasRef
                                    )}
                                    className="px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow"
                                >
                                    Lưu Chữ Ký
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
