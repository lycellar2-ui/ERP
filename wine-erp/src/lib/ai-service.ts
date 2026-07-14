'use server'

import { prisma } from '@/lib/db'

// ═══════════════════════════════════════════════════
// AI Service — Gemini API Wrapper
// Key Resolution: DB Vault (AES-256) → env fallback
// ═══════════════════════════════════════════════════

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent'

export interface AIGenerateOptions {
    prompt: string
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
}

// ── Resolve API Key from DB (encrypted) or env ────
async function resolveGeminiKey(): Promise<string | null> {
    // 1. Try DB vault first (AES-256-GCM encrypted)
    try {
        const dbKey = await prisma.aiApiKey.findFirst({
            where: { provider: 'gemini', isActive: true },
        })
        if (dbKey) {
            const { decryptApiKey } = await import('./encryption')
            return await decryptApiKey(dbKey.encryptedKey, dbKey.iv)
        }
    } catch { /* DB lookup/decrypt failed, try env fallback */ }

    // 2. Fallback to env var (for dev/CI or when DB not available)
    return process.env.GEMINI_API_KEY || null
}

// ── Resolve Prompt Template from DB ───────────────
export interface ResolvedPrompt {
    systemPrompt: string
    userTemplate: string
    temperature: number
    maxTokens: number
}

export async function resolvePromptTemplate(slug: string): Promise<ResolvedPrompt | null> {
    try {
        const template = await prisma.aiPromptTemplate.findUnique({
            where: { slug },
            select: { systemPrompt: true, userTemplate: true, temperature: true, maxTokens: true },
        })
        if (!template) return null
        return {
            systemPrompt: template.systemPrompt,
            userTemplate: template.userTemplate,
            temperature: template.temperature,
            maxTokens: template.maxTokens,
        }
    } catch { return null }
}

