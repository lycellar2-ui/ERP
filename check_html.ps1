[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$html = Get-Content 'sample_page.html' -Raw -Encoding utf8

# Find country using the label pattern - use Unicode escape for special chars
$labelPattern = 'Qu\u1ed1c gia</div>'
$qgIdx = $html.IndexOf([char]0x0051 + "u" + [char]0x1ED1 + "c gia</div>")
Write-Host "Index of Quoc gia: $qgIdx"

# Alternative: match by pa_quoc-gia attribute then extract value
$countryMatch = [regex]::Match($html, 'pa_quoc-gia[\s\S]{0,1000}?pa-info__value">([\s\S]*?)</div>')
if ($countryMatch.Success) {
    $rawVal = $countryMatch.Groups[1].Value
    $rawVal = $rawVal -replace '<[^>]+>', ''
    $rawVal = $rawVal.Trim()
    Write-Host "Raw country from pa_quoc-gia: '$rawVal'"
}

# Also try: look for breadcrumb or category with country info
$bcMatches = [regex]::Matches($html, 'ruou-vang-([a-z-]+)/')
Write-Host "`n=== URL country slugs ==="
$seen = @{}
foreach ($m in $bcMatches) {
    $slug = $m.Groups[1].Value
    if (-not $seen[$slug]) {
        Write-Host "  $slug"
        $seen[$slug] = $true
    }
}
