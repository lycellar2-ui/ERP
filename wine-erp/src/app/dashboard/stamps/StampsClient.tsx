'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Stamp, Plus, AlertTriangle, CheckCircle, Package, Trash2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { createStampPurchase, recordStampUsage, createStampDestruction, getStampAlerts, getStampDestructions } from './actions'
import type { StampAlert, StampDestructionRecord } from './actions'

interface StampPurchase {
    id: string
    purchaseDate: Date
    stampType: 'UNDER_20_ABV' | 'OVER_20_ABV'
    symbol: string
    serialStart: string
    serialEnd: string
    totalQty: number
    usedQty: number
    status: string
    createdAt: Date
    usages: {
        id: string
        qtyUsed: number
        qtyDamaged: number
        usedAt: Date
        shipmentId: string | null
        lotId: string | null
        notes: string | null
    }[]
}

interface StampSummary {
    under20: { total: number; used: number; remaining: number; activeBatches: number }
    over20: { total: number; used: number; remaining: number; activeBatches: number }
    all: { total: number; used: number; remaining: number; activeBatches: number }
}

interface Props {
    purchases: StampPurchase[]
    summary: StampSummary
}

// Shared style tokens
const card = {
    background: '#1A2F3F',
    border: '1px solid #2A4355',
    borderRadius: '12px',
    padding: '24px',
}

const labelStyle: React.CSSProperties = {
    color: '#6B8A99',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: '6px',
}

