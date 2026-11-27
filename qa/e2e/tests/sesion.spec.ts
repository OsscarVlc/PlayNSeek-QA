import { test, expect } from '@playwright/test';
import { USUARIO_QA, iniciarSesion } from './utilidades';

// RF-02: inicio y cierre de sesión. RNF-02: control de acceso en vistas protegidas.
test.describe('Sesión de usuario', () => {
    test('un usuario confirmado inicia sesión y llega a su perfil', async ({ page }) => {
        await iniciarSesion(page);

        await expect(page).toHaveURL(/\/perfil$/);
        await expect(page.getByRole('heading', { name: USUARIO_QA.nombre })).toBeVisible();
        await expect(page.getByText(USUARIO_QA.correo)).toBeVisible();
    });

    test('con una contraseña incorrecta se muestra un error y no entra', async ({ page }) => {
        await iniciarSesion(page, USUARIO_QA.correo, 'contraseña-equivocada');

        await expect(page.locator('#mensaje-login .alert-danger')).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);
    });

    test('una vista protegida sin sesión redirige al login', async ({ page }) => {
        await page.goto('/perfil');

        await expect(page).toHaveURL(/\/login$/);
    });

    test('al cerrar sesión ya no se puede volver al perfil', async ({ page }) => {
        await iniciarSesion(page);
        await expect(page).toHaveURL(/\/perfil$/);

        await page.getByRole('link', { name: 'Cerrar sesión' }).click();
        await page.goto('/perfil');

        await expect(page).toHaveURL(/\/login$/);
    });
});
