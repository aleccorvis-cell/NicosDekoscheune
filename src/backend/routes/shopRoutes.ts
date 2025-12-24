import express from 'express';
import { z } from 'zod';
import db from '../utils/db.ts';
import { sendOrderNotification } from '../utils/emailService.ts';

const router = express.Router();

const boxSchema = z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    customText: z.string().optional(),
    customFont: z.string().optional()  // NEW: Font selection
});

const addressSchema = z.object({
    name: z.string().min(2, 'Name zu kurz'),
    street: z.string().min(5, 'Straße zu kurz'),
    zip: z.string().min(4, 'PLZ ungültig'),
    city: z.string().min(2, 'Stadt zu kurz')
});

const checkoutSchema = z.object({
    items: z.array(boxSchema).min(1, 'Warenkorb ist leer'),
    billing: addressSchema,
    shipping: addressSchema.optional(),
    shippingMethod: z.enum(['shipping', 'pickup']).default('shipping'),
    email: z.string().email('Ungültige E-Mail'),
    paymentMethod: z.literal('PayPal').default('PayPal'),
    website: z.string().optional()
});

// POST /api/shop/checkout
router.post('/checkout', async (req, res) => {
    try {
        const parseResult = checkoutSchema.safeParse(req.body);
        if (!parseResult.success) {
            console.error('Validation Error:', parseResult.error.errors);
            return res.status(400).json({ error: 'Ungültige Daten', details: parseResult.error.errors });
        }

        const { items, billing, shipping, email, paymentMethod, website, shippingMethod } = parseResult.data;

        // 1. HONEYPOT CHECK
        if (website && website.length > 0) {
            console.warn('Bot detected via Honeypot');
            return res.status(400).json({ error: 'Spam detected' });
        }

        const shippingCost = shippingMethod === 'shipping' ? 5.99 : 0;

        // Transaction: Check stock -> Create Order -> Decrement
        let orderId: number | bigint = 0;
        let totalPrice = 0;
        const orderItemsPayload: any[] = [];

        const transaction = db.transaction((cartItems, billingData, shippingData, emailData, payment, method, shipCost) => {
            totalPrice = 0;

            // 1. Stock Check & Price Calculation
            for (const item of cartItems) {
                const stmt = db.prepare('SELECT id, name, price, stock FROM products WHERE id = ?');
                const product = stmt.get(item.productId) as any;

                if (!product) throw new Error(`Produkt ID ${item.productId} nicht gefunden.`);

                if (product.stock < item.quantity) throw new Error(`"${product.name}" nicht ausreichend verfügbar.`);

                totalPrice += product.price * item.quantity;
                orderItemsPayload.push({
                    product_id: product.id,
                    product_name: product.name,
                    quantity: item.quantity,
                    price: product.price,
                    custom_text: item.customText || '',
                    custom_font: item.customFont || 'Standard'
                });
            }

            totalPrice += shipCost;

            // 2. Insert Order
            const customerInfo = {
                billing: billingData,
                shipping: shippingData || billingData,
                email: emailData
            };

            const insertOrder = db.prepare(`
                INSERT INTO orders 
                (customer_info, total_price, payment_method, status, shipping_method, shipping_cost) 
                VALUES (?, ?, ?, 'PENDING', ?, ?)
            `);

            const infoJson = JSON.stringify(customerInfo);
            const orderResult = insertOrder.run(infoJson, totalPrice, payment, method, shipCost);
            orderId = orderResult.lastInsertRowid;

            // 3. Insert Items & Update Stock
            const insertOrderItem = db.prepare(`
                INSERT INTO order_items 
                (order_id, product_id, product_name, quantity, price_at_purchase, custom_text, custom_font) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

            for (const item of orderItemsPayload) {
                insertOrderItem.run(orderId, item.product_id, item.product_name, item.quantity, item.price, item.custom_text, item.custom_font);
                updateStock.run(item.quantity, item.product_id);
            }
        });

        transaction(items, billing, shipping, email, paymentMethod, shippingMethod, shippingCost);

        // 4. Send notification email (async, don't block response)
        const customerInfo = {
            billing,
            shipping: shipping || billing,
            email
        };

        sendOrderNotification(
            { id: orderId, total_price: totalPrice, shipping_method: shippingMethod },
            customerInfo,
            orderItemsPayload
        ).catch(err => console.error('Email notification failed:', err));

        res.json({ success: true, message: 'Bestellung erfolgreich!' });

    } catch (error: any) {
        console.error('Checkout Error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

export default router;
