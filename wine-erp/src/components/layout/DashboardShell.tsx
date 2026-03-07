'use client'

import { useState, useEffect, Suspense } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { NavigationProgress } from '@/components/layout/NavigationProgress'
import { Menu } from 'lucide-react'

function PageSkeleton() {
    return (
        <div className="space-y-6 max-w-screen-2xl animate-pulse">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="h-7 w-56 rounded" style={{ background: '#1B2E3D' }} />
                    <div className="h-4 w-80 rounded mt-2" style={{ background: '#142433' }} />
                </div>
                <div className="h-10 w-32 rounded" style={{ background: '#1B2E3D' }} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="h-3 w-24 rounded mb-3" style={{ background: '#142433' }} />
                        <div className="h-8 w-20 rounded" style={{ background: '#142433' }} />
                    </div>
                ))}
            </div>
            <div className="h-12 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }} />
            <div className="h-72 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }} />
        </div>
    )
}

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])
    return isMobile
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false)
    const isMobile = useIsMobile()
    const [mobileOpen, setMobileOpen] = useState(false)

    // Auto-collapse on mobile
    useEffect(() => {
        if (isMobile) setCollapsed(true)
    }, [isMobile])

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: '#0A1926' }}>
            <NavigationProgress />

            {/* Mobile overlay */}
            {isMobile && mobileOpen && (
                <div
                    className="fixed inset-0 z-40"
                    style={{ background: 'rgba(10,25,38,0.75)' }}
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar: on mobile, show as overlay; on desktop, inline */}
            <div
                className={isMobile ? 'fixed top-0 left-0 h-full z-50 transition-transform duration-200' : ''}
                style={isMobile ? { transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)' } : {}}
            >
                <Sidebar
                    collapsed={isMobile ? false : collapsed}
                    onToggle={() => {
                        if (isMobile) setMobileOpen(false)
                        else setCollapsed(!collapsed)
                    }}
                    onNavigate={isMobile ? () => setMobileOpen(false) : undefined}
                />
            </div>

            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Header
                    title="LY's Cellars"
                    subtitle="Hệ thống quản lý nhập khẩu rượu vang"
                    mobileMenuButton={isMobile ? (
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="p-2 rounded-lg mr-2"
                            style={{ color: '#87CBB9' }}
                        >
                            <Menu size={20} />
                        </button>
                    ) : undefined}
                />

                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
                </main>
            </div>
        </div>
    )
}

