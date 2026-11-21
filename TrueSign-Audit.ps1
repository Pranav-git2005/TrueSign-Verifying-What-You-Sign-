param(
    [string]$FrontendPath = ".\frontend",
    [string]$BackendPath = ".\backend",
    [string]$ApiBase = "http://localhost:8080",
    [string]$PassportId = ""
)

$ErrorActionPreference = "Continue"
$results = New-Object System.Collections.Generic.List[object]

function Add-Result([string]$Area, [string]$Test, [string]$Status, [string]$Details) {
    $results.Add([pscustomobject]@{
        Area = $Area; Test = $Test; Status = $Status; Details = $Details
    })
    $color = switch ($Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "WARN" { "Yellow" }
        default { "Gray" }
    }
    Write-Host ("[{0}] {1} - {2}: {3}" -f $Status, $Area, $Test, $Details) -ForegroundColor $color
}

function Test-Http([string]$Method, [string]$Url) {
    try {
        $response = Invoke-WebRequest -Uri $Url -Method $Method -TimeoutSec 8 -UseBasicParsing
        return [pscustomobject]@{ Ok = $true; Code = [int]$response.StatusCode; Body = $response.Content }
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return [pscustomobject]@{ Ok = $false; Code = $code; Body = $_.Exception.Message }
    }
}

Write-Host "`n========== TRUESIGN FRONTEND + BACKEND AUDIT ==========" -ForegroundColor Cyan
Write-Host "API: $ApiBase"
Write-Host "This script does not create passports, submit transactions, register payees, or change data.`n"

# 1. Project structure
if (Test-Path (Join-Path $FrontendPath "package.json")) {
    Add-Result "Frontend" "package.json" "PASS" "Found frontend package manifest."
} else {
    Add-Result "Frontend" "package.json" "FAIL" "FrontendPath does not contain package.json."
}

if (Test-Path (Join-Path $FrontendPath "src")) {
    Add-Result "Frontend" "src directory" "PASS" "Expected src directory exists."
} else {
    Add-Result "Frontend" "src directory" "FAIL" "No src directory. Check ZIP extraction; do not build from a flattened archive."
}

if (Test-Path (Join-Path $BackendPath "pom.xml")) {
    Add-Result "Backend" "pom.xml" "PASS" "Found Maven project."
} else {
    Add-Result "Backend" "pom.xml" "FAIL" "BackendPath does not contain pom.xml."
}

# 2. Frontend build
$npm = Get-Command npm -ErrorAction SilentlyContinue
if ($npm -and (Test-Path (Join-Path $FrontendPath "package.json"))) {
    Push-Location $FrontendPath
    if (Test-Path "node_modules") {
        $build = & npm run build 2>&1
        if ($LASTEXITCODE -eq 0) {
            Add-Result "Frontend" "TypeScript + Vite production build" "PASS" "npm run build completed."
        } else {
            Add-Result "Frontend" "TypeScript + Vite production build" "FAIL" (($build | Select-Object -Last 12) -join " | ")
        }
    } else {
        Add-Result "Frontend" "Dependencies" "WARN" "node_modules missing. Run npm ci, then rerun this audit."
    }
    Pop-Location
} else {
    Add-Result "Frontend" "Build tooling" "WARN" "npm unavailable or package.json missing."
}

# 3. Backend API availability
$health = Test-Http "GET" "$ApiBase/api/health"
if ($health.Ok -and $health.Code -eq 200) {
    Add-Result "Backend API" "GET /api/health" "PASS" "HTTP 200: $($health.Body)"
} else {
    Add-Result "Backend API" "GET /api/health" "FAIL" "No healthy response. $($health.Body)"
}

$blockchain = Test-Http "GET" "$ApiBase/api/blockchain/status"
if ($blockchain.Ok -and $blockchain.Code -eq 200) {
    Add-Result "Blockchain" "GET /api/blockchain/status" "PASS" "Endpoint responded. Inspect returned connected/chainId/contract flags."
    try {
        $b = $blockchain.Body | ConvertFrom-Json
        if ($b.PSObject.Properties.Name -contains "connected") {
            Add-Result "Blockchain" "connected field" "PASS" "connected=$($b.connected)"
        } else {
            Add-Result "Blockchain" "connected field" "WARN" "Response has no 'connected' property; frontend status UI may show unavailable."
        }
        if ($b.PSObject.Properties.Name -contains "chainId") {
            Add-Result "Blockchain" "chainId field" "PASS" "chainId=$($b.chainId)"
        } else {
            Add-Result "Blockchain" "chainId field" "WARN" "Response has no 'chainId' property."
        }
    } catch {
        Add-Result "Blockchain" "JSON response" "WARN" "Could not parse status response as JSON."
    }
} else {
    Add-Result "Blockchain" "GET /api/blockchain/status" "WARN" "RPC may be offline or endpoint unavailable. $($blockchain.Body)"
}

