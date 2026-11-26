import { configurarChatPrivadoSocket, nombreSalaPrivada } from './chatPrivado.socket';
import { crearSocketFalso, consultaFalsa } from './socket.test-utils';
import { obtenerMatchesDeUsuario } from '../database/dgraph/queries/match.queries';
import { Mensaje } from '../database/mongo/models/mensaje.model';

jest.mock('../database/dgraph/queries/match.queries');
jest.mock('../database/mongo/models/mensaje.model');

describe('nombreSalaPrivada', () => {
    it('debería generar el mismo nombre de sala sin importar el orden de los ids', () => {
        // Arrange
        const idOscar = 'abc123';
        const idAna = 'xyz789';

        // Act
        // probamos las dos combinaciones posibles: Oscar primero, o Ana primero
        const salaUno = nombreSalaPrivada(idOscar, idAna);
        const salaDos = nombreSalaPrivada(idAna, idOscar);

        // Assert
        // el resultado debe ser identico en ambos casos, sin importar quien
        // se conecto primero al chat
        expect(salaUno).toBe(salaDos);
    });

    it('deberia tener el prefijo "privado_" y ambos ids ordenados alfabeticamente', () => {
        // Arrange
        const idA = 'zzz';
        const idB = 'aaa';

        // Act
        const resultado = nombreSalaPrivada(idA, idB);

        // Assert
        // aunque le pasamos zzz primero el resultado debe tener aaa primero
        // porque la funcion los ordena antes de juntarlos
        expect(resultado).toBe('privado_aaa_zzz');
    });
});

describe('configurarChatPrivadoSocket: unirse_chat_privado', () => {
    const idOscar = '111111111111111111111111';
    const idAna = '222222222222222222222222';

    beforeEach(() => jest.clearAllMocks());

    it('debería rechazar al usuario si no tiene match con el otro y no unirlo a la sala', async () => {
        // Arrange
        const { socket, io, emitirDesdeCliente } = crearSocketFalso({ usuarioId: idOscar });
        (obtenerMatchesDeUsuario as jest.Mock).mockResolvedValue([]);
        configurarChatPrivadoSocket(io);

        // Act
        await emitirDesdeCliente('unirse_chat_privado', idAna);

        // Assert
        expect(socket.emit).toHaveBeenCalledWith('error_chat_privado', 'No tienes match con este usuario');
        expect(socket.join).not.toHaveBeenCalled();
    });

    it('debería unir a la sala privada y enviar el historial si hay match', async () => {
        // Arrange
        const { socket, io, emitirDesdeCliente } = crearSocketFalso({ usuarioId: idOscar });
        const historial = [{ contenido: 'hola' }];
        (obtenerMatchesDeUsuario as jest.Mock).mockResolvedValue([{ companero: { mongo_id: idAna } }]);
        (Mensaje.find as jest.Mock).mockReturnValue(consultaFalsa(historial));
        configurarChatPrivadoSocket(io);

        // Act
        await emitirDesdeCliente('unirse_chat_privado', idAna);

        // Assert
        expect(socket.join).toHaveBeenCalledWith(nombreSalaPrivada(idOscar, idAna));
        expect(socket.emit).toHaveBeenCalledWith('historial_privado', historial);
    });
});
