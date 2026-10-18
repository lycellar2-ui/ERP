import type { AppLocale } from '@/lib/i18n'

export const CRM_I18N = {
    vi: {
        headerTitle: 'CRM — Quản Lý Quan Hệ Khách Hàng',
        headerSubtitle: 'Hồ sơ 360°, cơ hội bán hàng, thử rượu, khiếu nại & phân nhóm thông minh',
        createCustomerBtn: 'Tạo Khách Hàng',
        kpiActiveCustomers: 'KH Đang Hoạt Động',
        kpiOpenOpportunities: 'Cơ Hội Đang Mở',
        kpiPipelineValue: 'Giá Trị Pipeline',
        kpiOpenComplaints: 'Khiếu Nại Chưa Xử Lý',
        kpiChurningWarning: 'Cảnh Báo Rời Bỏ',
        kpiInactiveOver60d: 'Không đặt hàng >60 ngày',
        tabCustomers360: 'Khách Hàng 360°',
        tabPipeline: 'Pipeline Cơ Hội',
        tabTelesales: 'Telesales & Tìm Kiếm KH',
        tabWeeklyVisit: 'Kế Hoạch Đi Thăm Tuần',
        tabEvents: 'Sự Kiện Thử Rượu',
        tabComplaints: 'Khiếu Nại',
    },
    en: {
        headerTitle: 'CRM — Customer Relationship Management',
        headerSubtitle: 'Customer 360°, sales pipeline, wine tastings, complaint tickets & smart segmentation',
        createCustomerBtn: 'New Customer',
        kpiActiveCustomers: 'Active Customers',
        kpiOpenOpportunities: 'Open Opportunities',
        kpiPipelineValue: 'Pipeline Value',
        kpiOpenComplaints: 'Open Complaints',
        kpiChurningWarning: 'Churn Risk Warning',
        kpiInactiveOver60d: 'No order >60 days',
        tabCustomers360: 'Customer 360°',
        tabPipeline: 'Opportunity Pipeline',
        tabTelesales: 'Telesales & Prospecting',
        tabWeeklyVisit: 'Weekly Visit Plan',
        tabEvents: 'Wine Tasting Events',
        tabComplaints: 'Complaint Tickets',
    },
} as const

export function getCrmLabels(locale: AppLocale) {
    return CRM_I18N[locale]
}
