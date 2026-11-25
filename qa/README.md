# Entorno local de QA

Herramientas para medir el **antes y después** de rendimiento (JMeter) y seguridad (OWASP ZAP)
sobre el backend de Play N Seek, con bases de datos locales y desechables.

| Archivo | Uso |
| --- | --- |
| `docker-compose.qa.yml` | MongoDB 7 y Dgraph locales para QA |
| `.env.qa` | Variables del backend para este entorno (sin secretos reales) |
| `../BACKEND/scripts/seed-qa.ts` | Datos de prueba: 20 juegos, 50 usuarios confirmados, 10 grupos |
| `jmeter/plan-rendimiento.jmx` | 50 usuarios concurrentes: login, catálogo, grupos, perfil y recomendaciones |

Requisitos: Docker Desktop, Node.js 22 y Apache JMeter 5.6.3. Los comandos son para **PowerShell**,
desde la raíz del repositorio.

## Forma rápida

`medir.ps1` hace todos los pasos de abajo y deja los resultados en `qa\resultados\<etapa>\`:

```powershell
powershell -ExecutionPolicy Bypass -File qa\medir.ps1 -Etapa antes     # línea base (commit 1aaaa1a)
powershell -ExecutionPolicy Bypass -File qa\medir.ps1 -Etapa despues   # código actual
```

Si ya hay una MongoDB en el puerto 27017 y un Dgraph en el 9080, el script los reutiliza.
Cuidado: el seed **borra todo el grafo** de ese Dgraph, así que debe ser uno de pruebas.

## Forma manual

### 1. Levantar las bases de datos

Si tienes corriendo el Dgraph de desarrollo (`docker-compose.yml` de la raíz), deténlo primero,
porque usa los mismos puertos.

```powershell
docker compose -f qa/docker-compose.qa.yml up -d
```

### 2. Sembrar datos de prueba

```powershell
cd BACKEND
npm ci
$env:DOTENV_CONFIG_PATH = "..\qa\.env.qa"
npx ts-node --transpile-only scripts/seed-qa.ts
cd ..
```

Todos los usuarios usan la contraseña `PruebaQA123!`. El administrador es `admin@qa.playnseek.test`.

### 3. Levantar la versión a medir

**Antes** (código del tag `linea-base`), en una carpeta aparte para no tocar tu rama:

```powershell
git worktree add ..\PlayNSeek-QA-base linea-base
cd ..\PlayNSeek-QA-base\BACKEND
npm ci
npm run build
$env:DOTENV_CONFIG_PATH = "..\..\PlayNSeek-QA\qa\.env.qa"
node dist/index.js
```

**Después** (código actual de `dev`): los mismos pasos desde `PlayNSeek-QA\BACKEND`, con
`$env:DOTENV_CONFIG_PATH = "..\qa\.env.qa"`.

Deja esa terminal abierta: el servidor queda en `http://localhost:3000`.

### 4. Prueba de rendimiento (JMeter)

En otra terminal, desde la raíz del repo:

```powershell
cd qa\jmeter
& "$HOME\Desktop\apache-jmeter-5.6.3\bin\jmeter.bat" -n -t plan-rendimiento.jmx -l antes.jtl -e -o reporte-antes
```

Para la medición final cambia `antes` por `despues`. El reporte HTML queda en `reporte-antes\index.html`.

### 5. Escaneo de seguridad (OWASP ZAP)

```powershell
docker run --rm -v "${PWD}\qa\zap:/zap/wrk:rw" -t ghcr.io/zaproxy/zaproxy:stable `
  zap-baseline.py -t http://host.docker.internal:3000 -r zap-antes.html -J zap-antes.json -I
```

Es un escaneo pasivo (no ataca la app): revisa cabeceras de seguridad, cookies y configuración.

### 6. Limpiar

```powershell
docker compose -f qa/docker-compose.qa.yml down -v
git worktree remove ..\PlayNSeek-QA-base
```
