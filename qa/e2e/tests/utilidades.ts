import { Page, expect } from '@playwright/test';

/** Usuario sembrado por BACKEND/scripts/seed-qa.ts */
export const USUARIO_QA = {
    nombre: 'Usuario QA 1',
    correo: 'usuario1@qa.playnseek.test',
};

export function passwordQa(): string {
    const password = process.env.QA_PASSWORD;
    if (!password) throw new Error('Falta QA_PASSWORD (qa/.env.qa). Corre primero medir.ps1 o crea el archivo.');
    return password;
}

/** Inicia sesión desde la vista de login, igual que un usuario real. */
export async function iniciarSesion(page: Page, correo = USUARIO_QA.correo, password = passwordQa()) {
    await page.goto('/login');
    await page.locator('#email').fill(correo);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
}

/**
 * Registra cualquier violación de la Content-Security-Policy que ocurra en la página.
 * Se debe llamar antes de navegar. Devuelve la lista, que se llena conforme el navegador
 * bloquea recursos (scripts, estilos, imágenes, conexiones).
 */
export async function vigilarCsp(page: Page): Promise<string[]> {
    const violaciones: string[] = [];
    await page.exposeFunction('reportarViolacionCsp', (detalle: string) => violaciones.push(detalle));
    await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
            (window as unknown as { reportarViolacionCsp: (d: string) => void }).reportarViolacionCsp(
                `${e.violatedDirective} bloqueó ${e.blockedURI || 'código inline'}`,
            );
        });
    });
    page.on('console', (msg) => {
        if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) violaciones.push(msg.text());
    });
    return violaciones;
}

export async function esperarSinViolaciones(violaciones: string[]) {
    // Margen para que lleguen los eventos de recursos que cargan después del DOM
    await new Promise((r) => setTimeout(r, 500));
    expect(violaciones, violaciones.join('\n')).toEqual([]);
}
