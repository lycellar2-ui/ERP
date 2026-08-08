'use client'

import { useState, useEffect } from 'react'
import { X, Save, Send, Plus, Trash2, ArrowRightLeft, AlertCircle, Building2, Calendar, FileText, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { createTransferOrder, getTransferOptions } from './actions'
import { formatVND } from '@/lib/utils'

interface CreateTransferDrawerProps {
    open: boolean
    onClose: () => void
    onSuccess: () => void
}

type WarehouseOpt = { id: string; code: string; name: string }
type ProductOpt = { id: string; skuCode: string; productName: string; country?: string | null; vintage?: number | null }

interface TransferLineItem {
    productId: string
    qtyTransferred: number
    qtyAvailable: number
}

const TRANSFER_REASONS = [
    'Phân bổ hàng hóa cho Kho Cửa hàng / HORECA',
    'Cân bằng tồn kho giữa các kho chi nhánh',
    'Chuyển sang Kho Lạnh bảo quản đặc biệt (Grand Cru)',
    'Trả hàng về Kho Tổng (Main Central Warehouse)',
    'Trung chuyển hàng hóa cho Đơn Bán Hàng / Sự Kiện',
    'Khác (Chi tiết trong ghi chú)',
]

export function CreateTransferDrawer({ open, onClose, onSuccess }: CreateTransferDrawerProps) {
    const [loadingOpts, setLoadingOpts] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [warehouses, setWarehouses] = useState<WarehouseOpt[]>([])
    const [products, setProducts] = useState<ProductOpt[]>([])

    const [fromWarehouseId, setFromWarehouseId] = useState('')
    const [toWarehouseId, setToWarehouseId] = useState('')
    const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
    const [reasonSelect, setReasonSelect] = useState(TRANSFER_REASONS[0])
    const [customNotes, setCustomNotes] = useState('')
    const [lines, setLines] = useState<TransferLineItem[]>([])

    useEffect(() => {
        if (!open) return
        const load = async () => {
            setLoadingOpts(true)
            try {
                const res = await getTransferOptions()
                setWarehouses(res.warehouses)
                setProducts(res.products)
                if (res.warehouses.length >= 2) {
                    setFromWarehouseId(res.warehouses[0].id)
                    setToWarehouseId(res.warehouses[1].id)
                }
            } catch (err: any) {
                toast.error('Lỗi tải danh mục kho & sản phẩm: ' + err.message)
            } finally {
                setLoadingOpts(false)
            }
        }
        load()
    }, [open])

    if (!open) return null

    const handleAddLine = () => {
        setLines(prev => [...prev, { productId: '', qtyTransferred: 1, qtyAvailable: 0 }])
    }

    const handleRemoveLine = (idx: number) => {
        setLines(prev => prev.filter((_, i) => i !== idx))
    }

    const handleLineProductChange = (idx: number, productId: string) => {
        setLines(prev => prev.map((l, i) => i === idx ? { ...l, productId } : l))
    }

    const handleLineQtyChange = (idx: number, qtyTransferred: number) => {
        setLines(prev => prev.map((l, i) => i === idx ? { ...l, qtyTransferred: Math.max(1, qtyTransferred) } : l))
    }

    const handleSubmit = async (submitForApproval: boolean) => {
        if (!fromWarehouseId || !toWarehouseId) {
            toast.error('Vui lòng chọn Kho xuất và Kho nhận')
            return
        }
        if (fromWarehouseId === toWarehouseId) {
            toast.error('Kho xuất và Kho nhận không được trùng nhau!')
            return
        }

        const validLines = lines.filter(l => l.productId && l.qtyTransferred > 0)
        if (validLines.length === 0) {
            toast.error('Vui lòng chọn ít nhất 1 sản phẩm với số lượng > 0')
            return
        }

        setSubmitting(true)
        const notes = customNotes ? `${reasonSelect} — ${customNotes}` : reasonSelect

        try {
            const res = await createTransferOrder({
                fromWarehouseId,
                toWarehouseId,
                transferDate,
                notes,
                submitForApproval,
                lines: validLines.map(l => ({ productId: l.productId, qtyTransferred: l.qtyTransferred })),
            })

            if (!res.success) {
                toast.error(res.error || 'Tạo phiếu thất bại')
                return
            }

            toast.success(submitForApproval ? `✅ Đã tạo & gửi Kế Toán duyệt thành công (Mã ${res.transferNo})` : `✅ Đã lưu nháp Phiếu Chuyển Kho (${res.transferNo})`)
            onSuccess()
            onClose()
        } catch (err: any) {
            toast.error('Lỗi hệ thống: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10,25,38,0.7)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white w-full max-w-3xl h-full flex flex-col shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200">
                {/* Drawer Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                📋 Lập Phiếu Chuyển Kho Nội Bộ
                            </h3>
                            <p className="text-xs text-slate-500">
                                Tạo phiếu chuyển rượu giữa các kho & gửi Kế toán phê duyệt
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Warehouse Route Card */}
                    <div className="p-4.5 rounded-2xl bg-amber-500/5 border border-amber-200 space-y-3">
                        <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                            <Building2 size={15} className="text-amber-600" /> Tuyến Đường Chuyển Kho
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Source WH */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                                    🔴 Kho Xuất (Kho Đi) <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={fromWarehouseId}
                                    onChange={e => setFromWarehouseId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-bold text-xs text-slate-900 outline-none focus:border-amber-500 cursor-pointer"
                                >
                                    <option value="">-- Chọn Kho Xuất --</option>
                                    {warehouses.map(w => (
                                        <option key={`from-${w.id}`} value={w.id}>
                                            [{w.code}] {w.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Destination WH */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                                    🟢 Kho Nhận (Kho Đến) <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={toWarehouseId}
                                    onChange={e => setToWarehouseId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-bold text-xs text-slate-900 outline-none focus:border-amber-500 cursor-pointer"
                                >
                                    <option value="">-- Chọn Kho Nhận --</option>
                                    {warehouses.map(w => (
                                        <option key={`to-${w.id}`} value={w.id} disabled={w.id === fromWarehouseId}>
                                            [{w.code}] {w.name} {w.id === fromWarehouseId ? '(Trùng kho xuất)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Metadata Card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                                <Calendar size={14} className="text-slate-500" /> Ngày Chuyển Dự Kiến
                            </label>
                            <input
                                type="date"
                                value={transferDate}
                                onChange={e => setTransferDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold text-xs text-slate-900 outline-none focus:border-amber-500"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                                <FileText size={14} className="text-slate-500" /> Lý Do / Mục Đích Chuyển Kho
                            </label>
                            <select
                                value={reasonSelect}
                                onChange={e => setReasonSelect(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 font-bold text-xs text-slate-900 outline-none focus:border-amber-500 cursor-pointer"
                            >
                                {TRANSFER_REASONS.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Ghi Chú Bổ Sung</label>
                        <input
                            type="text"
                            value={customNotes}
                            onChange={e => setCustomNotes(e.target.value)}
                            placeholder="Ví dụ: Chuyển 24 chai Chateau Margaux theo đề xuất SO-2608-0015..."
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 outline-none focus:border-amber-500"
                        />
                    </div>

                    {/* Line Items Table */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                🍷 Danh Mục Sản Phẩm Chuyển Kho ({lines.length} dòng)
                            </h4>
                            <button
                                type="button"
                                onClick={handleAddLine}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                <Plus size={14} /> Thêm Rượu
                            </button>
                        </div>

                        {lines.length === 0 ? (
                            <div className="p-8 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center text-slate-400 bg-slate-50">
                                <AlertCircle size={32} className="mb-2 text-slate-300" />
                                <p className="text-xs font-bold text-slate-600">Chưa có sản phẩm nào trong phiếu</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">Nhấp "Thêm Rượu" ở trên để chọn mã sản phẩm & số lượng chuyển</p>
                            </div>
                        ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                                            <th className="p-3 font-extrabold uppercase text-[11px] w-12 text-center">STT</th>
                                            <th className="p-3 font-extrabold uppercase text-[11px]">Sản Phẩm / SKU</th>
                                            <th className="p-3 font-extrabold uppercase text-[11px] text-center w-36">Số Lượng (Chai)</th>
                                            <th className="p-3 font-extrabold uppercase text-[11px] text-center w-12">#</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {lines.map((line, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                                                <td className="p-3">
                                                    <select
                                                        value={line.productId}
                                                        onChange={e => handleLineProductChange(idx, e.target.value)}
                                                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 font-bold text-xs text-slate-900 outline-none focus:border-amber-500 cursor-pointer"
                                                    >
                                                        <option value="">-- Chọn Rượu Vang --</option>
                                                        {products.map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                [{p.skuCode}] {p.productName} {p.vintage ? `(${p.vintage})` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={line.qtyTransferred}
                                                        onChange={e => handleLineQtyChange(idx, parseInt(e.target.value) || 1)}
                                                        className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-center font-mono font-bold text-xs outline-none focus:border-amber-500"
                                                    />
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveLine(idx)}
                                                        className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Drawer Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                        Hủy Bỏ
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit(false)}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                            <Save size={15} /> Lưu Nháp
                        </button>

                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit(true)}
                            className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-amber-500 text-white hover:bg-amber-600 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                            <Send size={15} /> Tạo & Gửi Kế Toán Duyệt
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
