[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$d = Get-Content 'winecellar_products.json' -Raw -Encoding utf8 | ConvertFrom-Json
Write-Host "Total products: $($d.Count)"
Write-Host ""
Write-Host "=== Country Distribution ==="
$groups = $d | Group-Object -Property country | Sort-Object Count -Descending
foreach ($g in $groups) {
    $name = if ($g.Name) { $g.Name } else { "(empty)" }
    Write-Host "$($name): $($g.Count)"
}
Write-Host ""
Write-Host "=== Sample URLs without country match ==="
$noCountry = $d | Where-Object { -not $_.country -or $_.country -eq "" } | Select-Object -First 10
foreach ($nc in $noCountry) {
    Write-Host "  $($nc.name) => $($nc.url)"
}
