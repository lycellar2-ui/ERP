import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest) {
    try {
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
