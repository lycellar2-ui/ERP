/**
 * Seed Sales Pipeline Data (v2 — with stage timing)
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/seed-pipeline.ts
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import { prisma } from '../src/lib/db'

// Stage order for previousStage calculation
const STAGE_ORDER = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const

async function main() {
    console.log('🌱 Seeding Sales Pipeline data (v2 — with stage timing)...')

    // Clean existing
    const deleted = await prisma.salesOpportunity.deleteMany({})
    console.log(`🗑️  Deleted ${deleted.count} existing opportunities`)

    const users = await prisma.user.findMany({ take: 5, select: { id: true, name: true } })
    const customers = await prisma.customer.findMany({ take: 20, where: { deletedAt: null }, select: { id: true, name: true } })

    if (users.length === 0 || customers.length === 0) {
        console.log('❌ Need at least 1 user and 1 customer.')
        return
    }

    const now = new Date()
    const daysAgoDate = (d: number) => { const dt = new Date(now); dt.setDate(dt.getDate() - d); return dt }

    // daysAgo = when deal was created
    // daysInStage = how long it's been at current stage
    // prevStage = what stage it was before
    const deals = [
        // LEAD — newly created, still exploring
        { name: 'Bordeaux 2022 En Primeur — Mua 500 thùng', value: 850_000_000, stage: 'LEAD', prob: 15, daysAgo: 2, daysInStage: 2, prevStage: null },
        { name: 'Champagne Dom Pérignon 2015 — Đại lý Đà Nẵng', value: 420_000_000, stage: 'LEAD', prob: 20, daysAgo: 5, daysInStage: 5, prevStage: null },
        { name: 'Brunello di Montalcino — Khách hàng mới Q3', value: 180_000_000, stage: 'LEAD', prob: 10, daysAgo: 1, daysInStage: 1, prevStage: null },
        { name: 'Prosecco DOCG — Chuỗi nhà hàng HCM', value: 95_000_000, stage: 'LEAD', prob: 25, daysAgo: 14, daysInStage: 14, prevStage: null },
        { name: 'Riesling Alsace — Hotel 5 sao Nha Trang', value: 65_000_000, stage: 'LEAD', prob: 15, daysAgo: 21, daysInStage: 21, prevStage: null },

        // QUALIFIED — moved from LEAD, spent time qualifying
        { name: 'Opus One 2021 — VIP client portfolio', value: 1_200_000_000, stage: 'QUALIFIED', prob: 35, daysAgo: 25, daysInStage: 8, prevStage: 'LEAD' },
        { name: 'Penfolds Grange 2019 — Distributor Hà Nội', value: 780_000_000, stage: 'QUALIFIED', prob: 40, daysAgo: 18, daysInStage: 5, prevStage: 'LEAD' },
        { name: 'Barolo DOCG 2018 — Wine club subscription', value: 320_000_000, stage: 'QUALIFIED', prob: 30, daysAgo: 30, daysInStage: 15, prevStage: 'LEAD' },
        { name: 'NZ Sauvignon Blanc — Chuỗi siêu thị', value: 150_000_000, stage: 'QUALIFIED', prob: 45, daysAgo: 20, daysInStage: 3, prevStage: 'LEAD' },

        // PROPOSAL — sent quotation, waiting
        { name: 'Château Margaux 2019 — Park Hyatt dinner', value: 2_100_000_000, stage: 'PROPOSAL', prob: 55, daysAgo: 35, daysInStage: 12, prevStage: 'QUALIFIED' },
        { name: 'Super Tuscan — Private label cho InterCon', value: 450_000_000, stage: 'PROPOSAL', prob: 60, daysAgo: 28, daysInStage: 7, prevStage: 'QUALIFIED' },
        { name: 'Burgundy Grand Cru — Wine investment fund', value: 3_500_000_000, stage: 'PROPOSAL', prob: 50, daysAgo: 40, daysInStage: 18, prevStage: 'QUALIFIED' },
        { name: 'Rioja Reserva — Nhà hàng Tây Ban Nha HN', value: 120_000_000, stage: 'PROPOSAL', prob: 65, daysAgo: 22, daysInStage: 4, prevStage: 'QUALIFIED' },

        // NEGOTIATION — pricing/terms discussion
        { name: 'Collection Bordeaux 1er Cru — Wedding planner', value: 680_000_000, stage: 'NEGOTIATION', prob: 75, daysAgo: 45, daysInStage: 10, prevStage: 'PROPOSAL' },
        { name: 'Moët & Chandon bulk — Tết 2027 pre-order', value: 1_500_000_000, stage: 'NEGOTIATION', prob: 80, daysAgo: 38, daysInStage: 5, prevStage: 'PROPOSAL' },
        { name: 'Premium Italian selection — JW Marriott HCM', value: 350_000_000, stage: 'NEGOTIATION', prob: 70, daysAgo: 42, daysInStage: 14, prevStage: 'PROPOSAL' },
        { name: 'Côtes du Rhône — Wine dinner series', value: 180_000_000, stage: 'NEGOTIATION', prob: 65, daysAgo: 50, daysInStage: 22, prevStage: 'PROPOSAL' },

        // WON — closed deals with full journey
        { name: 'Sassicaia 2020 — The Wine Room Saigon', value: 920_000_000, stage: 'WON', prob: 100, daysAgo: 60, daysInStage: 5, prevStage: 'NEGOTIATION' },
        { name: 'Pétrus 2018 — Private collector HN', value: 4_200_000_000, stage: 'WON', prob: 100, daysAgo: 55, daysInStage: 10, prevStage: 'NEGOTIATION' },
        { name: 'Chilean Carménère — Chuỗi nhà hàng BBQ', value: 85_000_000, stage: 'WON', prob: 100, daysAgo: 30, daysInStage: 15, prevStage: 'NEGOTIATION' },
        { name: 'Amarone della Valpolicella — Khách VIP', value: 240_000_000, stage: 'WON', prob: 100, daysAgo: 25, daysInStage: 8, prevStage: 'NEGOTIATION' },

        // LOST — with reasons
        { name: 'Chablis Grand Cru — Hotel Metropole HN', value: 380_000_000, stage: 'LOST', prob: 0, daysAgo: 35, daysInStage: 5, prevStage: 'PROPOSAL' },
        { name: 'Argentinian Malbec — Competitor won', value: 200_000_000, stage: 'LOST', prob: 0, daysAgo: 50, daysInStage: 15, prevStage: 'NEGOTIATION' },
        { name: 'Loire Valley mix — Budget cut by client', value: 150_000_000, stage: 'LOST', prob: 0, daysAgo: 55, daysInStage: 10, prevStage: 'QUALIFIED' },
    ]

    let created = 0
    for (const deal of deals) {
        const customer = customers[Math.floor(Math.random() * customers.length)]
        const user = users[Math.floor(Math.random() * users.length)]

        const createdAt = daysAgoDate(deal.daysAgo)
        const stageChangedAt = daysAgoDate(deal.daysInStage)
        const closeDate = ['WON', 'LOST'].includes(deal.stage)
            ? stageChangedAt
            : daysAgoDate(-Math.floor(30 + Math.random() * 60))

        const lostReasons: Record<string, string> = {
            'Chablis Grand Cru — Hotel Metropole HN': 'Giá cao hơn đối thủ 15%. Khách chọn nhà cung cấp khác.',
            'Argentinian Malbec — Competitor won': 'Competitor đáp ứng supply chain nhanh hơn 2 tuần.',
            'Loire Valley mix — Budget cut by client': 'Khách cắt ngân sách F&B 30% do giảm booking.',
        }

        await prisma.salesOpportunity.create({
            data: {
                customerId: customer.id,
                name: deal.name,
                expectedValue: deal.value,
                stage: deal.stage as any,
                previousStage: deal.prevStage as any ?? undefined,
                probability: deal.prob,
                assignedTo: user.id,
                closeDate,
                stageChangedAt,
                notes: lostReasons[deal.name] ?? `Total cycle: ${deal.daysAgo}d | In ${deal.stage}: ${deal.daysInStage}d`,
                createdAt,
                updatedAt: stageChangedAt,
            },
        })
        created++
    }

    console.log(`✅ Created ${created} pipeline opportunities with stage timing`)

    // Summary with velocity
    const all = await prisma.salesOpportunity.findMany({
        select: { stage: true, expectedValue: true, createdAt: true, stageChangedAt: true },
    })

    const byStage = new Map<string, { count: number; value: number; avgDaysInStage: number }>()
    for (const o of all) {
        const prev = byStage.get(o.stage) ?? { count: 0, value: 0, avgDaysInStage: 0 }
        const daysInStage = Math.round((now.getTime() - o.stageChangedAt.getTime()) / (1000 * 60 * 60 * 24))
        byStage.set(o.stage, {
            count: prev.count + 1,
            value: prev.value + Number(o.expectedValue),
            avgDaysInStage: prev.avgDaysInStage + daysInStage,
        })
    }

    console.log('\n📊 Pipeline Summary (with velocity):')
    for (const [stage, data] of byStage) {
        const avgDays = Math.round(data.avgDaysInStage / data.count)
        console.log(`  ${stage}: ${data.count} deals · ${data.value.toLocaleString()}đ · Avg ${avgDays}d in stage`)
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit(0))
