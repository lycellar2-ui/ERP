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
                'flex items-center gap-3 p-4 text-left bg-lys-card border rounded-lg shadow-xs w-full select-none',
                active ? 'border-lys-teal ring-1 ring-lys-teal' : 'border-lys-border',
                onClick && 'cursor-pointer hover:border-lys-border-strong hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] transition-all duration-150',
                className,
            )}
        >
            {Icon && (
                <div className={cn('flex items-center justify-center w-10 h-10 rounded-md border shrink-0', TONE_CLASS[tone])}>
                    <Icon size={18} aria-hidden />
                </div>
            )}
            <div className="min-w-0">
                <p className="type-caption uppercase tracking-wide text-lys-muted truncate">{label}</p>
                <p className="text-xl font-bold leading-7 text-lys-primary type-number truncate">{value}</p>
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

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3', className)}>{children}</div>
}
