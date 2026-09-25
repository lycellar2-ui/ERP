'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
    Users, Search, Phone, Mail, Handshake, Wine,
    Package, AlertCircle, TrendingUp, ChevronRight, MessageSquarePlus,
    ShoppingCart, Clock, CheckCircle2, Loader2, Crown, Calendar, AlertTriangle,
    ArrowUpDown, ArrowDown, ArrowUp, Gem, Target
} from 'lucide-react'
import { toast } from 'sonner'
import { CustomerCRMRow, getCRMCustomers, logCustomerActivity, ActivityType, getCustomer360, getCustomerTransactions, recalcAllCustomerTiers } from './actions'
import { ContactsPanel, TagsPanel } from './ContactsTagsPanel'
import { TastingEventsPanel } from './TastingEventsPanel'
import { ComplaintTicketsPanel } from './ComplaintTicketsPanel'
import { WinePreferencePanel } from './WinePreferencePanel'
import { WeeklyVisitPlannerPanel } from './WeeklyVisitPlannerPanel'
import { PipelinePanel } from './PipelinePanel'
import { formatVND, formatDate } from '@/lib/utils'

const TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
    HORECA: { label: 'HORECA', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    WHOLESALE: { label: 'Đại Lý', color: '#4A8FAB', bg: 'rgba(74,143,171,0.12)' },
    VIP_RETAIL: { label: 'VIP', color: '#D4A853', bg: 'rgba(212,168,83,0.12)' },
    DISTRIBUTOR: { label: 'NPP', color: '#A5DED0', bg: 'rgba(165,222,208,0.1)' },
}

const ACTIVITY_ICONS: Record<ActivityType, React.FC<any>> = {
    CALL: Phone,
    EMAIL: Mail,
    MEETING: Handshake,
    TASTING: Wine,
    DELIVERY: Package,
    COMPLAINT: AlertCircle,
    OTHER: MessageSquarePlus,
}

const TIER_CFG: Record<string, { label: string; color: string; icon: string }> = {
    PLATINUM: { label: 'Platinum', color: '#0F172A', icon: '💎' },
    GOLD: { label: 'Gold', color: '#D4A853', icon: '🥇' },
    SILVER: { label: 'Silver', color: '#475569', icon: '🥈' },
    BRONZE: { label: 'Bronze', color: '#87685A', icon: '🥉' },
}

function getTierFromRevenue(revenue: number): string {
    if (revenue >= 5_000_000_000) return 'PLATINUM'
    if (revenue >= 2_000_000_000) return 'GOLD'
    if (revenue >= 500_000_000) return 'SILVER'
    return 'BRONZE'
}

function CustomerCard({ row, onSelect, isSelected }: { row: CustomerCRMRow; onSelect: () => void; isSelected: boolean }) {
    const typeCfg = TYPE_CFG[row.channel ?? ''] ?? { label: row.customerType, color: '#475569', bg: 'rgba(138,174,187,0.1)' }
    const tier = getTierFromRevenue(row.totalRevenue)
    const tierCfg = TIER_CFG[tier]

    return (
        <button onClick={onSelect} className="w-full text-left p-4 rounded-md transition-all duration-150"
            style={{
                background: isSelected ? 'rgba(135,203,185,0.08)' : '#FFFFFF',
                border: `1px solid ${isSelected ? '#87CBB9' : '#E2E8F0'}`,
                borderLeft: `3px solid ${isSelected ? '#87CBB9' : 'transparent'}`,
            }}
            onMouseEnter={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.borderColor = '#0891B2' } }}
            onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0' } }}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ color: typeCfg.color, background: typeCfg.bg }}>{typeCfg.label}</span>
                        {tier !== 'BRONZE' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{ color: tierCfg.color, background: `${tierCfg.color}15` }}>
                                {tierCfg.icon} {tierCfg.label}
                            </span>
                        )}
                        {row.openComplaints > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ color: '#8B1A2E', background: 'rgba(139,26,46,0.15)' }}>
                                ⚠ {row.openComplaints} KN
                            </span>
                        )}
                    </div>
                    <p className="font-semibold text-sm truncate" style={{ color: '#0F172A' }}>{row.name}</p>
                    <p className="text-xs font-mono" style={{ color: '#64748B' }}>{row.code}</p>
                </div>
                <ChevronRight size={14} style={{ color: '#0891B2', flexShrink: 0, marginTop: 4 }} />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 rounded" style={{ background: '#FFFFFF' }}>
                    <p className="text-xs font-bold" style={{ color: '#0891B2' }}>
                        {row.totalRevenue >= 1e9 ? `${(row.totalRevenue / 1e9).toFixed(2)} tỷ` : row.totalRevenue >= 1e6 ? `${(row.totalRevenue / 1e6).toFixed(0)} tr` : formatVND(row.totalRevenue)}
                    </p>
                    <p className="text-xs" style={{ color: '#64748B' }}>Doanh số</p>
                </div>
                <div className="text-center p-2 rounded" style={{ background: '#FFFFFF' }}>
                    <p className="text-xs font-bold" style={{ color: '#5BA88A' }}>{row.totalOrders}</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>Đơn hàng</p>
                </div>
            </div>

            {row.salesRepName && (
                <p className="text-xs mt-2" style={{ color: '#64748B' }}>
                    👤 {row.salesRepName} · {row.paymentTerm}
                </p>
            )}
        </button>
    )
}

