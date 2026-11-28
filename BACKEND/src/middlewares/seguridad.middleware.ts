// Cabeceras HTTP de seguridad para todas las respuestas (PNSQ-43).
//
// helmet agrega las cabeceras recomendadas por OWASP: Content-Security-Policy,
// X-Frame-Options / frame-ancestors (anti-clickjacking), X-Content-Type-Options,
// Cross-Origin-Opener-Policy, Referrer-Policy, etc., y quita X-Powered-By.
import { NextFunction, Request, RequestHandler, Response } from 'express';
import helmet from 'helmet';

// Único CDN que usan las vistas (Bootstrap y Bootstrap Icons).
const CDN = 'https://cdn.jsdelivr.net';

const politicaDeContenido = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // Scripts solo del propio servidor y del CDN. Las vistas no usan scripts inline.
            scriptSrc: ["'self'", CDN],
            styleSrc: ["'self'", CDN, "'unsafe-inline'"],
            fontSrc: ["'self'", CDN, 'data:'],
            // Portadas de RAWG y fotos de perfil de Cloudinary.
            imgSrc: ["'self'", 'data:', 'https:'],
            // fetch al API y Socket.IO, ambos en el mismo origen.
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            formAction: ["'self'"],
            baseUri: ["'self'"],
            // El despliegue en EC2 es HTTP: forzar HTTPS rompería CSS y scripts propios.
            upgradeInsecureRequests: null,
        },
    },
    // require-corp bloquearía las imágenes de RAWG y Cloudinary, que no mandan CORP.
    crossOriginEmbedderPolicy: false,
});

// helmet no define Permissions-Policy: desactivamos APIs del navegador que la app no usa.
function politicaDePermisos(_req: Request, res: Response, next: NextFunction) {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    next();
}

export const cabecerasDeSeguridad: RequestHandler[] = [politicaDeContenido, politicaDePermisos];
