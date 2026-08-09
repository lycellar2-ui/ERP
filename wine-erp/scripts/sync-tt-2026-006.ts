import { prisma } from '../src/lib/db'

export async function syncProposalToCustomerPriceRules(proposalId: string) {
    const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        include: {
            priceItems: true,
            customer: true,
        },
    })

    if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
    }

    if (!proposal.customerId) {
        console.log(`[Sync] Proposal ${proposal.proposalNo} has no customer linked. Skipping.`)
        return { count: 0 }
    }

    const userId = proposal.createdBy ?? 'system'
    const startDate = proposal.resolvedAt ?? proposal.submittedAt ?? new Date()
    const endDate = new Date('2026-12-31T23:59:59.999Z')
    let createdCount = 0

    // 1. Sync specific product prices from priceItems
    for (const item of proposal.priceItems) {
        const proposedPrice = Number(item.proposedPrice)
        if (!proposedPrice || proposedPrice <= 0) continue

        const existing = await prisma.customerPriceRule.findFirst({
            where: {
                customerId: proposal.customerId,
                productId: item.productId,
                status: 'APPROVED',
            },
        })

        const noteText = `Áp dụng từ Tờ trình ${proposal.proposalNo}: ${proposal.title}`

        if (existing) {
            await prisma.customerPriceRule.update({
                where: { id: existing.id },
                data: {
                    ruleType: 'SPECIAL_PRICE',
                    value: proposedPrice,
                    startDate,
                    endDate,
                    approvedBy: userId,
                    approvedAt: new Date(),
                    notes: noteText,
                },
            })
        } else {
            await prisma.customerPriceRule.create({
                data: {
                    customerId: proposal.customerId,
                    productId: item.productId,
                    ruleType: 'SPECIAL_PRICE',
                    value: proposedPrice,
                    startDate,
                    endDate,
                    status: 'APPROVED',
                    requestedBy: userId,
                    approvedBy: userId,
                    approvedAt: new Date(),
                    notes: noteText,
                },
            })
        }
        createdCount++
    }

    // 2. If portfolio discount percentage is specified and scope is ENTIRE_PORTFOLIO or MIXED, create portfolio discount rules for remaining active products
    if (proposal.discountPct && Number(proposal.discountPct) > 0) {
        const discountVal = Number(proposal.discountPct)
        const products = await prisma.product.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: { id: true },
        })

        // Exclude products that already have explicit priceItems in this proposal
        const explicitProductIds = new Set(proposal.priceItems.map(i => i.productId))
        const remainingProducts = products.filter(p => !explicitProductIds.has(p.id))

        for (const prod of remainingProducts) {
            const existing = await prisma.customerPriceRule.findFirst({
                where: {
                    customerId: proposal.customerId,
                    productId: prod.id,
                    status: 'APPROVED',
                },
            })

            const noteText = `Áp dụng chiết khấu ${discountVal}% từ Tờ trình ${proposal.proposalNo}: ${proposal.title}`

            if (existing) {
                if (existing.ruleType === 'FIXED_DISCOUNT') {
                    await prisma.customerPriceRule.update({
                        where: { id: existing.id },
                        data: {
                            ruleType: 'FIXED_DISCOUNT',
                            value: discountVal,
                            startDate,
                            endDate,
                            approvedBy: userId,
                            approvedAt: new Date(),
                            notes: noteText,
                        },
                    })
                }
            } else {
                await prisma.customerPriceRule.create({
                    data: {
                        customerId: proposal.customerId,
                        productId: prod.id,
                        ruleType: 'FIXED_DISCOUNT',
                        value: discountVal,
                        startDate,
                        endDate,
                        status: 'APPROVED',
                        requestedBy: userId,
                        approvedBy: userId,
                        approvedAt: new Date(),
                        notes: noteText,
                    },
                })
                createdCount++
            }
        }
    }

    console.log(`[Sync] Successfully synced proposal ${proposal.proposalNo} into ${createdCount} CustomerPriceRule entries.`)
    return { count: createdCount }
}

async function run() {
    const proposal = await prisma.proposal.findFirst({
        where: { proposalNo: { contains: '006' } },
    })

    if (!proposal) {
        console.error('Proposal TT-2026-006 not found')
        return
    }

    console.log(`Syncing TT-2026-006 (${proposal.id}) for Customer ${proposal.customerId}...`)
    const res = await syncProposalToCustomerPriceRules(proposal.id)
    console.log(`Done! Created/updated price rules count:`, res.count)
}

if (require.main === module) {
    run()
        .then(() => prisma.$disconnect())
        .catch(err => {
            console.error(err)
            prisma.$disconnect()
        })
}
