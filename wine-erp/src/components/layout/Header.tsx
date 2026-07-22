'use client'

import { Bell, LogOut, User, Key, X, Save, Loader2, AlertCircle } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { type SessionUser } from '@/lib/session'
import { signOut } from '@/app/login/actions'
import { updatePersonalProfile } from '@/app/dashboard/settings/actions'
import { toast } from 'sonner'
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/lib/notifications'

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
            { path: '/dashboard/proposals', title: 'Tờ Trình — Đề Xuất' },
            { path: '/dashboard/products', title: 'Sản Phẩm' },
            { path: '/dashboard/suppliers', title: 'Nhà Cung Cấp' },
            { path: '/dashboard/customers', title: 'Khách Hàng' },
            { path: '/dashboard/contracts', title: 'Hợp Đồng' },
            { path: '/dashboard/procurement', title: 'Đơn Mua Hàng' },
            { path: '/dashboard/shipments', title: 'Lô Hàng' },
            { path: '/dashboard/agency', title: 'Agency Portal' },
            { path: '/dashboard/tax', title: 'Tra Cứu Thuế' },
            { path: '/dashboard/costing', title: 'Tính Giá Vốn (CST)' },
            { path: '/dashboard/warehouse', title: 'Kho Hàng' },
            { path: '/dashboard/transfers', title: 'Chuyển Kho' },
            { path: '/dashboard/stock-count', title: 'Kiểm Kê' },
            { path: '/dashboard/sales', title: 'Đơn Bán Hàng' },
            { path: '/dashboard/quotations', title: 'Báo Giá' },
            { path: '/dashboard/price-list', title: 'Bảng Giá' },
            { path: '/dashboard/crm', title: 'CRM — Khách Hàng' },
            { path: '/dashboard/consignment', title: 'Ký Gửi (CSG)' },
            { path: '/dashboard/allocation', title: 'Allocation Engine' },
            { path: '/dashboard/delivery', title: 'Vận Chuyển' },
            { path: '/dashboard/returns', title: 'Trả Hàng & CN' },
            { path: '/dashboard/pos', title: 'POS Showroom' },
            { path: '/dashboard/qr-codes', title: 'QR Truy Xuất' },
            { path: '/dashboard/finance', title: 'Công Nợ & Kế Toán' },
            { path: '/dashboard/declarations', title: 'Tờ Khai Thuế' },
            { path: '/dashboard/stamps', title: 'Quản Lý Tem' },
            { path: '/dashboard/reports', title: 'Báo Cáo' },
            { path: '/dashboard/market-price', title: 'Giá Thị Trường' },
            { path: '/dashboard/kpi', title: 'KPI Chỉ Tiêu' },
            { path: '/dashboard/media', title: 'Thư Viện Ảnh' },
            { path: '/dashboard/audit-log', title: 'Nhật Ký Hệ Thống' },
            { path: '/dashboard/ai', title: 'AI & Prompt' },
            { path: '/dashboard/settings/approval-matrix', title: 'Ma Trận Phân Quyền' },
            { path: '/dashboard/settings', title: 'Cài Đặt & RBAC' },
            { path: '/dashboard', title: 'Dashboard CEO' },
        ]

        const matched = routes.find(r => pathname.startsWith(r.path))
        return matched ? matched.title : "Hệ Thống"
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
            className="sticky top-0 z-10 flex items-center justify-between px-4"
            style={{
                height: '42px',
                background: 'rgba(20,36,51,0.95)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid #2A4355',
            }}
        >
            {/* Page title */}
            <div className="flex items-center">
                {mobileMenuButton}
                <div>
                    <h1 className="font-bold text-sm leading-none tracking-wide" style={{ color: '#E8F1F2' }}>
                        {title}
                    </h1>
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
                {/* Notifications */}
                <div className="relative" ref={notiRef}>
                    <button
                        onClick={handleToggleNoti}
                        className="relative flex items-center justify-center w-7 h-7 transition-all duration-150"
                        style={{
                            background: '#1B2E3D',
                            border: '1px solid #2A4355',
                            color: '#8AAEBB',
                            borderRadius: '5px',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}
                    >
                        <Bell size={14} />
                        {/* Notification badge */}
                        {unreadCount > 0 && (
                            <span
                                className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center text-slate-100"
                                style={{ background: '#E05252' }}
                            >
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Popover Dropdown */}
                    {showNoti && (
                        <div
                            className="absolute right-0 mt-2 w-80 rounded-lg shadow-lg z-50 overflow-hidden"
                            style={{
                                background: '#142433',
                                border: '1px solid #2A4355',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                            }}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#2A4355' }}>
                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8AAEBB' }}>Thông Báo</span>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllAsRead}
                                        className="text-[10px] font-semibold hover:underline text-[#87CBB9]"
                                    >
                                        Đọc tất cả
                                    </button>
                                )}
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="py-8 text-center text-xs" style={{ color: '#4A6A7A' }}>
                                        Không có thông báo mới
                                    </div>
                                ) : (
                                    <>
                                        {notifications.map(n => (
                                            <div
                                                key={n.id}
                                                onClick={() => handleNotificationClick(n)}
                                                className="px-4 py-3 transition-colors duration-150 cursor-pointer border-b last:border-b-0"
                                                style={{
                                                    borderColor: '#2A4355',
                                                    background: n.isRead ? 'transparent' : 'rgba(135,203,185,0.04)',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.08)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(135,203,185,0.04)')}
                                            >
                                                <div className="flex gap-2.5 items-start">
                                                    <span className="mt-0.5 flex-shrink-0 text-xs">
                                                        {n.type === 'success' ? '🟢' : n.type === 'warning' ? '🟡' : n.type === 'error' ? '🔴' : '🔵'}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-semibold leading-normal" style={{ color: n.isRead ? '#8AAEBB' : '#E8F1F2' }}>
                                                            {n.title}
                                                        </p>
                                                        {n.content && (
                                                            <p className="text-[10px] mt-0.5 text-slate-400 line-clamp-2">
                                                                {n.content}
                                                            </p>
                                                        )}
                                                        <span className="text-[10px] block mt-1" style={{ color: '#4A6A7A' }}>
                                                            {formatNotiTime(n.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {hasMore && (
                                            <button
                                                onClick={() => fetchNotifications(true)}
                                                disabled={loadingNoti}
                                                className="w-full py-2 text-center text-[10px] font-bold border-t hover:underline transition-all"
                                                style={{ 
                                                    borderColor: '#2A4355', 
                                                    color: '#87CBB9', 
                                                    background: 'rgba(135,203,185,0.02)' 
                                                }}
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
                        className="flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 transition-all duration-150"
                        style={{
                            background: '#1B2E3D',
                            border: '1px solid #2A4355',
                            borderRadius: '5px',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}
                    >
                        {/* Avatar circle — Teal */}
                        <div
                            className="w-6 h-6 flex items-center justify-center text-[11px] font-bold"
                            style={{
                                background: 'rgba(135,203,185,0.2)',
                                color: '#87CBB9',
                                border: '1px solid rgba(135,203,185,0.3)',
                                borderRadius: '4px',
                            }}
                        >
                            {(currentUser?.name?.[0] || 'A').toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold hidden sm:inline" style={{ color: '#8AAEBB' }}>
                            {currentUser?.name || 'Admin'}
                        </span>
                    </button>

                    {/* Profile Dropdown */}
                    {showProfile && (
                        <div
                            className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg z-50 overflow-hidden"
                            style={{
                                background: '#142433',
                                border: '1px solid #2A4355',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                            }}
                        >
                            <div className="p-4 border-b" style={{ borderColor: '#2A4355' }}>
                                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#8AAEBB' }}>Thông Tin Cá Nhân</p>
                                <p className="text-sm font-semibold truncate" style={{ color: '#E8F1F2' }}>
                                    {currentUser?.name || 'Admin'}
                                </p>
                                <p className="text-xs truncate mt-0.5" style={{ color: '#4A6A7A' }}>
                                    {currentUser?.email || 'admin@lyscellars.com'}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2.5">
                                    {(currentUser?.roles || ['Admin']).map(r => (
                                        <span key={r} className="text-xs px-1.5 py-0.5 rounded font-bold"
                                            style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="p-2 border-b" style={{ borderColor: '#2A4355' }}>
                                <button
                                    onClick={() => {
                                        setShowProfile(false)
                                        setShowMyAccount(true)
                                    }}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold rounded transition-colors duration-150 text-left text-slate-300 hover:bg-[#1B2E3D]"
                                >
                                    <User size={14} style={{ color: '#87CBB9' }} />
                                    Tài khoản của tôi
                                </button>
                            </div>
                            <div className="p-2">
                                <button
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold rounded transition-colors duration-150 disabled:opacity-50 text-left hover:bg-red-950/20"
                                    style={{ color: '#8B1A2E' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#ff6b6b')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#8B1A2E')}
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

    useEffect(() => {
        if (currentUser) {
            setName(currentUser.name || '')
            setPassword('')
            setConfirmPassword('')
            setError('')
        }
    }, [currentUser, open])

    if (!open || !currentUser) return null

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px',
        borderRadius: '6px',
        border: '1px solid #2A4355',
        background: '#142433',
        color: '#E8F1F2',
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

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10,25,38,0.7)' }}>
            <div className="w-full max-w-md h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-250" 
                style={{ background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                <div>
                    <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: '1px solid #142433' }}>
                        <div className="flex items-center gap-2">
                            <User size={18} style={{ color: '#87CBB9' }} />
                            <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>Tài Khoản Của Tôi</h3>
                        </div>
                        <button onClick={onClose} className="hover:opacity-80 transition-opacity">
                            <X size={18} style={{ color: '#4A6A7A' }} />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded text-sm flex items-center gap-2"
                            style={{ background: 'rgba(139,26,46,0.15)', border: '1px solid rgba(139,26,46,0.3)', color: '#f87171' }}>
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Email</label>
                            <div className="text-sm font-semibold p-3 rounded-md font-mono" style={{ background: '#142433', border: '1px solid #2A4355', color: '#8AAEBB' }}>
                                {currentUser.email}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Vai Trò</label>
                            <div className="flex flex-wrap gap-1 p-3 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                {currentUser.roles.map(r => (
                                    <span key={r} className="text-xs px-2 py-0.5 rounded font-bold"
                                        style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>
                                        {r}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Họ Tên *</label>
                            <input 
                                style={inputStyle} 
                                placeholder="Họ và tên của bạn"
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                            />
                        </div>

                        <div className="pt-4 border-t" style={{ borderColor: '#142433' }}>
                            <div className="flex items-center gap-1.5 mb-3">
                                <Key size={14} style={{ color: '#87CBB9' }} />
                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8AAEBB' }}>Đổi Mật Khẩu</span>
                            </div>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[11px] font-semibold mb-1 block" style={{ color: '#4A6A7A' }}>Mật Khẩu Mới</label>
                                    <input 
                                        style={inputStyle} 
                                        type="password" 
                                        placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                                        value={password} 
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-semibold mb-1 block" style={{ color: '#4A6A7A' }}>Xác Nhận Mật Khẩu Mới</label>
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
                    style={{ background: '#87CBB9', color: '#0A1926' }}
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Đang lưu thay đổi...' : 'Lưu Thay Đổi'}
                </button>
            </div>
        </div>
    )
}
