$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
$evidenceDir = Join-Path $root 'evidencias'

if (-not (Test-Path -LiteralPath $envFile)) {
  throw 'No existe el archivo .env. Copia .env.example y configura los valores.'
}

New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null

$config = @{}
Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $key = $Matches[1]
    $value = $Matches[2].Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $config[$key] = $value
  }
}

$port = if ($config['PORT']) { [int]$config['PORT'] } else { 3000 }
$baseUrl = "http://127.0.0.1:$port"
$usuario = $config['APP_USER']
$password = $config['APP_PASSWORD']

if (-not $usuario -or -not $password) {
  throw 'APP_USER y APP_PASSWORD son obligatorios en .env.'
}

$dbUri = [System.Uri]$config['DATABASE_URL']
$dbUser = [System.Uri]::UnescapeDataString($dbUri.UserInfo.Split(':')[0])
$dbPass = [System.Uri]::UnescapeDataString($dbUri.UserInfo.Split(':')[1])
$dbHost = $dbUri.Host
$dbPort = if ($dbUri.Port -gt 0) { $dbUri.Port } else { 5432 }
$dbName = [System.Uri]::UnescapeDataString($dbUri.AbsolutePath.TrimStart('/'))

$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
  $candidate = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
  if (Test-Path -LiteralPath $candidate) { $psql = $candidate }
}
if (-not $psql) { throw 'No se encontro psql. Agrega PostgreSQL al PATH.' }

function Wait-PortOpen {
  param([int]$Port, [int]$Intentos = 50)
  for ($i = 0; $i -lt $Intentos; $i++) {
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $client.Connect('127.0.0.1', $Port)
      $client.Close()
      return $true
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }
  return $false
}

function Wait-PortClosed {
  param([int]$Port, [int]$Intentos = 50)
  for ($i = 0; $i -lt $Intentos; $i++) {
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $client.Connect('127.0.0.1', $Port)
      $client.Close()
      Start-Sleep -Milliseconds 200
    } catch {
      return $true
    }
  }
  return $false
}

