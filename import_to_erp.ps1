# Import LYs Cellars products into Wine ERP
# 1. Merge all JSON pages
# 2. POST to the import API

$allProducts = @()

foreach ($page in 1..3) {
    $file = "lyscellars_products_p$page.json"
    if ($page -eq 1) { $file = "lyscellars_products.json" }
    
    if (Test-Path $file) {
        $raw = Get-Content $file -Raw -Encoding utf8
        $json = $raw | ConvertFrom-Json
        if ($json.products.Count -gt 0) {
            $allProducts += $json.products
            Write-Host "Page $page : $($json.products.Count) products loaded"
        }
    }
}

Write-Host "`nTotal products to import: $($allProducts.Count)"
Write-Host "Sending to http://localhost:3000/api/import-lyscellars ...`n"

# Convert to JSON payload
$payload = @{ products = $allProducts } | ConvertTo-Json -Depth 10 -Compress

# POST to API
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:3000/api/import-lyscellars' `
        -Method POST `
        -ContentType 'application/json; charset=utf-8' `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) `
        -TimeoutSec 120

    Write-Host "=== IMPORT RESULTS ==="
    Write-Host "Total: $($response.total)"
    Write-Host "Created: $($response.created)" -ForegroundColor Green
    Write-Host "Skipped (duplicates): $($response.skipped)" -ForegroundColor Yellow
    
    if ($response.errors -and $response.errors.Count -gt 0) {
        Write-Host "Errors: $($response.errors.Count)" -ForegroundColor Red
        foreach ($err in $response.errors) {
            Write-Host "  [$($err.sku)] $($err.name): $($err.error)" -ForegroundColor Red
        }
    }
}
catch {
    Write-Host "Error calling API: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Host "Response body: $body" -ForegroundColor Red
    }
}
