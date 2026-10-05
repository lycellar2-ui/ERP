import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const controlBase =
    'w-full rounded-md border bg-white text-lys-primary placeholder:text-lys-dim transition-colors ' +
    'focus:outline-none focus:border-lys-teal focus:ring-2 focus:ring-lys-teal/20 ' +
    'disabled:bg-lys-subtle disabled:text-lys-muted disabled:cursor-not-allowed'

const controlSize = 'h-11 sm:h-9 px-3 text-base sm:text-[13px]'

function borderFor(invalid?: boolean) {
    return invalid ? 'border-tone-danger-fg focus:border-tone-danger-fg focus:ring-tone-danger-fg/20' : 'border-lys-border-strong'
}

interface FieldProps {
    label?: ReactNode
    hint?: ReactNode
    error?: ReactNode
    required?: boolean
    className?: string
    /** Render prop receives the generated id to bind label → control. */
    children: (id: string) => ReactNode
}

/** Label + control + hint/error, consistent across all forms. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
    const id = useId()
    return (
        <div className={cn('flex flex-col gap-1', className)}>
            {label && (
                <label htmlFor={id} className="type-caption text-lys-secondary">
                    {label}
                    {required && <span className="text-tone-danger-fg ml-0.5">*</span>}
                </label>
            )}
            {children(id)}
            {error ? (
                <p className="type-caption text-tone-danger-fg" role="alert">{error}</p>
            ) : hint ? (
                <p className="type-caption text-lys-muted">{hint}</p>
            ) : null}
        </div>
    )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
    function Input({ className, invalid, ...props }, ref) {
        return <input ref={ref} aria-invalid={invalid || undefined} className={cn(controlBase, controlSize, borderFor(invalid), className)} {...props} />
    },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
    function Select({ className, invalid, children, ...props }, ref) {
        return (
            <select ref={ref} aria-invalid={invalid || undefined} className={cn(controlBase, controlSize, 'pr-8 cursor-pointer', borderFor(invalid), className)} {...props}>
                {children}
            </select>
        )
    },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
    function Textarea({ className, invalid, rows = 3, ...props }, ref) {
        return (
            <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cn(controlBase, 'px-3 py-2 text-base sm:text-[13px]', borderFor(invalid), className)} {...props} />
        )
    },
)
