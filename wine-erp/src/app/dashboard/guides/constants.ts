export interface GuideScreenMeta {
    key: string
    label: string
    labelEn: string
    description: string
    descriptionEn: string
}

export const GUIDE_SCREENS: GuideScreenMeta[] = [
    {
        key: 'overview',
        label: 'Tổng Quan & Tờ Trình',
        labelEn: 'Overview & Proposals',
        description: 'Dashboard điều hành, Tờ trình — Đề xuất, Quy trình chuẩn SOP',
        descriptionEn: 'Executive Dashboard, Proposals, Standard Operating Procedures',
    },
    {
        key: 'master-data',
        label: 'Danh Mục & Hợp Đồng',
        labelEn: 'Master Data & Contracts',
        description: 'Sản phẩm, Nhà cung cấp, Khách hàng, Hợp đồng',
        descriptionEn: 'Products, Suppliers, Customers, Contracts',
    },
    {
        key: 'procurement',
        label: 'Mua Hàng & Lô Hàng',
        labelEn: 'Procurement & Shipments',
        description: 'Đơn mua hàng, Theo dõi lô hàng nhập khẩu, Tính giá vốn (CST)',
        descriptionEn: 'Purchase Orders, Import Shipments, Landed Costing',
    },
    {
        key: 'sales',
        label: 'Bán Hàng & Báo Giá',
        labelEn: 'Sales & Quotations',
        description: 'Đơn bán hàng, Báo giá PDF, Bảng giá, Check Margin, POS Showroom',
        descriptionEn: 'Sales Orders, Quotations, Price Lists, Margin Check, POS Showroom',
    },
    {
        key: 'crm',
        label: 'CRM & Thị Trường',
        labelEn: 'CRM & Field Visits',
        description: 'CRM Khách hàng 360°, Pipeline cơ hội, Check-in thị trường',
        descriptionEn: 'Customer 360°, Sales Pipeline, Field Check-in',
    },
    {
        key: 'warehouse',
        label: 'Kho Vận & Logistics',
        labelEn: 'Warehouse & Logistics',
        description: 'Nhập/Xuất kho, Sơ đồ 2D, Kiểm kê, Chuyển kho, Ký gửi (CSG), Trả hàng',
        descriptionEn: 'Warehouses, Stock Count, Transfers, Consignment, Returns',
    },
    {
        key: 'finance',
        label: 'Tài Chính & Kế Toán',
        labelEn: 'Finance & Accounting',
        description: 'Đề nghị thanh toán, Công nợ, Đối chiếu hóa đơn, Tem rượu, Báo cáo, KPI',
        descriptionEn: 'Payment Requests, AR/AP, Reconciliation, Wine Stamps, Reports, KPI',
    },
    {
        key: 'system',
        label: 'Nhân Sự & Hệ Thống',
        labelEn: 'HR & System',
        description: 'Nhân sự & Giấy tờ, Nhật ký hệ thống, AI & Prompt, Cài đặt RBAC',
        descriptionEn: 'HR & Documents, Audit Log, AI & Prompt, Settings & RBAC',
    },
]

export function getScreenMeta(screenKey: string): GuideScreenMeta | undefined {
    return GUIDE_SCREENS.find((s) => s.key === screenKey)
}
