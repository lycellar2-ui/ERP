'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useCallback, useRef } from 'react'
import {
    LayoutDashboard, Package, Users, ShoppingCart, Warehouse,
    Truck, DollarSign, FileText, BarChart3, Settings, ChevronLeft,
    ChevronRight, Building2, FileSignature, Globe, Briefcase,
    Layers, Brain, LogOut, Target, Calculator, Handshake, Stamp, Tag,
    ArrowRightLeft, RotateCcw, ClipboardList, TrendingUp, Wine, QrCode,
    Image as ImageIcon, Megaphone
} from 'lucide-react'

const NAV_GROUPS = [
    {
        label: 'Tổng Quan',
        items: [
            { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard CEO' },
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
            { href: '/dashboard/ai', icon: Brain, label: 'AI & Prompt' },
            { href: '/dashboard/settings', icon: Settings, label: 'Cài Đặt & RBAC' },
        ]
    }
]

// LY's Cellars — Wine glass SVG logo
function LysLogo({ collapsed }: { collapsed: boolean }) {
    return (
        <div
            className="flex items-center gap-3 px-4 py-4"
            style={{ borderBottom: '1px solid #2A4355', minHeight: '64px' }}
        >
            {/* Wine glass SVG — matches real logo */}
            <svg
                width="28"
                height="28"
                viewBox="0 0 40 48"
                fill="none"
                className="flex-shrink-0"
                aria-hidden="true"
            >
                {/* Glass body */}
                <path
                    d="M8 4 Q8 20 20 26 Q32 20 32 4 Z"
                    stroke="#87CBB9"
                    strokeWidth="1.8"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* Stem */}
                <line
                    x1="20" y1="26" x2="20" y2="40"
                    stroke="#87CBB9"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                />
                {/* Base */}
                <line
                    x1="13" y1="40" x2="27" y2="40"
                    stroke="#87CBB9"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                />
                {/* Teal swirl — the signature element from logo */}
                <path
                    d="M20 22 Q16 16 18 10 Q20 6 22 10"
                    stroke="#A5DED0"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                />
            </svg>

            {!collapsed && (
                <div className="min-w-0">
                    <p
                        className="font-bold text-lg leading-tight truncate"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}
                    >
                        LY&apos;s Cellars
                    </p>
                    <p
                        className="text-xs truncate"
                        style={{ color: '#4A6A7A', letterSpacing: '0.08em' }}
                    >
                        FINE WINE SPECIALIST
                    </p>
                </div>
            )}
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

    // Smart prefetch: prefetch on hover (with debounce to avoid spam)
    const handlePrefetch = useCallback((href: string) => {
        if (prefetchedRef.current.has(href)) return
        prefetchedRef.current.add(href)
        router.prefetch(href)
    }, [router])

    // Auto-prefetch adjacent tabs when current page loads
    useEffect(() => {
        const allHrefs = NAV_GROUPS.flatMap(g => g.items.map(i => i.href))
        const currentIdx = allHrefs.indexOf(pathname)
        if (currentIdx === -1) return

        // Prefetch prev + next tabs (most likely navigation targets)
        const adjacentIdxs = [currentIdx - 1, currentIdx + 1].filter(
            i => i >= 0 && i < allHrefs.length
        )
        // Also prefetch dashboard (most common return target)
        const toPrefetch = [...adjacentIdxs.map(i => allHrefs[i]), '/dashboard']

        // Delay slightly to not compete with current page load
        const timer = setTimeout(() => {
            toPrefetch.forEach(href => {
                if (href !== pathname && !prefetchedRef.current.has(href)) {
                    prefetchedRef.current.add(href)
                    router.prefetch(href)
                }
            })
        }, 1000)

        return () => clearTimeout(timer)
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
                    className="flex items-center gap-3 w-full px-5 py-3.5 transition-colors duration-150"
                    style={{ color: '#4A6A7A' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#8B1A2E')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#4A6A7A')}
                >
                    <LogOut size={16} className="flex-shrink-0" />
                    {!collapsed && <span className="text-sm">Đăng Xuất</span>}
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
