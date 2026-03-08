// Shared labels and constants for Regulated Documents
// Not a "use server" file — safe for client imports

export const REG_DOC_CATEGORY_LABELS: Record<string, string> = {
    COMPANY_LICENSE: 'Giấy phép DN',
    IMPORT_DOCUMENT: 'Chứng từ NK',
    PRODUCT_CERTIFICATION: 'Chứng nhận SP',
    FACILITY_COMPLIANCE: 'Kho bãi & PCCC',
    TRADE_AGREEMENT: 'HĐ Thương mại',
}

export const REG_DOC_TYPE_LABELS: Record<string, string> = {
    // Company Licenses
    DISTRIBUTION_LICENSE: 'GP Phân phối rượu',
    WHOLESALE_LICENSE: 'GP Bán buôn rượu',
    RETAIL_LICENSE: 'GP Bán lẻ rượu',
    IMPORT_LICENSE: 'GP Nhập khẩu tự động',
    BUSINESS_REGISTRATION: 'ĐKKD + MST',
    FOOD_SAFETY_CERT: 'VSATTP',
    ADVERTISING_PERMIT: 'GP Quảng cáo rượu',
    // Facility & Safety
    FIRE_SAFETY_CERT: 'PCCC — Đủ ĐK',
    FIRE_DESIGN_APPROVAL: 'PCCC — Thẩm duyệt TK',
    FIRE_INSPECTION_CERT: 'PCCC — Nghiệm thu',
    WAREHOUSE_LICENSE: 'GP Kho bãi',
    ENVIRONMENT_CERT: 'CN Môi trường',
    WAREHOUSE_LEASE: 'HĐ Thuê kho',
    TEMPERATURE_CALIBRATION: 'Hiệu chuẩn nhiệt kế',
    // Import Documents
    CERTIFICATE_OF_ORIGIN: 'C/O (EUR.1, Form D...)',
    QUALITY_TEST_REPORT: 'Phiếu kiểm nghiệm CL',
    CUSTOMS_DECLARATION_CERT: 'Tờ khai HQ thông quan',
    FOOD_SAFETY_LOT: 'KT ATTP per lô',
    INSURANCE_POLICY_DOC: 'Bảo hiểm hàng hóa',
    WINE_STAMP_CERT: 'Xác nhận tem rượu',
    HEALTH_CERTIFICATE: 'Health Certificate',
    FREE_SALE_CERTIFICATE: 'Free Sale Certificate',
    PHYTOSANITARY_CERT: 'Kiểm dịch thực vật',
    // Product Certifications
    QUALITY_DECLARATION: 'Tự công bố CL SP',
    VIETNAMESE_LABEL: 'Nhãn phụ tiếng Việt',
    STANDARDS_COMPLIANCE: 'Phù hợp QCVN',
    OTHER: 'Khác',
}

export const REG_DOC_SCOPE_LABELS: Record<string, string> = {
    COMPANY: 'Công ty',
    SUPPLIER: 'Nhà cung cấp',
    CUSTOMER: 'Khách hàng',
    PRODUCT: 'Sản phẩm',
    SHIPMENT: 'Lô hàng',
    LOT: 'Stock Lot',
}

// Category → suggested types mapping
export const CATEGORY_TYPE_MAP: Record<string, string[]> = {
    COMPANY_LICENSE: [
        'DISTRIBUTION_LICENSE', 'WHOLESALE_LICENSE', 'RETAIL_LICENSE',
        'IMPORT_LICENSE', 'BUSINESS_REGISTRATION', 'FOOD_SAFETY_CERT',
        'ADVERTISING_PERMIT',
    ],
    FACILITY_COMPLIANCE: [
        'FIRE_SAFETY_CERT', 'FIRE_DESIGN_APPROVAL', 'FIRE_INSPECTION_CERT',
        'WAREHOUSE_LICENSE', 'ENVIRONMENT_CERT', 'WAREHOUSE_LEASE',
        'TEMPERATURE_CALIBRATION',
    ],
    IMPORT_DOCUMENT: [
        'CERTIFICATE_OF_ORIGIN', 'QUALITY_TEST_REPORT', 'CUSTOMS_DECLARATION_CERT',
        'FOOD_SAFETY_LOT', 'INSURANCE_POLICY_DOC', 'WINE_STAMP_CERT',
        'HEALTH_CERTIFICATE', 'FREE_SALE_CERTIFICATE', 'PHYTOSANITARY_CERT',
    ],
    PRODUCT_CERTIFICATION: [
        'QUALITY_DECLARATION', 'VIETNAMESE_LABEL', 'STANDARDS_COMPLIANCE',
    ],
    TRADE_AGREEMENT: ['OTHER'],
}
