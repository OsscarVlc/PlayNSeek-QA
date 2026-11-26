import { Server } from 'socket.io';

// Socket y servidor falsos para probar los handlers de Socket.IO sin red.
// io.on('connection', cb) llama de inmediato a cb con el socket falso, y
// socket.on(evento, handler) guarda el handler para invocarlo desde la prueba.

type Handler = (...args: unknown[]) => Promise<void> | void;

export function crearSocketFalso(datos: { usuarioId?: string; rol?: string } = {}) {
    const handlers: Record<string, Handler> = {};
    const socket = {
        id: 'socket-de-prueba',
        ...datos,
        on: jest.fn((evento: string, handler: Handler) => {
            handlers[evento] = handler;
        }),
        emit: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn(),
    };
    const io = {
        on: jest.fn((_evento: string, alConectar: (s: typeof socket) => void) => alConectar(socket)),
    } as unknown as Server;

    /** Ejecuta el handler registrado para un evento, como si el cliente lo emitiera. */
    async function emitirDesdeCliente(evento: string, ...args: unknown[]) {
        await handlers[evento](...args);
    }

    return { socket, io, emitirDesdeCliente };
}

/** Simula una consulta encadenada de Mongoose (find().sort().limit()...lean()) que resuelve a `resultado`. */
export function consultaFalsa(resultado: unknown) {
    const consulta = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(resultado),
    };
    return consulta;
}
