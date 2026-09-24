'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireAuth, hasRole, SessionUser } from '@/lib/session'

export interface EmployeeFilterParams {
    search?: string
    deptId?: string
    status?: string
    contractExpiring?: boolean
    healthExpiring?: boolean
}

export interface CreateEmployeeInput {
    code?: string
    userId?: string | null
    fullName: string
    avatarUrl?: string | null
    gender?: string | null
    dateOfBirth?: string | null
    phone?: string | null
    email?: string | null
    nationalId?: string | null
    nationalIdDate?: string | null
    nationalIdPlace?: string | null
    address?: string | null
    currentAddress?: string | null
    emergencyContact?: string | null
    emergencyPhone?: string | null
    emergencyRelation?: string | null
    deptId?: string | null
    position?: string | null
    status?: string
    startDate?: string | null
    officialDate?: string | null
    contractType?: string | null
    contractNumber?: string | null
    contractStartDate?: string | null
    contractEndDate?: string | null
    bankAccountNo?: string | null
    bankName?: string | null
    bankAccountHolder?: string | null
    taxCode?: string | null
    socialInsuranceNo?: string | null
    healthCheckDate?: string | null
    healthCheckExpiry?: string | null
    notes?: string | null
}

function canManageHr(user: SessionUser): boolean {
    return hasRole(user, 'CEO', 'ADMIN', 'TRO_LY', 'HCNS', 'HR')
}

// ── 1. Get Employee List with Aggregated Warning Calculations ───────
export async function getEmployees(params: EmployeeFilterParams = {}) {
    const user = await requireAuth()
    const isHrAdmin = canManageHr(user)

    const now = new Date()
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const where: any = {}

    // Non-admin can only see own profile or dept
    if (!isHrAdmin) {
        where.OR = [
            { userId: user.id },
            ...(user.roles?.includes('Sales Manager') || user.roles?.includes('SALES_MGR')
                ? [{ dept: { name: { contains: 'Kinh Doanh', mode: 'insensitive' } } }]
                : [])
        ]
    }

    if (params.search) {
        const q = params.search.trim()
        where.AND = [
            ...(where.AND || []),
            {
                OR: [
                    { fullName: { contains: q, mode: 'insensitive' } },
                    { code: { contains: q, mode: 'insensitive' } },
                    { phone: { contains: q, mode: 'insensitive' } },
                    { nationalId: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } },
                ]
            }
        ]
    }

    if (params.deptId && params.deptId !== 'ALL') {
        where.deptId = params.deptId
    }

    if (params.status && params.status !== 'ALL') {
        where.status = params.status
    }

    if (params.contractExpiring) {
        where.contractEndDate = {
            lte: thirtyDaysLater,
        }
    }

    if (params.healthExpiring) {
        where.healthCheckExpiry = {
            lte: thirtyDaysLater,
        }
    }

    const employees = await prisma.employee.findMany({
        where,
        include: {
            dept: { select: { id: true, name: true } },
            user: { select: { id: true, email: true, name: true, status: true } },
            _count: {
                select: { documents: true }
            }
        },
        orderBy: [
            { status: 'asc' },
            { createdAt: 'desc' }
        ]
    })

    // Compute dynamic warning badges
    return employees.map(emp => {
        let contractWarning: 'NORMAL' | 'EXPIRING_SOON' | 'EXPIRED' = 'NORMAL'
        let contractDaysLeft: number | null = null

        if (emp.contractEndDate) {
            const diffTime = new Date(emp.contractEndDate).getTime() - now.getTime()
            contractDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            if (contractDaysLeft <= 0) {
                contractWarning = 'EXPIRED'
            } else if (contractDaysLeft <= 30) {
                contractWarning = 'EXPIRING_SOON'
            }
        }

        let healthWarning: 'NORMAL' | 'EXPIRING_SOON' | 'EXPIRED' = 'NORMAL'
        let healthDaysLeft: number | null = null

        if (emp.healthCheckExpiry) {
            const diffTime = new Date(emp.healthCheckExpiry).getTime() - now.getTime()
            healthDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            if (healthDaysLeft <= 0) {
                healthWarning = 'EXPIRED'
            } else if (healthDaysLeft <= 30) {
                healthWarning = 'EXPIRING_SOON'
            }
        }

        return {
            ...emp,
            contractWarning,
            contractDaysLeft,
            healthWarning,
            healthDaysLeft,
            documentsCount: emp._count.documents,
        }
    })
}

