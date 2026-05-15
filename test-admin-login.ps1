$body = @{
    email = "dewakarsunny29@gmail.com"
    password = "admin123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/admin/login" -Method Post -Body $body -ContentType "application/json"
$response | ConvertTo-Json

# Check settings after admin login
Write-Host "`n=== Settings After Admin Login ===" -ForegroundColor Yellow
$settings = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/settings" -Method Get
$settings | ConvertTo-Json
