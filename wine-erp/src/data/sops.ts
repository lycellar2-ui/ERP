// Wine ERP — Company Standard Operating Procedures (SOPs) Data
// Knowledge Hub for seamless employee onboarding without heavy manual training

export type SopCategory = 'all' | 'sales' | 'warehouse' | 'procurement' | 'finance' | 'hr' | 'pos'

export interface RaciMatrix {
    responsible: string[] // R: Người trực tiếp thực hiện
    accountable: string[] // A: Người phê duyệt / Chịu trách nhiệm cuối cùng
    consulted: string[]   // C: Bên tư vấn, phối hợp
    informed: string[]    // I: Bên nhận thông tin / theo dõi
}

export interface SopStep {
    stepNumber: number
    title: string
    role: string
    action: string
    erpLink?: {
        path: string
        label: string
    }
    deliverables?: string[]
    cautions?: string[]
}

export interface SopChecklistItem {
    id: string
    text: string
    critical?: boolean
}

export interface SopFaq {
    q: string
    a: string
}

export interface SopAttachedForm {
    code: string
    title: string
    fileName: string
    downloadUrl: string
}

export interface SopItem {
    id: string
    code: string
    title: string
    titleEn: string
    category: SopCategory
    department: string
    departmentEn: string
    summary: string
    purpose: string
    scope: string
    estimatedDuration: string
    effectiveDate: string
    version: string
    raci: RaciMatrix
    flowSteps: SopStep[]
    checklist: SopChecklistItem[]
    requiredDocs: string[]
    forms?: SopAttachedForm[]
    faqs: SopFaq[]
}

export interface CategoryMeta {
    id: SopCategory
    label: string
    labelEn: string
    iconName: string
    color: string
    description: string
}

export const SOP_CATEGORIES: CategoryMeta[] = [
    {
        id: 'all',
        label: 'Tất Cả Quy Trình',
        labelEn: 'All Procedures',
        iconName: 'Layers',
        color: 'slate',
        description: 'Toàn bộ 6 quy trình chuẩn hóa đang vận hành tại công ty'
    },
    {
        id: 'sales',
        label: 'Bán Hàng & Báo Giá',
        labelEn: 'Sales & Quotations',
        iconName: 'Briefcase',
        color: 'rose',
        description: 'Quy trình tạo báo giá, chốt đơn hàng, duyệt chiết khấu & công nợ'
    },
    {
        id: 'warehouse',
        label: 'Kho Vận & Giao Hàng',
        labelEn: 'Warehouse & Logistics',
        iconName: 'Warehouse',
        color: 'amber',
        description: 'Quy trình nhập kho dán tem, xuất hàng, giao hàng COD & bảo quản'
    },
    {
        id: 'procurement',
        label: 'Mua Hàng & Nhập Khẩu',
        labelEn: 'Procurement & Import',
        iconName: 'ShoppingCart',
        color: 'blue',
        description: 'Quy trình mua hàng quốc tế, kê khai hải quan & tính giá vốn'
    },
    {
        id: 'finance',
        label: 'Tài Chính & Kế Toán',
        labelEn: 'Finance & Accounting',
        iconName: 'CreditCard',
        color: 'emerald',
        description: 'Quy trình đề nghị thanh toán, đối soát hóa đơn & quản lý thu chi'
    },
    {
        id: 'hr',
        label: 'Nhân Sự & Quyền Hạn',
        labelEn: 'HR & Permissions',
        iconName: 'Users',
        color: 'teal',
        description: 'Quy trình tiếp nhận nhân sự, cấp tài khoản & phân quyền ERP'
    },
]

