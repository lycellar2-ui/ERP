import type { AppLocale } from '@/lib/i18n'

export const PAYMENT_REQUESTS_I18N = {
    vi: {
        headerTitle: 'Đề Nghị Thanh Toán & Ngân Sách',
        headerSubtitle: 'Quản lý phiếu đề nghị thanh toán (PR), ngân sách phòng ban & chi trả công nợ NCC',
        tabRequests: 'Phiếu Đề Nghị TT',
        tabCategories: 'Danh Mục Khoản Mục',
        tabBudgets: 'Ngân Sách Phòng Ban',
        tabSupplierPayables: 'Công Nợ Nhà Cung Cấp',
        createPrBtn: 'Tạo Đề Nghị TT',
        kpiTotalPr: 'Tổng Phiếu ĐNTT',
        kpiPendingApproval: 'Chờ Phê Duyệt',
        kpiApprovedPaid: 'Đã Duyệt / Đã Chi',
        kpiOverBudgetWarning: 'Vượt Ngân Sách',
        searchPlaceholder: 'Tìm mã phiếu, tiêu đề, người đề nghị, thụ hưởng...',
        allStatuses: 'Tất cả trạng thái',
        allPriorities: 'Tất cả độ ưu tiên',
        allDepartments: 'Tất cả phòng ban',
    },
    en: {
        headerTitle: 'Payment Requests & Budgets',
        headerSubtitle: 'Manage payment requests (PR), departmental budgets & supplier AP settlements',
        tabRequests: 'Payment Requests',
        tabCategories: 'Expense Categories',
        tabBudgets: 'Department Budgets',
        tabSupplierPayables: 'Supplier Payables (AP)',
        createPrBtn: 'New Payment Request',
        kpiTotalPr: 'Total PRs',
        kpiPendingApproval: 'Pending Approval',
        kpiApprovedPaid: 'Approved / Paid',
        kpiOverBudgetWarning: 'Over Budget',
        searchPlaceholder: 'Search PR code, title, requester, beneficiary...',
        allStatuses: 'All statuses',
        allPriorities: 'All priorities',
        allDepartments: 'All departments',
    },
} as const

export function getPaymentRequestsLabels(locale: AppLocale) {
    return PAYMENT_REQUESTS_I18N[locale]
}
