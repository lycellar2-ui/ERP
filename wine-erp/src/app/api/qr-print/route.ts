import { NextRequest, NextResponse } from 'next/server'
import { generatePrintLabelsHtml } from '@/app/dashboard/qr-codes/actions'
import { getCurrentUser } from '@/lib/session'

export async function POST(req: NextRequest) {
    const user = await getCurrentUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { ids } = await req.json()
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'No QR code IDs provided' }, { status: 400 })
    }

    const baseUrl = req.nextUrl.origin
    const html = await generatePrintLabelsHtml(ids, baseUrl)

    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
        },
    })
}
