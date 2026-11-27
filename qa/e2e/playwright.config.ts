import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Usuarios y contraseña de prueba del entorno de QA (qa/.env.qa, generado por medir.ps1)
dotenv.config({ path: path.join(__dirname, '..', '.env.qa'), quiet: true });

export default defineConfig({
    testDir: './tests',
    // Las pruebas comparten la misma base sembrada; en serie evitamos interferencias.
    workers: 1,
    retries: 0,
    timeout: 30_000,
    reporter: [['list'], ['html', { outputFolder: process.env.E2E_REPORTE ?? 'playwright-report', open: 'never' }]],
    use: {
        baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
