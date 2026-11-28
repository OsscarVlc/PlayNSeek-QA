# Play N Seek QA

Backend de **Play N Seek**, una plataforma para encontrar compañeros de juego según juegos, plataformas,
idiomas y horarios, con grupos, publicaciones y chat en tiempo real.

Este repositorio es el proyecto de **Calidad de Software** (ITESO): aplicamos un proceso de aseguramiento de
calidad sobre el sistema existente y medimos el antes y después de cada mejora.

**Equipo:** Oscar Emanuel Velasco Casas y Sergio Lavin Orozco Miranda.

## Stack

| Capa | Tecnología |
| --- | --- |
| Servidor | Node.js 22, Express 5, TypeScript |
| Datos | MongoDB (Mongoose) y Dgraph (grafo de recomendaciones) |
| Tiempo real | Socket.IO |
| Vistas | Handlebars + Bootstrap 5 |
| Servicios externos | RAWG (juegos), Cloudinary (imágenes), Gmail (correos) |

## Estructura

```
BACKEND/    API, lógica de negocio, sockets y pruebas (routes → controllers → services → models)
FRONTEND/   Vistas Handlebars y scripts del navegador
qa/         Entorno local y scripts para medir rendimiento (JMeter) y seguridad (OWASP ZAP)
.github/    Pipeline de CI con los quality gates
```

## Cómo correrlo

Requisitos: Node.js 22, Docker (para Dgraph) y una base de MongoDB.

```bash
docker compose up -d             # Dgraph local (puertos 5080, 8080, 9080)
cd BACKEND
cp .env.example .env             # y llenar las variables
npm ci                           # instala dependencias, compila y activa el hook de pre-commit
npm run dev                      # servidor en http://localhost:3000
```

La documentación de la API está en `http://localhost:3000/api-docs`.

## Pruebas y calidad

| Comando (en `BACKEND`) | Qué hace |
| --- | --- |
| `npm test` | Pruebas unitarias con Jest |
| `npm run test:ci` | Pruebas con reporte de cobertura y umbral mínimo |
| `npm run lint` | ESLint |
| `npm run format:check` | Formato con Prettier |
| `npm run typecheck` | Verificación de tipos de TypeScript |
| `npm run precommit` | Todo lo anterior; corre solo antes de cada commit |

Para rendimiento y seguridad, ver [`qa/README.md`](qa/README.md).

## Flujo de trabajo

- Gestión de tareas, requisitos y defectos en **Jira**, proyecto `PNSQ`.
- Ramas: `main` (versiones entregadas), `dev` (integración) y `feature/*` o `fix/*` para cada cambio.
- Todo cambio entra a `dev` o `main` por **Pull Request**, con la aprobación del otro integrante.
- El PR solo se puede fusionar si pasan los quality gates del CI: instalación reproducible, lint, formato,
  tipos, pruebas con umbral de cobertura, `npm audit` sin vulnerabilidades altas y SonarCloud.
- Análisis estático en [SonarCloud](https://sonarcloud.io/project/overview?id=OsscarVlc_PlayNSeek-QA).
