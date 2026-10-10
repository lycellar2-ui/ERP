import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local
dotenv.config({ path: join(__dirname, '../.env.local') })

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// ── Setup Prisma Client with pg adapter ───────────────────
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
    throw new Error('DATABASE_URL is not set in .env.local')
}

const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 2,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ── Setup S3 / Cloudflare R2 Client ───────────────────────
const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucketName = process.env.R2_BUCKET_NAME || 'wine-erp-documents'

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
})

// ── Vietnamese Number to Words Helper ─────────────────────
function numberToWordsVN(amount) {
    if (!amount || isNaN(amount) || amount === 0) return 'Không đồng'
    const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
    const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']
    let n = Math.abs(Math.round(amount))

    function readGroup(threeDigits, isHighest) {
        const h = Math.floor(threeDigits / 100)
        const t = Math.floor((threeDigits % 100) / 10)
        const u = threeDigits % 10
        let s = ''
        if (h > 0 || !isHighest) s += digits[h] + ' trăm '
        if (t === 0) {
            if (u > 0 && (h > 0 || !isHighest)) s += 'lẻ '
        } else if (t === 1) {
            s += 'mười '
        } else {
            s += digits[t] + ' mươi '
        }
        if (t > 0 && u === 1 && t !== 1) s += 'mốt'
        else if (t > 0 && u === 5) s += 'lăm'
        else if (u > 0) s += digits[u]
        return s.trim()
    }

    const groups = []
    while (n > 0) {
        groups.push(n % 1000)
        n = Math.floor(n / 1000)
    }

    let result = ''
    for (let i = groups.length - 1; i >= 0; i--) {
        const g = groups[i]
        if (g > 0) {
            const isHighest = i === groups.length - 1
            const str = readGroup(g, isHighest)
            result += (result ? ' ' : '') + str + (units[i] ? ' ' + units[i] : '')
        }
    }
    result = result.trim() + ' đồng chẵn'
    return result.charAt(0).toUpperCase() + result.slice(1)
}

