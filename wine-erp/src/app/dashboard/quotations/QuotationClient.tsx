'use client'

import { useState, useCallback } from 'react'
import { Plus, Search, FileText, Clock, CheckCircle2, XCircle, ArrowRight, Eye, Loader2, X, Send, RefreshCcw, Download, Link2, Copy, ExternalLink, Printer, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { QuotationRow, QuotationStatus, getQuotations, getQuotationDetail, updateQuotationStatus, convertQuotationToSO, createQuotation, sendQuotation, duplicateQuotation, exportQuotationExcel } from './actions'
import { getCustomersForSO, getSalesReps, getProductsWithStock } from '../sales/actions'
import { formatVND, formatDate } from '@/lib/utils'

const STATUS_CFG: Record<QuotationStatus, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)' },
    SENT: { label: 'Đã Gửi', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    ACCEPTED: { label: 'Chấp Nhận', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    CONVERTED: { label: 'Đã Chuyển SO', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    EXPIRED: { label: 'Hết Hạn', color: '#4A6A7A', bg: 'rgba(74,106,122,0.12)' },
    CANCELLED: { label: 'Huỷ', color: '#8B1A2E', bg: 'rgba(139,26,46,0.12)' },
}

interface Props {
    initialRows: QuotationRow[]
    stats: { total: number; draft: number; sent: number; accepted: number; converted: number; totalValue: number }
}

export function QuotationClient({ initialRows, stats }: Props) {
    const [rows, setRows] = useState(initialRows)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [detail, setDetail] = useState<Awaited<ReturnType<typeof getQuotationDetail>>>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)

    // Create form state
    const [customers, setCustomers] = useState<any[]>([])
    const [reps, setReps] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [formData, setFormData] = useState({ customerId: '', salesRepId: '', channel: 'HORECA', paymentTerm: 'NET30', validUntil: '', notes: '', terms: '' })
    const [formLines, setFormLines] = useState<{ productId: string; qty: number; price: number; discount: number }[]>([])
    const [saving, setSaving] = useState(false)
    const [sendDrawerOpen, setSendDrawerOpen] = useState<string | null>(null)
    const [sendLoading, setSendLoading] = useState(false)

    const reload = useCallback(async () => {
        setLoading(true)
        const data = await getQuotations({ search: search || undefined, status: statusFilter || undefined })
        setRows(data)
        setLoading(false)
    }, [search, statusFilter])

    const openDetail = async (id: string) => {
        setDetailId(id)
        setDetailLoading(true)
        try {
            const d = await getQuotationDetail(id)
            setDetail(d)
        } catch (err) {
            console.error('Failed to load quotation detail:', err)
            setDetail(null)
        } finally {
            setDetailLoading(false)
        }
    }

    const handleConvert = async (id: string) => {
        if (!confirm('Chuyển Quotation này thành Sales Order?')) return
        setActionLoading(id)
        toast.promise(
            convertQuotationToSO(id).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi chuyển đổi thành SO')
                reload().then(() => setDetailId(null))
                return res
            }),
            {
                loading: 'Đang chuyển đổi thành Đơn Hàng...',
                success: (res: any) => `Đã tạo ${res.soNo} từ Quotation!`,
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setActionLoading(null)
            }
        )
    }

    const handleStatusChange = async (id: string, status: QuotationStatus) => {
        setActionLoading(id)
        toast.promise(
            updateQuotationStatus(id, status).then((res: any) => {
                reload()
                return res
            }),
            {
                loading: 'Đang cập nhật trạng thái...',
                success: 'Đã cập nhật trạng thái!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setActionLoading(null)
            }
        )
    }

    const openCreate = async () => {
        if (customers.length === 0) {
            const [c, r, p] = await Promise.all([getCustomersForSO(), getSalesReps(), getProductsWithStock()])
            setCustomers(c)
            setReps(r)
            setProducts(p)
        }
        setCreateOpen(true)
    }

    const handleCreate = async () => {
        if (!formData.customerId || !formData.salesRepId || !formData.validUntil || formLines.length === 0) {
            toast.error('Vui lòng điền đầy đủ thông tin')
            return
        }
        setSaving(true)
        toast.promise(
            createQuotation({
                ...formData,
                lines: formLines.map(l => ({ productId: l.productId, qtyOrdered: l.qty, unitPrice: l.price, lineDiscountPct: l.discount })),
            }).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi tạo báo giá')
                setCreateOpen(false)
                setFormData({ customerId: '', salesRepId: '', channel: 'HORECA', paymentTerm: 'NET30', validUntil: '', notes: '', terms: '' })
                setFormLines([])
                reload()
                return res
            }),
            {
                loading: 'Đang tạo báo giá...',
                success: 'Đã tạo báo giá thành công!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setSaving(false)
            }
        )
    }

    const addLine = () => setFormLines([...formLines, { productId: '', qty: 1, price: 0, discount: 0 }])
    const removeLine = (i: number) => setFormLines(formLines.filter((_, idx) => idx !== i))
    const updateLine = (i: number, field: string, val: any) => {
        const copy = [...formLines]
            ; (copy[i] as any)[field] = val
        setFormLines(copy)
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Báo Giá (QTN)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Tạo báo giá → Gửi khách → Chấp nhận → Chuyển thành Đơn Hàng
                    </p>
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all"
                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                    <Plus size={16} /> Tạo Báo Giá
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                    { label: 'Tổng Giá Trị', value: `₫${(stats.totalValue / 1e6).toFixed(0)}M`, accent: '#87CBB9' },
                    { label: 'Tổng BG', value: stats.total, accent: '#8AAEBB' },
                    { label: 'Đã Gửi', value: stats.sent, accent: '#D4A853' },
                    { label: 'Chấp Nhận', value: stats.accepted, accent: '#5BA88A' },
                    { label: 'Đã → SO', value: stats.converted, accent: '#87CBB9' },
                ].map(s => (
                    <div key={s.label} className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>{s.label}</p>
                        <p className="text-xl font-bold mt-1" style={{ fontFamily: '"DM Mono", monospace', color: '#E8F1F2' }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input value={search} onChange={e => { setSearch(e.target.value); setTimeout(reload, 300) }}
                        placeholder="Tìm số QT, khách hàng..."
                        className="w-full pl-9 pr-4 py-2.5 text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }} />
                </div>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setTimeout(reload, 100) }}
                    className="px-3 py-2.5 text-sm outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: statusFilter ? '#E8F1F2' : '#4A6A7A', borderRadius: '6px' }}>
                    <option value="">Tất cả</option>
                    {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['Số QT', 'Khách Hàng', 'Kênh', 'Giá Trị', 'Sales Rep', 'Hạn BG', 'Trạng Thái', 'Hành Động'].map(h => (
                                <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="text-center py-12" style={{ color: '#4A6A7A' }}>Đang tải...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-16" style={{ color: '#4A6A7A' }}>
                                <FileText size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                                <p className="text-sm">Chưa có báo giá nào</p>
                            </td></tr>
                        ) : rows.map(row => {
                            const cfg = STATUS_CFG[row.status]
                            const isExpired = new Date(row.validUntil) < new Date() && !['CONVERTED', 'CANCELLED', 'EXPIRED'].includes(row.status)
                            return (
                                <tr key={row.id}
                                    style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{row.quotationNo}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{row.customerName}</p>
                                        <p className="text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>{row.customerCode}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(135,203,185,0.1)', color: '#8AAEBB' }}>{row.channel}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>{formatVND(row.totalAmount)}</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm" style={{ color: '#8AAEBB' }}>{row.salesRepName}</td>
                                    <td className="px-4 py-3 text-xs" style={{ color: isExpired ? '#EF4444' : '#4A6A7A' }}>
                                        {formatDate(row.validUntil)}
                                        {isExpired && <span className="ml-1 text-[10px] font-bold">QUÁ HẠN</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openDetail(row.id)} className="p-1.5 rounded" title="Chi tiết"
                                                style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}>
                                                <Eye size={13} />
                                            </button>
                                            {/* PDF Preview */}
                                            <button onClick={() => window.open(`/api/export/quotation-pdf?id=${row.id}&style=professional`, '_blank')}
                                                className="p-1.5 rounded" title="Xem PDF"
                                                style={{ background: 'rgba(138,174,187,0.1)', color: '#8AAEBB' }}>
                                                <Printer size={13} />
                                            </button>
                                            {/* Send */}
                                            {['DRAFT', 'SENT'].includes(row.status) && (
                                                <button onClick={() => setSendDrawerOpen(row.id)}
                                                    className="flex items-center gap-0.5 px-2 py-1 text-xs font-semibold"
                                                    style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', borderRadius: '4px' }}>
                                                    <Send size={10} /> Gửi
                                                </button>
                                            )}
                                            {/* View tracking */}
                                            {row.viewCount > 0 && (
                                                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full" title={`KH đã xem ${row.viewCount} lần${row.lastViewedAt ? ` · Lần cuối: ${formatDate(row.lastViewedAt)}` : ''}`}
                                                    style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>
                                                    <Eye size={9} /> {row.viewCount}
                                                </span>
                                            )}
                                            {['SENT', 'ACCEPTED'].includes(row.status) && (
                                                <button onClick={() => handleConvert(row.id)} disabled={actionLoading === row.id}
                                                    className="flex items-center gap-0.5 px-2 py-1 text-xs font-semibold"
                                                    style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)', borderRadius: '4px' }}>
                                                    {actionLoading === row.id ? <Loader2 size={11} className="animate-spin" /> : <><ArrowRight size={10} /> → SO</>}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Detail Drawer */}
            {detailId && (
                <>
                    <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={() => setDetailId(null)} />
                    <div className="fixed top-0 right-0 h-full z-50 flex flex-col" style={{ width: 'min(580px,95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                            <h3 className="text-lg font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>
                                {detailLoading ? 'Chi Tiết Báo Giá' : `QT: ${detail?.quotationNo}`}
                            </h3>
                            <button onClick={() => setDetailId(null)} className="p-1.5 rounded" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        {detailLoading ? (
                            <div className="flex items-center justify-center flex-1"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
                        ) : !detail ? (
                            <p className="text-center py-8" style={{ color: '#4A6A7A' }}>Không tìm thấy</p>
                        ) : (
                            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Tổng Tiền', value: formatVND(Number(detail.totalAmount)), color: '#87CBB9' },
                                        { label: 'Khách Hàng', value: detail.customer.name, color: '#E8F1F2' },
                                        { label: 'Sales Rep', value: detail.salesRep.name, color: '#8AAEBB' },
                                    ].map(k => (
                                        <div key={k.label} className="p-3 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                            <p className="text-xs" style={{ color: '#4A6A7A' }}>{k.label}</p>
                                            <p className="text-sm font-bold mt-1" style={{ color: k.color, fontFamily: '"DM Mono"' }}>{k.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Hạn Báo Giá</p>
                                        <p className="text-sm font-bold mt-1" style={{ color: new Date(detail.validUntil) < new Date() ? '#EF4444' : '#D4A853', fontFamily: '"DM Mono"' }}>
                                            {formatDate(detail.validUntil)}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Trạng Thái</p>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block"
                                            style={{ color: STATUS_CFG[detail.status as QuotationStatus]?.color, background: STATUS_CFG[detail.status as QuotationStatus]?.bg }}>
                                            {STATUS_CFG[detail.status as QuotationStatus]?.label}
                                        </span>
                                    </div>
                                </div>
                                {detail.notes && (
                                    <div className="p-3 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                        <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>Ghi Chú</p>
                                        <p className="text-xs" style={{ color: '#8AAEBB' }}>{detail.notes}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A6A7A' }}>Sản Phẩm ({detail.lines.length} dòng)</p>
                                    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: '#142433' }}>
                                                    {['SKU', 'Sản Phẩm', 'SL', 'Giá', 'CK%', 'Thành Tiền'].map(h => (
                                                        <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.lines.map(l => {
                                                    const total = Number(l.qtyOrdered) * Number(l.unitPrice) * (1 - Number(l.lineDiscountPct) / 100)
                                                    return (
                                                        <tr key={l.id} style={{ borderTop: '1px solid #2A4355' }}>
                                                            <td className="px-3 py-2" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{l.product.skuCode}</td>
                                                            <td className="px-3 py-2" style={{ color: '#E8F1F2' }}>{l.product.productName}</td>
                                                            <td className="px-3 py-2 text-right" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{Number(l.qtyOrdered)}</td>
                                                            <td className="px-3 py-2 text-right" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{formatVND(Number(l.unitPrice))}</td>
                                                            <td className="px-3 py-2 text-center" style={{ color: '#D4A853' }}>{Number(l.lineDiscountPct) > 0 ? `${Number(l.lineDiscountPct)}%` : '—'}</td>
                                                            <td className="px-3 py-2 text-right font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{formatVND(total)}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* View tracking */}
                                {(detail as any).viewCount > 0 && (
                                    <div className="p-3 rounded-md" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                                        <div className="flex items-center gap-2">
                                            <Eye size={14} style={{ color: '#22C55E' }} />
                                            <span className="text-xs font-semibold" style={{ color: '#22C55E' }}>KH đã xem {(detail as any).viewCount} lần</span>
                                            {(detail as any).firstViewedAt && (
                                                <span className="text-[10px]" style={{ color: '#4A6A7A' }}>· Lần đầu: {formatDate((detail as any).firstViewedAt)}</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {/* PDF buttons */}
                                    <button onClick={() => window.open(`/api/export/quotation-pdf?id=${detail.id}&style=professional`, '_blank')}
                                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
                                        style={{ background: 'rgba(138,174,187,0.12)', color: '#8AAEBB', border: '1px solid rgba(138,174,187,0.25)', borderRadius: '6px' }}>
                                        <Printer size={13} /> PDF Trắng
                                    </button>
                                    <button onClick={() => window.open(`/api/export/quotation-pdf?id=${detail.id}&style=elegant`, '_blank')}
                                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
                                        style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.25)', borderRadius: '6px' }}>
                                        <Printer size={13} /> PDF Dark
                                    </button>

                                    {/* Copy link */}
                                    {(detail as any).publicToken && (
                                        <button onClick={() => {
                                            const url = `${window.location.origin}/verify/quotation/${(detail as any).publicToken}`
                                            navigator.clipboard.writeText(url)
                                            toast.success('Đã copy link báo giá!')
                                        }}
                                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
                                            style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '6px' }}>
                                            <Copy size={13} /> Copy Link
                                        </button>
                                    )}

                                    {/* Send email */}
                                    {['DRAFT', 'SENT'].includes(detail.status) && (
                                        <button onClick={() => { setSendDrawerOpen(detail.id); setDetailId(null) }}
                                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
                                            style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', borderRadius: '6px' }}>
                                            <Mail size={13} /> Gửi Email
                                        </button>
                                    )}

                                    {/* Convert to SO */}
                                    {!['CONVERTED', 'CANCELLED', 'EXPIRED'].includes(detail.status) && (
                                        <button onClick={() => { handleConvert(detail.id); setDetailId(null) }}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold"
                                            style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                                            <ArrowRight size={14} /> Chuyển → SO
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Create Drawer */}
            {createOpen && (
                <>
                    <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={() => setCreateOpen(false)} />
                    <div className="fixed top-0 right-0 h-full z-50 flex flex-col" style={{ width: 'min(520px,95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                            <h3 className="text-lg font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>Tạo Báo Giá Mới</h3>
                            <button onClick={() => setCreateOpen(false)} className="p-1.5 rounded" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                            {/* Customer */}
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Khách Hàng</label>
                                <select value={formData.customerId} onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                                    className="w-full mt-1 px-3 py-2.5 text-sm outline-none"
                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}>
                                    <option value="">Chọn khách hàng...</option>
                                    {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Sales Rep</label>
                                    <select value={formData.salesRepId} onChange={e => setFormData({ ...formData, salesRepId: e.target.value })}
                                        className="w-full mt-1 px-3 py-2.5 text-sm outline-none"
                                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}>
                                        <option value="">Chọn...</option>
                                        {reps.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Hạn Báo Giá</label>
                                    <input type="date" value={formData.validUntil} onChange={e => setFormData({ ...formData, validUntil: e.target.value })}
                                        className="w-full mt-1 px-3 py-2.5 text-sm outline-none"
                                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Ghi Chú / Điều Khoản</label>
                                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    rows={2} placeholder="Điều kiện giao hàng, thanh toán..."
                                    className="w-full mt-1 px-3 py-2 text-sm outline-none resize-none"
                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }} />
                            </div>

                            {/* Lines */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Sản Phẩm</p>
                                    <button onClick={addLine} className="text-xs font-semibold px-2 py-1" style={{ color: '#87CBB9' }}>+ Thêm Dòng</button>
                                </div>
                                <div className="space-y-2">
                                    {formLines.map((line, i) => (
                                        <div key={i} className="p-3 rounded-md space-y-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                            <select value={line.productId} onChange={e => updateLine(i, 'productId', e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs outline-none"
                                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}>
                                                <option value="">Chọn sản phẩm...</option>
                                                {products.map((p: any) => <option key={p.id} value={p.id}>{p.skuCode} — {p.productName}</option>)}
                                            </select>
                                            <div className="grid grid-cols-3 gap-2">
                                                <input type="number" value={line.qty} onChange={e => updateLine(i, 'qty', Number(e.target.value))} placeholder="SL"
                                                    className="px-2 py-1.5 text-xs outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }} />
                                                <input type="number" value={line.price} onChange={e => updateLine(i, 'price', Number(e.target.value))} placeholder="Giá"
                                                    className="px-2 py-1.5 text-xs outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#D4A853', fontFamily: '"DM Mono"', borderRadius: '4px' }} />
                                                <div className="flex items-center gap-1">
                                                    <input type="number" value={line.discount} onChange={e => updateLine(i, 'discount', Number(e.target.value))} placeholder="CK%"
                                                        className="flex-1 px-2 py-1.5 text-xs outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }} />
                                                    <button onClick={() => removeLine(i)} className="p-1 text-xs" style={{ color: '#8B1A2E' }}>✕</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button onClick={handleCreate} disabled={saving || !formData.customerId || formLines.length === 0}
                                className="w-full py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                                style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                                {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Tạo Báo Giá'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Send Drawer */}
            {sendDrawerOpen && (
                <>
                    <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={() => setSendDrawerOpen(null)} />
                    <div className="fixed top-0 right-0 h-full z-50 flex flex-col" style={{ width: 'min(420px,95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                            <h3 className="text-lg font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>Gửi Báo Giá</h3>
                            <button onClick={() => setSendDrawerOpen(null)} className="p-1.5 rounded" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                            <p className="text-sm" style={{ color: '#8AAEBB' }}>Chọn phương thức gửi báo giá cho khách hàng:</p>

                            {/* Send via Email */}
                            <button onClick={async () => {
                                setSendLoading(true)
                                const res = await sendQuotation(sendDrawerOpen, 'EMAIL')
                                setSendLoading(false)
                                if (res.success) {
                                    toast.success('Đã gửi báo giá qua Email!')
                                    if (res.publicUrl) {
                                        navigator.clipboard.writeText(res.publicUrl)
                                        toast.info('Link đã được copy vào clipboard')
                                    }
                                    setSendDrawerOpen(null)
                                    reload()
                                } else toast.error(res.error || 'Lỗi gửi email')
                            }} disabled={sendLoading}
                                className="w-full p-4 rounded-lg text-left transition-all"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = '#D4A853')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,168,83,0.15)' }}>
                                        <Mail size={18} style={{ color: '#D4A853' }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>📧 Gửi qua Email</p>
                                        <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>Gửi email HTML đẹp + link xem báo giá online</p>
                                    </div>
                                </div>
                            </button>

                            {/* Copy Link */}
                            <button onClick={async () => {
                                setSendLoading(true)
                                const res = await sendQuotation(sendDrawerOpen, 'LINK')
                                setSendLoading(false)
                                if (res.success && res.publicUrl) {
                                    navigator.clipboard.writeText(res.publicUrl)
                                    toast.success('Đã copy link! Paste vào Zalo/WhatsApp để gửi')
                                    setSendDrawerOpen(null)
                                    reload()
                                } else toast.error(res.error || 'Lỗi tạo link')
                            }} disabled={sendLoading}
                                className="w-full p-4 rounded-lg text-left transition-all"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
                                        <Link2 size={18} style={{ color: '#3B82F6' }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>🔗 Copy Link Gửi Zalo / WhatsApp</p>
                                        <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>Copy link → paste vào tin nhắn. KH bấm xem trực tuyến</p>
                                    </div>
                                </div>
                            </button>

                            {/* PDF Download */}
                            <button onClick={() => {
                                window.open(`/api/export/quotation-pdf?id=${sendDrawerOpen}&style=professional`, '_blank')
                            }}
                                className="w-full p-4 rounded-lg text-left transition-all"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.15)' }}>
                                        <Printer size={18} style={{ color: '#87CBB9' }} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>🖨️ In / Tải PDF</p>
                                        <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>Mở báo giá dạng web → In hoặc lưu PDF</p>
                                    </div>
                                </div>
                            </button>

                            {sendLoading && (
                                <div className="flex items-center justify-center gap-2 py-4">
                                    <Loader2 size={16} className="animate-spin" style={{ color: '#87CBB9' }} />
                                    <span className="text-sm" style={{ color: '#8AAEBB' }}>Đang xử lý...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

