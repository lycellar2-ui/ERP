'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Calendar, Building2, Filter, Loader2, Check, ArrowRight } from 'lucide-react'
import { useAppLocale } from '@/lib/i18n'
import { getDashboardDictionary } from './i18n'

export type PresetKey = 'TODAY' | 'YESTERDAY' | '7DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'

interface LegalEntityItem {
    id: string
    code: string
    name: string
}

interface Props {
    currentPreset: PresetKey
    currentEntity: string
    currentFrom?: string
    currentTo?: string
    legalEntities: LegalEntityItem[]
    displayRangeText: string
}

export function DashboardFilterBar({
    currentPreset,
    currentEntity,
    currentFrom = '',
    currentTo = '',
    legalEntities,
    displayRangeText,
}: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()
    const { locale, setLocale, isEn } = useAppLocale()
    const t = getDashboardDictionary(locale)

    const [preset, setPreset] = useState<PresetKey>(currentPreset)
    const [entity, setEntity] = useState<string>(currentEntity)
    const [customFrom, setCustomFrom] = useState<string>(currentFrom)
    const [customTo, setCustomTo] = useState<string>(currentTo)
    const [showCustomModal, setShowCustomModal] = useState<boolean>(currentPreset === 'CUSTOM')

    const PRESETS: { key: PresetKey; label: string }[] = [
        { key: 'TODAY', label: t.filters.presets.TODAY },
        { key: 'YESTERDAY', label: t.filters.presets.YESTERDAY },
        { key: '7DAYS', label: t.filters.presets['7DAYS'] },
        { key: 'THIS_MONTH', label: t.filters.presets.THIS_MONTH },
        { key: 'LAST_MONTH', label: t.filters.presets.LAST_MONTH },
        { key: 'CUSTOM', label: t.filters.presets.CUSTOM },
    ]

    const applyFilter = (newPreset: PresetKey, newEntity: string, fromVal?: string, toVal?: string) => {
        const params = new URLSearchParams(searchParams.toString())

        params.set('preset', newPreset)
        if (newEntity && newEntity !== 'ALL') {
            params.set('entity', newEntity)
        } else {
            params.delete('entity')
        }

        if (newPreset === 'CUSTOM' && fromVal && toVal) {
            params.set('from', fromVal)
            params.set('to', toVal)
        } else {
            params.delete('from')
            params.delete('to')
        }

        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`)
        })
    }

    const handlePresetClick = (p: PresetKey) => {
        setPreset(p)
        if (p === 'CUSTOM') {
            setShowCustomModal(true)
        } else {
            setShowCustomModal(false)
            applyFilter(p, entity)
        }
    }

    const handleEntityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value
        setEntity(val)
        applyFilter(preset, val, customFrom, customTo)
    }

    const handleApplyCustom = (e: React.FormEvent) => {
        e.preventDefault()
        if (!customFrom || !customTo) return
        applyFilter('CUSTOM', entity, customFrom, customTo)
        setShowCustomModal(false)
    }

    return (
        <div
            className="rounded-lg p-3.5 space-y-3 transition-all relative overflow-hidden"
            style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
            }}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* ── Preset Buttons ── */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold uppercase tracking-wider mr-1 text-slate-500 flex items-center gap-1">
                        <Filter size={12} /> {t.filters.period}
                    </span>
                    {PRESETS.map((item) => {
                        const active = preset === item.key
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => handlePresetClick(item.key)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                                    active
                                        ? 'bg-[#0E7490]/20 text-[#0891B2] border border-[#0E7490]/40 shadow-xs font-bold'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:border-slate-300'
                                }`}
                            >
                                {active && <Check size={11} className="text-[#0891B2]" />}
                                {item.label}
                            </button>
                        )
                    })}
                </div>

                {/* ── Legal Entity Filter, Quick Language Switcher & Status ── */}
                <div className="flex items-center gap-2.5 ml-auto flex-wrap">
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                        <Building2 size={13} className="text-[#0891B2]" />
                        <span className="text-xs text-slate-600 font-medium hidden sm:inline">{t.filters.entity}</span>
                        <select
                            value={entity}
                            onChange={handleEntityChange}
                            className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL" className="bg-white text-slate-900">
                                {t.filters.allEntities}
                            </option>
                            {legalEntities.map((le) => (
                                <option key={le.id} value={le.id} className="bg-white text-slate-900">
                                    [{le.code}] {le.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Quick VI / EN Switcher on Filter Bar */}
                    <div className="flex items-center p-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-bold">
                        <button
                            type="button"
                            onClick={() => setLocale('vi')}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                locale === 'vi'
                                    ? 'bg-[#0891B2] text-white font-black shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Tiếng Việt"
                        >
                            VI
                        </button>
                        <button
                            type="button"
                            onClick={() => setLocale('en')}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                locale === 'en'
                                    ? 'bg-[#0891B2] text-white font-black shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="English"
                        >
                            EN
                        </button>
                    </div>

                    {isPending && (
                        <div className="flex items-center gap-1 text-[11px] text-[#0891B2] font-medium animate-pulse px-2 py-0.5 rounded bg-[#0E7490]/10">
                            <Loader2 size={12} className="animate-spin" /> {isEn ? 'Loading...' : 'Đang tải...'}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Custom Range Inputs (When CUSTOM is active) ── */}
            {showCustomModal && (
                <form
                    onSubmit={handleApplyCustom}
                    className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 text-xs"
                >
                    <span className="text-slate-600 font-medium flex items-center gap-1">
                        <Calendar size={13} className="text-[#B45309]" /> {isEn ? 'Date range:' : 'Khoảng ngày:'}
                    </span>
                    <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        required
                        className="bg-white border border-slate-200 text-slate-900 px-2 py-1 rounded text-xs focus:border-[#0E7490] focus:outline-none"
                    />
                    <ArrowRight size={12} className="text-slate-500" />
                    <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        required
                        className="bg-white border border-slate-200 text-slate-900 px-2 py-1 rounded text-xs focus:border-[#0E7490] focus:outline-none"
                    />
                    <button
                        type="submit"
                        className="px-3 py-1 rounded bg-[#0891B2] hover:bg-[#0891B2]/90 text-white font-semibold text-xs transition-all cursor-pointer"
                    >
                        {t.apply}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setShowCustomModal(false)
                            if (preset === 'CUSTOM') {
                                handlePresetClick('THIS_MONTH')
                            }
                        }}
                        className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                    >
                        {t.close}
                    </button>
                </form>
            )}

            {/* ── Current Filter Status Pill ── */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0E7490]" />
                    <span>{isEn ? 'Filtered by:' : 'Dữ liệu đang lọc theo:'}</span>
                    <strong className="text-[#0891B2]">{displayRangeText}</strong>
                    {entity !== 'ALL' && (
                        <span>
                            · {isEn ? 'Entity:' : 'Pháp nhân:'}{' '}
                            <strong className="text-[#B45309]">
                                {legalEntities.find((le) => le.id === entity)?.name ?? entity}
                            </strong>
                        </span>
                    )}
                </div>
                <span className="text-[10px] hidden md:inline">
                    {isEn ? 'Revenue calculated by valid sales order dates' : 'Doanh thu tính theo ngày tạo đơn hàng hợp lệ'}
                </span>
            </div>
        </div>
    )
}
