
$ErrorActionPreference = "Continue"

# ============================================================
# TRUESIGN - DEBUG BATCH 7
# Frontend + Backend + API + CORS Integration Test
# Environment: Windows PowerShell 5.1
# ============================================================

$ProjectRoot = "D:\Hackathon\TrueSign"
$FrontendPath = Join-Path $ProjectRoot "frontend"

$FrontendUrl = "http://localhost:5173"
$BackendUrl = "http://localhost:8080"

$ApiHealthUrl = "$BackendUrl/api/health"
$BlockchainStatusUrl = "$BackendUrl/api/blockchain/status"

$Passed = 0
$Failed = 0
$Warnings = 0

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "             TRUESIGN - DEBUG BATCH 7" -ForegroundColor Cyan
Write-Host "       FRONTEND + BACKEND INTEGRATION TEST" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

function Write-TestResult {
    param(
        [string]$Name,
        [bool]$Success,
        [string]$Details = ""
    )

    if ($Success) {
        $script:Passed++
        Write-Host "[PASS] $Name" -ForegroundColor Green
    }
    else {
        $script:Failed++
        Write-Host "[FAIL] $Name" -ForegroundColor Red
    }

    if ($Details) {
        Write-Host "       $Details" -ForegroundColor Gray
    }
}

function Write-WarningResult {
    param(
        [string]$Name,
        [string]$Details = ""
    )

    $script:Warnings++
    Write-Host "[WARN] $Name" -ForegroundColor Yellow

    if ($Details) {
        Write-Host "       $Details" -ForegroundColor Gray
    }
}

