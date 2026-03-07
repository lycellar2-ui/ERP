'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { uploadFile } from '@/lib/storage'
import { cached, revalidateCache } from '@/lib/cache'
import { parseOrThrow, DeliveryRouteCreateSchema, EPODSchema, DeliveryFailureSchema, CODSyncSchema } from '@/lib/validations'

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
    const cacheKey = `delivery:routes:${page}:${pageSize}:${status ?? ''}`
    return cached(cacheKey, async () => {
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
    }) // end cached
}

export async function getDeliveryStats() {
    return cached('delivery:stats', async () => {
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
    }) // end cached
}

// ── Update route status ───────────────────────────────────
export async function updateRouteStatus(
    routeId: string,
    status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.deliveryRoute.update({ where: { id: routeId }, data: { status } })
        revalidateCache('delivery')
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
        const validated = parseOrThrow(DeliveryRouteCreateSchema, data)
        const route = await prisma.deliveryRoute.create({
            data: {
                routeDate: new Date(validated.routeDate),
                driverId: validated.driverId,
                vehicleId: validated.vehicleId,
                status: 'PLANNED',
            },
        })
        revalidateCache('delivery')
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
    signatureUrl?: string
    photoUrl?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const validated = parseOrThrow(EPODSchema, data)
        await prisma.$transaction([
            prisma.proofOfDelivery.upsert({
                where: { stopId: validated.stopId },
                create: {
                    stopId: validated.stopId,
                    confirmedBy: validated.confirmedBy,
                    notes: validated.notes,
                    signatureUrl: validated.signatureUrl,
                    photoUrl: validated.photoUrl,
                    confirmedAt: new Date(),
                },
                update: {
                    confirmedBy: validated.confirmedBy,
                    notes: validated.notes,
                    signatureUrl: validated.signatureUrl,
                    photoUrl: validated.photoUrl,
                    confirmedAt: new Date(),
                },
            }),
            prisma.deliveryStop.update({
                where: { id: validated.stopId },
                data: { status: 'DELIVERED', podSignedAt: new Date() },
            }),
        ])
        revalidateCache('delivery')
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
    signatureUrl?: string | null
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
            pod: { select: { confirmedBy: true, confirmedAt: true, notes: true, signatureUrl: true, photoUrl: true } },
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
        signatureUrl: s.pod?.signatureUrl ?? null,
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
        const validated = parseOrThrow(DeliveryFailureSchema, input)
        await prisma.deliveryStop.update({
            where: { id: validated.stopId },
            data: {
                status: 'FAILED',
                pod: {
                    upsert: {
                        create: { confirmedBy: 'SYSTEM', notes: `[Lý do: ${validated.reason}] ${validated.notes ?? ''}`.trim() },
                        update: { notes: `[Lý do: ${validated.reason}] ${validated.notes ?? ''}`.trim() }
                    }
                }
            },
        })

        const stop = await prisma.deliveryStop.findUnique({
            where: { id: validated.stopId },
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

        revalidateCache('delivery')
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
            pod: { select: { notes: true, confirmedAt: true } },
        },
        orderBy: { id: 'desc' },
        take: 50,
    })

    return stops.map(s => ({
        stopId: s.id,
        routeDate: s.route.routeDate,
        driverName: s.route.driver.name,
        customerName: s.do.so.customer.name,
        soNo: s.do.so.soNo,
        codAmount: Number(s.codAmount),
        failureReason: s.pod?.notes?.includes('[Lý do: ') ? (s.pod.notes.split(']')[0].replace('[Lý do: ', '') || 'UNKNOWN') : 'UNKNOWN',
        notes: s.pod?.notes || null,
        failedAt: s.pod?.confirmedAt ?? s.route.routeDate,
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
                pod: {
                    create: {
                        confirmedBy: 'SYSTEM',
                        notes: `Giao lại từ ${input.failedStopId.slice(-6).toUpperCase()}`,
                    }
                }
            },
        })

        // Mark original as rescheduled
        await prisma.deliveryStop.update({
            where: { id: input.failedStopId },
            data: {
                pod: {
                    upsert: {
                        create: { confirmedBy: 'SYSTEM', notes: `Đã lên lịch lại ở chuyến: ${input.newRouteId}` },
                        update: { notes: `Đã lên lịch lại ở chuyến: ${input.newRouteId}` }
                    }
                }
            },
        })

        revalidateCache('delivery')
        revalidatePath('/dashboard/delivery')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── COD → AR Payment Sync ─────────────────────────
