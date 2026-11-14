import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser()
    if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const report = await prisma.aiReport.findUnique({ where: { id }, select: { isPinned: true } })
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.aiReport.update({ where: { id }, data: { isPinned: !report.isPinned } })
    return NextResponse.json({ success: true })
}
