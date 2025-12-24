let allOrders = [];
let currentFilter = 'PENDING';
let currentOrder = null;

document.addEventListener('DOMContentLoaded', () => {
    loadOrders();

    document.getElementById('searchInput').addEventListener('input', (e) => {
        renderOrders(e.target.value);
    });
});

async function loadOrders() {
    try {
        const res = await fetch('/api/admin/orders');

        if (res.status === 401 || res.status === 403) {
            window.location.href = '/admin/login';
            return;
        }

        if (!res.ok) throw new Error('Failed to load: ' + res.status);

        allOrders = await res.json();
        console.log('Loaded Orders:', allOrders);
        renderOrders();
    } catch (e) {
        console.error('Loader Error:', e);
        const list = document.getElementById('ordersList');
        if (list) list.innerHTML = `<div class="text-red-400 text-center">Fehler beim Laden: ${e.message}</div>`;
    }
}

function filterStatus(status) {
    currentFilter = status;

    // Update Tabs
    // Update Tabs
    ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'].forEach(s => {
        const btn = document.getElementById(`tab-${s}`);
        if (btn) {
            if (s === status) {
                btn.classList.add('bg-orange-600', 'text-white', 'shadow');
                btn.classList.remove('text-stone-400', 'hover:bg-white/5');
            } else {
                btn.classList.remove('bg-orange-600', 'text-white', 'shadow');
                btn.classList.add('text-stone-400', 'hover:bg-white/5');
            }
        }
    });

    renderOrders(document.getElementById('searchInput').value);
}

