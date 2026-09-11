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

    const managerRoleKeywords = ['admin', 'sales manager', 'ceo', 'manager', 'ban giám đốc', 'system admin']
    const isManager = Boolean(
        user?.roles?.some((r: any) => {
            const roleName = typeof r === 'string' ? r : r.role?.name || r.name
            return typeof roleName === 'string' && managerRoleKeywords.includes(roleName.trim().toLowerCase())
        })
    )

    const todayStr = new Date().toISOString().slice(0, 10)

    const [visits, rawCustomers] = await Promise.all([
        getSalesVisits(), // Load recent visits so history and photos are immediately available
        prisma.customer.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                code: true,
                name: true,
                channel: true,
                purchasingPhone: true,
                addresses: {
                    where: { isDefault: true },
                    select: { address: true, city: true },
                    take: 1,
                },
            },
            orderBy: { name: 'asc' },
            take: 500,
        }),
    ])

    const customers = rawCustomers.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        channel: c.channel,
        phone: c.purchasingPhone || null,
        address: c.addresses?.[0]?.address || null,
    }))

    return (
        <Suspense fallback={<div className="p-8 text-[#8AAEBB] text-xs">Đang tải giao diện Check-in Thị Trường...</div>}>
            <SalesVisitsClient
                initialVisits={visits}
                customers={customers}
                currentUserId={user?.id || 'sys-user'}
                currentUserName={user?.name || 'Sales Rep'}
                isManager={isManager}
            />
        </Suspense>
    )
}
