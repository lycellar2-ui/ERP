// ─── Proposal Constants (shared between server & client) ──────
import type { AppLocale } from '@/lib/i18n'

export const CATEGORY_LABELS: Record<string, string> = {
    TASTING: '🍷 Tờ Trình Tasting (Thử Rượu / Hàng Mẫu)',
    SPECIAL_EVENT: '🎪 Tờ Trình Tổ Chức Sự Kiện / Event',
    PRICE_ADJUSTMENT: '🏷️ Tờ Trình Cơ Chế Giá & Giá Đặc Biệt',
    BUDGET_REQUEST: 'Xin Ngân Sách',
    CAPITAL_EXPENDITURE: 'Mua Sắm TSCĐ',
    NEW_SUPPLIER: 'NCC Mới',
    NEW_PRODUCT: 'Sản Phẩm Mới',
    POLICY_CHANGE: 'Thay Đổi Quy Trình',
    STAFF_REQUISITION: 'Tuyển Dụng',
    PAYMENT_SCHEDULE: 'Lịch Thanh Toán',
    PROMOTION_CAMPAIGN: 'Chương Trình KM',
    LICENSE_RENEWAL: 'Gia Hạn Giấy Phép',
    CONTRACT_SIGNING: 'Ký Hợp Đồng',
    DEBT_WRITE_OFF: 'Xoá Nợ Khó Đòi',
    OTHER: 'Khác',
}

export const CATEGORY_LABELS_EN: Record<string, string> = {
    TASTING: '🍷 Wine Tasting & Sample Proposal',
    SPECIAL_EVENT: '🎪 Special Event Proposal',
    PRICE_ADJUSTMENT: '🏷️ Special Pricing & Commercial Policy',
    BUDGET_REQUEST: 'Budget Request',
    CAPITAL_EXPENDITURE: 'Capital Expenditure (CAPEX)',
    NEW_SUPPLIER: 'New Supplier',
    NEW_PRODUCT: 'New Product',
    POLICY_CHANGE: 'Policy & Process Change',
    STAFF_REQUISITION: 'Staff Requisition',
    PAYMENT_SCHEDULE: 'Payment Schedule',
    PROMOTION_CAMPAIGN: 'Promotion Campaign',
    LICENSE_RENEWAL: 'License Renewal',
    CONTRACT_SIGNING: 'Contract Signing',
    DEBT_WRITE_OFF: 'Debt Write-Off',
    OTHER: 'Other',
}

export function getCategoryLabel(cat: string, locale: AppLocale = 'vi'): string {
    if (locale === 'en') {
        return CATEGORY_LABELS_EN[cat] || cat
    }
    return CATEGORY_LABELS[cat] || cat
}

export const PRIORITY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    LOW: { label: 'Thấp', color: '#64748B', bg: 'rgba(74,106,122,0.15)' },
    NORMAL: { label: 'Bình thường', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    HIGH: { label: 'Cao', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    URGENT: { label: 'Khẩn cấp', color: '#E05252', bg: 'rgba(224,82,82,0.15)' },
}

export const PRIORITY_LABELS_EN: Record<string, { label: string; color: string; bg: string }> = {
    LOW: { label: 'Low', color: '#64748B', bg: 'rgba(74,106,122,0.15)' },
    NORMAL: { label: 'Normal', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    HIGH: { label: 'High', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    URGENT: { label: 'Urgent', color: '#E05252', bg: 'rgba(224,82,82,0.15)' },
}

export function getPriorityLabel(prio: string, locale: AppLocale = 'vi') {
    if (locale === 'en') {
        return PRIORITY_LABELS_EN[prio] || PRIORITY_LABELS_EN.NORMAL
    }
    return PRIORITY_LABELS[prio] || PRIORITY_LABELS.NORMAL
}

export const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Bản nháp', color: '#64748B', bg: 'rgba(74,106,122,0.15)' },
    SUBMITTED: { label: 'Đã trình', color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)' },
    REVIEWING: { label: 'Đang xem xét', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    RETURNED: { label: 'Trả lại', color: '#C45A2A', bg: 'rgba(196,90,42,0.15)' },
    APPROVED_L1: { label: 'TP Duyệt', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    APPROVED_L2: { label: 'KT Duyệt', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    APPROVED: { label: 'CEO Duyệt ✓', color: '#5BA88A', bg: 'rgba(91,168,138,0.2)' },
    REJECTED: { label: 'Từ chối', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
    IN_PROGRESS: { label: 'Đang thực hiện', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    CLOSED: { label: 'Hoàn tất', color: '#64748B', bg: 'rgba(74,106,122,0.15)' },
    CANCELLED: { label: 'Huỷ', color: '#64748B', bg: 'rgba(74,106,122,0.1)' },
}

export const STATUS_LABELS_EN: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Draft', color: '#64748B', bg: 'rgba(74,106,122,0.15)' },
    SUBMITTED: { label: 'Submitted', color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)' },
    REVIEWING: { label: 'Reviewing', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    RETURNED: { label: 'Returned', color: '#C45A2A', bg: 'rgba(196,90,42,0.15)' },
    APPROVED_L1: { label: 'Manager Approved', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    APPROVED_L2: { label: 'Accountant Approved', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    APPROVED: { label: 'CEO Approved ✓', color: '#5BA88A', bg: 'rgba(91,168,138,0.2)' },
    REJECTED: { label: 'Rejected', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
    IN_PROGRESS: { label: 'In Progress', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    CLOSED: { label: 'Completed', color: '#64748B', bg: 'rgba(74,106,122,0.15)' },
    CANCELLED: { label: 'Cancelled', color: '#64748B', bg: 'rgba(74,106,122,0.1)' },
}

export function getStatusLabel(status: string, locale: AppLocale = 'vi') {
    if (locale === 'en') {
        return STATUS_LABELS_EN[status] || STATUS_LABELS_EN.DRAFT
    }
    return STATUS_LABELS[status] || STATUS_LABELS.DRAFT
}
