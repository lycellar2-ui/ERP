import { prisma, withRetry } from '@/lib/db'
import { callGemini } from '@/lib/ai-service'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const now = new Date()
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

        // 1. Get current stock per product
        const stockByProduct = await withRetry(() =>
            prisma.stockLot.groupBy({
                by: ['productId'],
                where: { status: 'AVAILABLE' },
                _sum: { qtyAvailable: true },
            })
        )

        // 2. Get sales velocity (last 3 months)
        const salesLines = await withRetry(() =>
            prisma.salesOrderLine.findMany({
                where: {
                    so: {
                        status: { in: ['CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID'] },
                        createdAt: { gte: threeMonthsAgo },
                    },
                },
                select: {
                    productId: true,
                    qtyOrdered: true,
                    so: { select: { createdAt: true } },
                },
            })
        )

        // 3. Sales velocity per product (monthly avg)
        const salesMap = new Map<string, number>()
        for (const line of salesLines) {
            const prev = salesMap.get(line.productId) ?? 0
            salesMap.set(line.productId, prev + Number(line.qtyOrdered))
        }

        // 4. Get product details
        const productIds = [...new Set([
            ...stockByProduct.map(s => s.productId),
            ...salesMap.keys(),
        ])]

        const products = await withRetry(() =>
            prisma.product.findMany({
                where: { id: { in: productIds }, deletedAt: null },
                select: {
                    id: true,
                    productName: true,
                    skuCode: true,
                    vintage: true,
                    country: true,
                },
            })
        )

        // Get average landed cost from stock lots
        const costData = await withRetry(() =>
            prisma.stockLot.groupBy({
                by: ['productId'],
                where: { productId: { in: productIds } },
                _avg: { unitLandedCost: true },
            })
        )

        // 5. Build analysis data
        const analysis = products.map(p => {
            const stock = stockByProduct.find(s => s.productId === p.id)
            const cost = costData.find(c => c.productId === p.id)
            const currentStock = Number(stock?._sum.qtyAvailable ?? 0)
            const totalSold3m = salesMap.get(p.id) ?? 0
            const monthlySales = totalSold3m / 3
            const weeksOfSupply = monthlySales > 0 ? (currentStock / monthlySales) * 4.33 : 999

            return {
                name: p.productName,
                sku: p.skuCode ?? '',
                vintage: p.vintage,
                country: p.country ?? '',
                currentStock,
                totalSold3Months: totalSold3m,
                monthlySalesAvg: Math.round(monthlySales * 10) / 10,
                weeksOfSupply: Math.round(weeksOfSupply * 10) / 10,
                unitCost: Number(cost?._avg.unitLandedCost ?? 0),
            }
        })
            .filter(a => a.totalSold3Months > 0 || a.currentStock > 0)
            .sort((a, b) => a.weeksOfSupply - b.weeksOfSupply)

        // 6. Build AI prompt
        const topItems = analysis.slice(0, 30) // limit to avoid token overflow
        const dataTable = topItems.map(a =>
            `${a.name} (${a.sku}) | Tồn: ${a.currentStock} | Bán TB/tháng: ${a.monthlySalesAvg} | Đủ: ${a.weeksOfSupply} tuần | Cost: ${a.unitCost.toLocaleString()}đ`
        ).join('\n')

        const prompt = `Bạn là chuyên gia quản lý tồn kho rượu vang cho công ty LY's Cellars (nhập khẩu rượu vang).

Phân tích dữ liệu tồn kho và bán hàng 3 tháng gần nhất sau đây:

${dataTable}

Tổng sản phẩm: ${analysis.length}
Sản phẩm sắp hết (< 8 tuần): ${analysis.filter(a => a.weeksOfSupply < 8).length}
Sản phẩm tồn cao (> 24 tuần): ${analysis.filter(a => a.weeksOfSupply > 24 && a.weeksOfSupply < 999).length}

Hãy viết báo cáo GỢI Ý NHẬP HÀNG bao gồm:

1. **🔴 CẦN NHẬP NGAY** (tồn < 6 tuần, bán chạy) — Gợi ý số lượng nhập
2. **🟡 NÊN NHẬP SỚM** (tồn 6-12 tuần) — Kế hoạch nhập trong 4-6 tuần tới
3. **🟢 ĐỦ TỒN** (tồn > 12 tuần) — Không cần nhập
4. **⚠️ TỒN CAO, CẦN GIẢI PHÓNG** (tồn > 24 tuần, bán chậm) — Gợi ý khuyến mãi
5. **📊 TỔNG HỢP** — Ước tính tổng chi phí nhập hàng đề xuất

Yêu cầu:
- Viết bằng tiếng Việt, phong cách báo cáo cho CEO
- Gợi ý số lượng cụ thể (tính dựa trên 3 tháng tồn kho an toàn)
- Nếu unit cost = 0 thì bỏ qua chi phí ước tính cho sản phẩm đó`

        const result = await callGemini({
            prompt,
            systemPrompt: 'You are a wine inventory management specialist. Provide actionable purchase recommendations based on data.',
            temperature: 0.4,
            maxTokens: 4096,
        })

        return NextResponse.json({
            success: result.success,
            suggestion: result.text,
            error: result.error,
            stats: {
                totalProducts: analysis.length,
                urgentReorder: analysis.filter(a => a.weeksOfSupply < 6).length,
                lowStock: analysis.filter(a => a.weeksOfSupply >= 6 && a.weeksOfSupply < 12).length,
                overstock: analysis.filter(a => a.weeksOfSupply > 24 && a.weeksOfSupply < 999).length,
            },
        })
    } catch (err) {
        console.error('[Purchase Suggestion API]', err)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
