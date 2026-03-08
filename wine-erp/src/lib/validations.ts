// Shared Zod validation schemas for all modules

import { z } from 'zod'

// ═══════════════════════════════════════════════════
// SHARED VALIDATORS
// ═══════════════════════════════════════════════════

export const idSchema = z.string().uuid('ID không hợp lệ')
export const positiveNumber = z.number().positive('Giá trị phải > 0')
export const nonNegativeNumber = z.number().min(0, 'Giá trị không được âm')
export const percentSchema = z.number().min(0).max(100, 'Phần trăm phải từ 0-100')

// ═══════════════════════════════════════════════════
// SALES MODULE
// ═══════════════════════════════════════════════════

export const SalesChannelSchema = z.enum(['HORECA', 'AGENCY', 'RETAIL', 'POS'])

export const SOLineCreateSchema = z.object({
    productId: idSchema,
    qtyOrdered: z.number().int().positive('Số lượng phải > 0'),
    unitPrice: positiveNumber,
    lineDiscountPct: percentSchema.optional(),
})

export const SOCreateSchema = z.object({
    customerId: idSchema,
    salesRepId: idSchema,
    channel: SalesChannelSchema,
    paymentTerm: z.string().min(1, 'Phải chọn điều khoản thanh toán'),
    shippingAddressId: idSchema.optional(),
    orderDiscount: percentSchema.optional(),
    notes: z.string().max(1000).optional(),
    lines: z.array(SOLineCreateSchema).min(1, 'Đơn hàng phải có ít nhất 1 dòng'),
})

// ═══════════════════════════════════════════════════
// FINANCE MODULE
// ═══════════════════════════════════════════════════

export const ARPaymentCreateSchema = z.object({
    invoiceId: idSchema,
    amount: positiveNumber,
    paymentDate: z.string().min(1),
    method: z.enum(['BANK_TRANSFER', 'CASH', 'COD', 'QR']),
    reference: z.string().max(100).optional(),
})

export const ExpenseCreateSchema = z.object({
    category: z.string().min(1, 'Phải chọn danh mục'),
    amount: positiveNumber,
    description: z.string().min(1, 'Chưa nhập mô tả').max(500),
    date: z.string().min(1),
    vendorName: z.string().max(200).optional(),
    receiptUrl: z.string().url().optional(),
})

export const JournalEntrySchema = z.object({
    date: z.string().min(1),
    description: z.string().min(1).max(500),
    entries: z.array(z.object({
        accountCode: z.string().min(1),
        debit: nonNegativeNumber,
        credit: nonNegativeNumber,
    })).min(2, 'Bút toán cần ít nhất 2 dòng'),
})

// ═══════════════════════════════════════════════════
// PROCUREMENT MODULE
// ═══════════════════════════════════════════════════

export const POLineCreateSchema = z.object({
    productId: idSchema,
    qty: z.number().int().positive('Số lượng phải > 0'),
    unitCostCIF: positiveNumber,
})

export const POCreateSchema = z.object({
    supplierId: idSchema,
    contractId: idSchema.optional(),
    currency: z.enum(['VND', 'USD', 'EUR']).default('USD'),
    paymentTerm: z.string().min(1),
    notes: z.string().max(1000).optional(),
    lines: z.array(POLineCreateSchema).min(1, 'PO phải có ít nhất 1 dòng'),
})

// ═══════════════════════════════════════════════════
// MASTER DATA MODULE
// ═══════════════════════════════════════════════════

export const ProductCreateSchema = z.object({
    name: z.string().min(1, 'Chưa nhập tên sản phẩm').max(300),
    skuCode: z.string().min(1, 'Chưa nhập SKU').max(50),
    category: z.string().min(1),
    country: z.string().min(1),
    region: z.string().optional(),
    vintage: z.number().int().min(1900).max(2030).optional(),
    abv: z.number().min(0).max(100).optional(),
    volumeMl: z.number().int().positive().optional(),
    grapeVariety: z.string().optional(),
    description: z.string().max(2000).optional(),
})

export const CustomerCreateSchema = z.object({
    name: z.string().min(1, 'Chưa nhập tên khách hàng').max(300),
    code: z.string().min(1).max(20),
    email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
    phone: z.string().max(20).optional(),
    address: z.string().max(500).optional(),
    taxCode: z.string().max(20).optional(),
    creditLimit: nonNegativeNumber.optional(),
    channel: SalesChannelSchema.optional(),
})

