// Shared constants for shipment cost tracking (NOT a server action file)

export const COST_CATEGORIES = [
    { key: 'FREIGHT', label: 'Cước vận chuyển' },
    { key: 'INSURANCE', label: 'Bảo hiểm hàng hóa' },
    { key: 'THC_ORIGIN', label: 'THC cảng xuất' },
    { key: 'THC_DEST', label: 'THC cảng đến' },
    { key: 'TRUCKING_ORIGIN', label: 'Trucking nội địa (xuất)' },
    { key: 'TRUCKING_DEST', label: 'Trucking nội địa (VN)' },
    { key: 'CUSTOMS_FEE', label: 'Phí dịch vụ HQ' },
    { key: 'INSPECTION', label: 'Phí giám định' },
    { key: 'FUMIGATION', label: 'Phí xông trùng' },
    { key: 'DETENTION', label: 'Phí lưu container' },
    { key: 'DEMURRAGE', label: 'Phí lưu tàu' },
    { key: 'STAMP', label: 'Phí tem rượu' },
    { key: 'DOCUMENTATION', label: 'Phí chứng từ' },
    { key: 'BANK_CHARGE', label: 'Phí ngân hàng (LC/TT)' },
    { key: 'OTHER', label: 'Chi phí khác' },
] as const
