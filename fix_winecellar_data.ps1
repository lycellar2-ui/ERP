# ============================================================
# RE-CRAWL producer names, prices, ABV, country from product pages
# Fixes country by extracting from HTML pa_quoc-gia attribute
# ============================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

$outputDir = "c:\Onedrive\OneDrive - NU Viet Nam\New folder\Lyruou"
$productsFile = Join-Path $outputDir "winecellar_products.json"
$fixedFile = Join-Path $outputDir "winecellar_products_fixed.json"
$csvFile = Join-Path $outputDir "winecellar_products_final.csv"

Write-Host "=== Loading products ===" -ForegroundColor Cyan
$products = Get-Content $productsFile -Raw -Encoding utf8 | ConvertFrom-Json
Write-Host "Loaded $($products.Count) products" -ForegroundColor Green

# Build country mapping at runtime to avoid encoding issues
$countryMapRuntime = @{}
# French
$countryMapRuntime["Vang Ph" + [char]0x00E1 + "p"] = "France"
$countryMapRuntime["Ph" + [char]0x00E1 + "p"] = "France"
$countryMapRuntime["France"] = "France"
# Italian
$yCap = [string][char]0x00DD
$countryMapRuntime["Vang $yCap"] = "Italy"
$countryMapRuntime[$yCap] = "Italy"
$countryMapRuntime["Vang Y"] = "Italy"
$countryMapRuntime["Italy"] = "Italy"
# Chile
$countryMapRuntime["Vang Chile"] = "Chile"
$countryMapRuntime["Chile"] = "Chile"
# Spain
$tbn = "T" + [char]0x00E2 + "y Ban Nha"
$countryMapRuntime["Vang $tbn"] = "Spain"
$countryMapRuntime[$tbn] = "Spain"
$countryMapRuntime["Spain"] = "Spain"
# Australia
$uc = [string][char]0x00DA + "c"
$countryMapRuntime["Vang $uc"] = "Australia"
$countryMapRuntime[$uc] = "Australia"
$countryMapRuntime["Australia"] = "Australia"
# USA
$my = "M" + [char]0x1EF9
$countryMapRuntime["Vang $my"] = "USA"
$countryMapRuntime[$my] = "USA"
$countryMapRuntime["USA"] = "USA"
# Argentina
$countryMapRuntime["Vang Argentina"] = "Argentina"
$countryMapRuntime["Argentina"] = "Argentina"
# New Zealand
$countryMapRuntime["Vang New Zealand"] = "New Zealand"
$countryMapRuntime["New Zealand"] = "New Zealand"
# Germany
$duc = [char]0x0110 + [char]0x1EE9 + "c"
$countryMapRuntime["Vang $duc"] = "Germany"
$countryMapRuntime[$duc] = "Germany"
$countryMapRuntime["Germany"] = "Germany"
# Portugal
$bdnha = "B" + [char]0x1ED3 + " " + [char]0x0110 + [char]0x00E0 + "o Nha"
$countryMapRuntime["Vang $bdnha"] = "Portugal"
$countryMapRuntime[$bdnha] = "Portugal"
$countryMapRuntime["Portugal"] = "Portugal"
# South Africa
$countryMapRuntime["Vang Nam Phi"] = "South Africa"
$countryMapRuntime["Nam Phi"] = "South Africa"
$countryMapRuntime["South Africa"] = "South Africa"

Write-Host "Country map has $($countryMapRuntime.Count) entries" -ForegroundColor Gray

