$ErrorActionPreference = 'Stop'

$repository = 'D:\Universidad\SW1\Grupal'
$key = 'C:\Users\LENOVO\.ssh\ficct-aws-deploy.pem'
$cloudflared = 'D:\Universidad\Taller de Grado I\ficct\.tools\cloudflared.exe'
$tunnelConfig = 'C:\Users\LENOVO\.cloudflared\tiluchirecords-aws.yml'
$instance = 'i-0700e5f68fff2c127'
$awsProfile = 'tiluchi-ip-updater'

# Keep the EC2 ingress limited to this network before reconnecting SSH.
$network = & (Join-Path $PSScriptRoot 'sync-network.ps1') -AwsProfile $awsProfile
$knownIpPath = Join-Path $PSScriptRoot 'instance-ip.txt'
$ip = if (Test-Path $knownIpPath) { (Get-Content $knownIpPath -Raw).Trim() } else { $null }
try {
    $currentIp = (& aws ec2 describe-instances --profile $awsProfile --region us-east-1 --instance-ids $instance --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>$null)
    if ($LASTEXITCODE -eq 0 -and $currentIp -and $currentIp.Trim() -ne 'None') {
        $ip = $currentIp.Trim()
        Set-Content -LiteralPath $knownIpPath -Value $ip -NoNewline
    }
} catch {
    # The cached EC2 address is safe while the instance has not been replaced.
}
if (-not $ip -or $ip -eq 'None') { throw 'La instancia EC2 no tiene IP publica.' }

$bridge = Get-CimInstance Win32_Process -Filter "name='ssh.exe'" | Where-Object { $_.CommandLine -like '*127.0.0.1:18080:127.0.0.1:18080*' }
$bridgeHealthy = $false
if ($bridge -and -not $network.Changed -and $bridge.CommandLine -like "*ec2-user@$ip*") {
    try {
        $web = Invoke-WebRequest -Uri 'http://127.0.0.1:18080/' -UseBasicParsing -TimeoutSec 5
        $media = Invoke-WebRequest -Uri 'http://127.0.0.1:19000/minio/health/live' -UseBasicParsing -TimeoutSec 5
        $bridgeHealthy = $web.StatusCode -eq 200 -and $media.StatusCode -eq 200
    } catch {
        $bridgeHealthy = $false
    }
}
if ($bridge -and -not $bridgeHealthy) {
    $bridge | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    Start-Sleep -Seconds 1
    $bridge = $null
}
if (-not $bridge) {
    $arguments = "-N -i `"$key`" -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:18080:127.0.0.1:18080 -L 127.0.0.1:19000:127.0.0.1:19000 -L 127.0.0.1:16379:127.0.0.1:16379 ec2-user@$ip"
    Start-Process -FilePath 'C:\Windows\System32\OpenSSH\ssh.exe' -ArgumentList $arguments -WindowStyle Hidden
}

for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $openPorts = @(Get-NetTCPConnection -LocalPort 18080, 19000, 16379 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort)
    if (@($openPorts | Select-Object -Unique).Count -eq 3) { break }
    Start-Sleep -Seconds 1
}
if (@($openPorts | Select-Object -Unique).Count -ne 3) { throw 'El reenvio SSH no abrio los tres puertos locales.' }

$tunnel = Get-CimInstance Win32_Process -Filter "name='cloudflared.exe'" | Where-Object { $_.CommandLine -like '*tiluchirecords-aws.yml*' }
if (-not $tunnel) {
    Start-Process -FilePath $cloudflared -ArgumentList "tunnel --config `"$tunnelConfig`" run" -WindowStyle Hidden
}

if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe' -WindowStyle Hidden
}

for ($attempt = 0; $attempt -lt 60; $attempt++) {
    & docker info --format '{{.ServerVersion}}' *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 5
}
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop no inicio.' }

Push-Location $repository
try {
    & docker compose --env-file deploy/ec2/.env -f deploy/local-ai/compose.yml up -d --no-build
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el worker de IA.' }
} finally {
    Pop-Location
}
