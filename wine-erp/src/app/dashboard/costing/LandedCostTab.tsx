'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    Ship, Plus, Loader2, ChevronRight, Calculator,
    CheckCircle2, Lock, AlertTriangle, Package, X, ArrowLeft, Wine
} from 'lucide-react'
import {
    ShipmentForCampaign, LandedCostCampaignRow,
    getShipmentsForCampaign, getLandedCostCampaigns,
    createLandedCostCampaign, getLandedCostCampaignDetail,
    calculateLandedCostProration, finalizeLandedCostCampaign,
    updateLandedCostCampaign
} from './actions'
import { formatVND, formatDate } from '@/lib/utils'

const card: React.CSSProperties = { background: '#1B2E3D', border: '1px solid #2A4355', borderRadius: '8px' }
const inputStyle: React.CSSProperties = {
    background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px',
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    CONFIRMED: { label: 'Đã Tính', color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)' },
    ALLOCATED: { label: 'Hoàn Tất', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
}

const SHIPMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
    BOOKED: { label: 'Booked', color: '#4A6A7A' },
    ON_VESSEL: { label: 'On Vessel', color: '#4A8FAB' },
    ARRIVED_PORT: { label: 'Arrived Port', color: '#D4A853' },
    CUSTOMS_CLEARED: { label: 'Customs Cleared', color: '#87CBB9' },
    DELIVERED_TO_WAREHOUSE: { label: 'Delivered', color: '#5BA88A' },
}

const WINE_COLORS: Record<string, string> = {
    RED: '#8B1A2E', WHITE: '#D4A853', ROSE: '#C45A2A',
    SPARKLING: '#87CBB9', FORTIFIED: '#4A8FAB', DESSERT: '#A5DED0',
}

