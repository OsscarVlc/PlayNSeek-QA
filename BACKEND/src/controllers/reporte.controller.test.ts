import { Response } from 'express';
import { AuthRequest } from '../types/auth-request';
import { listarReportes } from './reporte.controller';
import { Reporte } from '../database/mongo/models/reporte.model';

jest.mock('../database/mongo/models/reporte.model');

function crearRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    } as unknown as Response;
}

/** Simula la cadena Reporte.find().skip().limit().populate().populate() */
function mockConsultaReportes(resultado: unknown[]) {
    const consulta = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        then: (resolver: (v: unknown[]) => void) => resolver(resultado),
    };
    (Reporte.find as jest.Mock).mockReturnValue(consulta);
    (Reporte.countDocuments as jest.Mock).mockResolvedValue(resultado.length);
    return consulta;
}

const moderador = { _id: '111111111111111111111111', rol: 'MOD' };

describe('listarReportes (PNSQ-39)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('debería rechazar con 400 un estado con operador de MongoDB', async () => {
        // Arrange: ?estado[$ne]=pendiente llega a Express como un objeto
        const req = { user: moderador, query: { estado: { $ne: 'pendiente' } } } as unknown as AuthRequest;
        const res = crearRes();

        // Act
        await listarReportes(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(Reporte.find).not.toHaveBeenCalled();
    });

    it('debería filtrar por un estado válido del enum', async () => {
        // Arrange
        const req = { user: moderador, query: { estado: 'pendiente' } } as unknown as AuthRequest;
        const res = crearRes();
        mockConsultaReportes([]);

        // Act
        await listarReportes(req, res);

        // Assert
        expect(Reporte.find).toHaveBeenCalledWith({ estado: 'pendiente' });
    });

    it('debería limitar a 50 reportes por página aunque pidan más', async () => {
        // Arrange
        const req = { user: moderador, query: { limite: '100000' } } as unknown as AuthRequest;
        const res = crearRes();
        const consulta = mockConsultaReportes([]);

        // Act
        await listarReportes(req, res);

        // Assert
        expect(consulta.limit).toHaveBeenCalledWith(50);
    });
});
