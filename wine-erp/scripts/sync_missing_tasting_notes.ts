import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 2,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '77bcd51bb60bed1a4b71c794c28b49f2'
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '4642b28f948f8d18f430186f1f7a5e36'
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '5e75f7e5f71c5afa72b67b175483e32b397b49a7b1d6aba426fed6c0bbe8ae9d'
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'wine-erp-documents'
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN

const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
})

function getAssetUrl(storagePath: string): string {
    const cleanPath = storagePath.replace(/^\/+/, '')
    if (R2_PUBLIC_DOMAIN) {
        const domain = R2_PUBLIC_DOMAIN.replace(/\/+$/, '')
        return `${domain}/${cleanPath}`
    }
    return `/api/r2-file/${cleanPath}`
}

async function uploadToR2(
    buffer: Buffer,
    key: string,
    contentType: string = 'application/pdf'
): Promise<string> {
    await r2Client.send(
        new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        })
    )
    return getAssetUrl(key)
}

interface DossierMapping {
    skus: string[]
    filePath: string
    r2FileName: string
    contentType?: string
}

const DOSSIER_MAPPINGS: DossierMapping[] = [
    // 1. Lô Nam Phi — Anthonij Rupert & Protea
    {
        skus: ['L80001'],
        filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\Vietnam Labels and Images\\Fact Sheets\\PROTEA SHIRAZ 2024.pdf',
        r2FileName: 'l80001_protea_shiraz_2024.pdf',
    },
    {
        skus: ['L80002'],
        filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\Vietnam Labels and Images\\Fact Sheets\\PROTEA CABERNET SAUVINGON 2023.pdf',
        r2FileName: 'l80002_protea_cabernet_sauvignon_2023.pdf',
    },
    {
        skus: ['L80003'],
        filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\Vietnam Labels and Images\\Fact Sheets\\ANTHONIJ RUPERT OPTIMA 2022.pdf',
        r2FileName: 'l80003_anthonij_rupert_optima_2022.pdf',
    },
    {
        skus: ['L80004'],
        filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\Vietnam Labels and Images\\Fact Sheets\\ANTHONIJ RUPERT BLEND 2018.pdf',
        r2FileName: 'l80004_anthonij_rupert_blend_2018.pdf',
    },
    {
        skus: ['L80005'],
        filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\Vietnam Labels and Images\\Fact Sheets\\PROTEA CHENIN BLANC 2025.pdf',
        r2FileName: 'l80005_protea_chenin_blanc_2025.pdf',
    },
    {
        skus: ['L80006'],
        filePath: 'D:\\Lyscellar\\Purchasing\\Lô Nam Phi\\Vietnam Labels and Images\\Fact Sheets\\PROTEA SAUVINGON BLANC 2025.pdf',
        r2FileName: 'l80006_protea_sauvignon_blanc_2025.pdf',
    },
    // 2. Pháp — Plaimont / Domaine de Cassaigne
    {
        skus: ['L20073'],
        filePath: 'D:\\Lyscellar\\Thông tin các NCC\\Plaimon\\IGP GASCOGNE Domaine de Cassaigne Labyrinthe Red NEW.pdf',
        r2FileName: 'l20073_domaine_de_cassaigne_labyrinthe_red.pdf',
    },
    {
        skus: ['L20074'],
        filePath: 'D:\\Lyscellar\\Thông tin các NCC\\Plaimon\\IGP GASCOGNE Domaine de Cassaigne Labyrinthe White NEW.pdf',
        r2FileName: 'l20074_domaine_de_cassaigne_labyrinthe_white.pdf',
    },
    // 3. Ý — Lô Ý T7.2026 (Petra, Terre di Monteforte, Sartori Arco dei Giovi, Buccia Nera)
    {
        skus: ['L10042'],
        filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Ethica\\Label\\Petra Zingari Rosso Toscana IGT tech sheet.pdf',
        r2FileName: 'l10042_petra_zingari_rosso_toscana_igt.pdf',
    },
    {
        skus: ['L10045'],
        filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Satoril mới\\Tasting note\\40003199 RossoVulcanico_en.pdf',
        r2FileName: 'l10045_terre_di_monteforte_rosso_vulcanico.pdf',
    },
    {
        skus: ['L10046'],
        filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Satoril mới\\Tasting note\\40003264 SoaveVulcanico-en.pdf',
        r2FileName: 'l10046_terre_di_monteforte_soave_doc_vulcanico.pdf',
    },
    {
        skus: ['L10004', 'L10005', 'L10006', 'L10007'],
        filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Satoril mới\\Tasting note\\sartori-arco-dei-giovi.pdf',
        r2FileName: 'sartori_arco_dei_giovi_tasting_note.pdf',
    },
    {
        skus: ['L10040', 'L10041', 'L10043', 'L10044'],
        filePath: 'D:\\Lyscellar\\Purchasing\\Lô Ý T7.2026\\Buccia Nera\\BUCCIA NERA Brochure VIni 2026.pdf',
        r2FileName: 'buccia_nera_brochure_vini_2026.pdf',
    },
    // 4. Úc — Calabria The Wall Chardonnay
    {
        skus: ['L40011'],
        filePath: 'D:\\Lyscellar\\Thông tin các NCC\\Calabria\\Chardonnay 2025 Tasting Note.jpg',
        r2FileName: 'l40011_calabria_the_wall_chardonnay_2025.jpg',
        contentType: 'image/jpeg',
    },
    // 5. Hồ sơ các NCC / Lô nhập khẩu khác
    {
        skus: ['L10001', 'L10002', 'L10003'],
        filePath: 'D:\\Lyscellar\\Wiki\\sources\\TASTING NOTES\\ncc_ncc001_collis_heritage\\price_list_i_saltari_2023.pdf',
        r2FileName: 'price_list_i_saltari_2023.pdf',
    },
    {
        skus: ['L10008', 'L10009', 'L10010', 'L10011', 'L10012', 'L10013', 'L10014'],
        filePath: 'D:\\Lyscellar\\Wiki\\sources\\TASTING NOTES\\ncc_ncc001_collis_heritage\\price_list_sartori_2023.pdf',
        r2FileName: 'price_list_sartori_2023.pdf',
    },
    {
        skus: ['L20020', 'L20021', 'L20022', 'L20023', 'L20025', 'L20026', 'L20027', 'L20028'],
        filePath: 'D:\\Lyscellar\\Wiki\\sources\\TASTING NOTES\\ncc_ncc008_pardon_et_fils\\l20024_pardon_fils_morgon_la_croix_gaillard.pdf',
        r2FileName: 'l20024_pardon_fils_morgon_la_croix_gaillard.pdf',
    },
    {
        skus: ['L20068'],
        filePath: 'D:\\Lyscellar\\Wiki\\sources\\TASTING NOTES\\ncc_ncc002_maison_bouey\\l20001_maison_blanche_bordeaux_rouge.pdf',
        r2FileName: 'l20001_maison_blanche_bordeaux_rouge.pdf',
    },
    {
        skus: ['L20069'],
        filePath: 'D:\\Lyscellar\\Wiki\\sources\\TASTING NOTES\\ncc_ncc002_maison_bouey\\l20002_maison_blanche_bordeaux_blanc.pdf',
        r2FileName: 'l20002_maison_blanche_bordeaux_blanc.pdf',
    },
    {
        skus: ['L30004'],
        filePath: 'D:\\Lyscellar\\Wiki\\sources\\TASTING NOTES\\ncc_ncc004_vina_san_esteban\\l30003_vina_san_esteban_classic_chardonnay.pdf',
        r2FileName: 'l30003_vina_san_esteban_classic_chardonnay.pdf',
    },
    {
        skus: ['L60003', 'L60004'],
        filePath: 'D:\\Lyscellar\\Purchasing\\Lô hàng NZ T6.2026\\ASFW Price List 2026 By Josh Scott .pdf',
        r2FileName: 'by_josh_scott_natural_wines_2026.pdf',
    },
    {
        skus: ['L50001'],
        filePath: 'D:\\Lyscellar\\Wiki\\sources\\Legal\\Labels\\Bodegas_Paniza\\Labels Bailando Garnacha Red.pdf',
        r2FileName: 'l50001_bailando_garnacha_cariena_2023.pdf',
    },
    {
        skus: ['L50002'],
        filePath: 'D:\\Lyscellar\\Wiki\\sources\\Legal\\Labels\\Cavas_Marevia\\Labels Bella Mistala Ly Cellar Vietnam.pdf',
        r2FileName: 'l50002_cava_bella_mistala_brut_organic.pdf',
    },
]