// Quick log activity panel
function QuickLogPanel({ customerId, onLogged }: { customerId: string; onLogged: () => void }) {
    const [type, setType] = useState<ActivityType>('CALL')
    const [desc, setDesc] = useState('')
    const [saving, setSaving] = useState(false)

    const handleLog = async () => {
        if (!desc.trim()) return
        setSaving(true)
        toast.promise(
            logCustomerActivity({ customerId, type, description: desc, performedBy: 'SYSTEM' }).then(res => {
                setDesc('')
                onLogged()
                return res
            }),
            {
                loading: 'Đang lưu tương tác...',
                success: 'Đã lưu tương tác!',
                error: 'Lỗi lưu tương tác',
                finally: () => setSaving(false)
            }
        )
    }

    return (
        <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>
                Ghi Chép Tương Tác
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
                {(['CALL', 'EMAIL', 'MEETING', 'TASTING', 'OTHER'] as ActivityType[]).map(t => {
                    const Icon = ACTIVITY_ICONS[t]
                    return (
                        <button key={t} onClick={() => setType(t)}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-all"
                            style={{
                                background: type === t ? 'rgba(8, 145, 178, 0.15)' : '#FFFFFF',
                                color: type === t ? '#87CBB9' : '#475569',
                                border: `1px solid ${type === t ? '#87CBB9' : '#E2E8F0'}`,
                                borderRadius: '4px',
                            }}>
                            <Icon size={11} /> {t}
                        </button>
                    )
                })}
            </div>
            <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                rows={2}
                placeholder="Nội dung tương tác..."
                className="w-full px-3 py-2 text-sm outline-none resize-none"
                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', borderRadius: '4px' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
            />
            <button onClick={handleLog} disabled={saving || !desc.trim()}
                className="mt-2 px-4 py-1.5 text-xs font-semibold transition-all"
                style={{
                    background: desc.trim() ? '#87CBB9' : '#E2E8F0',
                    color: desc.trim() ? '#F8FAFC' : '#64748B',
                    borderRadius: '4px',
                    opacity: saving ? 0.7 : 1,
                }}>
                {saving ? 'Đang lưu...' : 'Lưu Tương Tác'}
            </button>
        </div>
    )
}

interface Props {
    initialRows: CustomerCRMRow[]
    initialTotal: number
    stats: { total: number; horeca: number; openOpps: number; openTickets: number }
}

