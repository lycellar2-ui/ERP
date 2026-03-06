'use client'

import { useState, useEffect } from 'react'
import { Calculator, AlertCircle, TrendingUp, TrendingDown, Wine, Ship, Package, Beaker } from 'lucide-react'
import { CostingProduct, runSensitivityAnalysis, getPresetScenarios } from './actions'
import type { SensitivityResult, SensitivityScenario } from './actions'
import { suggestPrices } from './costingUtils'
import { formatVND } from '@/lib/utils'
import { LandedCostTab } from './LandedCostTab'

const WINE_COLORS: Record<string, string> = {
    RED: '#8B1A2E', WHITE: '#D4A853', ROSE: '#C45A2A',
    SPARKLING: '#87CBB9', FORTIFIED: '#4A8FAB', DESSERT: '#A5DED0',
}

const SCT_NOTE: Record<string, string> = {
    low: 'TTĐB 35%',
    high: 'TTĐB 65%',
}

const CHANNEL_LABEL: Record<string, string> = {
    HORECA: 'HORECA', WHOLESALE_DISTRIBUTOR: 'Đại Lý',
    VIP_RETAIL: 'VIP Retail', POS: 'POS Showroom',
}

const TABS = [
    { key: 'sku', label: 'Giá Vốn SKU', icon: Package },
    { key: 'campaign', label: 'Landed Cost Campaign', icon: Ship },
    { key: 'sensitivity', label: 'Phân Tích Nhạy Cảm', icon: Beaker },
] as const

type TabKey = typeof TABS[number]['key']

interface Props { products: CostingProduct[] }

