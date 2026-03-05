'use client'

import { useState } from 'react'
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
                        <svg width="52" height="64" viewBox="0 0 40 52" fill="none" aria-hidden="true">
                            <path
                                d="M6 3 Q6 22 20 30 Q34 22 34 3 Z"
                                stroke="#87CBB9"
                                strokeWidth="1.6"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <line x1="20" y1="30" x2="20" y2="45" stroke="#87CBB9" strokeWidth="1.6" strokeLinecap="round" />
                            <line x1="11" y1="45" x2="29" y2="45" stroke="#87CBB9" strokeWidth="1.6" strokeLinecap="round" />
                            <path
                                d="M20 26 Q15 19 17 11 Q19 6 22 11"
                                stroke="#A5DED0"
                                strokeWidth="1.4"
                                fill="none"
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>
                    <h1
                        className="text-3xl font-bold mb-1"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}
                    >
                        LY&apos;s Cellars
                    </h1>
                    <p className="text-xs tracking-widest" style={{ color: '#4A6A7A', letterSpacing: '0.12em' }}>
                        FINE WINE SPECIALIST
                    </p>
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
