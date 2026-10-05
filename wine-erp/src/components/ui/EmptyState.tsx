import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
    icon?: LucideIcon
    title: ReactNode
    description?: ReactNode
    action?: ReactNode
    className?: string
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-2 py-12 px-4 text-center', className)}>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-lys-subtle text-lys-dim">
                <Icon size={22} aria-hidden />
            </div>
            <p className="type-section-title text-lys-primary">{title}</p>
            {description && <p className="type-body text-lys-muted max-w-sm">{description}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    )
}

export function Skeleton({ className }: { className?: string }) {
    return <div className={cn('animate-pulse rounded-md bg-lys-subtle', className)} aria-hidden />
}

/** Placeholder rows for a loading table. */
export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
    return (
        <div className="flex flex-col divide-y divide-lys-border" aria-busy="true" aria-label="Đang tải">
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex items-center gap-4 h-10 px-3">
                    {Array.from({ length: cols }).map((__, c) => (
                        <Skeleton key={c} className={cn('h-3', c === 0 ? 'w-24' : 'flex-1')} />
                    ))}
                </div>
            ))}
        </div>
    )
}
