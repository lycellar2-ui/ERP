'use client'

import { useState } from 'react'
import { Search, Plus, Building2, Globe, Clock, ShoppingCart, X, Save, Loader2, AlertCircle } from 'lucide-react'
import { SupplierRow, SupplierInput, createSupplier } from './actions'
import { formatVND } from '@/lib/utils'

// ── Type badge ──────────────────────────────────────────────
const SUPPLIER_TYPE: Record<string, { label: string; color: string; bg: string }> = {
    WINERY: { label: 'Winery', color: '#87CBB9', bg: 'rgba(135,203,185,0.12)' },
    NEGOCIANT: { label: 'Négociant', color: '#7AC4C4', bg: 'rgba(122,196,196,0.12)' },
    DISTRIBUTOR: { label: 'Distributor', color: '#5BA88A', bg: 'rgba(74,124,89,0.12)' },
    LOGISTICS: { label: 'Logistics', color: '#87CBB9', bg: 'rgba(168,130,204,0.12)' },
    FORWARDER: { label: 'Forwarder', color: '#4A8FAB', bg: 'rgba(46,91,122,0.15)' },
    CUSTOMS_BROKER: { label: 'Customs Broker', color: '#8AAEBB', bg: 'rgba(168,152,128,0.12)' },
}

const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦', VN: '🇻🇳', SG: '🇸🇬',
}

function TypeBadge({ type }: { type: string }) {
    const cfg = SUPPLIER_TYPE[type] ?? { label: type, color: '#8AAEBB', bg: 'rgba(168,152,128,0.12)' }
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
    )
}

