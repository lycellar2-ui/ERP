'use client'

import { useState, useEffect } from 'react'
import { Calculator, AlertCircle, TrendingUp, TrendingDown, Wine, Ship, Package, Beaker } from 'lucide-react'
import { CostingProduct, runSensitivityAnalysis, getPresetScenarios } from './actions'
import type { SensitivityResult, SensitivityScenario } from './actions'
import { suggestPrices } from './costingUtils'
import { LandedCostTab } from './LandedCostTab'
import {
    PageHeader, StatGrid, StatCard, StatusTabs, SearchInput,
    Table, THead, TBody, Tr, Th, Td, TableMessageRow,
    Button, Field, Input, Badge, EmptyState
} from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { COSTING_I18N } from './i18n'
import { cn } from '@/lib/utils'

const WINE_COLORS: Record<string, string> = {
    RED: '#B91C1C', WHITE: '#B45309', ROSE: '#B45309',
    SPARKLING: '#0E7490', FORTIFIED: '#1D4ED8', DESSERT: '#0891B2',
}

type TabKey = 'sku' | 'campaign' | 'sensitivity'

interface Props { products: CostingProduct[] }

export function CostingClient({ products }: Props) {
    const { locale, formatCurrency, formatNumber } = useAppLocale()
    const i18n = COSTING_I18N[locale]

    const [tab, setTab] = useState<TabKey>('sku')
    const [selected, setSelected] = useState<CostingProduct | null>(null)
    const [search, setSearch] = useState('')

    const filtered = products.filter(p =>
        !search || p.skuCode.toLowerCase().includes(search.toLowerCase()) ||
        p.productName.toLowerCase().includes(search.toLowerCase())
    )

    const lossCount = products.filter(p => p.isLoss).length
    const avgMargin = products.reduce((s, p) => s + (p.marginPct ?? 0), 0) / (products.length || 1)

    const suggestions = selected ? suggestPrices(selected.unitLandedCost) : []

    const tabs = [
        { value: 'sku' as TabKey, label: i18n.tabs.sku },
        { value: 'campaign' as TabKey, label: i18n.tabs.campaign },
        { value: 'sensitivity' as TabKey, label: i18n.tabs.sensitivity },
    ]

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <PageHeader
                description={i18n.description}
            />

            <StatusTabs
                items={tabs}
                value={tab}
                onChange={v => setTab(v)}
            />

            {tab === 'sku' && (
                <>
                    <StatGrid className="grid-cols-1 sm:grid-cols-3 lg:grid-cols-3">
                        <StatCard label={i18n.activeSkus} value={products.length} icon={Package} />
                        <StatCard label={i18n.avgMargin} value={`${avgMargin.toFixed(1)}%`} icon={TrendingUp} tone="success" />
                        <StatCard label={i18n.lossSkus} value={lossCount} icon={AlertCircle} tone={lossCount > 0 ? 'danger' : undefined} />
                    </StatGrid>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
                        {/* Left — SKU list */}
                        <div className="lg:col-span-7 space-y-3">
                            <SearchInput
                                placeholder={i18n.searchPlaceholder}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />

                            {/* Desktop Table */}
                            <div className="hidden md:block">
                                <Table>
                                    <THead>
                                        <Tr>
                                            <Th>{i18n.columns.sku}</Th>
                                            <Th>{i18n.columns.product}</Th>
                                            <Th align="right">{i18n.columns.unitCost}</Th>
                                            <Th align="right">{i18n.columns.listPrice}</Th>
                                            <Th>{i18n.columns.margin}</Th>
                                            <Th align="right">{i18n.columns.stock}</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        {filtered.length === 0 ? (
                                            <TableMessageRow colSpan={6}>
                                                <EmptyState icon={Wine} title={i18n.emptySkus} />
                                            </TableMessageRow>
                                        ) : filtered.map(p => {
                                            const isSelected = selected?.id === p.id
                                            const typeColor = WINE_COLORS[p.wineType] ?? '#475569'
                                            const marginOk = (p.marginPct ?? 0) >= 30
                                            return (
                                                <Tr
                                                    key={p.id}
                                                    onClick={() => setSelected(p)}
                                                    className={cn(
                                                        isSelected && 'bg-lys-teal-soft border-l-2 border-l-lys-teal-strong',
                                                        !isSelected && p.isLoss && 'bg-tone-danger-bg/40 border-l-2 border-l-tone-danger-fg'
                                                    )}
                                                >
                                                    <Td>
                                                        <span
                                                            className="inline-block text-xs px-1.5 py-0.5 rounded font-bold whitespace-nowrap shrink-0"
                                                            style={{ background: `${typeColor}20`, color: typeColor }}
                                                        >
                                                            {p.skuCode}
                                                        </span>
                                                    </Td>
                                                    <Td>
                                                        <p className="text-xs font-semibold truncate max-w-[180px] text-lys-primary">{p.productName}</p>
                                                        {p.abvPercent && (
                                                            <p className="text-[11px] text-lys-muted">
                                                                {p.abvPercent}° — {p.abvPercent >= 20 ? i18n.sctHigh : i18n.sctLow}
                                                            </p>
                                                        )}
                                                    </Td>
                                                    <Td align="right" className="font-mono text-xs font-bold text-tone-warning-fg">
                                                        {p.unitLandedCost > 0 ? formatCurrency(p.unitLandedCost) : '—'}
                                                    </Td>
                                                    <Td align="right" className="font-mono text-xs font-bold text-lys-primary">
                                                        {p.listPrice ? formatCurrency(p.listPrice) : '—'}
                                                    </Td>
                                                    <Td>
                                                        <div className="flex items-center gap-1">
                                                            {p.isLoss ? (
                                                                <TrendingDown size={11} className="text-tone-danger-fg" />
                                                            ) : (
                                                                <TrendingUp size={11} className="text-tone-success-fg" />
                                                            )}
                                                            <span className={cn(
                                                                'font-mono text-xs font-bold',
                                                                p.isLoss ? 'text-tone-danger-fg' : marginOk ? 'text-tone-success-fg' : 'text-tone-warning-fg'
                                                            )}>
                                                                {p.marginPct !== null ? `${p.marginPct.toFixed(1)}%` : '—'}
                                                            </span>
                                                        </div>
                                                    </Td>
                                                    <Td align="right" className="font-mono text-xs text-lys-secondary">
                                                        {formatNumber(p.stockQty)}
                                                    </Td>
                                                </Tr>
                                            )
                                        })}
                                    </TBody>
                                </Table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="block md:hidden space-y-2.5">
                                {filtered.length === 0 ? (
                                    <div className="p-8 bg-white rounded-lg border border-lys-border">
                                        <EmptyState icon={Wine} title={i18n.emptySkus} />
                                    </div>
                                ) : filtered.map(p => {
                                    const isSelected = selected?.id === p.id
                                    const marginOk = (p.marginPct ?? 0) >= 30
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => setSelected(p)}
                                            className={cn(
                                                'p-3.5 rounded-lg bg-white border transition-colors cursor-pointer space-y-2 shadow-2xs',
                                                isSelected ? 'border-lys-teal-strong bg-lys-teal-soft/30' : 'border-lys-border'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <span className="font-mono text-xs font-bold text-lys-teal-strong">{p.skuCode}</span>
                                                    <h4 className="text-xs font-bold text-lys-primary mt-0.5">{p.productName}</h4>
                                                </div>
                                                <Badge tone={p.isLoss ? 'danger' : marginOk ? 'success' : 'warning'}>
                                                    {p.marginPct !== null ? `${p.marginPct.toFixed(1)}%` : '—'}
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-lys-border text-xs">
                                                <div>
                                                    <span className="text-[10px] text-lys-muted block">{i18n.columns.unitCost}</span>
                                                    <span className="font-mono font-bold text-tone-warning-fg">{p.unitLandedCost > 0 ? formatCurrency(p.unitLandedCost) : '—'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-lys-muted block">{i18n.columns.listPrice}</span>
                                                    <span className="font-mono font-bold text-lys-primary">{p.listPrice ? formatCurrency(p.listPrice) : '—'}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] text-lys-muted block">{i18n.columns.stock}</span>
                                                    <span className="font-mono font-bold text-lys-secondary">{formatNumber(p.stockQty)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Right — Price suggestion panel */}
                        <div className="lg:col-span-5">
                            {selected ? (
                                <div className="p-5 rounded-lg bg-white border border-lys-border shadow-2xs">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Calculator size={18} className="text-lys-teal-strong" />
                                        <div>
                                            <h3 className="font-semibold text-sm text-lys-primary">{i18n.priceSuggestionTitle}</h3>
                                            <p className="text-xs text-lys-muted">{selected.skuCode} — {selected.productName}</p>
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-md mb-4 bg-lys-subtle border border-lys-border">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-xs text-lys-muted">{i18n.unitLandedCostWa}</span>
                                            <span className="font-mono text-sm font-bold text-tone-warning-fg">
                                                {formatCurrency(selected.unitLandedCost)}
                                            </span>
                                        </div>
                                        {selected.abvPercent && (
                                            <div className="flex justify-between">
                                                <span className="text-xs text-lys-muted">{i18n.appliedSct}</span>
                                                <span className={cn('text-xs font-bold', selected.abvPercent >= 20 ? 'text-tone-danger-fg' : 'text-tone-warning-fg')}>
                                                    {selected.abvPercent >= 20 ? '65%' : '35%'} ({selected.abvPercent}° ABV)
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {selected.isLoss && (
                                        <div className="flex items-center gap-2 p-3 rounded-md mb-4 bg-tone-danger-bg border border-tone-danger-border">
                                            <AlertCircle size={14} className="text-tone-danger-fg shrink-0" />
                                            <p className="text-xs text-tone-danger-fg">
                                                {i18n.lossWarningPrefix} <strong>{formatCurrency(selected.listPrice!)}</strong> {i18n.lossWarningSuffix}
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-lys-muted">
                                            {i18n.channelSuggestionHeader}
                                        </p>
                                        {suggestions.map(s => (
                                            <div key={s.channel} className="p-3 rounded-md bg-lys-subtle border border-lys-border">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-xs font-semibold text-lys-primary">
                                                        {(i18n.channels as Record<string, string>)[s.channel] ?? s.channel}
                                                    </p>
                                                    <Badge tone="brand">{s.margin}% margin</Badge>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <p className="text-xs text-lys-muted">{i18n.exactPrice}</p>
                                                        <p className="font-mono text-sm font-bold text-lys-secondary">
                                                            {formatCurrency(s.price)}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs text-lys-muted">{i18n.roundedPrice}</p>
                                                        <p className="font-mono text-lg font-bold text-lys-teal-strong">
                                                            {formatCurrency(s.rounded)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 rounded-lg bg-white border border-dashed border-lys-border">
                                    <EmptyState icon={Calculator} title={i18n.selectSkuHint} />
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {tab === 'campaign' && <LandedCostTab />}

            {tab === 'sensitivity' && <SensitivityPanel products={products} />}
        </div>
    )
}

function SensitivityPanel({ products }: { products: CostingProduct[] }) {
    const { locale, formatCurrency } = useAppLocale()
    const i18n = COSTING_I18N[locale]

    const [presets, setPresets] = useState<SensitivityScenario[]>([])
    const [results, setResults] = useState<SensitivityResult[]>([])
    const [loading, setLoading] = useState(false)
    const [custom, setCustom] = useState<SensitivityScenario>({ label: i18n.customScenarioTitle, exchangeRateChange: 0, importTaxChange: 0, sctChange: 0 })

    useEffect(() => {
        getPresetScenarios().then(setPresets)
    }, [])

    const runAnalysis = async (scenario: SensitivityScenario) => {
        setLoading(true)
        const res = await runSensitivityAnalysis([scenario])
        if (res.success && res.results) setResults(res.results)
        setLoading(false)
    }

    return (
        <div className="space-y-5">
            <div>
                <h4 className="text-sm font-semibold mb-3 text-lys-primary">{i18n.presetScenariosTitle}</h4>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {presets.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => runAnalysis(s)}
                            className="p-3 text-left rounded-lg transition-all bg-white border border-lys-border hover:border-lys-teal-strong shadow-2xs cursor-pointer"
                        >
                            <p className="text-xs font-bold mb-1 text-lys-primary">{s.label}</p>
                            <div className="flex gap-3 text-[10px] text-lys-muted font-mono">
                                {s.exchangeRateChange !== 0 && <span>FX: {s.exchangeRateChange > 0 ? '+' : ''}{s.exchangeRateChange}%</span>}
                                {s.importTaxChange !== 0 && <span>NK: {s.importTaxChange > 0 ? '+' : ''}{s.importTaxChange}%</span>}
                                {s.sctChange !== 0 && <span>SCT: {s.sctChange > 0 ? '+' : ''}{s.sctChange}%</span>}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 rounded-lg bg-white border border-lys-border shadow-2xs space-y-3">
                <h4 className="text-sm font-semibold text-tone-warning-fg">{i18n.customScenarioTitle}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label={i18n.fxDeltaLabel}>
                        {id => (
                            <Input
                                id={id}
                                type="number"
                                value={custom.exchangeRateChange}
                                onChange={e => setCustom({ ...custom, exchangeRateChange: Number(e.target.value) })}
                                step={1}
                                placeholder="+5"
                            />
                        )}
                    </Field>
                    <Field label={i18n.importTaxDeltaLabel}>
                        {id => (
                            <Input
                                id={id}
                                type="number"
                                value={custom.importTaxChange}
                                onChange={e => setCustom({ ...custom, importTaxChange: Number(e.target.value) })}
                                step={1}
                                placeholder="-10"
                            />
                        )}
                    </Field>
                    <Field label={i18n.sctDeltaLabel}>
                        {id => (
                            <Input
                                id={id}
                                type="number"
                                value={custom.sctChange}
                                onChange={e => setCustom({ ...custom, sctChange: Number(e.target.value) })}
                                step={1}
                                placeholder="+5"
                            />
                        )}
                    </Field>
                </div>
                <Button onClick={() => runAnalysis(custom)} loading={loading} disabled={loading} className="w-full">
                    <Beaker size={14} aria-hidden />
                    {loading ? i18n.calculating : i18n.runAnalysisBtn}
                </Button>
            </div>

            {results.length > 0 && (
                <Table>
                    <THead>
                        <Tr>
                            <Th>{i18n.sensColumns.sku}</Th>
                            <Th align="right">{i18n.sensColumns.currentCost}</Th>
                            <Th align="right">{i18n.sensColumns.newCost}</Th>
                            <Th align="right">{i18n.sensColumns.costDelta}</Th>
                            <Th align="right">{i18n.sensColumns.currentMargin}</Th>
                            <Th align="right">{i18n.sensColumns.newMargin}</Th>
                            <Th>{i18n.sensColumns.marginDelta}</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {results.map(r => {
                            const sc = r.scenarios[0]
                            if (!sc) return null
                            const costUp = sc.costDeltaPct > 0
                            const marginDown = (sc.marginDelta ?? 0) < 0
                            return (
                                <Tr key={r.skuCode}>
                                    <Td className="font-mono text-xs font-bold text-lys-teal-strong">{r.skuCode}</Td>
                                    <Td align="right" className="font-mono text-xs text-lys-secondary">{formatCurrency(r.currentUnitCost)}</Td>
                                    <Td align="right" className={cn('font-mono text-xs font-bold', costUp ? 'text-tone-danger-fg' : 'text-tone-success-fg')}>
                                        {formatCurrency(sc.newUnitCost)}
                                    </Td>
                                    <Td align="right">
                                        <Badge tone={costUp ? 'danger' : 'success'}>
                                            {sc.costDeltaPct > 0 ? '+' : ''}{sc.costDeltaPct.toFixed(1)}%
                                        </Badge>
                                    </Td>
                                    <Td align="right" className="font-mono text-xs text-lys-secondary">
                                        {r.currentMarginPct !== null ? `${r.currentMarginPct.toFixed(1)}%` : '—'}
                                    </Td>
                                    <Td align="right" className={cn('font-mono text-xs font-bold', marginDown ? 'text-tone-danger-fg' : 'text-tone-success-fg')}>
                                        {sc.newMarginPct !== null ? `${sc.newMarginPct.toFixed(1)}%` : '—'}
                                    </Td>
                                    <Td>
                                        {sc.marginDelta !== null ? (
                                            <div className="flex items-center gap-1">
                                                {marginDown ? <TrendingDown size={11} className="text-tone-danger-fg" /> : <TrendingUp size={11} className="text-tone-success-fg" />}
                                                <span className={cn('font-mono text-xs font-bold', marginDown ? 'text-tone-danger-fg' : 'text-tone-success-fg')}>
                                                    {sc.marginDelta > 0 ? '+' : ''}{sc.marginDelta.toFixed(1)}%
                                                </span>
                                            </div>
                                        ) : <span className="text-xs text-lys-muted">—</span>}
                                    </Td>
                                </Tr>
                            )
                        })}
                    </TBody>
                </Table>
            )}
        </div>
    )
}
