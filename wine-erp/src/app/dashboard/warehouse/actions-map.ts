'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getCurrentUser, hasRole } from '@/lib/session'
import { cached } from '@/lib/cache'
import { serialize } from '@/lib/serialize'

// ═══════════════════════════════════════════════════
// 2D WAREHOUSE MAP — Visual layout management
// ═══════════════════════════════════════════════════

export interface MapLocation {
    id: string
    locationCode: string
    zone: string
    rack: string | null
    bin: string | null
    type: string
    capacityCases: number | null
    tempControlled: boolean
    posX: number
    posY: number
    width: number
    height: number
    // Stock data
    stockCount: number
    totalQty: number
    occupancyPct: number
    products: {
        skuCode: string
        productName: string
        qtyAvailable: number
        status: string
    }[]
}

export interface MapWarehouse {
    id: string
    code: string
    name: string
    address: string | null
    locations: MapLocation[]
}

// ── Get warehouse map data ────────────────────────
export async function getWarehouseMapData(warehouseId: string): Promise<MapWarehouse | null> {
    return cached(`warehouse-map:${warehouseId}`, async () => {
        const warehouse = await prisma.warehouse.findUnique({
            where: { id: warehouseId },
            include: {
                locations: {
                    include: {
                        stockLots: {
                            where: { status: { in: ['AVAILABLE', 'RESERVED', 'QUARANTINE'] } },
                            select: {
                                id: true,
                                qtyAvailable: true,
                                status: true,
                                product: {
                                    select: { skuCode: true, productName: true },
                                },
                            },
                        },
                    },
                    orderBy: [{ zone: 'asc' }, { rack: 'asc' }, { bin: 'asc' }],
                },
            },
        })

        if (!warehouse) return null

        return serialize({
            id: warehouse.id,
            code: warehouse.code,
            name: warehouse.name,
            address: warehouse.address,
            locations: warehouse.locations.map(loc => {
                const totalQty = loc.stockLots.reduce((sum, lot) => sum + Number(lot.qtyAvailable), 0)
                const capacity = loc.capacityCases ? loc.capacityCases * 12 : 500 // default 500 bottles if no capacity set
                const occupancyPct = Math.min(100, Math.round((totalQty / capacity) * 100))

                return {
                    id: loc.id,
                    locationCode: loc.locationCode,
                    zone: loc.zone,
                    rack: loc.rack,
                    bin: loc.bin,
                    type: loc.type,
                    capacityCases: loc.capacityCases,
                    tempControlled: loc.tempControlled,
                    posX: loc.posX ?? 0,
                    posY: loc.posY ?? 0,
                    width: loc.width ?? 80,
                    height: loc.height ?? 60,
                    stockCount: loc.stockLots.length,
                    totalQty,
                    occupancyPct,
                    products: loc.stockLots.map(lot => ({
                        skuCode: lot.product.skuCode,
                        productName: lot.product.productName,
                        qtyAvailable: Number(lot.qtyAvailable),
                        status: lot.status,
                    })),
                }
            }),
        })
    }, 30_000)
}

// ── Update single location position (admin only) ──
export async function updateLocationPosition(
    locationId: string,
    update: { posX: number; posY: number; width?: number; height?: number }
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user || !hasRole(user, 'CEO', 'THU_KHO')) {
            return { success: false, error: 'Chỉ Admin/Thủ kho mới được chỉnh sửa sơ đồ kho' }
        }

        await prisma.location.update({
            where: { id: locationId },
            data: {
                posX: update.posX,
                posY: update.posY,
                ...(update.width !== undefined ? { width: update.width } : {}),
                ...(update.height !== undefined ? { height: update.height } : {}),
            },
        })

        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Batch save layout positions (admin only) ──────
