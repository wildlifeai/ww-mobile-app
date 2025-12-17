# Type alignment validation for Supabase cloud environments
# PowerShell version of check-types-cloud.sh
# Checks if committed types match the schema of a cloud Supabase instance
#
# Usage: .\scripts\check-types-cloud.ps1 <environment>
#   environment: cloud-dev or cloud-prod
#
# Environment Configuration:
#   cloud-dev:  nuhwmubvygxyddkycmpa (https://nuhwmubvygxyddkycmpa.supabase.co)
#   cloud-prod: [NOT YET CONFIGURED]
#
# Dependencies:
#   - Supabase CLI (must be authenticated to the project)
#   - Project must be linked: `supabase link --project-ref <ref>`
#
# Exit Codes:
#   0 = Types are aligned with cloud environment
#   1 = Types are out of sync OR error occurred

param(
    [Parameter(Mandatory=$true)]
    [string]$Environment
)

$ErrorActionPreference = "Stop"

# Validate environment parameter
if ([string]::IsNullOrEmpty($Environment)) {
    Write-Host "❌ Error: Environment not specified" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage: .\check-types-cloud.ps1 <environment>"
    Write-Host "  environment: cloud-dev or cloud-prod"
    exit 1
}

# Validate environment value
if ($Environment -ne "cloud-dev" -and $Environment -ne "cloud-prod") {
    Write-Host "❌ Error: Invalid environment '$Environment'" -ForegroundColor Red
    Write-Host ""
    Write-Host "Valid environments: cloud-dev, cloud-prod"
    exit 1
}

# Map environment to Supabase project ref
$ProjectRef = switch ($Environment) {
    "cloud-dev" { "nuhwmubvygxyddkycmpa" }
    "cloud-prod" {
        Write-Host "❌ Error: Production environment not yet configured" -ForegroundColor Red
        Write-Host ""
        Write-Host "Production Supabase project ref needs to be added to:"
        Write-Host "  - scripts/check-types-cloud.ps1"
        Write-Host "  - scripts/check-types-cloud.sh"
        Write-Host "  - package.json (types:cloud-prod script)"
        exit 1
    }
    default {
        Write-Host "❌ Error: Unknown environment '$Environment'" -ForegroundColor Red
        exit 1
    }
}

Write-Host "🔍 Checking type alignment with $Environment Supabase instance..." -ForegroundColor Cyan
Write-Host "   Project ref: $ProjectRef"
Write-Host ""

# Check if npx is available
try {
    $null = Get-Command npx -ErrorAction Stop
} catch {
    Write-Host "❌ Error: npx not found (Node.js required)" -ForegroundColor Red
    exit 1
}

# Verify Supabase CLI is available via npx
try {
    $null = npx supabase --version 2>$null
} catch {
    Write-Host "❌ Error: Supabase CLI not available" -ForegroundColor Red
    Write-Host ""
    Write-Host "The Supabase CLI will be installed automatically via npx on first use"
    exit 1
}

# Create temporary file for fresh types
$TempTypes = [System.IO.Path]::GetTempFileName()

try {
    # Generate types from cloud instance
    Write-Host "📡 Generating types from $Environment (this may take a few seconds)..." -ForegroundColor Cyan
    
    $output = npx supabase gen types typescript --project-id $ProjectRef --schema public 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ Error: Failed to generate types from $Environment" -ForegroundColor Red
        Write-Host ""
        Write-Host "Possible causes:"
        Write-Host "  1. Not authenticated to Supabase CLI (run: npx supabase login)"
        Write-Host "  2. No access to project ref: $ProjectRef"
        Write-Host "  3. Network connectivity issues"
        Write-Host "  4. Project ref is incorrect"
        Write-Host ""
        Write-Host "To authenticate: npx supabase login"
        Write-Host "To link project:  npx supabase link --project-ref $ProjectRef"
        exit 1
    }
    
    # Save output to temp file
    $output | Out-File -FilePath $TempTypes -Encoding UTF8
    
    # Check if temp file has content
    if ((Get-Item $TempTypes).Length -eq 0) {
        Write-Host "❌ Error: Generated types file is empty" -ForegroundColor Red
        exit 1
    }
    
    # Compare with committed types
    $committedTypes = Get-Content "src/types/database.types.ts" -Raw
    $freshTypes = Get-Content $TempTypes -Raw
    
    if ($committedTypes -eq $freshTypes) {
        Write-Host ""
        Write-Host "✅ Types are aligned with $Environment" -ForegroundColor Green
        Write-Host ""
        Write-Host "Committed types match the cloud database schema."
        exit 0
    } else {
        Write-Host ""
        Write-Host "❌ ERROR: Types are out of sync with $Environment!" -ForegroundColor Red
        Write-Host ""
        Write-Host "The committed types (src/types/database.types.ts) do not match the"
        Write-Host "current schema of the $Environment Supabase instance."
        Write-Host ""
        Write-Host "To fix, run:"
        Write-Host "  npm run types:$Environment"
        Write-Host ""
        Write-Host "Then commit the updated types:"
        Write-Host "  git add src/types/database.types.ts"
        Write-Host "  git commit -m 'chore(types): sync with $Environment schema'"
        Write-Host ""
        
        # Show diff (first 30 lines)
        Write-Host "First 30 lines of diff:" -ForegroundColor Yellow
        $diff = Compare-Object -ReferenceObject ($committedTypes -split "`n") -DifferenceObject ($freshTypes -split "`n") | Select-Object -First 30
        $diff | ForEach-Object {
            if ($_.SideIndicator -eq "<=") {
                Write-Host "- $($_.InputObject)" -ForegroundColor Red
            } else {
                Write-Host "+ $($_.InputObject)" -ForegroundColor Green
            }
        }
        Write-Host ""
        exit 1
} finally {
    # Cleanup
    if (Test-Path $TempTypes) {
        Remove-Item $TempTypes -Force
    }
}
