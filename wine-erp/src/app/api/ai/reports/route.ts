import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { module, title, analysis, stats, prompt } = body

        if (!module || !title || !analysis) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
        }

        const report = await prisma.aiReport.create({
            data: {
                module,
                title,
                analysis,
                stats: stats ?? undefined,
                prompt: prompt ?? undefined,
            },
        })

        return NextResponse.json({ success: true, id: report.id })
    } catch (err) {
        console.error('[Save AI Report]', err)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
