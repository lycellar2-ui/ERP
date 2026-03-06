'use client'

import { useState, useEffect } from 'react'
import { Target, Plus, X, Save, ChevronRight, BarChart3 } from 'lucide-react'
import {
    type AllocationCampaignRow, type AllocationQuotaRow,
    getAllocCampaigns, getAllocQuotas, getAllocStats,
    createAllocCampaign, addAllocQuota, getAllocOptions,
} from './actions'
import { toast } from 'sonner'

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE: { label: 'Hoạt Động', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    PAUSED: { label: 'Tạm Dừng', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    COMPLETED: { label: 'Hoàn Tất', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    CANCELLED: { label: 'Hủy', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
}

export function AllocationClient({ initialCampaigns, stats }: {
    initialCampaigns: AllocationCampaignRow[];
    stats: { total: number; active: number }
}) {
    const [campaigns, setCampaigns] = useState(initialCampaigns)
    const [selected, setSelected] = useState<AllocationCampaignRow | null>(null)
    const [quotas, setQuotas] = useState<AllocationQuotaRow[]>([])
    const [createOpen, setCreateOpen] = useState(false)
    const [addQuotaOpen, setAddQuotaOpen] = useState(false)
    const [options, setOptions] = useState<{ products: any[]; users: any[]; customers: any[] }>({ products: [], users: [], customers: [] })
    const [form, setForm] = useState({ name: '', productId: '', totalQty: '', unit: 'CASE', startDate: '', endDate: '' })
    const [quotaForm, setQuotaForm] = useState({ targetType: 'SALES_REP', targetId: '', qtyAllocated: '' })

    const reload = async () => {
        const [c, s] = await Promise.all([getAllocCampaigns(), getAllocStats()])
        setCampaigns(c)
    }

    const loadOptions = async () => {
        const opts = await getAllocOptions()
        setOptions(opts)
    }

    const handleSelectCampaign = async (c: AllocationCampaignRow) => {
        setSelected(c)
        const q = await getAllocQuotas(c.id)
        setQuotas(q)
    }

    const handleCreateCampaign = async () => {
        if (!form.name || !form.productId || !form.totalQty) return toast.error('Điền đủ thông tin')
        const res = await createAllocCampaign({
            name: form.name, productId: form.productId,
            totalQty: Number(form.totalQty), unit: form.unit,
            startDate: form.startDate, endDate: form.endDate,
        })
        if (res.success) { setCreateOpen(false); setForm({ name: '', productId: '', totalQty: '', unit: 'CASE', startDate: '', endDate: '' }); reload() }
        else toast.error(res.error || 'Lỗi tạo campaign')
    }

    const handleAddQuota = async () => {
        if (!selected || !quotaForm.targetId || !quotaForm.qtyAllocated) return toast.error('Điền đủ thông tin')
        const res = await addAllocQuota({
            campaignId: selected.id, targetType: quotaForm.targetType,
            targetId: quotaForm.targetId, qtyAllocated: Number(quotaForm.qtyAllocated),
        })
        if (res.success) {
            setAddQuotaOpen(false); setQuotaForm({ targetType: 'SALES_REP', targetId: '', qtyAllocated: '' })
            const q = await getAllocQuotas(selected.id)
            setQuotas(q)
            reload()
        } else toast.error(res.error || 'Lỗi thêm quota')
    }

    useEffect(() => { loadOptions() }, [])

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Allocation Engine
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Quản lý hạn mức phân bổ sản phẩm theo Sales Rep / Khách hàng / Kênh
                    </p>
                </div>
                <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                    <Plus size={16} /> Tạo Campaign
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Tổng Campaign', value: stats.total, accent: '#87CBB9' },
                    { label: 'Đang Active', value: stats.active, accent: '#5BA88A' },
                    { label: 'Campaigns List', value: campaigns.length, accent: '#D4A853' },
                ].map(s => (
                    <div key={s.label} className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{s.label}</p>
                        <p className="text-xl font-bold" style={{ fontFamily: '"DM Mono"', color: s.accent }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Main layout */}
            <div className="grid grid-cols-12 gap-5">
                {/* Left: Campaign list */}
                <div className="col-span-5 space-y-2">
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#4A6A7A' }}>Campaigns</p>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {campaigns.length === 0 ? (
                            <p className="text-sm py-8 text-center" style={{ color: '#4A6A7A' }}>Chưa có campaign — Tạo mới bên phải</p>
                        ) : campaigns.map(c => {
                            const st = STATUS_MAP[c.status] ?? STATUS_MAP.ACTIVE
                            const pct = c.totalQty > 0 ? (c.soldQty / c.totalQty) * 100 : 0
                            const barColor = pct >= 90 ? '#8B1A2E' : pct >= 70 ? '#D4A853' : '#87CBB9'
                            const statusLabel = pct >= 100 ? '🔴 Đã hết' : pct >= 90 ? '🟡 Gần hết' : pct >= 70 ? '⚠ Sắp hết' : '✅ Còn nhiều'
                            const statusColor = pct >= 90 ? '#8B1A2E' : pct >= 70 ? '#D4A853' : '#5BA88A'
                            return (
                                <button key={c.id} onClick={() => handleSelectCampaign(c)}
                                    className="w-full text-left p-4 rounded-md transition-all"
                                    style={{
                                        background: selected?.id === c.id ? 'rgba(135,203,185,0.08)' : '#1B2E3D',
                                        border: `1px solid ${selected?.id === c.id ? '#87CBB9' : '#2A4355'}`,
                                        borderLeft: `3px solid ${selected?.id === c.id ? '#87CBB9' : 'transparent'}`,
                                    }}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: '#E8F1F2' }}>{c.name}</p>
                                            <p className="text-xs" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{c.skuCode}</p>
                                        </div>
                                        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: '#142433' }}>
                                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                                    </div>
                                    <div className="flex justify-between items-center text-xs" style={{ color: '#4A6A7A' }}>
                                        <span>Đã bán: {c.soldQty}/{c.totalQty} {c.unit}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-semibold" style={{ color: statusColor }}>{statusLabel}</span>
                                            <span style={{ fontFamily: '"DM Mono"' }}>{pct.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Right: Quota matrix */}
                <div className="col-span-7 space-y-4">
                    {!selected ? (
                        <div className="flex flex-col items-center justify-center py-20 rounded-md" style={{ border: '1px dashed #2A4355' }}>
                            <Target size={36} style={{ color: '#2A4355' }} />
                            <p className="text-sm mt-3" style={{ color: '#4A6A7A' }}>Chọn một Campaign để xem ma trận phân bổ</p>
                        </div>
                    ) : (
                        <>
                            <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: '3px solid #87CBB9' }}>
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-lg font-bold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>
                                            {selected.name}
                                        </h3>
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                            {selected.skuCode} — {selected.productName} | {new Date(selected.startDate).toLocaleDateString('vi-VN')} → {new Date(selected.endDate).toLocaleDateString('vi-VN')}
                                        </p>
                                    </div>
                                    <button onClick={() => { setAddQuotaOpen(true) }} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-semibold"
                                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                                        <Plus size={12} /> Thêm Quota
                                    </button>
                                </div>

                                {/* Summary bars */}
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div className="text-center p-2 rounded" style={{ background: '#142433' }}>
                                        <p className="text-sm font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{selected.totalQty}</p>
                                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Tổng {selected.unit}</p>
                                    </div>
                                    <div className="text-center p-2 rounded" style={{ background: '#142433' }}>
                                        <p className="text-sm font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>{selected.allocatedQty}</p>
                                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Đã phân bổ</p>
                                    </div>
                                    <div className="text-center p-2 rounded" style={{ background: '#142433' }}>
                                        <p className="text-sm font-bold" style={{ color: '#5BA88A', fontFamily: '"DM Mono"' }}>{selected.soldQty}</p>
                                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Đã bán</p>
                                    </div>
                                </div>
                            </div>

                            {/* Quota Table */}
                            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                            {['Đối tượng', 'Loại', 'Hạn mức', 'Đã bán', 'Còn lại', '% Sử dụng'].map(h => (
                                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {quotas.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>
                                                Chưa có quota — Nhấn "Thêm Quota" để phân bổ
                                            </td></tr>
                                        ) : quotas.map(q => (
                                            <tr key={q.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#E8F1F2' }}>{q.targetName}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-xs px-2 py-0.5 rounded" style={{
                                                        background: q.targetType === 'SALES_REP' ? 'rgba(74,143,171,0.15)' : 'rgba(135,203,185,0.15)',
                                                        color: q.targetType === 'SALES_REP' ? '#4A8FAB' : '#87CBB9',
                                                    }}>{q.targetType === 'SALES_REP' ? 'Sales Rep' : q.targetType === 'CUSTOMER' ? 'Khách hàng' : 'Kênh'}</span>
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>{q.qtyAllocated}</td>
                                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#5BA88A', fontFamily: '"DM Mono"' }}>{q.qtySold}</td>
                                                <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"' }}>
                                                    <span style={{ color: q.remaining <= 0 ? '#8B1A2E' : q.pctUsed > 70 ? '#D4A853' : '#5BA88A' }}>
                                                        {q.remaining}
                                                    </span>
                                                    {' '}
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{
                                                        ...(q.remaining <= 0
                                                            ? { color: '#8B1A2E', background: 'rgba(139,26,46,0.15)' }
                                                            : q.pctUsed > 70
                                                                ? { color: '#D4A853', background: 'rgba(212,168,83,0.15)' }
                                                                : { color: '#5BA88A', background: 'rgba(91,168,138,0.15)' }),
                                                    }}>
                                                        {q.remaining <= 0 ? '🔴 Hết' : q.pctUsed > 70 ? '⚠ Sắp hết' : '✅ Còn nhiều'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#142433' }}>
                                                            <div className="h-full rounded-full" style={{
                                                                width: `${Math.min(q.pctUsed, 100)}%`,
                                                                background: q.pctUsed > 90 ? '#8B1A2E' : q.pctUsed > 70 ? '#D4A853' : '#87CBB9',
                                                            }} />
                                                        </div>
                                                        <span className="text-xs font-bold" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{q.pctUsed.toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Create Campaign Drawer */}
            {createOpen && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[420px] h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                            <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>Tạo Campaign Mới</h3>
                            <button onClick={() => setCreateOpen(false)} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            {[
                                { label: 'Tên Campaign', key: 'name', type: 'text' },
                                { label: 'Tổng Số Lượng', key: 'totalQty', type: 'number' },
                                { label: 'Ngày Bắt Đầu', key: 'startDate', type: 'date' },
                                { label: 'Ngày Kết Thúc', key: 'endDate', type: 'date' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>{f.label}</label>
                                    <input type={f.type} value={(form as any)[f.key]}
                                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                                </div>
                            ))}
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Sản Phẩm</label>
                                <select value={form.productId} onChange={e => setForm(prev => ({ ...prev, productId: e.target.value }))}
                                    className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                    <option value="">— Chọn SP —</option>
                                    {options.products.map(p => <option key={p.id} value={p.id}>{p.skuCode} — {p.productName}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Đơn Vị</label>
                                <select value={form.unit} onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                                    className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                    <option value="CASE">Case</option>
                                    <option value="BOTTLE">Bottle</option>
                                </select>
                            </div>
                            <button onClick={handleCreateCampaign} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded"
                                style={{ background: '#87CBB9', color: '#0A1926' }}>
                                <Save size={14} /> Tạo Campaign
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Quota Drawer */}
            {addQuotaOpen && selected && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[420px] h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                            <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>Thêm Quota</h3>
                            <button onClick={() => setAddQuotaOpen(false)} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Campaign: <span style={{ color: '#87CBB9' }}>{selected.name}</span></p>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Loại Đối Tượng</label>
                                <select value={quotaForm.targetType}
                                    onChange={e => setQuotaForm(prev => ({ ...prev, targetType: e.target.value, targetId: '' }))}
                                    className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                    <option value="SALES_REP">Sales Rep</option>
                                    <option value="CUSTOMER">Khách hàng</option>
                                    <option value="CHANNEL">Kênh</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Đối Tượng</label>
                                <select value={quotaForm.targetId}
                                    onChange={e => setQuotaForm(prev => ({ ...prev, targetId: e.target.value }))}
                                    className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                    <option value="">— Chọn —</option>
                                    {quotaForm.targetType === 'SALES_REP' && options.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    {quotaForm.targetType === 'CUSTOMER' && options.customers.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                                    {quotaForm.targetType === 'CHANNEL' && ['HORECA', 'WHOLESALE_DISTRIBUTOR', 'VIP_RETAIL', 'DIRECT_INDIVIDUAL'].map(ch => <option key={ch} value={ch}>{ch}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Hạn Mức ({selected.unit})</label>
                                <input type="number" value={quotaForm.qtyAllocated}
                                    onChange={e => setQuotaForm(prev => ({ ...prev, qtyAllocated: e.target.value }))}
                                    className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#D4A853' }} />
                            </div>
                            <button onClick={handleAddQuota} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded"
                                style={{ background: '#87CBB9', color: '#0A1926' }}>
                                <Save size={14} /> Thêm Quota
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
