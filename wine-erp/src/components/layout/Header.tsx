'use client'

import { Bell, LogOut, User, Key, Save, AlertCircle, ChevronRight } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { type SessionUser } from '@/lib/session'
import { signOut } from '@/app/login/actions'
import { updatePersonalProfile } from '@/app/dashboard/settings/actions'
import { toast } from 'sonner'
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/lib/notifications'
import { useAppLocale } from '@/lib/i18n'
import { Badge, Button, Drawer, Field, Input } from '@/components/ui'

interface HeaderProps {
    title?: string
    subtitle?: string
    mobileMenuButton?: React.ReactNode
    currentUser?: SessionUser | null
}

interface NotificationItem {
    id: string
    title: string
    content?: string | null
    type: string
    link?: string | null
    isRead: boolean
    createdAt: string
}

function formatNotiTime(dateString: string, locale: 'vi' | 'en' = 'vi'): string {
    const isEn = locale === 'en'
    try {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return isEn ? 'Just now' : 'Vừa xong'
        if (diffMins < 60) return isEn ? `${diffMins}m ago` : `${diffMins} phút trước`
        if (diffHours < 24) return isEn ? `${diffHours}h ago` : `${diffHours} giờ trước`
        if (diffDays === 1) return isEn ? 'Yesterday' : 'Hôm qua'
        if (diffDays < 7) return isEn ? `${diffDays}d ago` : `${diffDays} ngày trước`

        return date.toLocaleDateString(isEn ? 'en-GB' : 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
        return isEn ? 'Just now' : 'Vừa xong'
    }
}

export function Header({ title: customTitle, subtitle, mobileMenuButton, currentUser }: HeaderProps) {
    const pathname = usePathname()
    const router = useRouter()
    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [hasMore, setHasMore] = useState(false)
    const [loadingNoti, setLoadingNoti] = useState(false)
    const [showNoti, setShowNoti] = useState(false)
    const notiRef = useRef<HTMLDivElement>(null)
    const [showProfile, setShowProfile] = useState(false)
    const [showMyAccount, setShowMyAccount] = useState(false)
    const profileRef = useRef<HTMLDivElement>(null)
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const { locale, setLocale } = useAppLocale()

    const fetchNotifications = useCallback(async (isLoadMore = false) => {
        if (loadingNoti) return
        setLoadingNoti(true)
        try {
            const offset = isLoadMore ? notifications.length : 0
            const [res, countRes] = await Promise.all([
                getNotifications(10, offset),
                getUnreadCount(),
            ])
            if (res.success && res.notifications) {
                const newNotis = res.notifications as unknown as NotificationItem[]
                if (isLoadMore) {
                    setNotifications(prev => [...prev, ...newNotis])
                } else {
                    setNotifications(newNotis)
                }
                setHasMore(newNotis.length === 10)
            }
            if (countRes.success) {
                setUnreadCount(countRes.count)
            }
        } catch (err) {
            console.error('Error fetching notifications:', err)
        } finally {
            setLoadingNoti(false)
        }
    }, [notifications.length, loadingNoti])

    useEffect(() => {
        if (currentUser) {
            fetchNotifications()
            const timer = setInterval(() => {
                fetchNotifications()
            }, 45000)
            return () => clearInterval(timer)
        }
    }, [currentUser])

    const handleToggleNoti = () => {
        if (!showNoti) {
            fetchNotifications()
        }
        setShowNoti(!showNoti)
    }

    const handleMarkAllAsRead = async () => {
        try {
            await markAllAsRead()
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
            setUnreadCount(0)
            toast.success(locale === 'en' ? 'Marked all notifications as read' : 'Đã đánh dấu đọc tất cả thông báo')
        } catch (err) {
            console.error('Error marking all as read:', err)
        }
    }

    const handleNotificationClick = async (n: NotificationItem) => {
        setShowNoti(false)
        if (!n.isRead) {
            try {
                await markAsRead(n.id)
                setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, isRead: true } : item))
                setUnreadCount(prev => Math.max(0, prev - 1))
            } catch (err) {
                console.error('Error marking as read:', err)
            }
        }
        if (n.link) {
            router.push(n.link)
        }
    }

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

    // Dynamic group & title mapper based on pathname
    const getHeaderMeta = (): { group: string; title: string } => {
        const isEn = locale === 'en'
        if (customTitle && customTitle !== "LY's Cellars") {
            return { group: isEn ? 'System' : 'Hệ Thống', title: customTitle }
        }

        if (pathname === '/dashboard/margin') {
            return {
                group: isEn ? 'Sales & CRM' : 'Bán Hàng & CRM',
                title: isEn ? 'Margin Calculator' : 'Kiểm Tra Biên Lợi Nhuận',
            }
        }

        const routes: Array<{ path: string; group: string; title: string }> = [
            { path: '/dashboard/proposals', group: isEn ? 'Overview' : 'Tổng Quan', title: isEn ? 'Proposals & Submissions' : 'Tờ Trình — Đề Xuất' },
            { path: '/dashboard/sop', group: isEn ? 'Overview' : 'Tổng Quan', title: isEn ? 'SOP & Guidelines' : 'Quy Trình Chuẩn (SOP)' },
            { path: '/dashboard/hr', group: isEn ? 'System' : 'Hệ Thống', title: isEn ? 'HR & Documents' : 'Nhân Sự & Giấy Tờ' },
            { path: '/dashboard/pipeline', group: isEn ? 'Sales & CRM' : 'Bán Hàng & CRM', title: isEn ? 'Sales Pipeline' : 'Pipeline Bán Hàng' },
            { path: '/dashboard/products', group: isEn ? 'Master Data' : 'Danh Mục', title: isEn ? 'Product Catalog' : 'Sản Phẩm' },
            { path: '/dashboard/suppliers', group: isEn ? 'Master Data' : 'Danh Mục', title: isEn ? 'Suppliers' : 'Nhà Cung Cấp' },
            { path: '/dashboard/customers', group: isEn ? 'Master Data' : 'Danh Mục', title: isEn ? 'Customers' : 'Khách Hàng' },
            { path: '/dashboard/contracts', group: isEn ? 'Master Data' : 'Danh Mục', title: isEn ? 'Contracts' : 'Hợp Đồng' },
            { path: '/dashboard/procurement', group: isEn ? 'Procurement' : 'Mua Hàng', title: isEn ? 'Purchase Orders' : 'Đơn Mua Hàng' },
            { path: '/dashboard/shipments', group: isEn ? 'Procurement' : 'Mua Hàng', title: isEn ? 'Shipments' : 'Lô Hàng' },
            { path: '/dashboard/agency', group: isEn ? 'Procurement' : 'Mua Hàng', title: isEn ? 'Agency Portal' : 'Cổng Đối Tác' },
            { path: '/dashboard/costing', group: isEn ? 'Procurement' : 'Mua Hàng', title: isEn ? 'Costing (CST)' : 'Tính Giá Vốn (CST)' },
            { path: '/dashboard/warehouse/print', group: isEn ? 'Warehouse & Logistics' : 'Kho Vận & Logistics', title: isEn ? 'Print Warehouse Slip' : 'In Phiếu Kho' },
            { path: '/dashboard/warehouse', group: isEn ? 'Warehouse & Logistics' : 'Kho Vận & Logistics', title: isEn ? 'Warehouses & Stock' : 'Kho Hàng' },
            { path: '/dashboard/transfers', group: isEn ? 'Warehouse & Logistics' : 'Kho Vận & Logistics', title: isEn ? 'Transfers' : 'Chuyển Kho' },
            { path: '/dashboard/stock-count', group: isEn ? 'Warehouse & Logistics' : 'Kho Vận & Logistics', title: isEn ? 'Stock Auditing' : 'Kiểm Kê' },
            { path: '/dashboard/sales/print', group: isEn ? 'Sales & CRM' : 'Bán Hàng & CRM', title: isEn ? 'Print Sales Order' : 'In Đơn Bán Hàng' },
            { path: '/dashboard/sales/visits', group: isEn ? 'Sales & CRM' : 'Bán Hàng & CRM', title: isEn ? 'Field Check-in Management' : 'Quản Lý Check-in Thị Trường' },
            { path: '/dashboard/sales', group: isEn ? 'Sales & CRM' : 'Bán Hàng & CRM', title: isEn ? 'Sales Orders' : 'Đơn Bán Hàng' },
            { path: '/dashboard/quotations', group: isEn ? 'Sales & CRM' : 'Bán Hàng & CRM', title: isEn ? 'Quotations' : 'Báo Giá' },
            { path: '/dashboard/price-list', group: isEn ? 'Sales & CRM' : 'Bán Hàng & CRM', title: isEn ? 'Price Lists' : 'Bảng Giá' },
            { path: '/dashboard/crm', group: isEn ? 'Sales & CRM' : 'Bán Hàng & CRM', title: isEn ? 'CRM — Customers' : 'CRM — Khách Hàng' },
            { path: '/dashboard/consignment', group: isEn ? 'Warehouse & Logistics' : 'Kho Vận & Logistics', title: isEn ? 'Consignments (CSG)' : 'Ký Gửi (CSG)' },
            { path: '/dashboard/allocation', group: isEn ? 'Sales & CRM' : 'Bán Hàng & CRM', title: isEn ? 'Allocation Engine' : 'Phân Bổ Hàng Hóa' },
            { path: '/dashboard/delivery/shipper', group: isEn ? 'Warehouse & Logistics' : 'Kho Vận & Logistics', title: isEn ? 'Shipper E-POD' : 'Giao Hàng (Shipper)' },
            { path: '/dashboard/delivery', group: isEn ? 'Warehouse & Logistics' : 'Kho Vận & Logistics', title: isEn ? 'Deliveries & Logistics' : 'Vận Chuyển' },
            { path: '/dashboard/returns', group: isEn ? 'Warehouse & Logistics' : 'Kho Vận & Logistics', title: isEn ? 'Returns & CN' : 'Trả Hàng & CN' },
            { path: '/dashboard/pos/loyalty', group: isEn ? 'Sales & CRM' : 'Bán Hàng & CRM', title: isEn ? 'POS Loyalty Program' : 'POS — Khách Hàng Thân Thiết' },
            { path: '/dashboard/pos', group: isEn ? 'Sales & CRM' : 'Bán Hàng & CRM', title: 'POS Showroom' },
            { path: '/dashboard/qr-codes', group: isEn ? 'Warehouse & Logistics' : 'Kho Vận & Logistics', title: isEn ? 'QR Traceability' : 'QR Truy Xuất' },
            { path: '/dashboard/payment-requests', group: isEn ? 'Finance' : 'Tài Chính', title: isEn ? 'Payment Requests & Budgets' : 'Đề Nghị Thanh Toán & Ngân Sách' },
            { path: '/dashboard/finance', group: isEn ? 'Finance' : 'Tài Chính', title: isEn ? 'Finance & Accounting' : 'Công Nợ & Kế Toán' },
            { path: '/dashboard/reconciliation', group: isEn ? 'Finance' : 'Tài Chính', title: isEn ? 'Reconciliation' : 'Đối Chiếu Hóa Đơn' },
            { path: '/dashboard/declarations', group: isEn ? 'Finance' : 'Tài Chính', title: isEn ? 'Customs Declarations' : 'Tờ Khai Thuế' },
            { path: '/dashboard/stamps', group: isEn ? 'Finance' : 'Tài Chính', title: isEn ? 'Stamp Management' : 'Quản Lý Tem' },
            { path: '/dashboard/reports', group: isEn ? 'Finance' : 'Tài Chính', title: isEn ? 'Reports' : 'Báo Cáo' },
            { path: '/dashboard/market-price', group: isEn ? 'Finance' : 'Tài Chính', title: isEn ? 'Market Prices' : 'Giá Thị Trường' },
            { path: '/dashboard/kpi', group: isEn ? 'Finance' : 'Tài Chính', title: isEn ? 'KPI Targets' : 'KPI Chỉ Tiêu' },
            { path: '/dashboard/media', group: isEn ? 'System' : 'Hệ Thống', title: isEn ? 'Media Library' : 'Thư Viện Ảnh' },
            { path: '/dashboard/audit-log', group: isEn ? 'System' : 'Hệ Thống', title: isEn ? 'Audit Log' : 'Nhật Ký Hệ Thống' },
            { path: '/dashboard/ai', group: isEn ? 'System' : 'Hệ Thống', title: isEn ? 'AI & Prompt' : 'Trợ Lý AI & Prompt' },
            { path: '/dashboard/guides', group: isEn ? 'System' : 'Hệ Thống', title: isEn ? 'Video Guides' : 'Video Hướng Dẫn' },
            { path: '/dashboard/settings/approval-matrix', group: isEn ? 'System' : 'Hệ Thống', title: isEn ? 'Approval Matrix' : 'Ma Trận Phân Quyền' },
            { path: '/dashboard/settings/telegram', group: isEn ? 'System' : 'Hệ Thống', title: isEn ? 'Telegram Bot Settings' : 'Cấu Hình Telegram Bot' },
            { path: '/dashboard/settings', group: isEn ? 'System' : 'Hệ Thống', title: isEn ? 'Settings & RBAC' : 'Cài Đặt & RBAC' },
            { path: '/dashboard', group: isEn ? 'Overview' : 'Tổng Quan', title: isEn ? 'Executive Dashboard (CEO)' : 'Dashboard CEO' },
        ]

        const matched = routes.find(r => pathname.startsWith(r.path))
        return matched
            ? { group: matched.group, title: matched.title }
            : { group: isEn ? 'Workspace' : 'Hệ Thống', title: isEn ? 'System' : 'Hệ Thống' }
    }

    const { group, title } = getHeaderMeta()

    // Click outside to close dropdowns
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
                setShowNoti(false)
            }
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setShowProfile(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <header
            className="sticky top-0 z-30 flex items-center justify-between px-3 sm:px-5 h-12 bg-white/95 backdrop-blur-md border-b border-lys-border"
        >
            {/* Page breadcrumb & title */}
            <div className="flex items-center min-w-0 mr-2 sm:mr-4">
                {mobileMenuButton}
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="hidden sm:inline text-xs font-medium text-lys-muted shrink-0">
                        {group}
                    </span>
                    <ChevronRight size={13} className="hidden sm:inline text-lys-dim shrink-0" aria-hidden />
                    <h1 className="text-sm sm:text-[15px] font-semibold leading-none text-lys-primary truncate">
                        {title}
                    </h1>
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Global Language Switcher */}
                {pathname.startsWith('/dashboard') && (
                    <div className="flex items-center p-0.5 rounded-md bg-lys-subtle border border-lys-border text-[11px] font-semibold">
                        <button
                            type="button"
                            onClick={() => setLocale('vi')}
                            className={`px-2 py-1 rounded transition-all cursor-pointer ${
                                locale === 'vi'
                                    ? 'bg-lys-teal-strong text-white shadow-xs'
                                    : 'text-lys-secondary hover:text-lys-primary hover:bg-white/70'
                            }`}
                            title="Tiếng Việt"
                        >
                            VI
                        </button>
                        <button
                            type="button"
                            onClick={() => setLocale('en')}
                            className={`px-2 py-1 rounded transition-all cursor-pointer ${
                                locale === 'en'
                                    ? 'bg-lys-teal-strong text-white shadow-xs'
                                    : 'text-lys-secondary hover:text-lys-primary hover:bg-white/70'
                            }`}
                            title="English"
                        >
                            EN
                        </button>
                    </div>
                )}


                {/* Notifications */}
                <div className="relative" ref={notiRef}>
                    <button
                        type="button"
                        onClick={handleToggleNoti}
                        aria-label={locale === 'en' ? 'Notifications' : 'Thông báo'}
                        className="relative flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-md bg-white border border-lys-border text-lys-secondary transition-all duration-150 hover:border-lys-teal hover:text-lys-teal-strong active:scale-95 cursor-pointer"
                    >
                        <Bell size={15} />
                        {/* Notification badge */}
                        {unreadCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold leading-none inline-flex items-center justify-center text-white bg-tone-danger-fg whitespace-nowrap shrink-0 animate-pop">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Popover Dropdown */}
                    {showNoti && (
                        <div className="absolute right-0 mt-2 w-[calc(100vw-24px)] max-w-xs sm:w-80 rounded-lg shadow-xl z-50 overflow-hidden bg-lys-card border border-lys-border animate-dropdown origin-top-right">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-lys-border">
                                <span className="text-xs font-semibold uppercase tracking-wider text-lys-secondary">
                                    {locale === 'en' ? 'Notifications' : 'Thông Báo'}
                                </span>
                                {unreadCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleMarkAllAsRead}
                                        className="text-[11px] font-semibold hover:underline text-lys-teal-strong cursor-pointer"
                                    >
                                        {locale === 'en' ? 'Mark all read' : 'Đọc tất cả'}
                                    </button>
                                )}
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-lys-muted">
                                        {locale === 'en' ? 'No new notifications' : 'Không có thông báo mới'}
                                    </div>
                                ) : (
                                    <>
                                        {notifications.map(n => (
                                            <button
                                                type="button"
                                                key={n.id}
                                                onClick={() => handleNotificationClick(n)}
                                                className={`w-full text-left px-4 py-3 transition-colors duration-150 cursor-pointer border-b border-lys-border last:border-b-0 hover:bg-lys-subtle focus:bg-lys-subtle focus:outline-none ${n.isRead ? '' : 'bg-lys-teal-soft/60'}`}
                                            >
                                                <div className="flex gap-2.5 items-start">
                                                    <span
                                                        aria-hidden
                                                        className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                                                            n.type === 'success' ? 'bg-tone-success-fg'
                                                                : n.type === 'warning' ? 'bg-tone-warning-fg'
                                                                    : n.type === 'error' ? 'bg-tone-danger-fg'
                                                                        : 'bg-tone-info-fg'
                                                        }`}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-xs font-semibold leading-normal ${n.isRead ? 'text-lys-secondary' : 'text-lys-primary'}`}>
                                                            {n.title}
                                                        </p>
                                                        {n.content && (
                                                            <p className="text-[11px] mt-0.5 text-lys-muted line-clamp-2">
                                                                {n.content}
                                                            </p>
                                                        )}
                                                        <span className="text-[11px] block mt-1 text-lys-dim">
                                                            {formatNotiTime(n.createdAt, locale)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                        {hasMore && (
                                            <button
                                                type="button"
                                                onClick={() => fetchNotifications(true)}
                                                disabled={loadingNoti}
                                                className="w-full py-2 text-center text-[11px] font-semibold border-t border-lys-border hover:underline text-lys-teal-strong cursor-pointer"
                                            >
                                                {loadingNoti ? (locale === 'en' ? 'Loading...' : 'Đang tải...') : (locale === 'en' ? 'Load more' : 'Xem thêm thông báo')}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Avatar & Profile Popover */}
                <div className="relative" ref={profileRef}>
                    <button
                        type="button"
                        onClick={() => setShowProfile(!showProfile)}
                        aria-label={locale === 'en' ? 'Account menu' : 'Menu tài khoản'}
                        className="flex items-center gap-1.5 h-9 sm:h-8 pl-1 pr-2.5 rounded-md bg-white border border-lys-border transition-all duration-150 hover:border-lys-teal active:scale-95 cursor-pointer"
                    >
                        <div className="w-6 h-6 flex items-center justify-center text-[11px] font-bold rounded bg-lys-teal-soft text-lys-teal-strong border border-tone-brand-border">
                            {(currentUser?.name?.[0] || 'A').toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold hidden sm:inline text-lys-secondary">
                            {currentUser?.name || 'Admin'}
                        </span>
                    </button>

                    {/* Profile Dropdown */}
                    {showProfile && (
                        <div className="absolute right-0 mt-2 w-64 rounded-lg shadow-xl z-50 overflow-hidden bg-lys-card border border-lys-border animate-dropdown origin-top-right">
                            <div className="p-4 border-b border-lys-border">
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-lys-secondary">
                                    {locale === 'en' ? 'Personal Info' : 'Thông Tin Cá Nhân'}
                                </p>
                                <p className="text-sm font-semibold truncate text-lys-primary">
                                    {currentUser?.name || 'Admin'}
                                </p>
                                <p className="text-xs truncate mt-0.5 text-lys-muted">
                                    {currentUser?.email || 'admin@lyscellars.com'}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2.5">
                                    {Array.from(new Set(
                                        (currentUser?.roles || ['Admin']).filter(r => {
                                            if (r === 'TRO_LY' && currentUser?.roles?.includes('Trợ Lý')) return false
                                            if (r === 'KE_TOAN' && currentUser?.roles?.includes('Kế Toán')) return false
                                            if (r === 'SALES_MGR' && currentUser?.roles?.includes('Sales Manager')) return false
                                            if (r === 'SALES_REP' && currentUser?.roles?.includes('Sales Rep')) return false
                                            if (r === 'THU_KHO' && currentUser?.roles?.includes('Thủ Kho')) return false
                                            if (r === 'THU_MUA' && currentUser?.roles?.includes('Thu Mua')) return false
                                            if (r === 'SALES_ADMIN' && currentUser?.roles?.includes('Sales Admin')) return false
                                            return true
                                        })
                                    )).map(r => (
                                        <Badge key={r} tone="brand">
                                            {r}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <div className="p-2 border-b border-lys-border">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowProfile(false)
                                        setShowMyAccount(true)
                                    }}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold rounded transition-colors duration-150 text-left text-lys-primary hover:bg-lys-subtle cursor-pointer"
                                >
                                    <User size={14} className="text-lys-teal-strong" />
                                    {locale === 'en' ? 'My Account' : 'Tài khoản của tôi'}
                                </button>
                            </div>
                            <div className="p-2">
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold rounded transition-colors duration-150 disabled:opacity-50 text-left text-tone-danger-fg hover:bg-tone-danger-bg cursor-pointer"
                                >
                                    <LogOut size={14} className={isLoggingOut ? 'animate-spin' : ''} />
                                    {isLoggingOut
                                        ? (locale === 'en' ? 'Signing out...' : 'Đang Đăng Xuất...')
                                        : (locale === 'en' ? 'Sign Out' : 'Đăng Xuất')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <MyAccountDrawer
                open={showMyAccount}
                onClose={() => setShowMyAccount(false)}
                currentUser={currentUser ?? null}
                locale={locale}
            />
        </header>
    )
}

// ── My Account Drawer ─────────────────────────────
interface MyAccountDrawerProps {
    open: boolean
    onClose: () => void
    currentUser: SessionUser | null
    locale?: 'vi' | 'en'
}

function MyAccountDrawer({ open, onClose, currentUser, locale = 'vi' }: MyAccountDrawerProps) {
    const isEn = locale === 'en'
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    useEffect(() => {
        if (currentUser) {
            setName(currentUser.name || '')
            setPassword('')
            setConfirmPassword('')
            setError('')
        }
    }, [currentUser, open])

    async function handleSave() {
        setError('')
        if (name.trim().length < 2) {
            setError(isEn ? 'Full name must be at least 2 characters' : 'Họ tên tối thiểu 2 ký tự')
            return
        }

        if (password.length > 0) {
            if (password.length < 6) {
                setError(isEn ? 'New password must be at least 6 characters' : 'Mật khẩu mới tối thiểu 6 ký tự')
                return
            }
            if (password !== confirmPassword) {
                setError(isEn ? 'Password confirmation does not match' : 'Mật khẩu xác nhận không trùng khớp')
                return
            }
        }

        setSaving(true)
        try {
            const res = await updatePersonalProfile(name, password || undefined)
            if (res.success) {
                toast.success(isEn ? 'Account updated successfully!' : 'Cập nhật tài khoản thành công!')
                onClose()
                window.location.reload()
            } else {
                setError(res.error || (isEn ? 'Failed to update account' : 'Lỗi cập nhật tài khoản'))
            }
        } catch (err: any) {
            setError(err.message || (isEn ? 'System connection error' : 'Lỗi kết nối hệ thống'))
        } finally {
            setSaving(false)
        }
    }

    if (!currentUser) return null

    return (
        <Drawer
            open={open}
            onClose={() => { if (!saving) onClose() }}
            size="sm"
            className="bg-lys-bg"
            title={
                <span className="inline-flex items-center gap-2">
                    <User size={18} className="text-lys-teal" aria-hidden />
                    <span>{isEn ? 'My Account' : 'Tài Khoản Của Tôi'}</span>
                </span>
            }
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        {isEn ? 'Cancel' : 'Hủy'}
                    </Button>
                    <Button variant="primary" onClick={handleSave} loading={saving}>
                        {!saving && <Save size={15} aria-hidden />}
                        {saving
                            ? (isEn ? 'Saving changes...' : 'Đang lưu thay đổi...')
                            : (isEn ? 'Save Changes' : 'Lưu Thay Đổi')}
                    </Button>
                </>
            }
        >
            {error && (
                <div
                    role="alert"
                    className="mb-4 p-3 rounded-md text-sm flex items-center gap-2 bg-tone-danger-bg border border-tone-danger-border text-tone-danger-fg"
                >
                    <AlertCircle size={14} className="shrink-0" aria-hidden />
                    <span>{error}</span>
                </div>
            )}

            <div className="space-y-4">
                <Field label="Email">
                    <div className="text-sm font-semibold px-3 py-2.5 rounded-md font-mono bg-lys-card border border-lys-border text-lys-secondary">
                        {currentUser.email}
                    </div>
                </Field>

                <Field label={isEn ? 'Role' : 'Vai Trò'}>
                    <div className="flex flex-wrap gap-1.5 p-3 rounded-md bg-lys-card border border-lys-border">
                        {(currentUser.roles || []).map(r => (
                            <Badge key={r} tone="brand">
                                {r}
                            </Badge>
                        ))}
                    </div>
                </Field>

                <Field label={isEn ? 'Full Name' : 'Họ Tên'} required>
                    {id => (
                        <Input
                            id={id}
                            placeholder={isEn ? 'Your full name' : 'Họ và tên của bạn'}
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    )}
                </Field>

                <div className="pt-4 border-t border-lys-border space-y-3">
                    <div className="flex items-center gap-1.5">
                        <Key size={14} className="text-lys-teal" aria-hidden />
                        <span className="text-xs font-bold uppercase tracking-wider text-lys-secondary">
                            {isEn ? 'Change Password' : 'Đổi Mật Khẩu'}
                        </span>
                    </div>

                    <Field label={isEn ? 'New Password' : 'Mật Khẩu Mới'}>
                        {id => (
                            <Input
                                id={id}
                                type="password"
                                placeholder={isEn ? 'Enter new password (min 6 chars)' : 'Nhập mật khẩu mới (tối thiểu 6 ký tự)'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        )}
                    </Field>

                    <Field label={isEn ? 'Confirm New Password' : 'Xác Nhận Mật Khẩu Mới'}>
                        {id => (
                            <Input
                                id={id}
                                type="password"
                                placeholder={isEn ? 'Confirm new password' : 'Xác nhận mật khẩu mới'}
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                            />
                        )}
                    </Field>
                </div>
            </div>
        </Drawer>
    )
}
