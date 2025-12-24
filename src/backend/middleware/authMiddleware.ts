import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-unsafe-change-me';

// Extend Express Request type to include user data
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.auth_token;

    if (token) {
        jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
            if (err) {
                // Token invalid or expired
                // Clear cookie and redirect to login
                res.clearCookie('auth_token');
                return res.redirect('/admin/login');
            }

            // Token valid
            req.user = user;
            next();
        });
    } else {
        // No token provided
        res.redirect('/admin/login');
    }
};