function Get-CountryFromUrl {
    param([string]$url)
    if ($url -match 'ruou-vang-phap|ruou-champagne') { return "France" }
    elseif ($url -match 'ruou-vang-y/') { return "Italy" }
    elseif ($url -match 'ruou-vang-chile') { return "Chile" }
    elseif ($url -match 'vang-tay-ban-nha') { return "Spain" }
    elseif ($url -match 'ruou-vang-uc') { return "Australia" }
    elseif ($url -match 'ruou-vang-my') { return "USA" }
    elseif ($url -match 'ruou-vang-argentina') { return "Argentina" }
    elseif ($url -match 'ruou-vang-newzealand') { return "New Zealand" }
    elseif ($url -match 'ruou-vang-duc') { return "Germany" }
    elseif ($url -match 'ruou-vang-bo-dao-nha') { return "Portugal" }
    elseif ($url -match 'ruou-vang-nam-phi') { return "South Africa" }
    return ""
}

function Get-CountryFromHtml {
    param([string]$htmlContent)
    $cm = [regex]::Match($htmlContent, 'pa_quoc-gia[\s\S]{0,1500}?pa-info__value">([\s\S]*?)</div>')
    if ($cm.Success) {
        $rawVal = $cm.Groups[1].Value
        $rawVal = $rawVal -replace '<[^>]+>', ''
        $rawVal = $rawVal.Trim()
        if ($rawVal) {
            if ($countryMapRuntime.ContainsKey($rawVal)) {
                return $countryMapRuntime[$rawVal]
            }
            foreach ($key in $countryMapRuntime.Keys) {
                if ($rawVal -like "*$key*" -and $key.Length -gt 1) {
                    return $countryMapRuntime[$key]
                }
            }
            return $rawVal
        }
    }
    return ""
}

function Get-RegionFromHtml {
    param([string]$htmlContent)
    $rm = [regex]::Match($htmlContent, 'pa_vung[\s\S]{0,1500}?pa-info__value">([\s\S]*?)</div>')
    if ($rm.Success) {
        $rawVal = $rm.Groups[1].Value
        $rawVal = $rawVal -replace '<[^>]+>', ''
        $rawVal = $rawVal.Trim()
        if ($rawVal) { return $rawVal }
    }
    return ""
}

$dongSign = [char]0x20AB
$counter = 0
$total = $products.Count
$fixedCount = 0
$countryFixed = 0
$regionFixed = 0

