import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { buildPosmVoucherPrintHtml } from '@/app/dashboard/warehouse/posm-print-template'

export async function GET(req: NextRequest) {
    try {
        await requireAuth()
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const docNo = req.nextUrl.searchParams.get('docNo')?.trim()
    const legalEntityIdParam = req.nextUrl.searchParams.get('legalEntityId')?.trim() || ''

    if (!docNo) {
        return NextResponse.json({ error: 'Thiếu tham số docNo' }, { status: 400 })
    }

    const rows = await prisma.posmTransaction.findMany({
        where: { docNo },
        include: {
            posmProduct: {
                select: {
                    posmCode: true,
                    name: true,
                    category: true,
                    unit: true,
                },
            },
            legalEntity: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                    taxId: true,
                    address: true,
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    })

    if (rows.length === 0) {
        return new NextResponse(
            '<!doctype html><html lang="vi"><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px;">Không tìm thấy phiếu xuất kho POSM.</body></html>',
            { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
    }

    let resolvedEntity = legalEntityIdParam
        ? await prisma.legalEntity.findUnique({
            where: { id: legalEntityIdParam },
            select: { id: true, code: true, name: true, taxId: true, address: true },
        })
        : null

    if (!resolvedEntity && rows[0].legalEntity) {
        resolvedEntity = rows[0].legalEntity
    }

    if (!resolvedEntity) {
        resolvedEntity =
            (await prisma.legalEntity.findFirst({
                where: { code: 'LC' },
                select: { id: true, code: true, name: true, taxId: true, address: true },
            })) ||
            (await prisma.legalEntity.findFirst({
                orderBy: { code: 'asc' },
                select: { id: true, code: true, name: true, taxId: true, address: true },
            }))
    }

    const headerTx = rows[0]
    const companyName = resolvedEntity?.name || "CÔNG TY TNHH HẦM RƯỢU LY'S"
    const companyTaxId = resolvedEntity?.taxId || (!resolvedEntity ? '0109902863' : null)
    const companyAddress =
        resolvedEntity?.address ||
        (!resolvedEntity ? 'Số 12 Ngõ 52 Đường Giang Văn Minh, Phường Ba Đình, Thành phố Hà Nội, Việt Nam.' : null)

    const html = buildPosmVoucherPrintHtml(
        {
            companyName,
            companyTaxId,
            companyAddress,
            docNo: headerTx.docNo,
            performedAt: headerTx.performedAt,
            reason: headerTx.reason,
            recipient: headerTx.recipient,
            requestedBy: headerTx.requestedBy,
            notes: headerTx.notes,
            lines: rows.map(row => ({
                posmProductCode: row.posmProduct.posmCode,
                posmProductName: row.posmProduct.name,
                category: row.posmProduct.category,
                unit: row.posmProduct.unit,
                qty: Number(row.qty),
                unitCost: Number(row.unitCost),
                totalCost: Number(row.totalCost),
            })),
        },
        { showToolbar: true, autoPrint: true }
    )

    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    })
}
