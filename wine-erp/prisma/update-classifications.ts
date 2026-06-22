import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 3,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Exact mappings of product IDs to their true, premium classifications
const CLASSIFICATION_UPDATES: Record<string, string> = {
    // France
    'cmpqd16n5004o1klquviunsfm': 'IGP Pays d\'Oc',
    'cmpqd16rn004r1klqu6hva483': 'AOC Montagne-Saint-Émilion',
    'cmpqd14jr00351klql486k2gz': 'Saint-Émilion Grand Cru',
    'cmpqd12qn001r1klqycqwt8um': 'Bordeaux AOC',
    'cmpqd12t5001t1klqxqaqrj9t': 'Bordeaux AOC',
    'cmpqd12uf001u1klqghrlo9ks': 'IGP Pays d\'Oc',
    'cmpqd12wy001w1klqeqkxe5ol': 'Bordeaux Supérieur AOC',
    'cmpqd12zg001y1klqaoimej9d': 'Saint-Julien AOC',
    'cmpqd130r001z1klqrg1skw5g': 'Vin de France',
    'cmpqd133g00211klqvs9i7pdx': 'Vin de France',
    'cmpqd132500201klqjj7p6g00': 'Vin de France',
    'cmpqd136d00231klq8y1psqvc': 'Alsace AOC',
    'cmpqd137p00241klq7dakd6kn': 'Alsace AOC',
    'cmpqd139300251klqis6l3ww1': 'Alsace AOC',
    'cmpqd13ac00261klquslp1ixd': 'Alsace AOC',
    'cmpqd13d200281klqpcp799mt': 'Alsace AOC',
    'cmpqd13jt002d1klqle09uxem': 'Côtes du Rhône AOC',
    'cmpqd13l4002e1klqncqrnf54': 'Côtes du Rhône AOC',
    'cmpqd13nn002g1klq4bzcl9vs': 'Gigondas AOC',
    'cmpqd13q9002i1klqo5vbqb1l': 'Châteauneuf-du-Pape AOC',
    'cmpqd13rk002j1klqtsbvrpsn': 'Châteauneuf-du-Pape AOC',
    'cmpqd13z7002p1klqvt27ees2': 'Chiroubles AOC',
    'cmpqd144c002t1klqq3pr8s4f': 'Brouilly AOC',
    'cmpqd149n002x1klq4sf2ixe6': 'Beaujolais AOC',

    // Italy
    'cmpqd18dq00601klq0unalz9u': 'Benaco Bresciano IGT',
    'cmpqd11nr000x1klq9fd3t6ep': 'Venezia Giulia IGT',
    'cmpqd11vl00131klq9m2g5wut': 'Veneto IGT',
    'cmpqd11ud00121klq2rqk5wc5': 'Veneto IGT',
    'cmpqd12k7001m1klqtlqo83u1': 'Veneto IGT',
    'cmpqd12lj001n1klqae12olr5': 'Veneto IGT',
    'cmpqd10zq000i1klq9zt383sd': 'Prosecco DOC',
    'cmpqd10y7000h1klqvh8ejcfj': 'Prosecco DOC',
    'cmpqd10vh000f1klqsnuc63k3': 'Rosso Veneto IGT',
    'cmpqd10u4000e1klq4yu4acqe': 'delle Venezie DOC',
    'cmpqd10sm000d1klq6gphv8pl': 'Valpolicella DOC',
    'cmpqd10on000a1klq48og7pvy': 'Valpolicella Ripasso DOC',
    'cmpqd10j300061klqufhzbd9r': 'Valpolicella Ripasso DOC',
    'cmpqd10el00031klqaj4pjihl': 'Amarone della Valpolicella DOCG',
    'cmpqd10na00091klqbfytq7fu': 'Amarone della Valpolicella DOCG',
    'cmpqd10lu00081klq41kwyc6s': 'Valpolicella Superiore DOC',

    // New Zealand
    'cmpqd184m005t1klq9keeo5cy': 'Marlborough GI',
    'cmpqd188h005w1klqx79b2ayi': 'Marlborough GI',
    'cmpqd185v005u1klqwz6sr4fw': 'Marlborough GI',
    'cmpqd1875005v1klql39vniud': 'Marlborough GI',
}

async function main() {
    console.log('--- STARTING CLASSIFICATION UPDATE ---')
    let successCount = 0

    for (const [id, classification] of Object.entries(CLASSIFICATION_UPDATES)) {
        try {
            const updated = await prisma.product.updateMany({
                where: { id },
                data: { classification },
            })
            if (updated.count > 0) {
                console.log(`Successfully updated product [${id}] to classification: "${classification}"`)
                successCount++
            } else {
                console.log(`Warning: Product [${id}] not found or already has that classification.`)
            }
        } catch (err: any) {
            console.error(`Failed to update product [${id}]:`, err.message)
        }
    }

    console.log(`--- UPDATE FINISHED: ${successCount} products updated successfully ---`)
}

main().catch(console.error).finally(() => pool.end())
