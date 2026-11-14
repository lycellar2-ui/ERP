export interface ContractTemplateDefinition {
    code: string
    name: string
    category: 'SALES' | 'PURCHASE' | 'CONSIGNMENT' | 'LOGISTICS'
    description: string
    isDefault: boolean
    badgeText: string
    sampleDownloadUrl: string
    placeholders: Array<{ tag: string; label: string; example: string }>
}

export const CONTRACT_TEMPLATES: ContractTemplateDefinition[] = [
    {
        code: 'HD_NGUYEN_TAC',
        name: 'Hợp đồng nguyên tắc mua bán & phân phối rượu',
        category: 'SALES',
        description: 'Thiết lập quan hệ đối tác đại lý/bán buôn rượu lâu dài. Quy định hạn mức công nợ, thời hạn thanh toán, tiêu chuẩn bảo quản nhiệt độ và cam kết tem rượu nhập khẩu chính ngạch.',
        isDefault: true,
        badgeText: 'Nguyên Tắc / B2B',
        sampleDownloadUrl: '/templates/contracts/HD_NGUYEN_TAC.docx',
        placeholders: [
            { tag: '{so_hop_dong}', label: 'Số hợp đồng', example: 'HĐNT-2026/01-LYS' },
            { tag: '{ngay_ky_text}', label: 'Ngày ký văn bản', example: 'ngày 11 tháng 10 năm 2026' },
            { tag: '{ten_ben_b}', label: 'Tên đối tác (Bên B)', example: 'CÔNG TY TNHH NHÀ HÀNG LA TABLE' },
            { tag: '{mst_ben_b}', label: 'Mã số thuế Bên B', example: '0312456789' },
            { tag: '{dia_chi_ben_b}', label: 'Địa chỉ Bên B', example: '45 Lê Duẩn, Bến Nghé, Quận 1, TP.HCM' },
            { tag: '{dai_dien_ben_b}', label: 'Người đại diện Bên B', example: 'Bà Trần Thị B' },
            { tag: '{chuc_vu_ben_b}', label: 'Chức vụ Bên B', example: 'Giám Đốc Điều Hành' },
            { tag: '{han_muc_cong_no}', label: 'Hạn mức công nợ (số)', example: '500,000,000' },
            { tag: '{han_muc_cong_no_bang_chu}', label: 'Hạn mức công nợ (chữ)', example: 'Năm trăm triệu đồng chẵn' },
            { tag: '{thoi_han_thanh_toan}', label: 'Số ngày thanh toán', example: '30' },
            { tag: '{ngay_hieu_luc}', label: 'Ngày hiệu lực', example: '11/10/2026' },
            { tag: '{ngay_het_han}', label: 'Ngày hết hạn', example: '10/10/2027' },
        ],
    },
    {
        code: 'HD_KY_GUI',
        name: 'Phụ lục hợp đồng ký gửi và trưng bày rượu',
        category: 'CONSIGNMENT',
        description: 'Ký gửi rượu vang tại showroom, nhà hàng, khách sạn đối tác. Có bảng danh mục rượu ký gửi chi tiết, tỷ lệ hoa hồng, trách nhiệm bảo quản tiêu chuẩn rượu vang và chu kỳ đối soát.',
        isDefault: true,
        badgeText: 'Ký Gửi Showroom',
        sampleDownloadUrl: '/templates/contracts/HD_KY_GUI.docx',
        placeholders: [
            { tag: '{so_hop_dong}', label: 'Số phụ lục ký gửi', example: 'PLKG-2026/05' },
            { tag: '{so_hd_goc}', label: 'Hợp đồng nguyên tắc gốc', example: 'HĐNT-2026/01-LYS' },
            { tag: '{#san_pham}...{/san_pham}', label: 'Bảng lặp sản phẩm ký gửi', example: 'STT, Tên rượu, Niên vụ, ĐVT, SL, Đơn giá, Thành tiền' },
            { tag: '{tong_tien}', label: 'Tổng giá trị ký gửi', example: '185,000,000' },
            { tag: '{tong_tien_bang_chu}', label: 'Tổng tiền bằng chữ', example: 'Một trăm tám mươi lăm triệu đồng chẵn' },
            { tag: '{ty_le_hoa_hong}', label: 'Tỷ lệ hoa hồng (%)', example: '15' },
            { tag: '{ngay_doi_soat}', label: 'Ngày đối soát hàng tháng', example: '25' },
            { tag: '{dia_diem_giao_hang}', label: 'Kho/Địa điểm ký gửi', example: 'Showroom La Table, 45 Lê Duẩn, Q.1' },
        ],
    },
    {
        code: 'HD_MOT_LAN',
        name: 'Hợp đồng mua bán rượu nhập khẩu từng lần',
        category: 'SALES',
        description: 'Hợp đồng mua bán theo chuyến/đơn hàng cụ thể. Có bảng kê danh mục chai rượu chi tiết, thuế VAT 10%, tiền đặt cọc, thời gian giao hàng và cam kết tem rượu theo Nghị định 105/2017.',
        isDefault: true,
        badgeText: 'Đơn Hàng / Từng Lần',
        sampleDownloadUrl: '/templates/contracts/HD_MOT_LAN.docx',
        placeholders: [
            { tag: '{so_hop_dong}', label: 'Số hợp đồng', example: 'HĐMB-2026/102-LYS' },
            { tag: '{#san_pham}...{/san_pham}', label: 'Bảng lặp sản phẩm rượu', example: 'Tên vang, Niên vụ, Số lượng, Đơn giá, Thành tiền' },
            { tag: '{tien_truoc_thue}', label: 'Tiền trước thuế VAT', example: '150,000,000' },
            { tag: '{tien_vat}', label: 'Thuế VAT (10%)', example: '15,000,000' },
            { tag: '{tong_tien}', label: 'Tổng thanh toán', example: '165,000,000' },
            { tag: '{tong_tien_bang_chu}', label: 'Bằng chữ', example: 'Một trăm sáu mươi lăm triệu đồng chẵn' },
            { tag: '{ty_le_dat_coc}', label: 'Tỷ lệ đặt cọc (%)', example: '30' },
            { tag: '{tien_dat_coc}', label: 'Tiền đặt cọc', example: '49,500,000' },
            { tag: '{ngay_giao_hang}', label: 'Ngày hẹn giao hàng', example: '15/10/2026' },
        ],
    },
]
