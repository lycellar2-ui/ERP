'use client'

import { useState, useCallback } from 'react'
import { Layers, Calculator, CheckCircle2, AlertCircle, Plus, Pencil, Trash2, X, Loader2, Zap, CalendarRange, ArrowRight, Upload } from 'lucide-react'
import { TaxRateRow, TaxRateInput, getTaxRates, createTaxRate, updateTaxRate, deleteTaxRate, calculateTaxEngine, TaxEngineResult, importTaxRatesFromExcel, parseTaxExcelTemplate } from './actions'
import type { BulkTaxRow } from './actions'
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

// ── EVFTA Roadmap Panel ──────────────────────────
const EVFTA_CATEGORIES = [
    {
        name: 'Rượu vang ≤ 2L (HS 2204.21)',
        hsCode: '2204.21',
        color: '#87CBB9',
        schedule: [
            { year: 2020, rate: 42, note: 'Năm đầu áp dụng EVFTA' },
            { year: 2021, rate: 36, note: '' },
            { year: 2022, rate: 30, note: '' },
            { year: 2023, rate: 24, note: '' },
            { year: 2024, rate: 18, note: '' },
            { year: 2025, rate: 12, note: '' },
            { year: 2026, rate: 6, note: '' },
            { year: 2027, rate: 0, note: 'Miễn thuế hoàn toàn' },
        ],
    },
    {
        name: 'Rượu vang > 2L (HS 2204.22)',
        hsCode: '2204.22',
        color: '#D4A853',
        schedule: [
            { year: 2020, rate: 34, note: '' },
            { year: 2021, rate: 29, note: '' },
            { year: 2022, rate: 24, note: '' },
            { year: 2023, rate: 19, note: '' },
            { year: 2024, rate: 14, note: '' },
            { year: 2025, rate: 10, note: '' },
            { year: 2026, rate: 5, note: '' },
            { year: 2027, rate: 0, note: 'Miễn thuế hoàn toàn' },
        ],
    },
    {
        name: 'Rượu mạnh < 20° (HS 2208.xx)',
        hsCode: '2208',
        color: '#C45A2A',
        schedule: [
            { year: 2020, rate: 48, note: '' },
            { year: 2021, rate: 41, note: '' },
            { year: 2022, rate: 34, note: '' },
            { year: 2023, rate: 27, note: '' },
            { year: 2024, rate: 21, note: '' },
            { year: 2025, rate: 14, note: '' },
            { year: 2026, rate: 7, note: '' },
            { year: 2027, rate: 0, note: 'Miễn thuế hoàn toàn' },
        ],
    },
    {
        name: 'Rượu mạnh ≥ 20° (HS 2208.xx)',
        hsCode: '2208',
        color: '#8B1A2E',
        schedule: [
            { year: 2020, rate: 48, note: '' },
            { year: 2021, rate: 41, note: '' },
            { year: 2022, rate: 34, note: '' },
            { year: 2023, rate: 27, note: '' },
            { year: 2024, rate: 21, note: '' },
            { year: 2025, rate: 14, note: '' },
            { year: 2026, rate: 7, note: '' },
            { year: 2027, rate: 0, note: 'Miễn thuế hoàn toàn' },
        ],
    },
]

