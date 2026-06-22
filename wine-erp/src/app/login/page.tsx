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
                background: 'linear-gradient(135deg, #0A1926 0%, #142433 50%, #1B2E3D 100%)',
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
                            src="/logo/logo_tagline_white_green.png"
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
                        background: '#1B2E3D',
                        border: '1px solid #2A4355',
                        boxShadow: '0 24px 64px rgba(10,25,38,0.7)',
                    }}
                >
                    <h2 className="text-xl font-semibold mb-6" style={{ color: '#E8F1F2' }}>
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
                            <label className="block text-sm font-medium" style={{ color: '#8AAEBB' }} htmlFor="email">
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
                                    background: '#142433',
                                    border: '1px solid #2A4355',
                                    color: '#E8F1F2',
                                    outline: 'none',
                                    borderRadius: '6px',
                                    transition: 'border-color 150ms',
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium" style={{ color: '#8AAEBB' }} htmlFor="password">
                                    Mật khẩu
                                </label>
                                <a href="/forgot-password" className="text-xs" style={{ color: '#87CBB9' }}>
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
                                    background: '#142433',
                                    border: '1px solid #2A4355',
                                    color: '#E8F1F2',
                                    outline: 'none',
                                    borderRadius: '6px',
                                    transition: 'border-color 150ms',
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
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
                                color: '#0A1926',
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

                <p className="text-center mt-6 text-xs" style={{ color: '#4A6A7A' }}>
                    © 2026 LY&apos;s Cellars · Chỉ dành cho nhân viên nội bộ
                </p>
            </div>
        </div>
    )
}