export const SupplierCreateSchema = z.object({
    name: z.string().min(1, 'Chưa nhập tên NCC').max(300),
    code: z.string().min(1).max(20),
    country: z.string().min(1),
    contactEmail: z.string().email().optional().or(z.literal('')),
    contactPhone: z.string().max(20).optional(),
    paymentTerms: z.string().optional(),
})

// ═══════════════════════════════════════════════════
// WAREHOUSE MODULE
// ═══════════════════════════════════════════════════

export const StockAdjustSchema = z.object({
    stockLotId: idSchema,
    adjustQty: z.number().int().refine(v => v !== 0, 'Số lượng điều chỉnh ≠ 0'),
    reason: z.string().min(1, 'Chưa nhập lý do').max(500),
})

export const TransferCreateSchema = z.object({
    fromWarehouseId: idSchema,
    toWarehouseId: idSchema,
    lines: z.array(z.object({
        stockLotId: idSchema,
        qty: z.number().int().positive(),
    })).min(1),
}).refine(d => d.fromWarehouseId !== d.toWarehouseId, {
    message: 'Kho xuất và kho nhận phải khác nhau',
})

// ═══════════════════════════════════════════════════
// CRM MODULE
// ═══════════════════════════════════════════════════

export const PipelineDealSchema = z.object({
    customerId: idSchema,
    title: z.string().min(1).max(200),
    value: nonNegativeNumber,
    stage: z.string().min(1),
    expectedCloseDate: z.string().optional(),
    notes: z.string().max(1000).optional(),
})

export const CRMActivitySchema = z.object({
    customerId: idSchema,
    type: z.enum(['CALL', 'EMAIL', 'MEETING', 'TASTING', 'DELIVERY', 'COMPLAINT', 'OTHER']),
    description: z.string().min(1, 'Chưa nhập mô tả').max(1000),
    performedBy: z.string().min(1),
})

export const CRMContactSchema = z.object({
    customerId: idSchema,
    name: z.string().min(1, 'Chưa nhập tên').max(200),
    title: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
    email: z.string().email().optional().or(z.literal('')),
    isPrimary: z.boolean().optional(),
})

export const CRMComplaintSchema = z.object({
    customerId: idSchema,
    subject: z.string().min(1, 'Chưa nhập tiêu đề').max(300),
    description: z.string().min(1).max(2000),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    assignedTo: z.string().optional(),
})

export const CRMTastingEventSchema = z.object({
    name: z.string().min(1).max(200),
    date: z.string().min(1),
    venue: z.string().min(1).max(300),
    maxGuests: z.number().int().positive().max(500),
    description: z.string().max(2000).optional(),
})

// ═══════════════════════════════════════════════════
// POS MODULE
// ═══════════════════════════════════════════════════

export const POSPaymentSchema = z.object({
    method: z.enum(['CASH', 'BANK_TRANSFER', 'QR']),
    amountReceived: nonNegativeNumber,
    customerId: idSchema.optional(),
    lines: z.array(z.object({
        productId: idSchema,
        qty: z.number().int().positive(),
        unitPrice: positiveNumber,
    })).min(1, 'Giỏ hàng trống'),
})

// ═══════════════════════════════════════════════════
// CONTRACT MODULE
// ═══════════════════════════════════════════════════

export const ContractTypeSchema = z.enum(['PURCHASE', 'SALES', 'CONSIGNMENT', 'LOGISTICS', 'WAREHOUSE'])
export const ContractStatusSchema = z.enum(['ACTIVE', 'EXPIRED', 'TERMINATED'])

export const ContractCreateSchema = z.object({
    contractNo: z.string().min(1, 'Chưa nhập số hợp đồng').max(50),
    type: ContractTypeSchema,
    supplierId: idSchema.optional(),
    customerId: idSchema.optional(),
    value: positiveNumber,
    currency: z.enum(['VND', 'USD', 'EUR']).default('VND'),
    startDate: z.string().min(1, 'Chưa chọn ngày bắt đầu'),
    endDate: z.string().min(1, 'Chưa chọn ngày kết thúc'),
    paymentTerm: z.string().max(100).optional(),
    incoterms: z.string().max(20).optional(),
}).refine(d => d.supplierId || d.customerId, {
    message: 'Phải chọn nhà cung cấp hoặc khách hàng',
})

