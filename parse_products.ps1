$json = Get-Content 'lyscellars_products.json' -Raw -Encoding utf8 | ConvertFrom-Json

$results = @()
$i = 1

foreach ($p in $json.products) {
    $price = if ($p.variants[0].price) { [int]$p.variants[0].price } else { 0 }
    $comparePrice = if ($p.variants[0].compare_at_price) { [int]$p.variants[0].compare_at_price } else { 0 }
    $sku = $p.variants[0].sku
    $stock = $p.variants[0].inventory_quantity

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

$results | Format-Table -AutoSize -Wrap
Write-Host "Total products: $($results.Count)"

$results | Export-Csv -Path 'lyscellars_products_list.csv' -NoTypeInformation -Encoding UTF8
Write-Host "Exported to lyscellars_products_list.csv"
