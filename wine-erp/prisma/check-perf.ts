import * as dotenv from 'dotenv'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
dotenv.config({ path: '.env.local' })

async function test() {
    console.log('--- Measuring sales page queries ---')
    const { getSalesOrders, getSalesStats, getSOStatusCounts } = await import('../src/app/dashboard/sales/actions')
    
    console.time('getSalesOrders')
    const orders = await getSalesOrders({ page: 1, pageSize: 20 })
    console.timeEnd('getSalesOrders')
    console.log('Orders count in list:', orders.rows.length, 'Total:', orders.total)

    console.time('getSalesStats')
    const stats = await getSalesStats()
    console.timeEnd('getSalesStats')
    console.log('Stats:', stats)

    console.time('getSOStatusCounts')
    const statusCounts = await getSOStatusCounts()
    console.timeEnd('getSOStatusCounts')
    console.log('Status counts:', statusCounts)
}

test().catch(console.error)
