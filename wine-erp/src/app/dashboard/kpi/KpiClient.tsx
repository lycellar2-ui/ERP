'use client'

import { useState, useEffect } from 'react'
import {
    Target, TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
    Settings, Plus, Trash2, Save, X, Copy, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, StatGrid, StatCard, Button } from '@/components/ui'
import type { KpiSummary, KpiTargetRow } from './actions'
import {
    getKpiSummary, getKpiTargets, upsertKpiTarget, deleteKpiTarget,
    getSalesRepOptions, getAvailableMetrics, copyKpiFromPreviousYear,
} from './actions'

const STATUS_CFG = {
    ON_TRACK: { label: '✅ Đúng KH', color: '#15803D', icon: CheckCircle2 },
    AT_RISK: { label: '⚠️ Chú ý', color: '#B45309', icon: AlertCircle },
    BEHIND: { label: '🔴 Chậm', color: '#B91C1C', icon: TrendingDown },
    EXCEEDED: { label: '🌟 Vượt KH', color: '#0891B2', icon: TrendingUp },
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
    const [copying, setCopying] = useState(false)
    const [copyResult, setCopyResult] = useState<string | null>(null)
    const [growthPct, setGrowthPct] = useState(10)

    useEffect(() => { getAvailableMetrics().then(setMetrics) }, [])

    const loadSetup = async () => {
        const [t, reps] = await Promise.all([getKpiTargets(year), getSalesRepOptions()])
        setTargets(t)
        setSalesReps(reps)
    }

    useEffect(() => { if (tab === 'setup') loadSetup() }, [tab])

    const handleSave = async () => {
        if (!addForm.targetValue) return toast.error('Nhập giá trị chỉ tiêu')
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
        } else toast.error(res.error || 'Lỗi lưu chỉ tiêu')
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
            <PageHeader
                title="KPI Chỉ Tiêu Kinh Doanh"
                description={`Tháng ${month}/${year} — Dữ liệu real-time từ tất cả module`}
            />

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                {(['dashboard', 'setup'] as const).map(t => {
                    const isActive = tab === t
                    return (
                        <button key={t} onClick={() => setTab(t)}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all flex-1 justify-center cursor-pointer"
                            style={{
                                background: isActive ? 'rgba(8, 145, 178, 0.08)' : 'transparent',
                                color: isActive ? '#0891B2' : '#64748B',
                                border: isActive ? '1px solid rgba(8, 145, 178, 0.2)' : '1px solid transparent',
                            }}>
                            {t === 'dashboard' ? <><Target size={14} /> Dashboard</> :
                                <><Settings size={14} /> Cấu Hình Chỉ Tiêu</>}
                        </button>
                    )
                })}
            </div>

            {tab === 'dashboard' && (
                <>
                    {/* Overview */}
                    <StatGrid className="grid-cols-1 sm:grid-cols-3 lg:grid-cols-3">
                        <StatCard
                            label="Đạt / Vượt KH"
                            value={`${onTrack}/${summaries.length}`}
                            icon={CheckCircle2}
                            tone="success"
                        />
                        <StatCard
                            label="Cần Chú Ý"
                            value={summaries.filter(s => s.status === 'AT_RISK').length}
                            icon={AlertCircle}
                            tone="warning"
                        />
                        <StatCard
                            label="Đang Chậm"
                            value={behind}
                            icon={TrendingDown}
                            tone={behind > 0 ? 'danger' : 'success'}
                        />
                    </StatGrid>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {summaries.map(kpi => {
                            const cfg = STATUS_CFG[kpi.status]
                            const barPct = Math.min(Math.min(kpi.progressPct, 120), 100)
                            return (
                                <div key={kpi.metric} className="p-5 rounded-md"
                                    style={{ background: '#FFFFFF', border: `1px solid ${kpi.progressPct < 70 ? 'rgba(185,28,28,0.4)' : '#E2E8F0'}` }}>
                                    <div className="flex items-start justify-between mb-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>{kpi.label}</p>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                            style={{ color: cfg.color, background: `${cfg.color}20` }}>{cfg.label}</span>
                                    </div>
                                    <div className="mb-4">
                                        <div className="flex justify-between text-xs mb-1.5">
                                            <span className="font-bold" style={{ color: kpi.color }}>
                                                {formatValue(kpi.actual, kpi.unit)}
                                            </span>
                                            <span style={{ color: '#64748B' }}>KH: {formatValue(kpi.target, kpi.unit)}</span>
                                        </div>
                                        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#FFFFFF' }}>
                                            <div className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${barPct}%`,
                                                    background: kpi.progressPct > 110 ? '#B45309' : kpi.progressPct < 70 ? '#B91C1C' : kpi.color,
                                                }} />
                                        </div>
                                        <div className="flex justify-between mt-1">
                                            <span className="text-xs" style={{ color: '#64748B' }}>
                                                Còn thiếu: {kpi.actual < kpi.target ? formatValue(kpi.target - kpi.actual, kpi.unit) : '—'}
                                            </span>
                                            <span className="text-xs font-bold" style={{ color: cfg.color }}>{kpi.progressPct.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    <p className="text-xs" style={{ color: '#64748B' }}>
                                        {kpi.unit === 'VND' && kpi.actual > 0 ? (
                                            <>
                                                Dự báo cuối tháng: <span style={{ color: '#B45309', fontWeight: 600 }}>
                                                    {formatValue(kpi.actual * (30 / Math.max(new Date().getDate(), 1)), 'VND')}
                                                </span>
                                                {kpi.forecast ? ` (AI: ${formatValue(kpi.forecast, 'VND')})` : ''}
                                            </>
                                        ) : 'Cập nhật real-time từ database'}
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
                        <h3 className="text-sm font-bold" style={{ color: '#B45309' }}>
                            Cấu hình chỉ tiêu năm {year}
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-semibold"
                                style={{ background: '#0891B2', color: '#FFFFFF' }}>
                                <Plus size={12} /> Thêm Chỉ Tiêu
                            </button>
                            <div className="flex items-center gap-1">
                                <input type="number" className="w-14 px-2 py-1.5 rounded text-xs text-center"
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#B45309' }}
                                    value={growthPct} onChange={e => setGrowthPct(Number(e.target.value))} />
                                <span className="text-xs" style={{ color: '#64748B' }}>%</span>
                                <button onClick={async () => {
                                    setCopying(true); setCopyResult(null)
                                    const res = await copyKpiFromPreviousYear({
                                        fromYear: year - 1,
                                        toYear: year,
                                        growthMultiplier: 1 + growthPct / 100,
                                    })
                                    if (res.success) {
                                        setCopyResult(`✅ Đã copy ${res.copied} chỉ tiêu từ ${year - 1} (+${growthPct}%)`)
                                        loadSetup()
                                    } else setCopyResult(res.error || 'Lỗi copy')
                                    setCopying(false)
                                    setTimeout(() => setCopyResult(null), 4000)
                                }} disabled={copying}
                                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-semibold disabled:opacity-50"
                                    style={{ background: 'rgba(180,83,9,0.12)', color: '#B45309', border: '1px solid rgba(180,83,9,0.25)' }}>
                                    {copying ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
                                    Copy từ {year - 1}
                                </button>
                            </div>
                        </div>
                        {copyResult && <p className="text-xs mt-1" style={{ color: '#B45309' }}>{copyResult}</p>}
                    </div>

                    {/* Add Form */}
                    {addOpen && (
                        <div className="p-4 rounded-md space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold" style={{ color: '#0891B2' }}>Thêm / Cập Nhật Chỉ Tiêu</h4>
                                <button onClick={() => setAddOpen(false)} style={{ color: '#64748B' }}><X size={14} /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-semibold" style={{ color: '#64748B' }}>Metric</label>
                                    <select value={addForm.metric}
                                        onChange={e => {
                                            const m = metrics.find(x => x.metric === e.target.value)
                                            setAddForm(f => ({ ...f, metric: e.target.value, unit: m?.unit ?? 'VND' }))
                                        }}
                                        className="w-full px-3 py-2 rounded text-xs" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                                        {metrics.map(m => <option key={m.metric} value={m.metric}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold" style={{ color: '#64748B' }}>Tháng (để trống = cả năm)</label>
                                    <select value={addForm.month ?? ''}
                                        onChange={e => setAddForm(f => ({ ...f, month: e.target.value ? Number(e.target.value) : null }))}
                                        className="w-full px-3 py-2 rounded text-xs" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                                        <option value="">Cả năm</option>
                                        {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold" style={{ color: '#64748B' }}>Giá trị chỉ tiêu</label>
                                    <input type="number" value={addForm.targetValue}
                                        onChange={e => setAddForm(f => ({ ...f, targetValue: e.target.value }))}
                                        placeholder="5000000000" className="w-full px-3 py-2 rounded text-xs"
                                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#B45309' }} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold" style={{ color: '#64748B' }}>Sales Rep (tuỳ chọn)</label>
                                    <select value={addForm.salesRepId}
                                        onChange={e => setAddForm(f => ({ ...f, salesRepId: e.target.value }))}
                                        className="w-full px-3 py-2 rounded text-xs" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                                        <option value="">— Toàn công ty —</option>
                                        {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleSave} className="flex items-center gap-1 px-4 py-2 text-xs font-bold rounded"
                                style={{ background: '#0891B2', color: '#FFFFFF' }}>
                                <Save size={12} /> Lưu Chỉ Tiêu
                            </button>
                        </div>
                    )}

                    {/* Targets Table */}
                    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                    {['Metric', 'Kỳ', 'Chỉ Tiêu', 'ĐV', 'Sales Rep', ''].map(h => (
                                        <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                            style={{ color: '#64748B' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {targets.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#64748B' }}>
                                        Chưa có chỉ tiêu — Sử dụng giá trị mặc định. Nhấn "Thêm Chỉ Tiêu" để tuỳ chỉnh.
                                    </td></tr>
                                ) : targets.map(t => {
                                    const metricInfo = metrics.find(m => m.metric === t.metric)
                                    return (
                                        <tr key={t.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#0891B2' }}>
                                                {metricInfo?.label ?? t.metric}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#0F172A' }}>
                                                {t.month ? `T${t.month}/${t.year}` : `Năm ${t.year}`}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#B45309' }}>
                                                {t.targetValue.toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#475569' }}>{t.unit}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#0F172A' }}>
                                                {t.salesRepName ?? '🏢 Toàn công ty'}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <button onClick={() => handleDelete(t.id)} className="p-1 transition-all"
                                                    style={{ color: '#64748B' }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = '#B91C1C')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}>
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
                    <div className="p-4 rounded-md" style={{ background: 'rgba(8,145,178,0.05)', border: '1px dashed rgba(8, 145, 178, 0.25)' }}>
                        <p className="text-xs font-bold mb-2" style={{ color: '#0891B2' }}>Giá trị mặc định (khi chưa cấu hình):</p>
                        <div className="grid grid-cols-2 gap-1">
                            {metrics.map(m => {
                                const def = { REVENUE: '5 tỷ', ORDERS: '50 đơn', NEW_CUSTOMERS: '5 KH', AR_LIMIT: '2 tỷ', STOCK_VALUE: '10 tỷ' }
                                return (
                                    <p key={m.metric} className="text-xs" style={{ color: '#64748B' }}>
                                        • {m.label}: <span style={{ color: '#B45309' }}>{(def as any)[m.metric]}</span>
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
