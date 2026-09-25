'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Calendar, Building2, Filter, Loader2, Check, ArrowRight } from 'lucide-react'

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

const PRESETS: { key: PresetKey; label: string }[] = [
    { key: 'TODAY', label: 'Hôm nay' },
    { key: 'YESTERDAY', label: 'Hôm qua' },
    { key: '7DAYS', label: '7 ngày qua' },
    { key: 'THIS_MONTH', label: 'Tháng này' },
    { key: 'LAST_MONTH', label: 'Tháng trước' },
    { key: 'CUSTOM', label: 'Tùy chọn...' },
]

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

    const [preset, setPreset] = useState<PresetKey>(currentPreset)
    const [entity, setEntity] = useState<string>(currentEntity)
    const [customFrom, setCustomFrom] = useState<string>(currentFrom)
    const [customTo, setCustomTo] = useState<string>(currentTo)
    const [showCustomModal, setShowCustomModal] = useState<boolean>(currentPreset === 'CUSTOM')

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
                        <Filter size={12} /> Thời gian:
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
                                        ? 'bg-[#87CBB9]/20 text-[#0891B2] border border-[#87CBB9]/40 shadow-sm'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:border-[#64748B]'
                                }`}
                            >
                                {active && <Check size={11} className="text-[#0891B2]" />}
                                {item.label}
                            </button>
                        )
                    })}
                </div>

                {/* ── Legal Entity Filter & Active Badge ── */}
                <div className="flex items-center gap-2.5 ml-auto flex-wrap">
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                        <Building2 size={13} className="text-[#0891B2]" />
                        <span className="text-xs text-slate-600 font-medium hidden sm:inline">Pháp nhân:</span>
                        <select
                            value={entity}
                            onChange={handleEntityChange}
                            className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL" className="bg-white text-slate-900">
                                Tất cả pháp nhân (Toàn công ty)
                            </option>
                            {legalEntities.map((le) => (
                                <option key={le.id} value={le.id} className="bg-white text-slate-900">
                                    [{le.code}] {le.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {isPending && (
                        <div className="flex items-center gap-1 text-[11px] text-[#0891B2] font-medium animate-pulse px-2 py-0.5 rounded bg-[#87CBB9]/10">
                            <Loader2 size={12} className="animate-spin" /> Đang tải...
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
                        <Calendar size={13} className="text-[#D4A853]" /> Khoảng ngày:
                    </span>
                    <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        required
                        className="bg-white border border-slate-200 text-slate-900 px-2 py-1 rounded text-xs focus:border-[#87CBB9] focus:outline-none"
                    />
                    <ArrowRight size={12} className="text-slate-500" />
                    <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        required
                        className="bg-white border border-slate-200 text-slate-900 px-2 py-1 rounded text-xs focus:border-[#87CBB9] focus:outline-none"
                    />
                    <button
                        type="submit"
                        className="px-3 py-1 rounded bg-[#5BA88A] hover:bg-[#5BA88A]/80 text-slate-900 font-semibold text-xs transition-all cursor-pointer"
                    >
                        Áp dụng ngày
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
                        Đóng
                    </button>
                </form>
            )}

            {/* ── Current Filter Status Pill ── */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#87CBB9]" />
                    <span>Dữ liệu đang lọc theo:</span>
                    <strong className="text-[#0891B2]">{displayRangeText}</strong>
                    {entity !== 'ALL' && (
                        <span>
                            · Pháp nhân:{' '}
                            <strong className="text-[#D4A853]">
                                {legalEntities.find((le) => le.id === entity)?.name ?? entity}
                            </strong>
                        </span>
                    )}
                </div>
                <span className="text-[10px] hidden md:inline">Doanh số tính theo ngày tạo đơn hàng hợp lệ</span>
            </div>
        </div>
    )
}
