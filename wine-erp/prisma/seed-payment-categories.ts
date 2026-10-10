import { prisma } from '../src/lib/db'

const DEFAULT_CATEGORIES = [
    // ─── COST OF SALES (Tiền hàng & Nhập khẩu) ───────────
    {
        code: 'COS_WINE_IMPORT',
        name: 'Thanh toán tiền hàng rượu vang nhập khẩu',
        group: 'COST_OF_SALES',
        defaultAccount: '331 - Phải trả cho người bán',
        description: 'Chi trả tiền hàng cho các Nhà làm rượu / Châteaux / Đối tác xuất khẩu rượu',
        sortOrder: 1,
    },
    {
        code: 'COS_CUSTOMS_DUTY',
        name: 'Nộp Thuế Hải quan 3 tầng (NK, TTĐB, VAT)',
        group: 'COST_OF_SALES',
        defaultAccount: '3333 - Thuế xuất, nhập khẩu',
        description: 'Nộp thuế vào Kho bạc Nhà nước trước khi thông quan giải phóng lô hàng',
        sortOrder: 2,
    },
    {
        code: 'COS_LOGISTICS',
        name: 'Cước vận tải quốc tế & Logistics cảng biển',
        group: 'COST_OF_SALES',
        defaultAccount: '1562 - Chi phí thu mua hàng hóa',
        description: 'Cước biển/hàng không, Local charges cảng, phí D/O, kéo container lạnh về kho',
        sortOrder: 3,
    },
    {
        code: 'COS_STAMP_LABEL',
        name: 'Chi phí Tem rượu nhập khẩu & In nhãn phụ',
        group: 'COST_OF_SALES',
        defaultAccount: '1562 - Chi phí thu mua hàng hóa',
        description: 'Phí mua tem rượu nhập khẩu từ Tổng cục Thuế, chi phí in ấn nhãn phụ tiếng Việt',
        sortOrder: 4,
    },

    // ─── MARKETING & BÁN HÀNG ────────────────────────────
    {
        code: 'MKT_TASTING',
        name: 'Chi phí Thử nếm rượu (Wine Tasting) & Tiếp khách',
        group: 'MARKETING',
        defaultAccount: '641 - Chi phí bán hàng',
        description: 'Khui rượu mẫu cho khách VIP, HORECA, sự kiện thử nếm thương mại',
        sortOrder: 10,
    },
    {
        code: 'MKT_EVENT',
        name: 'Tổ chức Sự kiện, Workshop & Gala Dinner',
        group: 'MARKETING',
        defaultAccount: '641 - Chi phí bán hàng',
        description: 'Chi phí thuê địa điểm, âm thanh, trang trí, Masterclass cùng Sommelier',
        sortOrder: 11,
    },
    {
        code: 'MKT_POSM',
        name: 'Sản xuất Vật phẩm quảng cáo & Kệ trưng bày POSM',
        group: 'MARKETING',
        defaultAccount: '641 - Chi phí bán hàng',
        description: 'Ly pha lê cao cấp, khui rượu, xô đá, kệ trưng bày tại nhà hàng/khách sạn',
        sortOrder: 12,
    },
    {
        code: 'MKT_MEDIA',
        name: 'Quảng cáo, Truyền thông & Chụp ảnh sản phẩm',
        group: 'MARKETING',
        defaultAccount: '641 - Chi phí bán hàng',
        description: 'Chụp hình studio chai rượu, viết bài PR, ấn phẩm catalog, digital marketing',
        sortOrder: 13,
    },

    // ─── VẬN HÀNH & KHO BÃI (OPERATING) ──────────────────
    {
        code: 'OPS_RENT',
        name: 'Thuê mặt bằng Showroom & Kho lạnh bảo quản rượu',
        group: 'OPERATING',
        defaultAccount: '642 - Chi phí quản lý doanh nghiệp',
        description: 'Tiền thuê văn phòng trụ sở, showroom trưng bày và kho lạnh đạt chuẩn nhiệt độ 16-18°C',
        sortOrder: 20,
    },
    {
        code: 'OPS_UTILITIES',
        name: 'Điện, Nước, Viễn thông & Văn phòng phẩm',
        group: 'OPERATING',
        defaultAccount: '642 - Chi phí quản lý doanh nghiệp',
        description: 'Điện năng duy trì hệ thống lạnh 24/7, mạng cáp quang, văn phòng phẩm',
        sortOrder: 21,
    },
    {
        code: 'OPS_MAINTENANCE',
        name: 'Bảo trì hệ thống lạnh & Thiết bị bảo quản rượu',
        group: 'OPERATING',
        defaultAccount: '642 - Chi phí quản lý doanh nghiệp',
        description: 'Bảo dưỡng định kỳ máy nén khí, cảm biến nhiệt ẩm kế, xe nâng kho',
        sortOrder: 22,
    },

    // ─── HÀNH CHÍNH & NHÂN SỰ (ADMINISTRATIVE) ───────────
    {
        code: 'HR_TRAINING',
        name: 'Đào tạo Sommelier & Kiến thức rượu vang nội bộ',
        group: 'ADMINISTRATIVE',
        defaultAccount: '642 - Chi phí quản lý doanh nghiệp',
        description: 'Khóa học WSET, chứng chỉ Sommelier cho đội ngũ bán hàng và nhân sự',
        sortOrder: 30,
    },
    {
        code: 'HR_TRAVEL',
        name: 'Công tác phí & Đi thị trường nước ngoài',
        group: 'ADMINISTRATIVE',
        defaultAccount: '642 - Chi phí quản lý doanh nghiệp',
        description: 'Vé máy bay, khách sạn, di chuyển đi thăm vườn nho và xưởng sản xuất rượu',
        sortOrder: 31,
    },
    {
        code: 'HR_ADVANCE',
        name: 'Tạm ứng công tác & Hoàn ứng nhân sự',
        group: 'ADMINISTRATIVE',
        defaultAccount: '141 - Tạm ứng',
        description: 'Khoản chi tạm ứng cho cán bộ nhân viên thực hiện công vụ hoặc hoàn ứng sau sự vụ',
        sortOrder: 32,
    },

    // ─── ĐẦU TƯ TÀI SẢN (CAPEX) ──────────────────────────
    {
        code: 'CAP_EQUIPMENT',
        name: 'Mua sắm Tủ bảo quản rượu vang & Tài sản cố định',
        group: 'CAPEX',
        defaultAccount: '211 - Tài sản cố định hữu hình',
        description: 'Mua sắm tủ ướp rượu vang cao cấp, xe giao hàng chuyên dụng, máy chủ ERP',
        sortOrder: 40,
    },
]

export async function seedPaymentCategories() {
    console.log('Seeding Expense Categories...')
    let count = 0
    for (const cat of DEFAULT_CATEGORIES) {
        const existing = await prisma.expenseCategoryMaster.findUnique({
            where: { code: cat.code }
        })
        if (!existing) {
            await prisma.expenseCategoryMaster.create({
                data: cat
            })
            count++
        }
    }
    console.log(`Created ${count} new expense categories. Total: ${DEFAULT_CATEGORIES.length}`)
}

if (process.argv[1]?.endsWith('seed-payment-categories.ts')) {
    seedPaymentCategories()
        .then(() => prisma.$disconnect())
        .catch((e) => {
            console.error(e)
            prisma.$disconnect()
            process.exit(1)
        })
}
