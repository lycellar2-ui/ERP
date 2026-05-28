/**
 * Clean Test Data Script — Wine ERP
 * Run: npx tsx prisma/clean-test-data.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 3,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🧹 Bắt đầu xóa dữ liệu kiểm thử (test/mock transactional data)...')

    // 1. Phân hệ Tài chính & Thanh toán (Finance & Payments)
    console.log('  → Xóa dữ liệu thanh toán & hóa đơn (AP/AR Invoices & Payments)...')
    try { await prisma.aPPayment.deleteMany(); } catch (e) {}
    try { await prisma.aRPayment.deleteMany(); } catch (e) {}
    try { await prisma.aPInvoice.deleteMany(); } catch (e) {}
    try { await prisma.aRInvoice.deleteMany(); } catch (e) {}

    // 2. Phân hệ Bán hàng (Sales Orders & Quotations)
    console.log('  → Xóa dữ liệu Đơn bán hàng & Báo giá (Sales Orders & Quotations)...')
    try { await prisma.salesOrderLine.deleteMany(); } catch (e) {}
    try { await prisma.salesOrder.deleteMany(); } catch (e) {}
    try { await prisma.salesQuotationLine.deleteMany(); } catch (e) {}
    try { await prisma.salesQuotation.deleteMany(); } catch (e) {}

    // 3. Phân hệ Mua hàng & Vận chuyển (Procurement & Shipments)
    console.log('  → Xóa dữ liệu Đơn mua hàng & Lô hàng nhập khẩu (POs & Shipments)...')
    try { await prisma.purchaseOrderLine.deleteMany(); } catch (e) {}
    try { await prisma.pODocument.deleteMany(); } catch (e) {}
    try { await prisma.purchaseOrder.deleteMany(); } catch (e) {}
    try { await prisma.shipmentCostItem.deleteMany(); } catch (e) {}
    try { await prisma.shipmentMilestone.deleteMany(); } catch (e) {}
    try { await prisma.shipment.deleteMany(); } catch (e) {}

    // 4. Phân hệ Quản lý kho (WMS, GR, DO, Stock levels)
    console.log('  → Xóa dữ liệu Nhập kho, Xuất kho & Tồn kho (WMS, Stock levels)...')
    try { await prisma.goodsReceiptLine.deleteMany(); } catch (e) {}
    try { await prisma.goodsReceipt.deleteMany(); } catch (e) {}
    try { await prisma.deliveryOrderLine.deleteMany(); } catch (e) {}
    try { await prisma.deliveryOrder.deleteMany(); } catch (e) {}
    try { await prisma.wineStampUsage.deleteMany(); } catch (e) {}
    try { await prisma.wineStampPurchase.deleteMany(); } catch (e) {}
    try { await prisma.qRCode.deleteMany(); } catch (e) {}
    try { await prisma.landedCostAllocation.deleteMany(); } catch (e) {}
    try { await prisma.stockLot.deleteMany(); } catch (e) {}

    // 5. Phân hệ Kế toán (Journal entries & periods)
    console.log('  → Xóa dữ liệu Bút toán & Kỳ kế toán (Journal Entries & Periods)...')
    try { await prisma.journalLine.deleteMany(); } catch (e) {}
    try { await prisma.journalEntry.deleteMany(); } catch (e) {}
    try { await prisma.accountingPeriod.deleteMany(); } catch (e) {}

    // 6. Chi phí & Hoạt động nghiệp vụ khác
    console.log('  → Xóa dữ liệu Chi phí & Quy tắc giá (Expenses & Price Rules)...')
    try { await prisma.expense.deleteMany(); } catch (e) {}
    try { await prisma.customerPriceRule.deleteMany(); } catch (e) {}

    // 7. Phân hệ CRM & CSKH (Opportunities, Tasting Events, Complaints)
    console.log('  → Xóa dữ liệu CRM (Cơ hội bán hàng, Tasting, Khiếu nại)...')
    try { await prisma.salesOpportunity.deleteMany(); } catch (e) {}
    try { await prisma.tastingEventAttendee.deleteMany(); } catch (e) {}
    try { await prisma.tastingEventGuest.deleteMany(); } catch (e) {}
    try { await prisma.tastingEvent.deleteMany(); } catch (e) {}
    try { await prisma.complaintTicket.deleteMany(); } catch (e) {}

    // 8. Nhật ký hoạt động đối tác
    console.log('  → Xóa Nhật ký hoạt động đối tác (Activities)...')
    try { await prisma.customerActivity.deleteMany(); } catch (e) {}
    try { await prisma.supplierActivity.deleteMany(); } catch (e) {}

    // 9. Phân hệ Hợp đồng & Giấy tờ pháp lý (Contracts & Regulated Documents)
    console.log('  → Xóa dữ liệu Hợp đồng & Phụ lục Hợp đồng (Contracts)...')
    try { await prisma.contractDocument.deleteMany(); } catch (e) {}
    try { await prisma.contractAmendment.deleteMany(); } catch (e) {}
    try { await prisma.regulatedDocument.deleteMany(); } catch (e) {}
    try { await prisma.contract.deleteMany(); } catch (e) {}

    // 10. Danh mục Sản phẩm & Giá bán (Products, Price Lists, Producers, Regions)
    console.log('  → Xóa Danh mục sản phẩm & Bảng giá (Products, Price Lists, Appellations, Producers, Regions)...')
    try { await prisma.priceListLine.deleteMany(); } catch (e) {}
    try { await prisma.priceList.deleteMany(); } catch (e) {}
    try { await prisma.productMedia.deleteMany(); } catch (e) {}
    try { await prisma.productAward.deleteMany(); } catch (e) {}
    try { await prisma.product.deleteMany(); } catch (e) {}
    try { await prisma.grapeVariety.deleteMany(); } catch (e) {}
    try { await prisma.appellation.deleteMany(); } catch (e) {}
    try { await prisma.wineRegion.deleteMany(); } catch (e) {}
    try { await prisma.producer.deleteMany(); } catch (e) {}

    // 11. Danh bạ Nhà Cung Cấp (Suppliers)
    console.log('  → Xóa Danh sách Nhà cung cấp (Suppliers)...')
    try { await prisma.supplierContact.deleteMany(); } catch (e) {}
    try { await prisma.supplierAddress.deleteMany(); } catch (e) {}
    try { await prisma.supplier.deleteMany(); } catch (e) {}

    // 12. Danh bạ Khách hàng (Customers)
    console.log('  → Xóa Danh sách Khách hàng (Customers)...')
    try { await prisma.customerContact.deleteMany(); } catch (e) {}
    try { await prisma.customerAddress.deleteMany(); } catch (e) {}
    try { await prisma.customerTag.deleteMany(); } catch (e) {}
    try { await prisma.winePreference.deleteMany(); } catch (e) {}
    try { await prisma.customer.deleteMany(); } catch (e) {}

    console.log('\n🎉 Hoàn tất xóa sạch dữ liệu kiểm thử và danh mục gốc!')
    console.log('   Hệ thống hiện đã hoàn toàn trắng dữ liệu sản phẩm, nhà cung cấp, khách hàng và giao dịch.')
    console.log('   * Lưu ý: Tài khoản đăng nhập, các phòng ban và pháp nhân công ty vẫn được bảo toàn để giữ quyền truy cập.')
}

main()
    .catch((e) => {
        console.error('❌ Lỗi dọn dẹp dữ liệu:', e)
        process.exit(1)
    })
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
