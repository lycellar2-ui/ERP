$allProducts = @()

foreach ($page in 1..3) {
    $file = "lyscellars_products_p$page.json"
    if ($page -eq 1) { $file = "lyscellars_products.json" }
    
    if (Test-Path $file) {
        $json = Get-Content $file -Raw -Encoding utf8 | ConvertFrom-Json
        if ($json.products.Count -gt 0) {
            $allProducts += $json.products
        }
    }
}

$lines = @()
$lines += "| STT | Ten San Pham | SKU | Gia (VND) | Nha Cung Cap | Loai | Ton Kho |"
$lines += "|-----|-------------|-----|-----------|-------------|------|---------|"

$i = 1
foreach ($p in ($allProducts | Sort-Object title)) {
    $price = if ($p.variants[0].price) { [int]$p.variants[0].price } else { 0 }
    $sku = if ($p.variants[0].sku) { $p.variants[0].sku } else { "N/A" }
    $stock = if ($p.variants[0].inventory_quantity -ne $null) { [int]$p.variants[0].inventory_quantity } else { 0 }
    $priceFormatted = $price.ToString("N0")
    
    $lines += "| $i | $($p.title) | $sku | $priceFormatted | $($p.vendor) | $($p.product_type) | $stock |"
    $i++
}

$lines += ""
$lines += "Total: $($allProducts.Count) products"

$lines -join "`n" | Out-File -FilePath 'lyscellars_product_table.md' -Encoding utf8
Write-Host "Done! $($allProducts.Count) products written to lyscellars_product_table.md"
