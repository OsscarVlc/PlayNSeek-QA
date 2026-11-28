// jest.setup.ts (en la raíz de BACKEND, al lado de jest.config.js)
// Se ejecuta antes de cada archivo de pruebas.
import 'dotenv/config';

// Las pruebas no deben depender del .env de cada desarrollador ni de los
// secretos reales. Fijamos aquí los valores que el código necesita para que
// la suite se comporte igual en cualquier máquina y en GitHub Actions.
process.env.JWT_SECRET = 'jwt-secret-solo-para-pruebas';
