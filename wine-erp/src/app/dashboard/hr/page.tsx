import { getEmployees, getHrDashboardStats, getHrFormHelpers } from './actions'
import { HrClient } from './HrClient'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Quản Lý Hồ Sơ & Giấy Tờ Nhân Viên | Wine ERP',
    description: 'Phân hệ quản lý thông tin nhân sự, số hóa hợp đồng và giấy tờ pháp lý với cảnh báo thời hạn tự động.',
}

export default async function HrPage() {
    const [employees, stats, helpers] = await Promise.all([
        getEmployees().catch(() => []),
        getHrDashboardStats().catch(() => ({
            totalEmployees: 0,
            activeEmployees: 0,
            probationEmployees: 0,
            expiringContracts: 0,
            expiredContracts: 0,
            expiringHealthChecks: 0,
            totalDocs: 0,
            urgentItems: [],
        })),
        getHrFormHelpers().catch(() => ({
            departments: [],
            availableUsers: [],
        })),
    ])

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <HrClient
                initialEmployees={employees}
                initialStats={stats}
                departments={helpers.departments}
                availableUsers={helpers.availableUsers}
            />
        </div>
    )
}
