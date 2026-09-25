'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Save, Send, Plus, Trash2, ArrowRightLeft, AlertCircle, Building2, Calendar, FileText, Check, ChevronDown, Search } from 'lucide-react'
import { toast } from 'sonner'
import { createTransferOrder, getTransferOptions } from './actions'

export interface TransferInitialData {
    fromWarehouseId?: string
    toWarehouseId?: string
    reason?: string
    lines?: {
        productId: string
        qtyTransferred: number
        vintage?: number | null
        qtyAvailable?: number
    }[]
}

interface CreateTransferDrawerProps {
    open: boolean
    onClose: () => void
    onSuccess: () => void
    initialData?: TransferInitialData | null
}

type WarehouseOpt = { id: string; code: string; name: string }
type ProductOpt = {
    id: string
    skuCode: string
    productName: string
    country?: string | null
    vintage?: number | null
    vintages?: number[]
    stocksByWH?: Record<string, {
        totalAvailable: number
        vintages: {
            vintage: number | null
            qtyAvailable: number
        }[]
    }>
}

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
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    color: '#0F172A',
    borderRadius: '4px',
    outline: 'none',
}

const focusHandler = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => (e.currentTarget.style.borderColor = '#0891B2'),
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => (e.currentTarget.style.borderColor = '#E2E8F0'),
}

