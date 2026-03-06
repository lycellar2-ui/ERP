// API Route: Import products from LYs Cellars crawled JSON data
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Vendor → Country mapping
const VENDOR_COUNTRY: Record<string, string> = {
    'sartori di verona': 'IT',
    'eugenio collavini': 'IT',
    'alta mora': 'IT',
    'la jara': 'IT',
    'lamura': 'IT',
    'casa mirafiore': 'IT',
    'maison bouey': 'FR',
    'domaine de la tour blanche': 'FR',
    'domaine de la solitude': 'FR',
    'pardon & fils': 'FR',
    'badouin millet': 'FR',
    'domaine de rochebin': 'FR',
    'domaine du meteore': 'FR',
    'lorgeril': 'FR',
    'la perierre': 'FR',
    'berton vineyards': 'AU',
    'vina san esteban': 'CL',
}

// Wine type mapping from Vietnamese
const WINE_TYPE_MAP: Record<string, string> = {
    'rượu vang đỏ': 'RED',
    'rượu vang trắng': 'WHITE',
    'rượu vang hồng': 'ROSE',
    'rượu vang nổ': 'SPARKLING',
}

function extractFromHtml(html: string | null, pattern: RegExp): string | null {
    if (!html) return null
    const match = html.match(pattern)
    return match?.[1]?.trim()?.replace(/&nbsp;/g, '')?.replace(/<[^>]*>/g, '').trim() || null
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const products = body.products as any[]
        if (!products?.length) {
            return NextResponse.json({ error: 'No products provided' }, { status: 400 })
        }

        const results = {
            total: products.length,
            created: 0,
            skipped: 0,
            errors: [] as { sku: string; name: string; error: string }[],
        }

        // Cache producers
        const producerCache = new Map<string, string>()
        const existingProducers = await prisma.producer.findMany({ select: { id: true, name: true } })
        existingProducers.forEach(p => producerCache.set(p.name.toLowerCase(), p.id))

        // Cache existing SKUs
        const existingProducts = await prisma.product.findMany({
            where: { deletedAt: null },
            select: { skuCode: true },
        })
        const existingSKUs = new Set(existingProducts.map(p => p.skuCode))

        for (const p of products) {
            const sku = p.variants?.[0]?.sku || ''
            const name = p.title || ''
            const vendor = p.vendor || ''
            const productType = (p.product_type || '').toLowerCase()
            const price = p.variants?.[0]?.price ? Number(p.variants[0].price) : 0
            const bodyHtml = p.body_html || ''

            // Skip if no SKU
            if (!sku) {
                results.errors.push({ sku: 'N/A', name, error: 'Không có SKU' })
                results.skipped++
                continue
            }

            // Skip duplicate
            if (existingSKUs.has(sku)) {
                results.skipped++
                continue
            }

            try {
                // Wine type
                const wineType = WINE_TYPE_MAP[productType] || 'RED'

                // Country from vendor
                const country = VENDOR_COUNTRY[vendor.toLowerCase()] || 'FR'

                // Producer — find or create
                let producerId = producerCache.get(vendor.toLowerCase())
                if (!producerId) {
                    const newProducer = await prisma.producer.create({
                        data: { name: vendor, country },
                    })
                    producerId = newProducer.id
                    producerCache.set(vendor.toLowerCase(), producerId)
                }

                // Extract vintage from body_html
                let vintage: number | null = null
                const vintageStr = extractFromHtml(bodyHtml, /Vintage:?\s*<\/strong>\s*(?:&nbsp;)?(\d{4})/i)
                    || extractFromHtml(bodyHtml, /Vintage:?\s*(?:&nbsp;)?(\d{4})/i)
                if (vintageStr) vintage = parseInt(vintageStr)

                // Extract ABV from body_html
                let abv: number | null = null
                const abvStr = extractFromHtml(bodyHtml, /(?:Độ cồn|ABV|Nồng độ cồn):?\s*<\/strong>\s*(?:&nbsp;)?([\d.,]+)/i)
                    || extractFromHtml(bodyHtml, /(?:Độ cồn|ABV):?\s*(?:&nbsp;)?([\d.,]+)/i)
                if (abvStr) abv = parseFloat(abvStr.replace(',', '.'))

                // Extract classification from body_html
                const classification = extractFromHtml(bodyHtml, /(?:Phân loại|Classification):?\s*<\/strong>\s*(?:&nbsp;)?([^<]+)/i)

                // Create product
                await prisma.product.create({
                    data: {
                        skuCode: sku,
                        productName: name,
                        producerId,
                        vintage,
                        country,
                        abvPercent: abv ?? 13.0,
                        volumeMl: 750,
                        format: 'STANDARD',
                        packagingType: 'CARTON',
                        unitsPerCase: 12,
                        hsCode: '2204211000',
                        wineType: wineType as any,
                        classification,
                        status: 'ACTIVE',
                    },
                })

                existingSKUs.add(sku)
                results.created++
            } catch (err: any) {
                results.errors.push({
                    sku,
                    name,
                    error: err.code === 'P2002' ? 'SKU đã tồn tại' : (err.message || 'Unknown error'),
                })
            }
        }

        return NextResponse.json(results)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
