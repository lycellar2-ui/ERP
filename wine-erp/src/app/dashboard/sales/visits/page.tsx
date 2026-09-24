import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getSalesVisits, getTeamWeeklySalesOverview, getWeeklyPlanWithVisits } from './actions'
import { SalesVisitsClient } from './SalesVisitsClient'

export const metadata = {
    title: 'Quản Lý Check-in Thị Trường | Wine ERP',
    description: 'Quản lý kế hoạch tuần và theo dõi check-in thị trường',
}

function getWeekNumber(d: Date): { week: number; year: number } {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return { week: weekNo, year: date.getUTCFullYear() }
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

    const managerRoleKeywords = ['admin', 'sales manager', 'ceo', 'manager', 'ban giám đốc', 'system admin', 'trợ lý', 'tro ly', 'assistant']
    const isManager = Boolean(
        user?.roles?.some((r: any) => {
            const roleName = typeof r === 'string' ? r : r.role?.name || r.name
            return typeof roleName === 'string' && managerRoleKeywords.includes(roleName.trim().toLowerCase())
        })
    )

    const now = new Date()
    const weekInfo = getWeekNumber(now)

    // Parallel pre-fetching optimized by role to eliminate client waterfalls
    let visits: any[] = []
    let initialTeamData: any = null
    let initialPlan: any = null
    let customers: any[] = []

    if (isManager) {
        // Manager priority: Team overview data pre-loaded for instant first paint
        const [teamRes, recentVisits] = await Promise.all([
            getTeamWeeklySalesOverview(weekInfo.week, weekInfo.year),
            getSalesVisits({ limit: 20 }),
        ])
        if (teamRes.success) {
            initialTeamData = teamRes
        }
        visits = recentVisits || []
    } else {
        // Sales Rep priority: Today's visits, weekly plan, and customer list
        const [repVisits, planRes, customersList] = await Promise.all([
            getSalesVisits({ limit: 20, salespersonId: user?.id }),
            getWeeklyPlanWithVisits(user?.id || '', weekInfo.week, weekInfo.year),
            prisma.customer.findMany({
                where: { deletedAt: null },
                select: {
                    id: true,
                    code: true,
                    name: true,
                    channel: true,
                },
                orderBy: { name: 'asc' },
                take: 300,
            }),
        ])
        visits = repVisits || []
        if (planRes.success) {
            initialPlan = planRes
        }
        customers = customersList || []
    }

    return (
        <Suspense fallback={<div className="p-8 text-[#8AAEBB] text-xs">Đang tải dữ liệu...</div>}>
            <SalesVisitsClient
                initialVisits={visits}
                customers={customers}
                currentUserId={user?.id || 'sys-user'}
                currentUserName={user?.name || 'Sales Rep'}
                isManager={isManager}
                initialTeamData={initialTeamData}
                initialPlan={initialPlan}
            />
        </Suspense>
    )
}
