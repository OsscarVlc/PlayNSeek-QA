import request from 'supertest';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { createApp } from '../app';
import { User } from '../database/mongo/models/user.model';
import { Juego } from '../database/mongo/models/juego.model';
import { Comentario } from '../database/mongo/models/comentario.model';
import { conectarMongoEnMemoria, desconectarMongoEnMemoria, limpiarColecciones } from './mongo-memoria.test-utils';

// Pruebas de integración de lectura: catálogo, comentarios y posts contra una MongoDB
// real en memoria, incluidas las validaciones contra inyección NoSQL (PNSQ-39).
jest.setTimeout(120_000);

const app = createApp();

async function tokenDeUsuarioConfirmado(): Promise<string> {
    await User.create({
        nombre: 'Lector QA',
        correo: 'lector@qa.playnseek.test',
        contrasena_hash: await bcrypt.hash('Segura123!', 10),
        correo_confirmado: true,
    });
    const login = await request(app)
        .post('/user/login')
        .send({ email: 'lector@qa.playnseek.test', password: 'Segura123!' });
    return login.body.token;
}

beforeAll(conectarMongoEnMemoria);
afterEach(limpiarColecciones);
afterAll(desconectarMongoEnMemoria);

describe('Catálogo de juegos (RF-05, PNSQ-45)', () => {
    async function sembrarJuegos() {
        return Juego.create([
            { titulo: 'Activo 1', id_api: 1 },
            { titulo: 'Activo 2', id_api: 2 },
            { titulo: 'Inactivo', id_api: 3, activo: false },
        ]);
    }

    it('la API lista solo los juegos activos cuando se pide JSON', async () => {
        // Arrange
        await sembrarJuegos();

        // Act
        const res = await request(app).get('/juegos').set('Accept', 'application/json');

        // Assert
        expect(res.status).toBe(200);
        expect(res.body.totalJuegos).toBe(2);
        expect(res.body.data.map((j: { titulo: string }) => j.titulo).sort()).toEqual(['Activo 1', 'Activo 2']);
    });

    it('el navegador sigue recibiendo la vista del catálogo', async () => {
        // Arrange
        await sembrarJuegos();

        // Act
        const res = await request(app).get('/juegos').set('Accept', 'text/html');

        // Assert
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/html');
        expect(res.text).toContain('Activo 1');
        expect(res.text).not.toContain('Inactivo');
    });

    it('la API devuelve el detalle de un juego y 404 si está inactivo', async () => {
        // Arrange
        const [activo, , inactivo] = await sembrarJuegos();

        // Act
        const resActivo = await request(app).get(`/juegos/${activo._id}`).set('Accept', 'application/json');
        const resInactivo = await request(app).get(`/juegos/${inactivo._id}`).set('Accept', 'application/json');

        // Assert
        expect(resActivo.status).toBe(200);
        expect(resActivo.body.titulo).toBe('Activo 1');
        expect(resInactivo.status).toBe(404);
    });
});

describe('Comentarios (RF-11, PNSQ-39)', () => {
    it('limita la página a 50 resultados aunque se pidan más', async () => {
        // Arrange
        const postId = new Types.ObjectId();
        const usuarioId = new Types.ObjectId();
        await Comentario.insertMany(
            Array.from({ length: 60 }, (_, i) => ({ post_id: postId, usuario_id: usuarioId, contenido: `c${i}` })),
        );

        // Act
        const res = await request(app).get('/comentario').query({ limite: 1000 });

        // Assert
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(50);
        expect(res.body.total).toBe(60);
    });

    it('filtra por post_id cuando es un ObjectId válido', async () => {
        // Arrange
        const postBuscado = new Types.ObjectId();
        const usuarioId = new Types.ObjectId();
        await Comentario.create([
            { post_id: postBuscado, usuario_id: usuarioId, contenido: 'del post' },
            { post_id: new Types.ObjectId(), usuario_id: usuarioId, contenido: 'de otro post' },
        ]);

        // Act
        const res = await request(app).get('/comentario').query({ post_id: postBuscado.toString() });

        // Assert
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(1);
        expect(res.body.data[0].contenido).toBe('del post');
    });

    it('responde 400 si post_id llega como arreglo en lugar de un id', async () => {
        const res = await request(app).get('/comentario?post_id=a&post_id=b');

        expect(res.status).toBe(400);
    });
});

describe('Posts de un grupo (RF-11, RNF-02, PNSQ-39)', () => {
    it('responde 401 sin sesión', async () => {
        const res = await request(app).get('/post');

        expect(res.status).toBe(401);
    });

    it('responde 400 con un grupo_id que no es un ObjectId', async () => {
        // Arrange
        const token = await tokenDeUsuarioConfirmado();

        // Act
        const res = await request(app).get('/post?grupo_id=1&grupo_id=2').set('Authorization', `Bearer ${token}`);

        // Assert
        expect(res.status).toBe(400);
    });

    it('responde 404 si el grupo no existe', async () => {
        // Arrange
        const token = await tokenDeUsuarioConfirmado();

        // Act
        const res = await request(app)
            .get('/post')
            .query({ grupo_id: new Types.ObjectId().toString() })
            .set('Authorization', `Bearer ${token}`);

        // Assert
        expect(res.status).toBe(404);
    });
});
