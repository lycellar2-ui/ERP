'use client'

import { useState } from 'react'
import { Sparkles, Loader2, RefreshCw, TrendingUp, Target, Users, AlertTriangle, Trophy, XCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface Stats {
    totalDeals: number
    activeDeals: number
    wonDeals: number
    lostDeals: number
    pipelineValue: number
    weightedValue: number
    winRate: number
    avgDealSize: number
    staleDeals: number
}

export function AIPipelineAnalysis() {
    const [analysis, setAnalysis] = useState<string | null>(null)
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [collapsed, setCollapsed] = useState(true)

    async function handleGenerate() {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/pipeline-analysis', { method: 'POST' })
            const data = await res.json()
            if (data.success && data.analysis) {
                setAnalysis(data.analysis)
                setStats(data.stats)
            } else {
                setError(data.error || 'Không thể phân tích pipeline')
            }
        } catch {
            setError('Lỗi kết nối đến AI service')
        } finally {
            setLoading(false)
        }
    }

    const fmtVND = (v: number) => v >= 1e9 ? `${(v / 1e9).toFixed(1)}T` : `${(v / 1e6).toFixed(0)}M`

    return (
        <div className="rounded-md overflow-hidden" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #2A4355' }}>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(91,168,138,0.2))' }}>
                        <TrendingUp size={14} style={{ color: '#D4A853' }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>AI Sales Pipeline Analysis</h3>
                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Phân tích như Sales Director — coaching, risk, forecast</p>
                    </div>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all hover:scale-[1.02]"
                    style={{
                        background: loading ? 'rgba(212,168,83,0.08)' : 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(91,168,138,0.15))',
                        color: loading ? '#4A6A7A' : '#D4A853',
                        border: `1px solid ${loading ? '#2A4355' : 'rgba(212,168,83,0.3)'}`,
                    }}
                >
                    {loading ? (
                        <><Loader2 size={13} className="animate-spin" /> Đang phân tích...</>
                    ) : analysis ? (
                        <><RefreshCw size={13} /> Phân tích lại</>
                    ) : (
                        <><Sparkles size={13} /> 🔍 Phân Tích Pipeline</>
                    )}
                </button>
                <button onClick={() => setCollapsed(!collapsed)} className="p-2 rounded-md transition-all" style={{ color: '#4A6A7A' }}>
                    {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
            </div>

            {!collapsed && <>
                {/* Stats Row */}
                {stats && !loading && (
                    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 px-5 pt-4">
                        <div className="text-center p-2 rounded" style={{ background: '#142433' }}>
                            <div className="flex items-center justify-center gap-1 mb-0.5"><Target size={11} style={{ color: '#87CBB9' }} /></div>
                            <p className="text-lg font-bold" style={{ color: '#87CBB9', fontFamily: 'var(--font-mono)' }}>{stats.activeDeals}</p>
                            <p className="text-[9px]" style={{ color: '#4A6A7A' }}>Active Deals</p>
                        </div>
                        <div className="text-center p-2 rounded" style={{ background: '#142433' }}>
                            <div className="flex items-center justify-center gap-1 mb-0.5"><TrendingUp size={11} style={{ color: '#D4A853' }} /></div>
                            <p className="text-lg font-bold" style={{ color: '#D4A853', fontFamily: 'var(--font-mono)' }}>{fmtVND(stats.pipelineValue)}</p>
                            <p className="text-[9px]" style={{ color: '#4A6A7A' }}>Pipeline Value</p>
                        </div>
                        <div className="text-center p-2 rounded" style={{ background: '#142433' }}>
                            <p className="text-lg font-bold" style={{ color: '#4A8FAB', fontFamily: 'var(--font-mono)' }}>{fmtVND(stats.weightedValue)}</p>
                            <p className="text-[9px]" style={{ color: '#4A6A7A' }}>Weighted Value</p>
                        </div>
                        <div className="text-center p-2 rounded" style={{ background: 'rgba(91,168,138,0.06)' }}>
                            <div className="flex items-center justify-center gap-1 mb-0.5"><Trophy size={11} style={{ color: '#5BA88A' }} /></div>
                            <p className="text-lg font-bold" style={{ color: '#5BA88A', fontFamily: 'var(--font-mono)' }}>{stats.winRate}%</p>
                            <p className="text-[9px]" style={{ color: '#4A6A7A' }}>Win Rate</p>
                        </div>
                        <div className="text-center p-2 rounded" style={{ background: stats.staleDeals > 0 ? 'rgba(224,82,82,0.06)' : '#142433' }}>
                            <div className="flex items-center justify-center gap-1 mb-0.5"><AlertTriangle size={11} style={{ color: stats.staleDeals > 0 ? '#E05252' : '#4A6A7A' }} /></div>
                            <p className="text-lg font-bold" style={{ color: stats.staleDeals > 0 ? '#E05252' : '#4A6A7A', fontFamily: 'var(--font-mono)' }}>{stats.staleDeals}</p>
                            <p className="text-[9px]" style={{ color: '#4A6A7A' }}>Stale Deals</p>
                        </div>
                        <div className="text-center p-2 rounded" style={{ background: '#142433' }}>
                            <div className="flex items-center justify-center gap-1 mb-0.5"><XCircle size={11} style={{ color: '#8B1A2E' }} /></div>
                            <p className="text-lg font-bold" style={{ color: '#8B1A2E', fontFamily: 'var(--font-mono)' }}>{stats.lostDeals}</p>
                            <p className="text-[9px]" style={{ color: '#4A6A7A' }}>Lost</p>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="px-5 py-8 flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: '#2A4355', borderTopColor: '#D4A853' }} />
                        <p className="text-xs animate-pulse" style={{ color: '#4A6A7A' }}>
                            AI đang phân tích {'{'}pipeline, win rate, deal velocity, coaching...{'}'}
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
                        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-2">
                            {analysis.split('\n').filter(Boolean).map((line, i) => {
                                const isHeading = line.startsWith('#') || line.startsWith('**')
                                const isHighlight = line.includes('🔥') || line.includes('⚠️') || line.includes('🎯') || line.includes('📊') || line.includes('💡') || line.includes('📈')
                                const isUrgent = line.includes('🔴') || line.includes('cảnh báo') || line.includes('rủi ro')
                                const isPositive = line.includes('🟢') || line.includes('tốt') || line.includes('mạnh')

                                let color = '#8AAEBB'
                                if (isHeading || isHighlight) color = '#E8F1F2'
                                if (isUrgent) color = '#E05252'
                                if (isPositive) color = '#5BA88A'

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
                        <p className="text-[10px] mt-3 text-right" style={{ color: '#4A6A7A' }}>
                            🕐 Phân tích lúc {new Date().toLocaleString('vi-VN')} · Gemini 3.1 Pro · Sales Director AI
                        </p>
                    </div>
                )}

                {/* Empty State */}
                {!analysis && !loading && !error && (
                    <div className="px-5 py-4 flex flex-col items-center gap-2">
                        <TrendingUp size={20} style={{ color: '#2A4355' }} />
                        <p className="text-xs text-center" style={{ color: '#4A6A7A' }}>
                            Nhấn <strong>&quot;🔍 Phân Tích Pipeline&quot;</strong> để nhận<br />
                            đánh giá pipeline, coaching, dự báo doanh thu từ AI
                        </p>
                    </div>
                )}
            </>}
        </div>
    )
}
