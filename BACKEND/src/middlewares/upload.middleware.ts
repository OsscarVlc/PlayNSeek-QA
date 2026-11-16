import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { HttpStatus } from '../types/https-status';

// guardamos temporalmente en memoria porque de ahi
// lo subimos directo a Cloudinary sin necesitar un archivo fisico intermedio
const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB maximo
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Solo se permiten archivos de imagen'));
        }
        cb(null, true);
    },
});

/**
 * Igual que upload.single(campo), pero si multer rechaza el archivo (no es
 * imagen o pesa demasiado) responde 400 con { message }, que es la forma de
 * error que espera el front, en vez de dejar que Express responda un 500.
 */
export function subirUnaImagen(campo: string) {
    const middleware = upload.single(campo);

    return (req: Request, res: Response, next: NextFunction) => {
        middleware(req, res, (err: unknown) => {
            if (!err) {
                return next();
            }

            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(HttpStatus.BAD_REQUEST).json({ message: 'La imagen no debe superar los 15 MB' });
            }

            return res.status(HttpStatus.BAD_REQUEST).json({ message: (err as Error).message });
        });
    };
}