$ErrorActionPreference = "Stop"

$root = Join-Path $PSScriptRoot "dev-certs"
if (-not (Test-Path $root)) {
    New-Item -ItemType Directory -Path $root | Out-Null
}

$services = @(
    "api-gateway",
    "auth-service",
    "booking-service",
    "payment-service",
    "user-service",
    "review-service",
    "driver-service",
    "notification-service",
    "ride-service",
    "eta-service",
    "pricing-service"
)

function Write-PemFile {
    param(
        [Parameter(Mandatory = $true)] [string] $Path,
        [Parameter(Mandatory = $true)] [string] $Label,
        [Parameter(Mandatory = $true)] [byte[]] $Bytes
    )

    $base64 = [Convert]::ToBase64String($Bytes)
    $lines = ($base64 -split "(.{1,64})" | Where-Object { $_ })
    $content = @(
        "-----BEGIN $Label-----"
        $lines
        "-----END $Label-----"
        ""
    ) -join [Environment]::NewLine

    Set-Content -Path $Path -Value $content -NoNewline
}

function New-SerialNumber {
    $bytes = New-Object byte[] 16
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return $bytes
}

function New-CertificateDirectory {
    param([string] $ServiceName)
    $path = Join-Path $root $ServiceName
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
    }
    return $path
}

$hashAlgorithm = [System.Security.Cryptography.HashAlgorithmName]::SHA256
$signaturePadding = [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
$serverAuthOid = [System.Security.Cryptography.Oid]::new("1.3.6.1.5.5.7.3.1", "Server Authentication")
$clientAuthOid = [System.Security.Cryptography.Oid]::new("1.3.6.1.5.5.7.3.2", "Client Authentication")
$eku = [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new(
    [System.Security.Cryptography.OidCollection]::new(),
    $false
)
$eku.EnhancedKeyUsages.Add($serverAuthOid)
$eku.EnhancedKeyUsages.Add($clientAuthOid)

$caKey = [System.Security.Cryptography.RSA]::Create(4096)
$caReq = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    "CN=CAB Internal Dev CA",
    $caKey,
    $hashAlgorithm,
    $signaturePadding
)
$caReq.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $false, 0, $true)
)
$caReq.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
        [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign `
        -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::CrlSign,
        $true
    )
)
$caReq.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($caReq.PublicKey, $false)
)

$caNotBefore = [DateTimeOffset]::UtcNow.AddDays(-1)
$caNotAfter = $caNotBefore.AddYears(5)
$caCert = $caReq.CreateSelfSigned($caNotBefore, $caNotAfter)
$caPfx = $caCert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx)
$caCert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
    $caPfx,
    $null,
    [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
)

Write-PemFile -Path (Join-Path $root "ca.crt") -Label "CERTIFICATE" -Bytes $caCert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
Write-PemFile -Path (Join-Path $root "ca.key") -Label "PRIVATE KEY" -Bytes $caKey.ExportPkcs8PrivateKey()

foreach ($service in $services) {
    $serviceDir = New-CertificateDirectory -ServiceName $service
    $serviceKey = [System.Security.Cryptography.RSA]::Create(2048)
    $req = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
        "CN=$service",
        $serviceKey,
        $hashAlgorithm,
        $signaturePadding
    )

    $req.CertificateExtensions.Add(
        [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true)
    )
    $req.CertificateExtensions.Add(
        [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
            [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature `
            -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment,
            $true
        )
    )
    $req.CertificateExtensions.Add($eku)
    $req.CertificateExtensions.Add(
        [System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($req.PublicKey, $false)
    )

    $sanBuilder = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
    $sanBuilder.AddDnsName($service)
    $sanBuilder.AddDnsName("localhost")
    $req.CertificateExtensions.Add($sanBuilder.Build())

    $cert = $req.Create(
        $caCert,
        [DateTimeOffset]::UtcNow.AddDays(-1),
        [DateTimeOffset]::UtcNow.AddYears(2),
        (New-SerialNumber)
    )

    Write-PemFile -Path (Join-Path $serviceDir "tls.crt") -Label "CERTIFICATE" -Bytes $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    Write-PemFile -Path (Join-Path $serviceDir "tls.key") -Label "PRIVATE KEY" -Bytes $serviceKey.ExportPkcs8PrivateKey()
}

Write-Host "Generated development mTLS certificates under $root"
