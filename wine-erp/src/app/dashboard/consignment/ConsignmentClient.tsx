'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package, Handshake, TrendingUp, CheckCircle2, Plus, Eye, X, Wine, ChevronRight, FileText, AlertCircle, MapPin, AlertTriangle } from 'lucide-react'
import type { ConsignmentRow, ConsignmentStockRow, ConsignmentReportRow, ConsignedStockMapRow, ReplenishmentAlert } from './actions'
import {
    getConsignmentAgreements, getConsignmentStats, createConsignmentAgreement,
    getConsignmentStocks, addConsignmentStock, getConsignmentReports,
    createConsignmentReport, confirmConsignmentReport,
    getCustomerOptionsForCSG, getProductOptionsForCSG,
    getConsignedStockMap, getReplenishmentAlerts,
} from './actions'

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE: { label: 'Đang Hoạt Động', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    EXPIRED: { label: 'Hết Hạn', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    TERMINATED: { label: 'Đã Kết Thúc', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
}

const FREQ_LABEL: Record<string, string> = {
    WEEKLY: 'Hàng Tuần', MONTHLY: 'Hàng Tháng', QUARTERLY: 'Hàng Quý', AS_NEEDED: 'Khi Cần',
}

// ═══════════════════════════════════════════════════
// CREATE AGREEMENT DRAWER
// ═══════════════════════════════════════════════════
function CreateDrawer({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: () => void
}) {
    const [customers, setCustomers] = useState<{ id: string; name: string; code: string; customerType: string }[]>([])
    const [form, setForm] = useState<{ customerId: string; reportFrequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'AS_NEEDED'; startDate: string; endDate: string }>({ customerId: '', reportFrequency: 'MONTHLY', startDate: '', endDate: '' })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) getCustomerOptionsForCSG().then(setCustomers)
    }, [open])

    const handleSubmit = async () => {
        if (!form.customerId || !form.startDate || !form.endDate) return alert('Vui lòng điền đầy đủ')
        setLoading(true)
        const res = await createConsignmentAgreement(form)
        setLoading(false)
        if (res.success) { onCreated(); onClose() }
        else alert(res.error)
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-[480px] h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                    <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>
                        Tạo Hợp Đồng Ký Gửi
                    </h3>
                    <button onClick={onClose} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Khách Hàng *</label>
                        <select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                            className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                            <option value="">— Chọn KH HORECA/Đại lý —</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name} ({c.customerType})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Tần Suất Báo Cáo</label>
                        <select value={form.reportFrequency} onChange={e => setForm(f => ({ ...f, reportFrequency: e.target.value as typeof form.reportFrequency }))}
                            className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                            {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Ngày Bắt Đầu *</label>
                            <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Ngày Kết Thúc *</label>
                            <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                                className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                        </div>
                    </div>
                    <button onClick={handleSubmit} disabled={loading}
                        className="w-full py-2.5 text-sm font-bold rounded transition-all"
                        style={{ background: loading ? '#2A4355' : '#87CBB9', color: '#0A1926' }}>
                        {loading ? 'Đang tạo...' : 'Tạo Hợp Đồng'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// DETAIL DRAWER — Stock + Reports + Reconciliation
// ═══════════════════════════════════════════════════
function DetailDrawer({ agreement, onClose, onRefresh }: {
    agreement: ConsignmentRow | null; onClose: () => void; onRefresh: () => void
}) {
    const [stocks, setStocks] = useState<ConsignmentStockRow[]>([])
    const [reports, setReports] = useState<ConsignmentReportRow[]>([])
    const [products, setProducts] = useState<{ id: string; skuCode: string; productName: string; wineType: string }[]>([])
    const [tab, setTab] = useState<'stock' | 'reports'>('stock')
    const [addStock, setAddStock] = useState(false)
    const [addReport, setAddReport] = useState(false)
    const [stockForm, setStockForm] = useState({ productId: '', qty: '' })
    const [reportForm, setReportForm] = useState({ periodStart: '', periodEnd: '', items: [] as { stockId: string; qtySold: number }[] })
    const [loading, setLoading] = useState(false)

    const loadData = useCallback(async () => {
        if (!agreement) return
        const [s, r] = await Promise.all([getConsignmentStocks(agreement.id), getConsignmentReports(agreement.id)])
        setStocks(s)
        setReports(r)
    }, [agreement])

    useEffect(() => { loadData() }, [loadData])
    useEffect(() => { if (addStock) getProductOptionsForCSG().then(setProducts) }, [addStock])

    const handleAddStock = async () => {
        if (!agreement || !stockForm.productId || !stockForm.qty) return
        setLoading(true)
        const res = await addConsignmentStock({ agreementId: agreement.id, productId: stockForm.productId, qtyConsigned: Number(stockForm.qty) })
        setLoading(false)
        if (res.success) { setAddStock(false); setStockForm({ productId: '', qty: '' }); loadData(); onRefresh() }
        else alert(res.error)
    }

    const handleCreateReport = async () => {
        if (!agreement || !reportForm.periodStart || !reportForm.periodEnd) return
        const items = stocks.filter(s => s.qtyRemaining > 0).map(s => ({ stockId: s.id, qtySold: 0 }))
        setReportForm(f => ({ ...f, items }))
        setAddReport(true)
    }

    const handleSubmitReport = async () => {
        if (!agreement) return
        const filledItems = reportForm.items.filter(i => i.qtySold > 0)
        if (filledItems.length === 0) return alert('Nhập số lượng đã bán')
        setLoading(true)
        const res = await createConsignmentReport({
            agreementId: agreement.id, periodStart: reportForm.periodStart,
            periodEnd: reportForm.periodEnd, items: filledItems,
        })
        setLoading(false)
        if (res.success) { setAddReport(false); loadData(); onRefresh() }
        else alert(res.error)
    }

    const handleConfirmReport = async (id: string) => {
        const res = await confirmConsignmentReport(id)
        if (res.success) loadData()
        else alert(res.error)
    }

    if (!agreement) return null
    const st = STATUS_MAP[agreement.status] ?? STATUS_MAP.ACTIVE

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-[600px] h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                {/* Header */}
                <div className="p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>
                            Chi Tiết Hợp Đồng
                        </h3>
                        <button onClick={onClose} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><span style={{ color: '#4A6A7A' }}>Khách hàng:</span> <span style={{ color: '#E8F1F2' }}>{agreement.customerName}</span></div>
                        <div><span style={{ color: '#4A6A7A' }}>Trạng thái:</span>
                            <span className="ml-1 px-2 py-0.5 rounded font-bold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        </div>
                        <div><span style={{ color: '#4A6A7A' }}>Tần suất BC:</span> <span style={{ color: '#8AAEBB' }}>{FREQ_LABEL[agreement.reportFrequency]}</span></div>
                        <div><span style={{ color: '#4A6A7A' }}>Thời hạn:</span> <span style={{ color: '#8AAEBB' }}>
                            {new Date(agreement.startDate).toLocaleDateString('vi-VN')} — {new Date(agreement.endDate).toLocaleDateString('vi-VN')}
                        </span></div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex" style={{ borderBottom: '1px solid #2A4355' }}>
                    {(['stock', 'reports'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all"
                            style={{ color: tab === t ? '#87CBB9' : '#4A6A7A', borderBottom: tab === t ? '2px solid #87CBB9' : '2px solid transparent' }}>
                            {t === 'stock' ? `Hàng Ký Gửi (${stocks.length})` : `Báo Cáo (${reports.length})`}
                        </button>
                    ))}
                </div>

                {/* Stock Tab */}
                {tab === 'stock' && (
                    <div className="p-5 space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-bold" style={{ color: '#D4A853' }}>Sản Phẩm Ký Gửi</h4>
                            <button onClick={() => setAddStock(true)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-semibold"
                                style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>
                                <Plus size={12} /> Thêm SP
                            </button>
                        </div>
                        {addStock && (
                            <div className="p-3 rounded space-y-2" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <select value={stockForm.productId} onChange={e => setStockForm(f => ({ ...f, productId: e.target.value }))}
                                    className="w-full px-3 py-2 rounded text-xs" style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                    <option value="">— Chọn sản phẩm —</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.skuCode} — {p.productName}</option>)}
                                </select>
                                <input type="number" placeholder="Số lượng chai" value={stockForm.qty}
                                    onChange={e => setStockForm(f => ({ ...f, qty: e.target.value }))}
                                    className="w-full px-3 py-2 rounded text-xs" style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                                <div className="flex gap-2">
                                    <button onClick={handleAddStock} disabled={loading} className="flex-1 py-1.5 text-xs font-bold rounded"
                                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                                        {loading ? '...' : 'Xuất Ký Gửi'}
                                    </button>
                                    <button onClick={() => setAddStock(false)} className="px-3 py-1.5 text-xs rounded"
                                        style={{ background: '#2A4355', color: '#8AAEBB' }}>Hủy</button>
                                </div>
                            </div>
                        )}
                        {stocks.length === 0 ? (
                            <p className="text-xs text-center py-8" style={{ color: '#4A6A7A' }}>Chưa có sản phẩm nào</p>
                        ) : stocks.map(s => {
                            const pct = s.qtyConsigned > 0 ? (s.qtySold / s.qtyConsigned) * 100 : 0
                            return (
                                <div key={s.id} className="p-3 rounded" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div>
                                            <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{s.skuCode}</span>
                                            <span className="text-xs ml-2" style={{ color: '#E8F1F2' }}>{s.productName}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs mt-1" style={{ color: '#8AAEBB' }}>
                                        <span>Gửi: <b style={{ color: '#D4A853' }}>{s.qtyConsigned}</b></span>
                                        <span>Bán: <b style={{ color: '#5BA88A' }}>{s.qtySold}</b></span>
                                        <span>Còn: <b style={{ color: '#E8F1F2' }}>{s.qtyRemaining}</b></span>
                                    </div>
                                    <div className="mt-2 h-1.5 rounded-full" style={{ background: '#142433' }}>
                                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 80 ? '#5BA88A' : pct > 50 ? '#D4A853' : '#87CBB9' }} />
                                    </div>
                                    <span className="text-[10px]" style={{ color: '#4A6A7A' }}>{pct.toFixed(0)}% đã bán</span>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Reports Tab */}
                {tab === 'reports' && (
                    <div className="p-5 space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-bold" style={{ color: '#D4A853' }}>Báo Cáo Đối Chiếu</h4>
                            <button onClick={() => { setAddReport(true); handleCreateReport() }}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-semibold"
                                style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>
                                <FileText size={12} /> Tạo Đối Chiếu
                            </button>
                        </div>

                        {addReport && (
                            <div className="p-3 rounded space-y-2" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-semibold" style={{ color: '#4A6A7A' }}>Từ ngày</label>
                                        <input type="date" value={reportForm.periodStart}
                                            onChange={e => setReportForm(f => ({ ...f, periodStart: e.target.value }))}
                                            className="w-full px-2 py-1.5 rounded text-xs" style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold" style={{ color: '#4A6A7A' }}>Đến ngày</label>
                                        <input type="date" value={reportForm.periodEnd}
                                            onChange={e => setReportForm(f => ({ ...f, periodEnd: e.target.value }))}
                                            className="w-full px-2 py-1.5 rounded text-xs" style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                                    </div>
                                </div>
                                <p className="text-[10px] font-semibold mt-2" style={{ color: '#8AAEBB' }}>Nhập SL đã bán per SKU:</p>
                                {reportForm.items.map((item, idx) => {
                                    const stk = stocks.find(s => s.id === item.stockId)
                                    return (
                                        <div key={item.stockId} className="flex items-center gap-2">
                                            <span className="text-xs flex-1" style={{ color: '#E8F1F2' }}>{stk?.skuCode ?? '?'} — {stk?.productName}</span>
                                            <input type="number" min={0} max={stk?.qtyRemaining ?? 99} value={item.qtySold || ''}
                                                onChange={e => {
                                                    const items = [...reportForm.items]
                                                    items[idx] = { ...items[idx], qtySold: Number(e.target.value) }
                                                    setReportForm(f => ({ ...f, items }))
                                                }}
                                                placeholder="0" className="w-20 px-2 py-1 rounded text-xs text-right"
                                                style={{ background: '#142433', border: '1px solid #2A4355', color: '#D4A853' }} />
                                        </div>
                                    )
                                })}
                                <div className="flex gap-2 pt-1">
                                    <button onClick={handleSubmitReport} disabled={loading} className="flex-1 py-1.5 text-xs font-bold rounded"
                                        style={{ background: '#87CBB9', color: '#0A1926' }}>{loading ? '...' : 'Gửi Báo Cáo'}</button>
                                    <button onClick={() => setAddReport(false)} className="px-3 py-1.5 text-xs rounded"
                                        style={{ background: '#2A4355', color: '#8AAEBB' }}>Hủy</button>
                                </div>
                            </div>
                        )}

                        {reports.length === 0 ? (
                            <p className="text-xs text-center py-8" style={{ color: '#4A6A7A' }}>Chưa có báo cáo nào</p>
                        ) : reports.map(r => (
                            <div key={r.id} className="p-3 rounded flex items-center justify-between"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <div>
                                    <div className="text-xs" style={{ color: '#E8F1F2' }}>
                                        {new Date(r.periodStart).toLocaleDateString('vi-VN')} — {new Date(r.periodEnd).toLocaleDateString('vi-VN')}
                                    </div>
                                    <div className="text-[10px] mt-0.5" style={{ color: '#4A6A7A' }}>
                                        Gửi: {new Date(r.submittedAt).toLocaleDateString('vi-VN')}
                                    </div>
                                </div>
                                {r.status === 'PENDING' ? (
                                    <button onClick={() => handleConfirmReport(r.id)}
                                        className="text-xs px-3 py-1 rounded font-bold"
                                        style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A' }}>
                                        Xác Nhận
                                    </button>
                                ) : (
                                    <span className="text-xs px-2 py-0.5 rounded font-bold"
                                        style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A' }}>
                                        ✓ Đã xác nhận
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// MAIN CLIENT
// ═══════════════════════════════════════════════════
export function ConsignmentClient({ initialRows, stats: initialStats }: {
    initialRows: ConsignmentRow[]
    stats: { total: number; active: number; totalStockSent: number; totalSold: number }
}) {
    const [rows, setRows] = useState(initialRows)
    const [stats, setStats] = useState(initialStats)
    const [createOpen, setCreateOpen] = useState(false)
    const [selectedAgreement, setSelectedAgreement] = useState<ConsignmentRow | null>(null)
    const [mainTab, setMainTab] = useState<'agreements' | 'stockMap'>('agreements')
    const [stockMap, setStockMap] = useState<ConsignedStockMapRow[]>([])
    const [alerts, setAlerts] = useState<ReplenishmentAlert[]>([])
    const [mapLoading, setMapLoading] = useState(false)

    const reload = async () => {
        const [r, s] = await Promise.all([getConsignmentAgreements(), getConsignmentStats()])
        setRows(r)
        setStats(s)
    }

    const loadStockMap = async () => {
        setMapLoading(true)
        const [map, repAlerts] = await Promise.all([getConsignedStockMap(), getReplenishmentAlerts()])
        setStockMap(map)
        setAlerts(repAlerts)
        setMapLoading(false)
    }

    const statCards = [
        { label: 'Tổng HĐ Ký Gửi', value: stats.total, icon: Handshake, accent: '#87CBB9' },
        { label: 'Đang Hoạt Động', value: stats.active, icon: CheckCircle2, accent: '#5BA88A' },
        { label: 'Tổng Chai Gửi', value: stats.totalStockSent.toLocaleString('vi-VN'), icon: Package, accent: '#D4A853' },
        { label: 'Đã Bán', value: stats.totalSold.toLocaleString('vi-VN'), icon: TrendingUp, accent: '#87CBB9' },
    ]

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Ký Gửi Hàng Hoá (CSG)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Quản lý hợp đồng ký gửi, tồn tại HORECA, báo cáo tiêu thụ
                    </p>
                </div>
                <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all"
                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                    <Plus size={16} /> Tạo HĐ Ký Gửi
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                {statCards.map(c => {
                    const Icon = c.icon
                    return (
                        <div key={c.label} className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <Icon size={16} style={{ color: c.accent }} />
                                <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{c.label}</span>
                            </div>
                            <p className="text-xl font-bold" style={{ fontFamily: '"DM Mono"', color: c.accent }}>{c.value}</p>
                        </div>
                    )
                })}
            </div>

            {/* Main Tabs */}
            <div className="flex gap-1" style={{ borderBottom: '1px solid #2A4355' }}>
                <button onClick={() => setMainTab('agreements')}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all"
                    style={{ color: mainTab === 'agreements' ? '#87CBB9' : '#4A6A7A', borderBottom: mainTab === 'agreements' ? '2px solid #87CBB9' : '2px solid transparent' }}>
                    Hợp Đồng ({rows.length})
                </button>
                <button onClick={() => { setMainTab('stockMap'); loadStockMap() }}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all"
                    style={{ color: mainTab === 'stockMap' ? '#87CBB9' : '#4A6A7A', borderBottom: mainTab === 'stockMap' ? '2px solid #87CBB9' : '2px solid transparent' }}>
                    <MapPin size={12} /> Bản Đồ Tồn Kho Ký Gửi
                </button>
            </div>

            {/* Agreements Table */}
            {mainTab === 'agreements' && (
                <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                {['Mã HĐ', 'Khách Hàng', 'Trạng Thái', 'Tần Suất BC', 'SKU Gửi', 'Tổng Chai', 'Thời Hạn', ''].map(h => (
                                    <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                        style={{ color: '#4A6A7A', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-16 text-sm" style={{ color: '#4A6A7A' }}>
                                    Chưa có hợp đồng ký gửi nào — Nhấn "Tạo HĐ Ký Gửi" để bắt đầu
                                </td></tr>
                            ) : rows.map(row => {
                                const st = STATUS_MAP[row.status] ?? STATUS_MAP.ACTIVE
                                return (
                                    <tr key={row.id} className="cursor-pointer" style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                        onClick={() => setSelectedAgreement(row)}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                            CSG-{row.id.slice(-6).toUpperCase()}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: '#E8F1F2' }}>{row.customerName}</td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: st.bg, color: st.color }}>
                                                {st.label}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>
                                            {FREQ_LABEL[row.reportFrequency] ?? row.reportFrequency}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                            {row.stockCount}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>
                                            {row.totalQty.toLocaleString('vi-VN')}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>
                                            {new Date(row.startDate).toLocaleDateString('vi-VN')} — {new Date(row.endDate).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <ChevronRight size={14} style={{ color: '#4A6A7A' }} />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Stock Map Tab */}
            {mainTab === 'stockMap' && (
                <div className="space-y-4">
                    {/* Replenishment Alerts */}
                    {alerts.length > 0 && (
                        <div className="p-4 rounded-md" style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle size={14} style={{ color: '#D4A853' }} />
                                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#D4A853' }}>
                                    Cần bổ sung hàng ({alerts.length} mục)
                                </span>
                            </div>
                            <div className="space-y-1">
                                {alerts.map((a, i) => (
                                    <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded text-xs" style={{ background: '#1B2E3D' }}>
                                        <span style={{ color: '#E8F1F2' }}>{a.customerName}</span>
                                        <span style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{a.skuCode}</span>
                                        <span style={{ color: '#8B1A2E', fontFamily: '"DM Mono"', fontWeight: 'bold' }}>Còn {a.qtyRemaining} chai</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stock Map Table */}
                    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                    {['Điểm Ký Gửi', 'SKU', 'Sản Phẩm', 'Gửi', 'Đã Bán', 'Còn Lại', '% Bán'].map(h => (
                                        <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {mapLoading ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>Đang tải...</td></tr>
                                ) : stockMap.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>Chưa có dữ liệu ký gửi</td></tr>
                                ) : stockMap.map((row, i) => {
                                    const barColor = row.pctSold >= 80 ? '#5BA88A' : row.pctSold >= 50 ? '#D4A853' : '#87CBB9'
                                    const isLow = row.qtyRemaining <= 10
                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)', background: isLow ? 'rgba(139,26,46,0.04)' : 'transparent' }}>
                                            <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: '#E8F1F2' }}>{row.customerName}</td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{row.skuCode}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{row.productName}</td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>{row.qtyConsigned}</td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#5BA88A', fontFamily: '"DM Mono"' }}>{row.qtySold}</td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: isLow ? '#8B1A2E' : '#E8F1F2' }}>
                                                {row.qtyRemaining}
                                                {isLow && <span className="ml-1 text-[9px] px-1 py-0.5 rounded" style={{ background: 'rgba(139,26,46,0.15)', color: '#8B1A2E' }}>⚠ Thấp</span>}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 rounded-full" style={{ background: '#142433' }}>
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(row.pctSold, 100)}%`, background: barColor }} />
                                                    </div>
                                                    <span className="text-xs font-bold" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{row.pctSold.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Drawers */}
            <CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={reload} />
            <DetailDrawer agreement={selectedAgreement} onClose={() => setSelectedAgreement(null)} onRefresh={reload} />
        </div>
    )
}