// ── 2. Get Employee Detail with Documents ────────────────────────────
export async function getEmployeeById(id: string) {
    const user = await requireAuth()

    const emp = await prisma.employee.findUnique({
        where: { id },
        include: {
            dept: true,
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    status: true,
                    roles: {
                        include: { role: true }
                    }
                }
            },
            documents: {
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    if (!emp) return null

    const isHrAdmin = canManageHr(user)
    if (!isHrAdmin && emp.userId !== user.id) {
        throw new Error('Bạn không có quyền truy cập hồ sơ nhân sự này')
    }

    return emp
}

// ── 3. Create New Employee ───────────────────────────────────────────
export async function createEmployee(data: CreateEmployeeInput) {
    const user = await requireAuth()
    if (!canManageHr(user)) {
        throw new Error('Chỉ Ban Giám Đốc, Trợ Lý hoặc HCNS mới có quyền tạo hồ sơ nhân viên')
    }

    // Auto generate code if missing
    let code = data.code?.trim()
    if (!code) {
        const count = await prisma.employee.count()
        code = `NV-${String(count + 1).padStart(3, '0')}`
    } else {
        const existing = await prisma.employee.findUnique({ where: { code } })
        if (existing) {
            throw new Error(`Mã nhân viên "${code}" đã tồn tại trên hệ thống`)
        }
    }

    // Verify userId isn't already assigned to another employee
    if (data.userId) {
        const linked = await prisma.employee.findUnique({ where: { userId: data.userId } })
        if (linked) {
            throw new Error('Tài khoản ERP này đã được liên kết với một nhân viên khác')
        }
    }

    const created = await prisma.employee.create({
        data: {
            code,
            userId: data.userId || null,
            fullName: data.fullName.trim(),
            avatarUrl: data.avatarUrl || null,
            gender: data.gender || null,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            phone: data.phone?.trim() || null,
            email: data.email?.trim() || null,
            nationalId: data.nationalId?.trim() || null,
            nationalIdDate: data.nationalIdDate ? new Date(data.nationalIdDate) : null,
            nationalIdPlace: data.nationalIdPlace?.trim() || null,
            address: data.address?.trim() || null,
            currentAddress: data.currentAddress?.trim() || null,
            emergencyContact: data.emergencyContact?.trim() || null,
            emergencyPhone: data.emergencyPhone?.trim() || null,
            emergencyRelation: data.emergencyRelation?.trim() || null,
            deptId: data.deptId || null,
            position: data.position?.trim() || null,
            status: data.status || 'ACTIVE',
            startDate: data.startDate ? new Date(data.startDate) : null,
            officialDate: data.officialDate ? new Date(data.officialDate) : null,
            contractType: data.contractType || null,
            contractNumber: data.contractNumber?.trim() || null,
            contractStartDate: data.contractStartDate ? new Date(data.contractStartDate) : null,
            contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
            bankAccountNo: data.bankAccountNo?.trim() || null,
            bankName: data.bankName?.trim() || null,
            bankAccountHolder: data.bankAccountHolder?.trim() || null,
            taxCode: data.taxCode?.trim() || null,
            socialInsuranceNo: data.socialInsuranceNo?.trim() || null,
            healthCheckDate: data.healthCheckDate ? new Date(data.healthCheckDate) : null,
            healthCheckExpiry: data.healthCheckExpiry ? new Date(data.healthCheckExpiry) : null,
            notes: data.notes?.trim() || null,
        }
    })

    revalidatePath('/dashboard/hr')
    return { success: true, employee: created }
}

// ── 4. Update Employee ───────────────────────────────────────────────
export async function updateEmployee(id: string, data: Partial<CreateEmployeeInput>) {
    const user = await requireAuth()
    const isHrAdmin = canManageHr(user)

    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) throw new Error('Không tìm thấy nhân viên')

    if (!isHrAdmin && existing.userId !== user.id) {
        throw new Error('Bạn không có quyền chỉnh sửa hồ sơ nhân viên này')
    }

    // Only HR Admin can change dept, position, status, contract, bank, code, userId
    const updatePayload: any = {
        fullName: data.fullName ? data.fullName.trim() : existing.fullName,
        phone: data.phone !== undefined ? data.phone?.trim() || null : existing.phone,
        email: data.email !== undefined ? data.email?.trim() || null : existing.email,
        address: data.address !== undefined ? data.address?.trim() || null : existing.address,
        currentAddress: data.currentAddress !== undefined ? data.currentAddress?.trim() || null : existing.currentAddress,
        emergencyContact: data.emergencyContact !== undefined ? data.emergencyContact?.trim() || null : existing.emergencyContact,
        emergencyPhone: data.emergencyPhone !== undefined ? data.emergencyPhone?.trim() || null : existing.emergencyPhone,
        emergencyRelation: data.emergencyRelation !== undefined ? data.emergencyRelation?.trim() || null : existing.emergencyRelation,
        avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl || null : existing.avatarUrl,
    }

    if (isHrAdmin) {
        if (data.code && data.code !== existing.code) {
            const dup = await prisma.employee.findUnique({ where: { code: data.code.trim() } })
            if (dup && dup.id !== id) throw new Error(`Mã nhân viên "${data.code}" đã được sử dụng`)
            updatePayload.code = data.code.trim()
        }

        if (data.userId !== undefined) {
            if (data.userId) {
                const dupUser = await prisma.employee.findUnique({ where: { userId: data.userId } })
                if (dupUser && dupUser.id !== id) throw new Error('Tài khoản ERP này đã gắn với nhân viên khác')
            }
            updatePayload.userId = data.userId || null
        }

        if (data.gender !== undefined) updatePayload.gender = data.gender || null
        if (data.dateOfBirth !== undefined) updatePayload.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null
        if (data.nationalId !== undefined) updatePayload.nationalId = data.nationalId?.trim() || null
        if (data.nationalIdDate !== undefined) updatePayload.nationalIdDate = data.nationalIdDate ? new Date(data.nationalIdDate) : null
        if (data.nationalIdPlace !== undefined) updatePayload.nationalIdPlace = data.nationalIdPlace?.trim() || null
        if (data.deptId !== undefined) updatePayload.deptId = data.deptId || null
        if (data.position !== undefined) updatePayload.position = data.position?.trim() || null
        if (data.status !== undefined) updatePayload.status = data.status
        if (data.startDate !== undefined) updatePayload.startDate = data.startDate ? new Date(data.startDate) : null
        if (data.officialDate !== undefined) updatePayload.officialDate = data.officialDate ? new Date(data.officialDate) : null
        if (data.contractType !== undefined) updatePayload.contractType = data.contractType || null
        if (data.contractNumber !== undefined) updatePayload.contractNumber = data.contractNumber?.trim() || null
        if (data.contractStartDate !== undefined) updatePayload.contractStartDate = data.contractStartDate ? new Date(data.contractStartDate) : null
        if (data.contractEndDate !== undefined) updatePayload.contractEndDate = data.contractEndDate ? new Date(data.contractEndDate) : null
        if (data.bankAccountNo !== undefined) updatePayload.bankAccountNo = data.bankAccountNo?.trim() || null
        if (data.bankName !== undefined) updatePayload.bankName = data.bankName?.trim() || null
        if (data.bankAccountHolder !== undefined) updatePayload.bankAccountHolder = data.bankAccountHolder?.trim() || null
        if (data.taxCode !== undefined) updatePayload.taxCode = data.taxCode?.trim() || null
        if (data.socialInsuranceNo !== undefined) updatePayload.socialInsuranceNo = data.socialInsuranceNo?.trim() || null
        if (data.healthCheckDate !== undefined) updatePayload.healthCheckDate = data.healthCheckDate ? new Date(data.healthCheckDate) : null
        if (data.healthCheckExpiry !== undefined) updatePayload.healthCheckExpiry = data.healthCheckExpiry ? new Date(data.healthCheckExpiry) : null
        if (data.notes !== undefined) updatePayload.notes = data.notes?.trim() || null
    }

    const updated = await prisma.employee.update({
        where: { id },
        data: updatePayload
    })

    revalidatePath('/dashboard/hr')
    return { success: true, employee: updated }
}

// ── 5. Delete / Archive Employee ─────────────────────────────────────
export async function deleteEmployee(id: string) {
    const user = await requireAuth()
    if (!canManageHr(user)) {
        throw new Error('Chỉ Ban Giám Đốc, Trợ Lý hoặc HCNS mới có quyền xóa/nghỉ việc nhân sự')
    }

    // Set status to RESIGNED to preserve historical contracts & audit records
    await prisma.employee.update({
        where: { id },
        data: { status: 'RESIGNED' }
    })

    revalidatePath('/dashboard/hr')
    return { success: true }
}

// ── 6. Add Employee Document ─────────────────────────────────────────
export async function createEmployeeDocument(data: {
    employeeId: string
    docType: string
    title: string
    docNumber?: string | null
    fileUrl: string
    filePath?: string | null
    fileType?: string | null
    fileSize?: number | null
    issueDate?: string | null
    expiryDate?: string | null
    notes?: string | null
}) {
    const user = await requireAuth()
    const isHrAdmin = canManageHr(user)

    const emp = await prisma.employee.findUnique({ where: { id: data.employeeId } })
    if (!emp) throw new Error('Không tìm thấy nhân viên')

    if (!isHrAdmin && emp.userId !== user.id) {
        throw new Error('Bạn không có quyền tải lên giấy tờ cho nhân sự này')
    }

    const doc = await prisma.employeeDocument.create({
        data: {
            employeeId: data.employeeId,
            docType: data.docType,
            title: data.title.trim(),
            docNumber: data.docNumber?.trim() || null,
            fileUrl: data.fileUrl,
            filePath: data.filePath || null,
            fileType: data.fileType || null,
            fileSize: data.fileSize || null,
            issueDate: data.issueDate ? new Date(data.issueDate) : null,
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
            notes: data.notes?.trim() || null,
            uploadedBy: user.id,
        }
    })

    revalidatePath('/dashboard/hr')
    return { success: true, document: doc }
}

// ── 7. Delete Employee Document ──────────────────────────────────────
export async function deleteEmployeeDocument(docId: string) {
    const user = await requireAuth()
    const isHrAdmin = canManageHr(user)

    const doc = await prisma.employeeDocument.findUnique({
        where: { id: docId },
        include: { employee: true }
    })

    if (!doc) throw new Error('Không tìm thấy tài liệu')

    if (!isHrAdmin && doc.employee.userId !== user.id) {
        throw new Error('Bạn không có quyền xóa tài liệu này')
    }

    await prisma.employeeDocument.delete({ where: { id: docId } })
    revalidatePath('/dashboard/hr')
    return { success: true }
}

// ── 8. HR Expiry Alerts & Statistics ────────────────────────────────
export async function getHrDashboardStats() {
    const now = new Date()
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [
        totalEmployees,
        activeEmployees,
        probationEmployees,
        expiringContracts,
        expiredContracts,
        expiringHealthChecks,
        totalDocs
    ] = await Promise.all([
        prisma.employee.count(),
        prisma.employee.count({ where: { status: 'ACTIVE' } }),
        prisma.employee.count({ where: { status: 'PROBATION' } }),
        prisma.employee.count({
            where: {
                status: { in: ['ACTIVE', 'PROBATION'] },
                contractEndDate: {
                    gte: now,
                    lte: thirtyDaysLater,
                }
            }
        }),
        prisma.employee.count({
            where: {
                status: { in: ['ACTIVE', 'PROBATION'] },
                contractEndDate: {
                    lt: now,
                }
            }
        }),
        prisma.employee.count({
            where: {
                status: { in: ['ACTIVE', 'PROBATION'] },
                healthCheckExpiry: {
                    lte: thirtyDaysLater,
                }
            }
        }),
        prisma.employeeDocument.count()
    ])

    // List of top 10 urgent expiring items
    const urgentItems = await prisma.employee.findMany({
        where: {
            status: { in: ['ACTIVE', 'PROBATION'] },
            OR: [
                { contractEndDate: { lte: thirtyDaysLater } },
                { healthCheckExpiry: { lte: thirtyDaysLater } }
            ]
        },
        select: {
            id: true,
            code: true,
            fullName: true,
            position: true,
            contractType: true,
            contractEndDate: true,
            healthCheckExpiry: true,
            dept: { select: { name: true } }
        },
        orderBy: { contractEndDate: 'asc' },
        take: 10
    })

    return {
        totalEmployees,
        activeEmployees,
        probationEmployees,
        expiringContracts,
        expiredContracts,
        expiringHealthChecks,
        totalDocs,
        urgentItems,
    }
}

// ── 9. Trigger Expiry Notifications into Header Bell ─────────────────
export async function sendHrExpiryNotificationAlerts() {
    const user = await requireAuth()
    if (!canManageHr(user)) return { success: false, error: 'Unauthorized' }

    const now = new Date()
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Find urgent employees
    const expiringEmployees = await prisma.employee.findMany({
        where: {
            status: { in: ['ACTIVE', 'PROBATION'] },
            OR: [
                { contractEndDate: { lte: thirtyDaysLater } },
                { healthCheckExpiry: { lte: thirtyDaysLater } }
            ]
        },
        select: {
            id: true,
            code: true,
            fullName: true,
            contractEndDate: true,
            healthCheckExpiry: true
        }
    })

    if (expiringEmployees.length === 0) {
        return { success: true, count: 0, message: 'Không có hợp đồng hoặc giấy tờ nào cần cảnh báo' }
    }

    // Target users: All admins, CEO, Trợ Lý, HCNS
    const adminRoles = await prisma.role.findMany({
        where: {
            name: { in: ['CEO', 'Admin', 'Trợ Lý', 'Hành Chính Nhân Sự', 'HCNS', 'HR'] }
        },
        include: {
            users: {
                select: { userId: true }
            }
        }
    })

    const targetUserIds = Array.from(
        new Set(adminRoles.flatMap(r => r.users.map(u => u.userId)))
    )

    if (targetUserIds.length === 0) {
        targetUserIds.push(user.id)
    }

    const title = `⚠️ Cảnh báo nhân sự: Có ${expiringEmployees.length} nhân viên sắp hết hạn HĐ/KSK`
    const content = expiringEmployees
        .slice(0, 3)
        .map(e => {
            const dateStr = e.contractEndDate ? new Date(e.contractEndDate).toLocaleDateString('vi-VN') : ''
            return `${e.fullName} (${e.code}) - Hạn: ${dateStr}`
        })
        .join(', ') + (expiringEmployees.length > 3 ? ` và ${expiringEmployees.length - 3} nhân sự khác.` : '.')

    let createdCount = 0
    for (const uid of targetUserIds) {
        // Prevent duplicate spam in last 24h
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const recentNoti = await prisma.notification.findFirst({
            where: {
                userId: uid,
                title,
                createdAt: { gte: yesterday }
            }
        })

        if (!recentNoti) {
            await prisma.notification.create({
                data: {
                    userId: uid,
                    title,
                    content,
                    type: 'warning',
                    link: '/dashboard/hr',
                    isRead: false
                }
            })
            createdCount++
        }
    }

    return { success: true, count: createdCount, message: `Đã gửi ${createdCount} thông báo đến Ban Giám Đốc và Trợ Lý` }
}

// ── 10. Get Unlinked ERP Users & Departments for Dropdown ────────────
export async function getHrFormHelpers(currentEmployeeId?: string) {
    await requireAuth()

    const [departments, allActiveUsers, linkedEmployees] = await Promise.all([
        prisma.department.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        }),
        prisma.user.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                name: true,
                email: true,
                roles: {
                    include: { role: true }
                }
            },
            orderBy: { name: 'asc' }
        }),
        prisma.employee.findMany({
            where: {
                userId: { not: null },
                ...(currentEmployeeId ? { id: { not: currentEmployeeId } } : {})
            },
            select: { userId: true }
        })
    ])

    const linkedUserIds = new Set(linkedEmployees.map(e => e.userId).filter(Boolean))

    const availableUsers = allActiveUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        roles: u.roles.map(r => r.role.name).join(', '),
        isLinkedOther: linkedUserIds.has(u.id)
    }))

    return {
        departments,
        availableUsers,
    }
}

// ── 11. Upload File Helper ──────────────────────────────────────────
export async function uploadHrDocumentFile(formData: FormData) {
    const { uploadFile } = await import('@/lib/storage')
    return await uploadFile(formData, 'employee-documents')
}

