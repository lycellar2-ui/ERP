'use client'

import { useRef, useState, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { useOverlayBehavior } from './Drawer'

interface ModalProps {
    open: boolean
    onClose: () => void
    title: ReactNode
    footer?: ReactNode
    children: ReactNode
    className?: string
}

/** Centered modal — use only for short confirmations/prompts. Forms go in <Drawer>. */
export function Modal({ open, onClose, title, footer, children, className }: ModalProps) {
    const panelRef = useRef<HTMLDivElement>(null)
    useOverlayBehavior(open, onClose, panelRef)

    if (!open || typeof document === 'undefined') return null

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className={cn(
                    'relative w-full max-w-md bg-lys-surface border border-lys-border rounded-lg shadow-xl outline-none',
                    'animate-modal-in',
                    className,
                )}
            >
                <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-lys-border">
                    <h2 className="type-section-title text-lys-primary">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng"
                        className="flex items-center justify-center w-8 h-8 rounded-md text-lys-muted hover:bg-lys-subtle hover:text-lys-primary active:scale-90 transition-all duration-100 cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </header>
                <div className="px-5 py-4 type-body text-lys-secondary">{children}</div>
                {footer && <footer className="flex justify-end gap-2 px-5 py-3 border-t border-lys-border">{footer}</footer>}
            </div>
        </div>,
        document.body,
    )
}

interface ConfirmDialogProps {
    open: boolean
    onClose: () => void
    onConfirm: () => void
    title: ReactNode
    message: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    loading?: boolean
}

export function ConfirmDialog({
    open, onClose, onConfirm, title, message,
    confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', danger, loading,
}: ConfirmDialogProps) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
                    <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
                </>
            }
        >
            <div className="flex gap-3">
                {danger && (
                    <div className="flex items-center justify-center w-9 h-9 rounded-md border shrink-0 text-tone-danger-fg bg-tone-danger-bg border-tone-danger-border animate-pop">
                        <AlertTriangle size={18} aria-hidden />
                    </div>
                )}
                <div>{message}</div>
            </div>
        </Modal>
    )
}

export interface ConfirmConfig {
    title: ReactNode
    message: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
    variant?: 'danger' | 'warning' | 'primary'
    onConfirm?: () => void | Promise<void>
}

/**
 * Hook providing a non-blocking, modern confirmation dialog.
 * Replaces crude window.confirm() calls with unified Light Design System dialog.
 * Supports both promise-based (`const ok = await confirm(...)`) and callback-based (`onConfirm: ...`).
 */
export function useConfirmDialog() {
    const [config, setConfig] = useState<ConfirmConfig | null>(null)
    const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null)
    const [loading, setLoading] = useState(false)

    const confirm = useCallback((opts: ConfirmConfig): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
            setConfig(opts)
            setResolver(() => resolve)
        })
    }, [])

    const handleClose = () => {
        if (!loading) {
            setConfig(null)
            if (resolver) {
                resolver(false)
                setResolver(null)
            }
        }
    }

    const handleConfirm = async () => {
        if (!config) return
        try {
            setLoading(true)
            if (config.onConfirm) {
                await config.onConfirm()
            }
            if (resolver) {
                resolver(true)
                setResolver(null)
            }
            setConfig(null)
        } finally {
            setLoading(false)
        }
    }

    const isDanger = config?.danger || config?.variant === 'danger' || config?.variant === 'warning'

    const dialog = config ? (
        <ConfirmDialog
            open={!!config}
            onClose={handleClose}
            onConfirm={handleConfirm}
            title={config.title}
            message={config.message}
            confirmLabel={config.confirmLabel}
            cancelLabel={config.cancelLabel}
            danger={isDanger}
            loading={loading}
        />
    ) : null

    return { confirm, dialog }
}
