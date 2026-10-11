'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
    Stamp, Plus, AlertTriangle, CheckCircle, Package, Trash2,
    ShieldAlert, BookOpen, Download, Search, Filter, RefreshCw,
    Ship, Warehouse, FileSpreadsheet, ArrowRight, Info
} from 'lucide-react'
import { toast } from 'sonner'
import {
    createStampPurchase,
    safeRecordStampUsage,
    createStampDestruction,
    getStampAlerts,
    getStampDestructions,
    getStampLogbook,
    exportStampLogbookExcel,
    exportStampReportExcel,
} from './actions'
import { PageHeader, Button } from '@/components/ui'
import type { StampAlert, StampDestructionRecord, StampLogbookEntry } from './actions'

interface StampUsageItem {
    id: string
    serialStart: string | null
    serialEnd: string | null
    qtyUsed: number
    qtyDamaged: number
    usedAt: Date | string
    shipmentId: string | null
    lotId: string | null
    notes: string | null
    shipment?: { id: string; billOfLading: string } | null
    lot?: { id: string; lotNo: string; product: { skuCode: string; productName: string } } | null
    reporter?: { id: string; name: string } | null
}

interface StampPurchase {
    id: string
    purchaseDate: Date | string
    stampType: 'UNDER_20_ABV' | 'OVER_20_ABV'
    symbol: string
    serialStart: string
    serialEnd: string
    totalQty: number
    usedQty: number
    status: string
    createdAt: Date | string
    usages: StampUsageItem[]
}

interface StampSummary {
    under20: { total: number; used: number; remaining: number; activeBatches: number }
    over20: { total: number; used: number; remaining: number; activeBatches: number }
    all: { total: number; used: number; remaining: number; activeBatches: number }
}

interface LinkingOptions {
    shipments: { id: string; billOfLading: string; status: string; vesselName?: string | null }[]
    lots: { id: string; lotNo: string; qtyAvailable: any; product: { skuCode: string; productName: string } }[]
}

interface Props {
    purchases: StampPurchase[]
    summary: StampSummary
    linkingOptions?: LinkingOptions
    initialLogbook?: StampLogbookEntry[]
}

const cardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '24px',
}

const labelStyle: React.CSSProperties = {
    color: '#64748B',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '6px',
    display: 'block',
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #CBD5E1',
    background: '#FFFFFF',
    color: '#0F172A',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
}

const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '12px 14px',
    color: '#475569',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: '#F8FAFC',
}

const tdStyle: React.CSSProperties = {
    padding: '12px 14px',
    color: '#334155',
    fontSize: '13px',
    verticalAlign: 'middle',
}

