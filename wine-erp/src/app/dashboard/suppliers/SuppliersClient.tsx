'use client'

import { useState, useCallback } from 'react'
import { Plus, Building2, Globe, Clock, X, Save, Loader2, AlertCircle, Award, Copy, Upload } from 'lucide-react'
import { SupplierRow, SupplierInput, SupplierStats, createSupplier, getSuppliers, getAllSupplierScorecards, detectDuplicates, bulkImportSuppliers, type SupplierScorecard, type DuplicateCandidate } from './actions'
import { formatVND } from '@/lib/utils'
import { DataPagination } from '@/components/DataPagination'
import { FilterBar } from '@/components/FilterBar'
import { ExcelImportDialog } from '@/components/ExcelImportDialog'

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
export function SuppliersClient({ initialRows, initialTotal, stats }: { initialRows: SupplierRow[]; initialTotal: number; stats: SupplierStats }) {
    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [page, setPage] = useState(1)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'list' | 'scorecard' | 'duplicates'>('list')
    const [scorecards, setScorecards] = useState<SupplierScorecard[] | null>(null)
    const [scoreLoading, setScoreLoading] = useState(false)
    const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null)
    const [dupLoading, setDupLoading] = useState(false)

    const reload = useCallback(async (s?: string, t?: string, st?: string, p?: number) => {
        const result = await getSuppliers({
            search: (s ?? search) || undefined,
            type: (t ?? typeFilter) || undefined,
            status: (st ?? statusFilter) || undefined,
            page: p ?? page,
            pageSize: 25,
        })
        setRows(result.rows)
        setTotal(result.total)
    }, [search, typeFilter, statusFilter, page])

    const loadScorecards = async () => {
        setActiveTab('scorecard')
        if (scorecards) return
        setScoreLoading(true)
        const data = await getAllSupplierScorecards()
        setScorecards(data)
        setScoreLoading(false)
    }

    const loadDuplicates = async () => {
        setActiveTab('duplicates')
        if (duplicates) return
        setDupLoading(true)
        const data = await detectDuplicates()
        setDuplicates(data)
        setDupLoading(false)
    }

    const GRADE_COLOR: Record<string, { color: string; bg: string }> = {
        A: { color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
        B: { color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
        C: { color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
        D: { color: '#C07434', bg: 'rgba(192,116,52,0.15)' },
        F: { color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
    }

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
                <div className="flex items-center gap-2">
                    <button onClick={() => setImportOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                        style={{ background: '#1B2E3D', color: '#4A8FAB', border: '1px solid #2A4355' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#142433'; e.currentTarget.style.borderColor = '#4A8FAB' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#1B2E3D'; e.currentTarget.style.borderColor = '#2A4355' }}>
                        <Upload size={16} /> Import Excel
                    </button>
                    <button onClick={() => setDrawerOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                        style={{ background: '#87CBB9', color: '#0A1926' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                        <Plus size={16} /> Thêm NCC
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Tổng NCC', value: stats.total, icon: Building2, accent: '#87CBB9' },
                    { label: 'Hoạt động', value: stats.active, icon: Globe, accent: '#5BA88A' },
                    { label: 'Quốc gia', value: stats.countries, icon: Globe, accent: '#4A8FAB' },
                    { label: 'Avg Lead Time', value: `${stats.avgLeadTime} ngày`, icon: Clock, accent: '#87CBB9' },
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

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#142433' }}>
                {([
                    { key: 'list', label: 'Danh Sách NCC', icon: Building2 },
                    { key: 'scorecard', label: 'Scorecard', icon: Award },
                    { key: 'duplicates', label: 'Phát Hiện Trùng', icon: Copy },
                ] as const).map(tab => (
                    <button key={tab.key}
                        onClick={() => tab.key === 'scorecard' ? loadScorecards() : tab.key === 'duplicates' ? loadDuplicates() : setActiveTab('list')}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all"
                        style={{
                            background: activeTab === tab.key ? '#1B2E3D' : 'transparent',
                            color: activeTab === tab.key ? '#87CBB9' : '#4A6A7A',
                            border: activeTab === tab.key ? '1px solid #2A4355' : '1px solid transparent',
                        }}>
                        <tab.icon size={13} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab: NCC List */}
            {activeTab === 'list' && (
                <>
                    <FilterBar
                        searchValue={search}
                        searchPlaceholder="Tìm NCC (tên, mã)..."
                        onSearchChange={v => { setSearch(v); setPage(1); reload(v, undefined, undefined, 1) }}
                        filters={[
                            {
                                key: 'type', label: 'Tất cả loại',
                                options: Object.entries(SUPPLIER_TYPE).map(([k, v]) => ({ value: k, label: v.label })),
                                value: typeFilter,
                                onChange: v => { setTypeFilter(v); setPage(1); reload(undefined, v, undefined, 1) },
                            },
                            {
                                key: 'status', label: 'Trạng thái',
                                options: [
                                    { value: 'ACTIVE', label: 'Hoạt động' },
                                    { value: 'INACTIVE', label: 'Tạm dừng' },
                                    { value: 'BLACKLISTED', label: 'Blacklist' },
                                ],
                                value: statusFilter,
                                onChange: v => { setStatusFilter(v); setPage(1); reload(undefined, undefined, v, 1) },
                            },
                        ]}
                        onClearAll={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); setPage(1); reload('', '', '', 1) }}
                    />

                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                        <div style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
                            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355', position: 'sticky', top: 0, zIndex: 10 }}>
                                        {['Nhà Cung Cấp', 'Loại', 'Quốc Gia', 'Hiệp Định / C/O', 'Thanh Toán', 'Lead Time', 'Đơn Hàng', 'Trạng Thái'].map(h => (
                                            <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold"
                                                style={{ color: '#4A6A7A' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={8}>
                                            <div className="flex flex-col items-center py-16 gap-3">
                                                <span className="text-3xl">🏭</span>
                                                <p style={{ color: '#4A6A7A' }} className="text-sm">Chưa có nhà cung cấp nào</p>
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
                    </div>

                    <DataPagination page={page} pageSize={25} total={total}
                        onPageChange={p => { setPage(p); reload(undefined, undefined, undefined, p) }} />
                </>
            )}

            {/* Tab: Scorecard */}
            {activeTab === 'scorecard' && (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                    {scoreLoading ? (
                        <div className="flex items-center justify-center py-16 gap-2">
                            <Loader2 size={16} className="animate-spin" style={{ color: '#87CBB9' }} />
                            <span className="text-sm" style={{ color: '#4A6A7A' }}>Đang tính Scorecard...</span>
                        </div>
                    ) : scorecards && scorecards.length > 0 ? (
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                    {['NCC', 'Giao Đúng Hạn', 'Chất Lượng', 'Lead Time TB', 'Tổng PO', 'Xếp Hạng'].map(h => (
                                        <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {scorecards.map(sc => {
                                    const gc = GRADE_COLOR[sc.grade] ?? GRADE_COLOR.C
                                    return (
                                        <tr key={sc.supplierId} style={{ borderBottom: '1px solid rgba(42,67,85,0.6)' }}>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{sc.supplierName}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 rounded-full" style={{ background: '#2A4355' }}>
                                                        <div className="h-full rounded-full" style={{
                                                            background: sc.onTimeRate >= 90 ? '#5BA88A' : sc.onTimeRate >= 70 ? '#D4A853' : '#8B1A2E',
                                                            width: `${Math.min(sc.onTimeRate, 100)}%`
                                                        }} />
                                                    </div>
                                                    <span className="text-xs font-bold" style={{
                                                        color: sc.onTimeRate >= 90 ? '#5BA88A' : sc.onTimeRate >= 70 ? '#D4A853' : '#8B1A2E',
                                                        fontFamily: '"DM Mono"'
                                                    }}>{sc.onTimeRate.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-bold" style={{
                                                    color: sc.qualityScore >= 90 ? '#5BA88A' : '#D4A853', fontFamily: '"DM Mono"'
                                                }}>{sc.qualityScore.toFixed(0)}/100</span>
                                            </td>
                                            <td className="px-4 py-3 text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>
                                                {sc.avgLeadTimeDays.toFixed(0)} ngày
                                            </td>
                                            <td className="px-4 py-3 text-xs text-center" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                                {sc.totalPOs}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold"
                                                    style={{ background: gc.bg, color: gc.color }}>{sc.grade}</span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-16 text-sm" style={{ color: '#4A6A7A' }}>Chưa có dữ liệu scorecard</div>
                    )}
                </div>
            )}

            {/* Tab: Duplicate Detection */}
            {activeTab === 'duplicates' && (
                <div className="space-y-3">
                    {dupLoading ? (
                        <div className="flex items-center justify-center py-16 gap-2">
                            <Loader2 size={16} className="animate-spin" style={{ color: '#D4A853' }} />
                            <span className="text-sm" style={{ color: '#4A6A7A' }}>Đang quét dữ liệu trùng...</span>
                        </div>
                    ) : duplicates && duplicates.length > 0 ? (
                        duplicates.map((dup, i) => (
                            <div key={i} className="p-4 rounded-lg" style={{ background: '#1B2E3D', border: '1px solid rgba(212,168,83,0.3)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded-full"
                                        style={{ color: '#D4A853', background: 'rgba(212,168,83,0.12)' }}>
                                        {dup.type === 'PRODUCT' ? '📦 Sản phẩm' : dup.type === 'CUSTOMER' ? '👤 Khách hàng' : '🏭 NCC'}
                                    </span>
                                    <span className="text-xs font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                                        {(dup.similarity * 100).toFixed(0)}% giống nhau
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-2 rounded" style={{ background: '#142433' }}>
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Mục 1</p>
                                        <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{dup.itemA.name}</p>
                                    </div>
                                    <div className="p-2 rounded" style={{ background: '#142433' }}>
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Mục 2</p>
                                        <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{dup.itemB.name}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-16 rounded-lg" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <span className="text-3xl">✅</span>
                            <p className="text-sm mt-3" style={{ color: '#5BA88A' }}>Không phát hiện dữ liệu trùng lặp</p>
                        </div>
                    )}
                </div>
            )}

            <AddSupplierDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
                onSaved={async () => {
                    setDrawerOpen(false)
                    reload()
                }} />

            <ExcelImportDialog
                open={importOpen}
                onClose={() => setImportOpen(false)}
                title="Import Nhà Cung Cấp"
                templateFileName="template_nha_cung_cap.xlsx"
                templateColumns={[
                    { header: 'Mã NCC', sample: 'SUP-MOUTON', required: true },
                    { header: 'Tên NCC', sample: 'Château Mouton Rothschild', required: true },
                    { header: 'Loại', sample: 'WINERY', required: true },
                    { header: 'Quốc Gia', sample: 'FR', required: true },
                    { header: 'MST', sample: 'FR123456789' },
                    { header: 'Hiệp Định', sample: 'EVFTA' },
                    { header: 'Thanh Toán', sample: 'NET30' },
                    { header: 'Tiền Tệ', sample: 'EUR' },
                    { header: 'Incoterms', sample: 'CIF' },
                    { header: 'Lead Time', sample: '45' },
                ]}
                onImport={bulkImportSuppliers}
                onComplete={() => reload()}
            />
        </div>
    )
}