export const ContractAmendmentSchema = z.object({
    contractId: idSchema,
    newEndDate: z.string().optional(),
    newValue: positiveNumber.optional(),
    reason: z.string().min(1, 'Chưa nhập lý do').max(500),
    fileUrl: z.string().url().optional(),
})

export const DigitalSignatureSchema = z.object({
    contractId: idSchema,
    signerId: z.string().min(1),
    signerRole: z.string().min(1),
    signatureDataUrl: z.string().min(1, 'Chưa ký'),
    ipAddress: z.string().optional(),
})

// ═══════════════════════════════════════════════════
// REGULATED DOCUMENTS MODULE
// ═══════════════════════════════════════════════════

export const RegDocCategorySchema = z.enum([
    'COMPANY_LICENSE', 'IMPORT_DOCUMENT', 'PRODUCT_CERTIFICATION',
    'FACILITY_COMPLIANCE', 'TRADE_AGREEMENT',
])

export const RegDocTypeSchema = z.enum([
    'DISTRIBUTION_LICENSE', 'WHOLESALE_LICENSE', 'RETAIL_LICENSE',
    'IMPORT_LICENSE', 'BUSINESS_REGISTRATION', 'FOOD_SAFETY_CERT',
    'ADVERTISING_PERMIT', 'FIRE_SAFETY_CERT', 'FIRE_DESIGN_APPROVAL',
    'FIRE_INSPECTION_CERT', 'WAREHOUSE_LICENSE', 'ENVIRONMENT_CERT',
    'WAREHOUSE_LEASE', 'TEMPERATURE_CALIBRATION',
    'CERTIFICATE_OF_ORIGIN', 'QUALITY_TEST_REPORT',
    'CUSTOMS_DECLARATION_CERT', 'FOOD_SAFETY_LOT', 'INSURANCE_POLICY_DOC',
    'WINE_STAMP_CERT', 'HEALTH_CERTIFICATE', 'FREE_SALE_CERTIFICATE',
    'PHYTOSANITARY_CERT', 'QUALITY_DECLARATION', 'VIETNAMESE_LABEL',
    'STANDARDS_COMPLIANCE', 'OTHER',
])

export const RegDocScopeSchema = z.enum([
    'COMPANY', 'SUPPLIER', 'CUSTOMER', 'PRODUCT', 'SHIPMENT', 'LOT',
])

export const RegDocCreateSchema = z.object({
    docNo: z.string().min(1, 'Chưa nhập số giấy tờ').max(50),
    category: RegDocCategorySchema,
    type: RegDocTypeSchema,
    name: z.string().min(1, 'Chưa nhập tên giấy tờ').max(300),
    description: z.string().max(2000).optional(),
    issueDate: z.string().min(1, 'Chưa chọn ngày cấp'),
    effectiveDate: z.string().optional(),
    expiryDate: z.string().optional(),
    issuingAuthority: z.string().max(200).optional(),
    referenceNo: z.string().max(100).optional(),
    scope: RegDocScopeSchema.default('COMPANY'),
    contractId: z.string().optional(),
    supplierId: z.string().optional(),
    customerId: z.string().optional(),
    productId: z.string().optional(),
    shipmentId: z.string().optional(),
    stockLotId: z.string().optional(),
    assignedToId: z.string().optional(),
    alertDays: z.array(z.number().int().positive()).optional(),
})

export const RegDocUpdateSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(300).optional(),
    description: z.string().max(2000).optional(),
    expiryDate: z.string().optional(),
    issuingAuthority: z.string().max(200).optional(),
    referenceNo: z.string().max(100).optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'RENEWED', 'REVOKED']).optional(),
    assignedToId: z.string().optional(),
    alertDays: z.array(z.number().int().positive()).optional(),
})

export const RegDocRenewSchema = z.object({
    originalDocId: z.string().min(1, 'Thiếu ID giấy tờ gốc'),
    newDocNo: z.string().min(1, 'Chưa nhập số mới').max(50),
    issueDate: z.string().min(1),
    expiryDate: z.string().optional(),
    issuingAuthority: z.string().max(200).optional(),
    keepHistory: z.boolean().default(true),
})

