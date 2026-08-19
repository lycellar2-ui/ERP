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
type ProductOpt = { id: string; skuCode: string; productName: string; country?: string | null; vintage?: number | null; vintages?: number[] }

interface TransferLineItem {
    productId: string
    vintage?: number | null
    qtyTransferred: number
    qtyAvailable: number
}

const TRANSFER_REASONS = [
    'Điều hàng',
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
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedProduct = products.find(p => p.id === selectedProductId)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filtered = query.trim() === ''
        ? products.slice(0, 40)
        : products.filter(p =>
            p.skuCode.toLowerCase().includes(query.toLowerCase()) ||
            p.productName.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 40)

    return (
        <div ref={containerRef} className="relative w-full overflow-visible">
            <div
                onClick={() => setOpen(prev => !prev)}
                className="w-full px-2.5 py-1.5 rounded flex items-center justify-between text-xs cursor-pointer border transition-colors"
                style={{
                    background: '#142433',
                    borderColor: open ? '#87CBB9' : '#2A4355',
                    color: selectedProduct ? '#E8F1F2' : '#8AAEBB',
                }}
            >
                <span className="truncate font-semibold">
                    {selectedProduct
                        ? `[${selectedProduct.skuCode}] ${selectedProduct.productName}`
                        : '— Gõ tìm SKU / Tên Rượu Vang —'}
                </span>
                <ChevronDown size={14} className="ml-1 shrink-0 text-[#8AAEBB]" />
            </div>

            {open && (
                <div
                    className="absolute left-0 top-full mt-1 w-full max-h-60 overflow-y-auto rounded shadow-2xl z-[9999] border divide-y divide-[#2A4355]/40"
                    style={{ background: '#1B2E3D', borderColor: '#87CBB9' }}
                >
                    <div className="p-1.5 sticky top-0 bg-[#1B2E3D] z-10 border-b border-[#2A4355]">
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Nhập mã SKU (e.g. L40006) hoặc tên rượu..."
                            className="w-full px-2.5 py-1 text-xs outline-none rounded font-medium"
                            style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            autoFocus
                        />
                    </div>

                    {filtered.length === 0 ? (
                        <div className="p-3 text-center text-xs text-[#8AAEBB]">Không tìm thấy rượu phù hợp</div>
                    ) : (
                        filtered.map(p => {
                            const isSelected = p.id === selectedProductId
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => {
                                        onChange(p.id)
                                        setOpen(false)
                                        setQuery('')
                                    }}
                                    className={`p-2 text-xs cursor-pointer transition-colors flex items-center justify-between ${isSelected ? 'bg-[#87CBB9]/20 text-[#87CBB9]' : 'hover:bg-[#142433] text-[#E8F1F2]'}`}
                                >
                                    <div>
                                        <span className="font-mono font-bold text-[#D4A853] mr-1 text-[11px]">[{p.skuCode}]</span>
                                        <span className="font-semibold">{p.productName}</span>
                                    </div>
                                    {p.vintages && p.vintages.length > 0 && (
                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#142433] text-[#87CBB9]">
                                            {p.vintages.join(', ')}
                                        </span>
                                    )}
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
        setLines(prev => [...prev, { productId: '', vintage: null, qtyTransferred: 1, qtyAvailable: 0 }])
    }

    const handleRemoveLine = (idx: number) => {
        setLines(prev => prev.filter((_, i) => i !== idx))
    }

    const handleLineProductChange = (idx: number, productId: string) => {
        const prod = products.find(p => p.id === productId)
        const defaultVintage = prod?.vintages?.[0] ?? prod?.vintage ?? null
        setLines(prev => prev.map((l, i) => i === idx ? { ...l, productId, vintage: defaultVintage } : l))
    }

    const handleLineVintageChange = (idx: number, vintage: number | null) => {
        setLines(prev => prev.map((l, i) => i === idx ? { ...l, vintage } : l))
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
                lines: validLines.map(l => ({ productId: l.productId, qtyTransferred: l.qtyTransferred, vintage: l.vintage })),
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
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div className="w-full sm:max-w-3xl lg:max-w-4xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 bg-white dark:bg-[#111C24] border-l border-slate-200 dark:border-[#223645]">
                
                {/* Header (Matching CreateSODrawer) */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-200 dark:border-[#223645] bg-slate-50/50 dark:bg-[#16232F]/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                            <ArrowRightLeft size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Lập Phiếu Chuyển Kho Nội Bộ
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Tạo phiếu điều chuyển rượu giữa các kho & gửi Kế toán phê duyệt
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
                                                <th className="px-3 py-2.5 text-center w-28">VTG (Niên Vụ)</th>
                                                <th className="px-3 py-2.5 text-center w-32">Số Lượng (Chai)</th>
                                                <th className="px-3 py-2.5 text-center w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#2A4355]/40 overflow-visible">
                                            {lines.map((line, idx) => {
                                                const p = products.find(prod => prod.id === line.productId)
                                                const availableVintages = p?.vintages || []
                                                return (
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
                                                            <select
                                                                value={line.vintage ?? ''}
                                                                onChange={e => handleLineVintageChange(idx, e.target.value ? parseInt(e.target.value) : null)}
                                                                {...focusHandler}
                                                                className="w-full px-2 py-1.5 rounded text-center font-mono font-bold text-xs outline-none cursor-pointer"
                                                                style={{ ...inputStyle }}
                                                            >
                                                                <option value="">NV (K.Năm)</option>
                                                                {availableVintages.map(v => (
                                                                    <option key={v} value={v}>{v}</option>
                                                                ))}
                                                                {line.vintage && !availableVintages.includes(line.vintage) && (
                                                                    <option value={line.vintage}>{line.vintage}</option>
                                                                )}
                                                            </select>
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
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer Bar */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0 border-t border-slate-200 dark:border-[#223645] bg-slate-50/50 dark:bg-[#16232F]/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#2A4355] bg-white dark:bg-[#16232F] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        Hủy Bỏ
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit(false)}
                            className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-[#2A4355] bg-white dark:bg-[#16232F] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <Save size={14} className="text-amber-500" /> Lưu Nháp
                        </button>

                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit(true)}
                            className="px-5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                            <Send size={14} /> Tạo & Gửi Duyệt
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
