'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export interface DeliveryRouteRow {
    id: string
    routeDate: Date
    driverName: string
    vehiclePlate: string
    vehicleType: string
    stopCount: number
    deliveredCount: number
    status: string
    totalCod: number
    createdAt: Date
}

export interface DriverOption { id: string; name: string; phone: string }
export interface VehicleOption { id: string; plateNo: string; type: string }

export async function getDeliveryRoutes(filters: {
    status?: string
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: DeliveryRouteRow[]; total: number }> {
    const { status, page = 1, pageSize = 20 } = filters
    const skip = (page - 1) * pageSize

    const where: any = {}
    if (status) where.status = status

    const [routes, total] = await Promise.all([
        prisma.deliveryRoute.findMany({
            where, skip, take: pageSize,
            orderBy: { routeDate: 'desc' },
            include: {
                driver: { select: { name: true } },
                vehicle: { select: { plateNo: true, type: true } },
                stops: { select: { id: true, status: true, codAmount: true } },
            },
        }),
        prisma.deliveryRoute.count({ where }),
    ])

    return {
        rows: routes.map(r => ({
            id: r.id,
            routeDate: r.routeDate,
            driverName: r.driver.name,
            vehiclePlate: r.vehicle.plateNo,
            vehicleType: r.vehicle.type,
            stopCount: r.stops.length,
            deliveredCount: r.stops.filter(s => s.status === 'DELIVERED').length,
            status: r.status,
            totalCod: r.stops.reduce((sum, s) => sum + Number(s.codAmount), 0),
            createdAt: r.createdAt,
        })),
        total,
    }
}

export async function getDeliveryStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [todayRoutes, pending, delivered, inProgress] = await Promise.all([
        prisma.deliveryRoute.count({ where: { routeDate: { gte: today, lt: tomorrow } } }),
        prisma.deliveryStop.count({ where: { status: 'PENDING' } }),
        prisma.deliveryStop.count({ where: { status: 'DELIVERED' } }),
        prisma.deliveryRoute.count({ where: { status: 'IN_PROGRESS' } }),
    ])

    return { todayRoutes, pending, delivered, inProgress }
}

// ── Update route status ───────────────────────────────────
export async function updateRouteStatus(
    routeId: string,
    status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.deliveryRoute.update({ where: { id: routeId }, data: { status } })
        revalidatePath('/dashboard/delivery')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Get drivers & vehicles for create form ────────────────
export async function getDriversAndVehicles(): Promise<{
    drivers: DriverOption[]
    vehicles: VehicleOption[]
}> {
    const [drivers, vehicles] = await Promise.all([
        prisma.driver.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true, phone: true } }),
        prisma.vehicle.findMany({ where: { status: 'ACTIVE' }, select: { id: true, plateNo: true, type: true } }),
    ])
    return { drivers, vehicles }
}

