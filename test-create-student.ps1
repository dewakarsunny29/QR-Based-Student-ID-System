# Create a test student
Write-Host "=== Creating Test Student ===" -ForegroundColor Cyan

$studentBody = @{
    name = "Test Student"
    email = "test@student.com"
    password = "test123"
    rollNumber = "STU001"
    department = "Computer Science"
    year = 1
    mobileNumber = "1234567890"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method Post -Body $studentBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "Student created: $($response.name)" -ForegroundColor Green
    Write-Host "Student ID: $($response.studentId)"
    Write-Host "QR Code: $($response.qrCode.Substring(0, 50))..."
} catch {
    Write-Host "Student might already exist or error: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Now test student login
Write-Host "`n=== Testing Student Login ===" -ForegroundColor Cyan

$loginBody = @{
    email = "test@student.com"
    password = "test123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "SUCCESS: Student logged in!" -ForegroundColor Green
    Write-Host "Name: $($loginResponse.name)"
    Write-Host "Student ID: $($loginResponse.studentId)"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
