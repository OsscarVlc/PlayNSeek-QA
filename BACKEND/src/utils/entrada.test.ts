import { leerEnteroPositivo, leerOpcion, leerTexto } from './entrada';

describe('leerTexto', () => {
    it('devuelve el texto sin espacios a los lados', () => {
        expect(leerTexto('  ana@correo.com ')).toBe('ana@correo.com');
    });

    it('rechaza objetos con operadores de MongoDB (inyección NoSQL)', () => {
        expect(leerTexto({ $ne: null })).toBeNull();
        expect(leerTexto({ $gt: '' })).toBeNull();
    });

    it('rechaza textos vacíos y tipos que no son texto', () => {
        expect(leerTexto('')).toBeNull();
        expect(leerTexto('   ')).toBeNull();
        expect(leerTexto(undefined)).toBeNull();
        expect(leerTexto(123)).toBeNull();
        expect(leerTexto(['a'])).toBeNull();
    });
});

describe('leerEnteroPositivo', () => {
    it('acepta números y textos numéricos', () => {
        expect(leerEnteroPositivo(415171)).toBe(415171);
        expect(leerEnteroPositivo('42')).toBe(42);
    });

    it('rechaza objetos, decimales, negativos, cero y textos no numéricos', () => {
        expect(leerEnteroPositivo({ $gt: 0 })).toBeNull();
        expect(leerEnteroPositivo(1.5)).toBeNull();
        expect(leerEnteroPositivo(-3)).toBeNull();
        expect(leerEnteroPositivo(0)).toBeNull();
        expect(leerEnteroPositivo('../admin')).toBeNull();
        expect(leerEnteroPositivo('')).toBeNull();
    });
});

describe('leerOpcion', () => {
    const estados = ['pendiente', 'resuelto'] as const;

    it('acepta un valor permitido', () => {
        expect(leerOpcion('pendiente', estados)).toBe('pendiente');
    });

    it('rechaza valores fuera de la lista y objetos', () => {
        expect(leerOpcion('borrado', estados)).toBeNull();
        expect(leerOpcion({ $ne: 'pendiente' }, estados)).toBeNull();
    });
});
