import * as fs from 'fs'

async function main() {
    console.log("=== CHECKING LYSCellARS PRODUCTS FOR VENDORS ===");
    
    const allProducts: any[] = [];
    for (const page of [1, 2, 3]) {
        const file = `d:\\Lyruou\\lyscellars_products_p${page}.json`;
        const path = page === 1 ? `d:\\Lyruou\\lyscellars_products.json` : file;
        
        if (fs.existsSync(path)) {
            const raw = fs.readFileSync(path, 'utf8');
            const json = JSON.parse(raw.trim().replace(/^\uFEFF/, ''));
            if (json.products) {
                allProducts.push(...json.products);
            }
        }
    }
    
    console.log(`Total crawled products loaded: ${allProducts.length}`);
    
    // Print a sample of 15 products with SKU, title, and vendor
    console.log("\nSample products from crawl:");
    let sampleCount = 0;
    for (const p of allProducts) {
        const sku = p.variants?.[0]?.sku || 'N/A';
        const vendor = p.vendor || 'N/A';
        const title = p.title || 'N/A';
        
        if (sku !== 'N/A' && sampleCount < 15) {
            console.log(`- SKU: ${sku} | Vendor: "${vendor}" | Title: "${title}"`);
            sampleCount++;
        }
    }
}

main().catch(console.error);
