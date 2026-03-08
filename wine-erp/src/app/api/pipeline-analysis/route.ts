import { prisma, withRetry } from '@/lib/db'
import { callGemini } from '@/lib/ai-service'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        // 1. All active opportunities
        const opportunities = await withRetry(() =>
            prisma.salesOpportunity.findMany({
                select: {
                    id: true,
                    name: true,
                    expectedValue: true,
                    stage: true,
                    probability: true,
                    closeDate: true,
                    notes: true,
                    createdAt: true,
                    customer: { select: { name: true, customerType: true, channel: true } },
                    assignee: { select: { name: true } },
                },
                orderBy: { expectedValue: 'desc' },
            })
        )

        // 2. Pipeline stats
        const stageGroups = new Map<string, { count: number; value: number; weighted: number }>()
        for (const opp of opportunities) {
            const stage = opp.stage
            const prev = stageGroups.get(stage) ?? { count: 0, value: 0, weighted: 0 }
            const val = Number(opp.expectedValue)
            stageGroups.set(stage, {
                count: prev.count + 1,
                value: prev.value + val,
                weighted: prev.weighted + val * (opp.probability / 100),
            })
        }

        const active = opportunities.filter(o => !['WON', 'LOST'].includes(o.stage))
        const won = opportunities.filter(o => o.stage === 'WON')
        const lost = opportunities.filter(o => o.stage === 'LOST')
        const totalPipelineValue = active.reduce((s, o) => s + Number(o.expectedValue), 0)
        const totalWeightedValue = active.reduce((s, o) => s + Number(o.expectedValue) * (o.probability / 100), 0)
        const winRate = won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : 0
        const avgDealSize = active.length > 0 ? totalPipelineValue / active.length : 0

        // Stale deals (no update for 20+ days)
        const stale = active.filter(o => {
            const daysSinceCreated = (now.getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24)
            return daysSinceCreated > 20 && ['LEAD', 'QUALIFIED'].includes(o.stage)
        })

        // 3. Build AI prompt
        const dealList = opportunities.map(o =>
            `${o.name} | ${o.customer.name} (${o.customer.customerType}) | Stage: ${o.stage} | Value: ${Number(o.expectedValue).toLocaleString()}đ | Prob: ${o.probability}% | Sales: ${o.assignee.name} | Close: ${o.closeDate ? new Date(o.closeDate).toLocaleDateString('vi-VN') : 'N/A'} | Age: ${Math.round((now.getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24))}d`
        ).join('\n')

        const prompt = `Bạn là Sales Director / CRM Manager cho LY's Cellars, công ty nhập khẩu rượu vang cao cấp tại Việt Nam.

Phân tích Sales Pipeline sau đây:

${dealList}

===== THỐNG KÊ =====
- Tổng giá trị pipeline (active): ${totalPipelineValue.toLocaleString()} VND
- Giá trị weighted: ${totalWeightedValue.toLocaleString()} VND
- Win rate: ${winRate.toFixed(1)}%
- Avg deal size: ${avgDealSize.toLocaleString()} VND
- Deals stale (>20 ngày không chuyển stage): ${stale.length}
- Active deals: ${active.length} | Won: ${won.length} | Lost: ${lost.length}

Hãy viết BÁO CÁO PHÂN TÍCH PIPELINE CHO CEO bao gồm:

1. **📊 TỔNG QUAN PIPELINE** — Health score (1-10), pipeline velocity, conversion funnel
2. **🔥 TOP 5 DEAL QUAN TRỌNG NHẤT** — Deal value cao hoặc probability cao, cần CEO chú ý
3. **⚠️ CẢNH BÁO & RỦI RO**:
   - Deals bị stale (cần push hoặc disqualify)
   - Pipeline concentration risk (phụ thuộc vào 1-2 deal lớn)
   - Deals sắp đến close date nhưng probability thấp
4. **🎯 COACHING GỢI Ý** — Gợi ý cho từng sales rep cụ thể
5. **📈 DỰ BÁO DOANH THU** — Projected revenue cho tháng tới (dựa trên weighted pipeline)
6. **💡 HÀNH ĐỘNG NGAY** — Top 3 actions CEO nên yêu cầu team thực hiện

Yêu cầu:
- Viết bằng tiếng Việt, phong cách Sales Director briefing
- Cụ thể tên deal, tên khách hàng, tên sales rep
- Tone: quyết đoán, data-driven, actionable`

        const result = await callGemini({
            prompt,
            systemPrompt: 'You are a senior Sales Director analyzing CRM pipeline data for a luxury wine import company CEO. Be data-driven, specific, and actionable.',
            temperature: 0.4,
            maxTokens: 8192,
        })

        return NextResponse.json({
            success: result.success,
            analysis: result.text,
            error: result.error,
            stats: {
                totalDeals: opportunities.length,
                activeDeals: active.length,
                wonDeals: won.length,
                lostDeals: lost.length,
                pipelineValue: totalPipelineValue,
                weightedValue: totalWeightedValue,
                winRate: Math.round(winRate),
                avgDealSize,
                staleDeals: stale.length,
            },
        })
    } catch (err) {
        console.error('[Pipeline Analysis API]', err)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
