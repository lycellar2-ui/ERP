'use client'

import { useState, useEffect, Suspense } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { NavigationProgress } from '@/components/layout/NavigationProgress'
import { Menu } from 'lucide-react'
import { type SessionUser } from '@/lib/session'

function PageSkeleton() {
    return (
        <div className="space-y-6 max-w-screen-2xl animate-pulse">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="h-7 w-56 rounded" style={{ background: '#FFFFFF' }} />
                    <div className="h-4 w-80 rounded mt-2" style={{ background: '#FFFFFF' }} />
                </div>
                <div className="h-10 w-32 rounded" style={{ background: '#FFFFFF' }} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="p-5 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <div className="h-3 w-24 rounded mb-3" style={{ background: '#FFFFFF' }} />
                        <div className="h-8 w-20 rounded" style={{ background: '#FFFFFF' }} />
                    </div>
                ))}
            </div>
            <div className="h-12 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }} />
            <div className="h-72 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }} />
        </div>
    )
}


export function DashboardShell({ children, currentUser }: { children: React.ReactNode; currentUser: SessionUser | null }) {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    // Auto-collapse on tablet viewports, keep mobile drawer expanded and large desktop expanded
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768
            setIsMobile(mobile)
            if (mobile) {
                setCollapsed(false)
            } else if (window.innerWidth < 1024) {
                setCollapsed(true)
            } else {
                setCollapsed(false)
            }
        }
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
        <div className="flex h-screen overflow-hidden bg-lys-bg">
            <NavigationProgress />

            {/* Mobile backdrop overlay */}
            <div
                className={`fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-xs transition-opacity duration-200 md:hidden ${
                    mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={() => setMobileOpen(false)}
                aria-hidden={!mobileOpen}
            />

            {/* Sidebar: on mobile, drawer sliding in from left; on desktop, static inline */}
            <div
                className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0 ${
                    mobileOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <Sidebar
                    currentUser={currentUser}
                    collapsed={collapsed}
                    isMobile={isMobile}
                    onToggle={() => setCollapsed(!collapsed)}
                    onNavigate={() => setMobileOpen(false)}
                    onCloseMobile={() => setMobileOpen(false)}
                />
            </div>

            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Header
                    currentUser={currentUser}
                    mobileMenuButton={
                        <button
                            type="button"
                            onClick={() => setMobileOpen(true)}
                            aria-label="Mở menu điều hướng"
                            className="p-1.5 rounded-md mr-1.5 text-lys-teal-strong hover:bg-lys-subtle transition-colors cursor-pointer md:hidden flex items-center justify-center shrink-0"
                        >
                            <Menu size={20} />
                        </button>
                    }
                />

                <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-2.5 sm:p-3 md:p-4 outline-none">
                    <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
                </main>
            </div>
        </div>
    )
}

