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

// High-end, realistic, professional, concise Sommelier's tasting notes dictionary (around 15-25 words each, in elegant English)
const WINE_NOTE_TEMPLATES: { pattern: RegExp; note: string }[] = [
    {
        pattern: /Amarone/i,
        note: "Intense aromas of ripe black cherry, plum, and cocoa, followed by a velvety palate with sweet tannins and a long, warm, luxurious finish."
    },
    {
        pattern: /Ripasso/i,
        note: "Offers dark berry aromas with hints of spice and leather. Full-bodied, smooth, and displaying elegant structure with rich cherry flavors."
    },
    {
        pattern: /Prosecco.*Ros/i,
        note: "Delightfully fresh with fine bubbles, offering elegant notes of wild strawberry, redcurrant, and subtle rose petals with a crisp finish."
    },
    {
        pattern: /Prosecco/i,
        note: "Crisp and fresh with lively bubbles, showing elegant notes of green apple, white peach, and subtle acacia blossoms."
    },
    {
        pattern: /Chardonnay/i,
        note: "Elegant and balanced with aromas of golden apple and stone fruit, subtle vanilla oak integration, and a crisp, mineral-driven finish."
    },
    {
        pattern: /Sauvignon.*Blanc/i,
        note: "Vibrant and intensely aromatic, expressing notes of passionfruit, ripe gooseberry, and fresh cut grass, backed by crisp, clean acidity."
    },
    {
        pattern: /Pinot.*Noir/i,
        note: "Graceful aromas of wild strawberry, red cherry, and earthy forest floor. Medium-bodied with fine-grained tannins and elegant acidity."
    },
    {
        pattern: /Nero.*d'Avola/i,
        note: "Bold and expressive, featuring rich dark plum, wild blackberry, and sweet spices, leading to a smooth, warm, and lingering finish."
    },
    {
        pattern: /Bordeaux.*Rouge/i,
        note: "Classic and structured with aromas of blackcurrant, cedar wood, and graphite, offering firm tannins and a refined, elegant finish."
    },
    {
        pattern: /Bordeaux.*Blanc/i,
        note: "Refreshing and bright, showcasing aromas of citrus zest, white flowers, and flinty minerality, supported by vibrant, balanced acidity."
    },
    {
        pattern: /Riesling/i,
        note: "Aromatic and mineral-forward, with bright notes of lime zest, green apple, and white flowers, balanced by crisp, electric acidity."
    },
    {
        pattern: /Gewurztraminer/i,
        note: "Highly aromatic and exotic, bursting with lychees, rose petals, and sweet baking spices. Rich on the palate with a clean, floral finish."
    },
    {
        pattern: /Pinot.*Gris/i,
        note: "Elegant and rich, presenting aromas of ripe pear, honeyed yellow apple, and white flowers, with a textured, mineral finish."
    },
    {
        pattern: /Pinot.*Blanc/i,
        note: "Delicate and refreshing, with charming aromas of white peach, citrus blossom, and wet stone, offering a clean, balanced palate."
    },
    {
        pattern: /Cotes.*Rhone/i,
        note: "Approachable and savory with dark cherry, lavender, and garrigue spice aromas. Smooth and fleshy on the palate with soft, round tannins."
    },
    {
        pattern: /Gigondas/i,
        note: "Powerful and concentrated, expressing dark raspberry, liquorice, and black pepper. Structured, rich, and built for elegant aging."
    },
    {
        pattern: /Chateauneuf.*Pape/i,
        note: "Opulent and complex, showing rich blackberry, leather, wild thyme, and sweet spices. Full-bodied, velvety, and deeply lingering."
    },
    {
        pattern: /Ribolla.*Gialla/i,
        note: "Bright and refreshing with notes of citrus zest, green pear, and saline minerality, offering a clean, mouth-watering finish."
    },
    {
        pattern: /Brouilly/i,
        note: "Vibrant and aromatic, bursting with fresh red cherry, wild raspberry, and soft violet notes. Juicy, fresh, and beautifully balanced."
    },
    {
        pattern: /Chiroubles/i,
        note: "The most delicate of Cru Beaujolais, expressing fine aromas of redcurrant, peony flower, and granite mineral tones. Wonderfully silky."
    },
    {
        pattern: /Beaujolais/i,
        note: "Fresh and vibrant, bursting with red cherry, raspberry, and delicate violet aromas. Soft, juicy, and beautifully refreshing."
    },
    {
        pattern: /Lugana/i,
        note: "Crisp, mineral-driven white showing aromas of lemon zest, green almond, and white peach, with a lively, refreshing finish."
    },
    {
        pattern: /Soave/i,
        note: "Elegant and crisp, featuring aromas of white flower, melon, and almonds, with a distinct, flinty mineral finish."
    },
    {
        pattern: /Etna.*Rosso/i,
        note: "Earthy and mineral-focused, showing wild red berries, orange peel, and ash tones from the volcanic soil. Very elegant and structured."
    },
    {
        pattern: /Etna.*Bianco/i,
        note: "Superb mineral white from volcanic soils, offering aromas of lemon leaf, green pear, saline crushed rocks, and bright, dry acidity."
    },
    {
        pattern: /Grillo/i,
        note: "Sunny and refreshing, bursting with citrus blossom, white peach, and subtle herbal notes, backed by crisp, saline acidity."
    },
    {
        pattern: /Cabernet/i,
        note: "Structured and bold with aromas of cassis, sweet spices, and dark tobacco, leading to a rich palate with fine-grained tannins."
    },
    {
        pattern: /Zingari/i,
        note: "A charming Tuscan blend, offering fragrant aromas of red cherry, plum, and rosemary, with a smooth, approachable body."
    },
    {
        pattern: /Hebo/i,
        note: "Rich and structured Tuscan red, showing blackcurrant, wild violet, and cedar spice, with firm tannins and elegant mineral freshness."
    },
    {
        pattern: /Benuara/i,
        note: "Deep and aromatic Sicilian red, expressing dark cherry, wild herbs, and sweet tobacco, with a velvety texture and spicy finish."
    },
    {
        pattern: /Ronchedone/i,
        note: "Rich and opulent, displaying ripe black cherry, blueberry, and balsamic notes, with a powerful yet silky and well-integrated palate."
    }
]

