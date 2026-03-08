import { NextRequest, NextResponse } from 'next/server'
import { autoExpireRegDocs } from '@/app/dashboard/contracts/reg-doc-actions'

// GET /api/cron/compliance — Called by Vercel Cron daily
// Add to vercel.json: { "crons": [{ "path": "/api/cron/compliance", "schedule": "0 1 * * *" }] }
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Always require CRON_SECRET — never skip auth
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await autoExpireRegDocs()

    return NextResponse.json({
        ok: true,
        ...result,
        timestamp: new Date().toISOString(),
    })
}
