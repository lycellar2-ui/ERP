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
    Image as ImageIcon, Megaphone, Ship, ClipboardCheck, Shield, ScrollText, MapPin,
    FileCheck2, CreditCard
} from 'lucide-react'

import { useAppLocale } from '@/lib/i18n'

interface NavItem {
    href: string
    icon: React.FC<any>
    label: string
    labelEn?: string
    permission?: string
}

interface NavGroup {
    label: string
    labelEn?: string
    items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
    {
        label: 'Tổng Quan',
        labelEn: 'Overview',
        items: [
            { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard CEO', labelEn: 'Executive Dashboard' },
            { href: '/dashboard/proposals', icon: ClipboardCheck, label: 'Tờ Trình — Đề Xuất', labelEn: 'Proposals & Submissions' },
        ]
    },
    {
        label: 'Danh Mục',
        labelEn: 'Master Data',
        items: [
            { href: '/dashboard/products', icon: Package, label: 'Sản Phẩm', labelEn: 'Products', permission: 'MDM:READ' },
            { href: '/dashboard/suppliers', icon: Building2, label: 'Nhà Cung Cấp', labelEn: 'Suppliers', permission: 'PRC:READ' },
            { href: '/dashboard/customers', icon: Users, label: 'Khách Hàng', labelEn: 'Customers', permission: 'MDM:READ' },
            { href: '/dashboard/contracts', icon: FileSignature, label: 'Hợp Đồng', labelEn: 'Contracts', permission: 'CNT:READ' },
        ]
    },
    {
        label: 'Mua Hàng',
        labelEn: 'Procurement',
        items: [
            { href: '/dashboard/procurement', icon: ShoppingCart, label: 'Đơn Mua Hàng', labelEn: 'Purchase Orders', permission: 'PRC:READ' },
            { href: '/dashboard/shipments', icon: Ship, label: 'Lô Hàng', labelEn: 'Shipments', permission: 'PRC:READ' },
            // { href: '/dashboard/agency', icon: Globe, label: 'Agency Portal', permission: 'AGN:READ' },
            { href: '/dashboard/costing', icon: Calculator, label: 'Tính Giá Vốn (CST)', labelEn: 'Costing (CST)', permission: 'CST:READ' },
        ]
    },
    {
        label: 'Kho & Bán Hàng',
        labelEn: 'Sales & Inventory',
        items: [
            { href: '/dashboard/warehouse', icon: Warehouse, label: 'Kho Hàng', labelEn: 'Warehouses & Stock', permission: 'WMS:READ' },
            { href: '/dashboard/sales/visits', icon: MapPin, label: 'Quản Lý Check-in Thị Trường', labelEn: 'Field Check-in', permission: 'SLS:READ' },
            { href: '/dashboard/sales', icon: Briefcase, label: 'Đơn Bán Hàng', labelEn: 'Sales Orders', permission: 'SLS:READ' },
            { href: '/dashboard/quotations', icon: FileText, label: 'Báo Giá', labelEn: 'Quotations', permission: 'SLS:READ' },
            { href: '/dashboard/price-list', icon: Tag, label: 'Bảng Giá', labelEn: 'Price Lists', permission: 'SLS:READ' },
            { href: '/dashboard/margin', icon: Calculator, label: 'Check Margin', labelEn: 'Check Margin', permission: 'SLS:READ' },
            { href: '/dashboard/crm', icon: Users, label: 'CRM — Khách Hàng', labelEn: 'CRM — Customers', permission: 'CRM:READ' },
            { href: '/dashboard/consignment', icon: Handshake, label: 'Ký Gửi (CSG)', labelEn: 'Consignments (CSG)', permission: 'CSG:READ' },
            // { href: '/dashboard/allocation', icon: BarChart3, label: 'Allocation Engine', permission: 'SLS:READ' },
            // { href: '/dashboard/delivery', icon: Truck, label: 'Vận Chuyển', permission: 'SLS:READ' },
            { href: '/dashboard/returns', icon: ShoppingCart, label: 'Trả Hàng & CN', labelEn: 'Returns & CN', permission: 'SLS:READ' },
            { href: '/dashboard/pos', icon: Wine, label: 'POS Showroom', labelEn: 'POS Showroom', permission: 'POS:READ' },
            // { href: '/dashboard/qr-codes', icon: QrCode, label: 'QR Truy Xuất', permission: 'SLS:READ' },
        ]
    },
    {
        label: 'Tài Chính',
        labelEn: 'Finance',
        items: [
            { href: '/dashboard/payment-requests', icon: CreditCard, label: 'Đề Nghị Thanh Toán', labelEn: 'Payment Requests', permission: 'FIN:READ' },
            { href: '/dashboard/finance', icon: DollarSign, label: 'Công Nợ & Kế Toán', labelEn: 'Finance & Accounting', permission: 'FIN:READ' },
            { href: '/dashboard/reconciliation', icon: FileCheck2, label: 'Đối Chiếu Hóa Đơn', labelEn: 'Reconciliation', permission: 'FIN:READ' },
            // { href: '/dashboard/declarations', icon: FileText, label: 'Tờ Khai Thuế', permission: 'TAX:READ' },
            // { href: '/dashboard/stamps', icon: Stamp, label: 'Quản Lý Tem', permission: 'STM:READ' },
            { href: '/dashboard/reports', icon: BarChart3, label: 'Báo Cáo', labelEn: 'Reports', permission: 'RPT:READ' },
            // { href: '/dashboard/market-price', icon: TrendingUp, label: 'Giá Thị Trường', permission: 'RPT:READ' },
            { href: '/dashboard/kpi', icon: Target, label: 'KPI Chỉ Tiêu', labelEn: 'KPI Targets', permission: 'KPI:READ' },
        ]
    },
    {
        label: 'Marketing',
        labelEn: 'Marketing',
        items: [
            // { href: '/dashboard/media', icon: ImageIcon, label: 'Thư Viện Ảnh', permission: 'MDM:READ' },
        ]
    },
    {
        label: 'Hệ Thống',
        labelEn: 'System',
        items: [
            { href: '/dashboard/hr', icon: Briefcase, label: 'Nhân Sự & Giấy Tờ', labelEn: 'HR & Documents', permission: 'HRM:READ' },
            { href: '/dashboard/audit-log', icon: ScrollText, label: 'Nhật Ký Hệ Thống', labelEn: 'Audit Log', permission: 'SYS:READ' },
            { href: '/dashboard/ai', icon: Brain, label: 'AI & Prompt', labelEn: 'AI & Prompt', permission: 'SYS:ADMIN' },
            { href: '/dashboard/settings', icon: Settings, label: 'Cài Đặt & RBAC', labelEn: 'Settings & RBAC', permission: 'SYS:ADMIN' },
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
                style={{ borderBottom: '1px solid #E2E8F0', height: '42px' }}
            >
                <Image
                    src="/logo/Ly's Cellars - Logo_icon blue green.png"
                    alt="LY's Cellars"
                    width={18}
                    height={28}
                    priority
                    className="object-contain max-h-7"
                />
            </div>
        )
    }

    return (
        <div
            className="flex items-center px-4 w-full"
            style={{ borderBottom: '1px solid #E2E8F0', height: '42px' }}
        >
            <Image
                src="/logo/Ly's Cellars - Logo_tagline blue green.png"
                alt="LY's Cellars"
                width={115}
                height={28}
                priority
                className="object-contain max-h-7"
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
    const { locale, setLocale } = useAppLocale()

    const filteredGroups = useMemo(() => {
        return NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(item => {
                if (!currentUser) return false

                // CEO / System Admin / Trợ Lý see all menu items
                if (currentUser.roles.includes('CEO') || currentUser.roles.includes('CEO Secondary') || currentUser.roles.includes('ADMIN') || currentUser.roles.includes('Admin') || currentUser.roles.includes('Trợ Lý') || currentUser.roles.includes('TRO_LY')) {
                    return true
                }

                // Explicit role-based menu filtering for Kế Toán (Accountant)
                const isAccountant = currentUser.roles.includes('Kế Toán') || currentUser.roles.includes('KE_TOAN')
                if (isAccountant) {
                    const accountantAllowedHrefs = [
                        '/dashboard',
                        '/dashboard/proposals',
                        '/dashboard/products',
                        '/dashboard/suppliers',
                        '/dashboard/customers',
                        '/dashboard/contracts',
                        '/dashboard/procurement',
                        '/dashboard/shipments',
                        '/dashboard/costing',
                        '/dashboard/warehouse',
                        '/dashboard/transfers',
                        '/dashboard/stock-count',
                        '/dashboard/sales',
                        '/dashboard/quotations',
                        '/dashboard/price-list',
                        '/dashboard/margin',
                        '/dashboard/consignment',
                        '/dashboard/returns',
                        '/dashboard/finance',
                        '/dashboard/reconciliation',
                        '/dashboard/reports',
                        '/dashboard/kpi',
                    ]
                    if (!accountantAllowedHrefs.includes(item.href)) {
                        return false
                    }
                    return true
                }

                if (!item.permission) return true
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
            className="flex flex-col h-screen sticky top-0 transition-all duration-200 bg-lys-surface border-r border-lys-border"
            style={{ width: collapsed ? '64px' : '240px' }}
        >
            {/* Logo */}
            <LysLogo collapsed={collapsed} />

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-3">
                {filteredGroups.map((group) => {
                    const groupLabel = (locale === 'en' && group.labelEn) ? group.labelEn : group.label
                    return (
                        <div key={group.label} className="mb-1">
                            {!collapsed && (
                                <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-lys-muted">
                                    {groupLabel}
                                </p>
                            )}
                            {group.items.map((item) => {
                                const isActive = item.href === bestMatchHref
                                const Icon = item.icon
                                const itemLabel = (locale === 'en' && item.labelEn) ? item.labelEn : item.label

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        title={collapsed ? itemLabel : undefined}
                                        onClick={onNavigate}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={`flex items-center gap-3 mx-2 px-3 py-2 mb-0.5 rounded-md border-l-2 transition-colors duration-150 ${
                                            isActive
                                                ? 'bg-lys-teal-soft text-lys-teal-strong border-lys-teal-strong font-semibold'
                                                : 'text-lys-secondary border-transparent hover:bg-lys-subtle hover:text-lys-primary'
                                        }`}
                                        onMouseEnter={() => handlePrefetch(item.href)}
                                    >
                                        <Icon size={18} className="flex-shrink-0" />
                                        {!collapsed && (
                                            <span className="text-[13px] truncate">{itemLabel}</span>
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    )
                })}
            </nav>

            {/* Bottom: Language Switcher + Logout + Toggle */}
            <div className="border-t border-lys-border">
                {/* Language Switcher */}
                <div
                    className={`flex items-center transition-all border-b border-lys-border bg-lys-subtle/60 ${
                        collapsed ? 'justify-center py-2 px-1' : 'justify-between px-4 py-2.5'
                    }`}
                >
                    {!collapsed && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-lys-muted">
                            <Globe size={14} className="text-lys-teal-strong" />
                            <span>{locale === 'en' ? 'Language' : 'Ngôn ngữ'}</span>
                        </div>
                    )}
                    <div className="flex items-center p-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-bold shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setLocale('vi')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                locale === 'vi'
                                    ? 'bg-lys-teal-strong text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                            title="Tiếng Việt (VI)"
                        >
                            VI
                        </button>
                        <button
                            type="button"
                            onClick={() => setLocale('en')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                locale === 'en'
                                    ? 'bg-lys-teal-strong text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                            title="English (EN)"
                        >
                            EN
                        </button>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="flex items-center gap-3 w-full px-5 py-3 transition-colors duration-150 disabled:opacity-50 cursor-pointer text-lys-muted enabled:hover:text-tone-danger-fg"
                    title={collapsed ? (locale === 'en' ? 'Log Out' : 'Đăng Xuất') : undefined}
                >
                    <LogOut size={16} className={`flex-shrink-0 ${isLoggingOut ? 'animate-spin' : ''}`} />
                    {!collapsed && (
                        <span className="text-sm">
                            {locale === 'en'
                                ? (isLoggingOut ? 'Logging Out...' : 'Log Out')
                                : (isLoggingOut ? 'Đang Đăng Xuất...' : 'Đăng Xuất')
                            }
                        </span>
                    )}
                </button>

                <button
                    onClick={onToggle}
                    className="flex items-center justify-center w-full py-2 transition-colors duration-150 cursor-pointer text-lys-muted hover:text-lys-teal-strong border-t border-lys-border"
                    title={collapsed ? (locale === 'en' ? 'Expand sidebar' : 'Mở rộng menu') : (locale === 'en' ? 'Collapse sidebar' : 'Thu gọn menu')}
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