// ═══════════════════════════════════════════════════
// DELIVERY MODULE
// ═══════════════════════════════════════════════════

export const DeliveryRouteCreateSchema = z.object({
    routeDate: z.string().min(1, 'Chưa chọn ngày giao'),
    driverId: idSchema,
    vehicleId: idSchema,
})

export const DeliveryRouteStatusSchema = z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])

export const EPODSchema = z.object({
    stopId: idSchema,
    confirmedBy: z.string().min(1),
    notes: z.string().max(500).optional(),
    signatureUrl: z.string().optional(),
    photoUrl: z.string().optional(),
})

export const DeliveryFailureSchema = z.object({
    stopId: idSchema,
    reason: z.enum(['CUSTOMER_ABSENT', 'WRONG_ADDRESS', 'REFUSED', 'DAMAGED', 'OTHER']),
    notes: z.string().max(500).optional(),
})

export const CODSyncSchema = z.object({
    stopId: idSchema,
    codAmount: positiveNumber,
    collectedBy: z.string().min(1),
    notes: z.string().max(500).optional(),
})

// ═══════════════════════════════════════════════════
// FINANCE EXTENDED
// ═══════════════════════════════════════════════════

export const APPaymentSchema = z.object({
    invoiceId: idSchema,
    amount: positiveNumber,
    method: z.string().min(1),
    reference: z.string().max(200).optional(),
})

export const CODCollectionSchema = z.object({
    soId: idSchema,
    collectedAmount: positiveNumber,
    collectedBy: z.string().min(1),
    notes: z.string().max(500).optional(),
})

export const BadDebtWriteOffSchema = z.object({
    invoiceId: idSchema,
    reason: z.string().min(1, 'Chưa nhập lý do').max(500),
})

// ═══════════════════════════════════════════════════
// POS MODULE
// ═══════════════════════════════════════════════════

export const POSCartItemSchema = z.object({
    productId: z.string().min(1),
    skuCode: z.string().min(1),
    productName: z.string().min(1),
    qty: z.number().int().positive('SL phải > 0'),
    unitPrice: nonNegativeNumber,
    discountPct: percentSchema.default(0),
})

export const POSSaleSchema = z.object({
    items: z.array(POSCartItemSchema).min(1, 'Giỏ hàng trống'),
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'QR']),
    cashReceived: nonNegativeNumber.optional(),
    customerId: z.string().optional(),
    cashierName: z.string().max(100).optional(),
})

export const POSVATInvoiceSchema = z.object({
    soNo: z.string().min(1, 'Thiếu số SO'),
    customerName: z.string().min(1, 'Thiếu tên khách'),
    customerTaxCode: z.string().max(20).optional(),
    customerAddress: z.string().max(500).optional(),
})

export const LoyaltyEarnSchema = z.object({
    customerId: z.string().min(1),
    orderAmount: positiveNumber,
    soNo: z.string().min(1),
})

export const LoyaltyRedeemSchema = z.object({
    customerId: z.string().min(1),
    points: z.number().int().positive('Điểm phải > 0'),
})

// ═══════════════════════════════════════════════════
// WAREHOUSE MODULE
// ═══════════════════════════════════════════════════

export const GoodsReceiptLineSchema = z.object({
    productId: z.string().min(1),
    qtyReceived: z.number().int().positive('SL nhận phải > 0'),
    locationId: z.string().min(1),
    unitLandedCost: nonNegativeNumber.optional(),
})

export const GoodsReceiptCreateSchema = z.object({
    poId: z.string().min(1, 'Thiếu PO'),
    warehouseId: z.string().min(1, 'Thiếu kho'),
    shipmentId: z.string().optional(),
    lines: z.array(GoodsReceiptLineSchema).min(1, 'Cần ít nhất 1 dòng nhập'),
})

// ═══════════════════════════════════════════════════
// HELPER: Parse and throw
// ═══════════════════════════════════════════════════

export function parseOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
    const result = schema.safeParse(data)
    if (!result.success) {
        const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
        throw new Error(`Validation failed: ${errors}`)
    }
    return result.data
}
