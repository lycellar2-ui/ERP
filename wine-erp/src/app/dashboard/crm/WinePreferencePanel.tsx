'use client'

import { useState, useEffect } from 'react'
import { Wine, Save, Loader2, X, Plus } from 'lucide-react'
import {
    getWinePreference, saveWinePreference,
    getGrapePresets, getRegionPresets, getTastePresets,
    type WinePreference,
} from './actions'
import { formatVND } from '@/lib/utils'

function TagSelector({
    label, selected, presets, color, onToggle
}: {
    label: string; selected: string[]; presets: string[]; color: string
    onToggle: (item: string) => void
}) {
    return (
        <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#4A6A7A' }}>{label}</p>
            <div className="flex flex-wrap gap-1.5">
                {presets.map(item => {
                    const isSelected = selected.includes(item)
                    return (
                        <button key={item} onClick={() => onToggle(item)}
                            className="px-2 py-1 text-xs rounded-full font-medium transition-all"
                            style={{
                                background: isSelected ? `${color}20` : '#142433',
                                color: isSelected ? color : '#4A6A7A',
                                border: `1px solid ${isSelected ? `${color}40` : '#2A4355'}`,
                            }}>
                            {item}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export function WinePreferencePanel({ customerId }: { customerId: string }) {
    const [pref, setPref] = useState<WinePreference | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editing, setEditing] = useState(false)

    const [grapes, setGrapes] = useState<string[]>([])
    const [regions, setRegions] = useState<string[]>([])
    const [tastes, setTastes] = useState<string[]>([])
    const [priceMin, setPriceMin] = useState(0)
    const [priceMax, setPriceMax] = useState(5000000)
    const [notes, setNotes] = useState('')

    const [GRAPE_PRESETS, setGrapePresets] = useState<string[]>([])
    const [REGION_PRESETS, setRegionPresets] = useState<string[]>([])
    const [TASTE_PRESETS, setTastePresets] = useState<string[]>([])

    useEffect(() => {
        setLoading(true)
        Promise.all([
            getWinePreference(customerId),
            getGrapePresets(),
            getRegionPresets(),
            getTastePresets(),
        ]).then(([data, grapeP, regionP, tasteP]) => {
            setPref(data)
            setGrapePresets(grapeP)
            setRegionPresets(regionP)
            setTastePresets(tasteP)
            if (data) {
                setGrapes(data.grapeVarieties)
                setRegions(data.regions)
                setTastes(data.tasteProfile)
                setPriceMin(data.priceRangeMin)
                setPriceMax(data.priceRangeMax)
                setNotes(data.notes ?? '')
            }
            setLoading(false)
        })
    }, [customerId])

    const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
        setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item])
    }

    const handleSave = async () => {
        setSaving(true)
        await saveWinePreference({
            customerId,
            grapeVarieties: grapes,
            regions,
            tasteProfile: tastes,
            priceRangeMin: priceMin,
            priceRangeMax: priceMax,
            notes: notes || undefined,
        })
        const updated = await getWinePreference(customerId)
        setPref(updated)
        setSaving(false)
        setEditing(false)
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-3">
                <Loader2 size={12} className="animate-spin" style={{ color: '#87CBB9' }} />
                <span className="text-xs" style={{ color: '#4A6A7A' }}>Đang tải sở thích...</span>
            </div>
        )
    }

    return (
        <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Wine size={14} style={{ color: '#8B1A2E' }} />
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>
                        Sở Thích Rượu Vang
                    </p>
                </div>
                {!editing ? (
                    <button onClick={() => setEditing(true)}
                        className="text-xs px-2 py-1 rounded font-medium"
                        style={{ color: '#87CBB9', background: 'rgba(135,203,185,0.1)' }}>
                        {pref ? 'Sửa' : '+ Thêm'}
                    </button>
                ) : (
                    <button onClick={() => setEditing(false)} className="p-1" style={{ color: '#4A6A7A' }}>
                        <X size={12} />
                    </button>
                )}
            </div>

            {!editing && pref && (
                <div className="space-y-3">
                    {/* Grapes */}
                    {pref.grapeVarieties.length > 0 && (
                        <div>
                            <p className="text-xs mb-1.5" style={{ color: '#4A6A7A' }}>Giống nho</p>
                            <div className="flex flex-wrap gap-1">
                                {pref.grapeVarieties.map(g => (
                                    <span key={g} className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ color: '#8B1A2E', background: 'rgba(139,26,46,0.15)' }}>{g}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Regions */}
                    {pref.regions.length > 0 && (
                        <div>
                            <p className="text-xs mb-1.5" style={{ color: '#4A6A7A' }}>Vùng ưa thích</p>
                            <div className="flex flex-wrap gap-1">
                                {pref.regions.map(r => (
                                    <span key={r} className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ color: '#D4A853', background: 'rgba(212,168,83,0.12)' }}>{r}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Taste */}
                    {pref.tasteProfile.length > 0 && (
                        <div>
                            <p className="text-xs mb-1.5" style={{ color: '#4A6A7A' }}>Khẩu vị</p>
                            <div className="flex flex-wrap gap-1">
                                {pref.tasteProfile.map(t => (
                                    <span key={t} className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ color: '#5BA88A', background: 'rgba(91,168,138,0.12)' }}>{t}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Price Range */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#4A6A7A' }}>Tầm giá:</span>
                        <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                            {formatVND(pref.priceRangeMin)} – {formatVND(pref.priceRangeMax)}
                        </span>
                    </div>
                    {pref.notes && (
                        <p className="text-xs italic" style={{ color: '#4A6A7A' }}>"{pref.notes}"</p>
                    )}
                </div>
            )}

            {!editing && !pref && (
                <p className="text-xs text-center py-4" style={{ color: '#4A6A7A' }}>
                    Chưa có thông tin sở thích. Nhấn "+ Thêm" để tạo.
                </p>
            )}

            {editing && (
                <div className="space-y-4">
                    <TagSelector label="Giống nho yêu thích" selected={grapes} presets={GRAPE_PRESETS}
                        color="#8B1A2E" onToggle={item => toggleItem(grapes, setGrapes, item)} />
                    <TagSelector label="Vùng sản xuất" selected={regions} presets={REGION_PRESETS}
                        color="#D4A853" onToggle={item => toggleItem(regions, setRegions, item)} />
                    <TagSelector label="Khẩu vị" selected={tastes} presets={TASTE_PRESETS}
                        color="#5BA88A" onToggle={item => toggleItem(tastes, setTastes, item)} />

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>Giá tối thiểu (₫)</p>
                            <input type="number" className="w-full px-3 py-2 rounded text-sm outline-none"
                                style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                value={priceMin} onChange={e => setPriceMin(Number(e.target.value))} />
                        </div>
                        <div>
                            <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>Giá tối đa (₫)</p>
                            <input type="number" className="w-full px-3 py-2 rounded text-sm outline-none"
                                style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                value={priceMax} onChange={e => setPriceMax(Number(e.target.value))} />
                        </div>
                    </div>

                    <div>
                        <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>Ghi chú</p>
                        <textarea className="w-full px-3 py-2 rounded text-sm outline-none resize-none"
                            style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>

                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold disabled:opacity-50"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        {saving ? 'Đang lưu...' : 'Lưu Sở Thích'}
                    </button>
                </div>
            )}
        </div>
    )
}
