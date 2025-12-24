import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { type RequestHandler } from 'express';

// Standard Helmet Konfiguration für Sicherheits-Header
// Deaktiviert 'contentSecurityPolicy' fürs erste, falls Frontend Ressourcen von extern geladen werden müssen (kann später verschärft werden)
export const setupHelmet = () => helmet({
    contentSecurityPolicy: false,
});

// Rate Limiter gegen Brute Force und DoS
// Basis Limiter für alle Requests
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Minuten
    limit: 100, // Limit pro IP auf 100 Requests pro Fenster
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Zu viele Anfragen von dieser IP, bitte versuchen Sie es später erneut.'
});

// Strenger Limiter für Login Routes (gegen Brute Force auf Passwörter)
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 Stunde
    limit: 5, // Max 5 fehlgeschlagene Versuche pro IP (eigentlich total, aber hier Login Versuche)
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Zu viele Login-Versuche, Account vorübergehend gesperrt.'
});
