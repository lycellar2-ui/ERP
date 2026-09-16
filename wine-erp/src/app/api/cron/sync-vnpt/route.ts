import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getVnptConfigForEntity, syncInvoiceStatusFromVnpt } from '@/lib/vnpt/vnpt-client'
import { VnptDraftMetadata } from '@/lib/vnpt/types'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { revalidateCache } from '@/lib/cache'

// GET /api/cron/sync-vnpt — Run automatically by Vercel Cron or manual curl
export async function GET(req: NextRequest) {
    return handleCronSync(req)
}

export async function POST(req: NextRequest) {
    return handleCronSync(req)
}

async function handleCronSync(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const querySecret = req.nextUrl.searchParams.get('secret')
    const isVercelCron = req.headers.get('user-agent')?.includes('vercel-cron')

    // Verify authentication if CRON_SECRET is configured
    if (cronSecret && !isVercelCron) {
        const isAuthorized = authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret
        if (!isAuthorized) {
            return NextResponse.json({ error: 'Unauthorized — Invalid or missing CRON_SECRET' }, { status: 401 })
        }
    }

    try {
        // Query draft invoices needing VNPT check
        const draftInvoices = await prisma.aRInvoice.findMany({
            where: {
                OR: [
                    { invoiceNo: { startsWith: 'NHAP-' } },
                    { notes: { contains: '"status":"DRAFT"' } },
                ],
            },
            include: {
                so: {
                    select: {
                        id: true,
                        soNo: true,
                        legalEntityId: true,
                        legalEntity: { select: { code: true, name: true } },
                    },
                },
            },
            take: 50,
            orderBy: { createdAt: 'desc' },
        })

        if (draftInvoices.length === 0) {
            return NextResponse.json({
                ok: true,
                message: 'Không có đơn hàng nào đang ở trạng thái nháp cần đồng bộ từ VNPT.',
                totalScanned: 0,
                updatedCount: 0,
                timestamp: new Date().toISOString(),
            })
        }

        const statsByEntity: Record<string, { scanned: number; synced: number; stillDraft: number; failed: number }> = {
            TA: { scanned: 0, synced: 0, stillDraft: 0, failed: 0 },
            LC: { scanned: 0, synced: 0, stillDraft: 0, failed: 0 },
        }

        let totalSynced = 0
        let totalStillDraft = 0
        let totalFailed = 0

        for (const inv of draftInvoices) {
            if (!inv.so) continue

            const entityCode = (inv.so.legalEntity?.code || 'TA').toUpperCase().includes('LY') || (inv.so.legalEntity?.code || '').toUpperCase() === 'LC' ? 'LC' : 'TA'
            const entityStats = statsByEntity[entityCode]
            entityStats.scanned++

            let existingVnpt: any = null
            let fkey = ''
            let pattern = ''

            if (inv.notes) {
                try {
                    const parsed = JSON.parse(inv.notes)
                    if (parsed.vnpt) {
                        existingVnpt = parsed.vnpt
                        fkey = parsed.vnpt.fkey
                        pattern = parsed.vnpt.pattern
                    }
                } catch { }
            }

            if (!fkey) {
                const sanitizedSoNo = inv.so.soNo.replace(/[^A-Za-z0-9_-]/g, '_')
                fkey = `SO_${sanitizedSoNo}`
            }

            const config = getVnptConfigForEntity(entityCode)

            try {
                const syncRes = await syncInvoiceStatusFromVnpt(config, fkey, pattern)

                if (syncRes.success && !syncRes.isDraft) {
                    const finalInvoiceNo = syncRes.fullInvoiceNo || `${syncRes.serial}-${syncRes.invoiceNo}`

                    const updatedVnptMeta: VnptDraftMetadata = {
                        ...(existingVnpt || {}),
                        fkey,
                        pattern: syncRes.pattern || pattern || config.pattern,
                        serial: syncRes.serial || config.serial,
                        invoiceNo: syncRes.invoiceNo,
                        fullInvoiceNo: finalInvoiceNo,
                        taxAuthorityCode: syncRes.taxAuthorityCode,
                        taxStatus: syncRes.taxStatus,
                        viewUrl: syncRes.viewUrl,
                        pdfUrl: syncRes.pdfUrl,
                        xmlUrl: syncRes.xmlUrl,
                        status: 'PUBLISHED',
                        syncedAt: new Date().toISOString(),
                        publishedAt: new Date().toISOString(),
                    }

                    let notesObj: any = {}
                    try {
                        notesObj = JSON.parse(inv.notes || '{}')
                    } catch {
                        notesObj = { rawNotes: inv.notes }
                    }
                    notesObj.vnpt = updatedVnptMeta

                    await prisma.aRInvoice.update({
                        where: { id: inv.id },
                        data: {
                            invoiceNo: finalInvoiceNo,
                            notes: JSON.stringify(notesObj),
                        },
                    })

                    entityStats.synced++
                    totalSynced++

                    await logAudit({
                        userId: 'system-cron',
                        action: 'UPDATE',
                        entityType: 'ARInvoice',
                        entityId: inv.id,
                        description: `[CRON VNPT] Đã tự động cập nhật số HĐ ${finalInvoiceNo} (Mã CQT: ${syncRes.taxAuthorityCode || 'N/A'}) cho đơn ${inv.so.soNo} (${config.entityName})`,
                    })
                } else if (syncRes.isDraft) {
                    entityStats.stillDraft++
                    totalStillDraft++
                } else {
                    entityStats.failed++
                    totalFailed++
                }
            } catch {
                entityStats.failed++
                totalFailed++
            }
        }

        if (totalSynced > 0) {
            revalidateCache('sales')
            revalidatePath('/dashboard/sales')
            revalidatePath('/dashboard/finance')
        }

        return NextResponse.json({
            ok: true,
            totalScanned: draftInvoices.length,
            totalSynced,
            totalStillDraft,
            totalFailed,
            entities: {
                'Thắng Ân (TA)': statsByEntity.TA,
                "Ly's Cellar (LC)": statsByEntity.LC,
            },
            timestamp: new Date().toISOString(),
        })
    } catch (err: any) {
        return NextResponse.json({
            ok: false,
            error: err.message || 'Lỗi xử lý cronjob đồng bộ hóa đơn VNPT',
            timestamp: new Date().toISOString(),
        }, { status: 500 })
    }
}
