'use client'

import { Bell } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

interface HeaderProps {
    title?: string
    subtitle?: string
    mobileMenuButton?: React.ReactNode
}

interface NotificationItem {
    id: string
    title: string
    time: string
    type: 'info' | 'warning' | 'success'
    read: boolean
}

export function Header({ title: customTitle, subtitle, mobileMenuButton }: HeaderProps) {
    const pathname = usePathname()
    const [notifications, setNotifications] = useState<NotificationItem[]>([
        { id: '1', title: 'Tờ trình PO-2026-004 đang chờ CEO phê duyệt', time: '2 giờ trước', type: 'info', read: false },
        { id: '2', title: 'Lô hàng GR-2026-102 (Bordeaux) đã nhập kho thành công', time: '5 giờ trước', type: 'success', read: false },
        { id: '3', title: 'Mức margin của sản phẩm Chateau Margaux dưới 15%', time: 'Hôm qua', type: 'warning', read: false },
        { id: '4', title: 'Cảnh báo tồn kho: Chateau Lafite còn dưới mức an toàn', time: '2 ngày trước', type: 'warning', read: true },
    ])
    const [showNoti, setShowNoti] = useState(false)
    const notiRef = useRef<HTMLDivElement>(null)

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
            { path: '/dashboard/pipeline', title: 'Sales Pipeline' },
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

    // Click outside to close notifications dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
                setShowNoti(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const hasUnread = notifications.some(n => !n.read)

    return (
        <header
            className="sticky top-0 z-10 flex items-center justify-between px-6"
            style={{
                height: '64px',
                background: 'rgba(20,36,51,0.92)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid #2A4355',
            }}
        >
            {/* Page title */}
            <div className="flex items-center">
                {mobileMenuButton}
                <div>
                    <h1
                        className="font-semibold text-lg leading-tight"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}
                    >
                        {title}
                    </h1>
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
                {/* Notifications */}
                <div className="relative" ref={notiRef}>
                    <button
                        onClick={() => setShowNoti(!showNoti)}
                        className="relative flex items-center justify-center w-9 h-9 transition-all duration-150"
                        style={{
                            background: '#1B2E3D',
                            border: '1px solid #2A4355',
                            color: '#8AAEBB',
                            borderRadius: '6px',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}
                    >
                        <Bell size={16} />
                        {/* Notification dot — Burgundy */}
                        {hasUnread && (
                            <span
                                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                                style={{ background: '#8B1A2E' }}
                            />
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
                                {hasUnread && (
                                    <button
                                        onClick={() => {
                                            setNotifications(notifications.map(n => ({ ...n, read: true })))
                                        }}
                                        className="text-[10px] font-semibold hover:underline"
                                        style={{ color: '#87CBB9' }}
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
                                    notifications.map(n => (
                                        <div
                                            key={n.id}
                                            onClick={() => {
                                                setNotifications(notifications.map(item => item.id === n.id ? { ...item, read: true } : item))
                                            }}
                                            className="px-4 py-3 transition-colors duration-150 cursor-pointer border-b last:border-b-0"
                                            style={{
                                                borderColor: '#2A4355',
                                                background: n.read ? 'transparent' : 'rgba(135,203,185,0.04)',
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.08)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(135,203,185,0.04)')}
                                        >
                                            <div className="flex gap-2.5 items-start">
                                                <span className="mt-0.5 flex-shrink-0 text-xs">
                                                    {n.type === 'success' ? '🟢' : n.type === 'warning' ? '🟡' : '🔵'}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-medium leading-normal" style={{ color: n.read ? '#8AAEBB' : '#E8F1F2' }}>
                                                        {n.title}
                                                    </p>
                                                    <span className="text-[10px] block mt-1" style={{ color: '#4A6A7A' }}>
                                                        {n.time}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Avatar */}
                <button
                    className="flex items-center gap-2 pl-1 pr-3 py-1 transition-all duration-150"
                    style={{
                        background: '#1B2E3D',
                        border: '1px solid #2A4355',
                        borderRadius: '6px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}
                >
                    {/* Avatar circle — Teal */}
                    <div
                        className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                        style={{
                            background: 'rgba(135,203,185,0.2)',
                            color: '#87CBB9',
                            border: '1px solid rgba(135,203,185,0.3)',
                            borderRadius: '4px',
                        }}
                    >
                        A
                    </div>
                    <span className="text-sm hidden sm:inline" style={{ color: '#8AAEBB' }}>Admin</span>
                </button>
            </div>
        </header>
    )
}
