import { describe, it, expect } from 'vitest'
import { getWarehouseOptions, getCycleCountProgress } from '../src/app/dashboard/stock-count/actions'

describe('Cycle Count Actions', () => {
    it('returns warehouse options and cycle progress for warehouse', async () => {
        const warehouses = await getWarehouseOptions()
        console.log('Warehouses count:', warehouses.length)
        expect(warehouses.length).toBeGreaterThan(0)

        const wh = warehouses[0]
        console.log('Testing warehouse:', wh.name, wh.id)

        const progress = await getCycleCountProgress(wh.id, 7)
        console.log('Cycle progress result:', progress ? {
            whName: progress.warehouseName,
            totalProducts: progress.totalProducts,
            uncountedCount: progress.uncountedProductCount,
            countedCount: progress.countedProductCount,
            percent: progress.progressPercent,
            daysWindow: progress.daysWindow
        } : null)

        expect(progress).not.toBeNull()
        expect(progress?.totalProducts).toBeGreaterThanOrEqual(0)
    }, 30000)

    it('supports custom date range calculation', async () => {
        const warehouses = await getWarehouseOptions()
        const wh = warehouses[0]

        const fromDateStr = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
        const toDateStr = new Date().toISOString().slice(0, 10)

        const customProgress = await getCycleCountProgress(wh.id, 14, fromDateStr, toDateStr)
        expect(customProgress).not.toBeNull()
        expect(customProgress?.dateFrom).toBeDefined()
        expect(customProgress?.dateTo).toBeDefined()
        expect(customProgress?.daysWindow).toBeGreaterThanOrEqual(13)
        console.log('Custom date range progress:', {
            dateFrom: customProgress?.dateFrom,
            dateTo: customProgress?.dateTo,
            days: customProgress?.daysWindow,
            recentSessions: customProgress?.recentSessions.length
        })
    }, 30000)
})
