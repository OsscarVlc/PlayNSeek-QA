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
            page.on('response', (res) => {
                const esPropio = res.url().startsWith(baseURL ?? '');
                if (esPropio && res.status() >= 400 && !res.url().endsWith('/favicon.ico')) {
                    rotos.push(`${res.status()} ${res.url()}`);
                }
            });

            await page.goto(ruta);
            await page.waitForLoadState('networkidle');

            expect(rotos, rotos.join('\n')).toEqual([]);
        });
    }
});
