'use client'

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    function SearchInput({ className, ...props }, ref) {
        return (
            <div className={cn('relative w-full sm:w-64', className)}>
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-lys-dim pointer-events-none" aria-hidden />
                <input
                    ref={ref}
                    type="search"
                    className="w-full h-11 sm:h-9 pl-9 pr-3 rounded-md border border-lys-border-strong bg-white text-base sm:text-[13px] text-lys-primary placeholder:text-lys-dim focus:outline-none focus:border-lys-teal focus:ring-2 focus:ring-lys-teal/20"
                    {...props}
                />
            </div>
        )
    },
)

/** Row layout: tabs/left content + filter controls on the right. */
export function Toolbar({ left, right, className }: { left?: ReactNode; right?: ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3', className)}>
            <div className="flex-1 min-w-0">{left}</div>
            {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
        </div>
    )
}

/** Collapsible panel holding advanced filters in a responsive grid. */
export function FilterPanel({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 p-3 bg-lys-card border border-lys-border rounded-lg', className)}>
            {children}
        </div>
    )
}