function EVFTARoadmapPanel() {
    const currentYear = new Date().getFullYear()
    const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]
    const maxRate = 50

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="flex items-center gap-3 mb-3">
                    <CalendarRange size={20} style={{ color: '#5BA88A' }} />
                    <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                        Lộ Trình Giảm Thuế EVFTA (2020–2027)
                    </h3>
                </div>
                <p className="text-xs" style={{ color: '#4A6A7A' }}>
                    Hiệp định EVFTA có hiệu lực 01/08/2020. Thuế NK rượu vang & spirits từ EU giảm dần về 0% trong 7 năm.
                    Yêu cầu C/O EUR.1 hoặc tự chứng nhận xuất xứ REX.
                </p>
                <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs px-2 py-0.5 rounded font-bold"
                        style={{ background: 'rgba(91,168,138,0.2)', color: '#5BA88A' }}>
                        Năm hiện tại: {currentYear}
                    </span>
                    {currentYear >= 2027 && (
                        <span className="text-xs px-2 py-0.5 rounded font-bold"
                            style={{ background: 'rgba(91,168,138,0.2)', color: '#5BA88A' }}>
                            ✅ Đã miễn thuế hoàn toàn
                        </span>
                    )}
                </div>
            </div>

            {/* Timeline chart */}
            <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <h4 className="text-sm font-semibold mb-4" style={{ color: '#E8F1F2' }}>Biểu Đồ Thuế NK Theo Năm (%)</h4>
                <div className="overflow-x-auto">
                    <div style={{ minWidth: 700 }}>
                        {/* Year header */}
                        <div className="flex items-end gap-1 mb-2" style={{ paddingLeft: 160 }}>
                            {years.map(y => (
                                <div key={y} className="flex-1 text-center">
                                    <span className="text-xs font-bold" style={{
                                        color: y === currentYear ? '#87CBB9' : y < currentYear ? '#4A6A7A' : '#8AAEBB',
                                        fontFamily: '"DM Mono"',
                                    }}>
                                        {y}
                                    </span>
                                    {y === currentYear && (
                                        <div className="w-1.5 h-1.5 rounded-full mx-auto mt-0.5" style={{ background: '#87CBB9' }} />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Category bars */}
                        {EVFTA_CATEGORIES.map(cat => (
                            <div key={cat.name} className="flex items-center gap-1 mb-2">
                                <div className="w-40 text-right pr-3 shrink-0">
                                    <span className="text-xs font-semibold" style={{ color: cat.color }}>{cat.name.split(' (')[0]}</span>
                                </div>
                                {cat.schedule.map(s => {
                                    const pct = (s.rate / maxRate) * 100
                                    const isPast = s.year < currentYear
                                    const isCurrent = s.year === currentYear
                                    return (
                                        <div key={s.year} className="flex-1" style={{ height: 28 }}>
                                            <div className="relative h-full flex items-end rounded-sm overflow-hidden"
                                                style={{ background: '#142433' }}>
                                                <div className="w-full rounded-sm transition-all duration-300"
                                                    style={{
                                                        height: `${pct}%`,
                                                        background: isPast ? `${cat.color}40` : isCurrent ? cat.color : `${cat.color}80`,
                                                        border: isCurrent ? `2px solid ${cat.color}` : 'none',
                                                    }} />
                                                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
                                                    style={{ color: s.rate === 0 ? '#5BA88A' : '#E8F1F2', fontFamily: '"DM Mono"' }}>
                                                    {s.rate === 0 ? '0%' : `${s.rate}%`}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Detail cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {EVFTA_CATEGORIES.map(cat => {
                    const currentEntry = cat.schedule.find(s => s.year === currentYear) ?? cat.schedule[cat.schedule.length - 1]
                    const nextEntry = cat.schedule.find(s => s.year === currentYear + 1)
                    return (
                        <div key={cat.name} className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: `3px solid ${cat.color}` }}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="text-xs font-bold" style={{ color: cat.color }}>{cat.name}</p>
                                    <p className="text-[10px]" style={{ color: '#4A6A7A' }}>{cat.hsCode}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold" style={{ color: cat.color, fontFamily: '"DM Mono"' }}>
                                        {currentEntry.rate}%
                                    </p>
                                    <p className="text-[10px]" style={{ color: '#4A6A7A' }}>thuế NK {currentYear}</p>
                                </div>
                            </div>
                            {nextEntry && (
                                <div className="flex items-center gap-2 text-xs" style={{ color: '#5BA88A' }}>
                                    <ArrowRight size={10} />
                                    {nextEntry.year}: {nextEntry.rate}%
                                    {nextEntry.rate === 0 && ' (Miễn thuế!)'}
                                </div>
                            )}
                            {/* Mini progress */}
                            <div className="mt-3">
                                <div className="flex justify-between text-[10px] mb-1">
                                    <span style={{ color: '#4A6A7A' }}>Tiến trình giảm thuế</span>
                                    <span style={{ color: '#8AAEBB' }}>
                                        {Math.round(((cat.schedule[0].rate - currentEntry.rate) / cat.schedule[0].rate) * 100)}% hoàn thành
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#142433' }}>
                                    <div className="h-full rounded-full transition-all" style={{
                                        width: `${((cat.schedule[0].rate - currentEntry.rate) / cat.schedule[0].rate) * 100}%`,
                                        background: cat.color,
                                    }} />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Notes */}
            <div className="p-4 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#D4A853' }}>⚠ Điều Kiện Áp Dụng EVFTA</p>
                <ul className="grid grid-cols-1 lg:grid-cols-2 gap-1.5 text-xs" style={{ color: '#4A6A7A' }}>
                    <li>• Hàng hóa phải có xuất xứ EU (C/O EUR.1)</li>
                    <li>• Tự chứng nhận xuất xứ REX cho lô {'<'} 6,000 EUR</li>
                    <li>• Thuế TTĐB không thay đổi (35% / 65%)</li>
                    <li>• VAT 10% không thay đổi</li>
                    <li>• Áp dụng cho 27 quốc gia thành viên EU</li>
                    <li>• Không áp dụng cho hàng gia công tại nước thứ 3</li>
                </ul>
            </div>
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
    const [tab, setTab] = useState<'lookup' | 'engine' | 'evfta' | 'upload'>('lookup')

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
                    { key: 'evfta' as const, label: 'EVFTA Roadmap', icon: CalendarRange },
                    { key: 'upload' as const, label: 'Nhập Excel', icon: Upload },
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
            ) : tab === 'engine' ? (
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
            ) : tab === 'evfta' ? (
                <EVFTARoadmapPanel />
            ) : tab === 'upload' ? (
                <BulkUploadPanel onDone={refresh} />
            ) : null}

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

// ── Bulk Upload Panel ────────────────────────────
function BulkUploadPanel({ onDone }: { onDone: () => void }) {
    const [pasteData, setPasteData] = useState('')
    const [parsed, setParsed] = useState<BulkTaxRow[]>([])
    const [importing, setImporting] = useState(false)
    const [result, setResult] = useState<{ imported: number; updated: number; errors: string[] } | null>(null)

    const HEADER_LABELS = ['HS Code', 'Quốc Gia', 'Hiệp Định', 'NK %', 'TTĐB %', 'VAT %', 'Ngày HĐ']

    const handleParse = () => {
        const lines = pasteData.trim().split('\n').filter(l => l.trim())
        const rows: BulkTaxRow[] = []
        for (const line of lines) {
            const cols = line.split('\t').length > 1 ? line.split('\t') : line.split(',')
            if (cols.length < 7) continue
            if (cols[0].toLowerCase().includes('hscode') || cols[0].toLowerCase().includes('hs code')) continue
            rows.push({
                hsCode: cols[0]?.trim() || '',
                countryOfOrigin: cols[1]?.trim() || '',
                tradeAgreement: cols[2]?.trim() || 'MFN',
                importTaxRate: parseFloat(cols[3]) || 0,
                sctRate: parseFloat(cols[4]) || 35,
                vatRate: parseFloat(cols[5]) || 10,
                effectiveDate: cols[6]?.trim() || new Date().toISOString().split('T')[0],
            })
        }
        setParsed(rows)
    }

    const handleImport = async () => {
        if (parsed.length === 0) return
        setImporting(true)
        const res = await importTaxRatesFromExcel(parsed)
        setResult({ imported: res.success ? (res as any).imported : 0, updated: res.success ? (res as any).updated : 0, errors: res.success ? [] : [(res as any).error || 'Lỗi nhập dữ liệu'] })
        setImporting(false)
        if (res.success) onDone()
    }

    return (
        <div className="space-y-5">
            <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="flex items-center gap-2 mb-3">
                    <Upload size={18} style={{ color: '#D4A853' }} />
                    <h3 className="font-semibold" style={{ color: '#E8F1F2' }}>Nhập Thuế Suất Hàng Loạt</h3>
                </div>
                <p className="text-xs mb-3" style={{ color: '#4A6A7A' }}>
                    Sao chép dữ liệu từ Excel (Tab-delimited hoặc CSV) và dán vào ô bên dưới. Hệ thống sẽ tự nhận dạng và upsert.
                </p>
                <div className="flex flex-wrap gap-2">
                    {HEADER_LABELS.map(h => (
                        <span key={h} className="px-2 py-0.5 text-[10px] font-bold rounded"
                            style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>{h}</span>
                    ))}
                </div>
            </div>

            <textarea value={pasteData} onChange={e => setPasteData(e.target.value)}
                placeholder="2204.21&#9;France&#9;EVFTA&#9;10&#9;35&#9;10&#9;2026-01-01"
                rows={6} className="w-full px-4 py-3 text-xs font-mono"
                style={{ ...inputStyle, resize: 'vertical' as const, minHeight: '100px' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />

            <button onClick={handleParse}
                className="px-5 py-2 text-sm font-semibold transition-all"
                style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                📋 Phân Tích Dữ Liệu
            </button>

            {parsed.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold mb-2" style={{ color: '#E8F1F2' }}>
                        Xem Trước ({parsed.length} bản ghi)
                    </h4>
                    <div className="rounded-md overflow-auto" style={{ border: '1px solid #2A4355', maxHeight: '300px' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                    {HEADER_LABELS.map(h => (
                                        <th key={h} className="px-3 py-2 text-xs uppercase tracking-wider font-semibold sticky top-0"
                                            style={{ color: '#4A6A7A', background: '#142433' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {parsed.map((r, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                        <td className="px-3 py-2 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{r.hsCode}</td>
                                        <td className="px-3 py-2 text-xs" style={{ color: '#E8F1F2' }}>{r.countryOfOrigin}</td>
                                        <td className="px-3 py-2"><span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>{r.tradeAgreement}</span></td>
                                        <td className="px-3 py-2 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>{r.importTaxRate}%</td>
                                        <td className="px-3 py-2 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#C45A2A' }}>{r.sctRate}%</td>
                                        <td className="px-3 py-2 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#A5DED0' }}>{r.vatRate}%</td>
                                        <td className="px-3 py-2 text-xs" style={{ color: '#8AAEBB' }}>{r.effectiveDate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={handleImport} disabled={importing}
                        className="mt-3 px-6 py-2.5 text-sm font-bold transition-all flex items-center gap-2"
                        style={{ background: '#D4A853', color: '#0A1926', borderRadius: '6px', opacity: importing ? 0.7 : 1 }}>
                        {importing && <Loader2 size={14} className="animate-spin" />}
                        {importing ? 'Đang nhập...' : `⬆️ Nhập ${parsed.length} Thuế Suất`}
                    </button>
                </div>
            )}

            {result && (
                <div className="p-4 rounded-md" style={{ border: '1px solid #2A4355', background: result.errors.length === 0 ? 'rgba(91,168,138,0.08)' : 'rgba(232,93,93,0.08)' }}>
                    <div className="flex items-center gap-3 mb-2">
                        <CheckCircle2 size={16} style={{ color: '#5BA88A' }} />
                        <span className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Kết Quả Nhập</span>
                    </div>
                    <div className="flex gap-4 text-xs">
                        <span style={{ color: '#5BA88A' }}>✅ Mới: {result.imported}</span>
                        <span style={{ color: '#D4A853' }}>🔄 Cập nhật: {result.updated}</span>
                        {result.errors.length > 0 && <span style={{ color: '#E85D5D' }}>❌ Lỗi: {result.errors.length}</span>}
                    </div>
                    {result.errors.length > 0 && (
                        <div className="mt-2 p-2 rounded text-xs space-y-1" style={{ background: 'rgba(232,93,93,0.1)' }}>
                            {result.errors.slice(0, 5).map((e, i) => (
                                <p key={i} style={{ color: '#E85D5D' }}>• {e}</p>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
