/**
 * Seed Sales Pipeline Data
 * Run: npx tsx scripts/seed-pipeline.ts
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import { prisma } from '../src/lib/db'

async function main() {
    console.log('🌱 Seeding Sales Pipeline data...')

    // Get existing users and customers
    const users = await prisma.user.findMany({ take: 5, select: { id: true, name: true } })
    const customers = await prisma.customer.findMany({ take: 20, where: { deletedAt: null }, select: { id: true, name: true } })

    if (users.length === 0 || customers.length === 0) {
        console.log('❌ Need at least 1 user and 1 customer. Run other seeds first.')
        return
    }

    const stages = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const
    const now = new Date()

    // Wine deal templates
    const deals = [
        // LEAD stage
        { name: 'Bordeaux 2022 En Primeur — Mua 500 thùng', value: 850_000_000, stage: 'LEAD', prob: 15, daysAgo: 2 },
        { name: 'Champagne Dom Pérignon 2015 — Đại lý Đà Nẵng', value: 420_000_000, stage: 'LEAD', prob: 20, daysAgo: 5 },
        { name: 'Brunello di Montalcino — Khách hàng mới Q3', value: 180_000_000, stage: 'LEAD', prob: 10, daysAgo: 1 },
        { name: 'Prosecco DOCG — Chuỗi nhà hàng HCM', value: 95_000_000, stage: 'LEAD', prob: 25, daysAgo: 7 },
        { name: 'Riesling Alsace — Hotel 5 sao Nha Trang', value: 65_000_000, stage: 'LEAD', prob: 15, daysAgo: 3 },

        // QUALIFIED
        { name: 'Opus One 2021 — VIP client portfolio', value: 1_200_000_000, stage: 'QUALIFIED', prob: 35, daysAgo: 12 },
        { name: 'Penfolds Grange 2019 — Distributor Hà Nội', value: 780_000_000, stage: 'QUALIFIED', prob: 40, daysAgo: 8 },
        { name: 'Barolo DOCG 2018 — Wine club subscription', value: 320_000_000, stage: 'QUALIFIED', prob: 30, daysAgo: 15 },
        { name: 'NZ Sauvignon Blanc — Chuỗi siêu thị', value: 150_000_000, stage: 'QUALIFIED', prob: 45, daysAgo: 10 },

        // PROPOSAL
        { name: 'Château Margaux 2019 — Park Hyatt dinner', value: 2_100_000_000, stage: 'PROPOSAL', prob: 55, daysAgo: 20 },
        { name: 'Super Tuscan — Private label cho InterCon', value: 450_000_000, stage: 'PROPOSAL', prob: 60, daysAgo: 18 },
        { name: 'Burgundy Grand Cru — Wine investment fund', value: 3_500_000_000, stage: 'PROPOSAL', prob: 50, daysAgo: 25 },
        { name: 'Rioja Reserva — Nhà hàng Tây Ban Nha HN', value: 120_000_000, stage: 'PROPOSAL', prob: 65, daysAgo: 14 },

        // NEGOTIATION
        { name: 'Collection Bordeaux 1er Cru — Wedding planner', value: 680_000_000, stage: 'NEGOTIATION', prob: 75, daysAgo: 30 },
        { name: 'Moët & Chandon bulk — Tết 2027 pre-order', value: 1_500_000_000, stage: 'NEGOTIATION', prob: 80, daysAgo: 22 },
        { name: 'Premium Italian selection — JW Marriott HCM', value: 350_000_000, stage: 'NEGOTIATION', prob: 70, daysAgo: 28 },

        // WON (recent wins)
        { name: 'Sassicaia 2020 — The Wine Room Saigon', value: 920_000_000, stage: 'WON', prob: 100, daysAgo: 5 },
        { name: 'Pétrus 2018 — Private collector HN', value: 4_200_000_000, stage: 'WON', prob: 100, daysAgo: 10 },
        { name: 'Chilean Carménère — Chuỗi nhà hàng BBQ', value: 85_000_000, stage: 'WON', prob: 100, daysAgo: 15 },
        { name: 'Amarone della Valpolicella — Khách VIP', value: 240_000_000, stage: 'WON', prob: 100, daysAgo: 8 },

        // LOST
        { name: 'Chablis Grand Cru — Hotel Metropole HN (giá cao)', value: 380_000_000, stage: 'LOST', prob: 0, daysAgo: 20 },
        { name: 'Argentinian Malbec — Competitor won (giá thấp hơn)', value: 200_000_000, stage: 'LOST', prob: 0, daysAgo: 35 },
        { name: 'Loire Valley mix — Budget cut by client', value: 150_000_000, stage: 'LOST', prob: 0, daysAgo: 40 },
    ]

    let created = 0
    for (const deal of deals) {
        const customer = customers[Math.floor(Math.random() * customers.length)]
        const user = users[Math.floor(Math.random() * users.length)]
        const closeDate = new Date(now)
        closeDate.setDate(closeDate.getDate() + (deal.stage === 'WON' || deal.stage === 'LOST' ? -deal.daysAgo : 30 + Math.random() * 60))

        const createdAt = new Date(now)
        createdAt.setDate(createdAt.getDate() - deal.daysAgo)

        await prisma.salesOpportunity.create({
            data: {
                customerId: customer.id,
                name: deal.name,
                expectedValue: deal.value,
                stage: deal.stage as any,
                probability: deal.prob,
                assignedTo: user.id,
                closeDate,
                notes: `Deal tạo tự động cho testing AI Pipeline Analysis. ${deal.stage === 'LOST' ? 'Lý do thua: ' + deal.name.split('(')[1]?.replace(')', '') : ''}`,
                createdAt,
                updatedAt: createdAt,
            },
        })
        created++
    }

    console.log(`✅ Created ${created} pipeline opportunities`)

    // Summary
    const byStage = await prisma.salesOpportunity.groupBy({
        by: ['stage'],
        _count: { _all: true },
        _sum: { expectedValue: true },
    })

    console.log('\n📊 Pipeline Summary:')
    for (const s of byStage) {
        console.log(`  ${s.stage}: ${s._count._all} deals · ${Number(s._sum.expectedValue ?? 0).toLocaleString()} VND`)
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit(0))
