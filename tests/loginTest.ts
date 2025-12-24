import { start } from 'repl';

async function testLogin() {
    const url = 'http://localhost:3000/api/admin/login';

    // 1. Erfolgreicher Login
    console.log('Testing Valid Login...');
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'securePassword123!' })
        });

        if (res.ok) {
            console.log('✅ Login erfolgreich:', await res.json());
            const cookies = res.headers.get('set-cookie');
            console.log('✅ Cookie erhalten:', cookies ? 'Ja' : 'Nein');
        } else {
            console.error('❌ Login fehlgeschlagen:', await res.json());
        }
    } catch (e) {
        console.error('❌ Verbindung fehlerhaft:', e);
    }

    // 2. Falsches Passwort
    console.log('\nTesting Invalid Password...');
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
        });

        if (res.status === 401) {
            console.log('✅ Invalid Login korrekt abgelehnt (401)');
        } else {
            console.error('❌ Unerwarteter Status:', res.status, await res.json());
        }
    } catch (e) {
        console.error(e);
    }
}

// Warte kurz damit Server starten kann (falls wir ihn hier starteten, aber wir nehmen an er läuft extern)
// Aber wir starten diesen Test manuell während der Server läuft.
testLogin();
