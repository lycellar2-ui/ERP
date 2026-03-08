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
export async function moveOpportunityStage(id: string, stage: OppStage, lostReason?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const prob: Record<OppStage, number> = { LEAD: 10, QUALIFIED: 30, PROPOSAL: 50, NEGOTIATION: 70, WON: 100, LOST: 0 }
        const current = await prisma.salesOpportunity.findUnique({ where: { id }, select: { stage: true, notes: true } })
        if (!current) return { success: false, error: 'Opportunity not found' }

        const updateData: any = {
            stage: stage as any,
            probability: prob[stage],
            previousStage: current.stage,
            stageChangedAt: new Date(),
        }
        if (stage === 'LOST' && lostReason) {
            updateData.notes = lostReason
        }
        if (stage === 'WON' || stage === 'LOST') {
            updateData.closeDate = new Date()
        }

        await prisma.salesOpportunity.update({ where: { id }, data: updateData })
        revalidateCache('pipeline')
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
        revalidateCache('pipeline')
        revalidatePath('/dashboard/pipeline')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Get single opportunity detail ────────────────
export type OpportunityDetail = {
    id: string
    name: string
    customerId: string
    customerName: string
    customerCode: string
    customerType: string
    stage: OppStage
    previousStage: OppStage | null
    expectedValue: number
    probability: number
    assigneeName: string
    assigneeId: string
    closeDate: Date | null
    stageChangedAt: Date
    notes: string | null
    createdAt: Date
    updatedAt: Date
    daysInStage: number
    totalAge: number
}

export async function getOpportunityDetail(id: string): Promise<OpportunityDetail | null> {
    const opp = await prisma.salesOpportunity.findUnique({
        where: { id },
        include: {
            customer: { select: { name: true, code: true, customerType: true } },
            assignee: { select: { name: true } },
        },
    })
    if (!opp) return null
    const now = new Date()
    return {
        id: opp.id,
        name: opp.name,
        customerId: opp.customerId,
        customerName: opp.customer.name,
        customerCode: opp.customer.code,
        customerType: opp.customer.customerType,
        stage: opp.stage as OppStage,
        previousStage: (opp.previousStage as OppStage) ?? null,
        expectedValue: Number(opp.expectedValue),
        probability: opp.probability,
        assigneeName: opp.assignee.name,
        assigneeId: opp.assignedTo,
        closeDate: opp.closeDate,
        stageChangedAt: opp.stageChangedAt,
        notes: opp.notes,
        createdAt: opp.createdAt,
        updatedAt: opp.updatedAt,
        daysInStage: Math.round((now.getTime() - opp.stageChangedAt.getTime()) / (1000 * 60 * 60 * 24)),
        totalAge: Math.round((now.getTime() - opp.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    }
}

// ── Update opportunity ───────────────────────────
export async function updateOpportunity(id: string, input: {
    name?: string
    expectedValue?: number
    assignedTo?: string
    closeDate?: string | null
    notes?: string | null
}): Promise<{ success: boolean; error?: string }> {
    try {
        const data: any = {}
        if (input.name !== undefined) data.name = input.name
        if (input.expectedValue !== undefined) data.expectedValue = input.expectedValue
        if (input.assignedTo !== undefined) data.assignedTo = input.assignedTo
        if (input.closeDate !== undefined) data.closeDate = input.closeDate ? new Date(input.closeDate) : null
        if (input.notes !== undefined) data.notes = input.notes

        await prisma.salesOpportunity.update({ where: { id }, data })
        revalidateCache('pipeline')
        revalidatePath('/dashboard/pipeline')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

