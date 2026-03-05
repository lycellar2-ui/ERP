'use client'

import { useState } from 'react'
import { Plus, Trash2, MapPin, Thermometer, Loader2 } from 'lucide-react'
import { type LocationRow, getLocations, createLocation, deleteLocation, getLocationHeatmap } from './actions'

type HeatmapItem = { zone: string; totalLocations: number; usedLocations: number; totalCapacity: number; usedBottles: number; occupancyPct: number; hasTempControl: boolean }

export function LocationManager({ warehouseId, warehouseName, initialLocations }: {
    warehouseId: string
    warehouseName: string
    initialLocations: LocationRow[]
}) {
    const [locations, setLocations] = useState(initialLocations)
    const [heatmap, setHeatmap] = useState<HeatmapItem[]>([])
    const [showCreate, setShowCreate] = useState(false)
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ zone: '', rack: '', bin: '', type: 'STORAGE', capacityCases: '', tempControlled: false })

    const refresh = async () => {
        const [locs, hm] = await Promise.all([
            getLocations(warehouseId),
            getLocationHeatmap(warehouseId),
        ])
        setLocations(locs)
        setHeatmap(hm as any)
    }

    const handleCreate = async () => {
        setLoading(true)
        await createLocation({
            warehouseId,
            zone: form.zone,
            rack: form.rack || null,
            bin: form.bin || null,
            type: form.type as any,
            capacityCases: form.capacityCases ? Number(form.capacityCases) : null,
            tempControlled: form.tempControlled,
        })
        setForm({ zone: '', rack: '', bin: '', type: 'STORAGE', capacityCases: '', tempControlled: false })
        setShowCreate(false)
        await refresh()
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa vị trí này?')) return
        const res = await deleteLocation(id)
        if (!res.success) alert(res.error)
        else await refresh()
    }

    const typeColor: Record<string, string> = {
        STORAGE: '#87CBB9', RECEIVING: '#4A8FAB', SHIPPING: '#D4A853', QUARANTINE: '#E05252', VIRTUAL: '#4A6A7A',
    }

    // Group locations by zone
    const byZone = locations.reduce<Record<string, LocationRow[]>>((acc, loc) => {
        acc[loc.zone] = acc[loc.zone] || []
        acc[loc.zone].push(loc)
        return acc
    }, {})

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>
                    <MapPin size={14} className="inline mr-1" /> Vị Trí Kho: {warehouseName}
                </h3>
                <div className="flex gap-2">
                    <button onClick={() => refresh()} className="text-xs px-3 py-1.5 rounded"
                        style={{ border: '1px solid #2A4355', color: '#87CBB9' }}>
                        Heatmap
                    </button>
                    <button onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-semibold"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        <Plus size={12} /> Thêm Vị Trí
                    </button>
                </div>
            </div>

            {/* Heatmap */}
            {heatmap.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {heatmap.map(h => (
                        <div key={h.zone} className="p-3 rounded-md" style={{
                            background: '#1B2E3D',
                            borderLeft: `3px solid ${h.occupancyPct > 85 ? '#E05252' : h.occupancyPct > 60 ? '#D4A853' : '#5BA88A'}`,
                        }}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold" style={{ color: '#E8F1F2' }}>{h.zone}</span>
                                {h.hasTempControl && <Thermometer size={12} style={{ color: '#4A8FAB' }} />}
                            </div>
                            <div className="w-full h-2 rounded-full mb-1.5" style={{ background: '#142433' }}>
                                <div className="h-full rounded-full transition-all" style={{
                                    width: `${Math.min(100, h.occupancyPct)}%`,
                                    background: h.occupancyPct > 85 ? '#E05252' : h.occupancyPct > 60 ? '#D4A853' : '#5BA88A',
                                }} />
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[10px]" style={{ color: '#4A6A7A' }}>
                                    {h.usedLocations}/{h.totalLocations} vị trí
                                </span>
                                <span className="text-[10px] font-bold" style={{
                                    color: h.occupancyPct > 85 ? '#E05252' : h.occupancyPct > 60 ? '#D4A853' : '#5BA88A',
                                }}>
                                    {h.occupancyPct}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <div className="p-4 rounded-md space-y-3" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <h4 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Thêm Vị Trí Mới</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                            { label: 'Zone *', key: 'zone', placeholder: 'A, B, C...' },
                            { label: 'Rack', key: 'rack', placeholder: '01, 02...' },
                            { label: 'Bin', key: 'bin', placeholder: '01, 02...' },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>{f.label}</label>
                                <input value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                                    placeholder={f.placeholder}
                                    className="w-full px-3 py-2 text-xs rounded outline-none"
                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                            </div>
                        ))}
                        <div>
                            <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Loại</label>
                            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                                className="w-full px-3 py-2 text-xs rounded"
                                style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                {['STORAGE', 'RECEIVING', 'SHIPPING', 'QUARANTINE', 'VIRTUAL'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Sức chứa (thùng)</label>
                            <input type="number" value={form.capacityCases} onChange={e => setForm({ ...form, capacityCases: e.target.value })}
                                className="w-full px-3 py-2 text-xs rounded outline-none"
                                style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.tempControlled} onChange={e => setForm({ ...form, tempControlled: e.target.checked })}
                                    className="w-4 h-4 accent-emerald-500" />
                                <span className="text-xs" style={{ color: '#8AAEBB' }}>
                                    <Thermometer size={12} className="inline mr-1" />Kiểm soát nhiệt độ
                                </span>
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowCreate(false)} className="text-xs px-4 py-2 rounded"
                            style={{ color: '#4A6A7A' }}>Hủy</button>
                        <button onClick={handleCreate} disabled={!form.zone || loading}
                            className="text-xs px-4 py-2 rounded font-semibold"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            {loading ? <Loader2 size={12} className="animate-spin" /> : 'Tạo'}
                        </button>
                    </div>
                </div>
            )}

            {/* Location Table by Zone */}
            {Object.entries(byZone).map(([zone, locs]) => (
                <div key={zone} className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    <div className="px-4 py-2 flex items-center justify-between"
                        style={{ background: '#142433' }}>
                        <span className="text-xs font-bold" style={{ color: '#87CBB9' }}>Zone {zone}</span>
                        <span className="text-[10px]" style={{ color: '#4A6A7A' }}>{locs.length} vị trí</span>
                    </div>
                    <table className="w-full text-xs" style={{ color: '#E8F1F2' }}>
                        <thead>
                            <tr style={{ background: '#1B2E3D' }}>
                                <th className="px-4 py-2 text-left font-semibold" style={{ color: '#4A6A7A' }}>Mã</th>
                                <th className="px-4 py-2 text-left font-semibold" style={{ color: '#4A6A7A' }}>Rack</th>
                                <th className="px-4 py-2 text-left font-semibold" style={{ color: '#4A6A7A' }}>Bin</th>
                                <th className="px-4 py-2 text-left font-semibold" style={{ color: '#4A6A7A' }}>Loại</th>
                                <th className="px-4 py-2 text-center font-semibold" style={{ color: '#4A6A7A' }}>Sức chứa</th>
                                <th className="px-4 py-2 text-center font-semibold" style={{ color: '#4A6A7A' }}>Tồn</th>
                                <th className="px-4 py-2 text-center font-semibold" style={{ color: '#4A6A7A' }}>Đã dùng</th>
                                <th className="px-4 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {locs.map(loc => (
                                <tr key={loc.id} className="border-t" style={{ borderColor: '#2A4355' }}>
                                    <td className="px-4 py-2 font-mono font-bold" style={{ color: '#87CBB9' }}>{loc.locationCode}</td>
                                    <td className="px-4 py-2">{loc.rack ?? '—'}</td>
                                    <td className="px-4 py-2">{loc.bin ?? '—'}</td>
                                    <td className="px-4 py-2">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                            style={{ color: typeColor[loc.type] || '#4A6A7A', background: `${typeColor[loc.type] || '#4A6A7A'}18` }}>
                                            {loc.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-center font-mono">{loc.capacityCases ?? '∞'}</td>
                                    <td className="px-4 py-2 text-center font-mono">{loc.stockCount}</td>
                                    <td className="px-4 py-2 text-center font-mono">{loc.usedBottles}</td>
                                    <td className="px-4 py-2 text-right">
                                        {loc.stockCount === 0 && (
                                            <button onClick={() => handleDelete(loc.id)}
                                                className="p-1 rounded hover:opacity-60 transition-opacity"
                                                style={{ color: '#E05252' }}>
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                        {loc.tempControlled && <Thermometer size={12} style={{ color: '#4A8FAB' }} className="inline ml-1" />}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}

            {locations.length === 0 && (
                <div className="text-center py-12" style={{ color: '#4A6A7A' }}>
                    <MapPin size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Chưa có vị trí nào. Nhấn "Thêm Vị Trí" để bắt đầu.</p>
                </div>
            )}
        </div>
    )
}
