'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { signIn } from './actions'
import { Button } from '@/components/ui'

export default function LoginPage() {
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const formData = new FormData(e.currentTarget)
        const result = await signIn(formData)
        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-lys-bg">
            {/* Subtle ambient glows — Navy/Teal */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute -right-40 -top-40 w-96 h-96 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(8,145,178,0.08), transparent)',
                    }}
                />
                <div
                    className="absolute -left-40 -bottom-40 w-96 h-96 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(14,116,144,0.06), transparent)',
                    }}
                />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <Image
                            src="/logo/Ly's Cellars - Logo_tagline blue green.png"
                            alt="LY's Cellars"
                            width={252}
                            height={70}
                            priority
                            className="object-contain"
                        />
                    </div>
                </div>

                {/* Card */}
                <div className="bg-lys-surface border border-lys-border rounded-lg p-8 shadow-lg">
                    <h2 className="text-xl font-semibold mb-6 text-lys-primary">
                        Đăng nhập
                    </h2>

                    {error && (
                        <div
                            role="alert"
                            className="mb-5 p-3 rounded-md text-sm font-medium bg-tone-danger-bg border border-tone-danger-border text-tone-danger-fg flex items-start gap-2.5"
                        >
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-lys-secondary" htmlFor="email">
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="ten@company.com"
                                className="w-full h-11 px-3 text-sm rounded-md border border-lys-border-strong bg-white text-lys-primary placeholder:text-lys-dim focus:outline-none focus:border-lys-teal focus:ring-2 focus:ring-lys-teal/20 transition-colors"
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-lys-secondary" htmlFor="password">
                                    Mật khẩu
                                </label>
                                <a href="/forgot-password" className="text-xs text-lys-teal-strong hover:underline">
                                    Quên mật khẩu?
                                </a>
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    placeholder="••••••••"
                                    className="w-full h-11 pl-3 pr-10 text-sm rounded-md border border-lys-border-strong bg-white text-lys-primary placeholder:text-lys-dim focus:outline-none focus:border-lys-teal focus:ring-2 focus:ring-lys-teal/20 transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-lys-muted hover:text-lys-primary transition-colors cursor-pointer"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <Button
                            type="submit"
                            variant="primary"
                            loading={loading}
                            className="w-full h-11 text-sm font-semibold mt-2"
                        >
                            {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
                        </Button>
                    </form>
                </div>

                <p className="text-center mt-6 text-xs text-lys-muted">
                    © 2026 LY&apos;s Cellars · Chỉ dành cho nhân viên nội bộ
                </p>
            </div>
        </div>
    )
}