export function CRMClient({ initialRows, initialTotal, stats }: Props) {
    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [profile, setProfile] = useState<Awaited<ReturnType<typeof getCustomer360>>>(null)
    const [profileLoading, setProfileLoading] = useState(false)
    const [txHistory, setTxHistory] = useState<Awaited<ReturnType<typeof getCustomerTransactions>> | null>(null)
    const [txOpen, setTxOpen] = useState(false)
    const [tierRecalcing, setTierRecalcing] = useState(false)
    const searchParams = useSearchParams()
    const initialTab = (searchParams.get('tab') as any) || 'customers'
    const [crmTab, setCrmTab] = useState<'customers' | 'events' | 'complaints' | 'visits' | 'pipeline'>(initialTab)
    const [sortBy, setSortBy] = useState<'revenue' | 'orders' | 'name'>('revenue')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    const reload = useCallback(async (s?: string, t?: string) => {
        setLoading(true)
        try {
            const result = await getCRMCustomers({
                search: (s ?? search) || undefined,
                type: (t ?? typeFilter) || undefined,
            })
            setRows(result.rows)
            setTotal(result.total)
        } finally { setLoading(false) }
    }, [search, typeFilter])

    const selectedCustomer = rows.find(r => r.id === selectedId)

    // Sort rows client-side
    const sortedRows = [...rows].sort((a, b) => {
        const dir = sortDir === 'desc' ? -1 : 1
        switch (sortBy) {
            case 'revenue': return (a.totalRevenue - b.totalRevenue) * dir
            case 'orders': return (a.totalOrders - b.totalOrders) * dir
            case 'name': return a.name.localeCompare(b.name) * dir
            default: return 0
        }
    })

    const toggleSort = (field: typeof sortBy) => {
        if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
        else { setSortBy(field); setSortDir('desc') }
    }

    // CRM summary stats for empty state
    const topCustomers = [...rows].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5)
    const totalRevAll = rows.reduce((s, r) => s + r.totalRevenue, 0)
    const tierDist = rows.reduce((acc, r) => { const t = getTierFromRevenue(r.totalRevenue); acc[t] = (acc[t] || 0) + 1; return acc }, {} as Record<string, number>)

    useEffect(() => {
        if (!selectedId) { setProfile(null); setTxHistory(null); setTxOpen(false); return }
        setProfileLoading(true)
        getCustomer360(selectedId).then(p => { setProfile(p); setProfileLoading(false) })
    }, [selectedId])

    const loadTxHistory = async () => {
        if (!selectedId) return
        setTxOpen(true)
        const data = await getCustomerTransactions(selectedId)
        setTxHistory(data)
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>
                        CRM – Quan Hệ Khách Hàng
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
                        360° Customer View – Lịch sử, tương tác, cơ hội bán hàng
                    </p>
                </div>
                <button onClick={async () => {
                    setTierRecalcing(true)
                    toast.promise(
                        recalcAllCustomerTiers().then((res: any) => {
                            if (!res.success) throw new Error('Có lỗi xảy ra')
                            return res
                        }),
                        {
                            loading: 'Đang tính toán tier...',
                            success: (res: any) => `✅ Đã cập nhật ${res.updated} khách hàng`,
                            error: 'Lỗi tính toán',
                            finally: () => setTierRecalcing(false)
                        }
                    )
                }} disabled={tierRecalcing}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all"
                    style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.25)' }}>
                    {tierRecalcing ? <Loader2 size={12} className="animate-spin" /> : <Crown size={12} />}
                    {tierRecalcing ? 'Đang tính...' : 'Recalc Tiers'}
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Khách Hàng Đang Hoạt Động', value: stats.total, icon: Users, accent: '#87CBB9' },
                    { label: 'HORECA Partners', value: stats.horeca, icon: Wine, accent: '#5BA88A' },
                    { label: 'Cơ Hội Đang Theo Dõi', value: stats.openOpps, icon: TrendingUp, accent: '#D4A853' },
                    { label: 'Khiếu Nại Chưa Xử Lý', value: stats.openTickets, icon: AlertCircle, accent: '#8B1A2E' },
                ].map(s => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="p-4 rounded-md flex items-center gap-4"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
                                style={{ background: `${s.accent}18` }}>
                                <Icon size={20} style={{ color: s.accent }} />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>{s.label}</p>
                                <p className="text-xl font-bold mt-0.5 font-mono" style={{ color: '#0F172A' }}>{s.value}</p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* CRM Tabs */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#FFFFFF' }}>
                {([
                    { key: 'customers' as const, label: 'Khách Hàng', icon: Users },
                    { key: 'pipeline' as const, label: 'Cơ hội bán hàng (Pipeline)', icon: Target },
                    { key: 'visits' as const, label: 'Kế hoạch tuần', icon: Calendar },
                    { key: 'events' as const, label: 'Sự Kiện Thử Rượu', icon: Wine },
                    { key: 'complaints' as const, label: 'Phiếu Khiếu Nại', icon: AlertTriangle },
                ]).map(tab => (
                    <button key={tab.key} onClick={() => setCrmTab(tab.key)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all"
                        style={{
                            background: crmTab === tab.key ? '#FFFFFF' : 'transparent',
                            color: crmTab === tab.key ? '#87CBB9' : '#64748B',
                            border: crmTab === tab.key ? '1px solid #E2E8F0' : '1px solid transparent',
                        }}>
                        <tab.icon size={13} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab: Weekly Visit Planner */}
            {crmTab === 'visits' && <WeeklyVisitPlannerPanel />}

            {/* Tab: Sales Pipeline */}
            {crmTab === 'pipeline' && <PipelinePanel />}

            {/* Tab: Tasting Events */}
            {crmTab === 'events' && <TastingEventsPanel />}

            {/* Tab: Complaint Tickets */}
            {crmTab === 'complaints' && <ComplaintTicketsPanel />}

            {/* Tab: Customers (default) */}
            {crmTab === 'customers' && (<>
                <div className="grid grid-cols-12 gap-5">
                    {/* Left: customer list */}
                    <div className="col-span-12 lg:col-span-5 space-y-3">
                        {/* Filters */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                                <input
                                    type="text"
                                    placeholder="Tìm khách hàng..."
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); reload(e.target.value) }}
                                    className="w-full pl-9 pr-3 py-2 text-sm outline-none"
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', borderRadius: '6px' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
                                    onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                                />
                            </div>
                            <select value={typeFilter}
                                onChange={e => { setTypeFilter(e.target.value); reload(undefined, e.target.value) }}
                                className="px-3 py-2 text-sm outline-none"
                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: typeFilter ? '#0F172A' : '#64748B', borderRadius: '6px' }}>
                                <option value="">Tất cả</option>
                                <option value="HORECA">HORECA</option>
                                <option value="WHOLESALE">Đại Lý</option>
                                <option value="VIP_RETAIL">VIP</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#64748B' }}>
                                {total} Khách Hàng
                            </p>
                            <div className="flex gap-1">
                                {([['revenue', 'Revenue'], ['orders', 'Đơn'], ['name', 'Tên']] as const).map(([key, label]) => (
                                    <button key={key} onClick={() => toggleSort(key)}
                                        className="flex items-center gap-0.5 px-2 py-1 text-[10px] font-semibold rounded transition-all"
                                        style={{
                                            background: sortBy === key ? 'rgba(8, 145, 178, 0.08)' : 'transparent',
                                            color: sortBy === key ? '#87CBB9' : '#64748B',
                                            border: `1px solid ${sortBy === key ? 'rgba(8, 145, 178, 0.25)' : 'transparent'}`,
                                        }}>
                                        {label}
                                        {sortBy === key && (sortDir === 'desc' ? <ArrowDown size={9} /> : <ArrowUp size={9} />)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Customer cards */}
                        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                            {loading ? (
                                <div className="text-center py-8" style={{ color: '#64748B' }}>Đang tải...</div>
                            ) : sortedRows.map(row => (
                                <CustomerCard key={row.id} row={row} isSelected={selectedId === row.id} onSelect={() => setSelectedId(row.id)} />
                            ))}
                        </div>
                    </div>

                    {/* Right: 360° profile */}
                    <div className="col-span-12 lg:col-span-7 space-y-4">
                        {!selectedCustomer ? (
                            <div className="space-y-4">
                                {/* CRM Summary Dashboard */}
                                <div className="p-5 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#0F172A' }}>
                                        <TrendingUp size={15} style={{ color: '#0891B2' }} />
                                        Tổng Quan CRM
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="p-3 rounded-md text-center" style={{ background: '#FFFFFF' }}>
                                            <p className="text-lg font-bold" style={{ color: '#0891B2' }}>
                                                {totalRevAll >= 1e9 ? `${(totalRevAll / 1e9).toFixed(1)}T` : formatVND(totalRevAll)}
                                            </p>
                                            <p className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>Tổng Doanh Số</p>
                                        </div>
                                        <div className="p-3 rounded-md text-center" style={{ background: '#FFFFFF' }}>
                                            <p className="text-lg font-bold" style={{ color: '#D4A853' }}>
                                                {rows.reduce((s, r) => s + r.totalOrders, 0)}
                                            </p>
                                            <p className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>Tổng Đơn Hàng</p>
                                        </div>
                                    </div>

                                    {/* Tier Distribution */}
                                    <div className="mb-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>Phân Bổ Tier</p>
                                        <div className="flex gap-2">
                                            {(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE'] as const).map(tier => {
                                                const cfg = TIER_CFG[tier]
                                                const count = tierDist[tier] || 0
                                                return (
                                                    <div key={tier} className="flex-1 text-center p-2 rounded" style={{ background: `${cfg.color}08` }}>
                                                        <p className="text-xs">{cfg.icon}</p>
                                                        <p className="text-sm font-bold" style={{ color: cfg.color }}>{count}</p>
                                                        <p className="text-xs" style={{ color: '#64748B' }}>{cfg.label}</p>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Top 5 Customers */}
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>🏆 Top 5 Khách Hàng</p>
                                        <div className="space-y-1">
                                            {topCustomers.map((c, i) => {
                                                const tier = getTierFromRevenue(c.totalRevenue)
                                                const cfg = TIER_CFG[tier]
                                                return (
                                                    <button key={c.id} onClick={() => setSelectedId(c.id)}
                                                        className="w-full flex items-center justify-between py-2 px-3 rounded transition-all hover:bg-opacity-80"
                                                        style={{ background: '#FFFFFF' }}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold" style={{ color: i < 3 ? '#D4A853' : '#64748B' }}>#{i + 1}</span>
                                                            <div className="text-left">
                                                                <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>{c.name}</p>
                                                                <p className="text-[10px]" style={{ color: '#64748B' }}>{cfg.icon} {cfg.label} · {c.totalOrders} đơn</p>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-bold" style={{ color: '#0891B2' }}>
                                                            {c.totalRevenue >= 1e9 ? `${(c.totalRevenue / 1e9).toFixed(2)} tỷ` : formatVND(c.totalRevenue)}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <p className="text-xs text-center" style={{ color: '#64748B' }}>
                                    ← Chọn một khách hàng để xem hồ sơ 360°
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Customer header */}
                                <div className="p-5 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: '3px solid #87CBB9' }}>
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold" style={{ color: '#0F172A' }}>
                                                {selectedCustomer.name}
                                            </h3>
                                            <p className="text-xs" style={{ color: '#64748B' }}>
                                                {selectedCustomer.code} · {selectedCustomer.paymentTerm}
                                            </p>
                                        </div>
                                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                            style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A' }}>
                                            {selectedCustomer.status}
                                        </span>
                                    </div>

                                    {/* KPIs */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { label: 'Tổng Doanh Số', value: selectedCustomer.totalRevenue >= 1e9 ? `${(selectedCustomer.totalRevenue / 1e9).toFixed(2)} tỷ ₫` : formatVND(selectedCustomer.totalRevenue), color: '#0891B2' },
                                            { label: 'Số Đơn Hàng', value: selectedCustomer.totalOrders, color: '#5BA88A' },
                                            { label: 'Credit Limit', value: formatVND(selectedCustomer.creditLimit), color: '#D4A853' },
                                        ].map(kpi => (
                                            <div key={kpi.label} className="text-center p-3 rounded-md" style={{ background: '#FFFFFF' }}>
                                                <p className="text-lg font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                                                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{kpi.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Quick log */}
                                <QuickLogPanel customerId={selectedCustomer.id} onLogged={() => reload()} />

                                {/* Contacts + Tags */}
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                        <ContactsPanel customerId={selectedCustomer.id} />
                                    </div>
                                    <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                        <TagsPanel customerId={selectedCustomer.id} />
                                    </div>
                                </div>

                                {/* Wine Preference */}
                                <WinePreferencePanel customerId={selectedCustomer.id} />

                                {/* 360 data from profile */}
                                {profileLoading ? (
                                    <div className="p-4 text-center text-xs" style={{ color: '#64748B' }}>Loading...</div>
                                ) : profile && (
                                    <>
                                        {profile.arBalance > 0 && (
                                            <div className="p-3 rounded-md flex items-center justify-between"
                                                style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.2)' }}>
                                                <span className="text-xs" style={{ color: '#D4A853' }}>Công nợ chưa thu</span>
                                                <span className="text-sm font-bold" style={{ color: '#D4A853' }}>{formatVND(profile.arBalance)}</span>
                                            </div>
                                        )}
                                        <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>Đơn Hàng Gần Đây</p>
                                            {profile.recentOrders.length === 0 ? (
                                                <p className="text-xs py-3 text-center" style={{ color: '#64748B' }}>Chưa có đơn hàng</p>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    {profile.recentOrders.slice(0, 5).map(o => (
                                                        <div key={o.id} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: '#FFFFFF' }}>
                                                            <span className="text-xs font-bold" style={{ color: '#0891B2' }}>{o.soNo}</span>
                                                            <span className="text-xs" style={{ color: '#475569' }}>{formatDate(o.createdAt)}</span>
                                                            <span className="text-xs font-bold" style={{ color: '#0F172A' }}>{formatVND(Number(o.totalAmount))}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {/* Transaction History Button */}
                                        {!txOpen && (
                                            <button onClick={loadTxHistory} className="w-full py-2 text-xs font-semibold rounded transition-all"
                                                style={{ background: 'rgba(135,203,185,0.1)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.15)' }}>
                                                📊 Xem Toàn Bộ Lịch Sử Giao Dịch
                                            </button>
                                        )}

                                        {/* Transaction History Panel */}
                                        {txOpen && txHistory && (
                                            <div className="space-y-3">
                                                {/* Summary Stats */}
                                                <div className="grid grid-cols-4 gap-2">
                                                    {[
                                                        { label: 'All-time Revenue', value: txHistory.allTimeRevenue >= 1e9 ? `${(txHistory.allTimeRevenue / 1e9).toFixed(2)} tỷ ₫` : formatVND(txHistory.allTimeRevenue), color: '#0891B2' },
                                                        { label: 'Tổng Đơn', value: txHistory.totalOrders, color: '#4A8FAB' },
                                                        { label: 'Đã Xác Nhận', value: txHistory.confirmedOrders, color: '#5BA88A' },
                                                        { label: 'TB/Đơn', value: formatVND(txHistory.avgOrderValue), color: '#D4A853' },
                                                    ].map(s => (
                                                        <div key={s.label} className="text-center p-2 rounded" style={{ background: '#FFFFFF' }}>
                                                            <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                                                            <p className="text-[10px]" style={{ color: '#64748B' }}>{s.label}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Top SKUs */}
                                                {txHistory.topSkus.length > 0 && (
                                                    <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#D4A853' }}>
                                                            🏆 Top SKU Hay Mua
                                                        </p>
                                                        <div className="space-y-1">
                                                            {txHistory.topSkus.slice(0, 5).map((sku, i) => (
                                                                <div key={sku.skuCode} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: '#FFFFFF' }}>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-bold" style={{ color: i < 3 ? '#D4A853' : '#64748B' }}>#{i + 1}</span>
                                                                        <div>
                                                                            <span className="text-xs font-bold" style={{ color: '#0891B2' }}>{sku.skuCode}</span>
                                                                            <span className="text-xs ml-1" style={{ color: '#475569' }}>{sku.productName}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-xs font-bold" style={{ color: '#0F172A' }}>{sku.totalQty} chai</span>
                                                                        <span className="text-xs ml-2" style={{ color: '#5BA88A' }}>{sku.totalValue >= 1e9 ? `${(sku.totalValue / 1e9).toFixed(1)} tỷ` : formatVND(sku.totalValue)}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* All Orders */}
                                                <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>
                                                        Toàn Bộ Đơn Hàng ({txHistory.orders.length})
                                                    </p>
                                                    <div className="space-y-1 max-h-[250px] overflow-y-auto">
                                                        {txHistory.orders.map(o => (
                                                            <div key={o.id} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: '#FFFFFF' }}>
                                                                <span className="text-xs font-bold" style={{ color: '#0891B2' }}>{o.soNo}</span>
                                                                <span className="text-xs" style={{ color: '#475569' }}>{formatDate(o.date)}</span>
                                                                <span className="text-xs px-1.5 py-0.5 rounded" style={{
                                                                    background: o.status === 'PAID' ? 'rgba(91,168,138,0.15)' : 'rgba(138,174,187,0.15)',
                                                                    color: o.status === 'PAID' ? '#5BA88A' : '#475569',
                                                                }}>{o.status}</span>
                                                                <span className="text-xs font-bold" style={{ color: '#0F172A' }}>{formatVND(o.amount)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* AR Invoices */}
                                                {txHistory.invoices.length > 0 && (
                                                    <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>
                                                            Công Nợ / Hóa Đơn ({txHistory.invoices.length})
                                                        </p>
                                                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                                            {txHistory.invoices.map(inv => (
                                                                <div key={inv.invoiceNo} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: '#FFFFFF' }}>
                                                                    <span className="text-xs font-bold" style={{ color: '#D4A853' }}>{inv.invoiceNo}</span>
                                                                    <span className="text-xs" style={{ color: '#475569' }}>{formatDate(inv.date)}</span>
                                                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{
                                                                        background: inv.status === 'PAID' ? 'rgba(91,168,138,0.15)' :
                                                                            inv.status === 'OVERDUE' ? 'rgba(139,26,46,0.15)' : 'rgba(212,168,83,0.15)',
                                                                        color: inv.status === 'PAID' ? '#5BA88A' :
                                                                            inv.status === 'OVERDUE' ? '#8B1A2E' : '#D4A853',
                                                                    }}>{inv.status}</span>
                                                                    <div className="text-right">
                                                                        <span className="text-xs font-bold" style={{ color: '#0F172A' }}>{formatVND(inv.amount)}</span>
                                                                        <span className="text-[10px] block" style={{ color: '#5BA88A' }}>Đã thu: {formatVND(inv.paidAmount)}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <button onClick={() => setTxOpen(false)} className="w-full py-1.5 text-xs rounded"
                                                    style={{ background: '#E2E8F0', color: '#475569' }}>Thu Gọn</button>
                                            </div>
                                        )}
                                        {profile.recentActivities.length > 0 && (
                                            <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748B' }}>Lịch Sử Tương Tác</p>
                                                <div className="space-y-2">
                                                    {profile.recentActivities.slice(0, 5).map(a => {
                                                        const Icon = ACTIVITY_ICONS[a.type as ActivityType] ?? MessageSquarePlus
                                                        return (
                                                            <div key={a.id} className="flex gap-2 items-start">
                                                                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(8, 145, 178, 0.08)' }}>
                                                                    <Icon size={11} style={{ color: '#0891B2' }} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs" style={{ color: '#0F172A' }}>{a.description}</p>
                                                                    <p className="text-xs" style={{ color: '#64748B' }}>{a.performer?.name} {formatDate(a.occurredAt)}</p>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </>)}
        </div>
    )
}
