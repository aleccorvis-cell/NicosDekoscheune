import nodemailer from 'nodemailer';

// E-Mail Konfiguration aus Umgebungsvariablen
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'alec@alexandermunz.de';

// Transporter erstellen (konfiguriert für verschiedene Anbieter)
const createTransporter = () => {
    // Prüfen ob SMTP konfiguriert ist
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const port = parseInt(process.env.SMTP_PORT || '465');
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: port,
            secure: port === 465, // SSL für Port 465, STARTTLS für andere
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            connectionTimeout: 10000, // 10 Sekunden Timeout
            greetingTimeout: 5000,
            socketTimeout: 10000
        });
    }

    // Fallback: Ethereal Test Account (für Entwicklung)
    console.warn('SMTP nicht konfiguriert - E-Mails werden nur geloggt');
    return null;
};

// E-Mail senden (mit Fallback zu Konsolen-Log)
export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    const transporter = createTransporter();

    const mailOptions = {
        from: process.env.SMTP_FROM || 'Nicos Dekoscheune <noreply@example.com>',
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '')
    };

    if (!transporter) {
        // Fallback: Log email content
        console.log('=== E-MAIL (nicht gesendet - SMTP fehlt) ===');
        console.log('An:', to);
        console.log('Betreff:', subject);
        console.log('Inhalt:', text || html);
        console.log('=============================================');
        return true; // Return true for dev purposes
    }

    try {
        await transporter.sendMail(mailOptions);
        console.log('E-Mail gesendet an:', to);
        return true;
    } catch (error) {
        console.error('E-Mail Fehler:', error);
        return false;
    }
}

// Neue Bestellung Benachrichtigung
export async function sendOrderNotification(order: any, customerInfo: any, items: any[]): Promise<boolean> {
    const itemsHtml = items.map(item => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.product_name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.quantity}x</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.price.toFixed(2)} €</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.custom_text || '-'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.custom_font || 'Standard'}</td>
        </tr>
    `).join('');

    const hasShippingAddress = customerInfo.shipping && customerInfo.shipping.name;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #EA580C;">🛒 Neue Bestellung eingegangen!</h1>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="margin-top: 0;">Bestellung #${order.id}</h2>
                <p><strong>Datum:</strong> ${new Date().toLocaleString('de-DE')}</p>
                <p><strong>Gesamtsumme:</strong> ${order.total_price.toFixed(2)} €</p>
                <p><strong>Versandart:</strong> ${order.shipping_method === 'pickup' ? 'Selbstabholung' : 'Versand'}</p>
            </div>

            <h3>Rechnungsadresse</h3>
            <p>
                <strong>${customerInfo.billing.name}</strong><br>
                ${customerInfo.billing.street}<br>
                ${customerInfo.billing.zip} ${customerInfo.billing.city}<br>
                <a href="mailto:${customerInfo.email}">${customerInfo.email}</a>
            </p>

            ${hasShippingAddress ? `
                <h3 style="color: #3B82F6;">📍 Lieferadresse (abweichend)</h3>
                <p style="background: #EFF6FF; padding: 15px; border-radius: 8px; border-left: 4px solid #3B82F6;">
                    <strong>${customerInfo.shipping.name}</strong><br>
                    ${customerInfo.shipping.street}<br>
                    ${customerInfo.shipping.zip} ${customerInfo.shipping.city}
                </p>
            ` : ''}

            <h3>Bestellte Artikel</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #EA580C; color: white;">
                        <th style="padding: 8px; text-align: left;">Produkt</th>
                        <th style="padding: 8px; text-align: left;">Menge</th>
                        <th style="padding: 8px; text-align: left;">Preis</th>
                        <th style="padding: 8px; text-align: left;">Personalisierung</th>
                        <th style="padding: 8px; text-align: left;">Schriftart</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <p style="margin-top: 30px; color: #666;">
                <a href="http://localhost:3000/admin/dashboard" style="color: #EA580C;">→ Zum Admin Dashboard</a>
            </p>
        </div>
    `;

    return sendEmail(ADMIN_EMAIL, `🛒 Neue Bestellung #${order.id}`, html);
}

// Passwort-Reset E-Mail
export async function sendPasswordResetEmail(resetToken: string): Promise<boolean> {
    const resetLink = `http://localhost:3000/admin/reset-password?token=${resetToken}`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #EA580C;">Passwort zurücksetzen</h1>
            
            <p>Du hast ein neues Passwort für das Admin-Dashboard von Nicos Dekoscheune angefordert.</p>
            
            <div style="margin: 30px 0;">
                <a href="${resetLink}" 
                   style="background: #EA580C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                    Passwort zurücksetzen
                </a>
            </div>
            
            <p style="color: #666;">
                Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.<br>
                Der Link ist 1 Stunde gültig.
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 40px;">
                Nicos Dekoscheune Admin System
            </p>
        </div>
    `;

    return sendEmail(ADMIN_EMAIL, 'Passwort zurücksetzen - Nicos Dekoscheune', html);
}
