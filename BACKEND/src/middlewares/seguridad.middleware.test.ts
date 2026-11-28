import express from 'express';
import request from 'supertest';
import { cabecerasDeSeguridad } from './seguridad.middleware';

// App mínima con el middleware real: verificamos las cabeceras de una respuesta HTTP de verdad.
function crearAppDePrueba() {
    const app = express();
    app.use(cabecerasDeSeguridad);
    app.get('/', (_req, res) => {
        res.send('ok');
    });
    return app;
}

describe('cabecerasDeSeguridad (PNSQ-43)', () => {
    it('debería definir una Content-Security-Policy que solo permite scripts propios y del CDN', async () => {
        const res = await request(crearAppDePrueba()).get('/');

        const csp = res.headers['content-security-policy'];
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("script-src 'self' https://cdn.jsdelivr.net");
        expect(csp).toContain("frame-ancestors 'none'");
    });

    it('debería agregar las cabeceras anti-clickjacking, nosniff, COOP y Permissions-Policy', async () => {
        const res = await request(crearAppDePrueba()).get('/');

        expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
        expect(res.headers['permissions-policy']).toContain('camera=()');
    });

    it('no debería revelar la tecnología del servidor con X-Powered-By', async () => {
        const res = await request(crearAppDePrueba()).get('/');

        expect(res.headers['x-powered-by']).toBeUndefined();
    });
});
