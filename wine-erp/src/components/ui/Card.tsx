import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('bg-lys-card border border-lys-border rounded-lg shadow-xs', className)} {...props} />
}

interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    title: ReactNode
    description?: ReactNode
    actions?: ReactNode
}

export function CardHeader({ title, description, actions, className, ...props }: CardHeaderProps) {
    return (
        <div className={cn('flex items-start justify-between gap-3 px-4 py-3 border-b border-lys-border', className)} {...props}>
            <div className="min-w-0">
                <h3 className="type-section-title text-lys-primary truncate">{title}</h3>
                {description && <p className="type-caption text-lys-muted mt-0.5">{description}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
    )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('p-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('flex items-center justify-end gap-2 px-4 py-3 border-t border-lys-border bg-lys-subtle/50 rounded-b-lg', className)}
            {...props}
        />
    )
}
