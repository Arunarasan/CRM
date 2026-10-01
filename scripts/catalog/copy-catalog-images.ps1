# Copies the JB Decor product photos into website/public/catalog so the URLs in V96
# (https://jbdecorcdm.com/catalog/<sku>-NN.jpg) resolve once the website is deployed.
#
# Point -Source at the folder that contains the category folders from the catalog CSV
# ("Netlon (Mosquito Nets)", "Curtains", "Blinds", ...). Files are flattened by name — the
# names are already unique (net-door-01.jpg, cur-ready-01.jpg, ...).
#
#   powershell -File scripts\catalog\copy-catalog-images.ps1 -Source "D:\JB Decor Photos"
param([Parameter(Mandatory = $true)][string]$Source)

$dest = Join-Path $PSScriptRoot '..\..\website\public\catalog'
New-Item -ItemType Directory -Force $dest | Out-Null

$files = Get-ChildItem -Path $Source -Recurse -File -Include *.jpg, *.jpeg, *.png, *.webp
foreach ($f in $files) { Copy-Item $f.FullName (Join-Path $dest $f.Name.ToLower()) -Force }
Write-Host "Copied $($files.Count) images to $((Resolve-Path $dest).Path)"

# Report any image the catalog expects but that wasn't found.
$csv = Import-Csv (Join-Path $PSScriptRoot 'jb-decor-catalog.csv')
$missing = foreach ($r in $csv) {
  1..[int]$r.'Image Count' | ForEach-Object {
    $name = '{0}-{1:D2}.jpg' -f $r.SKU.ToLower(), $_
    if (-not (Test-Path (Join-Path $dest $name))) { $name }
  }
}
if ($missing) { Write-Warning "Missing $($missing.Count) expected images:`n$($missing -join "`n")" }
else { Write-Host 'All expected catalog images are present.' }
