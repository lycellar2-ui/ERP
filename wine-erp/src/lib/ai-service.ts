'use server'

import { prisma } from '@/lib/db'

// ═══════════════════════════════════════════════════
// AI Service — Gemini API Wrapper
// ═══════════════════════════════════════════════════

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export interface AIGenerateOptions {
    prompt: string
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
}

// ── Call Gemini API ───────────────────────────────
export async function callGemini(options: AIGenerateOptions): Promise<{
    success: boolean
    text?: string
    error?: string
    tokensUsed?: number
}> {
    try {
        // Get API key from environment or DB
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return { success: false, error: 'GEMINI_API_KEY not configured' }
        }

        const contents = []
        if (options.systemPrompt) {
            contents.push({
                role: 'user',
                parts: [{ text: `System: ${options.systemPrompt}\n\nUser: ${options.prompt}` }],
            })
        } else {
            contents.push({
                role: 'user',
                parts: [{ text: options.prompt }],
            })
        }

        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: options.temperature ?? 0.7,
                    maxOutputTokens: options.maxTokens ?? 2048,
                },
            }),
        })

        if (!response.ok) {
            const err = await response.text()
            return { success: false, error: `Gemini API Error: ${response.status} — ${err}` }
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        const tokensUsed = data.usageMetadata?.totalTokenCount ?? 0

        return { success: true, text, tokensUsed }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Generate Product Description ──────────────────
interface FormDataForAI {
    name: string
    wineType?: string
    vintage?: number
    abv?: number
    tastingNotes?: string
    countryCode?: string
}

export async function generateProductDescription(
    productId?: string,
    formData?: FormDataForAI,
): Promise<{
    success: boolean
    descriptionVI?: string
    descriptionEN?: string
    error?: string
}> {
    let pName = ''
    let wType = 'N/A'
    let pVintage: string | number = 'N/A'
    let pAbv: string | number = 'N/A'
    let pClassification = 'N/A'
    let pVolume: string | number = 'N/A'
    let pRegion = 'N/A'
    let pSku = 'N/A'

    if (productId) {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: {
                productName: true, skuCode: true, wineType: true,
                country: true, vintage: true, abvPercent: true,
                volumeMl: true, classification: true,
                appellation: { select: { name: true } },
            },
        })
        if (!product) return { success: false, error: 'Product not found' }

        pName = product.productName
        pSku = product.skuCode
        wType = product.wineType ?? 'N/A'
        pVintage = product.vintage ?? 'N/A'
        pAbv = product.abvPercent ?? 'N/A'
        pClassification = product.classification ?? 'N/A'
        pVolume = product.volumeMl ?? 'N/A'
        pRegion = product.appellation?.name ?? product.country ?? 'N/A'
    } else if (formData) {
        pName = formData.name
        wType = formData.wineType || 'N/A'
        pVintage = formData.vintage ?? 'N/A'
        pAbv = formData.abv ?? 'N/A'
        pRegion = formData.countryCode || 'N/A'
        if (!pName) return { success: false, error: 'Product name is required' }
    } else {
        return { success: false, error: 'Either productId or formData is required' }
    }

    const prompt = `Viết mô tả chuyên nghiệp cho rượu vang sau (2 phiên bản: Tiếng Việt và English):

Tên: ${pName}
SKU: ${pSku}
Loại: ${wType}
Vùng: ${pRegion}
Vintage: ${pVintage}
Nồng độ: ${pAbv}%
Classification: ${pClassification}
Dung tích: ${pVolume}ml

Yêu cầu:
- Mô tả tasting notes (mắt, mũi, miệng)
- Gợi ý thực phẩm kết hợp
- Phong cách chuyên nghiệp, sang trọng
- Format: 
  ## Tiếng Việt
  [nội dung]
  ## English
  [nội dung]`

    const result = await callGemini({
        prompt,
        systemPrompt: 'You are a professional sommelier writing wine descriptions for a premium wine import company in Vietnam.',
        temperature: 0.8,
    })

    if (!result.success) return { success: false, error: result.error }

    // Split VI/EN
    const text = result.text ?? ''
    const viMatch = text.match(/## Tiếng Việt\s*([\s\S]*?)(?=## English|$)/i)
    const enMatch = text.match(/## English\s*([\s\S]*?)$/i)

    return {
        success: true,
        descriptionVI: viMatch?.[1]?.trim() ?? text,
        descriptionEN: enMatch?.[1]?.trim() ?? '',
    }
}

// ── CEO Monthly Summary ───────────────────────────
export async function generateCEOSummary(): Promise<{
    success: boolean
    summary?: string
    error?: string
}> {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [revenue, orders, newCustomers, arOutstanding, stockValue] = await Promise.all([
        prisma.salesOrder.aggregate({
            where: {
                status: { in: ['CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: { gte: monthStart },
            },
            _sum: { totalAmount: true },
        }),
        prisma.salesOrder.count({ where: { createdAt: { gte: monthStart } } }),
        prisma.customer.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
        prisma.aRInvoice.aggregate({
            where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
            _sum: { totalAmount: true },
        }),
        prisma.stockLot.findMany({
            where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
            select: { qtyAvailable: true, unitLandedCost: true },
        }),
    ])

    const rev = Number(revenue._sum?.totalAmount ?? 0)
    const ar = Number(arOutstanding._sum?.totalAmount ?? 0)
    const sv = stockValue.reduce((s, l) => s + Number(l.qtyAvailable) * Number(l.unitLandedCost), 0)
    const monthName = now.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })

    const prompt = `Viết báo cáo tổng hợp CEO cho ${monthName}, công ty LY's Cellars (nhập khẩu rượu vang):

Dữ liệu:
- Doanh thu tháng: ${rev.toLocaleString()} VND
- Số đơn hàng: ${orders}
- Khách hàng mới: ${newCustomers}
- Công nợ phải thu: ${ar.toLocaleString()} VND
- Giá trị tồn kho: ${sv.toLocaleString()} VND

Yêu cầu:
- Viết bằng tiếng Việt, phong cách CEO briefing
- Tóm tắt ngắn gọn 3-5 bullet points
- Highlight rủi ro nếu có (AR cao, tồn kho lớn, doanh thu thấp)
- Đề xuất hành động 2-3 items`

    return callGemini({
        prompt,
        systemPrompt: 'You are a business analyst writing executive summaries for a wine import CEO.',
        temperature: 0.5,
    }).then(r => ({
        success: r.success,
        summary: r.text,
        error: r.error,
    }))
}
