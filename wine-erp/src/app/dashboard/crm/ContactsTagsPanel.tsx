'use client'

import { useState, useCallback } from 'react'
import {
    User, Phone, Mail, Plus, X, Star, Tag, Loader2, Edit2, Trash2, Check
} from 'lucide-react'
import {
    ContactRow, TagRow, getCustomerContacts, createCustomerContact,
    updateCustomerContact, deleteCustomerContact, getCustomerTags,
    addCustomerTag, removeCustomerTag
} from './actions'

const inputStyle = { background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }

// ── Contacts Panel ──────────────────────────
export function ContactsPanel({ customerId }: { customerId: string }) {
    const [contacts, setContacts] = useState<ContactRow[]>([])
    const [loaded, setLoaded] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm] = useState({ name: '', title: '', phone: '', email: '', isPrimary: false })
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        const data = await getCustomerContacts(customerId)
        setContacts(data)
        setLoaded(true)
    }, [customerId])

    if (!loaded) {
        load()
        return (
            <div className="p-4 text-center">
                <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#4A6A7A' }} />
            </div>
        )
    }

    const handleSave = async () => {
        if (!form.name.trim()) return
        setSaving(true)
        if (editId) {
            await updateCustomerContact(editId, form)
        } else {
            await createCustomerContact({ customerId, ...form })
        }
        setSaving(false)
        setShowForm(false)
        setEditId(null)
        setForm({ name: '', title: '', phone: '', email: '', isPrimary: false })
        load()
    }

    const handleEdit = (c: ContactRow) => {
        setEditId(c.id)
        setForm({ name: c.name, title: c.title ?? '', phone: c.phone ?? '', email: c.email ?? '', isPrimary: c.isPrimary })
        setShowForm(true)
    }

    const handleDelete = async (id: string) => {
        await deleteCustomerContact(id)
        load()
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4A6A7A' }}>
                    <User size={12} className="inline mr-1" /> Liên Hệ ({contacts.length})
                </h4>
                <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', title: '', phone: '', email: '', isPrimary: false }) }}
                    className="text-xs px-2 py-1 rounded flex items-center gap-1"
                    style={{ color: '#87CBB9', background: 'rgba(135,203,185,0.1)' }}>
                    <Plus size={10} /> Thêm
                </button>
            </div>

            {contacts.length === 0 && !showForm && (
                <p className="text-xs text-center py-3" style={{ color: '#4A6A7A' }}>
                    Chưa có liên hệ nào
                </p>
            )}

            {contacts.map(c => (
                <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg group"
                    style={{ background: '#142433', border: c.isPrimary ? '1px solid rgba(212,168,83,0.3)' : '1px solid transparent' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{ background: c.isPrimary ? 'rgba(212,168,83,0.15)' : 'rgba(135,203,185,0.1)', color: c.isPrimary ? '#D4A853' : '#87CBB9' }}>
                        {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{c.name}</span>
                            {c.isPrimary && (
                                <Star size={10} style={{ color: '#D4A853' }} fill="#D4A853" />
                            )}
                        </div>
                        {c.title && <p className="text-[10px]" style={{ color: '#4A6A7A' }}>{c.title}</p>}
                        <div className="flex gap-3 mt-1">
                            {c.phone && (
                                <a href={`tel:${c.phone}`} className="text-xs flex items-center gap-1" style={{ color: '#8AAEBB' }}>
                                    <Phone size={9} /> {c.phone}
                                </a>
                            )}
                            {c.email && (
                                <a href={`mailto:${c.email}`} className="text-xs flex items-center gap-1" style={{ color: '#8AAEBB' }}>
                                    <Mail size={9} /> {c.email}
                                </a>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(c)} className="p-1 rounded" style={{ color: '#4A6A7A' }}><Edit2 size={12} /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1 rounded" style={{ color: '#E05252' }}><Trash2 size={12} /></button>
                    </div>
                </div>
            ))}

            {showForm && (
                <div className="p-3 rounded-lg space-y-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Tên liên hệ *" className="w-full px-3 py-2 text-sm outline-none" style={inputStyle} />
                    <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Chức danh (VD: Quản lý mua hàng)" className="w-full px-3 py-2 text-sm outline-none" style={inputStyle} />
                    <div className="grid grid-cols-2 gap-2">
                        <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                            placeholder="Điện thoại" className="w-full px-3 py-2 text-sm outline-none" style={inputStyle} />
                        <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            placeholder="Email" className="w-full px-3 py-2 text-sm outline-none" style={inputStyle} />
                    </div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#4A6A7A' }}>
                        <input type="checkbox" checked={form.isPrimary} onChange={e => setForm(f => ({ ...f, isPrimary: e.target.checked }))} />
                        <Star size={10} /> Liên hệ chính
                    </label>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => { setShowForm(false); setEditId(null) }}
                            className="px-3 py-1.5 text-xs rounded" style={{ color: '#4A6A7A' }}>Hủy</button>
                        <button onClick={handleSave} disabled={!form.name.trim() || saving}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded disabled:opacity-50"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                            {editId ? 'Cập Nhật' : 'Thêm'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Tags Panel ──────────────────────────
export function TagsPanel({ customerId }: { customerId: string }) {
    const [tags, setTags] = useState<TagRow[]>([])
    const [loaded, setLoaded] = useState(false)
    const [showPicker, setShowPicker] = useState(false)
    const [customTag, setCustomTag] = useState('')
    const [saving, setSaving] = useState(false)

    const presets = [
        { tag: 'VIP', color: '#D4A853' },
        { tag: 'At-risk', color: '#E05252' },
        { tag: 'Price-sensitive', color: '#4A8FAB' },
        { tag: 'EVFTA', color: '#5BA88A' },
        { tag: 'New', color: '#87CBB9' },
        { tag: 'Top Buyer', color: '#A5DED0' },
        { tag: 'HORECA Key', color: '#8AAEBB' },
    ]

    const load = useCallback(async () => {
        const data = await getCustomerTags(customerId)
        setTags(data)
        setLoaded(true)
    }, [customerId])

    if (!loaded) {
        load()
        return (
            <div className="p-4 text-center">
                <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#4A6A7A' }} />
            </div>
        )
    }

    const handleAdd = async (tag: string, color?: string) => {
        setSaving(true)
        await addCustomerTag({ customerId, tag, color })
        setSaving(false)
        load()
    }

    const handleRemove = async (id: string) => {
        await removeCustomerTag(id)
        load()
    }

    const handleCustom = async () => {
        if (!customTag.trim()) return
        await handleAdd(customTag.trim())
        setCustomTag('')
    }

    const existingTags = new Set(tags.map(t => t.tag))

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4A6A7A' }}>
                    <Tag size={12} className="inline mr-1" /> Nhãn
                </h4>
                <button onClick={() => setShowPicker(!showPicker)}
                    className="text-xs px-2 py-1 rounded flex items-center gap-1"
                    style={{ color: '#87CBB9', background: 'rgba(135,203,185,0.1)' }}>
                    <Plus size={10} /> Gắn
                </button>
            </div>

            {/* Current tags */}
            <div className="flex flex-wrap gap-1.5">
                {tags.length === 0 && (
                    <span className="text-xs" style={{ color: '#4A6A7A' }}>Chưa có nhãn</span>
                )}
                {tags.map(t => (
                    <span key={t.id} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold group"
                        style={{ background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40` }}>
                        {t.tag}
                        <button onClick={() => handleRemove(t.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 -mr-1 rounded-full hover:bg-white/10">
                            <X size={8} />
                        </button>
                    </span>
                ))}
            </div>

            {/* Tag picker */}
            {showPicker && (
                <div className="p-3 rounded-lg space-y-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                    <p className="text-[10px] uppercase font-bold" style={{ color: '#4A6A7A' }}>Nhãn có sẵn</p>
                    <div className="flex flex-wrap gap-1.5">
                        {presets.filter(p => !existingTags.has(p.tag)).map(p => (
                            <button key={p.tag} onClick={() => handleAdd(p.tag, p.color)} disabled={saving}
                                className="text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all hover:scale-105 disabled:opacity-50"
                                style={{ background: `${p.color}15`, color: p.color, border: `1px dashed ${p.color}40` }}>
                                + {p.tag}
                            </button>
                        ))}
                        {presets.every(p => existingTags.has(p.tag)) && (
                            <span className="text-xs" style={{ color: '#4A6A7A' }}>Đã gắn hết nhãn có sẵn</span>
                        )}
                    </div>
                    <div className="flex gap-2 mt-2">
                        <input value={customTag} onChange={e => setCustomTag(e.target.value)}
                            placeholder="Hoặc nhập nhãn mới..."
                            className="flex-1 px-3 py-1.5 text-xs outline-none" style={inputStyle}
                            onKeyDown={e => e.key === 'Enter' && handleCustom()} />
                        <button onClick={handleCustom} disabled={!customTag.trim() || saving}
                            className="px-3 py-1.5 text-xs font-semibold rounded disabled:opacity-50"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            Thêm
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
