$body = @{
    email = "dewakarsunny29@gmail.com"
    password = "admin123"
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$result | ConvertTo-Json
