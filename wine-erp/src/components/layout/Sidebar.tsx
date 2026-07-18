'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { signOut } from '@/app/login/actions'
import { type SessionUser } from '@/lib/session'
import {
    LayoutDashboard, Package, Users, ShoppingCart, Warehouse,
    Truck, DollarSign, FileText, BarChart3, Settings, ChevronLeft,
    ChevronRight, Building2, FileSignature, Globe, Briefcase,
    Layers, Brain, LogOut, Target, Calculator, Handshake, Stamp, Tag,
    ArrowRightLeft, RotateCcw, ClipboardList, TrendingUp, Wine, QrCode,
    Image as ImageIcon, Megaphone, Ship, ClipboardCheck, Shield, ScrollText
} from 'lucide-react'

interface NavItem {
    href: string
    icon: React.FC<any>
    label: string
    permission?: string
}

interface NavGroup {
    label: string
    items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
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
            { href: '/dashboard/products', icon: Package, label: 'Sản Phẩm', permission: 'MDM:READ' },
            { href: '/dashboard/suppliers', icon: Building2, label: 'Nhà Cung Cấp', permission: 'MDM:READ' },
            { href: '/dashboard/customers', icon: Users, label: 'Khách Hàng', permission: 'MDM:READ' },
            { href: '/dashboard/contracts', icon: FileSignature, label: 'Hợp Đồng', permission: 'CNT:READ' },
        ]
    },
    {
        label: 'Mua Hàng',
        items: [
            { href: '/dashboard/procurement', icon: ShoppingCart, label: 'Đơn Mua Hàng', permission: 'PRC:READ' },
            { href: '/dashboard/shipments', icon: Ship, label: 'Lô Hàng', permission: 'PRC:READ' },
            // { href: '/dashboard/agency', icon: Globe, label: 'Agency Portal', permission: 'AGN:READ' },
            // { href: '/dashboard/tax', icon: Layers, label: 'Tra Cứu Thuế', permission: 'TAX:READ' },
            { href: '/dashboard/costing', icon: Calculator, label: 'Tính Giá Vốn (CST)', permission: 'CST:READ' },
        ]
    },
    {
        label: 'Kho & Bán Hàng',
        items: [
            { href: '/dashboard/warehouse', icon: Warehouse, label: 'Kho Hàng', permission: 'WMS:READ' },
            { href: '/dashboard/transfers', icon: ArrowRightLeft, label: 'Chuyển Kho', permission: 'TRS:READ' },
            { href: '/dashboard/stock-count', icon: ClipboardList, label: 'Kiểm Kê', permission: 'WMS:READ' },
            { href: '/dashboard/sales', icon: Briefcase, label: 'Đơn Bán Hàng', permission: 'SLS:READ' },
            { href: '/dashboard/quotations', icon: FileText, label: 'Báo Giá', permission: 'SLS:READ' },
            { href: '/dashboard/price-list', icon: Tag, label: 'Bảng Giá', permission: 'SLS:READ' },
            { href: '/dashboard/margin', icon: Calculator, label: 'Check Margin', permission: 'SLS:READ' },
            { href: '/dashboard/crm', icon: Users, label: 'CRM — Khách Hàng', permission: 'CRM:READ' },
            { href: '/dashboard/consignment', icon: Handshake, label: 'Ký Gửi (CSG)', permission: 'CSG:READ' },
            // { href: '/dashboard/allocation', icon: BarChart3, label: 'Allocation Engine', permission: 'SLS:READ' },
            // { href: '/dashboard/delivery', icon: Truck, label: 'Vận Chuyển', permission: 'SLS:READ' },
            { href: '/dashboard/returns', icon: ShoppingCart, label: 'Trả Hàng & CN', permission: 'SLS:READ' },
            { href: '/dashboard/pos', icon: Wine, label: 'POS Showroom', permission: 'SLS:READ' },
            // { href: '/dashboard/qr-codes', icon: QrCode, label: 'QR Truy Xuất', permission: 'SLS:READ' },
        ]
    },
    {
        label: 'Tài Chính',
        items: [
            { href: '/dashboard/finance', icon: DollarSign, label: 'Công Nợ & Kế Toán', permission: 'FIN:READ' },
            // { href: '/dashboard/declarations', icon: FileText, label: 'Tờ Khai Thuế', permission: 'TAX:READ' },
            // { href: '/dashboard/stamps', icon: Stamp, label: 'Quản Lý Tem', permission: 'STM:READ' },
            { href: '/dashboard/reports', icon: BarChart3, label: 'Báo Cáo', permission: 'RPT:READ' },
            // { href: '/dashboard/market-price', icon: TrendingUp, label: 'Giá Thị Trường', permission: 'RPT:READ' },
            { href: '/dashboard/kpi', icon: Target, label: 'KPI Chỉ Tiêu', permission: 'KPI:READ' },
        ]
    },
    {
        label: 'Marketing',
        items: [
            // { href: '/dashboard/media', icon: ImageIcon, label: 'Thư Viện Ảnh', permission: 'MDM:READ' },
        ]
    },
    {
        label: 'Hệ Thống',
        items: [
            { href: '/dashboard/audit-log', icon: ScrollText, label: 'Nhật Ký Hệ Thống', permission: 'SYS:READ' },
            { href: '/dashboard/ai', icon: Brain, label: 'AI & Prompt', permission: 'SYS:ADMIN' },
            { href: '/dashboard/settings/approval-matrix', icon: Shield, label: 'Ma Trận Phân Quyền', permission: 'SYS:ADMIN' },
            { href: '/dashboard/settings', icon: Settings, label: 'Cài Đặt & RBAC', permission: 'SYS:ADMIN' },
        ]
    }
]