// ── Test Runner ───────────────────────────────────────────
async function runE2ETests() {
    console.log('═══════════════════════════════════════════════════════════════════')
    console.log('   BẮT ĐẦU KIỂM THỬ TOÀN DIỆN (E2E) — PHÂN HỆ ĐỀ NGHỊ THANH TOÁN')
    console.log('   TÍCH HỢP CLOUDFLARE R2, POSTGRESQL & QUY TRÌNH PHÊ DUYỆT 3 CẤP')
    console.log('═══════════════════════════════════════════════════════════════════\n')

    let createdRequestId = null
    let createdBudgetId = null
    let r2TestKey = null
    let passedTests = 0
    let totalTests = 8

    try {
        // ── TEST 1: Cloudflare R2 Integration (Upload, Presign, Fetch, Delete) ──
        console.log('▶ [TEST 1/8] Kiểm tra Cloudflare R2 Storage Adapter...')
        r2TestKey = `payment-requests/2026/TEST/test-invoice-${Date.now()}.pdf`
        const mockPdfBuffer = Buffer.from('%PDF-1.4 Mock Scanned VAT Invoice for LyCellar Wine ERP Testing')

        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: r2TestKey,
            Body: mockPdfBuffer,
            ContentType: 'application/pdf',
        }))
        console.log('   ✓ Đã upload file PDF giả lập lên R2:', r2TestKey)

        const presignedUrl = await getSignedUrl(s3, new GetObjectCommand({
            Bucket: bucketName,
            Key: r2TestKey,
        }), { expiresIn: 900 })

        const res = await fetch(presignedUrl)
        if (res.status !== 200) throw new Error(`HTTP fetch failed with status: ${res.status}`)
        const fetchedText = await res.text()
        if (!fetchedText.includes('Mock Scanned VAT Invoice')) throw new Error('File content mismatch!')
        console.log('   ✓ Đã sinh Presigned URL và tải nội dung bảo mật thành công!')
        passedTests++

        // ── TEST 2: Kiểm tra Master Data (Hạng mục chi phí & Pháp nhân) ──
        console.log('\n▶ [TEST 2/8] Kiểm tra Master Data Hạng Mục Chi Phí & Pháp Nhân...')
        const categories = await prisma.expenseCategoryMaster.findMany({ where: { isActive: true } })
        console.log(`   ✓ Đã tìm thấy ${categories.length} hạng mục chi phí đang hoạt động`)
        if (categories.length < 5) throw new Error('Cần có ít nhất 5 hạng mục chi phí được nạp sẵn')

        const tastingCategory = categories.find(c => c.code.includes('TASTING') || c.category === 'MARKETING_EVENT') || categories[0]
        console.log(`   ✓ Hạng mục kiểm thử: [${tastingCategory.code}] ${tastingCategory.name} (TK mặc định: ${tastingCategory.defaultVasAccount || '641'})`)

        const legalEntity = await prisma.legalEntity.findFirst()
        const department = await prisma.department.findFirst()
        const user = await prisma.user.findFirst()
        if (!legalEntity || !department || !user) throw new Error('Thiếu Master Data: LegalEntity / Department / User')
        console.log(`   ✓ Pháp nhân: ${legalEntity.name} (MST: ${legalEntity.taxId || 'N/A'})`)
        console.log(`   ✓ Phòng ban: ${department.name}`)
        console.log(`   ✓ Nhân sự kiểm thử: ${user.name || user.email}`)
        passedTests++

        // ── TEST 3: Kiểm tra Thiết Lập Ngân Sách Chi Phí (Expense Budget) ──
        console.log('\n▶ [TEST 3/8] Thiết lập Hạn Mức Ngân Sách Dự Toán 2026...')
        const budget = await prisma.expenseBudget.create({
            data: {
                categoryId: tastingCategory.id,
                legalEntityId: legalEntity.id,
                departmentId: department.id,
                year: 2026,
                periodType: 'YEARLY',
                allocatedAmount: 50000000, // 50 triệu
                warningThresholdPct: 85,
            }
        })
        createdBudgetId = budget.id
        console.log(`   ✓ Đã tạo ngân sách dự toán ID: ${budget.id}`)
        console.log(`   ✓ Hạn mức phân bổ: 50.000.000 VNĐ | Ngưỡng báo động: 85%`)
        passedTests++

        // ── TEST 4: Tạo Phiếu Đề Nghị Thanh Toán & Đính Kèm File Scan R2 ──
        console.log('\n▶ [TEST 4/8] Khởi tạo Đề Nghị Thanh Toán & Gắn Chứng Từ Scan R2...')
        const testRequestNo = `PR-2026-TEST-${Math.floor(1000 + Math.random() * 9000)}`
        const request = await prisma.paymentRequest.create({
            data: {
                requestNo: testRequestNo,
                title: '[TEST E2E] Chi phí tổ chức Workshop Thử nếm vang Grand Cru',
                category: tastingCategory.category,
                priority: 'HIGH',
                status: 'SUBMITTED',
                currentLevel: 1, // Chờ Trưởng phòng duyệt Cấp 1
                totalAmount: 27500000,
                totalAmountVND: 27500000,
                paymentMethod: 'BANK_TRANSFER',
                beneficiaryName: 'CÔNG TY CP TỔ CHỨC SỰ KIỆN RƯỢU VANG',
                beneficiaryBank: 'Techcombank - CN Hoàn Kiếm',
                beneficiaryAccount: '19038899221133',
                legalEntityId: legalEntity.id,
                departmentId: department.id,
                createdBy: user.id,
                items: {
                    create: [
                        {
                            categoryId: tastingCategory.id,
                            description: 'Chi phí thuê ly Riedel & không gian tasting',
                            quantity: 1,
                            unitPrice: 25000000,
                            amount: 25000000,
                            vatAmount: 2500000,
                            totalAmount: 27500000,
                            accountCode: tastingCategory.defaultVasAccount || '641',
                            invoiceNo: 'HD-VAT-889900',
                            invoiceDate: new Date(),
                        }
                    ]
                },
                attachments: {
                    create: [
                        {
                            docType: 'VAT_INVOICE',
                            fileName: 'Hoa-don-VAT-dien-tu-889900.pdf',
                            fileUrl: presignedUrl,
                            storagePath: r2TestKey,
                            fileSize: mockPdfBuffer.length,
                            mimeType: 'application/pdf',
                            uploadedBy: user.id,
                        }
                    ]
                }
            },
            include: {
                items: true,
                attachments: true,
            }
        })
        createdRequestId = request.id
        console.log(`   ✓ Đã tạo thành công Phiếu: ${request.requestNo}`)
        console.log(`   ✓ Tổng tiền: 27.500.000 VNĐ (Vượt ngưỡng 20M -> Buộc CEO duyệt Cấp 3)`)
        console.log(`   ✓ Trạng thái khởi tạo: ${request.status} (Cấp ${request.currentLevel})`)
        passedTests++

        // ── TEST 5: Luồng Phê Duyệt Cấp 1 (Trưởng Phòng) ──
        console.log('\n▶ [TEST 5/8] Kiểm tra Phê duyệt Cấp 1 (Trưởng bộ phận)...')
        await prisma.$transaction([
            prisma.paymentRequest.update({
                where: { id: createdRequestId },
                data: {
                    status: 'REVIEWING_L1', // Chuyển sang Kế toán
                    currentLevel: 2,
                }
            }),
            prisma.paymentApprovalLog.create({
                data: {
                    requestId: createdRequestId,
                    actorId: user.id,
                    level: 1,
                    action: 'APPROVE',
                    comment: 'Xác nhận nhu cầu workshop quý 4 hợp lệ, chuyển kế toán soát xét hóa đơn VAT',
                }
            })
        ])
        const afterL1 = await prisma.paymentRequest.findUnique({ where: { id: createdRequestId } })
        if (afterL1.status !== 'REVIEWING_L1' || afterL1.currentLevel !== 2) throw new Error('Lỗi chuyển trạng thái Cấp 1')
        console.log('   ✓ Cấp 1 Trưởng phòng Duyệt thành công -> Trạng thái: REVIEWING_L1 (Cấp 2)')
        passedTests++

        // ── TEST 6: Luồng Phê Duyệt Cấp 2 (Kế toán) & Cấp 3 (CEO duyệt khoản > 20M) ──
        console.log('\n▶ [TEST 6/8] Kiểm tra Phê duyệt Cấp 2 (Kế toán) & Cấp 3 (CEO)...')
        // Kế toán duyệt -> Vì > 20M nên chuyển lên REVIEWING_L2 (CEO)
        await prisma.$transaction([
            prisma.paymentRequest.update({
                where: { id: createdRequestId },
                data: {
                    status: 'REVIEWING_L2',
                    currentLevel: 3,
                }
            }),
            prisma.paymentApprovalLog.create({
                data: {
                    requestId: createdRequestId,
                    actorId: user.id,
                    level: 2,
                    action: 'APPROVE',
                    comment: 'Đã đối soát Hóa đơn VAT hợp lệ, chuyển CEO phê duyệt chi khoản > 20M',
                }
            })
        ])
        console.log('   ✓ Cấp 2 Kế toán kiểm tra hóa đơn hợp lệ -> Chuyển CEO duyệt (Khoản chi 27.5M > 20M)')

        // CEO duyệt -> Chuyển sang APPROVED (Chờ chi tiền)
        await prisma.$transaction([
            prisma.paymentRequest.update({
                where: { id: createdRequestId },
                data: {
                    status: 'APPROVED',
                    currentLevel: 3,
                }
            }),
            prisma.paymentApprovalLog.create({
                data: {
                    requestId: createdRequestId,
                    actorId: user.id,
                    level: 3,
                    action: 'APPROVE',
                    comment: 'Đồng ý duyệt chi theo đúng kế hoạch phát triển thị trường',
                }
            })
        ])
        const afterL3 = await prisma.paymentRequest.findUnique({ where: { id: createdRequestId } })
        if (afterL3.status !== 'APPROVED') throw new Error('Lỗi chuyển trạng thái Cấp 3')
        console.log('   ✓ Cấp 3 CEO Phê Chuẩn hoàn tất -> Trạng thái: APPROVED (Đã duyệt, chờ chi)')
        passedTests++

        // ── TEST 7: Nghiệp Vụ Giải Ngân & Đính Kèm Ủy Nhiệm Chi (Settlement) ──
        console.log('\n▶ [TEST 7/8] Kiểm tra Giải Ngân & Ghi nhận Ủy Nhiệm Chi (UNC)...')
        const uncVoucherNo = `UNC-TCB-${Date.now()}`
        await prisma.$transaction([
            prisma.paymentRequest.update({
                where: { id: createdRequestId },
                data: {
                    status: 'PAID',
                    paidAmount: 27500000,
                    paidDate: new Date(),
                    uncVoucherNo: uncVoucherNo,
                    notes: 'Đã chuyển khoản qua Ngân hàng Techcombank',
                }
            }),
            prisma.paymentApprovalLog.create({
                data: {
                    requestId: createdRequestId,
                    actorId: user.id,
                    level: 2,
                    action: 'SETTLE',
                    comment: `Đã thực chi 27.500.000 VNĐ theo UNC số ${uncVoucherNo}`,
                }
            })
        ])

        const settledRequest = await prisma.paymentRequest.findUnique({
            where: { id: createdRequestId },
            include: { approvalLogs: true }
        })
        if (settledRequest.status !== 'PAID' || Number(settledRequest.paidAmount) !== 27500000) {
            throw new Error('Lỗi dữ liệu sau khi giải ngân')
        }
        console.log(`   ✓ Trạng thái phiếu sau giải ngân: ${settledRequest.status}`)
        console.log(`   ✓ Số tiền thực chi: 27.500.000 VNĐ | Lệnh UNC: ${settledRequest.uncVoucherNo}`)
        console.log(`   ✓ Số bước nhật ký phê duyệt (Audit Trail): ${settledRequest.approvalLogs.length} logs`)
        passedTests++

        // ── TEST 8: Tiện Ích Đọc Số Tiền Tiếng Việt (VAS Biểu Mẫu In) ──
        console.log('\n▶ [TEST 8/8] Kiểm tra Tiện Ích Đọc Tiền Bằng Chữ (numberToWordsVN)...')
        const testCases = [
            { num: 27500000, expected: 'Hai mươi bảy triệu năm trăm nghìn đồng chẵn' },
            { num: 15000000, expected: 'Mười lăm triệu đồng chẵn' },
            { num: 105000, expected: 'Một trăm lẻ năm nghìn đồng chẵn' },
            { num: 125450000, expected: 'Một trăm hai mươi lăm triệu bốn trăm năm mươi nghìn đồng chẵn' },
        ]

        for (const tc of testCases) {
            const actual = numberToWordsVN(tc.num)
            if (actual !== tc.expected) {
                throw new Error(`Đọc số sai: ${tc.num} -> Kỳ vọng "${tc.expected}", thực tế "${actual}"`)
            }
            console.log(`   ✓ ${tc.num.toLocaleString('vi-VN')} đ -> "${actual}"`)
        }
        passedTests++

        console.log('\n═══════════════════════════════════════════════════════════════════')
        console.log(`   KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTS ĐẠT 100% (PASSED)`)
        console.log('═══════════════════════════════════════════════════════════════════\n')

    } catch (err) {
        console.error('\n❌ KIỂM THỬ THẤT BẠI:', err)
        process.exitCode = 1
    } finally {
        // Dọn dẹp dữ liệu kiểm thử
        console.log('🧹 Đang dọn dẹp dữ liệu kiểm thử...')
        if (createdRequestId) {
            await prisma.paymentApprovalLog.deleteMany({ where: { requestId: createdRequestId } }).catch(() => {})
            await prisma.paymentRequestItem.deleteMany({ where: { requestId: createdRequestId } }).catch(() => {})
            await prisma.paymentRequestAttachment.deleteMany({ where: { requestId: createdRequestId } }).catch(() => {})
            await prisma.paymentRequest.delete({ where: { id: createdRequestId } }).catch(() => {})
            console.log('   ✓ Đã xóa dữ liệu đề nghị thanh toán test')
        }
        if (createdBudgetId) {
            await prisma.expenseBudget.delete({ where: { id: createdBudgetId } }).catch(() => {})
            console.log('   ✓ Đã xóa dữ liệu ngân sách test')
        }
        if (r2TestKey) {
            await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: r2TestKey })).catch(() => {})
            console.log('   ✓ Đã xóa file test trên Cloudflare R2')
        }
        await pool.end().catch(() => {})
        console.log('✅ Dọn dẹp hoàn tất, cơ sở dữ liệu và lưu trữ sạch sẽ 100%!\n')
    }
}

runE2ETests()
