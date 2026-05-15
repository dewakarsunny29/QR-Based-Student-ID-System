$result = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/settings" -Method Get
$result | ConvertTo-Json
