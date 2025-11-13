# PowerShell script to build Docker image with build args from .env.local
# Usage: .\docker-build.ps1

Write-Host "Loading environment variables from .env.local..." -ForegroundColor Cyan

if (!(Test-Path ".env.local")) {
    Write-Host "Error: .env.local not found!" -ForegroundColor Red
    exit 1
}

# Parse .env.local and extract NEXT_PUBLIC_ vars
$envVars = @{}
Get-Content ".env.local" | ForEach-Object {
    if ($_ -match '^(NEXT_PUBLIC_[^=]+)=(.+)$') {
        $envVars[$matches[1]] = $matches[2]
    }
}

# Build the docker build command with build args
$buildArgs = @()
foreach ($key in $envVars.Keys) {
    $buildArgs += "--build-arg"
    $buildArgs += "$key=$($envVars[$key])"
    Write-Host "  Using $key" -ForegroundColor Gray
}

Write-Host "`nBuilding Docker image..." -ForegroundColor Cyan
& docker build @buildArgs -t job-board:prod -f Dockerfile .

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild successful! Image tagged as job-board:prod" -ForegroundColor Green
    Write-Host "To run: docker run --rm -p 3000:3000 --env-file .env.local job-board:prod" -ForegroundColor Yellow
} else {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}
