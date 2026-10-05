import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-colors cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lys-teal',
    {
        variants: {
            variant: {
                primary: 'bg-lys-teal-strong text-white hover:bg-lys-teal-hover shadow-xs',
                secondary: 'bg-white text-lys-primary border border-lys-border-strong hover:bg-lys-subtle',
                ghost: 'text-lys-secondary hover:bg-lys-subtle hover:text-lys-primary',
                link: 'text-lys-teal-strong hover:text-lys-teal-hover hover:underline px-0',
                danger: 'bg-tone-danger-fg text-white hover:bg-red-800 shadow-xs',
                'danger-outline': 'bg-white text-tone-danger-fg border border-tone-danger-border hover:bg-tone-danger-bg',
            },
            size: {
                sm: 'h-8 px-3 text-xs',
                md: 'h-11 sm:h-9 px-4 text-[13px]',
                icon: 'h-11 w-11 sm:h-9 sm:w-9 p-0',
                'icon-sm': 'h-8 w-8 p-0',
            },
        },
        defaultVariants: { variant: 'primary', size: 'md' },
    },
)

export interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { className, variant, size, loading, disabled, children, type = 'button', ...props },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(buttonVariants({ variant, size }), className)}
            {...props}
        >
            {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
            {children}
        </button>
    )
})
