import type { ComponentType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { getStatusTone, TONE_CLASS, type Tone } from '@/lib/ui/status'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    tone?: Tone
    icon?: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
    children: ReactNode
}

export function Badge({ tone = 'neutral', icon: Icon, className, children, ...props }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 h-5 px-2 rounded-md border text-[11px] font-semibold whitespace-nowrap',
                TONE_CLASS[tone],
                className,
            )}
            {...props}
        >
            {Icon && <Icon size={11} aria-hidden />}
            {children}
        </span>
    )
}

interface StatusBadgeProps extends Omit<BadgeProps, 'tone' | 'children'> {
    status: string | null | undefined
    /** Display text (already localized). Falls back to the raw status code. */
    label?: ReactNode
    /** Per-module tone overrides, e.g. { DELIVERED: 'brand' }. */
    toneOverrides?: Record<string, Tone>
}

export function StatusBadge({ status, label, toneOverrides, ...props }: StatusBadgeProps) {
    return (
        <Badge tone={getStatusTone(status, toneOverrides)} {...props}>
            {label ?? status ?? '—'}
        </Badge>
    )
}
