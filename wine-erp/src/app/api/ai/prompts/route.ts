import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/session'

export async function PUT(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user || !hasRole(user, 'CEO', 'ADMIN', 'Admin', 'SYS:ADMIN')) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
        }
        const body = await req.json()
        const { slug, systemPrompt, userTemplate, temperature, maxTokens } = body

        if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

        await prisma.aiPromptTemplate.update({
            where: { slug },
            data: {
                ...(systemPrompt !== undefined && { systemPrompt }),
                ...(userTemplate !== undefined && { userTemplate }),
                ...(temperature !== undefined && { temperature: parseFloat(temperature) }),
                ...(maxTokens !== undefined && { maxTokens: parseInt(maxTokens) }),
            },
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[Update Prompt]', err)
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
    }
}
