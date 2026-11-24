import Link from 'next/link'
import { Wine, ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui'

export default function NotFound() {
    return (
        <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-lys-bg">
            <div className="w-full max-w-md text-center p-8 sm:p-10 bg-lys-surface border border-lys-border rounded-lg shadow-sm">
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-lg bg-lys-teal-soft border border-tone-brand-border flex items-center justify-center text-lys-teal-strong">
                        <Wine size={30} aria-hidden />
                    </div>
                </div>
                <p className="font-mono text-6xl font-bold tracking-tight text-lys-teal-strong mb-2">
                    404
                </p>
                <h1 className="text-lg font-semibold text-lys-primary mb-2">
                    Trang không tồn tại
                </h1>
                <p className="text-sm text-lys-muted mb-6 leading-relaxed">
                    Trang bạn tìm kiếm không có trong hệ thống LY&apos;s Cellars.
                </p>
                <div className="flex justify-center">
                    <Link href="/dashboard" className={buttonVariants({ variant: 'primary' })}>
                        <ArrowLeft size={15} aria-hidden />
                        Về Dashboard
                    </Link>
                </div>
            </div>
        </div>
    )
}
