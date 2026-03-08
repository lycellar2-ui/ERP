'use server'

import { prisma } from '@/lib/db'
import { withRetry } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { encryptApiKey, maskApiKey } from '@/lib/encryption'

// ═══════════════════════════════════════════════════
// API KEY VAULT
// ═══════════════════════════════════════════════════

export type ApiKeyRow = {
    id: string
    provider: string
    label: string
    maskedKey: string
    isActive: boolean
    monthlyBudget: number | null
    usedThisMonth: number
    lastTestedAt: Date | null
}

export async function getApiKeys(): Promise<ApiKeyRow[]> {
    const keys = await withRetry(() => prisma.aiApiKey.findMany({ orderBy: { provider: 'asc' } }))
    const rows: ApiKeyRow[] = []
    for (const k of keys) {
        rows.push({
            id: k.id,
            provider: k.provider,
            label: k.label,
            maskedKey: await maskApiKey(k.encryptedKey, k.iv),
            isActive: k.isActive,
            monthlyBudget: k.monthlyBudget ? Number(k.monthlyBudget) : null,
            usedThisMonth: Number(k.usedThisMonth),
            lastTestedAt: k.lastTestedAt,
        })
    }
    return rows
}

export async function saveApiKey(input: {
    provider: string
    label: string
    apiKey: string
    monthlyBudget?: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { encrypted, iv } = await encryptApiKey(input.apiKey)
        await withRetry(() => prisma.aiApiKey.upsert({
            where: { provider: input.provider },
            create: {
                provider: input.provider,
                label: input.label,
                encryptedKey: encrypted,
                iv,
                monthlyBudget: input.monthlyBudget ?? null,
            },
            update: {
                label: input.label,
                encryptedKey: encrypted,
                iv,
                monthlyBudget: input.monthlyBudget ?? null,
                lastTestedAt: null,
            },
        }))
        revalidatePath('/dashboard/ai')
        return { success: true }
    } catch (err: any) {
        console.error('[AI Vault] saveApiKey error:', err.message)
        return { success: false, error: err.message }
    }
}

export async function toggleApiKey(id: string): Promise<{ success: boolean }> {
    const key = await prisma.aiApiKey.findUnique({ where: { id } })
    if (!key) return { success: false }
    await prisma.aiApiKey.update({ where: { id }, data: { isActive: !key.isActive } })
    revalidatePath('/dashboard/ai')
    return { success: true }
}

export async function deleteApiKey(id: string): Promise<{ success: boolean }> {
    await prisma.aiApiKey.delete({ where: { id } })
    revalidatePath('/dashboard/ai')
    return { success: true }
}

export async function testApiKey(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const key = await withRetry(() => prisma.aiApiKey.findUnique({ where: { id } }))
        if (!key) return { success: false, error: 'Key not found' }

        const { decryptApiKey } = await import('@/lib/encryption')
        const plainKey = await decryptApiKey(key.encryptedKey, key.iv)

        // Actually test via API call
        if (key.provider === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${plainKey}`
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }],
                    generationConfig: { maxOutputTokens: 10 },
                }),
            })
            if (!response.ok) {
                const errText = await response.text()
                console.error('[AI Vault] testApiKey API error:', response.status, errText.slice(0, 200))
                return { success: false, error: `API Error ${response.status}: ${errText.slice(0, 200)}` }
            }
        }

        await withRetry(() => prisma.aiApiKey.update({ where: { id }, data: { lastTestedAt: new Date() } }))
        revalidatePath('/dashboard/ai')
        return { success: true }
    } catch (err: any) {
        console.error('[AI Vault] testApiKey error:', err.message)
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// PROMPT TEMPLATES
// ═══════════════════════════════════════════════════

export type PromptTemplateRow = {
    id: string
    slug: string
    name: string
    description: string | null
    systemPrompt: string
    userTemplate: string
    variables: string[]
    temperature: number
    maxTokens: number
    runCount: number
    createdAt: Date
}

export async function getPromptTemplates(): Promise<PromptTemplateRow[]> {
    const templates = await prisma.aiPromptTemplate.findMany({
        include: { _count: { select: { runs: true } } },
        orderBy: { createdAt: 'desc' },
    })
    return templates.map(t => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        systemPrompt: t.systemPrompt,
        userTemplate: t.userTemplate,
        variables: t.variables as string[],
        temperature: t.temperature,
        maxTokens: t.maxTokens,
        runCount: t._count.runs,
        createdAt: t.createdAt,
    }))
}

export async function createPromptTemplate(input: {
    slug: string
    name: string
    description?: string
    systemPrompt: string
    userTemplate: string
    variables?: string[]
    temperature?: number
    maxTokens?: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.aiPromptTemplate.create({
            data: {
                slug: input.slug,
                name: input.name,
                description: input.description,
                systemPrompt: input.systemPrompt,
                userTemplate: input.userTemplate,
                variables: input.variables ?? [],
                temperature: input.temperature ?? 0.7,
                maxTokens: input.maxTokens ?? 1024,
            },
        })
        revalidatePath('/dashboard/ai')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deletePromptTemplate(id: string): Promise<{ success: boolean }> {
    await prisma.aiPromptTemplate.delete({ where: { id } })
    revalidatePath('/dashboard/ai')
    return { success: true }
}

// ═══════════════════════════════════════════════════
// AI USAGE STATS
// ═══════════════════════════════════════════════════

export async function getAiUsageStats() {
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [totalRuns, monthRuns, failedRuns, tokenStats] = await Promise.all([
        prisma.aiPromptRun.count(),
        prisma.aiPromptRun.count({ where: { createdAt: { gte: firstOfMonth } } }),
        prisma.aiPromptRun.count({ where: { success: false, createdAt: { gte: firstOfMonth } } }),
        prisma.aiPromptRun.aggregate({
            where: { createdAt: { gte: firstOfMonth } },
            _sum: { inputTokens: true, outputTokens: true, costUsd: true },
            _avg: { durationMs: true },
        }),
    ])

    return {
        totalRuns,
        monthRuns,
        failedRuns,
        monthTokens: (tokenStats._sum.inputTokens ?? 0) + (tokenStats._sum.outputTokens ?? 0),
        monthCostUsd: Number(tokenStats._sum.costUsd ?? 0),
        avgDurationMs: Math.round(tokenStats._avg.durationMs ?? 0),
    }
}

export async function logAiRun(input: {
    templateId?: string
    provider: string
    model: string
    inputTokens: number
    outputTokens: number
    costUsd: number
    durationMs: number
    success: boolean
    error?: string
    userId?: string
}) {
    await prisma.aiPromptRun.create({ data: input })
    // Update monthly usage
    if (input.costUsd > 0) {
        await prisma.aiApiKey.updateMany({
            where: { provider: input.provider },
            data: { usedThisMonth: { increment: input.costUsd } },
        })
    }
}
