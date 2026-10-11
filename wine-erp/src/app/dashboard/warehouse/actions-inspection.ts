'use server'

import { prisma } from '@/lib/db'
import { requireAuth, SessionUser } from '@/lib/session'
import { serialize } from '@/lib/serialize'
import { revalidatePath } from 'next/cache'
import { notifyTelegram } from '@/lib/telegram'
import { logAudit } from '@/lib/audit'
import ExcelJS from 'exceljs'

const MANAGER_ROLES = ['Admin', 'ADMIN', 'Warehouse Manager', 'WAREHOUSE_MANAGER', 'CEO', 'Manager', 'MANAGER', 'Ban Giám Đốc', 'BAN_GIAM_DOC']

function checkIsManager(user: SessionUser): boolean {
    return user.roles?.some(r => MANAGER_ROLES.includes(r)) || false
}

// ── Types ───────────────────────────────────────────

export interface InspectionFilterInput {
    warehouseId?: string
    type?: 'DAILY_TEMP_HUMIDITY' | 'PERIODIC_AUDIT'
    status?: 'DRAFT' | 'ASSIGNED' | 'COMPLETED' | 'PENDING_APPROVAL' | 'RESOLVED' | 'OVERDUE'
    startDate?: string
    endDate?: string
    page?: number
    pageSize?: number
    assignedToMe?: boolean
    inspectorId?: string
}

export interface InspectionCheckItemInput {
    category: string
    itemCode: string
    itemName: string
    standard: string
    actualValue?: string
    isPassed: boolean
    actionProposal?: string
}

export interface InspectionPhotoInput {
    photoBase64: string // can be full base64 or URL
    thumbnailBase64?: string
    category: 'THERMOMETER' | 'AC_COOLING' | 'CORNER' | 'INCIDENT' | 'GENERAL'
    caption?: string
    takenAt?: string
    gpsLat?: number
    gpsLng?: number
    watermarkText?: string
}

export interface CreateInspectionInput {
    existingInspectionId?: string // If completing an assigned/scheduled inspection
    assignedToId?: string         // If manager is assigning or specifying inspector
    warehouseId: string
    type: 'DAILY_TEMP_HUMIDITY' | 'PERIODIC_AUDIT'
    inspectionDate: string // YYYY-MM-DD
    shift?: 'MORNING' | 'AFTERNOON' | 'NIGHT'
    temp1?: number
    temp2?: number
    temp3?: number
    humidity?: number
    incidentNotes?: string
    actionPlan?: string
    targetDate?: string
    items?: InspectionCheckItemInput[]
    photos?: InspectionPhotoInput[]
    isOfflineSync?: boolean
}

export interface AssignInspectionInput {
    inspectionId?: string         // If reassigning existing
    warehouseId?: string
    type?: 'DAILY_TEMP_HUMIDITY' | 'PERIODIC_AUDIT'
    inspectionDate?: string       // YYYY-MM-DD
    shift?: 'MORNING' | 'AFTERNOON' | 'NIGHT'
    assignedToId: string
    dueDate?: string
    notes?: string
}

// ── Query Inspections ───────────────────────────────

export async function getWarehouseInspectionsAction(filters: InspectionFilterInput = {}) {
    try {
        const user = await requireAuth()
        const page = Math.max(1, filters.page ?? 1)
        const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20))
        const skip = (page - 1) * pageSize

        // Auto-mark overdue for assigned inspections past dueDate
        const now = new Date()
        await prisma.warehouseInspection.updateMany({
            where: {
                status: 'ASSIGNED',
                dueDate: { lt: now },
            },
            data: {
                status: 'OVERDUE',
            },
        })

        const where: any = {}
        if (filters.warehouseId && filters.warehouseId !== 'ALL') {
            where.warehouseId = filters.warehouseId
        }
        if (filters.type) {
            where.type = filters.type
        }
        if (filters.status && filters.status !== 'ALL' as any) {
            where.status = filters.status
        }
        if (filters.assignedToMe) {
            where.inspectorId = user.id
        } else if (filters.inspectorId && filters.inspectorId !== 'ALL') {
            where.inspectorId = filters.inspectorId
        }
        if (filters.startDate || filters.endDate) {
            where.inspectionDate = {}
            if (filters.startDate) {
                where.inspectionDate.gte = new Date(filters.startDate)
            }
            if (filters.endDate) {
                const end = new Date(filters.endDate)
                end.setHours(23, 59, 59, 999)
                where.inspectionDate.lte = end
            }
        }

        const [total, items, statsRaw] = await Promise.all([
            prisma.warehouseInspection.count({ where }),
            prisma.warehouseInspection.findMany({
                where,
                include: {
                    warehouse: { select: { id: true, code: true, name: true } },
                    inspector: { select: { id: true, name: true, email: true } },
                    assignedBy: { select: { id: true, name: true, email: true } },
                    managerApproved: { select: { id: true, name: true } },
                    _count: { select: { items: true, photos: true } },
                    photos: {
                        take: 3,
                        select: {
                            id: true,
                            category: true,
                            caption: true,
                            thumbnailUrl: true,
                            takenAt: true,
                        },
                    },
                },
                orderBy: { inspectionDate: 'desc' },
                skip,
                take: pageSize,
            }),
            prisma.warehouseInspection.groupBy({
                by: ['overallResult', 'status'],
                _count: { _all: true },
                where: filters.warehouseId && filters.warehouseId !== 'ALL' ? { warehouseId: filters.warehouseId } : {},
            }),
        ])

        // Calculate summary KPI stats
        let totalInspections = 0
        let passedCount = 0
        let pendingApprovalCount = 0
        let assignedCount = 0
        let overdueCount = 0
        let incidentCount = 0

        statsRaw.forEach(s => {
            totalInspections += s._count._all
            if (s.overallResult === 'PASSED' && s.status === 'COMPLETED') passedCount += s._count._all
            if (s.status === 'PENDING_APPROVAL') pendingApprovalCount += s._count._all
            if (s.status === 'ASSIGNED') assignedCount += s._count._all
            if (s.status === 'OVERDUE') overdueCount += s._count._all
            if (s.overallResult === 'FAILED' || s.overallResult === 'WARNING') incidentCount += s._count._all
        })

        const complianceRate = totalInspections > 0 ? Math.round((passedCount / totalInspections) * 100) : 100

        return {
            success: true,
            data: serialize(items),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
            kpis: {
                totalInspections,
                passedCount,
                pendingApprovalCount,
                assignedCount,
                overdueCount,
                incidentCount,
                complianceRate,
            },
            currentUserId: user.id,
            isManager: checkIsManager(user),
        }
    } catch (err: any) {
        console.error('getWarehouseInspectionsAction error:', err)
        return { success: false, error: err.message ?? 'Lỗi khi tải dữ liệu kiểm tra kho' }
    }
}

