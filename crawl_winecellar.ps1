# ============================================================
# WINECELLAR.VN CRAWLER v3 - ASCII-safe
# ============================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

$outputDir = "c:\Onedrive\OneDrive - NU Viet Nam\New folder\Lyruou"
$urlsFile = Join-Path $outputDir "winecellar_urls.json"
$productsFile = Join-Path $outputDir "winecellar_products.json"
$csvFile = Join-Path $outputDir "winecellar_products.csv"

# ----- PHASE 1: Collect all product URLs -----
Write-Host "=== PHASE 1: Collecting product URLs ===" -ForegroundColor Cyan

$allUrls = @()

if (Test-Path $urlsFile) {
    $allUrls = Get-Content $urlsFile -Raw -Encoding utf8 | ConvertFrom-Json
    Write-Host "Loaded $($allUrls.Count) URLs from cache" -ForegroundColor Green
}
else {
    $totalPages = 78
    for ($page = 1; $page -le $totalPages; $page++) {
        $url = if ($page -eq 1) { "https://winecellar.vn/ruou-vang/" } else { "https://winecellar.vn/ruou-vang/page/$page/" }
        Write-Host "Page $page/$totalPages" -NoNewline -ForegroundColor Yellow

        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30 -Headers @{
                "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }

            $foundUrls = [regex]::Matches($r.Content, '<a\s+href="(https://winecellar\.vn/[^"]+/[^"]+/)"[^>]*class="[^"]*woocommerce-LoopProduct-link')
            if ($foundUrls.Count -eq 0) {
                $foundUrls = [regex]::Matches($r.Content, '<h2[^>]*>\s*<a\s+href="(https://winecellar\.vn/[^"]+/[^"]+/)"')
            }

            $pageUrls = @()
            foreach ($m in $foundUrls) {
                $pu = $m.Groups[1].Value
                if ($pu -and $pu -notmatch '/page/' -and $pu -notmatch 'ruou-vang/$') {
                    $pageUrls += $pu
                }
            }
            $pageUrls = $pageUrls | Select-Object -Unique
            $allUrls += $pageUrls
            Write-Host " -> $($pageUrls.Count) products (Total: $($allUrls.Count))" -ForegroundColor Green

            if ($pageUrls.Count -eq 0) {
                Write-Host "  No products, stopping." -ForegroundColor Red
                break
            }
            Start-Sleep -Milliseconds 400
        }
        catch {
            Write-Host " ERROR: $_" -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }

    $allUrls = $allUrls | Select-Object -Unique
    $allUrls | ConvertTo-Json -Depth 5 | Out-File $urlsFile -Encoding utf8
    Write-Host "Saved $($allUrls.Count) unique URLs" -ForegroundColor Green
}

Write-Host "Phase 1 done: $($allUrls.Count) URLs" -ForegroundColor Cyan

# ----- PHASE 2: Crawl product details -----
Write-Host "=== PHASE 2: Crawling product details ===" -ForegroundColor Cyan

$products = [System.Collections.ArrayList]::new()
$crawledUrls = @{}

# Resume support: load existing products
if (Test-Path $productsFile) {
    $existingData = Get-Content $productsFile -Raw -Encoding utf8 | ConvertFrom-Json
    foreach ($ep in $existingData) {
        [void]$products.Add($ep)
        if ($ep.url) { $crawledUrls[$ep.url] = $true }
    }
    Write-Host "Resumed: loaded $($products.Count) existing products" -ForegroundColor Green
}

$total = $allUrls.Count
$counter = 0
$dongSign = [char]0x20AB

foreach ($productUrl in $allUrls) {
    $counter++

    # Skip already crawled
    if ($crawledUrls.ContainsKey($productUrl)) {
        continue
    }

    try {
        $r = Invoke-WebRequest -Uri $productUrl -UseBasicParsing -TimeoutSec 30 -Headers @{
            "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        $html = $r.Content

        # NAME
        $nameMatch = [regex]::Match($html, '<h1[^>]*>([^<]+)</h1>')
        $productName = ""
        if ($nameMatch.Success) {
            $productName = $nameMatch.Groups[1].Value.Trim()
            $productName = [System.Net.WebUtility]::HtmlDecode($productName)
        }

        # PRICE
        $priceMatches = [regex]::Matches($html, 'woocommerce-Price-amount amount[^>]+><bdi>([\s\S]*?)</bdi>')
        $allPrices = @()
        foreach ($pm in $priceMatches) {
            $rawPrice = $pm.Groups[1].Value
            $rawPrice = $rawPrice -replace '<[^>]+>', ''
            $rawPrice = $rawPrice -replace '&nbsp;', ''
            $rawPrice = $rawPrice -replace '&#8363;', ''
            $rawPrice = $rawPrice -replace '&amp;nbsp;', ''
            $rawPrice = $rawPrice -replace $dongSign, ''
            $rawPrice = $rawPrice -replace '[^\d.]', ''
            $rawPrice = $rawPrice.Trim()
            if ($rawPrice) { $allPrices += $rawPrice }
        }
        $allPrices = $allPrices | Select-Object -Unique

        $price = ""
        $salePrice = ""
        $originalPrice = ""

        $hasSale = [regex]::IsMatch($html, '<del[^>]*>.*?woocommerce-Price-amount.*?</del>\s*<ins')
        if ($hasSale -and $allPrices.Count -ge 2) {
            $originalPrice = $allPrices[0]
            $salePrice = $allPrices[1]
            $price = $salePrice
        }
        elseif ($allPrices.Count -ge 1) {
            $price = $allPrices[0]
        }

        # SKU
        $skuMatch = [regex]::Match($html, 'class="sku"[^>]*>([^<]+)')
        $sku = if ($skuMatch.Success) { $skuMatch.Groups[1].Value.Trim() } else { "" }

        # GRAPE
        $grapeMatches = [regex]::Matches($html, 'href="https://winecellar\.vn/giong-nho/[^"]*"[^>]*>([^<]+)</a>')
        $grapes = ($grapeMatches | ForEach-Object { $_.Groups[1].Value.Trim() } | Select-Object -Unique) -join ", "

        # WINE TYPE
        $wineTypeMatch = [regex]::Match($html, 'href="https://winecellar\.vn/loai-vang/[^"]*"[^>]*>([^<]+)</a>')
        $wineType = if ($wineTypeMatch.Success) { $wineTypeMatch.Groups[1].Value.Trim() } else { "" }

        # PRODUCER
        $producerMatch = [regex]::Match($html, 'href="https://winecellar\.vn/nha-san-xuat/[^"]*"[^>]*>([^<]+)</a>')
        $producer = if ($producerMatch.Success) { $producerMatch.Groups[1].Value.Trim() } else { "" }

        # COUNTRY - extract from text like "Vang Phap", "Vang Y (Italy)", etc.
        $country = ""
        $countryMap = @{
            "Vang Ph"          = "Phap"
            "Vang Chile"       = "Chile"
            "Vang Argentina"   = "Argentina"
            "Vang New Zealand" = "New Zealand"
            "Vang Nam Phi"     = "Nam Phi"
            "Italy"            = "Y (Italy)"
            "Australia"        = "Uc (Australia)"
        }
        # Better approach: extract from breadcrumb or product categories
        $countryRx = [regex]::Match($html, 'Vang\s+([\w\s\(\)]+?)(?:\s*<|")')
        if ($countryRx.Success) {
            $country = $countryRx.Groups[1].Value.Trim()
        }

        # ABV
        $abvMatch = [regex]::Match($html, '([\d,\.]+)\s*%?\s*ABV')
        $abv = if ($abvMatch.Success) { $abvMatch.Groups[1].Value.Trim() } else { "" }

        # VOLUME
        $volumeMatch = [regex]::Match($html, '(\d+)\s*ml')
        $volume = if ($volumeMatch.Success) { $volumeMatch.Groups[1].Value + "ml" } else { "" }

        # VINTAGE
        $vintageMatch = [regex]::Match($productName, '\b(19|20)\d{2}\b')
        $vintage = if ($vintageMatch.Success) { $vintageMatch.Value } else { "" }

        # PRODUCT ID
        $idMatch = [regex]::Match($html, 'name="add-to-cart"\s+value="(\d+)"')
        if (-not $idMatch.Success) {
            $idMatch = [regex]::Match($html, 'class="[^"]*post-(\d+)\s')
        }
        $productId = if ($idMatch.Success) { $idMatch.Groups[1].Value } else { "" }

        # STOCK
        $stockStatus = "in-stock"
        if ([regex]::IsMatch($html, 'out-of-stock|class="stock out')) {
            $stockStatus = "out-of-stock"
        }

        # DESCRIPTION
        $descMatch = [regex]::Match($html, '(?s)short-description[^>]*>(.*?)</div>')
        $description = ""
        if ($descMatch.Success) {
            $description = $descMatch.Groups[1].Value
            $description = [regex]::Replace($description, '<[^>]+>', '')
            $description = $description -replace '&nbsp;', ' '
            $description = $description -replace '&amp;nbsp;', ' '
            $description = [regex]::Replace($description, '&#\d+;', '')
            $description = [regex]::Replace($description, '\s+', ' ')
            $description = $description.Trim()
            if ($description.Length -gt 500) { $description = $description.Substring(0, 500) }
        }

        # IMAGE
        $imgMatch = [regex]::Match($html, 'og:image"[^>]*content="([^"]+)"')
        $image = if ($imgMatch.Success) { $imgMatch.Groups[1].Value } else { "" }

        # REGION
        $regionMatch = [regex]::Match($html, 'href="https://winecellar\.vn/vung-san-xuat/[^"]*"[^>]*>([^<]+)</a>')
        $region = if ($regionMatch.Success) { $regionMatch.Groups[1].Value.Trim() } else { "" }

        # CATEGORIES
        $catMatches = [regex]::Matches($html, 'typeof="ListItem"[^>]*>.*?<span[^>]*>([^<]+)</span>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        $cats = @()
        foreach ($cm in $catMatches) {
            $catVal = $cm.Groups[1].Value.Trim()
            if ($catVal -and $catVal -ne "Trang ch") {
                $cats += $catVal
            }
        }
        $categories = $cats -join " > "

        $product = [PSCustomObject]@{
            url            = $productUrl
            product_id     = $productId
            sku            = $sku
            name           = $productName
            price          = $price
            sale_price     = $salePrice
            original_price = $originalPrice
            grape          = $grapes
            wine_type      = $wineType
            producer       = $producer
            country        = $country
            region         = $region
            abv            = $abv
            volume         = $volume
            vintage        = $vintage
            stock_status   = $stockStatus
            categories     = $categories
            description    = $description
            image          = $image
        }

        [void]$products.Add($product)

        $displayPrice = if ($price) { "$price VND" } else { "N/A" }
        Write-Host "[$counter/$total] $productName | $displayPrice | $producer" -ForegroundColor Green

        # Save every 100 products
        if ($counter % 100 -eq 0) {
            Write-Host "  >>> Saving progress ($($products.Count) products)..." -ForegroundColor Cyan
            $products | ConvertTo-Json -Depth 5 | Out-File $productsFile -Encoding utf8
        }

        Start-Sleep -Milliseconds 300
    }
    catch {
        Write-Host "[$counter/$total] ERROR on $productUrl : $_" -ForegroundColor Red
        Start-Sleep -Seconds 1
    }
}

# Final save
$products | ConvertTo-Json -Depth 5 | Out-File $productsFile -Encoding utf8
Write-Host ""
Write-Host "Phase 2 done: $($products.Count) products crawled" -ForegroundColor Cyan

# ----- PHASE 3: Export CSV -----
Write-Host "=== PHASE 3: Exporting CSV ===" -ForegroundColor Cyan

$products | Select-Object product_id, sku, name, price, sale_price, original_price, grape, wine_type, producer, country, region, abv, volume, vintage, stock_status, categories, description, url, image |
Export-Csv -Path $csvFile -NoTypeInformation -Encoding utf8

Write-Host "Exported: $csvFile" -ForegroundColor Green
Write-Host "Total: $($products.Count) products" -ForegroundColor Green

# Stats
$withPrice = ($products | Where-Object { $_.price }).Count
$uniqueProducers = ($products | Select-Object -ExpandProperty producer -Unique | Where-Object { $_ }).Count
Write-Host ""
Write-Host "--- STATS ---"
Write-Host "Products with price: $withPrice / $($products.Count)"
Write-Host "Unique producers: $uniqueProducers"
Write-Host "Done!" -ForegroundColor Cyan
