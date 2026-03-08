'use client'

import { useState } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'

export function AICeoSummary() {
    const [summary, setSummary] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleGenerate() {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/ceo-summary', { method: 'POST' })
            const data = await res.json()
            if (data.success && data.summary) {
                setSummary(data.summary)
            } else {
                setError(data.error || 'Không thể tạo báo cáo AI')
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
                        style={{ background: 'linear-gradient(135deg, rgba(135,203,185,0.2), rgba(212,168,83,0.2))' }}>
                        <Sparkles size={14} style={{ color: '#D4A853' }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>AI Briefing cho CEO</h3>
                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Phân tích tự động bằng Gemini 3.1 Pro</p>
                    </div>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all hover:scale-[1.02]"
                    style={{
                        background: loading ? 'rgba(135,203,185,0.08)' : 'linear-gradient(135deg, rgba(135,203,185,0.2), rgba(212,168,83,0.15))',
                        color: loading ? '#4A6A7A' : '#D4A853',
                        border: `1px solid ${loading ? '#2A4355' : 'rgba(212,168,83,0.3)'}`,
                    }}
                >
                    {loading ? (
                        <><Loader2 size={13} className="animate-spin" /> Đang phân tích...</>
                    ) : summary ? (
                        <><RefreshCw size={13} /> Tạo lại</>
                    ) : (
                        <><Sparkles size={13} /> ✨ Tạo Báo Cáo AI</>
                    )}
                </button>
            </div>

            {/* Content */}
            {loading && (
                <div className="px-5 py-8 flex flex-col items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: '#2A4355', borderTopColor: '#D4A853' }} />
                    </div>
                    <p className="text-xs animate-pulse" style={{ color: '#4A6A7A' }}>
                        AI đang phân tích doanh thu, công nợ, tồn kho...
                    </p>
                </div>
            )}

            {error && !loading && (
                <div className="px-5 py-4">
                    <div className="px-4 py-3 rounded-md" style={{ background: 'rgba(224,82,82,0.06)', border: '1px solid rgba(224,82,82,0.2)' }}>
                        <p className="text-xs" style={{ color: '#E05252' }}>❌ {error}</p>
                    </div>
                </div>
            )}

            {summary && !loading && (
                <div className="px-5 py-4">
                    <div className="prose prose-sm max-w-none space-y-2">
                        {summary.split('\n').filter(Boolean).map((line, i) => (
                            <p key={i} className="text-[13px] leading-relaxed" style={{
                                color: line.startsWith('##') || line.startsWith('**')
                                    ? '#E8F1F2'
                                    : line.startsWith('- 🔴') || line.startsWith('- ⚠')
                                        ? '#E05252'
                                        : line.startsWith('- 🟢') || line.startsWith('- ✅')
                                            ? '#5BA88A'
                                            : line.startsWith('- 🟡')
                                                ? '#D4A853'
                                                : '#8AAEBB',
                                fontWeight: line.startsWith('##') || line.startsWith('**') ? 700 : 400,
                                fontSize: line.startsWith('##') ? '14px' : '13px',
                                marginLeft: line.startsWith('- ') ? '8px' : '0',
                            }}>
                                {line.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
                            </p>
                        ))}
                    </div>
                    <p className="text-[10px] mt-3 text-right" style={{ color: '#4A6A7A' }}>
                        🕐 Tạo lúc {new Date().toLocaleString('vi-VN')} · Gemini 3.1 Pro
                    </p>
                </div>
            )}

            {!summary && !loading && !error && (
                <div className="px-5 py-6 flex flex-col items-center gap-2">
                    <Sparkles size={20} style={{ color: '#2A4355' }} />
                    <p className="text-xs text-center" style={{ color: '#4A6A7A' }}>
                        Nhấn <strong>&quot;✨ Tạo Báo Cáo AI&quot;</strong> để nhận bản tóm tắt<br />
                        doanh thu, rủi ro và đề xuất hành động từ AI
                    </p>
                </div>
            )}
        </div>
    )
}
