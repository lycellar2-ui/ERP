'use client'

import { useState, useEffect } from 'react'
import {
    Search, Plus, ShoppingCart, Truck, CheckCircle2, Clock,
    FileText, ChevronDown, X, Trash2, Loader2, Save, AlertCircle,
    Package, Globe, ArrowRight
} from 'lucide-react'
import { PORow, CreatePOInput, createPurchaseOrder, updatePOStatus, getPurchaseOrders } from './actions'
import { formatVND, formatDate } from '@/lib/utils'
import { getSuppliers } from '@/app/dashboard/suppliers/actions'
import { getProducts } from '@/app/dashboard/products/actions'

// ── Status config ─────────────────────────────────
const PO_STATUS: Record<string, { label: string; color: string; bg: string; icon: React.FC<any> }> = {
    DRAFT: { label: 'Nháp', color: '#4A6A7A', bg: 'rgba(107,90,78,0.15)', icon: FileText },
    PENDING_APPROVAL: { label: 'Chờ duyệt', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)', icon: Clock },
    APPROVED: { label: 'Đã duyệt', color: '#5BA88A', bg: 'rgba(74,124,89,0.15)', icon: CheckCircle2 },
    IN_TRANSIT: { label: 'Đang vận chuyển', color: '#4A8FAB', bg: 'rgba(46,91,122,0.15)', icon: Truck },
    PARTIALLY_RECEIVED: { label: 'Nhận một phần', color: '#87CBB9', bg: 'rgba(168,130,204,0.15)', icon: Package },
    RECEIVED: { label: 'Đã nhận đủ', color: '#5BA88A', bg: 'rgba(74,124,89,0.20)', icon: CheckCircle2 },
    CANCELLED: { label: 'Huỷ', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)', icon: X },
}

function POStatusBadge({ status }: { status: string }) {
    const cfg = PO_STATUS[status] ?? { label: status, color: '#8AAEBB', bg: 'rgba(168,152,128,0.15)', icon: FileText }
    const Icon = cfg.icon
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ color: cfg.color, background: cfg.bg }}>
            <Icon size={11} />{cfg.label}
        </span>
    )
}

