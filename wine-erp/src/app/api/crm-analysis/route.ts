import { prisma, withRetry } from '@/lib/db'
import { callGemini } from '@/lib/ai-service'
import { NextResponse } from 'next/server'
import { isModuleAiEnabled } from '@/app/dashboard/ai/ai-actions'

export async function POST() {
    try {
        const aiOk = await isModuleAiEnabled('crm')
        if (!aiOk) return NextResponse.json({ success: false, error: 'AI đã bị tắt bởi Admin' }, { status: 403 })
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

        // 1. Full customer data with aggregated metrics
        const customers = await withRetry(() =>
            prisma.customer.findMany({
                where: { deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    customerType: true,
                    channel: true,
                    paymentTerm: true,
                    creditLimit: true,
                    creditHold: true,
                    status: true,
                    salesRep: { select: { name: true } },
                    tags: { select: { tag: true } },
                    contacts: { select: { name: true, isPrimary: true }, take: 1, orderBy: { isPrimary: 'desc' } },
                    winePreference: { select: { grapeVarieties: true, regions: true, tasteProfile: true } },
                    createdAt: true,
                    _count: {
                        select: {
                            salesOrders: true,
                            complaints: true,
                            activities: true,
                            opportunities: true,
                        },
                    },
                },
            })
        )

        // 2. Revenue per customer (all time + this month + last month)
        const revenueData = await withRetry(() =>
            prisma.salesOrder.groupBy({
                by: ['customerId'],
                where: { status: { in: ['CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID'] } },
                _sum: { totalAmount: true },
                _count: true,
            })
        )
        const revenueMap = new Map(revenueData.map(r => [r.customerId, { total: Number(r._sum.totalAmount ?? 0), orders: r._count }]))

        // Revenue this month
        const revenueThisMonth = await withRetry(() =>
            prisma.salesOrder.groupBy({
                by: ['customerId'],
                where: {
                    status: { in: ['CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID'] },
                    createdAt: { gte: monthStart },
                },
                _sum: { totalAmount: true },
            })
        )
        const monthRevMap = new Map(revenueThisMonth.map(r => [r.customerId, Number(r._sum.totalAmount ?? 0)]))

        // Revenue last month
        const revenuePrevMonth = await withRetry(() =>
            prisma.salesOrder.groupBy({
                by: ['customerId'],
                where: {
                    status: { in: ['CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID'] },
                    createdAt: { gte: prevMonthStart, lt: monthStart },
                },
                _sum: { totalAmount: true },
            })
        )
        const prevMonthRevMap = new Map(revenuePrevMonth.map(r => [r.customerId, Number(r._sum.totalAmount ?? 0)]))

        // 3. Last order date per customer
        const lastOrders = await withRetry(() =>
            prisma.salesOrder.groupBy({
                by: ['customerId'],
                _max: { createdAt: true },
            })
        )
        const lastOrderMap = new Map(lastOrders.map(r => [r.customerId, r._max.createdAt]))

        // 4. Open complaints
        const openComplaints = await withRetry(() =>
            prisma.complaintTicket.groupBy({
                by: ['customerId'],
                where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
                _count: true,
            })
        )
        const complaintMap = new Map(openComplaints.map(r => [r.customerId, r._count]))

        // 5. AR Outstanding per customer
        const arData = await withRetry(() =>
            prisma.aRInvoice.groupBy({
                by: ['customerId'],
                where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
                _sum: { totalAmount: true },
            })
        )
        const arMap = new Map(arData.map(r => [r.customerId, Number(r._sum.totalAmount ?? 0)]))

        // 6. Overdue AR
        const overdueAR = await withRetry(() =>
            prisma.aRInvoice.groupBy({
                by: ['customerId'],
                where: { status: 'OVERDUE' },
                _sum: { totalAmount: true },
                _count: true,
            })
        )
        const overdueMap = new Map(overdueAR.map(r => [r.customerId, { amount: Number(r._sum.totalAmount ?? 0), count: r._count }]))

        // 7. Active opportunities
        const opportunities = await withRetry(() =>
            prisma.salesOpportunity.findMany({
                where: { stage: { notIn: ['WON', 'LOST'] } },
                select: {
                    customerId: true,
                    name: true,
                    expectedValue: true,
                    stage: true,
                    probability: true,
                },
            })
        )

        // 8. Recent activities (last 30 days)
        const recentActivities = await withRetry(() =>
            prisma.customerActivity.groupBy({
                by: ['customerId'],
                where: { occurredAt: { gte: thirtyDaysAgo } },
                _count: true,
            })
        )
        const activityMap = new Map(recentActivities.map(r => [r.customerId, r._count]))

        // ── Build enriched customer profiles ──
        function getTier(rev: number): string {
            if (rev >= 5_000_000_000) return 'PLATINUM'
            if (rev >= 2_000_000_000) return 'GOLD'
            if (rev >= 500_000_000) return 'SILVER'
            return 'BRONZE'
        }

        const enriched = customers.map(c => {
            const rev = revenueMap.get(c.id)
            const totalRevenue = rev?.total ?? 0
            const totalOrders = rev?.orders ?? 0
            const monthRev = monthRevMap.get(c.id) ?? 0
            const prevRev = prevMonthRevMap.get(c.id) ?? 0
            const lastOrder = lastOrderMap.get(c.id)
            const complaints = complaintMap.get(c.id) ?? 0
            const ar = arMap.get(c.id) ?? 0
            const overdue = overdueMap.get(c.id)
            const recentAct = activityMap.get(c.id) ?? 0
            const tier = getTier(totalRevenue)

            const daysSinceLastOrder = lastOrder ? Math.round((now.getTime() - new Date(lastOrder).getTime()) / (1000 * 60 * 60 * 24)) : null
            const isChurning = daysSinceLastOrder !== null && daysSinceLastOrder > 60 && totalOrders > 3
            const revGrowth = prevRev > 0 ? ((monthRev - prevRev) / prevRev * 100) : (monthRev > 0 ? 100 : 0)
            const daysSinceCreated = Math.round((now.getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24))

            return {
                name: c.name,
                code: c.code,
                type: c.customerType,
                channel: c.channel,
                tier,
                tags: c.tags.map(t => t.tag),
                salesRep: c.salesRep?.name ?? 'N/A',
                primaryContact: c.contacts[0]?.name ?? 'N/A',
                paymentTerm: c.paymentTerm,
                creditLimit: Number(c.creditLimit),
                creditHold: c.creditHold,
                totalRevenue,
                totalOrders,
                monthRevenue: monthRev,
                prevMonthRevenue: prevRev,
                revenueGrowth: Math.round(revGrowth),
                daysSinceLastOrder,
                isChurning,
                openComplaints: complaints,
                arOutstanding: ar,
                overdueAmount: overdue?.amount ?? 0,
                overdueCount: overdue?.count ?? 0,
                recentActivities: recentAct,
                winePrefs: c.winePreference ? {
                    grapes: c.winePreference.grapeVarieties,
                    regions: c.winePreference.regions,
                    taste: c.winePreference.tasteProfile,
                } : null,
                daysSinceCreated,
                oppCount: c._count.opportunities,
            }
        })

        // ── Aggregate stats ──
        const totalCustomers = enriched.length
        const totalRevenue = enriched.reduce((s, c) => s + c.totalRevenue, 0)
        const totalMonthRev = enriched.reduce((s, c) => s + c.monthRevenue, 0)
        const totalPrevMonthRev = enriched.reduce((s, c) => s + c.prevMonthRevenue, 0)
        const totalAR = enriched.reduce((s, c) => s + c.arOutstanding, 0)
        const totalOverdue = enriched.reduce((s, c) => s + c.overdueAmount, 0)
        const churning = enriched.filter(c => c.isChurning)
        const complaintsTotal = enriched.reduce((s, c) => s + c.openComplaints, 0)
        const creditHoldCount = enriched.filter(c => c.creditHold).length
        const tierDist = enriched.reduce((acc, c) => { acc[c.tier] = (acc[c.tier] || 0) + 1; return acc }, {} as Record<string, number>)
        const typeDist = enriched.reduce((acc, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc }, {} as Record<string, number>)
        const avgRevPerCustomer = totalCustomers > 0 ? totalRevenue / totalCustomers : 0

        // Top 10 by revenue
        const top10 = [...enriched].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10)
        // At-risk (churning + complaints)
        const atRisk = enriched.filter(c => c.isChurning || c.openComplaints > 0 || c.overdueAmount > 0)

        // ── Build AI prompt ──
        const customerList = enriched
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .map(c => {
                const flags: string[] = []
                if (c.isChurning) flags.push('⚠️CHURNING')
                if (c.openComplaints > 0) flags.push(`🔴${c.openComplaints} complaints`)
                if (c.overdueAmount > 0) flags.push(`💰overdue: ${c.overdueAmount.toLocaleString()}đ`)
                if (c.creditHold) flags.push('🚫CREDIT-HOLD')

                return `${c.name} (${c.code}) | ${c.type}/${c.channel ?? 'N/A'} | Tier: ${c.tier} | Revenue: ${c.totalRevenue.toLocaleString()}đ (tháng này: ${c.monthRevenue.toLocaleString()}đ, growth: ${c.revenueGrowth}%) | Orders: ${c.totalOrders} | Last order: ${c.daysSinceLastOrder !== null ? c.daysSinceLastOrder + 'd ago' : 'Never'} | AR: ${c.arOutstanding.toLocaleString()}đ | Sales Rep: ${c.salesRep} | Tags: [${c.tags.join(', ')}] | Activities (30d): ${c.recentActivities} | Opps: ${c.oppCount} ${flags.length > 0 ? '| ' + flags.join(' ') : ''}`
            }).join('\n')

        const oppList = opportunities.map(o => {
            const cust = enriched.find(c => c.name && customers.find(cu => cu.id === o.customerId)?.name === c.name)
            return `${o.name} | Customer: ${cust?.name ?? 'N/A'} | Stage: ${o.stage} | Value: ${Number(o.expectedValue).toLocaleString()}đ | Prob: ${o.probability}%`
        }).join('\n')

        const prompt = `Bạn là CRM Director / Chief Revenue Officer cho LY's Cellars, công ty nhập khẩu rượu vang cao cấp tại Việt Nam.

Phân tích TOÀN BỘ danh mục khách hàng CRM sau đây:

=== KHÁCH HÀNG (${totalCustomers} khách) ===
${customerList}

=== CƠ HỘI BÁN HÀNG ĐANG MỞ ===
${oppList || 'Không có cơ hội nào'}

===== THỐNG KÊ TỔNG HỢP =====
- Tổng doanh thu tích lũy: ${totalRevenue.toLocaleString()} VND
- Doanh thu tháng này: ${totalMonthRev.toLocaleString()} VND (tháng trước: ${totalPrevMonthRev.toLocaleString()} VND, tăng trưởng: ${totalPrevMonthRev > 0 ? Math.round((totalMonthRev - totalPrevMonthRev) / totalPrevMonthRev * 100) : 'N/A'}%)
- Doanh thu TB/khách: ${avgRevPerCustomer.toLocaleString()} VND
- Tổng công nợ phải thu: ${totalAR.toLocaleString()} VND
- Công nợ quá hạn: ${totalOverdue.toLocaleString()} VND
- Khách hàng churning (>60 ngày không mua): ${churning.length}
- Khiếu nại đang mở: ${complaintsTotal}
- Credit hold: ${creditHoldCount}
- Phân bổ tier: ${Object.entries(tierDist).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Phân loại: ${Object.entries(typeDist).map(([k, v]) => `${k}: ${v}`).join(', ')}

Hãy viết BÁO CÁO CRM TOÀN DIỆN CHO CEO bao gồm:

1. **📊 TỔNG QUAN SỨC KHỎE CRM** — CRM Health Score (1-10), tổng hợp tình trạng quan hệ khách hàng, xu hướng tăng trưởng
2. **🏆 TOP KHÁCH HÀNG GIÁ TRỊ CAO** — Phân tích Top 5 khách hàng, đóng góp doanh thu, xu hướng mua hàng, rủi ro mất khách
3. **⚠️ KHÁCH HÀNG RỦI RO & CHURNING** — Chi tiết khách có dấu hiệu churning, complaint chưa xử lý, credit hold, đề xuất hành động cứu vớt
4. **💰 PHÂN TÍCH CÔNG NỢ** — Tổng AR, quá hạn, risk concentration, khách nào cần ưu tiên thu hồi
5. **📈 XU HƯỚNG & CƠ HỘI** — Xu hướng doanh thu month-over-month, khách hàng tăng trưởng tốt, cơ hội up-sell/cross-sell dựa trên wine preference
6. **🎯 GỢI Ý CHIẾN LƯỢC** — Top 5 hành động CEO nên thực hiện ngay:
   - Retention play cho khách churning
   - Upsell play cho khách top-tier
   - Collection play cho AR overdue
   - Engagement play cho khách ít tương tác
7. **🍷 WINE PREFERENCE INSIGHTS** — Xu hướng preference phổ biến, cơ hội curate offering

Yêu cầu:
- Viết bằng tiếng Việt, phong cách CRO briefing cho CEO
- Cụ thể tên khách hàng, tên sales rep, số liệu thực
- Tone: chiến lược, data-driven, actionable
- Nêu bật rủi ro → đề xuất giải pháp ngay`

        const result = await callGemini({
            prompt,
            systemPrompt: 'You are a Chief Revenue Officer analyzing CRM data for a luxury wine import company CEO. Be strategic, data-driven, and provide actionable insights with specific customer names and numbers.',
            temperature: 0.4,
            maxTokens: 8192,
        })

        return NextResponse.json({
            success: result.success,
            analysis: result.text,
            error: result.error,
            stats: {
                totalCustomers,
                totalRevenue,
                monthRevenue: totalMonthRev,
                prevMonthRevenue: totalPrevMonthRev,
                revenueGrowth: totalPrevMonthRev > 0 ? Math.round((totalMonthRev - totalPrevMonthRev) / totalPrevMonthRev * 100) : 0,
                totalAR,
                totalOverdue,
                churningCount: churning.length,
                complaintsOpen: complaintsTotal,
                creditHoldCount,
                avgRevPerCustomer: Math.round(avgRevPerCustomer),
                tierDistribution: tierDist,
                atRiskCount: atRisk.length,
            },
        })
    } catch (err) {
        console.error('[CRM Analysis API]', err)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
