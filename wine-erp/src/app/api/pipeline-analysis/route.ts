import { prisma, withRetry } from '@/lib/db'
import { callGemini, resolvePromptTemplate } from '@/lib/ai-service'
import { NextResponse } from 'next/server'
import { isModuleAiEnabled } from '@/app/dashboard/ai/ai-actions'

export async function POST() {
    try {
        const aiOk = await isModuleAiEnabled('pipeline')
        if (!aiOk) return NextResponse.json({ success: false, error: 'AI đã bị tắt bởi Admin' }, { status: 403 })
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
                    previousStage: true,
                    probability: true,
                    closeDate: true,
                    stageChangedAt: true,
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

        // Stale deals (in same stage for 14+ days without progress)
        const stale = active.filter(o => {
            const daysInStage = (now.getTime() - new Date(o.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)
            return daysInStage > 14 && ['LEAD', 'QUALIFIED'].includes(o.stage)
        })

        // Calculate velocity per stage (avg days deals spend in each active stage)
        const velocityMap = new Map<string, number[]>()
        for (const o of active) {
            const daysInStage = Math.round((now.getTime() - new Date(o.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24))
            const arr = velocityMap.get(o.stage) ?? []
            arr.push(daysInStage)
            velocityMap.set(o.stage, arr)
        }
        const velocitySummary = [...velocityMap.entries()].map(([stage, days]) => {
            const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length)
            return `${stage}: avg ${avg} ngày (${days.length} deals)`
        }).join(' | ')

        // 3. Build AI prompt with velocity data
        const dealList = opportunities.map(o => {
            const daysInStage = Math.round((now.getTime() - new Date(o.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24))
            const totalAge = Math.round((now.getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            return `${o.name} | ${o.customer.name} (${o.customer.customerType}) | Stage: ${o.stage} (${daysInStage}d in stage${o.previousStage ? ', from ' + o.previousStage : ''}) | Value: ${Number(o.expectedValue).toLocaleString()}đ | Prob: ${o.probability}% | Sales: ${o.assignee.name} | Close: ${o.closeDate ? new Date(o.closeDate).toLocaleDateString('vi-VN') : 'N/A'} | Total age: ${totalAge}d`
        }).join('\n')

        const prompt = `Bạn là Sales Director / CRM Manager cho LY's Cellars, công ty nhập khẩu rượu vang cao cấp tại Việt Nam.

Phân tích Sales Pipeline sau đây:

${dealList}

===== THỐNG KÊ =====
- Tổng giá trị pipeline (active): ${totalPipelineValue.toLocaleString()} VND
- Giá trị weighted: ${totalWeightedValue.toLocaleString()} VND
- Win rate: ${winRate.toFixed(1)}%
- Avg deal size: ${avgDealSize.toLocaleString()} VND
- Deals stale (>14 ngày không chuyển stage): ${stale.length}
- Active deals: ${active.length} | Won: ${won.length} | Lost: ${lost.length}
- Pipeline velocity: ${velocitySummary}

Hãy viết BÁO CÁO PHÂN TÍCH PIPELINE CHO CEO bao gồm:

1. **📊 TỔNG QUAN PIPELINE** — Health score (1-10), pipeline velocity analysis (dựa trên dữ liệu "d in stage" thực tế cho từng deal), conversion funnel
2. **🔥 TOP 5 DEAL QUAN TRỌNG NHẤT** — Deal value cao hoặc probability cao, cần CEO chú ý
3. **⏱️ PIPELINE VELOCITY** — Phân tích tốc độ di chuyển qua từng stage:
   - Stage nào có deal bị "kẹt" lâu nhất?
   - Deal nào ở stage hiện tại quá lâu (>14 ngày)?
   - So sánh tốc độ giữa các sales rep
4. **⚠️ CẢNH BÁO & RỦI RO**:
   - Deals bị stale (cần push hoặc disqualify)
   - Pipeline concentration risk
   - Deals sắp đến close date nhưng probability thấp
5. **🎯 COACHING GỢI Ý** — Gợi ý cho từng sales rep dựa trên velocity và win rate
6. **📈 DỰ BÁO DOANH THU** — Projected revenue (dựa trên weighted pipeline + velocity)
7. **💡 HÀNH ĐỘNG NGAY** — Top 3 actions CEO nên yêu cầu team thực hiện

Yêu cầu:
- Viết bằng tiếng Việt, phong cách Sales Director briefing
- Cụ thể tên deal, tên khách hàng, tên sales rep
- Tone: quyết đoán, data-driven, actionable`

        // ── Resolve prompt from DB or fallback ──
        const dbPrompt = await resolvePromptTemplate('pipeline-analysis')

        const DEFAULT_SYSTEM = 'You are a senior Sales Director analyzing CRM pipeline data for a luxury wine import company CEO. Be data-driven, specific, and actionable.'

        let finalPrompt: string
        let finalSystem: string
        let finalTemp = 0.4
        let finalMax = 8192

        if (dbPrompt) {
            finalSystem = dbPrompt.systemPrompt
            finalPrompt = dbPrompt.userTemplate
                .replace('{{data}}', `${dealList}\n\n===== THỐNG KÊ =====\n- Tổng giá trị pipeline (active): ${totalPipelineValue.toLocaleString()} VND\n- Giá trị weighted: ${totalWeightedValue.toLocaleString()} VND\n- Win rate: ${winRate.toFixed(1)}%\n- Avg deal size: ${avgDealSize.toLocaleString()} VND\n- Deals stale (>14 ngày không chuyển stage): ${stale.length}\n- Active deals: ${active.length} | Won: ${won.length} | Lost: ${lost.length}\n- Pipeline velocity: ${velocitySummary}`)
            finalTemp = dbPrompt.temperature
            finalMax = dbPrompt.maxTokens
        } else {
            finalSystem = DEFAULT_SYSTEM
            finalPrompt = prompt
        }

        const result = await callGemini({
            prompt: finalPrompt,
            systemPrompt: finalSystem,
            temperature: finalTemp,
            maxTokens: finalMax,
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
