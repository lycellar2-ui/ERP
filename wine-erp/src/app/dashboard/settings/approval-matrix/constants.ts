// ─── Approval Matrix Types & Constants ───────────────

export interface StepRoleConfig {
    level: number
    role: string
    label?: string
}

export interface ProposalRouteConfig {
    category: string
    creatorRoles: string[]
    steps: StepRoleConfig[]
}

export interface ThresholdConfig {
    key: string
    label: string
    value: number
    description: string
}

export interface SystemRoleInfo {
    code: string
    name: string
}

export interface PORouteConfig {
    creatorRoles: string[]
    steps: StepRoleConfig[]
}

export interface ApprovalMatrixData {
    proposalRoutes: ProposalRouteConfig[]
    poRoute: PORouteConfig
    thresholds: ThresholdConfig[]
    availableRoles: SystemRoleInfo[]
}

export const DEFAULT_PO_ROUTING: PORouteConfig = {
    creatorRoles: ['THU_MUA', 'ADMIN'],
    steps: [
        { level: 1, role: 'THU_MUA', label: 'Trưởng Phòng Mua Hàng' },
        { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng / GĐ Tài Chính' },
        { level: 3, role: 'CEO', label: 'Tổng Giám Đốc (CEO)' },
    ]
}

export const SYSTEM_ROLES: SystemRoleInfo[] = [
    { code: 'SALES_REP', name: 'Sales Rep (Kinh doanh)' },
    { code: 'SALES_ADMIN', name: 'Sales Admin (Hỗ trợ KD)' },
    { code: 'SALES_MGR', name: 'Trưởng Phòng Kinh Doanh (CBO)' },
    { code: 'KE_TOAN', name: 'Kế Toán / GĐ Tài Chính' },
    { code: 'THU_MUA', name: 'Trưởng / NV Mua Hàng' },
    { code: 'THU_KHO', name: 'Thủ Kho' },
    { code: 'CEO', name: 'Tổng Giám Đốc (CEO)' },
    { code: 'OPERATION_MGR', name: 'Operation Manager' },
    { code: 'ADMIN', name: 'Admin Hệ Thống' },
]

export const DEFAULT_ROUTING_FULL: Record<string, ProposalRouteConfig> = {
    TASTING: {
        category: 'TASTING',
        creatorRoles: ['SALES_REP', 'SALES_ADMIN', 'SALES_MGR', 'ADMIN'],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Quản Lý Kinh Doanh' },
            { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng / Vận Hành' },
            { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    PRICE_ADJUSTMENT: {
        category: 'PRICE_ADJUSTMENT',
        creatorRoles: ['SALES_REP', 'SALES_ADMIN', 'SALES_MGR', 'ADMIN'],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng Kinh Doanh' },
            { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    BUDGET_REQUEST: {
        category: 'BUDGET_REQUEST',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng' },
            { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    CAPITAL_EXPENDITURE: {
        category: 'CAPITAL_EXPENDITURE',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng' },
            { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    NEW_SUPPLIER: {
        category: 'NEW_SUPPLIER',
        creatorRoles: ['THU_MUA', 'ADMIN'],
        steps: [
            { level: 1, role: 'THU_MUA', label: 'Trưởng Phòng Mua Hàng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    NEW_PRODUCT: {
        category: 'NEW_PRODUCT',
        creatorRoles: ['THU_MUA', 'SALES_MGR', 'ADMIN'],
        steps: [
            { level: 1, role: 'THU_MUA', label: 'Trưởng Phòng Mua Hàng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    POLICY_CHANGE: {
        category: 'POLICY_CHANGE',
        creatorRoles: ['CEO', 'ADMIN'],
        steps: [
            { level: 1, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    STAFF_REQUISITION: {
        category: 'STAFF_REQUISITION',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    PAYMENT_SCHEDULE: {
        category: 'PAYMENT_SCHEDULE',
        creatorRoles: ['KE_TOAN', 'ADMIN'],
        steps: [
            { level: 1, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    PROMOTION_CAMPAIGN: {
        category: 'PROMOTION_CAMPAIGN',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng' },
            { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    SPECIAL_EVENT: {
        category: 'SPECIAL_EVENT',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng' },
            { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    LICENSE_RENEWAL: {
        category: 'LICENSE_RENEWAL',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    CONTRACT_SIGNING: {
        category: 'CONTRACT_SIGNING',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    DEBT_WRITE_OFF: {
        category: 'DEBT_WRITE_OFF',
        creatorRoles: ['KE_TOAN', 'ADMIN'],
        steps: [
            { level: 1, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
    OTHER: {
        category: 'OTHER',
        creatorRoles: [],
        steps: [
            { level: 1, role: 'SALES_MGR', label: 'Trưởng Phòng' },
            { level: 2, role: 'CEO', label: 'Tổng Giám Đốc' },
        ]
    },
}

export const DEFAULT_THRESHOLDS: ThresholdConfig[] = [
    { key: 'so.amount_threshold', label: 'SO: Giá trị cần CEO duyệt', value: 100_000_000, description: 'Đơn bán ≥ mức này → chuyển CEO phê duyệt' },
    { key: 'so.discount_threshold', label: 'SO: % Chiết khấu cần duyệt', value: 15, description: '% Chiết khấu > mức này → cần CEO phê duyệt' },
    { key: 'po.amount_threshold', label: 'PO: Giá trị cần CEO duyệt', value: 200_000_000, description: 'Đơn mua ≥ mức này → chuyển CEO phê duyệt' },
    { key: 'proposal.amount_auto_ceo', label: 'Tờ Trình: Giá trị lên CEO trực tiếp', value: 500_000_000, description: 'Tờ trình ≥ mức này → skip cấp trung, lên CEO trực tiếp' },
]
