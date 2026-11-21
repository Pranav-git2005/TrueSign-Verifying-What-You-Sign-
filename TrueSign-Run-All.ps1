[CmdletBinding()]
param(
  [string]$ProjectRoot = (Split-Path -Parent $MyInvocation.MyCommand.Path),
  [string]$RpcUrl = 'http://127.0.0.1:8545',
  [switch]$InstallDependencies
)
$ErrorActionPreference = 'Continue'
$report = Join-Path $ProjectRoot 'truesign-test-report.txt'
$results = [System.Collections.Generic.List[string]]::new()
function Run-Step([string]$Name, [scriptblock]$Command) {
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  try { & $Command 2>&1 | Tee-Object -FilePath $report -Append; if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) { $script:results.Add("PASS: $Name") } else { $script:results.Add("FAIL: $Name (exit $LASTEXITCODE)") } }
  catch { $script:results.Add("FAIL: $Name ($($_.Exception.Message))"); Write-Host $_ -ForegroundColor Red }
}
"TrueSign test run: $(Get-Date -Format o)" | Set-Content $report
if (!(Test-Path (Join-Path $ProjectRoot 'frontend/package.json'))) { throw 'frontend/package.json not found' }
if (!(Test-Path (Join-Path $ProjectRoot 'backend/pom.xml'))) { throw 'backend/pom.xml not found' }
if (!(Test-Path (Join-Path $ProjectRoot 'contracts/foundry.toml'))) { throw 'contracts/foundry.toml not found' }
if ($InstallDependencies) {
  Run-Step 'Frontend npm ci' { Push-Location "$ProjectRoot/frontend"; npm ci; Pop-Location }
}
Run-Step 'Frontend TypeScript + Vite build' { Push-Location "$ProjectRoot/frontend"; npm run build; Pop-Location }
Run-Step 'Frontend ESLint' { Push-Location "$ProjectRoot/frontend"; npm run lint; Pop-Location }
Run-Step 'Backend Maven tests' { Push-Location "$ProjectRoot/backend"; .\mvnw.cmd -B test; Pop-Location }
Run-Step 'Foundry contract tests' { Push-Location "$ProjectRoot/contracts"; forge test -vv; Pop-Location }
try {
  $rpc = Invoke-RestMethod -Method Post -Uri $RpcUrl -ContentType 'application/json' -Body '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' -TimeoutSec 4
  if ($rpc.result -eq '0x7a69') { $results.Add('PASS: Anvil RPC reachable (chainId 31337)') } else { $results.Add("WARN: RPC reachable but chainId is $($rpc.result), expected 0x7a69") }
} catch { $results.Add("SKIP: Anvil RPC check ($($_.Exception.Message))") }
$results | Tee-Object -FilePath $report -Append
Write-Host "`nReport: $report" -ForegroundColor Yellow
if ($results | Where-Object { $_ -like 'FAIL:*' }) { exit 1 } else { exit 0 }
