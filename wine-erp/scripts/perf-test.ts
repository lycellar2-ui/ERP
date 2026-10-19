import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function runPerfTest() {
    console.log('⚡ Starting Product Page Performance Audit...')
    
    // Dynamic import to ensure dotenv.config has run first
    const { prisma } = await import('../src/lib/db')
    const { getProducts, getProductStats, getProductCountries, getProducers } = await import('../src/app/dashboard/products/actions')

    // Test 1: Prisma raw connection check
    const startConn = performance.now()
    await prisma.$queryRaw`SELECT 1`
    console.log(`- Connection check: ${(performance.now() - startConn).toFixed(1)}ms`)

    // Test 2: getProducts
    const startProducts = performance.now()
    const productsRes = await getProducts({ page: 1, pageSize: 20 })
    console.log(`- getProducts (page 1, size 20): ${(performance.now() - startProducts).toFixed(1)}ms (returned ${productsRes.rows.length} rows)`)

    // Test 3: getProductStats
    const startStats = performance.now()
    const statsRes = await getProductStats()
    console.log(`- getProductStats: ${(performance.now() - startStats).toFixed(1)}ms`)

    // Test 4: getProductCountries
    const startCountries = performance.now()
    const countriesRes = await getProductCountries()
    console.log(`- getProductCountries: ${(performance.now() - startCountries).toFixed(1)}ms`)

    // Test 5: getProducers
    const startProducers = performance.now()
    const producersRes = await getProducers()
    console.log(`- getProducers: ${(performance.now() - startProducers).toFixed(1)}ms`)
    
    await prisma.$disconnect()
}

runPerfTest().catch(console.error)
