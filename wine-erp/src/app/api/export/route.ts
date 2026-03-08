import { NextRequest, NextResponse } from 'next/server'
import { exportARAgingReport, exportSalesReport, exportCostingReport } from '@/lib/excel'
import { getARInvoices } from '@/app/dashboard/finance/actions'
import { getSalesOrders } from '@/app/dashboard/sales/actions'
import { getCostingProducts } from '@/app/dashboard/costing/actions'
import { getCurrentUser, hasPermission } from '@/lib/session'

// Permission mapping for each report type
const REPORT_PERMISSIONS: Record<string, { module: string; action: string }> = {
    'ar-aging': { module: 'FIN', action: 'READ' },
    'sales': { module: 'SLS', action: 'READ' },
    'costing': { module: 'FIN', action: 'READ' },
}

export async function GET(request: NextRequest) {
    // ── Auth Check ──────────────────────────
    const user = await getCurrentUser()
    if (!user) {
        return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const report = searchParams.get('report')

    if (!report || !REPORT_PERMISSIONS[report]) {
        return NextResponse.json({ error: 'Report không hợp lệ' }, { status: 400 })
    }

    // ── RBAC Check ──────────────────────────
    const perm = REPORT_PERMISSIONS[report]
    if (!hasPermission(user, perm.module, perm.action)) {
        return NextResponse.json({ error: 'Không có quyền xuất report này' }, { status: 403 })
    }

    try {
        let buffer: Buffer
        let filename: string

        switch (report) {
            case 'ar-aging': {
                const { rows } = await getARInvoices({ pageSize: 9999 })
                buffer = await exportARAgingReport(rows.map(r => ({
                    ...r,
                    dueDate: new Date(r.dueDate).toLocaleDateString('vi-VN'),
                })))
                filename = `AR_Aging_${new Date().toISOString().slice(0, 10)}.xlsx`
                break
            }

            case 'sales': {
                const { rows } = await getSalesOrders({ pageSize: 9999 })
                buffer = await exportSalesReport(rows.map(r => ({
                    ...r,
                    createdAt: new Date(r.createdAt).toLocaleDateString('vi-VN'),
                })))
                filename = `Sales_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
                break
            }

            case 'costing': {
                const rows = await getCostingProducts()
                buffer = await exportCostingReport(rows)
                filename = `Costing_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
                break
            }

            default:
                return NextResponse.json({ error: 'Report không hợp lệ' }, { status: 400 })
        }

        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (err: any) {
        console.error('[Export API Error]', err.message)
        return NextResponse.json({ error: 'Lỗi xuất báo cáo' }, { status: 500 })
    }
}

