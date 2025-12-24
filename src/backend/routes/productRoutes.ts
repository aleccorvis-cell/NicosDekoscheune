import express from 'express';
import { z } from 'zod';
import db from '../utils/db.ts';
import { authenticateJWT } from '../middleware/authMiddleware.ts';
import { uploadMiddleware, processImage } from '../middleware/uploadMiddleware.ts';

const router = express.Router();

// Validation Schemas
const productSchema = z.object({
    name: z.string().min(1, 'Name ist erforderlich'),
    description: z.string().optional(),
    price_net: z.coerce.number().min(0, 'Preis muss positiv sein'),
    tax_rate: z.coerce.number().default(0.19),
    stock: z.coerce.number().int().min(0, 'Bestand muss positiv sein').default(0),
    image_url: z.string().optional().nullable(),
    category: z.string().optional()
});

// GET / - Alle Produkte
router.get('/', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM products ORDER BY created_at DESC');
        const products = stmt.all() as any[];

        // Add calculated fields
        const enrichedProducts = products.map(p => ({
            ...p,
            stock_status: p.stock <= 10 ? 'LOW' : 'OK'
        }));

        res.json(enrichedProducts);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Produkte' });
    }
});

// GET /:id - Einzelnes Produkt
router.get('/:id', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
        const product = stmt.get(req.params.id) as any;

        if (!product) {
            return res.status(404).json({ error: 'Produkt nicht gefunden' });
        }

        res.json({
            ...product,
            stock_status: product.stock <= 10 ? 'LOW' : 'OK'
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Fehler beim Laden des Produkts' });
    }
});

// GET /categories - Kategorien abrufen (Distinct + Defaults)
router.get('/categories', (req, res) => {
    try {
        const stmt = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""');
        const rows = stmt.all() as { category: string }[];

        const usedCategories = rows.map(r => r.category);
        const defaultCategories = ['Holz', 'Stein', 'Schmuck'];

        // Merge and unique
        const allCategories = Array.from(new Set([...defaultCategories, ...usedCategories])).sort();

        res.json(allCategories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
    }
});

// --- Protected Routes (Admin only) ---

// POST / - Produkt erstellen
router.post('/', authenticateJWT, uploadMiddleware, processImage, (req, res) => {
    try {
        console.log('Body:', req.body);
        console.log('File:', req.file);

        const parseResult = productSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: 'Validierungsfehler', details: parseResult.error.errors });
        }

        const { name, description, price_net, tax_rate, stock, image_url, category } = parseResult.data;

        // Calculate Gross Price
        const price_gross = price_net * (1 + tax_rate);

        const stmt = db.prepare(`
            INSERT INTO products (name, description, price, tax_rate, stock, image_url, category)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        // Use processed image_url (from middleware) or null
        const finalImageUrl = req.body.image_url || null;

        const result = stmt.run(name, description || null, price_gross, tax_rate, stock, finalImageUrl, category || null);

        res.status(201).json({
            success: true,
            id: result.lastInsertRowid,
            message: 'Produkt erstellt',
            price_gross: price_gross.toFixed(2)
        });

    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Fehler beim Erstellen des Produkts' });
    }
});

// PUT /:id - Produkt bearbeiten
router.post('/:id', authenticateJWT, uploadMiddleware, processImage, (req, res) => {
    // Note: Using POST for update to support HTML Forms/Multipart which lack native PUT support sometimes, 
    // but typically we should route PUT. However, multer works best with POST.
    // Let's stick to using router.put if we can, but verify if client sends PUT. 
    // Actually, client (wizard) currently only creates. Dashboard list has "Bearbeiten" stub.
    // The test sends PUT. So we need router.put.
    // But Multer on PUT? Yes, works.
    handleUpdate(req, res);
});

router.put('/:id', authenticateJWT, uploadMiddleware, processImage, (req, res) => {
    handleUpdate(req, res);
});

function handleUpdate(req: any, res: any) {
    try {
        const parseResult = productSchema.partial().safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: 'Validierungsfehler', details: parseResult.error.errors });
        }

        const id = req.params.id;
        const updates = parseResult.data;

        // 1. Fetch existing
        const stmtGet = db.prepare('SELECT * FROM products WHERE id = ?');
        const current = stmtGet.get(id) as any;

        if (!current) {
            return res.status(404).json({ error: 'Produkt nicht gefunden' });
        }

        // 2. Prepare new values
        let newPriceNet = updates.price_net !== undefined ? updates.price_net : (current.price / (1 + current.tax_rate));
        let newTaxRate = updates.tax_rate !== undefined ? updates.tax_rate : current.tax_rate;

        // Recalculate Gross if Net or Tax changed
        let priceGross = current.price;
        if (updates.price_net !== undefined || updates.tax_rate !== undefined) {
            priceGross = newPriceNet * (1 + newTaxRate);
        }

        const keys: string[] = [];
        const values: any[] = [];

        if (updates.name) { keys.push('name = ?'); values.push(updates.name); }
        if (updates.description) { keys.push('description = ?'); values.push(updates.description); }
        if (updates.stock !== undefined) { keys.push('stock = ?'); values.push(updates.stock); }
        if (updates.category) { keys.push('category = ?'); values.push(updates.category); }
        if (req.body.image_url) { keys.push('image_url = ?'); values.push(req.body.image_url); }

        // Always update price/tax if changed logic implies it, but efficient query only updates changed
        if (updates.price_net !== undefined || updates.tax_rate !== undefined) {
            keys.push('price = ?'); values.push(priceGross);
            keys.push('tax_rate = ?'); values.push(newTaxRate);
        }

        if (keys.length === 0) {
            return res.json({ success: true, message: 'Nichts zu ändern' });
        }

        const stmt = db.prepare(`UPDATE products SET ${keys.join(', ')} WHERE id = ?`);
        stmt.run(...values, id);

        res.json({ success: true, message: 'Produkt aktualisiert', id });

    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Fehler beim Aktualisieren des Produkts' });
    }
}

// DELETE /:id - Produkt löschen
router.delete('/:id', authenticateJWT, (req, res) => {
    try {
        const productId = req.params.id;

        // First delete related order_items (orphan them from this product)
        const deleteItems = db.prepare('DELETE FROM order_items WHERE product_id = ?');
        deleteItems.run(productId);

        // Now delete the product
        const stmt = db.prepare('DELETE FROM products WHERE id = ?');
        const result = stmt.run(productId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Produkt nicht gefunden' });
        }

        res.json({ success: true, message: 'Produkt gelöscht' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Fehler beim Löschen des Produkts' });
    }
});

export default router;
