import { NextRequest, NextResponse } from 'next/server'
import { runScheduledReports } from '@/app/dashboard/reports/actions'

// GET /api/cron/reports — Called by Vercel Cron or external scheduler
// Add to vercel.json: { "crons": [{ "path": "/api/cron/reports", "schedule": "0 0 * * *" }] }
export async function GET(req: NextRequest) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Always require CRON_SECRET — never skip auth
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await runScheduledReports()

    return NextResponse.json({
        ok: true,
        ...result,
        timestamp: new Date().toISOString(),
    })
}
