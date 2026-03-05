'use client'

import { useState, useEffect } from 'react'
import {
    Target, TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
    Settings, Plus, Trash2, Save, X
} from 'lucide-react'
import type { KpiSummary, KpiTargetRow } from './actions'
import {
    getKpiSummary, getKpiTargets, upsertKpiTarget, deleteKpiTarget,
    getSalesRepOptions, getAvailableMetrics,
} from './actions'

const STATUS_CFG = {
    ON_TRACK: { label: '✅ Đúng KH', color: '#5BA88A', icon: CheckCircle2 },
    AT_RISK: { label: '⚠️ Chú ý', color: '#D4A853', icon: AlertCircle },
    BEHIND: { label: '🔴 Chậm', color: '#8B1A2E', icon: TrendingDown },
    EXCEEDED: { label: '🌟 Vượt KH', color: '#87CBB9', icon: TrendingUp },
}

function formatValue(val: number, unit: string) {
    if (unit === 'VND') {
        if (val >= 1e9) return `₫${(val / 1e9).toFixed(2)}T`
        if (val >= 1e6) return `₫${(val / 1e6).toFixed(0)}M`
        return `₫${val.toLocaleString()}`
    }
    return `${val.toLocaleString()} ${unit}`
}

interface Props {
    summaries: KpiSummary[]
    year: number
    month: number
}

