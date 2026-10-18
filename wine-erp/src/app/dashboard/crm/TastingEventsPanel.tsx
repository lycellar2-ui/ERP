'use client'

import { useState } from 'react'
import { Wine, Plus, MapPin, Users, Calendar, CheckCircle2, Loader2, X, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { getTastingEvents, createTastingEvent, type TastingEventRow } from './actions'
import { formatDate, formatVND } from '@/lib/utils'
import { useAppLocale } from '@/lib/i18n'

const STATUS_CFG: Record<string, { label: string; labelEn: string; color: string; bg: string }> = {
    PLANNED: { label: 'Lên kế hoạch', labelEn: 'Planned', color: '#1D4ED8', bg: 'rgba(29,78,216,0.15)' },
    ACTIVE: { label: 'Đang diễn ra', labelEn: 'Active', color: '#15803D', bg: 'rgba(21,128,61,0.15)' },
    COMPLETED: { label: 'Hoàn thành', labelEn: 'Completed', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    CANCELLED: { label: 'Đã hủy', labelEn: 'Cancelled', color: '#B91C1C', bg: 'rgba(185,28,28,0.15)' },
}

export function TastingEventsPanel() {
    const { isEn } = useAppLocale()
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
        toast.promise(
            createTastingEvent(form).then(async (res: any) => {
                setShowCreate(false)
                setForm({ name: '', date: '', venue: '', description: '', maxGuests: 30 })
                await load()
                return res
            }),
            {
                loading: isEn ? 'Creating event...' : 'Đang tạo sự kiện...',
                success: isEn ? 'Event created successfully!' : 'Tạo sự kiện thành công!',
                error: (err: any) => `${isEn ? 'Error' : 'Lỗi'}: ${err.message}`,
                finally: () => setSaving(false)
            }
        )
    }

    if (loading || !events) {
        return (
            <div className="flex items-center justify-center py-16 gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: '#0891B2' }} />
                <span className="text-sm" style={{ color: '#64748B' }}>{isEn ? 'Loading events...' : 'Đang tải sự kiện...'}</span>
            </div>
        )
    }

    const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none"
    const inputStyle = { background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Wine size={18} style={{ color: '#B45309' }} />
                    <h3 className="text-lg font-semibold" style={{ color: '#0F172A' }}>
                        {isEn ? 'Wine Tasting Events' : 'Sự Kiện Thử Rượu'}
                    </h3>
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0"
                        style={{ color: '#0891B2', background: 'rgba(8, 145, 178, 0.08)' }}>{events.length}</span>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: '#0E7490', color: '#FFFFFF' }}>
                    <Plus size={14} /> {isEn ? 'Create Event' : 'Tạo Sự Kiện'}
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="p-5 rounded-lg space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#0891B2' }}>
                            {isEn ? 'Create New Event' : 'Tạo Sự Kiện Mới'}
                        </p>
                        <button onClick={() => setShowCreate(false)} className="p-1" style={{ color: '#64748B' }}><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input className={inputCls} style={inputStyle} placeholder={isEn ? 'Event Name' : 'Tên sự kiện'}
                            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                        <input type="date" className={inputCls} style={inputStyle}
                            value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                        <input className={inputCls} style={inputStyle} placeholder={isEn ? 'Venue' : 'Địa điểm'}
                            value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
                        <input type="number" className={inputCls} style={inputStyle} placeholder={isEn ? 'Max Guests' : 'Max khách'}
                            value={form.maxGuests} onChange={e => setForm(f => ({ ...f, maxGuests: Number(e.target.value) }))} />
                    </div>
                    <textarea className={`${inputCls} resize-none`} style={inputStyle} rows={2}
                        placeholder={isEn ? 'Description (optional)' : 'Mô tả (tuỳ chọn)'}
                        value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    <button onClick={handleCreate} disabled={saving || !form.name || !form.date || !form.venue}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                        style={{ background: '#0E7490', color: '#FFFFFF' }}>
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        {saving ? (isEn ? 'Creating...' : 'Đang tạo...') : (isEn ? 'Create Event' : 'Tạo Sự Kiện')}
                    </button>
                </div>
            )}

            {/* Event Cards */}
            {events.length === 0 ? (
                <div className="text-center py-16 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <Wine size={28} style={{ color: '#E2E8F0', margin: '0 auto' }} />
                    <p className="text-sm mt-3" style={{ color: '#64748B' }}>{isEn ? 'No wine tasting events yet' : 'Chưa có sự kiện thử rượu'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {events.map(ev => {
                        const cfg = STATUS_CFG[ev.status] ?? STATUS_CFG.PLANNED
                        return (
                            <div key={ev.id} className="p-4 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{ev.name}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                                                <Calendar size={11} /> {ev.date ? formatDate(ev.date) : '—'}
                                            </span>
                                            <span className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                                                <MapPin size={11} /> {ev.venue ?? '—'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
                                        style={{ color: cfg.color, background: cfg.bg }}>{isEn ? cfg.labelEn : cfg.label}</span>
                                </div>
                                {ev.description && (
                                    <p className="text-xs mb-3" style={{ color: '#64748B' }}>{ev.description}</p>
                                )}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { label: 'Max', value: ev.maxGuests, color: '#1D4ED8' },
                                        { label: 'RSVP', value: ev.rsvpCount, color: '#0891B2' },
                                        { label: 'Check-in', value: ev.checkinCount, color: '#15803D' },
                                        { label: isEn ? 'Converted' : 'Chuyển đổi', value: ev.conversionCount, color: '#B45309' },
                                    ].map(m => (
                                        <div key={m.label} className="text-center p-2 rounded" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                            <p className="text-sm font-bold" style={{ color: m.color }}>{m.value}</p>
                                            <p className="text-xs" style={{ color: '#64748B' }}>{m.label}</p>
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
