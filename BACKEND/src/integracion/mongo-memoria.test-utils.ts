import os from 'os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Base de datos real de MongoDB que vive solo durante las pruebas de integración.
// La primera vez descarga el binario de mongod (queda en caché); nunca toca Atlas
// ni la base local de desarrollo.
let servidor: MongoMemoryServer | undefined;

export async function conectarMongoEnMemoria(): Promise<void> {
    servidor = await MongoMemoryServer.create();
    // Dentro de Jest el driver no puede cargar 'os' con import() dinámico, manda el saludo
    // al servidor sin el documento 'driver' y MongoDB rechaza la conexión. Por eso se lo pasamos.
    await mongoose.connect(servidor.getUri(), { runtimeAdapters: { os } });
}

/** Deja todas las colecciones vacías para que cada prueba empiece desde cero. */
export async function limpiarColecciones(): Promise<void> {
    const colecciones = Object.values(mongoose.connection.collections);
    await Promise.all(colecciones.map((coleccion) => coleccion.deleteMany({})));
}

export async function desconectarMongoEnMemoria(): Promise<void> {
    await mongoose.disconnect();
    await servidor?.stop();
}
