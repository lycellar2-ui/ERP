'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useCallback, useRef, useState } from 'react'
import { signOut } from '@/app/login/actions'
import {
    LayoutDashboard, Package, Users, ShoppingCart, Warehouse,
    Truck, DollarSign, FileText, BarChart3, Settings, ChevronLeft,
    ChevronRight, Building2, FileSignature, Globe, Briefcase,
    Layers, Brain, LogOut, Target, Calculator, Handshake, Stamp, Tag,
    ArrowRightLeft, RotateCcw, ClipboardList, TrendingUp, Wine, QrCode,
    Image as ImageIcon, Megaphone, Ship, ClipboardCheck, Shield, ScrollText
} from 'lucide-react'

const NAV_GROUPS = [
    {
        label: 'Tổng Quan',
        items: [
            { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard CEO' },
            { href: '/dashboard/proposals', icon: ClipboardCheck, label: 'Tờ Trình — Đề Xuất' },
        ]
    },
    {
        label: 'Danh Mục',
        items: [
            { href: '/dashboard/products', icon: Package, label: 'Sản Phẩm' },
            { href: '/dashboard/suppliers', icon: Building2, label: 'Nhà Cung Cấp' },
            { href: '/dashboard/customers', icon: Users, label: 'Khách Hàng' },
            { href: '/dashboard/contracts', icon: FileSignature, label: 'Hợp Đồng' },
        ]
    },
    {
        label: 'Mua Hàng',
        items: [
            { href: '/dashboard/procurement', icon: ShoppingCart, label: 'Đơn Mua Hàng' },
            { href: '/dashboard/shipments', icon: Ship, label: 'Lô Hàng' },
            { href: '/dashboard/agency', icon: Globe, label: 'Agency Portal' },
            { href: '/dashboard/tax', icon: Layers, label: 'Tra Cứu Thuế' },
            { href: '/dashboard/costing', icon: Calculator, label: 'Tính Giá Vốn (CST)' },
        ]
    },
    {
        label: 'Kho & Bán Hàng',
        items: [
            { href: '/dashboard/warehouse', icon: Warehouse, label: 'Kho Hàng' },
            { href: '/dashboard/transfers', icon: ArrowRightLeft, label: 'Chuyển Kho' },
            { href: '/dashboard/stock-count', icon: ClipboardList, label: 'Kiểm Kê' },
            { href: '/dashboard/sales', icon: Briefcase, label: 'Đơn Bán Hàng' },
            { href: '/dashboard/quotations', icon: FileText, label: 'Báo Giá' },
            { href: '/dashboard/price-list', icon: Tag, label: 'Bảng Giá' },
            { href: '/dashboard/margin', icon: Calculator, label: 'Check Margin' },
            { href: '/dashboard/crm', icon: Users, label: 'CRM — Khách Hàng' },
            { href: '/dashboard/pipeline', icon: Target, label: 'Sales Pipeline' },
            { href: '/dashboard/consignment', icon: Handshake, label: 'Ký Gửi (CSG)' },
            { href: '/dashboard/allocation', icon: BarChart3, label: 'Allocation Engine' },
            { href: '/dashboard/delivery', icon: Truck, label: 'Vận Chuyển' },
            { href: '/dashboard/returns', icon: ShoppingCart, label: 'Trả Hàng & CN' },
            { href: '/dashboard/pos', icon: Wine, label: 'POS Showroom' },
            { href: '/dashboard/qr-codes', icon: QrCode, label: 'QR Truy Xuất' },
        ]
    },
    {
        label: 'Tài Chính',
        items: [
            { href: '/dashboard/finance', icon: DollarSign, label: 'Công Nợ & Kế Toán' },
            { href: '/dashboard/declarations', icon: FileText, label: 'Tờ Khai Thuế' },
            { href: '/dashboard/stamps', icon: Stamp, label: 'Quản Lý Tem' },
            { href: '/dashboard/reports', icon: BarChart3, label: 'Báo Cáo' },
            { href: '/dashboard/market-price', icon: TrendingUp, label: 'Giá Thị Trường' },
            { href: '/dashboard/kpi', icon: Target, label: 'KPI Chỉ Tiêu' },
        ]
    },
    {
        label: 'Marketing',
        items: [
            { href: '/dashboard/media', icon: ImageIcon, label: 'Thư Viện Ảnh' },
        ]
    },
    {
        label: 'Hệ Thống',
        items: [
            { href: '/dashboard/audit-log', icon: ScrollText, label: 'Nhật Ký Hệ Thống' },
            { href: '/dashboard/ai', icon: Brain, label: 'AI & Prompt' },
            { href: '/dashboard/settings/approval-matrix', icon: Shield, label: 'Ma Trận Phân Quyền' },
            { href: '/dashboard/settings', icon: Settings, label: 'Cài Đặt & RBAC' },
        ]
    }
]

// LY's Cellars — Wine glass PNG logo
function LysLogo({ collapsed }: { collapsed: boolean }) {
    if (collapsed) {
        return (
            <div
                className="flex items-center justify-center py-4 w-full"
                style={{ borderBottom: '1px solid #2A4355', minHeight: '64px' }}
            >
                <Image
                    src="/logo/logo_icon_white_green.png"
                    alt="LY's Cellars"
                    width={20}
                    height={36}
                    priority
                    className="object-contain"
                />
            </div>
        )
    }

    return (
        <div
            className="flex items-center px-6 py-4 w-full"
            style={{ borderBottom: '1px solid #2A4355', minHeight: '64px' }}
        >
            <Image
                src="/logo/logo_tagline_white_green.png"
                alt="LY's Cellars"
                width={130}
                height={36}
                priority
                className="object-contain"
            />
        </div>
    )
}

interface SidebarProps {
    collapsed: boolean
    onToggle: () => void
    onNavigate?: () => void
}

export function Sidebar({ collapsed, onToggle, onNavigate }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const prefetchedRef = useRef(new Set<string>())
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const handleLogout = useCallback(async () => {
        setIsLoggingOut(true)
        try {
            await signOut()
        } catch (err) {
            console.error('Đăng xuất thất bại:', err)
            setIsLoggingOut(false)
        }
    }, [])

    // Smart prefetch: prefetch on hover (with debounce to avoid spam)
    const handlePrefetch = useCallback((href: string) => {
        if (prefetchedRef.current.has(href)) return
        prefetchedRef.current.add(href)
        router.prefetch(href)
    }, [router])

    // Auto-prefetch ALL sidebar links after current page loads
    // This ensures every link click is instant from Router Cache
    useEffect(() => {
        const allHrefs = NAV_GROUPS.flatMap(g => g.items.map(i => i.href))

        // Stagger prefetching to avoid thundering herd
        const timers: ReturnType<typeof setTimeout>[] = []
        allHrefs.forEach((href, idx) => {
            if (href === pathname || prefetchedRef.current.has(href)) return
            const timer = setTimeout(() => {
                prefetchedRef.current.add(href)
                router.prefetch(href)
            }, 500 + idx * 100) // Stagger: 500ms, 600ms, 700ms...
            timers.push(timer)
        })

        return () => timers.forEach(clearTimeout)
    }, [pathname, router])

    return (
        <aside
            className="flex flex-col h-screen sticky top-0 transition-all duration-200"
            style={{
                width: collapsed ? '64px' : '240px',
                background: '#142433',
                borderRight: '1px solid #2A4355',
            }}
        >
            {/* Logo */}
            <LysLogo collapsed={collapsed} />

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-3">
                {NAV_GROUPS.map((group) => (
                    <div key={group.label} className="mb-1">
                        {!collapsed && (
                            <p
                                className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
                                style={{ color: '#4A6A7A' }}
                            >
                                {group.label}
                            </p>
                        )}
                        {group.items.map((item) => {
                            const isActive = pathname === item.href ||
                                (item.href !== '/dashboard' && pathname.startsWith(item.href))
                            const Icon = item.icon

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    title={collapsed ? item.label : undefined}
                                    onClick={onNavigate}
                                    className="flex items-center gap-3 mx-2 px-3 py-2.5 mb-0.5 transition-all duration-150"
                                    style={{
                                        borderRadius: '6px',
                                        background: isActive ? 'rgba(135,203,185,0.12)' : 'transparent',
                                        color: isActive ? '#87CBB9' : '#8AAEBB',
                                        borderLeft: isActive ? '2px solid #87CBB9' : '2px solid transparent',
                                    }}
                                    onMouseEnter={e => {
                                        handlePrefetch(item.href)
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'rgba(135,203,185,0.06)'
                                            e.currentTarget.style.color = '#E8F1F2'
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'transparent'
                                            e.currentTarget.style.color = '#8AAEBB'
                                        }
                                    }}
                                >
                                    <Icon size={18} className="flex-shrink-0" />
                                    {!collapsed && (
                                        <span className="text-sm font-medium truncate">{item.label}</span>
                                    )}
                                </Link>
                            )
                        })}
                    </div>
                ))}
            </nav>

            {/* Bottom: Logout + Toggle */}
            <div style={{ borderTop: '1px solid #2A4355' }}>
                <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="flex items-center gap-3 w-full px-5 py-3.5 transition-colors duration-150 disabled:opacity-50"
                    style={{ color: '#4A6A7A' }}
                    onMouseEnter={e => {
                        if (!isLoggingOut) e.currentTarget.style.color = '#8B1A2E'
                    }}
                    onMouseLeave={e => {
                        if (!isLoggingOut) e.currentTarget.style.color = '#4A6A7A'
                    }}
                >
                    <LogOut size={16} className={`flex-shrink-0 ${isLoggingOut ? 'animate-spin' : ''}`} />
                    {!collapsed && <span className="text-sm">{isLoggingOut ? 'Đang Đăng Xuất...' : 'Đăng Xuất'}</span>}
                </button>

                <button
                    onClick={onToggle}
                    className="flex items-center justify-center w-full py-2 transition-colors duration-150"
                    style={{ color: '#4A6A7A', borderTop: '1px solid #2A4355' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#87CBB9')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#4A6A7A')}
                >
                    {collapsed
                        ? <ChevronRight size={16} />
                        : <ChevronLeft size={16} />
                    }
                </button>
            </div>
        </aside>
    )
}