function renderOrders(searchTerm = '') {
    const list = document.getElementById('ordersList');
    list.innerHTML = '';

    const term = searchTerm.toLowerCase();

    const filtered = allOrders.filter(o => {
        let matchesStatus = o.status === currentFilter;
        // Fallback: If filter is PENDING, also show OPEN (legacy)
        if (currentFilter === 'PENDING' && o.status === 'OPEN') {
            matchesStatus = true;
        }

        if (!matchesStatus) return false;

        const info = typeof o.customer_info === 'string' ? JSON.parse(o.customer_info) : o.customer_info;
        const name = (info.billing.name || '').toLowerCase();
        const email = (info.email || '').toLowerCase();
        const id = String(o.id);

        return name.includes(term) || email.includes(term) || id.includes(term);
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div class="text-center text-stone-500 py-8 italic">Keine Bestellungen in dieser Kategorie.</div>';
        return;
    }

    filtered.forEach(order => {
        const info = typeof order.customer_info === 'string' ? JSON.parse(order.customer_info) : order.customer_info;
        const date = new Date(order.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const el = document.createElement('div');
        el.className = 'glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-6 hover:border-orange-500/30 transition-colors cursor-pointer group';
        el.onclick = () => openModal(order);

        el.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-orange-500 font-bold font-serif">
                    #${order.id}
                </div>
                <div>
                    <h3 class="font-bold text-white group-hover:text-orange-400 transition-colors">${info.billing.name}</h3>
                    <p class="text-xs text-stone-400">${date} • ${itemCount(order.items)} Artikel</p>
                </div>
            </div>
            
            <div class="text-right">
                <span class="block text-xl font-bold text-white font-serif">${order.total_price.toFixed(2)} €</span>
                <span class="text-xs px-2 py-1 rounded bg-white/10 text-stone-400 border border-white/5 uppercase tracking-wider">${order.status}</span>
            </div>
        `;
        list.appendChild(el);
    });
}

function itemCount(items) {
    if (!items) return 0;
    return items.reduce((sum, i) => sum + i.quantity, 0);
}

// --- Modal ---

function openModal(order) {
    currentOrder = order;
    const modal = document.getElementById('orderModal');
    const info = typeof order.customer_info === 'string' ? JSON.parse(order.customer_info) : order.customer_info;
    const date = new Date(order.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    document.getElementById('modalId').textContent = order.id;
    document.getElementById('modalDate').textContent = date;

    // Customer
    const address = info.billing;
    document.getElementById('modalCustomer').innerHTML = `
        <div class="font-bold text-white">${address.name}</div>
        <div>${address.street}</div>
        <div>${address.zip} ${address.city}</div>
        <div class="mt-2 text-orange-400">${info.email}</div>
    `;

    // Payment / Shipping
    const shippingMethod = order.shipping_method === 'pickup' ? 'Selbstabholung' : 'Versand';
    document.getElementById('modalPayment').innerHTML = `
        <div>Methode: <span class="text-white">${order.payment_method}</span></div>
        <div>Versandart: <span class="text-white">${shippingMethod}</span></div>
        <div class="mt-2 pt-2 border-t border-white/10">Gesamt: <span class="text-xl font-bold text-white">${order.total_price.toFixed(2)} €</span></div>
    `;

    // Items
    const tbody = document.getElementById('modalItems');
    tbody.innerHTML = '';

    (order.items || []).forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-4">
                <div class="font-bold text-white">${item.product_name}</div>
                ${item.custom_text ? `<div class="text-xs text-orange-300 italic mt-1">"${item.custom_text}"</div>` : ''}
            </td>
            <td class="p-4">${item.quantity}x</td>
            <td class="p-4">${item.price_at_purchase.toFixed(2)} €</td>
            <td class="p-4 font-bold text-white">${(item.quantity * item.price_at_purchase).toFixed(2)} €</td>
        `;
        tbody.appendChild(row);
    });

    generateEmailTemplate(order, info);

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('orderModal').classList.add('hidden');
    currentOrder = null;
}

// --- Actions ---

async function updateStatus(s) {
    if (!currentOrder) return;
    if (!confirm(`Status auf ${s} ändern?`)) return;

    try {
        const res = await fetch(`/api/admin/orders/${currentOrder.id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: s })
        });
        if (res.ok) {
            // Update local object
            currentOrder.status = s;
            // Reload list to refresh
            loadOrders();
            // Keep modal open or close? Keep open but refresh visuals?
            // Simple: just notify success
            alert('Status aktualisiert!');
            closeModal();
        } else {
            alert('Fehler beim Speichern');
        }
    } catch (e) {
        console.error(e);
        alert('Fehler');
    }
}

function generateEmailTemplate(order, info) {
    const templateBox = document.getElementById('emailTemplate');
    const name = info.billing.name.split(' ')[0]; // First name guess

    let text = `Hallo ${name},\n\n`;
    text += `vielen Dank für deine Bestellung bei Nicos Dekoscheune (Bestell-Nr. #${order.id}).\n\n`;

    if (order.status === 'PENDING') {
        text += `Wir haben deine Bestellung erhalten und prüfen diese nun.\n`;
        text += `Sobald wir die Verfügbarkeit bestätigt haben, erhältst du eine weitere E-Mail mit den Zahlungsinformationen.\n\n`;
    } else if (order.status === 'PROCESSING') {
        text += `Deine Bestellung wurde angenommen! Bitte überweise den Betrag von ${order.total_price.toFixed(2)}€ an folgendes PayPal-Konto: [DEIN PAYPAL].\n`;
        text += `Sobald die Zahlung eingegangen ist, machen wir dein Paket fertig.\n\n`;
    } else if (order.status === 'COMPLETED') {
        if (order.shipping_method === 'pickup') {
            text += `Gute Nachrichten: Deine Bestellung liegt zur Abholung bereit!\n`;
            text += `Bitte melde dich kurz zwecks Terminvereinbarung.\n\n`;
        } else {
            text += `Gute Nachrichten: Dein Paket wurde versendet!\n`;
            text += `Es sollte in 2-3 Werktagen bei dir ankommen.\n\n`;
        }
    }

    text += `Bestellübersicht:\n`;
    order.items.forEach(i => {
        text += `- ${i.quantity}x ${i.product_name}`;
        if (i.custom_text) text += ` (Individualisierung: ${i.custom_text})`;
        text += `\n`;
    });
    text += `\nGesamtsumme: ${order.total_price.toFixed(2)} €\n\n`;
    text += `Liebe Grüße,\nNico von Nicos Dekoscheune`;

    templateBox.value = text;
}

function copyEmail() {
    const el = document.getElementById('emailTemplate');
    el.select();
    document.execCommand('copy');
    alert('Vorlage kopiert!');
}

function logout() {
    // Implement logout logic (fetch api logout or delete cookie)
    document.cookie = 'token=; Max-Age=0; path=/;';
    window.location.href = '/admin/login';
}
