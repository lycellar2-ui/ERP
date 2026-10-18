'use client'

import { useState, useEffect } from 'react'
import {
    Target, TrendingDown, AlertCircle, CheckCircle2,
    Settings, Plus, Trash2, Save, Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import {
    PageHeader, StatGrid, StatCard, Button, Badge, StatusTabs, Toolbar,
    Table, THead, TBody, Tr, Th, Td, TableMessageRow,
    Drawer, Field, Input, Select, EmptyState, useConfirmDialog,
} from '@/components/ui'
import type { KpiSummary, KpiTargetRow } from './actions'
import {
    getKpiSummary, getKpiTargets, upsertKpiTarget, deleteKpiTarget,
    getSalesRepOptions, getAvailableMetrics, copyKpiFromPreviousYear,
} from './actions'
import { useAppLocale } from '@/lib/i18n'
import { KPI_I18N } from './i18n'

const STATUS_TONE_MAP = {
    ON_TRACK: 'success',
    AT_RISK: 'warning',
    BEHIND: 'danger',
    EXCEEDED: 'brand',
} as const

interface Props {
    summaries: KpiSummary[]
    year: number
    month: number
}

export function KpiClient({ summaries: initialSummaries, year, month }: Props) {
    const { locale, formatCurrency, formatNumber } = useAppLocale()
    const L = KPI_I18N[locale]

    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [summaries, setSummaries] = useState(initialSummaries)
    const [tab, setTab] = useState<'dashboard' | 'setup'>('dashboard')
    const [targets, setTargets] = useState<KpiTargetRow[]>([])
    const [salesReps, setSalesReps] = useState<{ id: string; name: string; email: string }[]>([])
    const [addOpen, setAddOpen] = useState(false)
    const [addForm, setAddForm] = useState({ metric: 'REVENUE', year, month: month as number | null, targetValue: '', unit: 'VND', salesRepId: '' })

    const [metrics, setMetrics] = useState<{ metric: string; label: string; unit: string }[]>([])
    const [copying, setCopying] = useState(false)
    const [growthPct, setGrowthPct] = useState(10)

    useEffect(() => { getAvailableMetrics().then(setMetrics) }, [])

    const formatMetricValue = (val: number, unit: string) => {
        if (unit === 'VND') return formatCurrency(val)
        return `${formatNumber(val)} ${unit}`
    }

    const loadSetup = async () => {
        const [t, reps] = await Promise.all([getKpiTargets(year), getSalesRepOptions()])
        setTargets(t)
        setSalesReps(reps)
    }

    useEffect(() => { if (tab === 'setup') loadSetup() }, [tab])

    const handleSave = async () => {
        if (!addForm.targetValue) return toast.error(L.toast.missingTarget)
        const res = await upsertKpiTarget({
            metric: addForm.metric,
            year: addForm.year,
            month: addForm.month,
            targetValue: Number(addForm.targetValue),
            unit: addForm.unit,
            salesRepId: addForm.salesRepId || null,
        })
        if (res.success) {
            toast.success(L.toast.saveSuccess)
            setAddOpen(false)
            setAddForm({ metric: 'REVENUE', year, month, targetValue: '', unit: 'VND', salesRepId: '' })
            loadSetup()
            const newSummaries = await getKpiSummary()
            setSummaries(newSummaries)
        } else {
            toast.error(res.error || L.toast.saveError)
        }
    }

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: L.confirmDelete.title,
            message: L.confirmDelete.message,
            confirmLabel: L.confirmDelete.confirmLabel,
            variant: 'danger',
        })
        if (!ok) return
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
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description={L.header.description(month, year)}
                actions={
                    tab === 'setup' ? (
                        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
                            <Plus size={14} aria-hidden /> {L.setup.addBtn}
                        </Button>
                    ) : undefined
                }
            />

            <Toolbar
                left={
                    <StatusTabs
                        items={[
                            { value: 'dashboard', label: L.tabs.dashboard },
                            { value: 'setup', label: L.tabs.setup },
                        ]}
                        value={tab}
                        onChange={v => setTab(v as 'dashboard' | 'setup')}
                    />
                }
            />

            {tab === 'dashboard' && (
                <>
                    <StatGrid className="grid-cols-1 sm:grid-cols-3">
                        <StatCard
                            label={L.stats.onTrack}
                            value={`${onTrack}/${summaries.length}`}
                            icon={CheckCircle2}
                            tone="success"
                        />
                        <StatCard
                            label={L.stats.atRisk}
                            value={summaries.filter(s => s.status === 'AT_RISK').length}
                            icon={AlertCircle}
                            tone="warning"
                        />
                        <StatCard
                            label={L.stats.behind}
                            value={behind}
                            icon={TrendingDown}
                            tone={behind > 0 ? 'danger' : 'success'}
                        />
                    </StatGrid>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {summaries.map(kpi => {
                            const tone = STATUS_TONE_MAP[kpi.status]
                            const statusLabel = L.status[kpi.status]
                            const barPct = Math.min(Math.min(kpi.progressPct, 120), 100)
                            const barClass = kpi.progressPct >= 100 ? 'bg-tone-success-fg' : kpi.progressPct < 70 ? 'bg-tone-danger-fg' : 'bg-lys-teal-strong'

                            return (
                                <div
                                    key={kpi.metric}
                                    className={`p-5 rounded-lg bg-white border shadow-xs ${
                                        kpi.progressPct < 70 ? 'border-tone-danger-border' : 'border-lys-border'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <p className="type-caption uppercase tracking-wide font-semibold text-lys-muted">{kpi.label}</p>
                                        <Badge tone={tone}>{statusLabel}</Badge>
                                    </div>
                                    <div className="mb-4">
                                        <div className="flex justify-between text-xs mb-1.5">
                                            <span className="type-number font-bold text-lys-primary">
                                                {formatMetricValue(kpi.actual, kpi.unit)}
                                            </span>
                                            <span className="type-number text-lys-muted">
                                                {L.cards.targetPrefix} {formatMetricValue(kpi.target, kpi.unit)}
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full overflow-hidden bg-lys-border">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                                                style={{ width: `${barPct}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between mt-1.5">
                                            <span className="type-number text-xs text-lys-muted">
                                                {L.cards.shortfallPrefix}{' '}
                                                {kpi.actual < kpi.target ? formatMetricValue(kpi.target - kpi.actual, kpi.unit) : '—'}
                                            </span>
                                            <span className="type-number text-xs font-bold text-lys-primary">
                                                {kpi.progressPct.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-lys-muted">
                                        {kpi.unit === 'VND' && kpi.actual > 0 ? (
                                            <>
                                                {L.cards.forecastPrefix}{' '}
                                                <span className="type-number font-semibold text-tone-warning-fg">
                                                    {formatMetricValue(kpi.actual * (30 / Math.max(new Date().getDate(), 1)), 'VND')}
                                                </span>
                                                {kpi.forecast ? ` (AI: ${formatMetricValue(kpi.forecast, 'VND')})` : ''}
                                            </>
                                        ) : L.cards.realtimeNote}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}

            {tab === 'setup' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-3 p-4 rounded-lg bg-white border border-lys-border">
                        <h3 className="type-section-title text-lys-primary">
                            {L.setup.title(year)}
                        </h3>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                className="w-20 text-center"
                                value={growthPct}
                                onChange={e => setGrowthPct(Number(e.target.value))}
                            />
                            <span className="text-xs text-lys-muted">%</span>
                            <Button
                                variant="secondary"
                                size="sm"
                                loading={copying}
                                onClick={async () => {
                                    setCopying(true)
                                    const res = await copyKpiFromPreviousYear({
                                        fromYear: year - 1,
                                        toYear: year,
                                        growthMultiplier: 1 + growthPct / 100,
                                    })
                                    if (res.success) {
                                        toast.success(L.setup.copiedMsg(res.copied ?? 0, year - 1, growthPct))
                                        loadSetup()
                                    } else {
                                        toast.error(res.error || L.setup.copyError)
                                    }
                                    setCopying(false)
                                }}
                            >
                                <Copy size={13} aria-hidden /> {L.setup.copyBtn(year - 1)}
                            </Button>
                        </div>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block">
                        <Table>
                            <THead>
                                <tr>
                                    <Th>{L.setup.table.metric}</Th>
                                    <Th>{L.setup.table.period}</Th>
                                    <Th align="right">{L.setup.table.target}</Th>
                                    <Th>{L.setup.table.unit}</Th>
                                    <Th>{L.setup.table.salesRep}</Th>
                                    <Th aria-label="Action" />
                                </tr>
                            </THead>
                            <TBody>
                                {targets.length === 0 ? (
                                    <TableMessageRow colSpan={6}>
                                        <EmptyState
                                            icon={Settings}
                                            title={L.setup.table.emptyTitle}
                                            description={L.setup.table.emptyDesc}
                                        />
                                    </TableMessageRow>
                                ) : targets.map(t => {
                                    const metricInfo = metrics.find(m => m.metric === t.metric)
                                    return (
                                        <Tr key={t.id}>
                                            <Td className="font-semibold text-lys-teal-strong">
                                                {metricInfo?.label ?? t.metric}
                                            </Td>
                                            <Td className="type-number text-lys-primary">
                                                {t.month ? L.setup.table.monthPrefix(t.month, t.year) : L.setup.table.yearPrefix(t.year)}
                                            </Td>
                                            <Td align="right" className="type-number font-semibold text-tone-warning-fg">
                                                {formatNumber(t.targetValue)}
                                            </Td>
                                            <Td className="text-lys-secondary">{t.unit}</Td>
                                            <Td className="text-lys-primary">
                                                {t.salesRepName ?? L.setup.table.companyScope}
                                            </Td>
                                            <Td align="right">
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>
                                                    <Trash2 size={13} className="text-tone-danger-fg" />
                                                </Button>
                                            </Td>
                                        </Tr>
                                    )
                                })}
                            </TBody>
                        </Table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="block md:hidden space-y-2.5">
                        {targets.length === 0 ? (
                            <div className="rounded-lg border border-lys-border bg-white p-6">
                                <EmptyState
                                    icon={Settings}
                                    title={L.setup.table.emptyTitle}
                                    description={L.setup.table.emptyDesc}
                                />
                            </div>
                        ) : targets.map(t => {
                            const metricInfo = metrics.find(m => m.metric === t.metric)
                            return (
                                <div key={t.id} className="rounded-lg border border-lys-border bg-white p-3.5 flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-lys-teal-strong">{metricInfo?.label ?? t.metric}</p>
                                        <p className="text-xs text-lys-muted">
                                            {t.month ? L.setup.table.monthPrefix(t.month, t.year) : L.setup.table.yearPrefix(t.year)} • {t.salesRepName ?? L.setup.table.companyScope}
                                        </p>
                                        <p className="type-number text-sm font-bold text-tone-warning-fg mt-1">
                                            {formatNumber(t.targetValue)} {t.unit}
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>
                                        <Trash2 size={14} className="text-tone-danger-fg" />
                                    </Button>
                                </div>
                            )
                        })}
                    </div>

                    <div className="p-4 rounded-lg bg-lys-teal-soft border border-dashed border-lys-border">
                        <p className="text-xs font-semibold text-lys-teal-strong mb-2">{L.setup.defaultsTitle}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {metrics.map(m => {
                                const def: Record<string, string> = { REVENUE: '5,000,000,000 VND', ORDERS: '50', NEW_CUSTOMERS: '5', AR_LIMIT: '2,000,000,000 VND', STOCK_VALUE: '10,000,000,000 VND' }
                                return (
                                    <p key={m.metric} className="text-xs text-lys-secondary">
                                        • {m.label}: <span className="type-number font-semibold text-tone-warning-fg">{def[m.metric]}</span>
                                    </p>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            <Drawer
                open={addOpen}
                onClose={() => setAddOpen(false)}
                title={L.setup.formTitle}
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setAddOpen(false)}>{L.setup.cancelBtn}</Button>
                        <Button variant="primary" onClick={handleSave}>
                            <Save size={14} aria-hidden /> {L.setup.saveBtn}
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Field label={L.setup.metricLabel}>
                        {id => (
                            <Select
                                id={id}
                                value={addForm.metric}
                                onChange={e => {
                                    const m = metrics.find(x => x.metric === e.target.value)
                                    setAddForm(f => ({ ...f, metric: e.target.value, unit: m?.unit ?? 'VND' }))
                                }}
                            >
                                {metrics.map(m => <option key={m.metric} value={m.metric}>{m.label}</option>)}
                            </Select>
                        )}
                    </Field>
                    <Field label={L.setup.monthLabel}>
                        {id => (
                            <Select
                                id={id}
                                value={addForm.month ?? ''}
                                onChange={e => setAddForm(f => ({ ...f, month: e.target.value ? Number(e.target.value) : null }))}
                            >
                                <option value="">{L.setup.fullYear}</option>
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>{L.setup.monthOption(i + 1)}</option>
                                ))}
                            </Select>
                        )}
                    </Field>
                    <Field label={L.setup.targetValueLabel} required>
                        {id => (
                            <Input
                                id={id}
                                type="number"
                                value={addForm.targetValue}
                                onChange={e => setAddForm(f => ({ ...f, targetValue: e.target.value }))}
                                placeholder="5000000000"
                            />
                        )}
                    </Field>
                    <Field label={L.setup.salesRepLabel}>
                        {id => (
                            <Select
                                id={id}
                                value={addForm.salesRepId}
                                onChange={e => setAddForm(f => ({ ...f, salesRepId: e.target.value }))}
                            >
                                <option value="">{L.setup.companyWide}</option>
                                {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </Select>
                        )}
                    </Field>
                </div>
            </Drawer>

            {confirmDialog}
        </div>
    )
}
