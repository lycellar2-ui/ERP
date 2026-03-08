import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const DEFAULT_PROMPTS = [
    {
        slug: 'pipeline-analysis',
        name: 'Pipeline Analysis — Sales Director',
        systemPrompt: 'You are a senior Sales Director analyzing CRM pipeline data for a luxury wine import company CEO. Be data-driven, specific, and actionable.',
        userTemplate: `Bạn là Sales Director cho LY's Cellars. Phân tích dữ liệu sales pipeline:

{{data}}

Hãy viết BÁO CÁO PHÂN TÍCH PIPELINE CHO CEO bao gồm:

1. **📊 TỔNG QUAN PIPELINE** — Health score (1-10), pipeline velocity analysis, conversion funnel
2. **🔥 TOP 5 DEAL QUAN TRỌNG NHẤT** — Deal value cao hoặc probability cao
3. **⏱️ PIPELINE VELOCITY** — Tốc độ di chuyển qua từng stage, deal bị "kẹt"
4. **⚠️ CẢNH BÁO & RỦI RO** — Deals stale, concentration risk, close date sắp tới nhưng probability thấp
5. **🎯 COACHING GỢI Ý** — Gợi ý cho từng sales rep dựa trên velocity và win rate
6. **📈 DỰ BÁO DOANH THU** — Projected revenue dựa trên weighted pipeline
7. **💡 HÀNH ĐỘNG NGAY** — Top 3 actions CEO nên yêu cầu team thực hiện

Yêu cầu: Viết bằng tiếng Việt, phong cách Sales Director briefing. Cụ thể tên deal, tên khách hàng, tên sales rep. Tone: quyết đoán, data-driven, actionable.`,
        variables: ['data'],
        temperature: 0.4,
        maxTokens: 8192,
    },
    {
        slug: 'crm-analysis',
        name: 'CRM Analysis — Chief Revenue Officer',
        systemPrompt: 'You are a Chief Revenue Officer analyzing CRM data for a luxury wine import company CEO. Be strategic, data-driven, and provide actionable insights with specific customer names and numbers.',
        userTemplate: `Bạn là CRM Director / Chief Revenue Officer cho LY's Cellars. Phân tích dữ liệu CRM:

{{data}}

Hãy viết BÁO CÁO CRM TOÀN DIỆN CHO CEO bao gồm:

1. **📊 TỔNG QUAN SỨC KHỎE CRM** — CRM Health Score (1-10), xu hướng tăng trưởng
2. **🏆 TOP KHÁCH HÀNG GIÁ TRỊ CAO** — Top 5 KH, đóng góp doanh thu, rủi ro mất khách
3. **⚠️ KHÁCH HÀNG RỦI RO & CHURNING** — Dấu hiệu churning, complaint, credit hold, đề xuất hành động
4. **💰 PHÂN TÍCH CÔNG NỢ** — AR, quá hạn, risk concentration
5. **📈 XU HƯỚNG & CƠ HỘI** — Month-over-month, up-sell/cross-sell dựa trên wine preference
6. **🎯 GỢI Ý CHIẾN LƯỢC** — Top 5 hành động CEO nên thực hiện ngay
7. **🍷 WINE PREFERENCE INSIGHTS** — Xu hướng preference, cơ hội curate offering

Yêu cầu: Viết bằng tiếng Việt, phong cách CRO briefing. Cụ thể tên KH, tên sales rep, số liệu thực.`,
        variables: ['data'],
        temperature: 0.4,
        maxTokens: 8192,
    },
    {
        slug: 'catalog-analysis',
        name: 'Catalog Intelligence — Wine Portfolio Director',
        systemPrompt: 'You are a Wine Portfolio Director and market analyst with deep expertise in the Vietnamese wine import market and global wine industry trends. Analyze product catalogs and suppliers with both data-driven insights and market intelligence. Write in Vietnamese for a CEO audience.',
        userTemplate: `Bạn là Wine Portfolio Director / Chief Merchandising Officer cho LY's Cellars. Phân tích danh mục và NCC:

{{data}}

Hãy viết BÁO CÁO PHÂN TÍCH DANH MỤC & NGHIÊN CỨU THỊ TRƯỜNG CHO CEO bao gồm:

1. **📊 TỔNG QUAN DANH MỤC** — Portfolio Health Score (1-10), độ đa dạng, cân đối portfolio
2. **🏆 TOP PERFORMERS** — Sản phẩm bán chạy nhất, doanh thu cao nhất
3. **🆕 SẢN PHẨM CHƯA CÓ DỮ LIỆU BÁN** — Tiềm năng, chiến lược GTM, sản phẩm nên push vs loại bỏ
4. **🌍 NGHIÊN CỨU THỊ TRƯỜNG** — Xu hướng VN, gaps, competition
5. **🏢 PHÂN TÍCH NHÀ CUNG CẤP** — Concentration risk, trade agreements, lead time
6. **💰 PRICING & MARGIN** — Under/over-priced, cơ hội tối ưu margin
7. **📈 ĐỀ XUẤT CHIẾN LƯỢC** — Top 5 actions cho portfolio optimization

Yêu cầu: Viết bằng tiếng Việt. Cụ thể tên sản phẩm, NCC. Kết hợp kiến thức thị trường VN.`,
        variables: ['data'],
        temperature: 0.5,
        maxTokens: 8192,
    },
]

export async function POST() {
    try {
        const results = []
        for (const p of DEFAULT_PROMPTS) {
            const created = await prisma.aiPromptTemplate.upsert({
                where: { slug: p.slug },
                update: {
                    name: p.name,
                    systemPrompt: p.systemPrompt,
                    userTemplate: p.userTemplate,
                    variables: p.variables,
                    temperature: p.temperature,
                    maxTokens: p.maxTokens,
                },
                create: p,
            })
            results.push({ slug: created.slug, name: created.name })
        }
        return NextResponse.json({ success: true, seeded: results })
    } catch (err) {
        console.error('[Seed Prompts]', err)
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
    }
}