export function CostingClient({ products }: Props) {
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

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div>
                <h2 className="text-2xl font-bold"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                    Tính Giá Vốn & Đề Xuất Giá (CST)
                </h2>
                <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                    Landed cost / chai • Margin analysis • Đề xuất giá theo kênh
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                {TABS.map(t => {
                    const isActive = tab === t.key
                    const Icon = t.icon
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md transition-all flex-1 justify-center"
                            style={{
                                background: isActive ? '#1B2E3D' : 'transparent',
                                color: isActive ? '#87CBB9' : '#4A6A7A',
                                border: isActive ? '1px solid #2A4355' : '1px solid transparent',
                            }}>
                            <Icon size={14} />
                            {t.label}
                        </button>
                    )
                })}
            </div>

            {/* Tab Content */}
            {tab === 'sku' && (
                <>
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: '3px solid #87CBB9' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>SKU Đang Bán</p>
                            <p className="text-2xl font-bold" style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>{products.length}</p>
                        </div>
                        <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: '3px solid #5BA88A' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Margin TB</p>
                            <p className="text-2xl font-bold" style={{ fontFamily: '"DM Mono"', color: '#5BA88A' }}>{avgMargin.toFixed(1)}%</p>
                        </div>
                        <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: `3px solid ${lossCount > 0 ? '#8B1A2E' : '#5BA88A'}` }}>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>SKU Bán Dưới Giá Vốn</p>
                            <p className="text-2xl font-bold" style={{ fontFamily: '"DM Mono"', color: lossCount > 0 ? '#8B1A2E' : '#5BA88A' }}>
                                {lossCount}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-5">
                        {/* Left — SKU list */}
                        <div className="col-span-12 lg:col-span-7 space-y-3">
                            <input type="text" placeholder="Tìm SKU hoặc tên sản phẩm..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
                            />

                            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                            {['SKU', 'Sản Phẩm', 'Giá Vốn/Chai', 'Giá Bán', 'Margin', 'Tồn'].map(h => (
                                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: '#4A6A7A' }}>
                                                <Wine size={28} className="mx-auto mb-2" style={{ color: '#2A4355' }} />
                                                Chưa có SKU có dữ liệu tồn kho
                                            </td></tr>
                                        ) : filtered.map(p => {
                                            const isSelected = selected?.id === p.id
                                            const typeColor = WINE_COLORS[p.wineType] ?? '#8AAEBB'
                                            const marginOk = (p.marginPct ?? 0) >= 30
                                            return (
                                                <tr key={p.id}
                                                    onClick={() => setSelected(p)}
                                                    style={{
                                                        borderBottom: '1px solid rgba(42,67,85,0.5)',
                                                        background: isSelected ? 'rgba(135,203,185,0.08)' : p.isLoss ? 'rgba(139,26,46,0.05)' : 'transparent',
                                                        cursor: 'pointer',
                                                        borderLeft: isSelected ? '2px solid #87CBB9' : p.isLoss ? '2px solid #8B1A2E' : 'none',
                                                    }}
                                                    onMouseEnter={e => !isSelected && (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                                    onMouseLeave={e => !isSelected && (e.currentTarget.style.background = p.isLoss ? 'rgba(139,26,46,0.05)' : 'transparent')}
                                                >
                                                    <td className="px-3 py-2.5">
                                                        <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                                                            style={{ background: `${typeColor}25`, color: typeColor }}>
                                                            {p.skuCode}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <p className="text-xs font-medium truncate max-w-[170px]" style={{ color: '#E8F1F2' }}>{p.productName}</p>
                                                        {p.abvPercent && (
                                                            <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                                                {p.abvPercent}° — {p.abvPercent >= 20 ? SCT_NOTE.high : SCT_NOTE.low}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                                        {p.unitLandedCost > 0 ? formatVND(p.unitLandedCost) : '—'}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>
                                                        {p.listPrice ? formatVND(p.listPrice) : '—'}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-1">
                                                            {p.isLoss ? <TrendingDown size={10} style={{ color: '#8B1A2E' }} /> :
                                                                <TrendingUp size={10} style={{ color: '#5BA88A' }} />}
                                                            <span className="text-xs font-bold"
                                                                style={{ color: p.isLoss ? '#8B1A2E' : marginOk ? '#5BA88A' : '#D4A853' }}>
                                                                {p.marginPct !== null ? `${p.marginPct.toFixed(1)}%` : '—'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs" style={{ fontFamily: '"DM Mono"', color: '#8AAEBB' }}>
                                                        {p.stockQty.toLocaleString()}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right — Price suggestion panel */}
                        <div className="col-span-12 lg:col-span-5">
                            {selected ? (
                                <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Calculator size={18} style={{ color: '#87CBB9' }} />
                                        <div>
                                            <h3 className="font-semibold text-sm" style={{ color: '#E8F1F2' }}>Đề Xuất Giá Bán</h3>
                                            <p className="text-xs" style={{ color: '#4A6A7A' }}>{selected.skuCode} — {selected.productName}</p>
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-md mb-4" style={{ background: '#142433' }}>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-xs" style={{ color: '#4A6A7A' }}>Giá Vốn / Chai (WA)</span>
                                            <span className="text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                                {formatVND(selected.unitLandedCost)}
                                            </span>
                                        </div>
                                        {selected.abvPercent && (
                                            <div className="flex justify-between">
                                                <span className="text-xs" style={{ color: '#4A6A7A' }}>Thuế TTĐB áp dụng</span>
                                                <span className="text-xs font-bold" style={{ color: selected.abvPercent >= 20 ? '#8B1A2E' : '#D4A853' }}>
                                                    {selected.abvPercent >= 20 ? '65%' : '35%'} ({selected.abvPercent}° ABV)
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {selected.isLoss && (
                                        <div className="flex items-center gap-2 p-3 rounded-md mb-4"
                                            style={{ background: 'rgba(139,26,46,0.1)', border: '1px solid rgba(139,26,46,0.3)' }}>
                                            <AlertCircle size={14} style={{ color: '#8B1A2E' }} />
                                            <p className="text-xs" style={{ color: '#8B1A2E' }}>
                                                ⚠️ Giá bán hiện tại <strong>{formatVND(selected.listPrice!)}</strong> thấp hơn giá vốn!
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>
                                            Đề Xuất Theo Kênh (Target Margin)
                                        </p>
                                        {suggestions.map(s => (
                                            <div key={s.channel} className="p-3 rounded-md" style={{ background: '#142433' }}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-xs font-semibold" style={{ color: '#E8F1F2' }}>{CHANNEL_LABEL[s.channel]}</p>
                                                    <span className="text-xs px-1.5 py-0.5 rounded-full"
                                                        style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>
                                                        {s.margin}% margin
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Chính xác</p>
                                                        <p className="text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#8AAEBB' }}>
                                                            {formatVND(s.price)}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Làm tròn (±50k)</p>
                                                        <p className="text-lg font-bold" style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>
                                                            {formatVND(s.rounded)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 rounded-md text-center" style={{ background: '#1B2E3D', border: '1px dashed #2A4355' }}>
                                    <Calculator size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                                    <p className="text-sm" style={{ color: '#4A6A7A' }}>Chọn một SKU để xem đề xuất giá bán</p>
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

// ── Sensitivity Analysis Panel ──────────────────────
function SensitivityPanel({ products }: { products: CostingProduct[] }) {
    const [presets, setPresets] = useState<SensitivityScenario[]>([])
    const [results, setResults] = useState<SensitivityResult[]>([])
    const [loading, setLoading] = useState(false)
    const [custom, setCustom] = useState<SensitivityScenario>({ label: 'Tùy Chỉnh', exchangeRateChange: 0, importTaxChange: 0, sctChange: 0 })

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
            {/* Preset Scenarios Grid */}
            <div>
                <h4 className="text-sm font-semibold mb-3" style={{ color: '#E8F1F2' }}>⚡ Kịch Bản Có Sẵn</h4>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {presets.map((s, i) => (
                        <button key={i} onClick={() => runAnalysis(s)}
                            className="p-3 text-left rounded-md transition-all"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                            <p className="text-xs font-bold mb-1" style={{ color: '#E8F1F2' }}>{s.label}</p>
                            <div className="flex gap-3 text-[10px]" style={{ color: '#4A6A7A' }}>
                                {s.exchangeRateChange !== 0 && <span>FX: {s.exchangeRateChange > 0 ? '+' : ''}{s.exchangeRateChange}%</span>}
                                {s.importTaxChange !== 0 && <span>NK: {s.importTaxChange > 0 ? '+' : ''}{s.importTaxChange}%</span>}
                                {s.sctChange !== 0 && <span>SCT: {s.sctChange > 0 ? '+' : ''}{s.sctChange}%</span>}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Input */}
            <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <h4 className="text-sm font-semibold mb-3" style={{ color: '#D4A853' }}>🔧 Kịch Bản Tùy Chỉnh</h4>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>Tỷ giá Δ (%)</label>
                        <input type="number" value={custom.exchangeRateChange}
                            onChange={e => setCustom({ ...custom, exchangeRateChange: Number(e.target.value) })}
                            className="w-full px-3 py-2 text-sm outline-none"
                            style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}
                            step={1} placeholder="VD: +5" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>Thuế NK Δ (%)</label>
                        <input type="number" value={custom.importTaxChange}
                            onChange={e => setCustom({ ...custom, importTaxChange: Number(e.target.value) })}
                            className="w-full px-3 py-2 text-sm outline-none"
                            style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}
                            step={1} placeholder="VD: -10" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: '#4A6A7A' }}>TTĐB Δ (%)</label>
                        <input type="number" value={custom.sctChange}
                            onChange={e => setCustom({ ...custom, sctChange: Number(e.target.value) })}
                            className="w-full px-3 py-2 text-sm outline-none"
                            style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}
                            step={1} placeholder="VD: +5" />
                    </div>
                </div>
                <button onClick={() => runAnalysis(custom)} disabled={loading}
                    className="mt-3 w-full py-2 text-sm font-semibold transition-all flex items-center justify-center gap-2"
                    style={{ background: '#D4A853', color: '#0A1926', borderRadius: '6px' }}>
                    <Beaker size={14} />{loading ? 'Đang tính...' : 'Chạy Phân Tích'}
                </button>
            </div>

            {/* Results Table */}
            {results.length > 0 && (
                <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                {['SKU', 'Giá vốn hiện tại', 'Giá vốn mới', 'Δ Chi phí', 'Margin hiện tại', 'Margin mới', 'Δ Margin'].map(h => (
                                    <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(r => {
                                const sc = r.scenarios[0] // first (and only) scenario
                                if (!sc) return null
                                const costUp = sc.costDeltaPct > 0
                                const marginDown = (sc.marginDelta ?? 0) < 0
                                return (
                                    <tr key={r.skuCode} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                        <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{r.skuCode}</td>
                                        <td className="px-3 py-2.5 text-xs" style={{ fontFamily: '"DM Mono"', color: '#8AAEBB' }}>{formatVND(r.currentUnitCost)}</td>
                                        <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: costUp ? '#E85D5D' : '#5BA88A' }}>{formatVND(sc.newUnitCost)}</td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{
                                                background: costUp ? 'rgba(232,93,93,0.15)' : 'rgba(91,168,138,0.15)',
                                                color: costUp ? '#E85D5D' : '#5BA88A',
                                            }}>
                                                {sc.costDeltaPct > 0 ? '+' : ''}{sc.costDeltaPct.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs" style={{ fontFamily: '"DM Mono"', color: '#8AAEBB' }}>{r.currentMarginPct !== null ? `${r.currentMarginPct.toFixed(1)}%` : '—'}</td>
                                        <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: marginDown ? '#E85D5D' : '#5BA88A' }}>{sc.newMarginPct !== null ? `${sc.newMarginPct.toFixed(1)}%` : '—'}</td>
                                        <td className="px-3 py-2.5">
                                            {sc.marginDelta !== null ? (
                                                <div className="flex items-center gap-1">
                                                    {marginDown ? <TrendingDown size={10} style={{ color: '#E85D5D' }} /> : <TrendingUp size={10} style={{ color: '#5BA88A' }} />}
                                                    <span className="text-xs font-bold" style={{ color: marginDown ? '#E85D5D' : '#5BA88A' }}>
                                                        {sc.marginDelta > 0 ? '+' : ''}{sc.marginDelta.toFixed(1)}%
                                                    </span>
                                                </div>
                                            ) : <span className="text-xs" style={{ color: '#4A6A7A' }}>—</span>}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