interface ProfileSeed {
    skuCode: string
    grapes: string
    color: string
    aromas: string
    palate: string
    foodPairings: string
    servingTemp: string
    originDetail: string
    style: string
}

const PROFILE_SEEDS: ProfileSeed[] = [
    {
        skuCode: 'L70001',
        grapes: '100% Pinot Noir',
        color: 'Rich ruby red with garnet highlights',
        aromas: 'Vibrant notes of dark raspberry, ripe cherry, and delicate French oak spice.',
        palate: 'Juicy boysenberry and supple tannins create a rich, layered texture, with depth and elegance achieved through 15 months in 100% French oak barrels (30% new, 70% neutral). Bold yet graceful finish.',
        foodPairings: 'Roast duck breast, grilled salmon, mushroom risotto, herb-crusted pork tenderloin, and soft cheeses',
        servingTemp: '14 - 16°C',
        originDetail: 'California (Sonoma County & Central Coast), USA — The Duckhorn Portfolio',
        style: 'Expressive, layered & silky California Pinot Noir',
    },
    {
        skuCode: 'L70002',
        grapes: '76% Cabernet Sauvignon, 24% Merlot',
        color: 'Deep crimson-ruby',
        aromas: 'Dark cherry, raspberry, baking spice, cola, and subtle toasty oak form a focused, inviting, and balanced aromatic profile.',
        palate: 'Dark juicy blackberry supported by silky tannins, medium oak structure (aged 18 months in French oak, 40% new), and bright acidity that keeps the wine lively. Smooth, creamy texture carrying through to a long, balanced finish.',
        foodPairings: 'Grilled ribeye steak, braised short ribs, roast rack of lamb, gourmet burgers, and aged cheddar',
        servingTemp: '16 - 18°C',
        originDetail: 'California (Sonoma County, Central Coast, Mendocino County), USA — The Duckhorn Portfolio',
        style: 'Rich, polished & structured California Cabernet Sauvignon',
    },
    {
        skuCode: 'L70005',
        grapes: '100% Chardonnay',
        color: 'Radiant golden straw',
        aromas: 'Radiant aromas of ripe tangerine, sweet melon, and tropical mango mingling with delicate French oak spice.',
        palate: 'Round and full on the palate (aged 9 months in 100% French oak barrels, 30% new, 30% malolactic fermentation), with bright acidity and a supple backbone of sweet oak layered with juicy mango, pineapple, and a touch of vanilla.',
        foodPairings: 'Butter-poached lobster, roast chicken, seared scallops, creamy fettuccine Alfredo, and Brie cheese',
        servingTemp: '8 - 10°C',
        originDetail: 'California (55% Sonoma, 15% Santa Barbara, 14% Mendocino, 8% Yolo, 8% Monterey), USA — The Duckhorn Portfolio',
        style: 'Expressive, layered & creamy California Chardonnay',
    },
    {
        skuCode: 'L80001',
        grapes: '100% Shiraz',
        color: 'Deep ruby red with vibrant purple-black core',
        aromas: 'Shy spice whiffs complement bolder blue and black fruit and typical plum aromas, accented by fynbos and dried herbs.',
        palate: 'Rich blue and black fruit flavours of plum, cherry, mulberry and blueberry. Ripe, rounded and plush with a gentle touch of vanilla cream from 12 months in old French oak. Structured, poised and integrated with an impressive long finish.',
        foodPairings: 'Grilled ribeye steak, roasted lamb chops, braised beef short ribs, venison, and smoked barbecue meats',
        servingTemp: '16 - 18°C',
        originDetail: 'Western Cape, South Africa (Decomposed granite and shale with clay subsoils)',
        style: 'Full-bodied, plush & spicy South African Shiraz',
    },
    {
        skuCode: 'L80003',
        grapes: '37% Cabernet Sauvignon, 32% Merlot, 30% Cabernet Franc, 1% Petit Verdot',
        color: 'Deep crimson ruby with dark garnet core',
        aromas: 'Gentle aromas of fruitcake, dark berries and warm spice rise from the glass, with subtle floral notes and a hint of cracked pepper adding complexity.',
        palate: 'Supple and textured, echoing the nose with layers of rich berry fruit and gentle fruitcake spice. Velvety mouthfeel supported by 20 months in French oak barriques (30% new), finishing long and poised with lingering spice and dark fruit.',
        foodPairings: 'Roast rack of lamb, beef Wellington, duck breast with cherry reduction, and aged hard cheeses',
        servingTemp: '16 - 18°C',
        originDetail: 'Franschhoek and Darling, Western Cape, South Africa (Decomposed granite)',
        style: 'Elegant, age-worthy Bordeaux-style Cape Blend',
    },
    {
        skuCode: 'L80004',
        grapes: '59% Cabernet Sauvignon, 30% Cabernet Franc, 10% Merlot, 1% Petit Verdot',
        color: 'Deep opaque ruby-garnet',
        aromas: 'A shy floral perfume lifts from the glass with layered ripe yet restrained notes of blueberry, plum, and warm oak spice.',
        palate: 'Rich fruit compote flavours of black cherry, prune, and dark berries balanced by a frame of creamy, gently spiced French oak (24 months in 50% new barriques + 6 years bottle aging). Sleek, supple, silky texture with quiet power, precision, and depth.',
        foodPairings: 'Prime dry-aged ribeye, chateaubriand, slow-braised oxtail, wild game, and truffle dishes',
        servingTemp: '16 - 18°C',
        originDetail: 'L’Ormarins Estate, Franschhoek & Groenekloof, Coastal Region, South Africa (Oakleaf & decomposed granite)',
        style: 'Flagship Icon Bordeaux Blend — structured, silky & cellared 8 years prior to release',
    },
    {
        skuCode: 'L80005',
        grapes: '100% Chenin Blanc',
        color: 'Bright pale straw with golden-green highlights',
        aromas: 'Intense aromas of stone fruits and orange blossom mingle with dried peaches and apricots, showcasing sun-kissed Chenin Blanc fruit.',
        palate: 'Rich and generous in flavour — ripe orange citrus, nectarines and fresh apple — knit together by bright, tangy acidity and 2-3 months on fine lees for a deliciously long, dry finish.',
        foodPairings: 'Roast pork belly with apple sauce, grilled prawns, Thai green curry, roast chicken, and creamy seafood pasta',
        servingTemp: '8 - 10°C',
        originDetail: 'Western Cape, South Africa (Decomposed granite, shale and sandstone)',
        style: 'Fresh, stone-fruited & vibrant un-oaked Chenin Blanc',
    },
    {
        skuCode: 'L80006',
        grapes: '100% Sauvignon Blanc',
        color: 'Brilliantly clear pale straw with green tints',
        aromas: 'An array of summer fruit aromas — guava, gooseberry, kiwi and passion fruit combine with fresh stone fruits and citrus overtones.',
        palate: 'Appealing summer fruits fan out on the palate, well balanced and rounded from 2-3 months on the lees with a gentle yet lively, crisp acidity and a long, lingering dry finish.',
        foodPairings: 'Fresh oysters, goat cheese salad, grilled sea bass, ceviche, and asparagus risotto',
        servingTemp: '8 - 10°C',
        originDetail: 'Western Cape, South Africa (Decomposed granite, shale and sandstone)',
        style: 'Crisp, tropical & refreshing Sauvignon Blanc',
    },
    {
        skuCode: 'L20073',
        grapes: 'Merlot & Tannat',
        color: 'Bright ruby red with purple highlights',
        aromas: 'Fresh red and black berry fruit aromas (redcurrant, blackcurrant) layered with seductive spicy notes.',
        palate: 'Supple and modern on the palate, ripe with black fruits, vibrant freshness from low-temperature stainless steel vinification on the lees, and a fresh, full, easy-drinking finish.',
        foodPairings: 'Duck confit, grilled sausages, charcuterie boards, roasted poultry, and semi-hard cheeses',
        servingTemp: '15 - 17°C',
        originDetail: 'IGP Côtes de Gascogne, Château de Cassaigne, Gers, Sud-Ouest, France',
        style: 'Supple, fruit-forward & spicy Gascony Red Blend',
    },
    {
        skuCode: 'L20074',
        grapes: 'Colombard & Sauvignon Blanc',
        color: 'Shiny pale yellow with pale green tints',
        aromas: 'Fresh and expressive nose with zesty grapefruit notes and aromas of exotic tropical fruit.',
        palate: 'Well balanced and round with dominant fruity and zesty aromas, aged minimum 4 months on fine lees. Supple, lively-clear and refreshing with a zesty mineral edge and a long exotic fruit finish.',
        foodPairings: 'Aperitif, shellfish, grilled fish, sushi, seafood tapas, and fresh goat cheese',
        servingTemp: '8 - 10°C',
        originDetail: 'IGP Côtes de Gascogne, Château de Cassaigne, Gers, Sud-Ouest, France',
        style: 'Crisp, zesty & aromatic Gascony White Blend',
    },
    {
        skuCode: 'L10044',
        grapes: '50% Trebbiano, 50% Grechetto',
        color: 'Deep amber-orange (unfiltered organic skin-contact white wine)',
        aromas: 'Complex aromatic profile of candied orange peel, dried apricot, wild herbs, honeyed wildflowers, and Mediterranean macchia.',
        palate: 'Fermented with indigenous yeasts and macerated on the skins for 40 days (with 10% whole bunches), aged 6 months in stainless steel. Structured, savory, and enveloping with fine phenolic grip and vibrant freshness.',
        foodPairings: 'Blue cheeses, white meats, mushrooms, legumes, spicy Asian/Mediterranean dishes, tuna and salmon',
        servingTemp: '13 - 15°C',
        originDetail: 'Toscana Bianco IGT — Arezzo, Tuscany, Italy (350m altitude, clay & limestone soil, certified organic)',
        style: 'Organic Artisanal Skin-Contact Orange Wine (40 days maceration, unfiltered)',
    },
    {
        skuCode: 'L10045',
        grapes: 'Merlot & Merlot Khorus',
        color: 'Deep ruby red',
        aromas: 'Delicate and expressive bouquet with hints of ripe red fruits, wild strawberry, and cooked must from withered grapes.',
        palate: 'Dry, full-bodied, and flavorful on the palate (13.5% ABV) from grapes withered on trays for over two months prior to vinification, delivering velvety texture and hints of cherry cream.',
        foodPairings: 'Red meats, savory roasts, experimental cuisine, aged cheeses, and Mediterranean dishes',
        servingTemp: '16 - 18°C',
        originDetail: 'Hills of Monteforte d’Alpone, Verona, Veneto, Italy (Volcanic soil)',
        style: 'Full-bodied Appassimento-method Volcanic Red Wine',
    },
    {
        skuCode: 'L10046',
        grapes: '100% Garganega',
        color: 'Bright straw yellow',
        aromas: 'Rich, fragrant and fruity nose with distinct notes of sweet violets and almond blossom.',
        palate: 'Dry, crisp and mineral-driven from volcanic hillside soils, finishing clean and persistent with a signature aftertaste of bitter almond.',
        foodPairings: 'Aperitif, risotto, pasta first courses, shellfish, and delicate fish dishes',
        servingTemp: '10°C',
        originDetail: 'Soave DOC — Monteforte d’Alpone, Montecchia di Crosara & Roncà, Veneto, Italy (Volcanic hillside soils)',
        style: 'Classic Mineral Volcanic Soave DOC',
    },
]

