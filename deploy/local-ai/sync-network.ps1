param(
    [string]$AwsProfile = 'tiluchi-ip-updater',
    [string]$Region = 'us-east-1',
    [string]$SecurityGroupId = 'sg-05afa6121d3cb88d6'
)

$ErrorActionPreference = 'Stop'

function Get-PublicIPv4 {
    $addresses = @()
    foreach ($endpoint in @('https://checkip.amazonaws.com', 'https://api.ipify.org')) {
        try {
            $candidate = ([string](Invoke-RestMethod -Uri $endpoint -TimeoutSec 8)).Trim()
            $parsed = $null
            if ([Net.IPAddress]::TryParse($candidate, [ref]$parsed) -and
                $parsed.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork -and
                -not [Net.IPAddress]::IsLoopback($parsed)) {
                $addresses += $candidate
            }
        } catch {
            # A second independent endpoint is available.
        }
    }
    $addresses = @($addresses | Select-Object -Unique)
    if ($addresses.Count -ne 1) { throw 'No se pudo determinar una sola IP publica IPv4 confiable.' }
    return $addresses[0]
}

function Invoke-AwsJson {
    param([string[]]$Arguments)
    $output = & aws @Arguments --profile $AwsProfile --region $Region --output json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI fallo: $($output -join ' ')" }
    return ($output -join "`n" | ConvertFrom-Json)
}

$publicIp = Get-PublicIPv4
$ruleResponse = Invoke-AwsJson -Arguments @('ec2', 'describe-security-group-rules', '--filters', "Name=group-id,Values=$SecurityGroupId")
$sshRules = @($ruleResponse.SecurityGroupRules | Where-Object {
    -not $_.IsEgress -and $_.IpProtocol -eq 'tcp' -and $_.FromPort -eq 22 -and $_.ToPort -eq 22 -and $_.CidrIpv4
})
if ($sshRules.Count -ne 1) { throw "Se esperaba una sola regla SSH IPv4 en $SecurityGroupId; se encontraron $($sshRules.Count)." }

$rule = $sshRules[0]
$desiredCidr = "$publicIp/32"
$changed = $rule.CidrIpv4 -ne $desiredCidr
if ($changed) {
    $updatedRule = @{
        IpProtocol = 'tcp'
        FromPort = 22
        ToPort = 22
        CidrIpv4 = $desiredCidr
        Description = if ($rule.Description) { $rule.Description } else { 'TiluchiRecords SSH bridge' }
    }
    $request = @{
        GroupId = $SecurityGroupId
        SecurityGroupRules = @(@{
            SecurityGroupRuleId = $rule.SecurityGroupRuleId
            SecurityGroupRule = $updatedRule
        })
    }
    $requestPath = Join-Path ([IO.Path]::GetTempPath()) ("tiluchi-sg-$([guid]::NewGuid().ToString('N')).json")
    try {
        [IO.File]::WriteAllText($requestPath, ($request | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
        $response = Invoke-AwsJson -Arguments @('ec2', 'modify-security-group-rules', '--cli-input-json', "file://$requestPath")
        if (-not $response.Return) { throw 'AWS no confirmo el cambio de regla SSH.' }
    } finally {
        Remove-Item -LiteralPath $requestPath -ErrorAction SilentlyContinue
    }
    $verified = $false
    for ($attempt = 0; $attempt -lt 5; $attempt++) {
        Start-Sleep -Seconds 2
        $check = Invoke-AwsJson -Arguments @('ec2', 'describe-security-group-rules', '--security-group-rule-ids', $rule.SecurityGroupRuleId)
        if ($check.SecurityGroupRules[0].CidrIpv4 -eq $desiredCidr) { $verified = $true; break }
    }
    if (-not $verified) { throw 'La nueva IP SSH no pudo verificarse en AWS.' }
}

[pscustomobject]@{
    PublicIp = $publicIp
    Cidr = $desiredCidr
    RuleId = $rule.SecurityGroupRuleId
    Changed = $changed
}
