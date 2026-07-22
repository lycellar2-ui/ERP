'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export interface CheckInPayload {
    customerId: string
    salespersonId: string
    purpose?: string
    lat?: number
    lng?: number
    address?: string
    photoBase64: string // Mandatory camera photo URL/base64
}

export interface CheckOutPayload {
    visitId: string
    salespersonId: string
    notes?: string
    lat?: number
    lng?: number
    address?: string
    photoBase64: string // Mandatory camera photo URL/base64
}

export async function getActiveVisit(salespersonId: string) {
    try {
        const visit = await prisma.salesVisit.findFirst({
            where: {
                salespersonId,
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
        if (!data.customerId) return { success: false, error: 'Vui lòng chọn khách hàng viếng thăm' }
        if (!data.photoBase64) return { success: false, error: 'Bắt buộc phải chụp ảnh camera điểm bán khi Check-in' }

        // Check if user already has an active visit
        const active = await prisma.salesVisit.findFirst({
            where: { salespersonId: data.salespersonId, status: 'IN_PROGRESS' }
        })
        if (active) {
            return { success: false, error: 'Bạn đang có 1 điểm viếng thăm chưa Check-out. Vui lòng Check-out điểm trước đó!' }
        }

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

        const visit = await prisma.salesVisit.create({
            data: {
                visitNo,
                customerId: data.customerId,
                salespersonId: data.salespersonId,
                status: 'IN_PROGRESS',
                purpose: data.purpose || 'Viếng thăm & Chăm sóc định kỳ',
                checkInTime: now,
                checkInLat: data.lat,
                checkInLng: data.lng,
                checkInAddress: data.address,
                checkInPhoto: data.photoBase64,
            }
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
        if (!data.visitId) return { success: false, error: 'Mã lượt viếng thăm không hợp lệ' }
        if (!data.photoBase64) return { success: false, error: 'Bắt buộc phải chụp ảnh camera điểm bán khi Check-out' }

        const visit = await prisma.salesVisit.findUnique({
            where: { id: data.visitId }
        })
        if (!visit) return { success: false, error: 'Không tìm thấy lượt viếng thăm' }
        if (visit.status !== 'IN_PROGRESS') return { success: false, error: 'Lượt viếng thăm này đã được Check-out hoặc hủy trước đó' }

        const checkOutTime = new Date()
        const durationMinutes = Math.round((checkOutTime.getTime() - new Date(visit.checkInTime).getTime()) / (1000 * 60))

        await prisma.salesVisit.update({
            where: { id: data.visitId },
            data: {
                status: 'COMPLETED',
                checkOutTime,
                checkOutLat: data.lat,
                checkOutLng: data.lng,
                checkOutAddress: data.address,
                checkOutPhoto: data.photoBase64,
                durationMinutes: Math.max(1, durationMinutes),
                notes: data.notes,
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
}) {
    try {
        const where: any = {}
        if (filters?.salespersonId) where.salespersonId = filters.salespersonId
        if (filters?.customerId) where.customerId = filters.customerId
        if (filters?.status && filters.status !== 'ALL') where.status = filters.status
        if (filters?.date) {
            const start = new Date(`${filters.date}T00:00:00.000Z`)
            const end = new Date(`${filters.date}T23:59:59.999Z`)
            where.checkInTime = { gte: start, lte: end }
        }

        const visits = await prisma.salesVisit.findMany({
            where,
            include: {
                customer: { select: { id: true, code: true, name: true, channel: true } },
                salesperson: { select: { id: true, name: true, email: true } },
            },
            orderBy: { checkInTime: 'desc' },
            take: 100,
        })

        return visits.map(v => ({
            id: v.id,
            visitNo: v.visitNo,
            customerId: v.customerId,
            customerCode: v.customer.code,
            customerName: v.customer.name,
            customerChannel: v.customer.channel,
            salespersonId: v.salespersonId,
            salespersonName: v.salesperson.name,
            status: v.status,
            purpose: v.purpose,
            checkInTime: v.checkInTime.toISOString(),
            checkInLat: v.checkInLat,
            checkInLng: v.checkInLng,
            checkInAddress: v.checkInAddress,
            checkInPhoto: v.checkInPhoto,
            checkOutTime: v.checkOutTime?.toISOString() || null,
            checkOutLat: v.checkOutLat || null,
            checkOutLng: v.checkOutLng || null,
            checkOutAddress: v.checkOutAddress || null,
            checkOutPhoto: v.checkOutPhoto || null,
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
