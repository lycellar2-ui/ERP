import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import * as xlsx from 'xlsx'
const { prisma } = require('../src/lib/db')

async function main() {
    const excelPath = "D:\\Lyscellar\\Wiki\\sources\\Master data\\Master Data  - Khách hàng.xlsx"
    console.log(`Đang đọc file Excel từ: ${excelPath}...`)
    
    const workbook = xlsx.readFile(excelPath)
    const sheetName = 'Master Data'
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
        throw new Error(`Không tìm thấy sheet: ${sheetName}`)
    }
    
    const rawRows: any[] = xlsx.utils.sheet_to_json(sheet)
    console.log(`Đọc thành công ${rawRows.length} dòng dữ liệu từ Excel.`)
    
    // Lọc HORECA
    const horecaRows = rawRows.filter(row => {
        const channel = row['Kênh bán']
        return channel && String(channel).trim().toUpperCase() === 'HORECA'
    })
    console.log(`Lọc được ${horecaRows.length} dòng thuộc kênh HORECA.`)
    
    if (horecaRows.length === 0) {
        console.log("Không có dữ liệu HORECA nào để import.")
        return
    }
    
    // ─── BƯỚC 1: XỬ LÝ KHÁCH HÀNG CHA ─────────────────────────────────────
    console.log("\n--- BƯỚC 1: Đang import/cập nhật danh sách khách hàng CHA ---")
    const parentsToImport = new Map<string, { code: string; name: string; brandGroup: string | null }>()
    
    for (const row of horecaRows) {
        const parentCode = row['Mã cha'] ? String(row['Mã cha']).trim() : null
        const parentName = row['Tên công ty cha'] ? String(row['Tên công ty cha']).trim() : null
        const brandGroup = row['Nhóm Thương Hiệu'] ? String(row['Nhóm Thương Hiệu']).trim() : null
        const childCode = row['Mã con'] ? String(row['Mã con']).trim() : null
        const childName = row['Tên nhà hàng/chi nhánh con'] ? String(row['Tên nhà hàng/chi nhánh con']).trim() : null
        
        if (!parentCode) continue
        
        // Nếu parentCode đã thu thập hoặc chưa
        if (!parentsToImport.has(parentCode)) {
            parentsToImport.set(parentCode, {
                code: parentCode,
                name: parentName || childName || parentCode,
                brandGroup: brandGroup
            })
        }
    }
    
    console.log(`Tổng số mã cha duy nhất cần xử lý: ${parentsToImport.size}`)
    
    let parentCount = 0
    for (const [code, p] of parentsToImport) {
        await prisma.customer.upsert({
            where: { code },
            update: {
                name: p.name,
                customerType: 'HORECA',
                channel: 'HORECA',
                brandGroup: p.brandGroup,
                status: 'ACTIVE'
            },
            create: {
                code,
                name: p.name,
                customerType: 'HORECA',
                channel: 'HORECA',
                brandGroup: p.brandGroup,
                status: 'ACTIVE'
            }
        })
        parentCount++
    }
    console.log(`Đã import/cập nhật xong ${parentCount} khách hàng cha.`)
    
    // ─── BƯỚC 2: XỬ LÝ KHÁCH HÀNG CON VÀ LIÊN KẾT ─────────────────────────
    console.log("\n--- BƯỚC 2: Đang import/cập nhật danh sách khách hàng CON ---")
    let childCount = 0
    let addressCount = 0
    
    for (const row of horecaRows) {
        const parentCode = row['Mã cha'] ? String(row['Mã cha']).trim() : null
        const childCode = row['Mã con'] ? String(row['Mã con']).trim() : null
        const childName = row['Tên nhà hàng/chi nhánh con'] ? String(row['Tên nhà hàng/chi nhánh con']).trim() : null
        const taxId = row['Mã số thuế'] ? String(row['Mã số thuế']).trim() : null
        const brandGroup = row['Nhóm Thương Hiệu'] ? String(row['Nhóm Thương Hiệu']).trim() : null
        const address = row['Địa chỉ chính xác'] ? String(row['Địa chỉ chính xác']).trim() : null
        
        if (!childCode || !childName) {
            continue
        }
        
        let parentId: string | null = null
        if (parentCode && parentCode !== childCode) {
            // Lấy ID khách hàng cha
            const parentRecord = await prisma.customer.findUnique({
                where: { code: parentCode }
            })
            if (parentRecord) {
                parentId = parentRecord.id
            } else {
                console.warn(`Cảnh báo: Không tìm thấy khách hàng cha cho mã con ${childCode} (mã cha yêu cầu: ${parentCode})`)
            }
        }
        
        // Upsert child customer
        const customer = await prisma.customer.upsert({
            where: { code: childCode },
            update: {
                name: childName,
                taxId: taxId || null,
                brandGroup: brandGroup || null,
                customerType: 'HORECA',
                channel: 'HORECA',
                parentId: parentId,
                status: 'ACTIVE'
            },
            create: {
                code: childCode,
                name: childName,
                taxId: taxId || null,
                brandGroup: brandGroup || null,
                customerType: 'HORECA',
                channel: 'HORECA',
                parentId: parentId,
                status: 'ACTIVE'
            }
        })
        
        childCount++
        
        // Thao tác với địa chỉ
        if (address && address !== 'NaN') {
            const existingAddress = await prisma.customerAddress.findFirst({
                where: { customerId: customer.id, isDefault: true }
            })
            
            if (existingAddress) {
                await prisma.customerAddress.update({
                    where: { id: existingAddress.id },
                    data: { address }
                })
            } else {
                await prisma.customerAddress.create({
                    data: {
                        customerId: customer.id,
                        label: 'Địa chỉ chính',
                        address,
                        isDefault: true
                    }
                })
            }
            addressCount++
        }
    }
    
    console.log(`Đã import/cập nhật xong ${childCount} khách hàng con.`);
    console.log(`Đã thiết lập địa chỉ mặc định cho ${addressCount} khách hàng.`);
    
    // Đếm tổng số khách hàng hiện tại
    const finalCount = await prisma.customer.count()
    console.log(`\nHoàn thành! Tổng số khách hàng hiện có trong Database: ${finalCount} bản ghi.`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
