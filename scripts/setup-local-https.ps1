param(
  [string]$LanIp
)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$certificateDirectory = Join-Path $projectDirectory '.local-certs'

if (-not $LanIp) {
  $network = Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } |
    Sort-Object { $_.NetAdapter.InterfaceMetric } |
    Select-Object -First 1
  if (-not $network) {
    throw 'No active local network with an IPv4 address was found.'
  }
  $LanIp = $network.IPv4Address.IPAddress
}

if ($LanIp -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {
  throw "The supplied LAN IP is not valid: $LanIp"
}

$openSslCommand = Get-Command 'openssl.exe' -ErrorAction SilentlyContinue
if ($openSslCommand) {
  $openSsl = $openSslCommand.Source
} else {
  $gitOpenSsl = 'C:\Program Files\Git\usr\bin\openssl.exe'
  if (-not (Test-Path -LiteralPath $gitOpenSsl)) {
    throw 'OpenSSL was not found. Install Git for Windows and run this command again.'
  }
  $openSsl = $gitOpenSsl
}

New-Item -ItemType Directory -Force -Path $certificateDirectory | Out-Null
$caKey = Join-Path $certificateDirectory 'local-ca.key'
$caCertificate = Join-Path $certificateDirectory 'local-ca.crt'
$serverKey = Join-Path $certificateDirectory 'server.key'
$serverRequest = Join-Path $certificateDirectory 'server.csr'
$serverCertificate = Join-Path $certificateDirectory 'server.crt'
$serverChain = Join-Path $certificateDirectory 'server-chain.crt'
$extensionFile = Join-Path $certificateDirectory 'server-extensions.cnf'

if (-not (Test-Path -LiteralPath $caCertificate)) {
  & $openSsl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes `
    -keyout $caKey -out $caCertificate -subj '/CN=TDCON Local CA' `
    -addext 'basicConstraints=critical,CA:TRUE' `
    -addext 'keyUsage=critical,keyCertSign,cRLSign'
  if ($LASTEXITCODE -ne 0) { throw 'The local certificate authority could not be created.' }
}

@"
subjectAltName=IP:$LanIp,IP:127.0.0.1,DNS:localhost
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
"@ | Set-Content -LiteralPath $extensionFile -Encoding ascii

& $openSsl req -newkey rsa:2048 -sha256 -nodes `
  -keyout $serverKey -out $serverRequest -subj "/CN=$LanIp"
if ($LASTEXITCODE -ne 0) { throw 'The local server certificate request could not be created.' }

& $openSsl x509 -req -in $serverRequest -CA $caCertificate -CAkey $caKey `
  -CAcreateserial -out $serverCertificate -days 825 -sha256 -extfile $extensionFile
if ($LASTEXITCODE -ne 0) { throw 'The local server certificate could not be signed.' }

Get-Content -LiteralPath $serverCertificate, $caCertificate |
  Set-Content -LiteralPath $serverChain -Encoding ascii
$LanIp | Set-Content -LiteralPath (Join-Path $certificateDirectory 'lan-ip.txt') -Encoding ascii

Write-Output ''
Write-Output 'Local HTTPS is ready.'
Write-Output "Address for the Android device: https://${LanIp}:8443"
Write-Output "Certificate to install on Android: $caCertificate"
Write-Output 'Reserve this IP address in the router before creating production records.'
