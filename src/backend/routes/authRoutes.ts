import express from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import db from '../utils/db.ts';
import { verifyPassword } from '../utils/auth.ts';
import { authLimiter } from '../middleware/security.ts';

const router = express.Router();

// Validierungsschema für Login
const loginSchema = z.object({
    username: z.string().min(1, 'Benutzername ist erforderlich'),
    password: z.string().min(1, 'Passwort ist erforderlich')
});

// JWT Secret (In Produktion aus ENV, hier Fallback für Dev)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-unsafe-change-me';

// Login Route
router.post('/login', authLimiter, async (req, res) => {
    try {
        console.log('Login Request Headers:', req.headers);
        console.log('Login Request Body:', req.body);
        // 1. Input Validierung
        const parseResult = loginSchema.safeParse(req.body);
        if (!parseResult.success) {
            // Sicherheits-Best-Practice: Generische Fehlermeldung um Enumeration zu erschweren? 
            // Hier geben wir Validation Errors zurück, da es Client-Fehler sind.
            // Für Authentifizierungsfehler nutzen wir aber generische Meldungen.
            return res.status(400).json({ error: 'Ungültige Eingaben', details: parseResult.error.errors });
        }

        const { username, password } = parseResult.data;

        // 2. User suchen
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        const user = stmt.get(username) as any;

        if (!user) {
            // Verzögerung um Timing-Attacks zu erschweren (simuliert)
            await new Promise(resolve => setTimeout(resolve, 500));
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        // 3. Passwort prüfen
        const validPassword = await verifyPassword(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        // 4. Token erstellen
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // 5. Cookie setzen (HttpOnly, Secure)
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Nur in Production Secure (HTTPS)
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 Stunden
        });

        res.json({ success: true, message: 'Erfolgreich eingeloggt' });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Logout Route
router.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true, message: 'Erfolgreich ausgeloggt' });
});

// Password Change Route
import { hashPassword } from '../utils/auth.ts';
import { authenticateJWT } from '../middleware/authMiddleware.ts';

const passwordSchema = z.object({
    currentPassword: z.string().min(1, 'Aktuelles Passwort erforderlich'),
    newPassword: z.string().min(8, 'Neues Passwort muss mindestens 8 Zeichen haben')
});

router.put('/change-password', authenticateJWT, async (req, res) => {
    try {
        const parseResult = passwordSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: 'Ungültige Eingaben', details: parseResult.error.errors });
        }

        const { currentPassword, newPassword } = parseResult.data;
        const userId = (req as any).user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Nicht authentifiziert' });
        }

        // Get current user
        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
        const user = stmt.get(userId) as any;

        if (!user) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        // Verify current password
        const validPassword = await verifyPassword(currentPassword, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
        }

        // Hash new password and update
        const newHash = await hashPassword(newPassword);
        const updateStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        updateStmt.run(newHash, userId);

        res.json({ success: true, message: 'Passwort erfolgreich geändert' });

    } catch (error) {
        console.error('Password Change Error:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Password Reset Request
import { sendPasswordResetEmail } from '../utils/emailService.ts';
import crypto from 'crypto';

// Store reset tokens in memory (in production, use database)
const resetTokens = new Map<string, { expires: number }>();

router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Store token with 1 hour expiry
        resetTokens.set(resetToken, {
            expires: Date.now() + 60 * 60 * 1000
        });

        // Send email
        await sendPasswordResetEmail(resetToken);

        res.json({ success: true, message: 'E-Mail zum Zurücksetzen wurde gesendet' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Reset Password with Token
const resetSchema = z.object({
    token: z.string().min(1, 'Token erforderlich'),
    newPassword: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben')
});

router.post('/reset-password', async (req, res) => {
    try {
        const parseResult = resetSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: 'Ungültige Eingaben' });
        }

        const { token, newPassword } = parseResult.data;

        // Verify token
        const tokenData = resetTokens.get(token);
        if (!tokenData || tokenData.expires < Date.now()) {
            return res.status(400).json({ error: 'Token ungültig oder abgelaufen' });
        }

        // Get admin user (first user with admin role)
        const stmt = db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1');
        const user = stmt.get('admin') as any;

        if (!user) {
            return res.status(404).json({ error: 'Admin-Benutzer nicht gefunden' });
        }

        // Update password
        const newHash = await hashPassword(newPassword);
        const updateStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        updateStmt.run(newHash, user.id);

        // Delete used token
        resetTokens.delete(token);

        res.json({ success: true, message: 'Passwort erfolgreich zurückgesetzt' });

    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

export default router;
