import { prisma } from './src/lib/db'
import { getCustomerResolvedPrices } from './src/app/dashboard/price-list/customer-rules-actions'

async function main() {
    const customer = await prisma.customer.findFirst({ where: { code: 'HR10114-01' } })
    if (!customer) return console.log('Customer not found')

    console.log('Testing getCustomerResolvedPrices for:', customer.name, customer.id)
    const resolved = await getCustomerResolvedPrices(customer.id)
    
    const resolvedEntries = Object.entries(resolved)
    console.log(`Total resolved entries: ${resolvedEntries.length}`)

    const withPrices = resolvedEntries.filter(([_, res]) => res.price > 0)
    console.log(`Entries with price > 0: ${withPrices.length}`)

    const fixedDiscounts = resolvedEntries.filter(([_, res]) => res.source === 'FIXED_DISCOUNT')
    console.log(`Entries with source FIXED_DISCOUNT: ${fixedDiscounts.length}`)

    console.log('Sample FIXED_DISCOUNT results:', fixedDiscounts.slice(0, 5))
}

main().catch(console.error).finally(() => prisma.$disconnect())
