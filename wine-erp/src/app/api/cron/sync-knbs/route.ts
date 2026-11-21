import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { syncKnbsTaPayments } from '@/lib/knbs/sync-ta-payments'

// GET / POST /api/cron/sync-knbs — Scheduled sync for Thắng Ân cash-in receipts from KNBS
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

    if (cronSecret && !isVercelCron) {
        const isAuthorized = authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret
        if (!isAuthorized) {
            return NextResponse.json(
                { error: 'Unauthorized — Invalid or missing CRON_SECRET' },
                { status: 401 }
            )
        }
    }

    try {
        const summary = await syncKnbsTaPayments()
        if (summary.syncedCount > 0) {
            revalidatePath('/dashboard/finance')
            revalidatePath('/dashboard/sales')
            revalidatePath('/dashboard/customers')
        }
        return NextResponse.json({ ok: true, ...summary })
    } catch (err: any) {
        console.error('[CRON sync-knbs] Error:', err)
        return NextResponse.json(
            { ok: false, error: err?.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
