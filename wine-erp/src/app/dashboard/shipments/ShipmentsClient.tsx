'use client'

import React, { useState, useEffect } from 'react'
import {
    Search, Plus, Ship, Anchor, MapPin, Calendar, DollarSign,
    FileCheck, CheckCircle2, Loader2, X, Package, Globe, Truck,
    BarChart3, Shield, ChevronRight, Eye,
} from 'lucide-react'
import {
    getShipments, createShipment, getLandedCostBreakdown,
    type ShipmentRow,
} from '../procurement/shipment-actions'
import { ShipmentDetailDrawer } from '../procurement/ShipmentDetailDrawer'
import { getPurchaseOrders } from '../procurement/actions'
import { getForwardersAndBrokers } from '../procurement/shipment-actions'
import { toast } from 'sonner'

const fmtDate = (d: Date | string | null) => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const fmtNum = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n))

const STATUS_CFG: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Nháp', color: '#4A6A7A' },
    BOOKED: { label: 'Đã book', color: '#4A8FAB' },
    DOCS_READY: { label: 'Docs sẵn', color: '#7AC4C4' },
    LOADED: { label: 'Đã xếp', color: '#87CBB9' },
    ON_VESSEL: { label: 'Trên tàu', color: '#5BA88A' },
    ARRIVED_PORT: { label: 'Cập cảng', color: '#D4A853' },
    CUSTOMS_FILING: { label: 'Khai HQ', color: '#C07434' },
    CUSTOMS_INSPECTING: { label: 'Giám định', color: '#D4A853' },
    CUSTOMS_CLEARED: { label: 'Thông quan', color: '#5BA88A' },
    STAMPING: { label: 'Dán tem', color: '#87CBB9' },
    DELIVERED_TO_WAREHOUSE: { label: 'Nhập kho', color: '#5BA88A' },
    COMPLETED: { label: 'Hoàn tất', color: '#5BA88A' },
    CANCELLED: { label: 'Đã huỷ', color: '#8B1A2E' },
}

