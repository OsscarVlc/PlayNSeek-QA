import { Request, Response } from 'express';
import { Comentario } from '../database/mongo/models/comentario.model';
import { listarComentarios } from './comentario.controller';

jest.mock('../database/mongo/models/comentario.model');

describe('listarComentarios', () => {
    beforeEach(() => jest.clearAllMocks());

    it.each([{ $ne: null }, 'id-invalido'])('rechaza el post %p antes de consultar el modelo', async (valor) => {
        // Arrange
        const req = { query: { post_id: valor } } as unknown as Request;
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;

        // Act
        await listarComentarios(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(Comentario.find).not.toHaveBeenCalled();
        expect(Comentario.countDocuments).not.toHaveBeenCalled();
    });

    it.each([
        {
            nombre: 'filtra por el id válido y usa la paginación predeterminada',
            query: { post_id: ' 507f1f77bcf86cd799439011 ' },
            filtro: { post_id: '507f1f77bcf86cd799439011' },
            limite: 10,
            totalPaginas: 6,
        },
        {
            nombre: 'usa la primera página y limita a 50 al listar sin filtro',
            query: { pagina: '1.5', limite: '100' },
            filtro: {},
            limite: 50,
            totalPaginas: 2,
        },
    ])('$nombre', async ({ query, filtro, limite, totalPaginas }) => {
        // Arrange
        const req = { query } as unknown as Request;
        const res = { json: jest.fn() } as unknown as Response;
        const data = [{ contenido: 'Hola' }];
        const limit = jest.fn().mockResolvedValue(data);
        const skip = jest.fn().mockReturnValue({ limit });
        const populate = jest.fn().mockReturnValue({ skip });
        (Comentario.find as jest.Mock).mockReturnValue({ populate });
        (Comentario.countDocuments as jest.Mock).mockResolvedValueOnce(51);

        // Act
        await listarComentarios(req, res);

        // Assert
        expect(Comentario.find).toHaveBeenCalledWith(filtro);
        expect(Comentario.countDocuments).toHaveBeenCalledWith(filtro);
        expect(populate).toHaveBeenCalledWith('usuario_id', 'nombre');
        expect(skip).toHaveBeenCalledWith(0);
        expect(limit).toHaveBeenCalledWith(limite);
        expect(res.json).toHaveBeenCalledWith({ data, pagina: 1, totalPaginas, total: 51 });
    });
});
