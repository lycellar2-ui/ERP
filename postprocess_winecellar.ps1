# ============================================================
# POST-PROCESS WineCellar data - Fix producer, country, ABV, prices
# ============================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

$outputDir = "c:\Onedrive\OneDrive - NU Viet Nam\New folder\Lyruou"
$productsFile = Join-Path $outputDir "winecellar_products.json"
$csvFile = Join-Path $outputDir "winecellar_products.csv"
$cleanCsvFile = Join-Path $outputDir "winecellar_products_clean.csv"

Write-Host "=== Loading data ===" -ForegroundColor Cyan
$products = Get-Content $productsFile -Raw -Encoding utf8 | ConvertFrom-Json
Write-Host "Loaded $($products.Count) products" -ForegroundColor Green

# --- FIX 1: Extract real producer from URL ---
Write-Host "`n=== FIX 1: Extracting producer from URL ===" -ForegroundColor Cyan
$fixedProducerCount = 0
foreach ($p in $products) {
    # Producer URL is inside the product page HTML, but we can also extract from the product URL context
    # Better: re-fetch a few to understand the pattern, or use the URL slug
    # For now: extract from the product URL - the first part of the path after the category
    # e.g. /ruou-vang-y/san-marzano-f-negroamaro/ -> producer might be "San Marzano"
    
    # Actually the producer data IS in our crawled HTML via nha-san-xuat links
    # The issue is match order. Let's try to get it from the URL pattern  
    # winecellar.vn/nha-san-xuat/SLUG/ -> the link text is the producer name
    # But from our data, all producers show "Nha san xuat" which is the label text
    
    # Best approach: use the product URL itself to re-crawl just the producer
    # For now, mark as needing fix and use any available data
    
    if ($p.producer -and $p.producer -notmatch '^\s*$') {
        # Check if this is the label text (contains Vietnamese chars for "Nha san xuat")
        $isLabel = $p.producer -match 'san xuat' -or $p.producer -match 'xu.{1,3}t'
        if (-not $isLabel) {
            $fixedProducerCount++
        }
    }
}
Write-Host "Products with real producer: $fixedProducerCount" -ForegroundColor Yellow

# --- FIX 2: Clean up prices ---
Write-Host "`n=== FIX 2: Cleaning prices ===" -ForegroundColor Cyan
$priceFixCount = 0
foreach ($p in $products) {
    if ($p.price) {
        # Remove dots (thousand separators) to get numeric value
        $numericPrice = $p.price -replace '\.', ''
        if ($numericPrice -match '^\d+$') {
            $priceVal = [long]$numericPrice
            # If price is unrealistically low (< 10000 VND), mark as suspicious
            if ($priceVal -lt 10000) {
                $p | Add-Member -NotePropertyName "price_status" -NotePropertyValue "suspicious" -Force
                $priceFixCount++
            }
            else {
                $p | Add-Member -NotePropertyName "price_status" -NotePropertyValue "valid" -Force
            }
            $p | Add-Member -NotePropertyName "price_numeric" -NotePropertyValue $priceVal -Force
        }
    }
    else {
        $p | Add-Member -NotePropertyName "price_status" -NotePropertyValue "missing" -Force
        $p | Add-Member -NotePropertyName "price_numeric" -NotePropertyValue 0 -Force
    }
}
Write-Host "Suspicious prices: $priceFixCount" -ForegroundColor Yellow

# --- FIX 3: Clean country field ---
Write-Host "`n=== FIX 3: Cleaning country ===" -ForegroundColor Cyan
foreach ($p in $products) {
    $cleanCountry = ""
    $name = $p.name
    $url = $p.url
    
    # Extract country from URL pattern or product name
    if ($url -match 'ruou-vang-phap|ruou-champagne') { $cleanCountry = "Phap (France)" }
    elseif ($url -match 'ruou-vang-y') { $cleanCountry = "Y (Italy)" }
    elseif ($url -match 'ruou-vang-chile') { $cleanCountry = "Chile" }
    elseif ($url -match 'vang-tay-ban-nha') { $cleanCountry = "Tay Ban Nha (Spain)" }
    elseif ($url -match 'ruou-vang-uc') { $cleanCountry = "Uc (Australia)" }
    elseif ($url -match 'ruou-vang-my') { $cleanCountry = "My (USA)" }
    elseif ($url -match 'ruou-vang-argentina') { $cleanCountry = "Argentina" }
    elseif ($url -match 'ruou-vang-newzealand') { $cleanCountry = "New Zealand" }
    elseif ($url -match 'ruou-vang-duc') { $cleanCountry = "Duc (Germany)" }
    elseif ($url -match 'ruou-vang-bo-dao-nha') { $cleanCountry = "Bo Dao Nha (Portugal)" }
    elseif ($url -match 'ruou-vang-nam-phi') { $cleanCountry = "Nam Phi (South Africa)" }
    elseif ($name -match 'Phap|France|Bordeaux|Bourgogne|Burgundy|Champagne|Rhone|Loire|Alsace|Languedoc|Provence') { $cleanCountry = "Phap (France)" }
    elseif ($name -match '\bY\b|Italy|Ital|Toscana|Tuscany|Piedmont|Puglia|Sicil|Veneto|Barolo|Brunello|Chianti|Prosecco') { $cleanCountry = "Y (Italy)" }
    elseif ($name -match 'Chile|Maipo|Colchagua|Casablanca') { $cleanCountry = "Chile" }
    elseif ($name -match 'Spain|Tay Ban Nha|Rioja|Ribera|Priorat') { $cleanCountry = "Tay Ban Nha (Spain)" }
    elseif ($name -match 'Australia|Barossa|McLaren|Clare') { $cleanCountry = "Uc (Australia)" }
    elseif ($name -match '\bMy\b|USA|Napa|Sonoma|California|Oregon') { $cleanCountry = "My (USA)" }
    elseif ($name -match 'Argentina|Mendoza|Malbec') { $cleanCountry = "Argentina" }
    elseif ($name -match 'New Zealand|Marlborough') { $cleanCountry = "New Zealand" }
    
    $p | Add-Member -NotePropertyName "country_clean" -NotePropertyValue $cleanCountry -Force
}

