import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
    /**
     * Omit on dashboard routes — the global Header already shows the route title.
     * Use only on standalone pages (print, public, full-page forms).
     */
    title?: ReactNode
    /** Short context line or inline summary metrics (left side). */
    description?: ReactNode
    /** Right-aligned actions. Put the primary action last. */
    actions?: ReactNode
    className?: string
}

/** Standard page toolbar: context on the left, actions on the right. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
    return (
        <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)} data-page-header>
            <div className="min-w-0">
                {title && <h1 className="type-page-title text-lys-primary">{title}</h1>}
                {description && <div className={cn('type-body text-lys-muted', title && 'mt-0.5')}>{description}</div>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
        </div>
    )
}

/** Standard vertical rhythm for a dashboard page. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('flex flex-col gap-4', className)}>{children}</div>
}