function StatusDot({ status }: { status: string }) {
    const color = status === 'ACTIVE' ? '#5BA88A' : status === 'BLACKLISTED' ? '#8B1A2E' : '#4A6A7A'
    const label = status === 'ACTIVE' ? 'Hoạt động' : status === 'BLACKLISTED' ? 'Blacklist' : 'Tạm dừng'
    return (
        <span className="flex items-center gap-1.5 text-xs" style={{ color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {label}
        </span>
    )
}

// ── Add Supplier Drawer ────────────────────────────────────
function AddSupplierDrawer({ open, onClose, onSaved }: {
    open: boolean; onClose: () => void; onSaved: () => void
}) {
    const [form, setForm] = useState<Partial<SupplierInput>>({
        defaultCurrency: 'USD', leadTimeDays: 45, status: 'ACTIVE', type: 'WINERY',
    })
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    const set = (k: keyof SupplierInput, v: any) => setForm(f => ({ ...f, [k]: v }))

    const handleSave = async () => {
        const e: Record<string, string> = {}
        if (!form.code) e.code = 'Bắt buộc'
        if (!form.name) e.name = 'Bắt buộc'
        if (!form.country) e.country = 'Bắt buộc'
        setErrors(e)
        if (Object.keys(e).length) return

        setSaving(true)
        try {
            await createSupplier(form as SupplierInput)
            onSaved()
        } catch (err: any) {
            setErrors({ _global: err.message })
        } finally {
            setSaving(false)
        }
    }

    const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    return (
        <>
            <div className="fixed inset-0 z-40 transition-opacity duration-300"
                style={{ background: 'rgba(10,5,2,0.7)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
                onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300"
                style={{ width: 'min(520px, 95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355', transform: open ? 'translateX(0)' : 'translateX(100%)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                    style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.15)' }}>
                            <Building2 size={16} style={{ color: '#87CBB9' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>
                                Thêm Nhà Cung Cấp
                            </h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Nhà sản xuất, phân phối hoặc đại lý hải quan</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#4A6A7A' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}><X size={18} /></button>
                </div>

                {/* Body */}
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
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Mã NCC <span style={{ color: '#8B1A2E' }}>*</span></label>
                            <input className={inputCls} style={inputStyle} value={form.code ?? ''}
                                onChange={e => set('code', e.target.value.toUpperCase())} placeholder="SUP-LVMH"
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                            {errors.code && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>{errors.code}</p>}
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Loại NCC</label>
                            <select className={inputCls} style={inputStyle} value={form.type ?? 'WINERY'}
                                onChange={e => set('type', e.target.value)}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <option value="WINERY">Winery</option>
                                <option value="NEGOCIANT">Négociant</option>
                                <option value="DISTRIBUTOR">Distributor</option>
                                <option value="LOGISTICS">Logistics</option>
                                <option value="FORWARDER">Forwarder</option>
                                <option value="CUSTOMS_BROKER">Customs Broker</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Tên NCC <span style={{ color: '#8B1A2E' }}>*</span></label>
                        <input className={inputCls} style={inputStyle} value={form.name ?? ''}
                            onChange={e => set('name', e.target.value)} placeholder="LVMH Wines & Spirits Distribution"
                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                        {errors.name && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>{errors.name}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Quốc gia <span style={{ color: '#8B1A2E' }}>*</span></label>
                            <select className={inputCls} style={inputStyle} value={form.country ?? ''}
                                onChange={e => set('country', e.target.value)}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <option value="">Chọn quốc gia...</option>
                                <option value="FR">🇫🇷 Pháp</option>
                                <option value="IT">🇮🇹 Ý</option>
                                <option value="ES">🇪🇸 Tây Ban Nha</option>
                                <option value="US">🇺🇸 Mỹ</option>
                                <option value="AU">🇦🇺 Úc</option>
                                <option value="NZ">🇳🇿 New Zealand</option>
                                <option value="DE">🇩🇪 Đức</option>
                                <option value="PT">🇵🇹 Bồ Đào Nha</option>
                                <option value="AR">🇦🇷 Argentina</option>
                                <option value="CL">🇨🇱 Chile</option>
                            </select>
                            {errors.country && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>{errors.country}</p>}
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Mã thuế</label>
                            <input className={inputCls} style={inputStyle} value={form.taxId ?? ''}
                                onChange={e => set('taxId', e.target.value || null)} placeholder="FR12345678901"
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                        </div>
                    </div>

                    <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#87CBB9' }}>── Điều Khoản Thương Mại</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Hiệp định thương mại</label>
                            <select className={inputCls} style={inputStyle} value={form.tradeAgreement ?? ''}
                                onChange={e => set('tradeAgreement', e.target.value || null)}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <option value="">Không / MFN</option>
                                <option value="EVFTA">EVFTA (EU)</option>
                                <option value="AANZFTA">AANZFTA (Úc/NZ)</option>
                                <option value="UKVFTA">UKVFTA (Anh)</option>
                                <option value="CPTPP">CPTPP</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>C/O Form</label>
                            <input className={inputCls} style={inputStyle} value={form.coFormType ?? ''}
                                onChange={e => set('coFormType', e.target.value || null)} placeholder="EUR.1"
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Thanh toán</label>
                            <select className={inputCls} style={inputStyle} value={form.paymentTerm ?? 'NET60'}
                                onChange={e => set('paymentTerm', e.target.value)}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <option value="NET30">NET 30</option>
                                <option value="NET45">NET 45</option>
                                <option value="NET60">NET 60</option>
                                <option value="NET90">NET 90</option>
                                <option value="LC">L/C</option>
                                <option value="TT_ADVANCE">T/T Advance</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Tiền tệ</label>
                            <select className={inputCls} style={inputStyle} value={form.defaultCurrency ?? 'USD'}
                                onChange={e => set('defaultCurrency', e.target.value)}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Lead time (ngày)</label>
                            <input type="number" className={inputCls} style={inputStyle} value={form.leadTimeDays ?? 45}
                                onChange={e => set('leadTimeDays', Number(e.target.value))} min={1}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Incoterms</label>
                        <input className={inputCls} style={inputStyle} value={form.incoterms ?? ''}
                            onChange={e => set('incoterms', e.target.value || null)} placeholder="CIF Ho Chi Minh City"
                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
                    style={{ borderTop: '1px solid #2A4355' }}>
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
                        {saving ? 'Đang lưu...' : 'Tạo NCC'}
                    </button>
                </div>
            </div>
        </>
    )
}

// ── Main ───────────────────────────────────────────────────
export function SuppliersClient({ initialRows }: { initialRows: SupplierRow[] }) {
    const [rows, setRows] = useState(initialRows)
    const [search, setSearch] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)

    const filtered = rows.filter(r =>
        !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase())
    )

    const activeCount = rows.filter(r => r.status === 'ACTIVE').length
    const countries = [...new Set(rows.map(r => r.country))].length

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Nhà Cung Cấp
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Winery, Négociant, Distributor, Forwarder — toàn bộ đối tác nhập hàng
                    </p>
                </div>
                <button onClick={() => setDrawerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                    <Plus size={16} /> Thêm NCC
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Tổng NCC', value: rows.length, icon: Building2, accent: '#87CBB9' },
                    { label: 'Đang hoạt động', value: activeCount, icon: Globe, accent: '#5BA88A' },
                    { label: 'Quốc gia', value: countries, icon: Globe, accent: '#4A8FAB' },
                    { label: 'Avg Lead Time', value: rows.length ? `${Math.round(rows.reduce((s, r) => s + r.leadTimeDays, 0) / rows.length)} ngày` : '—', icon: Clock, accent: '#87CBB9' },
                ].map(s => (
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

            {/* Search */}
            <div className="relative max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                <input type="text" placeholder="Tìm NCC..." value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['Nhà Cung Cấp', 'Loại', 'Quốc Gia', 'Hiệp Định / C/O', 'Thanh Toán', 'Lead Time', 'Đơn Hàng', 'Trạng Thái'].map(h => (
                                <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold"
                                    style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={8}>
                                <div className="flex flex-col items-center py-16 gap-3">
                                    <span className="text-3xl">🏭</span>
                                    <p style={{ color: '#4A6A7A' }} className="text-sm">Chưa có nhà cung cấp nào</p>
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
                                <td className="px-4 py-3"><TypeBadge type={row.type} /></td>
                                <td className="px-4 py-3 text-sm" style={{ color: '#8AAEBB' }}>
                                    {COUNTRY_FLAGS[row.country] ?? '🌍'} {row.country}
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-xs font-semibold" style={{ color: row.tradeAgreement ? '#5BA88A' : '#2A4355' }}>
                                        {row.tradeAgreement ?? 'MFN'}
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>{row.coFormType ?? '—'}</p>
                                </td>
                                <td className="px-4 py-3 text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono", monospace' }}>
                                    {row.paymentTerm ?? '—'}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="flex items-center gap-1 text-xs" style={{ color: '#8AAEBB' }}>
                                        <Clock size={12} /> {row.leadTimeDays} ngày
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-sm font-bold" style={{ color: row.poCount > 0 ? '#87CBB9' : '#2A4355', fontFamily: '"DM Mono", monospace' }}>
                                        {row.poCount}
                                    </span>
                                </td>
                                <td className="px-4 py-3"><StatusDot status={row.status} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AddSupplierDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
                onSaved={async () => {
                    setDrawerOpen(false)
                    const { getSuppliers } = await import('./actions')
                    setRows(await getSuppliers())
                }} />
        </div>
    )
}
