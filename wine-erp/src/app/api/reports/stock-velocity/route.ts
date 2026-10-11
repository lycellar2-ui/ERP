import { NextRequest, NextResponse } from 'next/server'
import { getStockVelocityReport } from '@/app/dashboard/reports/actions-stock-velocity'
import { getCurrentUser, hasPermission } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ success: false, error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' }, { status: 401 })
        }

        if (!hasPermission(user, 'RPT', 'READ')) {
            return NextResponse.json({ success: false, error: 'Không có quyền truy cập báo cáo (RPT:READ)' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const cycleMonths = Number(searchParams.get('cycleMonths') || 6)

        const res = await getStockVelocityReport({ cycleMonths })
        return NextResponse.json(res)
    } catch (err: unknown) {
        console.error('[API /api/reports/stock-velocity] Error:', err)
        const errorMsg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
    }
}
