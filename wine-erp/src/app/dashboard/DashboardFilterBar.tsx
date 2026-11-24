'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Calendar, Building2, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui'
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
    const { locale, isEn } = useAppLocale()
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
        <div className="bg-lys-card border border-lys-border rounded-lg shadow-xs px-3 py-2 space-y-2 transition-all">
            <div className="flex flex-wrap items-center justify-between gap-2">
                {/* ── Segmented Preset Buttons ── */}
                <div className="inline-flex flex-wrap items-center p-0.5 rounded-md bg-lys-subtle border border-lys-border gap-0.5">
                    {PRESETS.map((item) => {
                        const active = preset === item.key
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => handlePresetClick(item.key)}
                                className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer ${
                                    active
                                        ? 'bg-white text-lys-teal-strong shadow-xs font-semibold'
                                        : 'text-lys-secondary hover:text-lys-primary font-medium'
                                }`}
                            >
                                {item.label}
                            </button>
                        )
                    })}
                </div>

                {/* ── Active Period Pill + Legal Entity Filter & Loading Status ── */}
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                    <div className="hidden xl:inline-flex items-center gap-1.5 text-[11px] text-lys-muted px-2 py-1 rounded-md bg-lys-subtle/60">
                        <Calendar size={12} className="text-lys-teal-strong shrink-0" aria-hidden />
                        <strong className="text-lys-primary font-medium">{displayRangeText}</strong>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white h-8 px-2.5 rounded-md border border-lys-border-strong">
                        <Building2 size={13} className="text-lys-teal-strong shrink-0" aria-hidden />
                        <span className="text-xs text-lys-secondary font-medium hidden sm:inline">{t.filters.entity}</span>
                        <select
                            aria-label={t.filters.entity}
                            value={entity}
                            onChange={handleEntityChange}
                            className="bg-transparent text-xs font-semibold text-lys-primary focus:outline-none cursor-pointer"
                        >
                            <option value="ALL" className="bg-white text-lys-primary">
                                {t.filters.allEntities}
                            </option>
                            {legalEntities.map((le) => (
                                <option key={le.id} value={le.id} className="bg-white text-lys-primary">
                                    [{le.code}] {le.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {isPending && (
                        <div className="inline-flex items-center gap-1 text-[11px] text-lys-teal-strong font-medium animate-pulse px-2 py-1 rounded-md bg-lys-teal-soft border border-tone-brand-border whitespace-nowrap shrink-0">
                            <Loader2 size={12} className="animate-spin" /> {isEn ? 'Loading...' : 'Đang tải...'}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Custom Range Inputs (When CUSTOM is active) ── */}
            {showCustomModal && (
                <form
                    onSubmit={handleApplyCustom}
                    className="flex flex-wrap items-center gap-2 pt-2 border-t border-lys-border text-xs"
                >
                    <span className="text-lys-secondary font-medium flex items-center gap-1">
                        <Calendar size={13} className="text-tone-warning-fg" aria-hidden /> {isEn ? 'Date range:' : 'Khoảng ngày:'}
                    </span>
                    <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        required
                        className="bg-white border border-lys-border-strong text-lys-primary px-2.5 py-1.5 rounded-md text-base sm:text-xs focus:border-lys-teal focus:outline-none"
                    />
                    <ArrowRight size={12} className="text-lys-muted" aria-hidden />
                    <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        required
                        className="bg-white border border-lys-border-strong text-lys-primary px-2.5 py-1.5 rounded-md text-base sm:text-xs focus:border-lys-teal focus:outline-none"
                    />
                    <Button type="submit" size="sm">
                        {t.apply}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setShowCustomModal(false)
                            if (preset === 'CUSTOM') {
                                handlePresetClick('THIS_MONTH')
                            }
                        }}
                    >
                        {t.close}
                    </Button>
                </form>
            )}
        </div>
    )
}
