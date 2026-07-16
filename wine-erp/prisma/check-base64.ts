import * as dotenv from 'dotenv'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
dotenv.config({ path: '.env.local' })

async function test() {
    const { prisma } = await import('../src/lib/db')
    const media = await prisma.productMedia.findFirst({
        where: { url: { startsWith: 'data:image/' } }
    })
    
    if (media) {
        console.log('--- FOUND BASE64 MEDIA IN DATABASE! ---')
        console.log('ID:', media.id)
        console.log('URL length:', media.url.length, 'characters')
        console.log('Start of URL:', media.url.substring(0, 100))
    } else {
        console.log('No base64 data:image/ found. Checking first media urls:')
        const list = await prisma.productMedia.findMany({ take: 5 })
        for (const m of list) {
            console.log(`Media ${m.id} URL length: ${m.url.length}, value: ${m.url.substring(0, 80)}...`)
        }
    }
}

test()
    .catch(console.error)
    .finally(async () => {
        const { prisma } = await import('../src/lib/db')
        await prisma.$disconnect()
    })
