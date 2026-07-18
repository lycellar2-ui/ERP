'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
    initialData?: {
        rows: QuotationRow[]
        stats: { total: number; draft: number; sent: number; accepted: number; converted: number; totalValue: number }
    }
}

export function QuotationClient({ initialData }: Props) {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [detail, setDetail] = useState<any>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)

    // Create form state
    const [formData, setFormData] = useState({ 
        customerId: '', 
        salesRepId: '', 
        channel: 'HORECA', 
        paymentTerm: 'NET30', 
        validUntil: '', 
        notes: '', 
        terms: '', 
        showQuantity: false,
        companyName: '',
        contactPerson: '',
        customerEmail: '',
        customerPhone: ''
    })
    const [isNewCustomer, setIsNewCustomer] = useState(false)
    const [formLines, setFormLines] = useState<{ productId: string; qty: number; price: number; discount: number }[]>([])
    const [saving, setSaving] = useState(false)
    const [sendDrawerOpen, setSendDrawerOpen] = useState<string | null>(null)
    const [sendLoading, setSendLoading] = useState(false)

    const handleCloseCreateDrawer = () => {
        const hasContent = isNewCustomer 
            ? !!(formData.companyName || formData.contactPerson || formData.customerEmail || formData.customerPhone || formLines.length > 0)
            : !!(formData.customerId || formData.validUntil || formData.notes || formData.terms || formLines.length > 0);

        if (hasContent) {
            if (window.confirm('Bạn có chắc chắn muốn đóng? Mọi thông tin báo giá đang nhập sẽ bị mất.')) {
                setCreateOpen(false)
            }
        } else {
            setCreateOpen(false)
        }
    }

    const handlePreview = () => {
        const previewData = {
            customerId: formData.customerId,
            salesRepId: formData.salesRepId,
            channel: formData.channel,
            paymentTerm: formData.paymentTerm,
            validUntil: formData.validUntil,
            notes: formData.notes,
            terms: formData.terms,
            showQuantity: formData.showQuantity,
            companyName: formData.companyName,
            contactPerson: formData.contactPerson,
            customerEmail: formData.customerEmail,
            customerPhone: formData.customerPhone,
            lines: formLines.map(line => ({
                productId: line.productId,
                qtyOrdered: line.qty,
                unitPrice: line.price,
                lineDiscountPct: line.discount
            }))
        }

        const form = document.createElement('form')
        form.method = 'POST'
        form.action = '/api/export/quotation-pdf'
        form.target = '_blank'

        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = 'data'
        input.value = JSON.stringify(previewData)
        form.appendChild(input)

        document.body.appendChild(form)
        form.submit()
        document.body.removeChild(form)
    }

    // Quick Product Picker states
    const [pickerOpen, setPickerOpen] = useState(false)
    const [pickerSearch, setPickerSearch] = useState('')
    const [pickerCountry, setPickerCountry] = useState('')
    const [pickerWineType, setPickerWineType] = useState('')
    const [pickerSelected, setPickerSelected] = useState<Record<string, { qty: number; checked: boolean }>>({})

    // TanStack Query — cache quotations list
    const { data: rows = [], isLoading: loading, refetch } = useQuery({
        queryKey: ['quotations', { search: search || undefined, status: statusFilter || undefined }],
        queryFn: () => getQuotations({ search: search || undefined, status: statusFilter || undefined }),
        initialData: !search && !statusFilter ? initialData?.rows : undefined,
        staleTime: 30_000,
    })

    // TanStack Query — cache reference data for form
    const { data: refData } = useQuery({
        queryKey: ['quotation_reference_data'],
        queryFn: async () => {
            const [c, r, p] = await Promise.all([getCustomersForSO(), getSalesReps(), getProductsWithStock()])
            return { customers: c, reps: r, products: p }
        },
        enabled: createOpen,
        staleTime: 5 * 60_000,
    })

    const customers = refData?.customers ?? []
    const reps = refData?.reps ?? []
    const products = refData?.products ?? []

    // Cache stats (uses initial stats hydration or simple local state if not fetched)
    const [stats, setStats] = useState(initialData?.stats ?? { total: 0, draft: 0, sent: 0, accepted: 0, converted: 0, totalValue: 0 })

    const reload = useCallback(async () => {
        refetch()
    }, [refetch])

    const openDetail = async (id: string) => {
        setDetailId(id)
        setDetailLoading(true)
        try {
            const res = await getQuotationDetail(id)
            if (res.success) {
                setDetail(res.data)
            } else {
                toast.error(`Lỗi tải báo giá: ${res.error}`)
                setDetail(null)
            }
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message || 'Không thể kết nối server'}`)
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

    const openCreate = () => {
        setCreateOpen(true)
    }

    const handleCreate = async () => {
        if (!formData.customerId || !formData.salesRepId || !formData.validUntil || formLines.length === 0) {
            toast.error('Vui lòng điền đầy đủ thông tin')
            return
        }
        if (formData.customerId === 'TEMP_CUSTOMER' && !formData.companyName && !formData.contactPerson) {
            toast.error('Vui lòng điền Tên doanh nghiệp hoặc Người liên hệ cho khách hàng mới')
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
                setIsNewCustomer(false)
                setFormData({ 
                    customerId: '', 
                    salesRepId: '', 
                    channel: 'HORECA', 
                    paymentTerm: 'NET30', 
                    validUntil: '', 
                    notes: '', 
                    terms: '', 
                    showQuantity: false,
                    companyName: '',
                    contactPerson: '',
                    customerEmail: '',
                    customerPhone: ''
                })
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

    const selectProductForLine = (i: number, productId: string) => {
        const prod = products.find(p => p.id === productId)
        const copy = [...formLines]
        copy[i].productId = productId
        copy[i].price = prod ? prod.wholesalePrice : 0
        setFormLines(copy)
    }

    const openPicker = () => {
        const initialSelected: Record<string, { qty: number; checked: boolean }> = {}
        for (const line of formLines) {
            if (line.productId) {
                initialSelected[line.productId] = { qty: line.qty, checked: true }
            }
        }
        setPickerSelected(initialSelected)
        setPickerOpen(true)
    }

    const confirmPickerAdd = () => {
        const newLines: typeof formLines = []
        for (const [prodId, data] of Object.entries(pickerSelected)) {
            if (data.checked && prodId) {
                const prod = products.find(p => p.id === prodId)
                const existing = formLines.find(l => l.productId === prodId)
                newLines.push({
                    productId: prodId,
                    qty: data.qty,
                    price: existing?.price || (prod ? prod.wholesalePrice : 0),
                    discount: existing?.discount || 0
                })
            }
        }
        setFormLines(newLines)
        setPickerOpen(false)
        setPickerSearch('')
        setPickerCountry('')
        setPickerWineType('')
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold font-brand" style={{ color: '#E8F1F2' }}>
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
                        <p className="text-xl font-bold mt-1 font-mono" style={{ color: '#E8F1F2' }}>{s.value}</p>
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

            {/* Table (Desktop View) */}
            <div className="hidden md:block rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
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
                                        <span className="text-xs font-bold" style={{ color: '#87CBB9' }}>{row.quotationNo}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{row.customerName}</p>
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>{row.customerCode}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(135,203,185,0.1)', color: '#8AAEBB' }}>{row.channel}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm font-bold" style={{ color: '#E8F1F2' }}>{formatVND(row.totalAmount)}</span>
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
                                            <button onClick={() => window.open(`/api/export/quotation-pdf?id=${row.id}&style=professional`, '_blank')}
                                                className="p-1.5 rounded" title="Xem PDF"
                                                style={{ background: 'rgba(138,174,187,0.1)', color: '#8AAEBB' }}>
                                                <Printer size={13} />
                                            </button>
                                            {['DRAFT', 'SENT'].includes(row.status) && (
                                                <button onClick={() => setSendDrawerOpen(row.id)}
                                                    className="flex items-center gap-0.5 px-2 py-1 text-xs font-semibold"
                                                    style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', borderRadius: '4px' }}>
                                                    <Send size={10} /> Gửi
                                                </button>
                                            )}
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

            {/* Mobile Stacked Quotations List (Mobile View) */}
            <div className="block md:hidden space-y-3">
                {loading ? (
                    <div className="text-center py-12" style={{ color: '#4A6A7A' }}>Đang tải...</div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-16" style={{ color: '#4A6A7A', border: '1px solid #2A4355', borderRadius: '6px' }}>
                        <FileText size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                        <p className="text-sm">Chưa có báo giá nào</p>
                    </div>
                ) : rows.map(row => {
                    const cfg = STATUS_CFG[row.status]
                    const isExpired = new Date(row.validUntil) < new Date() && !['CONVERTED', 'CANCELLED', 'EXPIRED'].includes(row.status)
                    return (
                        <div key={row.id} className="p-2.5 rounded-lg space-y-2 transition-all" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                            {/* Header: Quotation No & Status */}
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold" style={{ color: '#87CBB9' }}>{row.quotationNo}</span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                            </div>

                            {/* Body: Customer Name & Value */}
                            <div className="flex justify-between items-start gap-2">
                                <h4 className="text-xs font-bold truncate flex-1" style={{ color: '#E8F1F2' }}>{row.customerName}</h4>
                                <span className="text-xs font-bold whitespace-nowrap font-mono" style={{ color: '#E8F1F2' }}>{formatVND(row.totalAmount)}</span>
                            </div>

                            {/* Financials & Timeline Info */}
                            <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] pt-1" style={{ borderTop: '1px solid rgba(42,67,85,0.15)' }}>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="px-1.5 py-0.2 rounded text-xs font-medium" style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}>{row.channel}</span>
                                    <span style={{ color: '#4A6A7A' }}>{row.customerCode}</span>
                                    <span style={{ color: '#4A6A7A' }}>• Rep: <strong style={{ color: '#8AAEBB' }}>{row.salesRepName}</strong></span>
                                </div>
                                <div className="text-right">
                                    <span style={{ color: isExpired ? '#EF4444' : '#8AAEBB' }}>
                                        Hạn: {formatDate(row.validUntil)}
                                        {isExpired && <span className="ml-1 text-xs font-bold text-[#EF4444]">QUÁ HẠN</span>}
                                    </span>
                                </div>
                            </div>

                            {/* Actions & View count */}
                            <div className="flex items-center justify-end gap-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(42,67,85,0.15)' }}>
                                {row.viewCount > 0 && (
                                    <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium mr-auto"
                                        style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}
                                        title={`KH đã xem ${row.viewCount} lần`}>
                                        <Eye size={10} /> {row.viewCount}
                                    </span>
                                )}
                                <div className="flex items-center gap-1 scale-90 origin-right">
                                    <button onClick={() => openDetail(row.id)} className="p-1 rounded bg-[#1B2E3D]/80 hover:bg-[#1B2E3D] border border-[#2A4355]" style={{ color: '#87CBB9' }} title="Chi tiết">
                                        <Eye size={12} />
                                    </button>
                                    <button onClick={() => window.open(`/api/export/quotation-pdf?id=${row.id}&style=professional`, '_blank')}
                                        className="p-1 rounded bg-[#1B2E3D]/80 hover:bg-[#1B2E3D] border border-[#2A4355]" style={{ color: '#8AAEBB' }} title="Xem PDF">
                                        <Printer size={12} />
                                    </button>
                                    {['DRAFT', 'SENT'].includes(row.status) && (
                                        <button onClick={() => setSendDrawerOpen(row.id)}
                                            className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold rounded bg-[#1B2E3D]/80 hover:bg-[#1B2E3D] border"
                                            style={{ color: '#D4A853', borderColor: 'rgba(212,168,83,0.3)' }}>
                                            <Send size={10} /> Gửi
                                        </button>
                                    )}
                                    {['SENT', 'ACCEPTED'].includes(row.status) && (
                                        <button onClick={() => handleConvert(row.id)} disabled={actionLoading === row.id}
                                            className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold rounded bg-[#1B2E3D]/80 hover:bg-[#1B2E3D] border"
                                            style={{ color: '#87CBB9', borderColor: 'rgba(135,203,185,0.3)' }}>
                                            {actionLoading === row.id ? <Loader2 size={10} className="animate-spin" /> : <><ArrowRight size={10} /> → SO</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Detail Drawer */}
            {detailId && (
                <>
                    <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={() => setDetailId(null)} />
                    <div className="fixed top-0 right-0 h-full z-50 flex flex-col" style={{ width: 'min(580px,95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                            <h3 className="text-lg font-semibold font-brand" style={{ color: '#E8F1F2' }}>
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
                                        { 
                                            label: 'Khách Hàng', 
                                            value: detail.customer.code === 'KH-TEMP' ? (detail.companyName || detail.contactPerson || 'Khách Hàng Mới') : detail.customer.name, 
                                            color: '#E8F1F2' 
                                        },
                                        { label: 'Sales Rep', value: detail.salesRep.name, color: '#8AAEBB' },
                                    ].map(k => (
                                        <div key={k.label} className="p-3 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                            <p className="text-xs" style={{ color: '#4A6A7A' }}>{k.label}</p>
                                            <p className="text-sm font-bold mt-1" style={{ color: k.color }}>{k.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Hạn Báo Giá</p>
                                        <p className="text-sm font-bold mt-1 font-mono" style={{ color: new Date(detail.validUntil) < new Date() ? '#EF4444' : '#D4A853' }}>
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
                                {detail.customer.code === 'KH-TEMP' && (
                                    <div className="p-3 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#87CBB9' }}>Thông Tin Khách Hàng Ngoài Hệ Thống</p>
                                        <div className="space-y-1.5 text-xs text-slate-300">
                                            {detail.companyName && <p><strong>Doanh nghiệp:</strong> {detail.companyName}</p>}
                                            {detail.contactPerson && <p><strong>Người liên hệ:</strong> {detail.contactPerson}</p>}
                                            {detail.customerEmail && <p><strong>Email:</strong> {detail.customerEmail}</p>}
                                            {detail.customerPhone && <p><strong>Số điện thoại:</strong> {detail.customerPhone}</p>}
                                        </div>
                                    </div>
                                )}
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
                                                {detail.lines.map((l: any) => {
                                                    const total = Number(l.qtyOrdered) * Number(l.unitPrice) * (1 - Number(l.lineDiscountPct) / 100)
                                                    return (
                                                        <tr key={l.id} style={{ borderTop: '1px solid #2A4355' }}>
                                                            <td className="px-3 py-2" style={{ color: '#87CBB9' }}>{l.product.skuCode}</td>
                                                            <td className="px-3 py-2" style={{ color: '#E8F1F2' }}>{l.product.productName}</td>
                                                            <td className="px-3 py-2 text-right" style={{ color: '#8AAEBB' }}>{Number(l.qtyOrdered)}</td>
                                                            <td className="px-3 py-2 text-right" style={{ color: '#8AAEBB' }}>{formatVND(Number(l.unitPrice))}</td>
                                                            <td className="px-3 py-2 text-center" style={{ color: '#D4A853' }}>{Number(l.lineDiscountPct) > 0 ? `${Number(l.lineDiscountPct)}%` : '—'}</td>
                                                            <td className="px-3 py-2 text-right font-bold" style={{ color: '#87CBB9' }}>{formatVND(total)}</td>
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
                    <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={handleCloseCreateDrawer} />
                    <div className="fixed top-0 right-0 h-full z-50 flex flex-col" style={{ width: 'min(520px,95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                            <h3 className="text-lg font-semibold font-brand" style={{ color: '#E8F1F2' }}>Tạo Báo Giá Mới</h3>
                            <button onClick={handleCloseCreateDrawer} className="p-1.5 rounded" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                            {/* Customer */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Khách Hàng</label>
                                    <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#87CBB9' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={isNewCustomer} 
                                            onChange={e => {
                                                const checked = e.target.checked
                                                setIsNewCustomer(checked)
                                                setFormData(f => ({
                                                    ...f,
                                                    customerId: checked ? 'TEMP_CUSTOMER' : '',
                                                    companyName: '',
                                                    contactPerson: '',
                                                    customerEmail: '',
                                                    customerPhone: ''
                                                }))
                                            }}
                                            className="rounded border-[#2A4355] bg-[#142433] text-[#87CBB9] focus:ring-0 focus:ring-offset-0"
                                        />
                                        Khách hàng mới
                                    </label>
                                </div>
                                {!isNewCustomer ? (
                                    <select value={formData.customerId} onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                                        className="w-full mt-1.5 px-3 py-2.5 text-sm outline-none"
                                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}>
                                        <option value="">Chọn khách hàng...</option>
                                        {customers.length === 0 ? (
                                            <option disabled>⏳ Đang tải danh sách khách hàng...</option>
                                        ) : (
                                            customers.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)
                                        )}
                                    </select>
                                ) : (
                                    <div className="mt-2.5 p-3 rounded-md space-y-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                        <div>
                                            <label className="text-[11px] font-semibold mb-1 block" style={{ color: '#8AAEBB' }}>Tên Doanh Nghiệp / Đơn Vị</label>
                                            <input 
                                                type="text" 
                                                placeholder="VD: Nhà hàng Vườn Bia Hà Nội"
                                                value={formData.companyName} 
                                                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                                className="w-full px-3 py-2 text-xs outline-none rounded-md"
                                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold mb-1 block" style={{ color: '#8AAEBB' }}>Người Đại Diện / Liên Hệ</label>
                                            <input 
                                                type="text" 
                                                placeholder="VD: Anh Huy"
                                                value={formData.contactPerson} 
                                                onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                                                className="w-full px-3 py-2 text-xs outline-none rounded-md"
                                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[11px] font-semibold mb-1 block" style={{ color: '#8AAEBB' }}>Email</label>
                                                <input 
                                                    type="email" 
                                                    placeholder="VD: huy@example.com"
                                                    value={formData.customerEmail} 
                                                    onChange={e => setFormData({ ...formData, customerEmail: e.target.value })}
                                                    className="w-full px-3 py-2 text-xs outline-none rounded-md"
                                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-semibold mb-1 block" style={{ color: '#8AAEBB' }}>Số điện thoại</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="VD: 0912345678"
                                                    value={formData.customerPhone} 
                                                    onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                                                    className="w-full px-3 py-2 text-xs outline-none rounded-md"
                                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Sales Rep</label>
                                    <select value={formData.salesRepId} onChange={e => setFormData({ ...formData, salesRepId: e.target.value })}
                                        className="w-full mt-1 px-3 py-2.5 text-sm outline-none"
                                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}>
                                        <option value="">Chọn...</option>
                                        {reps.length === 0 ? (
                                            <option disabled>⏳ Đang tải...</option>
                                        ) : (
                                            reps.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)
                                        )}
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

                            <div className="flex items-center gap-2 py-1 select-none">
                                <input type="checkbox" id="showQuantity" checked={formData.showQuantity} onChange={e => setFormData({ ...formData, showQuantity: e.target.checked })}
                                    className="w-4 h-4 cursor-pointer accent-[#87CBB9]" />
                                <label htmlFor="showQuantity" className="text-xs font-semibold cursor-pointer" style={{ color: '#E8F1F2' }}>Hiển thị số lượng (SL) trên báo giá</label>
                            </div>

                            {/* Lines */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Sản Phẩm</p>
                                    <div className="flex gap-2">
                                        <button onClick={openPicker} disabled={products.length === 0} className="text-xs font-semibold px-2.5 py-1 transition-all disabled:opacity-50" style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', borderRadius: '4px' }}>
                                            {products.length === 0 ? '⏳ Đang tải...' : '🔍 Chọn Nhanh'}
                                        </button>
                                        <button onClick={addLine} disabled={products.length === 0} className="text-xs font-semibold px-2.5 py-1 transition-all disabled:opacity-50" style={{ background: 'rgba(138,174,187,0.15)', color: '#8AAEBB', borderRadius: '4px' }}>+ Thêm dòng</button>
                                    </div>
                                </div>
                                <div className="space-y-2.5">
                                    {formLines.map((line, i) => {
                                        const prod = products.find(p => p.id === line.productId)
                                        
                                        // Calculate metrics
                                        const diffPct = prod && prod.wholesalePrice > 0 ? ((line.price - prod.wholesalePrice) / prod.wholesalePrice) * 100 : 0
                                        const marginPct = prod && line.price > 0 ? ((line.price - prod.costPrice) / line.price) * 100 : 0
                                        
                                        return (
                                            <div key={i} className="p-3 rounded-sm space-y-2.5 transition-all" style={{ background: '#142433', border: '1px solid #2A4355', borderRadius: '4px' }}>
                                                {/* Header row: dropdown selector or product info */}
                                                {!line.productId ? (
                                                    <div className="flex items-center gap-2">
                                                        <select value={line.productId} onChange={e => selectProductForLine(i, e.target.value)}
                                                            className="flex-1 px-2.5 py-1.5 text-xs outline-none"
                                                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}>
                                                            <option value="">Chọn sản phẩm...</option>
                                                            {products.length === 0 ? (
                                                                <option disabled>⏳ Đang tải sản phẩm...</option>
                                                            ) : (
                                                                products.map((p: any) => <option key={p.id} value={p.id}>{p.skuCode} — {p.productName}</option>)
                                                            )}
                                                        </select>
                                                        <button onClick={() => removeLine(i)} className="p-1.5 text-xs" style={{ color: '#8B1A2E' }}>✕</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-3">
                                                        {/* Horizontal Image thumbnail */}
                                                        <div className="w-16 h-12 rounded-sm overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#091520', border: '1px solid #2A4355' }}>
                                                            {prod?.primaryImageUrl ? (
                                                                <img src={prod.primaryImageUrl} alt="" className="max-w-full max-h-full object-contain" />
                                                            ) : (
                                                                <span className="text-xs">🍷</span>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-1">
                                                                <h5 className="text-xs font-bold truncate" style={{ color: '#E8F1F2' }} title={prod?.productName}>{prod?.productName}</h5>
                                                                <button onClick={() => removeLine(i)} className="p-0.5 text-xs flex-shrink-0" style={{ color: '#8B1A2E' }}>✕</button>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] font-mono" style={{ color: '#8AAEBB' }}>{prod?.skuCode}</span>
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: prod && prod.totalStock > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: prod && prod.totalStock > 0 ? '#22C55E' : '#EF4444' }}>
                                                                    Tồn: {prod?.totalStock}
                                                                </span>
                                                                <span className="text-[10px] text-[#4A6A7A] truncate">
                                                                    {prod?.supplierName}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Numeric controls and indicators if product is selected */}
                                                {line.productId && prod && (
                                                    <div className="space-y-2">
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <div>
                                                                <label className="text-xs uppercase tracking-wider block mb-0.5" style={{ color: '#4A6A7A' }}>SL</label>
                                                                <input type="number" value={line.qty} onChange={e => updateLine(i, 'qty', Number(e.target.value))} placeholder="SL"
                                                                    className="w-full px-2 py-1 text-xs outline-none text-center" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }} />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs uppercase tracking-wider block mb-0.5" style={{ color: '#4A6A7A' }}>Giá báo khách</label>
                                                                <input type="number" value={line.price} onChange={e => updateLine(i, 'price', Number(e.target.value))} placeholder="Giá"
                                                                    className="w-full px-2 py-1 text-xs outline-none text-right" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#D4A853', fontFamily: '"DM Mono"', borderRadius: '4px' }} />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs uppercase tracking-wider block mb-0.5" style={{ color: '#4A6A7A' }}>CK%</label>
                                                                <input type="number" value={line.discount} onChange={e => updateLine(i, 'discount', Number(e.target.value))} placeholder="CK%"
                                                                    className="w-full px-2 py-1 text-xs outline-none text-center" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }} />
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Reference metrics row */}
                                                        <div className="flex items-center justify-between text-[10px] px-1 py-0.5 rounded" style={{ background: '#0D1E2B' }}>
                                                            <div className="flex items-center gap-1.5">
                                                                <span style={{ color: '#4A6A7A' }}>Wholesale:</span>
                                                                <span className="font-mono font-semibold text-[#D4A853]">{prod.wholesalePrice.toLocaleString('vi-VN')} đ</span>
                                                                <span className="font-semibold" style={{ color: diffPct >= 0 ? '#5BA88A' : '#EF4444' }}>
                                                                    {diffPct >= 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`}
                                                                </span>
                                                            </div>
                                                            {prod.costPrice > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <span style={{ color: '#4A6A7A' }}>Lãi gộp:</span>
                                                                    <span className="font-semibold" style={{ color: marginPct >= 15 ? '#87CBB9' : marginPct >= 0 ? '#D4A853' : '#EF4444' }}>
                                                                        {marginPct.toFixed(1)}%
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={handlePreview} disabled={!formData.customerId || formLines.length === 0}
                                    type="button"
                                    className="flex-1 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 border"
                                    style={{ background: 'rgba(138,174,187,0.1)', color: '#8AAEBB', borderColor: 'rgba(138,174,187,0.25)', borderRadius: '6px' }}
                                    onMouseEnter={e => {
                                        if (formData.customerId && formLines.length > 0) {
                                            e.currentTarget.style.background = 'rgba(138,174,187,0.2)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'rgba(138,174,187,0.1)';
                                    }}
                                >
                                    👁️ Xem Trước
                                </button>
                                <button onClick={handleCreate} disabled={saving || !formData.customerId || formLines.length === 0}
                                    className="w-[60%] py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                                    {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Tạo Báo Giá'}
                                </button>
                            </div>
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
                            <h3 className="text-lg font-semibold font-brand" style={{ color: '#E8F1F2' }}>Gửi Báo Giá</h3>
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

            {/* Quick Product Picker Modal */}
            {pickerOpen && (
                <>
                    <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(10,5,2,0.8)' }} onClick={() => setPickerOpen(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] flex flex-col rounded-sm"
                        style={{ width: 'min(780px,95vw)', height: 'min(620px,90vh)', background: '#0D1E2B', border: '1px solid #2A4355', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
                        
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                            <div>
                                <h3 className="text-lg font-bold font-brand" style={{ color: '#E8F1F2' }}>
                                    🔍 Chọn sản phẩm nhanh
                                </h3>
                                <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>
                                    Tìm kiếm, lọc danh sách và tích chọn hàng loạt sản phẩm để thêm vào báo giá
                                </p>
                            </div>
                            <button onClick={() => setPickerOpen(false)} className="p-1.5 rounded" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>

                        {/* Filters Bar */}
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                                <input 
                                    value={pickerSearch} 
                                    onChange={e => setPickerSearch(e.target.value)}
                                    placeholder="Tìm SKU, tên sản phẩm..."
                                    className="w-full pl-9 pr-4 py-1.5 text-xs outline-none"
                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }} 
                                />
                            </div>
                            <select 
                                value={pickerCountry} 
                                onChange={e => setPickerCountry(e.target.value)}
                                className="px-3 py-1.5 text-xs outline-none cursor-pointer"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: pickerCountry ? '#E8F1F2' : '#4A6A7A', borderRadius: '4px' }}
                            >
                                <option value="">Tất cả quốc gia</option>
                                {[...new Set(products.map(p => p.country).filter(Boolean))].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <select 
                                value={pickerWineType} 
                                onChange={e => setPickerWineType(e.target.value)}
                                className="px-3 py-1.5 text-xs outline-none cursor-pointer"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: pickerWineType ? '#E8F1F2' : '#4A6A7A', borderRadius: '4px' }}
                            >
                                <option value="">Tất cả loại rượu</option>
                                {[...new Set(products.map(p => p.wineType).filter(Boolean))].map(w => (
                                    <option key={w} value={w}>{w}</option>
                                ))}
                            </select>
                        </div>

                        {/* Product List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {(() => {
                                const filtered = products.filter(p => {
                                    const matchSearch = pickerSearch ? (p.skuCode.toLowerCase().includes(pickerSearch.toLowerCase()) || p.productName.toLowerCase().includes(pickerSearch.toLowerCase())) : true
                                    const matchCountry = pickerCountry ? p.country === pickerCountry : true
                                    const matchWineType = pickerWineType ? p.wineType === pickerWineType : true
                                    return matchSearch && matchCountry && matchWineType
                                })

                                if (filtered.length === 0) {
                                    return (
                                        <div className="text-center py-12" style={{ color: '#4A6A7A' }}>
                                            Không tìm thấy sản phẩm phù hợp bộ lọc
                                        </div>
                                    )
                                }

                                return filtered.map(p => {
                                    const selection = pickerSelected[p.id] || { qty: 1, checked: false }
                                    const handleCheckboxChange = (checked: boolean) => {
                                        setPickerSelected({
                                            ...pickerSelected,
                                            [p.id]: { ...selection, checked }
                                        })
                                    }
                                    const handleQtyChange = (qty: number) => {
                                        setPickerSelected({
                                            ...pickerSelected,
                                            [p.id]: { ...selection, qty: Math.max(1, qty) }
                                        })
                                    }

                                    return (
                                        <div 
                                            key={p.id} 
                                            onClick={() => handleCheckboxChange(!selection.checked)}
                                            className="p-2.5 rounded-sm flex items-center gap-3 transition-all cursor-pointer"
                                            style={{ 
                                                background: selection.checked ? 'rgba(135,203,185,0.04)' : '#142433', 
                                                border: selection.checked ? '1px solid rgba(135,203,185,0.3)' : '1px solid #2A4355',
                                                borderRadius: '4px'
                                            }}
                                        >
                                            {/* Checkbox */}
                                            <input 
                                                type="checkbox" 
                                                checked={selection.checked} 
                                                onChange={e => handleCheckboxChange(e.target.checked)}
                                                onClick={e => e.stopPropagation()} 
                                                className="cursor-pointer accent-[#87CBB9]" 
                                            />

                                            {/* Image - Horizontal */}
                                            <div className="w-16 h-12 rounded-sm overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: '#091520', border: '1px solid #2A4355' }}>
                                                {p.primaryImageUrl ? (
                                                    <img src={p.primaryImageUrl} alt="" className="max-w-full max-h-full object-contain" />
                                                ) : (
                                                    <span className="text-xs">🍷</span>
                                                )}
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <h4 className="text-xs font-bold truncate" style={{ color: selection.checked ? '#87CBB9' : '#E8F1F2' }}>
                                                        {p.productName}
                                                    </h4>
                                                    <span className="text-xs font-bold text-[#D4A853] font-mono">
                                                        {p.wholesalePrice.toLocaleString('vi-VN')} đ
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-mono" style={{ color: '#8AAEBB' }}>{p.skuCode}</span>
                                                    <span className="text-[10px] text-[#4A6A7A]">•</span>
                                                    <span className="text-[10px] text-[#8AAEBB]">{p.wineType} ({p.country})</span>
                                                    <span className="text-[10px] text-[#4A6A7A]">•</span>
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full" style={{ background: p.totalStock > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: p.totalStock > 0 ? '#22C55E' : '#EF4444' }}>
                                                        Tồn: {p.totalStock}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Quantity input inside picker card */}
                                            <div className="flex-shrink-0 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                <span className="text-[10px]" style={{ color: '#4A6A7A' }}>SL:</span>
                                                <input 
                                                    type="number" 
                                                    min={1} 
                                                    value={selection.qty}
                                                    onChange={e => handleQtyChange(Number(e.target.value))}
                                                    className="w-12 px-1 py-0.5 text-center text-xs outline-none"
                                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="p-4 flex items-center justify-between" style={{ borderTop: '1px solid #2A4355', background: '#142433' }}>
                            <div className="text-xs" style={{ color: '#8AAEBB' }}>
                                Đã chọn: <strong className="text-[#87CBB9]">{Object.values(pickerSelected).filter(s => s.checked).length}</strong> sản phẩm
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setPickerOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold rounded"
                                    style={{ background: 'rgba(138,174,187,0.1)', color: '#8AAEBB', borderRadius: '4px' }}
                                >
                                    Hủy bỏ
                                </button>
                                <button 
                                    onClick={confirmPickerAdd}
                                    className="px-5 py-2 text-xs font-semibold rounded"
                                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '4px' }}
                                >
                                    Xác nhận thêm
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