async function main() {
    console.log('\n=================================================================')
    console.log('SYNCING MISSING TASTING NOTES & WINE PROFILES FROM IMPORT DOSSIERS')
    console.log('=================================================================\n')

    let uploadedFiles = 0
    let updatedProducts = 0

    for (const item of DOSSIER_MAPPINGS) {
        if (!fs.existsSync(item.filePath)) {
            console.warn(`[WARN] File not found: ${item.filePath}`)
            continue
        }

        const buffer = fs.readFileSync(item.filePath)
        const r2Key = `products/tasting-notes/${item.r2FileName}`
        const contentType = item.contentType || 'application/pdf'

        const r2Url = await uploadToR2(buffer, r2Key, contentType)
        uploadedFiles++

        const res = await prisma.product.updateMany({
            where: {
                deletedAt: null,
                skuCode: { in: item.skus },
            },
            data: {
                tastingNoteUrl: r2Url,
            },
        })

        updatedProducts += res.count
        console.log(`[OK] Uploaded ${item.r2FileName} -> Linked ${res.count} SKU(s): ${item.skus.join(', ')}`)
    }

    console.log('\n--- Upserting Wine Profiles (ProductProfile) for 10 New SKUs ---')
    let upsertedProfiles = 0

    for (const seed of PROFILE_SEEDS) {
        const product = await prisma.product.findFirst({
            where: { skuCode: seed.skuCode, deletedAt: null },
            select: { id: true, skuCode: true, productName: true },
        })

        if (!product) {
            console.warn(`[WARN] SKU not found in DB: ${seed.skuCode}`)
            continue
        }

        await prisma.productProfile.upsert({
            where: { productId: product.id },
            create: {
                productId: product.id,
                grapes: seed.grapes,
                color: seed.color,
                aromas: seed.aromas,
                palate: seed.palate,
                foodPairings: seed.foodPairings,
                servingTemp: seed.servingTemp,
                originDetail: seed.originDetail,
                style: seed.style,
            },
            update: {
                grapes: seed.grapes,
                color: seed.color,
                aromas: seed.aromas,
                palate: seed.palate,
                foodPairings: seed.foodPairings,
                servingTemp: seed.servingTemp,
                originDetail: seed.originDetail,
                style: seed.style,
            },
        })
        upsertedProfiles++
        console.log(`[PROFILE] Upserted Wine Profile for [${product.skuCode}] ${product.productName}`)
    }

    // Final Audit
    const allActive = await prisma.product.findMany({
        where: { deletedAt: null },
        include: { profile: true },
        orderBy: { skuCode: 'asc' },
    })

    const withUrl = allActive.filter(p => Boolean(p.tastingNoteUrl))
    const withProfile = allActive.filter(p => Boolean(p.profile))
    const missingUrl = allActive.filter(p => !p.tastingNoteUrl)
    const missingProfile = allActive.filter(p => !p.profile)

    console.log('\n=================================================================')
    console.log(`FINAL AUDIT SUMMARY (Total Active Products: ${allActive.length})`)
    console.log(`- Files uploaded to R2 in this run: ${uploadedFiles}`)
    console.log(`- Products with tastingNoteUrl: ${withUrl.length}/${allActive.length}`)
    console.log(`- Products with ProductProfile: ${withProfile.length}/${allActive.length}`)
    if (missingUrl.length > 0) {
        console.log(`- Missing tastingNoteUrl (${missingUrl.length}): ${missingUrl.map(p => p.skuCode).join(', ')}`)
    }
    if (missingProfile.length > 0) {
        console.log(`- Missing ProductProfile (${missingProfile.length}): ${missingProfile.map(p => p.skuCode).join(', ')}`)
    }
    console.log('=================================================================\n')
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
