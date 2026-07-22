import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { getSalesVisits } from './actions'
import { SalesVisitsClient } from './SalesVisitsClient'

export const metadata = {
    title: 'Check-in Đi Thị Trường | Wine ERP',
    description: 'Module Check-in / Check-out đi thị trường dành cho Salesman',
}

export default async function SalesVisitsPage() {
    // Get current logged in user (Default to first active salesman or admin user)
    const currentUser = await prisma.user.findFirst({
        where: { status: 'ACTIVE' },
        include: { roles: { include: { role: true } } }
    })

    const isManager = currentUser?.roles.some((r: any) =>
        ['Admin', 'Sales Manager', 'CEO', 'Manager'].includes(r.role.name)
    ) ?? true

    const todayStr = new Date().toISOString().slice(0, 10)

    const [visits, customers] = await Promise.all([
        getSalesVisits({ date: todayStr }),
        prisma.customer.findMany({
            where: { deletedAt: null },
            select: { id: true, code: true, name: true, channel: true },
            orderBy: { name: 'asc' },
            take: 200,
        })
    ])

    return (
        <Suspense fallback={<div className="p-8 text-[#8AAEBB] text-xs">Đang tải giao diện Check-in Thị Trường...</div>}>
            <SalesVisitsClient
                initialVisits={visits}
                customers={customers}
                currentUserId={currentUser?.id || 'sys-user'}
                currentUserName={currentUser?.name || 'Sales Rep'}
                isManager={isManager}
            />
        </Suspense>
    )
}
