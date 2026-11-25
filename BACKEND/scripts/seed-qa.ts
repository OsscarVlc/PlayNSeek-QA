/**
 * Datos de prueba para el entorno local de QA (pruebas de rendimiento y seguridad).
 *
 * Crea juegos, usuarios confirmados y grupos en MongoDB, y sincroniza usuarios y
 * juegos con Dgraph para que las recomendaciones tengan datos reales.
 *
 * BORRA las colecciones y el grafo antes de sembrar, por eso solo se permite
 * contra una MongoDB local (localhost / 127.0.0.1). Nunca contra Atlas.
 *
 * Uso (desde BACKEND):  npx ts-node --transpile-only scripts/seed-qa.ts
 */
import 'dotenv/config';
import * as dgraph from 'dgraph-js';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { dgraphClient, setSchema } from '../src/config/dgraph.config';
import { User } from '../src/database/mongo/models/user.model';
import { Juego } from '../src/database/mongo/models/juego.model';
import { Grupo } from '../src/database/mongo/models/grupo.model';
import { crearUsuarioEnDgraph } from '../src/database/dgraph/queries/user.queries';
import { crearJuegoEnDgraph } from '../src/database/dgraph/queries/juego.queries';
import { sincronizarUsuarioConDgraph } from '../src/services/dgraphSync.service';
import { Idioma, Plataforma, Roles } from '../src/types/user.types';

export const PASSWORD_QA = 'PruebaQA123!';
const TOTAL_JUEGOS = 20;
const TOTAL_USUARIOS = 50;
const TOTAL_GRUPOS = 10;

const IDIOMAS = [Idioma.ESPANOL, Idioma.INGLES, Idioma.PORTUGUES];
const PLATAFORMAS = Object.values(Plataforma);
const GENEROS = ['acción', 'aventura', 'rpg', 'shooter', 'estrategia', 'deportes'];

/** Toma el elemento i de una lista de forma cíclica, para tener datos variados pero repetibles. */
function ciclico<T>(lista: T[], i: number): T {
    return lista[i % lista.length];
}

/** Quita usuario y contraseña de una URI de Mongo para poder mostrarla sin exponer credenciales. */
function ocultarCredenciales(uri: string): string {
    return uri.replace(/\/\/[^@/]+@/, '//***:***@');
}

function validarUriLocal(uri: string | undefined): string {
    if (!uri || !/^mongodb:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(uri)) {
        const actual = uri ? ocultarCredenciales(uri) : '(vacía)';
        throw new Error(`seed-qa solo corre contra una MongoDB local. MONGODB_URI actual: ${actual}`);
    }
    return uri;
}

async function limpiarDgraph() {
    const op = new dgraph.Operation();
    op.setDropAll(true);
    await dgraphClient.alter(op);
    await setSchema();
}

async function main() {
    const uri = validarUriLocal(process.env.MONGODB_URI);
    await mongoose.connect(uri);
    console.log('Conectado a MongoDB local');

    await Promise.all([User.deleteMany({}), Juego.deleteMany({}), Grupo.deleteMany({})]);
    await limpiarDgraph();
    console.log('Bases limpias');

    // Juegos ---------------------------------------------------------------------------------
    const juegos = [];
    for (let i = 0; i < TOTAL_JUEGOS; i++) {
        const juego = await Juego.create({
            titulo: `Juego QA ${i + 1}`,
            generos: [ciclico(GENEROS, i), ciclico(GENEROS, i + 2)],
            plataformas: [ciclico(PLATAFORMAS, i), ciclico(PLATAFORMAS, i + 1)],
            id_api: 900000 + i,
        });
        await crearJuegoEnDgraph(juego._id.toString(), juego.titulo);
        juegos.push(juego);
    }
    console.log(`${juegos.length} juegos creados`);

    // Usuarios -------------------------------------------------------------------------------
    // Un solo hash para todos: bcrypt es lento a propósito y no queremos esperar 50 veces.
    const hash = await bcrypt.hash(PASSWORD_QA, 10);
    const usuarios = [];
    for (let i = 0; i < TOTAL_USUARIOS; i++) {
        const idiomas = [ciclico(IDIOMAS, i)];
        const plataformas = [{ nombre: ciclico(PLATAFORMAS, i), gamertag: `qa_gamer_${i + 1}` }];
        const juegosActivos = [ciclico(juegos, i), ciclico(juegos, i + 3)].map((j) => ({
            juego_id: j._id,
            busca_equipo: true,
            desde: new Date(),
        }));

        const usuario = await User.create({
            nombre: i === 0 ? 'Admin QA' : `Usuario QA ${i}`,
            correo: i === 0 ? 'admin@qa.playnseek.test' : `usuario${i}@qa.playnseek.test`,
            contrasena_hash: hash,
            correo_confirmado: true,
            rol: i === 0 ? Roles.ADMIN : Roles.USER,
            idiomas,
            plataformas,
            juegos_activos: juegosActivos,
        });
        await crearUsuarioEnDgraph(usuario._id.toString(), usuario.nombre);
        await sincronizarUsuarioConDgraph(usuario._id.toString(), {
            idiomas,
            plataformas: usuario.plataformas,
            juegos_activos: usuario.juegos_activos,
        });
        usuarios.push(usuario);
    }
    console.log(`${usuarios.length} usuarios creados (contraseña de todos: ${PASSWORD_QA})`);

    // Grupos ---------------------------------------------------------------------------------
    for (let i = 0; i < TOTAL_GRUPOS; i++) {
        const lider = usuarios[i + 1];
        const integrantes = [lider, usuarios[i + 11], usuarios[i + 21]].map((u) => u._id);
        await Grupo.create({
            nombre: `Grupo QA ${i + 1}`,
            descripcion: 'Grupo generado para pruebas de calidad',
            lider_id: lider._id,
            integrantes,
        });
    }
    console.log(`${TOTAL_GRUPOS} grupos creados`);

    await mongoose.disconnect();
    console.log('Seed de QA terminado');
    process.exit(0);
}

main().catch(async (err) => {
    console.error('Error en seed-qa:', err);
    await mongoose.disconnect();
    process.exit(1);
});