export function KpiClient({ summaries: initialSummaries, year, month }: Props) {
    const [summaries, setSummaries] = useState(initialSummaries)
    const [tab, setTab] = useState<'dashboard' | 'setup'>('dashboard')
    const [targets, setTargets] = useState<KpiTargetRow[]>([])
    const [salesReps, setSalesReps] = useState<{ id: string; name: string; email: string }[]>([])
    const [addOpen, setAddOpen] = useState(false)
    const [addForm, setAddForm] = useState({ metric: 'REVENUE', year, month: month as number | null, targetValue: '', unit: 'VND', salesRepId: '' })

    const [metrics, setMetrics] = useState<{ metric: string; label: string; unit: string }[]>([])

    useEffect(() => { getAvailableMetrics().then(setMetrics) }, [])

    const loadSetup = async () => {
        const [t, reps] = await Promise.all([getKpiTargets(year), getSalesRepOptions()])
        setTargets(t)
        setSalesReps(reps)
    }

    useEffect(() => { if (tab === 'setup') loadSetup() }, [tab])

    const handleSave = async () => {
        if (!addForm.targetValue) return alert('Nhập giá trị chỉ tiêu')
        const res = await upsertKpiTarget({
            metric: addForm.metric,
            year: addForm.year,
            month: addForm.month,
            targetValue: Number(addForm.targetValue),
            unit: addForm.unit,
            salesRepId: addForm.salesRepId || null,
        })
        if (res.success) {
            setAddOpen(false)
            setAddForm({ metric: 'REVENUE', year, month, targetValue: '', unit: 'VND', salesRepId: '' })
            loadSetup()
            // Reload dashboard data
            const newSummaries = await getKpiSummary()
            setSummaries(newSummaries)
        } else alert(res.error)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa chỉ tiêu này?')) return
        const res = await deleteKpiTarget(id)
        if (res.success) {
            loadSetup()
            const newSummaries = await getKpiSummary()
            setSummaries(newSummaries)
        }
    }

    const onTrack = summaries.filter(s => s.status === 'ON_TRACK' || s.status === 'EXCEEDED').length
    const behind = summaries.filter(s => s.status === 'BEHIND').length

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        KPI Chỉ Tiêu Kinh Doanh
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Tháng {month}/{year} — Dữ liệu real-time từ tất cả module
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1" style={{ borderBottom: '1px solid #2A4355' }}>
                {(['dashboard', 'setup'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all"
                        style={{
                            color: tab === t ? '#87CBB9' : '#4A6A7A',
                            borderBottom: tab === t ? '2px solid #87CBB9' : '2px solid transparent',
                        }}>
                        {t === 'dashboard' ? <><Target size={12} className="inline mr-1" />Dashboard</> :
                            <><Settings size={12} className="inline mr-1" />Cấu Hình Chỉ Tiêu</>}
                    </button>
                ))}
            </div>

            {tab === 'dashboard' && (
                <>
                    {/* Overview */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-4 rounded-md flex items-center gap-3"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: '3px solid #5BA88A' }}>
                            <CheckCircle2 size={20} style={{ color: '#5BA88A' }} />
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Đạt / Vượt KH</p>
                                <p className="text-xl font-bold" style={{ fontFamily: '"DM Mono"', color: '#5BA88A' }}>{onTrack}/{summaries.length}</p>
                            </div>
                        </div>
                        <div className="p-4 rounded-md flex items-center gap-3"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: '3px solid #D4A853' }}>
                            <AlertCircle size={20} style={{ color: '#D4A853' }} />
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Cần Chú Ý</p>
                                <p className="text-xl font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                    {summaries.filter(s => s.status === 'AT_RISK').length}
                                </p>
                            </div>
                        </div>
                        <div className="p-4 rounded-md flex items-center gap-3"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: `3px solid ${behind > 0 ? '#8B1A2E' : '#5BA88A'}` }}>
                            <TrendingDown size={20} style={{ color: behind > 0 ? '#8B1A2E' : '#5BA88A' }} />
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Đang Chậm</p>
                                <p className="text-xl font-bold" style={{ fontFamily: '"DM Mono"', color: behind > 0 ? '#8B1A2E' : '#5BA88A' }}>{behind}</p>
                            </div>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {summaries.map(kpi => {
                            const cfg = STATUS_CFG[kpi.status]
                            const barPct = Math.min(Math.min(kpi.progressPct, 120), 100)
                            return (
                                <div key={kpi.metric} className="p-5 rounded-md"
                                    style={{ background: '#1B2E3D', border: `1px solid ${kpi.progressPct < 70 ? 'rgba(139,26,46,0.4)' : '#2A4355'}` }}>
                                    <div className="flex items-start justify-between mb-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>{kpi.label}</p>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                            style={{ color: cfg.color, background: `${cfg.color}20` }}>{cfg.label}</span>
                                    </div>
                                    <div className="mb-4">
                                        <div className="flex justify-between text-xs mb-1.5">
                                            <span className="font-bold" style={{ color: kpi.color, fontFamily: '"DM Mono"' }}>
                                                {formatValue(kpi.actual, kpi.unit)}
                                            </span>
                                            <span style={{ color: '#4A6A7A' }}>KH: {formatValue(kpi.target, kpi.unit)}</span>
                                        </div>
                                        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#142433' }}>
                                            <div className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${barPct}%`,
                                                    background: kpi.progressPct > 110 ? '#D4A853' : kpi.progressPct < 70 ? '#8B1A2E' : kpi.color,
                                                }} />
                                        </div>
                                        <div className="flex justify-between mt-1">
                                            <span className="text-xs" style={{ color: '#4A6A7A' }}>
                                                Còn thiếu: {kpi.actual < kpi.target ? formatValue(kpi.target - kpi.actual, kpi.unit) : '—'}
                                            </span>
                                            <span className="text-xs font-bold" style={{ color: cfg.color }}>{kpi.progressPct.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                        {kpi.unit === 'VND' && kpi.actual > 0
                                            ? `Dự báo cuối tháng: ${formatValue(kpi.actual * (30 / new Date().getDate()), 'VND')}`
                                            : 'Cập nhật real-time từ database'}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}

            {tab === 'setup' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold" style={{ color: '#D4A853' }}>
                            Cấu hình chỉ tiêu năm {year}
                        </h3>
                        <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-semibold"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            <Plus size={12} /> Thêm Chỉ Tiêu
                        </button>
                    </div>

                    {/* Add Form */}
                    {addOpen && (
                        <div className="p-4 rounded-md space-y-3" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold" style={{ color: '#87CBB9' }}>Thêm / Cập Nhật Chỉ Tiêu</h4>
                                <button onClick={() => setAddOpen(false)} style={{ color: '#4A6A7A' }}><X size={14} /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-semibold" style={{ color: '#4A6A7A' }}>Metric</label>
                                    <select value={addForm.metric}
                                        onChange={e => {
                                            const m = metrics.find(x => x.metric === e.target.value)
                                            setAddForm(f => ({ ...f, metric: e.target.value, unit: m?.unit ?? 'VND' }))
                                        }}
                                        className="w-full px-3 py-2 rounded text-xs" style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                        {metrics.map(m => <option key={m.metric} value={m.metric}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold" style={{ color: '#4A6A7A' }}>Tháng (để trống = cả năm)</label>
                                    <select value={addForm.month ?? ''}
                                        onChange={e => setAddForm(f => ({ ...f, month: e.target.value ? Number(e.target.value) : null }))}
                                        className="w-full px-3 py-2 rounded text-xs" style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                        <option value="">Cả năm</option>
                                        {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold" style={{ color: '#4A6A7A' }}>Giá trị chỉ tiêu</label>
                                    <input type="number" value={addForm.targetValue}
                                        onChange={e => setAddForm(f => ({ ...f, targetValue: e.target.value }))}
                                        placeholder="5000000000" className="w-full px-3 py-2 rounded text-xs"
                                        style={{ background: '#142433', border: '1px solid #2A4355', color: '#D4A853' }} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold" style={{ color: '#4A6A7A' }}>Sales Rep (tuỳ chọn)</label>
                                    <select value={addForm.salesRepId}
                                        onChange={e => setAddForm(f => ({ ...f, salesRepId: e.target.value }))}
                                        className="w-full px-3 py-2 rounded text-xs" style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                        <option value="">— Toàn công ty —</option>
                                        {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleSave} className="flex items-center gap-1 px-4 py-2 text-xs font-bold rounded"
                                style={{ background: '#87CBB9', color: '#0A1926' }}>
                                <Save size={12} /> Lưu Chỉ Tiêu
                            </button>
                        </div>
                    )}

                    {/* Targets Table */}
                    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                    {['Metric', 'Kỳ', 'Chỉ Tiêu', 'ĐV', 'Sales Rep', ''].map(h => (
                                        <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                            style={{ color: '#4A6A7A' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {targets.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>
                                        Chưa có chỉ tiêu — Sử dụng giá trị mặc định. Nhấn "Thêm Chỉ Tiêu" để tuỳ chỉnh.
                                    </td></tr>
                                ) : targets.map(t => {
                                    const metricInfo = metrics.find(m => m.metric === t.metric)
                                    return (
                                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#87CBB9' }}>
                                                {metricInfo?.label ?? t.metric}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>
                                                {t.month ? `T${t.month}/${t.year}` : `Năm ${t.year}`}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                                                {t.targetValue.toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{t.unit}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#E8F1F2' }}>
                                                {t.salesRepName ?? '🏢 Toàn công ty'}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <button onClick={() => handleDelete(t.id)} className="p-1 transition-all"
                                                    style={{ color: '#4A6A7A' }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = '#8B1A2E')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = '#4A6A7A')}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Default values info */}
                    <div className="p-4 rounded-md" style={{ background: 'rgba(135,203,185,0.05)', border: '1px dashed rgba(135,203,185,0.3)' }}>
                        <p className="text-xs font-bold mb-2" style={{ color: '#87CBB9' }}>Giá trị mặc định (khi chưa cấu hình):</p>
                        <div className="grid grid-cols-2 gap-1">
                            {metrics.map(m => {
                                const def = { REVENUE: '5 tỷ', ORDERS: '50 đơn', NEW_CUSTOMERS: '5 KH', AR_LIMIT: '2 tỷ', STOCK_VALUE: '10 tỷ' }
                                return (
                                    <p key={m.metric} className="text-xs" style={{ color: '#4A6A7A' }}>
                                        • {m.label}: <span style={{ color: '#D4A853' }}>{(def as any)[m.metric]}</span>
                                    </p>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
