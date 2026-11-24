import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TONE_CLASS, type Tone } from '@/lib/ui/status'

interface StatCardProps {
    label: ReactNode
    value: ReactNode
    sub?: ReactNode
    icon?: LucideIcon
    tone?: Tone
    /** Percent change; positive = up (success), negative = down (danger). */
    trend?: number
    onClick?: () => void
    active?: boolean
    className?: string
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'brand', trend, onClick, active, className }: StatCardProps) {
    const Comp = onClick ? 'button' : 'div'
    return (
        <Comp
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 p-3.5 text-left bg-lys-card border rounded-lg shadow-xs w-full select-none',
                active ? 'border-lys-teal ring-1 ring-lys-teal' : 'border-lys-border',
                onClick && 'cursor-pointer hover:border-lys-border-strong hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] transition-all duration-150',
                className,
            )}
        >
            {Icon && (
                <div className={cn('flex items-center justify-center w-9 h-9 rounded-md border shrink-0', TONE_CLASS[tone])}>
                    <Icon size={17} aria-hidden />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-lys-muted truncate">{label}</p>
                <p className="text-lg sm:text-xl font-bold leading-7 tracking-tight text-lys-primary type-number truncate">{value}</p>
                {(sub || trend !== undefined) && (
                    <p className="flex items-center gap-1.5 type-caption text-lys-muted">
                        {trend !== undefined && (
                            <span className={cn('inline-flex items-center gap-0.5 font-semibold', trend >= 0 ? 'text-tone-success-fg' : 'text-tone-danger-fg')}>
                                {trend >= 0 ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}
                                {Math.abs(trend).toFixed(1)}%
                            </span>
                        )}
                        {sub}
                    </p>
                )}
            </div>
        </Comp>
    )
}

const GRID_COLS = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-2 xl:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6',
} as const

export function StatGrid({ children, cols = 4, className }: { children: ReactNode; cols?: keyof typeof GRID_COLS; className?: string }) {
    return <div className={cn('grid gap-3', GRID_COLS[cols], className)}>{children}</div>
}
