'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Save, Send, Plus, Trash2, ArrowRightLeft, AlertCircle, Building2, Calendar, FileText, Check, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { createTransferOrder, getTransferOptions } from './actions'

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

// ── Searchable Product Combobox Component ──────────
function ProductCombobox({
    products,
    selectedProductId,
    onChange,
}: {
    products: ProductOpt[]
    selectedProductId: string
    onChange: (productId: string) => void
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedProduct = products.find(p => p.id === selectedProductId)

    useEffect(() => {
        if (selectedProduct && !isOpen) {
            setSearch(`[${selectedProduct.skuCode}] ${selectedProduct.productName}`)
        } else if (!selectedProduct && !isOpen) {
            setSearch('')
        }
    }, [selectedProductId, selectedProduct, isOpen])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filtered = products.filter(p => {
        if (!search.trim() || (selectedProduct && search === `[${selectedProduct.skuCode}] ${selectedProduct.productName}`)) return true
        const q = search.toLowerCase().trim()
        return (
            p.skuCode.toLowerCase().includes(q) ||
            p.productName.toLowerCase().includes(q) ||
            (p.country && p.country.toLowerCase().includes(q)) ||
            (p.vintage && String(p.vintage).includes(q))
        )
    })

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative flex items-center">
                <input
                    type="text"
                    value={search}
                    onFocus={() => setIsOpen(true)}
                    onChange={(e) => {
                        setSearch(e.target.value)
                        if (!isOpen) setIsOpen(true)
                    }}
                    placeholder="🔍 Gõ SKU (ví dụ: FRA-BOR...), tên rượu..."
                    className="w-full pl-3 pr-8 py-2 rounded-lg bg-white border border-[#CBD5E1] font-semibold text-xs text-[#0F172A] outline-none focus:border-[#87CBB9] focus:ring-2 focus:ring-[#87CBB9]/20 transition-all min-h-[40px] touch-manipulation placeholder-[#94A3B8]"
                />
                {search ? (
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault()
                            onChange('')
                            setSearch('')
                            setIsOpen(true)
                        }}
                        className="absolute right-2.5 p-1 text-[#64748B] hover:text-[#0F172A] rounded-md cursor-pointer"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <ChevronDown size={14} className="absolute right-3 pointer-events-none text-[#94A3B8]" />
                )}
            </div>

            {/* Dropdown Options Popup */}
            {isOpen && (
                <div className="absolute z-[300] left-0 top-full mt-1 bg-white border border-[#CBD5E1] rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-[#F1F5F9] w-full sm:w-[480px]">
                    {filtered.length === 0 ? (
                        <div className="p-3.5 text-center text-xs text-[#94A3B8]">
                            Không tìm thấy sản phẩm nào phù hợp với từ khóa "{search}"
                        </div>
                    ) : (
                        filtered.map(p => {
                            const isSelected = p.id === selectedProductId
                            return (
                                <div
                                    key={p.id}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        onChange(p.id)
                                        setSearch(`[${p.skuCode}] ${p.productName}`)
                                        setIsOpen(false)
                                    }}
                                    className={`p-3 cursor-pointer transition-colors flex items-center justify-between gap-2 ${isSelected ? 'bg-teal-50 text-teal-900 font-bold' : 'hover:bg-[#F8FAFC] text-[#0F172A]'}`}
                                >
                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-[#B47816] text-xs px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200">
                                                {p.skuCode}
                                            </span>
                                            {p.vintage && (
                                                <span className="text-[10px] font-mono bg-teal-50 text-teal-800 px-1.5 py-0.2 rounded font-bold border border-teal-200">
                                                    {p.vintage}
                                                </span>
                                            )}
                                            {p.country && (
                                                <span className="text-[10px] text-[#64748B] font-medium">
                                                    • {p.country}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs font-semibold text-[#0F172A] truncate mt-0.5">{p.productName}</p>
                                    </div>
                                    {isSelected && <Check size={16} className="text-[#16A34A] shrink-0 ml-2" />}
                                </div>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
}

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

            toast.success(submitForApproval ? `✅ Đã tạo & gửi Kế Toán duyệt thành công (${res.transferNo})` : `✅ Đã lưu nháp Phiếu Chuyển Kho (${res.transferNo})`)
            onSuccess()
            onClose()
        } catch (err: any) {
            toast.error('Lỗi hệ thống: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(15, 23, 42, 0.4)' }}>
            <div className="w-full sm:max-w-3xl lg:max-w-4xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
                style={{ background: '#FFFFFF', borderLeft: '1px solid #E2E8F0' }}>
                
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold" style={{ background: 'rgba(135, 203, 185, 0.15)', color: '#0A1926', border: '1px solid rgba(135, 203, 185, 0.3)' }}>
                            <ArrowRightLeft size={20} style={{ color: '#0A1926' }} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold" style={{ color: '#0F172A' }}>
                                Lập Phiếu Chuyển Kho Nội Bộ
                            </h3>
                            <p className="text-xs" style={{ color: '#64748B' }}>
                                Tạo phiếu điều chuyển rượu giữa các kho & gửi Kế toán phê duyệt
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        style={{ color: '#64748B' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Warehouse Route Card */}
                    <div className="p-4 rounded-xl space-y-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#B47816' }}>
                            <Building2 size={15} style={{ color: '#B47816' }} /> Tuyến Đường Chuyển Kho
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Source WH */}
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wide block mb-1.5" style={{ color: '#475569' }}>
                                    🔴 Kho Xuất (Kho Đi) <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={fromWarehouseId}
                                    onChange={e => setFromWarehouseId(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-lg text-xs font-semibold outline-none transition-all cursor-pointer min-h-[40px]"
                                    style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
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
                                <label className="text-[11px] font-bold uppercase tracking-wide block mb-1.5" style={{ color: '#475569' }}>
                                    🟢 Kho Nhận (Kho Đến) <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={toWarehouseId}
                                    onChange={e => setToWarehouseId(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-lg text-xs font-semibold outline-none transition-all cursor-pointer min-h-[40px]"
                                    style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
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
                            <label className="text-[11px] font-bold uppercase tracking-wide block mb-1 flex items-center gap-1.5" style={{ color: '#475569' }}>
                                <Calendar size={14} style={{ color: '#64748B' }} /> Ngày Chuyển Dự Kiến
                            </label>
                            <input
                                type="date"
                                value={transferDate}
                                onChange={e => setTransferDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg font-mono font-semibold text-xs outline-none transition-all min-h-[40px]"
                                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wide block mb-1 flex items-center gap-1.5" style={{ color: '#475569' }}>
                                <FileText size={14} style={{ color: '#64748B' }} /> Lý Do Chuyển Kho
                            </label>
                            <select
                                value={reasonSelect}
                                onChange={e => setReasonSelect(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-xs font-semibold outline-none transition-all cursor-pointer min-h-[40px]"
                                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                            >
                                {TRANSFER_REASONS.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wide block mb-1" style={{ color: '#475569' }}>Ghi Chú Bổ Sung</label>
                        <input
                            type="text"
                            value={customNotes}
                            onChange={e => setCustomNotes(e.target.value)}
                            placeholder="Ví dụ: Chuyển 24 chai Chateau Margaux theo đề xuất SO-2608-0015..."
                            className="w-full px-3 py-2 rounded-lg text-xs outline-none transition-all min-h-[40px]"
                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                        />
                    </div>

                    {/* Line Items Section */}
                    <div className="space-y-3 pt-2 overflow-visible">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#0F172A' }}>
                                🍷 Danh Mục Rượu Chuyển ({lines.length} dòng)
                            </h4>
                            <button
                                type="button"
                                onClick={handleAddLine}
                                className="px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                style={{ background: '#87CBB9', color: '#0A1926' }}
                            >
                                <Plus size={15} /> Thêm Rượu
                            </button>
                        </div>

                        {lines.length === 0 ? (
                            <div className="p-8 border border-dashed rounded-xl flex flex-col items-center justify-center text-center"
                                style={{ background: '#F8FAFC', border: '1px border-dashed #CBD5E1' }}>
                                <AlertCircle size={32} className="mb-2" style={{ color: '#94A3B8' }} />
                                <p className="text-xs font-bold" style={{ color: '#0F172A' }}>Chưa có sản phẩm nào trong phiếu</p>
                                <p className="text-[11px] mt-0.5" style={{ color: '#64748B' }}>Nhấp "Thêm Rượu" ở trên để gõ tìm SKU & chọn số lượng</p>
                            </div>
                        ) : (
                            <>
                                {/* 📱 MOBILE VIEW (< sm) */}
                                <div className="space-y-3 sm:hidden overflow-visible">
                                    {lines.map((line, idx) => (
                                        <div key={idx} className="p-3.5 rounded-xl space-y-3 overflow-visible shadow-2xs"
                                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold uppercase" style={{ color: '#64748B' }}>Sản phẩm #{idx + 1}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveLine(idx)}
                                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <ProductCombobox
                                                products={products}
                                                selectedProductId={line.productId}
                                                onChange={id => handleLineProductChange(idx, id)}
                                            />

                                            <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid #F1F5F9' }}>
                                                <span className="text-xs font-bold" style={{ color: '#475569' }}>Số lượng (chai):</span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLineQtyChange(idx, line.qtyTransferred - 1)}
                                                        className="w-9 h-9 rounded-lg font-black text-sm flex items-center justify-center active:scale-95 cursor-pointer"
                                                        style={{ background: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1' }}
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={line.qtyTransferred}
                                                        onChange={e => handleLineQtyChange(idx, parseInt(e.target.value) || 1)}
                                                        className="w-16 h-9 rounded-lg text-center font-mono font-bold text-xs outline-none"
                                                        style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLineQtyChange(idx, line.qtyTransferred + 1)}
                                                        className="w-9 h-9 rounded-lg font-black text-sm flex items-center justify-center active:scale-95 cursor-pointer"
                                                        style={{ background: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1' }}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* 💻 DESKTOP VIEW (>= sm) */}
                                <div className="hidden sm:block rounded-xl overflow-visible shadow-2xs"
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                    <table className="w-full text-left text-xs border-collapse overflow-visible">
                                        <thead>
                                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                                                <th className="p-3 font-semibold uppercase text-[10px] w-12 text-center">STT</th>
                                                <th className="p-3 font-semibold uppercase text-[10px]">Gõ Tìm SKU / Tên Rượu Vang</th>
                                                <th className="p-3 font-semibold uppercase text-[10px] text-center w-36">Số Lượng (Chai)</th>
                                                <th className="p-3 font-semibold uppercase text-[10px] text-center w-12">#</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y overflow-visible" style={{ borderColor: '#F1F5F9' }}>
                                            {lines.map((line, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 overflow-visible">
                                                    <td className="p-3 text-center font-bold" style={{ color: '#64748B' }}>{idx + 1}</td>
                                                    <td className="p-3 overflow-visible">
                                                        <ProductCombobox
                                                            products={products}
                                                            selectedProductId={line.productId}
                                                            onChange={id => handleLineProductChange(idx, id)}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            value={line.qtyTransferred}
                                                            onChange={e => handleLineQtyChange(idx, parseInt(e.target.value) || 1)}
                                                            className="w-full px-2 py-2 rounded-lg text-center font-mono font-bold text-xs outline-none"
                                                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveLine(idx)}
                                                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer Bar (Matching CreateSODrawer button styling) */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#64748B' }}
                    >
                        Hủy Bỏ
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit(false)}
                            className="px-4 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#334155' }}
                        >
                            <Save size={15} /> Lưu Nháp
                        </button>

                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit(true)}
                            className="px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                            style={{ background: '#87CBB9', color: '#0A1926' }}
                        >
                            <Send size={15} /> Tạo & Gửi Duyệt
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
