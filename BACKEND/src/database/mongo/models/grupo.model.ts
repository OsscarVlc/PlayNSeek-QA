import { Schema, model } from 'mongoose';
import { IGrupo } from '../../../types/grupo.types';

const grupoSchema = new Schema<IGrupo>({
    nombre: { type: String, required: true },
    descripcion: { type: String },
    fecha_creacion: { type: Date, default: Date.now, required: true }, // la fecha se genera al momento de guardar el documento
    lider_id: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // ref: 'User' apuntan a la coleccoin de User (user.model)
    integrantes: [{ type: Schema.Types.ObjectId, ref: 'User' }], // ref: 'User' apuntan a la coleccoin de User (user.model)
    activo: { type: Boolean, default: true },
    imagen: { type: String }, // URL de la portada en Cloudinary (opcional)
    imagen_public_id: { type: String }, // id de Cloudinary para poder borrarla
});

export const Grupo = model<IGrupo>('Grupo', grupoSchema);