export const SOP_ITEMS: SopItem[] = [
    {
        id: 'sop-sls-01',
        code: 'SOP-SLS-01',
        title: 'Quy Trình Bán Hàng & Phê Duyệt Chiết Khấu Đặc Biệt',
        titleEn: 'Sales Order & Special Discount Approval Procedure',
        category: 'sales',
        department: 'Phòng Kinh Doanh (Sales)',
        departmentEn: 'Sales Department',
        summary: 'Hướng dẫn nhân viên Sales từ khâu lập báo giá, trình duyệt chiết khấu vượt trần, kiểm tra tín dụng công nợ khách hàng đến khi tạo Đơn bán hàng (SO) chuyển Kho xuất.',
        purpose: 'Đảm bảo mọi đơn hàng xuất kho đều tuân thủ chính sách giá, biên lợi nhuận chuẩn và không vi phạm hạn mức tín dụng khách hàng.',
        scope: 'Áp dụng cho tất cả Sales Executive, Trưởng phòng Kinh doanh, Ban Giám Đốc và Bộ phận Kế toán công nợ.',
        estimatedDuration: '15 - 30 phút / Đơn hàng',
        effectiveDate: '01/01/2026',
        version: 'v2.1',
        raci: {
            responsible: ['Nhân viên Sales phụ trách khách hàng'],
            accountable: ['Trưởng phòng Kinh doanh', 'Ban Giám Đốc / CEO'],
            consulted: ['Kế toán công nợ (AR)', 'Thủ kho (kiểm tra tồn khả dụng)'],
            informed: ['Đội giao nhận', 'Khách hàng']
        },
        flowSteps: [
            {
                stepNumber: 1,
                title: 'Tạo Báo Giá & Kiểm Tra Margin',
                role: 'Nhân viên Sales',
                action: 'Truy cập phân hệ Báo giá hoặc Đơn bán hàng, chọn khách hàng, chọn danh mục vang và số lượng. Hệ thống tự động tính giá niêm yết theo Bảng giá được gán cho kênh khách hàng.',
                erpLink: {
                    path: '/dashboard/quotations',
                    label: 'Mở Màn Hình Báo Giá'
                },
                deliverables: ['Bản dự thảo Báo giá (Draft Quotation)'],
                cautions: [
                    'Kiểm tra tồn kho khả dụng (Available Stock) trước khi cam kết thời gian giao với khách.',
                    'Không cam kết miệng mức chiết khấu ngoài chính sách khi chưa có phê duyệt.'
                ]
            },
            {
                stepNumber: 2,
                title: 'Trình Duyệt Chiết Khấu (Nếu Vượt Hạn Mức)',
                role: 'Trưởng Phòng KD / CEO',
                action: 'Nếu mức chiết khấu đề xuất vượt khung chuẩn (> 15% cho vang nhập khẩu hoặc > 10% cho dòng Grand Cru), hệ thống tự động khóa trạng thái duyệt. Sales nhập lý do cạnh tranh/số lượng lớn và nhấn "Gửi Duyệt".',
                erpLink: {
                    path: '/dashboard/margin',
                    label: 'Kiểm Tra Biên Lợi Nhuận'
                },
                deliverables: ['Xác nhận phê duyệt điện tử trên hệ thống'],
                cautions: [
                    'Đơn hàng có chiết khấu cao mà biên lợi nhuận gộp (Gross Margin) dưới 20% bắt buộc phải có ý kiến phê duyệt của CEO.',
                    'Quy trình duyệt tự động ghi nhật ký vào Audit Log, không thể hoàn tác giả mạo.'
                ]
            },
            {
                stepNumber: 3,
                title: 'Kiểm Tra Tín Dụng & Khóa Nợ Tự Động (Credit Hold)',
                role: 'Kế toán Công Nợ / Hệ thống',
                action: 'Hệ thống tự động quét số dư nợ quá hạn và hạn mức tín dụng (Credit Limit). Nếu khách có hóa đơn quá hạn trên 30 ngày hoặc vượt hạn mức, đơn hàng rơi vào trạng thái "Credit Hold".',
                erpLink: {
                    path: '/dashboard/customers',
                    label: 'Xem Hạn Mức Tín Dụng Khách Hàng'
                },
                deliverables: ['Trạng thái kiểm tra tín dụng hợp lệ'],
                cautions: [
                    'Chỉ Kế toán trưởng hoặc Giám đốc mới có thẩm quyền Mở khóa (Override Credit Hold) với cam kết lịch thanh toán cụ thể.'
                ]
            },
            {
                stepNumber: 4,
                title: 'Xác Nhận Đơn Hàng (SO) & Chuyển Kho',
                role: 'Nhân viên Sales / Trưởng nhóm',
                action: 'Sau khi khách hàng chấp thuận báo giá và vượt qua kiểm tra tín dụng, Sales nhấn "Xác Nhận Đơn Hàng" (Confirm SO). Tồn kho sẽ chuyển từ "Khả dụng" sang "Đã giữ chỗ" (Allocated/Reserved) và tự động sinh thông báo cho Kho vận.',
                erpLink: {
                    path: '/dashboard/sales',
                    label: 'Mở Danh Sách Đơn Bán Hàng'
                },
                deliverables: ['Đơn Bán Hàng chính thức (Confirmed SO)', 'Thông báo lệnh xuất kho tự động'],
                cautions: [
                    'Khi SO đã xác nhận, không tự ý hủy đơn nếu Kho đã bắt đầu soạn hàng (Pick list).'
                ]
            }
        ],
        checklist: [
            { id: 'c1', text: 'Đã kiểm tra đúng bảng giá theo phân loại khách hàng (Horeca / Đại lý / Bán lẻ)', critical: true },
            { id: 'c2', text: 'Đã có phê duyệt nếu chiết khấu vượt mức phân quyền cho phép', critical: true },
            { id: 'c3', text: 'Khách hàng không bị khóa nợ quá hạn (No Credit Hold)', critical: true },
            { id: 'c4', text: 'Địa chỉ giao hàng và thông tin người nhận rõ ràng, kèm số điện thoại liên hệ' },
            { id: 'c5', text: 'Đã chọn hình thức thanh toán (Công nợ 30 ngày / Chuyển khoản trước / Thu COD khi giao)' }
        ],
        requiredDocs: [
            'Báo giá có xác nhận đồng ý của khách hàng (Email / Zalo / Chữ ký số)',
            'Hợp đồng nguyên tắc hoặc Đơn đặt hàng (Purchase Order từ phía khách)'
        ],
        faqs: [
            {
                q: 'Khách hàng nợ quá hạn nhưng cần gấp đơn hàng thì xử lý như thế nào?',
                a: 'Sales cần liên hệ Kế toán công nợ để khách thanh toán dứt điểm khoản nợ cũ, hoặc trình CEO phê duyệt văn bản mở khóa đặc biệt kèm cam kết thanh toán trong vòng 48h.'
            },
            {
                q: 'Làm sao để biết lô rượu muốn bán còn bao nhiêu chai khả dụng trong kho?',
                a: 'Tại màn hình Đơn Bán Hàng hoặc Báo Giá, khi gõ tên sản phẩm, hệ thống hiển thị đồng thời Tồn thực tế (On-hand) và Tồn khả dụng (Available). Bạn cũng có thể mở trực tiếp menu "Kho Hàng" để xem chi tiết từng vị trí lô.'
            }
        ]
    },
    {
        id: 'sop-wms-01',
        code: 'SOP-WMS-01',
        title: 'Quy Trình Nhập Kho & Dán Tem Rượu Nhập Khẩu',
        titleEn: 'Import Wine Goods Receipt & Stamping SOP',
        category: 'warehouse',
        department: 'Phòng Kho Vận (Warehouse)',
        departmentEn: 'Warehouse Department',
        summary: 'Quy định chuẩn các bước tiếp nhận rượu vang nhập khẩu từ cảng/nhà máy về kho, kiểm tra chất lượng, cách ly dán tem hải quan và nhập kho chính thức.',
        purpose: 'Đảm bảo 100% chai rượu lưu kho đều nguyên vẹn, bảo quản đúng nhiệt độ, có đầy đủ tem nhãn phụ tiếng Việt và tem rượu nhập khẩu theo quy định pháp luật.',
        scope: 'Áp dụng cho Thủ kho, Nhân viên bốc xếp - đóng gói, Kế toán kho và Nhân viên dán tem.',
        estimatedDuration: '2 - 4 giờ / Lô hàng',
        effectiveDate: '01/01/2026',
        version: 'v1.8',
        raci: {
            responsible: ['Thủ kho chính', 'Tổ dán tem'],
            accountable: ['Trưởng bộ phận Kho vận & Logistics'],
            consulted: ['Nhân viên Mua hàng/Khai báo hải quan', 'Kế toán kho'],
            informed: ['Phòng Kinh doanh (để biết hàng đã sẵn sàng bán)']
        },
        flowSteps: [
            {
                stepNumber: 1,
                title: 'Tiếp Nhận Hàng & Kiểm Tra Tình Trạng Vận Chuyển',
                role: 'Thủ kho & Đội giao nhận',
                action: 'Khi xe cont hoặc xe tải lạnh đến kho, kiểm tra số niêm chì (Seal), nhiệt độ thùng xe (nhiệt độ tiêu chuẩn rượu vang 14°C - 18°C), chụp ảnh chứng minh tình trạng niêm phong còn nguyên vẹn.',
                deliverables: ['Biên bản bàn giao vận chuyển', 'Ảnh chụp nhiệt độ & Seal'],
                cautions: [
                    'Nếu phát hiện xe cont bị tắt máy lạnh kéo dài hoặc thùng hàng bị móp méo, vỡ chai, lập tức lập Biên bản bất thường có chữ ký tài xế trước khi dỡ hàng.'
                ]
            },
            {
                stepNumber: 2,
                title: 'Kiểm Đếm Số Lượng & Phân Vào Khu Cách Ly (Quarantine)',
                role: 'Thủ kho & Kế toán kho',
                action: 'Dỡ hàng cẩn thận vào "Khu Vực Cách Ly Nhập Khẩu" (Quarantine Zone). Kiểm tra đối chiếu số lượng thùng, số chai từng niên vụ (Vintage), số lô (Lot/Batch) so với Tờ khai hải quan & Packing List.',
                erpLink: {
                    path: '/dashboard/warehouse',
                    label: 'Tạo Phiếu Nhập Kho (Goods Receipt)'
                },
                deliverables: ['Phiếu kiểm đếm thực tế (Tally Sheet)'],
                cautions: [
                    'Tuyệt đối không xếp chung hàng chưa dán tem vào khu vực hàng sẵn sàng xuất bán.'
                ]
            },
            {
                stepNumber: 3,
                title: 'Dán Tem Rượu Nhập Khẩu & Nhãn Phụ Tiếng Việt',
                role: 'Tổ dán tem & Kế toán kho',
                action: 'Nhận số lượng tem rượu theo định mức từ Kế toán quản lý tem. Dán tem rượu vắt qua cổ chai/nút chai và nhãn phụ tiếng Việt vào mặt sau thân chai theo chuẩn Nghị định quản lý rượu.',
                erpLink: {
                    path: '/dashboard/stamps',
                    label: 'Quản Lý Cấp Phát Tem'
                },
                deliverables: ['Báo cáo đối soát sử dụng tem (Tem dùng, Tem hỏng, Tem thừa)'],
                cautions: [
                    'Tem bị rách hỏng trong quá trình dán phải lưu giữ xác tem để làm thủ tục hủy tem với cơ quan Thuế/Hải quan.'
                ]
            },
            {
                stepNumber: 4,
                title: 'Xác Nhận Nhập Kho Chính Thức (Complete GR) & Lưu Vị Trí',
                role: 'Thủ kho chính',
                action: 'Sau khi dán tem 100%, thủ kho kiểm tra nghiệm thu lần cuối, bấm "Hoàn Tất Nhập Kho" (Approve GR) trên ERP và di chuyển pallet vào đúng vị trí kệ (Bin/Location) trong kho mát theo nguyên tắc FIFO.',
                erpLink: {
                    path: '/dashboard/warehouse',
                    label: 'Xem Danh Sách Phiếu Nhập'
                },
                deliverables: ['Phiếu Nhập Kho hoàn tất (Status: COMPLETED)', 'Tồn kho khả dụng cập nhật'],
                cautions: [
                    'Sau khi hoàn tất, hệ thống tự động ghi nhận số lượng vào tồn kho bán hàng.'
                ]
            }
        ],
        checklist: [
            { id: 'w1', text: 'Nhiệt độ thùng xe lạnh đạt chuẩn 14°C - 18°C khi mở cửa cont', critical: true },
            { id: 'w2', text: 'Số lượng chai thực tế khớp với Packing List & Tờ khai hải quan', critical: true },
            { id: 'w3', text: 'Đã dán 100% tem rượu nhập khẩu và nhãn phụ tiếng Việt hợp quy', critical: true },
            { id: 'w4', text: 'Số tem hỏng (nếu có) đã được lập biên bản và bàn giao xác tem' },
            { id: 'w5', text: 'Đã gán đúng mã vị trí kệ kho (Bin/Rack location) trên hệ thống' }
        ],
        requiredDocs: [
            'Hóa đơn thương mại (Commercial Invoice) & Packing List',
            'Tờ khai hải quan thông quan',
            'Biên bản bàn giao cấp phát tem rượu'
        ],
        faqs: [
            {
                q: 'Nếu phát hiện có chai bị rò rỉ hoặc vỡ trong thùng thì xử lý thế nào?',
                a: 'Thủ kho tách riêng chai vỡ ra khu vực hàng chờ thanh lý (Quarantine Defect), chụp ảnh hiện trạng, nhập số lượng vỡ vào mục "Hàng hư hỏng" trên Phiếu Nhập Kho để kế toán đối trừ công nợ bảo hiểm/vận tải.'
            }
        ]
    },
    {
        id: 'sop-wms-02',
        code: 'SOP-WMS-02',
        title: 'Quy Trình Xuất Kho Giao Hàng & Thu Tiền COD',
        titleEn: 'Warehouse Delivery & COD Collection Procedure',
        category: 'warehouse',
        department: 'Phòng Kho Vận & Đội Xe (Logistics)',
        departmentEn: 'Logistics & Delivery',
        summary: 'Hướng dẫn các bước từ khi nhận Đơn hàng đã duyệt (SO), lập Lệnh xuất kho (DO), nhặt hàng FIFO, đóng gói chống sốc rượu, giao cho khách và đối soát tiền COD.',
        purpose: 'Đảm bảo giao đúng loại vang, đúng niên vụ, đúng hạn, không vỡ hỏng trong quá trình vận chuyển và thu hồi tiền mặt/chuyển khoản đầy đủ.',
        scope: 'Áp dụng cho Thủ kho, Nhân viên đóng gói, Tài xế/Nhân viên giao nhận và Kế toán thu nợ.',
        estimatedDuration: '45 phút soạn hàng + Thời gian vận chuyển',
        effectiveDate: '01/01/2026',
        version: 'v2.0',
        raci: {
            responsible: ['Nhân viên kho soạn hàng', 'Nhân viên giao hàng / Đội xe'],
            accountable: ['Thủ kho', 'Điều phối giao vận (Dispatcher)'],
            consulted: ['Nhân viên Sales phụ trách', 'Khách hàng nhận hàng'],
            informed: ['Kế toán công nợ (AR)']
        },
        flowSteps: [
            {
                stepNumber: 1,
                title: 'Tiếp Nhận Lệnh Bán Hàng & Lập Lệnh Xuất Kho (DO)',
                role: 'Thủ kho',
                action: 'Kho nhận thông báo Đơn hàng đã xác nhận từ Sales. Thủ kho kiểm tra thứ tự ưu tiên giao, bấm "Tạo Lệnh Xuất Kho" (Create DO) và in Danh sách nhặt hàng (Pick List).',
                erpLink: {
                    path: '/dashboard/warehouse',
                    label: 'Mở Danh Sách Lệnh Xuất (DO)'
                },
                deliverables: ['Lệnh xuất kho (Delivery Order)', 'Phiếu nhặt hàng (Pick List)'],
                cautions: [
                    'Kiểm tra kỹ ghi chú đặc biệt của khách hàng (ví dụ: giao giờ hành chính, gọi trước 30 phút, cần túi quà tặng đi kèm).'
                ]
            },
            {
                stepNumber: 2,
                title: 'Soạn Hàng Theo Nguyên Tắc FIFO & Đóng Gói Chuyên Dụng',
                role: 'Nhân viên kho',
                action: 'Lấy đúng vị trí kệ theo nguyên tắc Nhập trước - Xuất trước (FIFO). Kiểm tra bằng mắt thường tình trạng nắp màng co, tem rượu không rách. Đóng gói vào thùng carton 6 chai có vách ngăn chống sốc hoặc màng bóng khí.',
                deliverables: ['Kiện hàng hoàn chỉnh có dán mã vận đơn / Phiếu giao hàng'],
                cautions: [
                    'Tuyệt đối không xếp chồng thùng rượu vang quá 4 lớp để tránh đè vỡ đáy chai.'
                ]
            },
            {
                stepNumber: 3,
                title: 'Bàn Giao Vận Chuyển & Giao Hàng Cho Khách',
                role: 'Đội xe / Nhân viên giao nhận',
                action: 'Nhân viên giao hàng kiểm tra số kiện, nhận Phiếu giao hàng và Hóa đơn VAT (nếu có). Đến địa chỉ khách hàng, đồng kiểm cùng khách hàng và thu tiền COD (nếu đơn hàng yêu cầu thu tiền mặt hoặc chuyển khoản QR).',
                erpLink: {
                    path: '/dashboard/delivery',
                    label: 'Cập Nhật Trạng Thái Giao Hàng'
                },
                deliverables: ['Phiếu giao hàng có ký nhận của khách', 'Biên nhận thu tiền COD'],
                cautions: [
                    'Yêu cầu khách hàng kiểm tra nguyên vẹn chai vang trước khi ký nhận, tránh tranh chấp sau khi tài xế rời đi.'
                ]
            },
            {
                stepNumber: 4,
                title: 'Đối Soát COD & Cấn Trừ Công Nợ Tự Động (COD → AR Sync)',
                role: 'Kế toán & Thủ quỹ',
                action: 'Sau chuyến đi, nhân viên giao nhận bàn giao tiền mặt hoặc mã giao dịch chuyển khoản cho Kế toán. Kế toán xác nhận trên hệ thống, ERP tự động tạo bút toán thu tiền (AR Payment) và đóng trạng thái hóa đơn thành PAID.',
                erpLink: {
                    path: '/dashboard/finance',
                    label: 'Kiểm Tra Đối Soát Công Nợ'
                },
                deliverables: ['Phiếu thu tiền cấn trừ hóa đơn thành công'],
                cautions: [
                    'Toàn bộ tiền COD thu trong ngày bắt buộc phải bàn giao cho thủ quỹ hoặc nộp vào tài khoản công ty trước 17h30 cùng ngày.'
                ]
            }
        ],
        checklist: [
            { id: 'd1', text: 'Xuất đúng niên vụ (Vintage) và lô hàng theo nguyên tắc FIFO', critical: true },
            { id: 'd2', text: 'Chai vang còn nguyên tem nhập khẩu, không nứt mẻ hay rò rỉ nút bấc', critical: true },
            { id: 'd3', text: 'Đóng thùng có vách ngăn chống va đập đạt chuẩn vận chuyển rượu', critical: true },
            { id: 'd4', text: 'Khách hàng đã ký họ tên rõ ràng vào Biên bản giao nhận hàng' },
            { id: 'd5', text: 'Đã thu đúng đủ số tiền COD và nộp đối soát về phòng kế toán trong ngày', critical: true }
        ],
        requiredDocs: [
            'Lệnh xuất kho & Phiếu nhặt hàng (DO & Pick List)',
            'Phiếu giao hàng kiêm Biên bản bàn giao 02 liên (01 liên gửi khách, 01 liên lưu kho)',
            'Hóa đơn giá trị gia tăng điện tử (VAT e-Invoice)'
        ],
        faqs: [
            {
                q: 'Khách hàng từ chối nhận hàng do thay đổi ý định hoặc chai bị nứt vỡ thì làm sao?',
                a: 'Tài xế lập biên bản trả hàng ngay tại chỗ ghi rõ lý do, chụp ảnh nếu chai bị hỏng. Khi về kho, thủ kho lập phiếu "Trả Hàng" (Return & CN) để nhập lại kho cách ly hoặc yêu cầu đền bù.'
            }
        ]
    },
    {
        id: 'sop-prc-01',
        code: 'SOP-PRC-01',
        title: 'Quy Trình Nhập Khẩu Rượu & Mua Hàng Quốc Tế',
        titleEn: 'International Procurement & Landed Costing Procedure',
        category: 'procurement',
        department: 'Phòng Mua Hàng & Xuất Nhập Khẩu',
        departmentEn: 'Procurement & Import Dept',
        summary: 'Các bước từ lập kế hoạch mua hàng, làm việc với Châteaux/Nhà làm vang nước ngoài, tính toán thuế nhập khẩu, thuế tiêu thụ đặc biệt (TTĐB) và phân bổ giá vốn thực tế.',
        purpose: 'Đảm bảo chủ động nguồn hàng phân phối, chi phí giá vốn (COGS) chuẩn xác và đáp ứng đầy đủ điều kiện pháp lý nhập khẩu rượu.',
        scope: 'Áp dụng cho Chuyên viên mua hàng quốc tế, Giám đốc điều hành, Kế toán giá vốn.',
        estimatedDuration: '4 - 8 tuần (từ lúc đặt hàng đến khi hàng cập cảng)',
        effectiveDate: '01/01/2026',
        version: 'v1.5',
        raci: {
            responsible: ['Chuyên viên mua hàng quốc tế (Purchaser)'],
            accountable: ['Giám đốc điều hành (CEO)'],
            consulted: ['Kế toán giá vốn (CST)', 'Đại lý Logistics quốc tế / Forwarder'],
            informed: ['Phòng Kinh doanh (để dự báo ngày hàng về)']
        },
        flowSteps: [
            {
                stepNumber: 1,
                title: 'Lập Kế Hoạch & Tạo Đơn Mua Hàng (PO)',
                role: 'Chuyên viên mua hàng',
                action: 'Dựa trên báo cáo dự báo tiêu thụ và tồn kho tối thiểu, tạo Đơn mua hàng (Purchase Order) trên hệ thống với thông tin Nhà sản xuất nước ngoài, danh mục sản phẩm, đồng tiền ngoại tệ (EUR, USD) và điều kiện giao hàng (Incoterms CIF/FOB).',
                erpLink: {
                    path: '/dashboard/procurement',
                    label: 'Mở Danh Sách Đơn Mua Hàng (PO)'
                },
                deliverables: ['Đơn mua hàng dự thảo (Draft PO)', 'Proforma Invoice từ hãng vang'],
                cautions: [
                    'Kiểm tra chứng thư vùng trồng và điều kiện niên vụ vang để tránh tình trạng hết hàng đột xuất.'
                ]
            },
            {
                stepNumber: 2,
                title: 'Trình Duyệt PO & Ký Hợp Đồng Ngoại Thương',
                role: 'Giám Đốc Điều Hành (CEO)',
                action: 'Trình duyệt PO qua hệ thống Approval Workflow. Sau khi CEO phê duyệt, tiến hành ký kết Hợp đồng ngoại thương (Sales Contract), mở thanh toán quốc tế (L/C hoặc T/T đặt cọc).',
                erpLink: {
                    path: '/dashboard/contracts',
                    label: 'Quản Lý Hợp Đồng'
                },
                deliverables: ['Hợp đồng ngoại thương đã ký kết 2 bên', 'Điện chuyển tiền đặt cọc (Swift MT103)'],
                cautions: [
                    'Phải ràng buộc điều kiện nhiệt độ vận chuyển cont lạnh (Reefer Container) 15°C trong suốt hải trình.'
                ]
            },
            {
                stepNumber: 3,
                title: 'Khai Báo Hải Quan & Tính Thuế Tự Động (Tax Engine)',
                role: 'Chuyên viên XNK & Kế toán',
                action: 'Khi tàu cập cảng, nhận bộ chứng từ gốc (B/L, C/O form EUR.1/AK, Phân tích kiểm nghiệm chất lượng rượu). Nhập mã HS Code vào Tax Engine để tự động tính Thuế Nhập Khẩu, Thuế TTĐB (theo độ cồn) và Thuế VAT.',
                erpLink: {
                    path: '/dashboard/costing',
                    label: 'Mở Công Cụ Tính Giá Vốn (CST)'
                },
                deliverables: ['Tờ khai hải quan thông quan', 'Giấy xác nhận công bố vệ sinh ATTP'],
                cautions: [
                    'Kiểm tra tính hợp lệ của C/O (Chứng nhận xuất xứ) để áp mức thuế suất ưu đãi đặc biệt.'
                ]
            },
            {
                stepNumber: 4,
                title: 'Phân Bổ Chi Phí & Tính Giá Vốn Thực Tế (Landed Cost)',
                role: 'Kế toán giá vốn',
                action: 'Tập hợp toàn bộ chi phí phụ trợ (cước tàu biển, bảo hiểm hàng hải, phí lưu kho bãi Demurrage, phí kiểm nghiệm) phân bổ vào từng mã chai theo giá trị hoặc số lượng, xác định giá vốn cuối cùng để kinh doanh định giá bán.',
                erpLink: {
                    path: '/dashboard/costing',
                    label: 'Xem Phân Bổ Giá Vốn Lô Hàng'
                },
                deliverables: ['Bảng tính Landed Cost chi tiết cho từng chai vang'],
                cautions: [
                    'Giá vốn thực tế là căn cứ để tính ngưỡng biên lợi nhuận (Margin), không được bỏ sót các chi phí bến bãi phát sinh.'
                ]
            }
        ],
        checklist: [
            { id: 'p1', text: 'Đơn PO có xác nhận giá và điều kiện Incoterms rõ ràng với Nhà sản xuất', critical: true },
            { id: 'p2', text: 'Hợp đồng vận chuyển quy định rõ nhiệt độ cont lạnh trong suốt hành trình', critical: true },
            { id: 'p3', text: 'Bộ chứng từ gốc đầy đủ (B/L, Invoice, Packing List, C/O ưu đãi thuế)', critical: true },
            { id: 'p4', text: 'Đã hoàn thành kiểm nghiệm vệ sinh an toàn thực phẩm trước khi thông quan', critical: true },
            { id: 'p5', text: 'Đã phân bổ đủ các chi phí phụ trợ vào giá vốn lô hàng' }
        ],
        requiredDocs: [
            'Hợp đồng thương mại quốc tế (Sales Contract)',
            'Hóa đơn thương mại (Commercial Invoice) & Chi tiết đóng gói (Packing List)',
            'Vận đơn đường biển gốc (Bill of Lading)',
            'Chứng nhận xuất xứ hàng hóa (Certificate of Origin - C/O)',
            'Giấy tiếp nhận bản công bố hợp quy / ATTP'
        ],
        faqs: [
            {
                q: 'Tại sao thuế TTĐB lại chiếm tỷ trọng lớn trong giá thành rượu vang?',
                a: 'Theo Luật Thuế Tiêu Thụ Đặc Biệt của Việt Nam, rượu vang chịu mức thuế suất TTĐB từ 35% đến 65% tùy theo nồng độ cồn và được tính trên giá nhập khẩu đã cộng thuế nhập khẩu. Vì vậy việc tính đúng phân loại độ cồn là tối quan trọng.'
            }
        ]
    },
    {
        id: 'sop-fin-01',
        code: 'SOP-FIN-01',
        title: 'Quy Trình Lập & Duyệt Đề Nghị Thanh Toán',
        titleEn: 'Payment Request & Multi-Level Approval Procedure',
        category: 'finance',
        department: 'Phòng Tài Chính - Kế Toán',
        departmentEn: 'Finance & Accounting',
        summary: 'Quy trình chuẩn từ việc khởi tạo yêu cầu thanh toán chi phí/nhà cung cấp, tải chứng từ lên R2 Scan Viewer, luồng phê duyệt đa cấp đến giải ngân và cập nhật sổ sách.',
        purpose: 'Kiểm soát chặt chẽ dòng tiền ra, minh bạch chứng từ kiểm toán, ngăn ngừa thanh toán trùng lặp hoặc chi sai ngân sách.',
        scope: 'Áp dụng cho toàn thể cán bộ nhân viên công ty khi phát sinh nhu cầu chi tiền cho hoạt động kinh doanh.',
        estimatedDuration: '1 - 3 ngày làm việc tùy hạn mức duyệt',
        effectiveDate: '01/01/2026',
        version: 'v3.0',
        raci: {
            responsible: ['Nhân viên đề nghị thanh toán'],
            accountable: ['Trưởng bộ phận đề nghị', 'Kế toán trưởng', 'CEO / Ban Giám Đốc'],
            consulted: ['Kế toán thanh toán', 'Bộ phận Mua hàng (đối chiếu PO/Hợp đồng)'],
            informed: ['Thủ quỹ (chuẩn bị dòng tiền)']
        },
        flowSteps: [
            {
                stepNumber: 1,
                title: 'Tạo Phiếu Đề Nghị & Tải Chứng Từ Lên Hệ Thống',
                role: 'Người Đề Nghị (Mọi Nhân Viên)',
                action: 'Truy cập phân hệ Đề Nghị Thanh Toán, chọn lý do chi (Thanh toán NCC, Tạm ứng công tác, Chi phí marketing, Chi phí văn phòng), nhập số tiền và số tài khoản thụ hưởng. Chụp/Quét hóa đơn đỏ VAT và chứng từ đính kèm tải lên R2 Scan Viewer.',
                erpLink: {
                    path: '/dashboard/payment-requests',
                    label: 'Tạo Phiếu Đề Nghị Thanh Toán'
                },
                deliverables: ['Phiếu Đề Nghị Thanh Toán điện tử kèm bản scan chứng từ gốc'],
                cautions: [
                    'Các khoản chi trên 20 triệu VNĐ bắt buộc phải có hóa đơn GTGT điện tử hợp pháp và thanh toán qua tài khoản ngân hàng của đơn vị bán.'
                ]
            },
            {
                stepNumber: 2,
                title: 'Thẩm Định Phê Duyệt Cấp Trưởng Phòng (HOD)',
                role: 'Trưởng Bộ Phận (Head of Dept)',
                action: 'Trưởng bộ phận nhận thông báo trên ERP, mở phiếu kiểm tra tính cần thiết của khoản chi so với kế hoạch công việc đã giao. Nếu đồng ý, bấm "Duyệt Bước 1" (HOD Approval).',
                deliverables: ['Phê duyệt điện tử cấp 1'],
                cautions: [
                    'Trưởng bộ phận chịu trách nhiệm liên đới về tính xác thực của nhu cầu chi phát sinh.'
                ]
            },
            {
                stepNumber: 3,
                title: 'Kiểm Tra Ngân Sách & Hợp Lệ Chứng Từ',
                role: 'Kế toán trưởng (Chief Accountant)',
                action: 'Kế toán trưởng kiểm tra tính hợp pháp của hóa đơn (tra cứu trên trang Tổng cục Thuế), đối chiếu với Hạn mức ngân sách còn lại của phòng ban và điều khoản hợp đồng/PO.',
                deliverables: ['Xác nhận kiểm tra ngân sách hợp lệ'],
                cautions: [
                    'Khoản chi vượt ngân sách đã duyệt đầu năm phải có Tờ trình giải trình bổ sung.'
                ]
            },
            {
                stepNumber: 4,
                title: 'Phê Duyệt Ban Giám Đốc & Thực Hiện Lệnh Chi',
                role: 'CEO & Kế toán thanh toán',
                action: 'CEO duyệt điện tử trên hệ thống đối với các khoản chi trên hạn mức phân quyền. Kế toán thanh toán tạo lệnh chi trên Internet Banking, thực hiện chuyển tiền và nhập Mã giao dịch (Bank Ref) vào hệ thống để hoàn tất.',
                erpLink: {
                    path: '/dashboard/payment-requests',
                    label: 'Theo Dõi Trạng Thái Giải Ngân'
                },
                deliverables: ['Ủy nhiệm chi ngân hàng (Bank Slip)', 'Trạng thái chuyển sang PAID'],
                cautions: [
                    'Không bao giờ giải ngân khi chưa có đủ chữ ký phê duyệt hợp lệ trên hệ thống.'
                ]
            }
        ],
        checklist: [
            { id: 'f1', text: 'Có đầy đủ hóa đơn GTGT điện tử (XML + PDF) và biên bản bàn giao dịch vụ/hàng hóa', critical: true },
            { id: 'f2', text: 'Thông tin tài khoản ngân hàng thụ hưởng trùng khớp với thông tin trên hóa đơn/hợp đồng', critical: true },
            { id: 'f3', text: 'Khoản chi nằm trong hạn mức ngân sách được duyệt của phòng ban', critical: true },
            { id: 'f4', text: 'Đã có phê duyệt đầy đủ của Trưởng bộ phận và Kế toán trưởng', critical: true },
            { id: 'f5', text: 'Đã lưu mã tham chiếu giao dịch ngân hàng vào hệ thống sau khi chuyển tiền' }
        ],
        requiredDocs: [
            'Hóa đơn giá trị gia tăng điện tử hợp lệ',
            'Hợp đồng mua bán / Đơn đặt hàng tương ứng',
            'Biên bản nghiệm thu công việc hoặc Biên bản bàn giao hàng hóa',
            'Giấy đề nghị tạm ứng / Bảng kê chi tiết chi phí (đối với chi phí công tác)'
        ],
        faqs: [
            {
                q: 'Thời gian từ lúc nộp đề nghị thanh toán đến khi nhận được tiền là bao lâu?',
                a: 'Lịch thanh toán định kỳ của công ty vào Thứ Ba và Thứ Sáu hàng tuần. Các hồ sơ hoàn thiện trước 12h00 của ngày liền trước sẽ được giải ngân theo đúng lịch.'
            },
            {
                q: 'Nếu mất hóa đơn giấy thì có được thanh toán không?',
                a: 'Hiện nay công ty áp dụng 100% hóa đơn điện tử. Nhân viên chỉ cần cung cấp file XML hoặc link tra cứu hóa đơn điện tử gốc từ nhà cung cấp.'
            }
        ]
    },
    {
        id: 'sop-hrm-01',
        code: 'SOP-HRM-01',
        title: 'Quy Trình Tiếp Nhận Nhân Sự Mới & Phân Quyền ERP',
        titleEn: 'Employee Onboarding & ERP Access Management',
        category: 'hr',
        department: 'Phòng Hành Chính - Nhân Sự (HR)',
        departmentEn: 'HR & Admin Dept',
        summary: 'Quy định các bước từ hoàn thiện hồ sơ nhân sự, ký kết hợp đồng lao động, cấp phát trang thiết bị làm việc đến việc tạo tài khoản và phân quyền truy cập Wine ERP.',
        purpose: 'Giúp nhân sự mới hòa nhập nhanh chóng với công việc mà không mất nhiều thời gian đào tạo, đồng thời đảm bảo bảo mật dữ liệu doanh nghiệp thông qua phân quyền đúng vai trò.',
        scope: 'Áp dụng cho Bộ phận HR, Quản trị hệ thống (System Admin) và Trưởng bộ phận tiếp nhận nhân sự.',
        estimatedDuration: '03 ngày làm việc đầu tiên',
        effectiveDate: '01/01/2026',
        version: 'v1.2',
        raci: {
            responsible: ['Chuyên viên tuyển dụng & Onboarding (HR)'],
            accountable: ['Trưởng phòng Nhân sự', 'Quản trị viên hệ thống (IT Admin)'],
            consulted: ['Trưởng bộ phận trực tiếp của nhân sự mới'],
            informed: ['Phòng Kế toán (đăng ký MST cá nhân & BHXH)']
        },
        flowSteps: [
            {
                stepNumber: 1,
                title: 'Hoàn Thiện Hồ Sơ Nhân Sự & Ký Hợp Đồng Thử Việc',
                role: 'Chuyên viên HR',
                action: 'Thu thập CCCD gắn chip, sơ yếu lý lịch, bằng cấp chứng chỉ, giấy khám sức khỏe. Nhập đầy đủ thông tin vào phân hệ Nhân sự (`/dashboard/hr`) và in Hợp đồng thử việc.',
                erpLink: {
                    path: '/dashboard/hr',
                    label: 'Mở Hồ Sơ Nhân Sự (HR Module)'
                },
                deliverables: ['Hồ sơ nhân sự điện tử trên ERP', 'Hợp đồng lao động/Thử việc đã ký'],
                cautions: [
                    'Kiểm tra kỹ hạn CCCD và số tài khoản ngân hàng nhận lương để tránh nhầm lẫn khi chi trả lương tháng.'
                ]
            },
            {
                stepNumber: 2,
                title: 'Cấp Tài Khoản Email & Quyền Truy Cập ERP Theo Role',
                role: 'Quản trị viên hệ thống (Admin)',
                action: 'Tạo tài khoản người dùng ERP liên kết với mã nhân viên. Gán đúng Role được phê duyệt (Ví dụ: SALES_EXECUTIVE, WAREHOUSE_STAFF, ACCOUNTANT, HOD). Hệ thống tự động giới hạn quyền theo Role-Based Access Control (RBAC).',
                erpLink: {
                    path: '/dashboard/settings',
                    label: 'Cài Đặt Người Dùng & Phân Quyền'
                },
                deliverables: ['Tài khoản ERP đã kích hoạt', 'Bảng phân quyền chi tiết'],
                cautions: [
                    'Tuyệt đối không cấp quyền SYS:ADMIN hoặc quyền sửa Bảng giá/Margin cho nhân viên chưa qua thời gian thử việc.'
                ]
            },
            {
                stepNumber: 3,
                title: 'Hướng Dẫn Tự Học Quy Trình Qua SOP Knowledge Hub',
                role: 'Trưởng bộ phận & HR',
                action: 'Bàn giao tài khoản, hướng dẫn nhân viên mới truy cập trực tiếp mục "Quy Trình Chuẩn (SOP)" trên thanh điều hướng ERP. Nhân viên đọc kỹ các quy trình thuộc bộ phận mình và hoàn thành các checklist tự kiểm tra.',
                erpLink: {
                    path: '/dashboard/sop',
                    label: 'Truy Cập SOP Knowledge Hub'
                },
                deliverables: ['Nhân viên nắm rõ luồng công việc và các lỗi cấm kỵ'],
                cautions: [
                    'Nhân sự mới phải đọc kỹ các điểm cảnh báo (Cautions) trong từng quy trình trước khi thao tác đơn hàng thật trên hệ thống.'
                ]
            }
        ],
        checklist: [
            { id: 'h1', text: 'Đã nộp đủ bản sao công chứng CCCD và hồ sơ nhân sự theo quy định', critical: true },
            { id: 'h2', text: 'Đã ký Hợp đồng thử việc / Hợp đồng lao động hợp lệ', critical: true },
            { id: 'h3', text: 'Đã tạo tài khoản ERP và gán đúng Role tương ứng với vị trí công tác', critical: true },
            { id: 'h4', text: 'Nhân viên đã đăng nhập thành công và đọc các SOP chuyên môn liên quan' }
        ],
        requiredDocs: [
            'Bản sao Căn cước công dân gắn chip',
            'Sơ yếu lý lịch có xác nhận địa phương hoặc CV ứng tuyển',
            'Giấy khám sức khỏe có thời hạn dưới 06 tháng',
            'Phiếu đề xuất cấp tài khoản và quyền truy cập phần mềm'
        ],
        faqs: [
            {
                q: 'Khi nhân viên thay đổi phòng ban hoặc kiêm nhiệm thì cập nhật quyền thế nào?',
                a: 'Trưởng phòng ban mới gửi phiếu đề nghị điều chỉnh quyền qua hệ thống Tờ Trình Đề Xuất (`/dashboard/proposals`). Sau khi được duyệt, Admin sẽ điều chỉnh quyền trong phần Cài đặt người dùng.'
            }
        ]
    }
]