function Start-Api {
  $outLog = Join-Path $evidenceDir 'servidor.log'
  $errLog = Join-Path $evidenceDir 'servidor-error.log'
  $proc = Start-Process -FilePath (Get-Command node).Source `
    -ArgumentList 'src/server.js' `
    -WorkingDirectory $root `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog

  if (-not (Wait-PortOpen -Port $port)) {
    if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
    throw "El servidor no respondio en el puerto $port. Revisa evidencias/servidor-error.log."
  }

  return $proc
}

function Stop-Api {
  param($Process)
  if ($Process -and -not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force
    Wait-Process -Id $Process.Id -ErrorAction SilentlyContinue
  }
  [void](Wait-PortClosed -Port $port)
}

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [string]$Token = ''
  )

  $headers = @{}
  if ($Token) { $headers['Authorization'] = "Bearer $Token" }

  $params = @{
    Uri = "$baseUrl$Path"
    Method = $Method
    Headers = $headers
  }

  if ($null -ne $Body) {
    $params['ContentType'] = 'application/json'
    $params['Body'] = ($Body | ConvertTo-Json -Compress)
  }

  return Invoke-RestMethod @params
}

function Query-Db {
  param([string]$Sql)
  $anterior = $env:PGPASSWORD
  $env:PGPASSWORD = $dbPass
  try {
    return (& $psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -tA -c $Sql 2>&1)
  } finally {
    $env:PGPASSWORD = $anterior
  }
}

if (Wait-PortOpen -Port $port -Intentos 1) {
  throw "El puerto $port ya esta en uso. Deten el servidor que esta ejecutandose y vuelve a intentar."
}

$servidor = $null

try {
  Write-Output '============================================================'
  Write-Output 'EVIDENCIA DE PERSISTENCIA - API LIBROS + POSTGRESQL + JWT'
  Write-Output "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  Write-Output "Base de datos: $dbName en $dbHost`:$dbPort"
  Write-Output '============================================================'
  Write-Output ''

  Write-Output '[1] Iniciando servidor Node.js...'
  $servidor = Start-Api
  Write-Output "Servidor disponible en $baseUrl"
  Write-Output ''

  Write-Output '[2] POST /auth/login con credenciales validas'
  $login = Invoke-Api -Method 'POST' -Path '/auth/login' -Body @{ usuario = $usuario; password = $password }
  Write-Output "HTTP 200 | usuario: $($login.usuario) | tokenType: $($login.tokenType) | expira: $($login.expiresIn)"
  Write-Output "Token JWT recibido (longitud: $($login.token.Length) caracteres). No se imprime el token."
  $token = $login.token
  Write-Output ''

  Write-Output '[3] POST /libros con JWT (creacion)'
  $creado = Invoke-Api -Method 'POST' -Path '/libros' -Token $token -Body @{
    titulo = 'El principito'
    autor = 'Antoine de Saint-Exupery'
    anio = 1943
  }
  Write-Output 'HTTP 201 | Respuesta JSON:'
  Write-Output ($creado | ConvertTo-Json -Depth 5)
  $id = $creado.id
  Write-Output ''
  Write-Output '[4] Consulta directa a PostgreSQL despues de crear:'
  Write-Output (Query-Db "SELECT id, titulo, autor, anio FROM libros WHERE id = $id;")
  Write-Output ''

  Write-Output '[5] PUT /libros/:id con JWT (actualizacion de titulo y anio)'
  $actualizado = Invoke-Api -Method 'PUT' -Path "/libros/$id" -Token $token -Body @{
    titulo = 'El principito (edicion revisada)'
    anio = 1945
  }
  Write-Output 'HTTP 200 | Respuesta JSON:'
  Write-Output ($actualizado | ConvertTo-Json -Depth 5)
  Write-Output ''
  Write-Output '[6] Consulta directa a PostgreSQL despues de actualizar:'
  Write-Output (Query-Db "SELECT id, titulo, autor, anio, actualizado_en FROM libros WHERE id = $id;")
  Write-Output ''

  Write-Output '[7] Reiniciando el servidor Node.js...'
  Stop-Api -Process $servidor
  $servidor = $null
  $servidor = Start-Api
  Write-Output 'Servidor reiniciado.'
  Write-Output ''

  Write-Output '[8] GET /libros/:id despues del reinicio, con el mismo JWT'
  $persistido = Invoke-Api -Method 'GET' -Path "/libros/$id" -Token $token
  Write-Output 'HTTP 200 | El registro sigue almacenado:'
  Write-Output ($persistido | ConvertTo-Json -Depth 5)
  Write-Output ''
  Write-Output '[9] Consulta directa a PostgreSQL despues del reinicio:'
  Write-Output (Query-Db "SELECT id, titulo, autor, anio FROM libros WHERE id = $id;")
  Write-Output ''

  Write-Output '[10] GET /libros/:id sin token (debe rechazarse sin tocar la base de datos)'
  try {
    $sinToken = Invoke-Api -Method 'GET' -Path "/libros/$id"
    Write-Output "HTTP 200 inesperado: $($sinToken | ConvertTo-Json -Compress)"
  } catch {
    $status = [int]$_.Exception.Response.StatusCode
    Write-Output "HTTP $status | Peticion rechazada."
  }
  Write-Output ''

  Write-Output '[11] DELETE /libros/:id con JWT'
  $eliminado = Invoke-Api -Method 'DELETE' -Path "/libros/$id" -Token $token
  Write-Output 'HTTP 200 | Respuesta JSON:'
  Write-Output ($eliminado | ConvertTo-Json -Depth 5)
  Write-Output ''
  Write-Output '[12] Consulta directa a PostgreSQL despues de eliminar:'
  Write-Output (Query-Db "SELECT COUNT(*) AS registros_restantes FROM libros WHERE id = $id;")
  Write-Output ''

  Write-Output '[13] GET /libros/:id despues de eliminar (debe responder 404)'
  try {
    $consultaFinal = Invoke-Api -Method 'GET' -Path "/libros/$id" -Token $token
    Write-Output "HTTP 200 inesperado: $($consultaFinal | ConvertTo-Json -Compress)"
  } catch {
    $status = [int]$_.Exception.Response.StatusCode
    Write-Output "HTTP $status | El registro ya no existe."
  }

  Write-Output ''
  Write-Output '============================================================'
  Write-Output 'FIN DE LA EVIDENCIA'
  Write-Output '============================================================'
} finally {
  if ($servidor) {
    Stop-Api -Process $servidor
    Write-Output ''
    Write-Output 'Servidor detenido.'
  }
}
