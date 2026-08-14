'use server'

import { prisma } from '@/lib/db'

export async function getDOPrintDetail(doId: string) {
    const d = await prisma.deliveryOrder.findUnique({
        where: { id: doId },
        include: {
            so: {
                include: {
                    customer: {
                        select: {
                            name: true, code: true, taxId: true,
                            vatCompanyName: true, channel: true,
                            receiverName: true, receiverPhone: true,
                            purchasingName: true, purchasingPhone: true,
                            deliveryNotes: true,
                            parent: { select: { name: true, taxId: true, vatCompanyName: true } },
                            addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }], take: 1 },
                            contacts: { select: { name: true, phone: true, isPrimary: true } },
                        }
                    },
                    legalEntity: {
                        select: {
                            name: true, address: true, taxId: true,
                            phone: true, email: true,
                            bankAccountName: true, bankAccountNumber: true, bankName: true,
                        }
                    },
                    salesRep: { select: { name: true } },
                    shippingAddress: true,
                    lines: {
                        include: { product: { select: { productName: true, skuCode: true, wineType: true } } }
                    },
                }
            },
            warehouse: { select: { code: true, name: true } },
            lines: {
                include: {
                    product: { select: { productName: true, skuCode: true } },
                    lot: { select: { lotNo: true } },
                    location: { select: { locationCode: true, zone: true, rack: true, bin: true } },
                },
            },
        },
    })
    if (!d) return null

    const so = d.so

    // Resolve customer phone
    const primaryContact = so.customer.contacts?.find(c => c.isPrimary)
    const firstContact = so.customer.contacts?.[0]
    const customerPhone = so.customer.receiverPhone || so.customer.purchasingPhone || primaryContact?.phone || firstContact?.phone || null
    const receiverName = so.customer.receiverName || so.customer.name
    const deliveryNotes = so.customer.deliveryNotes || null

    // Build shipping address with fallback to customer's registered address
    const defaultAddr = so.customer.addresses?.[0]
    const addr = so.shippingAddress || defaultAddr
    const fullAddress = addr
        ? [addr.address, addr.ward, addr.district, addr.city].filter(Boolean).join(', ')
        : 'Nhận tại kho'

    // Map DO lines to SO lines to get pricing & vintage
    const soLineMap = new Map(so.lines.map(l => [l.productId, l]))

    // Legal Entity fallback
    const le = so.legalEntity || {
        name: "CÔNG TY CỔ PHẦN THƯƠNG MẠI THẮNG ÂN",
        address: "Số 10 ngõ 52 Giang Văn Minh, Phường Đội Cấn, Q. Ba Đình, TP. Hà Nội",
        taxId: "0316123456",
        phone: "024.3933.8888",
        email: "orders@lyscellars.com",
        bankAccountName: "CÔNG TY CỔ PHẦN THƯƠNG MẠI THẮNG ÂN",
        bankAccountNumber: "1023456789",
        bankName: "Vietcombank (VCB) - Chi nhánh TP. Hà Nội",
    }

    return {
        doNo: d.doNo,
        doId: d.id,
        status: d.status,
        createdAt: d.createdAt,
        // SO info
        soNo: so.soNo,
        paymentTerm: so.paymentTerm,
        orderDiscount: Number(so.orderDiscount ?? 0),
        vatRate: Number(so.vatRate ?? 10),
        soNotes: so.notes ?? null,
        // Customer
        customer: {
            name: so.customer.name,
            code: so.customer.code,
            taxId: so.customer.taxId,
            vatCompanyName: so.customer.vatCompanyName,
            channel: so.customer.channel,
            parentTaxId: so.customer.parent?.taxId ?? null,
            parentVatName: so.customer.parent?.vatCompanyName ?? so.customer.parent?.name ?? null,
            phone: customerPhone,
            receiverPhone: so.customer.receiverPhone ?? null,
            receiverName: receiverName,
            purchasingPhone: so.customer.purchasingPhone ?? null,
            deliveryNotes: deliveryNotes,
        },
        customerPhone,
        receiverName,
        deliveryNotes,
        // Shipping
        shippingAddress: fullAddress,
        salesRepName: so.salesRep?.name ?? '—',
        // Legal Entity
        legalEntity: le,
        // Warehouse
        warehouseCode: d.warehouse.code,
        warehouseName: d.warehouse.name,
        // Lines (with pricing & vintage from SO/lot)
        lines: d.lines.map(l => {
            const soLine = soLineMap.get(l.productId)
            return {
                productName: l.product.productName,
                skuCode: l.product.skuCode,
                lotNo: l.lot.lotNo,
                vintage: (l.lot as any).vintage ?? (soLine as any)?.vintage ?? null,
                locationCode: l.location.locationCode,
                zone: l.location.zone,
                rack: l.location.rack,
                bin: l.location.bin,
                qtyPicked: Number(l.qtyPicked),
                unitPrice: soLine ? Number(soLine.unitPrice) : 0,
                lineDiscountPct: soLine ? Number(soLine.lineDiscountPct) : 0,
            }
        }),
    }
}
