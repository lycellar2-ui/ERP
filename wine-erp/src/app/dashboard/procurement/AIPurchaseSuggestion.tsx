'use client'

import { useState } from 'react'
import { Sparkles, Loader2, RefreshCw, Package, AlertTriangle, TrendingDown, CheckCircle2 } from 'lucide-react'

interface Stats {
    totalProducts: number
    urgentReorder: number
    lowStock: number
    overstock: number
}

export function AIPurchaseSuggestion() {
    const [suggestion, setSuggestion] = useState<string | null>(null)
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleGenerate() {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/purchase-suggestion', { method: 'POST' })
            const data = await res.json()
            if (data.success && data.suggestion) {
                setSuggestion(data.suggestion)
                setStats(data.stats)
            } else {
                setError(data.error || 'Không thể tạo gợi ý nhập hàng')
            }
        } catch {
            setError('Lỗi kết nối đến AI service')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="rounded-md overflow-hidden" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #2A4355' }}>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(74,143,171,0.2), rgba(212,168,83,0.2))' }}>
                        <Package size={14} style={{ color: '#4A8FAB' }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>AI Gợi Ý Nhập Hàng</h3>
                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Phân tích tồn kho + trend bán → đề xuất nhập</p>
                    </div>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all hover:scale-[1.02]"
                    style={{
                        background: loading ? 'rgba(74,143,171,0.08)' : 'linear-gradient(135deg, rgba(74,143,171,0.2), rgba(135,203,185,0.15))',
                        color: loading ? '#4A6A7A' : '#4A8FAB',
                        border: `1px solid ${loading ? '#2A4355' : 'rgba(74,143,171,0.3)'}`,
                    }}
                >
                    {loading ? (
                        <><Loader2 size={13} className="animate-spin" /> Đang phân tích...</>
                    ) : suggestion ? (
                        <><RefreshCw size={13} /> Phân tích lại</>
                    ) : (
                        <><Sparkles size={13} /> 📦 Phân Tích Tồn Kho</>
                    )}
                </button>
            </div>

            {/* Stats Cards */}
            {stats && !loading && (
                <div className="grid grid-cols-4 gap-2 px-5 pt-4">
                    <div className="text-center p-2 rounded" style={{ background: '#142433' }}>
                        <p className="text-lg font-bold" style={{ color: '#87CBB9', fontFamily: 'var(--font-mono)' }}>{stats.totalProducts}</p>
                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Sản phẩm</p>
                    </div>
                    <div className="text-center p-2 rounded" style={{ background: 'rgba(224,82,82,0.06)', border: stats.urgentReorder > 0 ? '1px solid rgba(224,82,82,0.2)' : 'none' }}>
                        <p className="text-lg font-bold" style={{ color: '#E05252', fontFamily: 'var(--font-mono)' }}>{stats.urgentReorder}</p>
                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Cần nhập gấp</p>
                    </div>
                    <div className="text-center p-2 rounded" style={{ background: 'rgba(212,168,83,0.06)' }}>
                        <p className="text-lg font-bold" style={{ color: '#D4A853', fontFamily: 'var(--font-mono)' }}>{stats.lowStock}</p>
                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Sắp hết</p>
                    </div>
                    <div className="text-center p-2 rounded" style={{ background: 'rgba(74,143,171,0.06)' }}>
                        <p className="text-lg font-bold" style={{ color: '#4A8FAB', fontFamily: 'var(--font-mono)' }}>{stats.overstock}</p>
                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Tồn cao</p>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="px-5 py-8 flex flex-col items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: '#2A4355', borderTopColor: '#4A8FAB' }} />
                    </div>
                    <p className="text-xs animate-pulse" style={{ color: '#4A6A7A' }}>
                        AI đang phân tích tồn kho, doanh số 3 tháng, trend bán...
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

            {/* AI Result */}
            {suggestion && !loading && (
                <div className="px-5 py-4">
                    <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-2">
                        {suggestion.split('\n').filter(Boolean).map((line, i) => {
                            const isHeading = line.startsWith('#') || line.startsWith('**')
                            const isUrgent = line.includes('🔴') || line.includes('CẦN NHẬP NGAY')
                            const isWarning = line.includes('🟡') || line.includes('NÊN NHẬP')
                            const isOk = line.includes('🟢') || line.includes('ĐỦ TỒN')
                            const isOverstock = line.includes('⚠') || line.includes('TỒN CAO')
                            const isSummary = line.includes('📊') || line.includes('TỔNG HỢP')

                            let color = '#8AAEBB'
                            if (isHeading || isSummary) color = '#E8F1F2'
                            if (isUrgent) color = '#E05252'
                            if (isWarning) color = '#D4A853'
                            if (isOk) color = '#5BA88A'
                            if (isOverstock) color = '#4A8FAB'

                            return (
                                <p key={i} className="text-[13px] leading-relaxed" style={{
                                    color,
                                    fontWeight: isHeading || isSummary ? 700 : 400,
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
                        🕐 Phân tích lúc {new Date().toLocaleString('vi-VN')} · Gemini 3.1 Pro · Dữ liệu 3 tháng gần nhất
                    </p>
                </div>
            )}

            {/* Empty State */}
            {!suggestion && !loading && !error && (
                <div className="px-5 py-6 flex flex-col items-center gap-2">
                    <Package size={20} style={{ color: '#2A4355' }} />
                    <p className="text-xs text-center" style={{ color: '#4A6A7A' }}>
                        Nhấn <strong>&quot;📦 Phân Tích Tồn Kho&quot;</strong> để nhận gợi ý<br />
                        sản phẩm cần nhập, số lượng và mức ưu tiên
                    </p>
                </div>
            )}
        </div>
    )
}
