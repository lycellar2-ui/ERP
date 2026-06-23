import * as dotenv from 'dotenv'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
dotenv.config({ path: '.env.local' })

async function test() {
    console.log('--- Measuring Products page queries ---')
    const { getProducts, getProductStats, getProductCountries, getProductVintages, getProducers } = await import('../src/app/dashboard/products/actions')

    for (let i = 1; i <= 3; i++) {
        console.log(`\n--- Iteration ${i} ---`)
        
        const t0 = performance.now()
        await getProducts({ page: 1, pageSize: 20 })
        const t1 = performance.now()
        console.log(`getProducts: ${(t1 - t0).toFixed(1)}ms`)

        const t2 = performance.now()
        await getProductStats()
        const t3 = performance.now()
        console.log(`getProductStats: ${(t3 - t2).toFixed(1)}ms`)

        const t4 = performance.now()
        await getProductCountries()
        const t5 = performance.now()
        console.log(`getProductCountries: ${(t5 - t4).toFixed(1)}ms`)

        const t6 = performance.now()
        await getProductVintages()
        const t7 = performance.now()
        console.log(`getProductVintages: ${(t7 - t6).toFixed(1)}ms`)

        const t8 = performance.now()
        await getProducers()
        const t9 = performance.now()
        console.log(`getProducers: ${(t9 - t8).toFixed(1)}ms`)
    }
}

test().catch(console.error)
