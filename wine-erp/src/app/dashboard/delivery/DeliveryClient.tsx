'use client'

import { useState, useCallback } from 'react'
import { Truck, MapPin, Package, CheckCircle2, Clock, Plus, X, Save, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import {
    DeliveryRouteRow, DriverOption, VehicleOption, RouteStopRow,
    getDeliveryRoutes, updateRouteStatus, createDeliveryRoute, getDriversAndVehicles,
    getRouteStops, recordEPOD
} from './actions'
import { formatVND, formatDate } from '@/lib/utils'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    PLANNED: { label: 'Đã Lập Kế Hoạch', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)' },
    IN_PROGRESS: { label: 'Đang Giao', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    COMPLETED: { label: 'Hoàn Thành', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    CANCELLED: { label: 'Huỷ', color: '#8B1A2E', bg: 'rgba(139,26,46,0.12)' },
}

const NEXT_STATUS: Record<string, string> = {
    PLANNED: 'IN_PROGRESS',
    IN_PROGRESS: 'COMPLETED',
}

const VEHICLE_LABEL: Record<string, string> = {
    MOTORCYCLE: '🛵 Xe Máy',
    VAN: '🚐 Xe Van',
    TRUCK_1T: '🚚 Tải 1T',
    TRUCK_2T: '🚚 Tải 2T',
    REFRIGERATED: '❄️ Lạnh',
}

// ── E-POD Drawer — Confirm delivery at each stop ──────────
function EPODDrawer({ open, routeId, onClose }: {
    open: boolean; routeId: string | null; onClose: () => void
}) {
    const [stops, setStops] = useState<RouteStopRow[]>([])
    const [loading, setLoading] = useState(false)
    const [confirmingId, setConfirmingId] = useState<string | null>(null)
    const [confirmName, setConfirmName] = useState('')
    const [confirmNotes, setConfirmNotes] = useState('')
    const [activeStopId, setActiveStopId] = useState<string | null>(null)
    const [successId, setSuccessId] = useState<string | null>(null)

    const loadStops = useCallback(async () => {
        if (!routeId) return
        setLoading(true)
        const data = await getRouteStops(routeId)
        setStops(data)
        setLoading(false)
    }, [routeId])

    if (!open || !routeId) return null
    if (stops.length === 0 && !loading) { loadStops() }

    const handleConfirm = async (stopId: string) => {
        if (!confirmName.trim()) return
        setConfirmingId(stopId)
        const result = await recordEPOD({
            stopId,
            confirmedBy: confirmName.trim(),
            notes: confirmNotes.trim() || undefined,
        })
        if (result.success) {
            setSuccessId(stopId)
            setActiveStopId(null)
            setConfirmName('')
            setConfirmNotes('')
            await loadStops()
            setTimeout(() => setSuccessId(null), 2000)
        }
        setConfirmingId(null)
    }

    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }

    const STOP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
        PENDING: { label: 'Chờ Giao', color: '#D4A853', bg: 'rgba(212,168,83,0.12)' },
        DELIVERED: { label: 'Đã Giao', color: '#5BA88A', bg: 'rgba(91,168,138,0.12)' },
        FAILED: { label: 'Thất Bại', color: '#E05252', bg: 'rgba(224,82,82,0.12)' },
    }

    return (
        <>
            <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col"
                style={{ width: 'min(520px,95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(91,168,138,0.15)' }}>
                            <CheckCircle2 size={16} style={{ color: '#5BA88A' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>
                                E-POD — Xác Nhận Giao Hàng
                            </h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                Xác nhận từng điểm dừng — Tên người nhận, ghi chú
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                        </div>
                    ) : stops.length === 0 ? (
                        <div className="text-center py-16">
                            <MapPin size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                            <p className="text-sm" style={{ color: '#4A6A7A' }}>Lộ trình chưa có điểm dừng nào</p>
                        </div>
                    ) : stops.map(stop => {
                        const cfg = STOP_STATUS[stop.status] ?? STOP_STATUS.PENDING
                        const isActive = activeStopId === stop.id
                        const isSuccess = successId === stop.id
                        const isDelivered = stop.status === 'DELIVERED'

                        return (
                            <div key={stop.id} className="p-4 rounded-md transition-all"
                                style={{
                                    background: isSuccess ? 'rgba(91,168,138,0.06)' : '#1B2E3D',
                                    border: `1px solid ${isSuccess ? 'rgba(91,168,138,0.3)' : '#2A4355'}`,
                                }}>
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                                            style={{
                                                background: isDelivered ? 'rgba(91,168,138,0.15)' : 'rgba(212,168,83,0.15)',
                                                color: isDelivered ? '#5BA88A' : '#D4A853',
                                            }}>
                                            {stop.sequence}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{stop.customerName}</p>
                                            <p className="text-xs" style={{ color: '#4A6A7A' }}>{stop.customerAddress || 'Không có địa chỉ'}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                        style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                                </div>

                                <div className="flex items-center gap-4 mb-2">
                                    <span className="text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>
                                        SO: {stop.soNo}
                                    </span>
                                    <span className="text-xs" style={{ color: '#4A6A7A' }}>
                                        {stop.itemCount} dòng SP
                                    </span>
                                    {stop.codAmount > 0 && (
                                        <span className="text-xs font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                                            COD: {formatVND(stop.codAmount)}
                                        </span>
                                    )}
                                </div>

                                {isDelivered && stop.podSignedAt && (
                                    <div className="flex items-center gap-2 p-2 rounded" style={{ background: 'rgba(91,168,138,0.06)' }}>
                                        <CheckCircle2 size={12} style={{ color: '#5BA88A' }} />
                                        <span className="text-xs" style={{ color: '#5BA88A' }}>
                                            Đã xác nhận lúc {new Date(stop.podSignedAt).toLocaleString('vi-VN')}
                                            {stop.notes && ` — ${stop.notes}`}
                                        </span>
                                    </div>
                                )}

                                {!isDelivered && !isActive && (
                                    <button onClick={() => { setActiveStopId(stop.id); setConfirmName(''); setConfirmNotes('') }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded mt-1 transition-all"
                                        style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.2)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(135,203,185,0.2)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(135,203,185,0.1)'}>
                                        <CheckCircle2 size={12} /> Xác Nhận Giao
                                    </button>
                                )}

                                {isActive && (
                                    <div className="mt-3 p-3 rounded-md space-y-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                        <div>
                                            <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>
                                                Người Nhận <span style={{ color: '#8B1A2E' }}>*</span>
                                            </label>
                                            <input type="text" value={confirmName}
                                                onChange={e => setConfirmName(e.target.value)}
                                                placeholder="Tên người nhận hàng"
                                                className="w-full px-3 py-2 text-sm outline-none"
                                                style={inputStyle}
                                                onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                                onBlur={e => e.currentTarget.style.borderColor = '#2A4355'} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>
                                                Ghi Chú (Tùy chọn)
                                            </label>
                                            <textarea value={confirmNotes}
                                                onChange={e => setConfirmNotes(e.target.value)}
                                                placeholder="VD: Giao tại quầy bar, bàn giao cho anh Minh"
                                                rows={2}
                                                className="w-full px-3 py-2 text-sm outline-none resize-none"
                                                style={inputStyle}
                                                onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                                onBlur={e => e.currentTarget.style.borderColor = '#2A4355'} />
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => setActiveStopId(null)}
                                                className="px-3 py-1.5 text-xs rounded"
                                                style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>Huỷ</button>
                                            <button onClick={() => handleConfirm(stop.id)}
                                                disabled={!confirmName.trim() || !!confirmingId}
                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded disabled:opacity-50"
                                                style={{ background: '#5BA88A', color: '#fff' }}>
                                                {confirmingId === stop.id
                                                    ? <><Loader2 size={12} className="animate-spin" /> Đang lưu...</>
                                                    : <><CheckCircle2 size={12} /> Xác Nhận</>}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Summary footer */}
                {stops.length > 0 && (
                    <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #2A4355', background: '#142433' }}>
                        <span className="text-xs" style={{ color: '#4A6A7A' }}>
                            {stops.filter(s => s.status === 'DELIVERED').length}/{stops.length} điểm đã giao
                        </span>
                        <div className="flex-1 mx-4 h-1.5 rounded-full" style={{ background: '#0D1E2B' }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{
                                width: `${stops.length > 0 ? (stops.filter(s => s.status === 'DELIVERED').length / stops.length) * 100 : 0}%`,
                                background: '#5BA88A',
                            }} />
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

// ── Create Route Drawer ────────────────────────────────────
function CreateRouteDrawer({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: () => void
}) {
    const [form, setForm] = useState({ routeDate: new Date().toISOString().slice(0, 10), driverId: '', vehicleId: '' })
    const [options, setOptions] = useState<{ drivers: DriverOption[]; vehicles: VehicleOption[] } | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // Load drivers & vehicles when drawer opens
    const handleOpen = useCallback(async () => {
        if (!options) {
            const data = await getDriversAndVehicles()
            setOptions(data)
        }
    }, [options])

    if (!open) return null

    // Trigger load once mounted
    if (!options) { handleOpen(); }

    const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none'
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    const handleSave = async () => {
        if (!form.driverId || !form.vehicleId) return setError('Chọn tài xế và phương tiện')
        setSaving(true)
        const result = await createDeliveryRoute(form)
        setSaving(false)
        if (result.success) { onCreated(); onClose() }
        else setError(result.error ?? 'Lỗi tạo lộ trình')
    }

    return (
        <>
            <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300"
                style={{ width: 'min(460px,95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(135,203,185,0.15)' }}>
                            <Truck size={16} style={{ color: '#87CBB9' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>
                                Tạo Lộ Trình Mới
                            </h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Chỉ định tài xế và phương tiện</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {error && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                            style={{ background: 'rgba(139,26,46,0.15)', border: '1px solid rgba(139,26,46,0.4)', color: '#E05252' }}>
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>
                            Ngày Giao <span style={{ color: '#8B1A2E' }}>*</span>
                        </label>
                        <input type="date" className={inputCls} style={inputStyle}
                            value={form.routeDate}
                            onChange={e => setForm(f => ({ ...f, routeDate: e.target.value }))}
                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>
                            Tài Xế <span style={{ color: '#8B1A2E' }}>*</span>
                        </label>
                        {!options ? (
                            <div className="flex items-center gap-2 text-xs" style={{ color: '#4A6A7A' }}>
                                <Loader2 size={12} className="animate-spin" /> Đang tải...
                            </div>
                        ) : (
                            <select className={inputCls} style={inputStyle} value={form.driverId}
                                onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <option value="">— Chọn tài xế —</option>
                                {options.drivers.map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>
                            Phương Tiện <span style={{ color: '#8B1A2E' }}>*</span>
                        </label>
                        {!options ? null : (
                            <select className={inputCls} style={inputStyle} value={form.vehicleId}
                                onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                <option value="">— Chọn phương tiện —</option>
                                {options.vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{VEHICLE_LABEL[v.type] ?? v.type} • {v.plateNo}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #2A4355' }}>
                    <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm"
                        style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>Hủy</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Đang tạo...' : 'Tạo Lộ Trình'}
                    </button>
                </div>
            </div>
        </>
    )
}

interface Props {
    initialRows: DeliveryRouteRow[]
    initialTotal: number
    stats: { todayRoutes: number; pending: number; delivered: number; inProgress: number }
}

export function DeliveryClient({ initialRows, initialTotal, stats: initStats }: Props) {
    const [rows, setRows] = useState(initialRows)
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [epodRouteId, setEpodRouteId] = useState<string | null>(null)

    const reload = async (s?: string) => {
        setLoading(true)
        const { rows } = await getDeliveryRoutes({ status: (s ?? statusFilter) || undefined, pageSize: 20 })
        setRows(rows)
        setLoading(false)
    }

    const handleStatusAdvance = async (routeId: string, nextStatus: string) => {
        setUpdatingId(routeId)
        await updateRouteStatus(routeId, nextStatus as any)
        await reload()
        setUpdatingId(null)
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Vận Chuyển & Giao Hàng (TRS)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Lộ trình giao hàng, E-POD, COD collection
                    </p>
                </div>
                <button onClick={() => setDrawerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                    <Plus size={16} /> Tạo Lộ Trình
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Lộ Trình Hôm Nay', value: initStats.todayRoutes, icon: Truck, accent: '#87CBB9' },
                    { label: 'Đang Giao', value: initStats.inProgress, icon: MapPin, accent: '#D4A853' },
                    { label: 'Điểm Dừng Chờ Giao', value: initStats.pending, icon: Clock, accent: '#4A8FAB' },
                    { label: 'Đã Giao Thành Công', value: initStats.delivered, icon: CheckCircle2, accent: '#5BA88A' },
                ].map(s => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="p-4 rounded-md flex items-center gap-4"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: `3px solid ${s.accent}` }}>
                            <Icon size={20} style={{ color: s.accent }} />
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>{s.label}</p>
                                <p className="text-xl font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>{s.value}</p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Filter */}
            <div className="flex gap-3">
                <select value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); reload(e.target.value) }}
                    className="px-3 py-2 text-sm outline-none"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: statusFilter ? '#E8F1F2' : '#4A6A7A', borderRadius: '6px' }}>
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(STATUS_CFG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['Ngày', 'Tài Xế', 'Phương Tiện', 'Điểm Dừng', 'Tiến Độ', 'COD', 'Trạng Thái', 'Action'].map(h => (
                                <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: '#4A6A7A' }}>Đang tải...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-16" style={{ color: '#4A6A7A' }}>
                                <Truck size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                                <p>Chưa có lộ trình giao hàng nào</p>
                            </td></tr>
                        ) : rows.map(row => {
                            const pct = row.stopCount > 0 ? Math.round((row.deliveredCount / row.stopCount) * 100) : 0
                            const cfg = STATUS_CFG[row.status] ?? { label: row.status, color: '#8AAEBB', bg: 'transparent' }
                            const nextStatus = NEXT_STATUS[row.status]
                            const isUpdating = updatingId === row.id
                            return (
                                <tr key={row.id}
                                    style={{ borderBottom: '1px solid rgba(42,67,85,0.5)', cursor: 'pointer' }}
                                    onClick={() => setEpodRouteId(row.id)}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <td className="px-4 py-3 text-sm" style={{ color: '#E8F1F2' }}>{formatDate(row.routeDate)}</td>
                                    <td className="px-4 py-3 text-sm" style={{ color: '#E8F1F2' }}>{row.driverName}</td>
                                    <td className="px-4 py-3 text-xs" style={{ color: '#8AAEBB' }}>
                                        {VEHICLE_LABEL[row.vehicleType] ?? row.vehicleType}<br />
                                        <span style={{ fontFamily: '"DM Mono"' }}>{row.vehiclePlate}</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>
                                        {row.stopCount} điểm
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#142433', minWidth: 60 }}>
                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? '#5BA88A' : '#D4A853' }} />
                                            </div>
                                            <span className="text-xs font-bold" style={{ color: '#8AAEBB' }}>{row.deliveredCount}/{row.stopCount}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>
                                        {row.totalCod > 0 ? formatVND(row.totalCod) : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                            style={{ color: cfg.color, background: cfg.bg }}>
                                            {cfg.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {nextStatus && (
                                            <button
                                                onClick={() => handleStatusAdvance(row.id, nextStatus)}
                                                disabled={isUpdating}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded disabled:opacity-50"
                                                style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.25)' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.22)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.12)')}>
                                                {isUpdating
                                                    ? <Loader2 size={11} className="animate-spin" />
                                                    : <ChevronDown size={11} />}
                                                {STATUS_CFG[nextStatus]?.label ?? nextStatus}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <CreateRouteDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onCreated={() => reload()}
            />

            <EPODDrawer
                open={!!epodRouteId}
                routeId={epodRouteId}
                onClose={() => { setEpodRouteId(null); reload() }}
            />
        </div>
    )
}
