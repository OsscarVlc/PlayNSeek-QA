import { leerEnteroPositivo, leerObjectId, leerOpcion, leerTexto } from './entrada';

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

describe('leerObjectId', () => {
    it('devuelve el identificador válido como texto sin espacios', () => {
        // Arrange
        const id = '507f1f77bcf86cd799439011';

        // Act
        const resultado = leerObjectId(` ${id} `);

        // Assert
        expect(resultado).toBe(id);
    });

    it.each([[{ $ne: null }], [['507f1f77bcf86cd799439011']], ['id-invalido']])('rechaza el valor %p', (valor) => {
        // Act
        const resultado = leerObjectId(valor);

        // Assert
        expect(resultado).toBeNull();
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
