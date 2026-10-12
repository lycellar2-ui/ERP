export interface ProcessMarkdownDoc {
    id: string
    title: string
    fileName: string
    relativeFilePath: string
    url: string
    group: string
    groupLabel: string
    groupCode: string
    version: string
    lastUpdated: string
    tags: string[]
    sizeStr: string
    isEnglish: boolean
}

export const PROCESS_GROUPS_META: Record<string, { label: string; code: string; order: number }> = {
    '01_chien_luoc': { label: 'Chiến Lược & Danh Mục', code: 'STR', order: 1 },
    '02_nha_cung_cap': { label: 'Nhà Cung Cấp & Hợp Đồng', code: 'SUP', order: 2 },
    '03_mua_hang': { label: 'Mua Hàng & Đặt Hàng Quốc Tế', code: 'PUR', order: 3 },
    '04_nhap_khau_logistics': { label: 'Nhập Khẩu & Hải Quan Logistics', code: 'IMP', order: 4 },
    '05_kho_van': { label: 'Kho Vận, Dán Tem & Bảo Quản', code: 'WMS', order: 5 },
    '06_ban_hang': { label: 'Bán Hàng & Kênh Phân Phối', code: 'SLS', order: 6 },
    '07_phap_ly': { label: 'Pháp Lý, Giấy Phép & Công Bố', code: 'LEG', order: 7 },
    '08_tai_chinh': { label: 'Tài Chính, Kế Toán & Giá Vốn', code: 'FIN', order: 8 },
    '09_marketing': { label: 'Marketing & Phát Triển Thương Hiệu', code: 'MKT', order: 9 },
    '10_nhan_su': { label: 'Nhân Sự & Đào Tạo', code: 'HR', order: 10 },
    '11_cntt': { label: 'Hệ Thống ERP & CNTT', code: 'IT', order: 11 },
    '12_van_hanh': { label: 'Tiêu Chuẩn Vận Hành & SLA', code: 'OPS', order: 12 },
    'general': { label: 'Văn Bản Quy Trình Khác', code: 'GEN', order: 13 }
}
