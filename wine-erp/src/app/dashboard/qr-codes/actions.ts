'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'

// ── Generate QR codes for a GR (after confirm) ────
export async function generateQRCodesForGR(grId: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        const gr = await prisma.goodsReceipt.findUnique({
            where: { id: grId },
            include: {
                warehouse: { select: { name: true, code: true } },
                shipment: { select: { billOfLading: true } },
                lines: {
                    include: {
                        product: { select: { skuCode: true, productName: true, country: true, vintage: true, wineType: true } },
                        lot: { select: { lotNo: true, receivedDate: true } },
                    },
                },
            },
        })
        if (!gr) return { success: false, count: 0, error: 'GR không tồn tại' }
        if (gr.status !== 'CONFIRMED') return { success: false, count: 0, error: 'GR chưa được xác nhận' }

        const qrCodes = []
        for (const line of gr.lines) {
            if (!line.lot) continue

            // Check if QR already exists for this lot
            const existing = await prisma.qRCode.findFirst({ where: { lotNo: line.lot.lotNo } })
            if (existing) continue

            const code = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
            qrCodes.push({
                code,
                lotNo: line.lot.lotNo,
                productId: line.productId,
                lotData: {
                    lotNo: line.lot.lotNo,
                    skuCode: line.product.skuCode,
                    productName: line.product.productName,
                    vintage: line.product.vintage,
                    country: line.product.country,
                    wineType: line.product.wineType,
                    shipmentNo: gr.shipment?.billOfLading ?? 'N/A',
                    importDate: line.lot.receivedDate.toISOString().split('T')[0],
                    warehouse: gr.warehouse.name,
                    grNo: gr.grNo,
                },
            })
        }

        if (qrCodes.length > 0) {
            await prisma.qRCode.createMany({ data: qrCodes })
        }

        return { success: true, count: qrCodes.length }
    } catch (err: any) {
        return { success: false, count: 0, error: err.message }
    }
}

// ── List QR codes ─────────────────────────────────
export async function getQRCodes(filters: {
    search?: string
    page?: number
    pageSize?: number
} = {}) {
    const { search, page = 1, pageSize = 50 } = filters
    const cacheKey = `qrCodes:list:${page}:${pageSize}:${search ?? ''}`
    return cached(cacheKey, async () => {
        const skip = (page - 1) * pageSize

        const where: any = {}
        if (search) {
            where.OR = [
                { lotNo: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
            ]
        }

        const [qrCodes, total] = await Promise.all([
            prisma.qRCode.findMany({
                where, skip, take: pageSize,
                orderBy: { createdAt: 'desc' },
                include: { product: { select: { skuCode: true, productName: true } } },
            }),
            prisma.qRCode.count({ where }),
        ])

        return {
            rows: qrCodes.map(qr => ({
                id: qr.id,
                code: qr.code,
                lotNo: qr.lotNo,
                skuCode: qr.product.skuCode,
                productName: qr.product.productName,
                scanCount: qr.scanCount,
                firstScannedAt: qr.firstScannedAt,
                lastScannedAt: qr.lastScannedAt,
                createdAt: qr.createdAt,
                lotData: qr.lotData as any,
            })),
            total,
        }
    }, 30_000) // 30s cache
}

// ── Verify QR (public — used by /verify/[code]) ──
export async function verifyQRCode(code: string) {
    const qr = await prisma.qRCode.findUnique({ where: { code } })
    if (!qr) return { valid: false, error: 'Mã QR không hợp lệ hoặc không tồn tại' }

    const isFirstScan = qr.scanCount === 0
    const now = new Date()

    // Increment scan count
    await prisma.qRCode.update({
        where: { code },
        data: {
            scanCount: { increment: 1 },
            firstScannedAt: qr.firstScannedAt ?? now,
            lastScannedAt: now,
        },
    })

    const lotData = qr.lotData as any
    return {
        valid: true,
        isFirstScan,
        scanCount: qr.scanCount + 1,
        product: {
            name: lotData.productName ?? 'N/A',
            sku: lotData.skuCode ?? 'N/A',
            vintage: lotData.vintage ?? 'N/A',
            country: lotData.country ?? 'N/A',
            wineType: lotData.wineType ?? 'N/A',
        },
        lot: {
            lotNo: lotData.lotNo ?? qr.lotNo,
            shipmentNo: lotData.shipmentNo ?? 'N/A',
            importDate: lotData.importDate ?? 'N/A',
            warehouse: lotData.warehouse ?? 'N/A',
            grNo: lotData.grNo ?? 'N/A',
        },
        firstScannedAt: qr.firstScannedAt?.toISOString() ?? now.toISOString(),
    }
}

// ── QR Stats ──────────────────────────────────────
export async function getQRStats() {
    return cached('qrCodes:stats', async () => {
        const [total, scanned, unscanned] = await Promise.all([
            prisma.qRCode.count(),
            prisma.qRCode.count({ where: { scanCount: { gt: 0 } } }),
            prisma.qRCode.count({ where: { scanCount: 0 } }),
        ])
        return { total, scanned, unscanned }
    }, 30_000) // 30s cache
}

// ── Get QR codes for printing ─────────────────────
export async function getQRCodesForPrint(ids: string[]) {
    const qrs = await prisma.qRCode.findMany({
        where: { id: { in: ids } },
        include: { product: { select: { skuCode: true, productName: true } } },
    })
    return qrs.map(qr => {
        const lotData = qr.lotData as any
        return {
            code: qr.code,
            lotNo: qr.lotNo,
            skuCode: qr.product.skuCode,
            productName: qr.product.productName,
            vintage: lotData?.vintage ?? '',
            country: lotData?.country ?? '',
        }
    })
}

// ── Generate printable HTML for QR labels ─────────
export async function generatePrintLabelsHtml(ids: string[], baseUrl: string): Promise<string> {
    const labels = await getQRCodesForPrint(ids)

    const labelHtml = labels.map(l => `
        <div class="label">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${baseUrl}/verify/${l.code}`)}" alt="QR" />
            <div class="info">
                <strong>${l.productName}</strong>
                <span>${l.skuCode}</span>
                <span>Lot: ${l.lotNo}</span>
                ${l.vintage ? `<span>Vintage: ${l.vintage}</span>` : ''}
                <span class="origin">${l.country}</span>
            </div>
        </div>
    `).join('')

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>QR Labels — LY's Cellars</title>
<style>
    @page { size: A4; margin: 8mm; }
    body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
    .label {
        border: 1px solid #ddd; border-radius: 4px; padding: 4mm;
        display: flex; gap: 3mm; align-items: center;
        page-break-inside: avoid; height: 30mm;
    }
    .label img { width: 25mm; height: 25mm; }
    .info { display: flex; flex-direction: column; font-size: 7pt; line-height: 1.3; }
    .info strong { font-size: 8pt; }
    .info span { color: #666; }
    .origin { font-weight: 600; color: #333 !important; }
    @media print { body { -webkit-print-color-adjust: exact; } }
</style></head><body>
<div class="grid">${labelHtml}</div>
<script>window.onload=()=>window.print()</script>
</body></html>`
}
