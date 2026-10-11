import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/session'

export async function PUT(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user || !hasRole(user, 'CEO', 'ADMIN')) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
        }
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
