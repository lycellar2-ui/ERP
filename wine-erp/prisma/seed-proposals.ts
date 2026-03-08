/**
 * Seed Proposals — Realistic Tờ Trình data across all workflow states
 * Run: npx tsx prisma/seed-proposals.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// Supabase pooler uses self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 3,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('📋 Seeding Proposals (Tờ Trình)...\n')

    // ─── 1. Resolve Users ─────────────────────────────
    console.log('  → Finding existing users...')
    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true },
        take: 20,
    })
    if (users.length === 0) {
        console.error('❌ No users found. Please seed users first (seed-rbac.ts)')
        return
    }

    // Map users by likely roles based on name/email
    const ceo = users.find(u => u.email?.includes('ceo') || u.name?.toLowerCase().includes('ceo') || u.email?.includes('admin')) ?? users[0]
    const accountant = users.find(u => u.email?.includes('ketoan') || u.name?.includes('Kế Toán') || u.email?.includes('accountant')) ?? users[1] ?? users[0]
    const purchasingMgr = users.find(u => u.email?.includes('mua') || u.name?.includes('Thu Mua') || u.email?.includes('purchase')) ?? users[2] ?? users[0]
    const salesMgr = users.find(u => u.email?.includes('sales') || u.name?.includes('Sales')) ?? users[3] ?? users[0]
    const warehouseMgr = users.find(u => u.email?.includes('kho') || u.name?.includes('Kho')) ?? users[4] ?? users[0]

    console.log(`    CEO: ${ceo.name ?? ceo.email}`)
    console.log(`    KT:  ${accountant.name ?? accountant.email}`)
    console.log(`    PM:  ${purchasingMgr.name ?? purchasingMgr.email}`)
    console.log(`    SM:  ${salesMgr.name ?? salesMgr.email}`)
    console.log(`    WH:  ${warehouseMgr.name ?? warehouseMgr.email}`)

    // ─── 2. Find/create a department ──────────────────
    let dept = await prisma.department.findFirst({ where: { name: { contains: 'Kinh Doanh' } } })
    if (!dept) {
        dept = await prisma.department.findFirst()
    }

    // ─── 3. Clean existing proposals ──────────────────
    console.log('  → Cleaning old seed proposals...')
    await prisma.proposalApprovalLog.deleteMany({ where: { proposal: { proposalNo: { startsWith: 'TT-2026-' } } } })
    await prisma.proposalComment.deleteMany({ where: { proposal: { proposalNo: { startsWith: 'TT-2026-' } } } })
    await prisma.proposalAttachment.deleteMany({ where: { proposal: { proposalNo: { startsWith: 'TT-2026-' } } } })
    await prisma.proposal.deleteMany({ where: { proposalNo: { startsWith: 'TT-2026-' } } })

    // ─── 4. Seed Proposals ────────────────────────────
    console.log('  → Creating proposals across all workflow states...\n')

    const now = new Date()
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000)
    const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000)

    // ═══════════════════════════════════════════════════
    // TT-001: APPROVED → IN_PROGRESS (Full journey, all levels passed)
    // ═══════════════════════════════════════════════════
    const tt001 = await prisma.proposal.create({
        data: {
            proposalNo: 'TT-2026-001',
            category: 'NEW_SUPPLIER',
            priority: 'HIGH',
            title: 'Đề xuất hợp tác với NCC mới — Tenuta San Guido (Sassicaia)',
            content: `Kính đề xuất mở hợp tác kinh doanh với Tenuta San Guido, nhà sản xuất Sassicaia — một trong những dòng vang Super Tuscan hàng đầu thế giới.

Hiện tại công ty đang thiếu dòng vang Ý cao cấp trong portfolio, đặc biệt phân khúc trên 5 triệu VND/chai. Khách hàng HORECA cao cấp liên tục yêu cầu.

Chi tiết NCC:
- Tên: Tenuta San Guido
- Vùng: Bolgheri, Tuscany, Italy
- Sản phẩm chính: Sassicaia DOC, Guidalberto, Le Difese
- MOQ đề xuất: 120 thùng / năm (1.440 chai)`,
            justification: `1. Portfolio gap nghiêm trọng: Hiện không có vang Ý cao cấp nào
2. Nhu cầu khách hàng: 8/15 KH HORECA VIP đã yêu cầu Sassicaia trong 6 tháng qua
3. Biên lợi nhuận cao: Ước tính GM 42-45% cho Super Tuscan
4. EVFTA áp dụng thuế suất 0% cho EU wines → lợi thế cạnh tranh`,
            expectedOutcome: 'Mở rộng portfolio thêm 3 SKU mới, tăng doanh số phân khúc vang Ý ước tính 15-20% trong Q2/2026',
            estimatedAmount: 850000000,  // 850 triệu VND
            currency: 'VND',
            deadline: daysAgo(-15),  // 15 days from now
            createdBy: purchasingMgr.id,
            departmentId: dept?.id,
            status: 'IN_PROGRESS',
            currentLevel: 3,
            submittedAt: daysAgo(12),
            resolvedAt: daysAgo(5),
            createdAt: daysAgo(14),
        },
    })
    // Approval logs for TT-001
    await prisma.proposalApprovalLog.createMany({
        data: [
            { proposalId: tt001.id, level: 1, action: 'APPROVE', approvedBy: purchasingMgr.id, comment: 'Đồng ý, thị trường cần Super Tuscan.', createdAt: daysAgo(10) },
            { proposalId: tt001.id, level: 3, action: 'APPROVE', approvedBy: ceo.id, comment: 'Approved. Tiến hành đàm phán hợp đồng với Tenuta San Guido. CC cho KT để chuẩn bị budget Q2.', createdAt: daysAgo(5) },
        ],
    })
    await prisma.proposalComment.createMany({
        data: [
            { proposalId: tt001.id, authorId: purchasingMgr.id, content: 'Đã liên hệ đại diện Tenuta San Guido tại VINEXPO. Họ quan tâm thị trường Việt Nam.', createdAt: daysAgo(13) },
            { proposalId: tt001.id, authorId: accountant.id, content: 'Budget Q2 có thể cover. Đề nghị thanh toán theo lộ trình: 50% T/T, 50% L/C 60 ngày.', createdAt: daysAgo(8) },
            { proposalId: tt001.id, authorId: ceo.id, content: 'Đã approved. Đàm phán mức chiết khấu tối thiểu 5% cho first order.', createdAt: daysAgo(5) },
        ],
    })
    console.log('  ✓ TT-001: NCC Mới (APPROVED → IN_PROGRESS)')

    // ═══════════════════════════════════════════════════
    // TT-002: APPROVED (CEO level, full journey)
    // ═══════════════════════════════════════════════════
    const tt002 = await prisma.proposal.create({
        data: {
            proposalNo: 'TT-2026-002',
            category: 'BUDGET_REQUEST',
            priority: 'HIGH',
            title: 'Xin ngân sách tổ chức Wine Tasting Event Q1 — Sheraton Grand',
            content: `Đề xuất tổ chức sự kiện Wine Tasting lớn tại Sheraton Grand Saigon cho khách hàng VIP và HORECA partners.

Chương trình:
- Ngày: 25/03/2026 (18:00 - 22:00)
- Địa điểm: Grand Ballroom, Sheraton Grand Hotel
- Quy mô: 80-100 khách mời (VIP + HORECA buyers)
- Vang tasting: 12 labels từ Bordeaux, Burgundy, Champagne
- F&B: Buffet dinner + 5 courses wine pairing by Sheraton chef
- Entertainment: Live jazz trio + sommelier presentation`,
            justification: `1. Duy trì quan hệ với top 20 KH contributing 65% revenue
2. Giới thiệu 3 labels mới vừa nhập (Krug, DRC, Sassicaia)
3. Benchmark: Event tương tự đối thủ PM Wines mang lại 30% more orders trong tháng sau
4. Chi phí marketing thấp hơn quảng cáo digital (~2.5x ROI)`,
            expectedOutcome: 'Thu hút 30 đơn đặt hàng mới, tổng giá trị dự kiến 1.2 tỷ VND. Brand awareness tăng 25%.',
            estimatedAmount: 185000000,  // 185 triệu VND
            currency: 'VND',
            deadline: daysAgo(-10),
            createdBy: salesMgr.id,
            departmentId: dept?.id,
            status: 'APPROVED',
            currentLevel: 3,
            submittedAt: daysAgo(8),
            resolvedAt: daysAgo(2),
            createdAt: daysAgo(10),
        },
    })
    await prisma.proposalApprovalLog.createMany({
        data: [
            { proposalId: tt002.id, level: 1, action: 'APPROVE', approvedBy: salesMgr.id, comment: 'Phê duyệt. Event này rất cần để push doanh số Q1.', createdAt: daysAgo(7) },
            { proposalId: tt002.id, level: 2, action: 'APPROVE', approvedBy: accountant.id, comment: 'Budget marketing Q1 còn dư 240M. OK.', createdAt: daysAgo(4) },
            { proposalId: tt002.id, level: 3, action: 'APPROVE', approvedBy: ceo.id, comment: 'Approved. Nhớ mời thêm nhóm KH tiềm năng mới từ Đà Nẵng.', createdAt: daysAgo(2) },
        ],
    })
    await prisma.proposalComment.createMany({
        data: [
            { proposalId: tt002.id, authorId: salesMgr.id, content: 'Sheraton đã confirm venue. Cần finalise danh sách khách mời trước 18/03.', createdAt: daysAgo(9) },
            { proposalId: tt002.id, authorId: ceo.id, content: 'Hãy làm thêm mini video recap để post lên social media sau event.', createdAt: daysAgo(2) },
        ],
    })
    console.log('  ✓ TT-002: Budget Request - Wine Tasting Event (APPROVED)')

    // ═══════════════════════════════════════════════════
    // TT-003: WAITING CEO APPROVAL (L3) — CEO needs to act!
    // ═══════════════════════════════════════════════════
    const tt003 = await prisma.proposal.create({
        data: {
            proposalNo: 'TT-2026-003',
            category: 'CAPITAL_EXPENDITURE',
            priority: 'URGENT',
            title: 'Mua sắm hệ thống Wine Cooler chuyên dụng cho kho Thủ Đức',
            content: `Kính trình CEO phê duyệt mua sắm 3 tủ Wine Cooler công nghiệp cho kho Thủ Đức.

Tình trạng hiện tại:
- Kho đang sử dụng 2 tủ Liebherr đời cũ (2019), hết bảo hành
- Tủ 1 bị lỗi quạt giải nhiệt, nhiệt độ dao động ±3°C
- Rủi ro hư hàng nghiêm trọng: 480 chai Bordeaux Premier Cru (giá trị ~2.8 tỷ VND) đang lưu trữ

Đề xuất:
- 2x EuroCave Royale V266 (zone kép 5-12°C, ~192 chai/tủ) — cho Bordeaux/Burgundy
- 1x Vintec Heritage V190SG (5-20°C, ~150 chai) — cho Champagne/Sparkling
- Bao gồm: vận chuyển, lắp đặt, bảo hành 5 năm`,
            justification: `1. Rủi ro thiệt hại: 2.8 tỷ VND hàng tồn kho Premier Cru
2. Tủ cũ 7 năm tuổi, sửa chữa tốn 40% giá mua mới
3. Quy định ATTP: Phải duy trì nhiệt độ ổn định ±1°C
4. Thu hồi vốn: Giảm 100% rủi ro hư hàng = tiết kiệm bảo hiểm 45M/năm`,
            expectedOutcome: 'Bảo vệ 2.8 tỷ VND hàng tồn kho, giảm rủi ro damage claim, tuân thủ ATTP.',
            estimatedAmount: 420000000,  // 420 triệu VND
            currency: 'VND',
            deadline: daysAgo(-7),
            createdBy: warehouseMgr.id,
            departmentId: dept?.id,
            status: 'APPROVED_L2',
            currentLevel: 3,
            submittedAt: daysAgo(5),
            createdAt: daysAgo(6),
        },
    })
    await prisma.proposalApprovalLog.createMany({
        data: [
            { proposalId: tt003.id, level: 1, action: 'APPROVE', approvedBy: warehouseMgr.id, comment: 'Cấp bách. Tủ cũ đã báo lỗi 3 lần trong 2 tuần.', createdAt: daysAgo(4) },
            { proposalId: tt003.id, level: 2, action: 'APPROVE', approvedBy: accountant.id, comment: 'CAPEX budget Q1 approved. Đề nghị thanh toán chuyển khoản 2 đợt.', createdAt: daysAgo(2) },
        ],
    })
    await prisma.proposalComment.createMany({
        data: [
            { proposalId: tt003.id, authorId: warehouseMgr.id, content: '⚠️ Tủ Liebherr #1 đã tắt lần 2 sáng nay. Cần xử lý gấp.', createdAt: daysAgo(3) },
            { proposalId: tt003.id, authorId: accountant.id, content: 'Đã xác nhận báo giá từ 3 NCC: EuroCave, Vintec, và SubZero. EuroCave+Vintec combo tốt nhất.', createdAt: daysAgo(2) },
        ],
    })
    console.log('  ✓ TT-003: CAPEX Wine Cooler (URGENT — WAITING CEO ⚡)')

    // ═══════════════════════════════════════════════════
    // TT-004: WAITING CEO (Normal priority)
    // ═══════════════════════════════════════════════════
    const tt004 = await prisma.proposal.create({
        data: {
            proposalNo: 'TT-2026-004',
            category: 'PRICE_ADJUSTMENT',
            priority: 'HIGH',
            title: 'Điều chỉnh giá bán Champagne Veuve Clicquot do tăng thuế TTĐB 2026',
            content: `Từ 01/04/2026, thuế Tiêu thụ đặc biệt cho rượu vang tăng từ 35% → 40% theo QĐ mới.

Tác động trực tiếp đến dòng Champagne Veuve Clicquot Yellow Label:
- Giá nhập CIF hiện: 28 EUR/chai (~750.000 VND)
- Giá bán hiện tại: 1.350.000 VND/chai (GM 44%)
- Thuế TTĐB mới: Tăng ~67.000 VND/chai
- Giá bán đề xuất mới: 1.450.000 VND/chai (duy trì GM 43%)

Các dòng bị ảnh hưởng:
1. Veuve Clicquot Yellow Label → 1.350K → 1.450K
2. Krug Grande Cuvée → 4.800K → 5.200K
3. Moët & Chandon Impérial → 980K → 1.060K`,
            justification: `1. Thuế TTĐB tăng 5% = không thể giữ giá cũ mà vẫn có lời
2. Đối thủ (Vin Wine, PM Wines) đã thông báo tăng giá tương tự
3. Nếu không điều chỉnh: GM giảm từ 44% → 38% (dưới ngưỡng 40%)
4. Timing: Cần thông báo khách hàng trước 15/03 để còn order giá cũ`,
            expectedOutcome: 'Duy trì GM trên 40%, bảo vệ lợi nhuận ước tính 280M/năm cho dòng Champagne.',
            estimatedAmount: 280000000,
            currency: 'VND',
            deadline: daysAgo(-5),
            createdBy: salesMgr.id,
            departmentId: dept?.id,
            status: 'APPROVED_L2',
            currentLevel: 3,
            submittedAt: daysAgo(4),
            createdAt: daysAgo(5),
        },
    })
    await prisma.proposalApprovalLog.createMany({
        data: [
            { proposalId: tt004.id, level: 1, action: 'APPROVE', approvedBy: salesMgr.id, comment: 'Đã survey đối thủ, giá đề xuất hợp lý.', createdAt: daysAgo(3) },
            { proposalId: tt004.id, level: 2, action: 'APPROVE', approvedBy: accountant.id, comment: 'Xác nhận tính toán thuế TTĐB chính xác. Recommend tiến hành.', createdAt: daysAgo(1) },
        ],
    })
    console.log('  ✓ TT-004: Price Adjustment Champagne (WAITING CEO)')

    // ═══════════════════════════════════════════════════
    // TT-005: WAITING CEO — Policy Change (direct to CEO)
    // ═══════════════════════════════════════════════════
    const tt005 = await prisma.proposal.create({
        data: {
            proposalNo: 'TT-2026-005',
            category: 'POLICY_CHANGE',
            priority: 'NORMAL',
            title: 'Thay đổi quy trình ký kết hợp đồng — thêm bước Legal Review',
            content: `Hiện tại quy trình ký hợp đồng chỉ qua 2 bước: Sales soạn → CEO ký.

Đề xuất thêm bước "Legal Review" trước khi CEO ký:
1. Sales soạn thảo HĐ          (hiện tại)
2. KT Trưởng xác nhận điều khoản thanh toán  (mới)
3. Legal Review — kiểm tra pháp lý        (mới)
4. CEO phê duyệt & ký            (hiện tại)

Lý do: 2 HĐ gần đây có sai sót điều khoản penalty clause, gây rủi ro tranh chấp.`,
            justification: 'Giảm rủi ro pháp lý, chuẩn hóa quy trình ISO 9001 đang audit.',
            estimatedAmount: null,
            createdBy: accountant.id,
            departmentId: dept?.id,
            status: 'SUBMITTED',
            currentLevel: 3,  // POLICY_CHANGE goes direct to CEO
            submittedAt: hoursAgo(6),
            createdAt: hoursAgo(8),
        },
    })
    await prisma.proposalComment.create({
        data: {
            proposalId: tt005.id,
            authorId: accountant.id,
            content: 'Đính kèm ví dụ 2 HĐ có vấn đề: HĐ-2025-089 (thiếu clause force majeure) và HĐ-2025-102 (penalty rate sai).',
            createdAt: hoursAgo(7),
        },
    })
    console.log('  ✓ TT-005: Policy Change (SUBMITTED → WAITING CEO direct)')

    // ═══════════════════════════════════════════════════
    // TT-006: REJECTED (CEO từ chối)
    // ═══════════════════════════════════════════════════
    const tt006 = await prisma.proposal.create({
        data: {
            proposalNo: 'TT-2026-006',
            category: 'PROMOTION_CAMPAIGN',
            priority: 'NORMAL',
            title: 'Chương trình KM Tết Nguyên Đán — Mua 6 tặng 1 dòng Veuve Clicquot',
            content: `Đề xuất chương trình khuyến mãi Tết Nguyên Đán 2026:
- Sản phẩm: Veuve Clicquot Yellow Label
- Cơ chế: Mua 6 chai tặng 1 chai (giảm 14.3%)
- Thời gian: 15/01/2026 - 28/02/2026
- Đối tượng: Tất cả kênh phân phối`,
            justification: 'Đẩy hàng tồn kho Veuve Clicquot (hiện 280 chai, > 3 tháng tồn)',
            expectedOutcome: 'Tiêu thụ thêm 200 chai, giảm tồn kho dưới mức an toàn 80 chai.',
            estimatedAmount: 65000000,  // 65M cost from free bottles
            currency: 'VND',
            createdBy: salesMgr.id,
            departmentId: dept?.id,
            status: 'REJECTED',
            currentLevel: 3,
            submittedAt: daysAgo(25),
            resolvedAt: daysAgo(20),
            createdAt: daysAgo(28),
        },
    })
    await prisma.proposalApprovalLog.createMany({
        data: [
            { proposalId: tt006.id, level: 1, action: 'APPROVE', approvedBy: salesMgr.id, comment: 'OK từ Sales.', createdAt: daysAgo(24) },
            { proposalId: tt006.id, level: 2, action: 'APPROVE', approvedBy: accountant.id, comment: 'Chi phí KM trong budget.', createdAt: daysAgo(22) },
            { proposalId: tt006.id, level: 3, action: 'REJECT', approvedBy: ceo.id, comment: 'Từ chối. Biên lợi nhuận Champagne đã mỏng. Thay vì giảm giá, hãy tổ chức tasting event để đẩy hàng — tốt hơn cho brand positioning.', createdAt: daysAgo(20) },
        ],
    })
    await prisma.proposalComment.create({
        data: {
            proposalId: tt006.id,
            authorId: ceo.id,
            content: 'Xem lại TT-002 (Wine Tasting Event) — đó là cách tốt hơn để đẩy hàng tồn mà không hạ giá.',
            createdAt: daysAgo(20),
        },
    })
    console.log('  ✓ TT-006: Promotion Campaign (REJECTED by CEO)')

    // ═══════════════════════════════════════════════════
    // TT-007: RETURNED (CEO trả lại để bổ sung)
    // ═══════════════════════════════════════════════════
    const tt007 = await prisma.proposal.create({
        data: {
            proposalNo: 'TT-2026-007',
            category: 'STAFF_REQUISITION',
            priority: 'NORMAL',
            title: 'Tuyển dụng 1 Sommelier cho phòng Kinh Doanh',
            content: `Đề xuất tuyển dụng 1 Sommelier chuyên nghiệp (Level 2+) để support team Sales:
- Vị trí: Sommelier / Wine Consultant
- Nhiệm vụ: Tư vấn khách hàng, đào tạo nội bộ, quản lý wine tasting
- Yêu cầu: WSET Level 2+, tiếng Anh IELTS 6.5+, 3 năm kinh nghiệm
- Mức lương đề xuất: 25-35 triệu VND + benefits`,
            justification: 'Team Sales không có chuyên gia rượu. Hiện phải thuê ngoài cho mỗi event (~15M/lần).',
            expectedOutcome: 'Nâng cao chuyên môn đội ngũ, giảm chi phí thuê ngoài, tăng chất lượng tư vấn khách hàng.',
            estimatedAmount: 420000000,  // Chi phí nhân sự cả năm
            currency: 'VND',
            createdBy: salesMgr.id,
            departmentId: dept?.id,
            status: 'RETURNED',
            currentLevel: 0,
            submittedAt: daysAgo(10),
            createdAt: daysAgo(12),
        },
    })
    await prisma.proposalApprovalLog.createMany({
        data: [
            { proposalId: tt007.id, level: 1, action: 'APPROVE', approvedBy: salesMgr.id, comment: 'Cần thiết cho team.', createdAt: daysAgo(9) },
            { proposalId: tt007.id, level: 3, action: 'REJECT', approvedBy: ceo.id, comment: 'Cần bổ sung: (1) JD chi tiết, (2) so sánh chi phí thuê ngoài vs full-time, (3) KPI cho vị trí này. Trả lại để bổ sung.', createdAt: daysAgo(6) },
        ],
    })
    await prisma.proposalComment.create({
        data: {
            proposalId: tt007.id,
            authorId: salesMgr.id,
            content: 'Đang bổ sung JD và bảng so sánh chi phí theo yêu cầu CEO. Dự kiến resubmit ngày mai.',
            createdAt: daysAgo(4),
        },
    })
    console.log('  ✓ TT-007: Staff Requisition (RETURNED for more info)')

    // ═══════════════════════════════════════════════════
    // TT-008: DRAFT (chưa submit)
    // ═══════════════════════════════════════════════════
    await prisma.proposal.create({
        data: {
            proposalNo: 'TT-2026-008',
            category: 'CONTRACT_SIGNING',
            priority: 'HIGH',
            title: 'Ký hợp đồng đại lý độc quyền với Domaine de la Romanée-Conti (DRC)',
            content: `Đề xuất ký hợp đồng đại lý độc quyền với DRC cho thị trường miền Nam Việt Nam.

DRC là thương hiệu vang Burgundy cao cấp nhất thế giới:
- Allocation cực kỳ hiếm (chỉ ~600 case/year globally)
- Giá trị brand vô cùng cao cho portfolio
- Potential revenue: 8-12 tỷ VND/năm

Điều kiện DRC yêu cầu:
- Guarantee purchase minimum 24 case/year
- Dedicated storage conditions (13°C ±0.5°C)
- No retail discount below MAP price`,
            justification: 'Cơ hội duy nhất — DRC đang tìm đại lý mới tại Việt Nam sau khi terminate partner cũ.',
            expectedOutcome: 'Trở thành đại lý DRC duy nhất tại VN. Revenue potential 8-12 tỷ/năm. Vị thế brand #1 luxury wines.',
            estimatedAmount: 3500000000,  // 3.5 tỷ commitment/năm
            currency: 'VND',
            deadline: daysAgo(-30),
            createdBy: purchasingMgr.id,
            departmentId: dept?.id,
            status: 'DRAFT',
            currentLevel: 0,
            createdAt: daysAgo(2),
        },
    })
    console.log('  ✓ TT-008: DRC Exclusive Contract (DRAFT)')

    // ═══════════════════════════════════════════════════
    // TT-009: APPROVED_L1 (TP đã duyệt, đang chờ KT)
    // ═══════════════════════════════════════════════════
    const tt009 = await prisma.proposal.create({
        data: {
            proposalNo: 'TT-2026-009',
            category: 'PAYMENT_SCHEDULE',
            priority: 'HIGH',
            title: 'Lịch thanh toán NCC LVMH — Lô hàng Krug + Moët tháng 3',
            content: `Đề xuất lịch thanh toán cho invoice INV-LVMH-2026-012:

Tổng giá trị invoice: EUR 45,800 (≈ 1,145,000,000 VND)
Sản phẩm: 120 chai Krug Grande Cuvée + 240 chai Moët Impérial

Lịch đề xuất:
- Đợt 1 (10/03): 30% = EUR 13,740 (~344M VND) — để NCC release hàng
- Đợt 2 (25/03): 40% = EUR 18,320 (~458M VND) — khi hàng cập cảng
- Đợt 3 (15/04): 30% = EUR 13,740 (~344M VND) — NET45 từ ngày nhận hàng`,
            justification: 'LVMH yêu cầu thanh toán trước 50% để release hàng. Chia 3 đợt giúp cash flow tốt hơn so với TT 100%.',
            expectedOutcome: 'Đảm bảo lô hàng Krug + Moët về kho trước 01/04, kịp phục vụ mùa lễ.',
            estimatedAmount: 1145000000,
            currency: 'VND',
            deadline: daysAgo(-3),
            createdBy: purchasingMgr.id,
            departmentId: dept?.id,
            status: 'APPROVED_L1',
            currentLevel: 2,  // Waiting for KT Trưởng
            submittedAt: daysAgo(3),
            createdAt: daysAgo(4),
        },
    })
    await prisma.proposalApprovalLog.create({
        data: {
            proposalId: tt009.id,
            level: 2,
            action: 'APPROVE',
            approvedBy: purchasingMgr.id,
            comment: 'Đã confirm với LVMH về schedule này. Họ accept.',
            createdAt: daysAgo(2),
        },
    })
    console.log('  ✓ TT-009: Payment Schedule LVMH (APPROVED_L1, waiting KT)')

    // ═══════════════════════════════════════════════════
    // TT-010: SUBMITTED — just submitted, waiting L1
    // ═══════════════════════════════════════════════════
    await prisma.proposal.create({
        data: {
            proposalNo: 'TT-2026-010',
            category: 'LICENSE_RENEWAL',
            priority: 'URGENT',
            title: 'Gia hạn giấy phép nhập khẩu rượu — hết hạn 31/03/2026',
            content: `Giấy phép nhập khẩu rượu GP-NK-2024-0156 sẽ hết hạn ngày 31/03/2026.

Cần hoàn tất thủ tục gia hạn trước 15/03 (thời gian xử lý của Bộ Công Thương: 10-15 ngày).

Chi phí gia hạn:
- Phí hồ sơ: 2.000.000 VND
- Phí thẩm định: 5.000.000 VND
- Công chứng tài liệu: 3.000.000 VND
- Tổng: ~10.000.000 VND

Tài liệu cần chuẩn bị:
1. Đơn xin gia hạn (theo mẫu BCT)
2. Bản sao GPKD + GCN ATTP
3. Báo cáo nhập khẩu 2024-2025
4. Cam kết tuân thủ quy định ATTP`,
            justification: 'Không gia hạn = không thể nhập hàng từ 01/04. Tất cả shipments Q2 bị chặn.',
            expectedOutcome: 'Gia hạn GP thành công, đảm bảo hoạt động kinh doanh liền mạch.',
            estimatedAmount: 10000000,
            currency: 'VND',
            deadline: daysAgo(-7),
            createdBy: accountant.id,
            departmentId: dept?.id,
            status: 'SUBMITTED',
            currentLevel: 2,  // LICENSE_RENEWAL: KT → CEO
            submittedAt: hoursAgo(3),
            createdAt: hoursAgo(5),
        },
    })
    console.log('  ✓ TT-010: License Renewal (SUBMITTED, URGENT ⚡)')

    // ═══════════════════════════════════════════════════
    // TT-011: CLOSED (Full lifecycle complete)
    // ═══════════════════════════════════════════════════
    const tt011 = await prisma.proposal.create({
        data: {
            proposalNo: 'TT-2026-011',
            category: 'DEBT_WRITE_OFF',
            priority: 'LOW',
            title: 'Xoá nợ khó đòi — KH The Restaurant by Martino (quá hạn 180 ngày)',
            content: `Đề xuất xoá nợ khó đòi cho KH "The Restaurant by Martino":
- Mã KH: CUS-THEREST
- Số nợ: 28,500,000 VND (Invoice INV-2025-067, INV-2025-089)
- Quá hạn: 180+ ngày
- Đã thu: 3 lần liên hệ, 1 lần gửi luật sư warning letter

Nhà hàng đã đóng cửa từ tháng 11/2025 do Covid aftermath. Không còn tài sản để thu hồi.`,
            justification: 'Nợ xấu > 180 ngày, khách hàng đã ngừng kinh doanh. Tiếp tục theo đuổi = tốn chi phí pháp lý > giá trị nợ.',
            expectedOutcome: 'Xoá sổ 28.5M nợ xấu, làm sạch AR aging report.',
            estimatedAmount: 28500000,
            currency: 'VND',
            createdBy: accountant.id,
            departmentId: dept?.id,
            status: 'CLOSED',
            currentLevel: 3,
            submittedAt: daysAgo(30),
            resolvedAt: daysAgo(22),
            createdAt: daysAgo(35),
        },
    })
    await prisma.proposalApprovalLog.createMany({
        data: [
            { proposalId: tt011.id, level: 2, action: 'APPROVE', approvedBy: accountant.id, comment: 'Đã hạch toán dự phòng nợ xấu từ Q4/2025. Khuyến nghị xoá.', createdAt: daysAgo(28) },
            { proposalId: tt011.id, level: 3, action: 'APPROVE', approvedBy: ceo.id, comment: 'Đồng ý xoá nợ. KT ghi nhận vào chi phí bất thường.', createdAt: daysAgo(22) },
        ],
    })
    console.log('  ✓ TT-011: Debt Write-Off (CLOSED — full lifecycle)')

    // ═══════════════════════════════════════════════════
    // TT-012: REVIEWING (mid-flow)
    // ═══════════════════════════════════════════════════
    await prisma.proposal.create({
        data: {
            proposalNo: 'TT-2026-012',
            category: 'NEW_PRODUCT',
            priority: 'NORMAL',
            title: 'Nhập khẩu thử nghiệm — Vang Chile Concha y Toro (phân khúc tầm trung)',
            content: `Đề xuất nhập khẩu thử nghiệm 500 chai vang Chile Concha y Toro cho phân khúc tầm trung:

Sản phẩm đề xuất:
1. Casillero del Diablo Cabernet Sauvignon — 250 chai (retail: 380K/chai)
2. Marques de Casa Concha Merlot — 150 chai (retail: 650K/chai)
3. Don Melchor Cabernet — 100 chai (retail: 1.8M/chai)

Thị trường: Direct-to-consumer + Wine Bar channel`,
            justification: 'Mở rộng phân khúc tầm trung (~300K-700K/chai) hiện đang bỏ trống. Chile wines có ưu đãi thuế CPTPP.',
            expectedOutcome: 'Test market reaction. Nếu thành công → expand thêm 5 SKU trong Q3.',
            estimatedAmount: 165000000,
            currency: 'VND',
            createdBy: purchasingMgr.id,
            departmentId: dept?.id,
            status: 'SUBMITTED',
            currentLevel: 1,  // Waiting TP
            submittedAt: hoursAgo(12),
            createdAt: daysAgo(1),
        },
    })
    console.log('  ✓ TT-012: New Product - Chile Wine (SUBMITTED, waiting TP)')

    // ═══════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════
    const counts = await prisma.proposal.groupBy({
        by: ['status'],
        _count: true,
        where: { proposalNo: { startsWith: 'TT-2026-' } },
    })

    console.log('\n' + '═'.repeat(60))
    console.log('✅ Proposal seed complete!')
    console.log('═'.repeat(60))
    console.log('\n📊 Status Distribution:')
    for (const c of counts) {
        console.log(`   ${c.status.padEnd(15)} → ${c._count}`)
    }
    console.log(`\n   Total: ${counts.reduce((s, c) => s + c._count, 0)} proposals`)
    console.log('\n🎯 CEO Actions Required:')
    console.log('   TT-003 (URGENT/CAPEX)  — Wine Cooler mua sắm khẩn cấp')
    console.log('   TT-004 (HIGH/Price)    — Điều chỉnh giá Champagne')
    console.log('   TT-005 (NORMAL/Policy) — Thay đổi quy trình ký HĐ')
    console.log('\n💡 Full Lifecycle: TT-001 (New Supplier journey) + TT-011 (Debt Write-Off closed)')
    console.log('   Cross-ref: TT-006 rejected → TT-002 approved (CEO suggested alt approach)')
}

main()
    .catch(e => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
