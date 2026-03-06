'use client'

import { useState } from 'react'
import { Wine, Plus, MapPin, Users, Calendar, CheckCircle2, Loader2, X, TrendingUp } from 'lucide-react'
import { getTastingEvents, createTastingEvent, type TastingEventRow } from './actions'
import { formatDate, formatVND } from '@/lib/utils'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    PLANNED: { label: 'Lên kế hoạch', color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)' },
    ACTIVE: { label: 'Đang diễn ra', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    COMPLETED: { label: 'Hoàn thành', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    CANCELLED: { label: 'Đã hủy', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
}

export function TastingEventsPanel() {
    const [events, setEvents] = useState<TastingEventRow[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ name: '', date: '', venue: '', description: '', maxGuests: 30 })

    const load = async () => {
        setLoading(true)
        const data = await getTastingEvents()
        setEvents(data)
        setLoading(false)
    }

    if (!events && !loading) { load() }

    const handleCreate = async () => {
        if (!form.name || !form.date || !form.venue) return
        setSaving(true)
        await createTastingEvent(form)
        setShowCreate(false)
        setForm({ name: '', date: '', venue: '', description: '', maxGuests: 30 })
        const data = await getTastingEvents()
        setEvents(data)
        setSaving(false)
    }

    if (loading || !events) {
        return (
            <div className="flex items-center justify-center py-16 gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: '#87CBB9' }} />
                <span className="text-sm" style={{ color: '#4A6A7A' }}>Đang tải sự kiện...</span>
            </div>
        )
    }

    const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Wine size={18} style={{ color: '#D4A853' }} />
                    <h3 className="text-lg font-semibold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>
                        Sự Kiện Thử Rượu
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ color: '#87CBB9', background: 'rgba(135,203,185,0.12)' }}>{events.length}</span>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    <Plus size={14} /> Tạo Sự Kiện
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="p-5 rounded-lg space-y-4" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#87CBB9' }}>Tạo Sự Kiện Mới</p>
                        <button onClick={() => setShowCreate(false)} className="p-1" style={{ color: '#4A6A7A' }}><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <input className={inputCls} style={inputStyle} placeholder="Tên sự kiện"
                            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                        <input type="date" className={inputCls} style={inputStyle}
                            value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                        <input className={inputCls} style={inputStyle} placeholder="Địa điểm"
                            value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
                        <input type="number" className={inputCls} style={inputStyle} placeholder="Max khách"
                            value={form.maxGuests} onChange={e => setForm(f => ({ ...f, maxGuests: Number(e.target.value) }))} />
                    </div>
                    <textarea className={`${inputCls} resize-none`} style={inputStyle} rows={2}
                        placeholder="Mô tả (tuỳ chọn)"
                        value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    <button onClick={handleCreate} disabled={saving || !form.name || !form.date || !form.venue}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        {saving ? 'Đang tạo...' : 'Tạo Sự Kiện'}
                    </button>
                </div>
            )}

            {/* Event Cards */}
            {events.length === 0 ? (
                <div className="text-center py-16 rounded-lg" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <Wine size={28} style={{ color: '#2A4355', margin: '0 auto' }} />
                    <p className="text-sm mt-3" style={{ color: '#4A6A7A' }}>Chưa có sự kiện thử rượu</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {events.map(ev => {
                        const cfg = STATUS_CFG[ev.status] ?? STATUS_CFG.PLANNED
                        return (
                            <div key={ev.id} className="p-4 rounded-lg" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{ev.name}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="flex items-center gap-1 text-xs" style={{ color: '#4A6A7A' }}>
                                                <Calendar size={11} /> {ev.date ? formatDate(ev.date) : '—'}
                                            </span>
                                            <span className="flex items-center gap-1 text-xs" style={{ color: '#4A6A7A' }}>
                                                <MapPin size={11} /> {ev.venue ?? '—'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                        style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                                </div>
                                {ev.description && (
                                    <p className="text-xs mb-3" style={{ color: '#4A6A7A' }}>{ev.description}</p>
                                )}
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { label: 'Max', value: ev.maxGuests, color: '#4A8FAB' },
                                        { label: 'RSVP', value: ev.rsvpCount, color: '#87CBB9' },
                                        { label: 'Check-in', value: ev.checkinCount, color: '#5BA88A' },
                                        { label: 'Chuyển đổi', value: ev.conversionCount, color: '#D4A853' },
                                    ].map(m => (
                                        <div key={m.label} className="text-center p-2 rounded" style={{ background: '#142433' }}>
                                            <p className="text-sm font-bold" style={{ color: m.color, fontFamily: '"DM Mono"' }}>{m.value}</p>
                                            <p className="text-xs" style={{ color: '#4A6A7A' }}>{m.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
