'use client'

import { Search, X } from 'lucide-react'
import { useRef, useEffect, useState, useCallback } from 'react'

interface FilterOption {
    value: string
    label: string
}

interface FilterConfig {
    key: string
    label: string
    options: FilterOption[]
    value: string
    onChange: (value: string) => void
}

interface FilterBarProps {
    searchValue: string
    searchPlaceholder?: string
    onSearchChange: (value: string) => void
    filters?: FilterConfig[]
    onClearAll?: () => void
    debounceMs?: number
}

export function FilterBar({
    searchValue, searchPlaceholder = 'Tìm kiếm...', onSearchChange, filters = [], onClearAll, debounceMs = 300,
}: FilterBarProps) {
    const [localSearch, setLocalSearch] = useState(searchValue)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => { setLocalSearch(searchValue) }, [searchValue])

    const handleSearch = useCallback((val: string) => {
        setLocalSearch(val)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => onSearchChange(val), debounceMs)
    }, [onSearchChange, debounceMs])

    useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current) } }, [])

    const hasActiveFilters = localSearch || filters.some(f => f.value)

    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                <input type="text" placeholder={searchPlaceholder} value={localSearch}
                    onChange={e => handleSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm outline-none"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
            </div>
            {filters.map(f => (
                <select key={f.key} value={f.value} onChange={e => f.onChange(e.target.value)}
                    className="px-3 py-2.5 text-sm outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: f.value ? '#E8F1F2' : '#4A6A7A', borderRadius: '6px' }}>
                    <option value="">{f.label}</option>
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            ))}
            {hasActiveFilters && onClearAll && (
                <button onClick={onClearAll}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-medium transition-all"
                    style={{ color: '#8AAEBB', border: '1px solid #2A4355', borderRadius: '6px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <X size={12} /> Xóa bộ lọc
                </button>
            )}
        </div>
    )
}
