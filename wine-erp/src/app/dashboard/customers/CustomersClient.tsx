'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    Plus, Users, Building2, CreditCard, ShoppingBag, X, Save, Loader2, AlertCircle,
    Upload, Download, Search, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import {
    CustomerRow, CustomerInput, CustomerStats, CustomerFilters,
    createCustomer, updateCustomer, getCustomers, getCustomerById,
    deleteCustomer, exportCustomersData, bulkImportCustomers,
} from './actions'
import { formatVND } from '@/lib/utils'
import { ExcelImportDialog } from '@/components/ExcelImportDialog'
import { toast } from 'sonner'

const CUSTOMER_TYPE: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
    HORECA: { label: 'HORECA', color: '#87CBB9', bg: 'rgba(135,203,185,0.12)', emoji: '🏨' },
    WHOLESALE_DISTRIBUTOR: { label: 'Phân Phối', color: '#5BA88A', bg: 'rgba(74,124,89,0.12)', emoji: '🏭' },
    VIP_RETAIL: { label: 'VIP Retail', color: '#87CBB9', bg: 'rgba(168,130,204,0.12)', emoji: '👑' },
    INDIVIDUAL: { label: 'Cá Nhân', color: '#7AC4C4', bg: 'rgba(122,196,196,0.12)', emoji: '👤' },
}

const CHANNEL_LABEL: Record<string, string> = {
    HORECA: 'HORECA (Khách sạn/Nhà hàng)',
    WHOLESALE_DISTRIBUTOR: 'Phân Phối Sỉ',
    VIP_RETAIL: 'Bán Lẻ VIP',
    DIRECT_INDIVIDUAL: 'Cá Nhân Trực Tiếp',
}

const CITIES = [
    'Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Nha Trang', 'Phú Quốc', 'Hội An',
    'Hải Phòng', 'Cần Thơ', 'Huế', 'Vũng Tàu', 'Đà Lạt', 'Quy Nhơn', 'Phan Thiết', 'Sapa',
]

function TypeBadge({ type }: { type: string }) {
    const cfg = CUSTOMER_TYPE[type] ?? { label: type, color: '#8AAEBB', bg: 'rgba(168,152,128,0.12)', emoji: '🏢' }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ color: cfg.color, background: cfg.bg }}>
            {cfg.emoji} {cfg.label}
        </span>
    )
}

