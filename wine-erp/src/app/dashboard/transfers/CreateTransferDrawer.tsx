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

const inputStyle = {
    background: '#142433',
    border: '1px solid #2A4355',
    color: '#E8F1F2',
    borderRadius: '4px',
    outline: 'none',
}

const focusHandler = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => (e.currentTarget.style.borderColor = '#87CBB9'),
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => (e.currentTarget.style.borderColor = '#2A4355'),
}

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
                    {...focusHandler}
                    placeholder="Gõ SKU hoặc tên sản phẩm..."
                    className="w-full pl-3 pr-8 py-1.5 text-xs outline-none rounded"
                    style={{ ...inputStyle }}
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
                        className="absolute right-2.5 p-1 text-[#4A6A7A] hover:text-[#88CBB9] rounded cursor-pointer"
                    >
                        <X size={13} />
                    </button>
                ) : (
                    <ChevronDown size={13} className="absolute right-2.5 pointer-events-none text-[#4A6A7A]" />
                )}
            </div>

            {/* Dropdown Options Popup */}
            {isOpen && (
                <div className="absolute z-[300] left-0 top-full mt-1 bg-[#142433] border border-[#2A4355] rounded-md shadow-2xl max-h-64 overflow-y-auto divide-y divide-[#2A4355]/40 w-full sm:w-[480px]">
                    {filtered.length === 0 ? (
                        <div className="p-3 text-center text-xs text-[#4A6A7A]">
                            Không tìm thấy sản phẩm nào phù hợp
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
                                    className={`p-2.5 cursor-pointer transition-colors flex items-center justify-between gap-2 ${isSelected ? 'bg-[#1B2E3D] text-[#87CBB9] font-bold' : 'hover:bg-[#1B2E3D]/60 text-[#E8F1F2]'}`}
                                >
                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded"
                                                style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)' }}>
                                                {p.skuCode}
                                            </span>
                                            {p.vintage && (
                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold"
                                                    style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                                    {p.vintage}
                                                </span>
                                            )}
                                            {p.country && (
                                                <span className="text-[10px] text-[#8AAEBB]">
                                                    • {p.country}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs font-semibold text-[#E8F1F2] truncate mt-0.5">{p.productName}</p>
                                    </div>
                                    {isSelected && <Check size={15} className="text-[#87CBB9] shrink-0 ml-2" />}
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
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10, 25, 38, 0.75)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full sm:max-w-3xl lg:max-w-4xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
                style={{ background: '#0A1926', borderLeft: '1px solid #2A4355' }}>
                
                {/* Header (Matching CreateSODrawer) */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold"
                            style={{ background: 'rgba(135, 203, 185, 0.15)', color: '#87CBB9', border: '1px solid rgba(135, 203, 185, 0.3)' }}>
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold" style={{ color: '#E8F1F2' }}>
                                Lập Phiếu Chuyển Kho Nội Bộ
                            </h3>
                            <p className="text-xs" style={{ color: '#8AAEBB' }}>
                                Tạo phiếu điều chuyển rượu giữa các kho & gửi Kế toán phê duyệt
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-[#1B2E3D] transition-colors cursor-pointer"
                        style={{ color: '#8AAEBB' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Warehouse Route Card */}
                    <div className="p-4 rounded-lg space-y-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#D4A853' }}>
                            <Building2 size={15} style={{ color: '#D4A853' }} /> Tuyến Đường Chuyển Kho
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Source WH */}
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>
                                    🔴 Kho Xuất (Kho Đi) *
                                </label>
                                <select
                                    value={fromWarehouseId}
                                    onChange={e => setFromWarehouseId(e.target.value)}
                                    {...focusHandler}
                                    className="w-full px-3 py-2 text-xs font-semibold outline-none rounded cursor-pointer"
                                    style={{ ...inputStyle }}
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
                                <label className="text-[11px] font-bold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>
                                    🟢 Kho Nhận (Kho Đến) *
                                </label>
                                <select
                                    value={toWarehouseId}
                                    onChange={e => setToWarehouseId(e.target.value)}
                                    {...focusHandler}
                                    className="w-full px-3 py-2 text-xs font-semibold outline-none rounded cursor-pointer"
                                    style={{ ...inputStyle }}
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
                            <label className="text-[11px] font-bold uppercase tracking-wide block mb-1 flex items-center gap-1.5" style={{ color: '#4A6A7A' }}>
                                <Calendar size={13} style={{ color: '#4A6A7A' }} /> Ngày Chuyển Dự Kiến
                            </label>
                            <input
                                type="date"
                                value={transferDate}
                                onChange={e => setTransferDate(e.target.value)}
                                {...focusHandler}
                                className="w-full px-3 py-2 font-mono font-semibold text-xs outline-none rounded"
                                style={{ ...inputStyle }}
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wide block mb-1 flex items-center gap-1.5" style={{ color: '#4A6A7A' }}>
                                <FileText size={13} style={{ color: '#4A6A7A' }} /> Lý Do Chuyển Kho
                            </label>
                            <select
                                value={reasonSelect}
                                onChange={e => setReasonSelect(e.target.value)}
                                {...focusHandler}
                                className="w-full px-3 py-2 text-xs font-semibold outline-none rounded cursor-pointer"
                                style={{ ...inputStyle }}
                            >
                                {TRANSFER_REASONS.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>
                            Ghi Chú Bổ Sung
                        </label>
                        <input
                            type="text"
                            value={customNotes}
                            onChange={e => setCustomNotes(e.target.value)}
                            {...focusHandler}
                            placeholder="Ví dụ: Chuyển 24 chai Chateau Margaux theo đề xuất SO-2608-0015..."
                            className="w-full px-3 py-2 text-xs outline-none rounded"
                            style={{ ...inputStyle }}
                        />
                    </div>

                    {/* Line Items Section */}
                    <div className="space-y-3 pt-2 overflow-visible">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>
                                🍷 Danh Mục Rượu Chuyển ({lines.length} dòng)
                            </label>
                            <button
                                type="button"
                                onClick={handleAddLine}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer"
                                style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)', borderRadius: '4px' }}
                            >
                                <Plus size={13} /> Thêm Rượu
                            </button>
                        </div>

                        {lines.length === 0 ? (
                            <div className="py-8 text-center rounded-md" style={{ border: '1px dashed #2A4355', background: '#142433' }}>
                                <p className="text-sm font-semibold" style={{ color: '#4A6A7A' }}>Chưa có sản phẩm — Click "+ Thêm Rượu"</p>
                            </div>
                        ) : (
                            <>
                                {/* 💻 DESKTOP VIEW (>= sm) - Matching SODrawer Table */}
                                <div className="hidden sm:block overflow-x-auto border border-[#2A4355] rounded-md bg-[#142433] max-w-full overflow-visible">
                                    <table className="w-full text-xs text-left border-collapse overflow-visible">
                                        <thead>
                                            <tr className="bg-[#1B2E3D] text-[#4A6A7A] border-b border-[#2A4355] font-semibold">
                                                <th className="px-3 py-2.5 w-12 text-center">STT</th>
                                                <th className="px-3 py-2.5">Gõ Tìm SKU / Tên Rượu Vang</th>
                                                <th className="px-3 py-2.5 text-center w-36">Số Lượng (Chai)</th>
                                                <th className="px-3 py-2.5 text-center w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#2A4355]/40 overflow-visible">
                                            {lines.map((line, idx) => (
                                                <tr key={idx} className="hover:bg-[#1B2E3D]/30 transition-colors overflow-visible">
                                                    <td className="px-3 py-2 text-center font-bold" style={{ color: '#8AAEBB' }}>{idx + 1}</td>
                                                    <td className="px-3 py-2 overflow-visible">
                                                        <ProductCombobox
                                                            products={products}
                                                            selectedProductId={line.productId}
                                                            onChange={id => handleLineProductChange(idx, id)}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            value={line.qtyTransferred}
                                                            onChange={e => handleLineQtyChange(idx, parseInt(e.target.value) || 1)}
                                                            {...focusHandler}
                                                            className="w-full px-2 py-1.5 rounded text-center font-mono font-bold text-xs outline-none"
                                                            style={{ ...inputStyle }}
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveLine(idx)}
                                                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded transition-colors cursor-pointer"
                                                        >
                                                            <Trash2 size={15} />
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

                {/* Footer Bar (Matching CreateSODrawer Footer) */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ background: '#142433', borderTop: '1px solid #2A4355' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold rounded transition-all cursor-pointer"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB' }}
                    >
                        Hủy Bỏ
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit(false)}
                            className="px-4 py-2 rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#87CBB9' }}
                        >
                            <Save size={14} /> Lưu Nháp
                        </button>

                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit(true)}
                            className="px-5 py-2 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow"
                            style={{ background: '#87CBB9', color: '#0A1926' }}
                        >
                            <Send size={14} /> Tạo & Gửi Duyệt
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
