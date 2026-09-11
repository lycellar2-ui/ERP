import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getSalesVisits } from './actions'
import { SalesVisitsClient } from './SalesVisitsClient'

export const metadata = {
    title: 'Hành Trình Thị Trường & Check-in | Wine ERP',
    description: 'Quản trị kế hoạch tuần, check-in thực địa và review cuối tuần cho Sales',
}

export default async function SalesVisitsPage() {
    const sessionUser = await getCurrentUser().catch(() => null)
    
    // If not authenticated via session, fallback to first active user
    let user = sessionUser
    if (!user) {
        user = await prisma.user.findFirst({
            where: { status: 'ACTIVE' },
            include: { roles: { include: { role: true } } }
        }) as any
    }

    const isManager = user?.roles?.some((r: any) => {
        const roleName = r.role?.name || r
        return ['Admin', 'Sales Manager', 'CEO', 'Manager', 'Ban Giám Đốc'].includes(roleName)
    }) ?? true

    const todayStr = new Date().toISOString().slice(0, 10)

    const [visits, customers, users] = await Promise.all([
        getSalesVisits({ date: todayStr }),
        prisma.customer.findMany({
            where: { deletedAt: null },
            select: { id: true, code: true, name: true, channel: true },
            orderBy: { name: 'asc' },
            take: 500,
        }),
        prisma.user.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' },
        })
    ])

    return (
        <Suspense fallback={<div className="p-8 text-[#8AAEBB] text-xs">Đang tải giao diện Check-in Thị Trường...</div>}>
            <SalesVisitsClient
                initialVisits={visits}
                customers={customers}
                users={users}
                currentUserId={user?.id || 'sys-user'}
                currentUserName={user?.name || 'Sales Rep'}
                isManager={isManager}
            />
        </Suspense>
    )
}
