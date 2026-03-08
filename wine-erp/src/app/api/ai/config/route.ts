import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json()
        await prisma.aiSystemConfig.upsert({
            where: { id: 'singleton' },
            update: body,
            create: { id: 'singleton', ...body },
        })
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[AI Config]', err)
        return NextResponse.json({ success: false }, { status: 500 })
    }
}