// ── Call Gemini API ───────────────────────────────
export async function callGemini(options: AIGenerateOptions): Promise<{
    success: boolean
    text?: string
    error?: string
    tokensUsed?: number
}> {
    const startTime = Date.now()

    try {
        const apiKey = await resolveGeminiKey()
        if (!apiKey) {
            return {
                success: false,
                error: 'Chưa cấu hình Gemini API Key. Vào AI Settings → API Key Vault → Thêm Key Gemini.',
            }
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
            const errBody = await response.text()
            await logRunSafe(0, 0, Date.now() - startTime, false, `API ${response.status}: ${errBody.slice(0, 200)}`)
            return { success: false, error: `Gemini API Error: ${response.status} — ${errBody.slice(0, 300)}` }
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        const inputTokens = data.usageMetadata?.promptTokenCount ?? 0
        const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0
        const tokensUsed = data.usageMetadata?.totalTokenCount ?? 0

        // Log successful run + update budget
        await logRunSafe(inputTokens, outputTokens, Date.now() - startTime, true)

        return { success: true, text, tokensUsed }
    } catch (err: any) {
        await logRunSafe(0, 0, Date.now() - startTime, false, err.message)
        return { success: false, error: err.message }
    }
}

// ── Silent usage logger (never throws) ────────────
async function logRunSafe(
    inputTokens: number,
    outputTokens: number,
    durationMs: number,
    success: boolean,
    error?: string,
) {
    try {
        // Gemini 2.5 Flash pricing: ~$0.15/1M input, ~$0.60/1M output
        const costUsd = (inputTokens * 0.0000001) + (outputTokens * 0.0000004)

        await prisma.aiPromptRun.create({
            data: {
                provider: 'gemini',
                model: 'gemini-3.1-pro-preview',
                inputTokens,
                outputTokens,
                costUsd,
                durationMs,
                success,
                error: error?.slice(0, 500),
            },
        })

        // Update monthly budget tracking
        if (costUsd > 0) {
            await prisma.aiApiKey.updateMany({
                where: { provider: 'gemini' },
                data: { usedThisMonth: { increment: costUsd } },
            })
        }
    } catch { /* never fail on logging */ }
}

// ── Generate Product Description ──────────────────
interface FormDataForAI {
    name: string
    wineType?: string
    abv?: number
    countryCode?: string
}

export async function generateProductDescription(
    productId?: string,
    formData?: FormDataForAI,
): Promise<{
    success: boolean
    profile?: {
        originDetail: string
        certification: string
        color: string
        aromas: string
        palate: string
        style: string
        servingTemp: string
        foodPairings: string
        bestSuitedFor: string
        grapes: string
    }
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
                country: true, abvPercent: true,
                volumeMl: true, classification: true,
                appellation: { select: { name: true } },
            },
        })
        if (!product) return { success: false, error: 'Product not found' }

        pName = product.productName
        pSku = product.skuCode
        wType = product.wineType ?? 'N/A'
        pAbv = product.abvPercent ? Number(product.abvPercent) : 'N/A'
        pClassification = product.classification ?? 'N/A'
        pVolume = product.volumeMl ? Number(product.volumeMl) : 'N/A'
        pRegion = product.appellation?.name ?? product.country ?? 'N/A'
    } else if (formData) {
        pName = formData.name
        wType = formData.wineType || 'N/A'
        pAbv = formData.abv ?? 'N/A'
        pRegion = formData.countryCode || 'N/A'
        if (!pName) return { success: false, error: 'Product name is required' }
    } else {
        return { success: false, error: 'Either productId or formData is required' }
    }

    const prompt = `Hãy phân tích và viết đặc tính chi tiết cho chai rượu vang sau dưới định dạng JSON:

Tên: ${pName}
SKU: ${pSku}
Loại: ${wType}
Vùng: ${pRegion}
Vintage: ${pVintage}
Nồng độ: ${pAbv}%
Classification: ${pClassification}
Dung tích: ${pVolume}ml

Trả về một đối tượng JSON duy nhất có các trường sau:
{
  "originDetail": "Xuất xứ chi tiết (ví dụ: Veneto, Ý)",
  "certification": "Chứng chỉ hoặc canh tác bền vững",
  "color": "Mô tả màu sắc (bằng Tiếng Việt)",
  "aromas": "Mô tả hương thơm (Nose) (bằng Tiếng Việt)",
  "palate": "Mô tả vị giác (Palate) (bằng Tiếng Việt)",
  "style": "Phong cách rượu (ví dụ: Khô, đậm đà mạnh mẽ...)",
  "servingTemp": "Nhiệt độ phục vụ khuyến nghị (ví dụ: 16°C - 18°C)",
  "foodPairings": "Gợi ý món ăn kèm (bằng Tiếng Việt)",
  "bestSuitedFor": "Phù hợp với đối tượng nào (bằng Tiếng Việt)",
  "grapes": "Giống nho tạo nên chai rượu này"
}

Chỉ trả về JSON thuần túy, không có mã Markdown hoặc lời dẫn.`

    const result = await callGemini({
        prompt,
        systemPrompt: 'You are a professional sommelier. Respond only with raw JSON text matching the requested schema. No markdown codeblocks, no extra explanation.',
        temperature: 0.7,
    })

    if (!result.success) return { success: false, error: result.error }

    try {
        let cleanText = result.text ?? '{}'
        // Strip markdown backticks if any
        if (cleanText.includes('```')) {
            cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim()
        }
        const profile = JSON.parse(cleanText)
        return {
            success: true,
            profile,
        }
    } catch (err: any) {
        return { success: false, error: `Parse error: ${err.message}. Raw text: ${result.text}` }
    }
}

// ── CEO Monthly Summary ───────────────────────────
export async function generateCEONarrative(): Promise<{
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
        systemPrompt: 'You are a business analyst writing executive summaries for a wine import CEO. Write in Vietnamese.',
        temperature: 0.5,
        maxTokens: 4096,
    }).then(r => ({
        success: r.success,
        summary: r.text,
        error: r.error,
    }))
}
