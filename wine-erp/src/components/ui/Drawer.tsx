'use client'

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIZE = {
    sm: 'sm:max-w-[480px]',
    md: 'sm:max-w-[640px]',
    lg: 'sm:max-w-[720px]',
    xl: 'sm:max-w-[960px]',
} as const

/** Closes on Escape and keeps focus inside the panel while open. */
export function useOverlayBehavior(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLElement | null>) {
    const onCloseRef = useRef(onClose)
    useLayoutEffect(() => {
        onCloseRef.current = onClose
    })

    useEffect(() => {
        if (!open) return
        const previous = document.activeElement as HTMLElement | null
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        panelRef.current?.focus()

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                onCloseRef.current()
                return
            }
            if (e.key !== 'Tab' || !panelRef.current) return
            const focusables = panelRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            )
            if (focusables.length === 0) return
            const first = focusables[0]
            const last = focusables[focusables.length - 1]
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
            }
        }
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = prevOverflow
            previous?.focus?.()
        }
    }, [open, panelRef])
}

interface DrawerProps {
    open: boolean
    onClose: () => void
    title: ReactNode
    description?: ReactNode
    /** Extra content in the header row, e.g. a StatusBadge. */
    headerExtra?: ReactNode
    /** Buttons rendered on the right of the header, before the close button. */
    actions?: ReactNode
    footer?: ReactNode
    size?: keyof typeof SIZE
    children: ReactNode
    className?: string
}

/** Right-side drawer for detail views and standard create/edit forms. */
export function Drawer({ open, onClose, title, description, headerExtra, actions, footer, size = 'md', children, className }: DrawerProps) {
    const panelRef = useRef<HTMLDivElement>(null)
    useOverlayBehavior(open, onClose, panelRef)

    if (!open || typeof document === 'undefined') return null

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px] animate-fade-in" onClick={onClose} aria-hidden />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className={cn(
                    'relative flex flex-col w-full h-full bg-lys-surface shadow-2xl border-l border-lys-border outline-none',
                    'animate-drawer-in',
                    SIZE[size],
                    className,
                )}
            >
                <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-lys-border">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="type-section-title text-lys-primary truncate">{title}</h2>
                            {headerExtra}
                        </div>
                        {description && <p className="type-caption text-lys-muted mt-1">{description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {actions}
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Đóng"
                            className="flex items-center justify-center w-8 h-8 rounded-md text-lys-muted hover:bg-lys-subtle hover:text-lys-primary active:scale-90 transition-all duration-100 cursor-pointer shrink-0"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
                {footer && (
                    <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-lys-border bg-lys-subtle/50">
                        {footer}
                    </footer>
                )}
            </div>
        </div>,
        document.body,
    )
}