// Data prefetch map: when hovering a sidebar link, prefetch page data into TanStack Query cache
// Uses dynamic import to avoid bundling all actions into sidebar chunk
const DATA_PREFETCH_MAP: Record<string, (qc: any) => void> = {
    '/dashboard/sales': (qc) => {
        import('@/app/dashboard/sales/actions').then(({ getSalesPageData }) => {
            qc.prefetchQuery({
                queryKey: ['sales', { page: 1, sortBy: 'createdAt', sortDir: 'desc' }],
                queryFn: () => getSalesPageData({ page: 1, pageSize: 20 }),
                staleTime: 30_000,
            })
        })
    },
    '/dashboard/products': (qc) => {
        import('@/app/dashboard/products/actions').then(({ getProductsPageData }) => {
            qc.prefetchQuery({
                queryKey: ['products', { page: 1, pageSize: 20 }],
                queryFn: () => getProductsPageData({ page: 1, pageSize: 20 }),
                staleTime: 30_000,
            })
        })
    },
    '/dashboard/customers': (qc) => {
        import('@/app/dashboard/customers/actions').then(({ getCustomers, getCustomerStats, getCustomerChannels, getSalesRepList }) => {
            qc.prefetchQuery({
                queryKey: ['customers', { page: 1, pageSize: 25 }],
                queryFn: async () => {
                    const [data, stats, channels, salesReps] = await Promise.all([
                        getCustomers({ pageSize: 25 }),
                        getCustomerStats(),
                        getCustomerChannels(),
                        getSalesRepList(),
                    ])
                    return { rows: data.rows, total: data.total, stats, channels, salesReps }
                },
                staleTime: 30_000,
            })
        })
    },
    '/dashboard/quotations': (qc) => {
        import('@/app/dashboard/quotations/actions').then(({ getQuotations }) => {
            qc.prefetchQuery({
                queryKey: ['quotations', {}],
                queryFn: () => getQuotations(),
                staleTime: 30_000,
            })
        })
    },
}

// LY's Cellars — Wine glass PNG logo
function LysLogo({ collapsed }: { collapsed: boolean }) {
    if (collapsed) {
        return (
            <div
                className="flex items-center justify-center w-full"
                style={{ borderBottom: '1px solid #2A4355', height: '64px' }}
            >
                <Image
                    src="/logo/Ly's Cellars - Logo_icon blue green.png"
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
            className="flex items-center px-6 w-full"
            style={{ borderBottom: '1px solid #2A4355', height: '64px' }}
        >
            <Image
                src="/logo/Ly's Cellars - Logo_tagline blue green.png"
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
    currentUser: SessionUser | null
    collapsed: boolean
    onToggle: () => void
    onNavigate?: () => void
}

export function Sidebar({ currentUser, collapsed, onToggle, onNavigate }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const queryClient = useQueryClient()
    const prefetchedRef = useRef(new Set<string>())
    const dataPrefetchedRef = useRef(new Set<string>())
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const filteredGroups = useMemo(() => {
        return NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(item => {
                if (!item.permission) return true
                if (!currentUser) return false
                if (currentUser.roles.includes('CEO') || currentUser.roles.includes('CEO Secondary')) return true
                return currentUser.permissions.includes(item.permission)
            })
            return { ...group, items: visibleItems }
        }).filter(group => group.items.length > 0)
    }, [currentUser])

    const bestMatchHref = useMemo(() => {
        let best = ''
        let maxLen = 0
        for (const group of filteredGroups) {
            for (const item of group.items) {
                if (pathname === item.href) {
                    return item.href
                }
                if (item.href !== '/dashboard' && pathname.startsWith(item.href + '/')) {
                    if (item.href.length > maxLen) {
                        best = item.href
                        maxLen = item.href.length
                    }
                }
            }
        }
        return best
    }, [pathname, filteredGroups])

    const handleLogout = useCallback(async () => {
        setIsLoggingOut(true)
        try {
            await signOut()
        } catch (err) {
            // Next.js redirect throws an error internally. Catching it and forcing
            // a hard client-side redirect ensures the Next.js router cache is fully cleared.
            window.location.href = '/login'
            return
        }
        window.location.href = '/login'
    }, [])

    // Smart prefetch: prefetch route + data on hover
    const handlePrefetch = useCallback((href: string) => {
        if (!prefetchedRef.current.has(href)) {
            prefetchedRef.current.add(href)
            router.prefetch(href)
        }
        // Prefetch TanStack Query data (only once per session)
        if (!dataPrefetchedRef.current.has(href)) {
            dataPrefetchedRef.current.add(href)
            const prefetcher = DATA_PREFETCH_MAP[href]
            if (prefetcher) prefetcher(queryClient)
        }
    }, [router, queryClient])

    // Auto-prefetch ALL sidebar links after current page loads
    // This ensures every link click is instant from Router Cache
    useEffect(() => {
        const allHrefs = filteredGroups.flatMap(g => g.items.map(i => i.href))

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
    }, [pathname, router, filteredGroups])

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
                {filteredGroups.map((group) => (
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
                            const isActive = item.href === bestMatchHref
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