// ═══════════════════════════════════════════════════
// CREATE SHIPMENT DRAWER
// ═══════════════════════════════════════════════════
function CreateShipmentDrawer({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: () => void
}) {
    const [pos, setPos] = useState<{ id: string; poNo: string; supplierName: string; incoterms: string | null }[]>([])
    const [fwBk, setFwBk] = useState<{ forwarders: any[]; brokers: any[] }>({ forwarders: [], brokers: [] })
    const [form, setForm] = useState({
        poId: '', billOfLading: '', vesselName: '', voyageNo: '',
        containerNo: '', containerType: '20FT', portOfLoading: '', portOfDischarge: 'VNSGN',
        etd: '', eta: '', cifAmount: 0, cifCurrency: 'USD', incoterms: 'EXW',
        forwarderId: '', customsBrokerId: '',
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) return
        Promise.all([
            getPurchaseOrders({ status: 'APPROVED', pageSize: 100 }).then(r =>
                setPos(r.rows.map(p => ({ id: p.id, poNo: p.poNo, supplierName: p.supplierName, incoterms: null })))),
            getForwardersAndBrokers().then(setFwBk),
        ])
    }, [open])

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
    const inputCls = "w-full px-3 py-2 rounded-lg text-sm outline-none"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    const handleSave = async () => {
        if (!form.poId || !form.billOfLading) { toast.error('Chọn PO và nhập B/L'); return }
        setSaving(true)
        try {
            const res = await createShipment({
                ...form, cifAmount: form.cifAmount,
                forwarderId: form.forwarderId || undefined,
                customsBrokerId: form.customsBrokerId || undefined,
            })
            if (res.success) { toast.success('Tạo lô hàng thành công!'); onCreated(); onClose() }
            else toast.error(res.error ?? 'Lỗi')
        } finally { setSaving(false) }
    }

    return (
        <>
            <div className="fixed inset-0 z-40 transition-opacity duration-300"
                style={{ background: 'rgba(10,5,2,0.75)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
                onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300"
                style={{ width: 'min(620px, 95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355', transform: open ? 'translateX(0)' : 'translateX(100%)' }}>

                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(74,143,171,0.15)' }}>
                            <Ship size={18} style={{ color: '#4A8FAB' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>Tạo Lô Hàng Mới</h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Tạo shipment từ PO đã duyệt</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>── Thông Tin Cơ Bản</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Purchase Order *</label>
                            <select className={inputCls} style={inputStyle} value={form.poId} onChange={e => set('poId', e.target.value)}>
                                <option value="">— Chọn PO —</option>
                                {pos.map(p => <option key={p.id} value={p.id}>{p.poNo} — {p.supplierName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Bill of Lading *</label>
                            <input className={inputCls} style={inputStyle} value={form.billOfLading} onChange={e => set('billOfLading', e.target.value)} placeholder="VD: MAEU12345678" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Incoterms</label>
                            <select className={inputCls} style={inputStyle} value={form.incoterms} onChange={e => set('incoterms', e.target.value)}>
                                <option value="EXW">EXW — Ex Works</option>
                                <option value="FOB">FOB — Free On Board</option>
                                <option value="CIF">CIF — Cost Insurance Freight</option>
                            </select>
                        </div>
                    </div>

                    <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#87CBB9' }}>── Thông Tin Vận Chuyển</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Tên Tàu</label>
                            <input className={inputCls} style={inputStyle} value={form.vesselName} onChange={e => set('vesselName', e.target.value)} placeholder="VD: MSC ROMA" /></div>
                        <div><label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Voyage No</label>
                            <input className={inputCls} style={inputStyle} value={form.voyageNo} onChange={e => set('voyageNo', e.target.value)} placeholder="VD: VA523W" /></div>
                        <div><label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Container No</label>
                            <input className={inputCls} style={inputStyle} value={form.containerNo} onChange={e => set('containerNo', e.target.value)} placeholder="VD: MSKU1234567" /></div>
                        <div><label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Container Type</label>
                            <select className={inputCls} style={inputStyle} value={form.containerType} onChange={e => set('containerType', e.target.value)}>
                                <option value="20FT">20FT Dry</option><option value="40FT">40FT Dry</option>
                                <option value="40HC">40HC High Cube</option><option value="REEFER">Reefer (lạnh)</option>
                                <option value="LCL">LCL (hàng lẻ)</option>
                            </select></div>
                        <div><label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Cảng Xuất</label>
                            <input className={inputCls} style={inputStyle} value={form.portOfLoading} onChange={e => set('portOfLoading', e.target.value)} placeholder="VD: FRMRS (Marseille)" /></div>
                        <div><label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Cảng Đến</label>
                            <input className={inputCls} style={inputStyle} value={form.portOfDischarge} onChange={e => set('portOfDischarge', e.target.value)} /></div>
                        <div><label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>ETD</label>
                            <input type="date" className={inputCls} style={inputStyle} value={form.etd} onChange={e => set('etd', e.target.value)} /></div>
                        <div><label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>ETA</label>
                            <input type="date" className={inputCls} style={inputStyle} value={form.eta} onChange={e => set('eta', e.target.value)} /></div>
                    </div>

                    <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#87CBB9' }}>── Giá Trị & Đối Tác</p>
                    <div className="grid grid-cols-3 gap-3">
                        <div><label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Giá trị CIF *</label>
                            <input type="number" className={inputCls} style={inputStyle} value={form.cifAmount || ''} onChange={e => set('cifAmount', Number(e.target.value))} /></div>
                        <div><label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Tiền tệ</label>
                            <select className={inputCls} style={inputStyle} value={form.cifCurrency} onChange={e => set('cifCurrency', e.target.value)}>
                                <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                            </select></div>
                        <div />
                        <div><label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Forwarder</label>
                            <select className={inputCls} style={inputStyle} value={form.forwarderId} onChange={e => set('forwarderId', e.target.value)}>
                                <option value="">— Chọn —</option>
                                {fwBk.forwarders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select></div>
                        <div className="col-span-2"><label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Customs Broker</label>
                            <select className={inputCls} style={inputStyle} value={form.customsBrokerId} onChange={e => set('customsBrokerId', e.target.value)}>
                                <option value="">— Chọn —</option>
                                {fwBk.brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select></div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #2A4355' }}>
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>Huỷ</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Ship size={14} />}
                        {saving ? 'Đang tạo...' : 'Tạo Lô Hàng'}
                    </button>
                </div>
            </div>
        </>
    )
}

// ═══════════════════════════════════════════════════
// LANDED COST MODAL
// ═══════════════════════════════════════════════════
function LandedCostModal({ shipmentId, onClose }: { shipmentId: string; onClose: () => void }) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getLandedCostBreakdown(shipmentId).then(d => { setData(d); setLoading(false) })
    }, [shipmentId])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
            <div className="p-6 rounded-xl w-[640px] max-h-[80vh] overflow-auto" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-semibold flex items-center gap-2" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>
                        <BarChart3 size={18} style={{ color: '#D4A853' }} /> Phân Tích Giá Vốn Nhập Kho
                    </h3>
                    <button onClick={onClose} style={{ color: '#4A6A7A' }}><X size={16} /></button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
                ) : !data ? (
                    <p className="text-center py-8 text-sm" style={{ color: '#4A6A7A' }}>Không có dữ liệu</p>
                ) : (
                    <div className="space-y-5">
                        {/* Summary bar */}
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Giá trị CIF (VND)', value: fmtNum(data.cifVND), color: '#87CBB9' },
                                { label: 'Tổng Chi Phí', value: fmtNum(data.totalCosts), color: '#D4A853' },
                                { label: 'TỔNG GIÁ VỐN', value: `${fmtNum(data.grandTotal)} ₫`, color: '#E8F1F2' },
                            ].map(c => (
                                <div key={c.label} className="p-3 rounded-lg text-center" style={{ background: '#142433' }}>
                                    <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>{c.label}</p>
                                    <p className="text-sm font-bold mt-1" style={{ color: c.color, fontFamily: '"DM Mono"' }}>{c.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Cost breakdown by category */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#D4A853' }}>Chi Phí Theo Loại</p>
                            <div className="space-y-1">
                                {data.costsByCategory.map((c: any) => (
                                    <div key={c.category} className="flex items-center justify-between px-3 py-2 rounded" style={{ background: '#142433' }}>
                                        <span className="text-xs" style={{ color: '#8AAEBB' }}>{c.label}</span>
                                        <span className="text-xs font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{fmtNum(c.totalVND)} ₫</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tax breakdown */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#D4A853' }}>Thuế</p>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                {[
                                    { label: 'Thuế NK', value: data.taxBreakdown.importTax },
                                    { label: 'TTĐB', value: data.taxBreakdown.sct },
                                    { label: 'VAT', value: data.taxBreakdown.vat },
                                    { label: 'TỔNG THUẾ', value: data.taxBreakdown.total },
                                ].map(t => (
                                    <div key={t.label} className="p-2 rounded" style={{ background: 'rgba(212,168,83,0.08)' }}>
                                        <p className="text-[10px]" style={{ color: '#D4A853' }}>{t.label}</p>
                                        <p className="text-xs font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{fmtNum(t.value)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Per product */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#87CBB9' }}>Giá Vốn Per SKU</p>
                            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #2A4355' }}>
                                        {['SKU', 'Tên', 'SL', 'CIF/chai', 'Landed/chai'].map(h => (
                                            <th key={h} className="px-2 py-2 text-[10px] uppercase font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.productBreakdown.map((p: any) => (
                                        <tr key={p.skuCode} style={{ borderBottom: '1px solid rgba(42,67,85,0.3)' }}>
                                            <td className="px-2 py-2 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{p.skuCode}</td>
                                            <td className="px-2 py-2 text-xs truncate max-w-[140px]" style={{ color: '#E8F1F2' }}>{p.productName}</td>
                                            <td className="px-2 py-2 text-xs text-center" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{p.qty}</td>
                                            <td className="px-2 py-2 text-xs text-right" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{fmtNum(p.unitCIF)}</td>
                                            <td className="px-2 py-2 text-xs text-right font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>{fmtNum(p.estimatedLandedCost)} ₫</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Average */}
                        <div className="flex justify-between items-center px-4 py-3 rounded-lg" style={{ background: 'rgba(135,203,185,0.08)', border: '1px solid rgba(135,203,185,0.2)' }}>
                            <span className="text-sm font-semibold" style={{ color: '#87CBB9' }}>Giá vốn BQ / chai</span>
                            <span className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{fmtNum(data.avgLandedCostPerUnit)} ₫</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// MAIN CLIENT
// ═══════════════════════════════════════════════════
interface Props {
    initialRows: ShipmentRow[]; initialTotal: number
    stats: { total: number; booked: number; onVessel: number; atPort: number; customsFiling: number; cleared: number; delivered: number }
}

export function ShipmentsClient({ initialRows, initialTotal, stats }: Props) {
    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [detailOpen, setDetailOpen] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [landedCostId, setLandedCostId] = useState<string | null>(null)

    const refresh = async () => {
        setLoading(true)
        try {
            const r = await getShipments({ search: search || undefined, status: statusFilter || undefined })
            setRows(r.rows); setTotal(r.total)
        } finally { setLoading(false) }
    }

    const statCards = [
        { label: 'Tổng Lô', value: stats.total, icon: Ship, accent: '#87CBB9' },
        { label: 'Đã Book', value: stats.booked, icon: Package, accent: '#4A8FAB' },
        { label: 'Trên Tàu', value: stats.onVessel, icon: Anchor, accent: '#5BA88A' },
        { label: 'Cập Cảng', value: stats.atPort, icon: MapPin, accent: '#D4A853' },
        { label: 'Hải Quan', value: stats.customsFiling, icon: FileCheck, accent: '#C07434' },
        { label: 'Thông Quan', value: stats.cleared, icon: CheckCircle2, accent: '#5BA88A' },
        { label: 'Nhập Kho', value: stats.delivered, icon: Truck, accent: '#87CBB9' },
    ]

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Quản Lý Lô Hàng
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Shipment Tracking — Theo dõi toàn bộ quy trình từ PO → Nhập kho
                    </p>
                </div>
                <button onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                    <Plus size={16} /> Tạo Lô Hàng
                </button>
            </div>

            {/* Stats */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {statCards.map(s => (
                    <button key={s.label} onClick={() => { /* could filter by status */ }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl flex-shrink-0 min-w-[130px]"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <s.icon size={18} style={{ color: s.accent }} />
                        <div className="text-left">
                            <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{s.label}</p>
                            <p className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono", monospace' }}>{s.value}</p>
                        </div>
                    </button>
                ))}
            </div>

            {/* Filter */}
            <div className="flex gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input placeholder="Tìm B/L, tàu, NCC..." value={search}
                        onChange={e => { setSearch(e.target.value); refresh() }}
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                </div>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); refresh() }}
                    className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: statusFilter ? '#E8F1F2' : '#4A6A7A' }}>
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['B/L', 'PO', 'NCC', 'Tàu', 'Container', 'Cảng', 'ETA', 'Tiến độ', 'Trạng Thái', ''].map(h => (
                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                    {Array.from({ length: 10 }).map((_, j) => (
                                        <td key={j} className="px-3 py-4"><div className="h-4 rounded animate-pulse" style={{ background: '#1B2E3D', width: '70%' }} /></td>
                                    ))}
                                </tr>
                            ))
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={10}>
                                <div className="flex flex-col items-center py-16 gap-3">
                                    <Ship size={40} style={{ color: '#2A4355' }} />
                                    <p style={{ color: '#4A6A7A' }} className="text-sm">Chưa có lô hàng nào</p>
                                    <button onClick={() => setCreateOpen(true)} className="text-xs px-3 py-1.5 rounded-lg"
                                        style={{ color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                        + Tạo lô hàng đầu tiên
                                    </button>
                                </div>
                            </td></tr>
                        ) : rows.map(row => {
                            const st = STATUS_CFG[row.status] ?? { label: row.status, color: '#4A6A7A' }
                            return (
                                <tr key={row.id} className="group"
                                    style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(61,43,31,0.3)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                    <td className="px-3 py-3">
                                        <button onClick={() => { setSelectedId(row.id); setDetailOpen(true) }}
                                            className="text-xs font-bold hover:underline" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                            {row.billOfLading}
                                        </button>
                                    </td>
                                    <td className="px-3 py-3 text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{row.poNo}</td>
                                    <td className="px-3 py-3 text-xs" style={{ color: '#E8F1F2' }}>{row.supplierName}</td>
                                    <td className="px-3 py-3 text-xs" style={{ color: '#8AAEBB' }}>{row.vesselName ?? '—'}</td>
                                    <td className="px-3 py-3 text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>{row.containerNo ?? '—'}</td>
                                    <td className="px-3 py-3">
                                        <div className="text-[10px]" style={{ color: '#4A6A7A' }}>{row.portOfLoading ?? '—'}</div>
                                        <div className="text-[10px]" style={{ color: '#8AAEBB' }}>→ {row.portOfDischarge ?? '—'}</div>
                                    </td>
                                    <td className="px-3 py-3 text-xs" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{fmtDate(row.eta)}</td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-14 h-1.5 rounded-full" style={{ background: '#2A4355' }}>
                                                <div className="h-full rounded-full transition-all" style={{ background: '#5BA88A', width: `${row.milestoneProgress}%` }} />
                                            </div>
                                            <span className="text-[10px] font-bold" style={{ color: '#5BA88A', fontFamily: '"DM Mono"' }}>{row.milestoneProgress}%</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                                            style={{ color: st.color, background: `${st.color}20` }}>{st.label}</span>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setSelectedId(row.id); setDetailOpen(true) }}
                                                className="p-1 rounded" title="Chi tiết"
                                                style={{ color: '#4A8FAB' }}><Eye size={14} /></button>
                                            <button onClick={() => setLandedCostId(row.id)}
                                                className="p-1 rounded" title="Giá vốn"
                                                style={{ color: '#D4A853' }}><BarChart3 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Total */}
            {total > 0 && (
                <p className="text-xs text-right" style={{ color: '#4A6A7A' }}>
                    Hiển thị {rows.length} / {total} lô hàng
                </p>
            )}

            {/* Drawers & Modals */}
            <CreateShipmentDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
            <ShipmentDetailDrawer open={detailOpen} shipmentId={selectedId} onClose={() => { setDetailOpen(false); setSelectedId(null) }} />
            {landedCostId && <LandedCostModal shipmentId={landedCostId} onClose={() => setLandedCostId(null)} />}
        </div>
    )
}
