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
            percent: progress.progressPercent
        } : null)

        expect(progress).not.toBeNull()
        expect(progress?.totalProducts).toBeGreaterThanOrEqual(0)
    })
})
