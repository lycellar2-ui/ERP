// Wine ERP — Official Company Forms & Templates Library
// Extracted directly from Lyscellar SOP Library (D:\Lyscellar\Wiki\sources\Forms)

export interface SopFormFile {
    id: string
    code: string
    fileName: string
    downloadUrl: string
    title: string
    fileType: string
    fileSize: string
    category: 'sales' | 'warehouse' | 'procurement' | 'finance' | 'mkt' | 'admin'
    updatedAt: string
}

export const OFFICIAL_FORMS: SopFormFile[] = [
    {
        "id": "b-o-c-o-c-ng-n--h-ng-ng-y-xlsx",
        "code": "Biểu mẫu",
        "fileName": "Báo cáo công nợ hàng ngày.xlsx",
        "downloadUrl": "/forms/B%C3%A1o%20c%C3%A1o%20c%C3%B4ng%20n%E1%BB%A3%20h%C3%A0ng%20ng%C3%A0y.xlsx",
        "title": "Báo cáo công nợ hàng ngày",
        "fileType": "XLSX",
        "fileSize": "9 KB",
        "category": "sales",
        "updatedAt": "2026-06-26"
    },
    {
        "id": "cptpp-co-chile-1040-docx",
        "code": "Biểu mẫu",
        "fileName": "CPTPP_Co_Chile_1040.docx",
        "downloadUrl": "/forms/CPTPP_Co_Chile_1040.docx",
        "title": "CPTPP Co Chile 1040",
        "fileType": "DOCX",
        "fileSize": "15 KB",
        "category": "procurement",
        "updatedAt": "2026-07-01"
    },
    {
        "id": "form-2-5-a-danh-gia-mau-xlsx",
        "code": "Form 2.5-A",
        "fileName": "Form_2.5-A_Danh_gia_Mau.xlsx",
        "downloadUrl": "/forms/Form_2.5-A_Danh_gia_Mau.xlsx",
        "title": "2.5-A Danh gia Mau",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "sales",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-3-1-a-du-bao-nhu-cau-xlsx",
        "code": "Form 3.1-A",
        "fileName": "Form_3.1-A_Du_bao_Nhu_cau.xlsx",
        "downloadUrl": "/forms/Form_3.1-A_Du_bao_Nhu_cau.xlsx",
        "title": "3.1-A Du bao Nhu cau",
        "fileType": "XLSX",
        "fileSize": "50 KB",
        "category": "procurement",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-3-1-b-ke-hoach-dat-hang-xlsx",
        "code": "Form 3.1-B",
        "fileName": "Form_3.1-B_Ke_hoach_Dat_hang.xlsx",
        "downloadUrl": "/forms/Form_3.1-B_Ke_hoach_Dat_hang.xlsx",
        "title": "3.1-B Ke hoach Dat hang",
        "fileType": "XLSX",
        "fileSize": "50 KB",
        "category": "procurement",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-3-2-a-purchase-order-xlsx",
        "code": "Form 3.2-A",
        "fileName": "Form_3.2-A_Purchase_Order.xlsx",
        "downloadUrl": "/forms/Form_3.2-A_Purchase_Order.xlsx",
        "title": "3.2-A Purchase Order",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "procurement",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-3-3-a-yeu-cau-thanh-toan-xlsx",
        "code": "Form 3.3-A",
        "fileName": "Form_3.3-A_Yeu_cau_Thanh_toan.xlsx",
        "downloadUrl": "/forms/Form_3.3-A_Yeu_cau_Thanh_toan.xlsx",
        "title": "3.3-A Yeu cau Thanh toan",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "procurement",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-3-4-a-bang-theo-doi-po-xlsx",
        "code": "Form 3.4-A",
        "fileName": "Form_3.4-A_Bang_theo_doi_PO.xlsx",
        "downloadUrl": "/forms/Form_3.4-A_Bang_theo_doi_PO.xlsx",
        "title": "3.4-A Bang theo doi PO",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "procurement",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-4-2-a-checklist-chung-tu-xlsx",
        "code": "Form 4.2-A",
        "fileName": "Form_4.2-A_Checklist_Chung_tu.xlsx",
        "downloadUrl": "/forms/Form_4.2-A_Checklist_Chung_tu.xlsx",
        "title": "4.2-A Checklist Chung tu",
        "fileType": "XLSX",
        "fileSize": "50 KB",
        "category": "procurement",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-4-5-a-landed-cost-xlsx",
        "code": "Form 4.5-A",
        "fileName": "Form_4.5-A_Landed_Cost.xlsx",
        "downloadUrl": "/forms/Form_4.5-A_Landed_Cost.xlsx",
        "title": "4.5-A Landed Cost",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "procurement",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-5-1-a-bien-ban-kiem-nhan-xlsx",
        "code": "Form 5.1-A",
        "fileName": "Form_5.1-A_Bien_ban_Kiem_nhan.xlsx",
        "downloadUrl": "/forms/Form_5.1-A_Bien_ban_Kiem_nhan.xlsx",
        "title": "5.1-A Bien ban Kiem nhan",
        "fileType": "XLSX",
        "fileSize": "50 KB",
        "category": "warehouse",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-5-2-a-so-theo-doi-tem-xlsx",
        "code": "Form 5.2-A",
        "fileName": "Form_5.2-A_So_theo_doi_Tem.xlsx",
        "downloadUrl": "/forms/Form_5.2-A_So_theo_doi_Tem.xlsx",
        "title": "5.2-A So theo doi Tem",
        "fileType": "XLSX",
        "fileSize": "50 KB",
        "category": "warehouse",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-5-3-a-so-nhiet-do-kho-xlsx",
        "code": "Form 5.3-A",
        "fileName": "Form_5.3-A_So_Nhiet_do_Kho.xlsx",
        "downloadUrl": "/forms/Form_5.3-A_So_Nhiet_do_Kho.xlsx",
        "title": "5.3-A So Nhiet do Kho",
        "fileType": "XLSX",
        "fileSize": "51 KB",
        "category": "warehouse",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-5-4-a-bang-ton-kho-xlsx",
        "code": "Form 5.4-A",
        "fileName": "Form_5.4-A_Bang_Ton_kho.xlsx",
        "downloadUrl": "/forms/Form_5.4-A_Bang_Ton_kho.xlsx",
        "title": "5.4-A Bang Ton kho",
        "fileType": "XLSX",
        "fileSize": "50 KB",
        "category": "warehouse",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-5-5-a-phieu-kiem-ke-xlsx",
        "code": "Form 5.5-A",
        "fileName": "Form_5.5-A_Phieu_Kiem_ke.xlsx",
        "downloadUrl": "/forms/Form_5.5-A_Phieu_Kiem_ke.xlsx",
        "title": "5.5-A Phieu Kiem ke",
        "fileType": "XLSX",
        "fileSize": "50 KB",
        "category": "warehouse",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-5-5-b-bien-ban-kiem-ke-xlsx",
        "code": "Form 5.5-B",
        "fileName": "Form_5.5-B_Bien_ban_Kiem_ke.xlsx",
        "downloadUrl": "/forms/Form_5.5-B_Bien_ban_Kiem_ke.xlsx",
        "title": "5.5-B Bien ban Kiem ke",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "warehouse",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-5-6-a-phieu-xuat-kho-xlsx",
        "code": "Form 5.6-A",
        "fileName": "Form_5.6-A_Phieu_Xuat_kho.xlsx",
        "downloadUrl": "/forms/Form_5.6-A_Phieu_Xuat_kho.xlsx",
        "title": "5.6-A Phieu Xuat kho",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "warehouse",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-5-7-a-bien-ban-hang-loi-xlsx",
        "code": "Form 5.7-A",
        "fileName": "Form_5.7-A_Bien_ban_Hang_loi.xlsx",
        "downloadUrl": "/forms/Form_5.7-A_Bien_ban_Hang_loi.xlsx",
        "title": "5.7-A Bien ban Hang loi",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "warehouse",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-5-8-a-phieu-yeu-cau-cap-phat-posm-xlsx",
        "code": "Form 5.8-A",
        "fileName": "Form_5.8-A_Phieu_yeu_cau_cap_phat_POSM.xlsx",
        "downloadUrl": "/forms/Form_5.8-A_Phieu_yeu_cau_cap_phat_POSM.xlsx",
        "title": "5.8-A Phieu yeu cau cap phat POSM",
        "fileType": "XLSX",
        "fileSize": "10 KB",
        "category": "warehouse",
        "updatedAt": "2026-06-29"
    },
    {
        "id": "form-6-1-a-danh-sach-kh-tiem-nang-xlsx",
        "code": "Form 6.1-A",
        "fileName": "Form_6.1-A_Danh_sach_KH_Tiem_nang.xlsx",
        "downloadUrl": "/forms/Form_6.1-A_Danh_sach_KH_Tiem_nang.xlsx",
        "title": "6.1-A Danh sach KH Tiem nang",
        "fileType": "XLSX",
        "fileSize": "50 KB",
        "category": "sales",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-6-1-b-phu-luc-gia-dac-biet-xlsx",
        "code": "Form 6.1-B",
        "fileName": "Form_6.1-B_Phu_luc_Gia_Dac_biet.xlsx",
        "downloadUrl": "/forms/Form_6.1-B_Phu_luc_Gia_Dac_biet.xlsx",
        "title": "6.1-B Phu luc Gia Dac biet",
        "fileType": "XLSX",
        "fileSize": "59 KB",
        "category": "sales",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-6-2-a-ho-so-khach-hang-xlsx",
        "code": "Form 6.2-A",
        "fileName": "Form_6.2-A_Ho_so_Khach_hang.xlsx",
        "downloadUrl": "/forms/Form_6.2-A_Ho_so_Khach_hang.xlsx",
        "title": "6.2-A Ho so Khach hang",
        "fileType": "XLSX",
        "fileSize": "141 KB",
        "category": "sales",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-6-3-a-don-hang-ban-xlsx",
        "code": "Form 6.3-A",
        "fileName": "Form_6.3-A_Don_hang_Ban.xlsx",
        "downloadUrl": "/forms/Form_6.3-A_Don_hang_Ban.xlsx",
        "title": "6.3-A Don hang Ban",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "sales",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-6-4-a-bang-gia-san-pham-xlsx",
        "code": "Form 6.4-A",
        "fileName": "Form_6.4-A_Bang_gia_San_pham.xlsx",
        "downloadUrl": "/forms/Form_6.4-A_Bang_gia_San_pham.xlsx",
        "title": "6.4-A Bang gia San pham",
        "fileType": "XLSX",
        "fileSize": "50 KB",
        "category": "sales",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-6-4-b-ly-cellars-quotation-template-xlsx",
        "code": "Form 6.4-B",
        "fileName": "Form_6.4-B_Ly_Cellars_Quotation_Template.xlsx",
        "downloadUrl": "/forms/Form_6.4-B_Ly_Cellars_Quotation_Template.xlsx",
        "title": "6.4-B Ly Cellars Quotation Template",
        "fileType": "XLSX",
        "fileSize": "14.3 MB",
        "category": "sales",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-6-4-c-to-trinh-co-che-dac-biet-xlsx",
        "code": "Form 6.4-C",
        "fileName": "Form_6.4-C_To_trinh_Co_che_Dac_biet.xlsx",
        "downloadUrl": "/forms/Form_6.4-C_To_trinh_Co_che_Dac_biet.xlsx",
        "title": "6.4-C To trinh Co che Dac biet",
        "fileType": "XLSX",
        "fileSize": "146 KB",
        "category": "sales",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-6-4-d-to-trinh-phe-duyet-ctkm-docx",
        "code": "Form 6.4-D",
        "fileName": "Form_6.4-D_To_trinh_Phe_duyet_CTKM.docx",
        "downloadUrl": "/forms/Form_6.4-D_To_trinh_Phe_duyet_CTKM.docx",
        "title": "6.4-D To trinh Phe duyet CTKM",
        "fileType": "DOCX",
        "fileSize": "39 KB",
        "category": "sales",
        "updatedAt": "2026-07-07"
    },
    {
        "id": "form-6-4-d-to-trinh-phe-duyet-ctkm-en-docx",
        "code": "Form 6.4-D",
        "fileName": "Form_6.4-D_To_trinh_Phe_duyet_CTKM_en.docx",
        "downloadUrl": "/forms/Form_6.4-D_To_trinh_Phe_duyet_CTKM_en.docx",
        "title": "6.4-D To trinh Phe duyet CTKM en",
        "fileType": "DOCX",
        "fileSize": "38 KB",
        "category": "sales",
        "updatedAt": "2026-07-07"
    },
    {
        "id": "form-6-6-a-phieu-khieu-nai-xlsx",
        "code": "Form 6.6-A",
        "fileName": "Form_6.6-A_Phieu_Khieu_nai.xlsx",
        "downloadUrl": "/forms/Form_6.6-A_Phieu_Khieu_nai.xlsx",
        "title": "6.6-A Phieu Khieu nai",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "sales",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-6-6-b-bien-ban-nhan-lai-hang-loi-xlsx",
        "code": "Form 6.6-B",
        "fileName": "Form_6.6-B_Bien_ban_Nhan_lai_Hang_loi.xlsx",
        "downloadUrl": "/forms/Form_6.6-B_Bien_ban_Nhan_lai_Hang_loi.xlsx",
        "title": "6.6-B Bien ban Nhan lai Hang loi",
        "fileType": "XLSX",
        "fileSize": "10 KB",
        "category": "sales",
        "updatedAt": "2026-06-25"
    },
    {
        "id": "form-6-7-a-bao-cao-doanh-so-xlsx",
        "code": "Form 6.7-A",
        "fileName": "Form_6.7-A_Bao_cao_Doanh_so.xlsx",
        "downloadUrl": "/forms/Form_6.7-A_Bao_cao_Doanh_so.xlsx",
        "title": "6.7-A Bao cao Doanh so",
        "fileType": "XLSX",
        "fileSize": "183 KB",
        "category": "sales",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-6-7-b-bao-cao-tuan-sales-xlsx",
        "code": "Form 6.7-B",
        "fileName": "Form_6.7-B_Bao_cao_Tuan_Sales.xlsx",
        "downloadUrl": "/forms/Form_6.7-B_Bao_cao_Tuan_Sales.xlsx",
        "title": "6.7-B Bao cao Tuan Sales",
        "fileType": "XLSX",
        "fileSize": "47 KB",
        "category": "sales",
        "updatedAt": "2026-06-26"
    },
    {
        "id": "form-7-1-a-theo-doi-giay-phep-xlsx",
        "code": "Form 7.1-A",
        "fileName": "Form_7.1-A_Theo_doi_Giay_phep.xlsx",
        "downloadUrl": "/forms/Form_7.1-A_Theo_doi_Giay_phep.xlsx",
        "title": "7.1-A Theo doi Giay phep",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "sales",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-8-10-a-to-trinh-wine-tasting-xlsx",
        "code": "Form 8.10-A",
        "fileName": "Form_8.10-A_To_trinh_Wine_Tasting.xlsx",
        "downloadUrl": "/forms/Form_8.10-A_To_trinh_Wine_Tasting.xlsx",
        "title": "8.10-A To trinh Wine Tasting",
        "fileType": "XLSX",
        "fileSize": "86 KB",
        "category": "finance",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-8-2-a-cong-no-phai-thu-xlsx",
        "code": "Form 8.2-A",
        "fileName": "Form_8.2-A_Cong_no_Phai_thu.xlsx",
        "downloadUrl": "/forms/Form_8.2-A_Cong_no_Phai_thu.xlsx",
        "title": "8.2-A Cong no Phai thu",
        "fileType": "XLSX",
        "fileSize": "50 KB",
        "category": "finance",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-8-2-b-doi-chieu-cong-no-xlsx",
        "code": "Form 8.2-B",
        "fileName": "Form_8.2-B_Doi_chieu_Cong_no.xlsx",
        "downloadUrl": "/forms/Form_8.2-B_Doi_chieu_Cong_no.xlsx",
        "title": "8.2-B Doi chieu Cong no",
        "fileType": "XLSX",
        "fileSize": "50 KB",
        "category": "finance",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-8-2-c-bao-cao-cong-no-hang-ngay-xlsx",
        "code": "Form 8.2-C",
        "fileName": "Form_8.2-C_Bao_cao_Cong_no_Hang_ngay.xlsx",
        "downloadUrl": "/forms/Form_8.2-C_Bao_cao_Cong_no_Hang_ngay.xlsx",
        "title": "8.2-C Bao cao Cong no Hang ngay",
        "fileType": "XLSX",
        "fileSize": "9 KB",
        "category": "finance",
        "updatedAt": "2026-06-26"
    },
    {
        "id": "form-8-3-a-cong-no-phai-tra-xlsx",
        "code": "Form 8.3-A",
        "fileName": "Form_8.3-A_Cong_no_Phai_tra.xlsx",
        "downloadUrl": "/forms/Form_8.3-A_Cong_no_Phai_tra.xlsx",
        "title": "8.3-A Cong no Phai tra",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "finance",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-8-4-a-cogs-xlsx",
        "code": "Form 8.4-A",
        "fileName": "Form_8.4-A_COGS.xlsx",
        "downloadUrl": "/forms/Form_8.4-A_COGS.xlsx",
        "title": "8.4-A COGS",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "finance",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-8-6-a-ngan-sach-xlsx",
        "code": "Form 8.6-A",
        "fileName": "Form_8.6-A_Ngan_sach.xlsx",
        "downloadUrl": "/forms/Form_8.6-A_Ngan_sach.xlsx",
        "title": "8.6-A Ngan sach",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "finance",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "form-8-8-a-yeu-cau-tao-ma-kh-xlsx",
        "code": "Form 8.8-A",
        "fileName": "Form_8.8-A_Yeu_cau_Tao_ma_KH.xlsx",
        "downloadUrl": "/forms/Form_8.8-A_Yeu_cau_Tao_ma_KH.xlsx",
        "title": "8.8-A Yeu cau Tao ma KH",
        "fileType": "XLSX",
        "fileSize": "78 KB",
        "category": "finance",
        "updatedAt": "2026-07-16"
    },
    {
        "id": "form-9-4-a-wine-tasting-xlsx",
        "code": "Form 9.4-A",
        "fileName": "Form_9.4-A_Wine_Tasting.xlsx",
        "downloadUrl": "/forms/Form_9.4-A_Wine_Tasting.xlsx",
        "title": "9.4-A Wine Tasting",
        "fileType": "XLSX",
        "fileSize": "49 KB",
        "category": "mkt",
        "updatedAt": "2026-06-23"
    },
    {
        "id": "weekly-report-template-26-06-2026-xlsx",
        "code": "Biểu mẫu",
        "fileName": "Weekly report template 26.06.2026.xlsx",
        "downloadUrl": "/forms/Weekly%20report%20template%2026.06.2026.xlsx",
        "title": "Weekly report template 26.06.2026",
        "fileType": "XLSX",
        "fileSize": "47 KB",
        "category": "sales",
        "updatedAt": "2026-06-26"
    }
];
