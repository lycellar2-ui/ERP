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

    const userEmail = (user?.email || '').toLowerCase()
    const userRoleNames = (user?.roles || []).map((r: any) => {
        const name = typeof r === 'string' ? r : r.role?.name || r.name || ''
        return name.trim().toLowerCase()
    })

    const isCEO = userRoleNames.some(r => ['ceo', 'admin', 'ban giám đốc', 'system admin'].includes(r)) ||
        userEmail === 'admin@lyscellars.com' ||
        userEmail === 'lyptc@lyscellars.com'

    const isJeremie = userEmail === 'jeremie.courivault@lyscellars.com' || userRoleNames.includes('cbo')

    // Chỉ có CEO / Ban Giám Đốc thuần quản lý mới ở chế độ xem Giám Sát chuyên biệt
    // Jeremie (CBO) cần check-in thực địa nên sẽ ưu tiên giao diện Check-in & Kế hoạch
    const isManagerOnly = isCEO && !isJeremie

    const now = new Date()
    const weekInfo = getWeekNumber(now)

    // Parallel pre-fetching optimized by role to eliminate client waterfalls
    let visits: any[] = []
    let initialTeamData: any = null
    let initialPlan: any = null
    let customers: any[] = []

    if (isJeremie) {
        // Jeremie (CBO): Nạp song song dữ liệu Check-in cá nhân + Khách hàng + Bảng giám sát cấp CBO
        const [repVisits, planRes, customersList, teamRes] = await Promise.all([
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
            getTeamWeeklySalesOverview(weekInfo.week, weekInfo.year),
        ])
        visits = repVisits || []
        if (planRes.success) initialPlan = planRes
        customers = customersList || []
        if (teamRes.success) initialTeamData = teamRes
    } else if (isManagerOnly) {
        // Quản lý / CEO: Ưu tiên tải tức thì Bảng Giám Sát Đội Ngũ
        const [teamRes, recentVisits] = await Promise.all([
            getTeamWeeklySalesOverview(weekInfo.week, weekInfo.year),
            getSalesVisits({ limit: 20 }),
        ])
        if (teamRes.success) {
            initialTeamData = teamRes
        }
        visits = recentVisits || []
    } else {
        // Sales Rep thực địa: Tải lịch trình tuần, lượt viếng thăm và danh sách khách hàng
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
        <Suspense fallback={<div className="p-8 text-slate-600 text-xs">Đang tải dữ liệu...</div>}>
            <SalesVisitsClient
                initialVisits={visits}
                customers={customers}
                currentUserId={user?.id || 'sys-user'}
                currentUserName={user?.name || (isJeremie ? 'Jeremy (CBO)' : 'Sales Rep')}
                isManager={isManagerOnly}
                isCboOrExecutiveRep={isJeremie}
                isCeoController={isCEO}
                initialTeamData={initialTeamData}
                initialPlan={initialPlan}
            />
        </Suspense>
    )
}
