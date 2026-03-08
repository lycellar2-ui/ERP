import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const report = await prisma.aiReport.findUnique({ where: { id }, select: { isPinned: true } })
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.aiReport.update({ where: { id }, data: { isPinned: !report.isPinned } })
    return NextResponse.json({ success: true })
}
