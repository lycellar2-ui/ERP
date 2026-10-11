'use client'

import { cn } from '@/lib/utils'

export interface StatusTabItem<T extends string = string> {
    value: T
    label: string
    count?: number
}

interface StatusTabsProps<T extends string> {
    items: StatusTabItem<T>[]
    value: T
    onChange: (value: T) => void
    /** Hide tabs whose count is 0 (except the first "All" tab). */
    hideEmpty?: boolean
    className?: string
}

export function StatusTabs<T extends string>({ items, value, onChange, hideEmpty, className }: StatusTabsProps<T>) {
    const visible = hideEmpty ? items.filter((t, i) => i === 0 || (t.count ?? 0) > 0) : items
    return (
        <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-lys-border [scrollbar-width:none]', className)}>
            {visible.map(tab => {
                const active = tab.value === value
                return (
                    <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(tab.value)}
                        className={cn(
                            'relative flex items-center gap-1.5 h-9 px-3 text-[13px] font-semibold whitespace-nowrap transition-all duration-150 active:scale-95 cursor-pointer select-none',
                            'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:transition-all after:duration-200 after:ease-out',
                            active
                                ? 'text-lys-teal-strong after:bg-lys-teal after:opacity-100'
                                : 'text-lys-muted hover:text-lys-primary after:bg-transparent after:opacity-0',
                        )}
                    >
                        {tab.label}
                        {tab.count !== undefined && (
                            <span
                                className={cn(
                                    'min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-md text-[11px] font-bold type-number transition-all duration-150',
                                    active ? 'bg-lys-teal-soft text-lys-teal-strong animate-pop' : 'bg-lys-subtle text-lys-muted',
                                )}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
