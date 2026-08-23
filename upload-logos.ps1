# Upload des logos restaurants vers le storage du backend + rattachement aux commerces
$ErrorActionPreference = "Continue"
$API = "https://api.fasofree.site/api/v1"
$ASSETS = Join-Path $PSScriptRoot "fasofree-frontend-client\public\assets"

$merchants = @(
  @{ Email = "cesar@fasofree.bf";     Password = "Merchant@12345"; Logo = Join-Path $ASSETS "cesar.jpeg" },
  @{ Email = "gusto@fasofree.bf";     Password = "Merchant@12345"; Logo = Join-Path $ASSETS "gusto.jpeg" },
  @{ Email = "belchiken@fasofree.bf"; Password = "Merchant@12345"; Logo = Join-Path $ASSETS "belchicken.jpeg" }
)

foreach ($m in $merchants) {
  Write-Host "`n=== $($m.Email) ===" -ForegroundColor Cyan
  try {
    # 1. Login
    $login = Invoke-RestMethod -Method Post -Uri "$API/auth/login" -ContentType "application/json" -Body (@{ email = $m.Email; password = $m.Password } | ConvertTo-Json)
    $token = $login.access_token
    if (-not $token -and $login.result) { $token = $login.result.access_token }
    if (-not $token) { Write-Host "  Login OK mais pas de token." -ForegroundColor Yellow; continue }
    $headers = @{ Authorization = "Bearer $token" }

    # 2. Commerce du marchand
    $biz = Invoke-RestMethod -Method Get -Uri "$API/businesses/me" -Headers $headers
    if (-not $biz -or -not $biz.id) { Write-Host "  Aucun commerce trouve pour ce compte." -ForegroundColor Yellow; continue }
    Write-Host "  Commerce : $($biz.name) ($($biz.id))"

    # 3. Upload du logo via curl.exe (multipart)
    $tmp = New-TemporaryFile
    curl.exe -s -X POST "$API/uploads/image?folder=logos" -H "Authorization: Bearer $token" -F "file=@$($m.Logo)" -o $tmp.FullName
    $up = Get-Content $tmp.FullName -Raw | ConvertFrom-Json
    Remove-Item $tmp.FullName -ErrorAction SilentlyContinue
    $url = $up.url
    if (-not $url) { Write-Host "  Upload sans URL. Reponse: $($tmpContent)" -ForegroundColor Yellow; continue }
    Write-Host "  Logo uploade : $url"

    # 4. Rattachement au commerce (logo + coverImage)
    $body = @{ logo = $url; coverImage = $url } | ConvertTo-Json
    $updated = Invoke-RestMethod -Method Patch -Uri "$API/businesses/$($biz.id)" -Headers $headers -ContentType "application/json" -Body $body
    Write-Host "  Commerce mis a jour. logo = $($updated.logo)" -ForegroundColor Green
  }
  catch {
    Write-Host "  ERREUR : $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) { Write-Host "  Detail : $($_.ErrorDetails.Message)" -ForegroundColor Red }
  }
}

Write-Host "`nNote : Chitir Chicken n'a pas de compte marchand dans le seed -> non traite (le fallback frontend /assets/chitirchiken.jpeg reste actif)."