export default function StampsClient({ purchases, summary, linkingOptions, initialLogbook = [] }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Navigation Tabs
    const [activeTab, setActiveTab] = useState<'batches' | 'logbook' | 'destructions'>('batches')

    // Modals
    const [showAddForm, setShowAddForm] = useState(false)
    const [usageTargetPurchase, setUsageTargetPurchase] = useState<StampPurchase | null>(null)
    const [destroyTargetPurchase, setDestroyTargetPurchase] = useState<StampPurchase | null>(null)
    const [loading, setLoading] = useState(false)

    // Alerts & Destructions & Logbook
    const [alerts, setAlerts] = useState<StampAlert[]>([])
    const [destructions, setDestructions] = useState<StampDestructionRecord[]>([])
    const [logbookEntries, setLogbookEntries] = useState<StampLogbookEntry[]>(initialLogbook)
    const [logbookLoading, setLogbookLoading] = useState(false)
    const [exportingLogbook, setExportingLogbook] = useState(false)

    // Logbook filters
    const currentYear = new Date().getFullYear()
    const [logYear, setLogYear] = useState<number>(currentYear)
    const [logQuarter, setLogQuarter] = useState<number>(0)
    const [logStampType, setLogStampType] = useState<'ALL' | 'UNDER_20_ABV' | 'OVER_20_ABV'>('ALL')
    const [logSearch, setLogSearch] = useState<string>('')

    useEffect(() => {
        getStampAlerts().then(setAlerts)
        getStampDestructions().then(setDestructions)
    }, [])

    // Fetch logbook when filters change
    const fetchLogbook = async () => {
        setLogbookLoading(true)
        try {
            const data = await getStampLogbook({
                year: logYear || undefined,
                quarter: logQuarter > 0 ? logQuarter : undefined,
                stampType: logStampType,
                search: logSearch || undefined,
            })
            setLogbookEntries(data)
        } catch (err: any) {
            toast.error(`Lỗi tải sổ tem: ${err.message}`)
        } finally {
            setLogbookLoading(false)
        }
    }

    // Add stamp purchase form state
    const [formData, setFormData] = useState({
        purchaseDate: new Date().toISOString().split('T')[0],
        stampType: 'UNDER_20_ABV' as 'UNDER_20_ABV' | 'OVER_20_ABV',
        symbol: '',
        serialStart: '',
        serialEnd: '',
        totalQty: 0,
    })

    // Usage & Allocation form state
    const [usageData, setUsageData] = useState({
        targetType: 'NONE' as 'NONE' | 'SHIPMENT' | 'STOCK_LOT',
        shipmentId: '',
        lotId: '',
        serialStart: '',
        serialEnd: '',
        qtyUsed: 0,
        qtyDamaged: 0,
        notes: '',
    })

    // Destruction form state
    const [destroyData, setDestroyData] = useState({
        qtyDestroyed: 0,
        reason: '',
        witnessName: '',
        destructionDate: new Date().toISOString().split('T')[0],
        notes: '',
    })

    async function handleAddPurchase(e: React.FormEvent) {
        e.preventDefault()
        if (formData.totalQty <= 0) {
            toast.error('Số lượng tem phải lớn hơn 0')
            return
        }
        setLoading(true)
        try {
            await createStampPurchase(formData)
            toast.success('Đã lưu lô tem thành công')
            setShowAddForm(false)
            setFormData({
                purchaseDate: new Date().toISOString().split('T')[0],
                stampType: 'UNDER_20_ABV',
                symbol: '',
                serialStart: '',
                serialEnd: '',
                totalQty: 0,
            })
            startTransition(() => {
                router.refresh()
            })
            fetchLogbook()
        } catch (err: any) {
            toast.error(`Lỗi lưu lô tem: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    async function handleRecordUsage(e: React.FormEvent) {
        e.preventDefault()
        if (!usageTargetPurchase) return
        if (usageData.qtyUsed <= 0 && usageData.qtyDamaged <= 0) {
            toast.error('Vui lòng nhập số lượng tem dán hoặc số lượng tem hỏng > 0')
            return
        }

        const remaining = usageTargetPurchase.totalQty - usageTargetPurchase.usedQty
        if (usageData.qtyUsed + usageData.qtyDamaged > remaining) {
            toast.error(`Vượt quá tồn kho tem khả dụng (${remaining.toLocaleString()} tem)`)
            return
        }

        setLoading(true)
        try {
            const res = await safeRecordStampUsage({
                purchaseId: usageTargetPurchase.id,
                shipmentId: usageData.targetType === 'SHIPMENT' ? usageData.shipmentId : undefined,
                lotId: usageData.targetType === 'STOCK_LOT' ? usageData.lotId : undefined,
                serialStart: usageData.serialStart || undefined,
                serialEnd: usageData.serialEnd || undefined,
                qtyUsed: usageData.qtyUsed,
                qtyDamaged: usageData.qtyDamaged,
                notes: usageData.notes || undefined,
            })

            if (!res.success) {
                throw new Error(res.error || 'Lỗi khi ghi nhận sử dụng tem')
            }

            toast.success('Đã ghi nhận cấp phát và dán tem thành công')
            setUsageTargetPurchase(null)
            setUsageData({
                targetType: 'NONE',
                shipmentId: '',
                lotId: '',
                serialStart: '',
                serialEnd: '',
                qtyUsed: 0,
                qtyDamaged: 0,
                notes: '',
            })
            startTransition(() => {
                router.refresh()
            })
            fetchLogbook()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleDestruction(e: React.FormEvent) {
        e.preventDefault()
        if (!destroyTargetPurchase) return
        if (!destroyData.reason.trim()) {
            toast.error('Vui lòng nhập lý do hủy tem')
            return
        }
        if (!destroyData.witnessName.trim()) {
            toast.error('Vui lòng nhập tên người chứng kiến')
            return
        }
        if (destroyData.qtyDestroyed <= 0) {
            toast.error('Số lượng hủy phải lớn hơn 0')
            return
        }

        setLoading(true)
        try {
            const res = await createStampDestruction({
                purchaseId: destroyTargetPurchase.id,
                ...destroyData,
            })

            if (!res.success) {
                throw new Error(res.error || 'Lỗi khi lập biên bản hủy tem')
            }

            toast.success('Đã tạo biên bản hủy tem thành công')
            setDestroyTargetPurchase(null)
            setDestroyData({
                qtyDestroyed: 0,
                reason: '',
                witnessName: '',
                destructionDate: new Date().toISOString().split('T')[0],
                notes: '',
            })
            startTransition(() => {
                router.refresh()
            })
            getStampAlerts().then(setAlerts)
            getStampDestructions().then(setDestructions)
            fetchLogbook()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleExportLogbook() {
        setExportingLogbook(true)
        try {
            const res = await exportStampLogbookExcel({
                year: logYear || undefined,
                quarter: logQuarter > 0 ? logQuarter : undefined,
                stampType: logStampType,
                search: logSearch || undefined,
            })

            if (!res.success || !res.base64 || !res.filename) {
                throw new Error(res.error || 'Lỗi tạo file Excel')
            }

            const link = document.createElement('a')
            link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`
            link.download = res.filename
            link.click()
            toast.success('Đã xuất file Sổ Theo Dõi Tem thành công')
        } catch (err: any) {
            toast.error(`Xuất Excel thất bại: ${err.message}`)
        } finally {
            setExportingLogbook(false)
        }
    }

    const pct = (used: number, total: number) =>
        total > 0 ? Math.round((used / total) * 100) : 0

    return (
        <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
            {/* Header */}
            <PageHeader
                title="Quản Lý & Phân Bổ Tem Rượu"
                description="Quản lý phôi tem, dải số seri, sổ theo dõi tem điện tử theo Nghị định 105/2017 & Thông tư 23/2021"
                actions={
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleExportLogbook}
                            disabled={exportingLogbook}
                        >
                            <FileSpreadsheet size={14} style={{ marginRight: '6px' }} />
                            {exportingLogbook ? 'Đang xuất...' : 'Xuất Excel Sổ Tem'}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setShowAddForm(!showAddForm)}
                        >
                            <Plus size={14} style={{ marginRight: '6px' }} />
                            Nhập Lô Tem Mới
                        </Button>
                    </div>
                }
            />

            {/* Navigation Tabs */}
            <div style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '1px solid #E2E8F0',
                marginBottom: '24px',
                paddingBottom: '2px',
            }}>
                <button
                    onClick={() => setActiveTab('batches')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 18px',
                        border: 'none',
                        background: 'transparent',
                        borderBottom: activeTab === 'batches' ? '2px solid #0891B2' : '2px solid transparent',
                        color: activeTab === 'batches' ? '#0891B2' : '#64748B',
                        fontWeight: activeTab === 'batches' ? 600 : 500,
                        fontSize: '13px',
                        cursor: 'pointer',
                    }}
                >
                    <Package size={15} />
                    Lô Tem Khả Dụng & Cấp Phát ({purchases.length})
                </button>
                <button
                    onClick={() => {
                        setActiveTab('logbook')
                        if (logbookEntries.length === 0) fetchLogbook()
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 18px',
                        border: 'none',
                        background: 'transparent',
                        borderBottom: activeTab === 'logbook' ? '2px solid #0891B2' : '2px solid transparent',
                        color: activeTab === 'logbook' ? '#0891B2' : '#64748B',
                        fontWeight: activeTab === 'logbook' ? 600 : 500,
                        fontSize: '13px',
                        cursor: 'pointer',
                    }}
                >
                    <BookOpen size={15} />
                    Sổ Theo Dõi Tem Điện Tử (Logbook)
                </button>
                <button
                    onClick={() => setActiveTab('destructions')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 18px',
                        border: 'none',
                        background: 'transparent',
                        borderBottom: activeTab === 'destructions' ? '2px solid #0891B2' : '2px solid transparent',
                        color: activeTab === 'destructions' ? '#0891B2' : '#64748B',
                        fontWeight: activeTab === 'destructions' ? 600 : 500,
                        fontSize: '13px',
                        cursor: 'pointer',
                    }}
                >
                    <Trash2 size={15} />
                    Biên Bản Hủy Tem ({destructions.length})
                </button>
            </div>

            {/* TAB 1: BATCHES & ALLOCATION */}
            {activeTab === 'batches' && (
                <div>
                    {/* Summary KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
                        {[
                            { label: 'Tem Dưới 20° ABV (Vang thông dụng)', data: summary.under20, color: '#0891B2' },
                            { label: 'Tem Từ 20° ABV Trở Lên (Mạnh / Fortified)', data: summary.over20, color: '#D97706' },
                            { label: 'Tổng Cộng Tất Cả Phôi Tem', data: summary.all, color: '#1E293B' },
                        ].map(({ label, data, color }) => (
                            <div key={label} style={cardStyle}>
                                <p style={labelStyle}>{label}</p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                                    <span style={{ color, fontSize: '28px', fontWeight: 700 }}>
                                        {data.remaining.toLocaleString('vi-VN')}
                                    </span>
                                    <span style={{ color: '#64748B', fontSize: '13px' }}>
                                        / {data.total.toLocaleString('vi-VN')} tem
                                    </span>
                                </div>
                                <div style={{ background: '#F1F5F9', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                                    <div style={{
                                        background: pct(data.used, data.total) > 90 ? '#B91C1C' : color,
                                        width: `${pct(data.used, data.total)}%`,
                                        height: '100%',
                                        borderRadius: '4px',
                                        transition: 'width 0.4s ease',
                                    }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px', color: '#64748B' }}>
                                    <span>Đã dùng: {data.used.toLocaleString('vi-VN')}</span>
                                    <span>{data.activeBatches} lô đang hoạt động</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Alerts Banner */}
                    {alerts.length > 0 && (
                        <div style={{
                            ...cardStyle,
                            marginBottom: '24px',
                            borderColor: alerts.some(a => a.severity === 'CRITICAL') ? '#FCA5A5' : '#FDE68A',
                            background: alerts.some(a => a.severity === 'CRITICAL') ? '#FEF2F2' : '#FFFBEB',
                            padding: '16px 20px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <ShieldAlert size={18} style={{ color: alerts.some(a => a.severity === 'CRITICAL') ? '#B91C1C' : '#D97706' }} />
                                <h4 style={{ color: '#0F172A', margin: 0, fontSize: '14px', fontWeight: 600 }}>
                                    Cảnh Báo Tồn Kho Tem ({alerts.length})
                                </h4>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {alerts.map(a => (
                                    <div key={a.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '8px 12px', borderRadius: '6px',
                                        background: '#FFFFFF',
                                        border: '1px solid #E2E8F0',
                                        fontSize: '13px',
                                    }}>
                                        <AlertTriangle size={14} style={{ color: a.severity === 'CRITICAL' ? '#B91C1C' : '#D97706' }} />
                                        <span style={{ color: '#1E293B', flex: 1 }}>{a.message}</span>
                                        <span style={{
                                            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                                            background: a.severity === 'CRITICAL' ? '#FEE2E2' : '#FEF3C7',
                                            color: a.severity === 'CRITICAL' ? '#991B1B' : '#92400E',
                                        }}>
                                            {a.severity === 'CRITICAL' ? 'Nghiêm trọng' : 'Cảnh báo'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add Stamp Purchase Form */}
                    {showAddForm && (
                        <div style={{ ...cardStyle, marginBottom: '24px', borderColor: '#0891B2' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                                <h3 style={{ color: '#0F172A', margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Stamp size={16} style={{ color: '#0891B2' }} />
                                    Khai Báo Lô Tem Mua Từ Cơ Quan Thuế / Hải Quan
                                </h3>
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    style={{ border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: '13px' }}
                                >
                                    Đóng
                                </button>
                            </div>
                            <form onSubmit={handleAddPurchase} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                <div>
                                    <label style={labelStyle}>Ngày Mua Chứng Từ *</label>
                                    <input
                                        type="date"
                                        value={formData.purchaseDate}
                                        onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Phân Loại Nồng Độ Cồn *</label>
                                    <select
                                        value={formData.stampType}
                                        onChange={e => setFormData({ ...formData, stampType: e.target.value as any })}
                                        style={inputStyle}
                                    >
                                        <option value="UNDER_20_ABV">Rượu dưới 20° ABV (Vang nổ, vang chát thông thường)</option>
                                        <option value="OVER_20_ABV">Rượu từ 20° ABV trở lên (Rượu mạnh, vang cường hóa)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Ký Hiệu Tem (Symbol) *</label>
                                    <input
                                        placeholder="Ví dụ: AA/20P hoặc NK/24"
                                        value={formData.symbol}
                                        onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Seri Bắt Đầu *</label>
                                    <input
                                        placeholder="Ví dụ: 000001"
                                        value={formData.serialStart}
                                        onChange={e => setFormData({ ...formData, serialStart: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Seri Kết Thúc *</label>
                                    <input
                                        placeholder="Ví dụ: 005000"
                                        value={formData.serialEnd}
                                        onChange={e => setFormData({ ...formData, serialEnd: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Tổng Số Lượng Tem *</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={formData.totalQty || ''}
                                        onChange={e => setFormData({ ...formData, totalQty: parseInt(e.target.value) || 0 })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ gridColumn: 'span 3', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>
                                        Hủy
                                    </Button>
                                    <Button type="submit" variant="primary" size="sm" disabled={loading}>
                                        {loading ? 'Đang lưu...' : 'Lưu Lô Tem Vào Kho'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Stamp Batches Table */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ color: '#0F172A', margin: 0, fontSize: '15px', fontWeight: 600 }}>
                                Danh Sách Lô Tem Đang Quản Lý
                            </h3>
                            <span style={{ fontSize: '12px', color: '#64748B' }}>
                                Tổng: {purchases.length} đợt cấp phát
                            </span>
                        </div>

                        {purchases.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B' }}>
                                <Package size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                <p>Chưa có dữ liệu lô tem nào. Nhấn &quot;Nhập Lô Tem Mới&quot; để thêm.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #CBD5E1' }}>
                                            <th style={thStyle}>Ngày Mua</th>
                                            <th style={thStyle}>Phân Loại</th>
                                            <th style={thStyle}>Ký Hiệu</th>
                                            <th style={thStyle}>Dải Seri Khai Báo</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Tổng Số</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Đã Dán</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Còn Lại</th>
                                            <th style={thStyle}>Trạng Thái</th>
                                            <th style={{ ...thStyle, textAlign: 'center' }}>Thao Tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {purchases.map(p => {
                                            const remaining = p.totalQty - p.usedQty
                                            const isExhaust = remaining <= 0
                                            const isLow = remaining > 0 && remaining < p.totalQty * 0.15

                                            return (
                                                <tr key={p.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                                    <td style={tdStyle}>
                                                        {new Date(p.purchaseDate).toLocaleDateString('vi-VN')}
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <span style={{
                                                            padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500,
                                                            background: p.stampType === 'UNDER_20_ABV' ? '#E0F2FE' : '#FEF3C7',
                                                            color: p.stampType === 'UNDER_20_ABV' ? '#0369A1' : '#B45309',
                                                        }}>
                                                            {p.stampType === 'UNDER_20_ABV' ? '< 20° ABV' : '≥ 20° ABV'}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...tdStyle, fontWeight: 600, color: '#0F172A' }}>
                                                        {p.symbol}
                                                    </td>
                                                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#475569' }}>
                                                        {p.serialStart} → {p.serialEnd}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                        {p.totalQty.toLocaleString('vi-VN')}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', color: '#64748B' }}>
                                                        {p.usedQty.toLocaleString('vi-VN')}
                                                    </td>
                                                    <td style={{
                                                        ...tdStyle, textAlign: 'right', fontWeight: 600,
                                                        color: isExhaust ? '#B91C1C' : isLow ? '#D97706' : '#0891B2'
                                                    }}>
                                                        {remaining.toLocaleString('vi-VN')}
                                                    </td>
                                                    <td style={tdStyle}>
                                                        {isExhaust ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#B91C1C', fontSize: '12px' }}>
                                                                <AlertTriangle size={13} /> Đã hết tem
                                                            </span>
                                                        ) : isLow ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#D97706', fontSize: '12px' }}>
                                                                <AlertTriangle size={13} /> Sắp hết
                                                            </span>
                                                        ) : (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0891B2', fontSize: '12px' }}>
                                                                <CheckCircle size={13} /> Khả dụng
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                            {!isExhaust && (
                                                                <button
                                                                    onClick={() => {
                                                                        setUsageTargetPurchase(p)
                                                                        setUsageData({
                                                                            targetType: 'NONE',
                                                                            shipmentId: '',
                                                                            lotId: '',
                                                                            serialStart: '',
                                                                            serialEnd: '',
                                                                            qtyUsed: 0,
                                                                            qtyDamaged: 0,
                                                                            notes: '',
                                                                        })
                                                                    }}
                                                                    style={{
                                                                        padding: '4px 10px',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid #0891B2',
                                                                        background: '#F0FDFA',
                                                                        color: '#0891B2',
                                                                        fontSize: '12px',
                                                                        fontWeight: 500,
                                                                        cursor: 'pointer',
                                                                    }}
                                                                >
                                                                    Phân & Dán Tem
                                                                </button>
                                                            )}
                                                            {!isExhaust && (
                                                                <button
                                                                    onClick={() => {
                                                                        setDestroyTargetPurchase(p)
                                                                        setDestroyData({
                                                                            qtyDestroyed: 0,
                                                                            reason: '',
                                                                            witnessName: '',
                                                                            destructionDate: new Date().toISOString().split('T')[0],
                                                                            notes: '',
                                                                        })
                                                                    }}
                                                                    style={{
                                                                        padding: '4px 10px',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid #FCA5A5',
                                                                        background: '#FEF2F2',
                                                                        color: '#B91C1C',
                                                                        fontSize: '12px',
                                                                        cursor: 'pointer',
                                                                    }}
                                                                >
                                                                    Hủy Tem
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: ELECTRONIC LOGBOOK */}
            {activeTab === 'logbook' && (
                <div>
                    {/* Logbook Filters Bar */}
                    <div style={{
                        ...cardStyle,
                        marginBottom: '20px',
                        padding: '16px 20px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Filter size={14} style={{ color: '#64748B' }} />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Bộ lọc:</span>
                            </div>

                            {/* Year select */}
                            <select
                                value={logYear}
                                onChange={e => setLogYear(parseInt(e.target.value))}
                                style={{ ...inputStyle, width: '110px' }}
                            >
                                {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(y => (
                                    <option key={y} value={y}>Năm {y}</option>
                                ))}
                            </select>

                            {/* Quarter select */}
                            <select
                                value={logQuarter}
                                onChange={e => setLogQuarter(parseInt(e.target.value))}
                                style={{ ...inputStyle, width: '130px' }}
                            >
                                <option value={0}>Cả năm</option>
                                <option value={1}>Quý 1 (T1 - T3)</option>
                                <option value={2}>Quý 2 (T4 - T6)</option>
                                <option value={3}>Quý 3 (T7 - T9)</option>
                                <option value={4}>Quý 4 (T10 - T12)</option>
                            </select>

                            {/* Stamp Type select */}
                            <select
                                value={logStampType}
                                onChange={e => setLogStampType(e.target.value as any)}
                                style={{ ...inputStyle, width: '160px' }}
                            >
                                <option value="ALL">Tất cả nồng độ cồn</option>
                                <option value="UNDER_20_ABV">Tem &lt; 20° ABV</option>
                                <option value="OVER_20_ABV">Tem ≥ 20° ABV</option>
                            </select>

                            {/* Search input */}
                            <div style={{ position: 'relative', width: '240px' }}>
                                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                                <input
                                    type="text"
                                    placeholder="Tìm ký hiệu, seri, vận đơn..."
                                    value={logSearch}
                                    onChange={e => setLogSearch(e.target.value)}
                                    style={{ ...inputStyle, paddingLeft: '32px' }}
                                />
                            </div>

                            <Button variant="secondary" size="sm" onClick={fetchLogbook} disabled={logbookLoading}>
                                <RefreshCw size={13} style={{ marginRight: '4px' }} className={logbookLoading ? 'animate-spin' : ''} />
                                Lọc
                            </Button>
                        </div>

                        <div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleExportLogbook}
                                disabled={exportingLogbook}
                            >
                                <FileSpreadsheet size={14} style={{ marginRight: '6px' }} />
                                {exportingLogbook ? 'Đang xuất...' : 'Tải File Excel Sổ Tem'}
                            </Button>
                        </div>
                    </div>

                    {/* Logbook Table */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <h3 style={{ color: '#0F172A', margin: 0, fontSize: '15px', fontWeight: 600 }}>
                                    Sổ Theo Dõi Sử Dụng Tem Rượu Nhập Khẩu
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                                    Theo dõi lưu vết nhập, xuất dán, hủy hỏng và dải số seri theo Thông tư 23/2021/TT-BTC
                                </p>
                            </div>
                            <span style={{ fontSize: '12px', color: '#64748B' }}>
                                Hiển thị {logbookEntries.length} giao dịch ghi sổ
                            </span>
                        </div>

                        {logbookEntries.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B' }}>
                                <BookOpen size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                <p>Chưa có giao dịch ghi sổ nào phù hợp với bộ lọc.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #CBD5E1' }}>
                                            <th style={thStyle}>STT</th>
                                            <th style={thStyle}>Ngày CT</th>
                                            <th style={thStyle}>Nghiệp Vụ</th>
                                            <th style={thStyle}>Ký Hiệu</th>
                                            <th style={thStyle}>Loại Tem</th>
                                            <th style={thStyle}>Dải Seri Bắt Đầu</th>
                                            <th style={thStyle}>Dải Seri Kết Thúc</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>SL Nhập</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>SL Dán</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>SL Hỏng</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Tồn Cuối Lô</th>
                                            <th style={thStyle}>Lô Hàng / Chứng Từ</th>
                                            <th style={thStyle}>Người TH</th>
                                            <th style={thStyle}>Ghi Chú</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logbookEntries.map((e, idx) => (
                                            <tr key={e.id} style={{
                                                borderBottom: '1px solid #E2E8F0',
                                                background: e.txType === 'NHAP_KHO' ? '#F8FAFC' : e.txType === 'HUY_TEM' ? '#FEF2F2' : '#FFFFFF',
                                            }}>
                                                <td style={{ ...tdStyle, color: '#94A3B8', textAlign: 'center' }}>
                                                    {idx + 1}
                                                </td>
                                                <td style={tdStyle}>
                                                    {new Date(e.date).toLocaleDateString('vi-VN')}
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                                                        background: e.txType === 'NHAP_KHO' ? '#E0F2FE' : e.txType === 'HUY_TEM' ? '#FEE2E2' : '#F1F5F9',
                                                        color: e.txType === 'NHAP_KHO' ? '#0369A1' : e.txType === 'HUY_TEM' ? '#991B1B' : '#334155',
                                                    }}>
                                                        {e.txLabel}
                                                    </span>
                                                </td>
                                                <td style={{ ...tdStyle, fontWeight: 600, color: '#0F172A' }}>
                                                    {e.symbol}
                                                </td>
                                                <td style={tdStyle}>
                                                    {e.stampTypeLabel}
                                                </td>
                                                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                                                    {e.serialStart}
                                                </td>
                                                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                                                    {e.serialEnd}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: e.qtyIn > 0 ? 600 : 400, color: e.qtyIn > 0 ? '#0891B2' : '#94A3B8' }}>
                                                    {e.qtyIn > 0 ? e.qtyIn.toLocaleString('vi-VN') : '—'}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: e.qtyUsed > 0 ? 600 : 400, color: e.qtyUsed > 0 ? '#0F172A' : '#94A3B8' }}>
                                                    {e.qtyUsed > 0 ? e.qtyUsed.toLocaleString('vi-VN') : '—'}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', color: e.qtyDamaged > 0 ? '#B91C1C' : '#94A3B8', fontWeight: e.qtyDamaged > 0 ? 600 : 400 }}>
                                                    {e.qtyDamaged > 0 ? e.qtyDamaged.toLocaleString('vi-VN') : '—'}
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#0E7490' }}>
                                                    {e.balanceAfter.toLocaleString('vi-VN')}
                                                </td>
                                                <td style={{ ...tdStyle, maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.referenceTitle}>
                                                    {e.referenceTitle}
                                                </td>
                                                <td style={tdStyle}>
                                                    {e.reporterName}
                                                </td>
                                                <td style={{ ...tdStyle, color: '#64748B', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.notes || ''}>
                                                    {e.notes || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: DESTRUCTION RECORDS */}
            {activeTab === 'destructions' && (
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                        <div>
                            <h3 style={{ color: '#0F172A', margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Trash2 size={16} style={{ color: '#B91C1C' }} />
                                Lịch Sử Biên Bản Hủy Tem Rượu Hỏng / Rách
                            </h3>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                                Lưu giữ hồ sơ hủy tem phục vụ thanh tra hải quan và quyết toán thuế tiêu thụ đặc biệt
                            </p>
                        </div>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>
                            Tổng: {destructions.length} biên bản
                        </span>
                    </div>

                    {destructions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B' }}>
                            <Trash2 size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                            <p>Chưa có biên bản hủy tem nào phát sinh.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #CBD5E1' }}>
                                    <th style={thStyle}>Ngày Hủy</th>
                                    <th style={thStyle}>Lô Tem</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Số Lượng Hủy</th>
                                    <th style={thStyle}>Lý Do Hủy Tem</th>
                                    <th style={thStyle}>Người Chứng Kiến</th>
                                    <th style={thStyle}>Ghi Chú Chi Tiết</th>
                                </tr>
                            </thead>
                            <tbody>
                                {destructions.map(d => (
                                    <tr key={d.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                        <td style={tdStyle}>{new Date(d.destructionDate).toLocaleDateString('vi-VN')}</td>
                                        <td style={{ ...tdStyle, fontWeight: 600, color: '#0F172A' }}>{d.purchaseSymbol}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', color: '#B91C1C', fontWeight: 600 }}>
                                            {d.qtyDestroyed.toLocaleString('vi-VN')}
                                        </td>
                                        <td style={{ ...tdStyle, color: '#334155' }}>{d.reason}</td>
                                        <td style={tdStyle}>{d.witnessName}</td>
                                        <td style={{ ...tdStyle, color: '#64748B', maxWidth: '300px' }}>{d.notes || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* MODAL: PHÂN TEM & GHI NHẬN DÁN TEM */}
            {usageTargetPurchase && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
                }} onClick={() => setUsageTargetPurchase(null)}>
                    <div style={{ ...cardStyle, width: '560px', maxWidth: '95vw', borderColor: '#0891B2', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
                            <div>
                                <h3 style={{ color: '#0F172A', margin: 0, fontSize: '16px', fontWeight: 600 }}>
                                    Phân Tem & Ghi Nhận Dán
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                                    Lô tem: <strong style={{ color: '#0891B2' }}>{usageTargetPurchase.symbol}</strong> ({usageTargetPurchase.stampType === 'UNDER_20_ABV' ? '< 20° ABV' : '≥ 20° ABV'}) — Tồn khả dụng: <strong style={{ color: '#0F172A' }}>{(usageTargetPurchase.totalQty - usageTargetPurchase.usedQty).toLocaleString('vi-VN')}</strong> tem
                                </p>
                            </div>
                            <button onClick={() => setUsageTargetPurchase(null)} style={{ border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: '14px' }}>
                                Đóng
                            </button>
                        </div>

                        <form onSubmit={handleRecordUsage} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Phân bổ theo Lô hàng NK / Kho */}
                            <div>
                                <label style={labelStyle}>Mục Đích Cấp Phát / Phân Tem</label>
                                <select
                                    value={usageData.targetType}
                                    onChange={e => setUsageData({ ...usageData, targetType: e.target.value as any, shipmentId: '', lotId: '' })}
                                    style={inputStyle}
                                >
                                    <option value="NONE">Dán kho thông thường / Không gắn lô cụ thể</option>
                                    <option value="SHIPMENT">Dán cho Lô Hàng Nhập Khẩu (Container / Vận đơn B/L)</option>
                                    <option value="STOCK_LOT">Dán cho Lô Hàng Trong Kho (StockLot)</option>
                                </select>
                            </div>

                            {/* Dropdown Lô hàng NK */}
                            {usageData.targetType === 'SHIPMENT' && (
                                <div style={{ background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '6px', padding: '12px' }}>
                                    <label style={{ ...labelStyle, color: '#0D9488' }}>Chọn Lô Hàng Nhập Khẩu (Shipment)</label>
                                    <select
                                        value={usageData.shipmentId}
                                        onChange={e => setUsageData({ ...usageData, shipmentId: e.target.value })}
                                        required
                                        style={inputStyle}
                                    >
                                        <option value="">-- Chọn vận đơn B/L lô hàng --</option>
                                        {linkingOptions?.shipments.map(s => (
                                            <option key={s.id} value={s.id}>
                                                B/L: {s.billOfLading} ({s.status}) {s.vesselName ? `— Tàu: ${s.vesselName}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Dropdown Lô Kho */}
                            {usageData.targetType === 'STOCK_LOT' && (
                                <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '12px' }}>
                                    <label style={labelStyle}>Chọn Lô Kho (StockLot)</label>
                                    <select
                                        value={usageData.lotId}
                                        onChange={e => setUsageData({ ...usageData, lotId: e.target.value })}
                                        required
                                        style={inputStyle}
                                    >
                                        <option value="">-- Chọn số lô kho --</option>
                                        {linkingOptions?.lots.map(l => (
                                            <option key={l.id} value={l.id}>
                                                Lô: {l.lotNo} — {l.product.productName} (Tồn: {Number(l.qtyAvailable)} chai)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Dải số seri nhập tay theo yêu cầu */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={labelStyle}>Seri Bắt Đầu Bóc Dán</label>
                                    <input
                                        placeholder="VD: 000101"
                                        value={usageData.serialStart}
                                        onChange={e => setUsageData({ ...usageData, serialStart: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Seri Kết Thúc Bóc Dán</label>
                                    <input
                                        placeholder="VD: 000300"
                                        value={usageData.serialEnd}
                                        onChange={e => setUsageData({ ...usageData, serialEnd: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            {/* Số lượng dán & hỏng */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={labelStyle}>Số Lượng Tem Đã Dán *</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={usageData.qtyUsed || ''}
                                        onChange={e => setUsageData({ ...usageData, qtyUsed: parseInt(e.target.value) || 0 })}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Số Lượng Hỏng / Rách Trong Đợt</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={usageData.qtyDamaged || ''}
                                        onChange={e => setUsageData({ ...usageData, qtyDamaged: parseInt(e.target.value) || 0 })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            {/* Ghi chú */}
                            <div>
                                <label style={labelStyle}>Ghi Chú Đợt Dán Tem</label>
                                <textarea
                                    rows={2}
                                    placeholder="Ghi chú chi tiết thùng rượu, vị trí dán, hoặc sự cố nếu có..."
                                    value={usageData.notes}
                                    onChange={e => setUsageData({ ...usageData, notes: e.target.value })}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                                <Button type="button" variant="secondary" size="sm" onClick={() => setUsageTargetPurchase(null)}>
                                    Hủy
                                </Button>
                                <Button type="submit" variant="primary" size="sm" disabled={loading}>
                                    {loading ? 'Đang ghi nhận...' : 'Xác Nhận Cấp Phát & Dán'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: BIÊN BẢN HỦY TEM */}
            {destroyTargetPurchase && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
                }} onClick={() => setDestroyTargetPurchase(null)}>
                    <div style={{ ...cardStyle, width: '520px', maxWidth: '95vw', borderColor: '#B91C1C' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
                            <div>
                                <h3 style={{ color: '#0F172A', margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Trash2 size={16} style={{ color: '#B91C1C' }} />
                                    Lập Biên Bản Hủy Tem Rách / Hỏng
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                                    Lô tem: {destroyTargetPurchase.symbol} — Tồn: {(destroyTargetPurchase.totalQty - destroyTargetPurchase.usedQty).toLocaleString('vi-VN')} tem
                                </p>
                            </div>
                            <button onClick={() => setDestroyTargetPurchase(null)} style={{ border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: '14px' }}>
                                Đóng
                            </button>
                        </div>

                        <form onSubmit={handleDestruction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={labelStyle}>Số Lượng Tem Hủy *</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={destroyData.qtyDestroyed || ''}
                                        onChange={e => setDestroyData({ ...destroyData, qtyDestroyed: parseInt(e.target.value) || 0 })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Ngày Hủy *</label>
                                    <input
                                        type="date"
                                        value={destroyData.destructionDate}
                                        onChange={e => setDestroyData({ ...destroyData, destructionDate: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Lý Do Hủy Tem *</label>
                                <input
                                    placeholder="VD: Tem bị rách nát do va đập, ngấm nước mưa, lỗi in phôi..."
                                    value={destroyData.reason}
                                    onChange={e => setDestroyData({ ...destroyData, reason: e.target.value })}
                                    required
                                    style={inputStyle}
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>Người Chứng Kiến Hủy Tem *</label>
                                <input
                                    placeholder="Họ tên và chức vụ người chứng kiến"
                                    value={destroyData.witnessName}
                                    onChange={e => setDestroyData({ ...destroyData, witnessName: e.target.value })}
                                    required
                                    style={inputStyle}
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>Ghi Chú Bổ Sung</label>
                                <textarea
                                    rows={2}
                                    placeholder="Ghi chú thêm về phương thức hủy (cắt góc, đốt hủy, lập hội đồng...)"
                                    value={destroyData.notes}
                                    onChange={e => setDestroyData({ ...destroyData, notes: e.target.value })}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                                <Button type="button" variant="secondary" size="sm" onClick={() => setDestroyTargetPurchase(null)}>
                                    Hủy
                                </Button>
                                <Button type="submit" variant="primary" size="sm" disabled={loading} style={{ background: '#B91C1C' }}>
                                    {loading ? 'Đang xử lý...' : 'Xác Nhận Hủy Tem'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
