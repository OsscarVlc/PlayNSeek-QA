import { NextFunction, Request, Response } from 'express';

/**
 * Algunas vistas comparten ruta con la API (por ejemplo GET /juegos y GET /juegos/:id).
 * Como el router de vistas se registra primero, sin esto la vista respondía siempre y la
 * ruta de la API quedaba inalcanzable (PNSQ-45).
 *
 * Si el cliente prefiere JSON (Accept: application/json, como fetch o Angular), se salta
 * la vista con next('route') y Express sigue con la ruta de la API. El navegador manda
 * Accept: text/html, así que sigue viendo la vista.
 */
export function soloSiPideHtml(req: Request, _res: Response, next: NextFunction) {
    if (req.accepts(['html', 'json']) === 'json') {
        return next('route');
    }
    next();
}
