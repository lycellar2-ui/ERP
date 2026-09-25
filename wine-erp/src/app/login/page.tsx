'use client'

import { useState } from 'react'
import Image from 'next/image'
import { signIn } from './actions'

export default function LoginPage() {
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

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
        <div
            className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 50%, #FFFFFF 100%)',
            }}
        >
            {/* Subtle ambient glows — Navy/Teal */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute -right-40 -top-40 w-96 h-96 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(135,203,185,0.06), transparent)',
                    }}
                />
                <div
                    className="absolute -left-40 -bottom-40 w-96 h-96 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(26,67,99,0.3), transparent)',
                    }}
                />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-10">
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
                <div
                    className="rounded-md p-8"
                    style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 24px 64px rgba(15, 23, 42, 0.45)',
                    }}
                >
                    <h2 className="text-xl font-semibold mb-6" style={{ color: '#0F172A' }}>
                        Đăng nhập
                    </h2>

                    {error && (
                        <div
                            className="mb-4 p-3 rounded text-sm"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                        >
                            {error}
                        </div>
                    )}

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium" style={{ color: '#475569' }} htmlFor="email">
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="ten@company.com"
                                className="w-full px-4 text-sm"
                                style={{
                                    height: '44px',
                                    background: '#FFFFFF',
                                    border: '1px solid #E2E8F0',
                                    color: '#0F172A',
                                    outline: 'none',
                                    borderRadius: '6px',
                                    transition: 'border-color 150ms',
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium" style={{ color: '#475569' }} htmlFor="password">
                                    Mật khẩu
                                </label>
                                <a href="/forgot-password" className="text-xs" style={{ color: '#0891B2' }}>
                                    Quên mật khẩu?
                                </a>
                            </div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                placeholder="••••••••"
                                className="w-full px-4 text-sm"
                                style={{
                                    height: '44px',
                                    background: '#FFFFFF',
                                    border: '1px solid #E2E8F0',
                                    color: '#0F172A',
                                    outline: 'none',
                                    borderRadius: '6px',
                                    transition: 'border-color 150ms',
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full font-semibold text-sm mt-2 transition-all duration-200"
                            style={{
                                height: '44px',
                                background: loading ? '#5ba396' : '#87CBB9',
                                color: '#0F172A',
                                border: 'none',
                                cursor: loading ? 'wait' : 'pointer',
                                borderRadius: '6px',
                                opacity: loading ? 0.7 : 1,
                            }}
                            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#A5DED0' }}
                            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#87CBB9' }}
                        >
                            {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
                        </button>
                    </form>
                </div>

                <p className="text-center mt-6 text-xs" style={{ color: '#64748B' }}>
                    © 2026 LY&apos;s Cellars · Chỉ dành cho nhân viên nội bộ
                </p>
            </div>
        </div>
    )
}
