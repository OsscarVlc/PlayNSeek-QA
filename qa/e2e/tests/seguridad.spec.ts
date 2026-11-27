import { test, expect } from '@playwright/test';
import { esperarSinViolaciones, iniciarSesion, vigilarCsp } from './utilidades';

// PNSQ-43: la Content-Security-Policy y los atributos SRI no deben romper la interfaz.
// Si un hash de integridad estuviera mal, el navegador no cargaría Bootstrap.
test.describe('Cabeceras de seguridad en el navegador', () => {
    for (const ruta of ['/', '/login', '/register', '/juegos', '/grupos']) {
        test(`${ruta} carga sin violaciones de CSP y con Bootstrap disponible`, async ({ page }) => {
            const violaciones = await vigilarCsp(page);

            await page.goto(ruta);

            await esperarSinViolaciones(violaciones);
            // bootstrap.bundle.min.js se cargó y pasó la verificación de integridad (SRI)
            expect(await page.evaluate(() => typeof (window as unknown as { bootstrap?: unknown }).bootstrap)).toBe(
                'object',
            );
        });
    }

    for (const ruta of ['/perfil', '/match']) {
        test(`${ruta} (con sesión) carga sin violaciones de CSP`, async ({ page }) => {
            const violaciones = await vigilarCsp(page);
            await iniciarSesion(page);
            await expect(page).toHaveURL(/\/perfil$/);

            await page.goto(ruta);

            await esperarSinViolaciones(violaciones);
        });
    }
});
