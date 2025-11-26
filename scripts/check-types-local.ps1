# Quick check if local Supabase types are in sync with committed types
# PowerShell version of check-types-local.sh

$ErrorActionPreference = "Stop"

Write-Host "🔍 Checking if types are current with local Supabase..." -ForegroundColor Cyan

# Determine backend path (adjust as needed)
$BackendPath = Join-Path $PSScriptRoot "..\..\wildlife-watcher-backend"
$MobileAppPath = Join-Path $PSScriptRoot ".."
$TempTypesFile = Join-Path $MobileAppPath ".types-check.ts"

# Check if backend directory exists
if (-not (Test-Path $BackendPath)) {
    Write-Host ""
    Write-Host "❌ Error: Backend directory not found at: $BackendPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please ensure the wildlife-watcher-backend repository is cloned"
    Write-Host "in the same parent directory as wildlife-watcher-mobile-app"
    exit 1
}

try {
    # Generate fresh types from local Supabase
    Push-Location $BackendPath
    
    Write-Host "Generating types from local Supabase..." -ForegroundColor Gray
    $output = npx supabase gen types typescript --local 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ Error: Failed to generate types from local Supabase" -ForegroundColor Red
        Write-Host ""
        Write-Host "Possible causes:"
        Write-Host "  1. Local Supabase is not running (run: npx supabase start)"
        Write-Host "  2. Supabase CLI not available"
        Write-Host ""
        Write-Host "To start local Supabase:"
        Write-Host "  cd $BackendPath"
        Write-Host "  npx supabase start"
        exit 1
    }
    
    Pop-Location
    
    # Save output to temp file
    $output | Out-File -FilePath $TempTypesFile -Encoding UTF8
    
    # Compare with committed types
    $committedTypesPath = Join-Path $MobileAppPath "src\types\database.types.ts"
    
    if (-not (Test-Path $committedTypesPath)) {
        Write-Host ""
        Write-Host "❌ Error: Committed types file not found at: $committedTypesPath" -ForegroundColor Red
        exit 1
    }
    
    $committedTypes = Get-Content $committedTypesPath -Raw
    $freshTypes = Get-Content $TempTypesFile -Raw
    
    if ($committedTypes -eq $freshTypes) {
        Write-Host "✅ Types are current with local Supabase" -ForegroundColor Green
        exit 0
    } else {
        Write-Host ""
        Write-Host "❌ ERROR: Supabase types are out of sync!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Backend schema changed but types not regenerated."
        Write-Host ""
        Write-Host "To fix, run:"
        Write-Host "  npm run types:local"
        Write-Host ""
        Write-Host "First 20 differences:" -ForegroundColor Yellow
        $diff = Compare-Object -ReferenceObject ($committedTypes -split "`n") -DifferenceObject ($freshTypes -split "`n") | Select-Object -First 20
        $diff | ForEach-Object {
            if ($_.SideIndicator -eq "<=") {
                Write-Host "- $($_.InputObject)" -ForegroundColor Red
            } else {
                Write-Host "+ $($_.InputObject)" -ForegroundColor Green
            }
        }
        Write-Host ""
        exit 1
    }
} finally {
    # Cleanup
    if (Test-Path $TempTypesFile) {
        Remove-Item $TempTypesFile -Force
    }
    
    # Ensure we're back in the original directory
    Pop-Location -ErrorAction SilentlyContinue
}
