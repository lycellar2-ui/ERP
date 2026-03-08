'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// ═══════════════════════════════════════════════════
// AI SYSTEM CONFIG — Toggle + Settings
// ═══════════════════════════════════════════════════

export async function getAiConfig() {
    let config = await prisma.aiSystemConfig.findUnique({ where: { id: 'singleton' } })
    if (!config) {
        config = await prisma.aiSystemConfig.create({
            data: { id: 'singleton', aiEnabled: true },
        })
    }
    return JSON.parse(JSON.stringify(config))
}

export async function isAiEnabled(): Promise<boolean> {
    try {
        const config = await prisma.aiSystemConfig.findUnique({
            where: { id: 'singleton' },
            select: { aiEnabled: true },
        })
        return config?.aiEnabled ?? true
    } catch { return true }
}

export async function isModuleAiEnabled(module: string): Promise<boolean> {
    try {
        const config = await prisma.aiSystemConfig.findUnique({
            where: { id: 'singleton' },
            select: { aiEnabled: true, allowedModules: true },
        })
        if (!config?.aiEnabled) return false
        const allowed = config.allowedModules as string[]
        return allowed.includes(module)
    } catch { return true }
}

export async function toggleAiEnabled(enabled: boolean) {
    await prisma.aiSystemConfig.upsert({
        where: { id: 'singleton' },
        update: { aiEnabled: enabled },
        create: { id: 'singleton', aiEnabled: enabled },
    })
    revalidatePath('/dashboard')
}

export async function updateAiConfig(data: {
    aiEnabled?: boolean
    allowedModules?: string[]
    defaultTemperature?: number
    defaultMaxTokens?: number
}) {
    await prisma.aiSystemConfig.upsert({
        where: { id: 'singleton' },
        update: data,
        create: { id: 'singleton', ...data },
    })
    revalidatePath('/dashboard')
}

// ═══════════════════════════════════════════════════
// AI REPORTS — Save, List, Pin, Archive, Delete
// ═══════════════════════════════════════════════════

export async function saveAiReport(input: {
    module: string
    title: string
    analysis: string
    stats?: any
    prompt?: string
}) {
    const report = await prisma.aiReport.create({
        data: {
            module: input.module,
            title: input.title,
            analysis: input.analysis,
            stats: input.stats ?? undefined,
            prompt: input.prompt,
        },
    })
    return JSON.parse(JSON.stringify(report))
}

export async function getAiReports(module?: string, limit = 20) {
    const reports = await prisma.aiReport.findMany({
        where: {
            ...(module ? { module } : {}),
            isArchived: false,
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: limit,
    })
    return JSON.parse(JSON.stringify(reports))
}

export async function getAiReportById(id: string) {
    const report = await prisma.aiReport.findUnique({ where: { id } })
    return report ? JSON.parse(JSON.stringify(report)) : null
}

export async function togglePinReport(id: string) {
    const report = await prisma.aiReport.findUnique({ where: { id }, select: { isPinned: true } })
    if (!report) return
    await prisma.aiReport.update({
        where: { id },
        data: { isPinned: !report.isPinned },
    })
}

export async function archiveReport(id: string) {
    await prisma.aiReport.update({
        where: { id },
        data: { isArchived: true },
    })
}

export async function deleteAiReport(id: string) {
    await prisma.aiReport.delete({ where: { id } })
}

// ═══════════════════════════════════════════════════
// AI PROMPT TEMPLATES — CRUD
// ═══════════════════════════════════════════════════

export async function getPromptTemplates() {
    const templates = await prisma.aiPromptTemplate.findMany({
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { runs: true } } },
    })
    return JSON.parse(JSON.stringify(templates))
}

export async function getPromptTemplate(slug: string) {
    const template = await prisma.aiPromptTemplate.findUnique({ where: { slug } })
    return template ? JSON.parse(JSON.stringify(template)) : null
}

export async function upsertPromptTemplate(input: {
    slug: string
    name: string
    description?: string
    systemPrompt: string
    userTemplate: string
    variables?: string[]
    temperature?: number
    maxTokens?: number
}) {
    const data = {
        name: input.name,
        description: input.description ?? null,
        systemPrompt: input.systemPrompt,
        userTemplate: input.userTemplate,
        variables: input.variables ?? [],
        temperature: input.temperature ?? 0.7,
        maxTokens: input.maxTokens ?? 4096,
    }
    const result = await prisma.aiPromptTemplate.upsert({
        where: { slug: input.slug },
        update: data,
        create: { slug: input.slug, ...data },
    })
    return JSON.parse(JSON.stringify(result))
}

export async function deletePromptTemplate(slug: string) {
    await prisma.aiPromptTemplate.delete({ where: { slug } })
}

// ═══════════════════════════════════════════════════
// AI USAGE STATS
// ═══════════════════════════════════════════════════

export async function getAiUsageStats() {
    const [totalRuns, successRuns, recentRuns, totalCost] = await Promise.all([
        prisma.aiPromptRun.count(),
        prisma.aiPromptRun.count({ where: { success: true } }),
        prisma.aiPromptRun.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                provider: true,
                model: true,
                inputTokens: true,
                outputTokens: true,
                costUsd: true,
                durationMs: true,
                success: true,
                error: true,
                createdAt: true,
            },
        }),
        prisma.aiPromptRun.aggregate({ _sum: { costUsd: true } }),
    ])

    const totalReports = await prisma.aiReport.count()

    return JSON.parse(JSON.stringify({
        totalRuns,
        successRuns,
        successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0,
        totalCost: Number(totalCost._sum.costUsd ?? 0),
        totalReports,
        recentRuns,
    }))
}