// When driver collects COD, auto-create AR payment record
export async function syncCODToAR(input: {
    stopId: string
    codAmount: number
    collectedBy: string
    notes?: string
}): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    try {
        const validated = parseOrThrow(CODSyncSchema, input)

        const stop = await prisma.deliveryStop.findUnique({
            where: { id: validated.stopId },
            include: {
                do: {
                    select: {
                        id: true, doNo: true, soId: true,
                        so: {
                            select: {
                                id: true, soNo: true, customerId: true,
                                arInvoices: { where: { status: { not: 'PAID' } }, take: 1, orderBy: { createdAt: 'desc' } },
                            },
                        },
                    },
                },
            },
        })
        if (!stop) return { success: false, error: 'Delivery stop not found' }
        if (!stop.do?.so) return { success: false, error: 'No SO linked to this delivery' }

        const invoice = stop.do.so.arInvoices[0]
        if (!invoice) return { success: false, error: 'No outstanding AR invoice for this SO' }

        const paymentCount = await prisma.aRPayment.count()
        const paymentNo = `COD-${String(paymentCount + 1).padStart(6, '0')}`

        const payment = await prisma.aRPayment.create({
            data: {
                paymentNo,
                invoiceId: invoice.id,
                amount: validated.codAmount,
                paymentDate: new Date(),
                method: 'COD',
                reference: `COD from stop ${stop.sequence} | Driver: ${validated.collectedBy}`,
                notes: validated.notes ?? `Auto-created from COD delivery ${stop.id}`,
            },
        })

        await prisma.deliveryStop.update({
            where: { id: validated.stopId },
            data: { codCollected: true, codStatus: 'COLLECTED_CASH' },
        })

        const totalPaid = await prisma.aRPayment.aggregate({
            where: { invoiceId: invoice.id },
            _sum: { amount: true },
        })
        const paid = Number(totalPaid._sum.amount ?? 0)
        if (paid >= Number(invoice.amount)) {
            await prisma.aRInvoice.update({
                where: { id: invoice.id },
                data: { status: 'PAID' },
            })
        }

        revalidateCache('delivery')
        revalidatePath('/dashboard/delivery')
        revalidatePath('/dashboard/finance')
        return { success: true, paymentId: payment.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Upload POD Photo ──────────────────────────────
export async function uploadPODPhoto(
    stopId: string,
    formData: FormData
): Promise<{ success: boolean; photoUrl?: string; error?: string }> {
    try {
        const result = await uploadFile(formData, 'pod-photos')
        if (!result.success || !result.url) {
            return { success: false, error: result.error ?? 'Upload thất bại' }
        }

        await prisma.proofOfDelivery.upsert({
            where: { stopId },
            create: { stopId, confirmedBy: 'DRIVER', photoUrl: result.url },
            update: { photoUrl: result.url },
        })

        revalidateCache('delivery')
        revalidatePath('/dashboard/delivery')
        return { success: true, photoUrl: result.url }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Shipper Manifest — Today's route + stops for driver ──
export type ShipperManifestStop = {
    id: string
    sequence: number
    customerName: string
    address: string
    soNo: string
    itemCount: number
    codAmount: number
    status: string
    podSignedAt: Date | null
    signatureUrl: string | null
    photoUrl: string | null
    notes: string | null
}

export type ShipperManifest = {
    routeId: string
    routeDate: Date
    driverName: string
    vehiclePlate: string
    vehicleType: string
    status: string
    stops: ShipperManifestStop[]
    totalStops: number
    deliveredStops: number
    totalCod: number
    collectedCod: number
}

export async function getShipperManifest(
    driverId: string,
    date?: string
): Promise<ShipperManifest | null> {
    const targetDate = date ? new Date(date) : new Date()
    targetDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    const route = await prisma.deliveryRoute.findFirst({
        where: {
            driverId,
            routeDate: { gte: targetDate, lt: nextDay },
            status: { not: 'CANCELLED' },
        },
        include: {
            driver: { select: { name: true } },
            vehicle: { select: { plateNo: true, type: true } },
            stops: {
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
                    pod: { select: { signatureUrl: true, photoUrl: true, notes: true } },
                },
                orderBy: { sequence: 'asc' },
            },
        },
        orderBy: { createdAt: 'desc' },
    })

    if (!route) return null

    const stops: ShipperManifestStop[] = route.stops.map((s, i) => ({
        id: s.id,
        sequence: s.sequence ?? i + 1,
        customerName: s.do.so.customer.name,
        address: s.address,
        soNo: s.do.so.soNo,
        itemCount: s.do.so.lines.length,
        codAmount: Number(s.codAmount),
        status: s.status,
        podSignedAt: s.podSignedAt,
        signatureUrl: s.pod?.signatureUrl ?? null,
        photoUrl: s.pod?.photoUrl ?? null,
        notes: s.pod?.notes ?? null,
    }))

    return {
        routeId: route.id,
        routeDate: route.routeDate,
        driverName: route.driver.name,
        vehiclePlate: route.vehicle.plateNo,
        vehicleType: route.vehicle.type,
        status: route.status,
        stops,
        totalStops: stops.length,
        deliveredStops: stops.filter(s => s.status === 'DELIVERED').length,
        totalCod: stops.reduce((sum, s) => sum + s.codAmount, 0),
        collectedCod: stops.filter(s => s.status === 'DELIVERED').reduce((sum, s) => sum + s.codAmount, 0),
    }
}

// ── Get All Drivers (for shipper select) ──────────
export async function getActiveDrivers(): Promise<{ id: string; name: string; phone: string }[]> {
    return prisma.driver.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, phone: true },
        orderBy: { name: 'asc' },
    })
}
