# Test 1: Check initial settings
Write-Host "=== STEP 1: Initial System Settings ===" -ForegroundColor Cyan
$settings = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/settings" -Method Get
Write-Host "System Activated: $($settings.systemActivated)"
Write-Host "Student Login Enabled: $($settings.studentLoginEnabled)"

# Test 2: Try student login (should fail)
Write-Host "`n=== STEP 2: Student Login (Should FAIL - System not activated) ===" -ForegroundColor Cyan
$studentBody = @{
    email = "test@student.com"
    password = "test123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $studentBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "ERROR: Student logged in (unexpected!)" -ForegroundColor Red
} catch {
    Write-Host "SUCCESS: Student login blocked - $($_.Exception.Response.StatusDescription)" -ForegroundColor Green
}

# Test 3: Admin Login
Write-Host "`n=== STEP 3: Admin Login ===" -ForegroundColor Cyan
$adminBody = @{
    email = "dewakarsunny29@gmail.com"
    password = "admin123"
} | ConvertTo-Json

$adminResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/admin/login" -Method Post -Body $adminBody -ContentType "application/json"
Write-Host "Admin logged in: $($adminResponse.name)"
$adminToken = $adminResponse.token

# Test 4: Check settings after admin login
Write-Host "`n=== STEP 4: System Settings After Admin Login ===" -ForegroundColor Cyan
$settingsAfter = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/settings" -Method Get
Write-Host "System Activated: $($settingsAfter.systemActivated)"
Write-Host "Student Login Enabled: $($settingsAfter.studentLoginEnabled)"

# Test 5: Try student login again (should succeed now)
Write-Host "`n=== STEP 5: Student Login (Should SUCCEED - System activated) ===" -ForegroundColor Cyan
try {
    $studentResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $studentBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "SUCCESS: Student logged in: $($studentResponse.name)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Student login failed - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== FULL FLOW TEST COMPLETE ===" -ForegroundColor Yellow
