import request from 'supertest';
import { createApp } from './app';

// Prueba de integración: la app real con todas sus rutas y middlewares.
// /login es una vista pública que no consulta la base de datos.
describe('createApp', () => {
    it('debería responder las vistas con las cabeceras de seguridad activas (PNSQ-43)', async () => {
        const res = await request(createApp()).get('/login');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/html');
        expect(res.headers['content-security-policy']).toContain("default-src 'self'");
        expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(res.headers['x-powered-by']).toBeUndefined();
    });
});
