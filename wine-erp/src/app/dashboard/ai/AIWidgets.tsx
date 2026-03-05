'use client'

import { useState } from 'react'
import { Brain, AlertTriangle, TrendingUp, DollarSign, Loader2, Search, ShieldAlert } from 'lucide-react'
import { forecastDemand, suggestPricing, detectAnomalies, AnomalyAlert } from './actions'
import { formatVND } from '@/lib/utils'

export function AnomalyWidget() {
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

    const severity = { high: '#E05252', medium: '#D4A853', low: '#4A6A7A' }
    const typeIcon = { unusual_order: '📦', duplicate_invoice: '📋', negative_stock: '⚠️', expense_spike: '💰' }

    return (
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: '#E8F1F2' }}>
                    <ShieldAlert size={16} style={{ color: '#D4A853' }} /> AI Anomaly Detection
                </h3>
                <button onClick={load} disabled={loading}
                    className="text-xs px-3 py-1.5 rounded font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    {loading ? <Loader2 size={12} className="animate-spin" /> : 'Quét Bất Thường'}
                </button>
            </div>

            {!loaded ? (
                <p className="text-xs text-center py-6" style={{ color: '#4A6A7A' }}>
                    Nhấn "Quét Bất Thường" để chạy AI phát hiện giao dịch bất thường
                </p>
            ) : alerts.length === 0 ? (
                <div className="text-center py-6">
                    <span className="text-3xl">✅</span>
                    <p className="text-sm mt-2 font-semibold" style={{ color: '#5BA88A' }}>Không phát hiện bất thường</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {alerts.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-md"
                            style={{ background: '#142433', border: `1px solid ${severity[a.severity]}30` }}>
                            <span className="text-lg">{typeIcon[a.type]}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold" style={{ color: severity[a.severity] }}>{a.title}</p>
                                <p className="text-xs mt-0.5 truncate" style={{ color: '#8AAEBB' }}>{a.description}</p>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                                style={{ color: severity[a.severity], background: `${severity[a.severity]}18` }}>
                                {a.severity}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export function DemandForecastWidget() {
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

    const trendColor = { growing: '#5BA88A', declining: '#E05252', stable: '#D4A853', no_data: '#4A6A7A' }
    const trendLabel = { growing: '📈 Tăng', declining: '📉 Giảm', stable: '📊 Ổn định', no_data: '⚠ Chưa có data' }

    return (
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: '#E8F1F2' }}>
                <TrendingUp size={16} style={{ color: '#5BA88A' }} /> Dự Báo Nhu Cầu
            </h3>
            <div className="flex gap-2 mb-4">
                <input value={productId} onChange={e => setProductId(e.target.value)}
                    placeholder="Nhập Product ID..."
                    className="flex-1 px-3 py-2 text-xs rounded outline-none"
                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                <button onClick={run} disabled={loading || !productId}
                    className="text-xs px-4 py-2 rounded font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    {loading ? <Loader2 size={12} className="animate-spin" /> : 'Phân tích'}
                </button>
            </div>

            {result && (
                <div className="space-y-3">
                    <div className="flex gap-3">
                        <div className="flex-1 p-3 rounded-md" style={{ background: '#142433' }}>
                            <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Xu hướng</p>
                            <p className="text-sm font-bold" style={{ color: trendColor[result.trend as keyof typeof trendColor] }}>
                                {trendLabel[result.trend as keyof typeof trendLabel]}
                            </p>
                        </div>
                        <div className="flex-1 p-3 rounded-md" style={{ background: '#142433' }}>
                            <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>TB/tháng</p>
                            <p className="text-sm font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>
                                {result.avgMonthlyDemand} chai
                            </p>
                        </div>
                    </div>
                    {result.forecast.map((f: any) => (
                        <div key={f.month} className="flex items-center justify-between p-2 rounded"
                            style={{ background: '#142433' }}>
                            <span className="text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{f.month}</span>
                            <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                {f.predicted} chai
                            </span>
                            <span className="text-[10px]" style={{ color: '#4A6A7A' }}>
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
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: '#E8F1F2' }}>
                <DollarSign size={16} style={{ color: '#D4A853' }} /> Gợi Ý Giá Bán
            </h3>
            <div className="flex gap-2 mb-4">
                <input value={productId} onChange={e => setProductId(e.target.value)}
                    placeholder="Nhập Product ID..."
                    className="flex-1 px-3 py-2 text-xs rounded outline-none"
                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                <button onClick={run} disabled={loading || !productId}
                    className="text-xs px-4 py-2 rounded font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    {loading ? <Loader2 size={12} className="animate-spin" /> : 'Phân tích'}
                </button>
            </div>

            {result && (
                <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Giá vốn', value: formatVND(result.unitLandedCost), color: '#E05252' },
                            { label: 'Giá thị trường', value: formatVND(result.latestMarketPrice), color: '#D4A853' },
                            { label: 'Tồn kho', value: `${result.currentStock}`, color: '#87CBB9' },
                        ].map(s => (
                            <div key={s.label} className="p-2 rounded-md text-center" style={{ background: '#142433' }}>
                                <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>{s.label}</p>
                                <p className="text-xs font-bold" style={{ color: s.color, fontFamily: '"DM Mono"' }}>{s.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-1.5">
                        {result.priceTiers.map((t: any) => (
                            <div key={t.label} className="flex items-center justify-between p-2 rounded"
                                style={{
                                    background: result.recommendedTier === t.label ? 'rgba(135,203,185,0.1)' : '#142433',
                                    border: result.recommendedTier === t.label ? '1px solid rgba(135,203,185,0.3)' : '1px solid transparent',
                                }}>
                                <span className="text-xs" style={{ color: '#8AAEBB' }}>{t.label}</span>
                                <span className="text-xs font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>
                                    {formatVND(t.price)}
                                </span>
                                {result.recommendedTier === t.label && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                        style={{ color: '#5BA88A', background: 'rgba(91,168,138,0.15)' }}>
                                        ✓ Đề xuất
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-3 rounded-md text-xs" style={{ background: '#142433', color: '#8AAEBB' }}>
                        {result.reasoning}
                    </div>
                </div>
            )}
        </div>
    )
}