function Test-HttpEndpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{}
    )

    try {
        $Response = Invoke-WebRequest `
            -Uri $Url `
            -Method $Method `
            -Headers $Headers `
            -TimeoutSec 8 `
            -UseBasicParsing

        Write-TestResult `
            -Name $Name `
            -Success ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 400) `
            -Details "HTTP $($Response.StatusCode)"

        return $Response
    }
    catch {
        Write-TestResult `
            -Name $Name `
            -Success $false `
            -Details $_.Exception.Message

        return $null
    }
}

# ============================================================
# 1. PROJECT DIRECTORY
# ============================================================

Write-Host "`n[1] PROJECT STRUCTURE" -ForegroundColor Cyan

Write-TestResult `
    -Name "Project root exists" `
    -Success (Test-Path $ProjectRoot) `
    -Details $ProjectRoot

Write-TestResult `
    -Name "Frontend directory exists" `
    -Success (Test-Path $FrontendPath) `
    -Details $FrontendPath

if (-not (Test-Path $FrontendPath)) {
    Write-Host "`nFrontend directory missing. Cannot continue." -ForegroundColor Red
    exit 1
}

# ============================================================
# 2. NODE AND NPM
# ============================================================

Write-Host "`n[2] NODE AND NPM ENVIRONMENT" -ForegroundColor Cyan

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
$NpmCommand = Get-Command npm -ErrorAction SilentlyContinue

Write-TestResult `
    -Name "Node.js installed" `
    -Success ($null -ne $NodeCommand)

Write-TestResult `
    -Name "npm installed" `
    -Success ($null -ne $NpmCommand)

if ($NodeCommand) {
    Write-Host "       Node: $(node --version)" -ForegroundColor Gray
}

if ($NpmCommand) {
    Write-Host "       npm: $(npm --version)" -ForegroundColor Gray
}

# ============================================================
# 3. FRONTEND FILE STRUCTURE
# ============================================================

Write-Host "`n[3] FRONTEND PAGE FILES" -ForegroundColor Cyan

$RequiredFiles = @(
    "src\App.tsx",
    "src\components\Dashboard.tsx",
    "src\pages\LiveMonitor.tsx",
    "src\pages\PassportExplorer.tsx",
    "src\pages\VerificationCenter.tsx",
    "src\pages\TransactionIntelligence.tsx",
    "src\pages\SnapshotInspector.tsx",
    "src\pages\ProofExplorer.tsx",
    "src\pages\AttackSimulator.tsx",
    "src\pages\AnomalyMonitor.tsx",
    "src\pages\ContractExplorer.tsx",
    "src\pages\Settings.tsx",
    "src\lib\api.ts",
    "package.json"
)

foreach ($File in $RequiredFiles) {
    $FullPath = Join-Path $FrontendPath $File

    Write-TestResult `
        -Name "File: $File" `
        -Success (Test-Path $FullPath)
}

# ============================================================
# 4. FRONTEND ROUTE DECLARATIONS
# ============================================================

Write-Host "`n[4] FRONTEND ROUTE DECLARATIONS" -ForegroundColor Cyan

$AppFile = Join-Path $FrontendPath "src\App.tsx"

if (Test-Path $AppFile) {
    $AppContent = Get-Content $AppFile -Raw

    $RequiredRoutes = @(
        'path="/"',
        'path="/monitor"',
        'path="/passports"',
        'path="/verification"',
        'path="/transactions"',
        'path="/snapshots"',
        'path="/proofs"',
        'path="/simulator"',
        'path="/anomalies"',
        'path="/contracts"',
        'path="/settings"'
    )

    foreach ($Route in $RequiredRoutes) {
        Write-TestResult `
            -Name "Route declaration: $Route" `
            -Success ($AppContent.Contains($Route))
    }
}

# ============================================================
# 5. FRONTEND DEPENDENCIES
# ============================================================

Write-Host "`n[5] FRONTEND DEPENDENCIES" -ForegroundColor Cyan

$NodeModules = Join-Path $FrontendPath "node_modules"
$PackageLock = Join-Path $FrontendPath "package-lock.json"

Write-TestResult `
    -Name "node_modules exists" `
    -Success (Test-Path $NodeModules)

Write-TestResult `
    -Name "package-lock.json exists" `
    -Success (Test-Path $PackageLock)

# ============================================================
# 6. FRONTEND PRODUCTION BUILD
# ============================================================

Write-Host "`n[6] FRONTEND PRODUCTION BUILD" -ForegroundColor Cyan

Push-Location $FrontendPath

try {
    if (Test-Path $NodeModules) {
        npm run build

        $BuildExitCode = $LASTEXITCODE

        Write-TestResult `
            -Name "npm run build" `
            -Success ($BuildExitCode -eq 0) `
            -Details "Exit code: $BuildExitCode"
    }
    else {
        Write-WarningResult `
            -Name "Build skipped" `
            -Details "node_modules is missing. Run npm install first."
    }
}
catch {
    Write-TestResult `
        -Name "npm run build" `
        -Success $false `
        -Details $_.Exception.Message
}
finally {
    Pop-Location
}

# ============================================================
# 7. FRONTEND DEVELOPMENT SERVER
# ============================================================

Write-Host "`n[7] FRONTEND SERVER" -ForegroundColor Cyan

$FrontendResponse = Test-HttpEndpoint `
    -Name "Vite frontend server" `
    -Url $FrontendUrl

if ($FrontendResponse) {
    Write-TestResult `
        -Name "Frontend returns HTML" `
        -Success ($FrontendResponse.Content -match "<html")
}

# ============================================================
# 8. BACKEND HEALTH API
# ============================================================

Write-Host "`n[8] BACKEND HEALTH API" -ForegroundColor Cyan

$HealthResponse = Test-HttpEndpoint `
    -Name "Spring Boot health endpoint" `
    -Url $ApiHealthUrl

if ($HealthResponse) {
    try {
        $HealthData = $HealthResponse.Content | ConvertFrom-Json

        Write-TestResult `
            -Name "Health response is valid JSON" `
            -Success ($null -ne $HealthData)

        Write-Host "       Response: $($HealthResponse.Content)" -ForegroundColor Gray

        if ($HealthData.status) {
            Write-TestResult `
                -Name "Backend reports UP" `
                -Success ($HealthData.status -eq "UP") `
                -Details "Status: $($HealthData.status)"
        }
        else {
            Write-WarningResult `
                -Name "Health status field not found" `
                -Details "Review the actual response above."
        }
    }
    catch {
        Write-TestResult `
            -Name "Health response is valid JSON" `
            -Success $false `
            -Details $_.Exception.Message
    }
}

# ============================================================
# 9. BLOCKCHAIN STATUS API
# ============================================================

Write-Host "`n[9] BLOCKCHAIN STATUS API" -ForegroundColor Cyan

$BlockchainResponse = Test-HttpEndpoint `
    -Name "Blockchain status endpoint" `
    -Url $BlockchainStatusUrl

if ($BlockchainResponse) {
    try {
        $BlockchainData = $BlockchainResponse.Content | ConvertFrom-Json

        Write-TestResult `
            -Name "Blockchain response is valid JSON" `
            -Success ($null -ne $BlockchainData)

        Write-Host "       Blockchain response:" -ForegroundColor Gray
        Write-Host ($BlockchainResponse.Content | ConvertFrom-Json | Format-List | Out-String) -ForegroundColor Gray

        if ($null -ne $BlockchainData.chainId) {
            Write-Host "       Chain ID: $($BlockchainData.chainId)" -ForegroundColor Gray
        }

        if ($null -ne $BlockchainData.connected) {
            Write-Host "       Connected: $($BlockchainData.connected)" -ForegroundColor Gray
        }
    }
    catch {
        Write-TestResult `
            -Name "Blockchain response is valid JSON" `
            -Success $false `
            -Details $_.Exception.Message
    }
}

# ============================================================
# 10. CORS TEST
# ============================================================

Write-Host "`n[10] CORS CONNECTIVITY" -ForegroundColor Cyan

try {
    $CorsResponse = Invoke-WebRequest `
        -Uri $ApiHealthUrl `
        -Method GET `
        -Headers @{
            Origin = $FrontendUrl
        } `
        -TimeoutSec 8 `
        -UseBasicParsing

    $AllowOrigin = $CorsResponse.Headers["Access-Control-Allow-Origin"]

    Write-TestResult `
        -Name "Backend allows frontend origin" `
        -Success ($AllowOrigin -eq $FrontendUrl) `
        -Details "Access-Control-Allow-Origin: $AllowOrigin"
}
catch {
    Write-TestResult `
        -Name "CORS request" `
        -Success $false `
        -Details $_.Exception.Message
}

# ============================================================
# 11. FRONTEND API CONFIGURATION
# ============================================================

Write-Host "`n[11] FRONTEND API CONFIGURATION" -ForegroundColor Cyan

$ApiFile = Join-Path $FrontendPath "src\lib\api.ts"

if (Test-Path $ApiFile) {
    $ApiContent = Get-Content $ApiFile -Raw

    Write-TestResult `
        -Name "Axios API client exists" `
        -Success ($ApiContent -match "axios\.create")

    Write-TestResult `
        -Name "API base URL is configured" `
        -Success ($ApiContent -match "VITE_API_BASE_URL")

    Write-TestResult `
        -Name "Backend default URL configured" `
        -Success ($ApiContent -match "localhost:8080")
}

$EnvFile = Join-Path $FrontendPath ".env"

if (Test-Path $EnvFile) {
    Write-Host "       .env file found." -ForegroundColor Gray
    Write-Host "       Review VITE_API_BASE_URL manually if requests fail." -ForegroundColor Gray
}
else {
    Write-WarningResult `
        -Name "No frontend .env file" `
        -Details "The API client default URL may still be used."
}

# ============================================================
# 12. FINAL REPORT
# ============================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "                 DEBUG BATCH 7 REPORT" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

Write-Host "Passed   : $Passed" -ForegroundColor Green
Write-Host "Failed   : $Failed" -ForegroundColor Red
Write-Host "Warnings : $Warnings" -ForegroundColor Yellow

Write-Host "------------------------------------------------------------"

if ($Failed -eq 0) {
    Write-Host "RESULT: AUTOMATED CHECKS PASSED" -ForegroundColor Green
}
else {
    Write-Host "RESULT: ISSUES DETECTED - REVIEW FAILED TESTS" -ForegroundColor Red
}

Write-Host "============================================================"
Write-Host ""
