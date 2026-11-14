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
        const updateData: Record<string, unknown> = {}
        if (typeof body.aiEnabled === 'boolean') updateData.aiEnabled = body.aiEnabled
        if (Array.isArray(body.allowedModules)) updateData.allowedModules = body.allowedModules
        if (typeof body.defaultTemperature === 'number') updateData.defaultTemperature = body.defaultTemperature
        if (typeof body.defaultMaxTokens === 'number') updateData.defaultMaxTokens = body.defaultMaxTokens
        await prisma.aiSystemConfig.upsert({
            where: { id: 'singleton' },
            update: updateData,
            create: { id: 'singleton', ...updateData },
        })
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[AI Config]', err)
        return NextResponse.json({ success: false }, { status: 500 })
    }
}
