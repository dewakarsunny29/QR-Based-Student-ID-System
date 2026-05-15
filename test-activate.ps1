$loginBody = @{
    email = "dewakarsunny29@gmail.com"
    password = "admin123"
} | ConvertTo-Json

$loginResult = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginResult.token

Write-Host "Login successful, token received"

# Now verify admin (activate system)
$verifyBody = @{
    verificationCode = "ADMIN2024"
} | ConvertTo-Json

$verifyResult = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/admin/verify" -Method Post -Body $verifyBody -ContentType "application/json" -Headers @{Authorization = "Bearer $token"}
$verifyResult | ConvertTo-Json
