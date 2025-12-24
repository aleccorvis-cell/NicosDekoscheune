import db, { initDb } from './db.ts';
import { hashPassword } from './auth.ts';

async function seedAdmin() {
    initDb();

    const adminUsername = 'admin';
    const adminPassword = 'securePassword123!'; // Dies sollte in Produktion geändert werden!

    // Check ob Admin existiert
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(adminUsername);

    if (!user) {
        console.log('Erstelle Standard-Admin Account...');
        try {
            const hash = await hashPassword(adminPassword);
            const insert = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
            insert.run(adminUsername, hash, 'admin');
            console.log(`Admin User '${adminUsername}' erfolgreich erstellt.`);
            console.log('Bitte ändern Sie das Passwort nach dem ersten Login!');
        } catch (error) {
            console.error('Fehler beim Erstellen des Admin Users:', error);
        }
    } else {
        console.log('Admin User existiert bereits.');
    }
}

// Wenn dieses Skript direkt ausgeführt wird
if (import.meta.url === `file://${process.argv[1]}`) {
    seedAdmin();
}

export { seedAdmin };
