'use client'

import { useState, useCallback } from 'react'
import { Layers, Calculator, CheckCircle2, AlertCircle, Plus, Pencil, Trash2, X, Loader2, Zap } from 'lucide-react'
import { TaxRateRow, TaxRateInput, getTaxRates, createTaxRate, updateTaxRate, deleteTaxRate, calculateTaxEngine, TaxEngineResult } from './actions'
import { calculateLandedCost, LandedCostResult } from './taxUtils'
import { formatVND } from '@/lib/utils'

const AGREEMENTS = ['EVFTA', 'MFN', 'AANZFTA', 'VCFTA', 'VKFTA', 'ASEAN']

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

// ── Tax Rate Form (Create/Edit) ──────────────────
function TaxRateForm({ existing, onClose, onSaved }: {
    existing?: TaxRateRow | null
    onClose: () => void
    onSaved: () => void
}) {
    const isEdit = !!existing
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [form, setForm] = useState<TaxRateInput>({
        hsCode: existing?.hsCode ?? '',
        countryOfOrigin: existing?.countryOfOrigin ?? '',
        tradeAgreement: (existing?.tradeAgreement as any) ?? 'EVFTA',
        importTaxRate: existing?.importTaxRate ?? 0,
        sctRate: existing?.sctRate ?? 35,
        vatRate: existing?.vatRate ?? 10,
        effectiveDate: existing?.effectiveDate
            ? new Date(existing.effectiveDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
        expiryDate: existing?.expiryDate
            ? new Date(existing.expiryDate).toISOString().split('T')[0]
            : null,
        requiresCo: existing?.requiresCo ?? false,
        coFormType: existing?.coFormType ?? null,
        notes: existing?.notes ?? null,
    })

    const setField = (key: keyof TaxRateInput, value: any) => setForm(prev => ({ ...prev, [key]: value }))

    const handleSubmit = async () => {
        setSaving(true)
        setError('')
        const result = isEdit
            ? await updateTaxRate(existing!.id, form)
            : await createTaxRate(form)
        setSaving(false)
        if (result.success) {
            onSaved()
            onClose()
        } else {
            setError(result.error ?? 'Lỗi không xác định')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="w-full max-w-lg p-6 rounded-lg" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                        {isEdit ? 'Sửa Thuế Suất' : 'Thêm Thuế Suất Mới'}
                    </h3>
                    <button onClick={onClose} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded text-xs" style={{ background: 'rgba(139,26,46,0.15)', color: '#ff6b6b', border: '1px solid rgba(139,26,46,0.3)' }}>
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>HS Code *</label>
                        <input type="text" value={form.hsCode} onChange={e => setField('hsCode', e.target.value)}
                            className="w-full px-3 py-2 text-sm" style={inputStyle} {...focusHandler} placeholder="2204.21" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>Quốc Gia *</label>
                        <input type="text" value={form.countryOfOrigin} onChange={e => setField('countryOfOrigin', e.target.value)}
                            className="w-full px-3 py-2 text-sm" style={inputStyle} {...focusHandler} placeholder="France" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>Hiệp Định *</label>
                        <select value={form.tradeAgreement} onChange={e => setField('tradeAgreement', e.target.value)}
                            className="w-full px-3 py-2 text-sm" style={inputStyle} {...focusHandler}>
                            {AGREEMENTS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>Thuế NK (%)</label>
                        <input type="number" value={form.importTaxRate} onChange={e => setField('importTaxRate', Number(e.target.value))}
                            className="w-full px-3 py-2 text-sm" style={inputStyle} {...focusHandler} min={0} max={100} step={0.1} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>TTĐB (%)</label>
                        <input type="number" value={form.sctRate} onChange={e => setField('sctRate', Number(e.target.value))}
                            className="w-full px-3 py-2 text-sm" style={inputStyle} {...focusHandler} min={0} max={100} step={0.1} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>VAT (%)</label>
                        <input type="number" value={form.vatRate} onChange={e => setField('vatRate', Number(e.target.value))}
                            className="w-full px-3 py-2 text-sm" style={inputStyle} {...focusHandler} min={0} max={100} step={0.1} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>Ngày Hiệu Lực *</label>
                        <input type="date" value={form.effectiveDate} onChange={e => setField('effectiveDate', e.target.value)}
                            className="w-full px-3 py-2 text-sm" style={inputStyle} {...focusHandler} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>Ngày Hết Hạn</label>
                        <input type="date" value={form.expiryDate ?? ''} onChange={e => setField('expiryDate', e.target.value || null)}
                            className="w-full px-3 py-2 text-sm" style={inputStyle} {...focusHandler} />
                    </div>
                </div>

                <div className="mt-3 flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.requiresCo} onChange={e => setField('requiresCo', e.target.checked)} />
                        <span className="text-xs" style={{ color: '#8AAEBB' }}>Yêu cầu C/O</span>
                    </label>
                    {form.requiresCo && (
                        <input type="text" value={form.coFormType ?? ''} onChange={e => setField('coFormType', e.target.value || null)}
                            className="px-3 py-1.5 text-xs" style={inputStyle} {...focusHandler} placeholder="EUR.1, Form AANZ..." />
                    )}
                </div>

                <div className="mt-3">
                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>Ghi chú</label>
                    <textarea value={form.notes ?? ''} onChange={e => setField('notes', e.target.value || null)}
                        className="w-full px-3 py-2 text-xs resize-none" style={{ ...inputStyle, minHeight: 50 }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
                        placeholder="Ghi chú về lộ trình giảm thuế, điều kiện áp dụng..." />
                </div>

                <div className="flex justify-end gap-3 mt-5">
                    <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: '#4A6A7A' }}>Huỷ</button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="px-5 py-2 text-sm font-semibold flex items-center gap-2 transition-all"
                        style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px', opacity: saving ? 0.7 : 1 }}>
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        {isEdit ? 'Cập Nhật' : 'Tạo Mới'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Tax Engine Panel ─────────────────────────────
function TaxEnginePanel() {
    const [country, setCountry] = useState('France')
    const [hsCode, setHsCode] = useState('2204.21')
    const [abv, setAbv] = useState(13.5)
    const [cifUsd, setCifUsd] = useState(10000)
    const [exchangeRate, setExchangeRate] = useState(25400)
    const [qty, setQty] = useState(120)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<TaxEngineResult | null>(null)

    const run = async () => {
        setLoading(true)
        const res = await calculateTaxEngine({ countryOfOrigin: country, hsCode, abvPercent: abv, cifUsd, exchangeRate, qty })
        if (res.success && res.result) setResult(res.result)
        setLoading(false)
    }

    return (
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <div className="flex items-center gap-2 mb-4">
                <Zap size={18} style={{ color: '#D4A853' }} />
                <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>Tax Engine — Tính Tự Động</h3>
            </div>
            <p className="text-xs mb-4" style={{ color: '#4A6A7A' }}>
                Nhập Quốc gia + HS Code + ABV → Hệ thống tự tra thuế và tính Landed Cost
            </p>

            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'Quốc Gia', value: country, setter: setCountry, type: 'text' },
                    { label: 'HS Code', value: hsCode, setter: setHsCode, type: 'text' },
                    { label: 'ABV (%)', value: abv, setter: (v: any) => setAbv(Number(v)), type: 'number' },
                    { label: 'CIF (USD)', value: cifUsd, setter: (v: any) => setCifUsd(Number(v)), type: 'number' },
                    { label: 'Tỷ Giá', value: exchangeRate, setter: (v: any) => setExchangeRate(Number(v)), type: 'number' },
                    { label: 'Số Lượng (chai)', value: qty, setter: (v: any) => setQty(Number(v)), type: 'number' },
                ].map(f => (
                    <div key={f.label}>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>{f.label}</label>
                        <input type={f.type} value={f.value} onChange={e => f.setter(f.type === 'number' ? e.target.value : e.target.value)}
                            className="w-full px-3 py-2 text-sm" style={inputStyle} {...focusHandler} />
                    </div>
                ))}
            </div>

            <button onClick={run} disabled={loading}
                className="w-full mt-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                style={{ background: '#D4A853', color: '#0A1926', borderRadius: '6px' }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Tính Thuế Tự Động
            </button>

            {result && (
                <div className="mt-5 space-y-2 pt-5" style={{ borderTop: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs px-2 py-0.5 rounded font-bold"
                            style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>
                            {result.tradeAgreement}
                        </span>
                        <span className="text-xs" style={{ color: result.rateSource === 'db' ? '#5BA88A' : '#D4A853' }}>
                            {result.rateSource === 'db' ? '✓ Từ cơ sở dữ liệu' : '⚠ Mặc định (chưa có trong DB)'}
                        </span>
                        {result.requiresCo && (
                            <span className="text-xs flex items-center gap-1" style={{ color: '#D4A853' }}>
                                <AlertCircle size={10} /> C/O: {result.coFormType}
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-3 rounded" style={{ background: '#142433' }}>
                        <div className="text-center">
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>NK</p>
                            <p className="text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>{result.importTaxRate}%</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>TTĐB ({abv >= 20 ? '≥20°' : '<20°'})</p>
                            <p className="text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#C45A2A' }}>{result.sctRate}%</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>VAT</p>
                            <p className="text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#A5DED0' }}>{result.vatRate}%</p>
                        </div>
                    </div>

                    {[
                        { label: 'CIF (VND)', value: formatVND(result.cifVnd), color: '#8AAEBB' },
                        { label: 'Thuế Nhập Khẩu', value: formatVND(result.importTax), color: '#D4A853' },
                        { label: 'Thuế TTĐB', value: formatVND(result.sct), color: '#C45A2A' },
                        { label: 'VAT Nhập Khẩu', value: formatVND(result.vat), color: '#A5DED0' },
                        { label: 'Tổng Thuế', value: formatVND(result.totalTax), color: '#8B1A2E' },
                    ].map(item => (
                        <div key={item.label} className="flex justify-between items-center">
                            <span className="text-xs" style={{ color: '#8AAEBB' }}>{item.label}</span>
                            <span className="text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: item.color }}>
                                {item.value}
                            </span>
                        </div>
                    ))}

                    <div className="flex justify-between items-center pt-2 mt-2" style={{ borderTop: '1px solid #2A4355' }}>
                        <span className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Giá Vốn / Chai</span>
                        <span className="text-lg font-bold" style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>
                            {formatVND(result.unitLandedCost)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                        <CheckCircle2 size={12} style={{ color: '#5BA88A' }} />
                        <span className="text-xs" style={{ color: '#5BA88A' }}>
                            Tổng thuế hiệu dụng: {result.effectiveTaxRate.toFixed(1)}% trên CIF
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Main Client ──────────────────────────────────
export function TaxClient({ initialRows, initialTotal }: { initialRows: TaxRateRow[]; initialTotal: number }) {
    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [loading, setLoading] = useState(false)
    const [hsCode, setHsCode] = useState('')
    const [country, setCountry] = useState('')
    const [agreement, setAgreement] = useState('')

    // Form state
    const [showForm, setShowForm] = useState(false)
    const [editRow, setEditRow] = useState<TaxRateRow | null>(null)

    // Tab state
    const [tab, setTab] = useState<'lookup' | 'engine'>('lookup')

    // Calculator state (manual)
    const [cifUsd, setCifUsd] = useState(10000)
    const [exchangeRate, setExchangeRate] = useState(25400)
    const [importRate, setImportRate] = useState(50)
    const [sctRate, setSctRate] = useState(35)
    const [vatRate] = useState(10)
    const [qty, setQty] = useState(120)
    const [calc, setCalc] = useState<LandedCostResult | null>(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        const { rows, total } = await getTaxRates({
            hsCode: hsCode || undefined,
            country: country || undefined,
            agreement: agreement || undefined,
        })
        setRows(rows)
        setTotal(total)
        setLoading(false)
    }, [hsCode, country, agreement])

    const search = async () => {
        await refresh()
    }

    const runCalc = () => {
        const result = calculateLandedCost({ cifUsd, exchangeRate, importTaxRate: importRate, sctRate, vatRate, qty })
        setCalc(result)
    }

    const applyRate = (row: TaxRateRow) => {
        setImportRate(row.importTaxRate)
        setSctRate(row.sctRate)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Xoá thuế suất này?')) return
        const res = await deleteTaxRate(id)
        if (res.success) refresh()
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Tra Cứu Thuế Nhập Khẩu (TAX)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        EVFTA, MFN, AANZFTA — Thuế NK, TTĐB, VAT + Landed Cost Calculator • {total} thuế suất
                    </p>
                </div>
                <button onClick={() => { setEditRow(null); setShowForm(true) }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all"
                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                    <Plus size={16} /> Thêm Thuế Suất
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-md" style={{ background: '#142433', display: 'inline-flex' }}>
                {[
                    { key: 'lookup' as const, label: 'Tra Cứu & Bảng Thuế', icon: Layers },
                    { key: 'engine' as const, label: 'Tax Engine (Tự Động)', icon: Zap },
                ].map(t => {
                    const Icon = t.icon
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-all"
                            style={{
                                borderRadius: '4px',
                                background: tab === t.key ? 'rgba(135,203,185,0.15)' : 'transparent',
                                color: tab === t.key ? '#87CBB9' : '#4A6A7A',
                            }}>
                            <Icon size={14} /> {t.label}
                        </button>
                    )
                })}
            </div>

            {tab === 'lookup' ? (
                <div className="grid grid-cols-12 gap-5">
                    {/* Left — Tax lookup table */}
                    <div className="col-span-12 lg:col-span-7 space-y-4">
                        {/* Search */}
                        <div className="flex gap-3">
                            <input type="text" placeholder="HS Code (vd: 2204.21)" value={hsCode}
                                onChange={e => setHsCode(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm" style={inputStyle} {...focusHandler} />
                            <input type="text" placeholder="Quốc gia xuất xứ" value={country}
                                onChange={e => setCountry(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm" style={inputStyle} {...focusHandler} />
                            <select value={agreement} onChange={e => setAgreement(e.target.value)}
                                className="px-3 py-2 text-sm outline-none"
                                style={{ ...inputStyle, minWidth: 110, color: agreement ? '#E8F1F2' : '#4A6A7A' }}>
                                <option value="">Tất cả HĐ</option>
                                {AGREEMENTS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <button onClick={search} disabled={loading}
                                className="px-4 py-2 text-sm font-semibold transition-all"
                                style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '4px' }}>
                                {loading ? '...' : 'Tìm'}
                            </button>
                        </div>

                        {/* Table */}
                        <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                        {['HS Code', 'Quốc Gia', 'Hiệp Định', 'NK %', 'TTĐB %', 'VAT %', 'C/O', ''].map(h => (
                                            <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                                style={{ color: '#4A6A7A', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>
                                            Không có dữ liệu — Tìm kiếm hoặc thêm bảng thuế
                                        </td></tr>
                                    ) : rows.map(row => (
                                        <tr key={row.id}
                                            style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                                {row.hsCode}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#E8F1F2' }}>{row.countryOfOrigin}</td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                                                    style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>
                                                    {row.tradeAgreement}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                                {row.importTaxRate}%
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#C45A2A' }}>
                                                {row.sctRate}%
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#A5DED0' }}>
                                                {row.vatRate}%
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {row.requiresCo
                                                    ? <span className="text-xs flex items-center gap-1" style={{ color: '#D4A853' }}><AlertCircle size={10} /> {row.coFormType}</span>
                                                    : <span className="text-xs" style={{ color: '#4A6A7A' }}>—</span>
                                                }
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => applyRate(row)}
                                                        className="text-xs px-2 py-0.5 font-medium transition-all"
                                                        style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)', borderRadius: '4px' }}>
                                                        Áp dụng
                                                    </button>
                                                    <button onClick={() => { setEditRow(row); setShowForm(true) }}
                                                        className="p-1 transition-all" style={{ color: '#4A6A7A' }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = '#87CBB9')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = '#4A6A7A')}>
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button onClick={() => handleDelete(row.id)}
                                                        className="p-1 transition-all" style={{ color: '#4A6A7A' }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = '#8B1A2E')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = '#4A6A7A')}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right — Manual calculator */}
                    <div className="col-span-12 lg:col-span-5">
                        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <Calculator size={18} style={{ color: '#87CBB9' }} />
                                <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>Landed Cost Calculator (Thủ Công)</h3>
                            </div>

                            <div className="space-y-3">
                                {[
                                    { label: 'CIF (USD)', value: cifUsd, setter: setCifUsd },
                                    { label: 'Tỷ Giá (VND/USD)', value: exchangeRate, setter: setExchangeRate },
                                    { label: 'Số Lượng (chai)', value: qty, setter: setQty },
                                    { label: 'Thuế NK (%)', value: importRate, setter: setImportRate },
                                    { label: 'TTĐB (%)', value: sctRate, setter: setSctRate },
                                ].map(f => (
                                    <div key={f.label}>
                                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>
                                            {f.label}
                                        </label>
                                        <input type="number" value={f.value}
                                            onChange={e => f.setter(Number(e.target.value))}
                                            className="w-full px-3 py-2 text-sm" style={inputStyle} {...focusHandler} />
                                    </div>
                                ))}

                                <div className="flex items-center justify-between p-2 rounded" style={{ background: '#142433' }}>
                                    <span className="text-xs" style={{ color: '#4A6A7A' }}>VAT</span>
                                    <span className="text-xs font-bold" style={{ color: '#A5DED0' }}>10% (cố định)</span>
                                </div>

                                <button onClick={runCalc}
                                    className="w-full py-2.5 text-sm font-semibold transition-all"
                                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                                    Tính Landed Cost
                                </button>
                            </div>

                            {calc && (
                                <div className="mt-5 space-y-2 pt-5" style={{ borderTop: '1px solid #2A4355' }}>
                                    {[
                                        { label: 'CIF (VND)', value: formatVND(calc.cifVnd), color: '#8AAEBB' },
                                        { label: 'Thuế Nhập Khẩu', value: formatVND(calc.importTax), color: '#D4A853' },
                                        { label: 'Thuế TTĐB', value: formatVND(calc.sct), color: '#C45A2A' },
                                        { label: 'VAT Nhập Khẩu', value: formatVND(calc.vat), color: '#A5DED0' },
                                        { label: 'Tổng Thuế', value: formatVND(calc.totalTax), color: '#8B1A2E' },
                                    ].map(item => (
                                        <div key={item.label} className="flex justify-between items-center">
                                            <span className="text-xs" style={{ color: '#8AAEBB' }}>{item.label}</span>
                                            <span className="text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: item.color }}>
                                                {item.value}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-2 mt-2"
                                        style={{ borderTop: '1px solid #2A4355' }}>
                                        <span className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Giá Vốn / Chai</span>
                                        <span className="text-lg font-bold" style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>
                                            {formatVND(calc.unitLandedCost)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <CheckCircle2 size={12} style={{ color: '#5BA88A' }} />
                                        <span className="text-xs" style={{ color: '#5BA88A' }}>
                                            Tổng thuế hiệu dụng: {calc.effectiveTaxRate.toFixed(1)}% trên CIF
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-12 gap-5">
                    <div className="col-span-12 lg:col-span-7">
                        <TaxEnginePanel />
                    </div>
                    <div className="col-span-12 lg:col-span-5 space-y-4">
                        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <h3 className="font-semibold mb-3" style={{ color: '#E8F1F2' }}>Cách Hoạt Động</h3>
                            <div className="space-y-2">
                                {[
                                    { step: '1', label: 'Nhập Quốc gia + HS Code', desc: 'Hệ thống tra thuế suất từ cơ sở dữ liệu' },
                                    { step: '2', label: 'Nhập ABV (%)', desc: 'Tự động chọn TTĐB: <20° → 35%, ≥20° → 65%' },
                                    { step: '3', label: 'Nhập CIF + Tỷ giá + Số lượng', desc: 'Tính: CIF → NK → TTĐB → VAT → Landed Cost' },
                                ].map(s => (
                                    <div key={s.step} className="flex gap-3 items-start">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                            style={{ background: 'rgba(212,168,83,0.2)', color: '#D4A853' }}>{s.step}</span>
                                        <div>
                                            <p className="text-xs font-semibold" style={{ color: '#E8F1F2' }}>{s.label}</p>
                                            <p className="text-xs" style={{ color: '#4A6A7A' }}>{s.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                            <p className="text-xs font-semibold mb-2" style={{ color: '#D4A853' }}>⚠ Lưu Ý Pháp Lý</p>
                            <ul className="space-y-1.5 text-xs" style={{ color: '#4A6A7A' }}>
                                <li>• Thuế TTĐB (SCT): 35% nếu ABV {'<'} 20°, 65% nếu ABV ≥ 20°</li>
                                <li>• EVFTA: Thuế NK = 0% cho rượu vang EU (thực hiện từ 2020)</li>
                                <li>• MFN: Thuế NK = 50-55% cho quốc gia không có FTA</li>
                                <li>• VAT NK = 10% cố định trên (CIF + NK + TTĐB)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Form modal */}
            {showForm && (
                <TaxRateForm
                    existing={editRow}
                    onClose={() => { setShowForm(false); setEditRow(null) }}
                    onSaved={refresh}
                />
            )}
        </div>
    )
}
