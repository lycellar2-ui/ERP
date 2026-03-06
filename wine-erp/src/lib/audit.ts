'use server'

import { prisma } from '@/lib/db'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'EXPORT' | 'STATUS_CHANGE' | 'CONFIRM' | 'SIGN'

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

// ═══════════════════════════════════════════════════
// ENHANCED: Per-Field Change Tracking
// ═══════════════════════════════════════════════════

export type FieldChange = {
    field: string
    oldValue: unknown
    newValue: unknown
    displayName?: string
}

/**
 * Compute field-level diffs between old and new objects.
 * Ignores internal fields like `updatedAt`, `createdAt`, `id`.
 */
function computeFieldDiff(
    oldObj: Record<string, unknown> | null | undefined,
    newObj: Record<string, unknown> | null | undefined,
    ignoreFields: string[] = ['id', 'createdAt', 'updatedAt']
): FieldChange[] {
    if (!oldObj || !newObj) return []

    const changes: FieldChange[] = []
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

    for (const key of allKeys) {
        if (ignoreFields.includes(key)) continue

        const oldVal = oldObj[key]
        const newVal = newObj[key]

        // Deep compare for objects/arrays
        const oldStr = JSON.stringify(oldVal)
        const newStr = JSON.stringify(newVal)

        if (oldStr !== newStr) {
            changes.push({
                field: key,
                oldValue: oldVal,
                newValue: newVal,
            })
        }
    }

    return changes
}

/**
 * Generate human-readable description from field changes
 */
function generateChangeDescription(changes: FieldChange[], entityType: string): string {
    if (changes.length === 0) return 'Không có thay đổi'
    if (changes.length === 1) {
        const c = changes[0]
        return `${entityType}: ${c.field} thay đổi từ "${formatValue(c.oldValue)}" → "${formatValue(c.newValue)}"`
    }
    return `${entityType}: ${changes.length} trường thay đổi (${changes.map(c => c.field).join(', ')})`
}

function formatValue(val: unknown): string {
    if (val === null || val === undefined) return '(trống)'
    if (typeof val === 'boolean') return val ? 'Có' : 'Không'
    if (typeof val === 'number') return val.toLocaleString('vi-VN')
    if (val instanceof Date) return val.toLocaleDateString('vi-VN')
    const str = String(val)
    return str.length > 50 ? str.substring(0, 47) + '...' : str
}

/**
 * Enhanced audit log with auto-diff.
 * Pass oldObj and newObj, and it auto-computes field changes + description.
 */
export async function logAuditWithDiff(input: {
    userId?: string
    userName?: string
    action: AuditAction
    entityType: string
    entityId?: string
    oldObj?: Record<string, unknown> | null
    newObj?: Record<string, unknown> | null
    description?: string
}): Promise<void> {
    const changes = computeFieldDiff(input.oldObj, input.newObj)
    const autoDescription = input.description ?? generateChangeDescription(changes, input.entityType)

    const oldValue = input.oldObj ? {
        ...input.oldObj,
        _fieldChanges: changes.map(c => ({
            field: c.field,
            from: c.oldValue,
            to: c.newValue,
        })),
    } : null

    await logAudit({
        userId: input.userId,
        userName: input.userName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        description: autoDescription,
        oldValue: oldValue as any,
        newValue: input.newObj as any,
    })
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

/**
 * Get field-level change history for a specific entity.
 * Returns timeline of changes per field.
 */
export async function getFieldChanges(entityType: string, entityId: string): Promise<{
    changes: {
        field: string
        oldValue: unknown
        newValue: unknown
        changedAt: Date
        changedBy: string | null
        action: string
    }[]
}> {
    const { logs } = await getAuditLogs({
        entityType,
        entityId,
        limit: 100,
    })

    const changes: {
        field: string
        oldValue: unknown
        newValue: unknown
        changedAt: Date
        changedBy: string | null
        action: string
    }[] = []

    for (const log of logs) {
        const oldValue = log.oldValue as Record<string, unknown> | null
        if (oldValue && Array.isArray((oldValue as any)._fieldChanges)) {
            for (const fc of (oldValue as any)._fieldChanges) {
                changes.push({
                    field: fc.field,
                    oldValue: fc.from,
                    newValue: fc.to,
                    changedAt: log.createdAt,
                    changedBy: log.userName,
                    action: log.action,
                })
            }
        }
    }

    return { changes: changes.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime()) }
}

