import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
    try {
        const config = await prisma.aiSystemConfig.findUnique({
            where: { id: 'singleton' },
            select: { aiEnabled: true, allowedModules: true },
        })
        return NextResponse.json({
            enabled: config?.aiEnabled ?? true,
            allowedModules: (config?.allowedModules as string[]) ?? ['pipeline', 'crm', 'catalog', 'ceo', 'product-desc'],
        })
    } catch {
        return NextResponse.json({ enabled: true, allowedModules: [] })
    }
}