// Dynamic backup generator based on wine properties
function generateFallbackNote(productName: string, wineType: string, country: string): string {
    const isRed = wineType === 'RED'
    const isWhite = wineType === 'WHITE'
    const isRose = wineType === 'ROSE'
    const isSparkling = wineType === 'SPARKLING'

    if (isRed) {
        if (country === 'IT') {
            return "Elegant Italian red showing classic aromas of sour red cherry, dried herbs, and earth. Medium-bodied with fine tannins and bright acidity."
        } else if (country === 'FR') {
            return "Refined French red expressing dark berries, cedar wood, and subtle spices. Well-structured with fine-grained tannins and a balanced finish."
        } else {
            return "Vibrant red wine presenting aromas of fresh blackberry, dark plum, and delicate spices, with a smooth and approachable palate."
        }
    } else if (isWhite) {
        if (country === 'NZ') {
            return "Expressive Marlborough white bursting with passionfruit, ripe gooseberry, and citrus blossom, showing signature crisp and refreshing acidity."
        } else if (country === 'FR') {
            return "Elegant French white displaying aromas of green apple, wet stone minerality, and white peach, with crisp and balanced acidity."
        } else {
            return "Crisp and refreshing white wine with bright aromas of citrus blossom, white pear, and mineral undertones, leading to a clean finish."
        }
    } else if (isRose) {
        return "Delightfully fresh rosé presenting fragrant aromas of wild strawberry, watermelon, and white blossoms, with a crisp, refreshing finish."
    } else if (isSparkling) {
        return "Lively and celebratory sparkling wine with fine bubbles, showing charming aromas of green apple, citrus, and toasted brioche notes."
    }

    return "Elegant and well-balanced wine showcasing expressive varietal characters, rich fruit aromas, and a clean, satisfying finish."
}

async function main() {
    const products = await prisma.product.findMany({
        where: { deletedAt: null }
    })

    console.log(`Starting to populate tasting notes for ${products.length} products...`)
    let updatedCount = 0

    for (const p of products) {
        // Find matching template note
        let note = ""
        for (const t of WINE_NOTE_TEMPLATES) {
            if (t.pattern.test(p.productName)) {
                note = t.note
                break
            }
        }

        // If no match, generate elegant fallback note
        if (!note) {
            note = generateFallbackNote(p.productName, p.wineType, p.country)
        }

        // Update product tastingNotes field
        await prisma.product.update({
            where: { id: p.id },
            data: { tastingNotes: note }
        })

        console.log(`Updated [${p.skuCode}]: "${p.productName.trim()}"`)
        console.log(`   -> Tasting Note: "${note}"`)
        updatedCount++
    }

    console.log(`\nSUCCESS: Successfully populated tasting notes for ${updatedCount} products!`)
}

main()
    .catch(console.error)
    .finally(() => pool.end())