// ── Detail Query ────────────────────────────────────

export async function getWarehouseInspectionDetailAction(id: string) {
    try {
        await requireAuth()
        const inspection = await prisma.warehouseInspection.findUnique({
            where: { id },
            include: {
                warehouse: { select: { id: true, code: true, name: true, address: true } },
                inspector: { select: { id: true, name: true, email: true } },
                assignedBy: { select: { id: true, name: true, email: true } },
                managerApproved: { select: { id: true, name: true, email: true } },
                items: {
                    orderBy: { itemCode: 'asc' },
                },
                photos: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        })

        if (!inspection) {
            return { success: false, error: 'Không tìm thấy phiếu kiểm tra kho' }
        }

        return { success: true, data: serialize(inspection) }
    } catch (err: any) {
        console.error('getWarehouseInspectionDetailAction error:', err)
        return { success: false, error: err.message ?? 'Lỗi khi tải chi tiết kiểm tra kho' }
    }
}

// ── Create or Complete Inspection ───────────────────

export async function createWarehouseInspectionAction(payload: CreateInspectionInput) {
    try {
        const user = await requireAuth()

        if (!payload.warehouseId) {
            return { success: false, error: 'Vui lòng chọn kho kiểm tra' }
        }
        if (!payload.inspectionDate) {
            return { success: false, error: 'Vui lòng chọn ngày kiểm tra' }
        }

        const warehouse = await prisma.warehouse.findUnique({
            where: { id: payload.warehouseId },
            select: { id: true, code: true, name: true },
        })
        if (!warehouse) {
            return { success: false, error: 'Kho hàng không tồn tại trong hệ thống' }
        }

        let existingInspection: any = null
        if (payload.existingInspectionId) {
            existingInspection = await prisma.warehouseInspection.findUnique({
                where: { id: payload.existingInspectionId },
                include: { inspector: true, warehouse: true },
            })
            if (!existingInspection) {
                return { success: false, error: 'Không tìm thấy phiếu kiểm tra được giao' }
            }
            // Constraint & Edge Case 2: Only assigned inspector or manager can execute
            const isAssignee = existingInspection.inspectorId === user.id
            const isManager = checkIsManager(user)
            if (!isAssignee && !isManager) {
                return {
                    success: false,
                    error: `Chỉ nhân viên được phân công (${existingInspection.inspector?.name ?? 'Người được giao'}) hoặc Quản lý kho mới có quyền mở và hoàn tất phiếu này.`,
                }
            }
        }

        // Automatic Evaluation based on SOP 5.3 & Checklist Rules:
        // Temp safety range: 14 - 22°C (Ideal: 14-18°C; Acceptable: 18-22°C; Danger: >22°C or <8°C)
        // Humidity safety range: 45 - 65% (Acceptable: 50-80%; Danger: >80% or <45%)
        let hasDanger = false
        let hasWarning = false
        const incidentReasons: string[] = []

        // Evaluate temperature 1, 2, 3
        const temps = [payload.temp1, payload.temp2, payload.temp3].filter((t): t is number => typeof t === 'number' && !isNaN(t))
        for (const t of temps) {
            if (t > 22 || t < 8) {
                hasDanger = true
                incidentReasons.push(`Nhiệt độ ${t}°C vượt ngưỡng an toàn (>22°C hoặc <8°C)`)
            } else if (t > 18 || t < 12) {
                hasWarning = true
            }
        }

        // Evaluate humidity
        if (typeof payload.humidity === 'number' && !isNaN(payload.humidity)) {
            if (payload.humidity > 80 || payload.humidity < 40) {
                hasDanger = true
                incidentReasons.push(`Độ ẩm ${payload.humidity}% ngoài ngưỡng cho phép (<40% hoặc >80%)`)
            } else if (payload.humidity > 65 || payload.humidity < 45) {
                hasWarning = true
            }
        }

        // Evaluate checklist items
        if (payload.items && payload.items.length > 0) {
            const failedItems = payload.items.filter(i => !i.isPassed)
            if (failedItems.length > 0) {
                hasDanger = true
                failedItems.forEach(fi => {
                    incidentReasons.push(`Mục "${fi.itemName}" không đạt tiêu chuẩn`)
                })
            }
        }

        const overallResult = hasDanger ? 'FAILED' : hasWarning ? 'WARNING' : 'PASSED'
        const status = hasDanger || hasWarning ? 'PENDING_APPROVAL' : 'COMPLETED'

        // Determine inspection number
        let inspectionNo = existingInspection?.inspectionNo
        if (!inspectionNo) {
            const todayDate = new Date(payload.inspectionDate)
            const dateStr = todayDate.toISOString().slice(0, 10).replace(/-/g, '')
            const prefix = `KT-${dateStr}`
            const countToday = await prisma.warehouseInspection.count({
                where: {
                    inspectionNo: { startsWith: prefix },
                },
            })
            inspectionNo = `${prefix}-${String(countToday + 1).padStart(3, '0')}`
        }

        const combinedIncidentNotes = [
            payload.incidentNotes?.trim(),
            incidentReasons.length > 0 ? `Tự động phát hiện:\n- ${incidentReasons.join('\n- ')}` : null,
        ].filter(Boolean).join('\n\n')

        const isManager = checkIsManager(user)
        const targetInspectorId = (isManager && payload.assignedToId) ? payload.assignedToId : user.id
        const assignedById = (isManager && payload.assignedToId && payload.assignedToId !== user.id) ? user.id : null
        const assignedAt = assignedById ? new Date() : null

        // DB Transaction
        const newRecord = await prisma.$transaction(async (tx) => {
            if (existingInspection) {
                const updated = await tx.warehouseInspection.update({
                    where: { id: existingInspection.id },
                    data: {
                        status,
                        temp1: payload.temp1 !== undefined && payload.temp1 !== null ? payload.temp1 : null,
                        temp2: payload.temp2 !== undefined && payload.temp2 !== null ? payload.temp2 : null,
                        temp3: payload.temp3 !== undefined && payload.temp3 !== null ? payload.temp3 : null,
                        humidity: payload.humidity !== undefined && payload.humidity !== null ? payload.humidity : null,
                        overallResult,
                        incidentNotes: combinedIncidentNotes || existingInspection.incidentNotes || null,
                        actionPlan: payload.actionPlan?.trim() || null,
                        targetDate: payload.targetDate ? new Date(payload.targetDate) : null,
                        isOfflineSync: payload.isOfflineSync ?? false,
                        items: payload.items && payload.items.length > 0 ? {
                            deleteMany: {},
                            create: payload.items.map(it => ({
                                category: it.category,
                                itemCode: it.itemCode,
                                itemName: it.itemName,
                                standard: it.standard,
                                actualValue: it.actualValue || null,
                                isPassed: it.isPassed,
                                actionProposal: it.actionProposal || null,
                            })),
                        } : undefined,
                        photos: payload.photos && payload.photos.length > 0 ? {
                            create: payload.photos.map(p => ({
                                photoUrl: p.photoBase64,
                                thumbnailUrl: p.thumbnailBase64 || p.photoBase64.slice(0, 5000),
                                category: p.category,
                                caption: p.caption || null,
                                takenAt: p.takenAt ? new Date(p.takenAt) : new Date(),
                                gpsLat: p.gpsLat !== undefined ? p.gpsLat : null,
                                gpsLng: p.gpsLng !== undefined ? p.gpsLng : null,
                                watermarkText: p.watermarkText || null,
                            })),
                        } : undefined,
                    },
                    include: {
                        warehouse: { select: { name: true } },
                        inspector: { select: { name: true } },
                        items: true,
                        photos: true,
                    },
                })
                return updated
            }

            const created = await tx.warehouseInspection.create({
                data: {
                    inspectionNo,
                    warehouseId: payload.warehouseId,
                    type: payload.type,
                    inspectionDate: new Date(payload.inspectionDate),
                    shift: payload.shift ?? 'MORNING',
                    inspectorId: targetInspectorId,
                    assignedById,
                    assignedAt,
                    status,
                    temp1: payload.temp1 !== undefined && payload.temp1 !== null ? payload.temp1 : null,
                    temp2: payload.temp2 !== undefined && payload.temp2 !== null ? payload.temp2 : null,
                    temp3: payload.temp3 !== undefined && payload.temp3 !== null ? payload.temp3 : null,
                    humidity: payload.humidity !== undefined && payload.humidity !== null ? payload.humidity : null,
                    overallResult,
                    incidentNotes: combinedIncidentNotes || null,
                    actionPlan: payload.actionPlan?.trim() || null,
                    targetDate: payload.targetDate ? new Date(payload.targetDate) : null,
                    isOfflineSync: payload.isOfflineSync ?? false,
                    items: payload.items && payload.items.length > 0 ? {
                        create: payload.items.map(it => ({
                            category: it.category,
                            itemCode: it.itemCode,
                            itemName: it.itemName,
                            standard: it.standard,
                            actualValue: it.actualValue || null,
                            isPassed: it.isPassed,
                            actionProposal: it.actionProposal || null,
                        })),
                    } : undefined,
                    photos: payload.photos && payload.photos.length > 0 ? {
                        create: payload.photos.map(p => ({
                            photoUrl: p.photoBase64,
                            thumbnailUrl: p.thumbnailBase64 || p.photoBase64.slice(0, 5000), // fallback thumb
                            category: p.category,
                            caption: p.caption || null,
                            takenAt: p.takenAt ? new Date(p.takenAt) : new Date(),
                            gpsLat: p.gpsLat !== undefined ? p.gpsLat : null,
                            gpsLng: p.gpsLng !== undefined ? p.gpsLng : null,
                            watermarkText: p.watermarkText || null,
                        })),
                    } : undefined,
                },
                include: {
                    warehouse: { select: { name: true } },
                    inspector: { select: { name: true } },
                    items: true,
                    photos: true,
                },
            })

            return created
        })

        // Edge Case 2: Telegram Incident Notification to Managers
        if (hasDanger || hasWarning) {
            const tempStr = temps.length > 0 ? temps.map(t => `${t}°C`).join(', ') : 'Chưa đo'
            const humStr = payload.humidity !== undefined && payload.humidity !== null ? `${payload.humidity}%` : 'Chưa đo'
            const msg = [
                `<b>[CẢNH BÁO KIỂM TRA KHO BẤT THƯỜNG]</b>`,
                `• Mã phiếu: <code>${inspectionNo}</code>`,
                `• Kho: <b>${warehouse.name}</b>`,
                `• Ngày: ${payload.inspectionDate} (${payload.shift === 'MORNING' ? 'Sáng' : payload.shift === 'AFTERNOON' ? 'Chiều' : 'Tối'})`,
                `• Người kiểm tra: ${user.name ?? user.email}`,
                `• Nhiệt độ: <b>${tempStr}</b>`,
                `• Độ ẩm: <b>${humStr}</b>`,
                `• Trạng thái: <b>${overallResult === 'FAILED' ? 'KHÔNG ĐẠT / SỰ CỐ' : 'CẢNH BÁO SÁT NGƯỠNG'}</b>`,
                incidentReasons.length > 0 ? `• Chi tiết bất thường:\n- ${incidentReasons.join('\n- ')}` : '',
                payload.actionPlan ? `• Đề xuất xử lý: ${payload.actionPlan}` : '',
                `\n<i>Yêu cầu Quản lý kho / BGĐ truy cập phân hệ Kho vận để thẩm định và phê duyệt phương án.</i>`,
            ].filter(Boolean).join('\n')

            // Asynchronously dispatch notification without blocking response
            notifyTelegram(msg).catch(err => console.error('Telegram notification error:', err))
        }

        // Audit Log
        await logAudit({
            userId: user.id,
            userName: user.name ?? user.email,
            action: 'CREATE',
            entityType: 'WarehouseInspection',
            entityId: newRecord.id,
            description: `Tạo biên bản kiểm tra sự cố kho ${inspectionNo}`,
            newValue: {
                inspectionNo,
                warehouseId: payload.warehouseId,
                overallResult,
                status,
                itemsCount: payload.items?.length ?? 0,
                photosCount: payload.photos?.length ?? 0,
            },
        })

        revalidatePath('/dashboard/warehouse')
        return { success: true, data: serialize(newRecord) }
    } catch (err: any) {
        console.error('createWarehouseInspectionAction error:', err)
        return { success: false, error: err.message ?? 'Lỗi khi lưu kết quả kiểm tra kho' }
    }
}

// ── Approve / Resolve Incident ──────────────────────

export async function approveWarehouseInspectionAction(params: {
    inspectionId: string
    actionPlan?: string
    feedback?: string
    status?: 'RESOLVED' | 'COMPLETED'
}) {
    try {
        const user = await requireAuth()
        if (!checkIsManager(user)) {
            return { success: false, error: 'Chỉ Quản lý kho hoặc Ban Giám Đốc mới có quyền phê duyệt phương án xử lý sự cố' }
        }

        const inspection = await prisma.warehouseInspection.findUnique({
            where: { id: params.inspectionId },
            include: { warehouse: true },
        })
        if (!inspection) {
            return { success: false, error: 'Không tìm thấy phiếu kiểm tra kho' }
        }

        const targetStatus = params.status ?? 'RESOLVED'

        const updated = await prisma.warehouseInspection.update({
            where: { id: params.inspectionId },
            data: {
                status: targetStatus,
                managerApprovedId: user.id,
                managerApprovedAt: new Date(),
                managerFeedback: params.feedback?.trim() || null,
                actionPlan: params.actionPlan?.trim() || inspection.actionPlan,
            },
            include: {
                managerApproved: { select: { id: true, name: true } },
            },
        })

        // Notify Telegram of Resolution
        const resolveMsg = [
            `<b>[ĐÃ PHÊ DUYỆT PHƯƠNG ÁN XỬ LÝ SỰ CỐ KHO]</b>`,
            `• Mã phiếu: <code>${inspection.inspectionNo}</code>`,
            `• Kho: <b>${inspection.warehouse.name}</b>`,
            `• Quản lý duyệt: <b>${user.name ?? user.email}</b>`,
            `• Trạng thái mới: <b>${targetStatus === 'RESOLVED' ? 'ĐÃ GIẢI QUYẾT' : 'HOÀN TẤT'}</b>`,
            params.actionPlan ? `• Phương án: ${params.actionPlan}` : '',
            params.feedback ? `• Ý kiến chỉ đạo: ${params.feedback}` : '',
        ].filter(Boolean).join('\n')

        notifyTelegram(resolveMsg).catch(err => console.error('Telegram notification error:', err))

        await logAudit({
            userId: user.id,
            userName: user.name ?? user.email,
            action: 'APPROVE',
            entityType: 'WarehouseInspection',
            entityId: inspection.id,
            description: `Phê duyệt biên bản kiểm tra sự cố kho ${inspection.inspectionNo}`,
            newValue: {
                inspectionNo: inspection.inspectionNo,
                approvedBy: user.id,
                status: targetStatus,
            },
        })

        revalidatePath('/dashboard/warehouse')
        return { success: true, data: serialize(updated) }
    } catch (err: any) {
        console.error('approveWarehouseInspectionAction error:', err)
        return { success: false, error: err.message ?? 'Lỗi khi phê duyệt phiếu kiểm tra kho' }
    }
}

// ── Staff & Assignment Actions ──────────────────────

export async function getWarehouseStaffUsersAction() {
    try {
        await requireAuth()
        const users = await prisma.user.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' },
        })
        return { success: true, data: serialize(users) }
    } catch (err: any) {
        console.error('getWarehouseStaffUsersAction error:', err)
        return { success: false, error: err.message ?? 'Lỗi khi tải danh sách nhân viên' }
    }
}

