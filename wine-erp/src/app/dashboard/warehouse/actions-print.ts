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
                            parent: { select: { name: true, taxId: true, vatCompanyName: true } },
                            addresses: { where: { isDefault: true }, take: 1 },
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

    // Build shipping address
    const addr = so.shippingAddress
    const fullAddress = addr
        ? [addr.address, addr.ward, addr.district, addr.city].filter(Boolean).join(', ')
        : 'Nhận tại kho'

    // Map DO lines to SO lines to get pricing
    const soLineMap = new Map(so.lines.map(l => [l.productId, l]))

    return {
        doNo: d.doNo,
        doId: d.id,
        status: d.status,
        createdAt: d.createdAt,
        // SO info
        soNo: so.soNo,
        paymentTerm: so.paymentTerm,
        orderDiscount: Number(so.orderDiscount),
        vatRate: Number(so.vatRate ?? 10),
        // Customer
        customer: {
            name: so.customer.name,
            code: so.customer.code,
            taxId: so.customer.taxId,
            vatCompanyName: so.customer.vatCompanyName,
            channel: so.customer.channel,
            parentTaxId: so.customer.parent?.taxId ?? null,
            parentVatName: so.customer.parent?.vatCompanyName ?? so.customer.parent?.name ?? null,
        },
        // Shipping
        shippingAddress: fullAddress,
        salesRepName: so.salesRep.name,
        // Legal Entity
        legalEntity: so.legalEntity ? {
            name: so.legalEntity.name,
            address: so.legalEntity.address,
            taxId: so.legalEntity.taxId,
            phone: so.legalEntity.phone,
            email: so.legalEntity.email,
            bankAccountName: so.legalEntity.bankAccountName,
            bankAccountNumber: so.legalEntity.bankAccountNumber,
            bankName: so.legalEntity.bankName,
        } : null,
        // Warehouse
        warehouseCode: d.warehouse.code,
        warehouseName: d.warehouse.name,
        // Lines (with pricing from SO)
        lines: d.lines.map(l => {
            const soLine = soLineMap.get(l.productId)
            return {
                productName: l.product.productName,
                skuCode: l.product.skuCode,
                lotNo: l.lot.lotNo,
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
