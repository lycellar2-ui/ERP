import { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import {
    getPaymentRequests, getPaymentRequestStats,
    getExpenseCategories, getExpenseBudgets, getSuppliersMaster
} from './actions'
import { PaymentRequestsClient } from './PaymentRequestsClient'

export const metadata: Metadata = {
    title: 'Đề Nghị Thanh Toán & Ngân Sách | Wine ERP',
    description: 'Phân hệ duyệt đề nghị thanh toán đa cấp, lưu trữ chứng từ scan Cloudflare R2 và kiểm soát định mức ngân sách chi phí.',
}

export default async function PaymentRequestsPage() {
    const user = await getCurrentUser()

    const [
        requestsData,
        stats,
        categories,
        budgets,
        suppliers,
        legalEntities,
        departments,
    ] = await Promise.all([
        getPaymentRequests({ pageSize: 50 }),
        getPaymentRequestStats(),
        getExpenseCategories(true),
        getExpenseBudgets(),
        getSuppliersMaster(),
        prisma.legalEntity.findMany({
            select: { id: true, name: true, code: true },
            orderBy: { code: 'asc' },
        }),
        prisma.department.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        }),
    ])

    return (
        <PaymentRequestsClient
            initialRequests={requestsData.rows}
            initialTotal={requestsData.total}
            stats={stats}
            categories={categories}
            budgets={budgets}
            legalEntities={legalEntities}
            suppliers={suppliers}
            departments={departments}
            currentUser={user}
        />
    )
}
