import cloudinary from '../config/cloudinary.config';

// Sube la foto de perfil. Se conserva tal cual porque la usa /user/actualizar.
export function subirImagenACloudinary(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ folder: 'play-n-seek/perfiles' }, (error, result) => {
            if (error || !result) {
                return reject(error);
            }
            resolve(result.secure_url);
        });
        uploadStream.end(buffer);
    });
}

// Lo que devuelve una subida: la URL pública para mostrarla y el public_id,
// que Cloudinary pide para poder borrarla después.
export interface ImagenSubida {
    url: string;
    publicId: string;
}

// Sube una imagen a la carpeta indicada (por ejemplo 'play-n-seek/grupos')
export function subirImagen(buffer: Buffer, carpeta: string): Promise<ImagenSubida> {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ folder: carpeta }, (error, result) => {
            if (error || !result) {
                return reject(error);
            }
            resolve({ url: result.secure_url, publicId: result.public_id });
        });
        uploadStream.end(buffer);
    });
}

// Borra una imagen de Cloudinary por su public_id
export async function eliminarImagen(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
}
