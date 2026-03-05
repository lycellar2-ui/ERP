'use client'

import { useState } from 'react'
import { Search, Plus, Users, Building2, CreditCard, ShoppingBag, X, Save, Loader2, AlertCircle } from 'lucide-react'
import { CustomerRow, CustomerInput, createCustomer } from './actions'
import { formatVND } from '@/lib/utils'

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
    const color = { ACTIVE: '#5BA88A', INACTIVE: '#4A6A7A', BLOCKED: '#8B1A2E' }[status] ?? '#4A6A7A'
    const label = { ACTIVE: 'Hoạt động', INACTIVE: 'Tạm dừng', BLOCKED: 'Bị khóa' }[status] ?? status
    return (
        <span className="flex items-center gap-1.5 text-xs" style={{ color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {label}
        </span>
    )
}

function AddCustomerDrawer({ open, onClose, onSaved }: {
    open: boolean; onClose: () => void; onSaved: () => void
}) {
    const [form, setForm] = useState<Partial<CustomerInput>>({
        paymentTerm: 'NET30', creditLimit: 0, status: 'ACTIVE', customerType: 'HORECA',
    })
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

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
            await createCustomer(form as CustomerInput)
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
                style={{ width: 'min(520px, 95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355', transform: open ? 'translateX(0)' : 'translateX(100%)' }}>
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.15)' }}>
                            <Users size={16} style={{ color: '#87CBB9' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>Thêm Khách Hàng</h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Khách sạn, nhà hàng, phân phối, VIP retail</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#4A6A7A' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
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
                                onChange={e => set('code', e.target.value.toUpperCase())}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                            {errors.code && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>{errors.code}</p>}
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Loại KH</label>
                            <select className={inputCls} style={inputStyle} value={form.customerType ?? 'HORECA'}
                                onChange={e => set('customerType', e.target.value as any)}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
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
                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                        {errors.name && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>{errors.name}</p>}
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Mã số thuế</label>
                        <input className={inputCls} style={inputStyle} value={form.taxId ?? ''} placeholder="0302012345"
                            onChange={e => set('taxId', e.target.value || null)}
                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Kênh bán hàng</label>
                        <select className={inputCls} style={inputStyle} value={form.channel ?? ''}
                            onChange={e => set('channel', e.target.value as any || null)}
                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                            <option value="">— Chọn kênh —</option>
                            {Object.entries(CHANNEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </div>

                    <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#87CBB9' }}>── Tín Dụng & Thanh Toán</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Điều khoản</label>
                            <select className={inputCls} style={inputStyle} value={form.paymentTerm ?? 'NET30'}
                                onChange={e => set('paymentTerm', e.target.value)}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <option value="COD">COD</option>
                                <option value="NET15">NET 15</option>
                                <option value="NET30">NET 30</option>
                                <option value="NET45">NET 45</option>
                                <option value="NET60">NET 60</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Hạn mức tín dụng (VND)</label>
                            <input type="number" className={inputCls} style={inputStyle} value={form.creditLimit ?? 0}
                                onChange={e => set('creditLimit', Number(e.target.value))} step={50000000}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                        </div>
                    </div>
                </div>

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
                        {saving ? 'Đang lưu...' : 'Tạo KH'}
                    </button>
                </div>
            </div>
        </>
    )
}

export function CustomersClient({ initialRows }: { initialRows: CustomerRow[] }) {
    const [rows, setRows] = useState(initialRows)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)

    const filtered = rows.filter(r =>
        (!search || r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase())) &&
        (!typeFilter || r.customerType === typeFilter)
    )

    const totalCredit = rows.reduce((s, r) => s + r.creditLimit, 0)
    const horecaCount = rows.filter(r => r.customerType === 'HORECA').length
    const activeCount = rows.filter(r => r.status === 'ACTIVE').length

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Khách Hàng (CRM)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        B2B: Khách sạn, nhà hàng, phân phối, VIP retail
                    </p>
                </div>
                <button onClick={() => setDrawerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                    <Plus size={16} /> Thêm Khách Hàng
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Tổng KH', value: rows.length, icon: Users, accent: '#87CBB9' },
                    { label: 'Đang hoạt động', value: activeCount, icon: Building2, accent: '#5BA88A' },
                    { label: 'HORECA', value: horecaCount, icon: ShoppingBag, accent: '#4A8FAB' },
                    { label: 'Tổng hạn mức', value: formatVND(totalCredit), icon: CreditCard, accent: '#87CBB9' },
                ].map(s => (
                    <div key={s.label} className="flex items-center gap-4 p-4 rounded-xl"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${s.accent}20` }}>
                            <s.icon size={20} style={{ color: s.accent }} />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{s.label}</p>
                            <p className="text-lg font-bold mt-0.5" style={{ color: '#E8F1F2', fontFamily: '"DM Mono", monospace' }}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input type="text" placeholder="Tìm khách hàng..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                </div>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: typeFilter ? '#E8F1F2' : '#4A6A7A' }}>
                    <option value="">Tất cả loại</option>
                    <option value="HORECA">🏨 HORECA</option>
                    <option value="WHOLESALE_DISTRIBUTOR">🏭 Phân Phối</option>
                    <option value="VIP_RETAIL">👑 VIP Retail</option>
                    <option value="INDIVIDUAL">👤 Cá Nhân</option>
                </select>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['Khách Hàng', 'Loại', 'MST', 'Kênh', 'Thanh Toán', 'Hạn Mức', 'Đơn Hàng', 'Trạng Thái'].map(h => (
                                <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={8}>
                                <div className="flex flex-col items-center py-16 gap-3">
                                    <span className="text-3xl">👥</span>
                                    <p style={{ color: '#4A6A7A' }} className="text-sm">Chưa có khách hàng nào</p>
                                </div>
                            </td></tr>
                        ) : filtered.map(row => (
                            <tr key={row.id} className="group transition-colors duration-100"
                                style={{ borderBottom: '1px solid rgba(61,43,31,0.6)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(61,43,31,0.35)')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                <td className="px-4 py-3">
                                    <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{row.name}</p>
                                    <p className="text-xs mt-0.5" style={{ color: '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>{row.code}</p>
                                </td>
                                <td className="px-4 py-3"><TypeBadge type={row.customerType} /></td>
                                <td className="px-4 py-3 text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>
                                    {row.taxId ?? '—'}
                                </td>
                                <td className="px-4 py-3 text-xs" style={{ color: '#8AAEBB' }}>
                                    {CHANNEL_LABEL[row.channel ?? ''] ?? '—'}
                                </td>
                                <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#8AAEBB', fontFamily: '"DM Mono", monospace' }}>
                                    {row.paymentTerm}
                                </td>
                                <td className="px-4 py-3 text-sm" style={{ color: row.creditLimit > 0 ? '#87CBB9' : '#2A4355', fontFamily: '"DM Mono", monospace' }}>
                                    {row.creditLimit > 0 ? formatVND(row.creditLimit) : '—'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-sm font-bold" style={{ color: row.orderCount > 0 ? '#5BA88A' : '#2A4355', fontFamily: '"DM Mono", monospace' }}>
                                        {row.orderCount}
                                    </span>
                                </td>
                                <td className="px-4 py-3"><StatusDot status={row.status} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AddCustomerDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
                onSaved={async () => {
                    setDrawerOpen(false)
                    const { getCustomers } = await import('./actions')
                    setRows(await getCustomers())
                }} />
        </div>
    )
}
