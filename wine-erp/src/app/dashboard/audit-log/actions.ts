'use server'

import { prisma } from '@/lib/db'
import { cached } from '@/lib/cache'

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type AuditLogRow = {
    id: string
    userId: string | null
    userName: string | null
    action: string
    entityType: string
    entityId: string | null
    oldValue: Record<string, unknown> | null
    newValue: Record<string, unknown> | null
    createdAt: Date
}

export type AuditFilters = {
    search?: string
    entityType?: string
    action?: string
    userId?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    pageSize?: number
}

export type AuditStats = {
    total: number
    today: number
    thisWeek: number
    uniqueUsers: number
    topActions: { action: string; count: number }[]
    topModules: { entityType: string; count: number }[]
}

// ═══════════════════════════════════════════════════
// FETCH AUDIT LOGS with advanced filters
// ═══════════════════════════════════════════════════

export async function getAuditLogsDashboard(filters: AuditFilters = {}): Promise<{
    rows: AuditLogRow[]
    total: number
}> {
    const { search, entityType, action, userId, dateFrom, dateTo, page = 1, pageSize = 30 } = filters
    const cacheKey = `audit:logs:${page}:${pageSize}:${search ?? ''}:${entityType ?? ''}:${action ?? ''}:${userId ?? ''}:${dateFrom ?? ''}:${dateTo ?? ''}`

    return cached(cacheKey, async () => {
        const where: any = {}

        if (entityType) where.entityType = entityType
        if (action) where.action = action
        if (userId) where.userId = userId

        if (dateFrom || dateTo) {
            where.createdAt = {}
            if (dateFrom) where.createdAt.gte = new Date(dateFrom)
            if (dateTo) {
                const end = new Date(dateTo)
                end.setHours(23, 59, 59, 999)
                where.createdAt.lte = end
            }
        }

        if (search) {
            where.OR = [
                { userName: { contains: search, mode: 'insensitive' } },
                { entityType: { contains: search, mode: 'insensitive' } },
                { entityId: { contains: search, mode: 'insensitive' } },
            ]
        }

        const [rows, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                select: {
                    id: true,
                    userId: true,
                    userName: true,
                    action: true,
                    entityType: true,
                    entityId: true,
                    createdAt: true,
                    // Exclude oldValue/newValue from list — lazy load on expand
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.auditLog.count({ where }),
        ])

        return {
            rows: rows.map(r => ({
                id: r.id,
                userId: r.userId,
                userName: r.userName,
                action: r.action,
                entityType: r.entityType,
                entityId: r.entityId,
                oldValue: null, // lazy load
                newValue: null, // lazy load
                createdAt: r.createdAt,
            })),
            total,
        }
    }, 30_000) // 30s cache
}

// ═══════════════════════════════════════════════════
// GET AUDIT LOG DETAIL (lazy load oldValue/newValue)
// ═══════════════════════════════════════════════════

export async function getAuditLogDetail(id: string): Promise<{
    oldValue: Record<string, unknown> | null
    newValue: Record<string, unknown> | null
} | null> {
    const log = await prisma.auditLog.findUnique({
        where: { id },
        select: { oldValue: true, newValue: true },
    })
    if (!log) return null
    return {
        oldValue: log.oldValue as Record<string, unknown> | null,
        newValue: log.newValue as Record<string, unknown> | null,
    }
}

// ═══════════════════════════════════════════════════
// AUDIT STATS — Overview KPIs
// ═══════════════════════════════════════════════════

export async function getAuditStats(): Promise<AuditStats> {
    return cached('audit:stats', async () => {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekStart = new Date(todayStart)
        weekStart.setDate(weekStart.getDate() - 7)

        const [total, today, thisWeek, actionCounts, moduleCounts, userCounts] = await Promise.all([
            prisma.auditLog.count(),
            prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
            prisma.auditLog.count({ where: { createdAt: { gte: weekStart } } }),
            prisma.auditLog.groupBy({
                by: ['action'],
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 8,
            }),
            prisma.auditLog.groupBy({
                by: ['entityType'],
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 10,
            }),
            prisma.auditLog.groupBy({
                by: ['userId'],
                where: { userId: { not: null } },
                _count: { id: true },
            }),
        ])

        return {
            total,
            today,
            thisWeek,
            uniqueUsers: userCounts.length,
            topActions: actionCounts.map(a => ({ action: a.action, count: a._count.id })),
            topModules: moduleCounts.map(m => ({ entityType: m.entityType, count: m._count.id })),
        }
    }, 30_000) // 30s cache
}

// ═══════════════════════════════════════════════════
// FILTER OPTIONS — Dynamic from DB (cached 120s)
// ═══════════════════════════════════════════════════

export async function getAuditFilterOptions(): Promise<{
    entityTypes: string[]
    actions: string[]
    users: { id: string; name: string }[]
}> {
    return cached('audit:filterOptions', async () => {
        const [entityTypes, actions, users] = await Promise.all([
            prisma.auditLog.findMany({
                select: { entityType: true },
                distinct: ['entityType'],
                orderBy: { entityType: 'asc' },
            }),
            prisma.auditLog.findMany({
                select: { action: true },
                distinct: ['action'],
                orderBy: { action: 'asc' },
            }),
            prisma.auditLog.findMany({
                where: { userId: { not: null }, userName: { not: null } },
                select: { userId: true, userName: true },
                distinct: ['userId'],
                orderBy: { userName: 'asc' },
            }),
        ])

        return {
            entityTypes: entityTypes.map(e => e.entityType),
            actions: actions.map(a => a.action),
            users: users.map(u => ({ id: u.userId!, name: u.userName ?? 'Unknown' })),
        }
    }, 120_000) // 120s — filter options hiếm thay đổi
}
