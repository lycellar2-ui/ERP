import { prisma } from '../src/lib/db'

async function run() {
    const parentCode = 'HR10026'
    const childCode = 'HR10026-01'

    const parent = await prisma.customer.findUnique({ where: { code: parentCode } })
    const child = await prisma.customer.findUnique({ where: { code: childCode } })

    const customers = [parent, child].filter(Boolean)
    if (customers.length === 0) {
        console.error('Customer LukLak not found')
        return
    }

    console.log(`Found customers: ${customers.map(c => `${c?.code} (${c?.name})`).join(', ')}`)

    const adminUser = await prisma.user.findFirst({ where: { status: 'ACTIVE' } })
    const userId = adminUser?.id ?? 'system'

    const products = await prisma.product.findMany({ select: { id: true, skuCode: true, productName: true } })
    console.log(`Applying 5% discount across ${products.length} products for LukLak...`)

    const startDate = new Date('2026-01-01T00:00:00.000Z')
    const endDate = new Date('2026-08-31T23:59:59.999Z')

    let count = 0
    for (const cust of customers) {
        if (!cust) continue
        for (const prod of products) {
            const existing = await prisma.customerPriceRule.findFirst({
                where: { customerId: cust.id, productId: prod.id }
            })

            if (existing) {
                await prisma.customerPriceRule.update({
                    where: { id: existing.id },
                    data: {
                        ruleType: 'FIXED_DISCOUNT',
                        value: 5,
                        startDate,
                        endDate,
                        status: 'APPROVED',
                        notes: `Cơ chế giá HORECA giảm 5% cho ${cust.name}`,
                    }
                })
            } else {
                await prisma.customerPriceRule.create({
                    data: {
                        customerId: cust.id,
                        productId: prod.id,
                        ruleType: 'FIXED_DISCOUNT',
                        value: 5,
                        startDate,
                        endDate,
                        status: 'APPROVED',
                        requestedBy: userId,
                        approvedBy: userId,
                        approvedAt: new Date(),
                        notes: `Cơ chế giá HORECA giảm 5% cho ${cust.name}`,
                    }
                })
            }
            count++
        }
    }

    const proposalNo = 'TT-2026-LUKLAK-5PCT'
    const existingProp = await prisma.proposal.findFirst({ where: { proposalNo } })

    if (!existingProp) {
        await prisma.proposal.create({
            data: {
                proposalNo,
                category: 'PRICE_ADJUSTMENT',
                priority: 'HIGH',
                title: 'Đề xuất cơ chế giá giảm 5% HORECA cho LukLak Restaurant',
                content: 'Áp dụng mức chiết khấu 5% so với bảng giá HORECA tiêu chuẩn cho toàn bộ sản phẩm của LukLak Restaurant.',
                justification: 'Khách hàng LukLak là đối tác chiến lược cam kết doanh số cao trong năm 2026.',
                expectedOutcome: 'Tăng 25% sản lượng tiêu thụ dòng vang cao cấp.',
                status: 'APPROVED',
                currentLevel: 3,
                createdBy: userId,
                customerId: child?.id ?? parent?.id ?? null,
                scope: 'ENTIRE_PORTFOLIO',
                discountPct: 5,
                submittedAt: new Date(),
                resolvedAt: new Date(),
            }
        })
        console.log(`Created proposal ${proposalNo}`)
    } else {
        await prisma.proposal.update({
            where: { id: existingProp.id },
            data: {
                status: 'APPROVED',
                discountPct: 5,
                scope: 'ENTIRE_PORTFOLIO',
            }
        })
    }

    console.log(`SUCCESS: Created/updated ${count} price rules (5% discount) for LukLak!`)
}

run().then(() => prisma.$disconnect())
