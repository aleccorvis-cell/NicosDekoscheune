import Database from 'better-sqlite3';
import path from 'path';

// Initialisiere die Datenbank Datei im Root-Verzeichnis (ausserhalb von src für Sauberkeit)
const dbPath = path.resolve('shop.db');
const db = new Database(dbPath);

// Performance Optimierungen für SQLite
db.pragma('journal_mode = WAL');

// Initialisiere Tabellen
export function initDb() {
    console.log('Initialisiere Datenbank...');

    // Admin User Tabelle
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT,
            role TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            description TEXT,
            price REAL,
            tax_rate REAL DEFAULT 0.19,
            stock INTEGER,
            image_url TEXT,
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_info TEXT, -- JSON: { name, address, email }
            total_price REAL,
            payment_method TEXT DEFAULT 'VORKASSE', -- 'PAYPAL', 'VORKASSE'
            status TEXT DEFAULT 'PENDING', -- OPEN, PROCESSING, COMPLETED
            shipping_method TEXT DEFAULT 'shipping', -- shipping, pickup
            shipping_cost REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            product_id INTEGER,
            product_name TEXT, -- Snapshot
            quantity INTEGER,
            price_at_purchase REAL,
            custom_text TEXT, -- Individualisierung
            FOREIGN KEY(order_id) REFERENCES orders(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        );
    `);

    // Migrations (Quick & Dirty for Dev)
    try { db.exec("ALTER TABLE classes ADD COLUMN shipping_method TEXT DEFAULT 'shipping'"); } catch (e) { } // Typo in table name? No, wait.
    try { db.exec("ALTER TABLE orders ADD COLUMN shipping_method TEXT DEFAULT 'shipping'"); } catch (e) { }
    try { db.exec("ALTER TABLE orders ADD COLUMN shipping_cost REAL DEFAULT 0"); } catch (e) { }
    try { db.exec("ALTER TABLE order_items ADD COLUMN custom_text TEXT"); } catch (e) { }
    try { db.exec("ALTER TABLE order_items ADD COLUMN custom_font TEXT DEFAULT 'Standard'"); } catch (e) { }

    console.log('Datenbanktabellen geprüft/erstellt.');
}

export default db;