// ── Searchable Product Combobox Component ──────────
function ProductCombobox({
    products,
    selectedProductId,
    fromWarehouseId,
    onChange,
}: {
    products: ProductOpt[]
    selectedProductId: string
    fromWarehouseId?: string
    onChange: (productId: string) => void
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedProduct = products.find(p => p.id === selectedProductId)

    useEffect(() => {
        if (selectedProduct && !open) {
            setQuery(`[${selectedProduct.skuCode}] ${selectedProduct.productName}`)
        } else if (!selectedProduct && !open) {
            setQuery('')
        }
    }, [selectedProduct, open])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
                if (selectedProduct) {
                    setQuery(`[${selectedProduct.skuCode}] ${selectedProduct.productName}`)
                } else {
                    setQuery('')
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [selectedProduct])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        let list = products
        if (q && (!selectedProduct || query !== `[${selectedProduct.skuCode}] ${selectedProduct.productName}`)) {
            list = products.filter(p =>
                p.skuCode.toLowerCase().includes(q) ||
                p.productName.toLowerCase().includes(q)
            )
        }
        if (fromWarehouseId) {
            return [...list].sort((a, b) => {
                const stockA = a.stocksByWH?.[fromWarehouseId]?.totalAvailable || 0
                const stockB = b.stocksByWH?.[fromWarehouseId]?.totalAvailable || 0
                if (stockA > 0 && stockB === 0) return -1
                if (stockA === 0 && stockB > 0) return 1
                return 0
            }).slice(0, 50)
        }
        return list.slice(0, 50)
    }, [products, query, selectedProduct, fromWarehouseId])

    return (
        <div className="relative flex-1 min-w-[280px]" ref={containerRef}>
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    placeholder="-- Gõ SKU hoặc tên rượu vang để chọn --"
                    onFocus={e => {
                        setOpen(true)
                        e.target.select()
                    }}
                    onChange={e => {
                        setQuery(e.target.value)
                        setOpen(true)
                    }}
                    className="w-full px-2.5 py-1.5 pr-8 text-xs rounded outline-none font-medium transition-colors"
                    style={{
                        ...inputStyle,
                        borderColor: open ? '#87CBB9' : '#E2E8F0',
                    }}
                />
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            </div>

            {open && (
                <div
                    className="absolute left-0 top-full mt-1 w-full min-w-[420px] max-h-72 overflow-y-auto rounded shadow-2xl z-[9999] border divide-y divide-slate-200/40"
                    style={{ background: '#FFFFFF', borderColor: '#0891B2' }}
                >
                    {filtered.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-600">Không tìm thấy rượu phù hợp</div>
                    ) : (
                        filtered.map(p => {
                            const isSelected = p.id === selectedProductId
                            const whStock = fromWarehouseId && p.stocksByWH ? p.stocksByWH[fromWarehouseId] : null
                            const whTotal = whStock ? whStock.totalAvailable : 0
                            return (
                                <div
                                    key={p.id}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        onChange(p.id)
                                        setOpen(false)
                                        setQuery(`[${p.skuCode}] ${p.productName}`)
                                    }}
                                    className={`p-2.5 text-xs cursor-pointer transition-colors flex items-center justify-between gap-3 ${isSelected ? 'bg-[#87CBB9]/20 text-[#0891B2]' : 'hover:bg-white text-slate-900'}`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-medium">
                                            <span className="font-mono font-bold text-[#D4A853] mr-1 text-[11px]">[{p.skuCode}]</span>
                                            <span>{p.productName}</span>
                                        </div>
                                        {fromWarehouseId && whStock && whStock.vintages.length > 0 ? (
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                                                {whStock.vintages.map(v => (
                                                    <span
                                                        key={String(v.vintage)}
                                                        className={`px-1.5 py-0.5 rounded font-mono font-bold ${v.qtyAvailable > 0 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50' : 'bg-slate-800 text-slate-500'}`}
                                                    >
                                                        {v.vintage ? `NV ${v.vintage}` : 'NV (K.Năm)'}: {v.qtyAvailable} chai
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            p.vintages && p.vintages.length > 0 && (
                                                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400">
                                                    <span>Niên vụ: {p.vintages.join(', ')}</span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                    <div className="shrink-0 text-right">
                                        {fromWarehouseId ? (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${whTotal > 0 ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40' : 'bg-red-950/40 text-red-400 border-red-900/40'}`}>
                                                Tồn kho xuất: {whTotal}c
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400">
                                                {p.country || ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
}

export function CreateTransferDrawer({ open, onClose, onSuccess, initialData }: CreateTransferDrawerProps) {
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

                if (initialData?.fromWarehouseId) {
                    setFromWarehouseId(initialData.fromWarehouseId)
                } else if (res.warehouses.length >= 2) {
                    setFromWarehouseId(res.warehouses[0].id)
                }

                if (initialData?.toWarehouseId) {
                    setToWarehouseId(initialData.toWarehouseId)
                } else if (res.warehouses.length >= 2) {
                    setToWarehouseId(res.warehouses[1].id)
                }

                if (initialData?.reason) {
                    setReasonSelect(initialData.reason)
                }

                if (initialData?.lines && initialData.lines.length > 0) {
                    setLines(initialData.lines.map(l => ({
                        productId: l.productId,
                        vintage: l.vintage ?? null,
                        qtyTransferred: l.qtyTransferred,
                        qtyAvailable: l.qtyAvailable ?? 0,
                    })))
                } else {
                    setLines([{ productId: '', vintage: null, qtyTransferred: 1, qtyAvailable: 0 }])
                }
            } catch (err: any) {
                toast.error('Lỗi tải danh mục kho & sản phẩm: ' + err.message)
            } finally {
                setLoadingOpts(false)
            }
        }
        load()
    }, [open, initialData])

    if (!open) return null

    const handleAddLine = () => {
        setLines(prev => [...prev, { productId: '', vintage: null, qtyTransferred: 1, qtyAvailable: 0 }])
    }

    const handleRemoveLine = (idx: number) => {
        setLines(prev => prev.filter((_, i) => i !== idx))
    }

    const handleLineProductChange = (idx: number, productId: string) => {
        const prod = products.find(p => p.id === productId)
        let bestVintage: number | null = null
        if (fromWarehouseId && prod?.stocksByWH?.[fromWarehouseId]?.vintages?.length) {
            const withStock = prod.stocksByWH[fromWarehouseId].vintages.filter(v => v.qtyAvailable > 0 && v.vintage !== null)
            if (withStock.length > 0) {
                bestVintage = withStock[0].vintage
            } else {
                const nonV = prod.stocksByWH[fromWarehouseId].vintages.find(v => v.vintage === null && v.qtyAvailable > 0)
                if (nonV) {
                    bestVintage = null
                } else if (prod.stocksByWH[fromWarehouseId].vintages[0]?.vintage !== undefined) {
                    bestVintage = prod.stocksByWH[fromWarehouseId].vintages[0].vintage
                }
            }
        }
        if (bestVintage === null && prod?.vintages && prod.vintages.length > 0) {
            bestVintage = prod.vintages[0]
        }
        setLines(prev => prev.map((l, i) => i === idx ? { ...l, productId, vintage: bestVintage } : l))
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

        // Validate stock by vintage client-side
        const zeroStockLine = validLines.find(l => {
            const p = products.find(prod => prod.id === l.productId)
            const whStock = fromWarehouseId && p?.stocksByWH ? p.stocksByWH[fromWarehouseId] : null
            if (!whStock) return true
            const match = whStock.vintages.find(v => v.vintage === l.vintage)
            return !match || match.qtyAvailable <= 0
        })
        if (zeroStockLine) {
            const prod = products.find(p => p.id === zeroStockLine.productId)
            const vText = zeroStockLine.vintage ? ` (Niên vụ ${zeroStockLine.vintage})` : ''
            toast.error(`Sản phẩm [${prod?.skuCode}] ${prod?.productName}${vText} có tồn kho = 0 chai tại Kho xuất! Vui lòng chọn niên vụ có tồn hoặc điều chỉnh lại.`)
            return
        }

        const overStockLine = validLines.find(l => {
            const p = products.find(prod => prod.id === l.productId)
            const whStock = fromWarehouseId && p?.stocksByWH ? p.stocksByWH[fromWarehouseId] : null
            if (!whStock) return false
            const match = whStock.vintages.find(v => v.vintage === l.vintage)
            const avail = match ? match.qtyAvailable : 0
            return l.qtyTransferred > avail
        })
        if (overStockLine) {
            const prod = products.find(p => p.id === overStockLine.productId)
            const vText = overStockLine.vintage ? ` (Niên vụ ${overStockLine.vintage})` : ''
            const p = products.find(prod => prod.id === overStockLine.productId)
            const whStock = fromWarehouseId && p?.stocksByWH ? p.stocksByWH[fromWarehouseId] : null
            const match = whStock?.vintages.find(v => v.vintage === overStockLine.vintage)
            const avail = match ? match.qtyAvailable : 0
            toast.error(`Sản phẩm [${prod?.skuCode}] ${prod?.productName}${vText} chỉ còn ${avail} chai tại Kho xuất (Yêu cầu chuyển ${overStockLine.qtyTransferred} chai).`)
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
            <div className="w-full sm:max-w-3xl lg:max-w-4xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 bg-white dark:bg-slate-50 border-l border-slate-200 dark:border-slate-200">
                
                {/* Header (Matching CreateSODrawer) */}
                <div className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-200 dark:border-slate-200 bg-slate-50/50 dark:bg-white/50">
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
                    <div className="p-4 rounded-lg space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#D4A853' }}>
                            <Building2 size={15} style={{ color: '#D4A853' }} /> Tuyến Đường Chuyển Kho
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Source WH */}
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>
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
                                <label className="text-[11px] font-bold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>
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
                            <label className="text-[11px] font-bold uppercase tracking-wide block mb-1 flex items-center gap-1.5" style={{ color: '#64748B' }}>
                                <Calendar size={13} style={{ color: '#64748B' }} /> Ngày Chuyển Dự Kiến
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
                            <label className="text-[11px] font-bold uppercase tracking-wide block mb-1 flex items-center gap-1.5" style={{ color: '#64748B' }}>
                                <FileText size={13} style={{ color: '#64748B' }} /> Lý Do Chuyển Kho
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
                        <label className="text-[11px] font-bold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>
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
                    <div className="space-y-3 pt-2 pb-28">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                🍷 Danh Mục Rượu Chuyển ({lines.length} dòng)
                            </label>
                            <button
                                type="button"
                                onClick={handleAddLine}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer"
                                style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.25)', borderRadius: '4px' }}
                            >
                                <Plus size={13} /> Thêm Rượu
                            </button>
                        </div>

                        {lines.length === 0 ? (
                            <div className="py-8 text-center rounded-md" style={{ border: '1px dashed #E2E8F0', background: '#FFFFFF' }}>
                                <p className="text-sm font-semibold" style={{ color: '#64748B' }}>Chưa có sản phẩm — Click "+ Thêm Rượu"</p>
                            </div>
                        ) : (
                            <>
                                {/* 💻 DESKTOP VIEW (>= sm) - Matching SODrawer Table */}
                                <div
                                    className="hidden sm:block overflow-x-auto border border-slate-200 rounded-md bg-white max-w-full"
                                    style={{ minHeight: lines.length > 0 ? '360px' : 'auto' }}
                                >
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white text-slate-500 border-b border-slate-200 font-semibold">
                                                <th className="px-3 py-2.5 w-12 text-center">STT</th>
                                                <th className="px-3 py-2.5">Gõ Tìm SKU / Tên Rượu Vang</th>
                                                <th className="px-3 py-2.5 text-center w-28">VTG (Niên Vụ)</th>
                                                <th className="px-3 py-2.5 text-center w-32">Số Lượng (Chai)</th>
                                                <th className="px-3 py-2.5 text-center w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200/40 overflow-visible">
                                            {lines.map((line, idx) => {
                                                const p = products.find(prod => prod.id === line.productId)
                                                const whStock = fromWarehouseId && p?.stocksByWH ? p.stocksByWH[fromWarehouseId] : null
                                                const whVintages = whStock?.vintages || []
                                                const totalWhAvail = whStock?.totalAvailable ?? 0

                                                let selectedVintageQty = 0
                                                if (whStock) {
                                                    const match = whVintages.find(v => v.vintage === line.vintage)
                                                    selectedVintageQty = match ? match.qtyAvailable : 0
                                                }

                                                const allProductVintages = p?.vintages || []
                                                const isZeroStock = Boolean(fromWarehouseId && line.productId && selectedVintageQty === 0)
                                                const isOverStock = Boolean(fromWarehouseId && line.productId && line.qtyTransferred > selectedVintageQty && selectedVintageQty > 0)

                                                return (
                                                    <tr key={idx} className={`hover:bg-white/30 transition-colors ${isZeroStock ? 'bg-red-950/20' : ''}`}>
                                                        <td className="px-3 py-2.5 text-center font-bold align-top" style={{ color: '#475569' }}>{idx + 1}</td>
                                                        <td className="px-3 py-2.5 align-top">
                                                            <ProductCombobox
                                                                products={products}
                                                                selectedProductId={line.productId}
                                                                fromWarehouseId={fromWarehouseId}
                                                                onChange={id => handleLineProductChange(idx, id)}
                                                            />
                                                            {fromWarehouseId && line.productId && (
                                                                <div className="mt-1 flex items-center gap-2 text-[11px]">
                                                                    <span className="text-slate-400">Tồn kho xuất:</span>
                                                                    <span className={`font-mono font-bold px-1.5 py-0.2 rounded text-[10px] ${totalWhAvail > 0 ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40' : 'text-red-400 bg-red-950/40 border border-red-900/40'}`}>
                                                                        {totalWhAvail} chai
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center align-top">
                                                            <select
                                                                value={line.vintage ?? ''}
                                                                onChange={e => handleLineVintageChange(idx, e.target.value ? parseInt(e.target.value) : null)}
                                                                {...focusHandler}
                                                                className={`w-full px-2 py-1.5 rounded text-center font-mono font-bold text-xs outline-none cursor-pointer ${isZeroStock ? 'text-red-400' : ''}`}
                                                                style={{ ...inputStyle, borderColor: isZeroStock ? '#F87171' : '#E2E8F0' }}
                                                            >
                                                                <option value="">
                                                                    NV (K.Năm) {whStock ? `(Tồn: ${whVintages.find(v => v.vintage === null)?.qtyAvailable ?? 0}c)` : ''}
                                                                </option>
                                                                {whVintages.filter(v => v.vintage !== null).map(v => (
                                                                    <option key={v.vintage!} value={v.vintage!}>
                                                                        {v.vintage} (Tồn: {v.qtyAvailable}c)
                                                                    </option>
                                                                ))}
                                                                {allProductVintages.filter(v => !whVintages.some(wv => wv.vintage === v)).map(v => (
                                                                    <option key={v} value={v}>
                                                                        {v} (Tồn: 0c - Hết)
                                                                    </option>
                                                                ))}
                                                                {line.vintage && !allProductVintages.includes(line.vintage) && !whVintages.some(wv => wv.vintage === line.vintage) && (
                                                                    <option value={line.vintage}>{line.vintage} (Tồn: 0c)</option>
                                                                )}
                                                            </select>

                                                            {fromWarehouseId && line.productId && (
                                                                <div className="mt-1 flex items-center justify-center">
                                                                    {isZeroStock ? (
                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-800/50">
                                                                            <AlertCircle size={11} className="text-red-400" /> Tồn = 0 chai
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] font-semibold text-emerald-400">
                                                                            Tồn: <strong className="font-mono font-bold">{selectedVintageQty}</strong> chai
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center align-top">
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                value={line.qtyTransferred}
                                                                onChange={e => handleLineQtyChange(idx, parseInt(e.target.value) || 1)}
                                                                {...focusHandler}
                                                                className={`w-full px-2 py-1.5 rounded text-center font-mono font-bold text-xs outline-none ${isOverStock ? 'text-amber-300' : ''}`}
                                                                style={{ ...inputStyle, borderColor: isOverStock ? '#F59E0B' : '#E2E8F0' }}
                                                            />
                                                            {fromWarehouseId && line.productId && (
                                                                <div className="mt-1 flex items-center justify-center">
                                                                    {isOverStock ? (
                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50">
                                                                            ⚠️ Vượt tồn ({selectedVintageQty}c)
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-400">
                                                                            Chai
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center align-top">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveLine(idx)}
                                                                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded transition-colors cursor-pointer mt-1"
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
                <div className="px-6 py-4 flex items-center justify-between shrink-0 border-t border-slate-200 dark:border-slate-200 bg-slate-50/50 dark:bg-white/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-200 bg-white dark:bg-white text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        Hủy Bỏ
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSubmit(false)}
                            className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-200 bg-white dark:bg-white text-slate-700 dark:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