function StatusDot({ status }: { status: string }) {
    const color = { ACTIVE: '#5BA88A', INACTIVE: '#4A6A7A', CREDIT_HOLD: '#D4963A' }[status] ?? '#4A6A7A'
    const label = { ACTIVE: 'Hoạt động', INACTIVE: 'Tạm dừng', CREDIT_HOLD: 'Giữ tín dụng' }[status] ?? status
    return (
        <span className="flex items-center gap-1.5 text-xs" style={{ color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {label}
        </span>
    )
}

function SortIcon({ column, sortBy, sortDir }: { column: string; sortBy?: string; sortDir?: string }) {
    if (sortBy !== column) return <ArrowUpDown size={11} style={{ color: '#2A4355' }} />
    return sortDir === 'asc'
        ? <ArrowUp size={11} style={{ color: '#87CBB9' }} />
        : <ArrowDown size={11} style={{ color: '#87CBB9' }} />
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.FC<any>; accent: string }) {
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}20` }}>
                <Icon size={20} style={{ color: accent }} />
            </div>
            <div>
                <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{label}</p>
                <p className="text-lg font-bold mt-0.5" style={{ color: '#E8F1F2', fontFamily: '"DM Mono", monospace' }}>{value}</p>
            </div>
        </div>
    )
}

// ════════════════════════════════════════════════════════
// CUSTOMER DRAWER (Create + Edit)
// ════════════════════════════════════════════════════════

function CustomerDrawer({ open, editingId, salesReps, onClose, onSaved }: {
    open: boolean; editingId: string | null
    salesReps: { id: string; name: string }[]
    onClose: () => void; onSaved: () => void
}) {
    const [form, setForm] = useState<Partial<CustomerInput>>({
        paymentTerm: 'NET30', creditLimit: 0, status: 'ACTIVE', customerType: 'HORECA',
    })
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    const isEdit = !!editingId

    useEffect(() => {
        if (!open) return
        if (editingId) {
            setLoading(true)
            getCustomerById(editingId).then(data => {
                if (data) {
                    setForm({
                        code: data.code,
                        name: data.name,
                        shortName: data.shortName,
                        taxId: data.taxId,
                        customerType: data.customerType as any,
                        channel: data.channel as any,
                        paymentTerm: data.paymentTerm,
                        creditLimit: data.creditLimit,
                        salesRepId: data.salesRepId,
                        status: data.status as any,
                        contactName: data.contactName,
                        email: data.email,
                        phone: data.phone,
                        address: data.address,
                        ward: data.ward,
                        district: data.district,
                        city: data.city,
                    })
                }
            }).finally(() => setLoading(false))
        } else {
            setForm({ paymentTerm: 'NET30', creditLimit: 0, status: 'ACTIVE', customerType: 'HORECA' })
        }
        setErrors({})
    }, [open, editingId])

    const set = (k: keyof CustomerInput, v: any) => setForm(f => ({ ...f, [k]: v }))
    const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    const handleSave = async () => {
        const e: Record<string, string> = {}
        if (!form.code) e.code = 'Bắt buộc'
        if (!form.name) e.name = 'Bắt buộc'
        setErrors(e)
        if (Object.keys(e).length) return
        setSaving(true)
        try {
            if (isEdit) {
                await updateCustomer(editingId!, form as CustomerInput)
                toast.success('Đã cập nhật khách hàng')
            } else {
                await createCustomer(form as CustomerInput)
                toast.success('Đã tạo khách hàng mới')
            }
            onSaved()
        } catch (err: any) {
            setErrors({ _global: err.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <div className="fixed inset-0 z-40 transition-opacity duration-300"
                style={{ background: 'rgba(10,5,2,0.7)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
                onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300"
                style={{ width: 'min(560px, 95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355', transform: open ? 'translateX(0)' : 'translateX(100%)' }}>
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.15)' }}>
                            <Users size={16} style={{ color: '#87CBB9' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>
                                {isEdit ? 'Chỉnh Sửa Khách Hàng' : 'Thêm Khách Hàng'}
                            </h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                {isEdit ? 'Điền thông tin đầy đủ về khách hàng' : 'Khách sạn, nhà hàng, phân phối, VIP retail'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#4A6A7A' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
                    ) : (
                        <>
                            {errors._global && (
                                <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                                    style={{ background: 'rgba(139,26,46,0.15)', border: '1px solid rgba(139,26,46,0.4)', color: '#E05252' }}>
                                    <AlertCircle size={14} /> {errors._global}
                                </div>
                            )}

                            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>── Thông Tin Cơ Bản</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Mã KH <span style={{ color: '#8B1A2E' }}>*</span></label>
                                    <input className={inputCls} style={inputStyle} value={form.code ?? ''} placeholder="CUS-PARKHYATT"
                                        onChange={e => set('code', e.target.value.toUpperCase())} disabled={isEdit}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                                    {errors.code && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>{errors.code}</p>}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Loại KH</label>
                                    <select className={inputCls} style={inputStyle} value={form.customerType ?? 'HORECA'}
                                        onChange={e => set('customerType', e.target.value as any)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                        <option value="HORECA">🏨 HORECA</option>
                                        <option value="WHOLESALE_DISTRIBUTOR">🏭 Phân Phối Sỉ</option>
                                        <option value="VIP_RETAIL">👑 VIP Retail</option>
                                        <option value="INDIVIDUAL">👤 Cá Nhân</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Tên Khách Hàng <span style={{ color: '#8B1A2E' }}>*</span></label>
                                <input className={inputCls} style={inputStyle} value={form.name ?? ''} placeholder="Park Hyatt Saigon"
                                    onChange={e => set('name', e.target.value)}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                                {errors.name && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>{errors.name}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Tên viết tắt</label>
                                    <input className={inputCls} style={inputStyle} value={form.shortName ?? ''} placeholder="PH Saigon"
                                        onChange={e => set('shortName', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Mã số thuế</label>
                                    <input className={inputCls} style={inputStyle} value={form.taxId ?? ''} placeholder="0302012345"
                                        onChange={e => set('taxId', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Kênh bán hàng</label>
                                    <select className={inputCls} style={inputStyle} value={form.channel ?? ''}
                                        onChange={e => set('channel', e.target.value as any || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                        <option value="">— Chọn kênh —</option>
                                        {Object.entries(CHANNEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Sales phụ trách</label>
                                    <select className={inputCls} style={inputStyle} value={form.salesRepId ?? ''}
                                        onChange={e => set('salesRepId', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                        <option value="">— Chọn Sales —</option>
                                        {salesReps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#87CBB9' }}>── Liên Hệ & Địa Chỉ</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Người liên hệ</label>
                                    <input className={inputCls} style={inputStyle} value={form.contactName ?? ''} placeholder="Nguyễn Văn A"
                                        onChange={e => set('contactName', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Số điện thoại</label>
                                    <input className={inputCls} style={inputStyle} value={form.phone ?? ''} placeholder="0901234567"
                                        onChange={e => set('phone', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Email</label>
                                <input type="email" className={inputCls} style={inputStyle} value={form.email ?? ''} placeholder="contact@hotel.com"
                                    onChange={e => set('email', e.target.value || null)}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Địa chỉ</label>
                                <input className={inputCls} style={inputStyle} value={form.address ?? ''} placeholder="123 Đường Lê Lai, Quận 1"
                                    onChange={e => set('address', e.target.value || null)}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Phường/Xã</label>
                                    <input className={inputCls} style={inputStyle} value={form.ward ?? ''} placeholder="Phường Bến Nghé"
                                        onChange={e => set('ward', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Quận/Huyện</label>
                                    <input className={inputCls} style={inputStyle} value={form.district ?? ''} placeholder="Quận 1"
                                        onChange={e => set('district', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Thành phố</label>
                                    <select className={inputCls} style={inputStyle} value={form.city ?? ''}
                                        onChange={e => set('city', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                        <option value="">— Chọn —</option>
                                        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#87CBB9' }}>── Tín Dụng & Thanh Toán</p>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Điều khoản</label>
                                    <select className={inputCls} style={inputStyle} value={form.paymentTerm ?? 'NET30'}
                                        onChange={e => set('paymentTerm', e.target.value)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                        <option value="COD">COD</option>
                                        <option value="NET15">NET 15</option>
                                        <option value="NET30">NET 30</option>
                                        <option value="NET45">NET 45</option>
                                        <option value="NET60">NET 60</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Hạn mức (VND)</label>
                                    <input type="number" className={inputCls} style={inputStyle} value={form.creditLimit ?? 0}
                                        onChange={e => set('creditLimit', Number(e.target.value))} step={50000000}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Trạng thái</label>
                                    <select className={inputCls} style={inputStyle} value={form.status ?? 'ACTIVE'}
                                        onChange={e => set('status', e.target.value as any)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')} onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                        <option value="ACTIVE">Hoạt động</option>
                                        <option value="CREDIT_HOLD">Giữ tín dụng</option>
                                        <option value="INACTIVE">Tạm dừng</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #2A4355' }}>
                    <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm"
                        style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>Hủy</button>
                    <button onClick={handleSave} disabled={saving || loading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                        style={{ background: '#87CBB9', color: '#0A1926' }}
                        onMouseEnter={e => !saving && (e.currentTarget.style.background = '#A5DED0')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo KH'}
                    </button>
                </div>
            </div>
        </>
    )
}

// ════════════════════════════════════════════════════════
// MAIN CLIENT COMPONENT
// ════════════════════════════════════════════════════════

interface CustomersClientProps {
    initialRows: CustomerRow[]
    initialTotal: number
    stats: CustomerStats
    channels: { channel: string; count: number }[]
    salesReps: { id: string; name: string }[]
}

export function CustomersClient({ initialRows, initialTotal, stats, channels, salesReps }: CustomersClientProps) {
    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [loading, setLoading] = useState(false)
    const [filters, setFilters] = useState<CustomerFilters>({ page: 1, pageSize: 25 })
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [importOpen, setImportOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [channelFilter, setChannelFilter] = useState('')
    const [exporting, setExporting] = useState(false)

    const applyFilter = useCallback(async (newFilters: Partial<CustomerFilters>) => {
        const merged = { ...filters, ...newFilters, page: newFilters.page ?? 1 }
        setFilters(merged)
        setLoading(true)
        try {
            const result = await getCustomers(merged)
            setRows(result.rows)
            setTotal(result.total)
        } finally {
            setLoading(false)
        }
    }, [filters])

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Xóa khách hàng "${name}"?\n\nKH sẽ bị đánh dấu Tạm dừng (soft delete). Nếu KH đang có đơn hàng chưa hoàn tất sẽ không xóa được.`)) return
        try {
            const result = await deleteCustomer(id)
            if (result.success) {
                toast.success(`Đã xóa "${name}"`)
                applyFilter({})
            } else {
                toast.error(result.error ?? 'Không thể xóa')
            }
        } catch {
            toast.error('Lỗi khi xóa khách hàng')
        }
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const data = await exportCustomersData()
            if (data.length === 0) { toast.error('Chưa có KH để xuất'); return }
            const headers = Object.keys(data[0])
            const csvRows = [
                headers.join(','),
                ...data.map(row =>
                    headers.map(h => {
                        const val = String((row as any)[h] ?? '')
                        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
                    }).join(',')
                ),
            ]
            const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `danh_sach_khach_hang_${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            URL.revokeObjectURL(url)
            toast.success(`Đã xuất ${data.length} khách hàng`)
        } catch {
            toast.error('Lỗi xuất dữ liệu')
        } finally {
            setExporting(false)
        }
    }

    const handleSort = (sortBy: CustomerFilters['sortBy']) => {
        const newDir = filters.sortBy === sortBy && filters.sortDir === 'asc' ? 'desc' : 'asc'
        applyFilter({ sortBy, sortDir: newDir })
    }

    const sortableHeaders: { key: CustomerFilters['sortBy'] | undefined; label: string; cls: string; sortable: boolean }[] = [
        { key: 'name', label: 'Khách Hàng', cls: 'px-4 py-3 w-[280px]', sortable: true },
        { key: undefined, label: 'Loại', cls: 'px-3 py-3 w-[120px]', sortable: false },
        { key: undefined, label: 'MST', cls: 'px-3 py-3 w-[110px]', sortable: false },
        { key: undefined, label: 'Sales Rep', cls: 'px-3 py-3 w-[130px]', sortable: false },
        { key: undefined, label: 'Thanh Toán', cls: 'px-3 py-3 w-[90px]', sortable: false },
        { key: 'creditLimit', label: 'Hạn Mức', cls: 'px-3 py-3 w-[140px]', sortable: true },
        { key: 'orderCount', label: 'Đơn Hàng', cls: 'px-3 py-3 w-[80px] text-center', sortable: true },
        { key: undefined, label: 'Trạng Thái', cls: 'px-3 py-3 w-[100px]', sortable: false },
        { key: undefined, label: '', cls: 'px-3 py-3 w-[70px]', sortable: false },
    ]

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Khách Hàng (CRM)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        B2B: Khách sạn, nhà hàng, phân phối, VIP retail — {stats.total} khách hàng
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleExport} disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        style={{ background: '#1B2E3D', color: '#5BA88A', border: '1px solid #2A4355' }}
                        onMouseEnter={e => { if (!exporting) { e.currentTarget.style.background = '#142433'; e.currentTarget.style.borderColor = '#5BA88A' } }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#1B2E3D'; e.currentTarget.style.borderColor = '#2A4355' }}>
                        <Download size={16} /> {exporting ? 'Đang xuất...' : 'Export CSV'}
                    </button>
                    <button onClick={() => setImportOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                        style={{ background: '#1B2E3D', color: '#4A8FAB', border: '1px solid #2A4355' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#142433'; e.currentTarget.style.borderColor = '#4A8FAB' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#1B2E3D'; e.currentTarget.style.borderColor = '#2A4355' }}>
                        <Upload size={16} /> Import Excel
                    </button>
                    <button onClick={() => { setEditingId(null); setDrawerOpen(true) }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
                        style={{ background: '#87CBB9', color: '#0A1926' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                        <Plus size={16} /> Thêm Khách Hàng
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Tổng KH" value={stats.total} icon={Users} accent="#87CBB9" />
                <StatCard label="Hoạt động" value={stats.active} icon={Building2} accent="#5BA88A" />
                <StatCard label="Có hạn mức" value={stats.withCredit} icon={ShoppingBag} accent="#4A8FAB" />
                <StatCard label="Tổng hạn mức" value={formatVND(stats.totalCreditLimit)} icon={CreditCard} accent="#87CBB9" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input type="text" placeholder="Tìm theo tên, mã, MST, email, SĐT..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); applyFilter({ search: e.target.value || undefined }) }}
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                </div>
                <select value={typeFilter}
                    onChange={e => { setTypeFilter(e.target.value); applyFilter({ type: e.target.value || undefined }) }}
                    className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: typeFilter ? '#E8F1F2' : '#4A6A7A' }}>
                    <option value="">Tất cả loại</option>
                    <option value="HORECA">🏨 HORECA</option>
                    <option value="WHOLESALE_DISTRIBUTOR">🏭 Phân Phối</option>
                    <option value="VIP_RETAIL">👑 VIP Retail</option>
                    <option value="INDIVIDUAL">👤 Cá Nhân</option>
                </select>
                <select value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); applyFilter({ status: e.target.value || undefined }) }}
                    className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: statusFilter ? '#E8F1F2' : '#4A6A7A' }}>
                    <option value="">Trạng thái</option>
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="CREDIT_HOLD">Giữ tín dụng</option>
                    <option value="INACTIVE">Tạm dừng</option>
                </select>
                <select value={channelFilter}
                    onChange={e => { setChannelFilter(e.target.value); applyFilter({ channel: e.target.value || undefined }) }}
                    className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: channelFilter ? '#E8F1F2' : '#4A6A7A' }}>
                    <option value="">Tất cả kênh</option>
                    {channels.map(c => (
                        <option key={c.channel} value={c.channel}>{CHANNEL_LABEL[c.channel] ?? c.channel} ({c.count})</option>
                    ))}
                </select>
                {(search || typeFilter || statusFilter || channelFilter) && (
                    <button onClick={() => {
                        setSearch(''); setTypeFilter(''); setStatusFilter(''); setChannelFilter('')
                        applyFilter({ search: undefined, type: undefined, status: undefined, channel: undefined })
                    }} className="px-3 py-2.5 rounded-lg text-sm"
                        style={{ color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.3)' }}>
                        Xóa filter
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                {sortableHeaders.map((h, i) => (
                                    <th key={i} className={`${h.cls} text-xs uppercase tracking-wider font-semibold ${h.sortable ? 'cursor-pointer select-none' : ''}`}
                                        style={{ color: h.sortable && filters.sortBy === h.key ? '#87CBB9' : '#4A6A7A' }}
                                        onClick={() => h.sortable && h.key && handleSort(h.key)}>
                                        <span className="inline-flex items-center gap-1.5">
                                            {h.label}
                                            {h.sortable && h.key && <SortIcon column={h.key} sortBy={filters.sortBy} sortDir={filters.sortDir} />}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(61,43,31,0.6)' }}>
                                        {sortableHeaders.map((_, j) => (
                                            <td key={j} className="px-4 py-4">
                                                <div className="h-4 rounded animate-pulse" style={{ background: '#1B2E3D', width: j === 0 ? '80%' : '55%' }} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={9}>
                                    <div className="flex flex-col items-center py-16 gap-3">
                                        <span className="text-3xl">👥</span>
                                        <p style={{ color: '#4A6A7A' }} className="text-sm">Chưa có khách hàng nào</p>
                                    </div>
                                </td></tr>
                            ) : rows.map(row => (
                                <tr key={row.id} className="group transition-colors duration-100"
                                    style={{ borderBottom: '1px solid rgba(61,43,31,0.6)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(61,43,31,0.35)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                    <td className="px-4 py-3">
                                        <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{row.name}</p>
                                        <p className="text-xs mt-0.5" style={{ color: '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>{row.code}</p>
                                    </td>
                                    <td className="px-3 py-3"><TypeBadge type={row.customerType} /></td>
                                    <td className="px-3 py-3 text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>{row.taxId ?? '—'}</td>
                                    <td className="px-3 py-3 text-xs" style={{ color: row.salesRepName ? '#8AAEBB' : '#2A4355' }}>
                                        {row.salesRepName ?? '—'}
                                    </td>
                                    <td className="px-3 py-3 text-xs font-semibold" style={{ color: '#8AAEBB', fontFamily: '"DM Mono", monospace' }}>{row.paymentTerm}</td>
                                    <td className="px-3 py-3 text-sm" style={{ color: row.creditLimit > 0 ? '#87CBB9' : '#2A4355', fontFamily: '"DM Mono", monospace' }}>
                                        {row.creditLimit > 0 ? formatVND(row.creditLimit) : '—'}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <span className="text-sm font-bold" style={{ color: row.orderCount > 0 ? '#5BA88A' : '#2A4355', fontFamily: '"DM Mono", monospace' }}>
                                            {row.orderCount}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3"><StatusDot status={row.status} /></td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => { setEditingId(row.id); setDrawerOpen(true) }}
                                                className="p-1.5 rounded-lg transition-all" style={{ color: '#8AAEBB' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(135,203,185,0.15)'; e.currentTarget.style.color = '#87CBB9' }}
                                                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#8AAEBB' }}
                                                title="Chỉnh sửa"><Edit2 size={14} /></button>
                                            <button onClick={() => handleDelete(row.id, row.name)}
                                                className="p-1.5 rounded-lg transition-all" style={{ color: '#4A6A7A' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,26,46,0.15)'; e.currentTarget.style.color = '#E05252' }}
                                                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#4A6A7A' }}
                                                title="Xóa"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {total > 0 && (
                    <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #2A4355', background: '#142433' }}>
                        <p className="text-xs" style={{ color: '#4A6A7A' }}>
                            Hiển thị <span style={{ color: '#8AAEBB' }}>{((filters.page ?? 1) - 1) * 25 + 1}–{Math.min((filters.page ?? 1) * 25, total)}</span> trong <span style={{ color: '#8AAEBB' }}>{total}</span>
                        </p>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.ceil(total / 25) }).map((_, i) => (
                                <button key={i} onClick={() => applyFilter({ page: i + 1 })}
                                    className="min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium"
                                    style={{ background: (filters.page ?? 1) === i + 1 ? '#87CBB9' : 'transparent', color: (filters.page ?? 1) === i + 1 ? '#0A1926' : '#8AAEBB' }}>
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <CustomerDrawer
                open={drawerOpen} editingId={editingId}
                salesReps={salesReps}
                onClose={() => setDrawerOpen(false)}
                onSaved={() => { setDrawerOpen(false); applyFilter({}) }}
            />

            <ExcelImportDialog
                open={importOpen}
                onClose={() => setImportOpen(false)}
                title="Import Khách Hàng"
                templateFileName="template_khach_hang.xlsx"
                templateColumns={[
                    { header: 'Mã KH', sample: 'CUS-PARKHYATT', required: true },
                    { header: 'Tên KH', sample: 'Park Hyatt Saigon', required: true },
                    { header: 'Tên Viết Tắt', sample: 'PH Saigon' },
                    { header: 'Loại KH', sample: 'HORECA', required: true },
                    { header: 'Kênh', sample: 'HORECA' },
                    { header: 'MST', sample: '0302012345' },
                    { header: 'Thanh Toán', sample: 'NET30' },
                    { header: 'Hạn Mức', sample: '500000000' },
                    { header: 'Người Liên Hệ', sample: 'Nguyễn Văn A' },
                    { header: 'Email', sample: 'contact@parkhyatt.com' },
                    { header: 'SĐT', sample: '0281234567' },
                    { header: 'Địa Chỉ', sample: '2 Công Trường Lam Sơn, Q.1' },
                    { header: 'Thành Phố', sample: 'Hồ Chí Minh' },
                ]}
                onImport={bulkImportCustomers}
                onComplete={() => applyFilter({})}
            />
        </div>
    )
}
