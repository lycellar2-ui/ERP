'use client'

import { useState, useEffect } from 'react'
import { MapPin, Plus, Loader2, Thermometer, Box, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export type LocationItem = {
    id: string
    code?: string
    locationCode?: string
    zone: string
    rack?: string | null
    bin?: string | null
    type: string
    capacityCases?: number | null
    tempControlled?: boolean
    active?: boolean
    isOccupied?: boolean
    usedCases?: number
    lotCount?: number
}

type Props = {
    warehouseId: string
    warehouseName: string
    locations?: LocationItem[]
    initialLocations?: LocationItem[]
    onLocationCreated?: () => void
}

export function LocationManager({ warehouseId, warehouseName, locations, initialLocations, onLocationCreated }: Props) {
    const locList = locations || initialLocations || []
    const [showCreate, setShowCreate] = useState(false)
    const [heatmap, setHeatmap] = useState<{ zone: string; totalLocations: number; usedLocations: number; occupancyPct: number; hasTempControl: boolean }[]>([])
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        zone: '', rack: '', bin: '', type: 'STORAGE', capacityCases: '100', tempControlled: false,
    })

    const refresh = async () => {
        try {
            const res = await fetch(`/api/warehouse/locations?warehouseId=${warehouseId}&heatmap=true`)
            if (res.ok) {
                const data = await res.json()
                setHeatmap(data.heatmap || [])
            }
        } catch { }
    }

    useEffect(() => { refresh() }, [warehouseId])

    const handleCreate = async () => {
        if (!form.zone) return toast.error('Vui lòng nhập Zone')
        setLoading(true)
        try {
            const res = await fetch('/api/warehouse/locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouseId,
                    zone: form.zone.toUpperCase(),
                    rack: form.rack || null,
                    bin: form.bin || null,
                    type: form.type,
                    capacityCases: parseInt(form.capacityCases) || 100,
                    tempControlled: form.tempControlled,
                }),
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.message || 'Lỗi khi tạo vị trí')
            }
            toast.success('Đã tạo vị trí kho mới!')
            setShowCreate(false)
            setForm({ zone: '', rack: '', bin: '', type: 'STORAGE', capacityCases: '100', tempControlled: false })
            onLocationCreated?.()
            refresh()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    const byZone = locList.reduce<Record<string, LocationItem[]>>((acc, loc) => {
        const z = loc.zone || 'KHÁC'
        if (!acc[z]) acc[z] = []
        acc[z].push(loc)
        return acc
    }, {})

    const inputCls = "w-full px-3 py-2 rounded-xl text-xs outline-none bg-white border border-slate-200 text-slate-900 focus:border-emerald-500 shadow-2xs"

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
                        <MapPin size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-extrabold text-slate-900">
                            Sơ Đồ Vị Trí Kho: {warehouseName}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">Quản lý Zone, Rack, Bin & Mức độ lấp đầy thực tế</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => refresh()} className="text-xs px-3 py-2 rounded-xl font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 shadow-2xs">
                        <RefreshCw size={13} /> Cập Nhật Heatmap
                    </button>
                    <button onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-95">
                        <Plus size={15} /> Thêm Vị Trí
                    </button>
                </div>
            </div>

            {/* Heatmap Cards */}
            {heatmap.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {heatmap.map(h => (
                        <div key={h.zone} className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs" style={{
                            borderLeft: `4px solid ${h.occupancyPct > 85 ? '#EF4444' : h.occupancyPct > 60 ? '#F59E0B' : '#10B981'}`,
                        }}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-extrabold text-slate-900">Zone {h.zone}</span>
                                {h.hasTempControl && <Thermometer size={14} className="text-sky-600" />}
                            </div>
                            <div className="w-full h-2 rounded-full mb-1.5 bg-slate-100 overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{
                                    width: `${Math.min(100, h.occupancyPct)}%`,
                                    background: h.occupancyPct > 85 ? '#EF4444' : h.occupancyPct > 60 ? '#F59E0B' : '#10B981',
                                }} />
                            </div>
                            <div className="flex justify-between font-mono text-[10px]">
                                <span className="text-slate-500 font-medium">
                                    {h.usedLocations}/{h.totalLocations} vị trí
                                </span>
                                <span className="font-bold" style={{
                                    color: h.occupancyPct > 85 ? '#EF4444' : h.occupancyPct > 60 ? '#F59E0B' : '#10B981',
                                }}>
                                    {h.occupancyPct}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Form Drawer */}
            {showCreate && (
                <div className="p-4 sm:p-5 rounded-2xl space-y-3.5 bg-white border border-slate-200 shadow-sm">
                    <h4 className="text-sm font-extrabold text-slate-900">Thêm Vị Trí Kho Mới</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                            { label: 'Zone *', key: 'zone', placeholder: 'A, B, C...' },
                            { label: 'Rack', key: 'rack', placeholder: '01, 02...' },
                            { label: 'Bin', key: 'bin', placeholder: '01, 02...' },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="text-[10px] uppercase font-bold block mb-1 text-slate-600">{f.label}</label>
                                <input value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                                    placeholder={f.placeholder}
                                    className={inputCls} />
                            </div>
                        ))}
                        <div>
                            <label className="text-[10px] uppercase font-bold block mb-1 text-slate-600">Loại</label>
                            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                                className={inputCls}>
                                {['STORAGE', 'RECEIVING', 'SHIPPING', 'QUARANTINE', 'VIRTUAL'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold block mb-1 text-slate-600">Sức chứa (thùng)</label>
                            <input type="number" value={form.capacityCases} onChange={e => setForm({ ...form, capacityCases: e.target.value })}
                                className={inputCls} />
                        </div>
                        <div className="flex items-end pb-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={form.tempControlled} onChange={e => setForm({ ...form, tempControlled: e.target.checked })}
                                    className="w-4 h-4 rounded accent-emerald-600 cursor-pointer" />
                                <span className="text-xs font-bold text-slate-700">
                                    <Thermometer size={14} className="inline mr-1 text-sky-600" />Kiểm soát nhiệt độ
                                </span>
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                        <button onClick={() => setShowCreate(false)} className="text-xs font-bold px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer">Hủy</button>
                        <button onClick={handleCreate} disabled={!form.zone || loading}
                            className="text-xs font-bold px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs">
                            {loading ? <Loader2 size={13} className="animate-spin" /> : 'Tạo Vị Trí'}
                        </button>
                    </div>
                </div>
            )}

            {/* Location Table by Zone */}
            {Object.entries(byZone).map(([zone, locs]) => (
                <div key={zone} className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-2xs">
                    <div className="px-4 py-3 flex items-center justify-between bg-slate-50 border-b border-slate-200">
                        <span className="text-xs font-extrabold text-emerald-700">Zone {zone}</span>
                        <span className="text-[10px] font-bold text-slate-500 font-mono">{locs.length} vị trí</span>
                    </div>
                    {/* Desktop Table */}
                    <table className="w-full text-xs hidden md:table border-collapse">
                        <thead>
                            <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-700">
                                <th className="px-4 py-2.5 text-left font-extrabold uppercase text-[10px]">Mã Vị Trí</th>
                                <th className="px-4 py-2.5 text-left font-extrabold uppercase text-[10px]">Rack</th>
                                <th className="px-4 py-2.5 text-left font-extrabold uppercase text-[10px]">Bin</th>
                                <th className="px-4 py-2.5 text-left font-extrabold uppercase text-[10px]">Loại</th>
                                <th className="px-4 py-2.5 text-center font-extrabold uppercase text-[10px]">Sức Chứa</th>
                                <th className="px-4 py-2.5 text-center font-extrabold uppercase text-[10px]">Số Lô Tồn</th>
                                <th className="px-4 py-2.5 text-center font-extrabold uppercase text-[10px]">Đã Dùng</th>
                                <th className="px-4 py-2.5" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {locs.map(loc => {
                                const cap = loc.capacityCases || 0
                                const usedPct = cap > 0 ? Math.round(((loc.usedCases || 0) / cap) * 100) : 0
                                return (
                                    <tr key={loc.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-2.5 font-bold font-mono text-emerald-700">
                                            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                                                {loc.code || loc.locationCode || loc.id}
                                            </span>
                                            {loc.tempControlled && <span title="Kho lạnh"><Thermometer size={12} className="inline ml-1 text-sky-600" /></span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-700 font-medium font-mono">{loc.rack || '—'}</td>
                                        <td className="px-4 py-2.5 text-slate-700 font-medium font-mono">{loc.bin || '—'}</td>
                                        <td className="px-4 py-2.5 font-bold text-[10px] uppercase text-slate-600">{loc.type}</td>
                                        <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-900">{loc.capacityCases} thùng</td>
                                        <td className="px-4 py-2.5 text-center font-mono text-amber-700 font-bold">{loc.lotCount || 0} lô</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <div className="flex items-center justify-center gap-2 font-mono text-xs">
                                                <div className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden">
                                                    <div className="h-full rounded-full" style={{
                                                        width: `${Math.min(100, usedPct)}%`,
                                                        background: usedPct > 85 ? '#EF4444' : usedPct > 60 ? '#F59E0B' : '#10B981',
                                                    }} />
                                                </div>
                                                <span className="font-bold text-[10px]" style={{
                                                    color: usedPct > 85 ? '#EF4444' : usedPct > 60 ? '#F59E0B' : '#10B981',
                                                }}>
                                                    {usedPct}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${loc.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                                {loc.active ? 'Hoạt động' : 'Tắt'}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>

                    {/* Mobile Cards */}
                    <div className="block md:hidden p-3 space-y-3">
                        {locs.map(loc => (
                            <div key={loc.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white space-y-2 shadow-xl">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-400 border border-slate-700">
                                        📍 {loc.code}
                                    </span>
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${loc.active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                                        {loc.active ? 'Hoạt động' : 'Tắt'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-slate-300 pt-1">
                                    <span className="font-semibold text-slate-400">Rack: <strong className="text-white">{loc.rack || '—'}</strong> · Bin: <strong className="text-white">{loc.bin || '—'}</strong></span>
                                    <span className="font-mono font-bold text-amber-400">{loc.capacityCases} thùng</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
