import argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
    try {
        return await argon2.hash(password);
    } catch (err) {
        console.error('Fehler beim Hashen des Passworts:', err);
        throw new Error('Internal Server Error bei Passwortverarbeitung');
    }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
        return await argon2.verify(hash, password);
    } catch (err) {
        console.error('Fehler beim Verifizieren des Passworts:', err);
        return false;
    }
}
