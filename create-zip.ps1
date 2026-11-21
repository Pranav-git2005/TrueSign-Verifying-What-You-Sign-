$ErrorActionPreference = "Stop"

$Source = "D:\Hackathon\TrueSign"
$ZipFile = "D:\Hackathon\TrueSign-upload.zip"
$Stage = Join-Path $env:TEMP "TrueSign-Zip-Staging"

Write-Host "Preparing TrueSign project..." -ForegroundColor Cyan

if (!(Test-Path $Source)) {
    throw "Project folder not found: $Source"
}

if (Test-Path $Stage) {
    Remove-Item $Stage -Recurse -Force
}

if (Test-Path $ZipFile) {
    Remove-Item $ZipFile -Force
}

New-Item -ItemType Directory -Path $Stage -Force | Out-Null

robocopy $Source $Stage /E `
    /XD node_modules target out cache .git dist .vite `
    /XF .env .env.local .env.development.local `
        application-local.properties `
        *.jks *.keystore

if ($LASTEXITCODE -ge 8) {
    throw "Project copy failed."
}

Compress-Archive -Path "$Stage\*" `
    -DestinationPath $ZipFile `
    -CompressionLevel Optimal

Remove-Item $Stage -Recurse -Force

Write-Host "ZIP created successfully!" -ForegroundColor Green
Write-Host $ZipFile -ForegroundColor Yellow
