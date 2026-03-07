'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    Plus, Building2, Globe, Clock, X, Save, Loader2, AlertCircle, Award, Copy, Upload,
    Download, Search, Edit2, Trash2, Eye,
} from 'lucide-react'
import {
    SupplierRow, SupplierInput, SupplierStats, SupplierFilters,
    createSupplier, updateSupplier, getSuppliers, getSupplierById,
    deleteSupplier, exportSuppliersData, bulkImportSuppliers,
    getAllSupplierScorecards, detectDuplicates,
    type SupplierScorecard, type DuplicateCandidate,
} from './actions'
import { ExcelImportDialog } from '@/components/ExcelImportDialog'
import { SupplierDetailDrawer } from './SupplierDetailDrawer'
import { toast } from 'sonner'

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
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
}

function StatusDot({ status }: { status: string }) {
    const color = status === 'ACTIVE' ? '#5BA88A' : status === 'BLACKLISTED' ? '#8B1A2E' : '#4A6A7A'
    const label = status === 'ACTIVE' ? 'Hoạt động' : status === 'BLACKLISTED' ? 'Blacklist' : 'Tạm dừng'
    return <span className="flex items-center gap-1.5 text-xs" style={{ color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{label}</span>
}

// ── Supplier Drawer (Create + Edit) ────────────────────
function SupplierDrawer({ open, editingId, onClose, onSaved }: {
    open: boolean; editingId: string | null; onClose: () => void; onSaved: () => void
}) {
    const [form, setForm] = useState<Partial<SupplierInput>>({
        defaultCurrency: 'USD', leadTimeDays: 45, status: 'ACTIVE', type: 'WINERY',
    })
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const isEdit = !!editingId

    useEffect(() => {
        if (!open) return
        if (editingId) {
            setLoading(true)
            getSupplierById(editingId).then(data => {
                if (data) setForm({
                    code: data.code, name: data.name, type: data.type as any,
                    country: data.country, taxId: data.taxId, tradeAgreement: data.tradeAgreement,
                    coFormType: data.coFormType, paymentTerm: data.paymentTerm,
                    defaultCurrency: data.defaultCurrency, incoterms: data.incoterms,
                    leadTimeDays: data.leadTimeDays, status: data.status as any,
                    website: data.website, notes: data.notes,
                    contactName: data.contactName, contactTitle: data.contactTitle,
                    contactEmail: data.contactEmail, contactPhone: data.contactPhone,
                    address: data.address, city: data.city, region: data.region,
                })
            }).finally(() => setLoading(false))
        } else {
            setForm({ defaultCurrency: 'USD', leadTimeDays: 45, status: 'ACTIVE', type: 'WINERY' })
        }
        setErrors({})
    }, [open, editingId])

    const set = (k: keyof SupplierInput, v: any) => setForm(f => ({ ...f, [k]: v }))
    const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    const handleSave = async () => {
        const e: Record<string, string> = {}
        if (!form.code) e.code = 'Bắt buộc'
        if (!form.name) e.name = 'Bắt buộc'
        if (!form.country) e.country = 'Bắt buộc'
        setErrors(e)
        if (Object.keys(e).length) return

        setSaving(true)
        try {
            if (isEdit) {
                await updateSupplier(editingId!, form as SupplierInput)
                toast.success('Đã cập nhật NCC')
            } else {
                await createSupplier(form as SupplierInput)
                toast.success('Đã tạo NCC mới')
            }
            onSaved()
        } catch (err: any) {
            setErrors({ _global: err.message })
        } finally { setSaving(false) }
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
                            <Building2 size={16} style={{ color: '#87CBB9' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>
                                {isEdit ? 'Chỉnh Sửa NCC' : 'Thêm Nhà Cung Cấp'}
                            </h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                {isEdit ? 'Cập nhật thông tin nhà cung cấp' : 'Winery, Négociant, Distributor, Forwarder'}
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
                    ) : (<>
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
                                <input className={inputCls} style={inputStyle} value={form.code ?? ''} disabled={isEdit}
                                    onChange={e => set('code', e.target.value.toUpperCase())} placeholder="SUP-LVMH" />
                                {errors.code && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>{errors.code}</p>}
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Loại NCC</label>
                                <select className={inputCls} style={inputStyle} value={form.type ?? 'WINERY'} onChange={e => set('type', e.target.value)}>
                                    <option value="WINERY">Winery</option><option value="NEGOCIANT">Négociant</option>
                                    <option value="DISTRIBUTOR">Distributor</option><option value="LOGISTICS">Logistics</option>
                                    <option value="FORWARDER">Forwarder</option><option value="CUSTOMS_BROKER">Customs Broker</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Tên NCC <span style={{ color: '#8B1A2E' }}>*</span></label>
                            <input className={inputCls} style={inputStyle} value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="LVMH Wines & Spirits" />
                            {errors.name && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>{errors.name}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Quốc gia <span style={{ color: '#8B1A2E' }}>*</span></label>
                                <select className={inputCls} style={inputStyle} value={form.country ?? ''} onChange={e => set('country', e.target.value)}>
                                    <option value="">Chọn...</option>
                                    <option value="FR">🇫🇷 Pháp</option><option value="IT">🇮🇹 Ý</option><option value="ES">🇪🇸 TBN</option>
                                    <option value="US">🇺🇸 Mỹ</option><option value="AU">🇦🇺 Úc</option><option value="NZ">🇳🇿 NZ</option>
                                    <option value="DE">🇩🇪 Đức</option><option value="PT">🇵🇹 BĐN</option><option value="AR">🇦🇷 Argentina</option><option value="CL">🇨🇱 Chile</option>
                                </select>
                                {errors.country && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>{errors.country}</p>}
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Mã thuế</label>
                                <input className={inputCls} style={inputStyle} value={form.taxId ?? ''} onChange={e => set('taxId', e.target.value || null)} placeholder="FR12345678901" />
                            </div>
                        </div>

                        <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#87CBB9' }}>── Liên Hệ Chính</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Người liên hệ</label>
                                <input className={inputCls} style={inputStyle} value={form.contactName ?? ''} onChange={e => set('contactName', e.target.value || null)} placeholder="Jean-Pierre Dupont" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Chức vụ</label>
                                <input className={inputCls} style={inputStyle} value={form.contactTitle ?? ''} onChange={e => set('contactTitle', e.target.value || null)} placeholder="Export Manager" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Email</label>
                                <input className={inputCls} style={inputStyle} value={form.contactEmail ?? ''} onChange={e => set('contactEmail', e.target.value || null)} placeholder="jp@winery.fr" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Điện thoại</label>
                                <input className={inputCls} style={inputStyle} value={form.contactPhone ?? ''} onChange={e => set('contactPhone', e.target.value || null)} placeholder="+33 1 23 45 67" />
                            </div>
                        </div>

                        <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#87CBB9' }}>── Điều Khoản Thương Mại</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Hiệp định</label>
                                <select className={inputCls} style={inputStyle} value={form.tradeAgreement ?? ''} onChange={e => set('tradeAgreement', e.target.value || null)}>
                                    <option value="">Không / MFN</option><option value="EVFTA">EVFTA (EU)</option>
                                    <option value="AANZFTA">AANZFTA</option><option value="CPTPP">CPTPP</option><option value="UKVFTA">UKVFTA</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>C/O Form</label>
                                <input className={inputCls} style={inputStyle} value={form.coFormType ?? ''} onChange={e => set('coFormType', e.target.value || null)} placeholder="EUR.1" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Thanh toán</label>
                                <select className={inputCls} style={inputStyle} value={form.paymentTerm ?? 'NET60'} onChange={e => set('paymentTerm', e.target.value)}>
                                    <option value="NET30">NET 30</option><option value="NET45">NET 45</option><option value="NET60">NET 60</option>
                                    <option value="NET90">NET 90</option><option value="LC">L/C</option><option value="TT_ADVANCE">T/T Advance</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Tiền tệ</label>
                                <select className={inputCls} style={inputStyle} value={form.defaultCurrency ?? 'USD'} onChange={e => set('defaultCurrency', e.target.value)}>
                                    <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Lead time (ngày)</label>
                                <input type="number" className={inputCls} style={inputStyle} value={form.leadTimeDays ?? 45} onChange={e => set('leadTimeDays', Number(e.target.value))} min={1} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Incoterms</label>
                                <input className={inputCls} style={inputStyle} value={form.incoterms ?? ''} onChange={e => set('incoterms', e.target.value || null)} placeholder="CIF Ho Chi Minh" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Website</label>
                                <input className={inputCls} style={inputStyle} value={form.website ?? ''} onChange={e => set('website', e.target.value || null)} placeholder="https://winery.fr" />
                            </div>
                        </div>

                        <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#87CBB9' }}>── Địa Chỉ & Trạng Thái</p>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Địa chỉ</label>
                            <input className={inputCls} style={inputStyle} value={form.address ?? ''} onChange={e => set('address', e.target.value || null)} placeholder="33 Rue du Commerce, Bordeaux" />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Thành phố</label>
                                <input className={inputCls} style={inputStyle} value={form.city ?? ''} onChange={e => set('city', e.target.value || null)} placeholder="Bordeaux" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Vùng</label>
                                <input className={inputCls} style={inputStyle} value={form.region ?? ''} onChange={e => set('region', e.target.value || null)} placeholder="Nouvelle-Aquitaine" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Trạng thái</label>
                                <select className={inputCls} style={inputStyle} value={form.status ?? 'ACTIVE'} onChange={e => set('status', e.target.value as any)}>
                                    <option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Tạm dừng</option><option value="BLACKLISTED">Blacklist</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Ghi chú nội bộ</label>
                            <textarea className={inputCls + ' resize-none'} style={{ ...inputStyle, minHeight: 60 }} value={form.notes ?? ''} onChange={e => set('notes', e.target.value || null)} placeholder="Ghi chú..." />
                        </div>
                    </>)}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #2A4355' }}>
                    <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm" style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>Hủy</button>
                    <button onClick={handleSave} disabled={saving || loading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo NCC'}
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
    const [loading, setLoading] = useState(false)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [importOpen, setImportOpen] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'list' | 'scorecard' | 'duplicates'>('list')
    const [scorecards, setScorecards] = useState<SupplierScorecard[] | null>(null)
    const [scoreLoading, setScoreLoading] = useState(false)
    const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null)
    const [dupLoading, setDupLoading] = useState(false)

    const reload = useCallback(async (s?: string, t?: string, st?: string, p?: number) => {
        setLoading(true)
        try {
            const result = await getSuppliers({
                search: (s ?? search) || undefined, type: (t ?? typeFilter) || undefined,
                status: (st ?? statusFilter) || undefined, page: p ?? page, pageSize: 25,
            })
            setRows(result.rows); setTotal(result.total)
        } finally { setLoading(false) }
    }, [search, typeFilter, statusFilter, page])

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Xóa NCC "${name}"?\n\nNCC sẽ bị đánh dấu Tạm dừng. Nếu NCC đang có PO chưa hoàn tất sẽ không xóa được.`)) return
        try {
            const result = await deleteSupplier(id)
            if (result.success) { toast.success(`Đã xóa "${name}"`); reload() }
            else toast.error(result.error ?? 'Không thể xóa')
        } catch { toast.error('Lỗi khi xóa NCC') }
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const data = await exportSuppliersData()
            if (data.length === 0) { toast.error('Chưa có NCC để xuất'); return }
            const headers = Object.keys(data[0])
            const csvRows = [
                headers.join(','),
                ...data.map(row => headers.map(h => {
                    const val = String((row as any)[h] ?? '')
                    return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
                }).join(',')),
            ]
            const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `nha_cung_cap_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
            URL.revokeObjectURL(url)
            toast.success(`Đã xuất ${data.length} NCC`)
        } catch { toast.error('Lỗi xuất dữ liệu') }
        finally { setExporting(false) }
    }

    const loadScorecards = async () => {
        setActiveTab('scorecard')
        if (scorecards) return
        setScoreLoading(true)
        setScorecards(await getAllSupplierScorecards())
        setScoreLoading(false)
    }

    const loadDuplicates = async () => {
        setActiveTab('duplicates')
        if (duplicates) return
        setDupLoading(true)
        setDuplicates(await detectDuplicates())
        setDupLoading(false)
    }

    const GRADE_COLOR: Record<string, { color: string; bg: string }> = {
        A: { color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' }, B: { color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
        C: { color: '#D4A853', bg: 'rgba(212,168,83,0.15)' }, D: { color: '#C07434', bg: 'rgba(192,116,52,0.15)' },
        F: { color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>Nhà Cung Cấp</h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>Winery, Négociant, Distributor, Forwarder — {stats.total} đối tác</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleExport} disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        style={{ background: '#1B2E3D', color: '#5BA88A', border: '1px solid #2A4355' }}>
                        <Download size={16} /> {exporting ? 'Đang xuất...' : 'Export CSV'}
                    </button>
                    <button onClick={() => setImportOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                        style={{ background: '#1B2E3D', color: '#4A8FAB', border: '1px solid #2A4355' }}>
                        <Upload size={16} /> Import Excel
                    </button>
                    <button onClick={() => { setEditingId(null); setDrawerOpen(true) }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
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
                    <div key={s.label} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${s.accent}20` }}>
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
            {activeTab === 'list' && (<>
                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                        <input type="text" placeholder="Tìm NCC (tên, mã, MST, email)..."
                            value={search} onChange={e => { setSearch(e.target.value); setPage(1); reload(e.target.value, undefined, undefined, 1) }}
                            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                    </div>
                    <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); reload(undefined, e.target.value, undefined, 1) }}
                        className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: typeFilter ? '#E8F1F2' : '#4A6A7A' }}>
                        <option value="">Tất cả loại</option>
                        {Object.entries(SUPPLIER_TYPE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); reload(undefined, undefined, e.target.value, 1) }}
                        className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: statusFilter ? '#E8F1F2' : '#4A6A7A' }}>
                        <option value="">Trạng thái</option>
                        <option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Tạm dừng</option><option value="BLACKLISTED">Blacklist</option>
                    </select>
                    {(search || typeFilter || statusFilter) && (
                        <button onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); setPage(1); reload('', '', '', 1) }}
                            className="px-3 py-2.5 rounded-lg text-sm" style={{ color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.3)' }}>Xóa filter</button>
                    )}
                </div>

                {/* Table */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355', position: 'sticky', top: 0, zIndex: 10 }}>
                                    {['Nhà Cung Cấp', 'Loại', 'Quốc Gia', 'Hiệp Định / C/O', 'Thanh Toán', 'Lead Time', 'Đơn Hàng', 'Trạng Thái', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(42,67,85,0.6)' }}>
                                        {Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-4 py-4"><div className="h-4 rounded animate-pulse" style={{ background: '#1B2E3D', width: j === 0 ? '80%' : '55%' }} /></td>)}
                                    </tr>
                                )) : rows.length === 0 ? (
                                    <tr><td colSpan={9}>
                                        <div className="flex flex-col items-center py-16 gap-3">
                                            <span className="text-3xl">🏭</span>
                                            <p style={{ color: '#4A6A7A' }} className="text-sm">Chưa có nhà cung cấp nào</p>
                                        </div>
                                    </td></tr>
                                ) : rows.map(row => (
                                    <tr key={row.id} className="group transition-colors duration-100 cursor-pointer"
                                        style={{ borderBottom: '1px solid rgba(42,67,85,0.6)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(27,46,61,0.5)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                                        onClick={() => { setDetailId(row.id); setDetailOpen(true) }}>
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{row.name}</p>
                                            <p className="text-xs mt-0.5" style={{ color: '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>{row.code}</p>
                                            {row.contactName && <p className="text-[10px] mt-0.5" style={{ color: '#4A8FAB' }}>👤 {row.contactName}</p>}
                                        </td>
                                        <td className="px-4 py-3"><TypeBadge type={row.type} /></td>
                                        <td className="px-4 py-3 text-sm" style={{ color: '#8AAEBB' }}>{COUNTRY_FLAGS[row.country] ?? '🌍'} {row.country}</td>
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-semibold" style={{ color: row.tradeAgreement ? '#5BA88A' : '#2A4355' }}>{row.tradeAgreement ?? 'MFN'}</p>
                                            <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>{row.coFormType ?? '—'}</p>
                                        </td>
                                        <td className="px-4 py-3 text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono", monospace' }}>{row.paymentTerm ?? '—'}</td>
                                        <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs" style={{ color: '#8AAEBB' }}><Clock size={12} /> {row.leadTimeDays} ngày</span></td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-sm font-bold" style={{ color: row.poCount > 0 ? '#87CBB9' : '#2A4355', fontFamily: '"DM Mono", monospace' }}>{row.poCount}</span>
                                        </td>
                                        <td className="px-4 py-3"><StatusDot status={row.status} /></td>
                                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => { setDetailId(row.id); setDetailOpen(true) }}
                                                    className="p-1.5 rounded-lg transition-all" style={{ color: '#4A8FAB' }} title="Chi tiết 360°">
                                                    <Eye size={14} />
                                                </button>
                                                <button onClick={() => { setEditingId(row.id); setDrawerOpen(true) }}
                                                    className="p-1.5 rounded-lg transition-all" style={{ color: '#8AAEBB' }} title="Chỉnh sửa">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(row.id, row.name)}
                                                    className="p-1.5 rounded-lg transition-all" style={{ color: '#4A6A7A' }} title="Xóa">
                                                    <Trash2 size={14} />
                                                </button>
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
                                Hiển thị <span style={{ color: '#8AAEBB' }}>{(page - 1) * 25 + 1}–{Math.min(page * 25, total)}</span> trong <span style={{ color: '#8AAEBB' }}>{total}</span>
                            </p>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.ceil(total / 25) }).map((_, i) => (
                                    <button key={i} onClick={() => { setPage(i + 1); reload(undefined, undefined, undefined, i + 1) }}
                                        className="min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium"
                                        style={{ background: page === i + 1 ? '#87CBB9' : 'transparent', color: page === i + 1 ? '#0A1926' : '#8AAEBB' }}>
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </>)}

            {/* Tab: Scorecard */}
            {activeTab === 'scorecard' && (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                    {scoreLoading ? (
                        <div className="flex items-center justify-center py-16 gap-2"><Loader2 size={16} className="animate-spin" style={{ color: '#87CBB9' }} /><span className="text-sm" style={{ color: '#4A6A7A' }}>Đang tính Scorecard...</span></div>
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
                                            <td className="px-4 py-3"><p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{sc.supplierName}</p></td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 rounded-full" style={{ background: '#2A4355' }}>
                                                        <div className="h-full rounded-full" style={{ background: sc.onTimeRate >= 90 ? '#5BA88A' : sc.onTimeRate >= 70 ? '#D4A853' : '#8B1A2E', width: `${Math.min(sc.onTimeRate, 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold" style={{ color: sc.onTimeRate >= 90 ? '#5BA88A' : sc.onTimeRate >= 70 ? '#D4A853' : '#8B1A2E', fontFamily: '"DM Mono"' }}>{sc.onTimeRate.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><span className="text-xs font-bold" style={{ color: sc.qualityScore >= 90 ? '#5BA88A' : '#D4A853', fontFamily: '"DM Mono"' }}>{sc.qualityScore.toFixed(0)}/100</span></td>
                                            <td className="px-4 py-3 text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{sc.avgLeadTimeDays.toFixed(0)} ngày</td>
                                            <td className="px-4 py-3 text-xs text-center" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{sc.totalPOs}</td>
                                            <td className="px-4 py-3"><span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold" style={{ background: gc.bg, color: gc.color }}>{sc.grade}</span></td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : <div className="text-center py-16 text-sm" style={{ color: '#4A6A7A' }}>Chưa có dữ liệu scorecard</div>}
                </div>
            )}

            {/* Tab: Duplicate Detection */}
            {activeTab === 'duplicates' && (
                <div className="space-y-3">
                    {dupLoading ? (
                        <div className="flex items-center justify-center py-16 gap-2"><Loader2 size={16} className="animate-spin" style={{ color: '#D4A853' }} /><span className="text-sm" style={{ color: '#4A6A7A' }}>Đang quét trùng...</span></div>
                    ) : duplicates && duplicates.length > 0 ? (
                        duplicates.map((dup, i) => (
                            <div key={i} className="p-4 rounded-lg" style={{ background: '#1B2E3D', border: '1px solid rgba(212,168,83,0.3)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded-full" style={{ color: '#D4A853', background: 'rgba(212,168,83,0.12)' }}>
                                        {dup.type === 'PRODUCT' ? '📦 Sản phẩm' : dup.type === 'CUSTOMER' ? '👤 Khách hàng' : '🏭 NCC'}
                                    </span>
                                    <span className="text-xs font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>{dup.similarity}% giống</span>
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

            <SupplierDrawer open={drawerOpen} editingId={editingId}
                onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); reload() }} />

            <SupplierDetailDrawer open={detailOpen} supplierId={detailId}
                onClose={() => setDetailOpen(false)} />

            <ExcelImportDialog open={importOpen} onClose={() => setImportOpen(false)}
                title="Import Nhà Cung Cấp" templateFileName="template_nha_cung_cap.xlsx"
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
                    { header: 'Website', sample: 'https://mouton.com' },
                    { header: 'Người Liên Hệ', sample: 'Jean-Pierre' },
                    { header: 'Email', sample: 'jp@mouton.com' },
                    { header: 'SĐT', sample: '+33 1 2345 6789' },
                ]}
                onImport={bulkImportSuppliers} onComplete={() => reload()} />
        </div>
    )
}