// ── Create PO Drawer ───────────────────────────────
function CreatePODrawer({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: (poNo: string) => void
}) {
    const [suppliers, setSuppliers] = useState<{ id: string; name: string; defaultCurrency: string }[]>([])
    const [products, setProducts] = useState<{ id: string; productName: string; skuCode: string }[]>([])
    const [supplierId, setSupplierId] = useState('')
    const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD')
    const [exchangeRate, setExchangeRate] = useState(25500)
    const [lines, setLines] = useState<{ productId: string; qtyOrdered: number; unitPrice: number; uom: string }[]>([
        { productId: '', qtyOrdered: 12, unitPrice: 0, uom: 'BOTTLE' }
    ])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!open) return
        Promise.all([
            getSuppliers().then(s => setSuppliers(s.map(x => ({ id: x.id, name: x.name, defaultCurrency: x.defaultCurrency })))),
            getProducts({ pageSize: 100 }).then(r => setProducts(r.rows.map(p => ({ id: p.id, productName: p.productName, skuCode: p.skuCode })))),
        ])
    }, [open])

    const totalFOB = lines.reduce((s, l) => s + l.qtyOrdered * l.unitPrice, 0)
    const totalVND = totalFOB * exchangeRate

    const addLine = () => setLines(ls => [...ls, { productId: '', qtyOrdered: 12, unitPrice: 0, uom: 'BOTTLE' }])
    const removeLine = (i: number) => setLines(ls => ls.filter((_, idx) => idx !== i))
    const setLine = (i: number, key: string, val: any) =>
        setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [key]: val } : l))

    const handleSave = async () => {
        if (!supplierId) return setError('Chọn nhà cung cấp')
        if (lines.some(l => !l.productId || l.unitPrice <= 0)) return setError('Điền đầy đủ thông tin tất cả dòng sản phẩm')
        setSaving(true)
        setError('')
        try {
            const result = await createPurchaseOrder({ supplierId, currency, exchangeRate, lines })
            onCreated(result.poNo)
        } catch (err: any) {
            setError(err.message ?? 'Lỗi không xác định')
        } finally {
            setSaving(false)
        }
    }

    const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-150"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }
    const focusStyle = { borderColor: '#87CBB9' }
    const blurStyle = { borderColor: '#2A4355' }

    return (
        <>
            <div className="fixed inset-0 z-40 transition-opacity duration-300"
                style={{ background: 'rgba(10,5,2,0.75)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
                onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300"
                style={{ width: 'min(680px, 97vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355', transform: open ? 'translateX(0)' : 'translateX(100%)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.15)' }}>
                            <ShoppingCart size={16} style={{ color: '#87CBB9' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>Tạo Đơn Mua Hàng</h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Đặt hàng từ nhà cung cấp / Winery</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#4A6A7A' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}><X size={18} /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {error && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                            style={{ background: 'rgba(139,26,46,0.15)', border: '1px solid rgba(139,26,46,0.4)', color: '#E05252' }}>
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>── Thông Tin Chung</p>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Nhà Cung Cấp *</label>
                            <select className={inputCls} style={inputStyle} value={supplierId} onChange={e => setSupplierId(e.target.value)}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <option value="">— Chọn NCC —</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Tiền Tệ</label>
                            <select className={inputCls} style={inputStyle} value={currency} onChange={e => setCurrency(e.target.value as any)}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Tỷ Giá (VND/{currency})</label>
                        <input type="number" className={inputCls} style={inputStyle} value={exchangeRate}
                            onChange={e => setExchangeRate(Number(e.target.value))} step={100}
                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                    </div>

                    {/* Product Lines */}
                    <div className="flex items-center justify-between pt-2">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>── Danh Sách Sản Phẩm</p>
                        <button onClick={addLine} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.1)')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <Plus size={12} /> Thêm Sản Phẩm
                        </button>
                    </div>

                    <div className="space-y-3">
                        {lines.map((line, i) => (
                            <div key={i} className="p-3 rounded-xl space-y-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold" style={{ color: '#4A6A7A' }}>Dòng #{i + 1}</span>
                                    {lines.length > 1 && (
                                        <button onClick={() => removeLine(i)} className="p-1 rounded" style={{ color: '#8B1A2E' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Sản Phẩm</label>
                                    <select className={inputCls} style={inputStyle} value={line.productId}
                                        onChange={e => setLine(i, 'productId', e.target.value)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                        <option value="">— Chọn sản phẩm —</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.productName} ({p.skuCode})</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Số Lượng (Chai)</label>
                                        <input type="number" className={inputCls} style={inputStyle} value={line.qtyOrdered} min={1}
                                            onChange={e => setLine(i, 'qtyOrdered', Number(e.target.value))}
                                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Đơn Giá ({currency})</label>
                                        <input type="number" className={inputCls} style={inputStyle} value={line.unitPrice} min={0} step={0.01}
                                            onChange={e => setLine(i, 'unitPrice', Number(e.target.value))}
                                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Thành Tiền ({currency})</label>
                                        <div className="px-3 py-2.5 rounded-lg text-sm font-semibold"
                                            style={{ background: '#0A1926', border: '1px solid #1B2E3D', color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>
                                            {(line.qtyOrdered * line.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary */}
                    {totalFOB > 0 && (
                        <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(135,203,185,0.06)', border: '1px solid rgba(135,203,185,0.2)' }}>
                            <div className="flex justify-between text-sm">
                                <span style={{ color: '#8AAEBB' }}>Tổng FOB ({currency}):</span>
                                <span className="font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono", monospace' }}>
                                    {totalFOB.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currency}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span style={{ color: '#8AAEBB' }}>Quy đổi VND (ước tính):</span>
                                <span className="font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>
                                    {formatVND(totalVND)}
                                </span>
                            </div>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>* Chưa bao gồm thuế nhập khẩu, SCT, VAT, chi phí logistics</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #2A4355' }}>
                    <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm"
                        style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>Hủy</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                        style={{ background: '#87CBB9', color: '#0A1926' }}
                        onMouseEnter={e => !saving && (e.currentTarget.style.background = '#A5DED0')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Đang tạo...' : 'Tạo PO'}
                    </button>
                </div>
            </div>
        </>
    )
}

// ── Status stepper ─────────────────────────────────
const STATUS_FLOW = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_TRANSIT', 'RECEIVED']

function StatusStepper({ current, poId, onUpdate }: { current: string; poId: string; onUpdate: () => void }) {
    const [updating, setUpdating] = useState(false)
    const currentIdx = STATUS_FLOW.indexOf(current)
    const nextStatus = STATUS_FLOW[currentIdx + 1]

    if (!nextStatus || current === 'CANCELLED' || current === 'RECEIVED') return null

    const next = PO_STATUS[nextStatus]

    const handleAdvance = async () => {
        setUpdating(true)
        try {
            await updatePOStatus(poId, nextStatus)
            onUpdate()
        } finally {
            setUpdating(false)
        }
    }

    return (
        <button onClick={handleAdvance} disabled={updating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ color: next?.color ?? '#8AAEBB', border: `1px solid ${next?.color ?? '#8AAEBB'}33` }}
            onMouseEnter={e => (e.currentTarget.style.background = next?.bg ?? '')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}>
            {updating ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />}
            → {next?.label}
        </button>
    )
}

// ── Main ──────────────────────────────────────────
interface Props {
    initialRows: PORow[]
    initialTotal: number
    stats: { total: number; draft: number; approved: number; inTransit: number }
}

export function ProcurementClient({ initialRows, initialTotal, stats }: Props) {
    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')

    const refresh = async () => {
        setLoading(true)
        try {
            const result = await getPurchaseOrders({ search: search || undefined, status: statusFilter || undefined })
            setRows(result.rows)
            setTotal(result.total)
        } finally {
            setLoading(false)
        }
    }

    const filtered = rows.filter(r =>
        (!search || r.poNo.toLowerCase().includes(search.toLowerCase()) || r.supplierName.toLowerCase().includes(search.toLowerCase())) &&
        (!statusFilter || r.status === statusFilter)
    )

    const statCards = [
        { label: 'Tổng PO', value: stats.total, icon: ShoppingCart, accent: '#87CBB9' },
        { label: 'Nháp / Chờ duyệt', value: stats.draft, icon: FileText, accent: '#4A6A7A' },
        { label: 'Đã duyệt', value: stats.approved, icon: CheckCircle2, accent: '#5BA88A' },
        { label: 'Đang vận chuyển', value: stats.inTransit, icon: Truck, accent: '#4A8FAB' },
    ]

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Đơn Mua Hàng
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Purchase Orders — Đặt hàng từ winery / négociant / distributor
                    </p>
                </div>
                <button onClick={() => setDrawerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                    <Plus size={16} /> Tạo PO Mới
                </button>
            </div>

            {/* Success toast */}
            {successMsg && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(74,124,89,0.15)', border: '1px solid rgba(74,124,89,0.4)', color: '#5BA88A' }}>
                    <CheckCircle2 size={16} />
                    <span className="text-sm font-semibold">{successMsg}</span>
                    <button className="ml-auto" onClick={() => setSuccessMsg('')}><X size={14} /></button>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {statCards.map(s => (
                    <div key={s.label} className="flex items-center gap-4 p-4 rounded-xl"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${s.accent}20` }}>
                            <s.icon size={20} style={{ color: s.accent }} />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{s.label}</p>
                            <p className="text-xl font-bold mt-0.5" style={{ color: '#E8F1F2', fontFamily: '"DM Mono", monospace' }}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter bar */}
            <div className="flex gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input placeholder="Tìm PO No, NCC..." value={search}
                        onChange={e => { setSearch(e.target.value); refresh() }}
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                </div>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); refresh() }}
                    className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: statusFilter ? '#E8F1F2' : '#4A6A7A' }}>
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(PO_STATUS).map(([v, cfg]) => <option key={v} value={v}>{cfg.label}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['PO Number', 'Nhà Cung Cấp', 'Ngày Tạo', 'Sản Phẩm', 'Tổng Số Lượng', 'Giá Trị FOB', 'Ti Giá', 'Trạng Thái', ''].map(h => (
                                <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(61,43,31,0.6)' }}>
                                    {Array.from({ length: 9 }).map((_, j) => (
                                        <td key={j} className="px-4 py-4">
                                            <div className="h-4 rounded animate-pulse" style={{ background: '#1B2E3D', width: j === 0 ? '70%' : '50%' }} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={9}>
                                <div className="flex flex-col items-center py-16 gap-3">
                                    <span className="text-4xl">📋</span>
                                    <p style={{ color: '#4A6A7A' }} className="text-sm">Chưa có đơn mua hàng nào</p>
                                    <button onClick={() => setDrawerOpen(true)} className="text-xs px-3 py-1.5 rounded-lg"
                                        style={{ color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                        + Tạo PO đầu tiên
                                    </button>
                                </div>
                            </td></tr>
                        ) : filtered.map(row => (
                            <tr key={row.id} className="group transition-colors duration-100"
                                style={{ borderBottom: '1px solid rgba(61,43,31,0.6)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(61,43,31,0.35)')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                <td className="px-4 py-3">
                                    <span className="text-sm font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>
                                        {row.poNo}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{row.supplierName}</p>
                                </td>
                                <td className="px-4 py-3 text-xs" style={{ color: '#4A6A7A' }}>
                                    {formatDate(row.createdAt)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-sm font-bold" style={{ color: '#8AAEBB', fontFamily: '"DM Mono", monospace' }}>
                                        {row.lineCount} SKU
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-sm" style={{ color: '#8AAEBB', fontFamily: '"DM Mono", monospace' }}>
                                        {row.totalQty.toLocaleString()} chai
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <span className="text-sm font-semibold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono", monospace' }}>
                                        {row.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {row.currency}
                                    </span>
                                    <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>
                                        ≈ {formatVND(row.totalAmount * row.exchangeRate)}
                                    </p>
                                </td>
                                <td className="px-4 py-3 text-center text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>
                                    {row.exchangeRate.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <POStatusBadge status={row.status} />
                                </td>
                                <td className="px-4 py-3">
                                    <StatusStepper current={row.status} poId={row.id} onUpdate={refresh} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <CreatePODrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onCreated={poNo => {
                    setDrawerOpen(false)
                    setSuccessMsg(`✅ Tạo thành công đơn hàng ${poNo}`)
                    refresh()
                    setTimeout(() => setSuccessMsg(''), 5000)
                }}
            />
        </div>
    )
}
