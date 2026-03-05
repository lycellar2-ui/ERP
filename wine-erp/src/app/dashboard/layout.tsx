'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [collapsed, setCollapsed] = useState(false)

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: '#0A1926' }}>
            {/* Sidebar */}
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

            {/* Main content */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Header title="LY's Cellars" subtitle="Hệ thống quản lý nhập khẩu rượu vang" />

                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
