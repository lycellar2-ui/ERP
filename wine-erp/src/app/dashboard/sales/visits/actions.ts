'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireAuth, SessionUser } from '@/lib/session'

const MANAGER_ROLES = ['Admin', 'ADMIN', 'Sales Manager', 'SALES_MANAGER', 'CEO', 'Manager', 'MANAGER', 'Ban Giám Đốc', 'BAN_GIAM_DOC']

function checkIsManager(user: SessionUser): boolean {
    return user.roles?.some(r => MANAGER_ROLES.includes(r)) || false
}

export interface CheckInPayload {
    customerId: string
    salespersonId?: string
    purpose?: string
    activityType?: string
    scheduleId?: string
    isUnplanned?: boolean
    notes?: string
    lat?: number
    lng?: number
    address?: string
    photoBase64: string // Mandatory camera photo URL/base64
    thumbnailBase64?: string // Micro-thumbnail (~5-8KB) to reduce DB query payload by 95%+
}

export interface CheckOutPayload {
    visitId: string
    salespersonId?: string
    notes: string // Mandatory result notes
    lat?: number
    lng?: number
    address?: string
    photoBase64: string // Mandatory camera photo URL/base64
}

/**
 * Parses raw checkInPhoto which can be either a legacy Base64 string or
 * a JSON bundle: { thumb: string, full: string }.
 * Keeps list queries lightweight while allowing on-demand full resolution viewing.
 */
function parseVisitPhoto(rawPhoto: string | null | undefined): { thumb: string; full: string; hasFull: boolean } {
    if (!rawPhoto) return { thumb: '', full: '', hasFull: false }
    if (rawPhoto.startsWith('{') && rawPhoto.includes('"thumb"')) {
        try {
            const parsed = JSON.parse(rawPhoto)
            return {
                thumb: parsed.thumb || parsed.full || '',
                full: parsed.full || parsed.thumb || '',
                hasFull: !!parsed.full,
            }
        } catch {
            return { thumb: rawPhoto, full: rawPhoto, hasFull: true }
        }
    }
    return { thumb: rawPhoto, full: rawPhoto, hasFull: true }
}

/**
 * On-demand query to fetch high-resolution original check-in photo for zoom modal or CEO inspection.
 */
export async function getSalesVisitFullPhoto(visitId: string): Promise<{ success: boolean; photo?: string; error?: string }> {
    try {
        await requireAuth()
        const visit = await prisma.salesVisit.findUnique({
            where: { id: visitId },
            select: { checkInPhoto: true, checkOutPhoto: true }
        })
        if (!visit) return { success: false, error: 'Không tìm thấy lượt viếng thăm' }
        const parsed = parseVisitPhoto(visit.checkInPhoto || visit.checkOutPhoto)
        return { success: true, photo: parsed.full || parsed.thumb }
    } catch (e: any) {
        return { success: false, error: e.message || 'Lỗi khi tải ảnh gốc' }
    }
}

// Reverse Geocoding via Server Action to bypass browser CORS & User-Agent restrictions
const geocodeCache = new Map<string, string>()