# 4. SSE stream
try {
    $request = [System.Net.HttpWebRequest]::Create("$ApiBase/api/stream")
    $request.Method = "GET"
    $request.Accept = "text/event-stream"
    $request.Timeout = 4000
    $request.ReadWriteTimeout = 4000
    $response = $request.GetResponse()
    $contentType = $response.ContentType
    $response.Close()
    if ($contentType -match "text/event-stream") {
        Add-Result "Live Monitor" "GET /api/stream" "PASS" "SSE content type: $contentType"
    } else {
        Add-Result "Live Monitor" "GET /api/stream" "WARN" "Unexpected content type: $contentType"
    }
} catch {
    Add-Result "Live Monitor" "GET /api/stream" "FAIL" "SSE connection failed: $($_.Exception.Message)"
}

# 5. Read-only endpoint checks (requires an existing ID)
if ($PassportId.Trim()) {
    $encoded = [uri]::EscapeDataString($PassportId.Trim())

    $passport = Test-Http "GET" "$ApiBase/api/passports/$encoded"
    if ($passport.Ok -and $passport.Code -eq 200) {
        Add-Result "Passport Explorer" "GET passport by ID" "PASS" "Passport retrieved."
    } else {
        Add-Result "Passport Explorer" "GET passport by ID" "FAIL" "HTTP $($passport.Code): $($passport.Body)"
    }

    $snapshots = Test-Http "GET" "$ApiBase/api/passports/$encoded/snapshots"
    if ($snapshots.Ok -and $snapshots.Code -eq 200) {
        Add-Result "Snapshot Inspector" "GET snapshot history" "PASS" "Snapshot endpoint returned HTTP 200."
    } else {
        Add-Result "Snapshot Inspector" "GET snapshot history" "FAIL" "HTTP $($snapshots.Code): $($snapshots.Body)"
    }

    $proof = Test-Http "GET" "$ApiBase/api/proofs/$encoded"
    if ($proof.Ok -and $proof.Code -eq 200) {
        Add-Result "Proof Explorer" "GET proof bundle" "PASS" "Proof bundle retrieved."
    } else {
        Add-Result "Proof Explorer" "GET proof bundle" "WARN" "Proof may not exist until verification: HTTP $($proof.Code): $($proof.Body)"
    }
} else {
    Add-Result "Passport-dependent modules" "Existing Passport ID" "WARN" "Pass -PassportId '<real-id>' to test passport, snapshot and proof lookups."
}

# 6. Frontend-to-backend endpoint inventory
$frontendFiles = Get-ChildItem $FrontendPath -Recurse -File -Include *.ts,*.tsx -ErrorAction SilentlyContinue
$backendFiles = Get-ChildItem $BackendPath -Recurse -File -Include *Controller.java -ErrorAction SilentlyContinue
if ($frontendFiles.Count -gt 0 -and $backendFiles.Count -gt 0) {
    $frontendText = ($frontendFiles | ForEach-Object { Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue }) -join "`n"
    $backendText = ($backendFiles | ForEach-Object { Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue }) -join "`n"

    $routes = @(
        @{ Name="Health"; Pattern='/api/health'; Verb="GET" },
        @{ Name="Blockchain status"; Pattern='/api/blockchain/status'; Verb="GET" },
        @{ Name="Passport create"; Pattern='/api/passports'; Verb="POST" },
        @{ Name="Passport lookup"; Pattern='/api/passports/\$\{encodeURIComponent'; Verb="GET" },
        @{ Name="Verification"; Pattern='/api/verify'; Verb="POST" },
        @{ Name="Snapshots"; Pattern='/snapshots'; Verb="GET/POST" },
        @{ Name="Proof bundle"; Pattern='/api/proofs'; Verb="GET" },
        @{ Name="Execution receipt"; Pattern='/execution'; Verb="POST" },
        @{ Name="SSE stream"; Pattern='/api/stream'; Verb="GET" }
    )

    foreach ($route in $routes) {
        $inFrontend = $frontendText -match [regex]::Escape($route.Pattern)
        $inBackend = $backendText -match [regex]::Escape(($route.Pattern -replace '/\$\{encodeURIComponent.*',''))
        if ($inFrontend -and $inBackend) {
            Add-Result "API contract" $route.Name "PASS" "Route pattern appears in frontend and backend. Confirm verb and payload in module review."
        } elseif ($inFrontend) {
            Add-Result "API contract" $route.Name "WARN" "Referenced in frontend; backend controller match not confirmed by this simple scan."
        } else {
            Add-Result "API contract" $route.Name "WARN" "No literal route match; may be composed dynamically."
        }
    }
} else {
    Add-Result "API contract" "Source inventory" "WARN" "Could not find both frontend TS/TSX and backend controller Java files. Check paths and archive structure."
}

# 7. Summary
Write-Host "`n==================== SUMMARY ====================" -ForegroundColor Cyan
$results | Format-Table -AutoSize -Wrap
$failed = @($results | Where-Object Status -eq "FAIL").Count
$warned = @($results | Where-Object Status -eq "WARN").Count
Write-Host "FAIL: $failed   WARN: $warned   PASS: $(@($results | Where-Object Status -eq 'PASS').Count)" -ForegroundColor Cyan
Write-Host "`nNote: This is a safe smoke/structure test. It does not prove button-level UI behavior, wallet signing, verifier correctness, or on-chain transaction execution."