export async function assignWarehouseInspectionAction(payload: AssignInspectionInput) {
    try {
        const user = await requireAuth()
        const isManager = checkIsManager(user)
        if (!isManager) {
            return { success: false, error: 'Chỉ Quản lý kho hoặc Ban Giám Đốc mới có quyền phân công kiểm tra kho' }
        }

        if (!payload.assignedToId) {
            return { success: false, error: 'Vui lòng chọn nhân viên được phân công' }
        }

        const staff = await prisma.user.findUnique({
            where: { id: payload.assignedToId },
            select: { id: true, name: true, email: true },
        })
        if (!staff) {
            return { success: false, error: 'Không tìm thấy thông tin nhân viên' }
        }

        // Case A: Reassign existing inspection
        if (payload.inspectionId) {
            const existing = await prisma.warehouseInspection.findUnique({
                where: { id: payload.inspectionId },
                include: { warehouse: true, inspector: true },
            })
            if (!existing) {
                return { success: false, error: 'Không tìm thấy phiếu kiểm tra' }
            }
            if (existing.status === 'COMPLETED' || existing.status === 'RESOLVED') {
                return { success: false, error: 'Phiếu đã hoàn thành hoặc đã giải quyết, không thể phân công lại' }
            }

            const shift = payload.shift ?? existing.shift
            let dueDate: Date | null = existing.dueDate
            if (payload.dueDate) {
                dueDate = new Date(payload.dueDate)
            } else if (!dueDate) {
                dueDate = new Date(existing.inspectionDate)
                if (shift === 'MORNING') dueDate.setHours(12, 0, 0, 0)
                else if (shift === 'AFTERNOON') dueDate.setHours(18, 0, 0, 0)
                else dueDate.setHours(23, 59, 59, 0)
            }

            const updated = await prisma.warehouseInspection.update({
                where: { id: payload.inspectionId },
                data: {
                    inspectorId: payload.assignedToId,
                    assignedById: user.id,
                    assignedAt: new Date(),
                    status: 'ASSIGNED',
                    dueDate,
                    incidentNotes: payload.notes
                        ? (existing.incidentNotes ? `${existing.incidentNotes}\n[Phân công lại]: ${payload.notes}` : `[Phân công lại]: ${payload.notes}`)
                        : existing.incidentNotes,
                },
                include: {
                    warehouse: { select: { id: true, code: true, name: true } },
                    inspector: { select: { id: true, name: true, email: true } },
                    assignedBy: { select: { id: true, name: true } },
                },
            })

            // Edge Case 1 & Telegram Notification
            const shiftText = updated.shift === 'MORNING' ? 'Ca Sáng (08:00)' : updated.shift === 'AFTERNOON' ? 'Ca Chiều (16:00)' : 'Ca Bổ sung'
            const dateStr = updated.inspectionDate.toISOString().slice(0, 10)
            const dueStr = updated.dueDate ? updated.dueDate.toLocaleString('vi-VN') : 'Trong ca'

            const msg = [
                `<b>[PHÂN CÔNG LẠI KIỂM TRA KHO]</b>`,
                `• Mã phiếu: <code>${updated.inspectionNo}</code>`,
                `• Kho: <b>${updated.warehouse.name}</b>`,
                `• Loại phiếu: ${updated.type === 'DAILY_TEMP_HUMIDITY' ? 'Sổ nhiệt ẩm 12h' : 'Phiếu định kỳ T2/T5'}`,
                `• Ca kiểm tra: <b>${shiftText}</b> (${dateStr})`,
                `• Người thực hiện mới: <b>${staff.name ?? staff.email}</b>`,
                `• Người giao việc: ${user.name ?? user.email}`,
                `• Hạn hoàn thành: ${dueStr}`,
                payload.notes ? `• Ghi chú: ${payload.notes}` : '',
            ].filter(Boolean).join('\n')

            notifyTelegram(msg).catch(err => console.error('Telegram notification error:', err))

            await logAudit({
                userId: user.id,
                userName: user.name ?? user.email,
                action: 'UPDATE',
                entityType: 'WarehouseInspection',
                entityId: updated.id,
                description: `Phân công lại phiếu kiểm tra kho ${updated.inspectionNo} cho ${staff.name}`,
            })

            revalidatePath('/dashboard/warehouse')
            return { success: true, data: serialize(updated) }
        }

        // Case B: Create new inspection assignment
        if (!payload.warehouseId) {
            return { success: false, error: 'Vui lòng chọn kho kiểm tra' }
        }
        if (!payload.inspectionDate) {
            return { success: false, error: 'Vui lòng chọn ngày kiểm tra' }
        }

        const warehouse = await prisma.warehouse.findUnique({
            where: { id: payload.warehouseId },
            select: { id: true, code: true, name: true },
        })
        if (!warehouse) {
            return { success: false, error: 'Kho hàng không tồn tại' }
        }

        const shift = payload.shift ?? 'MORNING'
        let dueDate: Date
        if (payload.dueDate) {
            dueDate = new Date(payload.dueDate)
        } else {
            dueDate = new Date(payload.inspectionDate)
            if (shift === 'MORNING') dueDate.setHours(12, 0, 0, 0)
            else if (shift === 'AFTERNOON') dueDate.setHours(18, 0, 0, 0)
            else dueDate.setHours(23, 59, 59, 0)
        }

        const todayDate = new Date(payload.inspectionDate)
        const dateStr = todayDate.toISOString().slice(0, 10).replace(/-/g, '')
        const prefix = `KT-${dateStr}`
        const countToday = await prisma.warehouseInspection.count({
            where: {
                inspectionNo: { startsWith: prefix },
            },
        })
        const inspectionNo = `${prefix}-${String(countToday + 1).padStart(3, '0')}`

        const created = await prisma.warehouseInspection.create({
            data: {
                inspectionNo,
                warehouseId: payload.warehouseId,
                type: payload.type ?? 'DAILY_TEMP_HUMIDITY',
                inspectionDate: new Date(payload.inspectionDate),
                shift,
                inspectorId: payload.assignedToId,
                assignedById: user.id,
                assignedAt: new Date(),
                status: 'ASSIGNED',
                dueDate,
                incidentNotes: payload.notes ? `[Ghi chú phân công]: ${payload.notes}` : null,
            },
            include: {
                warehouse: { select: { id: true, code: true, name: true } },
                inspector: { select: { id: true, name: true, email: true } },
                assignedBy: { select: { id: true, name: true } },
            },
        })

        // Edge Case 1 & Telegram Notification
        const shiftText = created.shift === 'MORNING' ? 'Ca Sáng (08:00)' : created.shift === 'AFTERNOON' ? 'Ca Chiều (16:00)' : 'Ca Bổ sung'
        const dateStrFormatted = created.inspectionDate.toISOString().slice(0, 10)
        const dueStr = created.dueDate ? created.dueDate.toLocaleString('vi-VN') : 'Trong ca'

        const msg = [
            `<b>[PHÂN CÔNG KIỂM TRA KHO MỚI]</b>`,
            `• Mã phiếu: <code>${created.inspectionNo}</code>`,
            `• Kho: <b>${warehouse.name}</b>`,
            `• Loại phiếu: ${created.type === 'DAILY_TEMP_HUMIDITY' ? 'Sổ nhiệt ẩm 12h' : 'Phiếu định kỳ T2/T5'}`,
            `• Ca kiểm tra: <b>${shiftText}</b> (${dateStrFormatted})`,
            `• Nhân viên phụ trách: <b>${staff.name ?? staff.email}</b>`,
            `• Người giao việc: ${user.name ?? user.email}`,
            `• Hạn hoàn thành: ${dueStr}`,
            payload.notes ? `• Ghi chú: ${payload.notes}` : '',
        ].filter(Boolean).join('\n')

        notifyTelegram(msg).catch(err => console.error('Telegram notification error:', err))

        await logAudit({
            userId: user.id,
            userName: user.name ?? user.email,
            action: 'CREATE',
            entityType: 'WarehouseInspection',
            entityId: created.id,
            description: `Phân công phiếu kiểm tra kho ${created.inspectionNo} cho ${staff.name}`,
        })

        revalidatePath('/dashboard/warehouse')
        return { success: true, data: serialize(created) }
    } catch (err: any) {
        console.error('assignWarehouseInspectionAction error:', err)
        return { success: false, error: err.message ?? 'Lỗi khi phân công nhân viên kiểm tra kho' }
    }
}