export async function reverseGeocodeAction(lat: number, lng: number): Promise<{ address?: string }> {
    try {
        if (!lat || !lng) return {}
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
        if (geocodeCache.has(key)) {
            return { address: geocodeCache.get(key) }
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2500)

        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi&zoom=18`
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'WineERP-FieldOperations/1.0 (info@lyscellars.com)',
                'Accept': 'application/json'
            },
            signal: controller.signal,
            next: { revalidate: 86400 } // Cache results for 24 hours
        })
        clearTimeout(timeoutId)

        if (res.ok) {
            const data = await res.json()
            if (data && data.display_name) {
                geocodeCache.set(key, data.display_name)
                return { address: data.display_name }
            }
        }
    } catch (e) {
        console.warn('reverseGeocodeAction failed, fallback to raw coords', e)
    }
    return { address: `Toạ độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}` }
}

// Quick create prospect / lead customer by sales rep on the field
export async function quickCreateProspectCustomer(data: {
    name: string
    contactName?: string
    phone?: string
    address?: string
    city?: string
    channel?: string
    salespersonId?: string
}) {
    try {
        const user = await requireAuth()
        const isMgr = checkIsManager(user)
        const targetRepId = (isMgr && data.salespersonId) ? data.salespersonId : user.id

        if (!data.name || !data.name.trim()) {
            return { success: false, error: 'Vui lòng nhập tên khách hàng / nhà hàng / đại lý' }
        }

        const now = new Date()
        const ym = now.toISOString().slice(0, 7).replace('-', '')
        const count = await prisma.customer.count({
            where: {
                createdAt: {
                    gte: new Date(now.getFullYear(), now.getMonth(), 1)
                }
            }
        })
        const code = `LEAD-${ym}-${String(count + 1).padStart(4, '0')}`

        const customer = await prisma.customer.create({
            data: {
                code,
                name: data.name.trim(),
                channel: (data.channel as any) || 'HORECA',
                customerType: 'HORECA',
                status: 'ACTIVE',
                salesRepId: targetRepId,
                paymentTerm: 'COD',
            }
        })

        // Add contact info if provided
        if (data.phone || data.contactName) {
            await prisma.customerContact.create({
                data: {
                    customerId: customer.id,
                    name: data.contactName?.trim() || data.name.trim(),
                    phone: data.phone?.trim() || null,
                    isPrimary: true,
                }
            })
        }

        // Add address if provided
        if (data.address) {
            await prisma.customerAddress.create({
                data: {
                    customerId: customer.id,
                    label: 'Địa chỉ điểm bán',
                    address: data.address.trim(),
                    city: data.city?.trim() || 'Hồ Chí Minh',
                    isDefault: true,
                }
            })
        }

        revalidatePath('/dashboard/sales/visits')
        return {
            success: true,
            customer: {
                id: customer.id,
                code: customer.code,
                name: customer.name,
                channel: customer.channel,
                phone: data.phone || null,
                address: data.address || null,
            }
        }
    } catch (err: any) {
        console.error('quickCreateProspectCustomer error:', err)
        return { success: false, error: err.message || 'Không thể tạo nhanh khách hàng' }
    }
}

export async function getActiveVisit(salespersonId?: string) {
    try {
        const user = await requireAuth()
        const isMgr = checkIsManager(user)
        const targetRepId = (isMgr && salespersonId && salespersonId !== 'ALL') ? salespersonId : user.id

        const visit = await prisma.salesVisit.findFirst({
            where: {
                salespersonId: targetRepId,
                status: 'IN_PROGRESS',
            },
            include: {
                customer: {
                    select: { id: true, code: true, name: true, channel: true }
                }
            },
            orderBy: { checkInTime: 'desc' }
        })
        return visit
    } catch (e: any) {
        console.error('Failed to get active visit', e)
        return null
    }
}

export async function checkInSalesVisit(data: CheckInPayload) {
    try {
        const user = await requireAuth()
        const isMgr = checkIsManager(user)
        const targetRepId = (isMgr && data.salespersonId) ? data.salespersonId : user.id

        if (!data.customerId) return { success: false, error: 'Vui lòng chọn khách hàng viếng thăm' }
        if (!data.photoBase64) return { success: false, error: 'Bắt buộc phải chụp ảnh camera điểm bán khi Check-in' }

        // Store photo as JSON bundle (thumbnail + full photo) if thumbnail is provided
        const photoStorageValue = data.thumbnailBase64
            ? JSON.stringify({ thumb: data.thumbnailBase64, full: data.photoBase64 })
            : data.photoBase64

        // Generate visitNo e.g. VIS-202607-0001
        const now = new Date()
        const ym = now.toISOString().slice(0, 7).replace('-', '')
        const count = await prisma.salesVisit.count({
            where: {
                checkInTime: {
                    gte: new Date(now.getFullYear(), now.getMonth(), 1)
                }
            }
        })
        const visitNo = `VIS-${ym}-${String(count + 1).padStart(4, '0')}`
        const visitNotes = (data.notes || data.purpose || 'Đã viếng thăm và chăm sóc điểm bán').trim()

        const visit = await prisma.$transaction(async (tx) => {
            // 1-step check-in: marks COMPLETED with photo and GPS
            const newVisit = await tx.salesVisit.create({
                data: {
                    visitNo,
                    customerId: data.customerId,
                    salespersonId: targetRepId,
                    status: 'COMPLETED',
                    purpose: data.purpose || 'Chăm sóc khách hàng định kỳ',
                    activityType: data.activityType || 'PERIODIC_CARE',
                    scheduleId: data.scheduleId || null,
                    isUnplanned: !!data.isUnplanned,
                    checkInTime: now,
                    checkInLat: data.lat,
                    checkInLng: data.lng,
                    checkInAddress: data.address,
                    checkInPhoto: photoStorageValue,
                    checkOutTime: now,
                    checkOutLat: data.lat,
                    checkOutLng: data.lng,
                    checkOutAddress: data.address,
                    durationMinutes: 1,
                    notes: visitNotes,
                }
            })

            // If checked in from a planned schedule, mark it COMPLETED immediately
            if (data.scheduleId) {
                await tx.salesVisitSchedule.update({
                    where: { id: data.scheduleId },
                    data: {
                        status: 'COMPLETED',
                        resultNotes: visitNotes,
                        salesVisitId: newVisit.id,
                    }
                }).catch(() => {})
            }

            return newVisit
        })

        revalidatePath('/dashboard/sales/visits')
        return { success: true, visitId: visit.id }
    } catch (e: any) {
        console.error('checkInSalesVisit error', e)
        return { success: false, error: e.message || 'Lỗi hệ thống khi Check-in' }
    }
}

export async function checkOutSalesVisit(data: CheckOutPayload) {
    try {
        const user = await requireAuth()
        const isMgr = checkIsManager(user)

        if (!data.visitId) return { success: false, error: 'Mã lượt viếng thăm không hợp lệ' }
        if (!data.photoBase64) return { success: false, error: 'Bắt buộc phải chụp ảnh camera điểm bán khi Check-out' }
        if (!data.notes || data.notes.trim().length < 5) {
            return { success: false, error: 'Bắt buộc nhập ghi chú kết quả làm việc với khách hàng (tối thiểu 5 ký tự)' }
        }

        const visit = await prisma.salesVisit.findUnique({
            where: { id: data.visitId }
        })
        if (!visit) return { success: false, error: 'Không tìm thấy lượt viếng thăm' }
        if (!isMgr && visit.salespersonId !== user.id) {
            return { success: false, error: 'Bạn không có quyền check-out lượt viếng thăm của nhân viên khác' }
        }
        if (visit.status !== 'IN_PROGRESS') return { success: false, error: 'Lượt viếng thăm này đã được Check-out hoặc hủy trước đó' }

        const checkOutTime = new Date()
        const durationMinutes = Math.round((checkOutTime.getTime() - new Date(visit.checkInTime).getTime()) / (1000 * 60))

        await prisma.$transaction(async (tx) => {
            await tx.salesVisit.update({
                where: { id: data.visitId },
                data: {
                    status: 'COMPLETED',
                    checkOutTime,
                    checkOutLat: data.lat,
                    checkOutLng: data.lng,
                    checkOutAddress: data.address,
                    checkOutPhoto: data.photoBase64,
                    durationMinutes: Math.max(1, durationMinutes),
                    notes: data.notes.trim(),
                }
            })

            // If visit has a linked schedule, mark it COMPLETED
            if (visit.scheduleId) {
                await tx.salesVisitSchedule.update({
                    where: { id: visit.scheduleId },
                    data: {
                        status: 'COMPLETED',
                        resultNotes: data.notes.trim(),
                        salesVisitId: visit.id,
                    }
                }).catch(() => {})
            }
        })

        revalidatePath('/dashboard/sales/visits')
        return { success: true }
    } catch (e: any) {
        console.error('checkOutSalesVisit error', e)
        return { success: false, error: e.message || 'Lỗi hệ thống khi Check-out' }
    }
}

export async function getSalesVisits(filters?: {
    salespersonId?: string
    customerId?: string
    status?: string
    date?: string
    limit?: number
}) {
    try {
        const user = await requireAuth()
        const isMgr = checkIsManager(user)

        const where: any = {}
        if (filters?.salespersonId && filters.salespersonId !== 'ALL') {
            where.salespersonId = isMgr ? filters.salespersonId : user.id
        } else if (!isMgr) {
            where.salespersonId = user.id
        }

        if (filters?.customerId && filters.customerId !== 'ALL') {
            where.customerId = filters.customerId
        }
        if (filters?.status && filters.status !== 'ALL') {
            where.status = filters.status
        }
        if (filters?.date && filters.date.trim() !== '') {
            const start = new Date(`${filters.date}T00:00:00+07:00`)
            const end = new Date(`${filters.date}T23:59:59.999+07:00`)
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                where.checkInTime = { gte: start, lte: end }
            }
        }

        const visits = await prisma.salesVisit.findMany({
            where,
            include: {
                customer: { select: { id: true, code: true, name: true, channel: true } },
                salesperson: { select: { id: true, name: true, email: true } },
            },
            orderBy: { checkInTime: 'desc' },
            take: filters?.limit ?? 30,
        })

        return visits.map((v: any) => ({
            id: v.id,
            visitNo: v.visitNo,
            customerId: v.customerId,
            customerCode: v.customer?.code || '',
            customerName: v.customer?.name || '',
            customerChannel: v.customer?.channel || 'HORECA',
            salespersonId: v.salespersonId,
            salespersonName: v.salesperson?.name || '',
            status: v.status,
            purpose: v.purpose,
            activityType: v.activityType || 'PERIODIC_CARE',
            isUnplanned: v.isUnplanned || false,
            scheduleId: v.scheduleId || null,
            checkInTime: v.checkInTime.toISOString(),
            checkInLat: v.checkInLat,
            checkInLng: v.checkInLng,
            checkInAddress: v.checkInAddress,
            // Return lightweight thumbnail to reduce JSON payload by 95%+
            checkInPhoto: parseVisitPhoto(v.checkInPhoto).thumb,
            checkOutTime: v.checkOutTime?.toISOString() || null,
            checkOutLat: v.checkOutLat || null,
            checkOutLng: v.checkOutLng || null,
            checkOutAddress: v.checkOutAddress || null,
            checkOutPhoto: parseVisitPhoto(v.checkOutPhoto).thumb,
            durationMinutes: v.durationMinutes || 0,
            notes: v.notes || '',
        }))
    } catch (e: any) {
        console.error('getSalesVisits error', e)
        return []
    }
}

export async function getVisitStats() {
    try {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const [totalToday, inProgressToday, completedToday] = await Promise.all([
            prisma.salesVisit.count({ where: { checkInTime: { gte: todayStart } } }),
            prisma.salesVisit.count({ where: { status: 'IN_PROGRESS' } }),
            prisma.salesVisit.count({ where: { status: 'COMPLETED', checkInTime: { gte: todayStart } } }),
        ])

        return {
            totalToday,
            inProgressToday,
            completedToday,
        }
    } catch (e: any) {
        console.error('getVisitStats error', e)
        return { totalToday: 0, inProgressToday: 0, completedToday: 0 }
    }
}

// -------------------------------------------------------------
// WEEKLY PLANNING & REVIEW ACTIONS
// -------------------------------------------------------------

export async function getWeeklyPlanWithVisits(salespersonId: string, weekNumber: number, year: number) {
    try {
        const user = await requireAuth()
        const isMgr = checkIsManager(user)
        const targetRepId = (isMgr && salespersonId && salespersonId !== 'ALL') ? salespersonId : user.id

        let plan = await prisma.weeklyVisitPlan.findUnique({
            where: {
                salesRepId_weekNumber_year: {
                    salesRepId: targetRepId,
                    weekNumber,
                    year,
                }
            },
            include: {
                visits: {
                    include: {
                        customer: {
                            select: { id: true, code: true, name: true, channel: true }
                        }
                    },
                    orderBy: { visitDate: 'asc' }
                }
            }
        })

        // Compute Monday - Sunday dates for the week
        const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7)
        const dow = simple.getDay()
        const ISOweekStart = new Date(simple)
        if (dow <= 4) {
            ISOweekStart.setDate(simple.getDate() - (simple.getDay() || 7) + 1)
        } else {
            ISOweekStart.setDate(simple.getDate() + 8 - (simple.getDay() || 7))
        }
        
        const start = new Date(ISOweekStart.getFullYear(), ISOweekStart.getMonth(), ISOweekStart.getDate(), 0, 0, 0)
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        end.setHours(23, 59, 59, 999)

        // Also fetch all actual sales visits for this salesperson in this week range
        const actualVisits = await prisma.salesVisit.findMany({
            where: {
                salespersonId: targetRepId,
                checkInTime: {
                    gte: start,
                    lte: end,
                }
            },
            include: {
                customer: {
                    select: { id: true, code: true, name: true, channel: true }
                }
            },
            orderBy: { checkInTime: 'asc' }
        })

        return {
            success: true,
            plan: plan ? {
                id: plan.id,
                salesRepId: plan.salesRepId,
                weekNumber: plan.weekNumber,
                year: plan.year,
                status: plan.status,
                note: plan.note || '',
                selfReview: plan.selfReview || '',
                managerFeedback: plan.managerFeedback || '',
                submittedAt: plan.submittedAt?.toISOString() || null,
                reviewedAt: plan.reviewedAt?.toISOString() || null,
                visits: plan.visits.map(v => ({
                    id: v.id,
                    planId: v.planId,
                    customerId: v.customerId,
                    customer: v.customer,
                    visitDate: v.visitDate.toISOString().split('T')[0],
                    purpose: v.purpose,
                    status: v.status,
                    isUnplanned: v.isUnplanned,
                    salesVisitId: v.salesVisitId,
                    resultNotes: v.resultNotes,
                }))
            } : null,
            actualVisits: actualVisits.map(v => ({
                id: v.id,
                visitNo: v.visitNo,
                customerId: v.customerId,
                customer: v.customer,
                status: v.status,
                purpose: v.purpose,
                activityType: v.activityType,
                scheduleId: v.scheduleId,
                isUnplanned: v.isUnplanned,
                checkInTime: v.checkInTime.toISOString(),
                checkInPhoto: parseVisitPhoto(v.checkInPhoto).thumb,
                checkOutTime: v.checkOutTime?.toISOString() || null,
                durationMinutes: v.durationMinutes || 0,
                notes: v.notes || '',
            }))
        }
    } catch (err: any) {
        console.error('getWeeklyPlanWithVisits error:', err)
        return { success: false, error: err.message }
    }
}

export async function saveWeeklyPlanAction(input: {
    salespersonId?: string
    weekNumber: number
    year: number
    note?: string
    visits: Array<{
        id?: string
        customerId: string
        visitDate: string
        purpose: string
        status?: string
    }>
}) {
    try {
        const user = await requireAuth()
        const isMgr = checkIsManager(user)
        const targetRepId = (isMgr && input.salespersonId) ? input.salespersonId : user.id

        const result = await prisma.$transaction(async (tx) => {
            let plan = await tx.weeklyVisitPlan.findUnique({
                where: {
                    salesRepId_weekNumber_year: {
                        salesRepId: targetRepId,
                        weekNumber: input.weekNumber,
                        year: input.year,
                    }
                }
            })

            if (!plan) {
                plan = await tx.weeklyVisitPlan.create({
                    data: {
                        salesRepId: targetRepId,
                        weekNumber: input.weekNumber,
                        year: input.year,
                        note: input.note || null,
                        status: 'DRAFT',
                    }
                })
            } else {
                plan = await tx.weeklyVisitPlan.update({
                    where: { id: plan.id },
                    data: {
                        note: input.note || null,
                    }
                })
            }

            // Sync visits safely: keep existing items that have id or are COMPLETED
            const existingVisits = await tx.salesVisitSchedule.findMany({
                where: { planId: plan.id }
            })

            const incomingIds = input.visits.filter(v => v.id).map(v => v.id)
            // Delete only visits that are NOT completed and NOT in the incoming list
            const toDelete = existingVisits.filter(v => !incomingIds.includes(v.id) && v.status !== 'COMPLETED' && v.status !== 'IN_PROGRESS')
            if (toDelete.length > 0) {
                await tx.salesVisitSchedule.deleteMany({
                    where: { id: { in: toDelete.map(d => d.id) } }
                })
            }

            // Upsert / Create incoming
            for (const v of input.visits) {
                const visitDate = new Date(`${v.visitDate}T09:00:00.000Z`)
                if (v.id && existingVisits.some(e => e.id === v.id)) {
                    await tx.salesVisitSchedule.update({
                        where: { id: v.id },
                        data: {
                            customerId: v.customerId,
                            visitDate,
                            purpose: v.purpose,
                        }
                    })
                } else {
                    await tx.salesVisitSchedule.create({
                        data: {
                            planId: plan.id,
                            customerId: v.customerId,
                            visitDate,
                            purpose: v.purpose,
                            status: 'PLANNED',
                        }
                    })
                }
            }

            return plan
        })

        revalidatePath('/dashboard/sales/visits')
        return { success: true, planId: result.id }
    } catch (err: any) {
        console.error('saveWeeklyPlanAction error:', err)
        return { success: false, error: err.message || 'Không thể lưu kế hoạch tuần' }
    }
}

export async function submitWeeklyReportAction(input: {
    planId: string
    salespersonId?: string
    selfReview: string
}) {
    try {
        const user = await requireAuth()
        const isMgr = checkIsManager(user)

        if (!input.selfReview || input.selfReview.trim().length < 5) {
            return { success: false, error: 'Vui lòng nhập nội dung tự đánh giá kết quả tuần (tối thiểu 5 ký tự)' }
        }

        const plan = await prisma.weeklyVisitPlan.findUnique({
            where: { id: input.planId }
        })
        if (!plan) return { success: false, error: 'Không tìm thấy kế hoạch tuần' }
        if (!isMgr && plan.salesRepId !== user.id) return { success: false, error: 'Bạn không có quyền chốt kế hoạch này' }

        const updated = await prisma.weeklyVisitPlan.update({
            where: { id: input.planId },
            data: {
                status: 'SUBMITTED',
                selfReview: input.selfReview.trim(),
                submittedAt: new Date(),
            }
        })

        revalidatePath('/dashboard/sales/visits')
        return { success: true, plan: updated }
    } catch (err: any) {
        console.error('submitWeeklyReportAction error:', err)
        return { success: false, error: err.message || 'Không thể chốt báo cáo tuần' }
    }
}

export async function saveManagerFeedbackAction(input: {
    planId: string
    managerFeedback: string
    managerId?: string
}) {
    try {
        const user = await requireAuth()
        if (!checkIsManager(user)) {
            return { success: false, error: 'Chỉ Quản lý / Ban Giám Đốc mới có quyền đánh giá và phê duyệt kế hoạch tuần' }
        }

        const plan = await prisma.weeklyVisitPlan.findUnique({
            where: { id: input.planId }
        })
        if (!plan) return { success: false, error: 'Không tìm thấy kế hoạch tuần' }

        const updated = await prisma.weeklyVisitPlan.update({
            where: { id: input.planId },
            data: {
                status: 'APPROVED',
                managerFeedback: input.managerFeedback.trim(),
                reviewedAt: new Date(),
                reviewedById: user.id,
            }
        })

        revalidatePath('/dashboard/sales/visits')
        return { success: true, plan: updated }
    } catch (err: any) {
        console.error('saveManagerFeedbackAction error:', err)
        return { success: false, error: err.message || 'Không thể lưu nhận xét của quản lý' }
    }
}

// -------------------------------------------------------------
// MANAGER / CEO OVERVIEW ACTION
// -------------------------------------------------------------
export async function getTeamWeeklySalesOverview(weekNumber: number, year: number) {
    try {
        const user = await requireAuth()
        if (!checkIsManager(user)) {
            return { success: false, error: 'Chỉ Quản lý / Ban Giám Đốc mới có quyền xem bảng giám sát đội ngũ' }
        }

        // Compute Monday - Sunday dates for the week
        const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7)
        const dow = simple.getDay()
        const ISOweekStart = new Date(simple)
        if (dow <= 4) {
            ISOweekStart.setDate(simple.getDate() - (simple.getDay() || 7) + 1)
        } else {
            ISOweekStart.setDate(simple.getDate() + 8 - (simple.getDay() || 7))
        }
        
        const start = new Date(ISOweekStart.getFullYear(), ISOweekStart.getMonth(), ISOweekStart.getDate(), 0, 0, 0)
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        end.setHours(23, 59, 59, 999)

        // 1. Get all active users with Sales Rep role
        const users = await prisma.user.findMany({
            where: {
                status: 'ACTIVE',
                roles: {
                    some: {
                        role: {
                            name: {
                                in: ['Sales Rep', 'SALES_REP']
                            }
                        }
                    }
                }
            },
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' }
        })

        // 2. Fetch all weekly plans for this week
        const plans = await prisma.weeklyVisitPlan.findMany({
            where: { weekNumber, year },
            include: {
                visits: {
                    include: {
                        customer: { select: { id: true, code: true, name: true, channel: true } }
                    },
                    orderBy: { visitDate: 'asc' }
                }
            }
        })

        // 3. Fetch all actual sales visits in this week
        const actualVisits = await prisma.salesVisit.findMany({
            where: {
                checkInTime: { gte: start, lte: end }
            },
            include: {
                customer: { select: { id: true, code: true, name: true, channel: true } },
                salesperson: { select: { id: true, name: true, email: true } },
            },
            orderBy: { checkInTime: 'desc' }
        })

        // 4. Aggregate by user
        const items = users.map(u => {
            const plan = plans.find(p => p.salesRepId === u.id)
            const uVisits = actualVisits.filter(v => v.salespersonId === u.id)
            const plannedVisits = plan?.visits || []
            const plannedCount = plannedVisits.length
            const completedCount = uVisits.filter(v => v.status === 'COMPLETED').length
            const unplannedCount = uVisits.filter(v => v.isUnplanned).length
            const completionRate = plannedCount > 0 ? Math.min(100, Math.round((completedCount / plannedCount) * 100)) : 0

            return {
                salespersonId: u.id,
                salespersonName: u.name,
                salespersonEmail: u.email,
                planId: plan?.id || null,
                planStatus: plan?.status || 'NOT_CREATED', // NOT_CREATED, DRAFT, SUBMITTED, APPROVED
                plannedCount,
                completedCount,
                unplannedCount,
                completionRate,
                planNote: plan?.note || '',
                selfReview: plan?.selfReview || '',
                managerFeedback: plan?.managerFeedback || '',
                submittedAt: plan?.submittedAt?.toISOString() || null,
                reviewedAt: plan?.reviewedAt?.toISOString() || null,
                plannedVisits: plannedVisits.map(pv => ({
                    id: pv.id,
                    visitDate: pv.visitDate.toISOString().split('T')[0],
                    customerId: pv.customerId,
                    customerName: pv.customer?.name || 'Khách hàng',
                    customerCode: pv.customer?.code || '',
                    customerChannel: pv.customer?.channel || '',
                    purpose: pv.purpose,
                    status: pv.status,
                    resultNotes: pv.resultNotes,
                })),
                actualVisits: uVisits.map(av => ({
                    id: av.id,
                    visitNo: av.visitNo,
                    customerId: av.customerId,
                    customerName: av.customer?.name || 'Khách hàng',
                    customerCode: av.customer?.code || '',
                    customerChannel: av.customer?.channel || '',
                    checkInTime: av.checkInTime.toISOString(),
                    checkInAddress: av.checkInAddress,
                    checkInLat: av.checkInLat,
                    checkInLng: av.checkInLng,
                    // Return lightweight thumbnail to reduce JSON payload by 95%+
                    checkInPhoto: parseVisitPhoto(av.checkInPhoto).thumb,
                    status: av.status,
                    isUnplanned: av.isUnplanned,
                    purpose: av.purpose,
                    notes: av.notes,
                }))
            }
        })

        return {
            success: true,
            weekNumber,
            year,
            weekRange: {
                startStr: start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
                endStr: end.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            },
            items,
        }
    } catch (err: any) {
        console.error('getTeamWeeklySalesOverview error:', err)
        return { success: false, error: err.message || 'Lỗi khi tải tổng quan đội sale' }
    }
}

