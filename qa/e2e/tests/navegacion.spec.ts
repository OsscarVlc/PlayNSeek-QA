import { test, expect } from '@playwright/test';

// RF-05 (catálogo de juegos) y RF-10 (grupos), con los datos de seed-qa.ts.
test.describe('Navegación pública', () => {
    test('el catálogo muestra los juegos activos', async ({ page }) => {
        await page.goto('/juegos');

        await expect(page.getByRole('heading', { name: 'Catálogo de juegos' })).toBeVisible();
        await expect(page.locator('.card-title', { hasText: 'Juego QA' })).toHaveCount(20);
    });

    test('la lista de grupos muestra los grupos sembrados', async ({ page }) => {
        await page.goto('/grupos');

        await expect(page.getByRole('heading', { name: 'Grupos', exact: true })).toBeVisible();
        await expect(page.locator('.card-title', { hasText: 'Grupo QA' })).toHaveCount(10);
    });
});

// Defecto encontrado por estas pruebas: el layout enlazaba /styles/main.css, que no existe,
// y cada página hacía una petición con error 404.
test.describe('Recursos de las páginas', () => {
    for (const ruta of ['/', '/login', '/juegos', '/grupos']) {
        test(`${ruta} no pide recursos propios que no existen`, async ({ page, baseURL }) => {
            const rotos: string[] = [];
            const esPropio = (url: string) => url.startsWith(baseURL ?? '') && !url.endsWith('/favicon.ico');
            page.on('response', (res) => {
                if (esPropio(res.url()) && res.status() >= 400) {
                    rotos.push(`${res.status()} ${res.url()}`);
                }
            });
            // Express responde el 404 como text/html con nosniff: Chrome aborta la carga de la hoja
            // de estilos y Playwright no emite 'response', solo 'requestfailed'.
            page.on('requestfailed', (req) => {
                if (esPropio(req.url())) {
                    rotos.push(`${req.failure()?.errorText ?? 'fallida'} ${req.url()}`);
                }
            });

            await page.goto(ruta);
            await page.waitForLoadState('networkidle');

            expect(rotos, rotos.join('\n')).toEqual([]);
        });
    }
});
