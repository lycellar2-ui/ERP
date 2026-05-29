'use client'

import { Bell, Search } from 'lucide-react'
import { usePathname } from 'next/navigation'

interface HeaderProps {
    title?: string
    subtitle?: string
    mobileMenuButton?: React.ReactNode
}

export function Header({ title: customTitle, subtitle, mobileMenuButton }: HeaderProps) {
    const pathname = usePathname()

    // Dynamic title mapper based on pathname
    const getHeaderTitle = (): string => {
        if (customTitle && customTitle !== "LY's Cellars") return customTitle

        if (pathname === '/dashboard/margin') return 'Check Giá & Biên Lợi Nhuận'

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
    const isMarginPage = pathname === '/dashboard/margin'

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
                {/* Search */}
                {!isMarginPage && (
                    <button
                        className="flex items-center gap-2 px-3 py-2 text-sm transition-all duration-150"
                        style={{
                            background: '#1B2E3D',
                            color: '#4A6A7A',
                            border: '1px solid #2A4355',
                            borderRadius: '6px',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#87CBB9'
                            e.currentTarget.style.color = '#8AAEBB'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#2A4355'
                            e.currentTarget.style.color = '#4A6A7A'
                        }}
                    >
                        <Search size={15} />
                        <span className="hidden sm:inline text-xs">Tìm kiếm...</span>
                        <kbd
                            className="hidden sm:inline text-xs px-1.5 py-0.5"
                            style={{ background: '#2A4355', color: '#4A6A7A', borderRadius: '4px', fontSize: '10px' }}
                        >
                            ⌘K
                        </kbd>
                    </button>
                )}

                {/* Notifications */}
                <button
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
                    <span
                        className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                        style={{ background: '#8B1A2E' }}
                    />
                </button>

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
