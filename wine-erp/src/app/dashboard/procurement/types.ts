import { z } from 'zod'
import { StepRoleConfig } from '@/app/dashboard/settings/approval-matrix/constants'

// ─── Types ────────────────────────────────────────
export type POShipmentSummary = {
    id: string
    billOfLading: string
    vesselName: string | null
    voyageNo: string | null
    containerNo: string | null
    containerType: string | null
    eta: Date | null
    etd: Date | null
    portOfLoading: string | null
    portOfDischarge: string | null
    status: string
    milestoneProgress: number
}

export type POApprovalLog = {
    id: string
    step?: number
    action: string
    actorName: string
    comment: string | null
    createdAt: Date
}

export type POStepConfig = StepRoleConfig

export type PORow = {
    id: string
    poNo: string
    legalEntityId?: string
    legalEntityCode?: string | null
    legalEntityName?: string | null
    supplierName: string
    supplierId: string
    supplierCode?: string | null
    supplierCountry?: string | null
    incoterms?: string | null
    paymentTerm?: string | null
    currency: string
    exchangeRate: number
    status: string
    currentApprovalStep?: number
    totalApprovalSteps?: number
    totalAmount: number
    lineCount: number
    totalQty: number
    totalQtyReceived: number
    receivedPercentage: number
    estimatedDelivery?: Date | null
    creatorName?: string | null
    docCount?: number
    documents?: { id: string; name: string; fileUrl: string; uploadedAt: Date }[]
    shipments: POShipmentSummary[]
    latestShipment?: POShipmentSummary | null
    createdAt: Date
}

export type PODetail = PORow & {
    currentApprovalStep: number
    totalApprovalSteps: number
    approvalSteps: POStepConfig[]
    approvalHistory: POApprovalLog[]
    lines: {
        id: string
        productId: string
        productName: string
        skuCode: string
        qtyOrdered: number
        unitPrice: number
        uom: string
        lineTotal: number
    }[]
}

// ─── Schema ───────────────────────────────────────
export const poLineSchema = z.object({
    productId: z.string().min(1),
    qtyOrdered: z.number().positive(),
    unitPrice: z.number().positive(),
    uom: z.string().default('BOTTLE'),
})

export const createPOSchema = z.object({
    supplierId: z.string().min(1, 'Chọn nhà cung cấp'),
    currency: z.enum(['USD', 'EUR', 'GBP', 'NZD', 'AUD']).default('USD'),
    exchangeRate: z.number().positive().default(25000),
    lines: z.array(poLineSchema).min(1, 'Cần ít nhất 1 dòng sản phẩm'),
})

export type CreatePOInput = z.infer<typeof createPOSchema>

export type POCurrencyBreakdown = {
    poId: string
    poNo: string
    currency: string
    exchangeRate: number
    totalForeign: number
    totalVND: number
    lines: {
        skuCode: string
        productName: string
        qty: number
        unitPriceForeign: number
        unitPriceVND: number
        lineTotalForeign: number
        lineTotalVND: number
    }[]
}