// ── Create delivery route ─────────────────────────────────
export async function createDeliveryRoute(data: {
    routeDate: string
    driverId: string
    vehicleId: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const route = await prisma.deliveryRoute.create({
            data: {
                routeDate: new Date(data.routeDate),
                driverId: data.driverId,
                vehicleId: data.vehicleId,
                status: 'PLANNED',
            },
        })
        revalidatePath('/dashboard/delivery')
        return { success: true, id: route.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Record E-POD (Proof of Delivery) ─────────────────────
export async function recordEPOD(data: {
    stopId: string
    confirmedBy: string
    notes?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.$transaction([
            prisma.proofOfDelivery.upsert({
                where: { stopId: data.stopId },
                create: {
                    stopId: data.stopId,
                    confirmedBy: data.confirmedBy,
                    notes: data.notes,
                    confirmedAt: new Date(),
                },
                update: {
                    confirmedBy: data.confirmedBy,
                    notes: data.notes,
                    confirmedAt: new Date(),
                },
            }),
            prisma.deliveryStop.update({
                where: { id: data.stopId },
                data: { status: 'DELIVERED', podSignedAt: new Date() },
            }),
        ])
        revalidatePath('/dashboard/delivery')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Get Route Stops for E-POD ────────────────────────────
export interface RouteStopRow {
    id: string
    sequence: number
    customerName: string
    customerAddress: string
    soNo: string
    status: string
    codAmount: number
    podSignedAt: Date | null
    notes: string | null
    itemCount: number
}

export async function getRouteStops(routeId: string): Promise<RouteStopRow[]> {
    const stops = await prisma.deliveryStop.findMany({
        where: { routeId },
        include: {
            do: {
                include: {
                    so: {
                        select: {
                            soNo: true,
                            customer: { select: { name: true } },
                            lines: { select: { id: true } },
                        },
                    },
                },
            },
            pod: { select: { confirmedBy: true, confirmedAt: true, notes: true } },
        },
        orderBy: { sequence: 'asc' },
    })

    return stops.map((s, i) => ({
        id: s.id,
        sequence: s.sequence ?? i + 1,
        customerName: s.do.so.customer.name,
        customerAddress: s.address,
        soNo: s.do.so.soNo,
        status: s.status,
        codAmount: Number(s.codAmount),
        podSignedAt: s.podSignedAt,
        notes: s.pod?.notes ?? null,
        itemCount: s.do.so.lines.length,
    }))
}

// ── Record Delivery Failure (Reverse Logistics) ───
export async function recordDeliveryFailure(input: {
    stopId: string
    reason: 'CUSTOMER_ABSENT' | 'WRONG_ADDRESS' | 'REFUSED' | 'DAMAGED' | 'OTHER'
    notes?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.deliveryStop.update({
            where: { id: input.stopId },
            data: {
                status: 'FAILED',
                failureReason: input.reason,
                notes: input.notes ?? null,
            },
        })

        // Check if all stops in the route are done
        const stop = await prisma.deliveryStop.findUnique({
            where: { id: input.stopId },
            select: { routeId: true },
        })
        if (stop) {
            const remainingPending = await prisma.deliveryStop.count({
                where: { routeId: stop.routeId, status: 'PENDING' },
            })
            if (remainingPending === 0) {
                await prisma.deliveryRoute.update({
                    where: { id: stop.routeId },
                    data: { status: 'COMPLETED' },
                })
            }
        }

        revalidatePath('/dashboard/delivery')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Get Failed Deliveries ─────────────────────────
export type FailedDeliveryRow = {
    stopId: string
    routeDate: Date
    driverName: string
    customerName: string
    soNo: string
    codAmount: number
    failureReason: string
    notes: string | null
    failedAt: Date
}

export async function getFailedDeliveries(): Promise<FailedDeliveryRow[]> {
    const stops = await prisma.deliveryStop.findMany({
        where: { status: 'FAILED' },
        include: {
            route: {
                select: { routeDate: true, driver: { select: { name: true } } },
            },
            do: {
                select: {
                    so: { select: { soNo: true, customer: { select: { name: true } } } },
                },
            },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
    })

    return stops.map(s => ({
        stopId: s.id,
        routeDate: s.route.routeDate,
        driverName: s.route.driver.name,
        customerName: s.do.so.customer.name,
        soNo: s.do.so.soNo,
        codAmount: Number(s.codAmount),
        failureReason: s.failureReason ?? 'UNKNOWN',
        notes: s.notes,
        failedAt: s.updatedAt,
    }))
}

// ── Schedule Redelivery ───────────────────────────
export async function scheduleRedelivery(input: {
    failedStopId: string
    newRouteId: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const failedStop = await prisma.deliveryStop.findUnique({
            where: { id: input.failedStopId },
            include: {
                route: { select: { id: true } },
            },
        })
        if (!failedStop) return { success: false, error: 'Không tìm thấy điểm giao thất bại' }
        if (failedStop.status !== 'FAILED') return { success: false, error: 'Điểm giao không ở trạng thái FAILED' }

        // Get highest sequence in new route
        const maxSeq = await prisma.deliveryStop.aggregate({
            where: { routeId: input.newRouteId },
            _max: { sequence: true },
        })

        // Create new stop on the new route
        await prisma.deliveryStop.create({
            data: {
                routeId: input.newRouteId,
                doId: failedStop.doId,
                address: failedStop.address,
                sequence: (maxSeq._max.sequence ?? 0) + 1,
                codAmount: failedStop.codAmount,
                status: 'PENDING',
                notes: `Giao lại từ ${input.failedStopId.slice(-6).toUpperCase()}`,
            },
        })

        // Mark original as rescheduled
        await prisma.deliveryStop.update({
            where: { id: input.failedStopId },
            data: { status: 'RESCHEDULED' },
        })

        revalidatePath('/dashboard/delivery')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

