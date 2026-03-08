import { prisma, withRetry } from '@/lib/db'
import { callGemini } from '@/lib/ai-service'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

        // ═══ 1. PRODUCTS — Full catalog with enriched data ═══
        const products = await withRetry(() =>
            prisma.product.findMany({
                where: { deletedAt: null },
                select: {
                    id: true,
                    skuCode: true,
                    productName: true,
                    wineType: true,
                    vintage: true,
                    abvPercent: true,
                    volumeMl: true,
                    format: true,
                    classification: true,
                    tastingNotes: true,
                    isAllocationEligible: true,
                    status: true,
                    country: true,
                    producer: { select: { name: true, country: true } },
                    appellation: { select: { name: true, region: { select: { name: true } } } },
                    awards: { select: { source: true, score: true, awardedYear: true } },
                    _count: {
                        select: {
                            soLines: true,      // sales order lines
                            quotationLines: true, // quotation lines
                            stockLots: true,    // stock lots
                            poLines: true,      // purchase order lines
                        },
                    },
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            })
        )

        // Sales data per product (revenue + qty sold)
        const salesLines = await withRetry(() =>
            prisma.salesOrderLine.findMany({
                select: {
                    productId: true,
                    qtyOrdered: true,
                    unitPrice: true,
                    lineDiscountPct: true,
                    so: { select: { createdAt: true } },
                },
            })
        )
        const salesMap = new Map<string, { revenue: number; qtySold: number; orderCount: number }>()
        const recentSalesMap = new Map<string, { revenue90d: number; qty90d: number }>()
        for (const line of salesLines) {
            const pid = line.productId
            const qty = Number(line.qtyOrdered)
            const price = Number(line.unitPrice)
            const disc = Number(line.lineDiscountPct ?? 0) / 100
            const lineRevenue = qty * price * (1 - disc)

            // All-time
            const existing = salesMap.get(pid) ?? { revenue: 0, qtySold: 0, orderCount: 0 }
            existing.revenue += lineRevenue
            existing.qtySold += qty
            existing.orderCount += 1
            salesMap.set(pid, existing)

            // Recent (90 days)
            if (line.so.createdAt >= ninetyDaysAgo) {
                const recent = recentSalesMap.get(pid) ?? { revenue90d: 0, qty90d: 0 }
                recent.revenue90d += lineRevenue
                recent.qty90d += qty
                recentSalesMap.set(pid, recent)
            }
        }


        // Stock availability
        const stockData = await withRetry(() =>
            prisma.stockLot.groupBy({
                by: ['productId'],
                where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                _sum: { qtyAvailable: true },
            })
        )
        const stockMap = new Map(stockData.map(s => [s.productId, Number(s._sum.qtyAvailable ?? 0)]))

        // Price list data (current prices)
        const priceData = await withRetry(() =>
            prisma.priceListLine.findMany({
                where: {
                    priceList: { effectiveDate: { lte: now } },
                },
                select: {
                    productId: true,
                    unitPrice: true,
                    priceList: { select: { channel: true } },
                },
                orderBy: { priceList: { effectiveDate: 'desc' } },
            })
        )
        const priceMap = new Map<string, { price: number; channel: string }[]>()
        for (const p of priceData) {
            const arr = priceMap.get(p.productId) ?? []
            arr.push({ price: Number(p.unitPrice), channel: p.priceList.channel })
            priceMap.set(p.productId, arr)
        }

        // ═══ 2. SUPPLIERS — Full supplier data ═══
        const suppliers = await withRetry(() =>
            prisma.supplier.findMany({
                where: { deletedAt: null },
                select: {
                    id: true,
                    code: true,
                    name: true,
                    type: true,
                    country: true,
                    tradeAgreement: true,
                    coFormType: true,
                    paymentTerm: true,
                    defaultCurrency: true,
                    incoterms: true,
                    leadTimeDays: true,
                    status: true,
                    website: true,
                    notes: true,
                    contacts: { select: { name: true, title: true, isPrimary: true }, take: 2 },
                    _count: {
                        select: {
                            purchaseOrders: true,
                            contracts: true,
                            apInvoices: true,
                        },
                    },
                    createdAt: true,
                },
            })
        )

        // PO data per supplier (total spending from PO lines)
        const poLines = await withRetry(() =>
            prisma.purchaseOrderLine.findMany({
                select: {
                    qtyOrdered: true,
                    unitPrice: true,
                    po: { select: { supplierId: true } },
                },
            })
        )
        const poMap = new Map<string, { totalSpent: number; poCount: number }>()
        for (const line of poLines) {
            const sid = line.po.supplierId
            const existing = poMap.get(sid) ?? { totalSpent: 0, poCount: 0 }
            existing.totalSpent += Number(line.qtyOrdered) * Number(line.unitPrice)
            poMap.set(sid, existing)
        }
        // Count POs per supplier
        const poCountData = await withRetry(() =>
            prisma.purchaseOrder.groupBy({
                by: ['supplierId'],
                _count: true,
            })
        )
        for (const pc of poCountData) {
            const existing = poMap.get(pc.supplierId) ?? { totalSpent: 0, poCount: 0 }
            existing.poCount = pc._count
            poMap.set(pc.supplierId, existing)
        }

        // AP data per supplier
        const apData = await withRetry(() =>
            prisma.aPInvoice.groupBy({
                by: ['supplierId'],
                where: { status: { in: ['UNPAID', 'OVERDUE'] } },
                _sum: { amount: true },
            })
        )
        const apMap = new Map(apData.map(a => [a.supplierId, Number(a._sum.amount ?? 0)]))

        // Products per supplier (via PO lines → products)
        const supplierProductLines = await withRetry(() =>
            prisma.purchaseOrderLine.findMany({
                select: {
                    productId: true,
                    po: { select: { supplierId: true } },
                    product: { select: { productName: true, wineType: true, country: true } },
                },
            })
        )
        const supplierProductMap = new Map<string, string[]>()
        const seenPairs = new Set<string>()
        for (const sp of supplierProductLines) {
            const sid = sp.po.supplierId
            const key = `${sid}:${sp.productId}`
            if (seenPairs.has(key)) continue
            seenPairs.add(key)
            const arr = supplierProductMap.get(sid) ?? []
            arr.push(`${sp.product.productName} (${sp.product.wineType})`)
            supplierProductMap.set(sid, arr)
        }

        // ═══ 3. MARKET CONTEXT — Producers & Regions ═══
        const producers = await withRetry(() =>
            prisma.producer.findMany({
                select: {
                    name: true,
                    country: true,
                    _count: { select: { products: true } },
                },
            })
        )

        const regions = await withRetry(() =>
            prisma.wineRegion.findMany({
                select: {
                    name: true,
                    country: true,
                    appellations: { select: { name: true, _count: { select: { products: true } } } },
                },
            })
        )

        // ═══ BUILD ENRICHED DATA ═══

        // Enrich products
        const enrichedProducts = products.map(p => {
            const sales = salesMap.get(p.id)
            const recent = recentSalesMap.get(p.id)
            const stock = stockMap.get(p.id) ?? 0
            const prices = priceMap.get(p.id) ?? []
            const hasSalesData = !!sales && sales.orderCount > 0

            return {
                name: p.productName,
                sku: p.skuCode,
                type: p.wineType,
                vintage: p.vintage,
                abv: Number(p.abvPercent),
                volume: p.volumeMl,
                classification: p.classification,
                producer: p.producer.name,
                producerCountry: p.producer.country,
                appellation: p.appellation?.name,
                region: p.appellation?.region?.name,
                country: p.country,
                status: p.status,
                isAllocation: p.isAllocationEligible,
                tastingNotes: p.tastingNotes,
                awards: p.awards.map(a => `${a.source}${a.score ? ' ' + Number(a.score) + 'pts' : ''}${a.awardedYear ? ' ' + a.awardedYear : ''}`),
                hasSalesData,
                totalRevenue: sales?.revenue ?? 0,
                totalQtySold: sales?.qtySold ?? 0,
                totalOrders: sales?.orderCount ?? 0,
                revenue90d: recent?.revenue90d ?? 0,
                qty90d: recent?.qty90d ?? 0,
                currentStock: stock,
                quotationCount: p._count.quotationLines,
                prices: prices.slice(0, 3).map(pr => `${pr.channel}: ${pr.price.toLocaleString()}đ`),
                daysSinceCreated: Math.round((now.getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
            }
        })

        // Enrich suppliers
        const enrichedSuppliers = suppliers.map(s => {
            const po = poMap.get(s.id)
            const ap = apMap.get(s.id) ?? 0
            const prods = supplierProductMap.get(s.id) ?? []
            return {
                name: s.name,
                code: s.code,
                type: s.type,
                country: s.country,
                tradeAgreement: s.tradeAgreement,
                coForm: s.coFormType,
                paymentTerm: s.paymentTerm,
                currency: s.defaultCurrency,
                incoterms: s.incoterms,
                leadTimeDays: s.leadTimeDays,
                status: s.status,
                primaryContact: s.contacts.find(c => c.isPrimary)?.name ?? s.contacts[0]?.name ?? 'N/A',
                totalSpent: po?.totalSpent ?? 0,
                poCount: po?.poCount ?? 0,
                apOutstanding: ap,
                contractCount: s._count.contracts,
                products: prods.slice(0, 5),
                notes: s.notes,
            }
        })

        // ═══ AGGREGATE STATS ═══
        const totalProducts = enrichedProducts.length
        const activeProducts = enrichedProducts.filter(p => p.status === 'ACTIVE').length
        const productsWithSales = enrichedProducts.filter(p => p.hasSalesData).length
        const productsNoSales = enrichedProducts.filter(p => !p.hasSalesData).length
        const totalProductRevenue = enrichedProducts.reduce((s, p) => s + p.totalRevenue, 0)
        const totalStock = enrichedProducts.reduce((s, p) => s + p.currentStock, 0)
        const outOfStock = enrichedProducts.filter(p => p.currentStock === 0 && p.status === 'ACTIVE').length

        // Type distribution
        const typeDist = enrichedProducts.reduce((acc, p) => { acc[p.type] = (acc[p.type] || 0) + 1; return acc }, {} as Record<string, number>)
        // Country distribution
        const countryDist = enrichedProducts.reduce((acc, p) => { acc[p.country] = (acc[p.country] || 0) + 1; return acc }, {} as Record<string, number>)
        // Revenue by type
        const revByType = enrichedProducts.reduce((acc, p) => { acc[p.type] = (acc[p.type] || 0) + p.totalRevenue; return acc }, {} as Record<string, number>)

        const totalSuppliers = enrichedSuppliers.length
        const activeSuppliers = enrichedSuppliers.filter(s => s.status === 'ACTIVE').length
        const totalSpending = enrichedSuppliers.reduce((s, sup) => s + sup.totalSpent, 0)
        const supplierCountries = new Set(enrichedSuppliers.map(s => s.country)).size

        // ═══ BUILD AI PROMPT ═══
        const productList = enrichedProducts
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .map(p => {
                const salesInfo = p.hasSalesData
                    ? `Revenue: ${p.totalRevenue.toLocaleString()}đ | Qty sold: ${p.totalQtySold} | Orders: ${p.totalOrders} | Last 90d: ${p.revenue90d.toLocaleString()}đ (${p.qty90d} units)`
                    : '🆕 CHƯA CÓ DỮ LIỆU BÁN HÀNG'
                const stockInfo = `Stock: ${p.currentStock} units${p.currentStock === 0 ? ' ⚠️ HẾT HÀNG' : ''}`
                const priceInfo = p.prices.length > 0 ? `Prices: ${p.prices.join(', ')}` : 'No prices set'
                const awardInfo = p.awards.length > 0 ? `Awards: ${p.awards.join(', ')}` : ''

                return `${p.name} | SKU: ${p.sku} | ${p.type} ${p.vintage ?? 'NV'} | Producer: ${p.producer} (${p.producerCountry}) | Region: ${p.appellation ?? 'N/A'} (${p.country}) | ABV: ${p.abv}% | ${p.volume}ml | Classification: ${p.classification ?? 'N/A'} | ${salesInfo} | ${stockInfo} | ${priceInfo} | Quotations: ${p.quotationCount} | ${p.isAllocation ? '🎯ALLOCATION' : ''} ${awardInfo} | Status: ${p.status}`
            }).join('\n')

        const supplierList = enrichedSuppliers
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .map(s => {
                return `${s.name} (${s.code}) | Type: ${s.type} | Country: ${s.country} | Trade: ${s.tradeAgreement ?? 'N/A'} | CO: ${s.coForm ?? 'N/A'} | Payment: ${s.paymentTerm ?? 'N/A'} | ${s.currency} | Incoterms: ${s.incoterms ?? 'N/A'} | Lead time: ${s.leadTimeDays}d | Total spent: ${s.totalSpent.toLocaleString()}đ | POs: ${s.poCount} | Contracts: ${s.contractCount} | AP outstanding: ${s.apOutstanding.toLocaleString()}đ | Products: [${s.products.join('; ')}] | Contact: ${s.primaryContact} | Status: ${s.status}`
            }).join('\n')

        const producerList = producers.map(p => `${p.name} (${p.country}) — ${p._count.products} products`).join(', ')
        const regionList = regions.map(r => `${r.name} (${r.country}): ${r.appellations.map(a => `${a.name} [${a._count.products}p]`).join(', ')}`).join('\n')

        const prompt = `Bạn là Wine Portfolio Director / Chief Merchandising Officer cho LY's Cellars, công ty nhập khẩu rượu vang cao cấp tại Việt Nam.

Bạn cần phân tích TOÀN BỘ danh mục sản phẩm và nhà cung cấp, kết hợp nghiên cứu thị trường rượu vang để tư vấn chiến lược cho CEO.

===== DANH MỤC SẢN PHẨM (${totalProducts} sản phẩm) =====
${productList}

===== NHÀ CUNG CẤP (${totalSuppliers} NCC) =====
${supplierList}

===== NHÀ SẢN XUẤT =====
${producerList}

===== VÙNG & APPELLATION =====
${regionList}

===== THỐNG KÊ TỔNG HỢP =====
- Products: ${totalProducts} (Active: ${activeProducts}, Out of stock: ${outOfStock})
- Có dữ liệu bán hàng: ${productsWithSales} | Chưa có: ${productsNoSales}
- Tổng doanh thu sản phẩm: ${totalProductRevenue.toLocaleString()} VND
- Tổng hàng tồn kho: ${totalStock} units
- Wine types: ${Object.entries(typeDist).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Countries: ${Object.entries(countryDist).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Revenue by type: ${Object.entries(revByType).map(([k, v]) => `${k}: ${v.toLocaleString()}đ`).join(', ')}
- Suppliers: ${totalSuppliers} (Active: ${activeSuppliers}) | ${supplierCountries} quốc gia
- Tổng chi NCC: ${totalSpending.toLocaleString()} VND

Hãy viết BÁO CÁO PHÂN TÍCH DANH MỤC & NGHIÊN CỨU THỊ TRƯỜNG CHO CEO bao gồm:

1. **📊 TỔNG QUAN DANH MỤC** — Portfolio Health Score (1-10), độ đa dạng (type/country/price range), cân đối portfolio
2. **🏆 TOP PERFORMERS** — Sản phẩm bán chạy nhất, doanh thu cao nhất, tỷ suất lợi nhuận tốt nhất (ước tính từ giá mua vs giá bán)
3. **🆕 SẢN PHẨM CHƯA CÓ DỮ LIỆU BÁN** — Phân tích từng sản phẩm chưa bán:
   - Đánh giá tiềm năng thị trường dựa trên loại rượu, vùng sản xuất, vintage
   - Gợi ý chiến lược GTM (go-to-market) cho từng nhóm
   - Xác định sản phẩm nên push mạnh vs sản phẩm nên cân nhắc loại bỏ
4. **🌍 NGHIÊN CỨU THỊ TRƯỜNG RƯỢU VANG VIỆT NAM** — Dựa trên kiến thức của bạn:
   - Xu hướng tiêu thụ rượu vang tại VN (loại rượu, phân khúc giá, kênh)
   - So sánh danh mục của LY's Cellars với xu hướng thị trường
   - Gaps & Opportunities: loại rượu/vùng nào LY's Cellars đang thiếu?
   - Cạnh tranh: phân tích positioning vs các nhà nhập khẩu lớn
5. **🏢 PHÂN TÍCH NHÀ CUNG CẤP** — 
   - Supplier concentration risk (quá phụ thuộc vào 1-2 NCC?)
   - Trade agreement optimization (EVFTA, AANZFTA...)
   - Lead time analysis, payment terms comparison
   - Supplier-product mapping: NCC nào cung cấp gì, đa dạng hóa
6. **💰 PRICING & MARGIN INSIGHTS** —
   - Phân tích cấu trúc giá theo kênh (HORECA vs retail vs wholesale)
   - Sản phẩm under-priced / over-priced so với thị trường
   - Cơ hội tối ưu margin
7. **📈 ĐỀ XUẤT CHIẾN LƯỢC** — Top 5 actions CEO nên thực hiện ngay:
   - Portfolio optimization (thêm/bớt SKU)
   - Supplier diversification
   - Market expansion opps
   - Pricing adjustments
   - GTM for unsold products

Yêu cầu:
- Viết bằng tiếng Việt, phong cách Wine Portfolio Director briefing cho CEO
- Cụ thể tên sản phẩm, tên NCC, tên vùng, số liệu thực
- Kết hợp kiến thức chuyên môn về thị trường rượu vang quốc tế & Việt Nam
- Với sản phẩm CHƯA CÓ DATA BÁN HÀNG: dùng kiến thức thị trường + đặc tính sản phẩm để đánh giá tiềm năng
- Tone: chiến lược, data-driven nhưng kết hợp market intuition`

        const result = await callGemini({
            prompt,
            systemPrompt: 'You are a Wine Portfolio Director and market analyst with deep expertise in the Vietnamese wine import market and global wine industry trends. Analyze product catalogs and suppliers with both data-driven insights and market intelligence. Write in Vietnamese for a CEO audience.',
            temperature: 0.5,
            maxTokens: 8192,
        })

        return NextResponse.json({
            success: result.success,
            analysis: result.text,
            error: result.error,
            stats: {
                totalProducts,
                activeProducts,
                productsWithSales,
                productsNoSales,
                outOfStock,
                totalProductRevenue,
                totalStock,
                typeDistribution: typeDist,
                countryDistribution: countryDist,
                totalSuppliers,
                activeSuppliers,
                supplierCountries,
                totalSpending,
            },
        })
    } catch (err) {
        console.error('[Catalog Analysis API]', err)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
