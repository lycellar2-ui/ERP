import { notFound } from 'next/navigation'
import { getQuotationByToken } from './actions'
import { QuotationPublicView } from './QuotationPublicView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const qt = await getQuotationByToken(token)
    if (!qt) return { title: 'Báo giá không tồn tại' }
    return {
        title: `Báo Giá ${qt.quotationNo} — LY's Cellars`,
        description: `Báo giá rượu vang cho ${qt.customer.name}`,
    }
}

export default async function QuotationPublicPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const qt = await getQuotationByToken(token)
    if (!qt) notFound()

    const isExpired = qt.validUntil < new Date()
    const isActionable = (qt.status === 'DRAFT' || qt.status === 'SENT') && !isExpired

    // Serialize for client
    const data = {
        id: qt.id,
        quotationNo: qt.quotationNo,
        status: qt.status as string,
        channel: qt.channel as string,
        paymentTerm: qt.paymentTerm,
        totalAmount: Number(qt.totalAmount),
        orderDiscount: Number(qt.orderDiscount),
        validUntil: qt.validUntil.toISOString(),
        notes: qt.notes,
        terms: qt.terms,
        deliveryTerms: qt.deliveryTerms,
        vatIncluded: qt.vatIncluded,
        companyName: qt.companyName,
        contactPerson: qt.contactPerson,
        createdAt: qt.createdAt.toISOString(),
        customerName: qt.customer.name,
        customerCode: qt.customer.code,
        salesRepName: qt.salesRep.name,
        salesRepEmail: qt.salesRep.email,
        isExpired,
        isActionable,
        lines: qt.lines.map((l, i) => {
            const unitPrice = Number(l.unitPrice)
            const qty = Number(l.qtyOrdered)
            const disc = Number(l.lineDiscountPct)
            const lineTotal = qty * unitPrice * (1 - disc / 100)
            return {
                index: i + 1,
                productName: l.product.productName,
                skuCode: l.product.skuCode,
                wineType: l.product.wineType as string,
                volumeMl: l.product.volumeMl,
                vintage: l.product.vintage,
                country: l.product.country,
                abvPercent: Number(l.product.abvPercent),
                tastingNotes: l.product.tastingNotes,
                classification: l.product.classification,
                producerName: l.product.producer?.name,
                appellationName: l.product.appellation?.name,
                regionName: l.product.appellation?.region,
                imageUrl: l.product.media?.[0]?.url || l.product.media?.[0]?.thumbnailUrl || null,
                awards: l.product.awards?.map(a => ({
                    source: a.source,
                    score: a.score ? Number(a.score) : null,
                    medal: a.medal as string | null,
                })) || [],
                qty,
                unitPrice,
                discountPct: disc,
                lineTotal,
            }
        }),
    }

    return <QuotationPublicView data={data as any} token={token} />
}
