$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

$secretPath = Join-Path $env:LOCALAPPDATA 'TiluchiRecords\roaming-ip-credential.bin'
if (-not (Test-Path -LiteralPath $secretPath)) { throw 'No se encontro la credencial AWS protegida.' }

$encrypted = [IO.File]::ReadAllBytes($secretPath)
$plaintext = [Security.Cryptography.ProtectedData]::Unprotect(
    $encrypted,
    $null,
    [Security.Cryptography.DataProtectionScope]::CurrentUser
)
try {
    $credential = [Text.Encoding]::UTF8.GetString($plaintext) | ConvertFrom-Json
    @{
        Version = 1
        AccessKeyId = $credential.AccessKeyId
        SecretAccessKey = $credential.SecretAccessKey
    } | ConvertTo-Json -Compress
} finally {
    [Array]::Clear($plaintext, 0, $plaintext.Length)
}