export async function sendInspectionOverdueAlertAction(inspectionId: string) {
    try {
        const user = await requireAuth()
        const inspection = await prisma.warehouseInspection.findUnique({
            where: { id: inspectionId },
            include: { warehouse: true, inspector: true, assignedBy: true },
        })
        if (!inspection) return { success: false, error: 'Không tìm thấy phiếu kiểm tra' }

        const shiftText = inspection.shift === 'MORNING' ? 'Ca Sáng' : inspection.shift === 'AFTERNOON' ? 'Ca Chiều' : 'Ca Bổ sung'
        const dueStr = inspection.dueDate ? inspection.dueDate.toLocaleString('vi-VN') : 'Đã quá hạn'

        const msg = [
            `<b>[CẢNH BÁO: QUÁ HẠN KIỂM TRA KHO]</b>`,
            `• Mã phiếu: <code>${inspection.inspectionNo}</code>`,
            `• Kho: <b>${inspection.warehouse.name}</b>`,
            `• Ca: ${shiftText} ngày ${inspection.inspectionDate.toISOString().slice(0, 10)}`,
            `• Nhân viên phụ trách: <b>${inspection.inspector.name ?? inspection.inspector.email}</b>`,
            `• Hạn chót: <b>${dueStr}</b>`,
            `• Trạng thái: <b>CHƯA THỰC HIỆN KIỂM TRA HIỆN TRƯỜNG</b>`,
            `• Nhắc nhở bởi: ${user.name ?? user.email}`,
            `\n<i>Yêu cầu nhân viên phụ trách khẩn trương kiểm tra kho và cập nhật số liệu.</i>`,
        ].join('\n')

        await notifyTelegram(msg)

        return { success: true }
    } catch (err: any) {
        console.error('sendInspectionOverdueAlertAction error:', err)
        return { success: false, error: err.message ?? 'Lỗi khi gửi cảnh báo Telegram' }
    }
}

