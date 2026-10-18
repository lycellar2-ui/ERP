'use client'

import { useState } from 'react'
import { Brain, AlertTriangle, TrendingUp, DollarSign, Loader2, Search, ShieldAlert, CheckCircle2, Package, FileText, TrendingDown, Minus } from 'lucide-react'
import { forecastDemand, suggestPricing, detectAnomalies, AnomalyAlert } from './actions'
import { useAppLocale } from '@/lib/i18n'
import { getAiI18n } from './i18n'

export function AnomalyWidget() {
    const { locale } = useAppLocale()
    const t = getAiI18n(locale).widgets
    const [alerts, setAlerts] = useState<AnomalyAlert[]>([])
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)

    const load = async () => {
        setLoading(true)
        const data = await detectAnomalies()
        setAlerts(data)
        setLoaded(true)
        setLoading(false)
    }

    const severity = { high: '#B91C1C', medium: '#B45309', low: '#64748B' }
    const typeIcon: Record<string, any> = {
        unusual_order: Package,
        duplicate_invoice: FileText,
        negative_stock: AlertTriangle,
        expense_spike: DollarSign,
    }

    return (
        <div className="p-5 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: '#0F172A' }}>
                    <ShieldAlert size={16} style={{ color: '#B45309' }} /> {t.anomalyTitle}
                </h3>
                <button onClick={load} disabled={loading}
                    className="text-xs px-3 py-1.5 rounded font-semibold"
                    style={{ background: '#0E7490', color: '#FFFFFF' }}>
                    {loading ? <Loader2 size={12} className="animate-spin" /> : t.scanBtn}
                </button>
            </div>

            {!loaded ? (
                <p className="text-xs text-center py-6" style={{ color: '#64748B' }}>
                    {t.scanHint}
                </p>
            ) : alerts.length === 0 ? (
                <div className="text-center py-6">
                    <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: '#15803D' }} />
                    <p className="text-sm font-semibold" style={{ color: '#15803D' }}>{t.noAnomalies}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {alerts.map((a, i) => {
                        const IconComp = typeIcon[a.type] || AlertTriangle
                        return (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-md"
                                style={{ background: '#FFFFFF', border: `1px solid ${severity[a.severity]}30` }}>
                                <div className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                                    style={{ background: `${severity[a.severity]}15`, color: severity[a.severity] }}>
                                    <IconComp size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold" style={{ color: severity[a.severity] }}>{a.title}</p>
                                    <p className="text-xs mt-0.5 truncate" style={{ color: '#475569' }}>{a.description}</p>
                                </div>
                                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap shrink-0"
                                    style={{ color: severity[a.severity], background: `${severity[a.severity]}18` }}>
                                    {a.severity}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export function DemandForecastWidget() {
    const { locale } = useAppLocale()
    const t = getAiI18n(locale).widgets
    const [productId, setProductId] = useState('')
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const run = async () => {
        if (!productId) return
        setLoading(true)
        const data = await forecastDemand(productId)
        setResult(data)
        setLoading(false)
    }

    const trendColor = { growing: '#15803D', declining: '#B91C1C', stable: '#B45309', no_data: '#64748B' }
    const trendIcon = { growing: TrendingUp, declining: TrendingDown, stable: Minus, no_data: AlertTriangle }

    return (
        <div className="p-5 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: '#0F172A' }}>
                <TrendingUp size={16} style={{ color: '#15803D' }} /> {t.demandTitle}
            </h3>
            <div className="flex gap-2 mb-4">
                <input value={productId} onChange={e => setProductId(e.target.value)}
                    placeholder={t.productIdPlaceholder}
                    className="flex-1 px-3 py-2 text-xs rounded outline-none"
                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }} />
                <button onClick={run} disabled={loading || !productId}
                    className="text-xs px-4 py-2 rounded font-semibold"
                    style={{ background: '#0E7490', color: '#FFFFFF' }}>
                    {loading ? <Loader2 size={12} className="animate-spin" /> : t.analyzeBtn}
                </button>
            </div>

            {result && (
                <div className="space-y-3">
                    <div className="flex gap-3">
                        <div className="flex-1 p-3 rounded-md" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>{t.trendLabel}</p>
                            {(() => {
                                const TrendIcon = trendIcon[result.trend as keyof typeof trendIcon] || Minus
                                return (
                                    <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: trendColor[result.trend as keyof typeof trendColor] }}>
                                        <TrendIcon size={14} />
                                        {t.trends[result.trend as keyof typeof t.trends]}
                                    </p>
                                )
                            })()}
                        </div>
                        <div className="flex-1 p-3 rounded-md" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>{t.avgMonthLabel}</p>
                            <p className="text-sm font-bold" style={{ color: '#0F172A' }}>
                                {result.avgMonthlyDemand} {t.bottlesSuffix}
                            </p>
                        </div>
                    </div>
                    {result.forecast.map((f: any) => (
                        <div key={f.month} className="flex items-center justify-between p-2 rounded"
                            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <span className="text-xs" style={{ color: '#475569' }}>{f.month}</span>
                            <span className="text-xs font-bold" style={{ color: '#0891B2' }}>
                                {f.predicted} {t.bottlesSuffix}
                            </span>
                            <span className="text-[10px]" style={{ color: '#64748B' }}>
                                ±{Math.round((1 - f.confidence) * 100)}%
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export function PricingWidget() {
    const { locale, formatCurrency } = useAppLocale()
    const t = getAiI18n(locale).widgets
    const [productId, setProductId] = useState('')
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const run = async () => {
        if (!productId) return
        setLoading(true)
        const data = await suggestPricing(productId)
        setResult(data)
        setLoading(false)
    }

    return (
        <div className="p-5 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: '#0F172A' }}>
                <DollarSign size={16} style={{ color: '#B45309' }} /> {t.pricingTitle}
            </h3>
            <div className="flex gap-2 mb-4">
                <input value={productId} onChange={e => setProductId(e.target.value)}
                    placeholder={t.productIdPlaceholder}
                    className="flex-1 px-3 py-2 text-xs rounded outline-none"
                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }} />
                <button onClick={run} disabled={loading || !productId}
                    className="text-xs px-4 py-2 rounded font-semibold"
                    style={{ background: '#0E7490', color: '#FFFFFF' }}>
                    {loading ? <Loader2 size={12} className="animate-spin" /> : t.analyzeBtn}
                </button>
            </div>

            {result && (
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                            { label: t.unitCostLabel, value: formatCurrency(result.unitLandedCost), color: '#B91C1C' },
                            { label: t.marketPriceLabel, value: formatCurrency(result.latestMarketPrice), color: '#B45309' },
                            { label: t.stockLabel, value: `${result.currentStock}`, color: '#0891B2' },
                        ].map(s => (
                            <div key={s.label} className="p-2 rounded-md text-center" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>{s.label}</p>
                                <p className="text-xs font-bold" style={{ color: s.color }}>{s.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-1.5">
                        {result.priceTiers.map((tier: any) => (
                            <div key={tier.label} className="flex items-center justify-between p-2 rounded"
                                style={{
                                    background: result.recommendedTier === tier.label ? 'rgba(8,145,178,0.1)' : '#FFFFFF',
                                    border: result.recommendedTier === tier.label ? '1px solid rgba(8, 145, 178, 0.25)' : '1px solid transparent',
                                }}>
                                <span className="text-xs" style={{ color: '#475569' }}>{tier.label}</span>
                                <span className="text-xs font-bold" style={{ color: '#0F172A' }}>
                                    {formatCurrency(tier.price)}
                                </span>
                                {result.recommendedTier === tier.label && (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0"
                                        style={{ color: '#15803D', background: 'rgba(21,128,61,0.15)' }}>
                                        <CheckCircle2 size={10} /> {t.recommendedBadge}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-3 rounded-md text-xs" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}>
                        {result.reasoning}
                    </div>
                </div>
            )}
        </div>
    )
}
