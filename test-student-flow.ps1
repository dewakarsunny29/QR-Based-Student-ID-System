# Test student login BEFORE admin login (should fail)
Write-Host "=== Testing Student Login BEFORE Admin Login ===" -ForegroundColor Yellow

$body = @{
    email = "test@student.com"
    password = "test123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Host "SUCCESS: Student logged in (unexpected!)" -ForegroundColor Red
} catch {
    Write-Host "Expected Error: $($_.Exception.Response.StatusDescription)" -ForegroundColor Green
}

# Check settings
Write-Host "`n=== Current Settings ===" -ForegroundColor Yellow
$settings = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/settings" -Method Get
$settings | ConvertTo-Json
