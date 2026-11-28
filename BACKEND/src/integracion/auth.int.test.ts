import request from 'supertest';
import { createApp } from '../app';
import { User } from '../database/mongo/models/user.model';
import { enviarCorreoConfirmacion } from '../services/email.service';
import { conectarMongoEnMemoria, desconectarMongoEnMemoria, limpiarColecciones } from './mongo-memoria.test-utils';

// Pruebas de integración de autenticación: la app real (rutas, middlewares, controllers,
// bcrypt y JWT) contra una MongoDB real en memoria. Solo se simulan los servicios
// externos: el envío de correo y Dgraph.
jest.mock('../services/email.service');
jest.mock('../database/dgraph/queries/user.queries');
jest.setTimeout(120_000);

const app = createApp();

const DATOS = {
    name: 'Usuario Integracion',
    email: 'integracion@qa.playnseek.test',
    password: 'Segura123!',
};

/** El token de confirmación viaja en la URL del correo que se habría enviado. */
function tokenDelUltimoCorreo(): string {
    const url = jest.mocked(enviarCorreoConfirmacion).mock.calls.at(-1)?.[2] ?? '';
    return url.split('/confirmar/')[1];
}

async function registrar() {
    return request(app).post('/user/register').send(DATOS);
}

async function iniciarSesion(email: unknown = DATOS.email, password: unknown = DATOS.password) {
    return request(app).post('/user/login').send({ email, password });
}

beforeAll(conectarMongoEnMemoria);
afterEach(async () => {
    await limpiarColecciones();
    jest.clearAllMocks();
});
afterAll(desconectarMongoEnMemoria);

describe('Registro (RF-01, RNF-01)', () => {
    it('crea el usuario con la contraseña guardada como hash de bcrypt y sin devolverla', async () => {
        // Act
        const res = await registrar();

        // Assert
        expect(res.status).toBe(201);
        expect(res.body.user).not.toHaveProperty('contrasena_hash');
        const guardado = await User.findOne({ correo: DATOS.email });
        expect(guardado?.contrasena_hash).not.toBe(DATOS.password);
        expect(guardado?.contrasena_hash).toMatch(/^\$2[aby]\$10\$/);
        expect(guardado?.correo_confirmado).toBe(false);
    });

    it('rechaza un correo que ya está registrado', async () => {
        // Arrange
        await registrar();

        // Act
        const res = await registrar();

        // Assert
        expect(res.status).toBe(400);
        expect(await User.countDocuments({ correo: DATOS.email })).toBe(1);
    });
});

describe('Inicio de sesión (RF-01, RF-02)', () => {
    it('no deja entrar hasta confirmar el correo', async () => {
        // Arrange
        await registrar();

        // Act
        const res = await iniciarSesion();

        // Assert
        expect(res.status).toBe(401);
        expect(res.body.token).toBeUndefined();
    });

    it('recorre registro, confirmación, login y /user/me', async () => {
        // Arrange
        await registrar();
        const confirmacion = await request(app).get(`/user/confirmar/${tokenDelUltimoCorreo()}`);

        // Act
        const login = await iniciarSesion();
        const me = await request(app).get('/user/me').set('Authorization', `Bearer ${login.body.token}`);

        // Assert
        expect(confirmacion.status).toBe(200);
        expect(login.status).toBe(200);
        expect(typeof login.body.token).toBe('string');
        expect(me.status).toBe(200);
        expect(me.body.user).toMatchObject({ correo: DATOS.email, nombre: DATOS.name });
        expect(me.body.user).not.toHaveProperty('contrasena_hash');
    });

    it('responde 401 con una contraseña incorrecta', async () => {
        // Arrange
        await registrar();
        await request(app).get(`/user/confirmar/${tokenDelUltimoCorreo()}`);

        // Act
        const res = await iniciarSesion(DATOS.email, 'Incorrecta123!');

        // Assert
        expect(res.status).toBe(401);
        expect(res.body.token).toBeUndefined();
    });

    it('rechaza con 400 un operador de MongoDB en lugar del correo (inyección NoSQL)', async () => {
        // Arrange
        await registrar();
        await request(app).get(`/user/confirmar/${tokenDelUltimoCorreo()}`);

        // Act
        const res = await iniciarSesion({ $ne: null }, DATOS.password);

        // Assert
        expect(res.status).toBe(400);
        expect(res.body.token).toBeUndefined();
    });
});

describe('Control de acceso (RNF-02)', () => {
    it('responde 401 en una ruta protegida sin token', async () => {
        const res = await request(app).get('/user/me');

        expect(res.status).toBe(401);
    });

    it('responde 401 con un token alterado', async () => {
        const res = await request(app).get('/user/me').set('Authorization', 'Bearer token.alterado.firma');

        expect(res.status).toBe(401);
    });
});
