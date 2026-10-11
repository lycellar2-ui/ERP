'use client'

import { Bell, LogOut, User, Key, X, Save, Loader2, AlertCircle } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { type SessionUser } from '@/lib/session'
import { signOut } from '@/app/login/actions'
import { updatePersonalProfile } from '@/app/dashboard/settings/actions'
import { toast } from 'sonner'
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/lib/notifications'
import { useAppLocale } from '@/lib/i18n'

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

function formatNotiTime(dateString: string): string {
    try {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return 'Vừa xong'
        if (diffMins < 60) return `${diffMins} phút trước`
        if (diffHours < 24) return `${diffHours} giờ trước`
        if (diffDays === 1) return 'Hôm qua'
        if (diffDays < 7) return `${diffDays} ngày trước`
        
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
        return 'Vừa xong'
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
            const res = await getNotifications(10, offset)
            if (res.success && res.notifications) {
                const newNotis = res.notifications as unknown as NotificationItem[]
                if (isLoadMore) {
                    setNotifications(prev => [...prev, ...newNotis])
                } else {
                    setNotifications(newNotis)
                }
                setHasMore(newNotis.length === 10)
            }
            
            const countRes = await getUnreadCount()
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
            toast.success('Đã đánh dấu đọc tất cả thông báo')
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

    // Dynamic title mapper based on pathname
    const getHeaderTitle = (): string => {
        if (customTitle && customTitle !== "LY's Cellars") return customTitle

        if (pathname === '/dashboard/margin') return 'Check Margin'

        const routes = [
            { path: '/dashboard/proposals', title: locale === 'en' ? 'Proposals & Submissions' : 'Tờ Trình — Đề Xuất' },
            { path: '/dashboard/products', title: locale === 'en' ? 'Product Catalog' : 'Sản Phẩm' },
            { path: '/dashboard/suppliers', title: locale === 'en' ? 'Suppliers' : 'Nhà Cung Cấp' },
            { path: '/dashboard/customers', title: locale === 'en' ? 'Customers' : 'Khách Hàng' },
            { path: '/dashboard/contracts', title: locale === 'en' ? 'Contracts' : 'Hợp Đồng' },
            { path: '/dashboard/procurement', title: locale === 'en' ? 'Purchase Orders' : 'Đơn Mua Hàng' },
            { path: '/dashboard/shipments', title: locale === 'en' ? 'Shipments' : 'Lô Hàng' },
            { path: '/dashboard/agency', title: 'Agency Portal' },
            { path: '/dashboard/costing', title: locale === 'en' ? 'Costing (CST)' : 'Tính Giá Vốn (CST)' },
            { path: '/dashboard/warehouse', title: locale === 'en' ? 'Warehouses & Stock' : 'Kho Hàng' },
            { path: '/dashboard/transfers', title: locale === 'en' ? 'Transfers' : 'Chuyển Kho' },
            { path: '/dashboard/stock-count', title: locale === 'en' ? 'Stock Auditing' : 'Kiểm Kê' },
            { path: '/dashboard/sales/visits', title: locale === 'en' ? 'Field Check-in Management' : 'Quản Lý Check-in Thị Trường' },
            { path: '/dashboard/sales', title: locale === 'en' ? 'Sales Orders' : 'Đơn Bán Hàng' },
            { path: '/dashboard/quotations', title: locale === 'en' ? 'Quotations' : 'Báo Giá' },
            { path: '/dashboard/price-list', title: locale === 'en' ? 'Price Lists' : 'Bảng Giá' },
            { path: '/dashboard/crm', title: locale === 'en' ? 'CRM — Customers' : 'CRM — Khách Hàng' },
            { path: '/dashboard/consignment', title: locale === 'en' ? 'Consignments (CSG)' : 'Ký Gửi (CSG)' },
            { path: '/dashboard/allocation', title: 'Allocation Engine' },
            { path: '/dashboard/delivery', title: locale === 'en' ? 'Deliveries & Logistics' : 'Vận Chuyển' },
            { path: '/dashboard/returns', title: locale === 'en' ? 'Returns & CN' : 'Trả Hàng & CN' },
            { path: '/dashboard/pos', title: 'POS Showroom' },
            { path: '/dashboard/qr-codes', title: locale === 'en' ? 'QR Traceability' : 'QR Truy Xuất' },
            { path: '/dashboard/payment-requests', title: locale === 'en' ? 'Payment Requests & Budgets' : 'Đề Nghị Thanh Toán & Ngân Sách' },
            { path: '/dashboard/finance', title: locale === 'en' ? 'Finance & Accounting' : 'Công Nợ & Kế Toán' },
            { path: '/dashboard/reconciliation', title: locale === 'en' ? 'Reconciliation' : 'Đối Chiếu Hóa Đơn' },
            { path: '/dashboard/declarations', title: locale === 'en' ? 'Customs Declarations' : 'Tờ Khai Thuế' },
            { path: '/dashboard/stamps', title: locale === 'en' ? 'Stamp Management' : 'Quản Lý Tem' },
            { path: '/dashboard/reports', title: locale === 'en' ? 'Reports' : 'Báo Cáo' },
            { path: '/dashboard/market-price', title: locale === 'en' ? 'Market Prices' : 'Giá Thị Trường' },
            { path: '/dashboard/kpi', title: locale === 'en' ? 'KPI Targets' : 'KPI Chỉ Tiêu' },
            { path: '/dashboard/media', title: locale === 'en' ? 'Media Library' : 'Thư Viện Ảnh' },
            { path: '/dashboard/audit-log', title: locale === 'en' ? 'Audit Log' : 'Nhật Ký Hệ Thống' },
            { path: '/dashboard/ai', title: 'AI & Prompt' },
            { path: '/dashboard/settings/approval-matrix', title: locale === 'en' ? 'Approval Matrix' : 'Ma Trận Phân Quyền' },
            { path: '/dashboard/settings', title: locale === 'en' ? 'Settings & RBAC' : 'Cài Đặt & RBAC' },
            { path: '/dashboard', title: locale === 'en' ? 'Executive Dashboard (CEO)' : 'Dashboard CEO' },
        ]

        const matched = routes.find(r => pathname.startsWith(r.path))
        return matched ? matched.title : (locale === 'en' ? 'System' : 'Hệ Thống')
    }

    const title = getHeaderTitle()

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
            className="sticky top-0 z-10 flex items-center justify-between px-4 h-[42px] bg-white/95 backdrop-blur-md border-b border-lys-border"
        >
            {/* Page title */}
            <div className="flex items-center">
                {mobileMenuButton}
                <div>
                    <h1 className="text-[15px] font-semibold leading-none text-lys-primary">
                        {title}
                    </h1>
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
                {/* Global Language Switcher */}
                {pathname.startsWith('/dashboard') && (
                    <div className="flex items-center p-0.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold shadow-xs">
                        <button
                            type="button"
                            onClick={() => setLocale('vi')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                locale === 'vi'
                                    ? 'bg-lys-teal-strong text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                            title="Tiếng Việt"
                        >
                            VI
                        </button>
                        <button
                            type="button"
                            onClick={() => setLocale('en')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                                locale === 'en'
                                    ? 'bg-lys-teal-strong text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
                        aria-label="Thông báo"
                        className="relative flex items-center justify-center w-8 h-8 rounded-md bg-white border border-lys-border text-lys-secondary transition-colors duration-150 hover:border-lys-teal hover:text-lys-teal-strong cursor-pointer"
                    >
                        <Bell size={15} />
                        {/* Notification badge */}
                        {unreadCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold inline-flex items-center justify-center text-white bg-tone-danger-fg whitespace-nowrap shrink-0">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Popover Dropdown */}
                    {showNoti && (
                        <div className="absolute right-0 mt-2 w-80 rounded-lg shadow-lg z-50 overflow-hidden bg-lys-card border border-lys-border">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-lys-border">
                                <span className="text-xs font-semibold uppercase tracking-wider text-lys-secondary">Thông Báo</span>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllAsRead}
                                        className="text-[11px] font-semibold hover:underline text-lys-teal-strong cursor-pointer"
                                    >
                                        Đọc tất cả
                                    </button>
                                )}
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-lys-muted">
                                        Không có thông báo mới
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
                                                            {formatNotiTime(n.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                        {hasMore && (
                                            <button
                                                onClick={() => fetchNotifications(true)}
                                                disabled={loadingNoti}
                                                className="w-full py-2 text-center text-[11px] font-semibold border-t border-lys-border hover:underline text-lys-teal-strong cursor-pointer"
                                            >
                                                {loadingNoti ? 'Đang tải...' : 'Xem thêm thông báo'}
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
                        onClick={() => setShowProfile(!showProfile)}
                        className="flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-md bg-white border border-lys-border transition-colors duration-150 hover:border-lys-teal cursor-pointer"
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
                        <div className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg z-50 overflow-hidden bg-lys-card border border-lys-border">
                            <div className="p-4 border-b border-lys-border">
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-lys-secondary">Thông Tin Cá Nhân</p>
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
                                        <span key={r} className="inline-block text-[11px] px-1.5 py-0.5 rounded font-semibold bg-lys-teal-soft text-lys-teal-strong whitespace-nowrap shrink-0">
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="p-2 border-b border-lys-border">
                                <button
                                    onClick={() => {
                                        setShowProfile(false)
                                        setShowMyAccount(true)
                                    }}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold rounded transition-colors duration-150 text-left text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                                >
                                    <User size={14} className="text-lys-teal-strong" />
                                    Tài khoản của tôi
                                </button>
                            </div>
                            <div className="p-2">
                                <button
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold rounded transition-colors duration-150 disabled:opacity-50 text-left text-tone-danger-fg hover:bg-tone-danger-bg cursor-pointer"
                                >
                                    <LogOut size={14} className={isLoggingOut ? 'animate-spin' : ''} />
                                    {isLoggingOut ? 'Đang Đăng Xuất...' : 'Đăng Xuất'}
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
            />
        </header>
    )
}

// ── My Account Drawer ─────────────────────────────
interface MyAccountDrawerProps {
    open: boolean
    onClose: () => void
    currentUser: SessionUser | null
}

function MyAccountDrawer({ open, onClose, currentUser }: MyAccountDrawerProps) {
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (currentUser) {
            setName(currentUser.name || '')
            setPassword('')
            setConfirmPassword('')
            setError('')
        }
    }, [currentUser, open])

    if (!open || !currentUser || !mounted) return null

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px',
        borderRadius: '6px',
        border: '1px solid #E2E8F0',
        background: '#FFFFFF',
        color: '#0F172A',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.15s ease-in-out',
    }

    async function handleSave() {
        setError('')
        if (name.trim().length < 2) {
            setError('Họ tên tối thiểu 2 ký tự')
            return
        }

        if (password.length > 0) {
            if (password.length < 6) {
                setError('Mật khẩu mới tối thiểu 6 ký tự')
                return
            }
            if (password !== confirmPassword) {
                setError('Mật khẩu xác nhận không trùng khớp')
                return
            }
        }

        setSaving(true)
        try {
            const res = await updatePersonalProfile(name, password || undefined)
            if (res.success) {
                toast.success('Cập nhật tài khoản thành công!')
                onClose()
                window.location.reload()
            } else {
                setError(res.error || 'Lỗi cập nhật tài khoản')
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi kết nối hệ thống')
        } finally {
            setSaving(false)
        }
    }

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end" style={{ background: 'rgba(15, 23, 42, 0.45)' }}>
            <div className="w-full max-w-md h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-250" 
                style={{ background: '#F8FAFC', borderLeft: '1px solid #E2E8F0' }}>
                <div>
                    <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: '1px solid #FFFFFF' }}>
                        <div className="flex items-center gap-2">
                            <User size={18} style={{ color: '#0891B2' }} />
                            <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>Tài Khoản Của Tôi</h3>
                        </div>
                        <button onClick={onClose} className="hover:opacity-80 transition-opacity">
                            <X size={18} style={{ color: '#64748B' }} />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded text-sm flex items-center gap-2"
                            style={{ background: 'rgba(185,28,28,0.15)', border: '1px solid rgba(185,28,28,0.3)', color: '#B91C1C' }}>
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>Email</label>
                            <div className="text-sm font-semibold p-3 rounded-md font-mono" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569' }}>
                                {currentUser.email}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>Vai Trò</label>
                            <div className="flex flex-wrap gap-1 p-3 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                {(currentUser.roles || []).map(r => (
                                    <span key={r} className="inline-block text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0"
                                        style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2' }}>
                                        {r}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>Họ Tên *</label>
                            <input 
                                style={inputStyle} 
                                placeholder="Họ và tên của bạn"
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                            />
                        </div>

                        <div className="pt-4 border-t" style={{ borderColor: '#E2E8F0' }}>
                            <div className="flex items-center gap-1.5 mb-3">
                                <Key size={14} style={{ color: '#0891B2' }} />
                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Đổi Mật Khẩu</span>
                            </div>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[11px] font-semibold mb-1 block" style={{ color: '#64748B' }}>Mật Khẩu Mới</label>
                                    <input 
                                        style={inputStyle} 
                                        type="password" 
                                        placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                                        value={password} 
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-semibold mb-1 block" style={{ color: '#64748B' }}>Xác Nhận Mật Khẩu Mới</label>
                                    <input 
                                        style={inputStyle} 
                                        type="password" 
                                        placeholder="Xác nhận mật khẩu mới"
                                        value={confirmPassword} 
                                        onChange={e => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="w-full mt-8 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#0891B2', color: '#FFFFFF' }}
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Đang lưu thay đổi...' : 'Lưu Thay Đổi'}
                </button>
            </div>
        </div>,
        document.body
    )
}
