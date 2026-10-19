import { prisma } from '../src/lib/db'

async function standardizeHorecaParents() {
    console.log('=== START STANDARDIZE HORECA PARENT COMPANIES ===\n')

    const independentHoreca = await prisma.customer.findMany({
        where: {
            deletedAt: null,
            channel: 'HORECA',
            parentId: null,
            entityType: 'RESTAURANT',
            children: { none: { deletedAt: null } }
        },
        orderBy: { code: 'asc' }
    })

    console.log(`Found ${independentHoreca.length} independent HORECA customers to standardize:`)

    const results: any[] = []

    await prisma.$transaction(async (tx) => {
        for (const child of independentHoreca) {
            let parentCode: string
            if (child.code.startsWith('HR') && child.code.includes('-')) {
                parentCode = child.code.substring(0, child.code.lastIndexOf('-'))
            } else {
                parentCode = `${child.code}-P`
            }

            let parent = await tx.customer.findUnique({
                where: { code: parentCode }
            })

            let createdParent = false
            if (!parent) {
                parent = await tx.customer.create({
                    data: {
                        code: parentCode,
                        name: child.vatCompanyName || child.name,
                        shortName: child.shortName || null,
                        taxId: child.taxId || null,
                        vatCompanyName: child.vatCompanyName || null,
                        vatAddress: child.vatAddress || null,
                        vatEmail: child.vatEmail || null,
                        channel: child.channel,
                        paymentTerm: child.paymentTerm || 'NET30',
                        creditLimit: child.creditLimit || 0,
                        salesRepId: child.salesRepId || null,
                        status: child.status || 'ACTIVE',
                        entityType: 'COMPANY',
                        allowDirectSO: false,
                    }
                })
                createdParent = true
            }

            // Link child to parent and set child creditLimit to 0 (inherited from parent)
            await tx.customer.update({
                where: { id: child.id },
                data: {
                    parentId: parent.id,
                    creditLimit: 0,
                }
            })

            results.push({
                childCode: child.code,
                childName: child.name,
                parentCode: parent.code,
                parentName: parent.name,
                createdParent,
            })
        }
    })

    console.table(results)
    console.log(`\nSuccessfully standardized ${results.length} HORECA customers into Parent-Child hierarchy!`)

    // Verification check: ensure no independent HORECA customers remain
    const remainingIndependent = await prisma.customer.count({
        where: {
            deletedAt: null,
            channel: 'HORECA',
            parentId: null,
            entityType: 'RESTAURANT',
            children: { none: { deletedAt: null } }
        }
    })
    console.log(`Remaining independent HORECA customers: ${remainingIndependent}`)
}

standardizeHorecaParents()
    .catch((err) => {
        console.error('Migration failed:', err)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