export async function saveWarehouseLayout(
    warehouseId: string,
    layouts: { id: string; posX: number; posY: number; width: number; height: number }[]
): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
    try {
        const user = await getCurrentUser()
        if (!user || !hasRole(user, 'CEO', 'THU_KHO')) {
            return { success: false, error: 'Chỉ Admin/Thủ kho mới được chỉnh sửa sơ đồ kho' }
        }

        // Verify all locations belong to this warehouse
        const locationIds = layouts.map(l => l.id)
        const locCount = await prisma.location.count({
            where: {
                id: { in: locationIds },
                warehouseId,
            },
        })

        if (locCount !== locationIds.length) {
            return { success: false, error: 'Một số vị trí không thuộc kho này' }
        }

        // Batch update using transaction
        await prisma.$transaction(
            layouts.map(l =>
                prisma.location.update({
                    where: { id: l.id },
                    data: {
                        posX: l.posX,
                        posY: l.posY,
                        width: l.width,
                        height: l.height,
                    },
                })
            )
        )

        revalidatePath('/dashboard/warehouse')
        return { success: true, updatedCount: layouts.length }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Auto-layout: arrange locations in grid ────────
export async function autoLayoutWarehouse(
    warehouseId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user || !hasRole(user, 'CEO', 'THU_KHO')) {
            return { success: false, error: 'Chỉ Admin/Thủ kho mới được chỉnh sửa sơ đồ kho' }
        }

        const locations = await prisma.location.findMany({
            where: { warehouseId },
            orderBy: [{ zone: 'asc' }, { rack: 'asc' }, { bin: 'asc' }],
        })

        if (locations.length === 0) return { success: true }

        // Group by zone
        const zones: Record<string, typeof locations> = {}
        for (const loc of locations) {
            if (!zones[loc.zone]) zones[loc.zone] = []
            zones[loc.zone].push(loc)
        }

        const PADDING = 20
        const LOC_W = 90
        const LOC_H = 65
        const GAP = 12
        const ZONE_GAP = 40
        const ZONE_HEADER = 35
        const COLS_PER_ZONE = 6

        let zoneY = PADDING
        const updates: { id: string; posX: number; posY: number; width: number; height: number }[] = []

        for (const [, zoneLocs] of Object.entries(zones)) {
            const rows = Math.ceil(zoneLocs.length / COLS_PER_ZONE)

            for (let i = 0; i < zoneLocs.length; i++) {
                const col = i % COLS_PER_ZONE
                const row = Math.floor(i / COLS_PER_ZONE)
                updates.push({
                    id: zoneLocs[i].id,
                    posX: PADDING + col * (LOC_W + GAP),
                    posY: zoneY + ZONE_HEADER + row * (LOC_H + GAP),
                    width: LOC_W,
                    height: LOC_H,
                })
            }

            zoneY += ZONE_HEADER + rows * (LOC_H + GAP) + ZONE_GAP
        }

        await prisma.$transaction(
            updates.map(u =>
                prisma.location.update({
                    where: { id: u.id },
                    data: { posX: u.posX, posY: u.posY, width: u.width, height: u.height },
                })
            )
        )

        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Search product stock locations for map highlight ──
export async function searchProductLocations(
    warehouseId: string,
    searchTerm: string
): Promise<{
    productName: string
    skuCode: string
    totalQty: number
    locationIds: string[]
}[]> {
    if (!searchTerm || searchTerm.length < 2) return []

    const lots = await prisma.stockLot.findMany({
        where: {
            location: { warehouseId },
            status: { in: ['AVAILABLE', 'RESERVED'] },
            qtyAvailable: { gt: 0 },
            OR: [
                { product: { skuCode: { contains: searchTerm, mode: 'insensitive' } } },
                { product: { productName: { contains: searchTerm, mode: 'insensitive' } } },
            ],
        },
        select: {
            locationId: true,
            qtyAvailable: true,
            product: { select: { skuCode: true, productName: true } },
        },
    })

    // Group by product
    const map = new Map<string, { productName: string; skuCode: string; totalQty: number; locationIds: Set<string> }>()
    for (const lot of lots) {
        const key = lot.product.skuCode
        if (!map.has(key)) {
            map.set(key, {
                productName: lot.product.productName,
                skuCode: lot.product.skuCode,
                totalQty: 0,
                locationIds: new Set(),
            })
        }
        const entry = map.get(key)!
        entry.totalQty += Number(lot.qtyAvailable)
        entry.locationIds.add(lot.locationId)
    }

    return Array.from(map.values()).map(v => ({
        ...v,
        locationIds: Array.from(v.locationIds),
    }))
}