export function LandedCostTab() {
    const [campaigns, setCampaigns] = useState<LandedCostCampaignRow[]>([])
    const [loaded, setLoaded] = useState(false)
    const [loading, setLoading] = useState(false)

    // Create mode
    const [showCreate, setShowCreate] = useState(false)
    const [shipments, setShipments] = useState<ShipmentForCampaign[]>([])
    const [shipmentsLoading, setShipmentsLoading] = useState(false)
    const [selectedShipment, setSelectedShipment] = useState<ShipmentForCampaign | null>(null)
    const [createForm, setCreateForm] = useState({ importTax: '', sct: '', vat: '', other: '' })
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState('')

    // Detail mode
    const [detail, setDetail] = useState<any>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [calculating, setCalculating] = useState(false)
    const [finalizing, setFinalizing] = useState(false)
    const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

    // Edit cost figures
    const [editMode, setEditMode] = useState(false)
    const [editForm, setEditForm] = useState({ importTax: '', sct: '', vat: '', other: '' })

    const loadCampaigns = useCallback(async () => {
        setLoading(true)
        const data = await getLandedCostCampaigns()
        setCampaigns(data)
        setLoaded(true)
        setLoading(false)
    }, [])

    useEffect(() => { loadCampaigns() }, [loadCampaigns])

    // ── Create Flow ─────────────────────────
    const openCreate = async () => {
        setShowCreate(true)
        setShipmentsLoading(true)
        setSelectedShipment(null)
        setCreateForm({ importTax: '', sct: '', vat: '', other: '' })
        setCreateError('')
        const data = await getShipmentsForCampaign()
        setShipments(data)
        setShipmentsLoading(false)
    }

    const handleCreate = async () => {
        if (!selectedShipment) return
        setCreating(true)
        setCreateError('')
        const result = await createLandedCostCampaign({
            shipmentId: selectedShipment.id,
            totalImportTax: Number(createForm.importTax) || 0,
            totalSct: Number(createForm.sct) || 0,
            totalVat: Number(createForm.vat) || 0,
            totalOtherCost: Number(createForm.other) || 0,
        })
        if (result.success) {
            setShowCreate(false)
            await loadCampaigns()
            if (result.id) openDetail(result.id)
        } else {
            setCreateError(result.error || 'Lỗi tạo campaign')
        }
        setCreating(false)
    }

    // ── Detail Flow ─────────────────────────
    const openDetail = async (id: string) => {
        setDetailLoading(true)
        setActionMsg(null)
        setEditMode(false)
        const data = await getLandedCostCampaignDetail(id)
        setDetail(data)
        setDetailLoading(false)
    }

    const closeDetail = () => {
        setDetail(null)
        setActionMsg(null)
        setEditMode(false)
        loadCampaigns()
    }

    const handleCalculate = async () => {
        if (!detail) return
        setCalculating(true)
        setActionMsg(null)
        const result = await calculateLandedCostProration(detail.id)
        if (result.success) {
            setActionMsg({ type: 'ok', text: `Phân bổ thành công! ${result.allocations?.length ?? 0} SKU.` })
            await openDetail(detail.id)
        } else {
            setActionMsg({ type: 'err', text: result.error || 'Lỗi tính toán' })
        }
        setCalculating(false)
    }

    const handleFinalize = async () => {
        if (!detail) return
        setFinalizing(true)
        setActionMsg(null)
        const result = await finalizeLandedCostCampaign(detail.id)
        if (result.success) {
            setActionMsg({ type: 'ok', text: 'Hoàn tất! Giá vốn đã cập nhật vào StockLot.' })
            await openDetail(detail.id)
        } else {
            setActionMsg({ type: 'err', text: result.error || 'Lỗi finalize' })
        }
        setFinalizing(false)
    }

    const startEdit = () => {
        if (!detail || detail.status === 'ALLOCATED') return
        setEditMode(true)
        setEditForm({
            importTax: String(detail.totalImportTax),
            sct: String(detail.totalSct),
            vat: String(detail.totalVat),
            other: String(detail.totalOtherCost),
        })
    }

    const handleSaveEdit = async () => {
        if (!detail) return
        setCreating(true)
        const result = await updateLandedCostCampaign({
            id: detail.id,
            totalImportTax: Number(editForm.importTax) || 0,
            totalSct: Number(editForm.sct) || 0,
            totalVat: Number(editForm.vat) || 0,
            totalOtherCost: Number(editForm.other) || 0,
        })
        if (result.success) {
            setEditMode(false)
            await openDetail(detail.id)
            setActionMsg({ type: 'ok', text: 'Đã cập nhật chi phí.' })
        } else {
            setActionMsg({ type: 'err', text: result.error || 'Lỗi cập nhật' })
        }
        setCreating(false)
    }

    // ── Render Detail View ──────────────────
    if (detailLoading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 size={28} className="animate-spin" style={{ color: '#87CBB9' }} />
            </div>
        )
    }

    if (detail) {
        const st = STATUS_MAP[detail.status] ?? STATUS_MAP.DRAFT
        const isLocked = detail.status === 'ALLOCATED'
        const canCalculate = detail.status === 'DRAFT' || detail.status === 'CONFIRMED'
        const canFinalize = detail.status === 'CONFIRMED' && detail.allocations.length > 0

        return (
            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={closeDetail} className="p-1.5 rounded-md hover:bg-[#142433] transition-colors"
                            style={{ color: '#8AAEBB' }}>
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h3 className="text-base font-bold" style={{ color: '#E8F1F2' }}>
                                B/L: {detail.shipmentBol}
                            </h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                {detail.supplierName} • PO {detail.poNo} • {detail.vesselName || '—'}
                            </p>
                        </div>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full font-bold"
                        style={{ color: st.color, background: st.bg }}>
                        {st.label}
                    </span>
                </div>

                {/* Action messages */}
                {actionMsg && (
                    <div className="flex items-center gap-2 p-3 rounded-md" style={{
                        background: actionMsg.type === 'ok' ? 'rgba(91,168,138,0.1)' : 'rgba(224,82,82,0.1)',
                        border: `1px solid ${actionMsg.type === 'ok' ? 'rgba(91,168,138,0.3)' : 'rgba(224,82,82,0.3)'}`,
                    }}>
                        {actionMsg.type === 'ok'
                            ? <CheckCircle2 size={14} style={{ color: '#5BA88A' }} />
                            : <AlertTriangle size={14} style={{ color: '#E05252' }} />}
                        <span className="text-xs" style={{ color: actionMsg.type === 'ok' ? '#5BA88A' : '#E05252' }}>
                            {actionMsg.text}
                        </span>
                    </div>
                )}

                {/* Cost Summary */}
                <div className="p-4 rounded-md space-y-3" style={card}>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>
                            Chi Phí Container
                        </p>
                        {!isLocked && !editMode && (
                            <button onClick={startEdit} className="text-xs px-3 py-1 rounded-md"
                                style={{ color: '#87CBB9', border: '1px solid #2A4355' }}>
                                Sửa
                            </button>
                        )}
                    </div>

                    {editMode ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { key: 'importTax', label: 'Thuế nhập khẩu' },
                                    { key: 'sct', label: 'Thuế TTĐB (SCT)' },
                                    { key: 'vat', label: 'Thuế VAT' },
                                    { key: 'other', label: 'Chi phí khác (Logistics, phí cảng...)' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs block mb-1" style={{ color: '#4A6A7A' }}>{f.label}</label>
                                        <input type="number" value={(editForm as any)[f.key]}
                                            onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                                            onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                            onBlur={e => e.currentTarget.style.borderColor = '#2A4355'} />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setEditMode(false)} className="px-3 py-1.5 text-xs rounded-md"
                                    style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>Huỷ</button>
                                <button onClick={handleSaveEdit} disabled={creating}
                                    className="px-4 py-1.5 text-xs font-semibold rounded-md"
                                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                                    {creating ? 'Đang lưu...' : 'Lưu'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                {[
                                    { label: 'CIF', value: detail.cifAmount, color: '#8AAEBB', suffix: ` ${detail.cifCurrency}` },
                                    { label: 'Thuế NK', value: detail.totalImportTax, color: '#D4A853' },
                                    { label: 'Thuế TTĐB', value: detail.totalSct, color: '#E05252' },
                                    { label: 'VAT', value: detail.totalVat, color: '#4A8FAB' },
                                    { label: 'Chi phí khác', value: detail.totalOtherCost, color: '#87CBB9' },
                                ].map(s => (
                                    <div key={s.label} className="p-3 rounded-md" style={{ background: '#142433' }}>
                                        <p className="text-xs uppercase mb-0.5" style={{ color: '#4A6A7A' }}>{s.label}</p>
                                        <p className="text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: s.color }}>
                                            {s.label === 'CIF' ? `${s.value.toLocaleString('en-US')} ${(s as any).suffix}` : formatVND(s.value)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid #2A4355' }}>
                                <span className="text-xs font-semibold uppercase" style={{ color: '#4A6A7A' }}>
                                    Tổng Chi Phí Thuế & Logistics
                                </span>
                                <span className="text-lg font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                    {formatVND(detail.totalCost)}
                                </span>
                            </div>
                            {detail.exchangeRate > 0 && (
                                <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                    Tỷ giá PO: 1 {detail.cifCurrency} = {Number(detail.exchangeRate).toLocaleString('vi-VN')} VND
                                </p>
                            )}
                        </>
                    )}
                </div>

                {/* Action Buttons */}
                {!isLocked && (
                    <div className="flex gap-3">
                        <button onClick={handleCalculate} disabled={calculating || !canCalculate}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md transition-all"
                            style={{
                                background: canCalculate ? '#4A8FAB' : '#2A4355',
                                color: canCalculate ? '#fff' : '#4A6A7A',
                                cursor: canCalculate ? 'pointer' : 'not-allowed',
                            }}>
                            <Calculator size={16} />
                            {calculating ? 'Đang tính...' : 'Tính Phân Bổ (Prorate)'}
                        </button>
                        <button onClick={handleFinalize} disabled={finalizing || !canFinalize}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md transition-all"
                            style={{
                                background: canFinalize ? '#5BA88A' : '#2A4355',
                                color: canFinalize ? '#fff' : '#4A6A7A',
                                cursor: canFinalize ? 'pointer' : 'not-allowed',
                            }}>
                            <Lock size={16} />
                            {finalizing ? 'Đang xử lý...' : 'Lock & Cập Nhật StockLot'}
                        </button>
                    </div>
                )}

                {isLocked && (
                    <div className="flex items-center gap-2 p-3 rounded-md"
                        style={{ background: 'rgba(91,168,138,0.08)', border: '1px solid rgba(91,168,138,0.2)' }}>
                        <Lock size={14} style={{ color: '#5BA88A' }} />
                        <span className="text-xs font-medium" style={{ color: '#5BA88A' }}>
                            Campaign đã hoàn tất — Giá vốn đã cập nhật vào tất cả StockLot.
                        </span>
                    </div>
                )}

                {/* Allocations Table */}
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#4A6A7A' }}>
                        Phân Bổ Chi Phí Per SKU ({detail.allocations.length} sản phẩm)
                    </p>
                    {detail.allocations.length === 0 ? (
                        <div className="text-center py-12 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                            <Calculator size={28} className="mx-auto mb-2" style={{ color: '#2A4355' }} />
                            <p className="text-sm" style={{ color: '#4A6A7A' }}>
                                Chưa có phân bổ — Nhấn &quot;Tính Phân Bổ&quot; để hệ thống tự phân bổ chi phí theo số lượng chai
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                        {['SKU', 'Sản Phẩm', 'Số Chai', 'Giá Vốn/Chai', 'Tổng Phân Bổ', '% Tỷ Trọng'].map(h => (
                                            <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                                style={{ color: '#4A6A7A' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {detail.allocations.map((a: any) => {
                                        const totalQty = detail.allocations.reduce((s: number, x: any) => s + x.qty, 0)
                                        const pct = totalQty > 0 ? (a.qty / totalQty) * 100 : 0
                                        const typeColor = WINE_COLORS[a.wineType] ?? '#8AAEBB'
                                        return (
                                            <tr key={a.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                                onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                                                        style={{ background: `${typeColor}25`, color: typeColor }}>
                                                        {a.skuCode}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-medium truncate max-w-[200px]"
                                                    style={{ color: '#E8F1F2' }}>{a.productName}</td>
                                                <td className="px-3 py-2.5 text-xs font-bold"
                                                    style={{ fontFamily: '"DM Mono"', color: '#8AAEBB' }}>
                                                    {a.qty.toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-bold"
                                                    style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                                    {formatVND(a.unitLandedCost)}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-bold"
                                                    style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>
                                                    {formatVND(a.totalCost)}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 rounded-full" style={{ background: '#142433' }}>
                                                            <div className="h-full rounded-full" style={{
                                                                width: `${Math.min(pct, 100)}%`,
                                                                background: '#87CBB9',
                                                            }} />
                                                        </div>
                                                        <span className="text-xs" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                                            {pct.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {/* Total row */}
                                    <tr style={{ background: 'rgba(135,203,185,0.06)', borderTop: '2px solid #2A4355' }}>
                                        <td colSpan={2} className="px-3 py-3 text-xs font-bold uppercase"
                                            style={{ color: '#87CBB9' }}>Tổng Cộng</td>
                                        <td className="px-3 py-3 text-xs font-bold"
                                            style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>
                                            {detail.allocations.reduce((s: number, a: any) => s + a.qty, 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-3 text-xs" style={{ color: '#4A6A7A' }}>—</td>
                                        <td className="px-3 py-3 text-xs font-bold"
                                            style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>
                                            {formatVND(detail.allocations.reduce((s: number, a: any) => s + a.totalCost, 0))}
                                        </td>
                                        <td className="px-3 py-3 text-xs font-bold"
                                            style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>100%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ── Render Campaign List ────────────────
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: '#8AAEBB' }}>
                    <Ship size={14} className="inline mr-1.5" />
                    {campaigns.length} campaign
                </p>
                <button onClick={openCreate}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    <Plus size={14} /> Tạo Campaign
                </button>
            </div>

            {/* Create Drawer */}
            {showCreate && (
                <div className="p-5 rounded-md space-y-4" style={card}>
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Tạo Landed Cost Campaign</h4>
                        <button onClick={() => setShowCreate(false)} className="p-1 rounded"
                            style={{ color: '#4A6A7A' }}><X size={16} /></button>
                    </div>

                    {/* Step 1: Select Shipment */}
                    {shipmentsLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 size={20} className="animate-spin" style={{ color: '#87CBB9' }} />
                        </div>
                    ) : !selectedShipment ? (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase" style={{ color: '#4A6A7A' }}>
                                Bước 1: Chọn Shipment chưa có Campaign
                            </p>
                            {shipments.length === 0 ? (
                                <div className="text-center py-8 rounded-md" style={{ background: '#142433', border: '1px dashed #2A4355' }}>
                                    <Ship size={28} className="mx-auto mb-2" style={{ color: '#2A4355' }} />
                                    <p className="text-sm" style={{ color: '#4A6A7A' }}>
                                        Tất cả Shipments đã có Campaign hoặc chưa có Shipment nào
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {shipments.map(s => {
                                        const ss = SHIPMENT_STATUS_MAP[s.status] ?? SHIPMENT_STATUS_MAP.BOOKED
                                        return (
                                            <button key={s.id} onClick={() => setSelectedShipment(s)}
                                                className="w-full text-left p-3 rounded-md flex items-center justify-between group transition-all"
                                                style={{ background: '#142433', border: '1px solid #2A4355' }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = '#2A4355'}>
                                                <div>
                                                    <p className="text-xs font-bold" style={{ color: '#E8F1F2' }}>
                                                        B/L: {s.billOfLading}
                                                    </p>
                                                    <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>
                                                        {s.supplierName} • {s.poNo} • {s.vesselName || 'No vessel'}
                                                    </p>
                                                    <div className="flex gap-3 mt-1">
                                                        <span className="text-xs" style={{ fontFamily: '"DM Mono"', color: '#8AAEBB' }}>
                                                            CIF: {s.cifAmount.toLocaleString('en-US')} {s.cifCurrency}
                                                        </span>
                                                        <span className="text-xs" style={{ color: '#4A6A7A' }}>
                                                            {s.lotCount} lô hàng
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs px-2 py-0.5 rounded font-semibold"
                                                        style={{ color: ss.color, background: `${ss.color}18` }}>{ss.label}</span>
                                                    <ChevronRight size={14} style={{ color: '#4A6A7A' }} />
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        // Step 2: Enter costs
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase" style={{ color: '#4A6A7A' }}>
                                    Bước 2: Nhập Chi Phí Thực Tế
                                </p>
                                <button onClick={() => setSelectedShipment(null)}
                                    className="text-xs px-2 py-1 rounded" style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>
                                    ← Đổi Shipment
                                </button>
                            </div>

                            <div className="p-3 rounded-md" style={{ background: '#142433' }}>
                                <p className="text-xs font-bold" style={{ color: '#E8F1F2' }}>
                                    B/L: {selectedShipment.billOfLading}
                                </p>
                                <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                    {selectedShipment.supplierName} • CIF: {selectedShipment.cifAmount.toLocaleString('en-US')} {selectedShipment.cifCurrency}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { key: 'importTax', label: 'Thuế Nhập Khẩu (VND)', placeholder: 'VD: 127500000' },
                                    { key: 'sct', label: 'Thuế TTĐB / SCT (VND)', placeholder: 'VD: 248625000' },
                                    { key: 'vat', label: 'Thuế VAT (VND)', placeholder: 'VD: 63112500' },
                                    { key: 'other', label: 'Chi phí khác (THC, D/O, logistics...)', placeholder: 'VD: 15000000' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>
                                            {f.label}
                                        </label>
                                        <input type="number" value={(createForm as any)[f.key]}
                                            onChange={e => setCreateForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            placeholder={f.placeholder}
                                            className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                                            onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                            onBlur={e => e.currentTarget.style.borderColor = '#2A4355'} />
                                    </div>
                                ))}
                            </div>

                            {/* Total preview */}
                            <div className="flex justify-between items-center p-3 rounded-md" style={{ background: '#142433' }}>
                                <span className="text-xs uppercase font-semibold" style={{ color: '#4A6A7A' }}>
                                    Tổng Chi Phí
                                </span>
                                <span className="text-base font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                    {formatVND(
                                        (Number(createForm.importTax) || 0)
                                        + (Number(createForm.sct) || 0)
                                        + (Number(createForm.vat) || 0)
                                        + (Number(createForm.other) || 0)
                                    )}
                                </span>
                            </div>

                            {createError && (
                                <p className="text-xs flex items-center gap-1" style={{ color: '#E05252' }}>
                                    <AlertTriangle size={12} /> {createError}
                                </p>
                            )}

                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs rounded-md"
                                    style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>Huỷ</button>
                                <button onClick={handleCreate} disabled={creating}
                                    className="px-5 py-2 text-xs font-semibold rounded-md"
                                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                                    {creating ? 'Đang tạo...' : 'Tạo Campaign'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Campaign List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                </div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-16 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                    <Ship size={36} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>
                        Chưa có Landed Cost Campaign nào
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#2A4355' }}>
                        Tạo campaign cho mỗi container nhập khẩu để tính giá vốn thực tế
                    </p>
                </div>
            ) : (
                <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                {['B/L', 'NCC / Tàu', 'CIF', 'Tổng Thuế & CP', 'Trạng Thái', 'Phân Bổ', 'Ngày Tạo', ''].map(h => (
                                    <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                        style={{ color: '#4A6A7A' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {campaigns.map(c => {
                                const st = STATUS_MAP[c.status] ?? STATUS_MAP.DRAFT
                                return (
                                    <tr key={c.id}
                                        onClick={() => openDetail(c.id)}
                                        style={{ borderBottom: '1px solid rgba(42,67,85,0.5)', cursor: 'pointer' }}
                                        onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                        onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>
                                                {c.shipmentBol || '—'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <p className="text-xs font-medium" style={{ color: '#E8F1F2' }}>
                                                {c.supplierName || '—'}
                                            </p>
                                            <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                                {c.vesselName || '—'}
                                            </p>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-bold"
                                            style={{ fontFamily: '"DM Mono"', color: '#8AAEBB' }}>
                                            {c.cifAmount > 0 ? `$${c.cifAmount.toLocaleString('en-US')}` : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-sm font-bold"
                                            style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                            {formatVND(c.totalCost)}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs px-2 py-0.5 rounded font-semibold"
                                                style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>
                                            {c.allocationCount > 0 ? `${c.allocationCount} SKU` : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>
                                            {formatDate(c.createdAt)}
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
        </div>
    )
}
