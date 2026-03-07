'use client'

import { Bell, Search } from 'lucide-react'

interface HeaderProps {
    title: string
    subtitle?: string
    mobileMenuButton?: React.ReactNode
}

export function Header({ title, subtitle, mobileMenuButton }: HeaderProps) {
    return (
        <header
            className="sticky top-0 z-10 flex items-center justify-between px-6"
            style={{
                height: '64px',
                background: 'rgba(20,36,51,0.92)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid #2A4355',
            }}
        >
            {/* Page title */}
            <div className="flex items-center">
                {mobileMenuButton}
                <div>
                    <h1
                        className="font-semibold text-lg leading-tight"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}
                    >
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-xs hidden sm:block" style={{ color: '#4A6A7A' }}>{subtitle}</p>
                    )}
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
                {/* Search */}
                <button
                    className="flex items-center gap-2 px-3 py-2 text-sm transition-all duration-150"
                    style={{
                        background: '#1B2E3D',
                        color: '#4A6A7A',
                        border: '1px solid #2A4355',
                        borderRadius: '6px',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#87CBB9'
                        e.currentTarget.style.color = '#8AAEBB'
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#2A4355'
                        e.currentTarget.style.color = '#4A6A7A'
                    }}
                >
                    <Search size={15} />
                    <span className="hidden sm:inline text-xs">Tìm kiếm...</span>
                    <kbd
                        className="hidden sm:inline text-xs px-1.5 py-0.5"
                        style={{ background: '#2A4355', color: '#4A6A7A', borderRadius: '4px', fontSize: '10px' }}
                    >
                        ⌘K
                    </kbd>
                </button>

                {/* Notifications */}
                <button
                    className="relative flex items-center justify-center w-9 h-9 transition-all duration-150"
                    style={{
                        background: '#1B2E3D',
                        border: '1px solid #2A4355',
                        color: '#8AAEBB',
                        borderRadius: '6px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}
                >
                    <Bell size={16} />
                    {/* Notification dot — Burgundy */}
                    <span
                        className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                        style={{ background: '#8B1A2E' }}
                    />
                </button>

                {/* Avatar */}
                <button
                    className="flex items-center gap-2 pl-1 pr-3 py-1 transition-all duration-150"
                    style={{
                        background: '#1B2E3D',
                        border: '1px solid #2A4355',
                        borderRadius: '6px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}
                >
                    {/* Avatar circle — Teal */}
                    <div
                        className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                        style={{
                            background: 'rgba(135,203,185,0.2)',
                            color: '#87CBB9',
                            border: '1px solid rgba(135,203,185,0.3)',
                            borderRadius: '4px',
                        }}
                    >
                        A
                    </div>
                    <span className="text-sm hidden sm:inline" style={{ color: '#8AAEBB' }}>Admin</span>
                </button>
            </div>
        </header>
    )
}
