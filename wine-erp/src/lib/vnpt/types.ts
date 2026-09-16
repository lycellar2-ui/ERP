/**
 * VNPT e-Invoice V5 Webservice Types (TT78 / NĐ123 / NĐ70)
 */

export interface VnptConfig {
    serviceUrl: string     // URL PublishService.asmx
    portalUrl: string      // URL PortalService.asmx
    businessUrl?: string   // URL BusinessService.asmx
    username: string       // Tài khoản gọi Web Service (ServiceRole)
    password: string       // Mật khẩu Web Service
    account: string        // Tài khoản phát hành (nhân viên)
    acpass: string         // Mật khẩu tài khoản phát hành
    pattern: string        // Mẫu số hóa đơn, vd: '1/001'
    serial: string         // Ký hiệu hóa đơn, vd: 'C26TTA' hoặc 'C26TLY'
    entityCode?: 'TA' | 'LC' // Mã pháp nhân
    entityName?: string    // Tên pháp nhân
    isMock?: boolean       // Chế độ giả lập khi chưa kết nối máy chủ thật
}

export interface InvoiceBuyer {
    buyerName?: string      // Tên người mua hàng (cá nhân)
    companyName: string     // Tên công ty / đơn vị mua hàng
    taxId?: string          // Mã số thuế (bắt buộc nếu là doanh nghiệp)
    address: string         // Địa chỉ
    email?: string          // Email nhận hóa đơn điện tử
    phone?: string          // Số điện thoại
    customerCode?: string   // Mã khách hàng trong ERP
}

export interface InvoiceItem {
    lineNo: number          // STT dòng
    productCode: string     // Mã hàng hóa (SKU)
    productName: string     // Tên hàng hóa
    unit: string            // Đơn vị tính (Chai, Thùng, Hộp...)
    quantity: number        // Số lượng
    unitPrice: number       // Đơn giá trước thuế
    discountPct?: number    // % Chiết khấu dòng
    discountAmount?: number // Số tiền chiết khấu dòng
    amount: number          // Thành tiền trước thuế (đã trừ chiết khấu)
    vatRate: string         // Thuế suất ('10%', '8%', '5%', '0%', 'KCT', 'KKKNT')
    vatAmount: number       // Tiền thuế GTGT dòng
    totalAmount?: number    // Tiền sau thuế
}

export interface InvoicePayload {
    fkey: string            // Khóa duy nhất từ Wine ERP (idempotency key)
    pattern: string         // Mẫu số
    serial: string          // Ký hiệu
    paymentMethod: string   // Hình thức thanh toán: 'TM/CK', 'CK', 'TM'
    buyer: InvoiceBuyer
    items: InvoiceItem[]
    totalNet: number        // Tổng tiền chưa thuế
    totalVat: number        // Tổng tiền thuế GTGT
    totalDiscount?: number  // Tổng tiền chiết khấu
    totalAmount: number     // Tổng tiền thanh toán bằng số
    totalAmountInWords?: string // Tổng tiền viết bằng chữ
    note?: string           // Diễn giải / Ghi chú đơn hàng
}

export interface VnptCallResult {
    success: boolean
    rawResponse?: string
    pattern?: string
    serial?: string
    fkey?: string
    invoiceNo?: string
    errorCode?: string
    errorMessage?: string
}

export interface VnptDraftMetadata {
    fkey: string
    pattern: string
    serial: string
    status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
    uploadedAt: string
    invoiceNo?: string
    fullInvoiceNo?: string
    taxAuthorityCode?: string
    taxStatus?: string
    viewUrl?: string
    pdfUrl?: string
    xmlUrl?: string
    publishedAt?: string
    syncedAt?: string
    xmlSnapshot?: string
    lastError?: string
}

export interface VnptSyncResult {
    success: boolean
    isDraft?: boolean
    invoiceNo?: string
    fullInvoiceNo?: string
    pattern?: string
    serial?: string
    taxAuthorityCode?: string
    taxStatus?: string
    taxStatusText?: string
    viewUrl?: string
    pdfUrl?: string
    xmlUrl?: string
    errorCode?: string
    errorMessage?: string
    rawXml?: string
}

export interface VnptRangeInvoice {
    fkey: string
    invoiceNo: string
    fullInvoiceNo: string
    pattern: string
    serial: string
    taxAuthorityCode: string
    taxStatus: string
    taxStatusText: string
    taxError?: string
}

export interface InvoiceDateWarning {
    hasWarning: boolean
    isDifferentMonth: boolean
    diffDays: number
    orderDateFormatted: string
    invoiceDateFormatted: string
    message: string
    level: 'INFO' | 'WARNING' | 'DANGER'
}


