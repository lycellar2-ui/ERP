'use server'

import { prisma } from '@/lib/db'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'EXPORT' | 'STATUS_CHANGE' | 'CONFIRM'

interface AuditLogInput {
    userId?: string
    userName?: string
    action: AuditAction
    entityType: string
    entityId?: string
    description?: string
    oldValue?: Record<string, unknown> | null
    newValue?: Record<string, unknown> | null
}

export async function logAudit(input: AuditLogInput): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId: input.userId ?? null,
                userName: input.userName ?? null,
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId ?? null,
                oldValue: (input.oldValue ?? undefined) as any,
                newValue: (input.newValue ?? undefined) as any,
            },
        })
    } catch (err) {
        console.error('[AuditLog] Failed to write audit log:', err)
    }
}

export async function getAuditLogs(params?: {
    entityType?: string
    entityId?: string
    userId?: string
    limit?: number
    offset?: number
}) {
    const where: Record<string, unknown> = {}
    if (params?.entityType) where.entityType = params.entityType
    if (params?.entityId) where.entityId = params.entityId
    if (params?.userId) where.userId = params.userId

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: params?.limit ?? 50,
            skip: params?.offset ?? 0,
        }),
        prisma.auditLog.count({ where }),
    ])

    return { logs, total }
}
