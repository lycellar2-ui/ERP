'use client'

import { useState } from 'react'
import {
    Sparkles, Loader2, RefreshCw, Wine, Globe, Package,
    TrendingUp, AlertTriangle, ChevronDown, ChevronUp,
    ShoppingBag, Truck, BarChart3, Save, CheckCircle
} from 'lucide-react'
import { useAiStatus } from '@/lib/useAiStatus'

interface CatalogStats {
    totalProducts: number
    activeProducts: number
    productsWithSales: number
    productsNoSales: number
    outOfStock: number
    totalProductRevenue: number
    totalStock: number
    typeDistribution: Record<string, number>
    countryDistribution: Record<string, number>
    totalSuppliers: number
    activeSuppliers: number
    supplierCountries: number
    totalSpending: number
}

const TYPE_LABELS: Record<string, string> = {
    RED: '🔴 Red',
    WHITE: '⚪ White',
    ROSE: '🩷 Rosé',
    SPARKLING: '✨ Sparkling',
    DESSERT: '🍯 Dessert',
    FORTIFIED: '🏰 Fortified',
    NATURAL: '🌿 Natural',
    ORANGE: '🟠 Orange',
}

export function AICatalogAnalysis() {
    const aiStatus = useAiStatus('catalog')
    const [analysis, setAnalysis] = useState<string | null>(null)
    const [stats, setStats] = useState<CatalogStats | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [collapsed, setCollapsed] = useState(true)
    const [saved, setSaved] = useState(false)

    if (aiStatus.loading) return null
    if (!aiStatus.enabled) return null

    async function handleSaveReport() {
        if (!analysis) return
        const res = await fetch('/api/ai/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module: 'catalog', title: `Catalog Analysis — ${new Date().toLocaleDateString('vi-VN')}`, analysis, stats }),
        })
        const data = await res.json()
        if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    }

    async function handleGenerate() {
        setLoading(true)
        setError(null)
        setCollapsed(false)
        try {
            const res = await fetch('/api/catalog-analysis', { method: 'POST' })
            const data = await res.json()
            if (data.success && data.analysis) {
                setAnalysis(data.analysis)
                setStats(data.stats)
            } else {
                setError(data.error || 'Không thể phân tích danh mục')
            }
        } catch {
            setError('Lỗi kết nối đến AI service')
        } finally {
            setLoading(false)
        }
    }

    const fmtVND = (v: number) => v >= 1e9 ? `${(v / 1e9).toFixed(1)}T` : v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${v.toLocaleString()}`

    return (
        <div className="rounded-md overflow-hidden mb-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(91,168,138,0.2))' }}>
                        <Wine size={14} style={{ color: '#D4A853' }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>AI Catalog & Market Intelligence</h3>
                        <p className="text-[10px]" style={{ color: '#64748B' }}>Phân tích danh mục, NCC, nghiên cứu thị trường · Wine Portfolio Director</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all hover:scale-[1.02]"
                        style={{
                            background: loading ? 'rgba(212,168,83,0.08)' : 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(91,168,138,0.15))',
                            color: loading ? '#64748B' : '#D4A853',
                            border: `1px solid ${loading ? '#E2E8F0' : 'rgba(212,168,83,0.3)'}`,
                        }}
                    >
                        {loading ? (
                            <><Loader2 size={13} className="animate-spin" /> Đang phân tích...</>
                        ) : analysis ? (
                            <><RefreshCw size={13} /> Phân tích lại</>
                        ) : (
                            <><Sparkles size={13} /> 🔍 Phân Tích Danh Mục</>
                        )}
                    </button>
                    <button onClick={() => setCollapsed(!collapsed)} className="p-2 rounded-md transition-all" style={{ color: '#64748B' }}>
                        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                </div>
            </div>

            {!collapsed && <>
                {/* Stats Rows */}
                {stats && !loading && (
                    <div className="px-5 pt-4 space-y-3">
                        {/* Row 1: Product KPIs */}
                        <div className="grid grid-cols-3 lg:grid-cols-7 gap-2">
                            <div className="text-center p-2 rounded" style={{ background: '#FFFFFF' }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5"><Package size={11} style={{ color: '#0891B2' }} /></div>
                                <p className="text-lg font-bold" style={{ color: '#0891B2' }}>{stats.totalProducts}</p>
                                <p className="text-xs" style={{ color: '#64748B' }}>Sản Phẩm</p>
                            </div>
                            <div className="text-center p-2 rounded" style={{ background: '#FFFFFF' }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5"><TrendingUp size={11} style={{ color: '#D4A853' }} /></div>
                                <p className="text-lg font-bold" style={{ color: '#D4A853' }}>{fmtVND(stats.totalProductRevenue)}</p>
                                <p className="text-xs" style={{ color: '#64748B' }}>Tổng Doanh Thu</p>
                            </div>
                            <div className="text-center p-2 rounded" style={{ background: '#FFFFFF' }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5"><BarChart3 size={11} style={{ color: '#5BA88A' }} /></div>
                                <p className="text-lg font-bold" style={{ color: '#5BA88A' }}>{stats.productsWithSales}</p>
                                <p className="text-xs" style={{ color: '#64748B' }}>Có Dữ Liệu Bán</p>
                            </div>
                            <div className="text-center p-2 rounded" style={{ background: stats.productsNoSales > 0 ? 'rgba(212,168,83,0.06)' : '#FFFFFF' }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5"><ShoppingBag size={11} style={{ color: stats.productsNoSales > 0 ? '#D4A853' : '#64748B' }} /></div>
                                <p className="text-lg font-bold font-mono" style={{ color: stats.productsNoSales > 0 ? '#D4A853' : '#64748B' }}>{stats.productsNoSales}</p>
                                <p className="text-xs" style={{ color: '#64748B' }}>Chưa Bán</p>
                            </div>
                            <div className="text-center p-2 rounded" style={{ background: stats.outOfStock > 0 ? 'rgba(224,82,82,0.06)' : '#FFFFFF' }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5"><AlertTriangle size={11} style={{ color: stats.outOfStock > 0 ? '#E05252' : '#64748B' }} /></div>
                                <p className="text-lg font-bold" style={{ color: stats.outOfStock > 0 ? '#E05252' : '#64748B' }}>{stats.outOfStock}</p>
                                <p className="text-xs" style={{ color: '#64748B' }}>Hết Hàng</p>
                            </div>
                            <div className="text-center p-2 rounded" style={{ background: '#FFFFFF' }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5"><Truck size={11} style={{ color: '#4A8FAB' }} /></div>
                                <p className="text-lg font-bold" style={{ color: '#4A8FAB' }}>{stats.totalSuppliers}</p>
                                <p className="text-xs" style={{ color: '#64748B' }}>NCC</p>
                            </div>
                            <div className="text-center p-2 rounded" style={{ background: '#FFFFFF' }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5"><Globe size={11} style={{ color: '#475569' }} /></div>
                                <p className="text-lg font-bold" style={{ color: '#475569' }}>{stats.supplierCountries}</p>
                                <p className="text-xs" style={{ color: '#64748B' }}>Quốc Gia NCC</p>
                            </div>
                        </div>

                        {/* Row 2: Type + Country Distribution */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 rounded" style={{ background: '#FFFFFF' }}>
                                <span className="text-[10px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Wine Types:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(stats.typeDistribution).map(([type, count]) => (
                                        <span key={type} className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                            style={{ background: 'rgba(212,168,83,0.08)', color: '#D4A853' }}>
                                            {TYPE_LABELS[type] ?? type} ×{count}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="p-2.5 rounded" style={{ background: '#FFFFFF' }}>
                                <span className="text-[10px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Countries:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(stats.countryDistribution).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([country, count]) => (
                                        <span key={country} className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                                            style={{ background: 'rgba(135,203,185,0.08)', color: '#0891B2' }}>
                                            {country} ×{count}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="px-5 py-8 flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: '#E2E8F0', borderTopColor: '#D4A853' }} />
                        <p className="text-xs animate-pulse" style={{ color: '#64748B' }}>
                            AI đang phân tích {'{'} danh mục, NCC, market trends, pricing, portfolio gaps... {'}'}
                        </p>
                    </div>
                )}

                {/* Error */}
                {error && !loading && (
                    <div className="px-5 py-4">
                        <div className="px-4 py-3 rounded-md" style={{ background: 'rgba(224,82,82,0.06)', border: '1px solid rgba(224,82,82,0.2)' }}>
                            <p className="text-xs" style={{ color: '#E05252' }}>❌ {error}</p>
                        </div>
                    </div>
                )}

                {/* AI Analysis */}
                {analysis && !loading && (
                    <div className="px-5 py-4">
                        <div className="space-y-1.5 max-h-[700px] overflow-y-auto pr-2">
                            {analysis.split('\n').filter(Boolean).map((line, i) => {
                                const isHeading = line.startsWith('#') || line.startsWith('**')
                                const isHighlight = /[🔥⚠️🎯📊💡📈🏆🆕🌍🏢💰🍷]/.test(line)
                                const isUrgent = line.includes('🔴') || line.includes('cảnh báo') || line.includes('rủi ro') || line.includes('hết hàng') || line.includes('chưa bán')
                                const isPositive = line.includes('🟢') || line.includes('tăng trưởng') || line.includes('bán chạy') || line.includes('tiềm năng')
                                const isMarket = line.includes('thị trường') || line.includes('xu hướng') || line.includes('cạnh tranh')

                                let color = '#475569'
                                if (isHeading || isHighlight) color = '#0F172A'
                                if (isUrgent) color = '#E05252'
                                if (isPositive) color = '#5BA88A'
                                if (isMarket && !isUrgent) color = '#D4A853'

                                return (
                                    <p key={i} className="text-[13px] leading-relaxed" style={{
                                        color,
                                        fontWeight: isHeading || isHighlight ? 700 : 400,
                                        fontSize: isHeading ? '14px' : '13px',
                                        marginLeft: line.startsWith('- ') || line.startsWith('* ') ? '12px' : '0',
                                        paddingTop: isHeading ? '8px' : '0',
                                    }}>
                                        {line.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
                                    </p>
                                )
                            })}
                        </div>
                        <p className="text-[10px] mt-3 text-right" style={{ color: '#64748B' }}>
                            🕐 Phân tích lúc {new Date().toLocaleString('vi-VN')} · Gemini 3.1 Pro · Wine Portfolio Director AI
                        </p>
                        <button onClick={handleSaveReport} disabled={saved}
                            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold rounded transition-all mt-1 ml-auto"
                            style={{ background: saved ? 'rgba(91,168,138,0.1)' : 'rgba(138,174,187,0.08)', color: saved ? '#5BA88A' : '#475569', border: `1px solid ${saved ? 'rgba(91,168,138,0.3)' : 'rgba(138,174,187,0.15)'}` }}>
                            {saved ? <><CheckCircle size={10} /> Đã lưu</> : <><Save size={10} /> Lưu Báo Cáo</>}
                        </button>
                    </div>
                )}

                {/* Empty State */}
                {!analysis && !loading && !error && (
                    <div className="px-5 py-4 flex flex-col items-center gap-2">
                        <Wine size={20} style={{ color: '#E2E8F0' }} />
                        <p className="text-xs text-center" style={{ color: '#64748B' }}>
                            Nhấn <strong>&quot;🔍 Phân Tích Danh Mục&quot;</strong> để nhận<br />
                            phân tích portfolio, NCC, nghiên cứu thị trường rượu vang VN
                        </p>
                    </div>
                )}
            </>}
        </div>
    )
}
