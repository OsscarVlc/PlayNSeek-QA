// Lectura segura de datos que llegan del cliente (req.body, req.query, req.params).
//
// Express entrega lo que el cliente mande: si en vez de un texto llega un objeto como
// {"$ne": null}, y ese objeto se usa tal cual en un filtro de Mongoose, la consulta cambia
// de significado (inyección NoSQL). Estas funciones solo dejan pasar el tipo esperado y
// devuelven null en cualquier otro caso, para que el controller responda 400.

/** Devuelve el texto (sin espacios a los lados) solo si es un string no vacío. */
export function leerTexto(valor: unknown): string | null {
    if (typeof valor !== 'string') return null;
    const texto = valor.trim();
    return texto === '' ? null : texto;
}

/** Devuelve un entero positivo; acepta number o texto numérico ("42"). */
export function leerEnteroPositivo(valor: unknown): number | null {
    const numero = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
    if (typeof numero !== 'number' || !Number.isSafeInteger(numero) || numero <= 0) return null;
    return numero;
}

/** Devuelve el valor solo si es uno de los valores permitidos (por ejemplo, los de un enum). */
export function leerOpcion<T extends string>(valor: unknown, permitidos: readonly T[]): T | null {
    return typeof valor === 'string' && (permitidos as readonly string[]).includes(valor) ? (valor as T) : null;
}
