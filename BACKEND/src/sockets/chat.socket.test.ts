import { configurarChatSocket } from './chat.socket';
import { crearSocketFalso, consultaFalsa } from './socket.test-utils';
import { Grupo } from '../database/mongo/models/grupo.model';
import { Mensaje } from '../database/mongo/models/mensaje.model';

jest.mock('../database/mongo/models/grupo.model');
jest.mock('../database/mongo/models/mensaje.model');

describe('configurarChatSocket: unirse_grupo', () => {
    const idOscar = '111111111111111111111111';
    const idGrupo = '333333333333333333333333';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    it('debería avisar si el grupo no existe o está inactivo', async () => {
        // Arrange
        const { socket, io, emitirDesdeCliente } = crearSocketFalso({ usuarioId: idOscar });
        (Grupo.findById as jest.Mock).mockResolvedValue(null);
        configurarChatSocket(io);

        // Act
        await emitirDesdeCliente('unirse_grupo', idGrupo);

        // Assert
        expect(socket.emit).toHaveBeenCalledWith('error_chat', 'Grupo no encontrado');
        expect(socket.join).not.toHaveBeenCalled();
    });

    it('debería rechazar a quien no es integrante del grupo', async () => {
        // Arrange
        const { socket, io, emitirDesdeCliente } = crearSocketFalso({ usuarioId: idOscar, rol: 'usuario' });
        (Grupo.findById as jest.Mock).mockResolvedValue({ activo: true, integrantes: ['999999999999999999999999'] });
        configurarChatSocket(io);

        // Act
        await emitirDesdeCliente('unirse_grupo', idGrupo);

        // Assert
        expect(socket.emit).toHaveBeenCalledWith('error_chat', 'No eres integrante de este grupo');
        expect(socket.join).not.toHaveBeenCalled();
    });

    it('debería unir al integrante a la sala y enviar el historial con el nombre de cada autor', async () => {
        // Arrange
        const { socket, io, emitirDesdeCliente } = crearSocketFalso({ usuarioId: idOscar, rol: 'usuario' });
        const fecha = new Date('2026-11-26T10:00:00Z');
        (Grupo.findById as jest.Mock).mockResolvedValue({ activo: true, integrantes: [idOscar] });
        (Mensaje.find as jest.Mock).mockReturnValue(
            consultaFalsa([{ _id: 'm1', usuario_id: { _id: idOscar, nombre: 'Oscar' }, contenido: 'hola', fecha }]),
        );
        configurarChatSocket(io);

        // Act
        await emitirDesdeCliente('unirse_grupo', idGrupo);

        // Assert
        expect(socket.join).toHaveBeenCalledWith(idGrupo);
        expect(socket.emit).toHaveBeenCalledWith('historial', [
            { _id: 'm1', grupo_id: idGrupo, usuario_id: idOscar, nombreUsuario: 'Oscar', contenido: 'hola', fecha },
        ]);
    });

    it('debería sacar el socket de la sala al salir del grupo', async () => {
        // Arrange
        const { socket, io, emitirDesdeCliente } = crearSocketFalso({ usuarioId: idOscar, rol: 'usuario' });
        configurarChatSocket(io);

        // Act
        await emitirDesdeCliente('salir_grupo', idGrupo);

        // Assert
        expect(socket.leave).toHaveBeenCalledWith(idGrupo);
    });
});
