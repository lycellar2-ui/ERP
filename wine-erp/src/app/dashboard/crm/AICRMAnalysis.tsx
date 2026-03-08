'use client'

import { useState } from 'react'
import {
    Sparkles, Loader2, RefreshCw, TrendingUp, Users, AlertTriangle,
    DollarSign, XCircle, ChevronDown, ChevronUp, ShieldAlert,
    Crown, Gem, UserX, CreditCard, Save, CheckCircle
} from 'lucide-react'
import { useAiStatus } from '@/lib/useAiStatus'

interface CRMStats {
    totalCustomers: number
    totalRevenue: number
    monthRevenue: number
    prevMonthRevenue: number
    revenueGrowth: number
    totalAR: number
    totalOverdue: number
    churningCount: number
    complaintsOpen: number
    creditHoldCount: number
    avgRevPerCustomer: number
    tierDistribution: Record<string, number>
    atRiskCount: number
}

export function AICRMAnalysis() {
    const aiStatus = useAiStatus('crm')
    const [analysis, setAnalysis] = useState<string | null>(null)
    const [stats, setStats] = useState<CRMStats | null>(null)
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
            body: JSON.stringify({ module: 'crm', title: `CRM Analysis — ${new Date().toLocaleDateString('vi-VN')}`, analysis, stats }),
        })
        const data = await res.json()
        if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    }

    async function handleGenerate() {
        setLoading(true)
        setError(null)
        setCollapsed(false)
        try {
            const res = await fetch('/api/crm-analysis', { method: 'POST' })
            const data = await res.json()
            if (data.success && data.analysis) {
                setAnalysis(data.analysis)
                setStats(data.stats)
            } else {
                setError(data.error || 'Không thể phân tích CRM')
            }
        } catch {
            setError('Lỗi kết nối đến AI service')
        } finally {
            setLoading(false)
        }
    }

    const fmtVND = (v: number) => v >= 1e9 ? `${(v / 1e9).toFixed(1)}T` : v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${v.toLocaleString()}`

    const TIER_ICONS: Record<string, string> = { PLATINUM: '💎', GOLD: '🥇', SILVER: '🥈', BRONZE: '🥉' }
    const TIER_COLORS: Record<string, string> = { PLATINUM: '#E8F1F2', GOLD: '#D4A853', SILVER: '#8AAEBB', BRONZE: '#87685A' }

    return (
        <div className="rounded-md overflow-hidden mb-5" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #2A4355' }}>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(135,203,185,0.2), rgba(212,168,83,0.2))' }}>
                        <Users size={14} style={{ color: '#87CBB9' }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>AI CRM Analysis</h3>
                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Phân tích CRO — sức khỏe KH, churning, AR, chiến lược</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all hover:scale-[1.02]"
                        style={{
                            background: loading ? 'rgba(135,203,185,0.08)' : 'linear-gradient(135deg, rgba(135,203,185,0.2), rgba(212,168,83,0.15))',
                            color: loading ? '#4A6A7A' : '#87CBB9',
                            border: `1px solid ${loading ? '#2A4355' : 'rgba(135,203,185,0.3)'}`,
                        }}
                    >
                        {loading ? (
                            <><Loader2 size={13} className="animate-spin" /> Đang phân tích...</>
                        ) : analysis ? (
                            <><RefreshCw size={13} /> Phân tích lại</>
                        ) : (
                            <><Sparkles size={13} /> 🔍 Phân Tích CRM</>
                        )}
                    </button>
                    <button onClick={() => setCollapsed(!collapsed)} className="p-2 rounded-md transition-all" style={{ color: '#4A6A7A' }}>
                        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                </div>
            </div>

            {!collapsed && <>
                {/* Stats Row */}
                {stats && !loading && (
                    <div className="px-5 pt-4">
                        {/* Row 1: Core KPIs */}
                        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
                            <div className="text-center p-2 rounded" style={{ background: '#142433' }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5"><Users size={11} style={{ color: '#87CBB9' }} /></div>
                                <p className="text-lg font-bold" style={{ color: '#87CBB9', fontFamily: 'var(--font-mono)' }}>{stats.totalCustomers}</p>
                                <p className="text-[9px]" style={{ color: '#4A6A7A' }}>Khách Hàng</p>
                            </div>
                            <div className="text-center p-2 rounded" style={{ background: '#142433' }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5"><DollarSign size={11} style={{ color: '#D4A853' }} /></div>
                                <p className="text-lg font-bold" style={{ color: '#D4A853', fontFamily: 'var(--font-mono)' }}>{fmtVND(stats.totalRevenue)}</p>
                                <p className="text-[9px]" style={{ color: '#4A6A7A' }}>Tổng Doanh Thu</p>
                            </div>
                            <div className="text-center p-2 rounded" style={{ background: '#142433' }}>
                                <p className="text-lg font-bold" style={{ color: stats.revenueGrowth >= 0 ? '#5BA88A' : '#E05252', fontFamily: 'var(--font-mono)' }}>
                                    {stats.revenueGrowth >= 0 ? '+' : ''}{stats.revenueGrowth}%
                                </p>
                                <p className="text-[9px]" style={{ color: '#4A6A7A' }}>MoM Growth</p>
                            </div>
                            <div className="text-center p-2 rounded" style={{ background: stats.totalOverdue > 0 ? 'rgba(224,82,82,0.06)' : '#142433' }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5"><CreditCard size={11} style={{ color: stats.totalOverdue > 0 ? '#E05252' : '#4A6A7A' }} /></div>
                                <p className="text-lg font-bold" style={{ color: stats.totalOverdue > 0 ? '#E05252' : '#8AAEBB', fontFamily: 'var(--font-mono)' }}>{fmtVND(stats.totalOverdue)}</p>
                                <p className="text-[9px]" style={{ color: '#4A6A7A' }}>AR Quá Hạn</p>
                            </div>
                            <div className="text-center p-2 rounded" style={{ background: stats.churningCount > 0 ? 'rgba(224,82,82,0.06)' : '#142433' }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5"><UserX size={11} style={{ color: stats.churningCount > 0 ? '#E05252' : '#4A6A7A' }} /></div>
                                <p className="text-lg font-bold" style={{ color: stats.churningCount > 0 ? '#E05252' : '#4A6A7A', fontFamily: 'var(--font-mono)' }}>{stats.churningCount}</p>
                                <p className="text-[9px]" style={{ color: '#4A6A7A' }}>Churning</p>
                            </div>
                            <div className="text-center p-2 rounded" style={{ background: stats.complaintsOpen > 0 ? 'rgba(224,82,82,0.06)' : '#142433' }}>
                                <div className="flex items-center justify-center gap-1 mb-0.5"><AlertTriangle size={11} style={{ color: stats.complaintsOpen > 0 ? '#E05252' : '#4A6A7A' }} /></div>
                                <p className="text-lg font-bold" style={{ color: stats.complaintsOpen > 0 ? '#E05252' : '#4A6A7A', fontFamily: 'var(--font-mono)' }}>{stats.complaintsOpen}</p>
                                <p className="text-[9px]" style={{ color: '#4A6A7A' }}>Complaints</p>
                            </div>
                        </div>

                        {/* Row 2: Tier Distribution + Revenue */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-3 p-2.5 rounded" style={{ background: '#142433' }}>
                                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Tiers:</span>
                                {(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE'] as const).map(tier => (
                                    <span key={tier} className="text-xs font-bold" style={{ color: TIER_COLORS[tier] }}>
                                        {TIER_ICONS[tier]} {stats.tierDistribution[tier] || 0}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded" style={{ background: '#142433' }}>
                                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>
                                    Tháng này: <span style={{ color: '#D4A853', fontFamily: 'var(--font-mono)' }}>{fmtVND(stats.monthRevenue)}</span>
                                </span>
                                <span className="text-[10px] font-semibold" style={{ color: '#4A6A7A' }}>
                                    vs trước: <span style={{ color: '#8AAEBB', fontFamily: 'var(--font-mono)' }}>{fmtVND(stats.prevMonthRevenue)}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="px-5 py-8 flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: '#2A4355', borderTopColor: '#87CBB9' }} />
                        <p className="text-xs animate-pulse" style={{ color: '#4A6A7A' }}>
                            AI đang phân tích {'{'}khách hàng, churning, AR, wine preferences, chiến lược...{'}'}
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
                                const isHighlight = line.includes('🔥') || line.includes('⚠️') || line.includes('🎯') || line.includes('📊') || line.includes('💡') || line.includes('📈') || line.includes('🏆') || line.includes('💰') || line.includes('🍷')
                                const isUrgent = line.includes('🔴') || line.includes('cảnh báo') || line.includes('rủi ro') || line.includes('churning') || line.includes('quá hạn')
                                const isPositive = line.includes('🟢') || line.includes('tăng trưởng') || line.includes('tốt') || line.includes('mạnh')

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
                            🕐 Phân tích lúc {new Date().toLocaleString('vi-VN')} · Gemini 3.1 Pro · CRM Director AI
                        </p>
                        <button onClick={handleSaveReport} disabled={saved}
                            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold rounded transition-all mt-1 ml-auto"
                            style={{ background: saved ? 'rgba(91,168,138,0.1)' : 'rgba(138,174,187,0.08)', color: saved ? '#5BA88A' : '#8AAEBB', border: `1px solid ${saved ? 'rgba(91,168,138,0.3)' : 'rgba(138,174,187,0.15)'}` }}>
                            {saved ? <><CheckCircle size={10} /> Đã lưu</> : <><Save size={10} /> Lưu Báo Cáo</>}
                        </button>
                    </div>
                )}

                {/* Empty State */}
                {!analysis && !loading && !error && (
                    <div className="px-5 py-4 flex flex-col items-center gap-2">
                        <Users size={20} style={{ color: '#2A4355' }} />
                        <p className="text-xs text-center" style={{ color: '#4A6A7A' }}>
                            Nhấn <strong>&quot;🔍 Phân Tích CRM&quot;</strong> để nhận<br />
                            báo cáo sức khỏe KH, churning, AR, chiến lược CEO
                        </p>
                    </div>
                )}
            </>}
        </div>
    )
}
