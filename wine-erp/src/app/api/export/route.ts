import { NextRequest, NextResponse } from 'next/server'
import { exportARAgingReport, exportSalesReport, exportCostingReport } from '@/lib/excel'
import { getARInvoices } from '@/app/dashboard/finance/actions'
import { getSalesOrders } from '@/app/dashboard/sales/actions'
import { getCostingProducts } from '@/app/dashboard/costing/actions'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const report = searchParams.get('report')

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
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