export default function StampsClient({ purchases, summary }: Props) {
    const router = useRouter()
    const [showAddForm, setShowAddForm] = useState(false)
    const [showUsageForm, setShowUsageForm] = useState<string | null>(null)
    const [showDestroyForm, setShowDestroyForm] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [alerts, setAlerts] = useState<StampAlert[]>([])
    const [destructions, setDestructions] = useState<StampDestructionRecord[]>([])
    const [showDestroyHistory, setShowDestroyHistory] = useState(false)

    // Load alerts & destructions on mount
    useEffect(() => {
        getStampAlerts().then(setAlerts)
        getStampDestructions().then(setDestructions)
    }, [])

    // Add stamp purchase form
    const [formData, setFormData] = useState({
        purchaseDate: new Date().toISOString().split('T')[0],
        stampType: 'UNDER_20_ABV' as 'UNDER_20_ABV' | 'OVER_20_ABV',
        symbol: '',
        serialStart: '',
        serialEnd: '',
        totalQty: 0,
    })

    // Usage form
    const [usageData, setUsageData] = useState({
        qtyUsed: 0,
        qtyDamaged: 0,
        notes: '',
    })

    // Destruction form
    const [destroyData, setDestroyData] = useState({
        qtyDestroyed: 0,
        reason: '',
        witnessName: '',
        destructionDate: new Date().toISOString().split('T')[0],
        notes: '',
    })

    async function handleAddPurchase(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        toast.promise(
            createStampPurchase(formData).then((res) => {
                setShowAddForm(false)
                setFormData({
                    purchaseDate: new Date().toISOString().split('T')[0],
                    stampType: 'UNDER_20_ABV',
                    symbol: '',
                    serialStart: '',
                    serialEnd: '',
                    totalQty: 0,
                })
                router.refresh()
                return res
            }),
            {
                loading: 'Đang lưu lô tem...',
                success: 'Đã lưu lô tem thành công!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setLoading(false)
            }
        )
    }

    async function handleRecordUsage(purchaseId: string) {
        setLoading(true)
        toast.promise(
            recordStampUsage({
                purchaseId,
                qtyUsed: usageData.qtyUsed,
                qtyDamaged: usageData.qtyDamaged,
                reportedBy: 'system', // TODO: replace with actual user ID
                notes: usageData.notes || undefined,
            }).then((res) => {
                setShowUsageForm(null)
                setUsageData({ qtyUsed: 0, qtyDamaged: 0, notes: '' })
                router.refresh()
                return res
            }),
            {
                loading: 'Đang ghi nhận dán tem...',
                success: 'Đã ghi nhận sử dụng tem!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setLoading(false)
            }
        )
    }

    async function handleDestruction(purchaseId: string) {
        if (!destroyData.reason.trim()) { toast.error('Vui lòng nhập lý do hủy tem'); return; }
        if (!destroyData.witnessName.trim()) { toast.error('Vui lòng nhập tên người chứng kiến'); return; }
        if (destroyData.qtyDestroyed <= 0) { toast.error('Số lượng hủy phải > 0'); return; }
        setLoading(true)
        toast.promise(
            createStampDestruction({ purchaseId, ...destroyData }).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi khi hủy tem')
                setShowDestroyForm(null)
                setDestroyData({ qtyDestroyed: 0, reason: '', witnessName: '', destructionDate: new Date().toISOString().split('T')[0], notes: '' })
                router.refresh()
                getStampAlerts().then(setAlerts)
                getStampDestructions().then(setDestructions)
                return res
            }),
            {
                loading: 'Đang xử lý hủy tem...',
                success: 'Đã hủy tem thành công!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setLoading(false)
            }
        )
    }

    const pct = (used: number, total: number) =>
        total > 0 ? Math.round((used / total) * 100) : 0

    return (
        <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ color: '#E8F1F2', fontSize: '28px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Stamp size={28} style={{ color: '#87CBB9' }} />
                        Quản Lý Tem Rượu Nhập Khẩu
                    </h1>
                    <p style={{ color: '#6B8A99', marginTop: '6px', fontSize: '14px' }}>
                        Theo dõi phôi tem do Bộ Tài Chính / Tổng cục Hải quan cấp phát
                    </p>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 20px', borderRadius: '8px', border: 'none',
                        background: '#87CBB9', color: '#0D1B25', fontWeight: 600,
                        cursor: 'pointer', fontSize: '14px',
                    }}
                >
                    <Plus size={16} /> Nhập Lô Tem Mới
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                {[
                    { label: 'Tem < 20° ABV', data: summary.under20, color: '#87CBB9' },
                    { label: 'Tem ≥ 20° ABV', data: summary.over20, color: '#E8A87C' },
                    { label: 'Tổng Cộng', data: summary.all, color: '#B6C9F0' },
                ].map(({ label, data, color }) => (
                    <div key={label} style={card}>
                        <p style={labelStyle}>{label}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                            <span style={{ color, fontSize: '32px', fontWeight: 700 }}>
                                {data.remaining.toLocaleString()}
                            </span>
                            <span style={{ color: '#6B8A99', fontSize: '13px' }}>
                                / {data.total.toLocaleString()} tem
                            </span>
                        </div>
                        {/* Progress bar */}
                        <div style={{ background: '#0D1B25', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                            <div style={{
                                background: pct(data.used, data.total) > 90 ? '#E85D5D' : color,
                                width: `${pct(data.used, data.total)}%`,
                                height: '100%',
                                borderRadius: '6px',
                                transition: 'width 0.5s ease',
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#6B8A99' }}>
                            <span>Đã dùng: {data.used.toLocaleString()}</span>
                            <span>{data.activeBatches} lô đang hoạt động</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Overuse Alerts Banner */}
            {alerts.length > 0 && (
                <div style={{ ...card, marginBottom: '24px', borderColor: alerts.some(a => a.severity === 'CRITICAL') ? '#E85D5D' : '#E8A87C' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <ShieldAlert size={18} style={{ color: alerts.some(a => a.severity === 'CRITICAL') ? '#E85D5D' : '#E8A87C' }} />
                        <h3 style={{ color: '#E8F1F2', margin: 0, fontSize: '15px', fontWeight: 600 }}>
                            Cảnh Báo Tem ({alerts.length})
                        </h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {alerts.map(a => (
                            <div key={a.id} style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '10px 14px', borderRadius: '8px',
                                background: a.severity === 'CRITICAL' ? 'rgba(232,93,93,0.08)' : 'rgba(232,168,124,0.08)',
                                border: `1px solid ${a.severity === 'CRITICAL' ? 'rgba(232,93,93,0.25)' : 'rgba(232,168,124,0.25)'}`,
                            }}>
                                <AlertTriangle size={14} style={{ color: a.severity === 'CRITICAL' ? '#E85D5D' : '#E8A87C', flexShrink: 0 }} />
                                <span style={{ color: a.severity === 'CRITICAL' ? '#E85D5D' : '#E8A87C', fontSize: '13px', flex: 1 }}>
                                    {a.message}
                                </span>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
                                    background: a.severity === 'CRITICAL' ? 'rgba(232,93,93,0.2)' : 'rgba(232,168,124,0.2)',
                                    color: a.severity === 'CRITICAL' ? '#E85D5D' : '#E8A87C',
                                }}>
                                    {a.severity}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Add Stamp Form */}
            {showAddForm && (
                <div style={{ ...card, marginBottom: '24px', borderColor: '#87CBB9' }}>
                    <h3 style={{ color: '#E8F1F2', margin: '0 0 20px', fontSize: '16px' }}>
                        📋 Nhập Lô Tem Từ Cơ Quan Thuế
                    </h3>
                    <form onSubmit={handleAddPurchase} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>Ngày Mua</label>
                            <input
                                type="date"
                                value={formData.purchaseDate}
                                onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                                required
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Loại Tem</label>
                            <select
                                value={formData.stampType}
                                onChange={e => setFormData({ ...formData, stampType: e.target.value as 'UNDER_20_ABV' | 'OVER_20_ABV' })}
                                style={inputStyle}
                            >
                                <option value="UNDER_20_ABV">Dưới 20° ABV</option>
                                <option value="OVER_20_ABV">Từ 20° ABV trở lên</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Ký Hiệu Tem</label>
                            <input
                                placeholder="VD: AA/20P"
                                value={formData.symbol}
                                onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                                required
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Seri Bắt Đầu</label>
                            <input
                                placeholder="VD: 000001"
                                value={formData.serialStart}
                                onChange={e => setFormData({ ...formData, serialStart: e.target.value })}
                                required
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Seri Kết Thúc</label>
                            <input
                                placeholder="VD: 005000"
                                value={formData.serialEnd}
                                onChange={e => setFormData({ ...formData, serialEnd: e.target.value })}
                                required
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Tổng Số Lượng</label>
                            <input
                                type="number"
                                min={1}
                                value={formData.totalQty || ''}
                                onChange={e => setFormData({ ...formData, totalQty: parseInt(e.target.value) || 0 })}
                                required
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ gridColumn: 'span 3', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                style={{ ...btnSecondary }}
                            >
                                Hủy
                            </button>
                            <button type="submit" disabled={loading} style={{ ...btnPrimary }}>
                                {loading ? 'Đang lưu...' : 'Lưu Lô Tem'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Stamp Batches Table */}
            <div style={card}>
                <h3 style={{ color: '#E8F1F2', margin: '0 0 20px', fontSize: '16px' }}>
                    📦 Danh Sách Lô Tem Đã Nhập
                </h3>

                {purchases.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: '#6B8A99' }}>
                        <Package size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                        <p>Chưa có lô tem nào. Bấm &quot;Nhập Lô Tem Mới&quot; để bắt đầu.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #2A4355' }}>
                                {['Ngày Mua', 'Loại', 'Ký Hiệu', 'Seri', 'Tổng', 'Đã Dùng', 'Còn Lại', 'Trạng Thái', ''].map(h => (
                                    <th key={h} style={{ ...thStyle }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.map((p) => {
                                const remaining = p.totalQty - p.usedQty
                                const isLow = remaining < p.totalQty * 0.1 && remaining > 0
                                const isExhaust = remaining <= 0

                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid #1E3344' }}>
                                        <td style={tdStyle}>
                                            {new Date(p.purchaseDate).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                                                background: p.stampType === 'UNDER_20_ABV' ? 'rgba(135,203,185,0.15)' : 'rgba(232,168,124,0.15)',
                                                color: p.stampType === 'UNDER_20_ABV' ? '#87CBB9' : '#E8A87C',
                                            }}>
                                                {p.stampType === 'UNDER_20_ABV' ? '< 20°' : '≥ 20°'}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, fontWeight: 600, color: '#E8F1F2' }}>{p.symbol}</td>
                                        <td style={{ ...tdStyle, fontSize: '12px', fontFamily: 'monospace' }}>
                                            {p.serialStart} → {p.serialEnd}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>{p.totalQty.toLocaleString()}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>{p.usedQty.toLocaleString()}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: isExhaust ? '#E85D5D' : isLow ? '#E8A87C' : '#87CBB9' }}>
                                            {remaining.toLocaleString()}
                                        </td>
                                        <td style={tdStyle}>
                                            {isExhaust ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#E85D5D', fontSize: '12px' }}>
                                                    <AlertTriangle size={14} /> Hết tem
                                                </span>
                                            ) : isLow ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#E8A87C', fontSize: '12px' }}>
                                                    <AlertTriangle size={14} /> Sắp hết
                                                </span>
                                            ) : (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#87CBB9', fontSize: '12px' }}>
                                                    <CheckCircle size={14} /> Đang dùng
                                                </span>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {!isExhaust && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setShowUsageForm(showUsageForm === p.id ? null : p.id) }}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '6px', border: '1px solid #2A4355',
                                                            background: 'transparent', color: '#87CBB9', cursor: 'pointer', fontSize: '12px',
                                                        }}
                                                    >
                                                        Ghi Nhận Dán
                                                    </button>
                                                )}
                                                {!isExhaust && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setShowDestroyForm(showDestroyForm === p.id ? null : p.id) }}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(232,93,93,0.3)',
                                                            background: 'transparent', color: '#E85D5D', cursor: 'pointer', fontSize: '12px',
                                                            display: 'flex', alignItems: 'center', gap: '4px',
                                                        }}
                                                    >
                                                        <Trash2 size={12} /> Hủy Tem
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Usage Recording Modal */}
            {showUsageForm && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
                }}
                    onClick={() => setShowUsageForm(null)}
                >
                    <div
                        style={{ ...card, width: '480px', borderColor: '#87CBB9' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ color: '#E8F1F2', margin: '0 0 20px' }}>🏷️ Ghi Nhận Sử Dụng Tem</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Số Lượng Dán</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={usageData.qtyUsed || ''}
                                    onChange={e => setUsageData({ ...usageData, qtyUsed: parseInt(e.target.value) || 0 })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Số Lượng Hỏng / Mất</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={usageData.qtyDamaged || ''}
                                    onChange={e => setUsageData({ ...usageData, qtyDamaged: parseInt(e.target.value) || 0 })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Ghi Chú</label>
                                <textarea
                                    value={usageData.notes}
                                    onChange={e => setUsageData({ ...usageData, notes: e.target.value })}
                                    placeholder="VD: Dán cho lô hàng container MAEU123..."
                                    rows={3}
                                    style={{ ...inputStyle, resize: 'vertical' as const }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowUsageForm(null)} style={btnSecondary}>Hủy</button>
                                <button
                                    onClick={() => handleRecordUsage(showUsageForm)}
                                    disabled={loading || (usageData.qtyUsed === 0 && usageData.qtyDamaged === 0)}
                                    style={btnPrimary}
                                >
                                    {loading ? 'Đang lưu...' : 'Xác Nhận'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Destruction Modal */}
            {showDestroyForm && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
                }}
                    onClick={() => setShowDestroyForm(null)}
                >
                    <div
                        style={{ ...card, width: '520px', borderColor: '#E85D5D' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ color: '#E8F1F2', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Trash2 size={18} style={{ color: '#E85D5D' }} /> Biên Bản Hủy Tem
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                <div>
                                    <label style={labelStyle}>Số Lượng Hủy *</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={destroyData.qtyDestroyed || ''}
                                        onChange={e => setDestroyData({ ...destroyData, qtyDestroyed: parseInt(e.target.value) || 0 })}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Ngày Hủy *</label>
                                    <input
                                        type="date"
                                        value={destroyData.destructionDate}
                                        onChange={e => setDestroyData({ ...destroyData, destructionDate: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Lý Do Hủy Tem *</label>
                                <input
                                    value={destroyData.reason}
                                    onChange={e => setDestroyData({ ...destroyData, reason: e.target.value })}
                                    placeholder="VD: Tem bị rách, ẩm mốc, in sai lỗi..."
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Người Chứng Kiến *</label>
                                <input
                                    value={destroyData.witnessName}
                                    onChange={e => setDestroyData({ ...destroyData, witnessName: e.target.value })}
                                    placeholder="Họ tên người chứng kiến hủy tem"
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Ghi Chú</label>
                                <textarea
                                    value={destroyData.notes}
                                    onChange={e => setDestroyData({ ...destroyData, notes: e.target.value })}
                                    placeholder="Ghi chú thêm (không bắt buộc)"
                                    rows={2}
                                    style={{ ...inputStyle, resize: 'vertical' as const }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowDestroyForm(null)} style={btnSecondary}>Hủy</button>
                                <button
                                    onClick={() => handleDestruction(showDestroyForm)}
                                    disabled={loading}
                                    style={{ ...btnPrimary, background: '#E85D5D' }}
                                >
                                    {loading ? 'Đang xử lý...' : '🗑️ Xác Nhận Hủy Tem'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Destruction History */}
            {destructions.length > 0 && (
                <div style={{ ...card, marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ color: '#E8F1F2', margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Trash2 size={16} style={{ color: '#E85D5D' }} /> Lịch Sử Hủy Tem ({destructions.length})
                        </h3>
                        <button onClick={() => setShowDestroyHistory(!showDestroyHistory)}
                            style={{ ...btnSecondary, padding: '5px 12px', fontSize: '12px' }}>
                            {showDestroyHistory ? 'Thu gọn' : 'Xem chi tiết'}
                        </button>
                    </div>
                    {showDestroyHistory && (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #2A4355' }}>
                                    {['Ngày Hủy', 'Lô Tem', 'SL Hủy', 'Lý Do', 'Chứng Kiến'].map(h => (
                                        <th key={h} style={{ ...thStyle }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {destructions.map(d => (
                                    <tr key={d.id} style={{ borderBottom: '1px solid #1E3344' }}>
                                        <td style={tdStyle}>{new Date(d.destructionDate).toLocaleDateString('vi-VN')}</td>
                                        <td style={{ ...tdStyle, fontWeight: 600, color: '#E8F1F2' }}>{d.purchaseSymbol}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', color: '#E85D5D', fontWeight: 600 }}>{d.qtyDestroyed.toLocaleString()}</td>
                                        <td style={{ ...tdStyle, maxWidth: '200px' }}>{d.reason}</td>
                                        <td style={tdStyle}>{d.witnessName}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    )
}

// Shared inline styles
const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #2A4355',
    background: '#0D1B25',
    color: '#E8F1F2',
    fontSize: '14px',
    outline: 'none',
}

const btnPrimary: React.CSSProperties = {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    background: '#87CBB9',
    color: '#0D1B25',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '14px',
}

const btnSecondary: React.CSSProperties = {
    padding: '10px 24px',
    borderRadius: '8px',
    border: '1px solid #2A4355',
    background: 'transparent',
    color: '#8AAEBB',
    cursor: 'pointer',
    fontSize: '14px',
}

const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px',
    color: '#6B8A99',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
}

const tdStyle: React.CSSProperties = {
    padding: '12px',
    color: '#8AAEBB',
    fontSize: '14px',
}