foreach ($p in $products) {
    $counter++

    try {
        $r = Invoke-WebRequest -Uri $p.url -UseBasicParsing -TimeoutSec 20 -Headers @{
            "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        $html = $r.Content

        # --- Fix Producer ---
        $producerMatches = [regex]::Matches($html, 'href="https://winecellar\.vn/nha-san-xuat/([^"]+)/"[^>]*>([^<]+)</a>')
        $realProducer = ""
        foreach ($pm in $producerMatches) {
            $pName = $pm.Groups[2].Value.Trim()
            if ($pName -and $pName.Length -gt 2) {
                $realProducer = $pName
                break
            }
        }
        if ($realProducer) {
            $p.producer = $realProducer
        }

        # --- Fix Price ---
        $productPriceMatch = [regex]::Match($html, 'class="price\s+product-page-price[^"]*"[^>]*>([\s\S]*?)</p>')
        if ($productPriceMatch.Success) {
            $priceHtml = $productPriceMatch.Groups[1].Value
            $hasDel = $priceHtml -match '<del'
            $hasIns = $priceHtml -match '<ins'
            $bdiPrices = [regex]::Matches($priceHtml, '<bdi>([\s\S]*?)</bdi>')
            $cleanPrices = @()
            foreach ($bp in $bdiPrices) {
                $raw = $bp.Groups[1].Value
                $raw = $raw -replace '<[^>]+>', '' -replace '&nbsp;', '' -replace '&#8363;', '' -replace '&amp;nbsp;', '' -replace $dongSign, '' -replace '[^\d.]', ''
                $raw = $raw.Trim()
                if ($raw) { $cleanPrices += $raw }
            }
            if ($hasDel -and $hasIns -and $cleanPrices.Count -ge 2) {
                $p.original_price = $cleanPrices[0]
                $p.sale_price = $cleanPrices[1]
                $p.price = $cleanPrices[1]
            }
            elseif ($cleanPrices.Count -ge 1) {
                $p.price = $cleanPrices[0]
            }
        }

        # --- Fix ABV ---
        $abvMatch = [regex]::Match($html, '(\d{1,2}[.,]\d{1,2})\s*%\s*ABV')
        if (-not $abvMatch.Success) {
            $abvMatch = [regex]::Match($html, '(\d{1,2}[.,]\d{1,2})\s*%\s*vol')
        }
        if ($abvMatch.Success) {
            $p.abv = $abvMatch.Groups[1].Value
        }
        else {
            $abvApprox = [regex]::Match($html, '(\d{1,2}[.,]?\d*)\s*%\s*ABV\*')
            if ($abvApprox.Success) {
                $p.abv = $abvApprox.Groups[1].Value + " (approx)"
            }
        }

        # --- Fix Country: HTML (primary) then URL (fallback) ---
        $htmlCountry = Get-CountryFromHtml -htmlContent $html
        if ($htmlCountry) {
            $p.country = $htmlCountry
            $countryFixed++
        }
        else {
            $urlCountry = Get-CountryFromUrl -url $p.url
            if ($urlCountry) {
                $p.country = $urlCountry
                $countryFixed++
            }
        }

        # --- Fix Region from HTML ---
        $htmlRegion = Get-RegionFromHtml -htmlContent $html
        if ($htmlRegion) {
            $p.region = $htmlRegion
            $regionFixed++
        }

        $fixedCount++
        $displayPrice = if ($p.price) { "$($p.price) VND" } else { "N/A" }
        Write-Host "[$counter/$total] $($p.name) | $displayPrice | $($p.producer) | $($p.country)" -ForegroundColor Green

        # Save every 100
        if ($counter % 100 -eq 0) {
            Write-Host "  >>> Saving progress ($fixedCount fixed, $countryFixed countries)..." -ForegroundColor Cyan
            $products | ConvertTo-Json -Depth 5 | Out-File $fixedFile -Encoding utf8
        }

        Start-Sleep -Milliseconds 200
    }
    catch {
        Write-Host "[$counter/$total] ERROR on $($p.name): $_" -ForegroundColor Red
        
        # Still fix country from URL even on error
        $urlCountry = Get-CountryFromUrl -url $p.url
        if ($urlCountry) {
            $p.country = $urlCountry
            $countryFixed++
        }
        
        Start-Sleep -Seconds 1
    }
}

# Final save
$products | ConvertTo-Json -Depth 5 | Out-File $fixedFile -Encoding utf8
Write-Host "`nFixed: $fixedCount products" -ForegroundColor Cyan
Write-Host "Countries fixed: $countryFixed" -ForegroundColor Cyan
Write-Host "Regions fixed: $regionFixed" -ForegroundColor Cyan

# Export CSV
Write-Host "=== Exporting final CSV ===" -ForegroundColor Cyan
$products | Select-Object product_id, sku, name, price, sale_price, original_price, grape, wine_type, producer, country, region, abv, volume, vintage, stock_status, categories, description, url, image |
Export-Csv -Path $csvFile -NoTypeInformation -Encoding utf8

# Stats
$uniqueProducers = ($products | Select-Object -ExpandProperty producer -Unique | Where-Object { $_ }).Count
$withPrice = ($products | Where-Object { $_.price -and ($_.price -replace '\.', '') -gt 10000 }).Count
$countryStats = $products | Group-Object -Property country | Sort-Object Count -Descending
Write-Host "`n=== Country Distribution ===" -ForegroundColor Yellow
foreach ($cs in $countryStats) {
    $name = if ($cs.Name) { $cs.Name } else { "(empty)" }
    Write-Host "  $($name): $($cs.Count)"
}
Write-Host "`nUnique producers: $uniqueProducers"
Write-Host "Products with valid price: $withPrice"
Write-Host "Exported to: $csvFile" -ForegroundColor Green
Write-Host "Done!" -ForegroundColor Cyan
