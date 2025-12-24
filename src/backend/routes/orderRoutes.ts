import express from 'express';
import { z } from 'zod';
import db from '../utils/db.ts';
import { authenticateJWT } from '../middleware/authMiddleware.ts';

const router = express.Router();

// Alle API-Calls hier sind für Admins geschützt
router.use(authenticateJWT);

// GET /api/admin/orders - Alle Bestellungen abrufen
router.get('/', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM orders ORDER BY created_at DESC');
        const orders = stmt.all() as any[];

        // Items laden für jede Order
        const ordersWithItems = orders.map(order => {
            const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
            const items = itemsStmt.all(order.id);
            return {
                ...order,
                customer_info: JSON.parse(order.customer_info), // JSON String parsen
                items
            };
        });

        res.json(ordersWithItems);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Bestellungen' });
    }
});

// PUT /api/admin/orders/:id/status - Status ändern
const statusSchema = z.object({
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'OPEN'])
});

router.put('/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = statusSchema.parse(req.body);

        const stmt = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
        const result = stmt.run(status, id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Bestellung nicht gefunden' });
        }

        res.json({ success: true, message: 'Status aktualisiert' });
    } catch (error: any) {
        console.error('Update Status Error:', error);
        res.status(400).json({ error: error.message || 'Fehler beim Aktualisieren' });
    }
});

// PUT /api/admin/orders/:id - Bestellung bearbeiten
const orderUpdateSchema = z.object({
    customer_info: z.object({
        billing: z.object({
            name: z.string(),
            street: z.string(),
            zip: z.string(),
            city: z.string()
        }),
        shipping: z.object({
            name: z.string(),
            street: z.string(),
            zip: z.string(),
            city: z.string()
        }).optional(),
        email: z.string().email()
    }).optional(),
    total_price: z.number().positive().optional(),
    shipping_method: z.enum(['shipping', 'pickup']).optional(),
    shipping_cost: z.number().min(0).optional()
});

router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = orderUpdateSchema.parse(req.body);

        const keys: string[] = [];
        const values: any[] = [];

        if (updates.customer_info) {
            keys.push('customer_info = ?');
            values.push(JSON.stringify(updates.customer_info));
        }
        if (updates.total_price !== undefined) {
            keys.push('total_price = ?');
            values.push(updates.total_price);
        }
        if (updates.shipping_method) {
            keys.push('shipping_method = ?');
            values.push(updates.shipping_method);
        }
        if (updates.shipping_cost !== undefined) {
            keys.push('shipping_cost = ?');
            values.push(updates.shipping_cost);
        }

        if (keys.length === 0) {
            return res.json({ success: true, message: 'Nichts zu ändern' });
        }

        const stmt = db.prepare(`UPDATE orders SET ${keys.join(', ')} WHERE id = ?`);
        const result = stmt.run(...values, id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Bestellung nicht gefunden' });
        }

        res.json({ success: true, message: 'Bestellung aktualisiert' });
    } catch (error: any) {
        console.error('Update Order Error:', error);
        res.status(400).json({ error: error.message || 'Fehler beim Aktualisieren' });
    }
});

// DELETE /api/admin/orders/:id - Bestellung löschen
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        // First delete order items
        const deleteItems = db.prepare('DELETE FROM order_items WHERE order_id = ?');
        deleteItems.run(id);

        // Then delete order
        const deleteOrder = db.prepare('DELETE FROM orders WHERE id = ?');
        const result = deleteOrder.run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Bestellung nicht gefunden' });
        }

        res.json({ success: true, message: 'Bestellung gelöscht' });
    } catch (error: any) {
        console.error('Delete Order Error:', error);
        res.status(500).json({ error: 'Fehler beim Löschen' });
    }
});

export default router;
