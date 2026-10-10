/**
 * Status → tone registry. Single source for badge colors across all modules.
 * Tones map to CSS tokens `--color-tone-{tone}-{fg|bg|border}` in globals.css.
 */
export type Tone = 'neutral' | 'info' | 'brand' | 'success' | 'warning' | 'danger'

export const TONES: readonly Tone[] = ['neutral', 'info', 'brand', 'success', 'warning', 'danger']

const STATUS_TONE: Record<string, Tone> = {
    // neutral — not started / inactive
    DRAFT: 'neutral',
    INACTIVE: 'neutral',
    ARCHIVED: 'neutral',
    UNDELIVERED: 'neutral',
    NEW: 'neutral',
    CLOSED: 'neutral',

    // warning — waiting on someone
    PENDING: 'warning',
    PENDING_APPROVAL: 'warning',
    PENDING_ACCOUNTING: 'warning',
    PREPARING: 'warning',
    UNPAID: 'warning',
    ON_HOLD: 'warning',
    REVIEW: 'warning',
    IN_REVIEW: 'warning',
    REVIEWING_L1: 'warning',
    EXPIRING: 'warning',

    // info — in motion
    SENT: 'info',
    SUBMITTED: 'info',
    IN_PROGRESS: 'info',
    IN_TRANSIT: 'info',
    SHIPPED: 'info',
    PARTIALLY_DELIVERED: 'info',
    PARTIALLY_PAID: 'info',
    PARTIALLY_RECEIVED: 'info',
    PROCESSING: 'info',

    // brand — confirmed, business-positive but not final
    CONFIRMED: 'brand',
    APPROVED: 'brand',
    REVIEWING_L2: 'brand',
    ACTIVE: 'brand',
    INVOICED: 'brand',
    ACCEPTED: 'brand',

    // success — final positive
    PAID: 'success',
    DELIVERED: 'success',
    RECEIVED: 'success',
    COMPLETED: 'success',
    DONE: 'success',
    CLEARED: 'success',
    WON: 'success',

    // danger — negative / blocked
    CANCELLED: 'danger',
    CANCELED: 'danger',
    REJECTED: 'danger',
    OVERDUE: 'danger',
    EXPIRED: 'danger',
    FAILED: 'danger',
    LOST: 'danger',
    BLOCKED: 'danger',
}

/** Resolve tone for a status code. Unknown codes fall back to `neutral`. */
export function getStatusTone(status: string | null | undefined, overrides?: Record<string, Tone>): Tone {
    if (!status) return 'neutral'
    const key = status.toUpperCase()
    return overrides?.[key] ?? STATUS_TONE[key] ?? 'neutral'
}

/** Tailwind classes for a tone (fg + bg + border). */
export const TONE_CLASS: Record<Tone, string> = {
    neutral: 'text-tone-neutral-fg bg-tone-neutral-bg border-tone-neutral-border',
    info: 'text-tone-info-fg bg-tone-info-bg border-tone-info-border',
    brand: 'text-tone-brand-fg bg-tone-brand-bg border-tone-brand-border',
    success: 'text-tone-success-fg bg-tone-success-bg border-tone-success-border',
    warning: 'text-tone-warning-fg bg-tone-warning-bg border-tone-warning-border',
    danger: 'text-tone-danger-fg bg-tone-danger-bg border-tone-danger-border',
}
