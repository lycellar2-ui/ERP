$allProducts = @()

foreach ($page in 1..3) {
    $file = "lyscellars_products_p$page.json"
    if ($page -eq 1) { $file = "lyscellars_products.json" }
    
    if (Test-Path $file) {
        $json = Get-Content $file -Raw -Encoding utf8 | ConvertFrom-Json
        if ($json.products.Count -gt 0) {
            $allProducts += $json.products
            Write-Host "Page $page : $($json.products.Count) products"
        }
    }
}

Write-Host "Total products loaded: $($allProducts.Count)"

$results = @()
$i = 1

foreach ($p in $allProducts) {
    $price = if ($p.variants[0].price) { [int]$p.variants[0].price } else { 0 }
    $comparePrice = if ($p.variants[0].compare_at_price) { [int]$p.variants[0].compare_at_price } else { 0 }
    $sku = if ($p.variants[0].sku) { $p.variants[0].sku } else { "" }
    $stock = if ($p.variants[0].inventory_quantity -ne $null) { [int]$p.variants[0].inventory_quantity } else { 0 }

    $obj = [PSCustomObject]@{
        STT          = $i
        Name         = $p.title
        SKU          = $sku
        Price        = $price
        ComparePrice = $comparePrice
        Vendor       = $p.vendor
        ProductType  = $p.product_type
        Available    = $p.available
        Stock        = $stock
        Handle       = $p.handle
    }
    $results += $obj
    $i++
}

$results | Format-Table STT, Name, SKU, Price, Vendor, ProductType, Stock -AutoSize
Write-Host "`nTotal products: $($results.Count)"

$results | Export-Csv -Path 'lyscellars_all_products.csv' -NoTypeInformation -Encoding UTF8
Write-Host "Exported to lyscellars_all_products.csv"
