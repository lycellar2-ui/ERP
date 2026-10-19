import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL!).replace('?sslmode=require', '')
const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 2,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🚀 Bắt đầu seed dữ liệu mẫu phân hệ Nhân sự & Giấy tờ (HRM)...')

    // 1. Lấy danh sách users hiện có để liên kết
    const camlyUser = await prisma.user.findFirst({ where: { email: { equals: 'camly1483@gmail.com', mode: 'insensitive' } } })
    const thamUser = await prisma.user.findFirst({ where: { email: { equals: 'Trieuthithamqucb@gmail.com', mode: 'insensitive' } } })
    const khanhUser = await prisma.user.findFirst({ where: { email: { equals: 'khanhtran299999@gmail.com', mode: 'insensitive' } } })
    const maiKhanhUser = await prisma.user.findFirst({ where: { email: { equals: 'maikhanh2234@gmail.com', mode: 'insensitive' } } })
    const adminUser = await prisma.user.findFirst({ where: { email: { equals: 'admin@lyscellars.com', mode: 'insensitive' } } })

    // Lấy hoặc tạo phòng ban
    let banGiamDocDept = await prisma.department.findFirst({ where: { name: { contains: 'Ban Giám Đốc', mode: 'insensitive' } } })
    if (!banGiamDocDept) {
        banGiamDocDept = await prisma.department.create({ data: { name: 'Ban Giám Đốc' } })
    }

    let salesDept = await prisma.department.findFirst({ where: { name: { contains: 'Kinh Doanh', mode: 'insensitive' } } })
    if (!salesDept) {
        salesDept = await prisma.department.create({ data: { name: 'Phòng Kinh Doanh' } })
    }

    let itDept = await prisma.department.findFirst({ where: { name: { contains: 'Kỹ Thuật', mode: 'insensitive' } } })
    if (!itDept) {
        itDept = await prisma.department.create({ data: { name: 'Phòng Kỹ Thuật & Vận Hành' } })
    }

    const now = new Date()

    // 2. Tạo hồ sơ Cẩm Ly - Trợ Lý
    const empCamLy = await prisma.employee.upsert({
        where: { code: 'NV-001' },
        update: {
            fullName: 'Cẩm Ly',
            userId: camlyUser?.id || null,
            deptId: banGiamDocDept.id,
            position: 'Trợ Lý Ban Giám Đốc',
            phone: '0903 148 388',
            email: 'camly1483@gmail.com',
            gender: 'NU',
            dateOfBirth: new Date('1994-08-14'),
            nationalId: '079194002345',
            nationalIdDate: new Date('2021-05-10'),
            nationalIdPlace: 'Cục Cảnh sát QLHC về TTXH',
            address: '124 Hoàng Văn Thụ, Phường 9, Quận Phú Nhuận, TP.HCM',
            currentAddress: '124 Hoàng Văn Thụ, Phường 9, Quận Phú Nhuận, TP.HCM',
            status: 'ACTIVE',
            startDate: new Date('2024-01-15'),
            officialDate: new Date('2024-03-15'),
            contractType: 'INDEFINITE',
            contractNumber: 'HĐLĐ-2024/01/BOD',
            contractStartDate: new Date('2024-03-15'),
            contractEndDate: null,
            bankAccountNo: '1028394829',
            bankName: 'Vietcombank - CN Tân Bình',
            bankAccountHolder: 'CAM LY',
            taxCode: '8492019482',
            socialInsuranceNo: '7920194821',
            healthCheckDate: new Date('2026-01-10'),
            healthCheckExpiry: new Date('2027-01-10'),
        },
        create: {
            code: 'NV-001',
            fullName: 'Cẩm Ly',
            userId: camlyUser?.id || null,
            deptId: banGiamDocDept.id,
            position: 'Trợ Lý Ban Giám Đốc',
            phone: '0903 148 388',
            email: 'camly1483@gmail.com',
            gender: 'NU',
            dateOfBirth: new Date('1994-08-14'),
            nationalId: '079194002345',
            nationalIdDate: new Date('2021-05-10'),
            nationalIdPlace: 'Cục Cảnh sát QLHC về TTXH',
            address: '124 Hoàng Văn Thụ, Phường 9, Quận Phú Nhuận, TP.HCM',
            currentAddress: '124 Hoàng Văn Thụ, Phường 9, Quận Phú Nhuận, TP.HCM',
            status: 'ACTIVE',
            startDate: new Date('2024-01-15'),
            officialDate: new Date('2024-03-15'),
            contractType: 'INDEFINITE',
            contractNumber: 'HĐLĐ-2024/01/BOD',
            contractStartDate: new Date('2024-03-15'),
            contractEndDate: null,
            bankAccountNo: '1028394829',
            bankName: 'Vietcombank - CN Tân Bình',
            bankAccountHolder: 'CAM LY',
            taxCode: '8492019482',
            socialInsuranceNo: '7920194821',
            healthCheckDate: new Date('2026-01-10'),
            healthCheckExpiry: new Date('2027-01-10'),
        }
    })
    console.log(`✓ Đã tạo hồ sơ: ${empCamLy.fullName} (${empCamLy.code})`)

    // Giấy tờ mẫu cho Cẩm Ly
    await prisma.employeeDocument.deleteMany({ where: { employeeId: empCamLy.id } })
    await prisma.employeeDocument.createMany({
        data: [
            {
                employeeId: empCamLy.id,
                docType: 'CONTRACT',
                title: 'Hợp đồng lao động không xác định thời hạn - Cẩm Ly',
                docNumber: 'HĐLĐ-2024/01/BOD',
                fileUrl: 'https://placehold.co/800x1100/1B2E3D/87CBB9.png?text=HDLD+Cam+Ly',
                issueDate: new Date('2024-03-15'),
                expiryDate: null,
                status: 'ACTIVE',
                notes: 'Bản gốc lưu tại tủ hồ sơ BOD-01'
            },
            {
                employeeId: empCamLy.id,
                docType: 'NATIONAL_ID',
                title: 'Căn cước công dân gắn chip 2 mặt',
                docNumber: '079194002345',
                fileUrl: 'https://placehold.co/800x600/1B2E3D/87CBB9.png?text=CCCD+Cam+Ly',
                issueDate: new Date('2021-05-10'),
                expiryDate: new Date('2034-08-14'),
                status: 'ACTIVE'
            },
            {
                employeeId: empCamLy.id,
                docType: 'HEALTH_CERT',
                title: 'Giấy khám sức khỏe định kỳ Bệnh viện Tân Bình',
                fileUrl: 'https://placehold.co/800x1100/1B2E3D/87CBB9.png?text=KSK+Cam+Ly',
                issueDate: new Date('2026-01-10'),
                expiryDate: new Date('2027-01-10'),
                status: 'ACTIVE'
            }
        ]
    })

    // 3. Tạo hồ sơ Triệu Thị Thắm (Sales Rep) - SẮP HẾT HẠN HỢP ĐỒNG TRONG 18 NGÀY ĐỂ TEST CẢNH BÁO
    const contractEndTham = new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000)
    const empTham = await prisma.employee.upsert({
        where: { code: 'NV-002' },
        update: {
            fullName: 'Triệu Thị Thắm',
            userId: thamUser?.id || null,
            deptId: salesDept.id,
            position: 'Chuyên Viên Kinh Doanh (Sales Rep)',
            phone: '0978 221 445',
            email: 'Trieuthithamqucb@gmail.com',
            gender: 'NU',
            dateOfBirth: new Date('1997-04-20'),
            nationalId: '038197009876',
            status: 'ACTIVE',
            startDate: new Date('2025-10-01'),
            officialDate: new Date('2025-11-01'),
            contractType: 'DEFINITE_1Y',
            contractNumber: 'HĐLĐ-2025/11/SLS',
            contractStartDate: new Date('2025-11-01'),
            contractEndDate: contractEndTham, // 18 ngày nữa hết hạn!
            bankAccountNo: '9988776655',
            bankName: 'Techcombank',
            bankAccountHolder: 'TRIEU THI THAM',
            taxCode: '8392018821',
            socialInsuranceNo: '7920188211',
            healthCheckExpiry: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000), // 25 ngày nữa KSK hết hạn
        },
        create: {
            code: 'NV-002',
            fullName: 'Triệu Thị Thắm',
            userId: thamUser?.id || null,
            deptId: salesDept.id,
            position: 'Chuyên Viên Kinh Doanh (Sales Rep)',
            phone: '0978 221 445',
            email: 'Trieuthithamqucb@gmail.com',
            gender: 'NU',
            dateOfBirth: new Date('1997-04-20'),
            nationalId: '038197009876',
            status: 'ACTIVE',
            startDate: new Date('2025-10-01'),
            officialDate: new Date('2025-11-01'),
            contractType: 'DEFINITE_1Y',
            contractNumber: 'HĐLĐ-2025/11/SLS',
            contractStartDate: new Date('2025-11-01'),
            contractEndDate: contractEndTham,
            bankAccountNo: '9988776655',
            bankName: 'Techcombank',
            bankAccountHolder: 'TRIEU THI THAM',
            taxCode: '8392018821',
            socialInsuranceNo: '7920188211',
            healthCheckExpiry: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
        }
    })
    console.log(`✓ Đã tạo hồ sơ: ${empTham.fullName} (${empTham.code}) - HĐLĐ sắp hết hạn sau 18 ngày!`)

    await prisma.employeeDocument.deleteMany({ where: { employeeId: empTham.id } })
    await prisma.employeeDocument.createMany({
        data: [
            {
                employeeId: empTham.id,
                docType: 'CONTRACT',
                title: 'HĐLĐ 1 năm - Triệu Thị Thắm (Sắp hết hạn)',
                docNumber: 'HĐLĐ-2025/11/SLS',
                fileUrl: 'https://placehold.co/800x1100/1B2E3D/87CBB9.png?text=HDLD+Trieu+Thi+Tham',
                issueDate: new Date('2025-11-01'),
                expiryDate: contractEndTham,
                status: 'ACTIVE'
            },
            {
                employeeId: empTham.id,
                docType: 'NATIONAL_ID',
                title: 'Bản scan CCCD',
                docNumber: '038197009876',
                fileUrl: 'https://placehold.co/800x600/1B2E3D/87CBB9.png?text=CCCD+Tham',
                issueDate: new Date('2022-03-12'),
                expiryDate: new Date('2037-04-20'),
                status: 'ACTIVE'
            }
        ]
    })

    // 4. Tạo hồ sơ Trần Khánh (Sales Rep)
    const empKhanh = await prisma.employee.upsert({
        where: { code: 'NV-003' },
        update: {
            fullName: 'Trần Khánh',
            userId: khanhUser?.id || null,
            deptId: salesDept.id,
            position: 'Chuyên Viên Kinh Doanh (Sales Rep)',
            phone: '0988 299 999',
            email: 'khanhtran299999@gmail.com',
            gender: 'NAM',
            status: 'ACTIVE',
            startDate: new Date('2025-12-01'),
            officialDate: new Date('2026-02-01'),
            contractType: 'DEFINITE_1Y',
            contractNumber: 'HĐLĐ-2026/02/SLS',
            contractStartDate: new Date('2026-02-01'),
            contractEndDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
            bankAccountNo: '8877665544',
            bankName: 'MB Bank',
            bankAccountHolder: 'TRAN KHANH',
        },
        create: {
            code: 'NV-003',
            fullName: 'Trần Khánh',
            userId: khanhUser?.id || null,
            deptId: salesDept.id,
            position: 'Chuyên Viên Kinh Doanh (Sales Rep)',
            phone: '0988 299 999',
            email: 'khanhtran299999@gmail.com',
            gender: 'NAM',
            status: 'ACTIVE',
            startDate: new Date('2025-12-01'),
            officialDate: new Date('2026-02-01'),
            contractType: 'DEFINITE_1Y',
            contractNumber: 'HĐLĐ-2026/02/SLS',
            contractStartDate: new Date('2026-02-01'),
            contractEndDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
            bankAccountNo: '8877665544',
            bankName: 'MB Bank',
            bankAccountHolder: 'TRAN KHANH',
        }
    })
    console.log(`✓ Đã tạo hồ sơ: ${empKhanh.fullName} (${empKhanh.code})`)

    // 5. Tạo hồ sơ Mai Khánh (Sales Admin - Thử Việc)
    const empMaiKhanh = await prisma.employee.upsert({
        where: { code: 'NV-004' },
        update: {
            fullName: 'Mai Khánh',
            userId: maiKhanhUser?.id || null,
            deptId: salesDept.id,
            position: 'Nhân Viên Điều Phối (Sales Admin)',
            phone: '0933 223 444',
            email: 'maikhanh2234@gmail.com',
            gender: 'NU',
            status: 'PROBATION',
            startDate: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
            contractType: 'PROBATION',
            contractNumber: 'HĐTV-2026/08/SA',
            contractStartDate: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
            contractEndDate: new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000),
            bankAccountNo: '3344556677',
            bankName: 'ACB',
            bankAccountHolder: 'MAI KHANH',
        },
        create: {
            code: 'NV-004',
            fullName: 'Mai Khánh',
            userId: maiKhanhUser?.id || null,
            deptId: salesDept.id,
            position: 'Nhân Viên Điều Phối (Sales Admin)',
            phone: '0933 223 444',
            email: 'maikhanh2234@gmail.com',
            gender: 'NU',
            status: 'PROBATION',
            startDate: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
            contractType: 'PROBATION',
            contractNumber: 'HĐTV-2026/08/SA',
            contractStartDate: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
            contractEndDate: new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000),
            bankAccountNo: '3344556677',
            bankName: 'ACB',
            bankAccountHolder: 'MAI KHANH',
        }
    })
    console.log(`✓ Đã tạo hồ sơ: ${empMaiKhanh.fullName} (${empMaiKhanh.code})`)

    console.log('\n🎉 Hoàn thành seed dữ liệu phân hệ Nhân sự & Giấy tờ!')
}

main().catch(console.error)
