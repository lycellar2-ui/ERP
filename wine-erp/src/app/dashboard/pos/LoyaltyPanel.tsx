'use client'

import { useState } from 'react'
import { Star, Loader2, Search, ArrowUpRight, ArrowDownLeft, ArrowLeft } from 'lucide-react'
import { getLoyaltyInfo, type LoyaltyInfo } from './actions'
import { formatVND } from '@/lib/utils'
import { Button, Card, Badge, PageHeader } from '@/components/ui'
import Link from 'next/link'
import type { Tone } from '@/lib/ui/status'

const TIER_CFG: Record<string, { label: string; tone: Tone; icon: string }> = {
    PLATINUM: { label: 'Platinum', tone: 'neutral', icon: '💎' },
    GOLD: { label: 'Gold', tone: 'warning', icon: '👑' },
    SILVER: { label: 'Silver', tone: 'info', icon: '🥈' },
    BRONZE: { label: 'Bronze', tone: 'brand', icon: '🥉' },
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
        <div className="space-y-4 max-w-screen-lg">
            <PageHeader
                description="Tra cứu điểm thưởng, lịch sử quy đổi và cấp bậc loyalty của khách hàng"
                actions={
                    <Link href="/dashboard/pos">
                        <Button variant="secondary" size="sm">
                            <ArrowLeft size={14} aria-hidden /> Về POS Bán Hàng
                        </Button>
                    </Link>
                }
            />

            {/* Search Input */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-lys-muted" aria-hidden />
                    <input
                        className="w-full pl-9 pr-3 py-2 rounded-md text-sm outline-none bg-white border border-lys-border-strong text-lys-primary focus:ring-1 focus:ring-lys-teal focus:border-lys-teal shadow-xs"
                        placeholder="Nhập Mã hoặc Tên Khách Hàng..."
                        value={customerId}
                        onChange={e => setCustomerId(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && lookup()}
                    />
                </div>
                <Button onClick={lookup} disabled={loading || !customerId.trim()} loading={loading}>
                    Tra Cứu
                </Button>
            </div>

            {error && <p className="type-caption text-tone-danger-fg">{error}</p>}

            {/* Loyalty Card Info */}
            {info && tierCfg && (
                <div className="space-y-4 animate-fade-in">
                    {/* Main card */}
                    <Card className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-base font-bold text-lys-primary">{info.customerName}</p>
                                <Badge tone={tierCfg.tone} className="mt-1">
                                    {tierCfg.icon} {tierCfg.label}
                                </Badge>
                            </div>
                            <div className="text-right">
                                <p className="type-number text-2xl font-black text-lys-teal-strong">
                                    {info.pointsBalance.toLocaleString('vi-VN')}
                                </p>
                                <p className="type-caption">điểm khả dụng</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Tổng Tích', value: info.totalEarned.toLocaleString('vi-VN'), colorClass: 'text-tone-success-fg' },
                                { label: 'Đã Đổi', value: info.totalRedeemed.toLocaleString('vi-VN'), colorClass: 'text-tone-warning-fg' },
                                { label: 'Giá Trị Quy Đổi', value: formatVND(info.redeemableValue), colorClass: 'text-lys-teal-strong' },
                            ].map(s => (
                                <div key={s.label} className="text-center p-3 rounded-md bg-lys-subtle border border-lys-border">
                                    <p className={`type-number text-base font-bold ${s.colorClass}`}>{s.value}</p>
                                    <p className="type-caption mt-0.5">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* History */}
                    <Card className="p-4">
                        <h4 className="type-section-title text-lys-secondary mb-3">
                            Lịch Sử Giao Dịch
                        </h4>
                        <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                            {info.history.length === 0 ? (
                                <p className="type-caption text-center py-6">Chưa có giao dịch tích/đổi điểm nào</p>
                            ) : (
                                info.history.map((h, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-md bg-lys-subtle/60 border border-lys-border">
                                        <div className="flex items-center gap-2">
                                            {h.type === 'EARN' ? (
                                                <ArrowUpRight size={14} className="text-tone-success-fg" aria-hidden />
                                            ) : (
                                                <ArrowDownLeft size={14} className="text-tone-warning-fg" aria-hidden />
                                            )}
                                            <span className="text-xs font-medium text-lys-primary">{h.description}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`type-number text-xs font-bold ${h.type === 'EARN' ? 'text-tone-success-fg' : 'text-tone-warning-fg'}`}>
                                                {h.type === 'EARN' ? '+' : ''}{h.points}
                                            </span>
                                            <span className="type-caption">
                                                {new Date(h.date).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* Tier Info */}
            {!info && !loading && (
                <Card className="p-5">
                    <h4 className="type-section-title text-lys-secondary mb-3">
                        Cấp Bậc Loyalty
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(TIER_CFG).map(([key, cfg]) => (
                            <div key={key} className="text-center p-3 rounded-md bg-lys-subtle border border-lys-border">
                                <p className="text-xl mb-1">{cfg.icon}</p>
                                <Badge tone={cfg.tone} className="font-bold">{cfg.label}</Badge>
                                <p className="type-caption mt-1.5">
                                    {key === 'PLATINUM' ? '≥ 5,000 đ' : key === 'GOLD' ? '≥ 2,000 đ' : key === 'SILVER' ? '≥ 500 đ' : '< 500 đ'}
                                </p>
                            </div>
                        ))}
                    </div>
                    <p className="type-caption mt-4 text-center">
                        Mỗi 10,000₫ đơn hàng = 1 điểm. 1 điểm = 1,000₫ giảm giá khi thanh toán đổi điểm.
                    </p>
                </Card>
            )}
        </div>
    )
}
