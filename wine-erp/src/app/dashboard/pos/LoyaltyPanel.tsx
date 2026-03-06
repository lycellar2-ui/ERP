'use client'

import { useState } from 'react'
import { Star, Gift, Crown, Loader2, Search, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { getLoyaltyInfo, type LoyaltyInfo } from './actions'
import { formatVND } from '@/lib/utils'

const TIER_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    PLATINUM: { label: 'Platinum', color: '#E8F1F2', bg: 'rgba(232,241,242,0.12)', icon: '💎' },
    GOLD: { label: 'Gold', color: '#D4A853', bg: 'rgba(212,168,83,0.12)', icon: '👑' },
    SILVER: { label: 'Silver', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)', icon: '🥈' },
    BRONZE: { label: 'Bronze', color: '#C07434', bg: 'rgba(192,116,52,0.12)', icon: '🥉' },
}

export function LoyaltyPanel() {
    const [customerId, setCustomerId] = useState('')
    const [info, setInfo] = useState<LoyaltyInfo | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const lookup = async () => {
        if (!customerId.trim()) return
        setLoading(true)
        setError('')
        const data = await getLoyaltyInfo(customerId.trim())
        if (!data) setError('Không tìm thấy khách hàng')
        setInfo(data)
        setLoading(false)
    }

    const tierCfg = info ? (TIER_CFG[info.tier] ?? TIER_CFG.BRONZE) : null

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-2">
                <Star size={18} style={{ color: '#D4A853' }} />
                <h3 className="text-lg font-semibold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>
                    Chương Trình Loyalty
                </h3>
            </div>

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                        placeholder="Nhập Customer ID..."
                        value={customerId}
                        onChange={e => setCustomerId(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && lookup()} />
                </div>
                <button onClick={lookup} disabled={loading || !customerId.trim()}
                    className="px-4 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    {loading ? <Loader2 size={14} className="animate-spin" /> : 'Tra Cứu'}
                </button>
            </div>

            {error && <p className="text-xs" style={{ color: '#8B1A2E' }}>{error}</p>}

            {/* Loyalty Card */}
            {info && tierCfg && (
                <div className="space-y-4">
                    {/* Main card */}
                    <div className="p-5 rounded-lg" style={{
                        background: 'linear-gradient(135deg, #1B2E3D 0%, #142433 100%)',
                        border: `1px solid ${tierCfg.color}30`,
                    }}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{info.customerName}</p>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                                    style={{ color: tierCfg.color, background: tierCfg.bg }}>
                                    {tierCfg.icon} {tierCfg.label}
                                </span>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                                    {info.pointsBalance.toLocaleString('vi-VN')}
                                </p>
                                <p className="text-xs" style={{ color: '#4A6A7A' }}>điểm khả dụng</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Tổng Tích', value: info.totalEarned.toLocaleString('vi-VN'), color: '#5BA88A' },
                                { label: 'Đã Đổi', value: info.totalRedeemed.toLocaleString('vi-VN'), color: '#C07434' },
                                { label: 'Giá Trị Quy Đổi', value: formatVND(info.redeemableValue), color: '#87CBB9' },
                            ].map(s => (
                                <div key={s.label} className="text-center p-2 rounded" style={{ background: '#0D1E2B' }}>
                                    <p className="text-sm font-bold" style={{ color: s.color, fontFamily: '"DM Mono"' }}>{s.value}</p>
                                    <p className="text-xs" style={{ color: '#4A6A7A' }}>{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* History */}
                    <div className="p-4 rounded-lg" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A6A7A' }}>
                            Lịch Sử Giao Dịch
                        </p>
                        <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                            {info.history.length === 0 ? (
                                <p className="text-xs text-center py-6" style={{ color: '#4A6A7A' }}>Chưa có giao dịch</p>
                            ) : (
                                info.history.map((h, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded" style={{ background: '#142433' }}>
                                        <div className="flex items-center gap-2">
                                            {h.type === 'EARN' ? (
                                                <ArrowUpRight size={12} style={{ color: '#5BA88A' }} />
                                            ) : (
                                                <ArrowDownLeft size={12} style={{ color: '#C07434' }} />
                                            )}
                                            <span className="text-xs" style={{ color: '#E8F1F2' }}>{h.description}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold" style={{
                                                color: h.type === 'EARN' ? '#5BA88A' : '#C07434',
                                                fontFamily: '"DM Mono"',
                                            }}>
                                                {h.type === 'EARN' ? '+' : ''}{h.points}
                                            </span>
                                            <span className="text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>
                                                {new Date(h.date).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tier Info */}
            {!info && !loading && (
                <div className="p-5 rounded-lg" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A6A7A' }}>
                        Cấp Bậc Loyalty
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                        {Object.entries(TIER_CFG).map(([key, cfg]) => (
                            <div key={key} className="text-center p-3 rounded" style={{ background: '#142433' }}>
                                <p className="text-lg">{cfg.icon}</p>
                                <p className="text-xs font-semibold mt-1" style={{ color: cfg.color }}>{cfg.label}</p>
                                <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>
                                    {key === 'PLATINUM' ? '≥5000' : key === 'GOLD' ? '≥2000' : key === 'SILVER' ? '≥500' : '<500'}
                                </p>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs mt-3" style={{ color: '#4A6A7A' }}>
                        Mỗi 10,000₫ đơn hàng = 1 điểm. 1 điểm = 1,000₫ giảm giá khi đổi.
                    </p>
                </div>
            )}
        </div>
    )
}