// ── Batch Offline Sync ──────────────────────────────

export async function syncOfflineWarehouseInspectionsAction(drafts: CreateInspectionInput[]) {
    try {
        await requireAuth()
        if (!drafts || drafts.length === 0) {
            return { success: true, syncedCount: 0, results: [] }
        }

        const results: { index: number; success: boolean; error?: string; inspectionNo?: string }[] = []

        for (let i = 0; i < drafts.length; i++) {
            const draft = drafts[i]
            draft.isOfflineSync = true
            const res = await createWarehouseInspectionAction(draft)
            if (res.success && res.data) {
                results.push({ index: i, success: true, inspectionNo: res.data.inspectionNo })
            } else {
                results.push({ index: i, success: false, error: res.error })
            }
        }

        const syncedCount = results.filter(r => r.success).length
        revalidatePath('/dashboard/warehouse')
        return { success: true, syncedCount, results }
    } catch (err: any) {
        console.error('syncOfflineWarehouseInspectionsAction error:', err)
        return { success: false, error: err.message ?? 'Lỗi khi đồng bộ dữ liệu ngoại tuyến' }
    }
}

// ── Export to Excel (Matches Form 5.3-A & Form Thanh Trì) ──

export async function exportWarehouseInspectionsExcelAction(params: {
    warehouseId: string
    month: number
    year: number
    type?: 'DAILY_TEMP_HUMIDITY' | 'PERIODIC_AUDIT'
}) {
    try {
        await requireAuth()

        const warehouse = await prisma.warehouse.findUnique({
            where: { id: params.warehouseId },
            select: { id: true, code: true, name: true },
        })
        if (!warehouse) {
            return { success: false, error: 'Kho hàng không tồn tại' }
        }

        const startOfMonth = new Date(params.year, params.month - 1, 1)
        const endOfMonth = new Date(params.year, params.month, 0, 23, 59, 59, 999)

        const inspections = await prisma.warehouseInspection.findMany({
            where: {
                warehouseId: params.warehouseId,
                inspectionDate: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
                ...(params.type ? { type: params.type } : {}),
            },
            include: {
                inspector: { select: { name: true } },
                managerApproved: { select: { name: true } },
                items: true,
            },
            orderBy: [{ inspectionDate: 'asc' }, { shift: 'asc' }],
        })

        const wb = new ExcelJS.Workbook()
        wb.creator = "LY's Cellars ERP"
        wb.created = new Date()

        // Sheet 1: Sổ Nhiệt Độ & Độ Ẩm (Form 5.3-A format)
        const ws1 = wb.addWorksheet('Nhiet_Do_Do_Am')

        // Title and Header metadata
        ws1.mergeCells('A1:H1')
        const t1 = ws1.getCell('A1')
        t1.value = 'SỔ THEO DÕI NHIỆT ĐỘ & ĐỘ ẨM KHO BẢO QUẢN'
        t1.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } }
        t1.alignment = { horizontal: 'center', vertical: 'middle' }

        ws1.mergeCells('A2:H2')
        const t2 = ws1.getCell('A2')
        t2.value = `Form 5.3-A • Kho: ${warehouse.name.toUpperCase()} • Tháng ${params.month}/${params.year}`
        t2.font = { italic: true, size: 10, color: { argb: 'FF64748B' } }
        t2.alignment = { horizontal: 'center' }

        // Rules
        ws1.mergeCells('A4:H4')
        ws1.getCell('A4').value = 'Ngưỡng quy chuẩn: Nhiệt độ 14 - 18°C (Tối ưu) | 18 - 22°C (Chấp nhận) | > 22°C (Nguy hiểm) • Độ ẩm: 45 - 65% (Tối ưu) | 50 - 80% (Cho phép)'
        ws1.getCell('A4').font = { size: 9, bold: true, color: { argb: 'FF0284C7' } }

        // Table headers
        const headers = ['Ngày', 'Ca đo', 'Vị trí #1 (°C)', 'Vị trí #2 (°C)', 'Vị trí #3 (°C)', 'Độ ẩm (%)', 'Đánh giá', 'Ghi chú / Người ký']
        ws1.getRow(6).values = headers
        const headerRow = ws1.getRow(6)
        headerRow.height = 26
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
            cell.border = {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' },
            }
        })

        // Populate table data
        let rIndex = 7
        const tempInspections = inspections.filter(i => i.type === 'DAILY_TEMP_HUMIDITY')

        if (tempInspections.length === 0) {
            ws1.getCell(`A${rIndex}`).value = 'Chưa có dữ liệu kiểm tra trong tháng này'
            ws1.mergeCells(`A${rIndex}:H${rIndex}`)
            ws1.getCell(`A${rIndex}`).alignment = { horizontal: 'center' }
            rIndex++
        } else {
            tempInspections.forEach(item => {
                const dateText = new Date(item.inspectionDate).toLocaleDateString('vi-VN')
                const shiftText = item.shift === 'MORNING' ? 'Sáng (08:00)' : item.shift === 'AFTERNOON' ? 'Chiều (16:00)' : 'Tối'
                const t1Val = item.temp1 ? Number(item.temp1) : '-'
                const t2Val = item.temp2 ? Number(item.temp2) : '-'
                const t3Val = item.temp3 ? Number(item.temp3) : '-'
                const hVal = item.humidity ? `${Number(item.humidity)}%` : '-'
                const resultText = item.overallResult === 'PASSED' ? 'Đạt' : item.overallResult === 'WARNING' ? 'Cảnh báo' : 'Không đạt'
                const noteText = [item.incidentNotes, item.inspector?.name].filter(Boolean).join(' | ')

                const row = ws1.getRow(rIndex)
                row.values = [dateText, shiftText, t1Val, t2Val, t3Val, hVal, resultText, noteText]
                row.eachCell((cell, colNum) => {
                    cell.alignment = { vertical: 'middle', horizontal: colNum >= 3 && colNum <= 7 ? 'center' : 'left' }
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    }
                    if (colNum === 7) {
                        if (item.overallResult === 'FAILED') {
                            cell.font = { bold: true, color: { argb: 'FFDC2626' } }
                        } else if (item.overallResult === 'WARNING') {
                            cell.font = { bold: true, color: { argb: 'FFD97706' } }
                        } else {
                            cell.font = { color: { argb: 'FF16A34A' } }
                        }
                    }
                })
                rIndex++
            })
        }

        // Set column widths
        ws1.getColumn(1).width = 14
        ws1.getColumn(2).width = 16
        ws1.getColumn(3).width = 16
        ws1.getColumn(4).width = 16
        ws1.getColumn(5).width = 16
        ws1.getColumn(6).width = 14
        ws1.getColumn(7).width = 14
        ws1.getColumn(8).width = 35

        // Sheet 2: Phiếu Kiểm Tra Định Kỳ (Audit Checklist format)
        const ws2 = wb.addWorksheet('Kiem_Tra_Dinh_Ky')
        ws2.mergeCells('A1:G1')
        ws2.getCell('A1').value = `PHIẾU KIỂM TRA ĐỊNH KỲ AN NINH & CƠ SỞ VẬT CHẤT KHO`
        ws2.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E293B' } }
        ws2.getCell('A1').alignment = { horizontal: 'center' }

        ws2.mergeCells('A2:G2')
        ws2.getCell('A2').value = `Kho: ${warehouse.name} • Tần suất: Thứ 2 & Thứ 5 hàng tuần • Tháng ${params.month}/${params.year}`
        ws2.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF64748B' } }
        ws2.getCell('A2').alignment = { horizontal: 'center' }

        const auditHeaders = ['Mã phiếu', 'Ngày KT', 'Người KT', 'Kết quả chung', 'Mô tả sự cố', 'Đề xuất khắc phục', 'Người duyệt']
        ws2.getRow(4).values = auditHeaders
        ws2.getRow(4).height = 24
        ws2.getRow(4).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
        })

        let auditRowIndex = 5
        const auditInspections = inspections.filter(i => i.type === 'PERIODIC_AUDIT')
        if (auditInspections.length === 0) {
            ws2.getCell(`A${auditRowIndex}`).value = 'Chưa có phiếu kiểm tra định kỳ trong tháng này'
            ws2.mergeCells(`A${auditRowIndex}:G${auditRowIndex}`)
            ws2.getCell(`A${auditRowIndex}`).alignment = { horizontal: 'center' }
        } else {
            auditInspections.forEach(item => {
                const dateText = new Date(item.inspectionDate).toLocaleDateString('vi-VN')
                const resText = item.overallResult === 'PASSED' ? 'Đạt chuẩn' : item.overallResult === 'WARNING' ? 'Cảnh báo' : 'Có sự cố'
                const row = ws2.getRow(auditRowIndex)
                row.values = [
                    item.inspectionNo,
                    dateText,
                    item.inspector?.name ?? '',
                    resText,
                    item.incidentNotes ?? 'Không có',
                    item.actionPlan ?? 'Bình thường',
                    item.managerApproved?.name ?? (item.status === 'PENDING_APPROVAL' ? 'Chờ duyệt' : 'Đạt'),
                ]
                row.eachCell((cell, colNum) => {
                    cell.alignment = { vertical: 'middle', horizontal: colNum <= 4 ? 'center' : 'left' }
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    }
                })
                auditRowIndex++
            })
        }

        ws2.getColumn(1).width = 18
        ws2.getColumn(2).width = 14
        ws2.getColumn(3).width = 18
        ws2.getColumn(4).width = 16
        ws2.getColumn(5).width = 30
        ws2.getColumn(6).width = 30
        ws2.getColumn(7).width = 18

        const buffer = await wb.xlsx.writeBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const fileName = `Bao_Cao_Kiem_Tra_Kho_${warehouse.code}_T${params.month}_${params.year}.xlsx`

        return {
            success: true,
            base64,
            fileName,
        }
    } catch (err: any) {
        console.error('exportWarehouseInspectionsExcelAction error:', err)
        return { success: false, error: err.message ?? 'Lỗi khi xuất file Excel báo cáo kiểm tra kho' }
    }
}
