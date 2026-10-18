'use client'

import { useState, useEffect } from 'react'
import { Wine, Save, Loader2, X, Plus } from 'lucide-react'
import {
    getWinePreference, saveWinePreference,
    getGrapePresets, getRegionPresets, getTastePresets,
    type WinePreference,
} from './actions'
import { formatVND } from '@/lib/utils'
import { useAppLocale } from '@/lib/i18n'

function TagSelector({
    label, selected, presets, color, onToggle
}: {
    label: string; selected: string[]; presets: string[]; color: string
    onToggle: (item: string) => void
}) {
    return (
        <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>{label}</p>
            <div className="flex flex-wrap gap-1.5">
                {presets.map(item => {
                    const isSelected = selected.includes(item)
                    return (
                        <button key={item} onClick={() => onToggle(item)}
                            className="px-2 py-1 text-xs rounded-full font-medium transition-all"
                            style={{
                                background: isSelected ? `${color}20` : '#FFFFFF',
                                color: isSelected ? color : '#64748B',
                                border: `1px solid ${isSelected ? `${color}40` : '#E2E8F0'}`,
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
    const { isEn } = useAppLocale()
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
                <Loader2 size={12} className="animate-spin" style={{ color: '#0891B2' }} />
                <span className="text-xs" style={{ color: '#64748B' }}>{isEn ? 'Loading preferences...' : 'Đang tải sở thích...'}</span>
            </div>
        )
    }

    return (
        <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Wine size={14} style={{ color: '#B91C1C' }} />
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                        {isEn ? 'Wine Preferences' : 'Sở Thích Rượu Vang'}
                    </p>
                </div>
                {!editing ? (
                    <button onClick={() => setEditing(true)}
                        className="text-xs px-2 py-1 rounded font-medium"
                        style={{ color: '#0891B2', background: 'rgba(8,145,178,0.1)' }}>
                        {pref ? (isEn ? 'Edit' : 'Sửa') : (isEn ? '+ Add' : '+ Thêm')}
                    </button>
                ) : (
                    <button onClick={() => setEditing(false)} className="p-1" style={{ color: '#64748B' }}>
                        <X size={12} />
                    </button>
                )}
            </div>

            {!editing && pref && (
                <div className="space-y-3">
                    {/* Grapes */}
                    {pref.grapeVarieties.length > 0 && (
                        <div>
                            <p className="text-xs mb-1.5" style={{ color: '#64748B' }}>{isEn ? 'Grape Varieties' : 'Giống nho'}</p>
                            <div className="flex flex-wrap gap-1">
                                {pref.grapeVarieties.map(g => (
                                    <span key={g} className="inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
                                        style={{ color: '#B91C1C', background: 'rgba(185,28,28,0.15)' }}>{g}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Regions */}
                    {pref.regions.length > 0 && (
                        <div>
                            <p className="text-xs mb-1.5" style={{ color: '#64748B' }}>{isEn ? 'Preferred Regions' : 'Vùng ưa thích'}</p>
                            <div className="flex flex-wrap gap-1">
                                {pref.regions.map(r => (
                                    <span key={r} className="inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
                                        style={{ color: '#B45309', background: 'rgba(180,83,9,0.12)' }}>{r}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Taste */}
                    {pref.tasteProfile.length > 0 && (
                        <div>
                            <p className="text-xs mb-1.5" style={{ color: '#64748B' }}>{isEn ? 'Taste Profile' : 'Khẩu vị'}</p>
                            <div className="flex flex-wrap gap-1">
                                {pref.tasteProfile.map(t => (
                                    <span key={t} className="inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
                                        style={{ color: '#15803D', background: 'rgba(21,128,61,0.12)' }}>{t}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Price Range */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#64748B' }}>{isEn ? 'Price Range:' : 'Tầm giá:'}</span>
                        <span className="text-xs font-bold" style={{ color: '#0891B2' }}>
                            {formatVND(pref.priceRangeMin)} – {formatVND(pref.priceRangeMax)}
                        </span>
                    </div>
                    {pref.notes && (
                        <p className="text-xs italic" style={{ color: '#64748B' }}>"{pref.notes}"</p>
                    )}
                </div>
            )}

            {!editing && !pref && (
                <p className="text-xs text-center py-4" style={{ color: '#64748B' }}>
                    {isEn ? 'No preferences recorded. Click "+ Add" to create.' : 'Chưa có thông tin sở thích. Nhấn "+ Thêm" để tạo.'}
                </p>
            )}

            {editing && (
                <div className="space-y-4">
                    <TagSelector label={isEn ? 'Favorite Grape Varieties' : 'Giống nho yêu thích'} selected={grapes} presets={GRAPE_PRESETS}
                        color="#B91C1C" onToggle={item => toggleItem(grapes, setGrapes, item)} />
                    <TagSelector label={isEn ? 'Wine Regions' : 'Vùng sản xuất'} selected={regions} presets={REGION_PRESETS}
                        color="#B45309" onToggle={item => toggleItem(regions, setRegions, item)} />
                    <TagSelector label={isEn ? 'Taste Profile' : 'Khẩu vị'} selected={tastes} presets={TASTE_PRESETS}
                        color="#15803D" onToggle={item => toggleItem(tastes, setTastes, item)} />

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs mb-1 block" style={{ color: '#64748B' }}>{isEn ? 'Min Price (₫)' : 'Giá tối thiểu (₫)'}</label>
                            <input type="number" aria-label={isEn ? 'Min Price' : 'Giá tối thiểu'} className="w-full px-3 py-2 rounded text-sm outline-none"
                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                                value={priceMin} onChange={e => setPriceMin(Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="text-xs mb-1 block" style={{ color: '#64748B' }}>{isEn ? 'Max Price (₫)' : 'Giá tối đa (₫)'}</label>
                            <input type="number" aria-label={isEn ? 'Max Price' : 'Giá tối đa'} className="w-full px-3 py-2 rounded text-sm outline-none"
                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                                value={priceMax} onChange={e => setPriceMax(Number(e.target.value))} />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs mb-1 block" style={{ color: '#64748B' }}>{isEn ? 'Notes' : 'Ghi chú'}</label>
                        <textarea aria-label={isEn ? 'Notes' : 'Ghi chú'} className="w-full px-3 py-2 rounded text-sm outline-none resize-none"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                            rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>

                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold disabled:opacity-50"
                        style={{ background: '#0E7490', color: '#FFFFFF' }}>
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        {saving ? (isEn ? 'Saving...' : 'Đang lưu...') : (isEn ? 'Save Preferences' : 'Lưu Sở Thích')}
                    </button>
                </div>
            )}
        </div>
    )
}
