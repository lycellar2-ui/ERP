'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'

export type OppStage = 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'

export type PipelineRow = {
    id: string
    name: string
    customerId: string
    customerName: string
    customerCode: string
    stage: OppStage
    expectedValue: number
    probability: number
    assigneeName: string
    assigneeId: string
    closeDate: Date | null
    notes: string | null
    createdAt: Date
}

// ── Get all opportunities ────────────────────────
export async function getOpportunities(): Promise<PipelineRow[]> {
    return cached('pipeline:list', async () => {
        const rows = await prisma.salesOpportunity.findMany({
            include: {
                customer: { select: { name: true, code: true } },
                assignee: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        })
        return rows.map(r => ({
            id: r.id,
            name: r.name,
            customerId: r.customerId,
            customerName: r.customer.name,
            customerCode: r.customer.code,
            stage: r.stage as OppStage,
            expectedValue: Number(r.expectedValue),
            probability: r.probability,
            assigneeName: r.assignee.name,
            assigneeId: r.assignedTo,
            closeDate: r.closeDate,
            notes: r.notes,
            createdAt: r.createdAt,
        }))
    }) // end cached
}

// ── Create opportunity ───────────────────────────
export async function createOpportunity(input: {
    name: string
    customerId: string
    expectedValue: number
    probability?: number
    assignedTo: string
    closeDate?: string
    notes?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.salesOpportunity.create({
            data: {
                name: input.name,
                customerId: input.customerId,
                expectedValue: input.expectedValue,
                probability: input.probability ?? 30,
                assignedTo: input.assignedTo,
                stage: 'LEAD',
                closeDate: input.closeDate ? new Date(input.closeDate) : null,
                notes: input.notes,
            },
        })
        revalidateCache('pipeline')
        revalidatePath('/dashboard/pipeline')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Move stage ───────────────────────────────────
export async function moveOpportunityStage(id: string, stage: OppStage): Promise<{ success: boolean; error?: string }> {
    try {
        const prob: Record<OppStage, number> = { LEAD: 10, QUALIFIED: 30, PROPOSAL: 50, NEGOTIATION: 70, WON: 100, LOST: 0 }
        await prisma.salesOpportunity.update({
            where: { id },
            data: { stage: stage as any, probability: prob[stage] },
        })
        revalidatePath('/dashboard/pipeline')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Pipeline stats ───────────────────────────────
export async function getPipelineStats() {
    return cached('pipeline:stats', async () => {
        const all = await prisma.salesOpportunity.findMany({
            select: { stage: true, expectedValue: true, probability: true },
        })
        const stages = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as OppStage[]
        const byStage = Object.fromEntries(stages.map(s => [s, { count: 0, value: 0 }]))
        for (const o of all) {
            const s = o.stage as OppStage
            byStage[s].count++
            byStage[s].value += Number(o.expectedValue)
        }
        const open = all.filter(o => !['WON', 'LOST'].includes(o.stage))
        const totalPipelineValue = open.reduce((s, o) => s + Number(o.expectedValue), 0)
        const weightedValue = open.reduce((s, o) => s + Number(o.expectedValue) * o.probability / 100, 0)
        const wonCount = byStage['WON'].count
        const totalClosed = wonCount + byStage['LOST'].count
        const conversionRate = totalClosed > 0 ? Math.round(wonCount / totalClosed * 100) : 0

        return { byStage, totalPipelineValue, weightedValue, conversionRate, total: all.length }
    }) // end cached
}

// ── Delete opportunity ───────────────────────────
export async function deleteOpportunity(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.salesOpportunity.delete({ where: { id } })
        revalidatePath('/dashboard/pipeline')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
