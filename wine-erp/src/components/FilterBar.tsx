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
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-lys-muted pointer-events-none" />
                <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={localSearch}
                    onChange={e => handleSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-lys-border-strong bg-white text-lys-primary placeholder:text-lys-dim focus:outline-none focus:border-lys-teal focus:ring-2 focus:ring-lys-teal/20 transition-colors"
                />
            </div>
            {filters.map(f => (
                <select
                    key={f.key}
                    value={f.value}
                    onChange={e => f.onChange(e.target.value)}
                    className="px-3 py-2 text-sm rounded-md border border-lys-border-strong bg-white text-lys-primary focus:outline-none focus:border-lys-teal focus:ring-2 focus:ring-lys-teal/20 transition-colors cursor-pointer"
                >
                    <option value="">{f.label}</option>
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            ))}
            {hasActiveFilters && onClearAll && (
                <button
                    type="button"
                    onClick={onClearAll}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-md border border-lys-border text-lys-secondary hover:bg-lys-subtle transition-colors cursor-pointer"
                >
                    <X size={12} /> Xóa bộ lọc
                </button>
            )}
        </div>
    )
}
