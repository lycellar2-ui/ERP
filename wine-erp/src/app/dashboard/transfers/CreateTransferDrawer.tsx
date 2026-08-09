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
                    className="w-full pl-3 pr-8 py-2 rounded-xl bg-[#0F172A] border border-[#2A4355] font-bold text-xs text-[#E8F1F2] outline-none focus:border-[#87CBB9] transition-all min-h-[42px] touch-manipulation placeholder-[#4A6A7A]"
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
                        className="absolute right-2.5 p-1 text-[#4A6A7A] hover:text-[#E8F1F2] rounded-md cursor-pointer"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <ChevronDown size={14} className="absolute right-3 pointer-events-none text-[#4A6A7A]" />
                )}
            </div>

            {/* Dropdown Options Popup */}
            {isOpen && (
                <div className="absolute z-[300] left-0 top-full mt-1 bg-[#142433] border border-[#2A4355] rounded-xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-[#2A4355]/40 w-full sm:w-[480px]">
                    {filtered.length === 0 ? (
                        <div className="p-3.5 text-center text-xs text-[#8AAEBB]">
                            Không tìm thấy sản phẩm nào phù hợp với từ khóa "{search}"
                        </div>
                    ) : (
                        filtered.map(p => {
                            const isSelected = p.id === selectedProductId
                            return (
                                <div
                                    key={p.id}
                                    onMouseDown={(e) => {
                                        e.preventDefault() // Prevents blur race condition
                                        onChange(p.id)
                                        setSearch(`[${p.skuCode}] ${p.productName}`)
                                        setIsOpen(false)
                                    }}
                                    className={`p-3 cursor-pointer transition-colors flex items-center justify-between gap-2 ${isSelected ? 'bg-[#1B364A] text-[#87CBB9] font-extrabold' : 'hover:bg-[#1A2D3D] text-[#E8F1F2]'}`}
                                >
                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-black text-[#D4A853] text-xs px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                                {p.skuCode}
                                            </span>
                                            {p.vintage && (
                                                <span className="text-[10px] font-mono bg-teal-500/10 text-[#87CBB9] px-1.5 py-0.2 rounded font-bold border border-teal-500/20">
                                                    {p.vintage}
                                                </span>
                                            )}
                                            {p.country && (
                                                <span className="text-[10px] text-[#8AAEBB] font-medium">
                                                    • {p.country}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs font-bold text-[#E8F1F2] truncate mt-0.5">{p.productName}</p>
                                    </div>
                                    {isSelected && <Check size={16} className="text-[#87CBB9] shrink-0 ml-2" />}
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
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10,25,38,0.8)' }}>
            <div className="w-full sm:max-w-3xl lg:max-w-4xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
                style={{ background: '#1B2E3D', borderLeft: '1px solid #2A4355' }}>
                
                {/* Drawer Header (Standardized ERP Dark Luxury Tone) */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-[#D4A853] border border-amber-500/20 flex items-center justify-center font-bold">
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-[#E8F1F2] flex items-center gap-2">
                                Lập Phiếu Chuyển Kho Nội Bộ
                            </h3>
                            <p className="text-xs text-[#8AAEBB]">
                                Tạo phiếu điều chuyển rượu giữa các kho & gửi Kế toán phê duyệt
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-[#4A6A7A] hover:text-[#E8F1F2] transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Warehouse Route Card */}
                    <div className="p-4 rounded-xl bg-[#142433] border border-[#2A4355] space-y-3">
                        <h4 className="text-xs font-bold text-[#D4A853] uppercase tracking-wider flex items-center gap-2">
                            <Building2 size={15} className="text-[#D4A853]" /> Tuyến Đường Chuyển Kho
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Source WH */}
                            <div>
                                <label className="text-[11px] font-bold text-[#4A6A7A] uppercase tracking-wide block mb-1.5">
                                    🔴 Kho Xuất (Kho Đi) <span className="text-rose-400">*</span>
                                </label>
                                <select
                                    value={fromWarehouseId}
                                    onChange={e => setFromWarehouseId(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl bg-[#0F172A] border border-[#2A4355] font-bold text-xs text-[#E8F1F2] outline-none focus:border-[#87CBB9] cursor-pointer min-h-[42px] touch-manipulation"
                                >
                                    <option value="" style={{ background: '#0F172A', color: '#E8F1F2' }}>-- Chọn Kho Xuất --</option>
                                    {warehouses.map(w => (
                                        <option key={`from-${w.id}`} value={w.id} style={{ background: '#0F172A', color: '#E8F1F2' }}>
                                            [{w.code}] {w.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Destination WH */}
                            <div>
                                <label className="text-[11px] font-bold text-[#4A6A7A] uppercase tracking-wide block mb-1.5">
                                    🟢 Kho Nhận (Kho Đến) <span className="text-rose-400">*</span>
                                </label>
                                <select
                                    value={toWarehouseId}
                                    onChange={e => setToWarehouseId(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl bg-[#0F172A] border border-[#2A4355] font-bold text-xs text-[#E8F1F2] outline-none focus:border-[#87CBB9] cursor-pointer min-h-[42px] touch-manipulation"
                                >
                                    <option value="" style={{ background: '#0F172A', color: '#E8F1F2' }}>-- Chọn Kho Nhận --</option>
                                    {warehouses.map(w => (
                                        <option key={`to-${w.id}`} value={w.id} disabled={w.id === fromWarehouseId} style={{ background: '#0F172A', color: w.id === fromWarehouseId ? '#4A6A7A' : '#E8F1F2' }}>
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
                            <label className="text-[11px] font-bold text-[#4A6A7A] uppercase tracking-wide block mb-1 flex items-center gap-1.5">
                                <Calendar size={14} className="text-[#4A6A7A]" /> Ngày Chuyển Dự Kiến
                            </label>
                            <input
                                type="date"
                                value={transferDate}
                                onChange={e => setTransferDate(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl bg-[#0F172A] border border-[#2A4355] font-mono font-bold text-xs text-[#E8F1F2] outline-none focus:border-[#87CBB9] min-h-[42px]"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-[#4A6A7A] uppercase tracking-wide block mb-1 flex items-center gap-1.5">
                                <FileText size={14} className="text-[#4A6A7A]" /> Lý Do Chuyển Kho
                            </label>
                            <select
                                value={reasonSelect}
                                onChange={e => setReasonSelect(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl bg-[#0F172A] border border-[#2A4355] font-bold text-xs text-[#E8F1F2] outline-none focus:border-[#87CBB9] cursor-pointer min-h-[42px] touch-manipulation"
                            >
                                {TRANSFER_REASONS.map(r => (
                                    <option key={r} value={r} style={{ background: '#0F172A', color: '#E8F1F2' }}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-[#4A6A7A] uppercase tracking-wide block mb-1">Ghi Chú Bổ Sung</label>
                        <input
                            type="text"
                            value={customNotes}
                            onChange={e => setCustomNotes(e.target.value)}
                            placeholder="Ví dụ: Chuyển 24 chai Chateau Margaux theo đề xuất SO-2608-0015..."
                            className="w-full px-3 py-2.5 rounded-xl bg-[#0F172A] border border-[#2A4355] text-xs text-[#E8F1F2] outline-none focus:border-[#87CBB9] placeholder-[#4A6A7A] min-h-[42px]"
                        />
                    </div>

                    {/* Line Items Container */}
                    <div className="space-y-3 pt-2 overflow-visible">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-[#E8F1F2] uppercase tracking-wider flex items-center gap-2">
                                🍷 Danh Mục Rượu Chuyển ({lines.length} dòng)
                            </h4>
                            <button
                                type="button"
                                onClick={handleAddLine}
                                className="px-3.5 py-2 rounded-xl bg-[#87CBB9] text-[#0A1926] font-bold text-xs hover:bg-[#A5DED0] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 touch-manipulation"
                            >
                                <Plus size={15} /> Thêm Rượu
                            </button>
                        </div>

                        {lines.length === 0 ? (
                            <div className="p-8 border border-dashed border-[#2A4355] rounded-xl flex flex-col items-center justify-center text-center bg-[#142433]">
                                <AlertCircle size={32} className="mb-2 text-[#4A6A7A]" />
                                <p className="text-xs font-bold text-[#E8F1F2]">Chưa có sản phẩm nào trong phiếu</p>
                                <p className="text-[11px] text-[#8AAEBB] mt-0.5">Nhấp "Thêm Rượu" ở trên để gõ tìm SKU & chọn số lượng</p>
                            </div>
                        ) : (
                            <>
                                {/* 📱 MOBILE VIEW (< sm) */}
                                <div className="space-y-3 sm:hidden overflow-visible">
                                    {lines.map((line, idx) => (
                                        <div key={idx} className="p-3.5 rounded-xl bg-[#142433] border border-[#2A4355] space-y-3 overflow-visible">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-[#8AAEBB] uppercase">Sản phẩm #{idx + 1}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveLine(idx)}
                                                    className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {/* Searchable Combobox */}
                                            <ProductCombobox
                                                products={products}
                                                selectedProductId={line.productId}
                                                onChange={id => handleLineProductChange(idx, id)}
                                            />

                                            {/* Stepper Quantity Controls */}
                                            <div className="flex items-center justify-between pt-1 border-t border-[#2A4355]">
                                                <span className="text-xs font-bold text-[#8AAEBB]">Số lượng (chai):</span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLineQtyChange(idx, line.qtyTransferred - 1)}
                                                        className="w-9 h-9 rounded-xl bg-[#1A2D3D] text-[#E8F1F2] border border-[#2A4355] font-black text-sm flex items-center justify-center active:scale-95 cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={line.qtyTransferred}
                                                        onChange={e => handleLineQtyChange(idx, parseInt(e.target.value) || 1)}
                                                        className="w-16 h-9 rounded-xl bg-[#0F172A] border border-[#2A4355] text-center font-mono font-bold text-xs text-[#E8F1F2] outline-none focus:border-[#87CBB9]"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLineQtyChange(idx, line.qtyTransferred + 1)}
                                                        className="w-9 h-9 rounded-xl bg-[#1A2D3D] text-[#E8F1F2] border border-[#2A4355] font-black text-sm flex items-center justify-center active:scale-95 cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* 💻 DESKTOP VIEW (>= sm) */}
                                <div className="hidden sm:block border border-[#2A4355] rounded-xl bg-[#142433] overflow-visible">
                                    <table className="w-full text-left text-xs border-collapse overflow-visible">
                                        <thead>
                                            <tr className="bg-[#0F172A] border-b border-[#2A4355] text-[#4A6A7A]">
                                                <th className="p-3 font-bold uppercase text-[11px] w-12 text-center">STT</th>
                                                <th className="p-3 font-bold uppercase text-[11px]">Gõ Tìm SKU / Tên Rượu Vang</th>
                                                <th className="p-3 font-bold uppercase text-[11px] text-center w-36">Số Lượng (Chai)</th>
                                                <th className="p-3 font-bold uppercase text-[11px] text-center w-12">#</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#2A4355]/50 bg-[#142433] overflow-visible">
                                            {lines.map((line, idx) => (
                                                <tr key={idx} className="hover:bg-[#1A2D3D] overflow-visible">
                                                    <td className="p-3 text-center font-bold text-[#8AAEBB]">{idx + 1}</td>
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
                                                            className="w-full px-2 py-2 rounded-xl bg-[#0F172A] border border-[#2A4355] text-center font-mono font-bold text-xs text-[#E8F1F2] outline-none focus:border-[#87CBB9]"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveLine(idx)}
                                                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
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

                {/* Drawer Footer */}
                <div className="px-6 py-4 border-t border-[#2A4355] bg-[#142433] flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-lg text-xs font-bold border border-[#2A4355] text-[#8AAEBB] hover:bg-white/5 transition-colors cursor-pointer"
                    >
                        Hủy Bỏ
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit(false)}
                            className="px-4 py-2.5 rounded-lg text-xs font-bold border border-[#2A4355] bg-white/5 text-[#E8F1F2] hover:bg-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <Save size={15} /> Lưu Nháp
                        </button>

                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit(true)}
                            className="px-5 py-2.5 rounded-lg text-xs font-extrabold bg-[#D4A853] text-[#0A1926] hover:bg-[#E5B964] transition-colors flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                        >
                            <Send size={15} /> Tạo & Gửi Duyệt
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
