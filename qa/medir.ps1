<#
  Mide rendimiento (JMeter), seguridad (OWASP ZAP) y pruebas de sistema (Playwright)
  del backend de Play N Seek
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

# Procesos que escuchan en el puerto 3000. Si hay otro servidor ahi, las pruebas
# podrian medir ese servidor y no el codigo de la etapa.
function Duenos-Puerto3000 {
    @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
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
    'FRONT_URL=http://localhost:4200',
    'QA_PASSWORD=PruebaQA123!'
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
if ((Duenos-Puerto3000).Count -gt 0) {
    throw "El puerto 3000 ya esta ocupado (proceso $(Duenos-Puerto3000)). Cierra ese servidor y vuelve a correr el script."
}
# -WorkingDirectory explicito: Start-Process no siempre toma la carpeta de Push-Location
# y podria arrancar el dist/ de otra copia del codigo.
$servidor = Start-Process -FilePath 'node' -ArgumentList 'dist/index.js' -PassThru -NoNewWindow `
    -WorkingDirectory (Join-Path $Codigo 'BACKEND') `
    -RedirectStandardOutput (Join-Path $Salida 'servidor.log') `
    -RedirectStandardError (Join-Path $Salida 'servidor-error.log')
Pop-Location

try {
    # Se usa 127.0.0.1 y no localhost: en Windows localhost puede resolver a IPv6 (::1)
    # y llegar a un proceso distinto al que levanto este script.
    Esperar-Url 'http://127.0.0.1:3000/' 60
    $duenos = Duenos-Puerto3000
    if ($duenos.Count -ne 1) { throw "Mas de un proceso escucha en el puerto 3000: $duenos" }

    # Huella del servidor medido: deja evidencia de que version del codigo respondio.
    $login = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/login' -UseBasicParsing
    try {
        $css = (Invoke-WebRequest -Uri 'http://127.0.0.1:3000/styles/main.css' -UseBasicParsing).StatusCode
    } catch { $css = [int]$_.Exception.Response.StatusCode }
    $huella = Join-Path $Salida 'huella.txt'
    @(
        "Etapa: $Etapa",
        "Codigo: $Codigo",
        "Commit: $(git -C $Codigo rev-parse --short HEAD)",
        "Proceso en el puerto 3000: $duenos (servidor lanzado: $($servidor.Id))",
        "Cabecera CSP en /login: $([bool]$login.Headers['Content-Security-Policy'])",
        "Layout enlaza /styles/main.css: $($login.Content -match 'styles/main.css')",
        "GET /styles/main.css: $css"
    ) | Set-Content -Encoding ascii $huella
    Get-Content $huella

    # 5. Rendimiento ---------------------------------------------------------------------
    Paso 'Prueba de rendimiento con JMeter (50 usuarios)'
    $reporte = Join-Path $Salida 'jmeter-reporte'
    $jtl = Join-Path $Salida 'jmeter.jtl'
    # JMeter se niega a correr si el .jtl de una medicion anterior sigue ahi.
    if (Test-Path $reporte) { Remove-Item -Recurse -Force $reporte }
    if (Test-Path $jtl) { Remove-Item -Force $jtl }
    & $JMeter -n -t (Join-Path $Qa 'jmeter\plan-rendimiento.jmx') '-Jhost=127.0.0.1' `
        -l $jtl -j (Join-Path $Salida 'jmeter.log') -e -o $reporte
    Revisar 'JMeter'
    # jmeter.bat puede terminar con codigo 0 aunque falle: se confirma que genero resultados.
    if (-not (Test-Path (Join-Path $reporte 'index.html'))) { throw 'JMeter no genero el reporte; revisa jmeter.log' }

    # 6. Seguridad -----------------------------------------------------------------------
    # ZAP escribe en una carpeta temporal sin espacios ni acentos y luego copiamos el resultado.
    Paso 'Escaneo de seguridad con OWASP ZAP'
    $tmpZap = Join-Path $env:TEMP 'playnseek-zap'
    New-Item -ItemType Directory -Force -Path $tmpZap | Out-Null
    docker run --rm -v "${tmpZap}:/zap/wrk:rw" -t ghcr.io/zaproxy/zaproxy:stable `
        zap-baseline.py -t http://host.docker.internal:3000 -r zap.html -J zap.json -I
    # ZAP devuelve codigo distinto de 0 cuando encuentra alertas: eso es un resultado, no un error.
    Copy-Item (Join-Path $tmpZap 'zap.*') $Salida -Force

    # 7. Pruebas de sistema --------------------------------------------------------------
    # Corren contra el servidor levantado. Si alguna falla, es un resultado de la medicion,
    # no un error del script: el reporte queda en e2e-reporte\index.html.
    Paso 'Pruebas de sistema con Playwright'
    $e2e = Join-Path $Qa 'e2e'
    Push-Location $e2e
    if (-not (Test-Path 'node_modules')) { npm ci; Revisar 'npm ci (e2e)' }
    npx playwright install chromium
    Revisar 'playwright install'
    $env:E2E_REPORTE = Join-Path $Salida 'e2e-reporte'
    $env:BASE_URL = 'http://127.0.0.1:3000'
    npx playwright test | Tee-Object -FilePath (Join-Path $Salida 'e2e.txt')
    Pop-Location
}
finally {
    Paso 'Deteniendo el servidor'
    Stop-Process -Id $servidor.Id -Force -ErrorAction SilentlyContinue
}

Paso "Listo. Resultados en $Salida"
