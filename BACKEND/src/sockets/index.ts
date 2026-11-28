import { Server } from 'socket.io';
import { socketAuthMiddleware } from './middlewares/socketAuth.middleware';
import { configurarChatSocket } from './chat.socket';
//import { configurarNotificacionesSocket } from './notifications.socket';
import { configurarChatPrivadoSocket } from './chatPrivado.socket';

// Este archivo conecta los módulos de sockets (chat grupal, chat privado,
// notificaciones) y centraliza lo que comparten.
export function configurarSockets(io: Server) {
    // La autenticación se registra UNA sola vez aquí, antes de los módulos.
    // Si cada módulo hiciera io.use(), el middleware correría varias veces
    // por conexión (una consulta a Mongo por cada módulo).
    io.use(socketAuthMiddleware);

    configurarChatSocket(io);
    configurarChatPrivadoSocket(io);
    // configurarNotificacionesSocket(io);
}
