<#
  Mide rendimiento (JMeter) y seguridad (OWASP ZAP) del backend de Play N Seek
  en un entorno local y desechable.

  Uso (PowerShell, desde la raiz del repo):
    powershell -ExecutionPolicy Bypass -File qa\medir.ps1 -Etapa antes
    powershell -ExecutionPolicy Bypass -File qa\medir.ps1 -Etapa despues

  -Etapa antes   mide el codigo de la linea base (commit 1aaaa1a) en una carpeta aparte
  -Etapa despues mide el codigo actual de esta carpeta

  Resultados en qa\resultados\<etapa>\
#>
param(
    [ValidateSet('antes', 'despues')]
    [string]$Etapa = 'antes'
)

$ErrorActionPreference = 'Stop'
$LineaBase = '1aaaa1a'
$Qa = $PSScriptRoot
$Repo = Split-Path -Parent $Qa
$Salida = Join-Path $Qa "resultados\$Etapa"
$JMeter = Join-Path $HOME 'Desktop\apache-jmeter-5.6.3\bin\jmeter.bat'

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }

function Revisar($descripcion) {
    if ($LASTEXITCODE -ne 0) { throw "Fallo: $descripcion (codigo $LASTEXITCODE)" }
}

function Esperar-Url($url, $segundos) {
    for ($i = 0; $i -lt $segundos; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -lt 500) { return }
        } catch { }
        Start-Sleep -Seconds 1
    }
    throw "No respondio $url despues de $segundos segundos"
}

if (-not (Test-Path $JMeter)) { throw "No encontre JMeter en $JMeter" }
New-Item -ItemType Directory -Force -Path $Salida | Out-Null

# 1. Variables del entorno de QA (sin secretos reales) -----------------------------------
Paso 'Escribiendo qa\.env.qa'
@(
    'MONGODB_URI=mongodb://127.0.0.1:27017/playnseek_qa',
    'JWT_SECRET=jwt-secret-solo-para-el-entorno-de-qa',
    'PORT=3000',
    'APP_URL=http://localhost:3000',
    'FRONT_URL=http://localhost:4200'
) | Set-Content -Encoding ascii (Join-Path $Qa '.env.qa')
$env:DOTENV_CONFIG_PATH = Join-Path $Qa '.env.qa'

# 2. Bases de datos locales --------------------------------------------------------------
function Puerto-Abierto($puerto) {
    try {
        $c = New-Object Net.Sockets.TcpClient
        $c.Connect('127.0.0.1', $puerto)
        $c.Close()
        return $true
    } catch { return $false }
}

Paso 'Revisando MongoDB y Dgraph'
if ((Puerto-Abierto 27017) -and (Puerto-Abierto 9080)) {
    # El seed usa la base playnseek_qa y BORRA el grafo de Dgraph: el Dgraph que responda aqui
    # debe ser uno de pruebas.
    Write-Host 'Ya hay MongoDB (27017) y Dgraph (9080) corriendo: se reutilizan.'
} else {
    docker compose -f (Join-Path $Qa 'docker-compose.qa.yml') up -d
    Revisar 'docker compose up'
}
Esperar-Url 'http://localhost:8080/health' 90

# 3. Datos de prueba (el script vive en el codigo actual) ---------------------------------
Paso 'Sembrando datos de prueba'
Push-Location (Join-Path $Repo 'BACKEND')
if (-not (Test-Path 'node_modules')) { npm ci; Revisar 'npm ci' }
npx ts-node --transpile-only scripts/seed-qa.ts
Revisar 'seed-qa'
Pop-Location

# 4. Codigo a medir ----------------------------------------------------------------------
if ($Etapa -eq 'antes') {
    $Codigo = Join-Path (Split-Path -Parent $Repo) 'PlayNSeek-QA-base'
    if (-not (Test-Path $Codigo)) {
        Paso "Creando copia de la linea base ($LineaBase) en $Codigo"
        git -C $Repo worktree add $Codigo $LineaBase
        Revisar 'git worktree add'
    }
} else {
    $Codigo = $Repo
}

Paso "Compilando el backend de $Codigo"
Push-Location (Join-Path $Codigo 'BACKEND')
npm ci
Revisar 'npm ci'
npm run build
Revisar 'npm run build'

Paso 'Arrancando el servidor'
$servidor = Start-Process -FilePath 'node' -ArgumentList 'dist/index.js' -PassThru -NoNewWindow `
    -RedirectStandardOutput (Join-Path $Salida 'servidor.log') `
    -RedirectStandardError (Join-Path $Salida 'servidor-error.log')
Pop-Location

try {
    Esperar-Url 'http://localhost:3000/' 60

    # 5. Rendimiento ---------------------------------------------------------------------
    Paso 'Prueba de rendimiento con JMeter (50 usuarios)'
    $reporte = Join-Path $Salida 'jmeter-reporte'
    if (Test-Path $reporte) { Remove-Item -Recurse -Force $reporte }
    & $JMeter -n -t (Join-Path $Qa 'jmeter\plan-rendimiento.jmx') `
        -l (Join-Path $Salida 'jmeter.jtl') -j (Join-Path $Salida 'jmeter.log') -e -o $reporte
    Revisar 'JMeter'

    # 6. Seguridad -----------------------------------------------------------------------
    # ZAP escribe en una carpeta temporal sin espacios ni acentos y luego copiamos el resultado.
    Paso 'Escaneo de seguridad con OWASP ZAP'
    $tmpZap = Join-Path $env:TEMP 'playnseek-zap'
    New-Item -ItemType Directory -Force -Path $tmpZap | Out-Null
    docker run --rm -v "${tmpZap}:/zap/wrk:rw" -t ghcr.io/zaproxy/zaproxy:stable `
        zap-baseline.py -t http://host.docker.internal:3000 -r zap.html -J zap.json -I
    # ZAP devuelve codigo distinto de 0 cuando encuentra alertas: eso es un resultado, no un error.
    Copy-Item (Join-Path $tmpZap 'zap.*') $Salida -Force
}
finally {
    Paso 'Deteniendo el servidor'
    Stop-Process -Id $servidor.Id -Force -ErrorAction SilentlyContinue
}

Paso "Listo. Resultados en $Salida"
