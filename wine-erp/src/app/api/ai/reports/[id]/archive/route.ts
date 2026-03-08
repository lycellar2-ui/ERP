import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    await prisma.aiReport.update({ where: { id }, data: { isArchived: true } })
    return NextResponse.json({ success: true })
}
