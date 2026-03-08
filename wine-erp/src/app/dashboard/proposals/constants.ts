// ─── Proposal Constants (shared between server & client) ──────

export const CATEGORY_LABELS: Record<string, string> = {
    BUDGET_REQUEST: 'Xin Ngân Sách',
    CAPITAL_EXPENDITURE: 'Mua Sắm TSCĐ',
    PRICE_ADJUSTMENT: 'Điều Chỉnh Giá',
    NEW_SUPPLIER: 'NCC Mới',
    NEW_PRODUCT: 'Sản Phẩm Mới',
    POLICY_CHANGE: 'Thay Đổi Quy Trình',
    STAFF_REQUISITION: 'Tuyển Dụng',
    PAYMENT_SCHEDULE: 'Lịch Thanh Toán',
    PROMOTION_CAMPAIGN: 'Chương Trình KM',
    SPECIAL_EVENT: 'Sự Kiện / Tasting',
    LICENSE_RENEWAL: 'Gia Hạn Giấy Phép',
    CONTRACT_SIGNING: 'Ký Hợp Đồng',
    DEBT_WRITE_OFF: 'Xoá Nợ Khó Đòi',
    OTHER: 'Khác',
}

export const PRIORITY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    LOW: { label: 'Thấp', color: '#4A6A7A', bg: 'rgba(74,106,122,0.15)' },
    NORMAL: { label: 'Bình thường', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    HIGH: { label: 'Cao', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    URGENT: { label: 'Khẩn cấp', color: '#E05252', bg: 'rgba(224,82,82,0.15)' },
}

export const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Bản nháp', color: '#4A6A7A', bg: 'rgba(74,106,122,0.15)' },
    SUBMITTED: { label: 'Đã trình', color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)' },
    REVIEWING: { label: 'Đang xem xét', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    RETURNED: { label: 'Trả lại', color: '#C45A2A', bg: 'rgba(196,90,42,0.15)' },
    APPROVED_L1: { label: 'TP Duyệt', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    APPROVED_L2: { label: 'KT Duyệt', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    APPROVED: { label: 'CEO Duyệt ✓', color: '#5BA88A', bg: 'rgba(91,168,138,0.2)' },
    REJECTED: { label: 'Từ chối', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
    IN_PROGRESS: { label: 'Đang thực hiện', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    CLOSED: { label: 'Hoàn tất', color: '#4A6A7A', bg: 'rgba(74,106,122,0.15)' },
    CANCELLED: { label: 'Huỷ', color: '#4A6A7A', bg: 'rgba(74,106,122,0.1)' },
}