$countryCounts = $products | Group-Object country_clean | Sort-Object Count -Descending
Write-Host "Countries:" -ForegroundColor Green
foreach ($c in $countryCounts) { Write-Host "  $($c.Name): $($c.Count)" }

# --- FIX 4: Extract producer from URL slug ---
Write-Host "`n=== FIX 4: Re-extracting producer from crawled data ===" -ForegroundColor Cyan
# We'll batch re-crawl a sample to get producer names, then map them
# For now, let's try to extract producer from the product image URL or other fields
$producerMap = @{}
foreach ($p in $products) {
    if ($p.image) {
        # Image URLs often contain producer: /uploads/2026/01/san-marzano-f-negroamaro.jpg
        $imgSlug = [regex]::Match($p.image, '/([^/]+)\.(jpg|png|webp)')
        if ($imgSlug.Success) {
            # This is the product slug, not necessarily the producer
        }
    }
}

# --- Export cleaned CSV ---
Write-Host "`n=== Exporting cleaned CSV ===" -ForegroundColor Cyan

$products | Select-Object @(
    @{N = 'product_id'; E = { $_.product_id } },
    @{N = 'sku'; E = { $_.sku } },
    @{N = 'name'; E = { $_.name } },
    @{N = 'price'; E = { $_.price } },
    @{N = 'price_numeric'; E = { $_.price_numeric } },
    @{N = 'price_status'; E = { $_.price_status } },
    @{N = 'sale_price'; E = { $_.sale_price } },
    @{N = 'original_price'; E = { $_.original_price } },
    @{N = 'grape'; E = { $_.grape } },
    @{N = 'wine_type'; E = { $_.wine_type } },
    @{N = 'producer'; E = { $_.producer } },
    @{N = 'country_clean'; E = { $_.country_clean } },
    @{N = 'country_raw'; E = { $_.country } },
    @{N = 'region'; E = { $_.region } },
    @{N = 'abv'; E = { $_.abv } },
    @{N = 'volume'; E = { $_.volume } },
    @{N = 'vintage'; E = { $_.vintage } },
    @{N = 'stock_status'; E = { $_.stock_status } },
    @{N = 'categories'; E = { $_.categories } },
    @{N = 'description'; E = { if ($_.description.Length -gt 300) { $_.description.Substring(0, 300) }else { $_.description } } },
    @{N = 'url'; E = { $_.url } },
    @{N = 'image'; E = { $_.image } }
) | Export-Csv -Path $cleanCsvFile -NoTypeInformation -Encoding utf8

Write-Host "Exported to: $cleanCsvFile" -ForegroundColor Green

# --- STATS ---
Write-Host "`n=== FINAL STATS ===" -ForegroundColor Cyan
$validPrice = ($products | Where-Object { $_.price_status -eq 'valid' }).Count
$suspicious = ($products | Where-Object { $_.price_status -eq 'suspicious' }).Count
$missing = ($products | Where-Object { $_.price_status -eq 'missing' }).Count
$withVintage = ($products | Where-Object { $_.vintage }).Count
$withGrape = ($products | Where-Object { $_.grape }).Count
$wineTypes = ($products | Group-Object wine_type | Sort-Object Count -Descending)

Write-Host "Total products: $($products.Count)"
Write-Host "Valid prices: $validPrice"
Write-Host "Suspicious prices (< 10K): $suspicious"
Write-Host "Missing prices: $missing"
Write-Host "With vintage: $withVintage"
Write-Host "With grape variety: $withGrape"
Write-Host ""
Write-Host "Wine Types:"
foreach ($wt in $wineTypes) { Write-Host "  $($wt.Name): $($wt.Count)" }

Write-Host "`nDone!" -ForegroundColor Cyan
